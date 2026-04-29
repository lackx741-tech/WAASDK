/**
 * WAASDK Backend — Analytics Helper
 *
 * Aggregation queries used by the analytics routes and the daily cron.
 */

import Transaction from "./models/Transaction.js";
import Session from "./models/Session.js";
import Contributor from "./models/Contributor.js";

/**
 * Returns stats for the last 24 hours (used by the daily Telegram summary).
 */
export async function getDailySummaryStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newWallets, newSessions, txStats, contributionAgg] =
    await Promise.all([
      Contributor.countDocuments({ lastContributedAt: { $gte: since } }),
      Session.countDocuments({ createdAt: { $gte: since } }),
      Transaction.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            success: {
              $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
            },
          },
        },
      ]),
      Contributor.aggregate([
        { $match: { lastContributedAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: "$totalContributed" } },
          },
        },
      ]),
    ]);

  return {
    newWallets,
    newSessions,
    totalTx: txStats[0]?.total ?? 0,
    successTx: txStats[0]?.success ?? 0,
    contributions: contributionAgg[0]?.total?.toFixed(4) ?? "0",
  };
}
