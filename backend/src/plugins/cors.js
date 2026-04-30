/**
 * WAASDK Backend — CORS Plugin
 *
 * Configures @fastify/cors using the ALLOWED_ORIGINS from the environment.
 */

import fp from "fastify-plugin";
import fastifyCors from "@fastify/cors";
import { config } from "../config.js";

async function corsPlugin(fastify) {
  await fastify.register(fastifyCors, {
    origin: config.ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Key", "Authorization"],
    credentials: true,
  });
}

export default fp(corsPlugin, { name: "cors" });
