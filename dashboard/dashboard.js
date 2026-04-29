/**
 * IntegratedDEX WaaS SDK — Admin Dashboard Logic
 *
 * Handles:
 *  - Tab navigation
 *  - Theme toggle
 *  - ABI parsing & function selector
 *  - Contract address validation
 *  - Config collection & script.js generation
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
    const val = input.value.trim();
    if (!val) {
      indicator.textContent = "";
      input.classList.remove("invalid");
      return;
    }
    if (isEVMAddress(val)) {
      indicator.textContent = "✅";
      input.classList.remove("invalid");
    } else {
      indicator.textContent = "❌";
      input.classList.add("invalid");
    }
  }

  input.addEventListener("input", validate);
}

/* ── ABI parsing & function selector ─────────────────────────────────────── */

let parsedAbi = [];

function parseABI(raw) {
  try {
    const abi = JSON.parse(raw);
    if (!Array.isArray(abi)) throw new Error("ABI must be a JSON array");
    return abi;
  } catch {
    return null;
  }
}

function populateFunctionSelector(abi) {
  const select = document.getElementById("fnSelector");
  if (!select) return;

  select.innerHTML = '<option value="">— Select a function —</option>';

  const fns = abi.filter(
    (item) => item.type === "function" || item.type === undefined
  );

  fns.forEach((fn) => {
    if (!fn.name) return;
    const opt = document.createElement("option");
    const mutability = fn.stateMutability ?? fn.constant ? "view" : "nonpayable";
    opt.value = fn.name;
    opt.textContent = `${fn.name} (${mutability})`;
    opt.dataset.inputs = JSON.stringify(fn.inputs ?? []);
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

  inputs.forEach((input) => {
    const row = document.createElement("div");
    row.className = "fn-arg-row";
    row.innerHTML = `
      <label>${input.name || "arg"}<span class="fn-tag">${input.type}</span></label>
      <input type="text" placeholder="${input.type}" data-arg-name="${input.name}" data-arg-type="${input.type}" />
    `;
    builder.appendChild(row);
  });
}

function initABIHandling() {
  const abiInput  = document.getElementById("abiInput");
  const fnSelect  = document.getElementById("fnSelector");
  if (!abiInput || !fnSelect) return;

  abiInput.addEventListener("input", () => {
    const abi = parseABI(abiInput.value);
    if (abi) {
      parsedAbi = abi;
      populateFunctionSelector(abi);
    } else {
      parsedAbi = [];
      fnSelect.innerHTML = '<option value="">— Paste valid ABI first —</option>';
      const builder = document.getElementById("fnArgBuilder");
      if (builder) builder.innerHTML = "";
    }
  });

  fnSelect.addEventListener("change", () => {
    const selected = fnSelect.options[fnSelect.selectedIndex];
    if (!selected || !selected.dataset.inputs) {
      buildArgFields([]);
      return;
    }
    try {
      const inputs = JSON.parse(selected.dataset.inputs);
      buildArgFields(inputs);
    } catch {
      buildArgFields([]);
    }
  });
}

/* ── Config collection ────────────────────────────────────────────────────── */

function val(id)     { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function checked(id) { const el = document.getElementById(id); return el ? el.checked : false; }

function collectConfig() {
  const chains = [];
  ["chainEth", "chainBsc", "chainPoly", "chainAvax"].forEach((id) => {
    if (checked(id)) {
      const map = { chainEth: 1, chainBsc: 56, chainPoly: 137, chainAvax: 43114 };
      chains.push(map[id]);
    }
  });

  const contractFnArgs = [];
  document.querySelectorAll("#fnArgBuilder input").forEach((input) => {
    contractFnArgs.push({
      name: input.dataset.argName,
      type: input.dataset.argType,
      defaultValue: input.value.trim(),
    });
  });

  return {
    // General
    appName:            val("appName")         || "IntegratedDEX",
    appDescription:     val("appDescription")  || "",
    projectId:          val("projectId")       || "YOUR_WALLETCONNECT_PROJECT_ID",
    theme:              val("themeSelect")      || "dark",
    connectText:        val("connectText")      || "Connect Wallet",
    connectedText:      val("connectedText")    || "Connected",
    loadingText:        val("loadingText")      || "Connecting…",
    txFunctionName:     val("txFunctionName")   || "",

    // Wallet
    chains:             chains.length ? chains : [1],
    minBalanceUSD:      parseFloat(val("minBalance")) || 0,
    singleChainMode:    checked("singleChain"),
    autoLoadScripts:    checked("autoLoad"),
    modalStyle:         val("modalStyle")       || "walletconnect",

    // Contract
    contractAddress:    val("contractAddress")  || "",
    contractName:       val("contractName")     || "",
    contractFunction:   val("fnSelector")       || "",
    contractArgs:       contractFnArgs,
    abi:                parsedAbi,

    // Advanced
    retryCount:         parseInt(val("retryCount"), 10) || 3,
    logFormat:          val("logFormat")        || "detailed",
    sessionCaching:     checked("sessionCaching"),
    postTxRefresh:      checked("postTxRefresh"),
    eip712Enforcement:  checked("eip712"),
  };
}

/* ── Script generation ────────────────────────────────────────────────────── */

function generateScript(config) {
  const configJson = JSON.stringify(config, null, 2);

  return `/*!
 * WaaS SDK — Generated by IntegratedDEX Admin Dashboard
 * Generated: ${new Date().toISOString()}
 * App: ${config.appName}
 *
 * Drop this file into any web page:
 *   <script src="script.js"><\/script>
 *
 * Then initialise:
 *   WaaSSDK.initSDK(WaaSSDK.CONFIG);
 */

(function (global) {
  "use strict";

  // ── Embedded configuration ───────────────────────────────────────────────
  var CONFIG = ${configJson};

  // ── Utility helpers ──────────────────────────────────────────────────────
  function isValidAddress(addr) {
    return /^0x[0-9a-fA-F]{40}$/.test(addr);
  }

  function shortenAddress(addr) {
    if (!addr || addr.length < 10) return addr;
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function showToast(message, type) {
    var existing = document.getElementById("__waas_toast__");
    if (existing) existing.remove();

    var el = document.createElement("div");
    el.id = "__waas_toast__";
    el.style.cssText = [
      "position:fixed", "bottom:1.5rem", "right:1.5rem",
      "background:#1a1d27", "color:#e2e8f0",
      "padding:.75rem 1.2rem", "border-radius:8px",
      "font-family:system-ui,sans-serif", "font-size:.88rem",
      "box-shadow:0 4px 20px rgba(0,0,0,.4)",
      "border-left:3px solid " + (type === "error" ? "#ff4d6a" : "#22d3a5"),
      "z-index:999999", "pointer-events:none",
    ].join(";");
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(function () { el.remove(); }, 4000);
  }

  // ── Transaction preview ──────────────────────────────────────────────────
  function previewTransaction(fn, args, contractAddr) {
    console.group("📋 WaaS SDK — Transaction Preview");
    console.log("Contract :", contractAddr);
    console.log("Function :", fn);
    console.log("Arguments:", args);
    console.groupEnd();
  }

  // ── Contract loader stub (requires ethers.js on the page) ────────────────
  function loadContract(address, abi, provider) {
    if (typeof ethers === "undefined") {
      throw new Error("WaaS SDK: ethers.js is not loaded. Add <script src=\\"https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.umd.min.js\\"></script> before this file.");
    }
    if (!isValidAddress(address)) {
      throw new Error("WaaS SDK: invalid contract address: " + address);
    }
    return new ethers.Contract(address, abi, provider);
  }

  async function readContract(contract, functionName, args) {
    args = args || [];
    return contract[functionName].apply(contract, args);
  }

  async function writeContract(contract, functionName, args, overrides) {
    args      = args      || [];
    overrides = overrides || {};
    var address = await contract.getAddress();
    previewTransaction(functionName, args, address);
    var tx = await contract[functionName].apply(contract, args.concat([overrides]));
    return tx.wait();
  }

  // ── SDK init ─────────────────────────────────────────────────────────────
  function initSDK(cfg) {
    cfg = cfg || CONFIG;
    console.log("[WaaS SDK] Initialising with config:", cfg);

    if (!cfg.projectId || cfg.projectId === "YOUR_WALLETCONNECT_PROJECT_ID") {
      console.warn("[WaaS SDK] No WalletConnect projectId set. Update CONFIG.projectId.");
    }

    if (cfg.contractAddress && isValidAddress(cfg.contractAddress)) {
      console.log("[WaaS SDK] Contract loaded:", shortenAddress(cfg.contractAddress));
    }

    return cfg;
  }

  // ── Public API ───────────────────────────────────────────────────────────
  global.WaaSSDK = {
    CONFIG:        CONFIG,
    initSDK:       initSDK,
    loadContract:  loadContract,
    readContract:  readContract,
    writeContract: writeContract,
    showToast:     showToast,
    isValidAddress: isValidAddress,
    shortenAddress: shortenAddress,
  };

  // Auto-init if document is already loaded
  if (document.readyState !== "loading") {
    initSDK(CONFIG);
  } else {
    document.addEventListener("DOMContentLoaded", function () { initSDK(CONFIG); });
  }

}(typeof globalThis !== "undefined" ? globalThis : window));
`;
}

/* ── Config preview ───────────────────────────────────────────────────────── */

function updateConfigPreview() {
  const preview = document.getElementById("configPreview");
  if (!preview) return;
  const config = collectConfig();
  const display = { ...config };
  if (display.abi && display.abi.length > 0) {
    display.abi = `[… ${display.abi.length} entries]`;
  }
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
      showToast("❌ Contract address is invalid — please check the Contract tab.", "error");
      return;
    }

    const config = collectConfig();
    const script = generateScript(config);
    outputArea.value = script;

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
    if (!output?.value) {
      showToast("Generate the script first.", "error");
      return;
    }
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
    if (!output?.value) {
      showToast("Generate the script first.", "error");
      return;
    }
    const blob = new Blob([output.value], { type: "text/javascript" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href:     url,
      download: "script.js",
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("⬇️ Downloading script.js…", "success");
  });
}

/* ── Toast helper ─────────────────────────────────────────────────────────── */

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = ""; }, 3200);
}

/* ── Live config preview updates ──────────────────────────────────────────── */

function initLivePreview() {
  const inputs = document.querySelectorAll(
    "input[type=text], input[type=number], select, input[type=checkbox], textarea"
  );
  inputs.forEach((el) => {
    el.addEventListener("input",  updateConfigPreview);
    el.addEventListener("change", updateConfigPreview);
  });
  updateConfigPreview();
}

/* ── Bootstrap ────────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  // Theme
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
  document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);

  // Tabs
  initTabs();

  // Contract tab
  initAddressValidation();
  initABIHandling();

  // Compile tab
  initCompile();
  initCopy();
  initDownload();

  // Live preview
  initLivePreview();
});
