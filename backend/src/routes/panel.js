/**
 * WAASDK Backend — Panel / Affiliate Web Panel Routes
 *
 * Provides the full administrative and affiliate-facing API:
 *
 * Auth
 *   POST  /auth/login            Email + password → access + refresh tokens
 *   POST  /auth/refresh          Rotate refresh token
 *   POST  /auth/logout           Invalidate refresh token
 *
 * Panel overview
 *   GET   /panel                 Panel metadata (identity, role, stats)
 *
 * Config management (affiliate configs / SDK deployments)
 *   GET   /configs               List configs for the caller
 *   POST  /configs               Create a new config
 *   GET   /configs/:id           Get a single config
 *   PUT   /configs/:id           Update a config
 *   DELETE /configs/:id          Delete a config
 *
 * Build engine
 *   POST  /compile/:configId     Trigger a bundle build
 *   GET   /files                 List all built artefacts for the caller
 *   GET   /files/:configId/:file Serve a compiled bundle file (static)
 *
 * Analytics
 *   GET   /stats                 Platform-level stats (admin) or affiliate stats
 *   GET   /stats/affiliates      List affiliate stats (admin only)
 */

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { stat, readdir } from "fs/promises";
import { join, resolve, basename, sep as pathSep } from "path";
import Affiliate from "../models/Affiliate.js";
import Config from "../models/Config.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Session from "../models/Session.js";
import AuditLog from "../models/AuditLog.js";
import { issueAccessToken, issueRefreshToken, verifyAccessToken } from "../utils/jwt.js";
import { compileConfig, listBuilds } from "../services/compiler.js";
import { config as envConfig } from "../config.js";
import { createHash } from "crypto";

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Validates Bearer JWT from the Authorization header.
 * Attaches decoded payload to request.affiliate.
 */
async function panelAuth(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing or invalid Authorization header" });
  }
  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    request.affiliate = payload;
  } catch {
    return reply.code(401).send({ error: "Access token expired or invalid" });
  }
}

/**
 * Admin-only guard — call after panelAuth.
 */
async function adminOnly(request, reply) {
  if (request.affiliate?.role !== "admin") {
    return reply.code(403).send({ error: "Admin access required" });
  }
}

// ─── Config ownership helper ─────────────────────────────────────────────────

async function ownedConfig(configId, affiliateId, role) {
  const filter = { _id: configId };
  if (role !== "admin") filter.affiliateId = affiliateId;
  return Config.findOne(filter);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function panelRoutes(fastify) {
  // ── POST /auth/login ────────────────────────────────────────────────────────
  fastify.post("/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { email, password } = request.body ?? {};
    if (!email || !password) {
      return reply.code(400).send({ error: "Missing required fields: email, password" });
    }

    const affiliate = await Affiliate.findOne({ email: email.toLowerCase(), isActive: true })
      .select("+passwordHash +refreshTokenHash +refreshTokenExpiresAt");
    if (!affiliate) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, affiliate.passwordHash);
    if (!valid) {
      await AuditLog.create({
        actor: { type: "affiliate", id: affiliate._id.toString() },
        event: "auth.login_failed",
        ipHash: createHash("sha256").update(request.ip ?? "").digest("hex"),
        success: false,
        timestamp: new Date(),
      }).catch(() => {});
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const accessToken = issueAccessToken({
      id: affiliate._id.toString(),
      role: affiliate.role,
      email: affiliate.email,
    });
    const { token: refreshToken, hash: refreshHash, expiresAt: refreshExp } = issueRefreshToken();

    affiliate.refreshTokenHash = refreshHash;
    affiliate.refreshTokenExpiresAt = refreshExp;
    affiliate.lastLoginAt = new Date();
    affiliate.lastLoginIp = request.ip;
    await affiliate.save();

    await AuditLog.create({
      actor: { type: "affiliate", id: affiliate._id.toString() },
      event: "auth.login",
      ipHash: createHash("sha256").update(request.ip ?? "").digest("hex"),
      timestamp: new Date(),
    }).catch(() => {});

    return reply.send({ accessToken, refreshToken, expiresIn: envConfig.JWT_EXPIRES_IN });
  });

  // ── POST /auth/refresh ──────────────────────────────────────────────────────
  fastify.post("/auth/refresh", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { refreshToken } = request.body ?? {};
    if (!refreshToken) {
      return reply.code(400).send({ error: "Missing required field: refreshToken" });
    }

    const hash = createHash("sha256").update(refreshToken).digest("hex");
    const affiliate = await Affiliate.findOne({
      refreshTokenHash: hash,
      refreshTokenExpiresAt: { $gt: new Date() },
      isActive: true,
    }).select("+refreshTokenHash +refreshTokenExpiresAt");

    if (!affiliate) {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }

    // Rotate
    const accessToken = issueAccessToken({
      id: affiliate._id.toString(),
      role: affiliate.role,
      email: affiliate.email,
    });
    const { token: newRefresh, hash: newHash, expiresAt: newExp } = issueRefreshToken();
    affiliate.refreshTokenHash = newHash;
    affiliate.refreshTokenExpiresAt = newExp;
    await affiliate.save();

    return reply.send({ accessToken, refreshToken: newRefresh, expiresIn: envConfig.JWT_EXPIRES_IN });
  });

  // ── POST /auth/logout ───────────────────────────────────────────────────────
  fastify.post("/auth/logout", { preHandler: panelAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    await Affiliate.findByIdAndUpdate(request.affiliate.sub, {
      $unset: { refreshTokenHash: "", refreshTokenExpiresAt: "" },
    });
    return reply.send({ ok: true });
  });

  // ── GET /panel ──────────────────────────────────────────────────────────────
  fastify.get("/panel", { preHandler: panelAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const affiliate = await Affiliate.findById(request.affiliate.sub)
      .select("-passwordHash -refreshTokenHash -refreshTokenExpiresAt")
      .lean();
    if (!affiliate) {
      return reply.code(404).send({ error: "Affiliate not found" });
    }
    const configCount = await Config.countDocuments({ affiliateId: affiliate._id });
    return reply.send({ affiliate, configCount });
  });

  // ── GET /configs ────────────────────────────────────────────────────────────
  fastify.get("/configs", { preHandler: panelAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { page = 1, limit = 20 } = request.query;
    const filter = request.affiliate.role === "admin"
      ? {}
      : { affiliateId: request.affiliate.sub };

    const configs = await Config.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    const total = await Config.countDocuments(filter);

    return reply.send({ configs, total, page: Number(page), limit: Number(limit) });
  });

  // ── POST /configs ───────────────────────────────────────────────────────────
  fastify.post("/configs", { preHandler: panelAuth, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { name, description, walletConnectProjectId, backendUrl, enabledChainIds, modules, theme } =
      request.body ?? {};
    if (!name) {
      return reply.code(400).send({ error: "Missing required field: name" });
    }

    const apiKey = `waas_${randomUUID().replace(/-/g, "")}`;
    const configDoc = await Config.create({
      affiliateId: request.affiliate.sub,
      name,
      description,
      apiKey,
      walletConnectProjectId,
      backendUrl,
      enabledChainIds: enabledChainIds ?? [],
      modules: modules ?? {},
      theme: theme ?? {},
    });

    await AuditLog.create({
      actor: { type: "affiliate", id: request.affiliate.sub },
      event: "config.created",
      resource: { type: "Config", id: configDoc._id.toString() },
      timestamp: new Date(),
    }).catch(() => {});

    return reply.code(201).send(configDoc);
  });

  // ── GET /configs/:id ────────────────────────────────────────────────────────
  fastify.get("/configs/:id", { preHandler: panelAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const doc = await ownedConfig(request.params.id, request.affiliate.sub, request.affiliate.role);
    if (!doc) return reply.code(404).send({ error: "Config not found" });
    return reply.send(doc);
  });

  // ── PUT /configs/:id ────────────────────────────────────────────────────────
  fastify.put("/configs/:id", { preHandler: panelAuth, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const doc = await ownedConfig(request.params.id, request.affiliate.sub, request.affiliate.role);
    if (!doc) return reply.code(404).send({ error: "Config not found" });

    const allowed = ["name", "description", "walletConnectProjectId", "backendUrl",
                     "enabledChainIds", "chainOverrides", "modules", "theme", "isActive"];
    for (const key of allowed) {
      if (request.body?.[key] !== undefined) doc[key] = request.body[key];
    }
    await doc.save();

    await AuditLog.create({
      actor: { type: "affiliate", id: request.affiliate.sub },
      event: "config.updated",
      resource: { type: "Config", id: doc._id.toString() },
      timestamp: new Date(),
    }).catch(() => {});

    return reply.send(doc);
  });

  // ── DELETE /configs/:id ─────────────────────────────────────────────────────
  fastify.delete("/configs/:id", { preHandler: panelAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const doc = await ownedConfig(request.params.id, request.affiliate.sub, request.affiliate.role);
    if (!doc) return reply.code(404).send({ error: "Config not found" });

    await doc.deleteOne();

    await AuditLog.create({
      actor: { type: "affiliate", id: request.affiliate.sub },
      event: "config.deleted",
      resource: { type: "Config", id: request.params.id },
      timestamp: new Date(),
    }).catch(() => {});

    return reply.send({ ok: true });
  });

  // ── POST /compile/:configId ─────────────────────────────────────────────────
  fastify.post("/compile/:configId", { preHandler: panelAuth, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const doc = await ownedConfig(request.params.configId, request.affiliate.sub, request.affiliate.role);
    if (!doc) return reply.code(404).send({ error: "Config not found" });

    try {
      const result = await compileConfig(doc._id.toString(), request.affiliate.sub);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return reply.code(500).send({ error: "Build failed", message: err.message });
    }
  });

  // ── GET /files ──────────────────────────────────────────────────────────────
  fastify.get("/files", { preHandler: panelAuth, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const filter = request.affiliate.role === "admin"
      ? {}
      : { affiliateId: request.affiliate.sub };

    const configs = await Config.find(filter).select("_id name build").lean();
    const results = await Promise.all(
      configs.map(async (c) => ({
        configId: c._id,
        name: c.name,
        build: c.build,
        files: await listBuilds(c._id.toString()),
      }))
    );
    return reply.send({ configs: results });
  });

  // ── GET /files/:configId/:file ──────────────────────────────────────────────
  fastify.get("/files/:configId/:file", { preHandler: panelAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { configId } = request.params;

    // Validate configId is a MongoDB ObjectId (24 hex chars) before using in file path
    if (!/^[a-f0-9]{24}$/i.test(configId)) {
      return reply.code(400).send({ error: "Invalid config ID" });
    }

    // Sanitise filename: strip any directory components and allow only bundle.*.js
    const file = basename(request.params.file);
    if (!/^bundle\.\d+\.js$/.test(file)) {
      return reply.code(400).send({ error: "Invalid file name" });
    }

    const doc = await ownedConfig(configId, request.affiliate.sub, request.affiliate.role);
    if (!doc) return reply.code(404).send({ error: "Config not found" });

    // Resolve to absolute path and ensure it is within the expected output directory
    const baseDir = resolve(envConfig.BUILD_OUTPUT_DIR);
    const outDir = resolve(baseDir, configId);
    const filePath = resolve(outDir, file);

    // Double-check containment (guards against symlink attacks)
    if (!filePath.startsWith(outDir + pathSep) && filePath !== outDir) {
      return reply.code(400).send({ error: "Invalid file path" });
    }

    try {
      await stat(filePath);
    } catch {
      return reply.code(404).send({ error: "File not found" });
    }

    reply.header("Content-Type", "application/javascript");
    if (doc.build?.integrityHash) {
      reply.header("X-Bundle-Integrity", doc.build.integrityHash);
    }
    return reply.send(createReadStream(filePath));
  });

  // ── GET /stats ──────────────────────────────────────────────────────────────
  fastify.get("/stats", { preHandler: panelAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const isAdmin = request.affiliate.role === "admin";
    const affiliateId = request.affiliate.sub;

    const userFilter = isAdmin ? {} : { affiliateId };
    const [totalUsers, totalTx, totalSessions, activeSessions, totalConfigs] = await Promise.all([
      User.countDocuments(userFilter),
      Transaction.countDocuments(),
      Session.countDocuments(),
      Session.countDocuments({
        status: "active",
        expiresAt: { $gt: Math.floor(Date.now() / 1000) },
      }),
      Config.countDocuments(isAdmin ? {} : { affiliateId }),
    ]);

    return reply.send({
      users: totalUsers,
      transactions: totalTx,
      sessions: { total: totalSessions, active: activeSessions },
      configs: totalConfigs,
    });
  });

  // ── GET /stats/affiliates (admin only) ─────────────────────────────────────
  fastify.get("/stats/affiliates", { preHandler: [panelAuth, adminOnly], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (_req, reply) => {
    const affiliates = await Affiliate.find({ isActive: true })
      .select("name email role stats createdAt")
      .lean();
    return reply.send({ affiliates, total: affiliates.length });
  });
}
