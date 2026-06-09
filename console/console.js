/**
 * IntegratedDEX WaaS Console — Frontend Logic
 * 
 * Connects to the backend API for auth, projects, sessions, transactions, gas sponsorship.
 * Also provides a contract explorer using ethers.js for read/write calls.
 */

// ── Config ────────────────────────────────────────────────────────────────────
// Auto-detect API URL: if served from same domain, use relative path
const API_BASE = localStorage.getItem("waas_api_url") || (
  window.location.protocol === "file:" 
    ? "http://localhost:3000" 
    : window.location.origin
);
const TOKEN_KEY = "waas_token";
const USER_KEY = "waas_user";

// ── State ─────────────────────────────────────────────────────────────────────
let token = localStorage.getItem(TOKEN_KEY) || null;
let user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
let projects = [];
let currentProject = null;

// ── API Helper ────────────────────────────────────────────────────────────────
async function api(method, path, body = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Also send the API key for legacy routes that expect it
  const apiKey = localStorage.getItem("waas_api_key") || "changeme";
  headers["X-API-Key"] = apiKey;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ""; }, 3500);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
let isRegisterMode = false;

function initAuth() {
  const form = document.getElementById("auth-form");
  const toggleLink = document.getElementById("auth-toggle-link");

  toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    document.getElementById("auth-title").textContent = isRegisterMode ? "Create Account" : "Sign in to Console";
    document.getElementById("auth-sub").textContent = isRegisterMode ? "Start building with WaaS" : "Manage your WaaS infrastructure";
    document.getElementById("auth-submit").textContent = isRegisterMode ? "Create Account" : "Sign In";
    document.getElementById("auth-toggle-text").textContent = isRegisterMode ? "Already have an account?" : "Don't have an account?";
    toggleLink.textContent = isRegisterMode ? "Sign in" : "Create one";
    document.getElementById("name-field").style.display = isRegisterMode ? "block" : "none";
    hideError();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value.trim();

    try {
      const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
      const body = isRegisterMode ? { email, password, name } : { email, password };
      const data = await api("POST", endpoint, body);

      token = data.token;
      user = data.user;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      showConsole();
      toast(isRegisterMode ? "Account created!" : "Welcome back!");
    } catch (err) {
      showError(err.message);
    }
  });
}

function showError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg;
  el.style.display = "block";
}

function hideError() {
  document.getElementById("auth-error").style.display = "none";
}

function logout() {
  token = null;
  user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.getElementById("auth-screen").classList.add("active");
  document.getElementById("console-screen").classList.remove("active");
}

// ── Navigation ────────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  const view = document.getElementById(`view-${viewName}`);
  if (navItem) navItem.classList.add("active");
  if (view) view.classList.add("active");

  // Load data for the view
  if (viewName === "overview") loadOverview();
  if (viewName === "projects") loadProjects();
  if (viewName === "sessions") loadSessions();
  if (viewName === "transactions") loadTransactions();
  if (viewName === "gas") loadGasInfo();
}

// ── Show Console ──────────────────────────────────────────────────────────────
function showConsole() {
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("console-screen").classList.add("active");
  document.getElementById("user-email").textContent = user?.email || "";
  loadOverview();
  loadProjects();
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [projectsData, analyticsData] = await Promise.all([
      api("GET", "/api/projects").catch(() => ({ projects: [] })),
      api("GET", "/api/analytics/overview").catch(() => null),
    ]);

    document.getElementById("stat-projects").textContent = projectsData.projects?.length ?? 0;

    if (analyticsData) {
      document.getElementById("stat-sessions").textContent = analyticsData.sessions?.active ?? 0;
      document.getElementById("stat-transactions").textContent = analyticsData.transactions?.total ?? 0;
    }

    // Try to get gas balance
    try {
      const gas = await api("GET", "/api/sponsor/balance?chainId=1");
      document.getElementById("stat-gas").textContent = parseFloat(gas.balanceEth).toFixed(4) + " ETH";
    } catch {
      document.getElementById("stat-gas").textContent = "N/A";
    }

    // Load recent transactions
    try {
      const txData = await api("GET", "/api/transactions?limit=5");
      const tbody = document.getElementById("recent-tx-body");
      if (txData.transactions?.length > 0) {
        tbody.innerHTML = txData.transactions.map(tx => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div>
              <span class="mono" style="font-size:.8rem">${tx.txHash.slice(0, 10)}…${tx.txHash.slice(-6)}</span>
              <span style="margin-left:8px;font-size:.78rem;color:var(--muted)">${tx.functionName || "transfer"}</span>
            </div>
            <span style="font-size:.75rem;padding:2px 8px;border-radius:4px;background:${tx.status === 'success' ? 'rgba(52,211,153,.1)' : 'rgba(239,68,68,.1)'};color:${tx.status === 'success' ? 'var(--green)' : 'var(--red)'}">${tx.status}</span>
          </div>
        `).join("");
      } else {
        tbody.innerHTML = '<p class="empty-state">No transactions yet.</p>';
      }
    } catch {}
  } catch (err) {
    console.error("Overview load error:", err);
  }
}

// ── Projects ──────────────────────────────────────────────────────────────────
async function loadProjects() {
  try {
    const data = await api("GET", "/api/projects");
    projects = data.projects || [];
    renderProjects();
  } catch (err) {
    console.error("Projects load error:", err);
  }
}

function renderProjects() {
  const container = document.getElementById("projects-list");
  if (projects.length === 0) {
    container.innerHTML = '<p class="empty-state">No projects yet. Create your first one.</p>';
    return;
  }

  container.innerHTML = projects.map(p => `
    <div class="project-card" data-id="${p._id}">
      <h3>${p.name}</h3>
      <p>${p.description || "No description"}</p>
      <div class="project-meta">
        <span>${p.chains?.length || 0} chains</span>
        <span>${p.contracts?.length || 0} contracts</span>
        <span>${p.apiKeys?.length || 0} API keys</span>
      </div>
    </div>
  `).join("");

  // Click to view project detail
  container.querySelectorAll(".project-card").forEach(card => {
    card.addEventListener("click", () => viewProjectDetail(card.dataset.id));
  });
}

async function viewProjectDetail(id) {
  try {
    const data = await api("GET", `/api/projects/${id}`);
    currentProject = data.project;
    
    // Show detail in a modal-like view
    const container = document.getElementById("projects-list");
    container.innerHTML = `
      <div style="margin-bottom:16px">
        <button class="btn btn-ghost btn-sm" id="back-to-projects">← Back</button>
      </div>
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <h3>${currentProject.name}</h3>
          <span style="font-size:.75rem;color:var(--muted)">ID: ${currentProject._id}</span>
        </div>
        <div class="card-body">
          <p style="color:var(--muted);margin-bottom:20px">${currentProject.description || "No description"}</p>
          
          <h4 style="font-size:.88rem;margin-bottom:12px">API Keys</h4>
          <div style="margin-bottom:20px">
            ${currentProject.apiKeys?.map(k => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg2);border-radius:6px;margin-bottom:6px">
                <div>
                  <span style="font-size:.84rem;font-weight:500">${k.name}</span>
                  <span class="mono" style="margin-left:10px">${k.key.slice(0, 12)}…${k.key.slice(-4)}</span>
                </div>
                <span style="font-size:.72rem;color:${k.isActive ? 'var(--green)' : 'var(--red)'}">${k.isActive ? "Active" : "Revoked"}</span>
              </div>
            `).join("") || '<p class="empty-state" style="padding:12px">No API keys</p>'}
            <button class="btn btn-sm btn-ghost" id="gen-key-btn" style="margin-top:8px">+ Generate Key</button>
          </div>

          <h4 style="font-size:.88rem;margin-bottom:12px">Chains</h4>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
            ${(currentProject.chains || []).map(c => `<span style="padding:4px 10px;background:var(--bg2);border-radius:4px;font-size:.78rem">${chainName(c)}</span>`).join("")}
          </div>

          <h4 style="font-size:.88rem;margin-bottom:12px">Project Contracts</h4>
          ${currentProject.contracts?.length ? currentProject.contracts.map(c => `
            <div style="padding:8px 12px;background:var(--bg2);border-radius:6px;margin-bottom:6px">
              <span style="font-weight:500;font-size:.84rem">${c.name || "Unnamed"}</span>
              <span class="mono" style="margin-left:10px">${c.address.slice(0, 10)}…${c.address.slice(-6)}</span>
              <span style="font-size:.72rem;color:var(--muted);margin-left:8px">${chainName(c.chainId)}</span>
            </div>
          `).join("") : '<p class="empty-state" style="padding:12px">No contracts added</p>'}
        </div>
      </div>
    `;

    document.getElementById("back-to-projects").addEventListener("click", () => {
      renderProjects();
    });

    document.getElementById("gen-key-btn")?.addEventListener("click", async () => {
      try {
        const result = await api("POST", `/api/projects/${currentProject._id}/keys`, { name: `Key ${Date.now().toString(36)}` });
        toast("API key generated! Copy it now — it won't be shown again.");
        // Show the key
        const keyDisplay = document.createElement("div");
        keyDisplay.className = "api-key-display";
        keyDisplay.textContent = result.key;
        document.getElementById("gen-key-btn").after(keyDisplay);
      } catch (err) {
        toast(err.message, "error");
      }
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

function chainName(id) {
  const names = { 1: "Ethereum", 56: "BSC", 137: "Polygon", 43114: "Avalanche", 42161: "Arbitrum", 8453: "Base", 10: "Optimism" };
  return names[id] || `Chain ${id}`;
}

// ── Create Project ────────────────────────────────────────────────────────────
function initCreateProject() {
  const btn = document.getElementById("create-project-btn");
  const modal = document.getElementById("create-project-modal");
  const cancelBtn = document.getElementById("cancel-project-btn");
  const form = document.getElementById("create-project-form");

  btn.addEventListener("click", () => { modal.style.display = "flex"; });
  cancelBtn.addEventListener("click", () => { modal.style.display = "none"; });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("project-name").value.trim();
    const description = document.getElementById("project-desc").value.trim();
    const chains = [...document.querySelectorAll(".chain-checkboxes input:checked")].map(i => Number(i.value));

    if (!name) { toast("Project name required", "error"); return; }

    try {
      const data = await api("POST", "/api/projects", { name, description, chains });
      modal.style.display = "none";
      form.reset();
      toast("Project created! API key: " + data.apiKey.slice(0, 16) + "…");
      loadProjects();
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────
async function loadSessions() {
  try {
    const data = await api("GET", "/api/sessions?limit=20");
    const container = document.getElementById("sessions-content");

    if (data.sessions?.length > 0) {
      container.innerHTML = `
        <div class="card-body" style="padding:0">
          <table class="data-table">
            <thead><tr><th>User</th><th>Session Key</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
            <tbody>
              ${data.sessions.map(s => `
                <tr>
                  <td class="mono">${s.userAddress.slice(0, 8)}…${s.userAddress.slice(-4)}</td>
                  <td class="mono">${s.sessionKey.slice(0, 8)}…</td>
                  <td><span style="color:${s.status === 'active' ? 'var(--green)' : 'var(--red)'}">${s.status}</span></td>
                  <td style="font-size:.8rem">${new Date(s.expiresAt * 1000).toLocaleDateString()}</td>
                  <td>${s.status === 'active' ? `<button class="btn btn-sm btn-danger" onclick="revokeSession('${s.id}')">Revoke</button>` : ''}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="card-body"><p class="empty-state">No sessions found.</p></div>';
    }
  } catch (err) {
    console.error("Sessions error:", err);
  }
}

window.revokeSession = async function(id) {
  try {
    await api("DELETE", `/api/sessions/${id}`);
    toast("Session revoked");
    loadSessions();
  } catch (err) {
    toast(err.message, "error");
  }
};

// ── Transactions ──────────────────────────────────────────────────────────────
async function loadTransactions() {
  try {
    const data = await api("GET", "/api/transactions?limit=30");
    const container = document.getElementById("tx-content");

    if (data.transactions?.length > 0) {
      container.innerHTML = `
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Tx Hash</th><th>User</th><th>Function</th><th>Chain</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              ${data.transactions.map(tx => `
                <tr>
                  <td class="mono">${tx.txHash.slice(0, 10)}…${tx.txHash.slice(-4)}</td>
                  <td class="mono">${tx.userAddress.slice(0, 8)}…</td>
                  <td>${tx.functionName || "-"}</td>
                  <td>${chainName(tx.chainId)}</td>
                  <td><span style="color:${tx.status === 'success' ? 'var(--green)' : tx.status === 'failed' ? 'var(--red)' : 'var(--orange)'}">${tx.status}</span></td>
                  <td style="font-size:.78rem">${new Date(tx.timestamp).toLocaleString()}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="card-body"><p class="empty-state">No transactions recorded.</p></div>';
    }
  } catch (err) {
    console.error("Transactions error:", err);
  }
}

// ── Gas Sponsorship ───────────────────────────────────────────────────────────
async function loadGasInfo() {
  try {
    const data = await api("GET", "/api/sponsor/balance?chainId=1");
    document.getElementById("gas-balance").textContent = parseFloat(data.balanceEth).toFixed(6);
    document.getElementById("gas-address").textContent = data.address ? `${data.address.slice(0, 10)}…${data.address.slice(-6)}` : "Not configured";
  } catch {
    document.getElementById("gas-balance").textContent = "N/A";
    document.getElementById("gas-address").textContent = "Not configured";
  }
}

function initGasEstimate() {
  const form = document.getElementById("gas-estimate-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const to = document.getElementById("gas-to").value.trim();
    const data = document.getElementById("gas-data").value.trim();
    const chainId = Number(document.getElementById("gas-chain").value);

    if (!to) { toast("To address required", "error"); return; }

    try {
      const result = await api("POST", "/api/sponsor/estimate", { to, data: data || "0x", chainId });
      document.getElementById("gas-estimate-result").innerHTML = `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;font-size:.84rem">
          <div>Gas Estimate: <strong>${result.gasEstimate}</strong></div>
          <div>Gas Price: <strong>${result.gasPrice}</strong> wei</div>
          <div>Cost: <strong>${result.estimatedCostEth} ETH</strong></div>
        </div>
      `;
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ── Contract Explorer ─────────────────────────────────────────────────────────
let explorerContract = null;
let explorerAbi = [];

function initExplorer() {
  document.getElementById("explorer-load-btn").addEventListener("click", () => {
    const address = document.getElementById("explorer-address").value.trim();
    const abiRaw = document.getElementById("explorer-abi").value.trim();
    const chainId = Number(document.getElementById("explorer-chain").value);

    if (!address || !abiRaw) { toast("Address and ABI required", "error"); return; }

    try {
      explorerAbi = JSON.parse(abiRaw);
    } catch {
      toast("Invalid ABI JSON", "error");
      return;
    }

    // Get RPC URL for chain
    const rpcs = {
      1: "https://eth.llamarpc.com",
      56: "https://bsc-dataseed.binance.org",
      137: "https://polygon-rpc.com",
      42161: "https://arb1.arbitrum.io/rpc",
      8453: "https://mainnet.base.org",
    };

    const provider = new ethers.JsonRpcProvider(rpcs[chainId] || rpcs[1]);
    explorerContract = new ethers.Contract(address, explorerAbi, provider);

    // Render functions
    const fnList = document.getElementById("explorer-fn-list");
    const fns = explorerAbi.filter(i => i.type === "function");
    
    fnList.innerHTML = fns.map((fn, idx) => `
      <div class="fn-item" data-idx="${idx}">
        <span class="fn-name">${fn.name}</span>
        <span class="fn-type">${fn.stateMutability || "nonpayable"}</span>
      </div>
    `).join("");

    document.getElementById("explorer-functions").style.display = "block";

    // Click handler for each function
    fnList.querySelectorAll(".fn-item").forEach(item => {
      item.addEventListener("click", () => {
        const fn = fns[Number(item.dataset.idx)];
        showFunctionCall(fn);
      });
    });

    toast("Contract loaded!");
  });
}

function showFunctionCall(fn) {
  const resultCard = document.getElementById("explorer-result");
  resultCard.style.display = "block";

  const inputs = fn.inputs || [];
  const isView = fn.stateMutability === "view" || fn.stateMutability === "pure";

  resultCard.innerHTML = `
    <div class="card-header"><h3>${fn.name} <span style="font-size:.75rem;color:var(--muted)">(${fn.stateMutability})</span></h3></div>
    <div class="card-body">
      <form id="fn-call-form">
        ${inputs.map((inp, i) => `
          <div class="field">
            <label>${inp.name || `arg${i}`} (${inp.type})</label>
            <input type="text" id="fn-arg-${i}" placeholder="${inp.type}" />
          </div>
        `).join("")}
        <button type="submit" class="btn btn-primary">${isView ? "Read" : "Write (requires signer)"}</button>
      </form>
      <pre id="fn-result" style="margin-top:16px;font-family:var(--mono);font-size:.82rem;color:var(--green);background:var(--bg2);padding:12px;border-radius:6px;display:none"></pre>
    </div>
  `;

  document.getElementById("fn-call-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const args = inputs.map((_, i) => document.getElementById(`fn-arg-${i}`).value.trim());
    const resultEl = document.getElementById("fn-result");
    resultEl.style.display = "block";
    resultEl.textContent = "Calling…";

    try {
      if (isView) {
        const result = await explorerContract[fn.name](...args);
        resultEl.textContent = JSON.stringify(result, (_, v) => typeof v === "bigint" ? v.toString() : v, 2);
        resultEl.style.color = "var(--green)";
      } else {
        resultEl.textContent = "Write calls require a connected signer. Use the SDK in your app for write operations.";
        resultEl.style.color = "var(--orange)";
      }
    } catch (err) {
      resultEl.textContent = "Error: " + err.message;
      resultEl.style.color = "var(--red)";
    }
  });
}

// ── Settings Modal ────────────────────────────────────────────────────────────
// (API URL configuration — accessible via console)
window.setApiUrl = function(url) {
  localStorage.setItem("waas_api_url", url);
  toast("API URL updated. Reload to apply.");
};

window.setApiKey = function(key) {
  localStorage.setItem("waas_api_key", key);
  toast("API key saved.");
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initNav();
  initCreateProject();
  initGasEstimate();
  initExplorer();
  initCompiler();

  document.getElementById("logout-btn").addEventListener("click", logout);

  // Check if already logged in
  if (token && user) {
    showConsole();
  }
});


// ── SDK Compiler ──────────────────────────────────────────────────────────────

const CHAIN_MAP = {
  1: { name: "Ethereum", importName: "mainnet", symbol: "ETH" },
  56: { name: "BNB Chain", importName: "bsc", symbol: "BNB" },
  137: { name: "Polygon", importName: "polygon", symbol: "MATIC" },
  43114: { name: "Avalanche", importName: "avalanche", symbol: "AVAX" },
  42161: { name: "Arbitrum", importName: "arbitrum", symbol: "ETH" },
  8453: { name: "Base", importName: "base", symbol: "ETH" },
};

function getCompileConfig() {
  const chains = [...document.querySelectorAll("#compile-chains input:checked")].map(i => Number(i.value));
  return {
    appName: document.getElementById("compile-app-name").value.trim() || "IntegratedDEX",
    projectId: document.getElementById("compile-project-id").value.trim() || "YOUR_PROJECT_ID",
    chains: chains.length ? chains : [1],
    theme: document.getElementById("compile-theme").value,
    contractAddress: document.getElementById("compile-contract").value.trim(),
    abi: document.getElementById("compile-abi").value.trim(),
    primaryFunction: document.getElementById("compile-function").value.trim(),
    strategy: document.getElementById("compile-strategy").value,
    gasMode: document.getElementById("compile-gas-mode").value,
    connectText: document.getElementById("compile-btn-text").value.trim() || "Connect Wallet",
    connectedText: document.getElementById("compile-connected-text").value.trim() || "Connected",
    postTx: document.getElementById("compile-post-tx").value,
  };
}

function generateSDKScript(cfg) {
  const selected = cfg.chains.map(id => CHAIN_MAP[id]).filter(Boolean);
  const networkImports = selected.map(c => c.importName).join(", ");
  const hasContract = cfg.contractAddress && /^0x[0-9a-fA-F]{40}$/.test(cfg.contractAddress);
  const hasAbi = cfg.abi && cfg.abi.length > 2;

  let abiParsed = "[]";
  if (hasAbi) {
    try { JSON.parse(cfg.abi); abiParsed = cfg.abi; } catch { abiParsed = "[]"; }
  }

  const postTxAction = cfg.postTx === "refresh"
    ? 'setTimeout(function(){ location.reload(); }, 1500);'
    : cfg.postTx === "redirect"
    ? '// redirect: window.location.href = "YOUR_URL";'
    : '';

  return `/*!
 * IntegratedDEX WaaS SDK — Generated Script
 * App: ${cfg.appName}
 * Chains: ${selected.map(c => c.name).join(", ")}
 * Strategy: ${cfg.strategy}
 * Gas: ${cfg.gasMode}
 * Generated: ${new Date().toISOString()}
 */

import { createAppKit } from "https://cdn.jsdelivr.net/npm/@reown/appkit@latest/+esm";
import { WagmiAdapter } from "https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-wagmi@latest/+esm";
import { ${networkImports} } from "https://cdn.jsdelivr.net/npm/@reown/appkit@latest/networks/+esm";

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  appName: "${cfg.appName}",
  projectId: "${cfg.projectId}",
  chains: [${cfg.chains.join(", ")}],
  theme: "${cfg.theme}",
  strategy: "${cfg.strategy}",
  gasMode: "${cfg.gasMode}",
  connectText: "${cfg.connectText}",
  connectedText: "${cfg.connectedText}",
  contractAddress: "${cfg.contractAddress || ""}",
  primaryFunction: "${cfg.primaryFunction || ""}",
};

const ABI = ${abiParsed};

// ── Wallet Setup ──────────────────────────────────────────────────────────────
const networks = [${networkImports}];

const wagmiAdapter = new WagmiAdapter({
  projectId: CONFIG.projectId,
  networks,
});

const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: CONFIG.projectId,
  metadata: {
    name: CONFIG.appName,
    description: CONFIG.appName,
    url: window.location.origin,
    icons: [],
  },
  themeMode: CONFIG.theme,
  features: { analytics: false },
});

// ── State ─────────────────────────────────────────────────────────────────────
const state = { account: null, chainId: null, contract: null };
const events = new EventTarget();

function _short(a) { return a ? a.slice(0,6) + "…" + a.slice(-4) : ""; }

function showToast(msg, type) {
  type = type || "success";
  var el = document.createElement("div");
  Object.assign(el.style, {
    position:"fixed", bottom:"1.5rem", right:"1.5rem", background:"#1a1d27", color:"#e2e8f0",
    padding:"0.75rem 1.2rem", borderRadius:"10px", fontFamily:"system-ui,sans-serif",
    fontSize:"0.88rem", boxShadow:"0 4px 24px rgba(0,0,0,0.45)", zIndex:"999999",
    borderLeft:"3px solid "+(type==="error"?"#ff4d6a":"#22d3a5"),
    transition:"opacity 0.3s,transform 0.3s", opacity:"0", transform:"translateY(12px)",
  });
  el.textContent = msg; document.body.appendChild(el);
  requestAnimationFrame(function(){ el.style.opacity="1"; el.style.transform="translateY(0)"; });
  setTimeout(function(){ el.style.opacity="0"; setTimeout(function(){ el.remove(); }, 300); }, 4000);
}

// ── Contract Init ─────────────────────────────────────────────────────────────
${hasContract && hasAbi ? `async function initContract() {
  try {
    var mod = await import("https://cdn.jsdelivr.net/npm/wagmi@latest/actions/+esm");
    var client = await mod.getConnectorClient(wagmiAdapter.wagmiConfig);
    var provider = new ethers.BrowserProvider(client.transport);
    var signer = await provider.getSigner(state.account);
    state.contract = new ethers.Contract(CONFIG.contractAddress, ABI, signer);
    events.dispatchEvent(new CustomEvent("contractReady", { detail: { contract: state.contract } }));
  } catch(e) { console.error("[WaaS] Contract init failed:", e); }
}` : `function initContract() {}`}

// ── Account Subscription ──────────────────────────────────────────────────────
modal.subscribeAccount(function(account) {
  if (account.isConnected && account.address) {
    var wasConnected = state.account !== null;
    state.account = account.address;
    try { state.chainId = wagmiAdapter.wagmiConfig.state.chainId; } catch(e){}
    if (!wasConnected) {
      showToast("✅ " + _short(state.account));
      events.dispatchEvent(new CustomEvent("connect", { detail: { account: state.account, chainId: state.chainId } }));
      initContract();
    }
    bindUI();
  } else if (state.account !== null) {
    state.account = null; state.chainId = null; state.contract = null;
    showToast("Disconnected", "error");
    events.dispatchEvent(new CustomEvent("disconnect"));
    bindUI();
  }
});

// ── UI Binding ────────────────────────────────────────────────────────────────
function bindUI() {
  document.querySelectorAll("[data-waas-connect]").forEach(function(b) {
    b.textContent = state.account ? CONFIG.connectedText + " (" + _short(state.account) + ")" : CONFIG.connectText;
    b.onclick = function(){ modal.open(); };
  });
  document.querySelectorAll("[data-waas-disconnect]").forEach(function(b) {
    b.disabled = !state.account;
    b.onclick = async function(){
      var mod = await import("https://cdn.jsdelivr.net/npm/wagmi@latest/actions/+esm");
      await mod.disconnect(wagmiAdapter.wagmiConfig);
    };
  });
  document.querySelectorAll("[data-waas-address]").forEach(function(e) { e.textContent = state.account ? _short(state.account) : ""; });
  document.querySelectorAll("[data-waas-chain]").forEach(function(e) { e.textContent = state.chainId || ""; });
  document.querySelectorAll("[data-waas-status]").forEach(function(e) { e.textContent = state.account ? "Connected" : "Disconnected"; });
}

// ── Contract Helpers ──────────────────────────────────────────────────────────
window.WaaSSDK = {
  CONFIG, ABI, state, events, modal,
  connect: function() { return modal.open(); },
  switchNetwork: function() { return modal.open({ view: "Networks" }); },
  showToast,
  // Read contract function
  async read(fn, args) {
    if (!state.contract) throw new Error("Contract not ready");
    return state.contract[fn](...(args || []));
  },
  // Write contract function
  async write(fn, args, overrides) {
    if (!state.contract) throw new Error("Contract not ready");
    var tx = await state.contract[fn](...(args || []).concat([overrides || {}]));
    showToast("⏳ Tx: " + _short(tx.hash));
    var receipt = await tx.wait();
    showToast("✅ Confirmed in block " + receipt.blockNumber);
    ${postTxAction}
    return receipt;
  },
};

// ── Auto-bind on load ─────────────────────────────────────────────────────────
if (document.readyState !== "loading") bindUI();
else document.addEventListener("DOMContentLoaded", bindUI);

console.log("[WaaS] SDK loaded —", CONFIG.appName, "| Strategy:", CONFIG.strategy);
`;
}

function initCompiler() {
  const generateBtn = document.getElementById("compile-generate-btn");
  const copyBtn = document.getElementById("compile-copy-btn");
  const downloadBtn = document.getElementById("compile-download-btn");
  const output = document.getElementById("compile-output");

  generateBtn?.addEventListener("click", () => {
    const cfg = getCompileConfig();
    if (!cfg.projectId || cfg.projectId === "YOUR_PROJECT_ID") {
      toast("Set your WalletConnect Project ID first", "error");
      return;
    }
    const script = generateSDKScript(cfg);
    output.value = script;
    toast("Script generated!");
  });

  copyBtn?.addEventListener("click", async () => {
    if (!output.value) { toast("Generate first", "error"); return; }
    await navigator.clipboard.writeText(output.value);
    toast("Copied to clipboard!");
  });

  downloadBtn?.addEventListener("click", () => {
    if (!output.value) { toast("Generate first", "error"); return; }
    const blob = new Blob([output.value], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "script.js" });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Downloading script.js");
  });
}
