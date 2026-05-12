# WAASDK Web3 Dashboard

A production-ready Next.js 14 Web3 SaaS dashboard for configuring smart contracts and generating embeddable scripts with full WalletConnect integration.

## Features

- **Config Builder** — General, Wallet, Contract, and Advanced settings with form validation
- **Live Dashboard** — Wallet info, native balance, block number, transaction history
- **Contract Executor** — Execute read/write functions with live calldata preview and gas estimation
- **Script Generator** — Build and download `script.js` with WalletConnect integration for embedding in any website

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Web3 | wagmi v2, viem, RainbowKit |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| State | Zustand (persisted to localStorage) |
| Notifications | react-hot-toast |

## Quick Start

```bash
cd web3-dashboard
npm install
cp .env.example .env.local
# Edit .env.local with your WalletConnect Project ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

Get a free WalletConnect Project ID at [cloud.walletconnect.com](https://cloud.walletconnect.com).

## Generated script.js API

The generated `script.js` exposes a global `WAASDK` object:

```html
<script src="./script.js"></script>
<script>
  // Connect wallet
  const address = await WAASDK.connectWallet()

  // Execute contract function
  const balance = await WAASDK.executeFunction('balanceOf', ['0x...'])

  // Listen for events
  WAASDK.on('walletConnected', ({ address }) => console.log(address))
  WAASDK.on('transactionSuccess', ({ txHash }) => console.log(txHash))
</script>
```

### Full API

| Method | Description |
|--------|-------------|
| `connectWallet()` | Connect via MetaMask / injected wallet |
| `disconnectWallet()` | Disconnect current wallet |
| `executeFunction(name, args, opts)` | Call read or write contract function |
| `getAddress()` | Get connected wallet address |
| `getChainId()` | Get current chain ID |
| `isConnected()` | Check connection status |
| `getBalance(address?)` | Get native token balance in wei |
| `getConfig()` | Get current SDK configuration |
| `on(event, handler)` | Subscribe to events (returns unsubscribe fn) |
| `showToast(msg, type)` | Show a toast notification |

### Events

| Event | Payload |
|-------|---------|
| `walletConnected` | `{ address, chainId }` |
| `walletDisconnected` | `{}` |
| `accountChanged` | `{ address }` |
| `chainChanged` | `{ chainId }` |
| `transactionSent` | `{ txHash, function, args }` |
| `transactionSuccess` | `{ txHash, receipt, function }` |
| `transactionFailed` | `{ txHash, receipt, function }` |
| `readResult` | `{ function, args, result }` |
| `error` | `{ type, message }` |

## Deploy to Vercel

```bash
vercel --prod
```

Or connect the `web3-dashboard/` directory to a Vercel project with root directory set to `web3-dashboard`.

## Supported Networks

- Ethereum Mainnet
- Polygon
- BNB Chain
- Avalanche
- Arbitrum
- Base
- Sepolia (testnet)
