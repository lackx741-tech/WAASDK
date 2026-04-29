/**
 * IntegratedDEX WaaS SDK — Dashboard Logic
 *
 * Handles:
 *  - Sidebar tab navigation
 *  - Config form state
 *  - ABI parsing → function dropdown
 *  - 🧪 Live Contract Test Panel (read + write functions, tx preview)
 *  - 📡 Live Event Log
 *  - 🚀 script.js generation + copy/download
 */

// ─── Ethers Loader ────────────────────────────────────────────────────────────
//
// Prefers the locally-installed ethers package (resolved by Vite / a bundler).
// Falls back to a pinned CDN URL only when this file is opened as a raw HTML
// file without a build step (demo / standalone mode).
//
// ⚠️  Production note: always serve through `npm run build` so the CDN path
// is never reached and the bundle is verified at build time.
//
async function loadEthers() {
  try {
    // Vite / bundler resolves this to the locally-installed package.
    return await import("ethers");
  } catch {
    // Standalone fallback — only reached when no bundler is present.
    return import("https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.min.js");
  }
}

// ─── Tab Navigation ──────────────────────────────────────────────────────────

const tabBtns   = document.querySelectorAll(".sidebar__item");
const tabPanels = document.querySelectorAll(".tab-panel");

function switchTab(id) {
  tabPanels.forEach((p) => (p.style.display = "none"));
  tabBtns.forEach((b) => b.classList.remove("sidebar__item--active"));

  const panel = document.getElementById(`tab-${id}`);
  const btn   = document.querySelector(`[data-tab="${id}"]`);
  if (panel) panel.style.display = "";
  if (btn)   btn.classList.add("sidebar__item--active");
}

tabBtns.forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab))
);

// ─── ABI Parser (Contract Tab) ───────────────────────────────────────────────

const parseAbiBtn    = document.getElementById("parse-abi-btn");
const cfgAbi         = document.getElementById("cfg-abi");
const cfgDefaultFn   = document.getElementById("cfg-default-fn");
const parseResult    = document.getElementById("parse-result");

function parseAbi() {
  const raw = cfgAbi.value.trim();
  if (!raw) {
    parseResult.innerHTML = `<div class="alert alert--warning">⚠️ ABI field is empty.</div>`;
    return null;
  }

  let abi;
  try {
    abi = JSON.parse(raw);
  } catch {
    parseResult.innerHTML = `<div class="alert alert--danger">❌ Invalid JSON — check your ABI format.</div>`;
    return null;
  }

  if (!Array.isArray(abi)) {
    parseResult.innerHTML = `<div class="alert alert--danger">❌ ABI must be a JSON array.</div>`;
    return null;
  }

  const fns = abi.filter((e) => e.type === "function");
  if (!fns.length) {
    parseResult.innerHTML = `<div class="alert alert--warning">⚠️ No functions found in ABI.</div>`;
    return null;
  }

  cfgDefaultFn.innerHTML = fns
    .map((f) => {
      const sig = fnSignature(f);
      return `<option value="${escAttr(f.name)}">${escHtml(sig)}</option>`;
    })
    .join("");

  parseResult.innerHTML = `<div class="alert alert--success">✅ Parsed ${fns.length} function(s) from ABI.</div>`;
  return abi;
}

parseAbiBtn.addEventListener("click", parseAbi);

// ─── Helper: Build function signature string ──────────────────────────────────

function fnSignature(fn) {
  const inputs = (fn.inputs ?? []).map((i) => `${i.type} ${i.name ?? ""}`.trim()).join(", ");
  return `${fn.name}(${inputs})`;
}

// ─── HTML escaping helpers ────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function escAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

// ─── 🧪 Live Contract Test Panel ─────────────────────────────────────────────

const loadFnsBtn    = document.getElementById("load-fns-btn");
const fnList        = document.getElementById("fn-list");
const fnCount       = document.getElementById("fn-count");
const fnCaller      = document.getElementById("fn-caller");
const fnCallerTitle = document.getElementById("fn-caller-title");
const fnArgs        = document.getElementById("fn-args");
const fnCallBtn     = document.getElementById("fn-call-btn");
const fnResult      = document.getElementById("fn-result");
const testBanner    = document.getElementById("test-banner");

let currentFn   = null;
let parsedAbi   = null;

loadFnsBtn.addEventListener("click", loadFunctions);

function loadFunctions() {
  const address = document.getElementById("cfg-contract-address").value.trim();
  const abiRaw  = document.getElementById("cfg-abi").value.trim();

  if (!address) {
    testBanner.className = "alert alert--warning";
    testBanner.innerHTML = "⚠️ No contract address found. Please fill it in the <strong>📄 Contract</strong> tab.";
    return;
  }

  if (!abiRaw) {
    testBanner.className = "alert alert--warning";
    testBanner.innerHTML = "⚠️ No ABI found. Please paste it in the <strong>📄 Contract</strong> tab.";
    return;
  }

  let abi;
  try {
    abi = JSON.parse(abiRaw);
  } catch {
    testBanner.className = "alert alert--danger";
    testBanner.innerHTML = "❌ Invalid ABI JSON. Please fix it in the <strong>📄 Contract</strong> tab.";
    return;
  }

  parsedAbi = abi;
  const fns = abi.filter((e) => e.type === "function");

  if (!fns.length) {
    testBanner.className = "alert alert--warning";
    testBanner.innerHTML = "⚠️ No functions found in ABI.";
    return;
  }

  testBanner.className = "alert alert--success";
  testBanner.innerHTML = `✅ Loaded <strong>${fns.length}</strong> function(s) from <code>${escHtml(address)}</code>`;

  fnCount.textContent = `${fns.length} function(s) found`;
  logEvent("info", `Loaded ${fns.length} function(s) from ${address}`);

  renderFnList(fns);
}

function renderFnList(fns) {
  fnList.innerHTML = "";
  fnCaller.style.display = "none";
  fnResult.style.display = "none";

  fns.forEach((fn) => {
    const isRead  = ["view", "pure"].includes(fn.stateMutability) || fn.constant;
    const sig     = fnSignature(fn);
    const item    = document.createElement("div");
    item.className = "fn-item";
    item.innerHTML = `
      <span class="fn-item__name">${escHtml(sig)}</span>
      <span class="fn-badge fn-badge--${isRead ? "read" : "write"}">${isRead ? "Read" : "Write"}</span>`;
    item.addEventListener("click", () => selectFunction(fn, isRead));
    fnList.appendChild(item);
  });
}

function selectFunction(fn, isRead) {
  currentFn = { fn, isRead };
  fnCaller.style.display = "";
  fnResult.style.display = "none";
  fnResult.textContent   = "";

  const sig = fnSignature(fn);
  fnCallerTitle.textContent = `${isRead ? "📖 Call (read)" : "✍️ Send (write)"}: ${sig}`;

  // Style the call button
  fnCallBtn.className = `btn btn--block ${isRead ? "btn--read" : "btn--write"}`;
  fnCallBtn.textContent = isRead ? "📖 Call" : "✍️ Send";

  // Highlight active
  document.querySelectorAll(".fn-item").forEach((el) => el.classList.remove("fn-item--active"));
  event.currentTarget.classList.add("fn-item--active");

  // Render argument inputs
  fnArgs.innerHTML = "";
  (fn.inputs ?? []).forEach((input, i) => {
    const div   = document.createElement("div");
    div.className = "arg-group";
    const label = document.createElement("label");
    label.htmlFor = `arg-input-${i}`;
    label.textContent = `${input.name || `arg${i}`}: ${input.type}`;
    const inp = document.createElement("input");
    inp.type  = "text";
    inp.id    = `arg-input-${i}`;
    inp.placeholder = input.type;
    div.appendChild(label);
    div.appendChild(inp);
    fnArgs.appendChild(div);
  });

  logEvent("info", `Selected: ${sig}`);
}

fnCallBtn.addEventListener("click", async () => {
  if (!currentFn) return;
  const { fn, isRead } = currentFn;
  const address = document.getElementById("cfg-contract-address").value.trim();
  const args = collectArgs(fn);

  if (isRead) {
    await executeRead(fn, args, address);
  } else {
    showTxPreview(fn, args, address);
  }
});

function collectArgs(fn) {
  return (fn.inputs ?? []).map((_, i) => {
    const el = document.getElementById(`arg-input-${i}`);
    return el ? el.value.trim() : "";
  });
}

// ─── Read function ────────────────────────────────────────────────────────────

async function executeRead(fn, args, contractAddress) {
  fnCallBtn.disabled = true;
  fnCallBtn.innerHTML = '<span class="spinner"></span> Calling…';
  fnResult.style.display  = "";
  fnResult.textContent = "Calling…";

  logEvent("info", `Calling ${fn.name}(${args.join(", ")}) on ${contractAddress}`);

  try {
    // Try to use window.ethereum if available; otherwise simulate
    if (typeof window !== "undefined" && window.ethereum) {
      const { ethers } = await loadEthers();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, parsedAbi, provider);
      const result   = await contract[fn.name](...args);
      const display  = typeof result === "bigint" ? result.toString() : JSON.stringify(result, null, 2);
      fnResult.textContent = display;
      logEvent("success", `${fn.name}() → ${display}`);
    } else {
      // Fallback simulation for demo purposes
      await delay(600);
      const simResult = `[Simulation] ${fn.name}() returned: "0x0000…" (connect wallet for live results)`;
      fnResult.textContent = simResult;
      logEvent("warn", simResult);
    }
  } catch (err) {
    fnResult.textContent = `Error: ${err.message}`;
    logEvent("error", `${fn.name}() failed: ${err.message}`);
  } finally {
    fnCallBtn.disabled    = false;
    fnCallBtn.textContent = "📖 Call";
  }
}

// ─── Transaction Preview Modal ────────────────────────────────────────────────

const txOverlay  = document.getElementById("tx-overlay");
const txCancel   = document.getElementById("tx-cancel-btn");
const txSend     = document.getElementById("tx-send-btn");

let pendingTxFn   = null;
let pendingTxArgs = null;
let pendingTxAddr = null;

function showTxPreview(fn, args, contractAddress) {
  pendingTxFn   = fn;
  pendingTxArgs = args;
  pendingTxAddr = contractAddress;

  const sig   = fnSignature(fn);
  const argDisplay = fn.inputs && fn.inputs.length
    ? fn.inputs.map((inp, i) => `${inp.name || `arg${i}`} = ${args[i] ?? ""}` ).join(", ")
    : "none";

  document.getElementById("tx-contract").textContent = contractAddress;
  document.getElementById("tx-function").textContent = sig;
  document.getElementById("tx-args").textContent     = argDisplay;
  document.getElementById("tx-gas").textContent      = "~65,000";

  txOverlay.style.display = "flex";
  logEvent("warn", `Transaction preview shown for ${fn.name}()`);
}

txCancel.addEventListener("click", () => {
  txOverlay.style.display = "none";
  logEvent("info", "Transaction cancelled by user");
  pendingTxFn   = null;
  pendingTxArgs = null;
  pendingTxAddr = null;
});

txSend.addEventListener("click", async () => {
  txOverlay.style.display = "none";
  if (!pendingTxFn) return;
  await executeWrite(pendingTxFn, pendingTxArgs, pendingTxAddr);
  pendingTxFn   = null;
  pendingTxArgs = null;
  pendingTxAddr = null;
});

txOverlay.addEventListener("click", (e) => {
  if (e.target === txOverlay) {
    txOverlay.style.display = "none";
    logEvent("info", "Transaction cancelled by user");
  }
});

// ─── Write function ───────────────────────────────────────────────────────────

async function executeWrite(fn, args, contractAddress) {
  fnCallBtn.disabled = true;
  fnCallBtn.innerHTML = '<span class="spinner"></span> Sending…';
  fnResult.style.display  = "";
  fnResult.textContent = "Sending transaction…";

  logEvent("warn", `Sending ${fn.name}(${args.join(", ")})…`);

  try {
    if (typeof window !== "undefined" && window.ethereum) {
      const { ethers } = await loadEthers();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, parsedAbi, signer);
      const tx       = await contract[fn.name](...args);

      logEvent("warn", `TX pending: ${tx.hash}`);
      fnResult.textContent = `TX pending: ${tx.hash}\nWaiting for confirmation…`;

      const receipt = await tx.wait();
      const chainId = (await provider.getNetwork()).chainId;
      const explorerBase = getExplorer(Number(chainId));
      const txUrl   = `${explorerBase}/tx/${receipt.hash}`;

      fnResult.innerHTML = `✅ Confirmed in block ${receipt.blockNumber}\n<a href="${txUrl}" target="_blank" rel="noopener">${txUrl}</a>`;
      logEvent("success", `TX confirmed: ${receipt.hash} (block ${receipt.blockNumber})`);
    } else {
      await delay(800);
      const fakeTx = "0x" + "a".repeat(64);
      fnResult.textContent = `[Simulation] TX hash: ${fakeTx}\n(connect wallet for live transactions)`;
      logEvent("warn", `[Simulation] TX hash: ${fakeTx}`);
    }
  } catch (err) {
    fnResult.textContent = `Error: ${err.message}`;
    logEvent("error", `${fn.name}() failed: ${err.message}`);
  } finally {
    fnCallBtn.disabled    = false;
    fnCallBtn.textContent = "✍️ Send";
  }
}

function getExplorer(chainId) {
  const map = {
    1: "https://etherscan.io",
    56: "https://bscscan.com",
    137: "https://polygonscan.com",
    43114: "https://snowtrace.io",
    42161: "https://arbiscan.io",
    10: "https://optimistic.etherscan.io",
    8453: "https://basescan.org",
  };
  return map[chainId] ?? "https://etherscan.io";
}

// ─── Event Log ────────────────────────────────────────────────────────────────

const eventLog   = document.getElementById("event-log");
const clearLogBtn = document.getElementById("clear-log-btn");
let logInitialized = false;

function logEvent(level, message) {
  if (!logInitialized) {
    eventLog.innerHTML = "";
    logInitialized = true;
  }

  const now  = new Date();
  const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const entry = document.createElement("div");
  entry.className = `log-entry log-entry--${level}`;
  entry.innerHTML = `<span class="log-entry__time">[${time}]</span><span class="log-entry__msg">${escHtml(message)}</span>`;
  eventLog.appendChild(entry);
  eventLog.scrollTop = eventLog.scrollHeight;
}

clearLogBtn.addEventListener("click", () => {
  eventLog.innerHTML = `<div class="log-empty">Events will appear here…</div>`;
  logInitialized = false;
});

// ─── Wallet Connect (connect-btn) ─────────────────────────────────────────────

const connectBtn    = document.getElementById("connect-btn");
const disconnectBtn = document.getElementById("disconnect-btn");
const walletBar     = document.getElementById("wallet-bar");
const walletAddress = document.getElementById("wallet-address");

connectBtn.addEventListener("click", async () => {
  if (!window.ethereum) {
    logEvent("error", "No injected wallet (MetaMask etc.) detected.");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address  = accounts[0];
    walletAddress.textContent = shortenAddr(address);
    walletBar.style.display   = "flex";
    connectBtn.style.display  = "none";
    logEvent("success", `Wallet connected: ${address}`);
  } catch (err) {
    logEvent("error", `Connect failed: ${err.message}`);
  }
});

disconnectBtn.addEventListener("click", () => {
  walletBar.style.display  = "none";
  connectBtn.style.display = "";
  logEvent("info", "Wallet disconnected");
});

function shortenAddr(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

// ─── Compile & Export ─────────────────────────────────────────────────────────

const compileBtn         = document.getElementById("compile-btn");
const compileOutputCard  = document.getElementById("compile-output-card");
const compileOutput      = document.getElementById("compile-output");
const copyScriptBtn      = document.getElementById("copy-script-btn");
const downloadScriptBtn  = document.getElementById("download-script-btn");

compileBtn.addEventListener("click", generateScript);

function getConfig() {
  const chains = [...document.querySelectorAll('input[name="chain"]:checked')].map((el) =>
    Number(el.value)
  );

  return {
    appName:        document.getElementById("cfg-app-name").value || "IntegratedDEX",
    projectId:      document.getElementById("cfg-project-id").value || "YOUR_WALLETCONNECT_PROJECT_ID",
    appUrl:         document.getElementById("cfg-app-url").value || "",
    appIcon:        document.getElementById("cfg-app-icon").value || "",
    appDescription: document.getElementById("cfg-app-desc").value || "",
    theme:          document.getElementById("cfg-theme").value || "dark",
    btnText:        document.getElementById("cfg-btn-text").value || "Connect Wallet",
    showAddress:    document.getElementById("cfg-show-address").checked,
    showChain:      document.getElementById("cfg-show-chain").checked,
    showBalance:    document.getElementById("cfg-show-balance").checked,
    chains:         chains.length ? chains : [1],
    contractAddress: document.getElementById("cfg-contract-address").value || "",
    abi:             document.getElementById("cfg-abi").value || "[]",
    defaultFn:      document.getElementById("cfg-default-fn").value || "",
    maxRetries:     Number(document.getElementById("cfg-max-retries").value) || 3,
    timeout:        Number(document.getElementById("cfg-timeout").value) || 30000,
    enableEip712:   document.getElementById("cfg-eip712").checked,
    enableMulticall: document.getElementById("cfg-multicall").checked,
    debug:          document.getElementById("cfg-debug").checked,
    cache:          document.getElementById("cfg-cache").checked,
    modalStyle:     document.getElementById("cfg-modal-style").value || "modal",
    analytics:      document.getElementById("cfg-analytics").checked,
    autoReconnect:  document.getElementById("cfg-auto-reconnect").checked,
    bundleFormat:   document.getElementById("cfg-bundle-format").value || "iife",
    minify:         document.getElementById("cfg-minify").value === "true",
  };
}

function generateScript() {
  const cfg    = getConfig();
  const format = cfg.bundleFormat;

  let abiValue;
  try {
    abiValue = JSON.stringify(JSON.parse(cfg.abi), null, 2);
  } catch {
    abiValue = "[]";
  }

  const configStr = JSON.stringify({
    appName:        cfg.appName,
    projectId:      cfg.projectId,
    appUrl:         cfg.appUrl,
    appDescription: cfg.appDescription,
    appIcon:        cfg.appIcon,
    theme:          cfg.theme,
    btnText:        cfg.btnText,
    showAddress:    cfg.showAddress,
    showChain:      cfg.showChain,
    showBalance:    cfg.showBalance,
    chains:         cfg.chains,
    contract: {
      address: cfg.contractAddress,
      abi:     "__ABI__",
      defaultFunction: cfg.defaultFn,
    },
    maxRetries:      cfg.maxRetries,
    timeout:         cfg.timeout,
    enableEip712:    cfg.enableEip712,
    enableMulticall: cfg.enableMulticall,
    debug:           cfg.debug,
    cache:           cfg.cache,
    modalStyle:      cfg.modalStyle,
    analytics:       cfg.analytics,
    autoReconnect:   cfg.autoReconnect,
  }, null, 2).replace('"__ABI__"', abiValue);

  let code;

  if (format === "iife") {
    code = `/**
 * IntegratedDEX WaaS SDK — generated by Dashboard
 * Generated: ${new Date().toISOString()}
 */
(function (global) {
  "use strict";

  // ─── SDK Configuration ──────────────────────────────────────────────────────
  const CONFIG = ${configStr};

  // ─── Utility ─────────────────────────────────────────────────────────────────
  function log(...args) {
    if (CONFIG.debug) console.log("[WaaS]", ...args);
  }

  function shortenAddress(addr) {
    return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
  }

  // ─── Wallet Connection ────────────────────────────────────────────────────────
  async function connect() {
    if (!window.ethereum) {
      throw new Error("No Web3 wallet detected. Install MetaMask or use WalletConnect.");
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    log("Connected:", accounts[0]);
    return accounts[0];
  }

  async function disconnect() {
    log("Disconnected");
  }

  // ─── Button Injection ─────────────────────────────────────────────────────────
  function injectConnectButton(selector) {
    const container = document.querySelector(selector);
    if (!container) {
      console.warn("[WaaS] Container not found:", selector);
      return;
    }

    const btn = document.createElement("button");
    btn.className = "waas-connect-btn";
    btn.textContent = CONFIG.btnText;
    btn.style.cssText = [
      "background:#6c63ff",
      "color:#fff",
      "border:none",
      "border-radius:8px",
      "padding:.65rem 1.5rem",
      "font-size:.95rem",
      "font-weight:600",
      "cursor:pointer",
      "transition:background .2s",
    ].join(";");

    btn.addEventListener("mouseenter", () => { btn.style.background = "#5a52e0"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "#6c63ff"; });

    let connected = false;
    let account   = null;

    btn.addEventListener("click", async () => {
      if (connected) {
        await disconnect();
        connected = false;
        account   = null;
        btn.textContent = CONFIG.btnText;
        return;
      }
      try {
        account   = await connect();
        connected = true;
        btn.textContent = CONFIG.showAddress ? shortenAddress(account) : "Connected";
      } catch (err) {
        console.error("[WaaS]", err);
      }
    });

    container.appendChild(btn);
    log("Button injected into", selector);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  global.WaaSSDK = {
    config: CONFIG,
    connect,
    disconnect,
    injectConnectButton,
  };

  // Auto-inject if selector is provided via data attribute
  document.addEventListener("DOMContentLoaded", () => {
    const el = document.querySelector("[data-waas-inject]");
    if (el) injectConnectButton("[data-waas-inject]");
  });

})(typeof window !== "undefined" ? window : globalThis);
`;
  } else if (format === "esm") {
    code = `/**
 * IntegratedDEX WaaS SDK — generated by Dashboard (ESM)
 * Generated: ${new Date().toISOString()}
 */

export const CONFIG = ${configStr};

export function shortenAddress(addr) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
}

export async function connect() {
  if (!window.ethereum) throw new Error("No Web3 wallet detected.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

export async function disconnect() {}

export function injectConnectButton(selector) {
  const container = document.querySelector(selector);
  if (!container) return;
  const btn = document.createElement("button");
  btn.textContent = CONFIG.btnText;
  btn.style.cssText = "background:#6c63ff;color:#fff;border:none;border-radius:8px;padding:.65rem 1.5rem;font-weight:600;cursor:pointer";
  container.appendChild(btn);
}

export default { CONFIG, connect, disconnect, injectConnectButton };
`;
  } else {
    code = `/**
 * IntegratedDEX WaaS SDK — generated by Dashboard (CJS)
 * Generated: ${new Date().toISOString()}
 */
"use strict";

const CONFIG = module.exports.CONFIG = ${configStr};

module.exports.shortenAddress = function (addr) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
};

module.exports.config = CONFIG;
`;
  }

  compileOutput.textContent    = code;
  compileOutputCard.style.display = "";
  logEvent("success", "script.js generated successfully");
}

copyScriptBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(compileOutput.textContent);
    copyScriptBtn.textContent = "✅ Copied!";
    setTimeout(() => (copyScriptBtn.textContent = "📋 Copy"), 2000);
  } catch {
    copyScriptBtn.textContent = "❌ Failed";
    setTimeout(() => (copyScriptBtn.textContent = "📋 Copy"), 2000);
  }
});

downloadScriptBtn.addEventListener("click", () => {
  const blob = new Blob([compileOutput.textContent], { type: "text/javascript" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "script.js";
  a.click();
  URL.revokeObjectURL(url);
  logEvent("info", "script.js downloaded");
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Init: sync default-fn select when Contract tab ABI changes ───────────────

cfgAbi.addEventListener("change", () => {
  parseAbi();
});

// ─── Startup log ─────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  logEvent("info", "Dashboard loaded — ready");
});
