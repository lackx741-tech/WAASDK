'use client'

import { motion } from 'framer-motion'
import {
  Wallet,
  TrendingUp,
  Activity,
  ExternalLink,
  RefreshCw,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Layers,
} from 'lucide-react'
import { useAccount, useBalance, useChainId, useBlockNumber } from 'wagmi'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useDashboardStore } from '@/lib/store'
import {
  cn,
  shortenAddress,
  formatEther,
  formatDate,
  getExplorerUrl,
  getAddressExplorerUrl,
  copyToClipboard,
} from '@/lib/utils'
import { CHAIN_METADATA } from '@/lib/web3'

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
}

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: balance, refetch: refetchBalance, isLoading: balanceLoading } = useBalance({ address })
  const { data: blockNumber } = useBlockNumber({ watch: true })
  const { transactions, clearTransactions, config } = useDashboardStore()
  const [copied, setCopied] = useState(false)

  const chainMeta = CHAIN_METADATA[chainId]

  const handleCopyAddress = async () => {
    if (!address) return
    await copyToClipboard(address)
    setCopied(true)
    toast.success('Address copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = () => {
    refetchBalance()
    toast.success('Balance refreshed')
  }

  const successTxs = transactions.filter((t) => t.status === 'success').length
  const failedTxs = transactions.filter((t) => t.status === 'failed').length
  const pendingTxs = transactions.filter((t) => t.status === 'pending').length

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-bg-tertiary border border-bg-border flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Wallet Connected</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Connect your wallet using the button in the header to view your dashboard, balances, and transaction history.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Dashboard</h2>
          <p className="text-sm text-text-secondary mt-1">
            Wallet overview and transaction history
          </p>
        </div>
        <button onClick={handleRefresh} className="btn-ghost">
          <RefreshCw className={cn('w-4 h-4', balanceLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Balance',
            value: balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ${balance.symbol}` : '—',
            icon: Wallet,
            color: 'text-accent-blue',
            bg: 'bg-accent-blue/10',
          },
          {
            label: 'Network',
            value: chainMeta?.name || `Chain ${chainId}`,
            icon: Layers,
            color: 'text-accent-purple',
            bg: 'bg-accent-purple/10',
          },
          {
            label: 'Block',
            value: blockNumber ? `#${blockNumber.toLocaleString()}` : '—',
            icon: Activity,
            color: 'text-accent-green',
            bg: 'bg-accent-green/10',
          },
          {
            label: 'Transactions',
            value: transactions.length.toString(),
            icon: TrendingUp,
            color: 'text-accent-pink',
            bg: 'bg-accent-pink/10',
          },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="card"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-text-tertiary uppercase tracking-wide">{stat.label}</p>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', stat.bg)}>
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </div>
              <p className="text-lg font-bold text-text-primary truncate">{stat.value}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Wallet card */}
      <motion.div
        custom={4}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Wallet className="w-4 h-4 text-accent-blue" />
            Connected Wallet
          </h3>
          {chainMeta && (
            <span
              className="badge text-xs"
              style={{
                backgroundColor: `${chainMeta.color}15`,
                borderColor: `${chainMeta.color}30`,
                color: chainMeta.color,
              }}
            >
              {chainMeta.icon} {chainMeta.name}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-pink-purple flex items-center justify-center flex-shrink-0 glow-pink">
            <span className="text-white font-bold text-lg">
              {address ? address.slice(2, 4).toUpperCase() : '??'}
            </span>
          </div>

          {/* Address */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-text-primary break-all">
                {address}
              </span>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 rounded-lg hover:bg-bg-hover transition-all text-text-tertiary hover:text-text-primary"
              >
                {copied ? (
                  <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <a
                href={getAddressExplorerUrl(chainId, address || '')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-bg-hover transition-all text-text-tertiary hover:text-text-primary"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-xs text-text-tertiary mt-1">
              {balance
                ? `${parseFloat(formatEther(balance.value)).toFixed(6)} ${balance.symbol}`
                : 'Loading balance...'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Transaction stats */}
      {transactions.length > 0 && (
        <motion.div
          custom={5}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-3 gap-4"
        >
          {[
            { label: 'Successful', count: successTxs, icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/10' },
            { label: 'Pending', count: pendingTxs, icon: Clock, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
            { label: 'Failed', count: failedTxs, icon: XCircle, color: 'text-accent-red', bg: 'bg-accent-red/10' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="card text-center">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', stat.bg)}>
                  <Icon className={cn('w-5 h-5', stat.color)} />
                </div>
                <p className="text-2xl font-bold text-text-primary">{stat.count}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{stat.label}</p>
              </div>
            )
          })}
        </motion.div>
      )}

      {/* Transaction history */}
      <motion.div
        custom={6}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-pink" />
            Transaction History
            {transactions.length > 0 && (
              <span className="badge badge-purple">{transactions.length}</span>
            )}
          </h3>
          {transactions.length > 0 && (
            <button onClick={clearTransactions} className="btn-ghost text-xs">
              Clear All
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="w-10 h-10 text-text-muted mb-3" />
            <p className="text-sm text-text-secondary">No transactions yet</p>
            <p className="text-xs text-text-tertiary mt-1">
              Execute contract functions to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-bg-border hover:bg-bg-hover transition-all"
              >
                {/* Status icon */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    tx.status === 'success' && 'bg-accent-green/10',
                    tx.status === 'failed' && 'bg-accent-red/10',
                    tx.status === 'pending' && 'bg-accent-yellow/10'
                  )}
                >
                  {tx.status === 'success' && <CheckCircle className="w-4 h-4 text-accent-green" />}
                  {tx.status === 'failed' && <XCircle className="w-4 h-4 text-accent-red" />}
                  {tx.status === 'pending' && <Clock className="w-4 h-4 text-accent-yellow animate-pulse" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary font-mono truncate">
                      {tx.functionName}()
                    </span>
                    <span
                      className={cn(
                        'badge text-[10px]',
                        tx.status === 'success' && 'badge-green',
                        tx.status === 'failed' && 'badge-red',
                        tx.status === 'pending' && 'badge-yellow'
                      )}
                    >
                      {tx.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-tertiary font-mono">
                      {shortenAddress(tx.txHash)}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="text-xs text-text-tertiary">
                      {formatDate(tx.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Explorer link */}
                <a
                  href={getExplorerUrl(tx.chainId, tx.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-bg-hover transition-all text-text-tertiary hover:text-text-primary flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
