/**
 * IntegratedDEX WaaS SDK — Smart Account Factory Module
 *
 * Deploys and manages smart accounts via the CREATE2 Factory singleton.
 * Also supports ERC-4337 UserOperation-style deployment via the
 * ERC4337FactoryWrapper.
 *
 * Factory contract:               0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF
 * ERC4337FactoryWrapper contract: 0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9
 *
 * Because both contracts are CREATE2 singletons the same account address is
 * deterministic across every EVM chain — compute once, deploy anywhere.
 */

import { CONTRACTS, ABIS } from './constants.js';

// ─── Address Computation ──────────────────────────────────────────────────────

/**
 * Compute the deterministic CREATE2 address for a smart account.
 *
 * No transaction is sent — this is a pure view call.
 *
 * @param {object} provider  ethers v6 provider
 * @param {string} owner     Owner address of the smart account
 * @param {number|bigint} [salt=0]  CREATE2 salt
 * @returns {Promise<string>}  The smart account address (same on all chains)
 */
export async function computeAccountAddress(provider, owner, salt = 0) {
  const { Contract } = await import('ethers');
  const factory = new Contract(CONTRACTS.Factory, ABIS.Factory, provider);
  return await factory.getAddress(owner, BigInt(salt));
}

// ─── Deployment ───────────────────────────────────────────────────────────────

/**
 * Deploy a new smart account for an owner via the Factory.
 *
 * If the account is already deployed, the factory is idempotent and returns
 * the existing address. Always check isAccountDeployed() first if you want
 * to avoid paying gas unnecessarily.
 *
 * @param {object} provider  ethers v6 provider (for address lookup after deploy)
 * @param {object} signer    ethers v6 Signer (pays gas for the deployment)
 * @param {string} owner     Owner address of the new smart account
 * @param {number|bigint} [salt=0]  CREATE2 salt
 * @returns {Promise<{ address: string, txHash: string }>}
 */
export async function deploySmartAccount(provider, signer, owner, salt = 0) {
  const { Contract } = await import('ethers');
  const factory = new Contract(CONTRACTS.Factory, ABIS.Factory, signer);

  const tx      = await factory.createAccount(owner, BigInt(salt));
  const receipt = await tx.wait();
  const address = await computeAccountAddress(provider, owner, salt);

  return { address, txHash: receipt.hash };
}

/**
 * Check whether a smart account has already been deployed.
 *
 * @param {object} provider  ethers v6 provider
 * @param {string} owner     Owner address
 * @param {number|bigint} [salt=0]  CREATE2 salt
 * @returns {Promise<boolean>}
 */
export async function isAccountDeployed(provider, owner, salt = 0) {
  const { Contract } = await import('ethers');
  const factory = new Contract(CONTRACTS.Factory, ABIS.Factory, provider);
  return await factory.isDeployed(owner, BigInt(salt));
}

/**
 * Deploy a smart account via the ERC-4337 UserOperation-style factory wrapper.
 *
 * This is the recommended path when using ERC-4337 account abstraction —
 * the wrapper produces initCode compatible with the EntryPoint's CREATE2 flow.
 *
 * @param {object} provider  ethers v6 provider
 * @param {object} signer    ethers v6 Signer
 * @param {string} owner     Owner address
 * @param {number|bigint} [salt=0]  CREATE2 salt
 * @returns {Promise<object>}  Transaction response
 */
export async function deployAccountViaERC4337(provider, signer, owner, salt = 0) {
  const { Contract } = await import('ethers');
  const wrapper = new Contract(
    CONTRACTS.ERC4337FactoryWrapper,
    ABIS.ERC4337FactoryWrapper,
    signer,
  );
  return await wrapper.createAccount(owner, BigInt(salt));
}

// ─── initCode Helper ──────────────────────────────────────────────────────────

/**
 * Build the `initCode` bytes used in an ERC-4337 UserOperation to deploy a
 * new smart account.
 *
 * initCode = ERC4337FactoryWrapper address (20 bytes) + createAccount calldata
 *
 * @param {string} owner           Owner address
 * @param {number|bigint} [salt=0] CREATE2 salt
 * @returns {Promise<string>}  0x-prefixed initCode
 */
export async function buildInitCode(owner, salt = 0) {
  const { Interface, concat } = await import('ethers');

  const iface    = new Interface(ABIS.ERC4337FactoryWrapper);
  const callData = iface.encodeFunctionData('createAccount', [owner, BigInt(salt)]);

  return concat([CONTRACTS.ERC4337FactoryWrapper, callData]);
}
