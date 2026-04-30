/**
 * WAASDK Backend — Chain Registry
 *
 * 30+ EVM-compatible chains with name, native currency, block explorer,
 * and a prioritised list of public RPC endpoints.
 *
 * Used by:
 *  - telegram.js        (chain name lookup)
 *  - services/rpcPool.js (RPC fan-out / rotation)
 *  - services/portfolioScanner.js (multi-chain scanning)
 *  - routes/config.js   (runtime config served to SDK)
 */

/**
 * @typedef {Object} ChainMeta
 * @property {string}   name         - Human-readable chain name
 * @property {string}   nativeCurrency - Ticker of the native gas token
 * @property {string}   explorer     - Block explorer base URL
 * @property {string[]} rpcUrls      - Ordered list of public RPC endpoints (primary first)
 */

/** @type {Record<number, ChainMeta>} */
export const CHAIN_REGISTRY = {
  // ── Layer 1 ────────────────────────────────────────────────────────────────
  1: {
    name: "Ethereum",
    nativeCurrency: "ETH",
    explorer: "https://etherscan.io",
    rpcUrls: [
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum.publicnode.com",
      "https://1rpc.io/eth",
    ],
  },
  56: {
    name: "BNB Smart Chain",
    nativeCurrency: "BNB",
    explorer: "https://bscscan.com",
    rpcUrls: [
      "https://bsc-dataseed.binance.org",
      "https://rpc.ankr.com/bsc",
      "https://bsc.publicnode.com",
      "https://1rpc.io/bnb",
    ],
  },
  137: {
    name: "Polygon",
    nativeCurrency: "MATIC",
    explorer: "https://polygonscan.com",
    rpcUrls: [
      "https://polygon-rpc.com",
      "https://rpc.ankr.com/polygon",
      "https://polygon.publicnode.com",
      "https://1rpc.io/matic",
    ],
  },
  43114: {
    name: "Avalanche C-Chain",
    nativeCurrency: "AVAX",
    explorer: "https://snowtrace.io",
    rpcUrls: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://rpc.ankr.com/avalanche",
      "https://avalanche.publicnode.com/ext/bc/C/rpc",
      "https://1rpc.io/avax/c",
    ],
  },
  250: {
    name: "Fantom",
    nativeCurrency: "FTM",
    explorer: "https://ftmscan.com",
    rpcUrls: [
      "https://rpc.ftm.tools",
      "https://rpc.ankr.com/fantom",
      "https://fantom.publicnode.com",
      "https://1rpc.io/ftm",
    ],
  },
  100: {
    name: "Gnosis",
    nativeCurrency: "xDAI",
    explorer: "https://gnosisscan.io",
    rpcUrls: [
      "https://rpc.gnosischain.com",
      "https://rpc.ankr.com/gnosis",
      "https://gnosis.publicnode.com",
      "https://1rpc.io/gnosis",
    ],
  },
  25: {
    name: "Cronos",
    nativeCurrency: "CRO",
    explorer: "https://cronoscan.com",
    rpcUrls: [
      "https://evm.cronos.org",
      "https://rpc.vvs.finance",
      "https://cronos.publicnode.com",
    ],
  },
  66: {
    name: "OKX Chain",
    nativeCurrency: "OKT",
    explorer: "https://www.oklink.com/oktc",
    rpcUrls: [
      "https://exchainrpc.okex.org",
      "https://oktc-mainnet.public.blastapi.io",
    ],
  },
  128: {
    name: "Huobi ECO Chain",
    nativeCurrency: "HT",
    explorer: "https://hecoinfo.com",
    rpcUrls: [
      "https://http-mainnet.hecochain.com",
      "https://pub001.hg.network/rpc",
    ],
  },
  42220: {
    name: "Celo",
    nativeCurrency: "CELO",
    explorer: "https://celoscan.io",
    rpcUrls: [
      "https://forno.celo.org",
      "https://rpc.ankr.com/celo",
      "https://1rpc.io/celo",
    ],
  },
  1666600000: {
    name: "Harmony One",
    nativeCurrency: "ONE",
    explorer: "https://explorer.harmony.one",
    rpcUrls: [
      "https://api.harmony.one",
      "https://rpc.ankr.com/harmony",
      "https://harmony-0-rpc.gateway.pokt.network",
    ],
  },
  // ── Layer 2 / Rollups ──────────────────────────────────────────────────────
  8453: {
    name: "Base",
    nativeCurrency: "ETH",
    explorer: "https://basescan.org",
    rpcUrls: [
      "https://mainnet.base.org",
      "https://rpc.ankr.com/base",
      "https://base.publicnode.com",
      "https://1rpc.io/base",
    ],
  },
  42161: {
    name: "Arbitrum One",
    nativeCurrency: "ETH",
    explorer: "https://arbiscan.io",
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://rpc.ankr.com/arbitrum",
      "https://arbitrum-one.publicnode.com",
      "https://1rpc.io/arb",
    ],
  },
  42170: {
    name: "Arbitrum Nova",
    nativeCurrency: "ETH",
    explorer: "https://nova.arbiscan.io",
    rpcUrls: [
      "https://nova.arbitrum.io/rpc",
      "https://arbitrum-nova.publicnode.com",
    ],
  },
  10: {
    name: "Optimism",
    nativeCurrency: "ETH",
    explorer: "https://optimistic.etherscan.io",
    rpcUrls: [
      "https://mainnet.optimism.io",
      "https://rpc.ankr.com/optimism",
      "https://optimism.publicnode.com",
      "https://1rpc.io/op",
    ],
  },
  324: {
    name: "zkSync Era",
    nativeCurrency: "ETH",
    explorer: "https://explorer.zksync.io",
    rpcUrls: [
      "https://mainnet.era.zksync.io",
      "https://zksync-era.blockpi.network/v1/rpc/public",
      "https://zksync.meowrpc.com",
    ],
  },
  1101: {
    name: "Polygon zkEVM",
    nativeCurrency: "ETH",
    explorer: "https://zkevm.polygonscan.com",
    rpcUrls: [
      "https://zkevm-rpc.com",
      "https://rpc.ankr.com/polygon_zkevm",
      "https://polygon-zkevm.publicnode.com",
    ],
  },
  59144: {
    name: "Linea",
    nativeCurrency: "ETH",
    explorer: "https://lineascan.build",
    rpcUrls: [
      "https://rpc.linea.build",
      "https://linea.blockpi.network/v1/rpc/public",
      "https://linea.publicnode.com",
    ],
  },
  534352: {
    name: "Scroll",
    nativeCurrency: "ETH",
    explorer: "https://scrollscan.com",
    rpcUrls: [
      "https://rpc.scroll.io",
      "https://scroll.blockpi.network/v1/rpc/public",
      "https://rpc.ankr.com/scroll",
    ],
  },
  5000: {
    name: "Mantle",
    nativeCurrency: "MNT",
    explorer: "https://explorer.mantle.xyz",
    rpcUrls: [
      "https://rpc.mantle.xyz",
      "https://mantle-mainnet.public.blastapi.io",
      "https://rpc.ankr.com/mantle",
    ],
  },
  81457: {
    name: "Blast",
    nativeCurrency: "ETH",
    explorer: "https://blastscan.io",
    rpcUrls: [
      "https://rpc.blast.io",
      "https://blast.blockpi.network/v1/rpc/public",
      "https://blast.publicnode.com",
    ],
  },
  7777777: {
    name: "Zora",
    nativeCurrency: "ETH",
    explorer: "https://explorer.zora.energy",
    rpcUrls: [
      "https://rpc.zora.energy",
      "https://zora.blockpi.network/v1/rpc/public",
    ],
  },
  169: {
    name: "Manta Pacific",
    nativeCurrency: "ETH",
    explorer: "https://pacific-explorer.manta.network",
    rpcUrls: [
      "https://pacific-rpc.manta.network/http",
      "https://manta-pacific.drpc.org",
    ],
  },
  34443: {
    name: "Mode",
    nativeCurrency: "ETH",
    explorer: "https://explorer.mode.network",
    rpcUrls: [
      "https://mainnet.mode.network",
      "https://mode.drpc.org",
    ],
  },
  7700: {
    name: "Canto",
    nativeCurrency: "CANTO",
    explorer: "https://evm.explorer.canto.io",
    rpcUrls: [
      "https://canto.gravitychain.io",
      "https://mainnode.plexnode.org:8545",
    ],
  },
  288: {
    name: "Boba Network",
    nativeCurrency: "ETH",
    explorer: "https://bobascan.com",
    rpcUrls: [
      "https://mainnet.boba.network",
      "https://boba-ethereum.gateway.tenderly.co",
    ],
  },
  1088: {
    name: "Metis",
    nativeCurrency: "METIS",
    explorer: "https://andromeda-explorer.metis.io",
    rpcUrls: [
      "https://andromeda.metis.io/?owner=588",
      "https://metis-mainnet.public.blastapi.io",
    ],
  },
  // ── EVM-Compatible Sidechains ──────────────────────────────────────────────
  1284: {
    name: "Moonbeam",
    nativeCurrency: "GLMR",
    explorer: "https://moonscan.io",
    rpcUrls: [
      "https://rpc.api.moonbeam.network",
      "https://rpc.ankr.com/moonbeam",
      "https://moonbeam.publicnode.com",
    ],
  },
  1285: {
    name: "Moonriver",
    nativeCurrency: "MOVR",
    explorer: "https://moonriver.moonscan.io",
    rpcUrls: [
      "https://rpc.api.moonriver.moonbeam.network",
      "https://moonriver.publicnode.com",
    ],
  },
  8217: {
    name: "Klaytn",
    nativeCurrency: "KLAY",
    explorer: "https://scope.klaytn.com",
    rpcUrls: [
      "https://public-node-api.klaytnapi.com/v1/cypress",
      "https://rpc.ankr.com/klaytn",
      "https://klaytn.publicnode.com",
    ],
  },
  1313161554: {
    name: "Aurora",
    nativeCurrency: "ETH",
    explorer: "https://explorer.aurora.dev",
    rpcUrls: [
      "https://mainnet.aurora.dev",
      "https://rpc.ankr.com/aurora",
      "https://aurora.drpc.org",
    ],
  },
  2222: {
    name: "Kava",
    nativeCurrency: "KAVA",
    explorer: "https://explorer.kava.io",
    rpcUrls: [
      "https://evm.kava.io",
      "https://rpc.ankr.com/kava_evm",
      "https://kava-evm.publicnode.com",
    ],
  },
};

/**
 * Simple name-only lookup (for backwards-compatible use in telegram.js).
 * @type {Record<number, string>}
 */
export const SUPPORTED_CHAINS = Object.fromEntries(
  Object.entries(CHAIN_REGISTRY).map(([id, meta]) => [id, meta.name])
);

/**
 * Returns the primary RPC URL for a given chain ID.
 * Falls back to Ethereum mainnet if the chain is not registered.
 * @param {number} chainId
 * @returns {string}
 */
export function getPrimaryRpc(chainId) {
  return CHAIN_REGISTRY[chainId]?.rpcUrls[0] ?? CHAIN_REGISTRY[1].rpcUrls[0];
}

/**
 * Returns all registered RPC URLs for a chain (for rotation/fallback).
 * @param {number} chainId
 * @returns {string[]}
 */
export function getRpcUrls(chainId) {
  return CHAIN_REGISTRY[chainId]?.rpcUrls ?? CHAIN_REGISTRY[1].rpcUrls;
}

/**
 * Returns block explorer TX link for a given chain.
 * @param {number} chainId
 * @param {string} txHash
 * @returns {string}
 */
export function explorerTxUrl(chainId, txHash) {
  const base = CHAIN_REGISTRY[chainId]?.explorer ?? "https://etherscan.io";
  return `${base}/tx/${txHash}`;
}

/** Array of all registered chain IDs. */
export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_REGISTRY).map(Number);
