import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ProjectRecord } from '#/shared/types'

function projectsDir(): string {
  const dir = path.join(app.getPath('userData'), 'projects')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function safeProjectFile(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(projectsDir(), `${sanitized}.json`)
}

export async function readAllProjects(): Promise<ProjectRecord[]> {
  const dir = projectsDir()
  const entries = await fs.promises.readdir(dir)
  const records: ProjectRecord[] = []

  for (const name of entries) {
    if (!name.endsWith('.json')) continue
    try {
      const raw = await fs.promises.readFile(path.join(dir, name), 'utf-8')
      records.push(JSON.parse(raw) as ProjectRecord)
    } catch {
      // Skip corrupted project file rather than crashing app launch
    }
  }

  return records.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

export async function writeProject(id: string, project: ProjectRecord): Promise<void> {
  const target = safeProjectFile(id)
  const tmp = `${target}.tmp`
  const payload: ProjectRecord = {
    ...project,
    id,
    updatedAt: new Date().toISOString(),
  }
  await fs.promises.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf-8')
  await fs.promises.rename(tmp, target)
}

export async function deleteProject(id: string): Promise<void> {
  const target = safeProjectFile(id)
  try {
    await fs.promises.unlink(target)
  } catch {
    // Already removed
  }
}
