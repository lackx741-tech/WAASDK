/**
 * WAASDK Backend — Fastify MongoDB Plugin
 *
 * Wraps the mongoose connection and exposes it as a Fastify decorator.
 * Register this plugin once in server.js.
 */

import fp from "fastify-plugin";
import { connectDB, isDBConnected } from "../db.js";

async function mongoPlugin(fastify) {
  await connectDB();

  fastify.decorate("isDBConnected", isDBConnected);

  fastify.addHook("onClose", async () => {
    const { disconnectDB } = await import("../db.js");
    await disconnectDB();
  });
}

export default fp(mongoPlugin, { name: "mongo" });
