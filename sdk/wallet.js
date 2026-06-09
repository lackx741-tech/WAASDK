/**
 * IntegratedDEX WaaS SDK — Wallet Connection Module
 *
 * Provides Reown AppKit (formerly Web3Modal) integration with support for
 * Ethereum, BSC, Polygon, Avalanche, Arbitrum, Base, and Optimism.
 *
 * Emits events: connect, disconnect, chainChanged, accountsChanged
 */

import { SUPPORTED_CHAINS } from "./utils.js";

// ─── Event Emitter (tiny, no-dep) ─────────────────────────────────────────────

class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, listener) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter((l) => l !== listener);
    return this;
  }

  emit(event, ...args) {
    (this._listeners[event] ?? []).forEach((l) => l(...args));
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// ─── Chain ID → AppKit network object mapping ────────────────────────────────

const CHAIN_ID_TO_NETWORK_NAME = {
  1: "mainnet",
  56: "bsc",
  137: "polygon",
  43114: "avalanche",
  42161: "arbitrum",
  8453: "base",
  10: "optimism",
};

// ─── WaaS Wallet ─────────────────────────────────────────────────────────────

/**
 * WaaSWallet — manages wallet connection state and emits lifecycle events.
 *
 * Usage:
 *   const wallet = new WaaSWallet({ projectId: "…", chains: [1, 56] });
 *   await wallet.connect();
 *   wallet.on("connect", ({ account, chainId }) => { … });
 */
export class WaaSWallet extends EventEmitter {
  /**
   * @param {object} config
   * @param {string}   config.projectId     WalletConnect Cloud / Reown project ID
   * @param {number[]} config.chains         Supported chain IDs
   * @param {string}   [config.appName]      App name shown in wallet modals
   * @param {string}   [config.appDescription]
   * @param {string}   [config.appUrl]
   * @param {string}   [config.appIcon]
   */
  constructor(config) {
    super();

    if (!config?.projectId) {
      throw new Error("WaaSWallet: projectId is required (get one at https://cloud.reown.com)");
    }

    this.projectId = config.projectId;
    this.chains = config.chains ?? [1];
    this.appName = config.appName ?? "IntegratedDEX";
    this.appDescription = config.appDescription ?? "";
    this.appUrl = config.appUrl ?? "";
    this.appIcon = config.appIcon ?? "";

    /** @type {string|null} Currently connected account */
    this.account = null;
    /** @type {number|null} Currently active chain ID */
    this.chainId = null;
    /** @type {object|null} Raw EIP-1193 provider */
    this.provider = null;

    this._modal = null;
    this._wagmiAdapter = null;
    this._initialized = false;
    this._unsubscribeAccount = null;
    this._unsubscribeProviders = null;
  }

  // ─── Lazy Initialization ────────────────────────────────────────────────────

  /**
   * Lazily initialise Reown AppKit.
   * Called automatically by connect() — you normally don't need this directly.
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;

    let createAppKit, WagmiAdapter, networkModules;
    try {
      ({ createAppKit } = await import("@reown/appkit"));
      ({ WagmiAdapter } = await import("@reown/appkit-adapter-wagmi"));
      networkModules = await import("@reown/appkit/networks");
    } catch {
      throw new Error(
        "WaaSWallet: @reown/appkit is not installed. Run: npm install @reown/appkit @reown/appkit-adapter-wagmi"
      );
    }

    // Map chain IDs to AppKit network objects
    const networks = this.chains.map((id) => {
      const networkName = CHAIN_ID_TO_NETWORK_NAME[id];
      if (!networkName || !networkModules[networkName]) {
        throw new Error(`WaaSWallet: unsupported chain ID ${id}`);
      }
      return networkModules[networkName];
    });

    // Set up Wagmi adapter
    this._wagmiAdapter = new WagmiAdapter({
      projectId: this.projectId,
      networks,
    });

    const metadata = {
      name: this.appName,
      description: this.appDescription,
      url: this.appUrl || window.location.origin,
      icons: this.appIcon ? [this.appIcon] : [],
    };

    // Create the AppKit modal
    this._modal = createAppKit({
      adapters: [this._wagmiAdapter],
      networks,
      metadata,
      projectId: this.projectId,
      features: {
        analytics: false,
      },
    });

    // Subscribe to account changes
    this._unsubscribeAccount = this._modal.subscribeAccount((account) => {
      if (account.isConnected && account.address) {
        const newAddress = account.address;
        const wasConnected = this.account !== null;
        this.account = newAddress;

        if (!wasConnected) {
          // Fresh connection
          this._updateChainAndProvider();
          this.emit("connect", {
            account: this.account,
            chainId: this.chainId,
            provider: this.provider,
          });
        }
      } else if (this.account !== null) {
        // Disconnected
        this.account = null;
        this.chainId = null;
        this.provider = null;
        this.emit("disconnect");
      }
    });

    this._initialized = true;
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  /** @private */
  _updateChainAndProvider() {
    try {
      if (this._wagmiAdapter?.wagmiConfig) {
        const state = this._wagmiAdapter.wagmiConfig.state;
        if (state) {
          this.chainId = state.chainId ?? null;
        }
      }
    } catch {
      // non-fatal
    }
  }

  // ─── Connect ────────────────────────────────────────────────────────────────

  /**
   * Open the Reown AppKit connection dialog.
   * Resolves when the user connects or rejects when they close the modal.
   * @returns {Promise<{ account: string, chainId: number, provider: object }>}
   */
  async connect() {
    await this.init();

    // If already connected, return current state
    if (this.account) {
      return { account: this.account, chainId: this.chainId, provider: this.provider };
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      // Listen for connection via account subscription
      const onConnect = ({ account, chainId, provider }) => {
        if (!resolved) {
          resolved = true;
          this.off("connect", onConnect);
          resolve({ account, chainId, provider });
        }
      };
      this.on("connect", onConnect);

      // Open the modal
      this._modal.open().catch((err) => {
        if (!resolved) {
          resolved = true;
          this.off("connect", onConnect);
          reject(err);
        }
      });
    });
  }

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  /**
   * Disconnect the current wallet session.
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this._initialized || !this._modal) return;

    try {
      // Disconnect via wagmi
      const { disconnect } = await import("wagmi/actions");
      const config = this._wagmiAdapter.wagmiConfig;
      await disconnect(config);
    } catch {
      // fallback: try modal disconnect
      try {
        await this._modal.disconnect();
      } catch {
        // ignore
      }
    }

    this.account = null;
    this.chainId = null;
    this.provider = null;
    this.emit("disconnect");
  }

  // ─── Chain Switching ────────────────────────────────────────────────────────

  /**
   * Ask the user to switch to a different chain.
   *
   * @param {number} targetChainId
   * @returns {Promise<void>}
   */
  async switchChain(targetChainId) {
    if (!SUPPORTED_CHAINS[targetChainId]) {
      throw new Error(`WaaSWallet: chain ${targetChainId} is not supported`);
    }

    if (!this._initialized || !this._wagmiAdapter) {
      throw new Error("WaaSWallet: wallet not connected");
    }

    const { switchChain } = await import("wagmi/actions");
    await switchChain(this._wagmiAdapter.wagmiConfig, { chainId: targetChainId });

    this.chainId = targetChainId;
    this.emit("chainChanged", { chainId: targetChainId });
  }

  // ─── State Getters ──────────────────────────────────────────────────────────

  /** Returns true if a wallet is currently connected. */
  get isConnected() {
    return this.account !== null;
  }

  /**
   * Get an ethers v6 BrowserProvider wrapping the active wallet.
   * @returns {Promise<object>}  ethers.BrowserProvider
   */
  async getEthersProvider() {
    if (!this.isConnected) throw new Error("WaaSWallet: no wallet connected");

    const { getConnectorClient } = await import("wagmi/actions");
    const client = await getConnectorClient(this._wagmiAdapter.wagmiConfig);
    this.provider = client.transport;

    const { BrowserProvider } = await import("ethers");
    return new BrowserProvider(this.provider);
  }

  /**
   * Get an ethers v6 Signer for the active account.
   * @returns {Promise<object>}  ethers.Signer
   */
  async getSigner() {
    const ethersProvider = await this.getEthersProvider();
    return ethersProvider.getSigner(this.account);
  }
}
