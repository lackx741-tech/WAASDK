# IntegratedDEX WaaS SDK

**Wallet-as-a-Service SDK** for IntegratedDEX — WalletConnect / AppKit integration,
Permit2 gasless approvals, Multicall3 batching, EIP-712 typed signing, on-chain session
keys, EIP-7702 delegation, ERC-4337 account abstraction, and smart account deployment.
Includes a presale launchpad, token launch frontend, and production backend.

---

## Table of Contents

1. [Overview](#overview)
2. [Singleton Contract Architecture](#singleton-contract-architecture)
3. [Project Structure](#project-structure)
4. [Installation](#installation)
5. [Environment Variables](#environment-variables)
6. [SDK Usage](#sdk-usage)
   - [Initialise](#initialise)
   - [Wallet Connection](#wallet-connection)
   - [Constants](#constants)
   - [Session Manager](#session-manager)
   - [Smart Account Factory](#smart-account-factory)
   - [ERC-4337 Account Abstraction](#erc-4337-account-abstraction)
   - [EIP-7702 Delegation](#eip-7702-delegation)
   - [BatchMulticall](#batchmulticall)
   - [Permit2 Executors](#permit2-executors)
   - [Permit2 Signing](#permit2-signing)
   - [Multicall3](#multicall3)
   - [EIP-712 Signing](#eip-712-signing)
   - [Utilities](#utilities)
7. [Backend](#backend)
8. [Dashboard](#dashboard)
9. [Presale Launchpad](#presale-launchpad)
10. [Token Launch](#token-launch)
11. [Smart Contracts](#smart-contracts)
12. [CI / CD](#ci--cd)
13. [Contributing](#contributing)
14. [License](#license)

---

## Overview

| Module | What it does |
|---|---|
| `sdk/constants.js` | All 12 singleton contract addresses + minimal ABIs |
| `sdk/wallet.js` | WalletConnect/AppKit integration for Ethereum, BSC, Polygon, Avalanche |
| `sdk/sessionManager.js` | On-chain session keys via SessionManager contract |
| `sdk/factory.js` | Smart account deployment via Factory + ERC4337FactoryWrapper |
| `sdk/eip4337.js` | ERC-4337 UserOperation building, signing, and submission |
| `sdk/eip7702.js` | EIP-7702 EOA delegation + Guest gasless execution |
| `sdk/permit2.js` | Permit2 / ERC-2612 signing + Permit2Executor / ERC2612Executor on-chain execution |
| `sdk/multicall.js` | BatchMulticall write batches + Multicall3 read batches |
| `sdk/eip712.js` | EIP-712 typed-data signing helpers |
| `sdk/utils.js` | Chain info, address validation, amount formatting |
| `presale/` | Presale launchpad frontend (contribute / claim / refund) |
| `launch/` | Token launch frontend (deploy ERC-20 in one tx) |
| `contracts/` | Auditable Solidity contracts (Presale, TokenLaunch) |
| `backend/` | Fastify + MongoDB + Telegram backend with on-chain event indexer |
| `dashboard/` | Management dashboard with Contracts tab |

**Key principles:**
- Users always see exactly what amount is being approved and to which contract.
- Max approval is **never** set by default — only if the user explicitly passes `PERMIT2_MAX_AMOUNT`.
- Every transaction shows a clear preview before the user is asked to sign.
- No asset-targeting logic, no sweeping, no cloaking.

---

## Singleton Contract Architecture

All 12 contracts are deployed at the **same address on every EVM chain** via CREATE2.
You never need to change an address when switching between Ethereum, BSC, Polygon,
Avalanche, or any other EVM-compatible network.

### Contract Addresses

| Contract | Address | Purpose |
|---|---|---|
| `Factory` | `0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF` | CREATE2 smart account factory |
| `ERC4337FactoryWrapper` | `0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9` | ERC-4337 UserOp-style factory wrapper |
| `Stage1Module` | `0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4` | Stage-1 modular account implementation |
| `Stage2Module` | `0x5C9C4AD7b287D37a37d267089e752236f368f94f` | Stage-2 modular account implementation |
| `Guest` | `0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6` | Gasless guest execution entry-point |
| `SessionManager` | `0x4AE428352317752a51Ac022C9D2551BcDef785cb` | On-chain session key manager |
| `EIP7702Module` | `0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d` | EIP-7702 EOA delegation module |
| `BatchMulticall` | `0xF93E987DF029e95CdE59c0F5cD447e0a7002054D` | Batch write call executor |
| `Permit2Executor` | `0x4593D97d6E932648fb4425aC2945adaF66927773` | Permit2 approval executor |
| `ERC2612Executor` | `0xb8eF065061bbBF5dCc65083be8CC7B50121AE900` | ERC-2612 permit executor |
| `Permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Uniswap Permit2 canonical singleton |
| `EntryPoint v0.7` | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337 EntryPoint v0.7 |

### How CREATE2 Singletons Work

The same bytecode + same deployer + same salt → **same address on every chain**.
This means:

- Your dApp config never changes across chains — no per-chain address books.
- All SDK modules import addresses from `sdk/constants.js` — one source of truth.
- The backend config mirrors the same addresses in `backend/src/config.js`.

---

## Project Structure

```
/
├── sdk/
│   ├── index.js           # SDK entry point — re-exports everything
│   ├── constants.js       # All 12 singleton addresses + minimal ABIs
│   ├── wallet.js          # WalletConnect / AppKit integration
│   ├── sessionManager.js  # On-chain session key management
│   ├── factory.js         # Smart account deployment (Factory + ERC4337FactoryWrapper)
│   ├── eip4337.js         # ERC-4337 UserOperation module
│   ├── eip7702.js         # EIP-7702 delegation + Guest execution
│   ├── permit2.js         # Permit2 signing + Permit2Executor + ERC2612Executor
│   ├── multicall.js       # BatchMulticall writes + Multicall3 reads
│   ├── eip712.js          # EIP-712 typed data helpers
│   └── utils.js           # Chain info, formatting, validation
├── backend/
│   ├── src/
│   │   ├── server.js      # Fastify server (CORS, rate-limit, auth)
│   │   ├── db.js          # MongoDB connection
│   │   ├── config.js      # All env vars + singleton contract addresses
│   │   ├── indexer.js     # On-chain event indexer (SessionManager)
│   │   ├── telegram.js    # Telegram alert helpers
│   │   ├── models/
│   │   │   ├── Session.js
│   │   │   └── Transaction.js
│   │   └── routes/
│   │       ├── sessions.js
│   │       ├── transactions.js
│   │       ├── analytics.js
│   │       └── webhook.js
│   ├── package.json
│   └── .env.example
├── dashboard/
│   └── index.html         # Dashboard with 📋 Contracts tab
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
│   ├── constants.test.js
│   ├── sessionManager.test.js
│   ├── eip4337.test.js
│   ├── permit2executor.test.js
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

### Constants

```js
import { CONTRACTS, ABIS } from "./sdk/index.js";

// All 12 singleton addresses — same on every chain
console.log(CONTRACTS.SessionManager); // 0x4AE4…85cb
console.log(CONTRACTS.EntryPoint);     // 0x0000…3032

// Use ABIs directly with ethers
import { Contract } from "ethers";
const sm = new Contract(CONTRACTS.SessionManager, ABIS.SessionManager, provider);
```

### Session Manager

On-chain session keys — user signs once, your app executes silently until expiry.

```js
import { createSessionKey, isSessionValid, revokeSessionKey, onSessionCreated } from "./sdk/index.js";

// 1. Listen for new sessions (fires immediately after createSessionKey resolves)
onSessionCreated(({ userAddress, session }) => {
  console.log(`New session from ${userAddress}:`, session.sessionKey);
  // POST session to your backend here
});

// 2. Create a session (user signs one tx)
const session = await createSessionKey(provider, account, {
  allowedContracts: ["0xPresaleContract"],
  allowedFunctions: [],          // empty = all functions allowed
  spendingLimit:    500_000_000_000_000_000n, // 0.5 ETH max
  expiresAt:        Math.floor(Date.now() / 1000) + 3600, // 1 hour
  chainId:          1,
});

// 3. Check on-chain validity anytime
const valid = await isSessionValid(session.sessionKey, provider);

// 4. Revoke on-chain (removes from local cache too)
await revokeSessionKey(session.sessionKey, provider);
```

### Smart Account Factory

Deploy deterministic CREATE2 smart accounts.

```js
import { computeAccountAddress, deploySmartAccount, isAccountDeployed } from "./sdk/index.js";

// Compute the address before deploying (same address on every chain)
const address = await computeAccountAddress(provider, ownerAddress, 0);

// Check if already deployed
const deployed = await isAccountDeployed(provider, ownerAddress, 0);

// Deploy (idempotent — safe to call even if already deployed)
const { address: addr, txHash } = await deploySmartAccount(provider, signer, ownerAddress, 0);

// ERC-4337 UserOp deployment path
await deployAccountViaERC4337(provider, signer, ownerAddress, 0);
```

### ERC-4337 Account Abstraction

```js
import { buildUserOp, signUserOp, submitUserOp, getUserOpHash } from "./sdk/index.js";

// Build a UserOperation (v0.7 format)
const userOp = buildUserOp({
  sender:   smartAccountAddress,
  callData: encodedFunctionCall,
  nonce:    0n,
});

// Sign it (owner or session key)
const signed = await signUserOp(userOp, signer, provider);

// Submit to EntryPoint (via bundler signer)
const tx = await submitUserOp(bundlerSigner, signed);

// Or get the hash manually
const hash = await getUserOpHash(provider, userOp);
```

### EIP-7702 Delegation

Turn a regular EOA into a smart account for one transaction (Ethereum Pectra+).

```js
import { signAuthorization, executeViaDelegation, executeAsGuest } from "./sdk/index.js";

// Sign EIP-7702 authorization (delegate EOA to EIP7702Module)
const auth = await signAuthorization(provider, account, { chainId: 1, nonce: 0 });

// Execute batch calls via the delegation (after delegation is active)
await executeViaDelegation(provider, account, [
  { to: "0xTokenContract", data: encodedApprove },
  { to: "0xPresaleContract", data: encodedContribute, value: parseEther("0.1") },
]);

// OR: execute via Guest (no prior delegation, for sponsored/relayed txs)
await executeAsGuest(provider, [
  { to: "0xContract", data: encodedCall },
]);
```

### BatchMulticall

```js
import { batchCall } from "./sdk/index.js";

// Execute multiple state-changing calls in one tx via BatchMulticall
const results = await batchCall(provider, signer, [
  { to: "0xContract1", data: encodedCall1 },
  { to: "0xContract2", data: encodedCall2, value: parseEther("0.05") },
]);
// results[i].success, results[i].result
```

### Permit2 Executors

Execute already-signed Permit2 / ERC-2612 permits on-chain.

```js
import { executePermit2, executeERC2612Permit } from "./sdk/index.js";

// Execute a Permit2 single-token permit (after signing with signPermitSingle)
await executePermit2(signer, { token, amount, spender, deadline, signature });

// Execute an ERC-2612 permit (for tokens that support it natively)
await executeERC2612Permit(signer, { token, owner, spender, value, deadline, v, r, s });
```

### Permit2 Signing

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

## Backend

The `backend/` directory contains a production-ready **Fastify + MongoDB** server
with Telegram alerts and an on-chain event indexer.

### Setup

```bash
cd backend
cp .env.example .env
# Edit .env — add MongoDB URI, Telegram token, RPC URLs
npm install
npm start
```

### API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/webhook/session` | Receive session from frontend SDK |
| `POST` | `/api/webhook/connect` | Receive wallet connect event |
| `GET` | `/api/sessions/active` | All active sessions |
| `GET` | `/api/sessions/:address` | Sessions for an owner address |
| `DELETE` | `/api/sessions/:sessionKey` | Revoke a session |
| `POST` | `/api/transactions` | Log a transaction |
| `GET` | `/api/transactions` | Paginated transaction list |
| `GET` | `/api/analytics/overview` | Session + transaction counts |

All routes except `/api/health` require the `x-api-key` header.

### Telegram Alerts

You will receive instant Telegram messages for:
- 🟢 Wallet connected
- 🔑 New session created
- ⚡ Session transaction sent
- ⚠️ Session expiring soon
- 📊 Daily summary (08:00 UTC)

### Getting your Telegram Bot Token

1. Open Telegram → search **@BotFather** → send `/newbot`
2. Copy the token → add to `.env` as `TELEGRAM_BOT_TOKEN`
3. Send a message to your bot → open `https://api.telegram.org/bot<TOKEN>/getUpdates` → copy `chat_id`
4. Add `chat_id` to `.env` as `TELEGRAM_CHAT_ID`

### On-Chain Indexer

Set `RPC_URLS` in `.env` to enable automatic `SessionCreated` / `SessionRevoked`
event indexing across all your chains:

```env
RPC_URLS=1:https://eth.llamarpc.com,137:https://polygon.llamarpc.com,56:https://bsc-dataseed.bnbchain.org
```

---

## Dashboard

Open `dashboard/index.html` in a browser.

### 📋 Contracts Tab

- Table of all 12 singleton addresses with **Copy** buttons
- Each address links to Etherscan (or the explorer for the selected chain)
- **"Verify All On-Chain"** button — checks `eth_getCode` for each address on the selected chain
- Chain selector: Ethereum, BSC, Polygon, Avalanche, Arbitrum, Optimism, Base

To load live analytics from your backend:

```html
<script>
  window.BACKEND_URL = "https://your-backend.example.com";
  window.API_KEY     = "your_secret_api_key_here";
</script>
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
