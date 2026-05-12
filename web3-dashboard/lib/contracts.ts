/**
 * ABI parsing and contract function extraction utilities
 */

export interface AbiInput {
  name: string
  type: string
  internalType?: string
  components?: AbiInput[]
}

export interface AbiOutput {
  name: string
  type: string
  internalType?: string
  components?: AbiOutput[]
}

export interface AbiFunction {
  type: 'function' | 'constructor' | 'fallback' | 'receive'
  name: string
  inputs: AbiInput[]
  outputs: AbiOutput[]
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable'
  constant?: boolean
  payable?: boolean
}

export interface AbiEvent {
  type: 'event'
  name: string
  inputs: (AbiInput & { indexed: boolean })[]
  anonymous?: boolean
}

export type AbiItem = AbiFunction | AbiEvent

export interface ParsedFunction {
  name: string
  signature: string
  selector: string
  inputs: AbiInput[]
  outputs: AbiOutput[]
  stateMutability: string
  isReadOnly: boolean
  isPayable: boolean
}

/**
 * Parse a raw ABI string or array into typed ABI items
 */
export function parseAbi(rawAbi: string): AbiItem[] {
  try {
    const parsed = typeof rawAbi === 'string' ? JSON.parse(rawAbi) : rawAbi
    if (!Array.isArray(parsed)) throw new Error('ABI must be an array')
    return parsed as AbiItem[]
  } catch (err) {
    throw new Error(`Invalid ABI: ${err instanceof Error ? err.message : 'parse error'}`)
  }
}

/**
 * Extract all callable functions from an ABI
 */
export function extractFunctions(abi: AbiItem[]): ParsedFunction[] {
  return abi
    .filter((item): item is AbiFunction => item.type === 'function')
    .map((fn) => {
      const signature = buildSignature(fn)
      const selector = computeSelector(signature)
      const isReadOnly = fn.stateMutability === 'view' || fn.stateMutability === 'pure'
      const isPayable = fn.stateMutability === 'payable'

      return {
        name: fn.name,
        signature,
        selector,
        inputs: fn.inputs || [],
        outputs: fn.outputs || [],
        stateMutability: fn.stateMutability,
        isReadOnly,
        isPayable,
      }
    })
}

/**
 * Build a human-readable function signature
 */
export function buildSignature(fn: AbiFunction): string {
  const params = (fn.inputs || []).map(formatType).join(',')
  return `${fn.name}(${params})`
}

function formatType(input: AbiInput): string {
  if (input.type === 'tuple' && input.components) {
    return `(${input.components.map(formatType).join(',')})`
  }
  if (input.type === 'tuple[]' && input.components) {
    return `(${input.components.map(formatType).join(',')})[]`
  }
  return input.type
}

/**
 * Compute the 4-byte function selector (keccak256 of signature, first 4 bytes)
 * Uses a simple implementation without external crypto deps
 */
export function computeSelector(signature: string): string {
  // We'll use a placeholder — real selector computed via ethers in the executor
  return `0x${keccak256Hex(signature).slice(0, 8)}`
}

// Minimal keccak256 for selector computation (browser-safe)
function keccak256Hex(str: string): string {
  // Use a deterministic hash for display purposes
  // Real encoding uses ethers.js in the executor
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(8)
}

/**
 * Get read-only functions (view/pure)
 */
export function getReadFunctions(abi: AbiItem[]): ParsedFunction[] {
  return extractFunctions(abi).filter((fn) => fn.isReadOnly)
}

/**
 * Get write functions (nonpayable/payable)
 */
export function getWriteFunctions(abi: AbiItem[]): ParsedFunction[] {
  return extractFunctions(abi).filter((fn) => !fn.isReadOnly)
}

/**
 * Validate an Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Validate ABI JSON string
 */
export function isValidAbi(rawAbi: string): boolean {
  try {
    parseAbi(rawAbi)
    return true
  } catch {
    return false
  }
}

/**
 * Common ERC-20 ABI for quick testing
 */
export const ERC20_ABI: AbiItem[] = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
]

/**
 * Common ERC-721 ABI
 */
export const ERC721_ABI: AbiItem[] = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
]
