# IntegratedDEX WaaS SDK

**Wallet-as-a-Service SDK** for IntegratedDEX — WalletConnect / AppKit integration,
Permit2 gasless approvals, Multicall3 batching, EIP-712 typed signing, and full
**EIP-7702 session keys** (Ethereum Pectra upgrade).
Includes a presale launchpad, token launch frontend, admin dashboard, and interactive
modal playground.

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
6. [EIP-7702 — Session Keys & Batch Execution](#eip-7702--session-keys--batch-execution)
   - [How Session Keys Work](#how-session-keys-work)
   - [Batch Execution](#batch-execution)
   - [Gas Sponsorship](#gas-sponsorship)
   - [Session Notifications](#session-notifications)
7. [Dashboard](#dashboard)
8. [Interactive Modal Playground](#interactive-modal-playground)
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
| `sdk/wallet.js` | WalletConnect/AppKit integration for Ethereum, BSC, Polygon, Avalanche |
| `sdk/permit2.js` | User-controlled, exact-amount Permit2 approvals via EIP-712 |
| `sdk/multicall.js` | Batch reads and writes via Multicall3 |
| `sdk/eip712.js` | EIP-712 typed-data signing helpers |
| `sdk/eip7702.js` | **EIP-7702** — authorization signing, batch execution, session keys, gas sponsorship |
| `sdk/sessionManager.js` | **Session key storage**, lifecycle callbacks, `executeWithSession()` |
| `sdk/sessionNotifier.js` | Browser notifications and webhooks for session events |
| `sdk/utils.js` | Chain info, address validation, amount formatting |
| `dashboard/` | Admin dashboard — General / Wallet / Contract / **⚡ Sessions** / Advanced / Compile |
| `modal/` | Interactive modal playground — Connect / Contract / Sign / **⚡ Batch & Sessions** |
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
│   ├── index.js            # SDK entry point — re-exports everything
│   ├── wallet.js           # WalletConnect / AppKit integration
│   ├── permit2.js          # Permit2 gasless approval module
│   ├── multicall.js        # Multicall3 execution module
│   ├── eip712.js           # EIP-712 typed data helpers
│   ├── eip7702.js          # EIP-7702 batch execution & session keys
│   ├── sessionManager.js   # Session key storage, callbacks, execution
│   ├── sessionNotifier.js  # Browser notifications & webhook delivery
│   └── utils.js            # Chain info, formatting, validation
├── dashboard/
│   └── index.html          # Admin dashboard (General/Wallet/Contract/Sessions/Compile)
├── modal/
│   └── index.html          # Interactive modal playground
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
│   ├── multicall.test.js
│   ├── eip7702.test.js
│   └── sessionManager.test.js
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

## EIP-7702 — Session Keys & Batch Execution

EIP-7702 was activated on Ethereum with the **Pectra upgrade (May 2025)**.
It lets a regular EOA temporarily act as a smart contract for one transaction,
enabling batch execution, gas sponsorship, and session keys — all on the user's
existing address, no fund migration required.

| Feature | Before EIP-7702 | With EIP-7702 |
|---|---|---|
| Batch transactions | Multiple txs | **1 tx** |
| Gas sponsorship | Not possible for EOA | ✅ Pay user gas |
| Session keys | Not possible | ✅ Temporary limited keys |
| Spending limits | Not possible | ✅ Per-session ETH cap |

### How Session Keys Work

**Step 1 — User signs a session (once)**

```js
import { createSessionKey } from "./sdk/eip7702.js";
import { saveSession, onSessionCreated } from "./sdk/sessionManager.js";

// Listen for when user creates a session
onSessionCreated(({ userAddress, session }) => {
  console.log(`✅ User ${userAddress} signed a session!`);
  console.log(`Session key: ${session.sessionKey}`);
  console.log(`Expires: ${new Date(session.expiresAt * 1000)}`);
  console.log(`Allowed: ${session.allowedFunctions.join(", ")}`);
  // Store it — you can now act on behalf of user within limits
});

const session = await createSessionKey(provider, userAddress, {
  sessionPublicKey: generatedKeyAddress,  // temporary key address
  allowedContracts: ["0xPresaleContract"],
  allowedFunctions: ["contribute(uint256)", "claim()"],
  spendingLimit: "0.5",    // max 0.5 ETH per tx
  expiresAt: Math.floor(Date.now() / 1000) + 3600,  // 1 hour
  chainId: 1,
});

saveSession(session);
```

**Step 2 — Use the session (no user confirmation needed)**

```js
import { executeWithSession } from "./sdk/sessionManager.js";

// Later — call contract on user's behalf using session key
// No wallet popup. No user needed.
const txHash = await executeWithSession(session.sessionKey, provider, {
  to: "0xPresaleContract",
  data: encodedContributeCalldata,
});

console.log(`Tx sent: ${txHash}`);
```

**Where to find active sessions:**

- In the **Dashboard → ⚡ Sessions tab** — live table of all sessions
- Via `getAllSessions()` — returns all sessions from localStorage
- Via `onSessionCreated(callback)` — fires the moment a user signs

**Session object shape:**

```json
{
  "id": "sess_abc123",
  "userAddress": "0xUser...",
  "sessionKey": "0xTempKey...",
  "allowedContracts": ["0xPresale..."],
  "allowedFunctions": ["contribute(uint256)", "claim()"],
  "spendingLimit": "0.5",
  "spendingLimitToken": "ETH",
  "expiresAt": 1748000000,
  "chainId": 1,
  "createdAt": 1747000000,
  "signature": "0xSig...",
  "txHash": "0xTx...",
  "status": "active"
}
```

### Session Manager API

```js
import {
  saveSession,         // store a session + fire onSessionCreated
  getActiveSessions,   // get active sessions for a user address
  getAllSessions,       // get all sessions (for operator dashboard)
  isSessionValid,      // check if a session is still valid
  executeWithSession,  // send a tx using a session key (no wallet popup)
  onSessionCreated,    // callback({ userAddress, session }) — fires on save
  onSessionExpired,    // callback(session) — fires when session expires
  exportSessions,      // returns all sessions as a JSON string
  revokeSession,       // mark a session revoked in local storage
} from "./sdk/sessionManager.js";

// Revoke a session (also call revokeSessionKey() from eip7702.js for on-chain)
revokeSession("sess_abc123");

// Export all sessions
const json = exportSessions();
```

### Batch Execution

```js
import { executeBatch } from "./sdk/eip7702.js";

// Approve + contribute in a single transaction
const txHash = await executeBatch(provider, account, [
  { to: tokenContract,   data: approveCalldata,    value: "0x0" },
  { to: presaleContract, data: contributeCalldata, value: ethAmount },
]);
// ✅ 1 transaction, 1 gas fee, 1 confirmation
```

### Gas Sponsorship

```js
import { sponsorTransaction } from "./sdk/eip7702.js";

// Sponsor gas for a user — you pay the fee, user gets the tx
const txHash = await sponsorTransaction(provider, sponsorAddress, {
  from: userAddress,
  to: presaleContract,
  data: contributeCalldata,
  value: "0x0",
});
```

### Session Notifications

```js
import {
  notifySessionCreated,
  notifySessionUsed,
  notifySessionExpiring,
  webhookSessionEvent,
} from "./sdk/sessionNotifier.js";

// Browser notification when session is created
await notifySessionCreated(session);

// Browser notification when session is used
await notifySessionUsed(session, txHash);

// Warn when session is close to expiry
await notifySessionExpiring(session, 15); // 15 minutes left

// Webhook delivery (POST JSON to your server)
await webhookSessionEvent("https://your-server.com/webhook", "session_created", session);
```

---

## Dashboard

Open `dashboard/index.html` locally or host on GitHub Pages.

**Tabs:**

| Tab | What it does |
|---|---|
| ⚙️ General | App name, WalletConnect Project ID, theme, button text |
| 💳 Wallet | Supported chains, modal style, balance display |
| 📄 Contract | Paste ABI + address → auto-detects functions → build args |
| ⚡ Sessions | Live table of active sessions, event log, create session, execute with session |
| 🔧 Advanced | EIP-7702, EIP-712, Permit2 toggles, retry config, webhook URL |
| 🚀 Compile | Generates ready-to-embed `script.js` → copy or download |

**Sessions tab features:**
- Live table: User Address / Session Key / Allowed Contracts / Spending Limit / Expires / Status / Actions
- Color coded: 🟢 Active · 🟡 Expiring (<1hr) · 🔴 Expired/Revoked
- Auto-refreshes every 30 seconds
- **[Revoke]** button per session
- **[Use Session]** → selects session for the Execute panel
- Session event log — timestamped feed of session lifecycle events
- Create Session form — allowed contracts/functions, spending limit, duration picker
- Execute With Session panel — no wallet popup needed

---

## Interactive Modal Playground

Open `modal/index.html` for a live, interactive SDK demo.

**Tabs:**

| Tab | What it does |
|---|---|
| 🔌 Connect | Connect button customizer with live preview + embed code |
| 📄 Contract | Paste ABI → call any function → live results |
| ✍️ Sign Message | Sign arbitrary messages + EIP-712 typed data |
| ⚡ Batch & Sessions | Batch builder + session key generator with countdown timer |

**Batch & Sessions tab:**
- Add multiple contract calls with `[+ Add Call]`
- Shows combined gas estimate
- Batch preview before execution
- Session key generator — set allowed contracts/functions/limit/duration → sign once
- Shows generated session key, signature, and live expiry countdown
- Sessions saved to localStorage (visible in Dashboard → Sessions tab)

---

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
