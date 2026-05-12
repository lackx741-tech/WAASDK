'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { ConfigBuilder } from '@/components/ConfigBuilder'
import { Dashboard } from '@/components/Dashboard'
import { ContractExecutor } from '@/components/ContractExecutor'
import { ScriptGenerator } from '@/components/ScriptGenerator'
import { useDashboardStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.2,
}

export default function Home() {
  const { activeSection, isSidebarOpen } = useDashboardStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-accent-pink border-t-transparent animate-spin" />
          <p className="text-text-secondary text-sm">Loading WAASDK Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 transition-all duration-300',
          isSidebarOpen ? 'ml-0 md:ml-[240px]' : 'ml-0'
        )}
      >
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            {activeSection === 'config' && (
              <motion.div
                key="config"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <ConfigBuilder />
              </motion.div>
            )}

            {activeSection === 'dashboard' && (
              <motion.div
                key="dashboard"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <Dashboard />
              </motion.div>
            )}

            {activeSection === 'executor' && (
              <motion.div
                key="executor"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <ContractExecutor />
              </motion.div>
            )}

            {activeSection === 'script' && (
              <motion.div
                key="script"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <ScriptGenerator />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
