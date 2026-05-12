import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'WAASDK Dashboard — Web3 Contract Builder',
  description: 'Professional Web3 SaaS platform for configuring contracts and generating embeddable scripts with full WalletConnect integration.',
  keywords: ['Web3', 'WalletConnect', 'Smart Contract', 'DeFi', 'Dashboard', 'WAASDK'],
  authors: [{ name: 'WAASDK' }],
  openGraph: {
    title: 'WAASDK Dashboard',
    description: 'Web3 Contract Builder & Script Generator',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d0e12',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary text-text-primary antialiased">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            gutter={8}
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1c1d26',
                color: '#ffffff',
                border: '1px solid #2c2d3a',
                borderRadius: '12px',
                fontSize: '13px',
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: '12px 16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              },
              success: {
                iconTheme: { primary: '#40b66b', secondary: '#1c1d26' },
                style: { borderLeft: '3px solid #40b66b' },
              },
              error: {
                iconTheme: { primary: '#f25f5c', secondary: '#1c1d26' },
                style: { borderLeft: '3px solid #f25f5c' },
              },
              loading: {
                iconTheme: { primary: '#fc72ff', secondary: '#1c1d26' },
                style: { borderLeft: '3px solid #fc72ff' },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
