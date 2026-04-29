/**
 * WAASDK — EIP-7702 Session Key Module
 *
 * Integrates the single-signature flow for EIP-7702 EOA delegation:
 *   1. Generate an ephemeral session keypair
 *   2. Build the new image hash (owner + session key as co-signers)
 *   3. Sign once to authorize the session key and update the image hash
 *
 * Deployed singletons used:
 *   EIP7702Module : 0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d
 *   Stage1Module  : 0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4
 */

import { Wallet } from "ethers";
import { buildSessionImageHash } from "./imageHash.js";
import { signSessionWithImageHash } from "./sessionAuth.js";
import { CONTRACT_ADDRESSES } from "../contracts/abis/index.js";

// ─── createSessionKey ─────────────────────────────────────────────────────────

/**
 * Generate an ephemeral session keypair and sign the combined session +
 * imageHash payload in a **single user signature**.
 *
 * The returned result can be submitted with `submitSessionWithImageHash`.
 *
 * @param {object} provider   EIP-1193 provider (e.g. window.ethereum)
 * @param {string} account    Wallet owner address
 * @param {object} options
 * @param {string[]} options.allowedContracts  Contract addresses the session may call
 * @param {string[]} options.allowedFunctions  Function signatures e.g. ['contribute(uint256)']
 * @param {string}   options.spendingLimit     Max ETH spend, human-readable e.g. "0.5"
 * @param {number}   options.expiresAt         Unix timestamp expiry
 * @param {number}   options.chainId           EVM chain ID
 * @param {object}   [options.imageHashOpts]   Override image hash weights / threshold
 * @param {number}   [options.imageHashOpts.ownerWeight=2]
 * @param {number}   [options.imageHashOpts.sessionWeight=1]
 * @param {number}   [options.imageHashOpts.threshold=2]
 * @returns {Promise<{
 *   sessionKey: string,
 *   sessionPrivateKey: string,
 *   imageHash: string,
 *   signature: string,
 *   attestation: object,
 *   payload: object,
 * }>}
 */
export async function createSessionKey(provider, account, {
  allowedContracts = [],
  allowedFunctions = [],
  spendingLimit = "0",
  expiresAt,
  chainId,
  imageHashOpts = {},
} = {}) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("eip7702: invalid provider — must expose an EIP-1193 request() method");
  }
  if (!account) throw new Error("eip7702: no account provided");
  if (!expiresAt) throw new Error("eip7702: expiresAt is required");
  if (!chainId) throw new Error("eip7702: chainId is required");

  // 1. Generate an ephemeral session keypair
  const sessionWallet = Wallet.createRandom();
  const sessionPublicKey = sessionWallet.address;
  const sessionPrivateKey = sessionWallet.privateKey;

  // 2. Build the new image hash (owner + session key as co-signers)
  const imageHash = buildSessionImageHash(account, sessionPublicKey, imageHashOpts);

  // 3. Single user signature for both session authorization + image hash update
  const sessionAuthResult = await signSessionWithImageHash(provider, account, {
    sessionPublicKey,
    allowedContracts,
    allowedFunctions,
    spendingLimit,
    expiresAt,
    chainId,
    imageHash,
  });

  return {
    sessionKey: sessionPublicKey,
    sessionPrivateKey,
    imageHash,
    signature: sessionAuthResult.signature,
    attestation: sessionAuthResult.attestation,
    payload: sessionAuthResult.payload,
    eip7702Module: CONTRACT_ADDRESSES.EIP7702Module,
  };
}
