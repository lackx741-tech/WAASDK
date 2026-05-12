'use client'

/**
 * Toast notification helpers — wraps react-hot-toast with WAASDK styling
 */

import toast from 'react-hot-toast'

export const notify = {
  success: (message: string) =>
    toast.success(message, {
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #40b66b',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  error: (message: string) =>
    toast.error(message, {
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #f25f5c',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  info: (message: string) =>
    toast(message, {
      icon: '💡',
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #4c82fb',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  warning: (message: string) =>
    toast(message, {
      icon: '⚠️',
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #f77f00',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  loading: (message: string) =>
    toast.loading(message, {
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #fc72ff',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  txSent: (txHash: string) =>
    toast.loading(`Transaction sent: ${txHash.slice(0, 10)}...`, {
      id: `tx-${txHash}`,
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #fc72ff',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  txConfirmed: (txHash: string) =>
    toast.success('Transaction confirmed!', {
      id: `tx-${txHash}`,
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #40b66b',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  txFailed: (txHash: string) =>
    toast.error('Transaction failed', {
      id: `tx-${txHash}`,
      style: {
        background: '#1c1d26',
        color: '#ffffff',
        border: '1px solid #2c2d3a',
        borderLeft: '3px solid #f25f5c',
        borderRadius: '12px',
        fontSize: '13px',
      },
    }),

  dismiss: toast.dismiss,
}

export default notify
