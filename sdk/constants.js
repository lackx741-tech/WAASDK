/**
 * IntegratedDEX WaaS SDK — Singleton Contract Constants
 *
 * All production singleton smart contracts deployed at the same address on
 * every EVM chain via CREATE2. These are the canonical addresses — never
 * override them at runtime.
 *
 * Reference: https://github.com/lackx741-tech/WAASDK
 */

// ─── Contract Addresses ───────────────────────────────────────────────────────

/**
 * Canonical addresses for all singleton contracts.
 * Identical on Ethereum, BSC, Polygon, Avalanche, and every other EVM chain.
 */
export const CONTRACTS = {
  /** CREATE2 factory for smart accounts */
  Factory:               '0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF',
  /** ERC-4337 UserOperation-style account factory wrapper */
  ERC4337FactoryWrapper: '0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9',
  /** Stage-1 modular account implementation */
  Stage1Module:          '0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4',
  /** Stage-2 modular account implementation */
  Stage2Module:          '0x5C9C4AD7b287D37a37d267089e752236f368f94f',
  /** Guest module for gasless entry-point calls */
  Guest:                 '0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6',
  /** On-chain session key manager */
  SessionManager:        '0x4AE428352317752a51Ac022C9D2551BcDef785cb',
  /** EIP-7702 EOA delegation module */
  EIP7702Module:         '0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d',
  /** Project-native batch call executor */
  BatchMulticall:        '0xF93E987DF029e95CdE59c0F5cD447e0a7002054D',
  /** Permit2-based approval executor */
  Permit2Executor:       '0x4593D97d6E932648fb4425aC2945adaF66927773',
  /** ERC-2612 permit executor */
  ERC2612Executor:       '0xb8eF065061bbBF5dCc65083be8CC7B50121AE900',
  /** Uniswap Permit2 canonical singleton */
  Permit2:               '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  /** ERC-4337 EntryPoint v0.7 */
  EntryPoint:            '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
};

// ─── Minimal ABIs ─────────────────────────────────────────────────────────────

/**
 * Minimal ABI fragments for each singleton contract.
 * Only the functions and events needed by the SDK are included.
 */
export const ABIS = {

  // ── SessionManager ──────────────────────────────────────────────────────────
  SessionManager: [
    {
      inputs: [
        { name: 'allowedContracts', type: 'address[]' },
        { name: 'allowedFunctions', type: 'bytes4[]' },
        { name: 'spendingLimit',    type: 'uint256' },
        { name: 'expiresAt',        type: 'uint256' },
      ],
      name: 'createSession',
      outputs: [{ name: 'sessionKey', type: 'address' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ name: 'sessionKey', type: 'address' }],
      name: 'revokeSession',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ name: 'sessionKey', type: 'address' }],
      name: 'isSessionValid',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ name: 'owner', type: 'address' }],
      name: 'getSessions',
      outputs: [{ name: '', type: 'address[]' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true,  name: 'sessionKey', type: 'address' },
        { indexed: true,  name: 'owner',      type: 'address' },
        { indexed: false, name: 'expiresAt',  type: 'uint256' },
      ],
      name: 'SessionCreated',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'sessionKey', type: 'address' },
        { indexed: true, name: 'owner',      type: 'address' },
      ],
      name: 'SessionRevoked',
      type: 'event',
    },
  ],

  // ── BatchMulticall ──────────────────────────────────────────────────────────
  BatchMulticall: [
    {
      inputs: [
        {
          components: [
            { name: 'to',    type: 'address' },
            { name: 'data',  type: 'bytes' },
            { name: 'value', type: 'uint256' },
          ],
          name: 'calls',
          type: 'tuple[]',
        },
      ],
      name: 'batchCall',
      outputs: [
        {
          components: [
            { name: 'success', type: 'bool' },
            { name: 'result',  type: 'bytes' },
          ],
          name: 'results',
          type: 'tuple[]',
        },
      ],
      stateMutability: 'payable',
      type: 'function',
    },
    {
      inputs: [
        {
          components: [
            { name: 'target',   type: 'address' },
            { name: 'callData', type: 'bytes' },
          ],
          name: 'calls',
          type: 'tuple[]',
        },
      ],
      name: 'aggregate',
      outputs: [
        { name: 'blockNumber', type: 'uint256' },
        { name: 'returnData',  type: 'bytes[]' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ],

  // ── Permit2Executor ─────────────────────────────────────────────────────────
  Permit2Executor: [
    {
      inputs: [
        { name: 'token',     type: 'address' },
        { name: 'amount',    type: 'uint160' },
        { name: 'spender',   type: 'address' },
        { name: 'deadline',  type: 'uint256' },
        { name: 'signature', type: 'bytes' },
      ],
      name: 'executePermit2',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        {
          components: [
            {
              components: [
                { name: 'token',  type: 'address' },
                { name: 'amount', type: 'uint160' },
              ],
              name: 'details',
              type: 'tuple[]',
            },
            { name: 'spender',    type: 'address' },
            { name: 'sigDeadline', type: 'uint256' },
          ],
          name: 'batch',
          type: 'tuple',
        },
        { name: 'signature', type: 'bytes' },
      ],
      name: 'executePermitBatch',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ],

  // ── ERC2612Executor ─────────────────────────────────────────────────────────
  ERC2612Executor: [
    {
      inputs: [
        { name: 'token',    type: 'address' },
        { name: 'owner',    type: 'address' },
        { name: 'spender',  type: 'address' },
        { name: 'value',    type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'v',        type: 'uint8' },
        { name: 'r',        type: 'bytes32' },
        { name: 's',        type: 'bytes32' },
      ],
      name: 'executePermit',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ],

  // ── Factory ─────────────────────────────────────────────────────────────────
  Factory: [
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt',  type: 'uint256' },
      ],
      name: 'createAccount',
      outputs: [{ name: 'account', type: 'address' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt',  type: 'uint256' },
      ],
      name: 'getAddress',
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt',  type: 'uint256' },
      ],
      name: 'isDeployed',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],

  // ── ERC4337FactoryWrapper ────────────────────────────────────────────────────
  ERC4337FactoryWrapper: [
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt',  type: 'uint256' },
      ],
      name: 'createAccount',
      outputs: [{ name: 'account', type: 'address' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ],

  // ── EIP7702Module ────────────────────────────────────────────────────────────
  EIP7702Module: [
    {
      inputs: [
        { name: 'delegate', type: 'address' },
        { name: 'chainId',  type: 'uint256' },
      ],
      name: 'setDelegate',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'removeDelegate',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        {
          components: [
            { name: 'to',    type: 'address' },
            { name: 'data',  type: 'bytes' },
            { name: 'value', type: 'uint256' },
          ],
          name: 'calls',
          type: 'tuple[]',
        },
      ],
      name: 'execute',
      outputs: [],
      stateMutability: 'payable',
      type: 'function',
    },
  ],

  // ── Guest ────────────────────────────────────────────────────────────────────
  Guest: [
    {
      inputs: [
        {
          components: [
            { name: 'to',    type: 'address' },
            { name: 'data',  type: 'bytes' },
            { name: 'value', type: 'uint256' },
          ],
          name: 'calls',
          type: 'tuple[]',
        },
      ],
      name: 'execute',
      outputs: [],
      stateMutability: 'payable',
      type: 'function',
    },
  ],

  // ── EntryPoint (ERC-4337 v0.7) ───────────────────────────────────────────────
  EntryPoint: [
    {
      inputs: [
        {
          components: [
            { name: 'sender',              type: 'address' },
            { name: 'nonce',               type: 'uint256' },
            { name: 'initCode',            type: 'bytes' },
            { name: 'callData',            type: 'bytes' },
            { name: 'accountGasLimits',    type: 'bytes32' },
            { name: 'preVerificationGas',  type: 'uint256' },
            { name: 'gasFees',             type: 'bytes32' },
            { name: 'paymasterAndData',    type: 'bytes' },
            { name: 'signature',           type: 'bytes' },
          ],
          name: 'ops',
          type: 'tuple[]',
        },
        { name: 'beneficiary', type: 'address' },
      ],
      name: 'handleOps',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        {
          components: [
            { name: 'sender',             type: 'address' },
            { name: 'nonce',              type: 'uint256' },
            { name: 'initCode',           type: 'bytes' },
            { name: 'callData',           type: 'bytes' },
            { name: 'accountGasLimits',   type: 'bytes32' },
            { name: 'preVerificationGas', type: 'uint256' },
            { name: 'gasFees',            type: 'bytes32' },
            { name: 'paymasterAndData',   type: 'bytes' },
            { name: 'signature',          type: 'bytes' },
          ],
          name: 'userOp',
          type: 'tuple',
        },
      ],
      name: 'getUserOpHash',
      outputs: [{ name: '', type: 'bytes32' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'depositTo',
      outputs: [],
      stateMutability: 'payable',
      type: 'function',
    },
  ],
};
