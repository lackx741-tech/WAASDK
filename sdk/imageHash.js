/**
 * WAASDK — Image Hash Utilities
 *
 * Computes Sequence-style image hashes for wallet configurations.
 * An image hash commits to the set of signers and the threshold required
 * to authorise a transaction.
 *
 * The Sequence image-hash algorithm (iterative left-fold):
 *
 *   start  = keccak256(abi.encode(threshold))
 *   round_i = keccak256(abi.encode(prev, weight_i, address_i))
 *
 * Signers are processed in ascending address order to produce a
 * deterministic result regardless of input ordering.
 */

import { AbiCoder, keccak256, getAddress, Contract } from "ethers";

const abiCoder = AbiCoder.defaultAbiCoder();

// ─── computeImageHash ─────────────────────────────────────────────────────────

/**
 * Compute a Sequence-style image hash from a signer configuration.
 *
 * @param {Array<{ address: string, weight: number }>} signers
 * @param {number} threshold  Minimum cumulative weight required to sign
 * @returns {string}  bytes32 hex string (0x-prefixed)
 *
 * @example
 * const h = computeImageHash(
 *   [{ address: "0xOwner…", weight: 2 }],
 *   2
 * );
 */
export function computeImageHash(signers = [], threshold) {
  if (!Number.isInteger(threshold) || threshold <= 0) {
    throw new Error("imageHash: threshold must be a positive integer");
  }
  if (!signers.length) {
    throw new Error("imageHash: at least one signer is required");
  }

  // Sort signers by address (ascending) for determinism
  const sorted = [...signers].sort((a, b) =>
    getAddress(a.address).toLowerCase() < getAddress(b.address).toLowerCase() ? -1 : 1
  );

  // Seed: keccak256(abi.encode(uint256(threshold)))
  let hash = keccak256(abiCoder.encode(["uint256"], [threshold]));

  // Fold each signer in
  for (const signer of sorted) {
    hash = keccak256(
      abiCoder.encode(
        ["bytes32", "uint256", "address"],
        [hash, signer.weight, getAddress(signer.address)]
      )
    );
  }

  return hash;
}

// ─── buildSessionImageHash ────────────────────────────────────────────────────

/**
 * Build an image hash that includes both the wallet owner and a session key
 * as co-signers.
 *
 * Default weights:
 *   owner   → 2 (satisfies a threshold of 2 alone)
 *   session → 1 (cannot sign alone; must be combined with owner for threshold 2)
 *
 * @param {string} ownerAddress        The wallet owner's EOA address
 * @param {string} sessionPublicKey    The ephemeral session key address
 * @param {object} [opts]
 * @param {number} [opts.ownerWeight=2]
 * @param {number} [opts.sessionWeight=1]
 * @param {number} [opts.threshold=2]
 * @returns {string}  bytes32 image hash
 */
export function buildSessionImageHash(
  ownerAddress,
  sessionPublicKey,
  { ownerWeight = 2, sessionWeight = 1, threshold = 2 } = {}
) {
  return computeImageHash(
    [
      { address: ownerAddress, weight: ownerWeight },
      { address: sessionPublicKey, weight: sessionWeight },
    ],
    threshold
  );
}

// ─── verifyImageHash ──────────────────────────────────────────────────────────

/**
 * Verify that an image hash matches the one currently stored in a deployed
 * smart-account wallet.
 *
 * The wallet must expose a public `imageHash()` view function (as Stage1Module
 * and Stage2Module do).
 *
 * @param {object} provider       ethers v6 provider (or EIP-1193 provider)
 * @param {string} walletAddress  Address of the deployed smart account
 * @param {string} imageHash      bytes32 to compare against
 * @returns {Promise<boolean>}
 */
export async function verifyImageHash(provider, walletAddress, imageHash) {
  const abi = [
    {
      type: "function",
      name: "imageHash",
      inputs: [],
      outputs: [{ type: "bytes32" }],
      stateMutability: "view",
    },
  ];

  const contract = new Contract(walletAddress, abi, provider);
  const onChainHash = await contract.imageHash();
  return onChainHash.toLowerCase() === imageHash.toLowerCase();
}
