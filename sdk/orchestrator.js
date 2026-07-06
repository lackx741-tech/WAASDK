/**
 * IntegratedDEX WaaS SDK — EIP-7702 Orchestrator Module
 *
 * High-level JavaScript wrapper for interacting with the delegatecall-based
 * modular account Orchestrator.
 *
 * Architecture recap
 * ──────────────────
 *  EOA (EIP-7702 delegated to Orchestrator)
 *    └─► Orchestrator  (module registry + delegate executor + fallback router)
 *          └─► delegatecall → installed modules
 *                (BatchModule, SessionKeyModule, …)
 *
 * Usage
 * ─────
 *   import { WaaSWallet } from "./wallet.js";
 *   import { OrchestratorClient } from "./orchestrator.js";
 *
 *   const wallet  = new WaaSWallet({ projectId: "…" });
 *   await wallet.connect();
 *
 *   const signer = await wallet.getSigner();
 *   const client = new OrchestratorClient("0xOrchestrator…", signer);
 *
 *   // Install a module
 *   await client.installModule("0xBatchModule…");
 *
 *   // Execute a module function
 *   await client.execute("0xBatchModule…", encodedBatchCalldata);
 *
 *   // Manage session keys
 *   await client.addSessionKey("0xSessionKey…", expiryTimestamp);
 *
 * @module sdk/orchestrator
 */

import { ethers } from "ethers";
import OrchestratorABI from "../contracts/abis/Orchestrator.json";
import BatchModuleABI from "../contracts/abis/BatchModule.json";
import SessionKeyModuleABI from "../contracts/abis/SessionKeyModule.json";

// ─── Re-export ABIs for consumers who need them ───────────────────────────────

export { OrchestratorABI, BatchModuleABI, SessionKeyModuleABI };

// ─── ABI Interface helpers ────────────────────────────────────────────────────

/** ethers Interface for ABI-encoding BatchModule calls. */
export const batchModuleInterface = new ethers.Interface(BatchModuleABI);
/** ethers Interface for ABI-encoding SessionKeyModule calls. */
export const sessionKeyModuleInterface = new ethers.Interface(SessionKeyModuleABI);

// ─── OrchestratorClient ───────────────────────────────────────────────────────

/**
 * High-level client for the EIP-7702 Orchestrator.
 *
 * @example
 * const client = new OrchestratorClient("0xDeployedOrchestrator", signerOrProvider);
 */
export class OrchestratorClient {
  /**
   * @param {string}                        address   Orchestrator contract address.
   * @param {ethers.Signer|ethers.Provider} signer    Ethers signer (for writes) or provider (for reads).
   */
  constructor(address, signer) {
    if (!ethers.isAddress(address)) {
      throw new Error(`OrchestratorClient: invalid address "${address}"`);
    }
    if (!signer) {
      throw new Error("OrchestratorClient: signer / provider is required");
    }

    /** @type {string} */
    this.address = address;
    /** @type {ethers.Signer|ethers.Provider} */
    this.signer = signer;
    /** @type {ethers.Contract} */
    this.contract = new ethers.Contract(address, OrchestratorABI, signer);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  /**
   * Return the current owner address stored in the orchestrator's namespaced slot.
   * @returns {Promise<string>}
   */
  async owner() {
    return this.contract.owner();
  }

  /**
   * Return the current execution nonce.
   * @returns {Promise<bigint>}
   */
  async nonce() {
    return this.contract.nonce();
  }

  /**
   * Check whether a module is installed.
   * @param {string} moduleAddress
   * @returns {Promise<boolean>}
   */
  async isModuleInstalled(moduleAddress) {
    return this.contract.isModuleInstalled(moduleAddress);
  }

  /**
   * Return the module address registered for a 4-byte selector.
   * @param {string} selector  Hex string, e.g. "0x12345678"
   * @returns {Promise<string>}  address(0) if not registered
   */
  async moduleForSelector(selector) {
    return this.contract.moduleForSelector(selector);
  }

  /**
   * Check whether a session key is currently valid (exists and not expired).
   * @param {string} keyAddress
   * @returns {Promise<boolean>}
   */
  async isSessionKeyValid(keyAddress) {
    return this.contract.isSessionKeyValid(keyAddress);
  }

  // ─── Module Management ─────────────────────────────────────────────────────

  /**
   * Install a module.  Caller must be the owner.
   * @param {string} moduleAddress  Deployed module contract address.
   * @param {object} [overrides={}] ethers tx overrides (gasLimit, etc.)
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async installModule(moduleAddress, overrides = {}) {
    const tx = await this.contract.installModule(moduleAddress, overrides);
    return tx.wait();
  }

  /**
   * Uninstall a module.
   * @param {string} moduleAddress
   * @param {object} [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async uninstallModule(moduleAddress, overrides = {}) {
    const tx = await this.contract.uninstallModule(moduleAddress, overrides);
    return tx.wait();
  }

  /**
   * Register a function selector to route to a module via the fallback.
   * The module must already be installed.
   *
   * @param {string} selector  4-byte hex selector string (e.g. "0x47e7ef24")
   * @param {string} moduleAddress
   * @param {object} [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async registerSelector(selector, moduleAddress, overrides = {}) {
    const tx = await this.contract.registerSelector(selector, moduleAddress, overrides);
    return tx.wait();
  }

  /**
   * Deregister a fallback selector mapping.
   * @param {string} selector
   * @param {object} [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async deregisterSelector(selector, overrides = {}) {
    const tx = await this.contract.deregisterSelector(selector, overrides);
    return tx.wait();
  }

  // ─── Session Keys ──────────────────────────────────────────────────────────

  /**
   * Grant a session key.
   * @param {string} keyAddress   Address to grant execution rights.
   * @param {number|bigint} expiry  Unix timestamp (seconds).  Pass 0 for no expiry.
   * @param {object} [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async addSessionKey(keyAddress, expiry = 0, overrides = {}) {
    const tx = await this.contract.addSessionKey(keyAddress, expiry, overrides);
    return tx.wait();
  }

  /**
   * Revoke a session key immediately.
   * @param {string} keyAddress
   * @param {object} [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async revokeSessionKey(keyAddress, overrides = {}) {
    const tx = await this.contract.revokeSessionKey(keyAddress, overrides);
    return tx.wait();
  }

  // ─── Delegate Execution ────────────────────────────────────────────────────

  /**
   * Execute a module function via delegatecall.
   *
   * @param {string} moduleAddress  Installed module address.
   * @param {string} data           ABI-encoded calldata (use ethers.Interface to encode).
   * @param {object} [overrides={}] ethers tx overrides; include `value` to forward ETH.
   * @returns {Promise<ethers.TransactionReceipt>}
   *
   * @example
   * const data = batchModuleInterface.encodeFunctionData("batchExecute", [
   *   ["0xTarget1", "0xTarget2"],
   *   [0n, ethers.parseEther("0.1")],
   *   ["0x", "0xabcd"],
   * ]);
   * await client.execute(batchModuleAddress, data, { value: ethers.parseEther("0.1") });
   */
  async execute(moduleAddress, data, overrides = {}) {
    const tx = await this.contract.execute(moduleAddress, data, overrides);
    return tx.wait();
  }

  // ─── Convenience: BatchModule ──────────────────────────────────────────────

  /**
   * Encode + execute a batch of calls through the BatchModule.
   *
   * @param {string}   batchModuleAddress  Installed BatchModule address.
   * @param {string[]} targets             Call targets.
   * @param {bigint[]} values              ETH amounts (in wei).
   * @param {string[]} payloads            ABI-encoded calldata per target.
   * @param {object}   [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async batchExecute(batchModuleAddress, targets, values, payloads, overrides = {}) {
    const data = batchModuleInterface.encodeFunctionData("batchExecute", [
      targets,
      values,
      payloads,
    ]);
    const totalValue = values.reduce((acc, v) => acc + BigInt(v), 0n);
    return this.execute(batchModuleAddress, data, { value: totalValue, ...overrides });
  }

  // ─── Convenience: SessionKeyModule ────────────────────────────────────────

  /**
   * Grant a session key via the SessionKeyModule (delegatecall path).
   *
   * Use this when the SessionKeyModule is installed as the authority for
   * session key management (rather than the built-in Orchestrator methods).
   *
   * @param {string}       sessionKeyModuleAddress  Installed SessionKeyModule address.
   * @param {string}       keyAddress               Key to grant.
   * @param {number|bigint} expiry                  Unix timestamp (0 = no expiry).
   * @param {object}       [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async addSessionKeyViaModule(sessionKeyModuleAddress, keyAddress, expiry = 0, overrides = {}) {
    const data = sessionKeyModuleInterface.encodeFunctionData("addSessionKey", [
      keyAddress,
      expiry,
    ]);
    return this.execute(sessionKeyModuleAddress, data, overrides);
  }

  /**
   * Revoke a session key via the SessionKeyModule (delegatecall path).
   *
   * @param {string} sessionKeyModuleAddress
   * @param {string} keyAddress
   * @param {object} [overrides={}]
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async revokeSessionKeyViaModule(sessionKeyModuleAddress, keyAddress, overrides = {}) {
    const data = sessionKeyModuleInterface.encodeFunctionData("revokeSessionKey", [keyAddress]);
    return this.execute(sessionKeyModuleAddress, data, overrides);
  }
}

// ─── Selector helpers ─────────────────────────────────────────────────────────

/**
 * Compute the 4-byte function selector from a full signature string.
 *
 * @param {string} sig  e.g. "batchExecute(address[],uint256[],bytes[])"
 * @returns {string}    e.g. "0x47e7ef24"
 *
 * @example
 * const sel = computeSelector("batchExecute(address[],uint256[],bytes[])");
 */
export function computeSelector(sig) {
  return ethers.id(sig).slice(0, 10);
}

/**
 * Pre-computed selectors for the built-in modules.
 * Use these with `OrchestratorClient.registerSelector()`.
 */
export const MODULE_SELECTORS = {
  batchExecute: computeSelector("batchExecute(address[],uint256[],bytes[])"),
  batchExecuteOptional: computeSelector(
    "batchExecuteOptional(address[],uint256[],bytes[],bool[])"
  ),
  addSessionKey: computeSelector("addSessionKey(address,uint256)"),
  revokeSessionKey: computeSelector("revokeSessionKey(address)"),
  isSessionKeyValid: computeSelector("isSessionKeyValid(address)"),
  sessionKeyExpiry: computeSelector("sessionKeyExpiry(address)"),
};
