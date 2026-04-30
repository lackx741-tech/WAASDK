/**
 * WAASDK Backend — Portfolio Scanner Service
 *
 * Fetches wallet balances across multiple chains using the RPC pool.
 * This is a backend-assisted aggregation layer; clients can also call
 * their wallet provider directly for primary balance reads.
 *
 * Security: reads only public on-chain data. No private keys.
 */

import { CHAIN_REGISTRY, SUPPORTED_CHAIN_IDS } from "../chainNames.js";
import { withProvider, getNativeBalance } from "./rpcPool.js";
import { config } from "../config.js";

// Minimal ERC-20 ABI for balance + metadata reads
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
];

// Well-known token lists per chain (minimal, for demo purposes)
// In production, replace with a Uniswap/CoinGecko token list fetch.
const KNOWN_TOKENS = {
  1: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI",  decimals: 18 },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
  ],
  56: [
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18 },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
    { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "BUSD", decimals: 18 },
  ],
  137: [
    { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI",  decimals: 18 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format raw wei balance to a human-readable string.
 * @param {string} raw
 * @param {number} decimals
 * @returns {string}
 */
async function formatBalance(raw, decimals) {
  const { ethers } = await import("ethers");
  try {
    return ethers.formatUnits(raw, decimals);
  } catch {
    return "0";
  }
}

/**
 * Scan a single chain for a wallet's native + known-token balances.
 * @param {string} walletAddress
 * @param {number} chainId
 * @returns {Promise<import("../models/PortfolioSnapshot.js").ChainSnapshot>}
 */
async function scanChain(walletAddress, chainId) {
  const start = Date.now();

  const nativeBalance = await getNativeBalance(chainId, walletAddress).catch(() => "0");
  const { ethers } = await import("ethers");
  const formattedNative = await formatBalance(nativeBalance, 18);

  const knownTokens = KNOWN_TOKENS[chainId] ?? [];
  const tokenResults = await Promise.allSettled(
    knownTokens.map(async (token) => {
      const raw = await withProvider(chainId, async (provider) => {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        return (await contract.balanceOf(walletAddress)).toString();
      });
      if (raw === "0" || !raw) return null;
      return {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        rawBalance: raw,
        formattedBalance: await formatBalance(raw, token.decimals),
        priceUsd: null,   // TODO: integrate price oracle
        valueUsd: null,
      };
    })
  );

  const tokens = tokenResults
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  return {
    chainId,
    nativeBalance,
    nativeBalanceUsd: null,   // TODO: integrate price oracle
    tokens,
    nfts: [],                 // TODO: integrate NFT indexer (e.g. Moralis/Alchemy)
    totalValueUsd: 0,
    scannedAt: new Date(),
    rpcLatencyMs: Date.now() - start,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan a wallet across one or more chains.
 *
 * @param {string} walletAddress  EVM wallet address (lowercase)
 * @param {number[]} [chainIds]   Chain IDs to scan; defaults to all supported chains
 * @returns {Promise<{ chains: object[], totalValueUsd: number }>}
 */
export async function scanWalletPortfolio(walletAddress, chainIds) {
  const ids = chainIds?.length ? chainIds : SUPPORTED_CHAIN_IDS;

  // Fan-out across chains with limited concurrency
  const concurrency = config.PORTFOLIO_SCAN_CONCURRENCY;
  const results = [];

  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((chainId) => scanChain(walletAddress, chainId))
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }

  const totalValueUsd = results.reduce((sum, c) => sum + (c.totalValueUsd ?? 0), 0);

  return { chains: results, totalValueUsd };
}
