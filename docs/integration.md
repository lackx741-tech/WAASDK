# Developer Integration Guide

## Install

```bash
npm install @integrateddex/waas-sdk ethers
```

> **Peer dependencies** — `ethers@^6` is required. `viem`, `wagmi`, and `@web3modal/wagmi` are needed only if you use the wallet-connection module (`sdk/wallet.js`). Install them if you want the full WalletConnect flow:
> ```bash
> npm install viem wagmi @web3modal/wagmi
> ```

---

## Quick Start

### 1 — Initialise the SDK

```js
import { initSDK } from "@integrateddex/waas-sdk";

const { wallet } = initSDK({
  projectId: "YOUR_WALLETCONNECT_PROJECT_ID",  // https://cloud.walletconnect.com
  chains:    [1, 56, 137, 43114],              // Ethereum, BSC, Polygon, Avalanche
  appName:   "My dApp",
  appUrl:    "https://example.com",
});
```

### 2 — Connect a wallet

```js
const { account, chainId } = await wallet.connect();

wallet.on("connect",      ({ account, chainId }) => console.log("connected", account));
wallet.on("disconnect",   ()                     => console.log("disconnected"));
wallet.on("chainChanged", ({ chainId })           => console.log("chain", chainId));
```

### 3 — Sign a Permit2 approval

User approves an **exact amount** — max approval is never set by default.

```js
import { signPermitSingle } from "@integrateddex/waas-sdk";

const provider = await wallet.getSigner();

const { signature, deadline } = await signPermitSingle(provider, account, chainId, {
  token:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on mainnet
  amount:  500_000_000n,   // 500 USDC (6 decimals) — explicit, never max
  spender: "0xYourContractAddress",
});
```

### 4 — Batch reads with Multicall3

```js
import { multicallRead, buildCall } from "@integrateddex/waas-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_KEY");

const erc20BalanceOf = ethers.id("balanceOf(address)").slice(0, 10);
const encoded = ethers.concat([erc20BalanceOf, ethers.zeroPadValue(account, 32)]);

const results = await multicallRead(provider, [
  buildCall("0xUSDC_ADDRESS", encoded),
  buildCall("0xDAI_ADDRESS",  encoded),
]);

// results[0].success, results[0].returnData
```

### 5 — Load and call any contract

```js
import { loadContract, readContract, writeContract } from "@integrateddex/waas-sdk";

const abi  = [/* your ABI */];
const contract = loadContract("0xYourContract", abi, provider);

// Read
const balance = await readContract(contract, "balanceOf", [account]);

// Write (requires a signer)
const signer  = await wallet.getSigner();
const receipt = await writeContract(contract.connect(signer), "mint", [account, 1000n]);
console.log("tx:", receipt.hash);
```

### 6 — EIP-712 typed signing

```js
import { buildDomain, buildTypedData, signTypedData } from "@integrateddex/waas-sdk";

const domain = buildDomain({
  name:              "MyApp",
  version:           "1",
  chainId:           1,
  verifyingContract: "0xYourContract",
});

const typedData = buildTypedData(
  domain,
  { Order: [{ name: "amount", type: "uint256" }, { name: "recipient", type: "address" }] },
  "Order",
  { amount: 42n, recipient: account }
);

const sig = await signTypedData(provider, account, typedData);
```

---

## Accessing Deployed Contracts

All IntegratedDEX infrastructure contracts are deployed at the same address on every supported EVM chain and are exported directly from the SDK:

```js
import { CONTRACTS } from "@integrateddex/waas-sdk";

// Address + ABI for every contract
const { address, abi } = CONTRACTS.BatchMulticall;
const { address: smAddr, abi: smAbi } = CONTRACTS.SessionManager;

// Use loadContract to get an ethers Contract instance
const batchMulticall = loadContract(address, abi, provider);
```

See [contracts.md](./contracts.md) for full addresses and Etherscan links.

---

## Using the Pre-compiled IIFE Bundle (no bundler needed)

```html
<!-- ethers v6 peer dep -->
<script src="https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.umd.min.js"></script>

<!-- WaaS SDK IIFE bundle (built with `npm run build`) -->
<script src="dist/script.js"></script>

<script>
  const { wallet } = WaaSSDK.initSDK({
    projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
    chains: [1, 137],
    appName: "My dApp",
  });

  document.getElementById("connectBtn").addEventListener("click", () => wallet.connect());
</script>
```

---

## Framework Examples

| Framework | Example |
|---|---|
| Vanilla JS | [`examples/vanilla-js/index.html`](../examples/vanilla-js/index.html) |
| React | [`examples/react/README.md`](../examples/react/README.md) |

---

## Utility Reference

```js
import {
  isValidAddress,      // (addr: string) => boolean
  shortenAddress,      // (addr: string) => "0x1234…abcd"
  parseAmount,         // (value: string, decimals?: number) => bigint
  formatAmount,        // (value: bigint, decimals?: number) => string
  getChainInfo,        // (chainId: number) => { name, explorer, nativeCurrency }
  getNativeCurrencySymbol, // (chainId: number) => "ETH" | "BNB" | …
  getExplorerUrl,      // (chainId: number) => "https://etherscan.io"
  getTxUrl,            // (txHash: string, chainId: number) => full explorer URL
  deadlineFromNow,     // (minutes: number) => Unix timestamp
  sleep,               // (ms: number) => Promise<void>
  SUPPORTED_CHAINS,    // Record<number, ChainInfo>
} from "@integrateddex/waas-sdk";
```

---

## Publishing a new version (maintainers)

```bash
npm run build          # build dist/ bundles
npm version patch      # bump version
npm publish --access public
```
