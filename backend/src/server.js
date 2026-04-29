/**
 * WAASDK Backend — Fastify Server Entry Point
 *
 * Registers:
 *  - @fastify/helmet  (security headers)
 *  - @fastify/cors    (cross-origin requests)
 *  - @fastify/rate-limit (rate limiting)
 *  - MongoDB plugin   (mongoose connection)
 *  - All route plugins
 *  - Auth pre-handler (skipped for /api/health)
 *  - Telegram bot
 *  - Graceful shutdown
 */

import "dotenv/config";
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import { config } from "./config.js";
import mongoPlugin from "./plugins/mongo.js";
import corsPlugin from "./plugins/cors.js";
import { initTelegramBot } from "./telegram.js";
import { rateLimitConfig } from "./middleware/rateLimit.js";

// Routes
import healthRoutes from "./routes/health.js";
import sessionRoutes from "./routes/sessions.js";
import transactionRoutes from "./routes/transactions.js";
import analyticsRoutes from "./routes/analytics.js";
import webhookRoutes from "./routes/webhook.js";
import sponsorRoutes from "./routes/sponsor.js";

// ─── Build Server ─────────────────────────────────────────────────────────────

export async function buildServer() {
  const fastify = Fastify({
    logger:
      config.NODE_ENV === "production"
        ? true
        : { transport: { target: "pino-pretty", options: { colorize: true } } },
  });

  // ── Security headers ────────────────────────────────────────────────────────
  await fastify.register(helmet, { global: true });

  // ── CORS ────────────────────────────────────────────────────────────────────
  await fastify.register(corsPlugin);

  // ── Rate limiting (global default) ─────────────────────────────────────────
  await fastify.register(rateLimit, rateLimitConfig.default);

  // ── MongoDB ─────────────────────────────────────────────────────────────────
  await fastify.register(mongoPlugin);

  // ── Routes ──────────────────────────────────────────────────────────────────
  await fastify.register(healthRoutes);
  await fastify.register(sessionRoutes);
  await fastify.register(transactionRoutes);
  await fastify.register(analyticsRoutes);

  // Webhook routes with tighter rate limit
  await fastify.register(async (instance) => {
    await instance.register(rateLimit, rateLimitConfig.webhook);
    await instance.register(webhookRoutes);
  });

  // Sponsor routes with tightest rate limit
  await fastify.register(async (instance) => {
    await instance.register(rateLimit, rateLimitConfig.sponsor);
    await instance.register(sponsorRoutes);
  });

  return fastify;
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  const fastify = await buildServer();

  // Initialise Telegram bot (non-fatal if tokens are missing)
  initTelegramBot(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID);

  // Graceful shutdown
  const shutdown = async (signal) => {
    fastify.log.info({ signal }, "shutting down");
    await fastify.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await fastify.listen({ port: config.PORT, host: "0.0.0.0" });
    fastify.log.info(`🚀 WAASDK Backend listening on port ${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
