#!/usr/bin/env node

import { parseArgs } from 'util'
import http from 'http'
import { initDefaultRoots } from '../server/lib/config.js'
import { startServer } from '../server/index.js'

const DEFAULT_PORT = 4000

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: String(DEFAULT_PORT) },
    roots: { type: 'string', short: 'r' },
    'no-open': { type: 'boolean', default: false },
    dev: { type: 'boolean', default: false },
    restart: { type: 'boolean', default: false },
  },
  strict: false,
})

const port = parseInt(values.port as string, 10) || DEFAULT_PORT
const isDev = values.dev as boolean ?? false
const noOpen = values['no-open'] as boolean ?? false
const shouldRestart = values.restart as boolean ?? false
const rootPaths = values.roots ? (values.roots as string).split(',') : undefined

async function checkServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/roots`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function findAndKillProcess(port: number): Promise<void> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  try {
    const { stdout } = await execAsync(`lsof -ti tcp:${port}`)
    const pids = stdout.trim().split('\n').filter(Boolean)
    for (const pid of pids) {
      try {
        await execAsync(`kill -9 ${pid}`)
      } catch {
        // Process may have already exited
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  } catch {
    // No process found on port
  }
}

async function openBrowser(url: string): Promise<void> {
  try {
    const { default: open } = await import('open')
    await open(url)
  } catch {
    // open package not available, user can open manually
  }
}

async function main(): Promise<void> {
  const url = `http://localhost:${port}`
  const isRunning = await checkServerRunning(port)

  if (isRunning && !shouldRestart) {
    console.log(`Claude Session Browser already running on ${url}`)
    if (!noOpen) {
      await openBrowser(url)
    }
    return
  }

  if (shouldRestart && isRunning) {
    console.log(`Restarting server on port ${port}...`)
    await findAndKillProcess(port)
  }

  await initDefaultRoots(rootPaths)
  await startServer(port, isDev)

  if (isDev) {
    console.log(`  Dev mode: run "npx vite" separately for frontend on http://localhost:5173`)
  } else {
    console.log(`Claude Session Browser running on ${url}`)
    if (!noOpen) {
      await openBrowser(url)
    }
  }
}

main().catch((error) => {
  console.error('Failed to start:', error)
  process.exit(1)
})
