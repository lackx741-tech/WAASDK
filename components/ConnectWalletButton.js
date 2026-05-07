'use client'

/**
 * ConnectWalletButton
 *
 * A reusable component that encapsulates all wallet connect / disconnect logic
 * via Reown AppKit (WalletConnect v2).
 *
 * Usage:
 *   import ConnectWalletButton from '@/components/ConnectWalletButton'
 *   ...
 *   <ConnectWalletButton />
 *
 * The component renders:
 *  - A "CONNECT WALLET" button when no wallet is connected.
 *  - The shortened wallet address + a "Disconnect" button when connected.
 */

import {
  useAppKit,
  useAppKitAccount,
  useDisconnect,
  useWalletInfo,
} from '@reown/appkit/react'

export default function ConnectWalletButton() {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const { walletInfo } = useWalletInfo()
  const { isConnected, address } = useAppKitAccount()

  const handleDisconnect = async () => {
    try {
      await disconnect()
    } catch (error) {
      console.error('Failed to disconnect wallet. Please try again or refresh the page.', error)
    }
  }

  if (isConnected && address) {
    const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`
    const walletName = walletInfo?.name ?? ''

    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm">
          {walletName && <span className="font-medium">{walletName}: </span>}
          <span className="font-mono">{shortAddress}</span>
        </p>
        <button
          onClick={handleDisconnect}
          className="px-6 py-2 border border-white rounded-full text-sm hover:bg-white hover:text-black transition duration-300"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => open()}
      className="mt-6 px-8 py-3 border border-white rounded-full text-lg hover:bg-white hover:text-black transition duration-300 w-full md:w-auto"
    >
      CONNECT WALLET
    </button>
  )
}
