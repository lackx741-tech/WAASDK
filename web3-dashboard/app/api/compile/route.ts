/**
 * POST /api/compile
 * Generates a script.js bundle from the provided dashboard config.
 * Returns the script content as text/javascript.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { DashboardConfig } from '@/lib/store'
import { generateEmbedScript } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const config = body as DashboardConfig

    // Basic validation
    if (!config) {
      return NextResponse.json(
        { error: 'Missing config in request body' },
        { status: 400 }
      )
    }

    // Generate the embeddable script
    const scriptContent = generateEmbedScript(config)

    // Add integrity hash
    const encoder = new TextEncoder()
    const data = encoder.encode(scriptContent)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    const integrityHash = `sha256-${Buffer.from(hashHex, 'hex').toString('base64')}`

    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Disposition': 'attachment; filename="script.js"',
        'X-Integrity-Hash': integrityHash,
        'X-Generated-At': new Date().toISOString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[/api/compile] Error:', err)
    return NextResponse.json(
      {
        error: 'Failed to compile script',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/compile',
    description: 'Generate an embeddable script.js from a dashboard config',
    body: {
      appName: 'string',
      contractAddress: '0x...',
      contractAbi: 'JSON string',
      chainId: 'number',
      walletConnectProjectId: 'string',
      primaryColor: '#fc72ff',
      enabledFunctions: 'string[]',
    },
  })
}
