/**
 * AppKit (Reown WalletConnect v2) network configuration.
 *
 * Import `networks` anywhere you need to reference supported chains,
 * or import `projectId` for AppKit initialisation.
 *
 * Usage:
 *   import { networks, projectId } from '@/config'
 */

import {
  mainnet,
  polygon,
  bsc,
  avalanche,
  arbitrum,
  base,
} from '@reown/appkit/networks'

/** WalletConnect Cloud project ID — replace with your own from https://cloud.walletconnect.com */
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || process.env.VITE_WALLETCONNECT_PROJECT_ID || ''

if (!projectId) {
  console.warn(
    '[ConnectWalletButton] No WalletConnect project ID found. ' +
    'Set NEXT_PUBLIC_PROJECT_ID (Next.js) or VITE_WALLETCONNECT_PROJECT_ID (Vite) ' +
    'in your environment. Get a free ID at https://cloud.walletconnect.com'
  )
}

/** All networks supported by this app */
export const networks = [mainnet, polygon, bsc, avalanche, arbitrum, base]
