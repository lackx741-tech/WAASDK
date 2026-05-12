/**
 * Zustand global store for dashboard configuration and state
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveSection = 'config' | 'dashboard' | 'executor' | 'script'

export interface DashboardConfig {
  // General
  appName: string
  appDescription: string
  primaryColor: string
  logoUrl: string
  darkMode: boolean

  // Wallet
  walletConnectProjectId: string
  enabledChainIds: number[]
  defaultChainId: number

  // Contract
  contractAddress: string
  contractAbi: string
  contractName: string
  enabledFunctions: string[]

  // Advanced
  backendUrl: string
  chainId: number
  gasMultiplier: number
  autoSwitchNetwork: boolean
  showGasEstimate: boolean
  enableNotifications: boolean
}

export interface TransactionRecord {
  id: string
  txHash: string
  functionName: string
  args: string[]
  status: 'pending' | 'success' | 'failed'
  timestamp: number
  chainId: number
  gasUsed?: string
  blockNumber?: number
  error?: string
}

export interface ExecutorState {
  selectedFunction: string
  functionArgs: Record<string, string>
  isExecuting: boolean
  lastResult: unknown
  lastError: string | null
  calldata: string
  gasEstimate: string
}

export interface DashboardStore {
  // Navigation
  activeSection: ActiveSection
  setActiveSection: (section: ActiveSection) => void

  // Config
  config: DashboardConfig
  updateConfig: (updates: Partial<DashboardConfig>) => void
  resetConfig: () => void

  // Executor
  executor: ExecutorState
  updateExecutor: (updates: Partial<ExecutorState>) => void
  resetExecutor: () => void

  // Transaction history
  transactions: TransactionRecord[]
  addTransaction: (tx: TransactionRecord) => void
  updateTransaction: (id: string, updates: Partial<TransactionRecord>) => void
  clearTransactions: () => void

  // UI state
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  isConfigDirty: boolean
  setConfigDirty: (dirty: boolean) => void
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: DashboardConfig = {
  appName: 'My Web3 App',
  appDescription: 'A Web3 application powered by WAASDK',
  primaryColor: '#fc72ff',
  logoUrl: '',
  darkMode: true,

  walletConnectProjectId: '',
  enabledChainIds: [1, 137, 56],
  defaultChainId: 1,

  contractAddress: '',
  contractAbi: '',
  contractName: '',
  enabledFunctions: [],

  backendUrl: '',
  chainId: 1,
  gasMultiplier: 1.2,
  autoSwitchNetwork: true,
  showGasEstimate: true,
  enableNotifications: true,
}

const DEFAULT_EXECUTOR: ExecutorState = {
  selectedFunction: '',
  functionArgs: {},
  isExecuting: false,
  lastResult: null,
  lastError: null,
  calldata: '',
  gasEstimate: '',
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      // Navigation
      activeSection: 'config',
      setActiveSection: (section) => set({ activeSection: section }),

      // Config
      config: DEFAULT_CONFIG,
      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
          isConfigDirty: true,
        })),
      resetConfig: () => set({ config: DEFAULT_CONFIG, isConfigDirty: false }),

      // Executor
      executor: DEFAULT_EXECUTOR,
      updateExecutor: (updates) =>
        set((state) => ({
          executor: { ...state.executor, ...updates },
        })),
      resetExecutor: () => set({ executor: DEFAULT_EXECUTOR }),

      // Transactions
      transactions: [],
      addTransaction: (tx) =>
        set((state) => ({
          transactions: [tx, ...state.transactions].slice(0, 50), // Keep last 50
        })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx
          ),
        })),
      clearTransactions: () => set({ transactions: [] }),

      // UI
      isSidebarOpen: true,
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      isConfigDirty: false,
      setConfigDirty: (dirty) => set({ isConfigDirty: dirty }),
    }),
    {
      name: 'waasdk-dashboard',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
        transactions: state.transactions,
        activeSection: state.activeSection,
      }),
    }
  )
)
