'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Terminal,
  Play,
  Eye,
  PenLine,
  AlertCircle,
  Loader2,
  Zap,
  Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from 'wagmi'
import { parseAbi as viemParseAbi } from 'viem'
import { useDashboardStore } from '@/lib/store'
import { cn, buildCalldata } from '@/lib/utils'
import { parseAbi, extractFunctions, isValidAbi, type ParsedFunction } from '@/lib/contracts'
import { CalldataBuilder } from './CalldataBuilder'
import { TransactionResult, type TxResult } from './TransactionResult'

type FunctionFilter = 'all' | 'read' | 'write'

export function ContractExecutor() {
  const { config, addTransaction, updateTransaction } = useDashboardStore()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [selectedFn, setSelectedFn] = useState<ParsedFunction | null>(null)
  const [args, setArgs] = useState<Record<string, string>>({})
  const [valueWei, setValueWei] = useState('')
  const [filter, setFilter] = useState<FunctionFilter>('all')
  const [isExecuting, setIsExecuting] = useState(false)
  const [txResult, setTxResult] = useState<TxResult>({ status: 'idle' })
  const [gasEstimate, setGasEstimate] = useState('')
  const [calldata, setCalldata] = useState('')

  // Parse ABI
  let functions: ParsedFunction[] = []
  let abiParseError = ''
  if (config.contractAbi && isValidAbi(config.contractAbi)) {
    try {
      functions = extractFunctions(parseAbi(config.contractAbi))
    } catch (e) {
      abiParseError = e instanceof Error ? e.message : 'ABI parse error'
    }
  }

  const filteredFunctions = functions.filter((fn) => {
    if (filter === 'read') return fn.isReadOnly
    if (filter === 'write') return !fn.isReadOnly
    return true
  })

  const handleSelectFunction = (fn: ParsedFunction) => {
    setSelectedFn(fn)
    setArgs({})
    setValueWei('')
    setTxResult({ status: 'idle' })
    setGasEstimate('')
    setCalldata('')
  }

  const handleArgChange = useCallback(
    (name: string, value: string) => {
      const newArgs = { ...args, [name]: value }
      setArgs(newArgs)

      // Update calldata preview
      if (selectedFn) {
        const argValues = selectedFn.inputs.map((inp) => newArgs[inp.name] || '')
        const cd = buildCalldata(selectedFn.signature, argValues)
        setCalldata(cd.fullCalldata)
      }
    },
    [args, selectedFn]
  )

  const handleEstimateGas = async () => {
    if (!selectedFn || !config.contractAddress || !publicClient) return
    try {
      const argValues = selectedFn.inputs.map((inp) => args[inp.name] || '')
      const viemAbi = viemParseAbi([
        `function ${selectedFn.signature} ${selectedFn.stateMutability} returns (${selectedFn.outputs.map((o) => o.type).join(',')})`,
      ])

      const gas = await publicClient.estimateContractGas({
        address: config.contractAddress as `0x${string}`,
        abi: viemAbi,
        functionName: selectedFn.name,
        args: argValues as never[],
        account: address,
        value: valueWei ? BigInt(valueWei) : undefined,
      })
      setGasEstimate(gas.toString())
      toast.success(`Gas estimate: ${gas.toLocaleString()} units`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gas estimation failed'
      toast.error(msg)
    }
  }

  const handleExecute = async () => {
    if (!selectedFn || !config.contractAddress) {
      toast.error('Select a function and ensure contract address is configured')
      return
    }

    const argValues = selectedFn.inputs.map((inp) => args[inp.name] || '')

    setIsExecuting(true)
    setTxResult({ status: 'pending', functionName: selectedFn.name, args: argValues })

    try {
      const viemAbi = viemParseAbi([
        `function ${selectedFn.signature} ${selectedFn.stateMutability} returns (${selectedFn.outputs.map((o) => o.type).join(',')})`,
      ])

      if (selectedFn.isReadOnly) {
        // Read call
        if (!publicClient) throw new Error('No public client available')

        const result = await publicClient.readContract({
          address: config.contractAddress as `0x${string}`,
          abi: viemAbi,
          functionName: selectedFn.name,
          args: argValues as never[],
        })

        setTxResult({
          status: 'success',
          result,
          functionName: selectedFn.name,
          args: argValues,
          isReadOnly: true,
        })
        toast.success('Read call successful!')
      } else {
        // Write transaction
        if (!isConnected || !walletClient) {
          throw new Error('Wallet not connected. Please connect your wallet first.')
        }

        const txId = `tx-${Date.now()}`
        addTransaction({
          id: txId,
          txHash: '',
          functionName: selectedFn.name,
          args: argValues,
          status: 'pending',
          timestamp: Date.now(),
          chainId,
        })

        const hash = await walletClient.writeContract({
          address: config.contractAddress as `0x${string}`,
          abi: viemAbi,
          functionName: selectedFn.name,
          args: argValues as never[],
          value: valueWei ? BigInt(valueWei) : undefined,
        })

        updateTransaction(txId, { txHash: hash })
        setTxResult({
          status: 'pending',
          txHash: hash,
          functionName: selectedFn.name,
          args: argValues,
        })
        toast.loading('Waiting for confirmation...', { id: 'tx-confirm' })

        // Wait for receipt
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          const success = receipt.status === 'success'

          updateTransaction(txId, {
            txHash: hash,
            status: success ? 'success' : 'failed',
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: Number(receipt.blockNumber),
          })

          setTxResult({
            status: success ? 'success' : 'failed',
            txHash: hash,
            functionName: selectedFn.name,
            args: argValues,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: Number(receipt.blockNumber),
          })

          toast.dismiss('tx-confirm')
          if (success) {
            toast.success('Transaction confirmed!')
          } else {
            toast.error('Transaction reverted')
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      setTxResult({
        status: 'failed',
        error: msg,
        functionName: selectedFn.name,
        args: argValues,
      })
      toast.error(msg.slice(0, 100))
    } finally {
      setIsExecuting(false)
    }
  }

  const hasContract = !!config.contractAddress && !!config.contractAbi

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">Contract Executor</h2>
        <p className="text-sm text-text-secondary mt-1">
          Execute read and write functions on your configured contract
        </p>
      </div>

      {/* No config warning */}
      {!hasContract && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-2xl bg-accent-yellow/5 border border-accent-yellow/20"
        >
          <AlertCircle className="w-5 h-5 text-accent-yellow flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">Contract not configured</p>
            <p className="text-sm text-text-secondary mt-0.5">
              Go to{' '}
              <button
                onClick={() => useDashboardStore.getState().setActiveSection('config')}
                className="text-accent-blue hover:underline"
              >
                Config Builder → Contract
              </button>{' '}
              to set your contract address and ABI.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: function list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Terminal className="w-4 h-4 text-accent-pink" />
                Functions
                {functions.length > 0 && (
                  <span className="badge badge-purple">{functions.length}</span>
                )}
              </h3>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 p-1 bg-bg-secondary rounded-xl border border-bg-border mb-3">
              {(['all', 'read', 'write'] as FunctionFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 capitalize',
                    filter === f
                      ? 'bg-bg-card text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {f === 'read' && <Eye className="w-3 h-3 inline mr-1" />}
                  {f === 'write' && <PenLine className="w-3 h-3 inline mr-1" />}
                  {f}
                </button>
              ))}
            </div>

            {/* Function list */}
            {abiParseError ? (
              <p className="text-xs text-accent-red p-2">{abiParseError}</p>
            ) : filteredFunctions.length === 0 ? (
              <div className="text-center py-8">
                <Terminal className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-secondary">
                  {hasContract ? 'No functions found' : 'Configure contract first'}
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {filteredFunctions.map((fn) => (
                  <button
                    key={fn.signature}
                    onClick={() => handleSelectFunction(fn)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
                      selectedFn?.name === fn.name
                        ? 'bg-bg-hover border border-bg-border text-text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    )}
                  >
                    <span
                      className={cn(
                        'badge text-[10px] flex-shrink-0',
                        fn.isReadOnly ? 'badge-blue' : fn.isPayable ? 'badge-yellow' : 'badge-purple'
                      )}
                    >
                      {fn.isReadOnly ? 'R' : fn.isPayable ? 'P' : 'W'}
                    </span>
                    <span className="text-sm font-mono truncate">{fn.name}</span>
                    {fn.inputs.length > 0 && (
                      <span className="text-xs text-text-muted ml-auto flex-shrink-0">
                        {fn.inputs.length} arg{fn.inputs.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: executor panel */}
        <div className="lg:col-span-3 space-y-4">
          {selectedFn ? (
            <>
              {/* Function details */}
              <div className="card space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-text-primary font-mono">
                        {selectedFn.name}
                      </h3>
                      <span
                        className={cn(
                          'badge',
                          selectedFn.isReadOnly ? 'badge-blue' : selectedFn.isPayable ? 'badge-yellow' : 'badge-purple'
                        )}
                      >
                        {selectedFn.stateMutability}
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary font-mono mt-1">
                      {selectedFn.signature}
                    </p>
                  </div>
                </div>

                {/* Inputs */}
                {selectedFn.inputs.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                      Parameters
                    </p>
                    {selectedFn.inputs.map((input) => (
                      <div key={input.name}>
                        <label className="label">
                          {input.name}{' '}
                          <span className="text-accent-purple normal-case font-mono">
                            ({input.type})
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input font-mono"
                          placeholder={getPlaceholder(input.type)}
                          value={args[input.name] || ''}
                          onChange={(e) => handleArgChange(input.name, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-bg-tertiary border border-bg-border">
                    <Info className="w-4 h-4 text-text-tertiary" />
                    <p className="text-xs text-text-secondary">This function takes no parameters</p>
                  </div>
                )}

                {/* Value (payable) */}
                {selectedFn.isPayable && (
                  <div>
                    <label className="label">
                      ETH Value (wei){' '}
                      <span className="text-accent-yellow normal-case">(payable)</span>
                    </label>
                    <input
                      type="text"
                      className="input font-mono"
                      placeholder="0"
                      value={valueWei}
                      onChange={(e) => setValueWei(e.target.value)}
                    />
                  </div>
                )}

                {/* Outputs */}
                {selectedFn.outputs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
                      Returns
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFn.outputs.map((out, i) => (
                        <span key={i} className="badge badge-blue font-mono text-xs">
                          {out.name || `out${i}`}: {out.type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  {!selectedFn.isReadOnly && (
                    <button
                      onClick={handleEstimateGas}
                      className="btn-secondary flex-1"
                      disabled={isExecuting || !config.contractAddress}
                    >
                      <Zap className="w-4 h-4" />
                      Estimate Gas
                    </button>
                  )}
                  <button
                    onClick={handleExecute}
                    className={cn(
                      'flex-1',
                      selectedFn.isReadOnly ? 'btn-secondary' : 'btn-primary'
                    )}
                    disabled={isExecuting || !config.contractAddress}
                  >
                    {isExecuting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : selectedFn.isReadOnly ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {isExecuting
                      ? 'Executing...'
                      : selectedFn.isReadOnly
                      ? 'Read'
                      : 'Execute'}
                  </button>
                </div>

                {/* Wallet warning for write functions */}
                {!selectedFn.isReadOnly && !isConnected && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-yellow/5 border border-accent-yellow/20">
                    <AlertCircle className="w-4 h-4 text-accent-yellow flex-shrink-0" />
                    <p className="text-xs text-text-secondary">
                      Connect your wallet to execute write functions
                    </p>
                  </div>
                )}
              </div>

              {/* Calldata builder */}
              <CalldataBuilder
                selectedFunction={selectedFn}
                args={args}
                calldata={calldata}
                gasEstimate={gasEstimate}
              />

              {/* Transaction result */}
              <TransactionResult result={txResult} />
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-bg-tertiary border border-bg-border flex items-center justify-center mb-4">
                <Terminal className="w-7 h-7 text-text-tertiary" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-2">
                Select a Function
              </h3>
              <p className="text-sm text-text-secondary max-w-xs">
                Choose a contract function from the list on the left to configure and execute it
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getPlaceholder(type: string): string {
  if (type === 'address') return '0x...'
  if (type.startsWith('uint') || type.startsWith('int')) return '0'
  if (type === 'bool') return 'true / false'
  if (type === 'bytes32') return '0x...'
  if (type === 'string') return 'Enter string value'
  if (type.endsWith('[]')) return 'Comma-separated values'
  return `Enter ${type}`
}
