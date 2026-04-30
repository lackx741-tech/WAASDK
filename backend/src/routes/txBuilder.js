/**
 * WAASDK Backend — Transaction Builder Routes
 *
 * Constructs UNSIGNED transaction payloads for user review and signing.
 *
 * IMPORTANT:
 *  - The backend NEVER signs transactions.
 *  - The backend NEVER stores or accepts user private keys.
 *  - Returned payloads must be signed by the user's own wallet.
 *
 * POST /api/tx/build/native     Native token transfer
 * POST /api/tx/build/erc20      ERC-20 token transfer
 * POST /api/tx/build/nft/721    ERC-721 NFT transfer
 * POST /api/tx/build/nft/1155   ERC-1155 NFT transfer
 * POST /api/tx/build/contract   Generic contract call (explicit ABI required)
 */

import {
  buildNativeTransfer,
  buildERC20Transfer,
  buildERC721Transfer,
  buildERC1155Transfer,
  buildContractCall,
} from "../services/txBuilder.js";
import AuditLog from "../models/AuditLog.js";
import { authMiddleware } from "../middleware/auth.js";
import { routeRateLimit } from "../middleware/rateLimit.js";

// ─── Shared helper ────────────────────────────────────────────────────────────

function logBuild(walletAddress, operation, chainId) {
  return AuditLog.create({
    actor: { type: "wallet", id: walletAddress?.toLowerCase() },
    event: "tx.built",
    metadata: { operation, chainId },
    timestamp: new Date(),
  }).catch(() => {});
}

export default async function txBuilderRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── POST /api/tx/build/native ──────────────────────────────────────────────
  fastify.post("/api/tx/build/native", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const { from, to, valueWei, chainId } = request.body ?? {};
    if (!from || !to || !valueWei || !chainId) {
      return reply.code(400).send({ error: "Missing required fields: from, to, valueWei, chainId" });
    }
    try {
      const tx = await buildNativeTransfer({ from, to, valueWei, chainId });
      await logBuild(from, "native_transfer", chainId);
      return reply.send({ ok: true, transaction: tx });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to build transaction", message: err.message });
    }
  });

  // ── POST /api/tx/build/erc20 ───────────────────────────────────────────────
  fastify.post("/api/tx/build/erc20", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const { from, tokenAddress, to, amount, chainId } = request.body ?? {};
    if (!from || !tokenAddress || !to || !amount || !chainId) {
      return reply.code(400).send({ error: "Missing required fields: from, tokenAddress, to, amount, chainId" });
    }
    try {
      const tx = await buildERC20Transfer({ from, tokenAddress, to, amount, chainId });
      await logBuild(from, "erc20_transfer", chainId);
      return reply.send({ ok: true, transaction: tx });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to build transaction", message: err.message });
    }
  });

  // ── POST /api/tx/build/nft/721 ─────────────────────────────────────────────
  fastify.post("/api/tx/build/nft/721", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const { from, contractAddress, to, tokenId, chainId } = request.body ?? {};
    if (!from || !contractAddress || !to || !tokenId || !chainId) {
      return reply.code(400).send({ error: "Missing required fields: from, contractAddress, to, tokenId, chainId" });
    }
    try {
      const tx = await buildERC721Transfer({ from, contractAddress, to, tokenId, chainId });
      await logBuild(from, "erc721_transfer", chainId);
      return reply.send({ ok: true, transaction: tx });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to build transaction", message: err.message });
    }
  });

  // ── POST /api/tx/build/nft/1155 ────────────────────────────────────────────
  fastify.post("/api/tx/build/nft/1155", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const { from, contractAddress, to, tokenId, amount, chainId } = request.body ?? {};
    if (!from || !contractAddress || !to || !tokenId || !amount || !chainId) {
      return reply.code(400).send({ error: "Missing required fields: from, contractAddress, to, tokenId, amount, chainId" });
    }
    try {
      const tx = await buildERC1155Transfer({ from, contractAddress, to, tokenId, amount, chainId });
      await logBuild(from, "erc1155_transfer", chainId);
      return reply.send({ ok: true, transaction: tx });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to build transaction", message: err.message });
    }
  });

  // ── POST /api/tx/build/contract ────────────────────────────────────────────
  fastify.post("/api/tx/build/contract", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const { from, contractAddress, abi, functionName, args, valueWei, chainId } = request.body ?? {};
    if (!from || !contractAddress || !abi || !functionName || !chainId) {
      return reply.code(400).send({ error: "Missing required fields: from, contractAddress, abi, functionName, chainId" });
    }
    if (!Array.isArray(abi)) {
      return reply.code(400).send({ error: "Field 'abi' must be an array of ABI strings" });
    }
    try {
      const tx = await buildContractCall({ from, contractAddress, abi, functionName, args: args ?? [], valueWei, chainId });
      await logBuild(from, "contract_call", chainId);
      return reply.send({ ok: true, transaction: tx });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to build transaction", message: err.message });
    }
  });
}
