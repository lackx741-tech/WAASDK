/**
 * Session model — mirrors on-chain SessionManager sessions in MongoDB.
 *
 * Sessions are written when:
 *  - The frontend POSTs to /api/webhook/session
 *  - The on-chain indexer detects a SessionCreated event
 */

import { mongoose } from '../db.js';

const { Schema, model } = mongoose;

const sessionSchema = new Schema(
  {
    sessionKey: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    owner: {
      type:  String,
      required: true,
      index: true,
    },
    allowedContracts: [String],
    allowedFunctions: [String],
    spendingLimit: {
      type:    String,
      default: '0',
    },
    expiresAt: {
      type:     Number,
      required: true,
    },
    chainId: Number,
    txHash:  String,
    onChain: {
      type:    Boolean,
      default: false,
    },
    status: {
      type:    String,
      enum:    ['active', 'revoked', 'expired'],
      default: 'active',
      index:   true,
    },
    usageCount: {
      type:    Number,
      default: 0,
    },
    lastUsedAt: Number,
  },
  { timestamps: true },
);

// Mark sessions as expired automatically
sessionSchema.virtual('isExpired').get(function () {
  return this.expiresAt < Math.floor(Date.now() / 1000);
});

export const Session = model('Session', sessionSchema);
