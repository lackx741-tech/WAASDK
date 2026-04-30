# React Integration Example

This guide shows how to integrate `@integrateddex/waas-sdk` into a React app using hooks.

## Install

```bash
npm create vite@latest my-dapp -- --template react
cd my-dapp
npm install @integrateddex/waas-sdk ethers viem wagmi @web3modal/wagmi
```

---

## 1 — SDK singleton (`src/sdk.js`)

Create the SDK once outside of React so it is shared across components.

```js
// src/sdk.js
import { initSDK } from "@integrateddex/waas-sdk";

export const { wallet, config } = initSDK({
  projectId:      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  chains:         [1, 56, 137, 43114],
  appName:        "My dApp",
  appDescription: "A great dApp",
  appUrl:         "https://example.com",
});
```

---

## 2 — Wallet hook (`src/hooks/useWallet.js`)

```js
// src/hooks/useWallet.js
import { useEffect, useState, useCallback } from "react";
import { wallet } from "../sdk";

export function useWallet() {
  const [account,  setAccount]  = useState(null);
  const [chainId,  setChainId]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    wallet.on("connect",      ({ account, chainId }) => { setAccount(account); setChainId(chainId); });
    wallet.on("disconnect",   ()                     => { setAccount(null);    setChainId(null);    });
    wallet.on("chainChanged", ({ chainId })           => setChainId(chainId));
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await wallet.connect();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => wallet.disconnect(), []);

  return { account, chainId, loading, error, connect, disconnect };
}
```

---

## 3 — ConnectButton component (`src/components/ConnectButton.jsx`)

```jsx
// src/components/ConnectButton.jsx
import { useWallet } from "../hooks/useWallet";
import { shortenAddress, getNativeCurrencySymbol } from "@integrateddex/waas-sdk";

export function ConnectButton() {
  const { account, chainId, loading, connect, disconnect } = useWallet();

  if (account) {
    return (
      <button onClick={disconnect}>
        {shortenAddress(account)} · {getNativeCurrencySymbol(chainId)}
      </button>
    );
  }

  return (
    <button onClick={connect} disabled={loading}>
      {loading ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
```

---

## 4 — Permit2 hook (`src/hooks/usePermit2.js`)

```js
// src/hooks/usePermit2.js
import { useState, useCallback } from "react";
import { signPermitSingle } from "@integrateddex/waas-sdk";
import { wallet } from "../sdk";

export function usePermit2() {
  const [sig,     setSig]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const approve = useCallback(async ({ token, amount, spender, chainId, account }) => {
    setLoading(true);
    setError(null);
    try {
      const provider = await wallet.getSigner();
      const result   = await signPermitSingle(provider, account, chainId, {
        token,
        amount, // exact bigint — never auto-maxed
        spender,
      });
      setSig(result);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sig, loading, error, approve };
}
```

---

## 5 — App entry (`src/App.jsx`)

```jsx
// src/App.jsx
import { ConnectButton } from "./components/ConnectButton";
import { useWallet }     from "./hooks/useWallet";
import { usePermit2 }    from "./hooks/usePermit2";

export default function App() {
  const { account, chainId } = useWallet();
  const { approve, loading, sig, error } = usePermit2();

  const handleApprove = async () => {
    if (!account) return;
    await approve({
      token:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      amount:  100_000_000n,    // 100 USDC
      spender: "0xYourContractAddress",
      chainId,
      account,
    });
  };

  return (
    <main>
      <ConnectButton />

      {account && (
        <>
          <p>Signed in as: {account}</p>
          <button onClick={handleApprove} disabled={loading}>
            {loading ? "Signing…" : "Approve 100 USDC (Permit2)"}
          </button>
          {sig   && <pre>{JSON.stringify(sig, null, 2)}</pre>}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </>
      )}
    </main>
  );
}
```

---

## 6 — Environment variables (`.env`)

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

---

## Run

```bash
npm run dev
```

---

## Next steps

- See [integration.md](../docs/integration.md) for the full API reference.
- See [contracts.md](../docs/contracts.md) for deployed contract addresses and Etherscan links.
- Use the **Admin Dashboard** (`dashboard/index.html`) to generate a no-bundler `script.js`.
