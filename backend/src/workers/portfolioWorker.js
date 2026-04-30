/**
 * WAASDK Backend — Portfolio Refresh Worker
 *
 * Consumes jobs from the "portfolio-refresh" queue.
 * Calls the portfolio scanner service and persists results.
 */

import { Worker } from "bullmq";
import { getQueueConnection } from "../queues/index.js";
import { scanWalletPortfolio } from "../services/portfolioScanner.js";
import PortfolioSnapshot from "../models/PortfolioSnapshot.js";
import User from "../models/User.js";

export function createPortfolioWorker(concurrency = 3) {
  const worker = new Worker(
    "portfolio-refresh",
    async (job) => {
      const { walletAddress, chainIds, triggeredBy } = job.data;

      job.log(`Scanning portfolio for ${walletAddress}`);

      const result = await scanWalletPortfolio(walletAddress, chainIds);

      // Persist snapshot
      const snapshot = new PortfolioSnapshot({
        walletAddress,
        chains: result.chains,
        totalValueUsd: result.totalValueUsd,
        triggeredBy: triggeredBy ?? "manual",
      });
      await snapshot.save();

      // Update denormalised User.latestPortfolio (only if chains were scanned)
      if (result.chains.length > 0) {
        const latestChain = result.chains[0];
        await User.findOneAndUpdate(
          { walletAddress },
          {
            $set: {
              "latestPortfolio.nativeBalance": latestChain.nativeBalance ?? "0",
              "latestPortfolio.nativeBalanceUsd": latestChain.nativeBalanceUsd ?? null,
              "latestPortfolio.tokens": latestChain.tokens ?? [],
              "latestPortfolio.nfts": latestChain.nfts ?? [],
              "latestPortfolio.totalValueUsd": result.totalValueUsd,
              "latestPortfolio.updatedAt": new Date(),
              lastSeenAt: new Date(),
            },
          },
          { upsert: false }
        );
      }

      job.log(`Portfolio scan complete. Total: $${result.totalValueUsd}`);
      return { walletAddress, totalValueUsd: result.totalValueUsd };
    },
    {
      connection: getQueueConnection(),
      concurrency,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[portfolio-worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
