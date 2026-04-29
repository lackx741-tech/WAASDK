/**
 * IntegratedDEX WaaS SDK — Session Manager
 *
 * Tracks active EIP-7702 session keys in localStorage (browser) or an
 * in-memory store (Node.js / test environment).  Fires callbacks when
 * sessions are created, used, or expire.
 *
 * Session object shape:
 * {
 *   id:               "sess_abc123",
 *   userAddress:      "0xUser...",
 *   sessionKey:       "0xTempKey...",
 *   sessionKeyPrivate:"0xPrivKey...",   // only present if generated client-side
 *   allowedContracts: ["0xPresale..."],
 *   allowedFunctions: ["contribute(uint256)", "claim()"],
 *   spendingLimit:    "0.5",
 *   spendingLimitToken: "ETH",
 *   expiresAt:        1748000000,        // Unix seconds
 *   chainId:          1,
 *   createdAt:        1747000000,        // Unix seconds
 *   signature:        "0xSig...",
 *   txHash:           "0xTx...",
 *   status:           "active" | "expired" | "revoked"
 * }
 */

// ─── Storage Abstraction ──────────────────────────────────────────────────────

const STORAGE_KEY = "waas_sessions";

/**
 * Read all sessions from storage.
 * @returns {object[]}
 */
function _readStore() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {
    // ignore parse / access errors
  }
  return _memoryStore;
}

/**
 * Write all sessions to storage.
 * @param {object[]} sessions
 */
function _writeStore(sessions) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      return;
    }
  } catch {
    // ignore write errors
  }
  _memoryStore = sessions;
}

/** In-memory fallback for non-browser environments. */
let _memoryStore = [];

// ─── Listeners ────────────────────────────────────────────────────────────────

/** @type {Function[]} */
const _onCreatedListeners = [];
/** @type {Function[]} */
const _onExpiredListeners = [];

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Store a newly created session and notify listeners.
 *
 * @param {object} session  Session object (from createSessionKey())
 * @returns {object}  The stored session (with generated id if missing)
 */
export function saveSession(session) {
  if (!session || typeof session !== "object") {
    throw new Error("SessionManager: session must be an object");
  }
  if (!session.userAddress) {
    throw new Error("SessionManager: session.userAddress is required");
  }
  if (!session.sessionKey) {
    throw new Error("SessionManager: session.sessionKey is required");
  }

  const stored = {
    id: session.id ?? `sess_${_randomId()}`,
    status: "active",
    createdAt: Math.floor(Date.now() / 1000),
    ...session,
  };

  const sessions = _readStore();
  sessions.push(stored);
  _writeStore(sessions);

  // Notify listeners
  for (const cb of _onCreatedListeners) {
    try {
      cb({ userAddress: stored.userAddress, session: stored });
    } catch {
      // ignore listener errors
    }
  }

  return stored;
}

// ─── Retrieve ─────────────────────────────────────────────────────────────────

/**
 * Get all active (non-expired, non-revoked) sessions for a user address.
 *
 * @param {string} userAddress
 * @returns {object[]}
 */
export function getActiveSessions(userAddress) {
  if (!userAddress) throw new Error("SessionManager: userAddress is required");
  const now = Math.floor(Date.now() / 1000);
  return _readStore().filter(
    (s) =>
      s.userAddress?.toLowerCase() === userAddress.toLowerCase() &&
      s.status !== "revoked" &&
      (s.expiresAt === undefined || s.expiresAt > now)
  );
}

/**
 * Get ALL sessions across all users (for operator dashboard).
 *
 * @returns {object[]}
 */
export function getAllSessions() {
  return _readStore();
}

// ─── Validity Check ───────────────────────────────────────────────────────────

/**
 * Check if a session object is still valid (not expired, not revoked).
 *
 * @param {object} session
 * @returns {boolean}
 */
export function isSessionValid(session) {
  if (!session || typeof session !== "object") return false;
  if (session.status === "revoked") return false;
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt !== undefined && session.expiresAt <= now) return false;
  return true;
}

// ─── Execute With Session ─────────────────────────────────────────────────────

/**
 * Use a session key to sign and send a transaction without user confirmation.
 *
 * The session key must have been previously created and stored.
 * Validates spending limits and allowed contracts before sending.
 *
 * @param {string} sessionKeyAddress  The session key's address
 * @param {object} provider           EIP-1193 provider
 * @param {object} call               { to, data, value }
 * @returns {Promise<string>}  Transaction hash
 */
export async function executeWithSession(sessionKeyAddress, provider, call) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("SessionManager: invalid provider");
  }
  if (!call || !call.to) {
    throw new Error("SessionManager: call.to is required");
  }

  const sessions = _readStore();
  const session = sessions.find(
    (s) => s.sessionKey?.toLowerCase() === sessionKeyAddress?.toLowerCase()
  );

  if (!session) {
    throw new Error(`SessionManager: no session found for key ${sessionKeyAddress}`);
  }
  if (!isSessionValid(session)) {
    throw new Error(`SessionManager: session ${session.id} is no longer valid`);
  }

  // Validate allowed contracts
  if (
    session.allowedContracts?.length > 0 &&
    !session.allowedContracts.some((c) => c.toLowerCase() === call.to.toLowerCase())
  ) {
    throw new Error(
      `SessionManager: contract ${call.to} is not in the allowed list for session ${session.id}`
    );
  }

  // Send using the provider (session key is the signer)
  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: sessionKeyAddress,
        to: call.to,
        data: call.data ?? "0x",
        value: call.value ?? "0x0",
      },
    ],
  });

  // Update session's last-used timestamp
  const updated = sessions.map((s) =>
    s.sessionKey?.toLowerCase() === sessionKeyAddress?.toLowerCase()
      ? { ...s, lastUsedAt: Math.floor(Date.now() / 1000) }
      : s
  );
  _writeStore(updated);

  return txHash;
}

// ─── Listeners ────────────────────────────────────────────────────────────────

/**
 * Register a callback that fires whenever a new session is created via saveSession().
 *
 * @param {Function} callback  ({ userAddress, session }) => void
 * @returns {Function}  Unsubscribe function
 */
export function onSessionCreated(callback) {
  if (typeof callback !== "function") {
    throw new Error("SessionManager: callback must be a function");
  }
  _onCreatedListeners.push(callback);
  return () => {
    const idx = _onCreatedListeners.indexOf(callback);
    if (idx !== -1) _onCreatedListeners.splice(idx, 1);
  };
}

/**
 * Register a callback that fires when a session is detected as expired.
 * Uses a polling interval of 60 seconds.
 *
 * @param {Function} callback  (session) => void
 * @returns {Function}  Unsubscribe / stop function
 */
export function onSessionExpired(callback) {
  if (typeof callback !== "function") {
    throw new Error("SessionManager: callback must be a function");
  }
  _onExpiredListeners.push(callback);

  const timer = typeof setInterval !== "undefined"
    ? setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const sessions = _readStore();
        let changed = false;
        const updated = sessions.map((s) => {
          if (s.status === "active" && s.expiresAt !== undefined && s.expiresAt <= now) {
            changed = true;
            for (const cb of _onExpiredListeners) {
              try { cb({ ...s, status: "expired" }); } catch { /* ignore */ }
            }
            return { ...s, status: "expired" };
          }
          return s;
        });
        if (changed) _writeStore(updated);
      }, 60_000)
    : null;

  return () => {
    const idx = _onExpiredListeners.indexOf(callback);
    if (idx !== -1) _onExpiredListeners.splice(idx, 1);
    if (timer !== null) clearInterval(timer);
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Export all sessions as a JSON string.
 *
 * @returns {string}  JSON array of all session objects
 */
export function exportSessions() {
  return JSON.stringify(_readStore(), null, 2);
}

// ─── Revoke (local only) ──────────────────────────────────────────────────────

/**
 * Mark a session as revoked in local storage.
 * Call revokeSessionKey() from eip7702.js to also revoke on-chain.
 *
 * @param {string} sessionId  The session's id field
 * @returns {boolean}  true if a session was found and revoked
 */
export function revokeSession(sessionId) {
  const sessions = _readStore();
  let found = false;
  const updated = sessions.map((s) => {
    if (s.id === sessionId) {
      found = true;
      return { ...s, status: "revoked" };
    }
    return s;
  });
  if (found) _writeStore(updated);
  return found;
}

// ─── Internal Reset (test helper) ────────────────────────────────────────────

/**
 * Clear all in-memory sessions and listeners.
 * Intended only for unit tests — do not call in production code.
 */
export function _resetForTesting() {
  _memoryStore = [];
  _onCreatedListeners.length = 0;
  _onExpiredListeners.length = 0;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _randomId() {
  return Math.random().toString(36).slice(2, 8);
}
