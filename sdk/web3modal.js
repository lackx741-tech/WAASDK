/**
 * IntegratedDEX WaaS SDK — Web3Modal / AppKit Integration Module
 *
 * A dedicated, tree-shakeable wrapper around @web3modal/wagmi that exposes
 * a flat, promise-based API for wallet connection, signing, and chain switching.
 *
 * Supported chains: Ethereum (1), BSC (56), Polygon (137), Avalanche (43114),
 *                   Arbitrum (42161), Optimism (10), Base (8453)
 *
 * Usage:
 *   import { initWeb3Modal, openModal, getAddress } from './sdk/web3modal.js'
 *   initWeb3Modal({ projectId: 'YOUR_ID', appName: 'MyApp' })
 *   document.getElementById('btn').onclick = () => openModal()
 */

import { SUPPORTED_CHAINS } from "./utils.js";

// ─── Module State ─────────────────────────────────────────────────────────────

const _web3State = {
  initialized: false,
  wagmiConfig: null,
  modal: null,
};

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialise Web3Modal (AppKit) with the provided config.
 *
 * @param {object} config
 * @param {string}   config.projectId  WalletConnect Cloud project ID
 * @param {number[]} [config.chains]   Chain IDs to support (default: [1])
 * @param {string}   [config.appName]  Human-readable app name
 * @returns {Promise<void>}
 */
export async function initWeb3Modal({ projectId, chains = [1], appName = "IntegratedDEX" } = {}) {
  if (!projectId) {
    throw new Error("initWeb3Modal: projectId is required (get one at https://cloud.walletconnect.com)");
  }

  if (_web3State.initialized) return;

  // Map chain IDs to wagmi-compatible chain objects
  const chainObjects = chains.map((id) => {
    const info = SUPPORTED_CHAINS[id];
    if (!info) throw new Error(`initWeb3Modal: unsupported chain ID ${id}`);
    return info;
  });

  let createWeb3Modal, defaultWagmiConfig, reconnect;
  try {
    ({ createWeb3Modal, defaultWagmiConfig, reconnect } = await import("@web3modal/wagmi"));
  } catch {
    throw new Error(
      "initWeb3Modal: @web3modal/wagmi is not installed. Run: npm install @web3modal/wagmi wagmi viem"
    );
  }

  const wagmiConfig = defaultWagmiConfig({
    chains: chainObjects,
    projectId,
    metadata: {
      name: appName,
      description: "",
      url: typeof window !== "undefined" ? window.location.origin : "",
      icons: [],
    },
  });

  _web3State.wagmiConfig = wagmiConfig;

  _web3State.modal = createWeb3Modal({
    wagmiConfig,
    projectId,
    enableAnalytics: false,
  });

  await reconnect(wagmiConfig);
  _web3State.initialized = true;
}

// ─── Modal Controls ───────────────────────────────────────────────────────────

/**
 * Open the Web3Modal connection dialog.
 * Requires initWeb3Modal() to have been called first.
 * @returns {Promise<void>}
 */
export async function openModal() {
  if (!_web3State.modal) {
    throw new Error("openModal: call initWeb3Modal() first");
  }
  await _web3State.modal.open();
}

/**
 * Close the Web3Modal dialog if it is open.
 * @returns {void}
 */
export function closeModal() {
  if (!_web3State.modal) return;
  _web3State.modal.close();
}

// ─── Account Helpers ──────────────────────────────────────────────────────────

/**
 * Get the currently connected wallet address (or null if not connected).
 * @returns {string|null}
 */
export function getAddress() {
  if (!_web3State.wagmiConfig) return null;
  try {
    // Use sync wagmi store access — no dynamic import needed at runtime
    const state = _web3State.wagmiConfig.state;
    return state?.connections?.values()?.next()?.value?.accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the currently active chain ID (or null if not connected).
 * @returns {number|null}
 */
export function getChainId() {
  if (!_web3State.wagmiConfig) return null;
  try {
    return _web3State.wagmiConfig.state?.chainId ?? null;
  } catch {
    return null;
  }
}

// ─── Signing ──────────────────────────────────────────────────────────────────

/**
 * Sign a plain-text message with the connected wallet.
 * The wallet always shows the exact message before the user signs.
 *
 * @param {string} message  Plain-text message to sign
 * @returns {Promise<string>}  0x-prefixed signature
 */
export async function signMessage(message) {
  if (!_web3State.wagmiConfig) {
    throw new Error("signMessage: call initWeb3Modal() first");
  }

  const { signMessage: wagmiSignMessage } = await import("wagmi/actions");
  return wagmiSignMessage(_web3State.wagmiConfig, { message });
}

// ─── Chain Switching ──────────────────────────────────────────────────────────

/**
 * Ask the user to switch to a different chain.
 * If the chain is not in their wallet, the wallet will prompt them to add it.
 *
 * @param {number} chainId  Target chain ID
 * @returns {Promise<void>}
 */
export async function switchChain(chainId) {
  if (!SUPPORTED_CHAINS[chainId]) {
    throw new Error(`switchChain: unsupported chain ID ${chainId}`);
  }

  if (!_web3State.wagmiConfig) {
    throw new Error("switchChain: call initWeb3Modal() first");
  }

  const { switchChain: wagmiSwitchChain } = await import("wagmi/actions");
  await wagmiSwitchChain(_web3State.wagmiConfig, { chainId });
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

/**
 * Disconnect the active wallet session.
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (!_web3State.wagmiConfig) return;

  const { disconnect: wagmiDisconnect } = await import("wagmi/actions");
  const { connectors } = _web3State.wagmiConfig;

  for (const connector of connectors) {
    try {
      await wagmiDisconnect(_web3State.wagmiConfig, { connector });
    } catch {
      // ignore individual connector errors
    }
  }
}

/**
 * Returns true if a wallet is currently connected.
 * @returns {boolean}
 */
export function isConnected() {
  return getAddress() !== null;
}

/**
 * Returns the underlying wagmi config (for advanced use).
 * @returns {object|null}
 */
export function getWagmiConfig() {
  return _web3State.wagmiConfig;
}

/**
 * Returns the underlying Web3Modal / AppKit instance (for advanced use).
 * @returns {object|null}
 */
export function getModal() {
  return _web3State.modal;
}
