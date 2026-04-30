/**
 * WAASDK Backend — Analytics Worker
 *
 * Consumes jobs from the "analytics" queue and runs aggregate update tasks.
 *
 * Job types:
 *  - affiliate_stats   Recalculate wallet connect / tx counts for an affiliate
 *  - daily_summary     Compute platform-wide daily stats (feeds Telegram cron)
 */

import { Worker } from "bullmq";
import { getQueueConnection } from "../queues/index.js";
import Affiliate from "../models/Affiliate.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Session from "../models/Session.js";

// ─── Task: affiliate stats ────────────────────────────────────────────────────

async function computeAffiliateStats(affiliateId) {
  if (!affiliateId) return;

  const [walletConnects, transactions, activeSessions] = await Promise.all([
    User.countDocuments({ affiliateId }),
    Transaction.countDocuments({ /* filter by affiliateId in future */ }),
    Session.countDocuments({
      status: "active",
      expiresAt: { $gt: Math.floor(Date.now() / 1000) },
    }),
  ]);

  await Affiliate.findByIdAndUpdate(affiliateId, {
    $set: {
      "stats.walletConnects": walletConnects,
      "stats.transactions": transactions,
      "stats.activeUsers": walletConnects,
      "stats.lastCalculatedAt": new Date(),
    },
  });
}

// ─── Task: daily summary ──────────────────────────────────────────────────────

async function computeDailySummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [newUsers, newTx, successTx] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: since } }),
    Transaction.countDocuments({ createdAt: { $gte: since } }),
    Transaction.countDocuments({ createdAt: { $gte: since }, status: "success" }),
  ]);

  return { newUsers, newTx, successTx, date: since.toISOString().split("T")[0] };
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export function createAnalyticsWorker(concurrency = 2) {
  const worker = new Worker(
    "analytics",
    async (job) => {
      const { type, affiliateId } = job.data;

      switch (type) {
        case "affiliate_stats":
          await computeAffiliateStats(affiliateId);
          job.log(`Affiliate stats updated for ${affiliateId}`);
          break;
        case "daily_summary": {
          const stats = await computeDailySummary();
          job.log(`Daily summary: ${JSON.stringify(stats)}`);
          return stats;
        }
        default:
          throw new Error(`Unknown analytics job type: ${type}`);
      }
    },
    {
      connection: getQueueConnection(),
      concurrency,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[analytics-worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
