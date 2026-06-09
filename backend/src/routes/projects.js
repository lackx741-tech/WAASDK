/**
 * WAASDK Backend — Project Routes (SaaS)
 *
 * POST   /api/projects              Create project
 * GET    /api/projects              List user's projects
 * GET    /api/projects/:id          Get project detail
 * PATCH  /api/projects/:id          Update project
 * DELETE /api/projects/:id          Delete project
 * POST   /api/projects/:id/keys     Generate new API key
 * DELETE /api/projects/:id/keys/:keyId  Revoke API key
 * POST   /api/projects/:id/contracts    Add contract
 * DELETE /api/projects/:id/contracts/:contractId  Remove contract
 */

import Project from "../models/Project.js";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { routeRateLimit } from "../middleware/rateLimit.js";

const JWT_SECRET = config.JWT_SECRET || "waassdk-jwt-secret-change-me";

// Auth helper — extracts user from JWT
async function requireAuth(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    request.userId = payload.id;
  } catch {
    return reply.code(401).send({ error: "Invalid or expired token" });
  }
}

export default async function projectRoutes(fastify) {
  fastify.addHook("preHandler", requireAuth);

  // ── POST /api/projects ──────────────────────────────────────────────────────
  fastify.post("/api/projects", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const { name, description, chains } = request.body ?? {};

    if (!name) {
      return reply.code(400).send({ error: "Project name is required" });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);

    const project = new Project({
      name,
      slug,
      owner: request.userId,
      description: description || "",
      chains: chains || [1],
    });

    // Auto-generate first API key
    const apiKey = project.generateApiKey("Default");
    await project.save();

    return reply.code(201).send({ project, apiKey });
  });

  // ── GET /api/projects ───────────────────────────────────────────────────────
  fastify.get("/api/projects", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const projects = await Project.find({ owner: request.userId, isActive: true })
      .sort({ createdAt: -1 })
      .select("-apiKeys.key");

    return reply.send({ projects });
  });

  // ── GET /api/projects/:id ───────────────────────────────────────────────────
  fastify.get("/api/projects/:id", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, owner: request.userId });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return reply.send({ project });
  });

  // ── PATCH /api/projects/:id ─────────────────────────────────────────────────
  fastify.patch("/api/projects/:id", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const { name, description, chains, settings } = request.body ?? {};
    const update = {};
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (chains) update.chains = chains;
    if (settings) update.settings = settings;

    const project = await Project.findOneAndUpdate(
      { _id: request.params.id, owner: request.userId },
      update,
      { new: true }
    );
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return reply.send({ project });
  });

  // ── DELETE /api/projects/:id ────────────────────────────────────────────────
  fastify.delete("/api/projects/:id", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const project = await Project.findOneAndUpdate(
      { _id: request.params.id, owner: request.userId },
      { isActive: false },
      { new: true }
    );
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return reply.send({ message: "Project deleted" });
  });

  // ── POST /api/projects/:id/keys ─────────────────────────────────────────────
  fastify.post("/api/projects/:id/keys", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const { name } = request.body ?? {};
    const project = await Project.findOne({ _id: request.params.id, owner: request.userId });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    const key = project.generateApiKey(name || `Key ${project.apiKeys.length + 1}`);
    await project.save();

    return reply.code(201).send({ key, message: "API key created. Store it securely — it won't be shown again." });
  });

  // ── DELETE /api/projects/:id/keys/:keyId ────────────────────────────────────
  fastify.delete("/api/projects/:id/keys/:keyId", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, owner: request.userId });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    const keyEntry = project.apiKeys.id(request.params.keyId);
    if (!keyEntry) {
      return reply.code(404).send({ error: "API key not found" });
    }

    keyEntry.isActive = false;
    await project.save();

    return reply.send({ message: "API key revoked" });
  });

  // ── POST /api/projects/:id/contracts ────────────────────────────────────────
  fastify.post("/api/projects/:id/contracts", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const { name, address, chainId, abi } = request.body ?? {};

    if (!address || !chainId) {
      return reply.code(400).send({ error: "Contract address and chainId are required" });
    }

    const project = await Project.findOne({ _id: request.params.id, owner: request.userId });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    project.contracts.push({ name: name || "", address, chainId, abi: abi || [] });
    await project.save();

    return reply.code(201).send({ project });
  });

  // ── DELETE /api/projects/:id/contracts/:contractId ───────────────────────────
  fastify.delete("/api/projects/:id/contracts/:contractId", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, owner: request.userId });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    project.contracts = project.contracts.filter(c => c._id.toString() !== request.params.contractId);
    await project.save();

    return reply.send({ message: "Contract removed" });
  });
}
