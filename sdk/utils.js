/**
 * IntegratedDEX WaaS SDK — Utility Helpers
 * Chain info, address validation, formatting, and misc helpers.
 */

// ─── Supported Chains ────────────────────────────────────────────────────────

export const SUPPORTED_CHAINS = {
  1: {
    id: 1,
    name: "Ethereum",
    network: "homestead",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://eth.llamarpc.com"] },
      public: { http: ["https://eth.llamarpc.com"] },
    },
    blockExplorers: {
      default: { name: "Etherscan", url: "https://etherscan.io" },
    },
  },
  56: {
    id: 56,
    name: "BNB Smart Chain",
    network: "bsc",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://bsc-dataseed.binance.org"] },
      public: { http: ["https://bsc-dataseed.binance.org"] },
    },
    blockExplorers: {
      default: { name: "BscScan", url: "https://bscscan.com" },
    },
  },
  137: {
    id: 137,
    name: "Polygon",
    network: "matic",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://polygon-rpc.com"] },
      public: { http: ["https://polygon-rpc.com"] },
    },
    blockExplorers: {
      default: { name: "PolygonScan", url: "https://polygonscan.com" },
    },
  },
  43114: {
    id: 43114,
    name: "Avalanche",
    network: "avalanche",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://api.avax.network/ext/bc/C/rpc"] },
      public: { http: ["https://api.avax.network/ext/bc/C/rpc"] },
    },
    blockExplorers: {
      default: { name: "SnowTrace", url: "https://snowtrace.io" },
    },
  },
};

// ─── Address Utilities ────────────────────────────────────────────────────────

/**
 * Validate an Ethereum address (checksummed or lowercase).
 * @param {string} address
 * @returns {boolean}
 */
export function isValidAddress(address) {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Shorten an address for display: 0x1234…abcd
 * @param {string} address
 * @param {number} [prefixLen=6]
 * @param {number} [suffixLen=4]
 * @returns {string}
 */
export function shortenAddress(address, prefixLen = 6, suffixLen = 4) {
  if (!isValidAddress(address)) return address;
  return `${address.slice(0, prefixLen)}…${address.slice(-suffixLen)}`;
}

// ─── Amount / BigInt Utilities ────────────────────────────────────────────────

/**
 * Parse a human-readable token amount to its raw BigInt representation.
 * @param {string|number} amount  Human-readable (e.g. "1.5")
 * @param {number} decimals       Token decimals (default 18)
 * @returns {bigint}
 */
export function parseAmount(amount, decimals = 18) {
  const [whole, fraction = ""] = String(amount).split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction);
}

/**
 * Format a raw BigInt token amount to a human-readable string.
 * @param {bigint|string} raw      Raw amount
 * @param {number} decimals        Token decimals (default 18)
 * @param {number} [displayDecimals=4]
 * @returns {string}
 */
export function formatAmount(raw, decimals = 18, displayDecimals = 4) {
  const n = BigInt(raw);
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const fraction = n % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, displayDecimals);
  return `${whole}.${fractionStr}`;
}

// ─── Chain Helpers ────────────────────────────────────────────────────────────

/**
 * Get chain metadata by chain ID.
 * @param {number} chainId
 * @returns {object|null}
 */
export function getChainInfo(chainId) {
  return SUPPORTED_CHAINS[chainId] ?? null;
}

/**
 * Returns the native currency symbol for a given chain ID.
 * @param {number} chainId
 * @returns {string}
 */
export function getNativeCurrencySymbol(chainId) {
  return SUPPORTED_CHAINS[chainId]?.nativeCurrency?.symbol ?? "ETH";
}

/**
 * Returns the block explorer base URL for a given chain ID.
 * @param {number} chainId
 * @returns {string}
 */
export function getExplorerUrl(chainId) {
  return SUPPORTED_CHAINS[chainId]?.blockExplorers?.default?.url ?? "https://etherscan.io";
}

/**
 * Build a transaction URL on the relevant block explorer.
 * @param {string} txHash
 * @param {number} chainId
 * @returns {string}
 */
export function getTxUrl(txHash, chainId) {
  return `${getExplorerUrl(chainId)}/tx/${txHash}`;
}

// ─── Deadline Helpers ─────────────────────────────────────────────────────────

/**
 * Compute a Unix timestamp deadline some minutes in the future.
 * @param {number} minutesFromNow
 * @returns {number}  Unix timestamp (seconds)
 */
export function deadlineFromNow(minutesFromNow = 30) {
  return Math.floor(Date.now() / 1000) + minutesFromNow * 60;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
