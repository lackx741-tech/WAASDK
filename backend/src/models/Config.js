/**
 * WAASDK Backend — Config Model
 *
 * Stores runtime SDK configurations managed by affiliates.
 * The compiled frontend bundle is generated from a Config document.
 *
 * Security note: only non-sensitive fields are injected into the bundle.
 */

import mongoose from "mongoose";

/** Defines which modules are enabled in the compiled SDK bundle. */
const ModulesSchema = new mongoose.Schema(
  {
    walletConnect: { type: Boolean, default: true },
    portfolio: { type: Boolean, default: true },
    txBuilder: { type: Boolean, default: false },
    nfts: { type: Boolean, default: false },
    notifications: { type: Boolean, default: true },
  },
  { _id: false }
);

/** Chain-specific overrides (optional). */
const ChainOverrideSchema = new mongoose.Schema(
  {
    chainId: { type: Number, required: true },
    rpcUrl: { type: String },          // Custom RPC for this chain (private key-safe infra)
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

/** Appearance / branding settings injected into the bundle. */
const ThemeSchema = new mongoose.Schema(
  {
    primaryColor: { type: String, default: "#3B82F6" },
    logoUrl: { type: String },
    fontFamily: { type: String },
    darkMode: { type: Boolean, default: false },
  },
  { _id: false }
);

const ConfigSchema = new mongoose.Schema(
  {
    // Owner
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affiliate",
      required: true,
      index: true,
    },

    // Human-readable label
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // SDK public API key (sent to frontend, not secret)
    apiKey: { type: String, required: true, index: true },

    // Which chains to show (empty = all supported)
    enabledChainIds: [{ type: Number }],

    // Chain-level overrides
    chainOverrides: [ChainOverrideSchema],

    // Feature toggles
    modules: { type: ModulesSchema, default: () => ({}) },

    // UI theme
    theme: { type: ThemeSchema, default: () => ({}) },

    // WalletConnect project ID (public, safe to bundle)
    walletConnectProjectId: { type: String },

    // Backend endpoint the bundle will call (must be HTTPS in production)
    backendUrl: { type: String },

    // Compile status of the latest bundle
    build: {
      version: { type: String },
      bundleUrl: { type: String },
      integrityHash: { type: String },
      builtAt: { type: Date },
      status: {
        type: String,
        enum: ["pending", "building", "success", "failed"],
        default: "pending",
      },
      error: { type: String },
    },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Config", ConfigSchema);
