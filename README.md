# IntegratedDEX WaaS SDK

**Wallet-as-a-Service SDK** for IntegratedDEX — WalletConnect / AppKit integration,
Permit2 gasless approvals, Multicall3 batching, and EIP-712 typed signing.
Includes a presale launchpad and token launch frontend.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [Environment Variables](#environment-variables)
5. [SDK Usage](#sdk-usage)
   - [Initialise](#initialise)
   - [Wallet Connection](#wallet-connection)
   - [RainbowKit](#rainbowkit)
   - [Web3Modal](#web3modal)
   - [Unified Wallet Modal](#unified-wallet-modal)
   - [Drop-in Connect Button](#drop-in-connect-button)
   - [Permit2](#permit2)
   - [Multicall3](#multicall3)
   - [EIP-712 Signing](#eip-712-signing)
   - [Utilities](#utilities)
6. [Dashboard](#dashboard)
7. [Presale Launchpad](#presale-launchpad)
8. [Token Launch](#token-launch)
9. [Smart Contracts](#smart-contracts)
10. [CI / CD](#ci--cd)
11. [Contributing](#contributing)
12. [License](#license)

---

## Overview

| Module | What it does |
|---|---|
| `sdk/wallet.js` | Core WalletConnect/AppKit wallet class |
| `sdk/rainbow.js` | RainbowKit integration (darkTheme, lightTheme, midnightTheme) |
| `sdk/web3modal.js` | Web3Modal / AppKit integration with sign + switchChain |
| `sdk/walletModal.js` | Unified entry point — auto-routes to RainbowKit or Web3Modal |
| `sdk/connectButton.js` | Embed-ready vanilla JS connect button (no framework needed) |
| `sdk/permit2.js` | User-controlled, exact-amount Permit2 approvals via EIP-712 |
| `sdk/multicall.js` | Batch reads and writes via Multicall3 |
| `sdk/eip712.js` | EIP-712 typed-data signing helpers |
| `sdk/utils.js` | Chain info, address validation, amount formatting |
| `dashboard/index.html` | Admin dashboard — config, preview, and compile |
| `presale/` | Presale launchpad frontend (contribute / claim / refund) |
| `launch/` | Token launch frontend (deploy ERC-20 in one tx) |
| `contracts/` | Auditable Solidity contracts (Presale, TokenLaunch) |

**Key principles:**
- Users always see exactly what they are connecting to before confirming.
- No hidden approvals — wallet connection only connects, never auto-approves anything.
- Max approval is **never** set by default — only if the user explicitly passes `PERMIT2_MAX_AMOUNT`.
- Every transaction shows a clear preview before the user is asked to sign.
- No asset-targeting logic, no sweeping, no cloaking.

---

## Project Structure

```
/
├── sdk/
│   ├── index.js           # SDK entry point — re-exports everything
│   ├── wallet.js          # WalletConnect / AppKit core wallet class
│   ├── rainbow.js         # RainbowKit integration module
│   ├── web3modal.js       # Web3Modal / AppKit module
│   ├── walletModal.js     # Unified wallet modal entry point
│   ├── connectButton.js   # Embed-ready vanilla JS connect button
│   ├── permit2.js         # Permit2 gasless approval module
│   ├── multicall.js       # Multicall3 execution module
│   ├── eip712.js          # EIP-712 typed data helpers
│   └── utils.js           # Chain info, formatting, validation
├── dashboard/
│   └── index.html         # Admin dashboard (config, preview, compile)
├── presale/
│   ├── index.html
│   ├── presale.js
│   └── presale.css
├── launch/
│   ├── index.html
│   ├── launch.js
│   └── launch.css
├── contracts/
│   ├── Presale.sol
│   └── TokenLaunch.sol
├── tests/
│   ├── utils.test.js
│   ├── eip712.test.js
│   ├── permit2.test.js
│   └── multicall.test.js
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── package.json
├── vite.config.js
├── vitest.config.js
├── eslint.config.js
└── .gitignore
```

---

## Installation

```bash
npm install
```

### Run development server

```bash
npm run dev
```

### Run tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Build SDK bundle

```bash
npm run build
```

---

## Environment Variables

Create a `.env` file (never commit it):

```env
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_PRESALE_ADDRESS=0xYourDeployedPresaleContract
VITE_FACTORY_ADDRESS=0xYourDeployedTokenLaunchFactory
VITE_PRESALE_CHAIN_ID=1
```

Get a WalletConnect project ID at <https://cloud.walletconnect.com>.

---

## SDK Usage

### Initialise

```js
import { initSDK } from "./sdk/index.js";

const { wallet } = initSDK({
  projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [1, 56, 137, 43114],       // Ethereum, BSC, Polygon, Avalanche
  appName: "My dApp",
  appDescription: "A great dApp",
  appUrl: "https://example.com",
});
```

### Wallet Connection

```js
// Connect — opens the Web3Modal / AppKit dialog
const { account, chainId } = await wallet.connect();

// Disconnect
await wallet.disconnect();

// Switch chain (prompts user if chain not already in wallet)
await wallet.switchChain(137); // switch to Polygon

// Events
wallet.on("connect",       ({ account, chainId }) => { /* … */ });
wallet.on("disconnect",    ()                     => { /* … */ });
wallet.on("chainChanged",  ({ chainId })           => { /* … */ });

// Get an ethers v6 signer
const signer = await wallet.getSigner();
```

### RainbowKit

```js
import { initRainbowKit, openConnectModal, getAccount, onAccountChange } from './sdk/rainbow.js'

await initRainbowKit({
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  appName: 'IntegratedDEX',
  chains: [1, 56, 137, 43114, 42161, 10, 8453],
  theme: 'dark',   // 'dark' | 'light' | 'midnight'
})

// Open the connect modal
document.getElementById('connectBtn').onclick = () => openConnectModal()

// Read current account
const address = getAccount()  // null if not connected

// Subscribe to account changes
const unsubscribe = onAccountChange((address) => {
  console.log('Account changed:', address)
})

// Unsubscribe later
unsubscribe()
```

Supported themes:
- `darkTheme()` — dark background with purple accent
- `lightTheme()` — white background
- `midnightTheme()` — deep black background

### Web3Modal

```js
import { initWeb3Modal, openModal, closeModal, getAddress, signMessage, switchChain } from './sdk/web3modal.js'

await initWeb3Modal({
  projectId: 'YOUR_PROJECT_ID',
  appName: 'IntegratedDEX',
  chains: [1, 56, 137, 43114, 42161, 10, 8453],
})

// Open / close the modal
document.getElementById('connectBtn').onclick = () => openModal()
closeModal()

// Read connected address
const address = getAddress()  // null if not connected

// Sign a message (wallet always shows exact message before signing)
const signature = await signMessage('Sign to verify ownership')

// Switch chain
await switchChain(137)  // switch to Polygon
```

### Unified Wallet Modal

A single entry point that works with either provider:

```js
import { initWalletModal, openWalletModal, getWalletState, disconnectWallet } from './sdk/walletModal.js'

await initWalletModal({
  provider: 'web3modal',  // 'rainbowkit' | 'web3modal'
  projectId: 'YOUR_PROJECT_ID',
  appName: 'IntegratedDEX',
  chains: [1, 56, 137],
  theme: 'dark',
  onConnect:    ({ address, chainId }) => console.log('Connected:', address),
  onDisconnect: ()                    => console.log('Disconnected'),
  onChainChange: (chainId)            => console.log('Chain:', chainId),
})

// Open / close
await openWalletModal()
closeWalletModal()

// Read state (sync)
const { address, chainId, connected } = getWalletState()

// Disconnect
await disconnectWallet()
```

### Drop-in Connect Button

Inject a fully-styled wallet connect button into **any HTML page** with a single line — no React or Vue required:

```js
import { injectConnectButton } from './sdk/connectButton.js'

injectConnectButton('#header', {
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  buttonText: 'Connect Wallet',
  theme: 'dark',          // 'dark' | 'light'
  showAddress: true,
  showBalance: true,
  showChainIcon: true,
})
```

**What it does:**
- Click when disconnected → opens wallet modal
- When connected → shows truncated address + native balance + chain icon
- Click when connected → opens dropdown (copy address, switch chain, disconnect)
- Fully CSS-styled, zero framework dependencies

**Supported options:**

| Option | Default | Description |
|---|---|---|
| `projectId` | *(required)* | WalletConnect Cloud project ID |
| `provider` | `'web3modal'` | `'web3modal'` or `'rainbowkit'` |
| `chains` | `[1]` | Array of chain IDs to support |
| `appName` | `'IntegratedDEX'` | App name shown in the modal |
| `buttonText` | `'Connect Wallet'` | Button label (disconnected state) |
| `theme` | `'dark'` | `'dark'` or `'light'` |
| `showAddress` | `true` | Show truncated address when connected |
| `showBalance` | `true` | Show native balance when connected |
| `showChainIcon` | `true` | Show chain emoji icon when connected |

### Permit2

User-controlled exact approvals — the amount must always be specified explicitly.

```js
import { signPermitSingle, signPermitBatch, PERMIT2_ADDRESS } from "./sdk/index.js";

// Single token approval
const { signature, deadline } = await signPermitSingle(provider, account, chainId, {
  token:   "0xTokenAddress",
  amount:  500_000_000n,        // exact amount — NEVER defaults to max
  spender: "0xSpenderAddress",
});

// Batch approval (multiple tokens, one signature)
const { signature } = await signPermitBatch(provider, account, chainId, {
  permits: [
    { token: "0xToken1", amount: 100n },
    { token: "0xToken2", amount: 200n },
  ],
  spender: "0xSpenderAddress",
});
```

### Multicall3

```js
import { multicallRead, buildCall, MULTICALL3_ADDRESS } from "./sdk/index.js";

// Batch read calls
const results = await multicallRead(provider, [
  buildCall("0xContract1", encodedCallData1),
  buildCall("0xContract2", encodedCallData2),
]);

// results[0].success, results[0].returnData
```

### EIP-712 Signing

```js
import { buildDomain, buildTypedData, signTypedData } from "./sdk/index.js";

const domain = buildDomain({
  name: "MyApp",
  version: "1",
  chainId: 1,
  verifyingContract: "0xContract",
});

const typedData = buildTypedData(
  domain,
  { Order: [{ name: "amount", type: "uint256" }] },
  "Order",
  { amount: 42 }
);

const signature = await signTypedData(provider, account, typedData);
```

### Utilities

```js
import {
  isValidAddress,
  shortenAddress,
  parseAmount,
  formatAmount,
  getChainInfo,
  getNativeCurrencySymbol,
  getTxUrl,
  deadlineFromNow,
} from "./sdk/index.js";

shortenAddress("0x1234...abcd");   // "0x1234…abcd"
parseAmount("1.5", 18);            // 1500000000000000000n
formatAmount(1500000000000000000n); // "1.5000"
getNativeCurrencySymbol(56);        // "BNB"
getTxUrl("0xHash", 1);             // "https://etherscan.io/tx/0xHash"
deadlineFromNow(30);               // Unix timestamp 30 minutes from now
```

---

## Dashboard

Open `dashboard/index.html` in your browser (or serve it via `npm run dev`):

```bash
npm run dev
# open http://localhost:5173/dashboard/
```

### Tabs

| Tab | What it does |
|---|---|
| **General** | Set app name, WalletConnect project ID, button labels |
| **Wallet** | Choose modal provider (Web3Modal / RainbowKit), theme, supported chains |
| **Connect Button** | Live preview of the connect button with your current settings |
| **Smart Contract** | Paste contract address + ABI → detect functions |
| **Compile 🚀** | Generate a ready-to-use `script.js` → copy or download |

### Quick Start

1. Go to the **General** tab → paste your WalletConnect Project ID
2. Go to the **Wallet** tab → pick a provider and theme, select chains
3. Go to **Connect Button** → toggle options and see the live preview
4. Go to **Compile** → click **⚡ Compile script.js** → download and drop into your site

---

## Presale Launchpad

### Deploy the Presale contract

```solidity
// contracts/Presale.sol
constructor(
  address _token,       // ERC-20 token to distribute
  uint256 _softcap,     // minimum raise in wei
  uint256 _hardcap,     // maximum raise in wei
  uint256 _tokensPerNative, // token wei per native wei contributed
  uint256 _durationSeconds  // presale window length
)
```

Deploy with your favourite tool (Hardhat / Foundry / Remix).
Pre-load the contract with enough tokens to cover `hardcap × tokensPerNative`.

### Configure the frontend

Set `VITE_PRESALE_ADDRESS` and `VITE_PRESALE_CHAIN_ID` in `.env`, then:

```bash
npm run dev
# open http://localhost:5173/presale/
```

### User flows

| Action | When available |
|---|---|
| **Contribute** | While presale is active & hardcap not reached |
| **Claim** | After presale ends AND softcap reached |
| **Refund** | After presale ends AND softcap NOT reached |
| **Owner withdraw** | After presale ends AND softcap reached |

---

## Token Launch

### Deploy the TokenLaunch factory

Deploy `contracts/TokenLaunch.sol` once per chain.
Set `VITE_FACTORY_ADDRESS` in `.env`.

### Use the frontend

```bash
npm run dev
# open http://localhost:5173/launch/
```

1. Connect wallet
2. Fill in name, symbol, supply, decimals
3. Review the live preview
4. Click **Deploy Token** — confirm in wallet
5. Your ERC-20 is live; the address appears on-screen

---

## Smart Contracts

### Presale.sol

- Accepts native token contributions (ETH / BNB / MATIC / AVAX)
- Enforces softcap / hardcap
- Refunds excess over hardcap immediately
- Tokens claimable after successful presale
- Refund path if softcap not reached
- Custom errors (gas-efficient)
- Events: `Contributed`, `Claimed`, `Refunded`, `FundsWithdrawn`

### TokenLaunch.sol

- Factory pattern — one `deployToken()` call per new token
- Deploys a minimal, auditable ERC-20 (no external dependencies)
- All tokens minted to `msg.sender` (deployer)
- Event `TokenDeployed` carries the new contract address

---

## CI / CD

### CI (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`:
1. Install dependencies (`npm ci`)
2. Lint (`eslint`)
3. Test (`vitest`)
4. Build SDK bundle (`vite build`)

### Deploy (`.github/workflows/deploy.yml`)

Runs on push to `main`:
1. Build with production env vars (stored as GitHub Secrets)
2. Deploy `dist/` to GitHub Pages

**Required GitHub Secrets:**

| Secret | Description |
|---|---|
| `WALLETCONNECT_PROJECT_ID` | Your WalletConnect Cloud project ID |
| `PRESALE_ADDRESS` | Deployed Presale contract address |
| `FACTORY_ADDRESS` | Deployed TokenLaunch factory address |
| `PRESALE_CHAIN_ID` | Chain ID for the presale (e.g. `1`) |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes, add tests
4. Run `npm run lint && npm test && npm run build`
5. Open a pull request

---

## License

MIT © IntegratedDEX
