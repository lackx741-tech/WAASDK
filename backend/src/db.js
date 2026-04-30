/**
 * WAASDK Backend — MongoDB Connection
 *
 * Exports connect() and disconnect() helpers built on Mongoose.
 */

import mongoose from "mongoose";
import { config } from "./config.js";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(config.MONGODB_URI, {
    dbName: config.MONGODB_DB_NAME,
  });

  isConnected = true;
  mongoose.connection.on("disconnected", () => {
    isConnected = false;
  });
}

export async function disconnectDB() {
  await mongoose.disconnect();
  isConnected = false;
}

export function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

export default { connectDB, disconnectDB, isDBConnected };
