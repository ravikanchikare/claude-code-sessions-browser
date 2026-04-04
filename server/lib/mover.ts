import { readdir, rename, copyFile, unlink, mkdir, cp, rm, access } from 'fs/promises'
import { join, dirname } from 'path'
import { readHeadAndTail, extractAgentMeta } from './scanner.js'
import { getRoots } from './config.js'

const AGENT_FILE_RE = /^agent-[0-9a-f]+\.jsonl$/i

// ---------------------------------------------------------------------------
// Discover all files belonging to a session (parent + linked agents)
// ---------------------------------------------------------------------------

export async function getSessionFiles(
  rootPath: string, projectId: string, sessionId: string
): Promise<{ parentFile: string; agentFiles: string[] }> {
  const projDir = join(rootPath, 'projects', projectId)
  const parentFile = join(projDir, `${sessionId}.jsonl`)

  // Verify parent exists
  await access(parentFile)

  // Scan for agent files whose sessionId matches this parent
  const allFiles = await readdir(projDir)
  const agentFiles: string[] = []

  await Promise.all(
    allFiles
      .filter(f => AGENT_FILE_RE.test(f))
      .map(async (f) => {
        const filePath = join(projDir, f)
        const data = await readHeadAndTail(filePath)
        if (!data) return
        const meta = extractAgentMeta(data.head)
        if (meta.sessionId === sessionId) {
          agentFiles.push(filePath)
        }
      })
  )

  return { parentFile, agentFiles }
}

// ---------------------------------------------------------------------------
// Move a single file (rename with cross-device fallback)
// ---------------------------------------------------------------------------

async function moveFile(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })
  try {
    await rename(src, dest)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      await copyFile(src, dest)
      await unlink(src)
    } else {
      throw err
    }
  }
}

// ---------------------------------------------------------------------------
// Move a session (parent + all agents) to another project in the same root
// ---------------------------------------------------------------------------

export async function moveSessionToProject(
  rootPath: string, srcProjectId: string, targetProjectId: string, sessionId: string
): Promise<{ movedFiles: string[] }> {
  if (srcProjectId === targetProjectId) {
    throw new Error('Source and target projects are the same')
  }

  const { parentFile, agentFiles } = await getSessionFiles(rootPath, srcProjectId, sessionId)
  const targetDir = join(rootPath, 'projects', targetProjectId)
  await mkdir(targetDir, { recursive: true })

  const movedFiles: string[] = []

  // Move parent
  const parentDest = join(targetDir, `${sessionId}.jsonl`)
  await moveFile(parentFile, parentDest)
  movedFiles.push(parentDest)

  // Move all agent files
  for (const agentFile of agentFiles) {
    const filename = agentFile.split('/').pop()!
    const agentDest = join(targetDir, filename)
    await moveFile(agentFile, agentDest)
    movedFiles.push(agentDest)
  }

  return { movedFiles }
}

// ---------------------------------------------------------------------------
// Move an entire project directory to another root
// ---------------------------------------------------------------------------

export async function moveProjectToRoot(
  srcRootPath: string, targetRootPath: string, projectId: string
): Promise<void> {
  if (srcRootPath === targetRootPath) {
    throw new Error('Source and target roots are the same')
  }

  // Validate target root is a configured root
  const roots = await getRoots()
  if (!roots.some(r => r.path === targetRootPath)) {
    throw new Error('Target root is not a configured root')
  }

  const srcDir = join(srcRootPath, 'projects', projectId)
  const targetDir = join(targetRootPath, 'projects', projectId)

  // Check target doesn't already exist
  try {
    await access(targetDir)
    throw new Error('Project already exists in target root')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
    // ENOENT is expected — target doesn't exist yet
  }

  await mkdir(join(targetRootPath, 'projects'), { recursive: true })

  try {
    await rename(srcDir, targetDir)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      // Cross-device: recursive copy then remove source
      await cp(srcDir, targetDir, { recursive: true })
      await rm(srcDir, { recursive: true })
    } else {
      throw err
    }
  }
}
