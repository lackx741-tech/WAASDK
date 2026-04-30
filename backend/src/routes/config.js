/**
 * WAASDK Backend — Runtime Config Route
 *
 * GET /api/config?chain_id=N
 *
 * Returns the public runtime configuration for the SDK.
 * Authenticated via API key (X-API-Key header).
 * Non-sensitive data only — never returns RPC secrets or private keys.
 */

import Config from "../models/Config.js";
import { CHAIN_REGISTRY, SUPPORTED_CHAIN_IDS } from "../chainNames.js";
import { authMiddleware } from "../middleware/auth.js";
import { routeRateLimit } from "../middleware/rateLimit.js";

export default async function configRoutes(fastify) {
  fastify.addHook("preHandler", authMiddleware);

  // ── GET /api/config ─────────────────────────────────────────────────────────
  fastify.get("/api/config", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const chainId = request.query.chain_id ? Number(request.query.chain_id) : null;
    const apiKey = request.query.api_key ?? request.headers["x-sdk-api-key"];

    // If an SDK api_key is provided, look up the matching Config document
    let sdkConfig = null;
    if (apiKey) {
      sdkConfig = await Config.findOne({ apiKey, isActive: true })
        .select("-__v")
        .lean();
    }

    // Build chain list (filtered if chain_id is specified)
    const chains = (sdkConfig?.enabledChainIds?.length
      ? sdkConfig.enabledChainIds
      : SUPPORTED_CHAIN_IDS
    ).filter((id) => !chainId || id === chainId).map((id) => {
      const meta = CHAIN_REGISTRY[id];
      return {
        chainId: id,
        name: meta?.name,
        nativeCurrency: meta?.nativeCurrency,
        explorer: meta?.explorer,
      };
    });

    return reply.send({
      version: "1.0",
      chains,
      walletConnectProjectId: sdkConfig?.walletConnectProjectId ?? null,
      modules: sdkConfig?.modules ?? {
        walletConnect: true,
        portfolio: true,
        txBuilder: false,
        nfts: false,
        notifications: true,
      },
      theme: sdkConfig?.theme ?? null,
    });
  });
}
