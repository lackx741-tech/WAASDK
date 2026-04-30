/**
 * WAASDK Backend — Telegram Bot & Alert Functions
 *
 * Provides:
 *  - initTelegramBot()              initialise the bot (reads env)
 *  - scheduleDailySummary()         register 9am UTC cron
 *  - sendMessage(text)              raw HTML message
 *  - alertWalletConnected()         wallet connected
 *  - alertSessionCreated()          new session signed
 *  - alertSessionUsed()             session key used for a tx
 *  - alertSessionExpiring()         session expiring soon (< 1hr)
 *  - alertSessionExpired()          session expired
 *  - alertSessionRevoked()          session revoked
 *  - alertTransactionSent()         transaction submitted
 *  - alertTransactionConfirmed()    transaction confirmed
 *  - alertTransactionFailed()       transaction failed
 *  - alertContribution()            presale contribution received
 *  - alertPresaleGoalReached()      presale goal reached
 *  - alertError()                   backend/contract error
 *
 * All messages use Telegram HTML parse mode.
 * Alerts are rate-limited to max 1 message/second to avoid Telegram spam.
 * If TELEGRAM_ALERTS_ENABLED=false alerts are silently skipped.
 * Telegram errors never crash the server.
 */

import TelegramBot from "node-telegram-bot-api";
import cron from "node-cron";
import { config } from "./config.js";
import { SUPPORTED_CHAINS } from "./chainNames.js";

let bot = null;
let chatId = null;

// ─── Rate-limit queue (max 1 msg/sec) ────────────────────────────────────────

const _queue = [];
let _queueTimer = null;

function _drainQueue() {
  if (_queue.length === 0) {
    _queueTimer = null;
    return;
  }
  const { text, options } = _queue.shift();
  if (bot && chatId) {
    bot.sendMessage(chatId, text, options).catch((err) => {
      console.error("[telegram] send error:", err.message);
    });
  }
  _queueTimer = setTimeout(_drainQueue, 1000);
}

function _enqueue(text, options = {}) {
  if (!bot || !chatId) return;
  if (config.TELEGRAM_ALERTS_ENABLED === false || config.TELEGRAM_ALERTS_ENABLED === "false") return;
  _queue.push({ text, options });
  if (!_queueTimer) _drainQueue();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _chainName(id) {
  return SUPPORTED_CHAINS[id] ?? `Chain ${id}`;
}

function _shortAddr(address) {
  if (!address || address.length < 10) return address ?? "unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function _escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function _explorerUrl(id) {
  const explorers = {
    1: "https://etherscan.io",
    56: "https://bscscan.com",
    137: "https://polygonscan.com",
    43114: "https://snowtrace.io",
    8453: "https://basescan.org",
    42161: "https://arbiscan.io",
    10: "https://optimistic.etherscan.io",
  };
  return explorers[id] ?? "https://etherscan.io";
}

function _formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function _formatExpiry(ts) {
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Bot Command Handlers ────────────────────────────────────────────────────

function _registerCommands() {
  bot.onText(/\/start/, (msg) => {
    bot
      .sendMessage(
        msg.chat.id,
        "🤖 <b>WAASDK Operator Bot</b>\n\nUse /help to see all commands.",
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  });

  bot.onText(/\/help/, (msg) => {
    bot
      .sendMessage(
        msg.chat.id,
        "📋 <b>Available Commands</b>\n\n" +
          "/status — system health (db, uptime, active sessions)\n" +
          "/sessions — list active sessions\n" +
          "/stats — presale &amp; transaction stats\n" +
          "/help — this message",
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  });

  bot.onText(/\/status/, async (msg) => {
    try {
      const { isDBConnected } = await import("./db.js");
      const Session = (await import("./models/Session.js")).default;
      const now = Math.floor(Date.now() / 1000);
      const activeSessions = await Session.countDocuments({
        status: "active",
        expiresAt: { $gt: now },
      });
      bot
        .sendMessage(
          msg.chat.id,
          "🟢 <b>System Status</b>\n\n" +
            `📡 Status: ok\n` +
            `🗄 DB: ${isDBConnected() ? "connected" : "disconnected"}\n` +
            `⏱ Uptime: ${_formatUptime(process.uptime())}\n` +
            `🔑 Active Sessions: ${activeSessions}`,
          { parse_mode: "HTML" }
        )
        .catch(() => {});
    } catch (err) {
      bot.sendMessage(msg.chat.id, "❌ Error fetching status: " + _escapeHtml(err.message), { parse_mode: "HTML" }).catch(() => {});
    }
  });

  bot.onText(/\/sessions/, async (msg) => {
    try {
      const Session = (await import("./models/Session.js")).default;
      const now = Math.floor(Date.now() / 1000);
      const sessions = await Session.find({
        status: "active",
        expiresAt: { $gt: now },
      })
        .sort({ createdAt: -1 })
        .limit(10);

      const lines = sessions.map(
        (s) =>
          `• <code>${_escapeHtml(_shortAddr(s.userAddress))}</code> → <code>${_escapeHtml(_shortAddr(s.sessionKey))}</code>`
      );

      bot
        .sendMessage(
          msg.chat.id,
          `⚡ <b>Active Sessions</b> (${sessions.length})\n\n` +
            (lines.length ? lines.join("\n") : "No active sessions"),
          { parse_mode: "HTML" }
        )
        .catch(() => {});
    } catch (err) {
      bot.sendMessage(msg.chat.id, "❌ Error fetching sessions: " + _escapeHtml(err.message), { parse_mode: "HTML" }).catch(() => {});
    }
  });

  bot.onText(/\/stats/, async (msg) => {
    try {
      const Contributor = (await import("./models/Contributor.js")).default;
      const Transaction = (await import("./models/Transaction.js")).default;

      const [raisedAgg, contributors, txCount] = await Promise.all([
        Contributor.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: "$totalContributed" } },
            },
          },
        ]),
        Contributor.countDocuments(),
        Transaction.countDocuments(),
      ]);

      const raised = raisedAgg[0]?.total ?? 0;
      const hardcap = config.HARDCAP_ETH;
      const percent =
        hardcap > 0 ? ((raised / hardcap) * 100).toFixed(1) : "0.0";

      bot
        .sendMessage(
          msg.chat.id,
          "📊 <b>Presale Stats</b>\n\n" +
            `💰 Raised: ${raised.toFixed(4)} / ${hardcap} ETH\n` +
            `📈 Progress: ${percent}%\n` +
            `👥 Contributors: ${contributors}\n` +
            `📤 Transactions: ${txCount}`,
          { parse_mode: "HTML" }
        )
        .catch(() => {});
    } catch (err) {
      bot.sendMessage(msg.chat.id, "❌ Error fetching stats: " + _escapeHtml(err.message), { parse_mode: "HTML" }).catch(() => {});
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the Telegram bot.
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment config.
 * No-ops silently if tokens are missing.
 */
export function initTelegramBot() {
  const token = config.TELEGRAM_BOT_TOKEN;
  const id = config.TELEGRAM_CHAT_ID;

  if (!token || !id) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — alerts disabled"
    );
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  chatId = id;

  _registerCommands();

  console.log("✅ Telegram bot initialized");
}

/**
 * Register the daily summary cron (9:00 AM UTC).
 * Call once after initTelegramBot() on server startup.
 */
export function scheduleDailySummary() {
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const { getDailySummaryStats } = await import("./analytics.js");
        const stats = await getDailySummaryStats();
        const successRate =
          stats.totalTx > 0
            ? Math.round((stats.successTx / stats.totalTx) * 100)
            : 0;

        _enqueue(
          "📊 <b>Daily Summary — WAASDK</b>\n\n" +
            `👥 New Wallets: ${stats.newWallets ?? 0}\n` +
            `🔑 Sessions Created: ${stats.newSessions ?? 0}\n` +
            `💰 Contributions: ${_escapeHtml(String(stats.contributions ?? "0"))} ETH\n` +
            `📤 Transactions: ${stats.totalTx ?? 0}\n` +
            `🟢 Success Rate: ${successRate}%`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        console.error("[telegram] daily summary cron failed:", err.message);
      }
    },
    { timezone: "UTC" }
  );
}

/**
 * Send a raw HTML message to the operator chat.
 * Bypasses rate-limit queue for immediate delivery.
 */
export async function sendMessage(text) {
  if (!bot || !chatId) return;
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("[telegram] sendMessage error:", err.message);
  }
}

// ─── Wallet Alert ─────────────────────────────────────────────────────────────

/**
 * Alert: new wallet connected.
 * @param {{ address: string, chainId: number, timestamp?: number }} param0
 */
export async function alertWalletConnected({ address, chainId, timestamp }) {
  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  _enqueue(
    "🟢 <b>Wallet Connected</b>\n\n" +
      `👤 Address: <code>${_escapeHtml(address)}</code>\n` +
      `🔗 Chain: ${_escapeHtml(_chainName(chainId))} (${chainId})\n` +
      `🕐 Time: ${ts}`,
    { parse_mode: "HTML" }
  );
}

// ─── Session Alerts ───────────────────────────────────────────────────────────

/**
 * Alert: new session key created.
 * @param {{ userAddress: string, sessionKey: string, expiresAt: number, chainId: number, allowedContracts?: string[] }} param0
 */
export async function alertSessionCreated({
  userAddress,
  sessionKey,
  expiresAt,
  chainId,
  allowedContracts,
}) {
  const contracts =
    (allowedContracts ?? []).length > 0
      ? allowedContracts.map(_shortAddr).join(", ")
      : "any";

  _enqueue(
    "🟢 <b>New Session Created</b>\n\n" +
      `👤 User: <code>${_escapeHtml(_shortAddr(userAddress))}</code>\n` +
      `🔑 Session Key: <code>${_escapeHtml(_shortAddr(sessionKey))}</code>\n` +
      `📋 Contracts: ${_escapeHtml(contracts)}\n` +
      `⏰ Expires: ${_formatExpiry(expiresAt)}\n` +
      `🔗 Chain: ${_escapeHtml(_chainName(chainId))} (${chainId})`,
    { parse_mode: "HTML" }
  );
}

/**
 * Alert: session key used for a tx.
 * @param {{ userAddress: string, sessionKey: string, txHash: string, functionName: string, chainId: number }} param0
 */
export async function alertSessionUsed({
  userAddress,
  sessionKey,
  txHash,
  functionName,
  chainId,
}) {
  const explorerBase = _explorerUrl(chainId);
  _enqueue(
    "⚡ <b>Session Used</b>\n\n" +
      `👤 User: <code>${_escapeHtml(_shortAddr(userAddress))}</code>\n` +
      `🔑 Key: <code>${_escapeHtml(_shortAddr(sessionKey))}</code>\n` +
      `📄 Function: <code>${_escapeHtml(functionName ?? "unknown")}</code>\n` +
      `🔗 TX: ${explorerBase}/tx/${_escapeHtml(txHash)}\n` +
      `⛓ Chain: ${_escapeHtml(_chainName(chainId))}`,
    { parse_mode: "HTML" }
  );
}

/**
 * Alert: session expiring soon (< 1hr).
 * @param {{ userAddress: string, sessionKey: string, expiresAt: number }} param0
 */
export async function alertSessionExpiring({ userAddress, sessionKey, expiresAt }) {
  _enqueue(
    "⚠️ <b>Session Expiring Soon</b>\n\n" +
      `👤 User: <code>${_escapeHtml(_shortAddr(userAddress))}</code>\n` +
      `🔑 Key: <code>${_escapeHtml(_shortAddr(sessionKey))}</code>\n` +
      `⏰ Expires in: ${_formatExpiry(expiresAt)}`,
    { parse_mode: "HTML" }
  );
}

/**
 * Alert: session expired.
 * @param {{ userAddress: string, sessionKey: string }} param0
 */
export async function alertSessionExpired({ userAddress, sessionKey }) {
  _enqueue(
    "🔴 <b>Session Expired</b>\n\n" +
      `👤 User: <code>${_escapeHtml(_shortAddr(userAddress))}</code>\n` +
      `🔑 Key: <code>${_escapeHtml(_shortAddr(sessionKey))}</code>`,
    { parse_mode: "HTML" }
  );
}

/**
 * Alert: session revoked.
 * @param {{ userAddress: string, sessionKey: string }} param0
 */
export async function alertSessionRevoked({ userAddress, sessionKey }) {
  _enqueue(
    "🚫 <b>Session Revoked</b>\n\n" +
      `👤 User: <code>${_escapeHtml(_shortAddr(userAddress))}</code>\n` +
      `🔑 Key: <code>${_escapeHtml(_shortAddr(sessionKey))}</code>`,
    { parse_mode: "HTML" }
  );
}

// ─── Transaction Alerts ───────────────────────────────────────────────────────

/**
 * Alert: new transaction submitted.
 * @param {{ userAddress: string, txHash: string, functionName: string, contractAddress: string, chainId: number, value: string }} param0
 */
export async function alertTransactionSent({
  userAddress,
  txHash,
  functionName,
  contractAddress,
  chainId,
  value,
}) {
  const explorerBase = _explorerUrl(chainId);
  _enqueue(
    "📤 <b>Transaction Sent</b>\n\n" +
      `👤 User: <code>${_escapeHtml(_shortAddr(userAddress))}</code>\n` +
      `📄 Function: <code>${_escapeHtml(functionName ?? "unknown")}</code>\n` +
      `📝 Contract: <code>${_escapeHtml(_shortAddr(contractAddress))}</code>\n` +
      `💸 Value: ${_escapeHtml(value ?? "0")} ETH\n` +
      `🔗 TX: ${explorerBase}/tx/${_escapeHtml(txHash)}\n` +
      `⛓ Chain: ${_escapeHtml(_chainName(chainId))}`,
    { parse_mode: "HTML" }
  );
}

/**
 * Alert: transaction confirmed.
 * @param {{ txHash: string, blockNumber: number, gasUsed: string }} param0
 */
export async function alertTransactionConfirmed({ txHash, blockNumber, gasUsed }) {
  _enqueue(
    "✅ <b>Transaction Confirmed</b>\n\n" +
      `🔗 TX: <code>${_escapeHtml(txHash)}</code>\n` +
      `📦 Block: ${blockNumber ?? "unknown"}\n` +
      `⛽ Gas Used: ${_escapeHtml(String(gasUsed ?? "unknown"))}`,
    { parse_mode: "HTML" }
  );
}

/**
 * Alert: transaction failed.
 * @param {{ txHash: string, error: string }} param0
 */
export async function alertTransactionFailed({ txHash, error }) {
  _enqueue(
    "❌ <b>Transaction Failed</b>\n\n" +
      `🔗 TX: <code>${_escapeHtml(txHash)}</code>\n` +
      `⚠️ Error: ${_escapeHtml(error?.message ?? String(error ?? "unknown"))}`,
    { parse_mode: "HTML" }
  );
}

// ─── Presale Alerts ───────────────────────────────────────────────────────────

/**
 * Alert: presale contribution received.
 * @param {{ address: string, amount: string, totalRaised: number, hardcap: number, chainId: number }} param0
 */
export async function alertContribution({
  address,
  amount,
  totalRaised,
  hardcap,
  chainId,
}) {
  const percent =
    hardcap > 0 ? ((totalRaised / hardcap) * 100).toFixed(1) : "0.0";
  _enqueue(
    "💰 <b>New Contribution</b>\n\n" +
      `👤 From: <code>${_escapeHtml(_shortAddr(address))}</code>\n` +
      `💵 Amount: ${_escapeHtml(String(amount))} ETH\n` +
      `📊 Total Raised: ${_escapeHtml(String(totalRaised))} / ${hardcap} ETH (${percent}%)\n` +
      `⛓ Chain: ${_escapeHtml(_chainName(chainId))}`,
    { parse_mode: "HTML" }
  );
}

/**
 * Alert: presale goal reached.
 * @param {{ totalRaised: number, contributors: number }} param0
 */
export async function alertPresaleGoalReached({ totalRaised, contributors }) {
  _enqueue(
    "🎉 <b>Presale Goal Reached!</b>\n\n" +
      `💰 Total Raised: ${_escapeHtml(String(totalRaised))} ETH\n` +
      `👥 Contributors: ${contributors}\n` +
      "🚀 Presale is now complete!",
    { parse_mode: "HTML" }
  );
}

// ─── Error Alert ─────────────────────────────────────────────────────────────

/**
 * Alert: backend or contract error.
 * @param {Error|string} error
 * @param {string} [context]
 */
export async function alertError(error, context) {
  _enqueue(
    "🔴 <b>Backend Error</b>\n\n" +
      `⚠️ Context: ${_escapeHtml(context ?? "Unknown")}\n` +
      `Error: ${_escapeHtml(error?.message ?? String(error))}`,
    { parse_mode: "HTML" }
  );
}
