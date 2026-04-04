#!/usr/bin/env node

import { parseArgs } from 'util'
import { initDefaultRoots } from '../server/lib/config.js'
import { startServer } from '../server/index.js'

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: '3333' },
    roots: { type: 'string', short: 'r' },
    'no-open': { type: 'boolean', default: false },
    dev: { type: 'boolean', default: false },
  },
  strict: false,
})

const port = parseInt(values.port as string, 10) || 3333
const isDev = values.dev as boolean ?? false
const noOpen = values['no-open'] as boolean ?? false
const rootPaths = values.roots ? (values.roots as string).split(',') : undefined

async function main(): Promise<void> {
  // Initialize roots from CLI args or defaults
  await initDefaultRoots(rootPaths)

  // Start Express API server
  await startServer(port, isDev)

  if (isDev) {
    console.log(`  Dev mode: run "npx vite" separately for frontend on http://localhost:5173`)
  } else {
    const url = `http://localhost:${port}`
    console.log(`  Open ${url} in your browser`)

    if (!noOpen) {
      try {
        const { default: open } = await import('open')
        await open(url)
      } catch {
        // open package not available, user can open manually
      }
    }
  }
}

main().catch((error) => {
  console.error('Failed to start:', error)
  process.exit(1)
})
