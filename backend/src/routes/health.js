/**
 * WAASDK Backend — Health Check Route
 * GET /api/health
 */

import { isDBConnected } from "../db.js";

export default async function healthRoutes(fastify) {
  fastify.get("/api/health", { config: { skipAuth: true } }, async (_req, reply) => {
    return reply.send({
      status: "ok",
      db: isDBConnected() ? "connected" : "disconnected",
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });
}
