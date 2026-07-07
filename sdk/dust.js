/**
 * IntegratedDEX WaaS SDK — Dust Ops Module
 *
 * "Dust" refers to ERC-20 token balances so small they are economically
 * worthless to trade individually.  This module provides utilities to
 * identify dust balances and batch-sweep them to a recipient address in a
 * single on-chain transaction via the BatchMulticall singleton.
 *
 * Typical workflow
 * ────────────────
 *   1. Fetch token balances for a user (off-chain or via multicallRead).
 *   2. Call filterDust() to find entries below the threshold.
 *   3. Call sweepDust() to transfer all dust in one batched tx.
 *
 * @module sdk/dust
 */

import { parseAmount } from "./utils.js";
import { batchMulticallWrite } from "./multicall.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default dust threshold expressed as a whole-unit string.
 * Any balance whose human-readable value is strictly less than this is "dust".
 *
 * The default is "0.01" which is 0.01 of the token's base unit
 * (e.g. 0.01 USDC, 0.01 ETH-equivalent).
 */
export const DUST_THRESHOLD_DEFAULT = "0.01";

/** ERC-20 transfer(address,uint256) function selector. */
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

// ─── isDust ───────────────────────────────────────────────────────────────────

/**
 * Determine whether a raw token balance is below the dust threshold.
 *
 * @param {bigint|string} rawAmount   Raw token amount (smallest unit / wei-like)
 * @param {number}        decimals    Token decimal places
 * @param {string}        [threshold] Human-readable threshold (default "0.01")
 * @returns {boolean}  `true` if the amount is dust (strictly less than threshold)
 *
 * @example
 * isDust(5000n, 6)          // 0.005 USDC → true  (below 0.01)
 * isDust(20000n, 6)         // 0.020 USDC → false
 * isDust(5000n, 6, "0.001") // 0.005 USDC → false (threshold is 0.001)
 */
export function isDust(rawAmount, decimals, threshold = DUST_THRESHOLD_DEFAULT) {
  const raw = BigInt(rawAmount);
  if (raw === 0n) return true;
  const thresholdRaw = parseAmount(threshold, decimals);
  return raw < thresholdRaw;
}

// ─── filterDust ───────────────────────────────────────────────────────────────

/**
 * Filter a list of token balance entries to only those that are dust.
 *
 * @param {Array<{ token: string, balance: bigint|string, decimals: number, [key: string]: any }>} entries
 *   Array of token balance descriptors.
 * @param {string} [threshold]  Human-readable dust threshold (default "0.01")
 * @returns {typeof entries}  Only entries whose balance is below the threshold
 *
 * @example
 * const dust = filterDust([
 *   { token: "0xA0b…", symbol: "USDC", balance: 5000n,   decimals: 6 },
 *   { token: "0xdAC…", symbol: "DAI",  balance: 1n,      decimals: 18 },
 *   { token: "0x1f9…", symbol: "LINK", balance: 5000000000000000000n, decimals: 18 },
 * ]);
 * // → USDC and DAI entries only
 */
export function filterDust(entries, threshold = DUST_THRESHOLD_DEFAULT) {
  if (!Array.isArray(entries)) throw new Error("filterDust: entries must be an array");
  return entries.filter((e) => isDust(e.balance, e.decimals, threshold));
}

// ─── buildDustSweepCalls ──────────────────────────────────────────────────────

/**
 * Build BatchMulticall call descriptors for sweeping a list of token balances.
 *
 * Each entry produces an ERC-20 `transfer(recipient, balance)` call encoded
 * as raw calldata — no ethers dependency required at call-build time.
 *
 * @param {Array<{ token: string, balance: bigint|string }>} entries
 *   Tokens to sweep.  `balance` is the raw amount to transfer.
 * @param {string} recipient  Destination address for all tokens
 * @returns {Array<{ target: string, value: bigint, data: string, allowFailure: boolean }>}
 *   Call descriptors ready for `batchMulticallWrite`.
 *
 * @example
 * const calls = buildDustSweepCalls(
 *   [{ token: "0xA0b…", balance: 5000n }],
 *   "0xRecipient…"
 * );
 */
export function buildDustSweepCalls(entries, recipient) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("buildDustSweepCalls: entries must be a non-empty array");
  }
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    throw new Error("buildDustSweepCalls: invalid recipient address");
  }

  return entries.map((e) => {
    const amount = BigInt(e.balance);
    if (amount === 0n) throw new Error(`buildDustSweepCalls: balance is 0 for token ${e.token}`);

    const data = encodeTransfer(recipient, amount);
    return {
      target: e.token,
      value: 0n,
      data,
      allowFailure: true,
    };
  });
}

// ─── sweepDust ────────────────────────────────────────────────────────────────

/**
 * Sweep all dust token balances to `recipient` in a single batched transaction.
 *
 * Uses the production BatchMulticall singleton
 * (`0xF93E987DF029e95CdE59c0F5cD447e0a7002054D`) to bundle every ERC-20
 * `transfer` into one user-facing transaction.
 *
 * @param {object} signer      ethers.js Signer (v6) connected to the user's wallet
 * @param {Array<{ token: string, balance: bigint|string, decimals: number }>} entries
 *   Token balances to sweep — typically the result of `filterDust()`.
 *   Zero-balance entries are skipped automatically.
 * @param {string} recipient   Destination address
 * @param {object} [overrides] Optional ethers transaction overrides (gasLimit, …)
 * @returns {Promise<object>}  Transaction response from BatchMulticall
 *
 * @example
 * const dustTokens = filterDust(balances);
 * const tx = await sweepDust(signer, dustTokens, "0xTreasury…");
 * await tx.wait();
 */
export async function sweepDust(signer, entries, recipient, overrides = {}) {
  if (!signer) throw new Error("sweepDust: signer is required");
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("sweepDust: entries must be a non-empty array");
  }

  // Skip zero-balance entries so callers don't need to pre-filter
  const nonZero = entries.filter((e) => BigInt(e.balance) > 0n);
  if (nonZero.length === 0) throw new Error("sweepDust: all entries have a zero balance");

  const calls = buildDustSweepCalls(nonZero, recipient);
  return batchMulticallWrite(signer, calls, overrides);
}

// ─── dustReport ───────────────────────────────────────────────────────────────

/**
 * Produce a summary report of dust balances from a token list.
 *
 * @param {Array<{ token: string, balance: bigint|string, decimals: number, symbol?: string }>} entries
 * @param {string} [threshold]  Human-readable dust threshold (default "0.01")
 * @returns {{
 *   dust: typeof entries,
 *   nonDust: typeof entries,
 *   dustCount: number,
 *   totalCount: number,
 * }}
 *
 * @example
 * const { dust, dustCount } = dustReport(balances);
 * console.log(`${dustCount} dust token(s) found`);
 */
export function dustReport(entries, threshold = DUST_THRESHOLD_DEFAULT) {
  if (!Array.isArray(entries)) throw new Error("dustReport: entries must be an array");
  const dust = filterDust(entries, threshold);
  const nonDust = entries.filter((e) => !isDust(e.balance, e.decimals, threshold));
  return {
    dust,
    nonDust,
    dustCount: dust.length,
    totalCount: entries.length,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * ABI-encode an ERC-20 transfer(address,uint256) call without an ethers
 * dependency so the module stays lightweight.
 *
 * Encoding layout (68 bytes total):
 *   [0..3]   4-byte function selector (0xa9059cbb)
 *   [4..35]  32-byte left-padded address
 *   [36..67] 32-byte left-padded uint256
 *
 * @param {string} to      Recipient address (0x-prefixed, 20 bytes)
 * @param {bigint} amount  Token amount
 * @returns {string}  0x-prefixed hex calldata
 */
function encodeTransfer(to, amount) {
  const addrPadded = to.slice(2).toLowerCase().padStart(64, "0");
  const amountHex = amount.toString(16).padStart(64, "0");
  return `${ERC20_TRANSFER_SELECTOR}${addrPadded}${amountHex}`;
}
