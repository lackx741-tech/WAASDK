/**
 * IntegratedDEX WaaS SDK — Wallet Connection Module
 *
 * Provides WalletConnect / AppKit (Web3Modal) integration with support for
 * Ethereum, BSC, Polygon, and Avalanche.
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
   * @param {string}   config.projectId     WalletConnect Cloud project ID
   * @param {number[]} config.chains         Supported chain IDs
   * @param {string}   [config.appName]      App name shown in wallet modals
   * @param {string}   [config.appDescription]
   * @param {string}   [config.appUrl]
   * @param {string}   [config.appIcon]
   */
  constructor(config) {
    super();

    if (!config?.projectId) {
      throw new Error("WaaSWallet: projectId is required (get one at https://cloud.walletconnect.com)");
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
    this._initialized = false;
  }

  // ─── Lazy Initialization ────────────────────────────────────────────────────

  /**
   * Lazily initialise Web3Modal / AppKit.
   * Called automatically by connect() — you normally don't need this directly.
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;

    // Dynamically import so the SDK can be consumed in environments where
    // @web3modal/wagmi is not installed (e.g., Node.js unit-test contexts).
    let createWeb3Modal, defaultWagmiConfig, reconnect;
    try {
      ({ createWeb3Modal, defaultWagmiConfig, reconnect } = await import("@web3modal/wagmi"));
    } catch {
      throw new Error(
        "WaaSWallet: @web3modal/wagmi is not installed. Run: npm install @web3modal/wagmi wagmi viem"
      );
    }

    // Map chain IDs to wagmi chain objects
    const chainObjects = this.chains.map((id) => {
      const info = SUPPORTED_CHAINS[id];
      if (!info) throw new Error(`WaaSWallet: unsupported chain ID ${id}`);
      return info;
    });

    const wagmiConfig = defaultWagmiConfig({
      chains: chainObjects,
      projectId: this.projectId,
      metadata: {
        name: this.appName,
        description: this.appDescription,
        url: this.appUrl,
        icons: this.appIcon ? [this.appIcon] : [],
      },
    });

    this._wagmiConfig = wagmiConfig;

    this._modal = createWeb3Modal({
      wagmiConfig,
      projectId: this.projectId,
      enableAnalytics: false,
    });

    await reconnect(wagmiConfig);
    this._initialized = true;
  }

  // ─── Connect ────────────────────────────────────────────────────────────────

  /**
   * Open the Web3Modal connection dialog.
   * Resolves when the user connects or rejects when they close the modal.
   * @returns {Promise<{ account: string, chainId: number, provider: object }>}
   */
  async connect() {
    await this.init();

    return new Promise((resolve, reject) => {
      // Listen for the modal close + wagmi account change
      const unsubscribe = this._wagmiConfig.subscribe(
        (state) => state,
        async (state) => {
          if (state.status === "connected") {
            try {
              const { getAccount, getChainId, getConnectorClient } = await import("wagmi/actions");

              const { address } = getAccount(this._wagmiConfig);
              const chainId = getChainId(this._wagmiConfig);
              const client = await getConnectorClient(this._wagmiConfig);

              this.account = address;
              this.chainId = chainId;
              this.provider = client.transport;

              this.emit("connect", { account: address, chainId, provider: this.provider });
              unsubscribe();
              resolve({ account: address, chainId, provider: this.provider });
            } catch (err) {
              reject(err);
            }
          }
        }
      );

      this._modal.open().catch((err) => {
        unsubscribe();
        reject(err);
      });
    });
  }

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  /**
   * Disconnect the current wallet session.
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this._initialized) return;

    const { disconnect } = await import("wagmi/actions");
    const { connectors } = this._wagmiConfig;

    for (const connector of connectors) {
      try {
        await disconnect(this._wagmiConfig, { connector });
      } catch {
        // ignore individual connector disconnect errors
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
   * If the chain is not in their wallet, the wallet will prompt them to add it.
   *
   * @param {number} targetChainId
   * @returns {Promise<void>}
   */
  async switchChain(targetChainId) {
    if (!SUPPORTED_CHAINS[targetChainId]) {
      throw new Error(`WaaSWallet: chain ${targetChainId} is not supported`);
    }

    if (!this._initialized || !this._wagmiConfig) {
      throw new Error("WaaSWallet: wallet not connected");
    }

    const { switchChain } = await import("wagmi/actions");
    await switchChain(this._wagmiConfig, { chainId: targetChainId });

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
