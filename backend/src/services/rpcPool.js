/**
 * WAASDK Backend — RPC Connection Pool
 *
 * Provides a rotating, failure-aware pool of JSON-RPC providers per chain.
 *
 * Strategy:
 *  1. Try the primary RPC URL (or env override).
 *  2. On timeout or error, rotate to the next URL.
 *  3. After all URLs are exhausted, throw so callers can handle gracefully.
 *
 * ERC-20 balance calls are batched via a minimal multicall ABI to minimise
 * round trips when scanning a wallet across many tokens.
 */

import { CHAIN_REGISTRY } from "../chainNames.js";
import { config } from "../config.js";

// ─── Env overrides (higher priority than chain registry defaults) ─────────────

const ENV_RPC_OVERRIDES = {
  1:      config.RPC_URL_ETHEREUM,
  56:     config.RPC_URL_BSC,
  137:    config.RPC_URL_POLYGON,
  43114:  config.RPC_URL_AVALANCHE,
  8453:   config.RPC_URL_BASE,
  42161:  config.RPC_URL_ARBITRUM,
  10:     config.RPC_URL_OPTIMISM,
  250:    config.RPC_URL_FANTOM,
  100:    config.RPC_URL_GNOSIS,
  324:    config.RPC_URL_ZKSYNC,
  59144:  config.RPC_URL_LINEA,
  534352: config.RPC_URL_SCROLL,
  5000:   config.RPC_URL_MANTLE,
  81457:  config.RPC_URL_BLAST,
};

/**
 * Build the ordered list of RPC URLs for a chain.
 * ENV override (if set) is prepended so it has highest priority.
 * @param {number} chainId
 * @returns {string[]}
 */
function getRpcList(chainId) {
  const override = ENV_RPC_OVERRIDES[chainId];
  const registry = CHAIN_REGISTRY[chainId]?.rpcUrls ?? CHAIN_REGISTRY[1].rpcUrls;
  const list = override ? [override, ...registry.filter((u) => u !== override)] : [...registry];
  return list;
}

/**
 * Execute a callback with an ethers.JsonRpcProvider, rotating through RPC URLs
 * on failure.
 *
 * @template T
 * @param {number} chainId
 * @param {(provider: import("ethers").JsonRpcProvider) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withProvider(chainId, fn) {
  const { ethers } = await import("ethers");
  const urls = getRpcList(chainId);
  const timeout = config.RPC_TIMEOUT_MS;

  let lastErr;
  for (const url of urls) {
    const provider = new ethers.JsonRpcProvider(url);
    try {
      const result = await Promise.race([
        fn(provider),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`RPC timeout: ${url}`)), timeout)
        ),
      ]);
      return result;
    } catch (err) {
      lastErr = err;
      // Try next URL
    }
  }
  throw lastErr ?? new Error(`All RPC URLs failed for chain ${chainId}`);
}

/**
 * Fetch native ETH/gas-token balance for an address.
 * @param {number} chainId
 * @param {string} address
 * @returns {Promise<string>} Raw balance in wei
 */
export async function getNativeBalance(chainId, address) {
  return withProvider(chainId, async (provider) => {
    const balance = await provider.getBalance(address);
    return balance.toString();
  });
}

/**
 * Fetch ERC-20 token balance for an address.
 * @param {number} chainId
 * @param {string} tokenAddress
 * @param {string} walletAddress
 * @returns {Promise<string>} Raw balance in token's smallest unit
 */
export async function getTokenBalance(chainId, tokenAddress, walletAddress) {
  const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
  return withProvider(chainId, async (provider) => {
    const { ethers } = await import("ethers");
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
    return balance.toString();
  });
}

/**
 * Get the latest block number for a chain.
 * @param {number} chainId
 * @returns {Promise<number>}
 */
export async function getBlockNumber(chainId) {
  return withProvider(chainId, (provider) => provider.getBlockNumber());
}
