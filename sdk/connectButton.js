/**
 * IntegratedDEX WaaS SDK — Embed-ready Connect Button
 *
 * Injects a fully-styled, framework-free connect button into any HTML element.
 * Works with plain HTML — no React, Vue, or other framework required.
 *
 * Features:
 *   - Opens wallet modal on click
 *   - Shows truncated address + balance when connected
 *   - Displays chain icon based on connected network
 *   - Dropdown with disconnect option when connected
 *   - Pure CSS + vanilla JS
 *
 * Usage:
 *   import { injectConnectButton } from './sdk/connectButton.js'
 *
 *   injectConnectButton('#header', {
 *     buttonText: 'Connect Wallet',
 *     theme: 'dark',
 *     showAddress: true,
 *     showBalance: true,
 *     showChainIcon: true,
 *   })
 */

import { initWalletModal, openWalletModal, closeWalletModal, getWalletState, disconnectWallet } from "./walletModal.js";
import { shortenAddress, SUPPORTED_CHAINS } from "./utils.js";

// ─── Chain Icons (inline SVG / emoji fallbacks) ───────────────────────────────

const CHAIN_ICONS = {
  1: "⟠",      // Ethereum
  56: "🔶",    // BNB / BSC
  137: "🟣",   // Polygon
  43114: "🔺", // Avalanche
  42161: "🔵", // Arbitrum
  10: "🔴",    // Optimism
  8453: "🔵",  // Base
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

const DARK_CSS = `
  .waasbtn-wrap *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
  .waasbtn-wrap{position:relative;display:inline-block}
  .waasbtn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;
    border:none;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s ease;
    background:#1a1b1f;color:#fff;border:1px solid rgba(255,255,255,0.1)}
  .waasbtn:hover{background:#2a2b30;border-color:rgba(255,255,255,0.2)}
  .waasbtn.connected{background:#1a1b1f;padding-right:12px}
  .waasbtn__dot{width:8px;height:8px;border-radius:50%;background:#30e000;flex-shrink:0}
  .waasbtn__chain{font-size:16px;line-height:1}
  .waasbtn__addr{color:#fff;font-size:13px}
  .waasbtn__balance{color:rgba(255,255,255,0.6);font-size:12px}
  .waasbtn__caret{color:rgba(255,255,255,0.4);font-size:10px;margin-left:2px}
  .waasbtn__dropdown{display:none;position:absolute;top:calc(100% + 6px);right:0;min-width:180px;
    background:#1a1b1f;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:9999}
  .waasbtn__dropdown.open{display:block}
  .waasbtn__menu-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;
    font-size:13px;font-weight:500;cursor:pointer;color:#fff;transition:background 0.15s}
  .waasbtn__menu-item:hover{background:rgba(255,255,255,0.08)}
  .waasbtn__menu-item.disconnect{color:#ff4d4d}
  .waasbtn__menu-item.disconnect:hover{background:rgba(255,77,77,0.1)}
  .waasbtn__divider{height:1px;background:rgba(255,255,255,0.08);margin:4px 0}
`;

const LIGHT_CSS = `
  .waasbtn-wrap *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
  .waasbtn-wrap{position:relative;display:inline-block}
  .waasbtn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;
    border:none;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s ease;
    background:#fff;color:#1a1b1f;border:1px solid rgba(0,0,0,0.1);box-shadow:0 2px 8px rgba(0,0,0,0.06)}
  .waasbtn:hover{background:#f7f8fa;border-color:rgba(0,0,0,0.15)}
  .waasbtn.connected{background:#fff;padding-right:12px}
  .waasbtn__dot{width:8px;height:8px;border-radius:50%;background:#30e000;flex-shrink:0}
  .waasbtn__chain{font-size:16px;line-height:1}
  .waasbtn__addr{color:#1a1b1f;font-size:13px}
  .waasbtn__balance{color:rgba(26,27,31,0.5);font-size:12px}
  .waasbtn__caret{color:rgba(0,0,0,0.3);font-size:10px;margin-left:2px}
  .waasbtn__dropdown{display:none;position:absolute;top:calc(100% + 6px);right:0;min-width:180px;
    background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:9999}
  .waasbtn__dropdown.open{display:block}
  .waasbtn__menu-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;
    font-size:13px;font-weight:500;cursor:pointer;color:#1a1b1f;transition:background 0.15s}
  .waasbtn__menu-item:hover{background:rgba(0,0,0,0.05)}
  .waasbtn__menu-item.disconnect{color:#e00}
  .waasbtn__menu-item.disconnect:hover{background:rgba(220,0,0,0.06)}
  .waasbtn__divider{height:1px;background:rgba(0,0,0,0.07);margin:4px 0}
`;

// ─── Inject CSS ───────────────────────────────────────────────────────────────

function injectCSS(theme) {
  const id = `waasbtn-style-${theme}`;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = theme === "light" ? LIGHT_CSS : DARK_CSS;
  document.head.appendChild(style);
}

// ─── Connect Button ───────────────────────────────────────────────────────────

/**
 * Inject a styled connect button into the target element.
 *
 * @param {string} targetSelector         CSS selector for the container element
 * @param {object} [options]
 * @param {string}  [options.buttonText='Connect Wallet']  Button label (disconnected state)
 * @param {string}  [options.connectedText='Connected']    Label prefix (connected state)
 * @param {string}  [options.theme='dark']                 'dark' | 'light'
 * @param {boolean} [options.showAddress=true]             Show truncated address when connected
 * @param {boolean} [options.showBalance=true]             Show native balance when connected
 * @param {boolean} [options.showChainIcon=true]           Show chain emoji icon when connected
 * @param {string}  [options.provider='web3modal']         'web3modal' | 'rainbowkit'
 * @param {string}  [options.projectId]                    WalletConnect project ID (required)
 * @param {number[]} [options.chains=[1]]                  Supported chain IDs
 * @param {string}  [options.appName='IntegratedDEX']      App name for modal
 * @param {string}  [options.modalTheme='dark']            Modal theme
 * @returns {{ update: function, destroy: function }}  Control handle
 */
export function injectConnectButton(targetSelector, options = {}) {
  const {
    buttonText = "Connect Wallet",
    theme = "dark",
    showAddress = true,
    showBalance = true,
    showChainIcon = true,
    provider = "web3modal",
    projectId,
    chains = [1],
    appName = "IntegratedDEX",
    modalTheme = theme,
  } = options;

  const container = document.querySelector(targetSelector);
  if (!container) {
    throw new Error(`injectConnectButton: element not found for selector '${targetSelector}'`);
  }

  if (!projectId) {
    throw new Error("injectConnectButton: options.projectId is required");
  }

  // Inject CSS
  injectCSS(theme);

  // Create wrapper + button elements
  const wrap = document.createElement("div");
  wrap.className = "waasbtn-wrap";

  const btn = document.createElement("button");
  btn.className = "waasbtn";
  btn.textContent = buttonText;

  const dropdown = document.createElement("div");
  dropdown.className = "waasbtn__dropdown";

  wrap.appendChild(btn);
  wrap.appendChild(dropdown);
  container.appendChild(wrap);

  // ─── State ─────────────────────────────────────────────────────────────────

  let _connected = false;
  let _address = null;
  let _chainId = null;
  let _balance = null;
  let _dropdownOpen = false;
  let _providerReady = false;

  // ─── Provider init ─────────────────────────────────────────────────────────

  initWalletModal({
    provider,
    projectId,
    chains,
    appName,
    theme: modalTheme,
    onConnect: ({ address, chainId }) => {
      _connected = true;
      _address = address;
      _chainId = chainId;
      _fetchBalance(address, chainId);
      _render();
    },
    onDisconnect: () => {
      _connected = false;
      _address = null;
      _chainId = null;
      _balance = null;
      _render();
    },
    onChainChange: (chainId) => {
      _chainId = chainId;
      if (_address) _fetchBalance(_address, chainId);
      _render();
    },
  }).then(() => {
    _providerReady = true;
    // Restore state if already connected
    const state = getWalletState();
    if (state.connected) {
      _connected = true;
      _address = state.address;
      _chainId = state.chainId;
      _fetchBalance(state.address, state.chainId);
    }
    _render();
  }).catch((err) => {
    console.error("[ConnectButton] Provider init failed:", err);
  });

  // ─── Balance Fetcher ───────────────────────────────────────────────────────

  async function _fetchBalance(address, chainId) {
    if (!showBalance) return;
    try {
      const chainInfo = SUPPORTED_CHAINS[chainId];
      if (!chainInfo) return;
      const rpc = chainInfo.rpcUrls.default.http[0];
      const body = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = await res.json();
      if (json.result) {
        const weiHex = json.result;
        const wei = BigInt(weiHex);
        const eth = Number(wei) / 1e18;
        const symbol = chainInfo.nativeCurrency.symbol;
        _balance = `${eth.toFixed(4)} ${symbol}`;
        _render();
      }
    } catch {
      _balance = null;
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  function _render() {
    btn.innerHTML = "";
    dropdown.innerHTML = "";

    if (!_connected) {
      btn.className = "waasbtn";
      btn.textContent = buttonText;
      return;
    }

    btn.className = "waasbtn connected";

    if (showChainIcon && _chainId) {
      const icon = document.createElement("span");
      icon.className = "waasbtn__chain";
      icon.textContent = CHAIN_ICONS[_chainId] ?? "🔗";
      btn.appendChild(icon);
    }

    const dot = document.createElement("span");
    dot.className = "waasbtn__dot";
    btn.appendChild(dot);

    if (showAddress && _address) {
      const addr = document.createElement("span");
      addr.className = "waasbtn__addr";
      addr.textContent = shortenAddress(_address);
      btn.appendChild(addr);
    }

    if (showBalance && _balance) {
      const bal = document.createElement("span");
      bal.className = "waasbtn__balance";
      bal.textContent = _balance;
      btn.appendChild(bal);
    }

    const caret = document.createElement("span");
    caret.className = "waasbtn__caret";
    caret.textContent = _dropdownOpen ? "▲" : "▼";
    btn.appendChild(caret);

    // Dropdown contents
    if (_address) {
      const addrItem = document.createElement("div");
      addrItem.className = "waasbtn__menu-item";
      addrItem.innerHTML = `<span>📋</span><span>${_address.slice(0, 6)}...${_address.slice(-4)}</span>`;
      addrItem.title = "Click to copy";
      addrItem.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(_address).catch(() => {});
        addrItem.querySelector("span:last-child").textContent = "Copied!";
        setTimeout(() => {
          addrItem.querySelector("span:last-child").textContent = `${_address.slice(0, 6)}...${_address.slice(-4)}`;
        }, 1500);
      });
      dropdown.appendChild(addrItem);
    }

    if (_chainId) {
      const chainInfo = SUPPORTED_CHAINS[_chainId];
      const chainItem = document.createElement("div");
      chainItem.className = "waasbtn__menu-item";
      chainItem.innerHTML = `<span>${CHAIN_ICONS[_chainId] ?? "🔗"}</span><span>${chainInfo?.name ?? `Chain ${_chainId}`}</span>`;
      dropdown.appendChild(chainItem);
    }

    const divider = document.createElement("div");
    divider.className = "waasbtn__divider";
    dropdown.appendChild(divider);

    const disconnectItem = document.createElement("div");
    disconnectItem.className = "waasbtn__menu-item disconnect";
    disconnectItem.innerHTML = `<span>🔌</span><span>Disconnect</span>`;
    disconnectItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      _closeDropdown();
      await disconnectWallet();
    });
    dropdown.appendChild(disconnectItem);
  }

  // ─── Dropdown ──────────────────────────────────────────────────────────────

  function _openDropdown() {
    _dropdownOpen = true;
    dropdown.classList.add("open");
    const caret = btn.querySelector(".waasbtn__caret");
    if (caret) caret.textContent = "▲";
  }

  function _closeDropdown() {
    _dropdownOpen = false;
    dropdown.classList.remove("open");
    const caret = btn.querySelector(".waasbtn__caret");
    if (caret) caret.textContent = "▼";
  }

  // ─── Event Listeners ───────────────────────────────────────────────────────

  btn.addEventListener("click", async () => {
    if (!_providerReady) return;

    if (_connected) {
      _dropdownOpen ? _closeDropdown() : _openDropdown();
      return;
    }

    // Not connected — open wallet modal
    try {
      await openWalletModal();
    } catch (err) {
      console.error("[ConnectButton] Failed to open modal:", err);
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (_dropdownOpen && !wrap.contains(e.target)) {
      _closeDropdown();
    }
  });

  // ─── Control Handle ────────────────────────────────────────────────────────

  return {
    /**
     * Force a re-render (useful if you manually update the wallet state elsewhere).
     */
    update() {
      const state = getWalletState();
      _connected = state.connected;
      _address = state.address;
      _chainId = state.chainId;
      _render();
    },
    /**
     * Remove the button from the DOM.
     */
    destroy() {
      container.removeChild(wrap);
    },
    /**
     * Programmatically open the wallet modal.
     * @returns {Promise<void>}
     */
    openModal() {
      return openWalletModal();
    },
    /**
     * Programmatically close the wallet modal.
     */
    closeModal() {
      return closeWalletModal();
    },
  };
}
