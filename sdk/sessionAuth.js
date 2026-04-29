/**
 * WAASDK — Single-Signature Session + ImageHash Flow
 *
 * Implements a single-signature flow where the user signs once to
 * simultaneously:
 *   1. Authorize a session key (validated by SessionManager)
 *   2. Update the wallet's image hash (via Stage1Module.updateImageHash)
 *
 * The user sees a single `eth_sign` (EIP-191 personal_sign) prompt.
 * No hidden approvals — the combined hash encodes both intents.
 *
 * Deployed singletons used:
 *   SessionManager : 0x4AE428352317752a51Ac022C9D2551BcDef785cb
 *   Stage1Module   : 0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4
 */

import { AbiCoder, keccak256, Contract, Interface, parseEther } from "ethers";
import { CONTRACT_ADDRESSES, SessionManagerABI, Stage1ModuleABI } from "../contracts/abis/index.js";

const abiCoder = AbiCoder.defaultAbiCoder();

// ─── signSessionWithImageHash ─────────────────────────────────────────────────

/**
 * Build and sign a single EIP-191 payload that encodes both:
 *   - The session key attestation (key, permissions, limits, expiry, chainId)
 *   - The new image hash (wallet config hash after adding the session signer)
 *
 * The user is prompted once via `personal_sign`.
 *
 * @param {object} provider   EIP-1193 provider (e.g. window.ethereum)
 * @param {string} account    Signer address (wallet owner)
 * @param {object} options
 * @param {string}   options.sessionPublicKey   Ephemeral session key address
 * @param {string[]} options.allowedContracts   Contract addresses the session may call
 * @param {string[]} options.allowedFunctions   Function selectors / signatures
 * @param {string}   options.spendingLimit      Max ETH spend (human-readable, e.g. "0.5")
 * @param {number}   options.expiresAt          Unix timestamp
 * @param {number}   options.chainId            EVM chain ID
 * @param {string}   options.imageHash          bytes32 — new wallet image hash
 * @returns {Promise<{ signature: string, sessionKey: string, imageHash: string, payload: object, attestation: object }>}
 */
export async function signSessionWithImageHash(provider, account, {
  sessionPublicKey,
  allowedContracts,
  allowedFunctions,
  spendingLimit,
  expiresAt,
  chainId,
  imageHash,
}) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("sessionAuth: invalid provider — must expose an EIP-1193 request() method");
  }
  if (!account) throw new Error("sessionAuth: no account provided");
  if (!sessionPublicKey) throw new Error("sessionAuth: sessionPublicKey is required");
  if (!imageHash) throw new Error("sessionAuth: imageHash is required");

  // 1. Build the Payload.Decoded struct (kind=0 transactions, no calls)
  const payload = {
    kind: 0,
    noChainId: false,
    calls: [],
    space: 0,
    nonce: 0,
    message: "0x",
    imageHash,
    digest: "0x" + "00".repeat(32),
    parentWallets: [],
  };

  // 2. Build the attestation object
  const attestation = {
    sessionPublicKey,
    allowedContracts: allowedContracts ?? [],
    allowedFunctions: allowedFunctions ?? [],
    spendingLimit: spendingLimit ?? "0",
    expiresAt,
    chainId,
  };

  // 3. ABI-encode the attestation
  const encodedAttestation = abiCoder.encode(
    ["address", "address[]", "string[]", "string", "uint256", "uint256"],
    [
      attestation.sessionPublicKey,
      attestation.allowedContracts,
      attestation.allowedFunctions,
      attestation.spendingLimit,
      attestation.expiresAt,
      attestation.chainId,
    ]
  );

  // 4. Hash the attestation
  const attestationHash = keccak256(encodedAttestation);

  // 5. Build the combined payload hash: keccak256(abi.encode(attestationHash, imageHash))
  const combinedHash = keccak256(
    abiCoder.encode(["bytes32", "bytes32"], [attestationHash, imageHash])
  );

  // 6. Request a single personal_sign of the combined hash
  const signature = await provider.request({
    method: "personal_sign",
    params: [combinedHash, account],
  });

  // 7. Return the complete result
  return {
    signature,
    sessionKey: sessionPublicKey,
    imageHash,
    payload,
    attestation,
  };
}

// ─── submitSessionWithImageHash ───────────────────────────────────────────────

/**
 * Submit the result of `signSessionWithImageHash` on-chain.
 *
 * Calls `Stage1Module.updateImageHash(imageHash)` on the wallet via
 * `selfExecute`, which applies the new image hash (making the session key
 * active as a co-signer).
 *
 * @param {object} provider       ethers v6 provider
 * @param {object} signer         ethers v6 signer (connected to the relayer/user)
 * @param {string} walletAddress  Address of the deployed smart account
 * @param {object} sessionAuthResult  Result from signSessionWithImageHash()
 * @param {string}   sessionAuthResult.signature
 * @param {string}   sessionAuthResult.sessionKey
 * @param {string}   sessionAuthResult.imageHash
 * @param {object}   sessionAuthResult.payload
 * @param {object}   sessionAuthResult.attestation
 * @returns {Promise<{ imageHashTxHash: string, sessionActive: true }>}
 */
export async function submitSessionWithImageHash(provider, signer, walletAddress, {
  imageHash,
  payload,
}) {
  // Build the calldata for updateImageHash(bytes32)
  const stage1Iface = new Interface(Stage1ModuleABI);
  const updateCalldata = stage1Iface.encodeFunctionData("updateImageHash", [imageHash]);

  // Build a selfExecute payload that calls updateImageHash on the wallet itself
  const execPayload = {
    ...payload,
    calls: [
      {
        to: walletAddress,
        value: 0n,
        data: updateCalldata,
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 0n,
      },
    ],
  };

  // Encode and submit via selfExecute
  const walletContract = new Contract(walletAddress, Stage1ModuleABI, signer);
  const tx = await walletContract.selfExecute(execPayload);
  const receipt = await tx.wait();

  return {
    imageHashTxHash: receipt.hash,
    sessionActive: true,
  };
}

// ─── validateSessionSignature ─────────────────────────────────────────────────

/**
 * Call `SessionManager.recoverSapientSignature` to verify a session signature
 * on-chain and recover the wallet image hash it was signed against.
 *
 * @param {object} provider       ethers v6 provider
 * @param {string} walletAddress  Address of the smart account wallet
 * @param {object} payload        Payload.Decoded struct
 * @param {string} encodedSignature  Encoded session signature bytes
 * @returns {Promise<string>}  bytes32 image hash recovered from the signature
 */
export async function validateSessionSignature(provider, walletAddress, payload, encodedSignature) {
  const sessionManager = new Contract(
    CONTRACT_ADDRESSES.SessionManager,
    SessionManagerABI,
    provider
  );

  const recoveredImageHash = await sessionManager.recoverSapientSignature(
    walletAddress,
    payload,
    encodedSignature
  );

  return recoveredImageHash;
}

// ─── getSessionPermissions ────────────────────────────────────────────────────

/**
 * Build a Permission struct compatible with `SessionManager.validatePermission`.
 *
 * @param {string}   sessionKey         Session key address (signer)
 * @param {string[]} allowedContracts   Addresses the session may call
 * @param {string[]} allowedFunctions   Function signatures / selectors
 * @param {string}   spendingLimit      Max ETH spend (human-readable, e.g. "0.5")
 * @param {number}   expiresAt          Unix timestamp deadline
 * @returns {object}  Permission struct
 */
export function getSessionPermissions(
  sessionKey,
  allowedContracts,
  allowedFunctions,
  spendingLimit,
  expiresAt
) {
  // Build ParameterRule entries for allowed contracts (value rules)
  const rules = allowedContracts.map((contractAddress) => ({
    cumulative: false,
    operation: 0, // EQUAL
    value: abiCoder.encode(["address"], [contractAddress]).slice(0, 66),
    offset: 0,
    mask: "0x" + "ff".repeat(32),
  }));

  // Add a cumulative spending limit rule if set
  if (spendingLimit && spendingLimit !== "0") {
    const limitWei = parseEther(spendingLimit);
    rules.push({
      cumulative: true,
      operation: 1, // LESS_THAN_OR_EQUAL
      value: abiCoder.encode(["uint256"], [limitWei]),
      offset: 0,
      mask: "0x" + "ff".repeat(32),
    });
  }

  return {
    signer: sessionKey,
    deadline: expiresAt,
    rules,
    allowedContracts,
    allowedFunctions,
  };
}
