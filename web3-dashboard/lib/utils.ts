/**
 * Utility functions: address formatting, calldata building, script generation
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DashboardConfig } from './store'

// ─── Tailwind helper ──────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Address formatting ───────────────────────────────────────────────────────

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

// ─── Number formatting ────────────────────────────────────────────────────────

export function formatEther(wei: bigint, decimals = 4): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(decimals)
}

export function formatUnits(value: bigint, decimals: number, displayDecimals = 4): string {
  const divisor = Math.pow(10, decimals)
  const result = Number(value) / divisor
  return result.toFixed(displayDecimals)
}

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
  return num.toFixed(decimals)
}

// ─── Time formatting ──────────────────────────────────────────────────────────

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

// ─── Calldata building ────────────────────────────────────────────────────────

export interface CalldataResult {
  selector: string
  encodedArgs: string
  fullCalldata: string
  humanReadable: string
}

export function buildCalldata(
  functionSignature: string,
  args: string[]
): CalldataResult {
  // Simple selector computation for display
  const selector = computeFunctionSelector(functionSignature)
  const encodedArgs = args.length > 0 ? encodeArgsSimple(args) : ''
  const fullCalldata = selector + encodedArgs

  return {
    selector,
    encodedArgs,
    fullCalldata,
    humanReadable: `${functionSignature}(${args.join(', ')})`,
  }
}

function computeFunctionSelector(signature: string): string {
  // Deterministic hash for display — real encoding uses ethers in executor
  let hash = 0
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return '0x' + Math.abs(hash).toString(16).padStart(8, '0')
}

function encodeArgsSimple(args: string[]): string {
  return args
    .map((arg) => {
      if (arg.startsWith('0x') && arg.length === 42) {
        // Address: pad to 32 bytes
        return arg.slice(2).padStart(64, '0')
      }
      if (/^\d+$/.test(arg)) {
        // Integer: pad to 32 bytes
        return BigInt(arg).toString(16).padStart(64, '0')
      }
      // String/bytes: encode as hex
      return Buffer.from(arg).toString('hex').padStart(64, '0')
    })
    .join('')
}

// ─── Copy to clipboard ────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  }
}

// ─── Script.js generator ──────────────────────────────────────────────────────

export interface ScriptConfig {
  projectId: string
  contractAddress: string
  abi: string
  chainId: number
  appName: string
  primaryColor: string
  enabledFunctions: string[]
  backendUrl?: string
}

export function generateEmbedScript(config: DashboardConfig): string {
  const safeAbi = config.contractAbi
    ? JSON.stringify(JSON.parse(config.contractAbi), null, 0)
    : '[]'

  const enabledFunctions = config.enabledFunctions || []

  return `/**
 * WAASDK Embeddable Script
 * Generated: ${new Date().toISOString()}
 * App: ${config.appName || 'WAASDK App'}
 * Contract: ${config.contractAddress || 'Not configured'}
 * Chain: ${config.chainId || 1}
 *
 * Usage:
 *   <script src="./script.js"></script>
 *   <script>
 *     WAASDK.connectWallet().then(address => console.log('Connected:', address))
 *     WAASDK.executeFunction('transfer', ['0x...', '1000000000000000000'])
 *   </script>
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self),
      (global.WAASDK = factory()))
})(this, function () {
  'use strict'

  // ─── Configuration ──────────────────────────────────────────────────────────
  const CONFIG = {
    projectId: '${config.walletConnectProjectId || ''}',
    contractAddress: '${config.contractAddress || ''}',
    abi: ${safeAbi},
    chainId: ${config.chainId || 1},
    appName: '${config.appName || 'WAASDK App'}',
    primaryColor: '${config.primaryColor || '#fc72ff'}',
    enabledFunctions: ${JSON.stringify(enabledFunctions)},
    backendUrl: '${config.backendUrl || ''}',
    rpcUrl: '${getRpcUrl(config.chainId || 1)}',
  }

  // ─── State ──────────────────────────────────────────────────────────────────
  let _provider = null
  let _signer = null
  let _address = null
  let _chainId = null
  const _listeners = {}

  // ─── Event system ───────────────────────────────────────────────────────────
  function emit(event, data) {
    const handlers = _listeners[event] || []
    handlers.forEach(function (fn) {
      try { fn(data) } catch (e) { console.error('[WAASDK] Event handler error:', e) }
    })
    // Also dispatch DOM event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('waasdk:' + event, { detail: data }))
    }
  }

  function on(event, handler) {
    if (!_listeners[event]) _listeners[event] = []
    _listeners[event].push(handler)
    return function () {
      _listeners[event] = _listeners[event].filter(function (fn) { return fn !== handler })
    }
  }

  // ─── Toast notifications ────────────────────────────────────────────────────
  function showToast(message, type) {
    type = type || 'info'
    if (typeof document === 'undefined') return

    var existing = document.getElementById('waasdk-toast-container')
    if (!existing) {
      existing = document.createElement('div')
      existing.id = 'waasdk-toast-container'
      existing.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:24px', 'z-index:99999',
        'display:flex', 'flex-direction:column', 'gap:8px', 'pointer-events:none'
      ].join(';')
      document.body.appendChild(existing)
    }

    var colors = { success: '#40b66b', error: '#f25f5c', info: '#4c82fb', warning: '#f77f00' }
    var toast = document.createElement('div')
    toast.style.cssText = [
      'background:#1c1d26', 'color:#fff', 'padding:12px 16px',
      'border-radius:12px', 'font-family:system-ui,sans-serif', 'font-size:14px',
      'border-left:3px solid ' + (colors[type] || colors.info),
      'box-shadow:0 4px 24px rgba(0,0,0,0.4)',
      'pointer-events:auto', 'cursor:pointer',
      'animation:waasdk-slide-in 0.3s ease-out',
      'max-width:320px', 'word-break:break-word'
    ].join(';')
    toast.textContent = message
    toast.onclick = function () { toast.remove() }

    if (!document.getElementById('waasdk-styles')) {
      var style = document.createElement('style')
      style.id = 'waasdk-styles'
      style.textContent = '@keyframes waasdk-slide-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}'
      document.head.appendChild(style)
    }

    existing.appendChild(toast)
    setTimeout(function () { if (toast.parentNode) toast.remove() }, 4000)
  }

  // ─── Wallet connection ──────────────────────────────────────────────────────
  async function connectWallet() {
    try {
      if (typeof window === 'undefined') throw new Error('Browser environment required')

      // Try EIP-1193 provider (MetaMask, injected wallets)
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        if (!accounts || accounts.length === 0) throw new Error('No accounts returned')

        _address = accounts[0]
        _chainId = parseInt(await window.ethereum.request({ method: 'eth_chainId' }), 16)

        // Switch to configured chain if needed
        if (_chainId !== CONFIG.chainId) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x' + CONFIG.chainId.toString(16) }],
            })
            _chainId = CONFIG.chainId
          } catch (switchErr) {
            console.warn('[WAASDK] Could not switch chain:', switchErr.message)
          }
        }

        // Set up provider
        if (window.ethers) {
          _provider = new window.ethers.BrowserProvider(window.ethereum)
          _signer = await _provider.getSigner()
        }

        // Listen for account/chain changes
        window.ethereum.on('accountsChanged', function (accounts) {
          _address = accounts[0] || null
          emit('accountChanged', { address: _address })
          if (!_address) emit('walletDisconnected', {})
        })
        window.ethereum.on('chainChanged', function (chainId) {
          _chainId = parseInt(chainId, 16)
          emit('chainChanged', { chainId: _chainId })
        })

        emit('walletConnected', { address: _address, chainId: _chainId })
        showToast('Wallet connected: ' + _address.slice(0, 6) + '...' + _address.slice(-4), 'success')
        return _address
      }

      // WalletConnect fallback
      throw new Error('No injected wallet found. Please install MetaMask or use WalletConnect.')
    } catch (err) {
      const msg = err.message || 'Failed to connect wallet'
      emit('error', { type: 'connection', message: msg })
      showToast(msg, 'error')
      throw err
    }
  }

  async function disconnectWallet() {
    _provider = null
    _signer = null
    _address = null
    _chainId = null
    emit('walletDisconnected', {})
    showToast('Wallet disconnected', 'info')
  }

  function getAddress() { return _address }
  function getChainId() { return _chainId }
  function isConnected() { return !!_address }

  // ─── Contract interaction ───────────────────────────────────────────────────
  async function executeFunction(functionName, args, options) {
    args = args || []
    options = options || {}

    try {
      if (!CONFIG.contractAddress) throw new Error('Contract address not configured')
      if (!CONFIG.abi || CONFIG.abi.length === 0) throw new Error('Contract ABI not configured')

      // Find function in ABI
      const fnAbi = CONFIG.abi.find(function (item) {
        return item.type === 'function' && item.name === functionName
      })
      if (!fnAbi) throw new Error('Function "' + functionName + '" not found in ABI')

      // Check if enabled
      if (CONFIG.enabledFunctions.length > 0 && !CONFIG.enabledFunctions.includes(functionName)) {
        throw new Error('Function "' + functionName + '" is not enabled')
      }

      const isReadOnly = fnAbi.stateMutability === 'view' || fnAbi.stateMutability === 'pure'

      if (isReadOnly) {
        return await callReadFunction(functionName, args, fnAbi)
      } else {
        if (!_signer) throw new Error('Wallet not connected. Call connectWallet() first.')
        return await sendWriteTransaction(functionName, args, fnAbi, options)
      }
    } catch (err) {
      const msg = err.message || 'Transaction failed'
      emit('error', { type: 'execution', function: functionName, message: msg })
      showToast(msg, 'error')
      throw err
    }
  }

  async function callReadFunction(functionName, args, fnAbi) {
    // Build calldata manually for read calls via RPC
    const calldata = encodeCalldata(fnAbi, args)
    const result = await rpcCall('eth_call', [{
      to: CONFIG.contractAddress,
      data: calldata,
    }, 'latest'])

    emit('readResult', { function: functionName, args, result })
    return result
  }

  async function sendWriteTransaction(functionName, args, fnAbi, options) {
    const calldata = encodeCalldata(fnAbi, args)
    const txParams = {
      to: CONFIG.contractAddress,
      data: calldata,
      from: _address,
    }
    if (options.value) txParams.value = '0x' + BigInt(options.value).toString(16)

    // Estimate gas
    let gasEstimate
    try {
      gasEstimate = await window.ethereum.request({
        method: 'eth_estimateGas',
        params: [txParams],
      })
    } catch (e) {
      gasEstimate = '0x' + (300000).toString(16)
    }
    txParams.gas = gasEstimate

    showToast('Sending transaction...', 'info')
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    })

    emit('transactionSent', { txHash, function: functionName, args })
    showToast('Transaction sent: ' + txHash.slice(0, 10) + '...', 'success')

    // Wait for receipt
    const receipt = await waitForReceipt(txHash)
    if (receipt && receipt.status === '0x1') {
      emit('transactionSuccess', { txHash, receipt, function: functionName })
      showToast('Transaction confirmed!', 'success')
    } else {
      emit('transactionFailed', { txHash, receipt, function: functionName })
      showToast('Transaction failed', 'error')
    }

    return { txHash, receipt }
  }

  async function waitForReceipt(txHash, maxAttempts) {
    maxAttempts = maxAttempts || 30
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(2000)
      try {
        const receipt = await rpcCall('eth_getTransactionReceipt', [txHash])
        if (receipt) return receipt
      } catch (e) { /* retry */ }
    }
    return null
  }

  // ─── Calldata encoding ──────────────────────────────────────────────────────
  function encodeCalldata(fnAbi, args) {
    const selector = keccak256Selector(fnAbi.name + '(' + (fnAbi.inputs || []).map(function (i) { return i.type }).join(',') + ')')
    if (!args || args.length === 0) return selector

    let encoded = ''
    const inputs = fnAbi.inputs || []
    for (let i = 0; i < inputs.length; i++) {
      encoded += encodeParam(inputs[i].type, args[i] !== undefined ? args[i] : '')
    }
    return selector + encoded
  }

  function encodeParam(type, value) {
    if (type === 'address') {
      return (value || '0x0000000000000000000000000000000000000000').replace('0x', '').padStart(64, '0')
    }
    if (type.startsWith('uint') || type.startsWith('int')) {
      try { return BigInt(value || 0).toString(16).padStart(64, '0') } catch { return '0'.padStart(64, '0') }
    }
    if (type === 'bool') {
      return (value === true || value === 'true' || value === '1' ? 1 : 0).toString(16).padStart(64, '0')
    }
    if (type === 'bytes32') {
      const hex = typeof value === 'string' ? Buffer.from(value).toString('hex') : ''
      return hex.padEnd(64, '0').slice(0, 64)
    }
    // Default: treat as hex
    return (value || '').replace('0x', '').padStart(64, '0')
  }

  // Simple keccak256 selector (first 4 bytes) — uses a deterministic hash
  function keccak256Selector(signature) {
    // NOTE: For production use, include a proper keccak256 library
    // This is a simplified version for demonstration
    let h = 0
    for (let i = 0; i < signature.length; i++) {
      h = Math.imul(31, h) + signature.charCodeAt(i) | 0
    }
    return '0x' + Math.abs(h).toString(16).padStart(8, '0')
  }

  // ─── RPC helpers ────────────────────────────────────────────────────────────
  async function rpcCall(method, params) {
    const rpcUrl = CONFIG.rpcUrl
    if (!rpcUrl) throw new Error('No RPC URL configured')

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
    })
    const data = await response.json()
    if (data.error) throw new Error(data.error.message || 'RPC error')
    return data.result
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

  async function getBalance(address) {
    try {
      const hex = await rpcCall('eth_getBalance', [address || _address, 'latest'])
      return parseInt(hex, 16)
    } catch { return 0 }
  }

  function getConfig() { return Object.assign({}, CONFIG) }

  // ─── Public API ─────────────────────────────────────────────────────────────
  return {
    connectWallet,
    disconnectWallet,
    executeFunction,
    getAddress,
    getChainId,
    isConnected,
    getBalance,
    getConfig,
    on,
    emit,
    showToast,
    version: '1.0.0',
  }
})
`
}

function getRpcUrl(chainId: number): string {
  const rpcMap: Record<number, string> = {
    1: 'https://eth.llamarpc.com',
    137: 'https://polygon.llamarpc.com',
    56: 'https://bsc.llamarpc.com',
    43114: 'https://avalanche.llamarpc.com',
    42161: 'https://arbitrum.llamarpc.com',
    8453: 'https://base.llamarpc.com',
    11155111: 'https://rpc.sepolia.org',
  }
  return rpcMap[chainId] || 'https://eth.llamarpc.com'
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType = 'text/javascript') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Explorer URLs ────────────────────────────────────────────────────────────

export function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    137: 'https://polygonscan.com/tx/',
    56: 'https://bscscan.com/tx/',
    43114: 'https://snowtrace.io/tx/',
    42161: 'https://arbiscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    11155111: 'https://sepolia.etherscan.io/tx/',
  }
  const base = explorers[chainId] || 'https://etherscan.io/tx/'
  return base + txHash
}

export function getAddressExplorerUrl(chainId: number, address: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/address/',
    137: 'https://polygonscan.com/address/',
    56: 'https://bscscan.com/address/',
    43114: 'https://snowtrace.io/address/',
    42161: 'https://arbiscan.io/address/',
    8453: 'https://basescan.org/address/',
    11155111: 'https://sepolia.etherscan.io/address/',
  }
  const base = explorers[chainId] || 'https://etherscan.io/address/'
  return base + address
}
