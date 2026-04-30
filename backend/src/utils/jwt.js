/**
 * WAASDK Backend — JWT Auth Utility
 *
 * Issue, verify, and refresh JWTs for the affiliate panel.
 * Access tokens are short-lived; refresh tokens are rotated on each use.
 */

import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { config } from "../config.js";

// ─── Token generation ─────────────────────────────────────────────────────────

/**
 * Issue an access token for an affiliate.
 * @param {{ id: string, role: string, email: string }} payload
 * @returns {string}
 */
export function issueAccessToken(payload) {
  return jwt.sign(
    { sub: payload.id, role: payload.role, email: payload.email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

/**
 * Issue a refresh token (opaque random string).
 * @returns {{ token: string, hash: string, expiresAt: Date }}
 */
export function issueRefreshToken() {
  const token = randomBytes(40).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    Date.now() + parseDuration(config.JWT_REFRESH_EXPIRES_IN)
  );
  return { token, hash, expiresAt };
}

/**
 * Verify an access token.
 * @param {string} token
 * @returns {{ sub: string, role: string, email: string }}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

// ─── Duration parser ──────────────────────────────────────────────────────────

function parseDuration(str) {
  const match = String(str).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, n, unit] = match;
  const ms = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 };
  return parseInt(n, 10) * ms[unit];
}
