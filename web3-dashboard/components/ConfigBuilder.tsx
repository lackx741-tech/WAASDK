'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Wallet,
  FileCode,
  Sliders,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Plus,
  X,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useDashboardStore } from '@/lib/store'
import { cn, isAddress } from '@/lib/utils'
import { isValidAbi, parseAbi, extractFunctions, ERC20_ABI, ERC721_ABI } from '@/lib/contracts'
import { CHAIN_METADATA } from '@/lib/web3'

type ConfigTab = 'general' | 'wallet' | 'contract' | 'advanced'

const TABS: { id: ConfigTab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'contract', label: 'Contract', icon: FileCode },
  { id: 'advanced', label: 'Advanced', icon: Sliders },
]

const PRESET_ABIS = [
  { label: 'ERC-20 Token', value: JSON.stringify(ERC20_ABI, null, 2) },
  { label: 'ERC-721 NFT', value: JSON.stringify(ERC721_ABI, null, 2) },
]

export function ConfigBuilder() {
  const { config, updateConfig, resetConfig, isConfigDirty, setConfigDirty } =
    useDashboardStore()
  const [activeTab, setActiveTab] = useState<ConfigTab>('general')
  const [abiError, setAbiError] = useState('')
  const [addressError, setAddressError] = useState('')

  const handleSave = () => {
    // Validate before saving
    if (config.contractAddress && !isAddress(config.contractAddress)) {
      setAddressError('Invalid Ethereum address')
      setActiveTab('contract')
      return
    }
    if (config.contractAbi && !isValidAbi(config.contractAbi)) {
      setAbiError('Invalid ABI JSON')
      setActiveTab('contract')
      return
    }
    setConfigDirty(false)
    toast.success('Configuration saved!')
  }

  const handleReset = () => {
    resetConfig()
    setAbiError('')
    setAddressError('')
    toast('Configuration reset to defaults', { icon: '↺' })
  }

  const handleAbiChange = (value: string) => {
    updateConfig({ contractAbi: value })
    if (value && !isValidAbi(value)) {
      setAbiError('Invalid JSON — check your ABI format')
    } else {
      setAbiError('')
      // Auto-populate enabled functions
      if (value) {
        try {
          const fns = extractFunctions(parseAbi(value))
          updateConfig({ enabledFunctions: fns.map((f) => f.name) })
        } catch {}
      }
    }
  }

  const handleAddressChange = (value: string) => {
    updateConfig({ contractAddress: value })
    if (value && !isAddress(value)) {
      setAddressError('Invalid Ethereum address format')
    } else {
      setAddressError('')
    }
  }

  const toggleChain = (chainId: number) => {
    const current = config.enabledChainIds
    const updated = current.includes(chainId)
      ? current.filter((id) => id !== chainId)
      : [...current, chainId]
    updateConfig({ enabledChainIds: updated })
  }

  const toggleFunction = (fnName: string) => {
    const current = config.enabledFunctions
    const updated = current.includes(fnName)
      ? current.filter((f) => f !== fnName)
      : [...current, fnName]
    updateConfig({ enabledFunctions: updated })
  }

  const loadPresetAbi = (abiJson: string) => {
    handleAbiChange(abiJson)
    toast.success('Preset ABI loaded')
  }

  let parsedFunctions: ReturnType<typeof extractFunctions> = []
  if (config.contractAbi && isValidAbi(config.contractAbi)) {
    try {
      parsedFunctions = extractFunctions(parseAbi(config.contractAbi))
    } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Configuration Builder</h2>
          <p className="text-sm text-text-secondary mt-1">
            Set up your Web3 application — General, Wallet, Contract, and Advanced settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConfigDirty && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="badge badge-yellow"
            >
              Unsaved changes
            </motion.span>
          )}
          <button onClick={handleReset} className="btn-ghost">
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button onClick={handleSave} className="btn-primary">
            <Save className="w-4 h-4" />
            Save Config
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-2xl border border-bg-border">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-bg-card text-text-primary shadow-card'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ── General ── */}
        {activeTab === 'general' && (
          <div className="card space-y-5">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Settings className="w-4 h-4 text-accent-pink" />
              General Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">App Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="My Web3 App"
                  value={config.appName}
                  onChange={(e) => updateConfig({ appName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-xl border border-bg-border bg-bg-tertiary cursor-pointer p-1"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="#fc72ff"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">App Description</label>
              <textarea
                className="textarea"
                placeholder="A Web3 application powered by WAASDK"
                value={config.appDescription}
                onChange={(e) => updateConfig({ appDescription: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <label className="label">Logo URL (optional)</label>
              <input
                type="url"
                className="input"
                placeholder="https://example.com/logo.png"
                value={config.logoUrl}
                onChange={(e) => updateConfig({ logoUrl: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-bg-tertiary border border-bg-border">
              <div>
                <p className="text-sm font-medium text-text-primary">Dark Mode</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Enable dark theme in the generated script
                </p>
              </div>
              <button
                onClick={() => updateConfig({ darkMode: !config.darkMode })}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-all duration-200',
                  config.darkMode ? 'bg-accent-pink' : 'bg-bg-border'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200',
                    config.darkMode ? 'left-5' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          </div>
        )}

        {/* ── Wallet ── */}
        {activeTab === 'wallet' && (
          <div className="card space-y-5">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Wallet className="w-4 h-4 text-accent-blue" />
              Wallet Settings
            </h3>

            <div>
              <label className="label">WalletConnect Project ID</label>
              <input
                type="text"
                className="input font-mono"
                placeholder="Get yours at cloud.walletconnect.com"
                value={config.walletConnectProjectId}
                onChange={(e) => updateConfig({ walletConnectProjectId: e.target.value })}
              />
              <p className="text-xs text-text-tertiary mt-1.5">
                Required for WalletConnect integration.{' '}
                <a
                  href="https://cloud.walletconnect.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  Get a free project ID →
                </a>
              </p>
            </div>

            <div>
              <label className="label">Default Chain</label>
              <div className="relative">
                <select
                  className="input appearance-none pr-10"
                  value={config.defaultChainId}
                  onChange={(e) => updateConfig({ defaultChainId: Number(e.target.value), chainId: Number(e.target.value) })}
                >
                  {Object.entries(CHAIN_METADATA).map(([id, meta]) => (
                    <option key={id} value={id}>
                      {meta.icon} {meta.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label">Enabled Networks</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(CHAIN_METADATA).map(([id, meta]) => {
                  const chainId = Number(id)
                  const isEnabled = config.enabledChainIds.includes(chainId)
                  return (
                    <button
                      key={id}
                      onClick={() => toggleChain(chainId)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200',
                        isEnabled
                          ? 'border-opacity-50 text-white'
                          : 'bg-bg-tertiary border-bg-border text-text-secondary hover:bg-bg-hover'
                      )}
                      style={
                        isEnabled
                          ? {
                              backgroundColor: `${meta.color}20`,
                              borderColor: `${meta.color}50`,
                              color: meta.color,
                            }
                          : {}
                      }
                    >
                      <span>{meta.icon}</span>
                      <span className="truncate">{meta.name}</span>
                      {isEnabled && <CheckCircle className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Contract ── */}
        {activeTab === 'contract' && (
          <div className="space-y-4">
            <div className="card space-y-5">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <FileCode className="w-4 h-4 text-accent-purple" />
                Contract Settings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Contract Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="MyToken"
                    value={config.contractName}
                    onChange={(e) => updateConfig({ contractName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Contract Address</label>
                  <input
                    type="text"
                    className={cn('input font-mono', addressError && 'input-error')}
                    placeholder="0x..."
                    value={config.contractAddress}
                    onChange={(e) => handleAddressChange(e.target.value)}
                  />
                  {addressError && (
                    <p className="text-xs text-accent-red mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {addressError}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Contract ABI</label>
                  <div className="flex gap-2">
                    {PRESET_ABIS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => loadPresetAbi(preset.value)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-bg-tertiary border border-bg-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className={cn('textarea min-h-[200px]', abiError && 'input-error')}
                  placeholder='[{"type":"function","name":"balanceOf","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"}]'
                  value={config.contractAbi}
                  onChange={(e) => handleAbiChange(e.target.value)}
                  rows={10}
                />
                {abiError ? (
                  <p className="text-xs text-accent-red mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {abiError}
                  </p>
                ) : config.contractAbi && parsedFunctions.length > 0 ? (
                  <p className="text-xs text-accent-green mt-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Valid ABI — {parsedFunctions.length} functions detected
                  </p>
                ) : null}
              </div>
            </div>

            {/* Function selector */}
            {parsedFunctions.length > 0 && (
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Enabled Functions ({config.enabledFunctions.length}/{parsedFunctions.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateConfig({ enabledFunctions: parsedFunctions.map((f) => f.name) })}
                      className="text-xs px-2.5 py-1 rounded-lg bg-bg-tertiary border border-bg-border text-text-secondary hover:text-text-primary transition-all"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => updateConfig({ enabledFunctions: [] })}
                      className="text-xs px-2.5 py-1 rounded-lg bg-bg-tertiary border border-bg-border text-text-secondary hover:text-text-primary transition-all"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {parsedFunctions.map((fn) => {
                    const isEnabled = config.enabledFunctions.includes(fn.name)
                    return (
                      <button
                        key={fn.signature}
                        onClick={() => toggleFunction(fn.name)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-200',
                          isEnabled
                            ? 'bg-accent-purple/10 border-accent-purple/30 text-text-primary'
                            : 'bg-bg-tertiary border-bg-border text-text-secondary hover:bg-bg-hover'
                        )}
                      >
                        <span
                          className={cn(
                            'badge text-[10px]',
                            fn.isReadOnly ? 'badge-blue' : 'badge-purple'
                          )}
                        >
                          {fn.isReadOnly ? 'read' : 'write'}
                        </span>
                        <span className="text-sm font-mono truncate">{fn.name}</span>
                        {isEnabled && (
                          <CheckCircle className="w-3.5 h-3.5 text-accent-purple ml-auto flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Advanced ── */}
        {activeTab === 'advanced' && (
          <div className="card space-y-5">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent-cyan" />
              Advanced Settings
            </h3>

            <div>
              <label className="label">Backend URL (optional)</label>
              <input
                type="url"
                className="input"
                placeholder="https://your-backend.railway.app"
                value={config.backendUrl}
                onChange={(e) => updateConfig({ backendUrl: e.target.value })}
              />
              <p className="text-xs text-text-tertiary mt-1.5">
                Optional backend for saving configs and analytics
              </p>
            </div>

            <div>
              <label className="label">Gas Multiplier</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.1"
                  className="flex-1 accent-accent-pink"
                  value={config.gasMultiplier}
                  onChange={(e) => updateConfig({ gasMultiplier: parseFloat(e.target.value) })}
                />
                <span className="text-sm font-mono text-text-primary w-10 text-right">
                  {config.gasMultiplier.toFixed(1)}x
                </span>
              </div>
              <p className="text-xs text-text-tertiary mt-1.5">
                Multiply gas estimates by this factor to reduce failed transactions
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: 'autoSwitchNetwork' as const,
                  label: 'Auto-switch Network',
                  desc: 'Automatically prompt users to switch to the configured chain',
                },
                {
                  key: 'showGasEstimate' as const,
                  label: 'Show Gas Estimate',
                  desc: 'Display gas cost estimates before sending transactions',
                },
                {
                  key: 'enableNotifications' as const,
                  label: 'Enable Notifications',
                  desc: 'Show toast notifications for wallet events and transactions',
                },
              ].map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-xl bg-bg-tertiary border border-bg-border"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{label}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => updateConfig({ [key]: !config[key] })}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-all duration-200',
                      config[key] ? 'bg-accent-pink' : 'bg-bg-border'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200',
                        config[key] ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Save bar */}
      {isConfigDirty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4 flex items-center justify-between p-4 rounded-2xl bg-bg-card border border-accent-pink/30 shadow-glow-pink"
        >
          <p className="text-sm text-text-secondary">
            You have unsaved changes
          </p>
          <div className="flex gap-2">
            <button onClick={handleReset} className="btn-ghost text-xs">
              Discard
            </button>
            <button onClick={handleSave} className="btn-primary text-xs">
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
