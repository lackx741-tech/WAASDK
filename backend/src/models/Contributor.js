/**
 * WAASDK Backend — Contributor Model
 */

import mongoose from "mongoose";

const ContributorSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, unique: true, index: true, lowercase: true },
    totalContributed: { type: String, default: "0" },
    contributionCount: { type: Number, default: 0 },
    lastContributedAt: { type: Date },
    claimed: { type: Boolean, default: false },
    refunded: { type: Boolean, default: false },
    chainId: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("Contributor", ContributorSchema);
