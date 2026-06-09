/**
 * WAASDK Backend — Auth Routes (SaaS)
 *
 * POST /api/auth/register    Create new account
 * POST /api/auth/login       Login, get JWT
 * GET  /api/auth/me          Get current user (JWT required)
 * POST /api/auth/logout      Clear token
 */

import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { routeRateLimit } from "../middleware/rateLimit.js";

const JWT_SECRET = config.JWT_SECRET || "waassdk-jwt-secret-change-me";
const JWT_EXPIRES = "7d";

function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export default async function authRoutes(fastify) {
  // ── POST /api/auth/register ─────────────────────────────────────────────────
  fastify.post("/api/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { email, password, name } = request.body ?? {};

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return reply.code(409).send({ error: "Account already exists with this email" });
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      name: name || email.split("@")[0],
    });
    await user.save();

    const token = signToken(user);

    return reply.code(201).send({
      token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  });

  // ── POST /api/auth/login ────────────────────────────────────────────────────
  fastify.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { email, password } = request.body ?? {};

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);

    return reply.send({
      token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  fastify.get("/api/auth/me", { config: { rateLimit: routeRateLimit.default } }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "No token provided" });
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user || !user.isActive) {
        return reply.code(401).send({ error: "Account not found or inactive" });
      }
      return reply.send({ user: { id: user._id, email: user.email, name: user.name, role: user.role } });
    } catch {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }
  });
}
