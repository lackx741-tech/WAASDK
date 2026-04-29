/**
 * IntegratedDEX WaaS SDK — Multicall Module
 *
 * Batches multiple read or write calls into a single RPC request using
 * either the Sequence WaaS BatchMulticall contract or the canonical
 * Multicall3 deployment.
 *
 * BatchMulticall address: 0xF93E987DF029e95CdE59c0F5cD447e0a7002054D (all chains — CREATE2 singleton)
 * Multicall3 address:     0xcA11bde05977b3631167028862bE2a173976CA11
 */

import { CONTRACTS } from "../contracts/abis/index.js";

// ─── Sequence WaaS BatchMulticall constants ───────────────────────────────────

/** Sequence WaaS BatchMulticall deployment (CREATE2 singleton — same address on all chains). */
export const BATCH_MULTICALL_ADDRESS = CONTRACTS.BatchMulticall.address;

/** ABI for the Sequence WaaS BatchMulticall contract. */
export const BATCH_MULTICALL_ABI = CONTRACTS.BatchMulticall.abi;

// ─── Legacy Multicall3 constants (kept for backward compatibility) ─────────────

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

// ─── Sequence WaaS BatchMulticall functions ───────────────────────────────────

/**
 * Execute a batch of static read calls via the Sequence WaaS BatchMulticall contract.
 *
 * Uses `batchStatic(address[] targets, bytes[] data)` which returns raw result bytes.
 *
 * @param {object} provider    ethers.js Provider (v6) or any EIP-1193 provider
 * @param {Array<{ target: string, callData: string }>} calls
 * @returns {Promise<string[]>}  Raw ABI-encoded return data for each call
 */
export async function batchStaticRead(provider, calls) {
  if (!calls || calls.length === 0) return [];

  const targets = calls.map((c) => c.target);
  const data = calls.map((c) => c.callData);

  if (provider.call) {
    const { Interface } = await import("ethers");
    const iface = new Interface(BATCH_MULTICALL_ABI);
    const encoded = iface.encodeFunctionData("batchStatic", [targets, data]);
    const raw = await provider.call({ to: BATCH_MULTICALL_ADDRESS, data: encoded });
    const [results] = iface.decodeFunctionResult("batchStatic", raw);
    return Array.from(results);
  }

  throw new Error(
    "batchStaticRead: pass an ethers v6 Provider for automatic ABI encoding."
  );
}

/**
 * Execute a batch of write calls in a single transaction via the Sequence WaaS BatchMulticall contract.
 *
 * Uses `batch((address target, uint256 value, bytes data, bool allowFailure)[])`.
 *
 * @param {object} signer      ethers.js Signer (v6) with a connected wallet
 * @param {Array<{ target: string, callData: string, value?: bigint, allowFailure?: boolean }>} calls
 * @param {object} [overrides] Optional transaction overrides (gasLimit, …)
 * @returns {Promise<object>}  Transaction response
 */
export async function batchWrite(signer, calls, overrides = {}) {
  if (!calls || calls.length === 0) {
    throw new Error("batchWrite: calls array must not be empty");
  }

  const { Contract } = await import("ethers");
  const mc = new Contract(BATCH_MULTICALL_ADDRESS, BATCH_MULTICALL_ABI, signer);

  const encodedCalls = calls.map((c) => ({
    target: c.target,
    value: c.value ?? 0n,
    data: c.callData,
    allowFailure: c.allowFailure ?? true,
  }));

  const tx = await mc.batch(encodedCalls, overrides);
  return tx;
}
