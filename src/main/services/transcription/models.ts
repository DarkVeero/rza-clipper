import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ModelDownloadProgress, ModelSize, ModelStatus } from '#/shared/types'

const MODEL_META: Record<ModelSize, { fileName: string; expectedBytes: number }> = {
  tiny: { fileName: 'ggml-tiny.bin', expectedBytes: 77_704_715 },
  base: { fileName: 'ggml-base.bin', expectedBytes: 147_951_465 },
  small: { fileName: 'ggml-small.bin', expectedBytes: 487_601_967 },
  'large-v3-turbo': { fileName: 'ggml-large-v3-turbo.bin', expectedBytes: 1_624_555_275 },
}

const HF_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

let activeDownload: AbortController | null = null

export function modelsDir(): string {
  const dir = path.join(app.getPath('userData'), 'whisper-models')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getModelPath(size: ModelSize): string {
  return path.join(modelsDir(), MODEL_META[size].fileName)
}

export async function getModelsStatus(): Promise<Record<string, ModelStatus>> {
  const result: Record<string, ModelStatus> = {}
  for (const [size, meta] of Object.entries(MODEL_META) as Array<[ModelSize, { fileName: string; expectedBytes: number }]>) {
    const filePath = getModelPath(size)
    let bytes = 0
    let installed = false
    try {
      const stat = fs.statSync(filePath)
      bytes = stat.size
      installed = bytes > 1_000_000
    } catch {
      // Not installed
    }
    result[size] = {
      size,
      installed,
      filePath,
      bytes,
      expectedBytes: meta.expectedBytes,
    }
  }
  return result
}

export async function deleteModel(size: ModelSize): Promise<void> {
  await fs.promises.unlink(getModelPath(size)).catch(() => {})
}

export function cancelModelDownload(): void {
  activeDownload?.abort()
  activeDownload = null
}

function broadcastProgress(payload: ModelDownloadProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('transcription:download-progress', payload)
  }
}

export async function downloadModel(
  size: ModelSize,
): Promise<{ success: boolean; filePath: string }> {
  cancelModelDownload()
  const controller = new AbortController()
  activeDownload = controller

  const meta = MODEL_META[size]
  const dest = getModelPath(size)
  const tmp = `${dest}.part`
  const url = `${HF_BASE}/${meta.fileName}`

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok || !res.body) {
      throw new Error(`Model download failed (${res.status})`)
    }

    const total = Number(res.headers.get('content-length') || meta.expectedBytes)
    const out = fs.createWriteStream(tmp)
    const reader = res.body.getReader()
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      out.write(value)
      loaded += value.byteLength
      broadcastProgress({
        modelSize: size,
        loaded,
        total,
        progress: total > 0 ? Math.min(1, loaded / total) : 0,
      })
    }

    await new Promise<void>((resolve, reject) => {
      out.on('finish', resolve)
      out.on('error', reject)
      out.end()
    })

    await fs.promises.rename(tmp, dest)
    return { success: true, filePath: dest }
  } catch (err) {
    await fs.promises.unlink(tmp).catch(() => {})
    throw err
  } finally {
    activeDownload = null
  }
}
