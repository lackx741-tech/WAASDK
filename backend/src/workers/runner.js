#!/usr/bin/env node
/**
 * WAASDK Backend — Worker Runner
 *
 * Standalone entry-point that starts all BullMQ workers.
 * Run as a separate process / Docker service:
 *   node src/workers/runner.js
 *
 * Workers started:
 *  - Notification worker  (Telegram / email / webhook dispatch)
 *  - Portfolio worker     (multi-chain wallet scanning)
 *  - Transaction status   (on-chain confirmation polling)
 *  - Analytics worker     (aggregate stats)
 */

import "dotenv/config";
import { connectDB } from "../db.js";
import { createNotificationWorker } from "./notificationWorker.js";
import { createPortfolioWorker } from "./portfolioWorker.js";
import { createTransactionStatusWorker } from "./transactionStatusWorker.js";
import { createAnalyticsWorker } from "./analyticsWorker.js";
import { closeQueues } from "../queues/index.js";
import { initTelegramBot } from "../telegram.js";

async function run() {
  // Connect to MongoDB
  await connectDB();
  console.log("✅ Worker runner: MongoDB connected");

  // Init Telegram (for notification worker alerts)
  initTelegramBot();

  // Start workers
  const workers = [
    createNotificationWorker(5),
    createPortfolioWorker(3),
    createTransactionStatusWorker(5),
    createAnalyticsWorker(2),
  ];

  console.log(`🚀 ${workers.length} BullMQ workers started`);

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`[worker-runner] ${signal} received — shutting down`);
    await Promise.allSettled(workers.map((w) => w.close()));
    await closeQueues();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

run().catch((err) => {
  console.error("[worker-runner] fatal:", err);
  process.exit(1);
});
