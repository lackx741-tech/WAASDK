/**
 * IntegratedDEX WaaS SDK — Multicall Module
 *
 * Provides two batching strategies:
 *  1. batchCall()     — uses the project's own BatchMulticall singleton for
 *                       write (state-changing) batch calls.
 *  2. multicallRead() — uses the canonical Multicall3 deployment for
 *                       efficient read-only (eth_call) batches.
 *
 * BatchMulticall address: 0xF93E987DF029e95CdE59c0F5cD447e0a7002054D
 * Multicall3 address:     0xcA11bde05977b3631167028862bE2a173976CA11
 */

import { CONTRACTS, ABIS } from './constants.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Canonical Multicall3 deployment — identical address on all supported chains. */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

// ─── ABI Fragments ────────────────────────────────────────────────────────────

export const MULTICALL3_ABI = [
  // aggregate3 — allows individual call failure without reverting the whole batch
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  // aggregate3Value — same as aggregate3 but forwards ETH per-call
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3Value",
    outputs: [
      {
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  // getBlockNumber — cheap on-chain block number read
  {
    inputs: [],
    name: "getBlockNumber",
    outputs: [{ name: "blockNumber", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// ─── Call Builder ─────────────────────────────────────────────────────────────

/**
 * Build a single Multicall3 call descriptor.
 *
 * @param {string}  target        Contract address to call
 * @param {string}  callData      ABI-encoded call data (0x-prefixed)
 * @param {boolean} [allowFailure=true]  Whether failure of this call
 *                                       reverts the whole batch
 * @returns {{ target: string, allowFailure: boolean, callData: string }}
 */
export function buildCall(target, callData, allowFailure = true) {
  return { target, allowFailure, callData };
}

// ─── Batch Write via BatchMulticall ──────────────────────────────────────────

/**
 * Execute a batch of calls in a single transaction via the project's
 * BatchMulticall singleton.
 *
 * Unlike Multicall3, BatchMulticall forwards ETH value per call and returns
 * per-call success/result pairs. This is the preferred path for write batches.
 *
 * @param {object} provider  ethers v6 provider (only used to construct the contract)
 * @param {object} signer    ethers v6 Signer — pays gas for the batch
 * @param {Array<{ to: string, data: string, value?: bigint }>} calls
 * @param {bigint} [totalValue=0n]  Total ETH to forward across all calls
 * @returns {Promise<Array<{ success: boolean, result: string }>>}
 */
export async function batchCall(provider, signer, calls, totalValue = 0n) {
  if (!calls || calls.length === 0) {
    throw new Error('batchCall: calls array must not be empty');
  }

  const { Contract } = await import('ethers');
  const mc = new Contract(CONTRACTS.BatchMulticall, ABIS.BatchMulticall, signer);

  const encoded = calls.map((c) => ({
    to:    c.to,
    data:  c.data  ?? '0x',
    value: c.value ?? 0n,
  }));

  const results = await mc.batchCall(encoded, { value: totalValue });
  return results.map((r) => ({ success: r.success, result: r.result }));
}

// ─── Batch Read (eth_call) ────────────────────────────────────────────────────

/**
 * Execute a batch of read calls in a single `eth_call` via Multicall3.
 *
 * Uses aggregate3 so individual call failures don't revert the entire batch.
 * Each result entry has { success: boolean, returnData: string }.
 *
 * @param {object} provider    ethers.js Provider (v6) or any EIP-1193 provider
 * @param {Array<{ target: string, callData: string, allowFailure?: boolean }>} calls
 * @returns {Promise<Array<{ success: boolean, returnData: string }>>}
 */
export async function multicallRead(provider, calls) {
  if (!calls || calls.length === 0) return [];

  const encodedCalls = calls.map((c) => ({
    target: c.target,
    allowFailure: c.allowFailure ?? true,
    callData: c.callData,
  }));

  // Build the aggregate3 calldata manually to avoid a full ethers dependency
  // in the SDK core.  Consumers can also pass an ethers Contract instance.
  if (provider.call) {
    // ethers v6 Provider
    const { Interface } = await import("ethers");
    const iface = new Interface(MULTICALL3_ABI);
    const data = iface.encodeFunctionData("aggregate3", [encodedCalls]);
    const raw = await provider.call({ to: MULTICALL3_ADDRESS, data });
    const [results] = iface.decodeFunctionResult("aggregate3", raw);
    return results.map((r) => ({ success: r.success, returnData: r.returnData }));
  }

  // Fallback: EIP-1193 provider — encode via simple ABI encoding
  throw new Error(
    "multicallRead: pass an ethers v6 Provider for automatic ABI encoding, " +
      "or pre-encode callData yourself and use multicallRaw()."
  );
}

// ─── Batch Write (eth_sendTransaction) ───────────────────────────────────────

/**
 * Execute a batch of write calls in a single transaction via Multicall3.
 *
 * The user sees one transaction in their wallet covering all batched calls.
 *
 * @param {object} signer      ethers.js Signer (v6) with a connected wallet
 * @param {Array<{ target: string, callData: string, allowFailure?: boolean }>} calls
 * @param {object} [overrides] Optional transaction overrides (value, gasLimit, …)
 * @returns {Promise<object>}  Transaction response
 */
export async function multicallWrite(signer, calls, overrides = {}) {
  if (!calls || calls.length === 0) {
    throw new Error("multicallWrite: calls array must not be empty");
  }

  const { Contract } = await import("ethers");
  const mc = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, signer);

  const encodedCalls = calls.map((c) => ({
    target: c.target,
    allowFailure: c.allowFailure ?? true,
    callData: c.callData,
  }));

  const tx = await mc.aggregate3(encodedCalls, overrides);
  return tx;
}

// ─── Result Decoder ───────────────────────────────────────────────────────────

/**
 * Decode a single Multicall3 return value given an ABI fragment.
 *
 * @param {string}   returnData  Hex-encoded return data
 * @param {string[]} outputTypes Solidity output types, e.g. ["uint256", "address"]
 * @returns {Array}  Decoded values
 */
export async function decodeResult(returnData, outputTypes) {
  const { AbiCoder } = await import("ethers");
  return AbiCoder.defaultAbiCoder().decode(outputTypes, returnData);
}
