/**
 * IntegratedDEX WaaS SDK — ERC-4337 Account Abstraction Module
 *
 * Builds, signs and submits ERC-4337 UserOperations to the EntryPoint v0.7
 * singleton. Works with any ERC-4337 compatible smart account deployed by
 * the Factory or ERC4337FactoryWrapper.
 *
 * EntryPoint v0.7: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
 *
 * ERC-4337 v0.7 packs several gas fields differently from v0.6:
 *  - accountGasLimits: (verificationGasLimit << 128) | callGasLimit  (bytes32)
 *  - gasFees:          (maxPriorityFeePerGas << 128) | maxFeePerGas  (bytes32)
 */

import { CONTRACTS, ABIS } from './constants.js';

// ─── Default Gas Values ───────────────────────────────────────────────────────

const DEFAULT_VERIFICATION_GAS  = 150_000n;
const DEFAULT_CALL_GAS          = 200_000n;
const DEFAULT_PRE_VERIFICATION  = 50_000n;
const DEFAULT_MAX_FEE            = 2_000_000_000n; // 2 gwei
const DEFAULT_MAX_PRIORITY_FEE  = 1_000_000_000n; // 1 gwei

// ─── UserOp Builder ───────────────────────────────────────────────────────────

/**
 * Build a v0.7 UserOperation object with sensible defaults.
 *
 * All gas fields can be overridden. For production use, fetch live gas
 * estimates from a bundler's `eth_estimateUserOperationGas` endpoint.
 *
 * @param {object} opts
 * @param {string}  opts.sender             Smart account address
 * @param {string}  opts.callData           Encoded function call
 * @param {bigint}  [opts.nonce=0n]         Account nonce
 * @param {string}  [opts.initCode='0x']    Non-empty only when deploying the account
 * @param {string}  [opts.paymasterData='0x'] Paymaster and data bytes
 * @param {bigint}  [opts.verificationGasLimit]
 * @param {bigint}  [opts.callGasLimit]
 * @param {bigint}  [opts.preVerificationGas]
 * @param {bigint}  [opts.maxFeePerGas]
 * @param {bigint}  [opts.maxPriorityFeePerGas]
 * @returns {object}  Unsigned UserOperation (v0.7 format)
 */
export function buildUserOp({
  sender,
  callData,
  nonce              = 0n,
  initCode           = '0x',
  paymasterData      = '0x',
  verificationGasLimit = DEFAULT_VERIFICATION_GAS,
  callGasLimit         = DEFAULT_CALL_GAS,
  preVerificationGas   = DEFAULT_PRE_VERIFICATION,
  maxFeePerGas         = DEFAULT_MAX_FEE,
  maxPriorityFeePerGas = DEFAULT_MAX_PRIORITY_FEE,
}) {
  if (!sender) throw new Error('buildUserOp: sender is required');
  if (!callData) throw new Error('buildUserOp: callData is required');

  // Pack gas limits into bytes32 fields (ERC-4337 v0.7)
  const accountGasLimits = _packUint128(verificationGasLimit, callGasLimit);
  const gasFees          = _packUint128(maxPriorityFeePerGas, maxFeePerGas);

  return {
    sender,
    nonce:              BigInt(nonce),
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas: BigInt(preVerificationGas),
    gasFees,
    paymasterAndData:   paymasterData,
    signature:          '0x', // populated by signUserOp()
  };
}

// ─── Signing ──────────────────────────────────────────────────────────────────

/**
 * Compute the hash of a UserOperation as returned by EntryPoint.getUserOpHash().
 *
 * @param {object} provider  ethers v6 provider
 * @param {object} userOp    UserOperation object (from buildUserOp)
 * @returns {Promise<string>}  0x-prefixed bytes32 hash
 */
export async function getUserOpHash(provider, userOp) {
  const { Contract } = await import('ethers');
  const entryPoint = new Contract(CONTRACTS.EntryPoint, ABIS.EntryPoint, provider);
  return await entryPoint.getUserOpHash(userOp);
}

/**
 * Sign a UserOperation.
 *
 * The signer must be the owner (or a valid session key) of the smart account
 * at userOp.sender.
 *
 * @param {object} userOp    UserOperation object (from buildUserOp)
 * @param {object} signer    ethers v6 Signer
 * @param {object} provider  ethers v6 provider (used to compute the hash)
 * @returns {Promise<object>}  UserOperation with signature populated
 */
export async function signUserOp(userOp, signer, provider) {
  const hash      = await getUserOpHash(provider, userOp);
  const signature = await signer.signMessage(hash);
  return { ...userOp, signature };
}

// ─── Submission ───────────────────────────────────────────────────────────────

/**
 * Submit a signed UserOperation to the EntryPoint.
 *
 * In production the beneficiary address should be the bundler's address so
 * they recover the gas cost. For testing you can use any address.
 *
 * @param {object} signer      ethers v6 Signer (the bundler, or your backend signer)
 * @param {object} userOp      Signed UserOperation
 * @param {string} [beneficiary]  Address that receives the gas refund (defaults to signer)
 * @returns {Promise<object>}  Transaction response
 */
export async function submitUserOp(signer, userOp, beneficiary) {
  const { Contract } = await import('ethers');

  const resolvedBeneficiary = beneficiary ?? (await signer.getAddress());

  const entryPoint = new Contract(CONTRACTS.EntryPoint, ABIS.EntryPoint, signer);
  return await entryPoint.handleOps([userOp], resolvedBeneficiary);
}

/**
 * Deposit ETH into the EntryPoint for a smart account (pre-fund gas).
 *
 * @param {object} signer   ethers v6 Signer
 * @param {string} account  Smart account address to deposit for
 * @param {bigint} amount   Amount in wei
 * @returns {Promise<object>}  Transaction response
 */
export async function depositToEntryPoint(signer, account, amount) {
  const { Contract } = await import('ethers');
  const entryPoint = new Contract(CONTRACTS.EntryPoint, ABIS.EntryPoint, signer);
  return await entryPoint.depositTo(account, { value: amount });
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Pack two uint128 values into a bytes32 (hi << 128 | lo).
 * Used for accountGasLimits and gasFees in ERC-4337 v0.7.
 * @param {bigint} hi
 * @param {bigint} lo
 * @returns {string}  0x-prefixed 32-byte hex string
 */
function _packUint128(hi, lo) {
  const packed = (BigInt(hi) << 128n) | BigInt(lo);
  return '0x' + packed.toString(16).padStart(64, '0');
}
