/**
 * On-chain event indexer — listens to SessionManager events on all configured
 * chains and syncs them to MongoDB, then fires Telegram alerts.
 *
 * Configure chains via the RPC_URLS environment variable:
 *   RPC_URLS=1:https://eth.llamarpc.com,137:https://polygon.llamarpc.com
 */

import { ethers } from 'ethers';
import { CONTRACTS, parseRpcUrls } from './config.js';
import { Session } from './models/Session.js';
import { alertSessionCreated, alertSessionRevoked } from './telegram.js';

// ─── SessionManager ABI (events only) ────────────────────────────────────────

const SESSION_MANAGER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: 'sessionKey', type: 'address' },
      { indexed: true,  name: 'owner',      type: 'address' },
      { indexed: false, name: 'expiresAt',  type: 'uint256' },
    ],
    name: 'SessionCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'sessionKey', type: 'address' },
      { indexed: true, name: 'owner',      type: 'address' },
    ],
    name: 'SessionRevoked',
    type: 'event',
  },
];

// ─── Active listeners (for graceful shutdown) ─────────────────────────────────

const _providers = [];

// ─── Start Indexer ────────────────────────────────────────────────────────────

/**
 * Start listening to SessionManager events on every configured chain.
 * Automatically reconnects on provider errors.
 *
 * @returns {Promise<void>}
 */
export async function startIndexer() {
  const rpcUrls = parseRpcUrls();

  if (rpcUrls.size === 0) {
    console.warn('[indexer] No RPC_URLS configured — indexer will not start');
    return;
  }

  for (const [chainId, rpcUrl] of rpcUrls) {
    _startChainListener(chainId, rpcUrl);
  }
}

function _startChainListener(chainId, rpcUrl) {
  let provider;

  function init() {
    try {
      provider = new ethers.JsonRpcProvider(rpcUrl);
      _providers.push(provider);

      const contract = new ethers.Contract(
        CONTRACTS.SessionManager,
        SESSION_MANAGER_ABI,
        provider,
      );

      contract.on('SessionCreated', async (sessionKey, owner, expiresAt) => {
        try {
          await Session.findOneAndUpdate(
            { sessionKey },
            {
              sessionKey,
              owner,
              expiresAt:  Number(expiresAt),
              chainId,
              onChain:    true,
              status:     'active',
            },
            { upsert: true, new: true },
          );
          console.log(`[indexer] SessionCreated chain=${chainId} key=${sessionKey}`);
          await alertSessionCreated({ sessionKey, owner, expiresAt: Number(expiresAt), chainId });
        } catch (err) {
          console.error('[indexer] SessionCreated handler error:', err.message);
        }
      });

      contract.on('SessionRevoked', async (sessionKey, owner) => {
        try {
          await Session.findOneAndUpdate(
            { sessionKey },
            { status: 'revoked' },
          );
          console.log(`[indexer] SessionRevoked chain=${chainId} key=${sessionKey}`);
          await alertSessionRevoked({ sessionKey, owner });
        } catch (err) {
          console.error('[indexer] SessionRevoked handler error:', err.message);
        }
      });

      provider.on('error', (err) => {
        console.error(`[indexer] Provider error chain=${chainId}:`, err.message);
        // Remove the broken provider and reconnect after 10 seconds
        const idx = _providers.indexOf(provider);
        if (idx >= 0) _providers.splice(idx, 1);
        setTimeout(() => _startChainListener(chainId, rpcUrl), 10_000);
      });

      console.log(`[indexer] Listening on chain=${chainId} rpc=${rpcUrl}`);
    } catch (err) {
      console.error(`[indexer] Failed to start chain=${chainId}:`, err.message);
      setTimeout(() => _startChainListener(chainId, rpcUrl), 10_000);
    }
  }

  init();
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

/**
 * Stop all chain listeners. Called on SIGTERM / SIGINT.
 */
export async function stopIndexer() {
  for (const provider of _providers) {
    try {
      provider.removeAllListeners();
      await provider.destroy();
    } catch {
      // ignore
    }
  }
  _providers.length = 0;
  console.log('[indexer] Stopped');
}
