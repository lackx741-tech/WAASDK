'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Code2, Copy, CheckCircle, ChevronDown, ChevronUp, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, copyToClipboard } from '@/lib/utils'
import type { ParsedFunction } from '@/lib/contracts'

interface CalldataBuilderProps {
  selectedFunction: ParsedFunction | null
  args: Record<string, string>
  calldata: string
  gasEstimate: string
}

export function CalldataBuilder({
  selectedFunction,
  args,
  calldata,
  gasEstimate,
}: CalldataBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleCopy = async (text: string, field: string) => {
    await copyToClipboard(text)
    setCopiedField(field)
    toast.success(`${field} copied!`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  if (!selectedFunction) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Code2 className="w-4 h-4 text-accent-cyan" />
          <h3 className="text-sm font-semibold text-text-primary">Calldata Builder</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Code2 className="w-8 h-8 text-text-muted mb-2" />
          <p className="text-sm text-text-secondary">Select a function to see calldata</p>
        </div>
      </div>
    )
  }

  const selector = calldata.slice(0, 10)
  const encodedArgs = calldata.slice(10)
  const argValues = Object.values(args)

  return (
    <div className="card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-accent-cyan" />
          <h3 className="text-sm font-semibold text-text-primary">Calldata Builder</h3>
          {calldata && (
            <span className="badge badge-blue text-[10px]">
              {calldata.length / 2 - 1} bytes
            </span>
          )}
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
            <div className="space-y-3">
              {/* Function signature */}
              <div>
                <label className="label">Function Signature</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-bg-border font-mono text-xs text-accent-cyan overflow-x-auto">
                    {selectedFunction.signature}
                  </div>
                  <button
                    onClick={() => handleCopy(selectedFunction.signature, 'Signature')}
                    className="p-2 rounded-xl bg-bg-tertiary border border-bg-border text-text-tertiary hover:text-text-primary transition-all"
                  >
                    {copiedField === 'Signature' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Function selector */}
              <div>
                <label className="label">Function Selector (4 bytes)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-bg-border font-mono text-xs text-accent-purple overflow-x-auto">
                    {selector || '0x????????'}
                  </div>
                  <button
                    onClick={() => handleCopy(selector, 'Selector')}
                    className="p-2 rounded-xl bg-bg-tertiary border border-bg-border text-text-tertiary hover:text-text-primary transition-all"
                    disabled={!selector}
                  >
                    {copiedField === 'Selector' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Encoded args */}
              {encodedArgs && (
                <div>
                  <label className="label">Encoded Arguments</label>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-bg-border font-mono text-xs text-text-secondary overflow-x-auto break-all leading-relaxed">
                      {encodedArgs.match(/.{1,64}/g)?.map((chunk, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-text-muted w-6 flex-shrink-0">{i}</span>
                          <span>{chunk}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleCopy(encodedArgs, 'Args')}
                      className="p-2 rounded-xl bg-bg-tertiary border border-bg-border text-text-tertiary hover:text-text-primary transition-all flex-shrink-0"
                    >
                      {copiedField === 'Args' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Full calldata */}
              {calldata && (
                <div>
                  <label className="label">Full Calldata</label>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 px-3 py-2 rounded-xl bg-bg-secondary border border-bg-border font-mono text-xs text-text-primary overflow-x-auto break-all leading-relaxed">
                      <span className="text-accent-purple">{selector}</span>
                      <span className="text-text-secondary">{encodedArgs}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(calldata, 'Calldata')}
                      className="p-2 rounded-xl bg-bg-tertiary border border-bg-border text-text-tertiary hover:text-text-primary transition-all flex-shrink-0"
                    >
                      {copiedField === 'Calldata' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Gas estimate */}
              {gasEstimate && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/20">
                  <Info className="w-4 h-4 text-accent-blue flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-primary">Gas Estimate</p>
                    <p className="text-xs text-text-secondary font-mono">{gasEstimate} gas units</p>
                  </div>
                </div>
              )}

              {/* Human readable */}
              <div>
                <label className="label">Human Readable</label>
                <div className="px-3 py-2 rounded-xl bg-bg-tertiary border border-bg-border font-mono text-xs text-text-secondary">
                  <span className="text-accent-cyan">{selectedFunction.name}</span>
                  <span className="text-text-tertiary">(</span>
                  {selectedFunction.inputs.map((input, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-text-tertiary">, </span>}
                      <span className="text-accent-purple">{input.type}</span>
                      <span className="text-text-secondary"> {input.name}</span>
                      {argValues[i] !== undefined && (
                        <span className="text-accent-green"> = {argValues[i] || '""'}</span>
                      )}
                    </span>
                  ))}
                  <span className="text-text-tertiary">)</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
