import { app } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

function checkpointDir(): string {
  const dir = path.join(app.getPath('userData'), 'ai-checkpoints')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function hashCheckpointKey(parts: unknown[]): string {
  const h = crypto.createHash('sha256')
  h.update(JSON.stringify(parts))
  return h.digest('hex')
}

export async function readCheckpoint<T>(key: string): Promise<T | null> {
  const target = path.join(checkpointDir(), `${key}.json`)
  try {
    const raw = await fs.promises.readFile(target, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writeCheckpoint(key: string, data: unknown): Promise<void> {
  const target = path.join(checkpointDir(), `${key}.json`)
  const tmp = `${target}.tmp`
  await fs.promises.writeFile(tmp, JSON.stringify(data), 'utf-8')
  await fs.promises.rename(tmp, target)
}
