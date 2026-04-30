/**
 * WAASDK Backend — User Model
 *
 * Represents a wallet owner who has interacted with the platform.
 * Never stores private keys or seed phrases.
 */

import mongoose from "mongoose";

const TokenSchema = new mongoose.Schema(
  {
    address: { type: String, lowercase: true },
    symbol: { type: String },
    decimals: { type: Number },
    balance: { type: String },        // raw wei / token unit string
    balanceUsd: { type: Number },
    logoUri: { type: String },
  },
  { _id: false }
);

const NftSchema = new mongoose.Schema(
  {
    contractAddress: { type: String, lowercase: true },
    tokenId: { type: String },
    name: { type: String },
    imageUri: { type: String },
    standard: { type: String, enum: ["ERC721", "ERC1155"] },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },
    // Last seen chain
    chainId: { type: Number, index: true },
    // Derived from affiliate campaign / referral
    affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: "Affiliate", index: true },
    referralCode: { type: String, index: true },

    // Activity tracking
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    connectCount: { type: Number, default: 1 },

    // Latest snapshot of portfolio (denormalised for quick dashboard reads)
    latestPortfolio: {
      nativeBalance: { type: String },           // wei string
      nativeBalanceUsd: { type: Number },
      tokens: [TokenSchema],
      nfts: [NftSchema],
      totalValueUsd: { type: Number, default: 0 },
      updatedAt: { type: Date },
    },

    // Device / session fingerprint hints (no PII)
    userAgent: { type: String },
    ipHash: { type: String },          // SHA-256 of IP — never the IP itself
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
