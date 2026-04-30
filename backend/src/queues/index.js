/**
 * WAASDK Backend — BullMQ Queue Topology
 *
 * Defines all queues, their default job options, and a shared Redis connection.
 * Import the named queue instances wherever you need to add jobs.
 *
 * Queue layout:
 *  - notifications       — Telegram / email / webhook dispatch
 *  - portfolio-refresh   — Periodic and triggered wallet scans
 *  - transaction-status  — Poll RPC for pending tx confirmation
 *  - analytics           — Aggregate stats updates (write-behind)
 */

import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import { config } from "../config.js";

// ─── Shared Redis connection (BullMQ requires maxRetriesPerRequest: null) ─────

let _connection = null;

export function getQueueConnection() {
  if (!_connection) {
    _connection = new Redis(config.REDIS_URL, {
      password: config.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _connection;
}

// ─── Shared job options ───────────────────────────────────────────────────────

const SHARED_DEFAULTS = {
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

// ─── Queue definitions ────────────────────────────────────────────────────────

/**
 * Notification queue.
 * Job data shape: { channel, event, payload }
 *   channel: "telegram" | "email" | "webhook"
 *   event:   see AuditLog event enum
 *   payload: channel-specific body
 */
export const notificationQueue = new Queue("notifications", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...SHARED_DEFAULTS,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    priority: 1,
  },
});

/**
 * Portfolio refresh queue.
 * Job data shape: { walletAddress, chainIds?, triggeredBy }
 */
export const portfolioRefreshQueue = new Queue("portfolio-refresh", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...SHARED_DEFAULTS,
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    priority: 5,
  },
});

/**
 * Transaction status queue.
 * Job data shape: { txHash, chainId, userAddress, attempt? }
 */
export const transactionStatusQueue = new Queue("transaction-status", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...SHARED_DEFAULTS,
    attempts: 10,
    backoff: { type: "exponential", delay: 3000 },
    delay: 5000,   // First check 5 s after submission
    priority: 2,
  },
});

/**
 * Analytics aggregate queue.
 * Job data shape: { type: "affiliate_stats" | "daily_summary", affiliateId? }
 */
export const analyticsQueue = new Queue("analytics", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...SHARED_DEFAULTS,
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    priority: 10,  // Low priority
  },
});

// ─── Queue events (for monitoring / logging) ──────────────────────────────────

export const queueEvents = {
  notifications: new QueueEvents("notifications", { connection: getQueueConnection() }),
  portfolioRefresh: new QueueEvents("portfolio-refresh", { connection: getQueueConnection() }),
  transactionStatus: new QueueEvents("transaction-status", { connection: getQueueConnection() }),
  analytics: new QueueEvents("analytics", { connection: getQueueConnection() }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Enqueue a notification.
 * @param {"telegram"|"email"|"webhook"} channel
 * @param {string} event
 * @param {object} payload
 */
export async function enqueueNotification(channel, event, payload) {
  return notificationQueue.add(`${channel}:${event}`, { channel, event, payload });
}

/**
 * Enqueue a portfolio refresh for a wallet.
 * @param {string} walletAddress
 * @param {number[]} [chainIds]
 * @param {string} [triggeredBy]
 */
export async function enqueuePortfolioRefresh(
  walletAddress,
  chainIds,
  triggeredBy = "manual"
) {
  return portfolioRefreshQueue.add(
    `scan:${walletAddress}`,
    { walletAddress, chainIds, triggeredBy },
    { jobId: `scan:${walletAddress}:${Date.now()}` }
  );
}

/**
 * Enqueue a transaction status poll.
 * @param {string} txHash
 * @param {number} chainId
 * @param {string} userAddress
 */
export async function enqueueTransactionStatus(txHash, chainId, userAddress) {
  return transactionStatusQueue.add(
    `status:${txHash}`,
    { txHash, chainId, userAddress },
    { jobId: `status:${txHash}` }
  );
}

/**
 * Enqueue an analytics aggregate job.
 * @param {"affiliate_stats"|"daily_summary"} type
 * @param {string} [affiliateId]
 */
export async function enqueueAnalytics(type, affiliateId) {
  return analyticsQueue.add(type, { type, affiliateId });
}

/**
 * Gracefully close all queues (call on server shutdown).
 */
export async function closeQueues() {
  await Promise.allSettled([
    notificationQueue.close(),
    portfolioRefreshQueue.close(),
    transactionStatusQueue.close(),
    analyticsQueue.close(),
  ]);
  if (_connection) {
    await _connection.quit().catch(() => {});
    _connection = null;
  }
}
