/**
 * WAASDK Backend — Project Model
 * 
 * Each project represents a dApp that uses the WaaS infrastructure.
 * Projects have their own API keys, chain configs, and usage tracking.
 */

import mongoose from "mongoose";
import crypto from "crypto";

const ApiKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "Default" },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    description: { type: String, default: "" },
    chains: [{ type: Number }],
    apiKeys: [ApiKeySchema],
    contracts: [
      {
        name: { type: String },
        address: { type: String, required: true },
        chainId: { type: Number, required: true },
        abi: { type: mongoose.Schema.Types.Mixed },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    settings: {
      gasSponsorship: { type: Boolean, default: false },
      sessionKeys: { type: Boolean, default: true },
      webhookUrl: { type: String, default: "" },
      allowedOrigins: [{ type: String }],
    },
    usage: {
      transactions: { type: Number, default: 0 },
      sponsoredGas: { type: String, default: "0" },
      sessions: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Generate a new API key
ProjectSchema.methods.generateApiKey = function (name = "Default") {
  const key = "wsk_" + crypto.randomBytes(24).toString("hex");
  this.apiKeys.push({ key, name });
  return key;
};

// Static: find project by API key
ProjectSchema.statics.findByApiKey = async function (key) {
  return this.findOne({ "apiKeys.key": key, "apiKeys.isActive": true, isActive: true });
};

export default mongoose.model("Project", ProjectSchema);
