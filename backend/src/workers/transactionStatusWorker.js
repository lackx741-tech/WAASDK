/**
 * WAASDK Backend — Transaction Status Worker
 *
 * Polls the appropriate RPC node to track the confirmation status of pending
 * transactions submitted by users.  Once confirmed (or permanently failed),
 * the Transaction document is updated and a notification is enqueued.
 */

import { Worker } from "bullmq";
import { getQueueConnection, enqueueNotification } from "../queues/index.js";
import { getPrimaryRpc } from "../chainNames.js";
import Transaction from "../models/Transaction.js";

const MAX_POLL_ATTEMPTS = 12;   // ~1 minute total with exponential back-off

export function createTransactionStatusWorker(concurrency = 5) {
  const worker = new Worker(
    "transaction-status",
    async (job) => {
      const { txHash, chainId, userAddress } = job.data;
      const attempt = (job.data.attempt ?? 0) + 1;

      job.log(`Checking tx ${txHash} on chain ${chainId} (attempt ${attempt})`);

      let receipt;
      try {
        const { ethers } = await import("ethers");
        const rpcUrl = getPrimaryRpc(chainId);
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        receipt = await provider.getTransactionReceipt(txHash);
      } catch (err) {
        job.log(`RPC call failed: ${err.message}`);
        throw err; // BullMQ will retry
      }

      if (!receipt) {
        // Transaction still pending
        if (attempt >= MAX_POLL_ATTEMPTS) {
          await Transaction.findOneAndUpdate(
            { txHash },
            { status: "failed" }
          );
          await enqueueNotification("telegram", "tx.failed", {
            txHash,
            error: { message: "Transaction timed out — not mined after max polls" },
          }).catch(() => {});
        } else {
          throw new Error("Transaction not yet mined — retrying");
        }
        return;
      }

      const status = receipt.status === 1 ? "success" : "failed";
      const gasUsed = receipt.gasUsed?.toString();
      const blockNumber = receipt.blockNumber;

      await Transaction.findOneAndUpdate(
        { txHash },
        { status, gasUsed, blockNumber }
      );

      if (status === "success") {
        await enqueueNotification("telegram", "tx.confirmed", {
          txHash,
          blockNumber,
          gasUsed,
        }).catch(() => {});
      } else {
        await enqueueNotification("telegram", "tx.failed", {
          txHash,
          error: { message: "Transaction reverted on-chain" },
        }).catch(() => {});
      }

      job.log(`Transaction ${txHash} → ${status} (block ${blockNumber})`);
      return { txHash, status, blockNumber };
    },
    {
      connection: getQueueConnection(),
      concurrency,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[tx-status-worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
