'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  LayoutDashboard,
  Terminal,
  Code2,
  ChevronLeft,
  ChevronRight,
  Zap,
  ExternalLink,
} from 'lucide-react'
import { useDashboardStore, type ActiveSection } from '@/lib/store'
import { cn } from '@/lib/utils'

interface NavItem {
  id: ActiveSection
  label: string
  icon: React.ElementType
  description: string
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'config',
    label: 'Config Builder',
    icon: Settings,
    description: 'General, Wallet, Contract, Advanced',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Wallet info, balances, history',
  },
  {
    id: 'executor',
    label: 'Contract Executor',
    icon: Terminal,
    description: 'Execute read/write functions',
    badge: 'Live',
  },
  {
    id: 'script',
    label: 'Script Generator',
    icon: Code2,
    description: 'Build & download script.js',
  },
]

export function Sidebar() {
  const { activeSection, setActiveSection, isSidebarOpen, setSidebarOpen } =
    useDashboardStore()

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          'fixed left-0 top-0 h-full z-30 flex flex-col',
          'bg-bg-secondary border-r border-bg-border',
          'transition-all duration-300'
        )}
        animate={{ width: isSidebarOpen ? 240 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        initial={{ width: 240, opacity: 1 }}
        style={{ overflow: 'hidden' }}
      >
        <div className="flex flex-col h-full w-[240px]">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-bg-border">
            <div className="w-8 h-8 rounded-xl bg-gradient-pink-purple flex items-center justify-center flex-shrink-0 glow-pink">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-text-primary truncate">WAASDK</h1>
              <p className="text-xs text-text-tertiary truncate">Web3 Dashboard</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <p className="px-3 mb-3 text-xs font-semibold text-text-tertiary uppercase tracking-widest">
              Navigation
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id

              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
                    'transition-all duration-200 group',
                    isActive
                      ? 'bg-bg-hover text-text-primary'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  )}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Active indicator */}
                  <div
                    className={cn(
                      'absolute left-0 w-0.5 h-6 rounded-r-full bg-gradient-pink-purple transition-all duration-200',
                      isActive ? 'opacity-100' : 'opacity-0'
                    )}
                  />

                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200',
                      isActive
                        ? 'bg-gradient-pink-purple shadow-glow-pink'
                        : 'bg-bg-tertiary group-hover:bg-bg-hover'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-green/15 text-accent-green border border-accent-green/20">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-bg-border space-y-2">
            <a
              href="https://docs.walletconnect.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all duration-200 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              WalletConnect Docs
            </a>
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="status-dot-green animate-pulse" />
                <span className="text-xs text-text-tertiary">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Toggle button */}
      <motion.button
        className={cn(
          'fixed z-40 top-[72px] flex items-center justify-center',
          'w-6 h-6 rounded-full bg-bg-card border border-bg-border',
          'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
          'transition-all duration-200 shadow-card',
          isSidebarOpen ? 'left-[228px]' : 'left-3'
        )}
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ left: isSidebarOpen ? 228 : 12 }}
        transition={{ duration: 0.3 }}
      >
        {isSidebarOpen ? (
          <ChevronLeft className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </motion.button>
    </>
  )
}
