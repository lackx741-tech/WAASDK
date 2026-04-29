/**
 * WAASDK Backend — Session Model
 */

import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userAddress: { type: String, required: true, index: true, lowercase: true },
    sessionKey: { type: String, required: true },
    allowedContracts: [{ type: String }],
    allowedFunctions: [{ type: String }],
    spendingLimit: { type: String, default: "0" },
    spendingLimitToken: { type: String, default: "ETH" },
    expiresAt: { type: Number, required: true },
    chainId: { type: Number, required: true },
    signature: { type: String },
    txHash: { type: String },
    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      index: true,
    },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-expire sessions based on expiresAt
SessionSchema.methods.isExpired = function () {
  return Date.now() / 1000 > this.expiresAt;
};

export default mongoose.model("Session", SessionSchema);
