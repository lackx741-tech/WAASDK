/**
 * WAASDK Backend — API Key Authentication Middleware
 *
 * All /api/* routes (except /api/health) require the X-API-Key header.
 * The expected key is stored in the API_KEY environment variable.
 */

import { config } from "../config.js";

export async function authMiddleware(request, reply) {
  const key = request.headers["x-api-key"];
  if (!key || key !== config.API_KEY) {
    return reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing X-API-Key header" });
  }
}
