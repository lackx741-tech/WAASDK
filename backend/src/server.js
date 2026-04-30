/**
 * WAASDK Backend — Fastify Server Entry Point
 *
 * Registers:
 *  - @fastify/helmet  (security headers)
 *  - @fastify/cors    (cross-origin requests)
 *  - @fastify/rate-limit (rate limiting)
 *  - MongoDB plugin   (mongoose connection)
 *  - Redis plugin     (ioredis connection, used by BullMQ)
 *  - All route plugins
 *  - Auth pre-handler (skipped for /api/health)
 *  - Telegram bot
 *  - BullMQ workers (optional — disable by setting WORKERS_ENABLED=false)
 *  - Graceful shutdown
 */

import "dotenv/config";
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import { config } from "./config.js";
import mongoPlugin from "./plugins/mongo.js";
import corsPlugin from "./plugins/cors.js";
import redisPlugin from "./plugins/redis.js";
import { initTelegramBot, scheduleDailySummary } from "./telegram.js";
import { rateLimitConfig } from "./middleware/rateLimit.js";
import { closeQueues } from "./queues/index.js";

// ── Existing routes ────────────────────────────────────────────────────────
import healthRoutes from "./routes/health.js";
import sessionRoutes from "./routes/sessions.js";
import transactionRoutes from "./routes/transactions.js";
import analyticsRoutes from "./routes/analytics.js";
import webhookRoutes from "./routes/webhook.js";
import sponsorRoutes from "./routes/sponsor.js";

// ── New routes ─────────────────────────────────────────────────────────────
import configRoutes from "./routes/config.js";
import eventRoutes from "./routes/events.js";
import portfolioRoutes from "./routes/portfolio.js";
import txBuilderRoutes from "./routes/txBuilder.js";
import panelRoutes from "./routes/panel.js";

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
  await fastify.register(rateLimit, { ...rateLimitConfig.default, global: true });

  // ── MongoDB ─────────────────────────────────────────────────────────────────
  await fastify.register(mongoPlugin);

  // ── Redis ───────────────────────────────────────────────────────────────────
  await fastify.register(redisPlugin);

  // ── Existing routes ─────────────────────────────────────────────────────────
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

  // ── New routes ──────────────────────────────────────────────────────────────

  // Runtime SDK config
  await fastify.register(configRoutes);

  // Event ingestion (wallet connect, assets, transactions, logs)
  await fastify.register(eventRoutes);

  // Portfolio scanner
  await fastify.register(portfolioRoutes);

  // Transaction builder (unsigned payloads only)
  await fastify.register(async (instance) => {
    await instance.register(rateLimit, rateLimitConfig.sponsor);
    await instance.register(txBuilderRoutes);
  });

  // Panel / Affiliate Web Panel API (auth, configs, compile, files, stats)
  await fastify.register(panelRoutes);

  return fastify;
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  const fastify = await buildServer();

  // Initialise Telegram bot (non-fatal if tokens are missing)
  initTelegramBot();
  scheduleDailySummary();

  // Optionally start in-process BullMQ workers (set WORKERS_ENABLED=false to disable)
  let workers = [];
  if (process.env.WORKERS_ENABLED !== "false") {
    const [
      { createNotificationWorker },
      { createPortfolioWorker },
      { createTransactionStatusWorker },
      { createAnalyticsWorker },
    ] = await Promise.all([
      import("./workers/notificationWorker.js"),
      import("./workers/portfolioWorker.js"),
      import("./workers/transactionStatusWorker.js"),
      import("./workers/analyticsWorker.js"),
    ]);

    workers = [
      createNotificationWorker(5),
      createPortfolioWorker(3),
      createTransactionStatusWorker(5),
      createAnalyticsWorker(2),
    ];
    fastify.log.info(`🔄 ${workers.length} BullMQ workers started`);
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    fastify.log.info({ signal }, "shutting down");
    await Promise.allSettled(workers.map((w) => w.close()));
    await closeQueues();
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
