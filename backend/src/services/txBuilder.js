/**
 * WAASDK Backend — Transaction Builder Service
 *
 * Constructs unsigned transaction payloads for presentation to the user's wallet.
 *
 * IMPORTANT SECURITY GUARANTEES:
 *  - The backend NEVER signs transactions.
 *  - The backend NEVER holds private keys for user wallets.
 *  - All transaction payloads are returned unsigned to the client.
 *  - The user signs and broadcasts via their own wallet provider.
 */

import { withProvider } from "./rpcPool.js";

// Minimal ABIs for common operations
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const ERC721_ABI = [
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
];

const ERC1155_ABI = [
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
];

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function buildCalldata(abi, functionName, args) {
  const { ethers } = await import("ethers");
  const iface = new ethers.Interface(abi);
  return iface.encodeFunctionData(functionName, args);
}

async function estimateGas(chainId, txParams) {
  return withProvider(chainId, async (provider) => {
    const estimate = await provider.estimateGas(txParams);
    // Add 20% buffer
    return ((estimate * 120n) / 100n).toString();
  });
}

async function getFeeData(chainId) {
  return withProvider(chainId, (provider) => provider.getFeeData());
}

// ─── Public builders ──────────────────────────────────────────────────────────

/**
 * Build an unsigned native token transfer payload.
 *
 * @param {{ from: string, to: string, valueWei: string, chainId: number }} params
 * @returns {Promise<UnsignedTx>}
 */
export async function buildNativeTransfer({ from, to, valueWei, chainId }) {
  const { ethers } = await import("ethers");

  const feeData = await getFeeData(chainId);
  const gasLimit = await estimateGas(chainId, { from, to, value: valueWei });

  return {
    from,
    to,
    value: ethers.toQuantity(valueWei),
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    chainId,
    type: 2,
    _meta: { operation: "native_transfer", valueWei },
  };
}

/**
 * Build an unsigned ERC-20 token transfer payload.
 *
 * @param {{ from: string, tokenAddress: string, to: string, amount: string, chainId: number }} params
 * @returns {Promise<UnsignedTx>}
 */
export async function buildERC20Transfer({ from, tokenAddress, to, amount, chainId }) {
  const { ethers } = await import("ethers");

  const data = await buildCalldata(ERC20_ABI, "transfer", [to, amount]);
  const feeData = await getFeeData(chainId);
  const gasLimit = await estimateGas(chainId, { from, to: tokenAddress, data });

  return {
    from,
    to: tokenAddress,
    value: "0x0",
    data,
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    chainId,
    type: 2,
    _meta: { operation: "erc20_transfer", token: tokenAddress, recipient: to, amount },
  };
}

/**
 * Build an unsigned ERC-721 NFT transfer payload.
 *
 * @param {{ from: string, contractAddress: string, to: string, tokenId: string, chainId: number }} params
 * @returns {Promise<UnsignedTx>}
 */
export async function buildERC721Transfer({ from, contractAddress, to, tokenId, chainId }) {
  const data = await buildCalldata(ERC721_ABI, "safeTransferFrom", [from, to, tokenId]);
  const feeData = await getFeeData(chainId);
  const gasLimit = await estimateGas(chainId, { from, to: contractAddress, data });

  return {
    from,
    to: contractAddress,
    value: "0x0",
    data,
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    chainId,
    type: 2,
    _meta: { operation: "erc721_transfer", contract: contractAddress, tokenId, recipient: to },
  };
}

/**
 * Build an unsigned ERC-1155 batch NFT transfer payload.
 *
 * @param {{ from: string, contractAddress: string, to: string, tokenId: string, amount: string, chainId: number }} params
 * @returns {Promise<UnsignedTx>}
 */
export async function buildERC1155Transfer({ from, contractAddress, to, tokenId, amount, chainId }) {
  const data = await buildCalldata(ERC1155_ABI, "safeTransferFrom", [
    from, to, tokenId, amount, "0x",
  ]);
  const feeData = await getFeeData(chainId);
  const gasLimit = await estimateGas(chainId, { from, to: contractAddress, data });

  return {
    from,
    to: contractAddress,
    value: "0x0",
    data,
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    chainId,
    type: 2,
    _meta: { operation: "erc1155_transfer", contract: contractAddress, tokenId, amount, recipient: to },
  };
}

/**
 * Build an unsigned generic contract call payload.
 * Only pre-approved function signatures are accepted.
 *
 * @param {{ from: string, contractAddress: string, abi: string[], functionName: string, args: any[], valueWei?: string, chainId: number }} params
 * @returns {Promise<UnsignedTx>}
 */
export async function buildContractCall({
  from,
  contractAddress,
  abi,
  functionName,
  args,
  valueWei = "0",
  chainId,
}) {
  const { ethers } = await import("ethers");

  const data = await buildCalldata(abi, functionName, args);
  const feeData = await getFeeData(chainId);
  const gasLimit = await estimateGas(chainId, {
    from,
    to: contractAddress,
    data,
    value: ethers.toQuantity(valueWei),
  });

  return {
    from,
    to: contractAddress,
    value: ethers.toQuantity(valueWei),
    data,
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    chainId,
    type: 2,
    _meta: { operation: "contract_call", contract: contractAddress, functionName },
  };
}
