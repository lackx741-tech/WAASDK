/**
 * IntegratedDEX WaaS SDK — Session Manager Module
 *
 * Manages session keys using the on-chain SessionManager singleton contract.
 * Sessions are also cached in localStorage so they are available without an
 * RPC call and can be exported to a backend for server-side execution.
 *
 * SessionManager contract: 0x4AE428352317752a51Ac022C9D2551BcDef785cb
 *
 * Session lifecycle:
 *  1. User calls createSessionKey() → one wallet signature → session minted on-chain
 *  2. Backend / app receives onSessionCreated() callback with the session key
 *  3. executeWithSession() uses the key to send txs without another wallet popup
 *  4. revokeSessionKey() invalidates the session on-chain
 */

import { CONTRACTS, ABIS } from './constants.js';

// ─── Storage Key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'waas_sessions';

// ─── Session Created Listeners ────────────────────────────────────────────────

const _sessionCreatedListeners = [];

/**
 * Register a callback that fires whenever a new session is created.
 *
 * @param {function({ userAddress: string, session: object }): void} callback
 */
export function onSessionCreated(callback) {
  _sessionCreatedListeners.push(callback);
}

function _emitSessionCreated(userAddress, session) {
  _sessionCreatedListeners.forEach((cb) => cb({ userAddress, session }));
}

// ─── LocalStorage Helpers ────────────────────────────────────────────────────

/**
 * Load all cached sessions from localStorage.
 * @returns {object[]}
 */
export function loadSessions() {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Persist a session to localStorage.
 * @param {object} session
 */
export function saveSession(session) {
  if (typeof localStorage === 'undefined') return;
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.sessionKey === session.sessionKey);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/**
 * Remove a session from localStorage by session key address.
 * @param {string} sessionKey
 */
export function removeSession(sessionKey) {
  if (typeof localStorage === 'undefined') return;
  const sessions = loadSessions().filter((s) => s.sessionKey !== sessionKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/**
 * Clear all sessions from localStorage.
 */
export function clearSessions() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// ─── On-Chain Session Management ─────────────────────────────────────────────

/**
 * Create a session key ON-CHAIN via the SessionManager contract.
 *
 * The user signs one transaction. The session key is returned by the contract
 * and cached in localStorage for fast access.
 *
 * @param {object} provider  ethers v6 BrowserProvider / JsonRpcProvider
 * @param {string} account   User's wallet address
 * @param {object} opts      Session configuration
 * @param {string[]} [opts.allowedContracts=[]]   Contracts the session may call
 * @param {string[]} [opts.allowedFunctions=[]]   Function selectors (bytes4) allowed
 * @param {bigint|string} [opts.spendingLimit=0]  Max wei the session may spend
 * @param {number} [opts.expiresAt]               Unix timestamp; defaults to +24h
 * @param {number} [opts.chainId]                 Chain ID (informational only)
 * @returns {Promise<object>}  Session data including the on-chain session key address
 */
export async function createSessionKey(provider, account, opts = {}) {
  const {
    allowedContracts = [],
    allowedFunctions = [],
    spendingLimit    = 0n,
    expiresAt        = Math.floor(Date.now() / 1000) + 86400, // 24h default
    chainId,
  } = opts;

  const { Contract } = await import('ethers');
  const signer = await provider.getSigner(account);

  const contract = new Contract(
    CONTRACTS.SessionManager,
    ABIS.SessionManager,
    signer,
  );

  const tx = await contract.createSession(
    allowedContracts,
    allowedFunctions,
    BigInt(spendingLimit.toString()),
    BigInt(expiresAt),
  );
  const receipt = await tx.wait();

  // The session key address is returned as the first value from the function,
  // but since we sent a tx we read it from the SessionCreated event instead.
  let sessionKey = null;
  for (const log of receipt.logs) {
    try {
      const iface = contract.interface;
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'SessionCreated') {
        sessionKey = parsed.args.sessionKey;
        break;
      }
    } catch {
      // not our event — skip
    }
  }

  const sessionData = {
    sessionKey,
    owner:            account,
    allowedContracts,
    allowedFunctions,
    spendingLimit:    spendingLimit.toString(),
    expiresAt,
    chainId:          chainId ?? null,
    txHash:           receipt.hash,
    onChain:          true,
    createdAt:        Math.floor(Date.now() / 1000),
  };

  saveSession(sessionData);
  _emitSessionCreated(account, sessionData);

  return sessionData;
}

/**
 * Verify that a session key is still valid by querying the on-chain contract.
 *
 * @param {string} sessionKey  Session key address
 * @param {object} provider    ethers v6 provider (read-only is fine)
 * @returns {Promise<boolean>}
 */
export async function isSessionValid(sessionKey, provider) {
  const { Contract } = await import('ethers');
  const contract = new Contract(
    CONTRACTS.SessionManager,
    ABIS.SessionManager,
    provider,
  );
  return await contract.isSessionValid(sessionKey);
}

/**
 * Revoke a session key ON-CHAIN via the SessionManager contract.
 *
 * The session is also removed from the local cache.
 *
 * @param {string} sessionKey  Session key address to revoke
 * @param {object} provider    ethers v6 BrowserProvider (needs signer)
 * @returns {Promise<object>}  Transaction response
 */
export async function revokeSessionKey(sessionKey, provider) {
  const { Contract } = await import('ethers');
  const signer = await provider.getSigner();

  const contract = new Contract(
    CONTRACTS.SessionManager,
    ABIS.SessionManager,
    signer,
  );

  const tx = await contract.revokeSession(sessionKey);
  removeSession(sessionKey);
  return tx;
}

/**
 * Get all session keys for an owner address from the on-chain contract.
 *
 * @param {string} owner    Owner wallet address
 * @param {object} provider ethers v6 provider
 * @returns {Promise<string[]>}  Array of session key addresses
 */
export async function getSessions(owner, provider) {
  const { Contract } = await import('ethers');
  const contract = new Contract(
    CONTRACTS.SessionManager,
    ABIS.SessionManager,
    provider,
  );
  return await contract.getSessions(owner);
}

// ─── Session Execution ────────────────────────────────────────────────────────

/**
 * Execute a transaction using a session key — no wallet popup required.
 *
 * The session key must still be valid on-chain. The provider must have the
 * session key loaded as a signer (e.g. an ethers Wallet constructed from the
 * session key's private key).
 *
 * @param {string} sessionKey        Session key address
 * @param {object} sessionSigner     ethers v6 Signer for the session key
 * @param {object} call              Call to execute
 * @param {string} call.to           Target contract address
 * @param {string} call.data         Encoded call data (0x-prefixed)
 * @param {bigint} [call.value=0n]   ETH value to send
 * @returns {Promise<object>}  Transaction response
 */
export async function executeWithSession(sessionKey, sessionSigner, call) {
  const { isAddress } = await import('ethers');

  if (!isAddress(sessionKey)) {
    throw new Error('executeWithSession: invalid sessionKey address');
  }
  if (!call?.to) {
    throw new Error('executeWithSession: call.to is required');
  }

  const tx = await sessionSigner.sendTransaction({
    to:    call.to,
    data:  call.data  ?? '0x',
    value: call.value ?? 0n,
  });
  return tx;
}
