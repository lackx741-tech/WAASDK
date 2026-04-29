/**
 * Transaction model — logs every transaction sent through the SDK.
 */

import { mongoose } from '../db.js';

const { Schema, model } = mongoose;

const transactionSchema = new Schema(
  {
    txHash: {
      type:  String,
      index: true,
    },
    from: {
      type:  String,
      index: true,
    },
    to:    String,
    value: String,
    data:  String,
    chainId: Number,
    sessionKey: {
      type:  String,
      index: true,
    },
    type: {
      type: String,
      enum: ['session', 'permit2', 'erc2612', 'userop', 'batch', 'other'],
      default: 'other',
    },
    status: {
      type:    String,
      enum:    ['pending', 'confirmed', 'failed'],
      default: 'pending',
      index:   true,
    },
    blockNumber: Number,
    gasUsed:     String,
    meta:        Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const Transaction = model('Transaction', transactionSchema);
