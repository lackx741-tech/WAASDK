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
   - [Permit2](#permit2)
   - [Multicall3](#multicall3)
   - [EIP-712 Signing](#eip-712-signing)
   - [Utilities](#utilities)
6. [Presale Launchpad](#presale-launchpad)
7. [Token Launch](#token-launch)
8. [Smart Contracts](#smart-contracts)
9. [CI / CD](#ci--cd)
10. [Contributing](#contributing)
11. [License](#license)

---

## Overview

| Module | What it does |
|---|---|
| `sdk/wallet.js` | WalletConnect/AppKit integration for Ethereum, BSC, Polygon, Avalanche |
| `sdk/permit2.js` | User-controlled, exact-amount Permit2 approvals via EIP-712 |
| `sdk/multicall.js` | Batch reads and writes via Multicall3 |
| `sdk/eip712.js` | EIP-712 typed-data signing helpers |
| `sdk/utils.js` | Chain info, address validation, amount formatting |
| `presale/` | Presale launchpad frontend (contribute / claim / refund) |
| `launch/` | Token launch frontend (deploy ERC-20 in one tx) |
| `contracts/` | Auditable Solidity contracts (Presale, TokenLaunch) |

**Key principles:**
- Users always see exactly what amount is being approved and to which contract.
- Max approval is **never** set by default — only if the user explicitly passes `PERMIT2_MAX_AMOUNT`.
- Every transaction shows a clear preview before the user is asked to sign.
- No asset-targeting logic, no sweeping, no cloaking.

---

## Project Structure

```
/
├── sdk/
│   ├── index.js        # SDK entry point — re-exports everything
│   ├── wallet.js       # WalletConnect / AppKit integration
│   ├── permit2.js      # Permit2 gasless approval module
│   ├── multicall.js    # Multicall3 execution module
│   ├── eip712.js       # EIP-712 typed data helpers
│   └── utils.js        # Chain info, formatting, validation
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

## Deployed Contracts

All contracts are deployed at the same address on every supported EVM chain (Ethereum, BSC, Polygon, Avalanche, Arbitrum, Base, and more).

| Contract | Address | Description |
|---|---|---|
| `Factory` | `0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF` | Deploys smart wallets via CREATE2 |
| `Stage1Module` | `0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4` | Core wallet implementation module |
| `Stage2Module` | `0x5C9C4AD7b287D37a37d267089e752236f368f94f` | Extended wallet implementation module |
| `Guest` | `0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6` | Unauthenticated execution module (no delegatecall) |
| `SessionManager` | `0x4AE428352317752a51Ac022C9D2551BcDef785cb` | On-chain session key validation with usage limits |
| `EIP7702Module` | `0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d` | EIP-7702 delegation module — turns EOAs into smart accounts |
| `BatchMulticall` | `0xF93E987DF029e95CdE59c0F5cD447e0a7002054D` | Batch multiple calls in a single transaction with per-call ETH forwarding |
| `Permit2Executor` | `0x4593D97d6E932648fb4425aC2945adaF66927773` | Permit2-based gasless token collection |
| `ERC2612Executor` | `0xb8eF065061bbBF5dCc65083be8CC7B50121AE900` | ERC-2612 permit-based gasless token collection |
| `ERC4337FactoryWrapper` | `0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9` | ERC-4337 compatible factory wrapper for account abstraction |

All ABIs and deployed addresses are available via:

```js
import { CONTRACTS } from "./sdk/index.js";

// Access address and ABI for any contract
const { address, abi } = CONTRACTS.BatchMulticall;
const { address: smAddr, abi: smAbi } = CONTRACTS.SessionManager;
```

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
