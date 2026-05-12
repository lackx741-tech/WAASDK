'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useChainId } from 'wagmi'
import { cn, shortenAddress, copyToClipboard, getExplorerUrl } from '@/lib/utils'

export interface TxResult {
  txHash?: string
  status: 'idle' | 'pending' | 'success' | 'failed'
  result?: unknown
  error?: string
  gasUsed?: string
  blockNumber?: number
  functionName?: string
  args?: string[]
  isReadOnly?: boolean
}

interface TransactionResultProps {
  result: TxResult
}

export function TransactionResult({ result }: TransactionResultProps) {
  const chainId = useChainId()
  const [isExpanded, setIsExpanded] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleCopyHash = async () => {
    if (!result.txHash) return
    await copyToClipboard(result.txHash)
    setCopied(true)
    toast.success('Transaction hash copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (result.status === 'idle') return null

  const statusConfig = {
    pending: {
      icon: Loader2,
      label: 'Transaction Pending',
      color: 'text-accent-yellow',
      bg: 'bg-accent-yellow/10',
      border: 'border-accent-yellow/20',
      iconClass: 'animate-spin',
    },
    success: {
      icon: CheckCircle,
      label: result.isReadOnly ? 'Read Successful' : 'Transaction Confirmed',
      color: 'text-accent-green',
      bg: 'bg-accent-green/10',
      border: 'border-accent-green/20',
      iconClass: '',
    },
    failed: {
      icon: XCircle,
      label: 'Transaction Failed',
      color: 'text-accent-red',
      bg: 'bg-accent-red/10',
      border: 'border-accent-red/20',
      iconClass: '',
    },
  }

  const config = statusConfig[result.status as keyof typeof statusConfig]
  if (!config) return null

  const Icon = config.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn('card border', config.border)}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', config.bg)}>
              <Icon className={cn('w-5 h-5', config.color, config.iconClass)} />
            </div>
            <div className="text-left">
              <p className={cn('text-sm font-semibold', config.color)}>{config.label}</p>
              {result.functionName && (
                <p className="text-xs text-text-tertiary font-mono">{result.functionName}()</p>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3">
                {/* Transaction hash */}
                {result.txHash && (
                  <div>
                    <label className="label">Transaction Hash</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-bg-border font-mono text-xs text-text-primary overflow-x-auto">
                        {result.txHash}
                      </div>
                      <button
                        onClick={handleCopyHash}
                        className="p-2 rounded-xl bg-bg-tertiary border border-bg-border text-text-tertiary hover:text-text-primary transition-all"
                      >
                        {copied ? (
                          <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={getExplorerUrl(chainId, result.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-bg-tertiary border border-bg-border text-text-tertiary hover:text-text-primary transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Read result */}
                {result.isReadOnly && result.result !== undefined && (
                  <div>
                    <label className="label">Return Value</label>
                    <div className="px-3 py-2 rounded-xl bg-bg-tertiary border border-bg-border font-mono text-xs text-accent-green overflow-x-auto">
                      {typeof result.result === 'object'
                        ? JSON.stringify(result.result, null, 2)
                        : String(result.result)}
                    </div>
                  </div>
                )}

                {/* Block number */}
                {result.blockNumber && (
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="label">Block Number</label>
                      <p className="text-sm font-mono text-text-primary">#{result.blockNumber}</p>
                    </div>
                    {result.gasUsed && (
                      <div>
                        <label className="label">Gas Used</label>
                        <p className="text-sm font-mono text-text-primary">{result.gasUsed}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error */}
                {result.error && (
                  <div className="p-3 rounded-xl bg-accent-red/5 border border-accent-red/20">
                    <p className="text-xs font-medium text-accent-red mb-1">Error Details</p>
                    <p className="text-xs text-text-secondary font-mono break-all">{result.error}</p>
                  </div>
                )}

                {/* Args used */}
                {result.args && result.args.length > 0 && (
                  <div>
                    <label className="label">Arguments Used</label>
                    <div className="space-y-1">
                      {result.args.map((arg, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-bg-border"
                        >
                          <span className="text-xs text-text-tertiary w-4">{i}</span>
                          <span className="text-xs font-mono text-text-secondary">{arg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
