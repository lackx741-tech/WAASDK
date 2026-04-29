/**
 * IntegratedDEX — Presale Launchpad Logic
 *
 * Handles:
 *  - Wallet connection via WaaSWallet
 *  - Presale contributions (native token)
 *  - Token claims after successful presale
 *  - Refunds if softcap is not reached
 */

import { initSDK, shortenAddress, getTxUrl, formatAmount, getNativeCurrencySymbol } from "../sdk/index.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  projectId: import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [1, 56, 137],
  appName: "IntegratedDEX Presale",
  // Replace with your deployed Presale contract address
  presaleAddress: import.meta.env?.VITE_PRESALE_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  presaleChainId: Number(import.meta.env?.VITE_PRESALE_CHAIN_ID ?? 1),
};

// Minimal Presale ABI (must match contracts/Presale.sol)
const PRESALE_ABI = [
  "function contribute() external payable",
  "function claim() external",
  "function refund() external",
  "function softcap() external view returns (uint256)",
  "function hardcap() external view returns (uint256)",
  "function totalRaised() external view returns (uint256)",
  "function presaleEndTime() external view returns (uint256)",
  "function presaleActive() external view returns (bool)",
  "function softcapReached() external view returns (bool)",
  "function claimedTokens(address) external view returns (bool)",
  "function refunded(address) external view returns (bool)",
  "function contributions(address) external view returns (uint256)",
  "function tokensPerNative() external view returns (uint256)",
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
  presaleSection: document.getElementById("presale-section"),
  progressFill: document.getElementById("progress-fill"),
  progressPct: document.getElementById("progress-pct"),
  raisedStat: document.getElementById("raised-stat"),
  softcapStat: document.getElementById("softcap-stat"),
  hardcapStat: document.getElementById("hardcap-stat"),
  amountInput: document.getElementById("amount-input"),
  nativeSymbol: document.getElementById("native-symbol"),
  contributeBtn: document.getElementById("contribute-btn"),
  claimBtn: document.getElementById("claim-btn"),
  refundBtn: document.getElementById("refund-btn"),
  statusMsg: document.getElementById("status-msg"),
  myContrib: document.getElementById("my-contrib"),
  tabContribute: document.getElementById("tab-contribute"),
  tabClaim: document.getElementById("tab-claim"),
  tabRefund: document.getElementById("tab-refund"),
  panelContribute: document.getElementById("panel-contribute"),
  panelClaim: document.getElementById("panel-claim"),
  panelRefund: document.getElementById("panel-refund"),
};

// ─── State ────────────────────────────────────────────────────────────────────

let presaleContract = null;
let signer = null;

// ─── Wallet Events ────────────────────────────────────────────────────────────

wallet.on("connect", async ({ account, chainId }) => {
  dom.walletBar.style.display = "flex";
  dom.walletAddress.textContent = shortenAddress(account);
  dom.connectBtn.style.display = "none";
  dom.disconnectBtn.style.display = "inline-flex";

  const symbol = getNativeCurrencySymbol(chainId);
  if (dom.nativeSymbol) dom.nativeSymbol.textContent = symbol;

  try {
    const { Contract } = await import("ethers");
    signer = await wallet.getSigner();
    presaleContract = new Contract(CONFIG.presaleAddress, PRESALE_ABI, signer);
    await refreshPresaleData(account);
  } catch (err) {
    showStatus("danger", `Failed to load presale data: ${err.message}`);
  }
});

wallet.on("disconnect", () => {
  dom.walletBar.style.display = "none";
  dom.connectBtn.style.display = "inline-flex";
  dom.disconnectBtn.style.display = "none";
  presaleContract = null;
  signer = null;
  clearStatus();
});

// ─── Connect / Disconnect ─────────────────────────────────────────────────────

dom.connectBtn?.addEventListener("click", () => {
  wallet.connect().catch((err) => showStatus("danger", err.message));
});

dom.disconnectBtn?.addEventListener("click", () => {
  wallet.disconnect();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(name) {
  ["contribute", "claim", "refund"].forEach((t) => {
    dom[`tab${t.charAt(0).toUpperCase() + t.slice(1)}`]?.classList.toggle("tab--active", t === name);
    dom[`panel${t.charAt(0).toUpperCase() + t.slice(1)}`]?.style.setProperty("display", t === name ? "block" : "none");
  });
  clearStatus();
}

dom.tabContribute?.addEventListener("click", () => switchTab("contribute"));
dom.tabClaim?.addEventListener("click", () => switchTab("claim"));
dom.tabRefund?.addEventListener("click", () => switchTab("refund"));

// ─── Presale Data ─────────────────────────────────────────────────────────────

async function refreshPresaleData(account) {
  if (!presaleContract) return;
  try {
    const [softcap, hardcap, totalRaised, myContrib] = await Promise.all([
      presaleContract.softcap(),
      presaleContract.hardcap(),
      presaleContract.totalRaised(),
      account ? presaleContract.contributions(account) : 0n,
    ]);

    const symbol = getNativeCurrencySymbol(CONFIG.presaleChainId);
    const pct = hardcap > 0n ? Number((totalRaised * 10000n) / hardcap) / 100 : 0;

    if (dom.progressFill) dom.progressFill.style.width = `${Math.min(pct, 100)}%`;
    if (dom.progressPct) dom.progressPct.textContent = `${pct.toFixed(1)}%`;
    if (dom.raisedStat) dom.raisedStat.textContent = `${formatAmount(totalRaised)} ${symbol}`;
    if (dom.softcapStat) dom.softcapStat.textContent = `${formatAmount(softcap)} ${symbol}`;
    if (dom.hardcapStat) dom.hardcapStat.textContent = `${formatAmount(hardcap)} ${symbol}`;
    if (dom.myContrib) dom.myContrib.textContent = `${formatAmount(myContrib)} ${symbol}`;
  } catch (err) {
    console.warn("Could not load presale stats:", err.message);
  }
}

// ─── Contribute ───────────────────────────────────────────────────────────────

dom.contributeBtn?.addEventListener("click", async () => {
  if (!presaleContract || !signer) return showStatus("danger", "Please connect your wallet first.");

  const raw = dom.amountInput?.value?.trim();
  if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) {
    return showStatus("danger", "Please enter a valid contribution amount.");
  }

  const { parseEther } = await import("ethers");
  const value = parseEther(raw);

  setButtonLoading(dom.contributeBtn, true);
  clearStatus();

  try {
    // Show user a clear preview before they sign
    showStatus("info", `You are contributing ${raw} ${getNativeCurrencySymbol(CONFIG.presaleChainId)} to the presale. Confirm in your wallet.`);

    const tx = await presaleContract.contribute({ value });
    showStatus("info", `Transaction submitted. Waiting for confirmation… <a href="${getTxUrl(tx.hash, CONFIG.presaleChainId)}" target="_blank" rel="noopener">View on explorer ↗</a>`);
    await tx.wait();
    showStatus("success", "✅ Contribution confirmed! Your tokens will be claimable after the presale ends.");
    await refreshPresaleData(wallet.account);
    dom.amountInput.value = "";
  } catch (err) {
    showStatus("danger", `Transaction failed: ${err.reason ?? err.message}`);
  } finally {
    setButtonLoading(dom.contributeBtn, false);
  }
});

// ─── Claim ────────────────────────────────────────────────────────────────────

dom.claimBtn?.addEventListener("click", async () => {
  if (!presaleContract || !signer) return showStatus("danger", "Please connect your wallet first.");

  setButtonLoading(dom.claimBtn, true);
  clearStatus();

  try {
    showStatus("info", "Claiming your tokens… Confirm in your wallet.");
    const tx = await presaleContract.claim();
    showStatus("info", `Transaction submitted. <a href="${getTxUrl(tx.hash, CONFIG.presaleChainId)}" target="_blank" rel="noopener">View on explorer ↗</a>`);
    await tx.wait();
    showStatus("success", "✅ Tokens claimed successfully!");
  } catch (err) {
    showStatus("danger", `Claim failed: ${err.reason ?? err.message}`);
  } finally {
    setButtonLoading(dom.claimBtn, false);
  }
});

// ─── Refund ───────────────────────────────────────────────────────────────────

dom.refundBtn?.addEventListener("click", async () => {
  if (!presaleContract || !signer) return showStatus("danger", "Please connect your wallet first.");

  setButtonLoading(dom.refundBtn, true);
  clearStatus();

  try {
    showStatus("info", "Requesting refund… Confirm in your wallet.");
    const tx = await presaleContract.refund();
    showStatus("info", `Transaction submitted. <a href="${getTxUrl(tx.hash, CONFIG.presaleChainId)}" target="_blank" rel="noopener">View on explorer ↗</a>`);
    await tx.wait();
    showStatus("success", "✅ Refund successful! Your funds have been returned.");
    await refreshPresaleData(wallet.account);
  } catch (err) {
    showStatus("danger", `Refund failed: ${err.reason ?? err.message}`);
  } finally {
    setButtonLoading(dom.refundBtn, false);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Processing…';
  } else {
    btn.innerHTML = btn.dataset.originalText ?? btn.innerHTML;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

switchTab("contribute");
