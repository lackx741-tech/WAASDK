/**
 * WAASDK Backend — Notification Worker
 *
 * Consumes jobs from the "notifications" queue and dispatches them via:
 *  - telegram  (using the existing telegram.js module)
 *  - webhook   (HTTP POST to affiliate-configured URL)
 *  - email     (placeholder — swap in nodemailer / SES)
 *
 * Start this worker as a separate process or as part of the main server.
 */

import { Worker } from "bullmq";
import { getQueueConnection } from "../queues/index.js";
import {
  alertWalletConnected,
  alertSessionCreated,
  alertSessionRevoked,
  alertTransactionSent,
  alertTransactionConfirmed,
  alertTransactionFailed,
  alertContribution,
  alertError,
} from "../telegram.js";

// ─── Telegram dispatcher ─────────────────────────────────────────────────────

const telegramHandlers = {
  "wallet.connected": alertWalletConnected,
  "session.created": alertSessionCreated,
  "session.revoked": alertSessionRevoked,
  "tx.submitted": alertTransactionSent,
  "tx.confirmed": alertTransactionConfirmed,
  "tx.failed": alertTransactionFailed,
  "presale.contribution": alertContribution,
  "system.error": alertError,
};

async function dispatchTelegram(event, payload) {
  const handler = telegramHandlers[event];
  if (handler) {
    await handler(payload);
  }
}

// ─── Webhook dispatcher ──────────────────────────────────────────────────────

async function dispatchWebhook(event, payload) {
  const { url, secret } = payload;
  if (!url) return;

  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() });
  const headers = {
    "Content-Type": "application/json",
    "X-WAASDK-Event": event,
  };
  if (secret) {
    headers["X-WAASDK-Signature"] = secret; // In production: HMAC-SHA256
  }

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    throw new Error(`Webhook POST to ${url} returned ${res.status}`);
  }
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export function createNotificationWorker(concurrency = 5) {
  const worker = new Worker(
    "notifications",
    async (job) => {
      const { channel, event, payload } = job.data;

      switch (channel) {
        case "telegram":
          await dispatchTelegram(event, payload);
          break;
        case "webhook":
          await dispatchWebhook(event, payload);
          break;
        case "email":
          // TODO: integrate nodemailer / AWS SES
          console.warn("[notification-worker] email channel not yet implemented");
          break;
        default:
          throw new Error(`Unknown notification channel: ${channel}`);
      }
    },
    {
      connection: getQueueConnection(),
      concurrency,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[notification-worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
