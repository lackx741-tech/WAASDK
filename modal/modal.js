/**
 * IntegratedDEX WaaS SDK — Interactive Modal Demo
 *
 * Handles:
 *  - Wallet connect / disconnect via injected provider (MetaMask etc.)
 *  - Live demo card status updates
 *  - Modal provider + theme toggles
 *  - Connect Button Customizer (Tab 1)
 *  - Contract Caller (Tab 2)
 *  - Sign Message (Tab 3)
 *  - Animated code snippets
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

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

const themeBtn = document.getElementById("theme-toggle-btn");
let isDark = true;

themeBtn?.addEventListener("click", () => {
  isDark = !isDark;
  document.body.classList.toggle("theme-light", !isDark);
  themeBtn.textContent = isDark ? "☀️ Light" : "🌙 Dark";
});

// ─── Wallet State ─────────────────────────────────────────────────────────────

let connectedAccount  = null;
let connectedChainId  = null;

const statusDot      = document.getElementById("demo-status-dot");
const statusText     = document.getElementById("demo-status-text");
const demoAddress    = document.getElementById("demo-address");
const demoChain      = document.getElementById("demo-chain");
const demoBalance    = document.getElementById("demo-balance");
const connectDemoBtn = document.getElementById("connect-demo-btn");
const heroConnectBtn = document.getElementById("hero-connect-btn");

const CHAIN_NAMES = {
  1:     "Ethereum",
  56:    "BNB Smart Chain",
  137:   "Polygon",
  43114: "Avalanche",
  42161: "Arbitrum One",
  10:    "Optimism",
  8453:  "Base",
};

function shortenAddr(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function setWalletConnected(address, chainId, balance) {
  connectedAccount = address;
  connectedChainId = chainId;

  if (statusDot)   { statusDot.className = "status-dot status-dot--connected"; }
  if (statusText)  { statusText.textContent = "Connected"; }
  if (demoAddress) { demoAddress.textContent = shortenAddr(address); }
  if (demoChain)   { demoChain.textContent = CHAIN_NAMES[Number(chainId)] ?? `Chain ${chainId}`; }
  if (demoBalance) { demoBalance.textContent = balance ? `${parseFloat(balance).toFixed(4)} ETH` : "—"; }
  if (connectDemoBtn) {
    connectDemoBtn.textContent = "✅ Disconnect";
    connectDemoBtn.classList.remove("btn--connect");
    connectDemoBtn.style.background = "rgba(52,211,153,0.15)";
    connectDemoBtn.style.color      = "#34d399";
    connectDemoBtn.style.border     = "1px solid rgba(52,211,153,0.3)";
  }

  updateButtonPreview();
}

function setWalletDisconnected() {
  connectedAccount = null;
  connectedChainId = null;

  if (statusDot)   { statusDot.className = "status-dot"; }
  if (statusText)  { statusText.textContent = "Disconnected"; }
  if (demoAddress) { demoAddress.textContent = "—"; }
  if (demoChain)   { demoChain.textContent = "—"; }
  if (demoBalance) { demoBalance.textContent = "—"; }
  if (connectDemoBtn) {
    connectDemoBtn.textContent      = "Connect Wallet";
    connectDemoBtn.className        = "btn btn--connect";
    connectDemoBtn.style.background = "";
    connectDemoBtn.style.color      = "";
    connectDemoBtn.style.border     = "";
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    showResult("pg-sign-result", "⚠️ No injected wallet detected. Install MetaMask or another EVM wallet.", "warn");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address  = accounts[0];
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId  = parseInt(chainHex, 16);

    let balance = "0";
    try {
      const balHex = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      balance = (parseInt(balHex, 16) / 1e18).toFixed(4);
    } catch { /* ignore */ }

    setWalletConnected(address, chainId, balance);

    window.ethereum.on("accountsChanged", (accs) => {
      if (!accs.length) {
        setWalletDisconnected();
      } else {
        connectWallet();
      }
    });

    window.ethereum.on("chainChanged", () => connectWallet());
  } catch (err) {
    showResult("pg-sign-result", `Connect failed: ${err.message}`, "error");
  }
}

async function disconnectWallet() {
  setWalletDisconnected();
}

// Both connect buttons do the same thing
[connectDemoBtn, heroConnectBtn].forEach((btn) => {
  btn?.addEventListener("click", async () => {
    if (connectedAccount) {
      await disconnectWallet();
    } else {
      await connectWallet();
    }
  });
});

// ─── Modal Provider Toggle ────────────────────────────────────────────────────

const providerChips = document.querySelectorAll(".toggle-chip[data-provider]");
providerChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    providerChips.forEach((c) => c.classList.remove("toggle-chip--active"));
    chip.classList.add("toggle-chip--active");
  });
});

// ─── Playground Tabs ──────────────────────────────────────────────────────────

const pgTabs   = document.querySelectorAll(".playground__tab");
const pgPanels = document.querySelectorAll(".playground__panel");

pgTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    pgTabs.forEach((t) => t.classList.remove("playground__tab--active"));
    pgPanels.forEach((p) => p.classList.remove("playground__panel--active"));
    tab.classList.add("playground__tab--active");
    const panel = document.getElementById(tab.dataset.panel);
    if (panel) panel.classList.add("playground__panel--active");
  });
});

// ─── Tab 1: Connect Button Customizer ────────────────────────────────────────

const previewBtn  = document.getElementById("pg-preview-btn");
const pgBtnText   = document.getElementById("pg-btn-text");
const pgTheme     = document.getElementById("pg-theme");
const pgShowAddr  = document.getElementById("pg-show-address");
const pgShowBal   = document.getElementById("pg-show-balance");
const pgShowChain = document.getElementById("pg-show-chain");
const copyCodeBtn = document.getElementById("pg-copy-code-btn");

function updateButtonPreview() {
  if (!previewBtn) return;
  const theme     = pgTheme?.value ?? "dark";
  const btnText   = pgBtnText?.value || "Connect Wallet";
  const showAddr  = pgShowAddr?.checked;
  const showBal   = pgShowBal?.checked;

  // Text
  let label = connectedAccount
    ? (showAddr ? shortenAddr(connectedAccount) : "Connected")
    : btnText;
  if (connectedAccount && showBal && demoBalance) {
    label += ` · ${demoBalance.textContent}`;
  }
  previewBtn.textContent = label;

  // Style
  if (theme === "light") {
    previewBtn.style.background = "#6c63ff";
    previewBtn.style.color      = "#fff";
  } else {
    previewBtn.style.background = "linear-gradient(135deg,#6c63ff,#a78bfa,#22d3ee)";
    previewBtn.style.color      = "#fff";
  }
}

[pgBtnText, pgTheme].forEach((el) => el?.addEventListener("input", updateButtonPreview));
[pgShowAddr, pgShowBal, pgShowChain].forEach((el) => el?.addEventListener("change", updateButtonPreview));

updateButtonPreview();

copyCodeBtn?.addEventListener("click", async () => {
  const btnText   = pgBtnText?.value || "Connect Wallet";
  const theme     = pgTheme?.value   ?? "dark";
  const showAddr  = pgShowAddr?.checked  ?? true;
  const showBal   = pgShowBal?.checked   ?? false;
  const showChain = pgShowChain?.checked ?? true;

  const snippet = `<div id="my-wallet"></div>
<script type="module">
  import { injectConnectButton } from './sdk/connectButton.js';
  injectConnectButton('#my-wallet', {
    theme: '${theme}',
    btnText: '${btnText}',
    showAddress: ${showAddr},
    showBalance: ${showBal},
    showChainIcon: ${showChain},
  });
<\/script>`;

  try {
    await navigator.clipboard.writeText(snippet);
    copyCodeBtn.textContent = "✅ Copied!";
    setTimeout(() => (copyCodeBtn.textContent = "📋 Copy Code"), 2000);
  } catch {
    copyCodeBtn.textContent = "❌ Failed";
    setTimeout(() => (copyCodeBtn.textContent = "📋 Copy Code"), 2000);
  }
});

// ─── Tab 2: Contract Caller ───────────────────────────────────────────────────

const pgContractAddr = document.getElementById("pg-contract-address");
const pgAbi          = document.getElementById("pg-abi");
const pgFnSelect     = document.getElementById("pg-fn-select");
const pgArgWrap      = document.getElementById("pg-arg-wrap");
const pgCallBtn      = document.getElementById("pg-call-btn");
const pgCallResult   = document.getElementById("pg-call-result");

let pgParsedAbi = null;

pgAbi?.addEventListener("change", parsePgAbi);

function parsePgAbi() {
  const raw = pgAbi?.value.trim();
  if (!raw) return;
  try {
    pgParsedAbi = JSON.parse(raw);
    const fns   = pgParsedAbi.filter((e) => e.type === "function");
    if (!pgFnSelect) return;
    pgFnSelect.innerHTML = fns.map((f) => {
      const isRead = ["view", "pure"].includes(f.stateMutability) || f.constant;
      const sig    = buildSig(f);
      return `<option value="${escAttr(f.name)}">${escHtml(sig)} [${isRead ? "read" : "write"}]</option>`;
    }).join("");
    pgFnSelect.dispatchEvent(new Event("change"));
  } catch { /* ignore */ }
}

pgFnSelect?.addEventListener("change", () => {
  if (!pgParsedAbi || !pgArgWrap) return;
  const name = pgFnSelect.value;
  const fn   = pgParsedAbi.find((f) => f.name === name && f.type === "function");
  if (!fn) return;

  pgArgWrap.innerHTML = "";
  (fn.inputs ?? []).forEach((inp, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-group";
    wrapper.innerHTML = `
      <label for="pg-arg-${i}">${escHtml(inp.name || `arg${i}`)}: <span style="color:var(--primary-2)">${escHtml(inp.type)}</span></label>
      <input type="text" id="pg-arg-${i}" placeholder="${escAttr(inp.type)}" />`;
    pgArgWrap.appendChild(wrapper);
  });
});

pgCallBtn?.addEventListener("click", async () => {
  if (!pgParsedAbi || !pgFnSelect || !pgContractAddr) return;
  const address = pgContractAddr.value.trim();
  const name    = pgFnSelect.value;
  const fn      = pgParsedAbi.find((f) => f.name === name && f.type === "function");
  if (!fn) return;

  const args = (fn.inputs ?? []).map((_, i) => {
    const el = document.getElementById(`pg-arg-${i}`);
    return el ? el.value.trim() : "";
  });

  const isRead = ["view", "pure"].includes(fn.stateMutability) || fn.constant;

  pgCallBtn.disabled = true;
  pgCallBtn.innerHTML = '<span class="spinner"></span> Processing…';

  try {
    if (!address) { throw new Error("Contract address is required"); }
    if (!window.ethereum) { throw new Error("No injected wallet detected"); }

    const { ethers } = await loadEthers();
    const provider   = new ethers.BrowserProvider(window.ethereum);

    if (isRead) {
      const contract = new ethers.Contract(address, pgParsedAbi, provider);
      const result   = await contract[fn.name](...args);
      const display  = typeof result === "bigint" ? result.toString() : JSON.stringify(result, null, 2);
      showResult("pg-call-result", `Result: ${display}`, "success");
    } else {
      if (!connectedAccount) { throw new Error("Please connect your wallet to send transactions"); }
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(address, pgParsedAbi, signer);
      const tx       = await contract[fn.name](...args);
      showResult("pg-call-result", `TX pending: ${tx.hash}\nWaiting for confirmation…`, "warn");
      const receipt  = await tx.wait();
      showResult("pg-call-result", `✅ TX confirmed in block ${receipt.blockNumber}\nHash: ${receipt.hash}`, "success");
    }
  } catch (err) {
    showResult("pg-call-result", `❌ Error: ${err.message}`, "error");
  } finally {
    pgCallBtn.disabled = false;
    pgCallBtn.textContent = isRead ? "📖 Call" : "✍️ Send";
  }
});

// ─── Tab 3: Sign Message ─────────────────────────────────────────────────────

const pgMsgInput  = document.getElementById("pg-message");
const pgSignBtn   = document.getElementById("pg-sign-btn");

pgSignBtn?.addEventListener("click", async () => {
  const msg = pgMsgInput?.value?.trim();
  if (!msg) {
    showResult("pg-sign-result", "⚠️ Please enter a message to sign.", "warn");
    return;
  }

  if (!connectedAccount) {
    showResult("pg-sign-result", "⚠️ Connect your wallet first.", "warn");
    return;
  }

  pgSignBtn.disabled = true;
  pgSignBtn.innerHTML = '<span class="spinner"></span> Waiting…';

  try {
    const sig = await window.ethereum.request({
      method: "personal_sign",
      params: [msg, connectedAccount],
    });
    showResult("pg-sign-result", `✅ Signature:\n${sig}`, "success");
  } catch (err) {
    showResult("pg-sign-result", `❌ ${err.message}`, "error");
  } finally {
    pgSignBtn.disabled = false;
    pgSignBtn.textContent = "✍️ Sign Message";
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSig(fn) {
  const inputs = (fn.inputs ?? []).map((i) => `${i.type} ${i.name ?? ""}`.trim()).join(", ");
  return `${fn.name}(${inputs})`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

function showResult(elId, msg, type) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent  = msg;
  el.className    = `result-display alert alert--${type}`;
  el.style.display = "";
}

// ─── Scroll-reveal animation ──────────────────────────────────────────────────

const observerCb = (entries, obs) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity    = "1";
      entry.target.style.transform  = "translateY(0)";
      obs.unobserve(entry.target);
    }
  });
};

const revealObs = new IntersectionObserver(observerCb, { threshold: 0.08 });

document.querySelectorAll(".feature-card, .snippet-card, .glass-card").forEach((el) => {
  el.style.opacity   = "0";
  el.style.transform = "translateY(30px)";
  el.style.transition = "opacity 0.55s ease, transform 0.55s ease";
  revealObs.observe(el);
});

// ─── Smooth-scroll for nav anchor links ───────────────────────────────────────

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const id = link.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
