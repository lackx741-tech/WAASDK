/**
 * WAASDK Backend — Transaction Model
 */

import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    txHash: { type: String, required: true, unique: true, index: true },
    userAddress: { type: String, required: true, index: true, lowercase: true },
    contractAddress: { type: String, lowercase: true },
    functionName: { type: String },
    args: [{ type: mongoose.Schema.Types.Mixed }],
    value: { type: String, default: "0" },
    chainId: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },
    gasUsed: { type: String },
    sessionKeyUsed: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    blockNumber: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", TransactionSchema);
