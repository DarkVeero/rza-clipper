import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { resolveFfmpegBinary } from '#/main/services/ffmpeg/binary'

const execFileAsync = promisify(execFile)

/**
 * Extracts 16 kHz mono 16-bit PCM WAV for whisper.cpp.
 */
export async function extractWav16k(
  filePath: string,
  range?: { start?: number; end?: number },
): Promise<string> {
  const ffmpeg = resolveFfmpegBinary()
  const outPath = path.join(os.tmpdir(), `rzaclipper-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`)
  const args: string[] = ['-y']
  if (range?.start !== undefined) args.push('-ss', String(range.start))
  if (range?.end !== undefined) args.push('-to', String(range.end))
  args.push('-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outPath)

  await execFileAsync(ffmpeg, args)
  return outPath
}

/**
 * Extracts 16 kHz mono Float32Array samples for waveform/renderer inspection.
 */
export async function extractAudioSamples(
  filePath: string,
  range?: { start?: number; end?: number },
): Promise<{ samples: Float32Array; duration: number }> {
  const ffmpeg = resolveFfmpegBinary()
  const outPath = path.join(os.tmpdir(), `rzaclipper-${Date.now()}.f32`)
  const args: string[] = ['-y']
  if (range?.start !== undefined) args.push('-ss', String(range.start))
  if (range?.end !== undefined) args.push('-to', String(range.end))
  args.push('-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', outPath)

  try {
    await execFileAsync(ffmpeg, args)
    const buf = await fs.promises.readFile(outPath)
    const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4))
    return { samples: new Float32Array(samples), duration: samples.length / 16000 }
  } finally {
    await fs.promises.unlink(outPath).catch(() => {})
  }
}

/**
 * Extracts Opus Ogg audio chunks (30-min max per chunk) for Deepgram uploads.
 */
export async function extractOpusChunks(
  filePath: string,
  totalDurationSec: number,
  range?: { start?: number; end?: number },
): Promise<Array<{ filePath: string; offsetSec: number }>> {
  const ffmpeg = resolveFfmpegBinary()
  const startSec = range?.start ?? 0
  const endSec = range?.end ?? totalDurationSec
  const chunkLen = 1800 // 30 minutes
  const chunks: Array<{ filePath: string; offsetSec: number }> = []

  for (let t = startSec; t < endSec || chunks.length === 0; t += chunkLen) {
    const segEnd = endSec > 0 ? Math.min(endSec, t + chunkLen) : undefined
    const outPath = path.join(os.tmpdir(), `rzaclipper-dg-${Date.now()}-${chunks.length}.ogg`)
    const args: string[] = ['-y', '-ss', String(t)]
    if (segEnd !== undefined) args.push('-to', String(segEnd))
    args.push('-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libopus', '-b:a', '32k', outPath)
    await execFileAsync(ffmpeg, args)
    chunks.push({ filePath: outPath, offsetSec: t })
    if (segEnd === undefined || segEnd >= endSec) break
  }

  return chunks
}
