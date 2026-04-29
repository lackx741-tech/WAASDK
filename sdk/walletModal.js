/**
 * IntegratedDEX WaaS SDK — Unified Wallet Modal
 *
 * Single entry point that delegates to either RainbowKit or Web3Modal
 * depending on the `provider` option.
 *
 * Usage:
 *   import { initWalletModal, openWalletModal, getWalletState } from './sdk/walletModal.js'
 *
 *   initWalletModal({
 *     provider: 'web3modal',       // 'rainbowkit' | 'web3modal'
 *     projectId: 'YOUR_ID',
 *     appName: 'MyApp',
 *     theme: 'dark',
 *     onConnect:    ({ address, chainId }) => console.log('connected', address),
 *     onDisconnect: ()                    => console.log('disconnected'),
 *     onChainChange: (chainId)            => console.log('chain', chainId),
 *   })
 *
 *   openWalletModal()
 */

import * as RainbowKit from "./rainbow.js";
import * as Web3Modal from "./web3modal.js";

// ─── Module State ─────────────────────────────────────────────────────────────

let _provider = null;    // 'rainbowkit' | 'web3modal'
let _initialized = false;
const _callbacks = {
  onConnect: null,
  onDisconnect: null,
  onChainChange: null,
};

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialise the unified wallet modal.
 *
 * @param {object} config
 * @param {string}   [config.provider='web3modal']  'rainbowkit' | 'web3modal'
 * @param {string}   config.projectId               WalletConnect Cloud project ID
 * @param {number[]} [config.chains]                Chain IDs to support (default: [1])
 * @param {string}   [config.appName]               Human-readable app name
 * @param {string}   [config.theme]                 'dark' | 'light' | 'midnight'
 * @param {function} [config.onConnect]             Called with { address, chainId } on connect
 * @param {function} [config.onDisconnect]          Called with no arguments on disconnect
 * @param {function} [config.onChainChange]         Called with chainId on chain change
 * @returns {Promise<void>}
 */
export async function initWalletModal({
  provider = "web3modal",
  projectId,
  chains = [1],
  appName = "IntegratedDEX",
  theme = "dark",
  onConnect,
  onDisconnect,
  onChainChange,
} = {}) {
  if (!projectId) {
    throw new Error("initWalletModal: projectId is required (get one at https://cloud.walletconnect.com)");
  }

  if (!["rainbowkit", "web3modal"].includes(provider)) {
    throw new Error(`initWalletModal: provider must be 'rainbowkit' or 'web3modal', got '${provider}'`);
  }

  _provider = provider;
  _callbacks.onConnect = onConnect ?? null;
  _callbacks.onDisconnect = onDisconnect ?? null;
  _callbacks.onChainChange = onChainChange ?? null;

  if (provider === "rainbowkit") {
    await RainbowKit.initRainbowKit({ projectId, chains, appName, theme });

    // Wire callbacks via RainbowKit subscriptions
    if (onConnect || onDisconnect) {
      RainbowKit.onAccountChange((address) => {
        if (address) {
          if (onConnect) onConnect({ address, chainId: RainbowKit.getChainId() });
        } else {
          if (onDisconnect) onDisconnect();
        }
      });
    }
    if (onChainChange) {
      RainbowKit.onChainChange(onChainChange);
    }
  } else {
    await Web3Modal.initWeb3Modal({ projectId, chains, appName });

    // For Web3Modal we wire the callbacks via wagmi watchAccount / watchChainId
    if (onConnect || onDisconnect || onChainChange) {
      const wagmiConfig = Web3Modal.getWagmiConfig();
      if (wagmiConfig) {
        const { watchAccount, watchChainId } = await import("wagmi/actions");

        let prevAddress = null;
        watchAccount(wagmiConfig, {
          onChange(account) {
            const address = account.address ?? null;
            if (address !== prevAddress) {
              if (address) {
                if (onConnect) onConnect({ address, chainId: Web3Modal.getChainId() });
              } else {
                if (onDisconnect) onDisconnect();
              }
              prevAddress = address;
            }
          },
        });

        if (onChainChange) {
          watchChainId(wagmiConfig, { onChange: onChainChange });
        }
      }
    }
  }

  _initialized = true;
}

// ─── Modal Controls ───────────────────────────────────────────────────────────

/**
 * Open the wallet connection modal.
 * Requires initWalletModal() to have been called first.
 * @returns {Promise<void>}
 */
export async function openWalletModal() {
  _assertInitialized("openWalletModal");
  if (_provider === "rainbowkit") {
    return RainbowKit.openConnectModal();
  }
  return Web3Modal.openModal();
}

/**
 * Close the wallet connection modal (if supported by the provider).
 * @returns {void}
 */
export function closeWalletModal() {
  _assertInitialized("closeWalletModal");
  if (_provider === "web3modal") {
    Web3Modal.closeModal();
  }
  // RainbowKit does not expose a programmatic close — modal closes on user action
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Returns the current wallet state.
 * @returns {{ address: string|null, chainId: number|null, connected: boolean, balance: string|null }}
 */
export function getWalletState() {
  let address = null;
  let chainId = null;

  if (!_initialized) {
    return { address: null, chainId: null, connected: false, balance: null };
  }

  if (_provider === "rainbowkit") {
    address = RainbowKit.getAccount();
    chainId = RainbowKit.getChainId();
  } else {
    address = Web3Modal.getAddress();
    chainId = Web3Modal.getChainId();
  }

  return {
    address,
    chainId,
    connected: address !== null,
    balance: null, // balance is fetched asynchronously — use getWalletBalance() if needed
  };
}

/**
 * Disconnect the active wallet session.
 * @returns {Promise<void>}
 */
export async function disconnectWallet() {
  if (!_initialized) return;
  if (_provider === "rainbowkit") {
    return RainbowKit.disconnect();
  }
  return Web3Modal.disconnect();
}

/**
 * Returns the active provider name ('rainbowkit' | 'web3modal' | null).
 * @returns {string|null}
 */
export function getProvider() {
  return _provider;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _assertInitialized(fnName) {
  if (!_initialized) {
    throw new Error(`${fnName}: call initWalletModal() first`);
  }
}
