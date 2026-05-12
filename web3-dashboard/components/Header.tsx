'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion } from 'framer-motion'
import { Menu, WifiOff } from 'lucide-react'
import { useAccount, useChainId, useBalance } from 'wagmi'
import { useDashboardStore } from '@/lib/store'
import { cn, shortenAddress, formatEther } from '@/lib/utils'
import { CHAIN_METADATA } from '@/lib/web3'

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  config: { title: 'Config Builder', subtitle: 'Configure your Web3 application settings' },
  dashboard: { title: 'Dashboard', subtitle: 'Monitor wallet activity and transactions' },
  executor: { title: 'Contract Executor', subtitle: 'Execute smart contract functions live' },
  script: { title: 'Script Generator', subtitle: 'Build and download your embeddable script.js' },
}

export function Header() {
  const { activeSection, setSidebarOpen, isSidebarOpen } = useDashboardStore()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: balance } = useBalance({ address })

  const sectionInfo = SECTION_TITLES[activeSection] || SECTION_TITLES.config
  const chainMeta = CHAIN_METADATA[chainId]

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 h-16 bg-bg-secondary/80 backdrop-blur-xl border-b border-bg-border">
      {/* Left: menu + title */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="md:hidden p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <motion.h2
            key={activeSection}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-base font-semibold text-text-primary truncate"
          >
            {sectionInfo.title}
          </motion.h2>
          <motion.p
            key={`${activeSection}-sub`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="text-xs text-text-tertiary hidden sm:block truncate"
          >
            {sectionInfo.subtitle}
          </motion.p>
        </div>
      </div>

      {/* Right: chain info + wallet */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        {isConnected && address ? (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-tertiary border border-bg-border">
            <div className="status-dot-green" />
            <span className="text-xs text-text-secondary font-mono">
              {shortenAddress(address)}
            </span>
            {balance && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-xs text-text-secondary">
                  {parseFloat(formatEther(balance.value)).toFixed(3)} {balance.symbol}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-tertiary border border-bg-border">
            <WifiOff className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Not connected</span>
          </div>
        )}

        {/* Chain badge */}
        {isConnected && chainMeta && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium"
            style={{
              backgroundColor: `${chainMeta.color}15`,
              borderColor: `${chainMeta.color}30`,
              color: chainMeta.color,
            }}
          >
            <span>{chainMeta.icon}</span>
            <span>{chainMeta.name}</span>
          </div>
        )}

        {/* RainbowKit connect button */}
        <ConnectButton
          accountStatus="avatar"
          chainStatus="icon"
          showBalance={false}
        />
      </div>
    </header>
  )
}
