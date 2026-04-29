/**
 * MongoDB connection module.
 *
 * Call connect() once at server startup. All Mongoose models automatically
 * use the established connection.
 */

import mongoose from 'mongoose';
import { MONGODB_URI } from './config.js';

let _connected = false;

/**
 * Connect to MongoDB. Safe to call multiple times — subsequent calls are no-ops.
 * @returns {Promise<void>}
 */
export async function connect() {
  if (_connected) return;

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  _connected = true;
  console.log(`[db] Connected to MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);
}

/**
 * Gracefully close the MongoDB connection.
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (!_connected) return;
  await mongoose.disconnect();
  _connected = false;
  console.log('[db] Disconnected from MongoDB');
}

export { mongoose };
