/**
 * IntegratedDEX WaaS SDK — Permit2 Module
 *
 * Integrates with Uniswap's Permit2 contract for gasless, user-controlled
 * ERC-20 approvals via EIP-712 signatures.
 *
 * Permit2 contract: 0x000000000022D473030F116dDEE9F6B43aC78BA3
 *
 * Key principles:
 *  - MAX (type(uint256).max) is used as the default approval amount,
 *    matching the on-chain MAX constant on Permit2Executor and ERC2612Executor.
 *  - Pass an explicit amount to override the default.
 *  - Every approval presents a clear human-readable preview before signing.
 */

import { buildDomain, buildTypedData, signTypedData, splitSignature } from "./eip712.js";
import { deadlineFromNow, isValidAddress } from "./utils.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Official Uniswap Permit2 deployment (same address on all EVM chains). */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * Explicit sentinel for "user consciously wants maximum approval".
 * This is also the default — matching the on-chain MAX constant
 * (type(uint256).max) on Permit2Executor and ERC2612Executor.
 */
export const PERMIT2_MAX_AMOUNT = 2n ** 256n - 1n; // uint256 max == MAX_UINT256

// ─── EIP-712 Type Definitions ─────────────────────────────────────────────────

const TOKEN_PERMISSIONS_TYPE = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
  ],
};

const PERMIT_SINGLE_TYPES = {
  ...TOKEN_PERMISSIONS_TYPE,
  PermitSingle: [
    { name: "details", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
};

const PERMIT_BATCH_TYPES = {
  ...TOKEN_PERMISSIONS_TYPE,
  PermitBatch: [
    { name: "details", type: "TokenPermissions[]" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
};

// ─── Domain Builder ───────────────────────────────────────────────────────────

/**
 * Build the Permit2 EIP-712 domain for a given chain.
 * @param {number} chainId
 * @returns {object}
 */
function permit2Domain(chainId) {
  return buildDomain({
    name: "Permit2",
    version: "1",
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  });
}

// ─── PermitSingle ─────────────────────────────────────────────────────────────

/**
 * Build and sign a Permit2 `PermitSingle` request.
 *
 * The user is shown exactly which token, how much, and to which spender
 * before they sign — wallet UX handles the human-readable preview via
 * EIP-712 structured display.
 *
 * @param {object} provider     EIP-1193 provider
 * @param {string} account      User's wallet address
 * @param {number} chainId      EVM chain ID
 * @param {object} permit       Permit details
 * @param {string} permit.token         ERC-20 token address
 * @param {bigint} [permit.amount]        Amount to approve (defaults to MAX_UINT256 when omitted)
 * @param {number} [permit.expiration]  Unix timestamp expiry for the allowance
 * @param {number} [permit.nonce]       Permit2 nonce (fetched on-chain if omitted)
 * @param {string} permit.spender       Address being granted the allowance
 * @param {number} [permit.sigDeadline] Unix timestamp deadline for signature validity
 * @returns {Promise<{ signature: string, r: string, s: string, v: number, deadline: number }>}
 */
export async function signPermitSingle(provider, account, chainId, permit) {
  const { token, amount = PERMIT2_MAX_AMOUNT, expiration, nonce = 0, spender, sigDeadline } = permit;

  if (!isValidAddress(token)) throw new Error("Permit2: invalid token address");
  if (!isValidAddress(spender)) throw new Error("Permit2: invalid spender address");

  const deadline = sigDeadline ?? deadlineFromNow(30);

  const message = {
    details: {
      token,
      amount: amount.toString(),
    },
    spender,
    sigDeadline: deadline.toString(),
  };

  // Attach optional fields only when provided
  if (expiration !== undefined) message.details.expiration = expiration.toString();
  if (nonce !== undefined) message.details.nonce = nonce.toString();

  const domain = permit2Domain(chainId);
  const typedData = buildTypedData(domain, PERMIT_SINGLE_TYPES, "PermitSingle", message);

  const signature = await signTypedData(provider, account, typedData);
  const { r, s, v } = splitSignature(signature);

  return { signature, r, s, v, deadline };
}

// ─── PermitBatch ──────────────────────────────────────────────────────────────

/**
 * Build and sign a Permit2 `PermitBatch` request for multiple tokens.
 *
 * Each token entry requires an explicit amount. Users see all tokens and
 * amounts before signing.
 *
 * @param {object} provider     EIP-1193 provider
 * @param {string} account      User's wallet address
 * @param {number} chainId      EVM chain ID
 * @param {object} batch        Batch permit details
 * @param {Array<{token: string, amount?: bigint, expiration?: number, nonce?: number}>} batch.permits
 * @param {string} batch.spender
 * @param {number} [batch.sigDeadline]
 * @returns {Promise<{ signature: string, r: string, s: string, v: number, deadline: number }>}
 */
export async function signPermitBatch(provider, account, chainId, batch) {
  const { permits, spender, sigDeadline } = batch;

  if (!Array.isArray(permits) || permits.length === 0) {
    throw new Error("Permit2: permits array must be non-empty");
  }
  if (!isValidAddress(spender)) throw new Error("Permit2: invalid spender address");

  // Validate every entry up-front so the user is never surprised mid-flow
  for (const p of permits) {
    if (!isValidAddress(p.token)) throw new Error(`Permit2: invalid token address ${p.token}`);
  }

  const deadline = sigDeadline ?? deadlineFromNow(30);

  const details = permits.map((p) => {
    const entry = {
      token: p.token,
      amount: (p.amount ?? PERMIT2_MAX_AMOUNT).toString(),
    };
    if (p.expiration !== undefined) entry.expiration = p.expiration.toString();
    if (p.nonce !== undefined) entry.nonce = p.nonce.toString();
    return entry;
  });

  const message = {
    details,
    spender,
    sigDeadline: deadline.toString(),
  };

  const domain = permit2Domain(chainId);
  const typedData = buildTypedData(domain, PERMIT_BATCH_TYPES, "PermitBatch", message);

  const signature = await signTypedData(provider, account, typedData);
  const { r, s, v } = splitSignature(signature);

  return { signature, r, s, v, deadline };
}

// ─── Allowance Query ABI ──────────────────────────────────────────────────────

/**
 * Minimal ABI fragment for reading Permit2 allowances on-chain.
 * Usage: const contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ALLOWANCE_ABI, provider);
 */
export const PERMIT2_ALLOWANCE_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
];
