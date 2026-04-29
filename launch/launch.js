/**
 * IntegratedDEX — Token Launch Logic
 *
 * Deploys a new ERC-20 token via the TokenLaunch factory contract.
 * Users configure name, symbol, supply, and decimals, then sign one
 * deployment transaction.
 */

import { initSDK, shortenAddress, getTxUrl } from "../sdk/index.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  projectId: import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [1, 56, 137, 43114],
  appName: "IntegratedDEX Token Launch",
  // Replace with your deployed TokenLaunch factory address
  factoryAddress: import.meta.env?.VITE_FACTORY_ADDRESS ?? "0x0000000000000000000000000000000000000000",
};

// Minimal TokenLaunch ABI (must match contracts/TokenLaunch.sol)
const TOKEN_LAUNCH_ABI = [
  "function deployToken(string name, string symbol, uint256 totalSupply, uint8 decimals) external returns (address token)",
  "event TokenDeployed(address indexed deployer, address indexed token, string name, string symbol, uint256 totalSupply)",
];

// ─── SDK Init ─────────────────────────────────────────────────────────────────

const { wallet } = initSDK({
  projectId: CONFIG.projectId,
  chains: CONFIG.chains,
  appName: CONFIG.appName,
});

// ─── DOM Refs ─────────────────────────────────────────────────────────────────

const dom = {
  connectBtn: document.getElementById("connect-btn"),
  disconnectBtn: document.getElementById("disconnect-btn"),
  walletBar: document.getElementById("wallet-bar"),
  walletAddress: document.getElementById("wallet-address"),
  nameInput: document.getElementById("token-name"),
  symbolInput: document.getElementById("token-symbol"),
  supplyInput: document.getElementById("token-supply"),
  decimalsInput: document.getElementById("token-decimals"),
  previewName: document.getElementById("preview-name"),
  previewSymbol: document.getElementById("preview-symbol"),
  previewSupply: document.getElementById("preview-supply"),
  previewDecimals: document.getElementById("preview-decimals"),
  launchBtn: document.getElementById("launch-btn"),
  statusMsg: document.getElementById("status-msg"),
  deployedSection: document.getElementById("deployed-section"),
  deployedAddress: document.getElementById("deployed-address"),
  deployedExplorer: document.getElementById("deployed-explorer"),
  step1: document.getElementById("step-1"),
  step2: document.getElementById("step-2"),
  step3: document.getElementById("step-3"),
};

// ─── Live Preview ─────────────────────────────────────────────────────────────

function updatePreview() {
  if (dom.previewName) dom.previewName.textContent = dom.nameInput?.value || "—";
  if (dom.previewSymbol) dom.previewSymbol.textContent = dom.symbolInput?.value || "—";
  if (dom.previewDecimals) dom.previewDecimals.textContent = dom.decimalsInput?.value || "18";

  const supply = dom.supplyInput?.value;
  if (dom.previewSupply) {
    dom.previewSupply.textContent = supply
      ? Number(supply).toLocaleString()
      : "—";
  }
}

[dom.nameInput, dom.symbolInput, dom.supplyInput, dom.decimalsInput].forEach((el) => {
  el?.addEventListener("input", updatePreview);
});

updatePreview();

// ─── Wallet Events ────────────────────────────────────────────────────────────

wallet.on("connect", ({ account }) => {
  dom.walletBar.style.display = "flex";
  dom.walletAddress.textContent = shortenAddress(account);
  dom.connectBtn.style.display = "none";
  dom.disconnectBtn.style.display = "inline-flex";
  setStep(2);
});

wallet.on("disconnect", () => {
  dom.walletBar.style.display = "none";
  dom.connectBtn.style.display = "inline-flex";
  dom.disconnectBtn.style.display = "none";
  setStep(1);
  clearStatus();
});

// ─── Connect / Disconnect ─────────────────────────────────────────────────────

dom.connectBtn?.addEventListener("click", () => {
  wallet.connect().catch((err) => showStatus("danger", err.message));
});

dom.disconnectBtn?.addEventListener("click", () => {
  wallet.disconnect();
});

// ─── Launch ───────────────────────────────────────────────────────────────────

dom.launchBtn?.addEventListener("click", async () => {
  if (!wallet.isConnected) return showStatus("danger", "Please connect your wallet first.");

  const name = dom.nameInput?.value?.trim();
  const symbol = dom.symbolInput?.value?.trim().toUpperCase();
  const supply = dom.supplyInput?.value?.trim();
  const decimals = parseInt(dom.decimalsInput?.value ?? "18", 10);

  // Input validation
  if (!name) return showStatus("danger", "Token name is required.");
  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) return showStatus("danger", "Symbol must be alphanumeric uppercase.");
  if (!supply || isNaN(Number(supply)) || Number(supply) <= 0) return showStatus("danger", "Total supply must be a positive number.");
  if (isNaN(decimals) || decimals < 0 || decimals > 18) return showStatus("danger", "Decimals must be between 0 and 18.");

  const { Contract, parseUnits } = await import("ethers");
  const signer = await wallet.getSigner();
  const factory = new Contract(CONFIG.factoryAddress, TOKEN_LAUNCH_ABI, signer);

  const totalSupplyRaw = parseUnits(supply, decimals);

  setButtonLoading(dom.launchBtn, true);
  clearStatus();
  setStep(2);

  try {
    // Show user exactly what they are deploying before they sign
    showStatus(
      "info",
      `Deploying <strong>${escapeHtml(name)} (${escapeHtml(symbol)})</strong> — supply: ${escapeHtml(Number(supply).toLocaleString())}, decimals: ${escapeHtml(String(decimals))}.<br>Confirm the transaction in your wallet.`
    );

    const tx = await factory.deployToken(name, symbol, totalSupplyRaw, decimals);
    showStatus(
      "info",
      `Transaction submitted. <a href="${getTxUrl(tx.hash, wallet.chainId)}" target="_blank" rel="noopener">View on explorer ↗</a>`
    );

    const receipt = await tx.wait();

    // Parse the TokenDeployed event to get the new token address
    const iface = factory.interface;
    let tokenAddress = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "TokenDeployed") {
          tokenAddress = parsed.args.token;
          break;
        }
      } catch {
        // skip non-matching logs
      }
    }

    setStep(3);
    clearStatus();

    if (dom.deployedSection) dom.deployedSection.style.display = "block";
    if (dom.deployedAddress) dom.deployedAddress.textContent = tokenAddress ?? "See transaction receipt";
    if (dom.deployedExplorer && tokenAddress) {
      dom.deployedExplorer.href = `${getTxUrl(tokenAddress, wallet.chainId).replace("/tx/", "/token/")}`;
      dom.deployedExplorer.style.display = "inline-flex";
    }

    showStatus("success", `✅ Token deployed successfully! Address: <code>${escapeHtml(tokenAddress)}</code>`);
  } catch (err) {
    showStatus("danger", `Deployment failed: ${escapeHtml(err.reason ?? err.message)}`);
    setStep(2);
  } finally {
    setButtonLoading(dom.launchBtn, false);
  }
});

// ─── Steps UI ─────────────────────────────────────────────────────────────────

function setStep(active) {
  [dom.step1, dom.step2, dom.step3].forEach((el, i) => {
    if (!el) return;
    const stepNum = i + 1;
    el.classList.toggle("step--active", stepNum === active);
    el.classList.toggle("step--done", stepNum < active);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escape a string for safe insertion into innerHTML. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showStatus(type, html) {
  if (!dom.statusMsg) return;
  dom.statusMsg.className = `alert alert--${type}`;
  dom.statusMsg.innerHTML = html;
  dom.statusMsg.style.display = "flex";
}

function clearStatus() {
  if (!dom.statusMsg) return;
  dom.statusMsg.style.display = "none";
  dom.statusMsg.innerHTML = "";
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Deploying…';
  } else {
    btn.innerHTML = btn.dataset.originalText ?? btn.innerHTML;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
setStep(1);
