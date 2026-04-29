/**
 * WAASDK Backend — Transaction Routes
 *
 * POST   /api/transactions              Log a new transaction
 * GET    /api/transactions              Get all transactions
 * GET    /api/transactions/address/:address  Get txs for a user
 * GET    /api/transactions/tx/:txHash   Get single transaction
 * PATCH  /api/transactions/tx/:txHash   Update tx status
 */

import Transaction from "../models/Transaction.js";
import { alertTransaction } from "../telegram.js";
import { authMiddleware } from "../middleware/auth.js";

export default async function transactionRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── POST /api/transactions ──────────────────────────────────────────────────
  fastify.post("/api/transactions", async (request, reply) => {
    const body = request.body;

    if (!body?.txHash || !body?.userAddress || !body?.chainId) {
      return reply.code(400).send({ error: "Missing required fields: txHash, userAddress, chainId" });
    }

    const existing = await Transaction.findOne({ txHash: body.txHash });
    if (existing) {
      return reply.code(409).send({ error: "Transaction already logged" });
    }

    const tx = new Transaction({
      txHash: body.txHash,
      userAddress: body.userAddress.toLowerCase(),
      contractAddress: body.contractAddress?.toLowerCase(),
      functionName: body.functionName,
      args: body.args ?? [],
      value: body.value ?? "0",
      chainId: body.chainId,
      status: body.status ?? "pending",
      gasUsed: body.gasUsed,
      sessionKeyUsed: body.sessionKeyUsed,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      blockNumber: body.blockNumber,
    });

    await tx.save();
    await alertTransaction(tx).catch(() => {});

    return reply.code(201).send(tx);
  });

  // ── GET /api/transactions ───────────────────────────────────────────────────
  fastify.get("/api/transactions", async (request, reply) => {
    const { page = 1, limit = 50, status, chainId } = request.query;
    const filter = {};
    if (status) filter.status = status;
    if (chainId) filter.chainId = Number(chainId);

    const txs = await Transaction.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Transaction.countDocuments(filter);

    return reply.send({ transactions: txs, total, page: Number(page), limit: Number(limit) });
  });

  // ── GET /api/transactions/address/:address ──────────────────────────────────
  fastify.get("/api/transactions/address/:address", async (request, reply) => {
    const { address } = request.params;
    const txs = await Transaction.find({
      userAddress: address.toLowerCase(),
    }).sort({ timestamp: -1 });

    return reply.send({ transactions: txs, total: txs.length });
  });

  // ── GET /api/transactions/tx/:txHash ───────────────────────────────────────
  fastify.get("/api/transactions/tx/:txHash", async (request, reply) => {
    const tx = await Transaction.findOne({ txHash: request.params.txHash });
    if (!tx) {
      return reply.code(404).send({ error: "Transaction not found" });
    }
    return reply.send(tx);
  });

  // ── PATCH /api/transactions/tx/:txHash ─────────────────────────────────────
  fastify.patch("/api/transactions/tx/:txHash", async (request, reply) => {
    const { status, gasUsed, blockNumber } = request.body ?? {};
    const allowed = ["pending", "success", "failed"];
    if (status && !allowed.includes(status)) {
      return reply.code(400).send({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const update = {};
    if (status) update.status = status;
    if (gasUsed !== undefined) update.gasUsed = gasUsed;
    if (blockNumber !== undefined) update.blockNumber = blockNumber;

    const tx = await Transaction.findOneAndUpdate(
      { txHash: request.params.txHash },
      update,
      { new: true }
    );
    if (!tx) {
      return reply.code(404).send({ error: "Transaction not found" });
    }
    return reply.send(tx);
  });
}
