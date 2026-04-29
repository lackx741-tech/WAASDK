/**
 * WAASDK Backend — Telegram Bot & Alert Functions
 *
 * Provides:
 *  - initTelegramBot()       initialise the bot
 *  - sendMessage()           raw text send
 *  - alertSessionCreated()   new session signed
 *  - alertSessionUsed()      session key used to send a tx
 *  - alertSessionExpiring()  session expiring soon
 *  - alertSessionRevoked()   session revoked
 *  - alertWalletConnected()  wallet connected
 *  - alertContribution()     presale contribution
 *  - alertTransaction()      any tx sent
 *  - alertError()            backend/contract error
 *  - sendDailySummary()      daily stats digest
 *
 * A daily cron fires sendDailySummary() at 08:00 UTC automatically
 * once initTelegramBot() has been called.
 */

import TelegramBot from "node-telegram-bot-api";
import cron from "node-cron";
import { SUPPORTED_CHAINS } from "./chainNames.js";

let bot = null;
let chatId = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chainName(chainId) {
  return SUPPORTED_CHAINS[chainId] ?? `Chain ${chainId}`;
}

function shortAddr(address) {
  if (!address || address.length < 10) return address ?? "unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function escapeMarkdown(text) {
  return String(text ?? "").replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the Telegram bot.  Must be called before any alert function.
 * @param {string} token  Bot token from BotFather
 * @param {string} id     Target chat/channel ID
 */
export function initTelegramBot(token, id) {
  if (!token || !id) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — alerts disabled"
    );
    return;
  }
  bot = new TelegramBot(token, { polling: false });
  chatId = id;

  // Daily summary cron — every day at 08:00 UTC
  cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        // Import lazily to avoid circular deps at startup
        const { getDailySummaryStats } = await import("./analytics.js");
        const stats = await getDailySummaryStats();
        await sendDailySummary(stats);
      } catch (err) {
        console.error("[telegram] daily cron failed:", err.message);
      }
    },
    { timezone: "UTC" }
  );
}

/**
 * Send a plain text (Markdown) message.
 */
export async function sendMessage(text) {
  if (!bot || !chatId) return;
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[telegram] sendMessage error:", err.message);
  }
}

// ─── Session Alerts ───────────────────────────────────────────────────────────

export async function alertSessionCreated(session) {
  const expiresIn = Math.round((session.expiresAt - Date.now() / 1000) / 3600);
  const functions = (session.allowedFunctions ?? []).join(", ") || "any";

  await sendMessage(
    `🔑 *New Session Created*\n` +
      `👤 User: \`${session.userAddress}\`\n` +
      `🔐 Session Key: \`${shortAddr(session.sessionKey)}\`\n` +
      `✅ Allowed: ${escapeMarkdown(functions)}\n` +
      `💰 Spend Limit: ${escapeMarkdown(session.spendingLimit)} ${escapeMarkdown(session.spendingLimitToken ?? "ETH")}\n` +
      `⏱ Expires: ${expiresIn}h from now\n` +
      `🔗 Chain: ${escapeMarkdown(chainName(session.chainId))}`
  );
}

export async function alertSessionUsed(session, tx) {
  const explorerBase = explorerUrl(session.chainId);
  await sendMessage(
    `⚡ *Session TX Sent*\n` +
      `👤 User: \`${session.userAddress}\`\n` +
      `📄 Function: ${escapeMarkdown(tx.functionName)}(${(tx.args ?? []).join(", ")})\n` +
      `💸 Value: ${escapeMarkdown(tx.value ?? "0")} ETH\n` +
      `🔗 TX: ${explorerBase}/tx/${tx.txHash}`
  );
}

export async function alertSessionExpiring(session, minutesLeft) {
  await sendMessage(
    `⚠️ *Session Expiring Soon*\n` +
      `👤 User: \`${session.userAddress}\`\n` +
      `⏱ Expires in: ${minutesLeft} minutes`
  );
}

export async function alertSessionRevoked(session) {
  await sendMessage(
    `🚫 *Session Revoked*\n` +
      `👤 User: \`${session.userAddress}\`\n` +
      `🔐 Session Key: \`${shortAddr(session.sessionKey)}\`\n` +
      `🔗 Chain: ${escapeMarkdown(chainName(session.chainId))}`
  );
}

// ─── Wallet & Contribution Alerts ─────────────────────────────────────────────

export async function alertWalletConnected(address, id) {
  await sendMessage(
    `🟢 *Wallet Connected*\n` +
      `👤 Address: \`${address}\`\n` +
      `🔗 Chain: ${escapeMarkdown(chainName(id))} (${id})`
  );
}

export async function alertContribution(address, amount, total, percent) {
  await sendMessage(
    `💰 *New Contribution\\!*\n` +
      `👤 From: \`${address}\`\n` +
      `💵 Amount: ${escapeMarkdown(String(amount))} ETH\n` +
      `📊 Total Raised: ${escapeMarkdown(String(total))} / ${escapeMarkdown(String(process.env.HARDCAP_ETH ?? "100"))} ETH \\(${escapeMarkdown(String(percent))}%\\)`
  );
}

// ─── Transaction Alert ────────────────────────────────────────────────────────

export async function alertTransaction(tx) {
  const explorerBase = explorerUrl(tx.chainId);
  const statusIcon = tx.status === "success" ? "✅" : tx.status === "failed" ? "❌" : "⏳";
  await sendMessage(
    `📤 *Transaction Sent*\n` +
      `👤 User: \`${tx.userAddress}\`\n` +
      `📄 ${escapeMarkdown(tx.functionName ?? "unknown")}(${(tx.args ?? []).join(", ")})\n` +
      `${statusIcon} Status: ${escapeMarkdown(tx.status)}\n` +
      `🔗 TX: ${explorerBase}/tx/${tx.txHash}`
  );
}

// ─── Error Alert ─────────────────────────────────────────────────────────────

export async function alertError(error, context) {
  await sendMessage(
    `🔴 *Error*\n` +
      `⚠️ ${escapeMarkdown(context ?? "Unknown context")}\n` +
      `Error: ${escapeMarkdown(error?.message ?? String(error))}`
  );
}

// ─── Daily Summary ────────────────────────────────────────────────────────────

export async function sendDailySummary(stats = {}) {
  const successRate =
    stats.totalTx > 0
      ? Math.round((stats.successTx / stats.totalTx) * 100)
      : 0;

  await sendMessage(
    `📊 *Daily Summary — IntegratedDEX*\n` +
      `👥 New Wallets: ${stats.newWallets ?? 0}\n` +
      `🔑 Sessions Created: ${stats.newSessions ?? 0}\n` +
      `💰 Contributions: ${escapeMarkdown(String(stats.contributions ?? "0"))} ETH\n` +
      `📤 Transactions: ${stats.totalTx ?? 0}\n` +
      `🟢 Success Rate: ${successRate}%`
  );
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function explorerUrl(id) {
  const explorers = {
    1: "https://etherscan.io",
    56: "https://bscscan.com",
    137: "https://polygonscan.com",
    43114: "https://snowtrace.io",
  };
  return explorers[id] ?? "https://etherscan.io";
}
