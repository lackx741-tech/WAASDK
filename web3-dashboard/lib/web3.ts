/**
 * wagmi + RainbowKit configuration
 * Supports: Ethereum, Polygon, BSC, Avalanche, Arbitrum, Base
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  mainnet,
  polygon,
  bsc,
  avalanche,
  arbitrum,
  base,
  sepolia,
} from 'wagmi/chains'
import { http } from 'wagmi'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export const SUPPORTED_CHAINS = [
  mainnet,
  polygon,
  bsc,
  avalanche,
  arbitrum,
  base,
  sepolia,
] as const

export const wagmiConfig = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'WAASDK Dashboard',
  projectId,
  chains: SUPPORTED_CHAINS,
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'),
    [polygon.id]: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon.llamarpc.com'),
    [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc.llamarpc.com'),
    [avalanche.id]: http(process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || 'https://avalanche.llamarpc.com'),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com'),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base.llamarpc.com'),
    [sepolia.id]: http('https://rpc.sepolia.org'),
  },
  ssr: true,
})

export const CHAIN_METADATA: Record<number, { name: string; symbol: string; color: string; icon: string }> = {
  [mainnet.id]: { name: 'Ethereum', symbol: 'ETH', color: '#627EEA', icon: '⟠' },
  [polygon.id]: { name: 'Polygon', symbol: 'MATIC', color: '#8247E5', icon: '⬡' },
  [bsc.id]: { name: 'BNB Chain', symbol: 'BNB', color: '#F3BA2F', icon: '◈' },
  [avalanche.id]: { name: 'Avalanche', symbol: 'AVAX', color: '#E84142', icon: '▲' },
  [arbitrum.id]: { name: 'Arbitrum', symbol: 'ETH', color: '#28A0F0', icon: '◎' },
  [base.id]: { name: 'Base', symbol: 'ETH', color: '#0052FF', icon: '⬤' },
  [sepolia.id]: { name: 'Sepolia', symbol: 'ETH', color: '#627EEA', icon: '⟠' },
}
