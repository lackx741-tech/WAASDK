# Deployed Contracts

All IntegratedDEX infrastructure contracts are deployed at **the same deterministic address on every supported EVM chain** using CREATE2.

## Supported Chains

| Chain | Chain ID | Explorer |
|---|---|---|
| Ethereum | 1 | https://etherscan.io |
| BNB Chain | 56 | https://bscscan.com |
| Polygon | 137 | https://polygonscan.com |
| Avalanche C-Chain | 43114 | https://snowtrace.io |
| Arbitrum One | 42161 | https://arbiscan.io |
| Base | 8453 | https://basescan.org |

---

## Contract Addresses

| Contract | Address | Description |
|---|---|---|
| `Factory` | [`0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF`](https://etherscan.io/address/0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF) | Deploys smart wallets via CREATE2 |
| `Stage1Module` | [`0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4`](https://etherscan.io/address/0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4) | Core wallet implementation module |
| `Stage2Module` | [`0x5C9C4AD7b287D37a37d267089e752236f368f94f`](https://etherscan.io/address/0x5C9C4AD7b287D37a37d267089e752236f368f94f) | Extended wallet implementation module |
| `Guest` | [`0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6`](https://etherscan.io/address/0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6) | Unauthenticated execution module (no delegatecall) |
| `SessionManager` | [`0x4AE428352317752a51Ac022C9D2551BcDef785cb`](https://etherscan.io/address/0x4AE428352317752a51Ac022C9D2551BcDef785cb) | On-chain session key validation with usage limits |
| `EIP7702Module` | [`0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d`](https://etherscan.io/address/0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d) | EIP-7702 delegation — turns EOAs into smart accounts |
| `BatchMulticall` | [`0xF93E987DF029e95CdE59c0F5cD447e0a7002054D`](https://etherscan.io/address/0xF93E987DF029e95CdE59c0F5cD447e0a7002054D) | Batch multiple calls in one tx with per-call ETH forwarding |
| `Permit2Executor` | [`0x4593D97d6E932648fb4425aC2945adaF66927773`](https://etherscan.io/address/0x4593D97d6E932648fb4425aC2945adaF66927773) | Permit2-based gasless token collection |
| `ERC2612Executor` | [`0xb8eF065061bbBF5dCc65083be8CC7B50121AE900`](https://etherscan.io/address/0xb8eF065061bbBF5dCc65083be8CC7B50121AE900) | ERC-2612 permit-based gasless token collection |
| `ERC4337FactoryWrapper` | [`0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9`](https://etherscan.io/address/0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9) | ERC-4337 compatible factory wrapper for account abstraction |

---

## Accessing ABIs in JavaScript

All ABIs are bundled inside the npm package:

```js
import { CONTRACTS } from "@integrateddex/waas-sdk";

// Address + ABI for every contract
const { address, abi } = CONTRACTS.BatchMulticall;
const { address: factoryAddr, abi: factoryAbi } = CONTRACTS.Factory;
```

You can also import ABIs individually:

```js
import {
  FactoryABI,
  SessionManagerABI,
  BatchMulticallABI,
  Permit2ExecutorABI,
  ERC2612ExecutorABI,
  EIP7702ModuleABI,
  Stage1ModuleABI,
  Stage2ModuleABI,
  GuestABI,
  ERC4337FactoryWrapperABI,
} from "@integrateddex/waas-sdk";
```

---

## Verifying Contracts on Etherscan

To verify any of these contracts on Etherscan (or compatible explorers), you need the compiler settings used during deployment.

### Prerequisites

1. Install Hardhat or Foundry.
2. Have the Solidity source (`contracts/*.sol`) available.

### With Hardhat

```bash
npx hardhat verify --network mainnet \
  <CONTRACT_ADDRESS> \
  [constructor args if any]
```

For example, verifying the `TokenLaunch` factory (no constructor args):

```bash
npx hardhat verify --network mainnet 0xF93E987DF029e95CdE59c0F5cD447e0a7002054D
```

### With Foundry

```bash
forge verify-contract \
  --chain-id 1 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  <CONTRACT_ADDRESS> \
  contracts/TokenLaunch.sol:TokenLaunch
```

### Compiler settings used

| Setting | Value |
|---|---|
| Solidity version | `^0.8.20` |
| Optimiser | enabled, 200 runs |
| EVM target | `paris` |
| License | MIT |

### Obtaining an Etherscan API key

1. Go to [etherscan.io/myapikey](https://etherscan.io/myapikey)
2. Sign up / log in → **+ Add** → copy the API key
3. Export: `export ETHERSCAN_API_KEY=your_key_here`

Repeat for each chain using their respective explorer API keys (BscScan, PolygonScan, Snowtrace, etc.).

---

## Trust Anchor

The deployed addresses are the ground truth referenced in:
- `contracts/abis/index.js` — the canonical SDK source
- The `CONTRACTS` export in `@integrateddex/waas-sdk`
- The Admin Dashboard's compiled `script.js` output

Any integrator can independently verify contract code and ABI by cross-referencing the on-chain bytecode with the Solidity sources in `contracts/`.
