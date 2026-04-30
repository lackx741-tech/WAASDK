/**
 * IntegratedDEX WaaS SDK — Smart Contract Integration Layer
 *
 * Provides helpers for loading and interacting with any EVM smart contract
 * using ethers.js v6.  Every write call shows a clear preview before
 * the transaction is submitted, and emits events so the host application
 * can react to success or failure.
 *
 * @module sdk/contract
 */

import { ethers } from "ethers";

// ─── Internal event bus ───────────────────────────────────────────────────────

/**
 * Tiny EventEmitter shim so the module works in plain-browser environments
 * without requiring a Node.js dependency.
 */
class ContractEventBus extends EventTarget {
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
  on(name, handler) {
    this.addEventListener(name, (e) => handler(e.detail));
  }
  off(name, handler) {
    this.removeEventListener(name, handler);
  }
}

/** Shared event bus.  Listen with `contractEvents.on(…)`. */
export const contractEvents = new ContractEventBus();

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Load a contract instance from an address + ABI.
 *
 * @param {string} address        Deployed contract address (checksummed or not)
 * @param {Array|string} abi      Contract ABI — JSON array or JSON string
 * @param {ethers.Provider|ethers.Signer} provider  ethers provider or signer
 * @returns {ethers.Contract}
 *
 * @example
 * const contract = loadContract("0xYourContract", abi, provider);
 */
export function loadContract(address, abi, provider) {
  if (!ethers.isAddress(address)) {
    throw new Error(`loadContract: "${address}" is not a valid EVM address`);
  }

  const parsedAbi = typeof abi === "string" ? JSON.parse(abi) : abi;

  if (!Array.isArray(parsedAbi) || parsedAbi.length === 0) {
    throw new Error("loadContract: ABI must be a non-empty array");
  }

  if (!provider) {
    throw new Error("loadContract: provider / signer is required");
  }

  return new ethers.Contract(address, parsedAbi, provider);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Call a read-only (view/pure) function on a contract.
 *
 * @param {ethers.Contract} contract        Contract instance from `loadContract`
 * @param {string}          functionName    Name of the function to call
 * @param {Array}           [args=[]]       Positional arguments
 * @returns {Promise<any>}                  Decoded return value(s)
 *
 * @example
 * const balance = await readContract(contract, "balanceOf", ["0xAddress"]);
 */
export async function readContract(contract, functionName, args = []) {
  if (!contract[functionName]) {
    throw new Error(`readContract: function "${functionName}" not found in contract ABI`);
  }

  try {
    const result = await contract[functionName](...args);
    contractEvents.emit("contractCallSuccess", {
      type: "read",
      functionName,
      args,
      result,
      address: await contract.getAddress(),
    });
    return result;
  } catch (err) {
    contractEvents.emit("contractCallError", {
      type: "read",
      functionName,
      args,
      error: err,
      address: await contract.getAddress(),
    });
    throw err;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Call a state-changing function on a contract (requires a signer).
 *
 * A human-readable preview of the call is logged to the console *before*
 * the transaction is submitted so the user / integrator can see exactly
 * what will be signed.
 *
 * @param {ethers.Contract} contract        Contract instance connected to a signer
 * @param {string}          functionName    Name of the function to call
 * @param {Array}           [args=[]]       Positional arguments
 * @param {object}          [overrides={}]  Optional ethers overrides (value, gasLimit, …)
 * @returns {Promise<ethers.TransactionReceipt>}
 *
 * @example
 * const receipt = await writeContract(contract, "mint", [toAddress, amount]);
 */
export async function writeContract(contract, functionName, args = [], overrides = {}) {
  if (!contract[functionName]) {
    throw new Error(`writeContract: function "${functionName}" not found in contract ABI`);
  }

  const address = await contract.getAddress();

  // ── Transaction preview ───────────────────────────────────────────────────
  const preview = {
    contract: address,
    function: functionName,
    args,
    overrides,
  };

  /* eslint-disable no-console */
  console.group("📋 WaaS SDK — Transaction Preview");
  console.log("Contract :", address);
  console.log("Function :", functionName);
  console.log("Arguments:", args);
  if (Object.keys(overrides).length > 0) {
    console.log("Overrides:", overrides);
  }
  console.groupEnd();
  /* eslint-enable no-console */

  try {
    const tx = await contract[functionName](...args, overrides);
    const receipt = await tx.wait();

    contractEvents.emit("contractCallSuccess", {
      type: "write",
      functionName,
      args,
      overrides,
      address,
      txHash: receipt.hash,
      receipt,
      preview,
    });

    return receipt;
  } catch (err) {
    contractEvents.emit("contractCallError", {
      type: "write",
      functionName,
      args,
      overrides,
      error: err,
      address,
      preview,
    });
    throw err;
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * Fetch past events emitted by a contract.
 *
 * @param {ethers.Contract} contract    Contract instance
 * @param {string}          eventName   Name of the event (e.g. `"Transfer"`)
 * @param {number}          [fromBlock=0]  Starting block (default: genesis)
 * @returns {Promise<ethers.EventLog[]>}
 *
 * @example
 * const transfers = await getContractEvents(contract, "Transfer", 18_000_000);
 */
export async function getContractEvents(contract, eventName, fromBlock = 0) {
  const filter = contract.filters[eventName];

  if (!filter) {
    throw new Error(`getContractEvents: event "${eventName}" not found in contract ABI`);
  }

  return contract.queryFilter(filter(), fromBlock);
}
