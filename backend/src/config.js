/**
 * WAASDK Backend — Environment Configuration
 *
 * Reads and validates all required environment variables.
 * Call config() from dotenv before importing this module.
 */

import "dotenv/config";

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  // ── Server ─────────────────────────────────────────────────────────────────
  PORT: parseInt(process.env.PORT ?? "3000", 10),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  API_KEY: requireEnv("API_KEY", "changeme"),

  // ── MongoDB ────────────────────────────────────────────────────────────────
  MONGODB_URI: requireEnv(
    "MONGODB_URI",
    "mongodb://localhost:27017/waassdk"
  ),
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME ?? "waassdk",

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? "",

  // ── JWT (Panel Auth) ───────────────────────────────────────────────────────
  JWT_SECRET: requireEnv("JWT_SECRET", "changeme-jwt-secret-at-least-32-chars"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "4h",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",

  // ── Telegram ───────────────────────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? "",
  TELEGRAM_ALERTS_ENABLED: process.env.TELEGRAM_ALERTS_ENABLED ?? "true",

  // ── Blockchain / RPC ───────────────────────────────────────────────────────
  // Per-chain overrides (used instead of the public fallbacks in chainNames.js)
  RPC_URL_ETHEREUM:
    process.env.RPC_URL_ETHEREUM ?? "https://eth.llamarpc.com",
  RPC_URL_BSC:
    process.env.RPC_URL_BSC ?? "https://bsc-dataseed.binance.org",
  RPC_URL_POLYGON:
    process.env.RPC_URL_POLYGON ?? "https://polygon-rpc.com",
  RPC_URL_AVALANCHE:
    process.env.RPC_URL_AVALANCHE ?? "https://api.avax.network/ext/bc/C/rpc",
  RPC_URL_BASE:
    process.env.RPC_URL_BASE ?? "https://mainnet.base.org",
  RPC_URL_ARBITRUM:
    process.env.RPC_URL_ARBITRUM ?? "https://arb1.arbitrum.io/rpc",
  RPC_URL_OPTIMISM:
    process.env.RPC_URL_OPTIMISM ?? "https://mainnet.optimism.io",
  RPC_URL_FANTOM:
    process.env.RPC_URL_FANTOM ?? "https://rpc.ftm.tools",
  RPC_URL_GNOSIS:
    process.env.RPC_URL_GNOSIS ?? "https://rpc.gnosischain.com",
  RPC_URL_ZKSYNC:
    process.env.RPC_URL_ZKSYNC ?? "https://mainnet.era.zksync.io",
  RPC_URL_LINEA:
    process.env.RPC_URL_LINEA ?? "https://rpc.linea.build",
  RPC_URL_SCROLL:
    process.env.RPC_URL_SCROLL ?? "https://rpc.scroll.io",
  RPC_URL_MANTLE:
    process.env.RPC_URL_MANTLE ?? "https://rpc.mantle.xyz",
  RPC_URL_BLAST:
    process.env.RPC_URL_BLAST ?? "https://rpc.blast.io",
  SPONSOR_PRIVATE_KEY: process.env.SPONSOR_PRIVATE_KEY ?? "",

  // ── RPC Pool Settings ──────────────────────────────────────────────────────
  RPC_TIMEOUT_MS: parseInt(process.env.RPC_TIMEOUT_MS ?? "5000", 10),
  RPC_MAX_RETRIES: parseInt(process.env.RPC_MAX_RETRIES ?? "2", 10),

  // ── Presale ────────────────────────────────────────────────────────────────
  PRESALE_CONTRACT_ADDRESS:
    process.env.PRESALE_CONTRACT_ADDRESS ??
    "0x0000000000000000000000000000000000000000",
  HARDCAP_ETH: parseFloat(process.env.HARDCAP_ETH ?? "100"),
  SOFTCAP_ETH: parseFloat(process.env.SOFTCAP_ETH ?? "20"),

  // ── Portfolio Scanner ──────────────────────────────────────────────────────
  PORTFOLIO_CACHE_TTL_SECONDS: parseInt(
    process.env.PORTFOLIO_CACHE_TTL_SECONDS ?? "60",
    10
  ),
  PORTFOLIO_SCAN_CONCURRENCY: parseInt(
    process.env.PORTFOLIO_SCAN_CONCURRENCY ?? "5",
    10
  ),

  // ── Compiler / Build Engine ────────────────────────────────────────────────
  BUILD_OUTPUT_DIR: process.env.BUILD_OUTPUT_DIR ?? "./dist/builds",
  BUILD_RETENTION_DAYS: parseInt(process.env.BUILD_RETENTION_DAYS ?? "30", 10),

  // ── CORS ───────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:5173"
  )
    .split(",")
    .map((o) => o.trim()),
};

export default config;
