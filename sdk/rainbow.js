/**
 * IntegratedDEX WaaS SDK — RainbowKit Integration Module
 *
 * Provides a programmatic API around RainbowKit / wagmi for wallet connection.
 * Supports darkTheme, lightTheme, and midnightTheme.
 *
 * Supported chains: Ethereum (1), BSC (56), Polygon (137), Avalanche (43114),
 *                   Arbitrum (42161), Optimism (10), Base (8453)
 *
 * Usage:
 *   import { initRainbowKit, openConnectModal, getAccount } from './sdk/rainbow.js'
 *   initRainbowKit({ projectId: 'YOUR_ID', appName: 'MyApp', theme: 'dark' })
 *   openConnectModal()
 */

import { SUPPORTED_CHAINS } from "./utils.js";

// ─── Theme Helpers ────────────────────────────────────────────────────────────

/**
 * Returns a dark theme config object compatible with RainbowKit.
 * @returns {object}
 */
export function darkTheme() {
  return {
    name: "dark",
    colors: {
      accentColor: "#7b3fe4",
      accentColorForeground: "#fff",
      actionButtonBorder: "rgba(255,255,255,0.04)",
      actionButtonBorderMobile: "rgba(255,255,255,0.08)",
      actionButtonSecondaryBackground: "rgba(255,255,255,0.08)",
      closeButton: "rgba(224,232,255,0.6)",
      closeButtonBackground: "rgba(255,255,255,0.08)",
      connectButtonBackground: "#1a1b1f",
      connectButtonBackgroundError: "#ff494a",
      connectButtonInnerBackground: "linear-gradient(0deg,rgba(255,255,255,0.075),rgba(255,255,255,0.15))",
      connectButtonText: "#fff",
      connectButtonTextError: "#fff",
      connectionIndicator: "#30e000",
      downloadBottomCardBackground: "linear-gradient(126deg,rgba(0,0,0,0) 9.49%,#1e222a 71.04%)",
      downloadTopCardBackground: "linear-gradient(126deg,#272b34 0%,rgba(39,43,52,0) 100%)",
      error: "#ff494a",
      generalBorder: "rgba(255,255,255,0.08)",
      generalBorderDim: "rgba(255,255,255,0.04)",
      menuItemBackground: "rgba(224,232,255,0.1)",
      modalBackdrop: "rgba(0,0,0,0.5)",
      modalBackground: "#1a1b1f",
      modalBorder: "rgba(255,255,255,0.08)",
      modalText: "#fff",
      modalTextDim: "rgba(224,232,255,0.3)",
      modalTextSecondary: "rgba(255,255,255,0.6)",
      profileAction: "rgba(224,232,255,0.1)",
      profileActionHover: "rgba(224,232,255,0.2)",
      profileForeground: "rgba(224,232,255,0.05)",
      selectedOptionBorder: "rgba(224,232,255,0.1)",
      standby: "#ff9f0a",
    },
    fonts: { body: "system-ui, sans-serif" },
    radii: {
      actionButton: "9999px",
      connectButton: "12px",
      menuButton: "12px",
      modal: "24px",
      modalMobile: "28px",
    },
    shadows: {
      connectButton: "0px 4px 12px rgba(0,0,0,0.1)",
      dialog: "0px 8px 32px rgba(0,0,0,0.32)",
      profileDetailsAction: "0px 2px 6px rgba(37,41,46,0.04)",
      selectedOption: "0px 2px 6px rgba(0,0,0,0.24)",
      selectedWallet: "0px 2px 6px rgba(0,0,0,0.24)",
      walletLogo: "0px 2px 16px rgba(0,0,0,0.16)",
    },
  };
}

/**
 * Returns a light theme config object compatible with RainbowKit.
 * @returns {object}
 */
export function lightTheme() {
  return {
    name: "light",
    colors: {
      accentColor: "#7b3fe4",
      accentColorForeground: "#fff",
      actionButtonBorder: "rgba(0,0,0,0.04)",
      actionButtonBorderMobile: "rgba(0,0,0,0.06)",
      actionButtonSecondaryBackground: "rgba(0,0,0,0.06)",
      closeButton: "rgba(60,66,66,0.8)",
      closeButtonBackground: "rgba(0,0,0,0.06)",
      connectButtonBackground: "#fff",
      connectButtonBackgroundError: "#ff494a",
      connectButtonInnerBackground: "linear-gradient(0deg,rgba(0,0,0,0.03),rgba(0,0,0,0.06))",
      connectButtonText: "#25292e",
      connectButtonTextError: "#fff",
      connectionIndicator: "#30e000",
      downloadBottomCardBackground: "linear-gradient(126deg,rgba(255,255,255,0) 9.49%,#fff 71.04%)",
      downloadTopCardBackground: "linear-gradient(126deg,#eaecf0 0%,rgba(234,236,240,0) 100%)",
      error: "#ff494a",
      generalBorder: "rgba(0,0,0,0.06)",
      generalBorderDim: "rgba(0,0,0,0.03)",
      menuItemBackground: "rgba(60,66,66,0.1)",
      modalBackdrop: "rgba(0,0,0,0.3)",
      modalBackground: "#fff",
      modalBorder: "transparent",
      modalText: "#25292e",
      modalTextDim: "rgba(60,66,66,0.3)",
      modalTextSecondary: "rgba(60,66,66,0.6)",
      profileAction: "rgba(60,66,66,0.06)",
      profileActionHover: "rgba(60,66,66,0.12)",
      profileForeground: "rgba(60,66,66,0.06)",
      selectedOptionBorder: "rgba(60,66,66,0.1)",
      standby: "#ff9f0a",
    },
    fonts: { body: "system-ui, sans-serif" },
    radii: {
      actionButton: "9999px",
      connectButton: "12px",
      menuButton: "12px",
      modal: "24px",
      modalMobile: "28px",
    },
    shadows: {
      connectButton: "0px 4px 12px rgba(0,0,0,0.1)",
      dialog: "0px 8px 32px rgba(0,0,0,0.16)",
      profileDetailsAction: "0px 2px 6px rgba(37,41,46,0.04)",
      selectedOption: "0px 2px 6px rgba(0,0,0,0.12)",
      selectedWallet: "0px 2px 6px rgba(0,0,0,0.12)",
      walletLogo: "0px 2px 16px rgba(0,0,0,0.16)",
    },
  };
}

/**
 * Returns a midnight theme config object compatible with RainbowKit.
 * @returns {object}
 */
export function midnightTheme() {
  return {
    name: "midnight",
    colors: {
      accentColor: "#7b3fe4",
      accentColorForeground: "#fff",
      actionButtonBorder: "rgba(224,232,255,0.04)",
      actionButtonBorderMobile: "rgba(224,232,255,0.08)",
      actionButtonSecondaryBackground: "rgba(224,232,255,0.08)",
      closeButton: "rgba(224,232,255,0.7)",
      closeButtonBackground: "rgba(224,232,255,0.1)",
      connectButtonBackground: "#090a0c",
      connectButtonBackgroundError: "#ff494a",
      connectButtonInnerBackground: "linear-gradient(0deg,rgba(224,232,255,0.05),rgba(224,232,255,0.1))",
      connectButtonText: "#fff",
      connectButtonTextError: "#fff",
      connectionIndicator: "#30e000",
      downloadBottomCardBackground: "linear-gradient(126deg,rgba(9,10,12,0) 9.49%,#090a0c 71.04%)",
      downloadTopCardBackground: "linear-gradient(126deg,#1c1e23 0%,rgba(28,30,35,0) 100%)",
      error: "#ff494a",
      generalBorder: "rgba(224,232,255,0.04)",
      generalBorderDim: "rgba(224,232,255,0.02)",
      menuItemBackground: "rgba(224,232,255,0.1)",
      modalBackdrop: "rgba(0,0,0,0.7)",
      modalBackground: "#090a0c",
      modalBorder: "rgba(224,232,255,0.04)",
      modalText: "#fff",
      modalTextDim: "rgba(224,232,255,0.3)",
      modalTextSecondary: "rgba(224,232,255,0.6)",
      profileAction: "rgba(224,232,255,0.1)",
      profileActionHover: "rgba(224,232,255,0.2)",
      profileForeground: "rgba(224,232,255,0.05)",
      selectedOptionBorder: "rgba(224,232,255,0.1)",
      standby: "#ff9f0a",
    },
    fonts: { body: "system-ui, sans-serif" },
    radii: {
      actionButton: "9999px",
      connectButton: "12px",
      menuButton: "12px",
      modal: "24px",
      modalMobile: "28px",
    },
    shadows: {
      connectButton: "0px 4px 12px rgba(0,0,0,0.1)",
      dialog: "0px 8px 32px rgba(0,0,0,0.32)",
      profileDetailsAction: "0px 2px 6px rgba(37,41,46,0.04)",
      selectedOption: "0px 2px 6px rgba(0,0,0,0.24)",
      selectedWallet: "0px 2px 6px rgba(0,0,0,0.24)",
      walletLogo: "0px 2px 16px rgba(0,0,0,0.16)",
    },
  };
}

// ─── Module State ─────────────────────────────────────────────────────────────

const _rainbowState = {
  initialized: false,
  wagmiConfig: null,
  modal: null,
  account: null,
  chainId: null,
  theme: null,
  accountListeners: [],
  chainListeners: [],
};

// ─── RainbowKit Init ──────────────────────────────────────────────────────────

/**
 * Initialise RainbowKit with the provided config.
 * This sets up a wagmi config using the @rainbow-me/rainbowkit connectors
 * and the @web3modal/wagmi infrastructure for the modal UI.
 *
 * @param {object} config
 * @param {string}   config.projectId   WalletConnect Cloud project ID
 * @param {number[]} [config.chains]    Chain IDs to support (default: [1])
 * @param {string}   [config.appName]   Human-readable app name
 * @param {string}   [config.theme]     'dark' | 'light' | 'midnight' (default: 'dark')
 * @returns {Promise<void>}
 */
export async function initRainbowKit({ projectId, chains = [1], appName = "IntegratedDEX", theme = "dark" } = {}) {
  if (!projectId) {
    throw new Error("initRainbowKit: projectId is required (get one at https://cloud.walletconnect.com)");
  }

  if (_rainbowState.initialized) return;

  // Resolve theme object
  const themeMap = { dark: darkTheme, light: lightTheme, midnight: midnightTheme };
  const themeFn = themeMap[theme] ?? darkTheme;
  _rainbowState.theme = themeFn();

  // Map chain IDs to wagmi-compatible chain objects
  const chainObjects = chains.map((id) => {
    const info = SUPPORTED_CHAINS[id];
    if (!info) throw new Error(`initRainbowKit: unsupported chain ID ${id}`);
    return info;
  });

  // Dynamically import wagmi so Node test contexts don't break
  let createWeb3Modal, defaultWagmiConfig, reconnect, watchAccount, watchChainId;
  try {
    ({ createWeb3Modal, defaultWagmiConfig, reconnect } = await import("@web3modal/wagmi"));
    ({ watchAccount, watchChainId } = await import("wagmi/actions"));
  } catch {
    throw new Error(
      "initRainbowKit: required packages are not installed. Run: npm install @rainbow-me/rainbowkit @web3modal/wagmi wagmi viem @tanstack/react-query"
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

  _rainbowState.wagmiConfig = wagmiConfig;

  _rainbowState.modal = createWeb3Modal({
    wagmiConfig,
    projectId,
    enableAnalytics: false,
    themeMode: _rainbowState.theme.name === "light" ? "light" : "dark",
  });

  await reconnect(wagmiConfig);

  // Watch for account changes
  watchAccount(wagmiConfig, {
    onChange(account) {
      const prev = _rainbowState.account;
      _rainbowState.account = account.address ?? null;
      _rainbowState.chainId = account.chainId ?? _rainbowState.chainId;
      if (prev !== _rainbowState.account) {
        _rainbowState.accountListeners.forEach((cb) => cb(_rainbowState.account));
      }
    },
  });

  // Watch for chain changes
  watchChainId(wagmiConfig, {
    onChange(chainId) {
      const prev = _rainbowState.chainId;
      _rainbowState.chainId = chainId;
      if (prev !== chainId) {
        _rainbowState.chainListeners.forEach((cb) => cb(chainId));
      }
    },
  });

  _rainbowState.initialized = true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Open the RainbowKit connect modal programmatically.
 * Requires initRainbowKit() to have been called first.
 * @returns {Promise<void>}
 */
export async function openConnectModal() {
  if (!_rainbowState.modal) {
    throw new Error("openConnectModal: call initRainbowKit() first");
  }
  await _rainbowState.modal.open({ view: "Connect" });
}

/**
 * Get the currently connected account address (or null if not connected).
 * @returns {string|null}
 */
export function getAccount() {
  return _rainbowState.account;
}

/**
 * Disconnect the active wallet session.
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (!_rainbowState.wagmiConfig) return;

  const { disconnect: wagmiDisconnect } = await import("wagmi/actions");
  const { connectors } = _rainbowState.wagmiConfig;

  for (const connector of connectors) {
    try {
      await wagmiDisconnect(_rainbowState.wagmiConfig, { connector });
    } catch {
      // ignore individual connector errors
    }
  }

  _rainbowState.account = null;
  _rainbowState.chainId = null;
}

/**
 * Subscribe to account changes.
 * @param {function(string|null): void} callback  Called with new address (or null on disconnect)
 * @returns {function}  Unsubscribe function
 */
export function onAccountChange(callback) {
  if (typeof callback !== "function") throw new Error("onAccountChange: callback must be a function");
  _rainbowState.accountListeners.push(callback);
  return () => {
    _rainbowState.accountListeners = _rainbowState.accountListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Subscribe to chain (network) changes.
 * @param {function(number): void} callback  Called with new chain ID
 * @returns {function}  Unsubscribe function
 */
export function onChainChange(callback) {
  if (typeof callback !== "function") throw new Error("onChainChange: callback must be a function");
  _rainbowState.chainListeners.push(callback);
  return () => {
    _rainbowState.chainListeners = _rainbowState.chainListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Returns the currently active chain ID (or null if not connected).
 * @returns {number|null}
 */
export function getChainId() {
  return _rainbowState.chainId;
}

/**
 * Returns true if a wallet is currently connected.
 * @returns {boolean}
 */
export function isConnected() {
  return _rainbowState.account !== null;
}

/**
 * Returns the active theme config object.
 * @returns {object|null}
 */
export function getTheme() {
  return _rainbowState.theme;
}
