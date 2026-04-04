import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export interface RootConfig {
  id: string
  path: string
  label: string
}

interface AppConfig {
  roots: RootConfig[]
}

const CONFIG_PATH = join(homedir(), '.claude-session-browser.json')

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function encodeRootId(path: string): string {
  return Buffer.from(path).toString('base64url')
}

export function decodeRootId(id: string): string {
  return Buffer.from(id, 'base64url').toString()
}

async function readConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return { roots: [] }
  }
}

async function writeConfig(config: AppConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export async function getRoots(): Promise<RootConfig[]> {
  const config = await readConfig()
  return config.roots
}

export async function addRoot(path: string, label?: string): Promise<RootConfig> {
  const config = await readConfig()
  const existing = config.roots.find(r => r.path === path)
  if (existing) return existing

  const root: RootConfig = {
    id: encodeRootId(path),
    path,
    label: label ?? path.split('/').pop() ?? path,
  }
  config.roots.push(root)
  await writeConfig(config)
  return root
}

export async function removeRoot(id: string): Promise<boolean> {
  const config = await readConfig()
  const idx = config.roots.findIndex(r => r.id === id)
  if (idx < 0) return false
  config.roots.splice(idx, 1)
  await writeConfig(config)
  return true
}

export async function initDefaultRoots(cliRoots?: string[]): Promise<void> {
  if (cliRoots && cliRoots.length > 0) {
    for (const rootPath of cliRoots) {
      await addRoot(rootPath.trim())
    }
    return
  }

  const config = await readConfig()
  if (config.roots.length === 0) {
    const defaultPath = join(homedir(), '.claude')
    try {
      const { stat } = await import('fs/promises')
      await stat(defaultPath)
      await addRoot(defaultPath, 'Local')
    } catch {
      // ~/.claude doesn't exist, skip
    }
  }
}
