/**
 * IntegratedDEX WaaS SDK — EIP-712 Typed Data Signing
 *
 * Provides utilities for constructing EIP-712 domain separators,
 * type hashes, and signing structured data via eth_signTypedData_v4.
 */

// ─── Type Hashing ─────────────────────────────────────────────────────────────

/**
 * Encode a type string for a given EIP-712 type definition.
 *
 * Example:
 *   encodeType("Mail", { from: "address", to: "address", contents: "string" })
 *   → "Mail(address from,address to,string contents)"
 *
 * @param {string} typeName
 * @param {Record<string, string>} fields  { fieldName: solidityType }
 * @returns {string}
 */
export function encodeType(typeName, fields) {
  const fieldStr = Object.entries(fields)
    .map(([name, type]) => `${type} ${name}`)
    .join(",");
  return `${typeName}(${fieldStr})`;
}

// ─── Domain Separator ─────────────────────────────────────────────────────────

/**
 * Build an EIP-712 domain object.
 *
 * @param {object} opts
 * @param {string}  opts.name              Human-readable app name
 * @param {string}  opts.version           Version string (e.g. "1")
 * @param {number}  opts.chainId           EVM chain ID
 * @param {string}  opts.verifyingContract Contract that will verify the sig
 * @param {string}  [opts.salt]            Optional salt
 * @returns {object}  EIP-712 domain object
 */
export function buildDomain({ name, version, chainId, verifyingContract, salt }) {
  const domain = { name, version, chainId, verifyingContract };
  if (salt !== undefined) domain.salt = salt;
  return domain;
}

// ─── Typed Data Payload ───────────────────────────────────────────────────────

/**
 * Build a complete EIP-712 typed-data payload ready to pass to a wallet.
 *
 * @param {object} domain         Result of buildDomain()
 * @param {object} types          EIP-712 types definition (without EIP712Domain)
 * @param {string} primaryType    Name of the primary type
 * @param {object} message        The structured message to sign
 * @returns {object}              Full EIP-712 payload
 */
export function buildTypedData(domain, types, primaryType, message) {
  return {
    domain,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ...types,
    },
    primaryType,
    message,
  };
}

// ─── Signing ──────────────────────────────────────────────────────────────────

/**
 * Request an EIP-712 typed-data signature from the connected wallet.
 *
 * Calls `eth_signTypedData_v4` on the provider, which presents a
 * human-readable preview to the user before they approve or reject.
 *
 * @param {object} provider    EIP-1193 provider (e.g. window.ethereum)
 * @param {string} account     Signer address (checksummed or lowercase)
 * @param {object} typedData   Full EIP-712 payload from buildTypedData()
 * @returns {Promise<string>}  Hex signature
 */
export async function signTypedData(provider, account, typedData) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("EIP712: invalid provider — must expose an EIP-1193 request() method");
  }
  if (!account) {
    throw new Error("EIP712: no account provided");
  }

  const signature = await provider.request({
    method: "eth_signTypedData_v4",
    params: [account, JSON.stringify(typedData)],
  });

  return signature;
}

// ─── Signature Splitting ──────────────────────────────────────────────────────

/**
 * Split a 65-byte hex signature into { r, s, v } components.
 *
 * @param {string} signature  Hex string (0x-prefixed, 130 hex chars)
 * @returns {{ r: string, s: string, v: number }}
 */
export function splitSignature(signature) {
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (sig.length !== 130) {
    throw new Error(`EIP712: invalid signature length ${sig.length}, expected 130`);
  }
  const r = `0x${sig.slice(0, 64)}`;
  const s = `0x${sig.slice(64, 128)}`;
  const v = parseInt(sig.slice(128, 130), 16);
  return { r, s, v };
}
