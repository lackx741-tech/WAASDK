/**
 * IntegratedDEX WaaS SDK — Admin Dashboard Logic
 *
 * Handles:
 *  - Tab navigation & theme toggle
 *  - ABI parsing & function selector
 *  - Contract address validation
 *  - Config collection
 *  - Advanced script.js generation with Reown AppKit modal
 *  - Copy-to-clipboard / download
 */

/* ── Theme ────────────────────────────────────────────────────────────────── */

const THEME_KEY = "waas-dashboard-theme";

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = theme === "light" ? "🌙 Dark" : "☀️ Light";
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  applyTheme(current === "light" ? "dark" : "light");
}

/* ── Tab navigation ───────────────────────────────────────────────────────── */

function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels  = document.querySelectorAll(".tab-panel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p)  => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

/* ── Address validation ───────────────────────────────────────────────────── */

function isEVMAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

function initAddressValidation() {
  const input = document.getElementById("contractAddress");
  const indicator = document.getElementById("addressIndicator");
  if (!input || !indicator) return;
  function validate() {
    const v = input.value.trim();
    if (!v) { indicator.textContent = ""; input.classList.remove("invalid"); return; }
    if (isEVMAddress(v)) { indicator.textContent = "✅"; input.classList.remove("invalid"); }
    else { indicator.textContent = "❌"; input.classList.add("invalid"); }
  }
  input.addEventListener("input", validate);
}

/* ── ABI parsing & function selector ─────────────────────────────────────── */

let parsedAbi = [];

function parseABI(raw) {
  try { const abi = JSON.parse(raw); if (!Array.isArray(abi)) throw 0; return abi; }
  catch { return null; }
}

function populateFunctionSelector(abi) {
  const select = document.getElementById("fnSelector");
  if (!select) return;
  select.innerHTML = '<option value="">— Select a function —</option>';
  abi.filter(i => i.type === "function" || i.type === undefined).forEach((fn) => {
    if (!fn.name) return;
    const opt = document.createElement("option");
    opt.value = fn.name;
    opt.textContent = fn.name + " (" + (fn.stateMutability || "nonpayable") + ")";
    opt.dataset.inputs = JSON.stringify(fn.inputs || []);
    select.appendChild(opt);
  });
}

function buildArgFields(inputs) {
  const builder = document.getElementById("fnArgBuilder");
  if (!builder) return;
  builder.innerHTML = "";
  if (!inputs || inputs.length === 0) {
    builder.innerHTML = '<p class="help">This function takes no arguments.</p>';
    return;
  }
  inputs.forEach((inp) => {
    const row = document.createElement("div");
    row.className = "fn-arg-row";
    row.innerHTML = '<label>' + (inp.name || "arg") + '<span class="fn-tag">' + inp.type + '</span></label>' +
      '<input type="text" placeholder="' + inp.type + '" data-arg-name="' + inp.name + '" data-arg-type="' + inp.type + '" />';
    builder.appendChild(row);
  });
}

function initABIHandling() {
  const abiInput = document.getElementById("abiInput");
  const fnSelect = document.getElementById("fnSelector");
  if (!abiInput || !fnSelect) return;
  abiInput.addEventListener("input", () => {
    const abi = parseABI(abiInput.value);
    if (abi) { parsedAbi = abi; populateFunctionSelector(abi); }
    else { parsedAbi = []; fnSelect.innerHTML = '<option value="">— Paste valid ABI first —</option>'; }
  });
  fnSelect.addEventListener("change", () => {
    const sel = fnSelect.options[fnSelect.selectedIndex];
    if (!sel || !sel.dataset.inputs) { buildArgFields([]); return; }
    try { buildArgFields(JSON.parse(sel.dataset.inputs)); } catch { buildArgFields([]); }
  });
}

/* ── Config collection ────────────────────────────────────────────────────── */

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function checked(id) { const el = document.getElementById(id); return el ? el.checked : false; }

function collectConfig() {
  const chains = [];
  const map = { chainEth: 1, chainBsc: 56, chainPoly: 137, chainAvax: 43114 };
  Object.keys(map).forEach(id => { if (checked(id)) chains.push(map[id]); });

  const contractFnArgs = [];
  document.querySelectorAll("#fnArgBuilder input").forEach((input) => {
    contractFnArgs.push({ name: input.dataset.argName, type: input.dataset.argType, defaultValue: input.value.trim() });
  });

  return {
    appName: val("appName") || "IntegratedDEX",
    appDescription: val("appDescription") || "",
    projectId: val("projectId") || "YOUR_PROJECT_ID",
    theme: val("themeSelect") || "dark",
    connectText: val("connectText") || "Connect Wallet",
    connectedText: val("connectedText") || "Connected",
    loadingText: val("loadingText") || "Connecting…",
    txFunctionName: val("txFunctionName") || "",
    chains: chains.length ? chains : [1],
    minBalanceUSD: parseFloat(val("minBalance")) || 0,
    singleChainMode: checked("singleChain"),
    autoLoadScripts: checked("autoLoad"),
    modalStyle: val("modalStyle") || "walletconnect",
    contractAddress: val("contractAddress") || "",
    contractName: val("contractName") || "",
    contractFunction: val("fnSelector") || "",
    contractArgs: contractFnArgs,
    abi: parsedAbi,
    retryCount: parseInt(val("retryCount"), 10) || 3,
    logFormat: val("logFormat") || "detailed",
    sessionCaching: checked("sessionCaching"),
    postTxRefresh: checked("postTxRefresh"),
    eip712Enforcement: checked("eip712"),
  };
}

/* ── Chain metadata for code generation ───────────────────────────────────── */

const CHAIN_META = {
  1:     { name: "Ethereum",  importName: "mainnet",   symbol: "ETH",  explorer: "https://etherscan.io" },
  56:    { name: "BNB Chain", importName: "bsc",       symbol: "BNB",  explorer: "https://bscscan.com" },
  137:   { name: "Polygon",   importName: "polygon",   symbol: "MATIC",explorer: "https://polygonscan.com" },
  43114: { name: "Avalanche", importName: "avalanche", symbol: "AVAX", explorer: "https://snowtrace.io" },
  42161: { name: "Arbitrum",  importName: "arbitrum",  symbol: "ETH",  explorer: "https://arbiscan.io" },
  8453:  { name: "Base",      importName: "base",      symbol: "ETH",  explorer: "https://basescan.org" },
  10:    { name: "Optimism",  importName: "optimism",  symbol: "ETH",  explorer: "https://optimistic.etherscan.io" },
};

/* ── Script Generation ────────────────────────────────────────────────────── */

function generateScript(config) {
  const selected = config.chains.map(id => CHAIN_META[id]).filter(Boolean);
  const networkImports = selected.map(c => c.importName).join(", ");
  const chainInfoLines = config.chains.map(id => {
    const c = CHAIN_META[id];
    return c ? '    ' + id + ': { name: "' + c.name + '", symbol: "' + c.symbol + '", explorer: "' + c.explorer + '" }' : null;
  }).filter(Boolean).join(",\n");

  const hasContract = config.contractAddress && isEVMAddress(config.contractAddress);
  const hasAbi = config.abi && config.abi.length > 0;
  const abiStr = hasAbi ? JSON.stringify(config.abi) : "[]";

  // Build the config object without the raw ABI (it goes separately)
  const cfgForEmbed = Object.assign({}, config);
  delete cfgForEmbed.abi;
  const configStr = JSON.stringify(cfgForEmbed, null, 2).replace(/<\/script>/gi, "<\\/script>");

  const contractInitBlock = hasContract && hasAbi
    ? [
      '',
      '  async function _initContract() {',
      '    try {',
      '      var signer = await getSigner();',
      '      state.contract = new ethers.Contract(CONFIG.contractAddress, ABI, signer);',
      '      _log("info", "Contract ready", { address: _short(CONFIG.contractAddress) });',
      '      events.dispatchEvent(new CustomEvent("contractReady", { detail: { contract: state.contract } }));',
      '    } catch (e) { _log("error", "Contract init failed", e); }',
      '  }',
    ].join('\n')
    : '\n  function _initContract() {}';

  const onConnectContract = hasContract && hasAbi ? '\n      _initContract();' : '';

  const lines = [];

  // ── Header
  lines.push('/*!');
  lines.push(' * IntegratedDEX WaaS SDK — Compiled Script');
  lines.push(' * Generated : ' + new Date().toISOString());
  lines.push(' * App       : ' + config.appName);
  lines.push(' * Chains    : ' + selected.map(c => c.name).join(", "));
  lines.push(' * Contract  : ' + (hasContract ? config.contractAddress : "None"));
  lines.push(' *');
  lines.push(' * Usage:');
  lines.push(' *   <script src="https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.umd.min.js"><\\/script>');
  lines.push(' *   <script type="module" src="script.js"><\\/script>');
  lines.push(' *');
  lines.push(' * For full SDK features (Permit2, Multicall, EIP-712, Session Keys):');
  lines.push(' *   npm install @integrateddex/waas-sdk ethers');
  lines.push(' *   import { loadContract, readContract, signPermitSingle, multicallRead } from "@integrateddex/waas-sdk";');
  lines.push(' *');
  lines.push(' * HTML attributes:');
  lines.push(' *   data-waas-connect      → Connect wallet button');
  lines.push(' *   data-waas-disconnect   → Disconnect button');
  lines.push(' *   data-waas-network      → Switch network button');
  lines.push(' *   data-waas-address      → Shows shortened address');
  lines.push(' *   data-waas-address-full → Shows full address');
  lines.push(' *   data-waas-chain        → Shows chain name');
  lines.push(' *   data-waas-status       → Shows Connected/Disconnected');
  lines.push(' */');
  lines.push('');

  // ── Imports
  lines.push('import { createAppKit } from "https://cdn.jsdelivr.net/npm/@reown/appkit@latest/+esm";');
  lines.push('import { WagmiAdapter } from "https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-wagmi@latest/+esm";');
  lines.push('import { ' + networkImports + ' } from "https://cdn.jsdelivr.net/npm/@reown/appkit@latest/networks/+esm";');
  lines.push('');

  // ── Config
  lines.push('// ── Configuration ──────────────────────────────────────────────────────────');
  lines.push('const CONFIG = ' + configStr + ';');
  lines.push('');
  lines.push('const ABI = ' + abiStr + ';');
  lines.push('');
  lines.push('const CHAIN_INFO = {');
  lines.push(chainInfoLines);
  lines.push('};');
  lines.push('');

  // ── AppKit init
  lines.push('// ── Reown AppKit ──────────────────────────────────────────────────────────');
  lines.push('const networks = [' + networkImports + '];');
  lines.push('');
  lines.push('const wagmiAdapter = new WagmiAdapter({');
  lines.push('  projectId: CONFIG.projectId,');
  lines.push('  networks,');
  lines.push('});');
  lines.push('');
  lines.push('const modal = createAppKit({');
  lines.push('  adapters: [wagmiAdapter],');
  lines.push('  networks,');
  lines.push('  projectId: CONFIG.projectId,');
  lines.push('  metadata: {');
  lines.push('    name: CONFIG.appName,');
  lines.push('    description: CONFIG.appDescription || CONFIG.appName,');
  lines.push('    url: window.location.origin,');
  lines.push('    icons: [],');
  lines.push('  },');
  lines.push('  themeMode: CONFIG.theme === "auto" ? undefined : CONFIG.theme,');
  lines.push('  features: { analytics: false },');
  lines.push('});');
  lines.push('');

  // ── State & helpers
  lines.push('// ── State ─────────────────────────────────────────────────────────────────');
  lines.push('const state = { account: null, chainId: null, provider: null, signer: null, contract: null };');
  lines.push('const events = new EventTarget();');
  lines.push('');
  lines.push('function _valid(a) { return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a); }');
  lines.push('function _short(a, p, s) { p=p||6; s=s||4; return (!a||a.length<10) ? (a||"") : a.slice(0,p)+"\\u2026"+a.slice(-s); }');
  lines.push('function _chain(id) { return CHAIN_INFO[id] || { name: "Chain "+id, symbol: "ETH", explorer: "" }; }');
  lines.push('function _txUrl(h, id) { var c = _chain(id||state.chainId); return c.explorer ? c.explorer+"/tx/"+h : "#"; }');
  lines.push('');

  // ── Logging
  lines.push('function _log(lvl, msg, data) {');
  lines.push('  if (CONFIG.logFormat === "minimal" && lvl === "debug") return;');
  lines.push('  var fn = lvl==="error" ? console.error : lvl==="warn" ? console.warn : console.log;');
  lines.push('  if (CONFIG.logFormat === "json") fn(JSON.stringify({lvl:lvl,msg:msg,data:data,ts:Date.now()}));');
  lines.push('  else fn("[WaaS]", msg, data||"");');
  lines.push('}');
  lines.push('');

  // ── Toast
  lines.push('function showToast(message, type) {');
  lines.push('  type = type || "success";');
  lines.push('  var old = document.getElementById("__waas_toast__"); if (old) old.remove();');
  lines.push('  var el = document.createElement("div"); el.id = "__waas_toast__";');
  lines.push('  Object.assign(el.style, {');
  lines.push('    position:"fixed", bottom:"1.5rem", right:"1.5rem", background:"#1a1d27", color:"#e2e8f0",');
  lines.push('    padding:"0.75rem 1.2rem", borderRadius:"10px", fontFamily:"system-ui,sans-serif",');
  lines.push('    fontSize:"0.88rem", boxShadow:"0 4px 24px rgba(0,0,0,0.45)", zIndex:"999999",');
  lines.push('    borderLeft:"3px solid "+(type==="error"?"#ff4d6a":type==="warn"?"#f5a623":"#22d3a5"),');
  lines.push('    transition:"opacity 0.3s,transform 0.3s", opacity:"0", transform:"translateY(12px)",');
  lines.push('  });');
  lines.push('  el.textContent = message; document.body.appendChild(el);');
  lines.push('  requestAnimationFrame(function(){ el.style.opacity="1"; el.style.transform="translateY(0)"; });');
  lines.push('  setTimeout(function(){ el.style.opacity="0"; el.style.transform="translateY(12px)";');
  lines.push('    setTimeout(function(){ el.remove(); }, 300); }, 4000);');
  lines.push('}');
  lines.push('');

  // ── Wallet actions
  lines.push('// ── Wallet Actions ─────────────────────────────────────────────────────────');
  lines.push('function connectWallet() { return modal.open(); }');
  lines.push('function switchNetwork() { return modal.open({ view: "Networks" }); }');
  lines.push('');
  lines.push('async function disconnectWallet() {');
  lines.push('  try {');
  lines.push('    var mod = await import("https://cdn.jsdelivr.net/npm/wagmi@latest/actions/+esm");');
  lines.push('    await mod.disconnect(wagmiAdapter.wagmiConfig);');
  lines.push('  } catch(e) { _log("warn","Disconnect error",e); }');
  lines.push('}');
  lines.push('');
  lines.push('async function getProvider() {');
  lines.push('  if (!state.account) throw new Error("WaaS: No wallet connected");');
  lines.push('  if (typeof ethers === "undefined") throw new Error("WaaS: ethers.js not loaded");');
  lines.push('  var mod = await import("https://cdn.jsdelivr.net/npm/wagmi@latest/actions/+esm");');
  lines.push('  var client = await mod.getConnectorClient(wagmiAdapter.wagmiConfig);');
  lines.push('  state.provider = new ethers.BrowserProvider(client.transport);');
  lines.push('  return state.provider;');
  lines.push('}');
  lines.push('');
  lines.push('async function getSigner() {');
  lines.push('  var p = await getProvider();');
  lines.push('  state.signer = await p.getSigner(state.account);');
  lines.push('  return state.signer;');
  lines.push('}');
  lines.push('');

  // ── Contract — delegates to SDK's contract module (loadContract, readContract, writeContract, getContractEvents)
  // These are re-exported from the SDK bundle. For standalone use without the npm package,
  // thin wrappers are provided that use ethers.js directly.
  lines.push('// ── Contract Interaction (uses SDK API when available, ethers.js fallback) ─');
  lines.push(contractInitBlock);
  lines.push('');
  lines.push('// Thin wrappers — if you install @integrateddex/waas-sdk via npm, use the');
  lines.push('// SDK exports directly: import { loadContract, readContract, writeContract } from "@integrateddex/waas-sdk";');
  lines.push('function loadContract(address, abi, signerOrProvider) {');
  lines.push('  if (typeof ethers === "undefined") throw new Error("WaaS: ethers.js not loaded");');
  lines.push('  if (!_valid(address)) throw new Error("WaaS: Invalid address");');
  lines.push('  return new ethers.Contract(address, typeof abi === "string" ? JSON.parse(abi) : abi, signerOrProvider);');
  lines.push('}');
  lines.push('var { readContract, writeContract, getContractEvents } = (function() {');
  lines.push('  async function readContract(contract, fn, args) {');
  lines.push('    if (!contract[fn]) throw new Error("WaaS: Function not found: " + fn);');
  lines.push('    return contract[fn].apply(contract, args || []);');
  lines.push('  }');
  lines.push('  async function writeContract(contract, fn, args, overrides) {');
  lines.push('    if (!contract[fn]) throw new Error("WaaS: Function not found: " + fn);');
  lines.push('    var tx = await contract[fn].apply(contract, (args||[]).concat([overrides||{}]));');
  lines.push('    showToast("\\u2709 Tx submitted: " + _short(tx.hash, 10, 6));');
  lines.push('    var receipt = await tx.wait();');
  lines.push('    showToast("\\u2705 Confirmed in block " + receipt.blockNumber);');
  lines.push('    if (CONFIG.postTxRefresh) setTimeout(function(){ location.reload(); }, 1500);');
  lines.push('    return receipt;');
  lines.push('  }');
  lines.push('  async function getContractEvents(contract, eventName, fromBlock) {');
  lines.push('    var f = contract.filters[eventName]; if(!f) throw new Error("Event not found: "+eventName);');
  lines.push('    return contract.queryFilter(f(), fromBlock||0);');
  lines.push('  }');
  lines.push('  return { readContract, writeContract, getContractEvents };');
  lines.push('})();');
  lines.push('');

  // ── Auto UI binding
  lines.push('// ── Auto UI Binding (data-waas-* attributes) ──────────────────────────────');
  lines.push('function _bindUI() {');
  lines.push('  document.querySelectorAll("[data-waas-connect]").forEach(function(b) {');
  lines.push('    b.textContent = state.account ? CONFIG.connectedText+" ("+_short(state.account)+")" : CONFIG.connectText;');
  lines.push('    b.onclick = function(){ modal.open(); };');
  lines.push('  });');
  lines.push('  document.querySelectorAll("[data-waas-disconnect]").forEach(function(b) {');
  lines.push('    b.disabled = !state.account; b.onclick = function(){ disconnectWallet(); };');
  lines.push('  });');
  lines.push('  document.querySelectorAll("[data-waas-network]").forEach(function(b) {');
  lines.push('    b.onclick = function(){ modal.open({ view:"Networks" }); };');
  lines.push('  });');
  lines.push('  document.querySelectorAll("[data-waas-address]").forEach(function(e) {');
  lines.push('    e.textContent = state.account ? _short(state.account) : "";');
  lines.push('  });');
  lines.push('  document.querySelectorAll("[data-waas-address-full]").forEach(function(e) {');
  lines.push('    e.textContent = state.account || "";');
  lines.push('  });');
  lines.push('  document.querySelectorAll("[data-waas-chain]").forEach(function(e) {');
  lines.push('    e.textContent = state.chainId ? _chain(state.chainId).name : "";');
  lines.push('  });');
  lines.push('  document.querySelectorAll("[data-waas-status]").forEach(function(e) {');
  lines.push('    e.textContent = state.account ? "Connected" : "Disconnected";');
  lines.push('    e.dataset.connected = state.account ? "true" : "false";');
  lines.push('  });');
  lines.push('}');
  lines.push('');

  // ── Account subscription
  lines.push('// ── Account Subscription ───────────────────────────────────────────────────');
  lines.push('modal.subscribeAccount(function(account) {');
  lines.push('  if (account.isConnected && account.address) {');
  lines.push('    var wasConnected = state.account !== null;');
  lines.push('    state.account = account.address;');
  lines.push('    try { state.chainId = wagmiAdapter.wagmiConfig.state.chainId || null; } catch(e){}');
  lines.push('    if (!wasConnected) {');
  lines.push('      _log("info", "Connected", { account: _short(state.account), chain: state.chainId });');
  lines.push('      showToast("\\u2705 " + _short(state.account));');
  lines.push('      events.dispatchEvent(new CustomEvent("connect", { detail: { account:state.account, chainId:state.chainId } }));' + onConnectContract);
  lines.push('    }');
  lines.push('    _bindUI();');
  lines.push('  } else if (state.account !== null) {');
  lines.push('    state.account = null; state.chainId = null; state.provider = null; state.signer = null; state.contract = null;');
  lines.push('    _log("info", "Disconnected");');
  lines.push('    showToast("Disconnected", "warn");');
  lines.push('    events.dispatchEvent(new CustomEvent("disconnect"));');
  lines.push('    _bindUI();');
  lines.push('  }');
  lines.push('});');
  lines.push('');

  // ── Public API
  lines.push('// ── Public API ─────────────────────────────────────────────────────────────');
  lines.push('// This script provides the modal + wallet layer. For advanced features');
  lines.push('// (Permit2, Multicall3, EIP-712, Session Keys), use the full SDK:');
  lines.push('//   import { signPermitSingle, multicallRead, ... } from "@integrateddex/waas-sdk";');
  lines.push('window.WaaSSDK = {');
  lines.push('  CONFIG, ABI, CHAIN_INFO, state, events, modal,');
  lines.push('  connectWallet, disconnectWallet, switchNetwork,');
  lines.push('  getProvider, getSigner,');
  lines.push('  loadContract, readContract, writeContract, getContractEvents,');
  lines.push('  isValidAddress: _valid, shortenAddress: _short, getChainInfo: _chain, getExplorerUrl: _txUrl,');
  lines.push('  showToast, log: _log,');
  lines.push('};');
  lines.push('');

  // ── Auto-init
  lines.push('_log("info", "WaaS SDK loaded", { app: CONFIG.appName, chains: CONFIG.chains });');
  lines.push('if (document.readyState !== "loading") _bindUI();');
  lines.push('else document.addEventListener("DOMContentLoaded", _bindUI);');

  return lines.join('\n');
}

/* ── Config preview ───────────────────────────────────────────────────────── */

function updateConfigPreview() {
  const preview = document.getElementById("configPreview");
  if (!preview) return;
  const config = collectConfig();
  const display = Object.assign({}, config);
  if (display.abi && display.abi.length > 0) display.abi = "[… " + display.abi.length + " entries]";
  preview.textContent = JSON.stringify(display, null, 2);
}

/* ── Compile button ───────────────────────────────────────────────────────── */

function initCompile() {
  const compileBtn = document.getElementById("compileBtn");
  const outputArea = document.getElementById("scriptOutput");
  if (!compileBtn || !outputArea) return;

  compileBtn.addEventListener("click", () => {
    const contractAddr = val("contractAddress");
    if (contractAddr && !isEVMAddress(contractAddr)) {
      showToast("❌ Contract address is invalid — check the Contract tab.", "error");
      return;
    }
    const pid = val("projectId");
    if (!pid || pid === "YOUR_PROJECT_ID") {
      showToast("⚠️ Set your WalletConnect Project ID in the General tab first.", "error");
      return;
    }

    const config = collectConfig();
    const script = generateScript(config);
    outputArea.value = script;
    updateConfigPreview();

    document.getElementById("outputSection")?.scrollIntoView({ behavior: "smooth" });
    showToast("✅ script.js generated!", "success");
  });
}

/* ── Copy to clipboard ────────────────────────────────────────────────────── */

function initCopy() {
  const copyBtn = document.getElementById("copyBtn");
  if (!copyBtn) return;
  copyBtn.addEventListener("click", async () => {
    const output = document.getElementById("scriptOutput");
    if (!output?.value) { showToast("Generate the script first.", "error"); return; }
    try {
      await navigator.clipboard.writeText(output.value);
      showToast("📋 Copied to clipboard!", "success");
    } catch {
      output.select();
      document.execCommand("copy");
      showToast("📋 Copied!", "success");
    }
  });
}

/* ── Download script.js ───────────────────────────────────────────────────── */

function initDownload() {
  const dlBtn = document.getElementById("downloadBtn");
  if (!dlBtn) return;
  dlBtn.addEventListener("click", () => {
    const output = document.getElementById("scriptOutput");
    if (!output?.value) { showToast("Generate the script first.", "error"); return; }
    const blob = new Blob([output.value], { type: "text/javascript" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "script.js" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("⬇️ Downloading script.js…", "success");
  });
}

/* ── Toast helper ─────────────────────────────────────────────────────────── */

function showToast(message, type) {
  type = type || "success";
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "show " + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = ""; }, 3200);
}

/* ── Live config preview ──────────────────────────────────────────────────── */

function initLivePreview() {
  const inputs = document.querySelectorAll("input[type=text], input[type=number], select, input[type=checkbox], textarea");
  inputs.forEach((el) => {
    el.addEventListener("input",  updateConfigPreview);
    el.addEventListener("change", updateConfigPreview);
  });
  updateConfigPreview();
}

/* ── Bootstrap ────────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);
  initTabs();
  initAddressValidation();
  initABIHandling();
  initCompile();
  initCopy();
  initDownload();
  initLivePreview();
});
