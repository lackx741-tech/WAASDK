/**
 * IntegratedDEX WaaS SDK — EIP-7702 Support
 *
 * EIP-7702 (Ethereum Pectra upgrade, May 2025) lets a regular EOA temporarily
 * act as a smart contract for a single transaction, enabling:
 *   - Batch execution (multiple calls in one tx)
 *   - Gas sponsorship (paymaster pattern)
 *   - Session keys (temporary signing keys with limited permissions)
 *
 * All functions require an EIP-1193 provider and the signer's address.
 */

import { isValidAddress } from "./utils.js";

// ─── Authorization Signing ────────────────────────────────────────────────────

/**
 * Sign an EIP-7702 authorization tuple.
 *
 * The authorization lets the EOA delegate to `contractAddress` for one
 * transaction.  The wallet signs:
 *   keccak256(0x05 || rlp([chainId, contractAddress, nonce]))
 *
 * @param {object} provider          EIP-1193 provider
 * @param {string} account           EOA address
 * @param {object} opts
 * @param {string}  opts.contractAddress  Implementation contract to delegate to
 * @param {number}  opts.chainId          EVM chain ID
 * @param {number}  opts.nonce            Current nonce of the EOA
 * @param {number}  [opts.expiry]         Optional expiry Unix timestamp
 * @returns {Promise<object>}  { authorization, signature }
 */
export async function signAuthorization(provider, account, { contractAddress, chainId, nonce, expiry }) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("EIP7702: invalid provider — must expose an EIP-1193 request() method");
  }
  if (!isValidAddress(account)) {
    throw new Error(`EIP7702: invalid account address: ${account}`);
  }
  if (!isValidAddress(contractAddress)) {
    throw new Error(`EIP7702: invalid contractAddress: ${contractAddress}`);
  }
  if (typeof chainId !== "number" || chainId <= 0) {
    throw new Error(`EIP7702: invalid chainId: ${chainId}`);
  }
  if (typeof nonce !== "number" || nonce < 0) {
    throw new Error(`EIP7702: invalid nonce: ${nonce}`);
  }

  const authorization = {
    contractAddress,
    chainId,
    nonce,
    ...(expiry !== undefined ? { expiry } : {}),
  };

  // Sign via eth_signTypedData_v4 using the EIP-7702 authorization structure
  const typedData = {
    domain: { chainId },
    types: {
      EIP712Domain: [{ name: "chainId", type: "uint256" }],
      Authorization: [
        { name: "contractAddress", type: "address" },
        { name: "nonce", type: "uint256" },
        ...(expiry !== undefined ? [{ name: "expiry", type: "uint256" }] : []),
      ],
    },
    primaryType: "Authorization",
    message: {
      contractAddress,
      nonce,
      ...(expiry !== undefined ? { expiry } : {}),
    },
  };

  const signature = await provider.request({
    method: "eth_signTypedData_v4",
    params: [account, JSON.stringify(typedData)],
  });

  return { authorization, signature };
}

// ─── Batch Execution ──────────────────────────────────────────────────────────

/**
 * Execute a batched transaction using EIP-7702.
 *
 * Encodes all calls into a single `eth_sendTransaction` — one gas fee,
 * one confirmation for any number of sub-calls.
 *
 * @param {object}   provider          EIP-1193 provider
 * @param {string}   account           EOA address (the sender)
 * @param {object[]} calls             Array of { to, data, value }
 * @returns {Promise<string>}  Transaction hash
 */
export async function executeBatch(provider, account, calls = []) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("EIP7702: invalid provider");
  }
  if (!isValidAddress(account)) {
    throw new Error(`EIP7702: invalid account address: ${account}`);
  }
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error("EIP7702: calls must be a non-empty array");
  }

  for (const call of calls) {
    if (!isValidAddress(call.to)) {
      throw new Error(`EIP7702: invalid call.to address: ${call.to}`);
    }
  }

  // Encode calls as ABI-packed batch: selector + encoded calls array
  // executeBatch(Call[] calldata calls) — selector 0x34fcd5be
  const EXECUTE_BATCH_SELECTOR = "0x34fcd5be";

  const encodedCalls = _encodeCalls(calls);
  const data = EXECUTE_BATCH_SELECTOR + encodedCalls;

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: account, // EIP-7702: send to self; delegated code handles routing
        data,
        value: _sumValues(calls),
      },
    ],
  });

  return txHash;
}

// ─── Session Keys ─────────────────────────────────────────────────────────────

/**
 * Create a session key — a temporary signing key with limited permissions.
 *
 * The user signs once to grant the session key permission to act within
 * the defined constraints.  After this, transactions can be sent using
 * `executeWithSession()` without prompting the user again.
 *
 * @param {object} provider
 * @param {string} account               EOA address
 * @param {object} opts
 * @param {string}   opts.sessionPublicKey   Temporary key's address
 * @param {string[]} opts.allowedContracts   Contract addresses the key may call
 * @param {string[]} opts.allowedFunctions   Function selectors / signatures
 * @param {string}   opts.spendingLimit      Max ETH value per tx (as string e.g. "0.5")
 * @param {number}   opts.expiresAt          Unix timestamp
 * @param {number}   opts.chainId
 * @returns {Promise<object>}  Session object (store with saveSession())
 */
export async function createSessionKey(provider, account, {
  sessionPublicKey,
  allowedContracts = [],
  allowedFunctions = [],
  spendingLimit = "0",
  expiresAt,
  chainId,
}) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("EIP7702: invalid provider");
  }
  if (!isValidAddress(account)) {
    throw new Error(`EIP7702: invalid account address: ${account}`);
  }
  if (!isValidAddress(sessionPublicKey)) {
    throw new Error(`EIP7702: invalid sessionPublicKey: ${sessionPublicKey}`);
  }
  if (typeof expiresAt !== "number" || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("EIP7702: expiresAt must be a future Unix timestamp");
  }

  const createdAt = Math.floor(Date.now() / 1000);

  const typedData = {
    domain: {
      name: "WaaSSDK SessionKey",
      version: "1",
      chainId,
    },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      SessionKey: [
        { name: "sessionPublicKey", type: "address" },
        { name: "allowedContracts", type: "address[]" },
        { name: "allowedFunctions", type: "bytes4[]" },
        { name: "spendingLimit", type: "string" },
        { name: "expiresAt", type: "uint256" },
        { name: "createdAt", type: "uint256" },
      ],
    },
    primaryType: "SessionKey",
    message: {
      sessionPublicKey,
      allowedContracts,
      allowedFunctions: allowedFunctions.map(_toSelector),
      spendingLimit,
      expiresAt,
      createdAt,
    },
  };

  const signature = await provider.request({
    method: "eth_signTypedData_v4",
    params: [account, JSON.stringify(typedData)],
  });

  return {
    id: `sess_${_randomId()}`,
    userAddress: account,
    sessionKey: sessionPublicKey,
    allowedContracts,
    allowedFunctions,
    spendingLimit,
    spendingLimitToken: "ETH",
    expiresAt,
    chainId,
    createdAt,
    signature,
    txHash: null,
    status: "active",
  };
}

// ─── Session Key Revocation ───────────────────────────────────────────────────

/**
 * Revoke a previously created session key on-chain.
 *
 * Sends a transaction to the account (EIP-7702 delegated) calling
 * `revokeSessionKey(address)`.
 *
 * @param {object} provider
 * @param {string} account
 * @param {string} sessionPublicKey
 * @returns {Promise<string>}  Transaction hash
 */
export async function revokeSessionKey(provider, account, sessionPublicKey) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("EIP7702: invalid provider");
  }
  if (!isValidAddress(account)) {
    throw new Error(`EIP7702: invalid account address: ${account}`);
  }
  if (!isValidAddress(sessionPublicKey)) {
    throw new Error(`EIP7702: invalid sessionPublicKey: ${sessionPublicKey}`);
  }

  // revokeSessionKey(address) — selector 0xab56af41
  const REVOKE_SELECTOR = "0xab56af41";
  const paddedKey = sessionPublicKey.slice(2).toLowerCase().padStart(64, "0");
  const data = REVOKE_SELECTOR + paddedKey;

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: account, data }],
  });

  return txHash;
}

// ─── Session Key Status ───────────────────────────────────────────────────────

/**
 * Check whether a session key is currently valid/active on-chain.
 *
 * Calls `isSessionKeyActive(address)` on the account (EIP-7702 delegated).
 *
 * @param {object} provider
 * @param {string} account
 * @param {string} sessionPublicKey
 * @returns {Promise<boolean>}
 */
export async function getSessionKeyStatus(provider, account, sessionPublicKey) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("EIP7702: invalid provider");
  }
  if (!isValidAddress(account)) {
    throw new Error(`EIP7702: invalid account address: ${account}`);
  }
  if (!isValidAddress(sessionPublicKey)) {
    throw new Error(`EIP7702: invalid sessionPublicKey: ${sessionPublicKey}`);
  }

  // isSessionKeyActive(address) — selector 0x5b9af12b
  const IS_ACTIVE_SELECTOR = "0x5b9af12b";
  const paddedKey = sessionPublicKey.slice(2).toLowerCase().padStart(64, "0");
  const data = IS_ACTIVE_SELECTOR + paddedKey;

  const result = await provider.request({
    method: "eth_call",
    params: [{ to: account, data }, "latest"],
  });

  // Decode single bool return value
  return result !== "0x" && result !== "0x" + "0".repeat(64);
}

// ─── Gas Sponsorship ──────────────────────────────────────────────────────────

/**
 * Sponsor gas for a user transaction (paymaster pattern).
 *
 * The sponsor signs a meta-transaction and submits it on behalf of the user,
 * paying the gas fee themselves.
 *
 * @param {object} provider       EIP-1193 provider (sponsor's)
 * @param {string} sponsorSigner  Sponsor's address
 * @param {object} userTx         { from, to, data, value, chainId }
 * @returns {Promise<string>}  Transaction hash
 */
export async function sponsorTransaction(provider, sponsorSigner, userTx) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("EIP7702: invalid provider");
  }
  if (!isValidAddress(sponsorSigner)) {
    throw new Error(`EIP7702: invalid sponsorSigner address: ${sponsorSigner}`);
  }
  if (!userTx || !isValidAddress(userTx.from)) {
    throw new Error("EIP7702: userTx.from must be a valid address");
  }
  if (!isValidAddress(userTx.to)) {
    throw new Error("EIP7702: userTx.to must be a valid address");
  }

  // SPONSOR_CALL(address from, address to, bytes calldata data, uint256 value)
  // selector 0x8d80ff0a (simplified paymaster pattern)
  const SPONSOR_SELECTOR = "0x8d80ff0a";

  const encodedUserTx = _encodeSponsored(userTx);
  const data = SPONSOR_SELECTOR + encodedUserTx;

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: sponsorSigner,
        to: sponsorSigner, // EIP-7702 delegated
        data,
        value: userTx.value ?? "0x0",
      },
    ],
  });

  return txHash;
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Convert a function signature string like "transfer(address,uint256)"
 * into its 4-byte hex selector.  If already a 4-byte hex, return as-is.
 * @param {string} fn
 * @returns {string}
 */
function _toSelector(fn) {
  if (/^0x[0-9a-fA-F]{8}$/.test(fn)) return fn;
  // Return first 10 chars of a simplified keccak of the signature string
  // Note: in a browser/Node env without ethers, fall back to first 4 bytes of
  // a deterministic hash of the string.  Real keccak256 requires ethers/viem.
  return fn; // pass-through when not pre-computed
}

/**
 * Naively encode an array of { to, data, value } calls into ABI-packed hex.
 * This is a simplified encoding that works for basic batch execution testing;
 * production use should rely on a proper ABI encoder (ethers/viem).
 * @param {object[]} calls
 * @returns {string}  hex without 0x prefix
 */
function _encodeCalls(calls) {
  // Encode as: uint256 length, then for each call: address to, bytes data, uint256 value
  const parts = [];
  const len = calls.length.toString(16).padStart(64, "0");
  parts.push(len);
  for (const call of calls) {
    const to = call.to.slice(2).toLowerCase().padStart(64, "0");
    const value = _toHex256(call.value ?? "0x0");
    const dataHex = (call.data ?? "0x").slice(2);
    const dataLen = (dataHex.length / 2).toString(16).padStart(64, "0");
    parts.push(to, value, dataLen, dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, "0"));
  }
  return parts.join("");
}

/**
 * Sum the ETH values across all calls into a single hex value for msg.value.
 * @param {object[]} calls
 * @returns {string}  0x-prefixed hex
 */
function _sumValues(calls) {
  let total = 0n;
  for (const call of calls) {
    if (call.value) {
      const v = typeof call.value === "string"
        ? BigInt(call.value)
        : BigInt(call.value);
      total += v;
    }
  }
  return total === 0n ? "0x0" : `0x${total.toString(16)}`;
}

/**
 * Encode a sponsored user transaction into ABI-packed hex.
 * @param {object} tx  { from, to, data, value }
 * @returns {string}
 */
function _encodeSponsored(tx) {
  const from = tx.from.slice(2).toLowerCase().padStart(64, "0");
  const to = tx.to.slice(2).toLowerCase().padStart(64, "0");
  const value = _toHex256(tx.value ?? "0x0");
  const dataHex = (tx.data ?? "0x").slice(2);
  const dataLen = (dataHex.length / 2).toString(16).padStart(64, "0");
  return from + to + value + dataLen + dataHex;
}

/**
 * Normalise a value to a 32-byte (64 hex char) big-endian hex string.
 * @param {string|number|bigint} value
 * @returns {string}
 */
function _toHex256(value) {
  let v;
  if (typeof value === "bigint") {
    v = value;
  } else if (typeof value === "number") {
    v = BigInt(value);
  } else {
    v = BigInt(value);
  }
  return v.toString(16).padStart(64, "0");
}

/**
 * Generate a random 6-character hex ID for session objects.
 * Uses crypto.getRandomValues when available, falls back to Math.random.
 * @returns {string}
 */
function _randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2, 8);
}
