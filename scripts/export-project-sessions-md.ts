#!/usr/bin/env npx tsx
/**
 * Export Claude Code project sessions to Markdown transcripts on disk.
 *
 * Layout (mirrors ~/.claude/projects):
 *   {out}/{projectId}/{sessionUuid}/transcript.md
 *   {out}/{projectId}/{sessionUuid}/subagents/agent-{id}.md
 *   {out}/{projectId}/_orphan-agents/agent-{id}.md   (agents with unknown parent)
 *
 * Each .md file: one # title line, then User:/Claude:/Claude Summary: blocks (content only).
 *
 * Usage:
 *   npx tsx scripts/export-project-sessions-md.ts --out ./export --project -Users-you-repo
 *   npx tsx scripts/export-project-sessions-md.ts -o ./export --all -r ~/.claude
 *   npx tsx scripts/export-project-sessions-md.ts --list-projects [-r ~/.claude]
 */

import { homedir } from 'os'
import { mkdir, writeFile } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { parseArgs } from 'util'
import { parseConversation } from '../server/lib/parser.js'
import { listProjects, listProjectFolders, listSessions } from '../server/lib/scanner.js'
import type { ParsedConversation } from '../server/lib/parser.js'
import { formatFullSessionTranscript } from '../src/lib/turnPairCopy.js'
import type { SessionInfo } from '../server/lib/scanner.js'

function expandUserPath(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  if (p.startsWith('~\\')) return join(homedir(), p.slice(2))
  return p
}

function sessionTitle(conv: ParsedConversation): string {
  const userMsg = conv.messages.find(m => m.type === 'user')
  const userHead = userMsg?.content.trim().match(/^[^\r\n]*/)?.[0]?.slice(0, 200)
  const raw = conv.customTitle?.trim() ?? userHead ?? conv.sessionId
  return raw.replace(/\r?\n/g, ' ').replace(/^#+\s*/, '').trim() || 'Session'
}

function conversationToMarkdown(conv: ParsedConversation): string {
  const title = sessionTitle(conv)
  const body = formatFullSessionTranscript(conv.messages)
  return `# ${title}\n\n${body}\n`
}

async function writeMarkdown(path: string, conv: ParsedConversation, dryRun: boolean): Promise<void> {
  const text = conversationToMarkdown(conv)
  if (dryRun) {
    console.log(`[dry-run] ${path} (${text.length} chars)`)
    return
  }
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, text, 'utf-8')
}

async function exportParentSession(
  projectOutDir: string,
  parent: SessionInfo,
  dryRun: boolean,
): Promise<void> {
  const conv = await parseConversation(parent.filePath)
  const dir = join(projectOutDir, parent.id)
  const outFile = join(dir, 'transcript.md')
  if (!dryRun) await mkdir(join(dir, 'subagents'), { recursive: true })
  await writeMarkdown(outFile, conv, dryRun)
  console.log(outFile)
}

async function exportAgentSession(
  projectOutDir: string,
  agent: SessionInfo,
  dryRun: boolean,
): Promise<void> {
  const conv = await parseConversation(agent.filePath)
  const stem = basename(agent.filePath, '.jsonl')
  const parentId = agent.parentSessionId
  const dir = parentId
    ? join(projectOutDir, parentId, 'subagents')
    : join(projectOutDir, '_orphan-agents')
  const outFile = join(dir, `${stem}.md`)
  await writeMarkdown(outFile, conv, dryRun)
  console.log(outFile)
}

async function exportProject(
  rootPath: string,
  projectId: string,
  projectOutDir: string,
  dryRun: boolean,
): Promise<{ parents: number; agents: number; errors: number }> {
  let parents = 0
  let agents = 0
  let errors = 0

  const sessions = await listSessions(rootPath, projectId)
  const parentList = sessions.filter(s => !s.isSubAgent)
  const agentList = sessions.filter(s => s.isSubAgent)

  if (!dryRun) await mkdir(projectOutDir, { recursive: true })

  for (const p of parentList) {
    try {
      await exportParentSession(projectOutDir, p, dryRun)
      parents++
    } catch (e) {
      errors++
      console.error(`Failed parent ${p.id}:`, e instanceof Error ? e.message : e)
    }
  }

  for (const a of agentList) {
    try {
      await exportAgentSession(projectOutDir, a, dryRun)
      agents++
    } catch (e) {
      errors++
      console.error(`Failed agent ${a.id}:`, e instanceof Error ? e.message : e)
    }
  }

  return { parents, agents, errors }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', short: 'r', default: join(homedir(), '.claude') },
      project: { type: 'string', short: 'p' },
      out: { type: 'string', short: 'o' },
      all: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'list-projects': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: false,
  })

  if (values.help) {
    console.log(`Usage:
  export-project-sessions-md.ts --list-projects [-r ~/.claude]
  export-project-sessions-md.ts --out <dir> --project <projectId>
  export-project-sessions-md.ts --out <dir> --all [--root ~/.claude]

Options:
  -o, --out       Output root directory (required)
  -p, --project   Project folder name under <root>/projects/ (sanitized path, e.g. -Users-you-repo)
  -r, --root      Claude data root (default: ~/.claude)
  --all           Export every project under <root>/projects/
  --dry-run       Print paths only; do not write files
  --list-projects List projects (project_id + sessions only); no export
  -h, --help      Show this help
`)
    process.exit(0)
  }

  const rootPath = resolve(expandUserPath(values.root as string))

  if (values['list-projects'] as boolean) {
    const projects = await listProjectFolders(rootPath)
    if (projects.length === 0) {
      console.log('(no project folders under projects/)')
      process.exit(0)
    }
    const rows = projects.map(p => ({
      project_id: p.id,
      sessions: String(p.sessionCount),
    }))
    const idW = Math.max('project_id'.length, ...rows.map(r => r.project_id.length))
    const sessW = Math.max('sessions'.length, ...rows.map(r => r.sessions.length))
    const sepLen = idW + 2 + sessW
    console.log(`${'project_id'.padEnd(idW)}  ${'sessions'.padStart(sessW)}`)
    console.log('-'.repeat(sepLen))
    for (const r of rows) {
      console.log(`${r.project_id.padEnd(idW)}  ${r.sessions.padStart(sessW)}`)
    }
    console.log(`\n(${projects.length} project folder(s); sessions = UUID .jsonl at project root)`)
    process.exit(0)
  }

  const outRaw = values.out as string | undefined
  if (!outRaw) {
    console.error('Error: --out <directory> is required (or use --list-projects).')
    process.exit(1)
  }

  const all = values.all as boolean
  const projectId = values.project as string | undefined
  if (!all && !projectId) {
    console.error('Error: pass --project <id> or --all (or use --list-projects).')
    process.exit(1)
  }

  const outRoot = resolve(expandUserPath(outRaw))
  const dryRun = values['dry-run'] as boolean

  console.error(`Root:  ${rootPath}`)
  console.error(`Out:   ${outRoot}`)
  console.error(dryRun ? 'Mode:  dry-run\n' : '')

  let totalParents = 0
  let totalAgents = 0
  let totalErrors = 0

  if (all) {
    const projects = await listProjects(rootPath)
    if (projects.length === 0) {
      console.error('No projects found.')
      process.exit(1)
    }
    for (const pr of projects) {
      console.error(`\nProject: ${pr.id} (${pr.displayName})`)
      const subOut = join(outRoot, pr.id)
      const r = await exportProject(rootPath, pr.id, subOut, dryRun)
      totalParents += r.parents
      totalAgents += r.agents
      totalErrors += r.errors
    }
  } else {
    const r = await exportProject(rootPath, projectId!, outRoot, dryRun)
    totalParents = r.parents
    totalAgents = r.agents
    totalErrors = r.errors
  }

  console.error(`\nDone: ${totalParents} parent session(s), ${totalAgents} agent session(s), ${totalErrors} error(s).`)
  if (totalErrors > 0) process.exit(1)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
