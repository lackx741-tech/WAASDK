/**
 * WAASDK Backend — Portfolio Routes
 *
 * GET  /api/portfolio/:address           Latest snapshot for a wallet
 * GET  /api/portfolio/:address/history   Historical snapshots
 * POST /api/portfolio/:address/refresh   Trigger an on-demand scan
 */

import PortfolioSnapshot from "../models/PortfolioSnapshot.js";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/auth.js";
import { routeRateLimit } from "../middleware/rateLimit.js";
import { enqueuePortfolioRefresh } from "../queues/index.js";

export default async function portfolioRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── GET /api/portfolio/:address ────────────────────────────────────────────
  fastify.get("/api/portfolio/:address", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const wallet = request.params.address.toLowerCase();

    const snapshot = await PortfolioSnapshot.findOne({ walletAddress: wallet })
      .sort({ capturedAt: -1 })
      .lean();

    if (!snapshot) {
      return reply.code(404).send({ error: "No portfolio data found for this address" });
    }

    return reply.send(snapshot);
  });

  // ── GET /api/portfolio/:address/history ────────────────────────────────────
  fastify.get("/api/portfolio/:address/history", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const wallet = request.params.address.toLowerCase();
    const { limit = 30, days = 30 } = request.query;

    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const snapshots = await PortfolioSnapshot.find({
      walletAddress: wallet,
      capturedAt: { $gte: since },
    })
      .sort({ capturedAt: -1 })
      .limit(Number(limit))
      .select("capturedAt totalValueUsd triggeredBy")
      .lean();

    return reply.send({ snapshots, total: snapshots.length });
  });

  // ── POST /api/portfolio/:address/refresh ───────────────────────────────────
  fastify.post("/api/portfolio/:address/refresh", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const wallet = request.params.address.toLowerCase();
    const { chainIds } = request.body ?? {};

    const job = await enqueuePortfolioRefresh(wallet, chainIds, "manual");

    return reply.code(202).send({
      message: "Portfolio refresh queued",
      jobId: job.id,
      walletAddress: wallet,
    });
  });
}
