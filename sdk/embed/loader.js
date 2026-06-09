/*!
 * IntegratedDEX WaaS SDK — Lightweight Loader
 * 
 * This script does NOT contain transaction logic, ABIs, or routing.
 * It injects a secure iframe from your backend that handles:
 *   - Wallet connection (AppKit modal)
 *   - Execution strategy (direct/permit2/multicall/eip7702/session)
 *   - Gas sponsorship decisions
 *   - Transaction signing and relay
 *
 * The host page communicates via postMessage with signed payloads.
 * All sensitive logic lives server-side — upgradeable, rate-limited, protected.
 *
 * Usage:
 *   <script 
 *     src="https://yourdomain.com/sdk/loader.js"
 *     data-project="wsk_your_project_api_key"
 *     data-theme="dark"
 *   ></script>
 *
 * API:
 *   WaaS.connect()           — Open wallet modal
 *   WaaS.disconnect()        — Disconnect wallet
 *   WaaS.execute(action)     — Execute configured action (backend decides how)
 *   WaaS.on(event, callback) — Listen to events
 *   WaaS.getState()          — Current wallet state
 */

(function() {
  "use strict";

  // ── Read config from script tag ───────────────────────────────────────────
  const scriptTag = document.currentScript || document.querySelector("script[data-project]");
  const PROJECT_KEY = scriptTag?.getAttribute("data-project") || "";
  const THEME = scriptTag?.getAttribute("data-theme") || "dark";
  const ORIGIN = scriptTag?.getAttribute("data-origin") || scriptTag?.src.replace(/\/sdk\/loader\.js.*$/, "") || "";
  const IFRAME_URL = `${ORIGIN}/sdk/frame.html`;

  if (!PROJECT_KEY) {
    console.error("[WaaS] Missing data-project attribute on script tag");
    return;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    ready: false,
    connected: false,
    account: null,
    chainId: null,
    balance: null,
  };

  const listeners = {};
  let iframe = null;
  let pendingCallbacks = {};
  let callId = 0;

  // ── Event system ──────────────────────────────────────────────────────────
  function emit(event, data) {
    (listeners[event] || []).forEach(fn => {
      try { fn(data); } catch(e) { console.error("[WaaS] Event handler error:", e); }
    });
  }

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
  }

  function off(event, fn) {
    if (listeners[event]) listeners[event] = listeners[event].filter(f => f !== fn);
  }

  // ── Iframe injection ──────────────────────────────────────────────────────
  function injectIframe() {
    iframe = document.createElement("iframe");
    iframe.id = "__waas_frame__";
    iframe.src = `${IFRAME_URL}?project=${encodeURIComponent(PROJECT_KEY)}&theme=${THEME}`;
    iframe.style.cssText = "display:none;position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:2147483647;background:transparent;";
    iframe.setAttribute("allow", "clipboard-write; payment; publickey-credentials-get");
    document.body.appendChild(iframe);
  }

  // ── PostMessage communication ─────────────────────────────────────────────
  function send(type, payload) {
    return new Promise((resolve, reject) => {
      if (!iframe?.contentWindow) {
        reject(new Error("WaaS iframe not ready"));
        return;
      }

      const id = ++callId;
      const timeout = setTimeout(() => {
        delete pendingCallbacks[id];
        reject(new Error("WaaS request timeout"));
      }, 30000);

      pendingCallbacks[id] = { resolve, reject, timeout };

      iframe.contentWindow.postMessage({
        source: "waas-host",
        id,
        type,
        payload,
        project: PROJECT_KEY,
      }, ORIGIN);
    });
  }

  function handleMessage(event) {
    // Only accept messages from our iframe origin
    if (event.origin !== new URL(ORIGIN).origin) return;
    const msg = event.data;
    if (!msg || msg.source !== "waas-frame") return;

    // Response to a pending call
    if (msg.id && pendingCallbacks[msg.id]) {
      const cb = pendingCallbacks[msg.id];
      clearTimeout(cb.timeout);
      delete pendingCallbacks[msg.id];
      if (msg.error) cb.reject(new Error(msg.error));
      else cb.resolve(msg.result);
      return;
    }

    // Events from iframe
    switch (msg.type) {
      case "ready":
        state.ready = true;
        emit("ready", state);
        break;

      case "connect":
        state.connected = true;
        state.account = msg.data.account;
        state.chainId = msg.data.chainId;
        state.balance = msg.data.balance;
        emit("connect", { account: state.account, chainId: state.chainId, balance: state.balance });
        updateUI();
        break;

      case "disconnect":
        state.connected = false;
        state.account = null;
        state.chainId = null;
        state.balance = null;
        emit("disconnect", {});
        updateUI();
        break;

      case "chainChanged":
        state.chainId = msg.data.chainId;
        emit("chainChanged", { chainId: state.chainId });
        updateUI();
        break;

      case "tx:submitted":
        emit("tx:submitted", msg.data);
        break;

      case "tx:confirmed":
        emit("tx:confirmed", msg.data);
        break;

      case "tx:failed":
        emit("tx:failed", msg.data);
        break;

      case "modal:open":
        iframe.style.display = "block";
        break;

      case "modal:close":
        iframe.style.display = "none";
        break;

      case "error":
        emit("error", msg.data);
        break;
    }
  }

  // ── UI binding (data attributes) ──────────────────────────────────────────
  function updateUI() {
    document.querySelectorAll("[data-waas-connect]").forEach(el => {
      el.textContent = state.connected 
        ? `${state.account.slice(0,6)}…${state.account.slice(-4)}`
        : el.getAttribute("data-waas-connect") || "Connect Wallet";
    });

    document.querySelectorAll("[data-waas-address]").forEach(el => {
      el.textContent = state.account ? `${state.account.slice(0,6)}…${state.account.slice(-4)}` : "";
    });

    document.querySelectorAll("[data-waas-status]").forEach(el => {
      el.textContent = state.connected ? "Connected" : "Disconnected";
      el.dataset.connected = state.connected ? "true" : "false";
    });

    document.querySelectorAll("[data-waas-chain]").forEach(el => {
      el.textContent = state.chainId ? `Chain ${state.chainId}` : "";
    });
  }

  // ── Click handlers ────────────────────────────────────────────────────────
  function bindClicks() {
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-waas-connect]");
      if (target) {
        e.preventDefault();
        if (state.connected) {
          WaaS.disconnect();
        } else {
          if (iframe) iframe.style.display = "block";
          WaaS.connect();
        }
      }

      const exec = e.target.closest("[data-waas-execute]");
      if (exec) {
        e.preventDefault();
        const action = exec.getAttribute("data-waas-execute");
        WaaS.execute(action);
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  const WaaS = {
    // State
    getState: () => ({ ...state }),
    isConnected: () => state.connected,
    getAccount: () => state.account,
    getChainId: () => state.chainId,

    // Actions — all routed through iframe → backend
    connect: () => {
      // Show iframe immediately so user sees the modal
      if (iframe) iframe.style.display = "block";
      return send("connect", {});
    },
    disconnect: () => send("disconnect", {}),
    switchChain: (chainId) => send("switchChain", { chainId }),

    /**
     * Execute an action — the backend decides the strategy:
     * - Which contract to call
     * - Whether to use permit2, session keys, or direct
     * - Whether to sponsor gas
     * - How to batch calls
     *
     * The host page NEVER sees ABIs, routing logic, or private execution details.
     */
    execute: (action, params) => send("execute", { action, params }),

    /**
     * Request a signature — backend builds the typed data,
     * iframe presents it to the user, result goes back to backend.
     */
    sign: (signatureRequest) => send("sign", signatureRequest),

    // Events
    on,
    off,
    once: (event, fn) => {
      const unsub = on(event, (data) => { unsub(); fn(data); });
      return unsub;
    },
  };

  // ── Initialize ────────────────────────────────────────────────────────────
  function init() {
    window.addEventListener("message", handleMessage);
    bindClicks();

    if (document.body) {
      injectIframe();
    } else {
      document.addEventListener("DOMContentLoaded", injectIframe);
    }
  }

  // Expose globally
  window.WaaS = WaaS;

  init();
})();
