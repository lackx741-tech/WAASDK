/**
 * WAASDK Backend — Affiliate Model
 *
 * Represents a partner / reseller account that manages SDK configurations
 * and views analytics for their own campaigns.
 */

import mongoose from "mongoose";

const AffiliateSchema = new mongoose.Schema(
  {
    // Human-readable display name
    name: { type: String, required: true, trim: true },

    // Login credential (email or username)
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    // bcrypt hash — NEVER stored in plaintext
    passwordHash: { type: String, required: true, select: false },

    // Short unique slug used in referral links (e.g. "partner42")
    referralCode: { type: String, unique: true, index: true },

    // Role-based access control
    role: {
      type: String,
      enum: ["affiliate", "admin"],
      default: "affiliate",
    },

    // Whether the account is active
    isActive: { type: Boolean, default: true, index: true },

    // Refresh token storage (rotated on each use)
    refreshTokenHash: { type: String, select: false },
    refreshTokenExpiresAt: { type: Date, select: false },

    // Aggregate campaign stats (updated asynchronously)
    stats: {
      walletConnects: { type: Number, default: 0 },
      transactions: { type: Number, default: 0 },
      activeUsers: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date },
    },

    // IP / device audit hints
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Affiliate", AffiliateSchema);
