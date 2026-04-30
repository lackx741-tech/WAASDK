/**
 * WAASDK Backend — PortfolioSnapshot Model
 *
 * Stores a point-in-time view of a wallet's holdings across chains.
 * Used for historical charting and analytics.
 *
 * Security note: only public on-chain data; no private keys.
 */

import mongoose from "mongoose";

const TokenHoldingSchema = new mongoose.Schema(
  {
    address: { type: String, lowercase: true },     // ERC-20 contract address; null = native
    symbol: { type: String },
    decimals: { type: Number },
    rawBalance: { type: String },                   // Wei / smallest unit (string to avoid precision loss)
    formattedBalance: { type: String },             // Human-readable (e.g. "1.23")
    priceUsd: { type: Number },
    valueUsd: { type: Number },
    logoUri: { type: String },
  },
  { _id: false }
);

const NftHoldingSchema = new mongoose.Schema(
  {
    contractAddress: { type: String, lowercase: true },
    tokenId: { type: String },
    name: { type: String },
    imageUri: { type: String },
    standard: { type: String, enum: ["ERC721", "ERC1155"] },
    quantity: { type: Number, default: 1 },
    floorPriceUsd: { type: Number },
  },
  { _id: false }
);

const ChainSnapshotSchema = new mongoose.Schema(
  {
    chainId: { type: Number, required: true },
    nativeBalance: { type: String },               // Raw wei string
    nativeBalanceUsd: { type: Number },
    tokens: [TokenHoldingSchema],
    nfts: [NftHoldingSchema],
    totalValueUsd: { type: Number, default: 0 },
    scannedAt: { type: Date, default: Date.now },
    rpcLatencyMs: { type: Number },
  },
  { _id: false }
);

const PortfolioSnapshotSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
    },
    // Compound index to fetch latest snapshot per wallet quickly
    capturedAt: { type: Date, default: Date.now, index: true },

    // Per-chain breakdown
    chains: [ChainSnapshotSchema],

    // Aggregated totals across all chains
    totalValueUsd: { type: Number, default: 0 },

    // Source of the scan
    triggeredBy: {
      type: String,
      enum: ["wallet_connect", "periodic_refresh", "manual", "webhook"],
      default: "wallet_connect",
    },
  },
  { timestamps: true }
);

// TTL index: automatically prune snapshots older than 90 days
PortfolioSnapshotSchema.index(
  { capturedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Compound index for efficient "latest per wallet" queries
PortfolioSnapshotSchema.index({ walletAddress: 1, capturedAt: -1 });

export default mongoose.model("PortfolioSnapshot", PortfolioSnapshotSchema);
