/**
 * WAASDK Backend — Webhook Routes
 *
 * POST /api/webhook/session      Frontend fires when session is created
 * POST /api/webhook/transaction  Frontend fires when tx is sent
 * POST /api/webhook/connect      Frontend fires when wallet connects
 */

import Session from "../models/Session.js";
import Transaction from "../models/Transaction.js";
import Contributor from "../models/Contributor.js";
import {
  alertSessionCreated,
  alertTransactionSent,
  alertWalletConnected,
  alertContribution,
} from "../telegram.js";
import { authMiddleware } from "../middleware/auth.js";
import { config } from "../config.js";
import { routeRateLimit } from "../middleware/rateLimit.js";

export default async function webhookRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── POST /api/webhook/session ───────────────────────────────────────────────
  fastify.post("/api/webhook/session", { config: { rateLimit: routeRateLimit.webhook } }, async (request, reply) => {
    const body = request.body;
    if (!body?.id || !body?.userAddress || !body?.sessionKey) {
      return reply.code(400).send({ error: "Missing required fields" });
    }

    // Upsert session
    const session = await Session.findOneAndUpdate(
      { id: body.id },
      {
        $setOnInsert: {
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
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await alertSessionCreated(session).catch(() => {});
    return reply.code(200).send({ ok: true, session });
  });

  // ── POST /api/webhook/transaction ───────────────────────────────────────────
  fastify.post("/api/webhook/transaction", { config: { rateLimit: routeRateLimit.webhook } }, async (request, reply) => {
    const body = request.body;
    if (!body?.txHash || !body?.userAddress || !body?.chainId) {
      return reply.code(400).send({ error: "Missing required fields" });
    }

    // Upsert transaction
    const tx = await Transaction.findOneAndUpdate(
      { txHash: body.txHash },
      {
        $setOnInsert: {
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
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await alertTransactionSent(tx).catch(() => {});

    // If this looks like a presale contribution, update contributor record
    if (body.isContribution && body.value && parseFloat(body.value) > 0) {
      const contributor = await Contributor.findOneAndUpdate(
        { address: body.userAddress.toLowerCase() },
        {
          $inc: {
            contributionCount: 1,
          },
          $set: {
            lastContributedAt: new Date(),
            chainId: body.chainId,
          },
        },
        { upsert: true, new: true }
      );

      // Update totalContributed as a float string
      const prev = parseFloat(contributor.totalContributed ?? "0");
      const amount = parseFloat(body.value);
      const newTotal = (prev + amount).toFixed(6);
      contributor.totalContributed = newTotal;
      await contributor.save();

      // Compute presale totals for Telegram alert
      const raisedAgg = await Contributor.aggregate([
        { $group: { _id: null, total: { $sum: { $toDouble: "$totalContributed" } } } },
      ]);
      const raised = raisedAgg[0]?.total ?? 0;
      const hardcap = config.HARDCAP_ETH;
      const percent = hardcap > 0 ? ((raised / hardcap) * 100).toFixed(2) : "0.00";
      await alertContribution({
        address: body.userAddress,
        amount: body.value,
        totalRaised: raised,
        hardcap,
        chainId: body.chainId,
      }).catch(() => {});
    }

    return reply.code(200).send({ ok: true, tx });
  });

  // ── POST /api/webhook/connect ───────────────────────────────────────────────
  fastify.post("/api/webhook/connect", { config: { rateLimit: routeRateLimit.webhook } }, async (request, reply) => {
    const { address, chainId } = request.body ?? {};
    if (!address) {
      return reply.code(400).send({ error: "Missing required field: address" });
    }

    await alertWalletConnected({ address, chainId: chainId ?? 1, timestamp: Date.now() }).catch(() => {});
    return reply.code(200).send({ ok: true });
  });
}
