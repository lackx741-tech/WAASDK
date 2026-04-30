/**
 * WAASDK Backend — AuditLog Model
 *
 * Immutable append-only log of security and operational events.
 * Used for compliance, debugging, and incident response.
 */

import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    actor: {
      type: { type: String, enum: ["affiliate", "system", "wallet", "api_key"] },
      id: { type: String },          // affiliateId, wallet address, or "system"
    },

    // What happened
    event: {
      type: String,
      required: true,
      index: true,
      enum: [
        // Auth
        "auth.login",
        "auth.logout",
        "auth.login_failed",
        "auth.token_refresh",
        // Config
        "config.created",
        "config.updated",
        "config.deleted",
        // Compile
        "compile.started",
        "compile.success",
        "compile.failed",
        // Wallet
        "wallet.connected",
        "wallet.disconnected",
        // Portfolio
        "portfolio.scanned",
        // Transaction
        "tx.built",
        "tx.submitted",
        "tx.confirmed",
        "tx.failed",
        // Session
        "session.created",
        "session.revoked",
        "session.expired",
        // System
        "system.startup",
        "system.shutdown",
        "system.error",
      ],
    },

    // Resource affected
    resource: {
      type: { type: String },        // e.g. "Config", "Session", "Transaction"
      id: { type: String },
    },

    // Arbitrary metadata (chain ID, contract address, etc.)
    metadata: { type: mongoose.Schema.Types.Mixed },

    // Request context
    requestId: { type: String, index: true },
    ipHash: { type: String },        // SHA-256 of IP

    // Outcome
    success: { type: Boolean, default: true },
    errorMessage: { type: String },

    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    // No `timestamps` — we use our own `timestamp` field for precision
    versionKey: false,
  }
);

// TTL: keep audit logs for 1 year
AuditLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

// Compound index for filtered queries (actor, event)
AuditLogSchema.index({ "actor.id": 1, event: 1, timestamp: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);
