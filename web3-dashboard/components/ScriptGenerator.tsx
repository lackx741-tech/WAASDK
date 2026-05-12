'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Code2,
  Download,
  Copy,
  CheckCircle,
  Loader2,
  Play,
  FileCode,
  Globe,
  Zap,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useDashboardStore } from '@/lib/store'
import { generateEmbedScript, downloadFile, copyToClipboard, cn } from '@/lib/utils'
import { isValidAbi } from '@/lib/contracts'

type PreviewTab = 'script' | 'embed' | 'usage'

export function ScriptGenerator() {
  const { config } = useDashboardStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedScript, setGeneratedScript] = useState('')
  const [integrityHash, setIntegrityHash] = useState('')
  const [generatedAt, setGeneratedAt] = useState('')
  const [previewTab, setPreviewTab] = useState<PreviewTab>('script')
  const [copied, setCopied] = useState<string | null>(null)
  const [showFullScript, setShowFullScript] = useState(false)

  // Validation
  const validationErrors: string[] = []
  if (!config.walletConnectProjectId) validationErrors.push('WalletConnect Project ID is required')
  if (!config.contractAddress) validationErrors.push('Contract address is required')
  if (!config.contractAbi) validationErrors.push('Contract ABI is required')
  if (config.contractAbi && !isValidAbi(config.contractAbi)) validationErrors.push('Contract ABI is invalid JSON')

  const isValid = validationErrors.length === 0

  // Live preview (always up to date)
  const livePreview = useMemo(() => {
    try {
      return generateEmbedScript(config)
    } catch {
      return '// Error generating preview'
    }
  }, [config])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Compilation failed')
      }

      const script = await response.text()
      const hash = response.headers.get('X-Integrity-Hash') || ''
      const at = response.headers.get('X-Generated-At') || new Date().toISOString()

      setGeneratedScript(script)
      setIntegrityHash(hash)
      setGeneratedAt(at)
      toast.success('Script generated successfully!')
    } catch (err) {
      // Fallback to client-side generation
      const script = generateEmbedScript(config)
      setGeneratedScript(script)
      setGeneratedAt(new Date().toISOString())
      toast.success('Script generated (client-side)')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    const script = generatedScript || livePreview
    downloadFile(script, 'script.js', 'text/javascript')
    toast.success('script.js downloaded!')
  }

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text)
    setCopied(label)
    toast.success(`${label} copied!`)
    setTimeout(() => setCopied(null), 2000)
  }

  const scriptToShow = generatedScript || livePreview
  const scriptLines = scriptToShow.split('\n')
  const previewLines = showFullScript ? scriptLines : scriptLines.slice(0, 40)

  const embedCode = `<!-- WAASDK Embeddable Script -->
<script src="./script.js"></script>
<script>
  // Connect wallet on button click
  document.getElementById('connect-btn').addEventListener('click', async () => {
    const address = await WAASDK.connectWallet()
    console.log('Connected:', address)
  })

  // Execute a contract function
  async function callContract() {
    const result = await WAASDK.executeFunction('balanceOf', [
      '0xYourAddressHere'
    ])
    console.log('Result:', result)
  }

  // Listen for events
  WAASDK.on('walletConnected', ({ address, chainId }) => {
    console.log('Wallet connected:', address, 'on chain', chainId)
  })

  WAASDK.on('transactionSuccess', ({ txHash, receipt }) => {
    console.log('Transaction confirmed:', txHash)
  })

  WAASDK.on('error', ({ type, message }) => {
    console.error('WAASDK error:', type, message)
  })
</script>`

  const usageCode = `// ─── WAASDK API Reference ────────────────────────────────────────────────────

// Connect wallet (MetaMask / injected)
const address = await WAASDK.connectWallet()

// Disconnect wallet
await WAASDK.disconnectWallet()

// Check connection status
const isConnected = WAASDK.isConnected()
const address = WAASDK.getAddress()
const chainId = WAASDK.getChainId()

// Execute a READ function (view/pure)
const balance = await WAASDK.executeFunction('balanceOf', [
  '0x742d35Cc6634C0532925a3b8D4C9C3b4b5e8f1a'
])

// Execute a WRITE function (nonpayable)
const { txHash, receipt } = await WAASDK.executeFunction('transfer', [
  '0x742d35Cc6634C0532925a3b8D4C9C3b4b5e8f1a',
  '1000000000000000000' // 1 token in wei
])

// Execute a PAYABLE function
const result = await WAASDK.executeFunction('deposit', [], {
  value: '1000000000000000000' // 1 ETH in wei
})

// Get native balance
const balanceWei = await WAASDK.getBalance()

// Get current config
const config = WAASDK.getConfig()

// ─── Event System ─────────────────────────────────────────────────────────────

// Available events:
// walletConnected    → { address, chainId }
// walletDisconnected → {}
// accountChanged     → { address }
// chainChanged       → { chainId }
// transactionSent    → { txHash, function, args }
// transactionSuccess → { txHash, receipt, function }
// transactionFailed  → { txHash, receipt, function }
// readResult         → { function, args, result }
// error              → { type, message }

const unsubscribe = WAASDK.on('walletConnected', ({ address }) => {
  document.getElementById('wallet-address').textContent = address
})

// Remove listener
unsubscribe()

// ─── DOM Events ───────────────────────────────────────────────────────────────

// All events also fire as DOM CustomEvents with 'waasdk:' prefix
window.addEventListener('waasdk:walletConnected', (e) => {
  console.log(e.detail.address)
})

// ─── Toast Notifications ──────────────────────────────────────────────────────

WAASDK.showToast('Hello from WAASDK!', 'success') // success | error | info | warning`

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Script Generator</h2>
          <p className="text-sm text-text-secondary mt-1">
            Build and download your embeddable script.js with full WalletConnect integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="btn-secondary"
            disabled={!scriptToShow}
          >
            <Download className="w-4 h-4" />
            Download script.js
          </button>
          <button
            onClick={handleGenerate}
            className="btn-primary"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Script'}
          </button>
        </div>
      </div>

      {/* Validation warnings */}
      {validationErrors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-accent-yellow/5 border border-accent-yellow/20 space-y-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-accent-yellow" />
            <p className="text-sm font-medium text-text-primary">
              Complete your configuration for a fully functional script
            </p>
          </div>
          <ul className="space-y-1 ml-6">
            {validationErrors.map((err) => (
              <li key={err} className="text-xs text-text-secondary list-disc">
                {err}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Config summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'App Name',
            value: config.appName || 'Not set',
            icon: Globe,
            color: 'text-accent-blue',
          },
          {
            label: 'Contract',
            value: config.contractAddress
              ? `${config.contractAddress.slice(0, 6)}...${config.contractAddress.slice(-4)}`
              : 'Not set',
            icon: FileCode,
            color: 'text-accent-purple',
          },
          {
            label: 'Chain ID',
            value: config.chainId.toString(),
            icon: Zap,
            color: 'text-accent-pink',
          },
          {
            label: 'Functions',
            value: config.enabledFunctions.length > 0
              ? `${config.enabledFunctions.length} enabled`
              : 'All enabled',
            icon: Code2,
            color: 'text-accent-green',
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="card py-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('w-3.5 h-3.5', item.color)} />
                <span className="text-xs text-text-tertiary">{item.label}</span>
              </div>
              <p className="text-sm font-medium text-text-primary font-mono truncate">
                {item.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Generated info */}
      {generatedScript && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-accent-green/5 border border-accent-green/20"
        >
          <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">Script generated successfully</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Generated at {new Date(generatedAt).toLocaleString()} ·{' '}
              {(generatedScript.length / 1024).toFixed(1)} KB
              {integrityHash && (
                <span className="ml-2 font-mono text-text-tertiary">
                  {integrityHash.slice(0, 20)}...
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            className="btn-ghost text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        </motion.div>
      )}

      {/* Preview tabs */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 p-1 bg-bg-secondary rounded-xl border border-bg-border">
            {([
              { id: 'script' as PreviewTab, label: 'script.js', icon: Code2 },
              { id: 'embed' as PreviewTab, label: 'Embed HTML', icon: Globe },
              { id: 'usage' as PreviewTab, label: 'API Usage', icon: FileCode },
            ]).map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setPreviewTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                    previewTab === tab.id
                      ? 'bg-bg-card text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const content =
                  previewTab === 'script'
                    ? scriptToShow
                    : previewTab === 'embed'
                    ? embedCode
                    : usageCode
                handleCopy(content, previewTab === 'script' ? 'Script' : previewTab === 'embed' ? 'Embed code' : 'Usage code')
              }}
              className="btn-ghost text-xs"
            >
              {copied ? (
                <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy
            </button>
            {previewTab === 'script' && (
              <button
                onClick={() => setShowFullScript(!showFullScript)}
                className="btn-ghost text-xs"
              >
                {showFullScript ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                {showFullScript ? 'Collapse' : 'Show All'}
              </button>
            )}
          </div>
        </div>

        {/* Code preview */}
        <div className="relative">
          <pre className="code-block max-h-[500px] overflow-auto text-xs leading-relaxed">
            <code>
              {previewTab === 'script' && (
                <>
                  {previewLines.join('\n')}
                  {!showFullScript && scriptLines.length > 40 && (
                    <span className="text-text-muted">
                      {'\n'}... {scriptLines.length - 40} more lines
                    </span>
                  )}
                </>
              )}
              {previewTab === 'embed' && embedCode}
              {previewTab === 'usage' && usageCode}
            </code>
          </pre>
        </div>
      </div>

      {/* Download section */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-accent-pink" />
          Deployment
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Download script.js',
              desc: 'Save the script file to your project',
              action: handleDownload,
              icon: Download,
              color: 'btn-primary',
            },
            {
              title: 'Copy to Clipboard',
              desc: 'Copy the full script content',
              action: () => handleCopy(scriptToShow, 'Script'),
              icon: Copy,
              color: 'btn-secondary',
            },
            {
              title: 'Regenerate',
              desc: 'Rebuild with latest config',
              action: handleGenerate,
              icon: RefreshCw,
              color: 'btn-secondary',
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.title}
                onClick={item.action}
                disabled={isGenerating}
                className={cn(
                  'flex flex-col items-start gap-2 p-4 rounded-xl border border-bg-border',
                  'bg-bg-tertiary hover:bg-bg-hover transition-all duration-200 text-left',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-bg-card border border-bg-border flex items-center justify-center">
                  <Icon className="w-4 h-4 text-text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{item.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Integration snippet */}
        <div className="mt-4 p-4 rounded-xl bg-bg-secondary border border-bg-border">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
            Quick Integration
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-accent-cyan overflow-x-auto">
              {`<script src="./script.js"></script>`}
            </code>
            <button
              onClick={() => handleCopy('<script src="./script.js"></script>', 'Tag')}
              className="p-1.5 rounded-lg bg-bg-card border border-bg-border text-text-tertiary hover:text-text-primary transition-all flex-shrink-0"
            >
              {copied === 'Tag' ? (
                <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
