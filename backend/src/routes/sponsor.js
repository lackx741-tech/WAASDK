/**
 * WAASDK Backend — Gas Sponsorship Routes
 *
 * POST /api/sponsor/estimate   Estimate gas cost for a transaction
 * POST /api/sponsor/submit     Submit a sponsored (gas-paid) transaction
 * GET  /api/sponsor/balance    Get sponsor wallet ETH balance
 */

import { authMiddleware } from "../middleware/auth.js";
import { config } from "../config.js";
import { routeRateLimit } from "../middleware/rateLimit.js";

// Lazy-import ethers so the server starts even without ethers installed
async function getProvider(chainId) {
  const { ethers } = await import("ethers");
  const rpcMap = {
    1: config.RPC_URL_ETHEREUM,
    56: config.RPC_URL_BSC,
    137: config.RPC_URL_POLYGON,
  };
  const rpcUrl = rpcMap[chainId] ?? config.RPC_URL_ETHEREUM;
  return new ethers.JsonRpcProvider(rpcUrl);
}

export default async function sponsorRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── POST /api/sponsor/estimate ─────────────────────────────────────────────
  fastify.post("/api/sponsor/estimate", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const { to, data, value, chainId = 1 } = request.body ?? {};
    if (!to) {
      return reply.code(400).send({ error: "Missing required field: to" });
    }

    try {
      const { ethers } = await import("ethers");
      const provider = await getProvider(chainId);
      const [gasEstimate, feeData] = await Promise.all([
        provider.estimateGas({ to, data: data ?? "0x", value: value ?? "0x0" }),
        provider.getFeeData(),
      ]);

      const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
      const estimatedCostWei = gasEstimate * gasPrice;
      const estimatedCostEth = ethers.formatEther(estimatedCostWei);

      return reply.send({
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCostWei: estimatedCostWei.toString(),
        estimatedCostEth,
      });
    } catch (err) {
      return reply.code(500).send({ error: "Gas estimation failed", message: err.message });
    }
  });

  // ── POST /api/sponsor/submit ───────────────────────────────────────────────
  fastify.post("/api/sponsor/submit", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const { to, data, value, chainId = 1 } = request.body ?? {};
    if (!to || !data) {
      return reply.code(400).send({ error: "Missing required fields: to, data" });
    }
    if (!config.SPONSOR_PRIVATE_KEY) {
      return reply.code(503).send({ error: "Sponsor wallet not configured" });
    }

    try {
      const { ethers } = await import("ethers");
      const provider = await getProvider(chainId);
      const wallet = new ethers.Wallet(config.SPONSOR_PRIVATE_KEY, provider);

      const tx = await wallet.sendTransaction({
        to,
        data,
        value: value ?? "0x0",
      });

      return reply.send({ txHash: tx.hash, message: "Transaction submitted" });
    } catch (err) {
      return reply.code(500).send({ error: "Sponsored transaction failed", message: err.message });
    }
  });

  // ── GET /api/sponsor/balance ────────────────────────────────────────────────
  fastify.get("/api/sponsor/balance", { config: { rateLimit: routeRateLimit.sponsor } }, async (request, reply) => {
    const chainId = Number(request.query.chainId ?? 1);
    if (!config.SPONSOR_PRIVATE_KEY) {
      return reply.code(503).send({ error: "Sponsor wallet not configured" });
    }

    try {
      const { ethers } = await import("ethers");
      const provider = await getProvider(chainId);
      const wallet = new ethers.Wallet(config.SPONSOR_PRIVATE_KEY, provider);
      const balanceWei = await provider.getBalance(wallet.address);

      return reply.send({
        address: wallet.address,
        balanceWei: balanceWei.toString(),
        balanceEth: ethers.formatEther(balanceWei),
        chainId,
      });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch balance", message: err.message });
    }
  });
}
