/**
 * Telegram alert module.
 *
 * Sends formatted messages to a Telegram chat via the Bot API.
 * All functions are fire-and-forget — they never throw so a Telegram failure
 * cannot take down the server.
 */

import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from './config.js';

/**
 * Send a plain-text or HTML message to the configured Telegram chat.
 * @param {string} text  Message text (supports HTML tags)
 * @returns {Promise<void>}
 */
export async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.warn('[telegram] sendMessage failed:', res.status, await res.text());
    }
  } catch (err) {
    console.warn('[telegram] fetch error:', err.message);
  }
}

// ─── Alert Helpers ────────────────────────────────────────────────────────────

export function alertWalletConnected({ address, chainId }) {
  return sendTelegram(
    `🟢 <b>Wallet Connected</b>\n` +
    `Address: <code>${address}</code>\n` +
    `Chain: ${chainId}`,
  );
}

export function alertSessionCreated({ sessionKey, owner, expiresAt, chainId }) {
  const expiry = new Date(expiresAt * 1000).toUTCString();
  return sendTelegram(
    `🔑 <b>New Session Created</b>\n` +
    `Owner:      <code>${owner}</code>\n` +
    `Session:    <code>${sessionKey}</code>\n` +
    `Expires:    ${expiry}\n` +
    `Chain:      ${chainId ?? 'all'}`,
  );
}

export function alertSessionRevoked({ sessionKey, owner }) {
  return sendTelegram(
    `🚫 <b>Session Revoked</b>\n` +
    `Owner:   <code>${owner}</code>\n` +
    `Session: <code>${sessionKey}</code>`,
  );
}

export function alertSessionTx({ sessionKey, txHash, functionName, chainId }) {
  return sendTelegram(
    `⚡ <b>Session TX Sent</b>\n` +
    `Function: ${functionName ?? 'unknown'}\n` +
    `Session:  <code>${sessionKey}</code>\n` +
    `Tx Hash:  <code>${txHash}</code>\n` +
    `Chain:    ${chainId ?? 'unknown'}`,
  );
}

export function alertSessionExpiring({ sessionKey, owner, minutesLeft }) {
  return sendTelegram(
    `⚠️ <b>Session Expiring Soon</b>\n` +
    `Owner:   <code>${owner}</code>\n` +
    `Session: <code>${sessionKey}</code>\n` +
    `Expires in: ${minutesLeft} minutes`,
  );
}

export function alertDailySummary({ totalSessions, activeSessions, totalTxs, date }) {
  return sendTelegram(
    `📊 <b>Daily Summary — ${date}</b>\n` +
    `Total Sessions: ${totalSessions}\n` +
    `Active Sessions: ${activeSessions}\n` +
    `Total Transactions: ${totalTxs}`,
  );
}
