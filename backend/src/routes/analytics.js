/**
 * WAASDK Backend — Analytics Routes
 *
 * GET /api/analytics/presale   { raised, hardcap, contributors, txCount, percentFilled }
 * GET /api/analytics/sessions  { totalSessions, activeSessions, revokedSessions }
 * GET /api/analytics/overview  Combined dashboard stats
 * GET /api/analytics/chart     Time-series data (contributions over time)
 */

import Session from "../models/Session.js";
import Transaction from "../models/Transaction.js";
import Contributor from "../models/Contributor.js";
import { authMiddleware } from "../middleware/auth.js";
import { config } from "../config.js";

export default async function analyticsRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── GET /api/analytics/presale ──────────────────────────────────────────────
  fastify.get("/api/analytics/presale", async (_req, reply) => {
    const [contributors, txCount, raisedAgg] = await Promise.all([
      Contributor.countDocuments(),
      Transaction.countDocuments({ status: "success" }),
      Contributor.aggregate([
        { $group: { _id: null, total: { $sum: { $toDouble: "$totalContributed" } } } },
      ]),
    ]);

    const raised = raisedAgg[0]?.total ?? 0;
    const hardcap = config.HARDCAP_ETH;
    const percentFilled = hardcap > 0 ? Math.min((raised / hardcap) * 100, 100).toFixed(2) : "0.00";

    return reply.send({
      raised: raised.toFixed(4),
      hardcap: hardcap.toFixed(4),
      softcap: config.SOFTCAP_ETH.toFixed(4),
      contributors,
      txCount,
      percentFilled,
    });
  });

  // ── GET /api/analytics/sessions ────────────────────────────────────────────
  fastify.get("/api/analytics/sessions", async (_req, reply) => {
    const now = Math.floor(Date.now() / 1000);
    const [total, active, revoked, expired] = await Promise.all([
      Session.countDocuments(),
      Session.countDocuments({ status: "active", expiresAt: { $gt: now } }),
      Session.countDocuments({ status: "revoked" }),
      Session.countDocuments({ $or: [{ status: "expired" }, { status: "active", expiresAt: { $lte: now } }] }),
    ]);

    return reply.send({ totalSessions: total, activeSessions: active, revokedSessions: revoked, expiredSessions: expired });
  });

  // ── GET /api/analytics/overview ────────────────────────────────────────────
  fastify.get("/api/analytics/overview", async (_req, reply) => {
    const now = Math.floor(Date.now() / 1000);
    const [
      totalContributors,
      raisedAgg,
      totalTx,
      successTx,
      totalSessions,
      activeSessions,
    ] = await Promise.all([
      Contributor.countDocuments(),
      Contributor.aggregate([
        { $group: { _id: null, total: { $sum: { $toDouble: "$totalContributed" } } } },
      ]),
      Transaction.countDocuments(),
      Transaction.countDocuments({ status: "success" }),
      Session.countDocuments(),
      Session.countDocuments({ status: "active", expiresAt: { $gt: now } }),
    ]);

    const raised = raisedAgg[0]?.total ?? 0;
    const hardcap = config.HARDCAP_ETH;

    return reply.send({
      presale: {
        raised: raised.toFixed(4),
        hardcap: hardcap.toFixed(4),
        percentFilled: hardcap > 0 ? Math.min((raised / hardcap) * 100, 100).toFixed(2) : "0.00",
        contributors: totalContributors,
      },
      transactions: {
        total: totalTx,
        success: successTx,
        successRate: totalTx > 0 ? Math.round((successTx / totalTx) * 100) : 0,
      },
      sessions: {
        total: totalSessions,
        active: activeSessions,
      },
    });
  });

  // ── GET /api/analytics/chart ────────────────────────────────────────────────
  fastify.get("/api/analytics/chart", async (request, reply) => {
    const { days = 30 } = request.query;
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const data = await Contributor.aggregate([
      { $match: { lastContributedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastContributedAt" } },
          contributions: { $sum: { $toDouble: "$totalContributed" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return reply.send({ chart: data, days: Number(days) });
  });
}
