/**
 * WAASDK Backend — Fastify Redis Plugin
 *
 * Creates a shared ioredis connection and exposes it as `fastify.redis`.
 * Used by BullMQ and any route that needs low-latency caching.
 */

import fp from "fastify-plugin";
import Redis from "ioredis";
import { config } from "../config.js";

async function redisPlugin(fastify) {
  const redis = new Redis(config.REDIS_URL, {
    password: config.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,       // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    fastify.log.info("✅ Redis connected");
  } catch (err) {
    fastify.log.warn({ err }, "⚠️  Redis connection failed — queue features disabled");
  }

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit().catch(() => {});
  });
}

export default fp(redisPlugin, { name: "redis" });
