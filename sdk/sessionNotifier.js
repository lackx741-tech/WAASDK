/**
 * IntegratedDEX WaaS SDK — Session Notifier
 *
 * Provides browser notifications and optional webhook delivery for session
 * lifecycle events (created, used, expiring, expired).
 *
 * All functions are no-ops when the Notifications API is unavailable
 * (e.g., non-browser environments) so the SDK remains importable in Node.js.
 */

// ─── Browser Notification Helpers ─────────────────────────────────────────────

/**
 * Request notification permission if not already granted.
 * @returns {Promise<boolean>}  true if permission is granted
 */
async function _ensurePermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Show a browser notification.
 * @param {string} title
 * @param {string} body
 * @param {string} [icon]
 */
async function _notify(title, body, icon) {
  if (!(await _ensurePermission())) return;
  try {
    new Notification(title, { body, icon: icon ?? "/favicon.ico" });
  } catch {
    // ignore — some environments block Notification constructor
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Show a browser notification when a session key is created.
 *
 * @param {object} session  Session object from createSessionKey() / saveSession()
 * @returns {Promise<void>}
 */
export async function notifySessionCreated(session) {
  if (!session) return;
  const addr = _short(session.userAddress);
  const expIn = _relativeTime(session.expiresAt);
  await _notify(
    "⚡ New Session Created",
    `${addr} signed a session — expires ${expIn}\nAllowed: ${(session.allowedFunctions ?? []).join(", ") || "any"}`
  );
}

/**
 * Show a browser notification when a session key is used to send a tx.
 *
 * @param {object} session
 * @param {string} txHash
 * @returns {Promise<void>}
 */
export async function notifySessionUsed(session, txHash) {
  if (!session) return;
  const addr = _short(session.userAddress);
  const tx = _short(txHash, 10);
  await _notify(
    "⚡ Session Tx Sent",
    `${addr} — tx ${tx}`
  );
}

/**
 * Show a warning notification when a session is close to expiry.
 *
 * @param {object} session
 * @param {number} minutesLeft  Minutes remaining until expiry
 * @returns {Promise<void>}
 */
export async function notifySessionExpiring(session, minutesLeft) {
  if (!session) return;
  const addr = _short(session.userAddress);
  await _notify(
    "🟡 Session Expiring Soon",
    `${addr} — ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""} left`
  );
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

/**
 * Send a webhook POST when a session event occurs.
 *
 * The webhook receives:
 * ```json
 * {
 *   "event":   "session_created" | "session_used" | "session_expiring" | "session_expired",
 *   "session": { …session object… },
 *   "timestamp": 1747000000
 * }
 * ```
 *
 * @param {string} webhookUrl  HTTP(S) endpoint to POST to
 * @param {string} event       Event name string
 * @param {object} session     Session object
 * @returns {Promise<void>}
 */
export async function webhookSessionEvent(webhookUrl, event, session) {
  if (!webhookUrl || typeof webhookUrl !== "string") {
    throw new Error("SessionNotifier: webhookUrl must be a non-empty string");
  }
  if (!event || typeof event !== "string") {
    throw new Error("SessionNotifier: event must be a non-empty string");
  }

  const payload = {
    event,
    session: session ?? null,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `SessionNotifier: webhook request failed — ${response.status} ${response.statusText}`
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Shorten an address/hash for display.
 * @param {string} str
 * @param {number} [len=8]
 * @returns {string}
 */
function _short(str, len = 8) {
  if (!str || str.length <= len) return str ?? "";
  return `${str.slice(0, len)}…`;
}

/**
 * Format a Unix timestamp as a relative human-readable string.
 * @param {number} unixTs
 * @returns {string}
 */
function _relativeTime(unixTs) {
  if (!unixTs) return "unknown";
  const secs = unixTs - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "now (expired)";
  if (secs < 60) return `in ${secs}s`;
  if (secs < 3600) return `in ${Math.round(secs / 60)}m`;
  return `in ${Math.round(secs / 3600)}h`;
}
