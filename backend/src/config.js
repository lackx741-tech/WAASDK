/**
 * WAASDK Backend — Environment Configuration
 *
 * Reads and validates all required environment variables.
 * Call config() from dotenv before importing this module.
 */

import "dotenv/config";

function require_env(name, fallback) {
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
  API_KEY: require_env("API_KEY", "changeme"),

  // ── MongoDB ────────────────────────────────────────────────────────────────
  MONGODB_URI: require_env(
    "MONGODB_URI",
    "mongodb://localhost:27017/waassdk"
  ),
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME ?? "waassdk",

  // ── Telegram ───────────────────────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? "",

  // ── Blockchain ─────────────────────────────────────────────────────────────
  RPC_URL_ETHEREUM:
    process.env.RPC_URL_ETHEREUM ?? "https://eth.llamarpc.com",
  RPC_URL_BSC:
    process.env.RPC_URL_BSC ?? "https://bsc-dataseed.binance.org",
  RPC_URL_POLYGON:
    process.env.RPC_URL_POLYGON ?? "https://polygon-rpc.com",
  SPONSOR_PRIVATE_KEY: process.env.SPONSOR_PRIVATE_KEY ?? "",

  // ── Presale ────────────────────────────────────────────────────────────────
  PRESALE_CONTRACT_ADDRESS:
    process.env.PRESALE_CONTRACT_ADDRESS ??
    "0x0000000000000000000000000000000000000000",
  HARDCAP_ETH: parseFloat(process.env.HARDCAP_ETH ?? "100"),
  SOFTCAP_ETH: parseFloat(process.env.SOFTCAP_ETH ?? "20"),

  // ── CORS ───────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:5173"
  )
    .split(",")
    .map((o) => o.trim()),
};

export default config;
