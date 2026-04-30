/**
 * WAASDK Backend — Event Ingestion Routes
 *
 * Receives analytics events from the frontend SDK.
 * All events are authenticated via API key.
 *
 * POST /api/events/connect       Wallet connected
 * POST /api/events/assets        Portfolio data received from client
 * POST /api/events/transactions  User-signed transaction submitted
 * POST /api/events/logs          General diagnostic / audit log entry
 */

import User from "../models/User.js";
import PortfolioSnapshot from "../models/PortfolioSnapshot.js";
import AuditLog from "../models/AuditLog.js";
import { authMiddleware } from "../middleware/auth.js";
import { routeRateLimit } from "../middleware/rateLimit.js";
import {
  enqueuePortfolioRefresh,
  enqueueNotification,
  enqueueTransactionStatus,
} from "../queues/index.js";
import { createHash } from "crypto";

function hashIp(ip) {
  if (!ip) return undefined;
  return createHash("sha256").update(ip).digest("hex");
}

export default async function eventRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── POST /api/events/connect ───────────────────────────────────────────────
  fastify.post("/api/events/connect", { config: { rateLimit: routeRateLimit.webhook } }, async (request, reply) => {
    const { address, chainId, userAgent } = request.body ?? {};
    if (!address) {
      return reply.code(400).send({ error: "Missing required field: address" });
    }

    const wallet = address.toLowerCase();
    const ipHash = hashIp(request.ip);

    // Upsert user record
    const user = await User.findOneAndUpdate(
      { walletAddress: wallet },
      {
        $set: {
          chainId: chainId ?? 1,
          lastSeenAt: new Date(),
          userAgent: userAgent?.slice(0, 256),
          ipHash,
        },
        $setOnInsert: { firstSeenAt: new Date() },
        $inc: { connectCount: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Audit log
    await AuditLog.create({
      actor: { type: "wallet", id: wallet },
      event: "wallet.connected",
      metadata: { chainId, userAgent: userAgent?.slice(0, 128) },
      ipHash,
      timestamp: new Date(),
    });

    // Trigger async portfolio scan
    await enqueuePortfolioRefresh(wallet, chainId ? [chainId] : undefined, "wallet_connect").catch(() => {});

    // Notify via Telegram
    await enqueueNotification("telegram", "wallet.connected", {
      address: wallet,
      chainId: chainId ?? 1,
      timestamp: Date.now(),
    }).catch(() => {});

    return reply.code(200).send({ ok: true, userId: user._id });
  });

  // ── POST /api/events/assets ───────────────────────────────────────────────
  fastify.post("/api/events/assets", { config: { rateLimit: routeRateLimit.webhook } }, async (request, reply) => {
    const { address, chainId, nativeBalance, tokens, nfts, totalValueUsd } = request.body ?? {};
    if (!address) {
      return reply.code(400).send({ error: "Missing required field: address" });
    }

    const wallet = address.toLowerCase();

    // Persist as a snapshot
    await PortfolioSnapshot.create({
      walletAddress: wallet,
      chains: [
        {
          chainId: chainId ?? 1,
          nativeBalance: nativeBalance ?? "0",
          tokens: tokens ?? [],
          nfts: nfts ?? [],
          totalValueUsd: totalValueUsd ?? 0,
          scannedAt: new Date(),
        },
      ],
      totalValueUsd: totalValueUsd ?? 0,
      triggeredBy: "webhook",
    });

    // Update user's latest portfolio
    await User.findOneAndUpdate(
      { walletAddress: wallet },
      {
        $set: {
          "latestPortfolio.nativeBalance": nativeBalance,
          "latestPortfolio.tokens": tokens ?? [],
          "latestPortfolio.nfts": nfts ?? [],
          "latestPortfolio.totalValueUsd": totalValueUsd ?? 0,
          "latestPortfolio.updatedAt": new Date(),
        },
      }
    );

    return reply.code(200).send({ ok: true });
  });

  // ── POST /api/events/transactions ─────────────────────────────────────────
  fastify.post("/api/events/transactions", { config: { rateLimit: routeRateLimit.webhook } }, async (request, reply) => {
    const { txHash, userAddress, chainId, contractAddress, functionName, value } =
      request.body ?? {};
    if (!txHash || !userAddress || !chainId) {
      return reply.code(400).send({ error: "Missing required fields: txHash, userAddress, chainId" });
    }

    // Enqueue status polling
    await enqueueTransactionStatus(txHash, chainId, userAddress.toLowerCase()).catch(() => {});

    // Notify
    await enqueueNotification("telegram", "tx.submitted", {
      userAddress,
      txHash,
      chainId,
      contractAddress,
      functionName,
      value: value ?? "0",
    }).catch(() => {});

    return reply.code(200).send({ ok: true });
  });

  // ── POST /api/events/logs ──────────────────────────────────────────────────
  fastify.post("/api/events/logs", { config: { rateLimit: routeRateLimit.webhook } }, async (request, reply) => {
    const { event, metadata, walletAddress } = request.body ?? {};
    if (!event) {
      return reply.code(400).send({ error: "Missing required field: event" });
    }

    await AuditLog.create({
      actor: { type: "wallet", id: walletAddress?.toLowerCase() ?? "unknown" },
      event: "system.error",   // Generic log; mapped to closest audit event
      metadata: { event, ...metadata },
      timestamp: new Date(),
    }).catch(() => {});

    return reply.code(200).send({ ok: true });
  });
}
