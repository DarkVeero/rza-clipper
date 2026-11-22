import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

let cachedFfmpegPath: string | null = null

/**
 * Resolves the Linux FFmpeg binary in priority order:
 * 1. Explicit env override (RZA_CLIPPER_FFMPEG)
 * 2. Bundled extraResource binary (<resources>/ffmpeg/ffmpeg)
 * 3. Unpacked ffmpeg-static binary
 * 4. System PATH (/usr/bin/ffmpeg)
 */
export function resolveFfmpegBinary(): string {
  if (cachedFfmpegPath && fs.existsSync(cachedFfmpegPath)) {
    return cachedFfmpegPath
  }

  const candidates: string[] = []
  if (process.env.RZA_CLIPPER_FFMPEG) {
    candidates.push(process.env.RZA_CLIPPER_FFMPEG)
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg'))
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticBin = require('ffmpeg-static') as string | null
    if (staticBin) {
      candidates.push(staticBin.replace('app.asar', 'app.asar.unpacked'))
      candidates.push(staticBin)
    }
  } catch {
    // Fallback to system ffmpeg
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      cachedFfmpegPath = candidate
      return candidate
    }
  }

  try {
    const sysPath = execFileSync('which', ['ffmpeg'], { encoding: 'utf-8' }).trim()
    if (sysPath && fs.existsSync(sysPath)) {
      cachedFfmpegPath = sysPath
      return sysPath
    }
  } catch {
    // Ignore
  }

  throw new Error(
    'FFmpeg binary not found. Install ffmpeg (e.g. `sudo apt install ffmpeg`) or bundle ffmpeg-static.',
  )
}
