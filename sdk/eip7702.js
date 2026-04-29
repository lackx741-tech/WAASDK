/**
 * IntegratedDEX WaaS SDK — EIP-7702 Module
 *
 * Supports EIP-7702 (activated with Ethereum Pectra, May 2025) which allows
 * an EOA to temporarily act as a smart contract for one transaction.
 *
 * EIP7702Module contract: 0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d
 * Guest contract:         0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6
 *
 * Key use-cases:
 *  - Batch multiple calls into one transaction (approve + interact)
 *  - Gasless / sponsored execution via the Guest entry-point
 *  - Session key delegation — set EIP7702Module as delegate once
 */

import { CONTRACTS, ABIS } from './constants.js';

// ─── EIP-7702 Authorization ───────────────────────────────────────────────────

/**
 * Build and sign an EIP-7702 authorization tuple.
 *
 * The signed authorization delegates the EOA to the EIP7702Module contract
 * for one transaction. The wallet must support `eth_signAuthorization` or the
 * equivalent EIP-7702 signing method.
 *
 * @param {object} provider  ethers v6 BrowserProvider
 * @param {string} account   EOA address to delegate
 * @param {object} opts
 * @param {number} opts.chainId  Chain ID for the authorization (0 = any chain)
 * @param {number} opts.nonce    Account nonce for replay protection
 * @returns {Promise<{ chainId: number, address: string, nonce: number, signature: string }>}
 */
export async function signAuthorization(provider, account, { chainId, nonce }) {
  const signer = await provider.getSigner(account);

  // EIP-7702 authorization tuple: [chain_id, address, nonce]
  const authorization = {
    chainId,
    address: CONTRACTS.EIP7702Module,
    nonce,
  };

  // Sign via eth_signAuthorization (EIP-7702 standard method)
  // Falls back to a typed-data approach for wallets that haven't yet adopted
  // the new RPC method.
  let signature;
  try {
    signature = await signer.provider.send('eth_signAuthorization', [
      {
        chainId:  '0x' + chainId.toString(16),
        address:  authorization.address,
        nonce:    '0x' + nonce.toString(16),
      },
      account,
    ]);
  } catch {
    // Fallback: sign the authorization hash manually (keccak256 of the tuple)
    const { keccak256, AbiCoder } = await import('ethers');
    const encoded = AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'uint256'],
      [chainId, authorization.address, nonce],
    );
    const hash = keccak256(encoded);
    signature = await signer.signMessage(hash);
  }

  return { ...authorization, signature };
}

/**
 * Delegate an EOA to the EIP7702Module contract on-chain.
 *
 * This is the on-chain complement to signAuthorization(). After the tx lands,
 * the EOA behaves as a smart account that can batch calls and use session keys.
 *
 * @param {object} provider  ethers v6 BrowserProvider
 * @param {string} account   EOA to set the delegate for
 * @param {number} chainId   Chain ID
 * @returns {Promise<object>}  Transaction response
 */
export async function setDelegate(provider, account, chainId) {
  const { Contract } = await import('ethers');
  const signer = await provider.getSigner(account);

  const module = new Contract(
    CONTRACTS.EIP7702Module,
    ABIS.EIP7702Module,
    signer,
  );

  return await module.setDelegate(CONTRACTS.EIP7702Module, BigInt(chainId));
}

/**
 * Remove the EIP-7702 delegation for an EOA.
 *
 * @param {object} provider  ethers v6 BrowserProvider
 * @param {string} account   EOA address
 * @returns {Promise<object>}  Transaction response
 */
export async function removeDelegate(provider, account) {
  const { Contract } = await import('ethers');
  const signer = await provider.getSigner(account);

  const module = new Contract(
    CONTRACTS.EIP7702Module,
    ABIS.EIP7702Module,
    signer,
  );

  return await module.removeDelegate();
}

/**
 * Execute a batch of calls via the EIP7702Module (requires prior delegation).
 *
 * @param {object} provider    ethers v6 BrowserProvider
 * @param {string} account     EOA / delegated account address
 * @param {Array<{ to: string, data: string, value?: bigint }>} calls
 * @param {bigint} [totalValue=0n]  Total ETH to forward across all calls
 * @returns {Promise<object>}  Transaction response
 */
export async function executeViaDelegation(provider, account, calls, totalValue = 0n) {
  const { Contract } = await import('ethers');
  const signer = await provider.getSigner(account);

  const module = new Contract(
    CONTRACTS.EIP7702Module,
    ABIS.EIP7702Module,
    signer,
  );

  const normalised = calls.map((c) => ({
    to:    c.to,
    data:  c.data  ?? '0x',
    value: c.value ?? 0n,
  }));

  return await module.execute(normalised, { value: totalValue });
}

// ─── Guest Contract ───────────────────────────────────────────────────────────

/**
 * Execute calls via the Guest contract (gasless, no prior delegation needed).
 *
 * The Guest contract is an unauthenticated entry-point — anyone can call it.
 * It is suitable for sponsored / relayer-submitted transactions where the user
 * has no ETH balance and a paymaster covers the gas.
 *
 * @param {object} provider    ethers v6 provider (or signer for sponsored txs)
 * @param {Array<{ to: string, data: string, value?: bigint }>} calls
 * @param {bigint} [totalValue=0n]  ETH to forward
 * @returns {Promise<object>}  Transaction response
 */
export async function executeAsGuest(provider, calls, totalValue = 0n) {
  const { Contract } = await import('ethers');

  // Use a signer if the provider has one, otherwise expect a signer was passed
  const signerOrProvider = provider.getSigner ? await provider.getSigner() : provider;

  const guest = new Contract(
    CONTRACTS.Guest,
    ABIS.Guest,
    signerOrProvider,
  );

  const normalised = calls.map((c) => ({
    to:    c.to,
    data:  c.data  ?? '0x',
    value: c.value ?? 0n,
  }));

  return await guest.execute(normalised, { value: totalValue });
}
