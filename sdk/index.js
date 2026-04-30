/**
 * IntegratedDEX WaaS SDK — Main Entry Point
 *
 * Exports all SDK modules as a unified surface.
 *
 * Usage:
 *   import { WaaSWallet, signPermitSingle, multicallRead } from "@integrateddex/waas-sdk";
 *
 *   const sdk = initSDK({ projectId: "…", chains: [1, 137] });
 *   await sdk.wallet.connect();
 */

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { WaaSWallet } from "./wallet.js";

export { CONTRACTS } from "../contracts/abis/index.js";

export {
  signPermitSingle,
  signPermitBatch,
  PERMIT2_ADDRESS,
  PERMIT2_MAX_AMOUNT,
  PERMIT2_ALLOWANCE_ABI,
} from "./permit2.js";

export {
  multicallRead,
  multicallWrite,
  batchMulticallRead,
  batchMulticallWrite,
  decodeResult,
  buildCall,
  MULTICALL3_ADDRESS,
  MULTICALL3_ABI,
  BATCH_MULTICALL_ADDRESS,
  BATCH_MULTICALL_ABI,
} from "./multicall.js";

export {
  signTypedData,
  buildTypedData,
  buildDomain,
  encodeType,
  splitSignature,
} from "./eip712.js";

export {
  SUPPORTED_CHAINS,
  isValidAddress,
  shortenAddress,
  parseAmount,
  formatAmount,
  getChainInfo,
  getNativeCurrencySymbol,
  getExplorerUrl,
  getTxUrl,
  deadlineFromNow,
  sleep,
} from "./utils.js";

export {
  loadContract,
  readContract,
  writeContract,
  getContractEvents,
  contractEvents,
} from "./contract.js";

// ─── SDK Factory ──────────────────────────────────────────────────────────────

/**
 * Initialise the IntegratedDEX WaaS SDK with a single config object.
 *
 * @param {object} config
 * @param {string}   config.projectId        WalletConnect Cloud project ID
 * @param {number[]} [config.chains]          Chain IDs to support (default: [1])
 * @param {string}   [config.appName]         Human-readable app name
 * @param {string}   [config.appDescription]  Short app description
 * @param {string}   [config.appUrl]          App URL
 * @param {string}   [config.appIcon]         App icon URL
 * @returns {{ wallet: WaaSWallet, config: object }}
 *
 * @example
 * const { wallet } = initSDK({
 *   projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
 *   chains: [1, 56, 137, 43114],
 *   appName: "IntegratedDEX",
 * });
 * await wallet.connect();
 */
export function initSDK(config) {
  const resolvedConfig = {
    projectId: config.projectId,
    chains: config.chains ?? [1],
    appName: config.appName ?? "IntegratedDEX",
    appDescription: config.appDescription ?? "",
    appUrl: config.appUrl ?? "",
    appIcon: config.appIcon ?? "",
  };

  const wallet = new WaaSWallet(resolvedConfig);

  return { wallet, config: resolvedConfig };
}
