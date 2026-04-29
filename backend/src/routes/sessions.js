/**
 * WAASDK Backend — Session Routes
 *
 * POST   /api/sessions              Save new session from frontend
 * GET    /api/sessions              Get all sessions (operator only)
 * GET    /api/sessions/active       All currently active sessions
 * GET    /api/sessions/expiring     Sessions expiring in <1hr
 * GET    /api/sessions/:address     Get sessions for a user address
 * GET    /api/sessions/:id          Get single session by session id
 * DELETE /api/sessions/:id          Revoke a session
 */

import Session from "../models/Session.js";
import { alertSessionCreated, alertSessionRevoked } from "../telegram.js";
import { authMiddleware } from "../middleware/auth.js";

export default async function sessionRoutes(fastify) {
  // Apply auth to all session routes
  fastify.addHook("preHandler", authMiddleware);

  // ── POST /api/sessions ──────────────────────────────────────────────────────
  fastify.post("/api/sessions", async (request, reply) => {
    const body = request.body;

    if (!body?.id || !body?.userAddress || !body?.sessionKey) {
      return reply.code(400).send({ error: "Missing required fields: id, userAddress, sessionKey" });
    }

    const existing = await Session.findOne({ id: body.id });
    if (existing) {
      return reply.code(409).send({ error: "Session already exists" });
    }

    const session = new Session({
      id: body.id,
      userAddress: body.userAddress.toLowerCase(),
      sessionKey: body.sessionKey,
      allowedContracts: body.allowedContracts ?? [],
      allowedFunctions: body.allowedFunctions ?? [],
      spendingLimit: body.spendingLimit ?? "0",
      spendingLimitToken: body.spendingLimitToken ?? "ETH",
      expiresAt: body.expiresAt,
      chainId: body.chainId,
      signature: body.signature,
      txHash: body.txHash,
      status: "active",
    });

    await session.save();
    await alertSessionCreated(session).catch(() => {});

    return reply.code(201).send(session);
  });

  // ── GET /api/sessions ───────────────────────────────────────────────────────
  fastify.get("/api/sessions", async (request, reply) => {
    const { page = 1, limit = 50, status } = request.query;
    const filter = {};
    if (status) filter.status = status;

    const sessions = await Session.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Session.countDocuments(filter);

    return reply.send({ sessions, total, page: Number(page), limit: Number(limit) });
  });

  // ── GET /api/sessions/active ────────────────────────────────────────────────
  fastify.get("/api/sessions/active", async (_req, reply) => {
    const now = Math.floor(Date.now() / 1000);
    const sessions = await Session.find({
      status: "active",
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    return reply.send({ sessions, total: sessions.length });
  });

  // ── GET /api/sessions/expiring ──────────────────────────────────────────────
  fastify.get("/api/sessions/expiring", async (_req, reply) => {
    const now = Math.floor(Date.now() / 1000);
    const oneHourLater = now + 3600;

    const sessions = await Session.find({
      status: "active",
      expiresAt: { $gt: now, $lte: oneHourLater },
    }).sort({ expiresAt: 1 });

    return reply.send({ sessions, total: sessions.length });
  });

  // ── GET /api/sessions/:address ──────────────────────────────────────────────
  // Note: must come before /:id to catch address-like params
  fastify.get("/api/sessions/address/:address", async (request, reply) => {
    const { address } = request.params;
    const sessions = await Session.find({
      userAddress: address.toLowerCase(),
    }).sort({ createdAt: -1 });

    return reply.send({ sessions, total: sessions.length });
  });

  // ── GET /api/sessions/:id ───────────────────────────────────────────────────
  fastify.get("/api/sessions/:id", async (request, reply) => {
    const session = await Session.findOne({ id: request.params.id });
    if (!session) {
      return reply.code(404).send({ error: "Session not found" });
    }
    return reply.send(session);
  });

  // ── DELETE /api/sessions/:id ────────────────────────────────────────────────
  fastify.delete("/api/sessions/:id", async (request, reply) => {
    const session = await Session.findOneAndUpdate(
      { id: request.params.id },
      { status: "revoked" },
      { new: true }
    );
    if (!session) {
      return reply.code(404).send({ error: "Session not found" });
    }
    await alertSessionRevoked(session).catch(() => {});
    return reply.send({ message: "Session revoked", session });
  });
}
