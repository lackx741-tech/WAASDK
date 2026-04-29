/**
 * IntegratedDEX WaaS SDK — Permit2 Module
 *
 * Integrates with Uniswap's Permit2 contract for gasless, user-controlled
 * ERC-20 approvals via EIP-712 signatures.
 *
 * Permit2 contract:         0x000000000022D473030F116dDEE9F6B43aC78BA3
 * Permit2Executor contract: 0x4593D97d6E932648fb4425aC2945adaF66927773
 * ERC2612Executor contract: 0xb8eF065061bbBF5dCc65083be8CC7B50121AE900
 *
 * Key principles:
 *  - Users ALWAYS specify the exact amount to approve.
 *  - Max approval is NEVER used unless the user explicitly passes
 *    PERMIT2_MAX_AMOUNT.
 *  - Every approval presents a clear human-readable preview before signing.
 */

import { buildDomain, buildTypedData, signTypedData, splitSignature } from "./eip712.js";
import { deadlineFromNow, isValidAddress } from "./utils.js";
import { CONTRACTS, ABIS } from "./constants.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Official Uniswap Permit2 deployment (same address on all EVM chains). */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * Explicit sentinel for "user consciously wants maximum approval".
 * Never used internally — only passed in by the caller.
 */
export const PERMIT2_MAX_AMOUNT = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"); // uint160 max

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
 * @param {bigint} permit.amount        Exact amount to approve (NOT max by default)
 * @param {number} [permit.expiration]  Unix timestamp expiry for the allowance
 * @param {number} [permit.nonce]       Permit2 nonce (fetched on-chain if omitted)
 * @param {string} permit.spender       Address being granted the allowance
 * @param {number} [permit.sigDeadline] Unix timestamp deadline for signature validity
 * @returns {Promise<{ signature: string, r: string, s: string, v: number, deadline: number }>}
 */
export async function signPermitSingle(provider, account, chainId, permit) {
  const { token, amount, expiration, nonce = 0, spender, sigDeadline } = permit;

  if (!isValidAddress(token)) throw new Error("Permit2: invalid token address");
  if (!isValidAddress(spender)) throw new Error("Permit2: invalid spender address");
  if (amount === undefined || amount === null) {
    throw new Error("Permit2: amount is required — users must specify an exact approval amount");
  }

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
 * @param {Array<{token: string, amount: bigint, expiration?: number, nonce?: number}>} batch.permits
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
    if (p.amount === undefined || p.amount === null) {
      throw new Error(`Permit2: amount required for token ${p.token}`);
    }
  }

  const deadline = sigDeadline ?? deadlineFromNow(30);

  const details = permits.map((p) => {
    const entry = {
      token: p.token,
      amount: p.amount.toString(),
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

// ─── Permit2Executor ──────────────────────────────────────────────────────────

/**
 * Execute a Permit2 single-token permit via the Permit2Executor contract.
 *
 * The permit signature must have been produced by signPermitSingle() or an
 * equivalent off-chain signer beforehand.
 *
 * @param {object} signer    ethers v6 Signer
 * @param {object} opts
 * @param {string} opts.token      ERC-20 token address
 * @param {bigint} opts.amount     Exact token amount (uint160)
 * @param {string} opts.spender    Address receiving the allowance
 * @param {number} opts.deadline   Signature deadline (Unix timestamp)
 * @param {string} opts.signature  0x-prefixed permit signature
 * @returns {Promise<object>}  Transaction response
 */
export async function executePermit2(signer, { token, amount, spender, deadline, signature }) {
  if (!isValidAddress(token))   throw new Error("executePermit2: invalid token address");
  if (!isValidAddress(spender)) throw new Error("executePermit2: invalid spender address");

  const { Contract } = await import("ethers");
  const executor = new Contract(CONTRACTS.Permit2Executor, ABIS.Permit2Executor, signer);

  return await executor.executePermit2(token, BigInt(amount), spender, deadline, signature);
}

/**
 * Execute a Permit2 batch permit via the Permit2Executor contract.
 *
 * @param {object} signer    ethers v6 Signer
 * @param {object} opts
 * @param {Array<{ token: string, amount: bigint }>} opts.details  Token permits
 * @param {string} opts.spender     Address receiving the allowances
 * @param {number} opts.sigDeadline Signature deadline (Unix timestamp)
 * @param {string} opts.signature   0x-prefixed batch permit signature
 * @returns {Promise<object>}  Transaction response
 */
export async function executePermit2Batch(signer, { details, spender, sigDeadline, signature }) {
  if (!isValidAddress(spender)) throw new Error("executePermit2Batch: invalid spender address");

  const { Contract } = await import("ethers");
  const executor = new Contract(CONTRACTS.Permit2Executor, ABIS.Permit2Executor, signer);

  const batch = {
    details:    details.map((d) => ({ token: d.token, amount: BigInt(d.amount) })),
    spender,
    sigDeadline,
  };

  return await executor.executePermitBatch(batch, signature);
}

// ─── ERC2612Executor ──────────────────────────────────────────────────────────

/**
 * Execute an ERC-2612 permit via the ERC2612Executor contract.
 *
 * The (v, r, s) values must come from an off-chain EIP-712 signature over
 * the token's permit typehash.
 *
 * @param {object} signer   ethers v6 Signer
 * @param {object} opts
 * @param {string} opts.token    ERC-20 token address (must support ERC-2612)
 * @param {string} opts.owner    Token owner address
 * @param {string} opts.spender  Address receiving the allowance
 * @param {bigint} opts.value    Amount to approve
 * @param {number} opts.deadline Permit deadline (Unix timestamp)
 * @param {number} opts.v        Signature v component
 * @param {string} opts.r        Signature r component (bytes32)
 * @param {string} opts.s        Signature s component (bytes32)
 * @returns {Promise<object>}  Transaction response
 */
export async function executeERC2612Permit(signer, { token, owner, spender, value, deadline, v, r, s }) {
  if (!isValidAddress(token))   throw new Error("executeERC2612Permit: invalid token address");
  if (!isValidAddress(owner))   throw new Error("executeERC2612Permit: invalid owner address");
  if (!isValidAddress(spender)) throw new Error("executeERC2612Permit: invalid spender address");

  const { Contract } = await import("ethers");
  const executor = new Contract(CONTRACTS.ERC2612Executor, ABIS.ERC2612Executor, signer);

  return await executor.executePermit(token, owner, spender, BigInt(value), deadline, v, r, s);
}
