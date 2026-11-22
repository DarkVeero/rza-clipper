import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  ModelSize,
  SpeechChunk,
  TranscribeProgress,
  TranscribeRequest,
  WordTimestamp,
} from '#/shared/types'
import { extractWav16k } from '#/main/services/transcription/audio-extract'
import { getModelPath } from '#/main/services/transcription/models'

let activeProc: ChildProcess | null = null

export function cancelWhisperRun(): void {
  if (activeProc) {
    activeProc.kill('SIGTERM')
    activeProc = null
  }
}

function resolveWhisperBinary(preferVulkan: boolean): { binary: string; backend: 'vulkan' | 'cpu' } {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const roots = [
    process.resourcesPath ? path.join(process.resourcesPath, 'bin') : '',
    path.resolve(process.cwd(), 'assets', 'bin'),
  ].filter(Boolean)

  const order: Array<{ dir: string; backend: 'vulkan' | 'cpu' }> = preferVulkan
    ? [
        { dir: `linux-${arch}-vulkan`, backend: 'vulkan' },
        { dir: `linux-${arch}`, backend: 'cpu' },
      ]
    : [
        { dir: `linux-${arch}`, backend: 'cpu' },
        { dir: `linux-${arch}-vulkan`, backend: 'vulkan' },
      ]

  for (const root of roots) {
    for (const entry of order) {
      const candidate = path.join(root, entry.dir, 'whisper-cli')
      if (fs.existsSync(candidate)) {
        return { binary: candidate, backend: entry.backend }
      }
    }
  }

  // Fallback to system PATH
  return { binary: 'whisper-cli', backend: preferVulkan ? 'vulkan' : 'cpu' }
}

function dtwPresetForModel(modelSize: ModelSize): string {
  switch (modelSize) {
    case 'tiny':
      return 'tiny'
    case 'base':
      return 'base'
    case 'small':
      return 'small'
    case 'large-v3-turbo':
      return 'large.v3.turbo'
  }
}

function parseWhisperJson(jsonPath: string, offsetSec = 0): { chunks: SpeechChunk[]; text: string } {
  const raw = fs.readFileSync(jsonPath, 'utf-8')
  const parsed = JSON.parse(raw) as {
    transcription?: Array<{
      offsets?: { from: number; to: number }
      text: string
      tokens?: Array<{
        text: string
        offsets?: { from: number; to: number }
        p?: number
      }>
    }>
  }

  const chunks: SpeechChunk[] = []
  const textParts: string[] = []

  for (const seg of parsed.transcription ?? []) {
    const segText = seg.text.trim()
    if (!segText) continue
    const start = (seg.offsets?.from ?? 0) / 1000 + offsetSec
    const end = (seg.offsets?.to ?? 0) / 1000 + offsetSec

    const words: WordTimestamp[] = []
    for (const tok of seg.tokens ?? []) {
      const clean = tok.text.trim()
      if (!clean || /^\[.*\]$/.test(clean)) continue
      words.push({
        word: clean,
        start: (tok.offsets?.from ?? 0) / 1000 + offsetSec,
        end: (tok.offsets?.to ?? 0) / 1000 + offsetSec,
        confidence: tok.p,
      })
    }

    chunks.push({ text: segText, timestamp: [start, end], words })
    textParts.push(segText)
  }

  return { chunks, text: textParts.join(' ').trim() }
}

async function execWhisperCli(
  binary: string,
  modelPath: string,
  wavPath: string,
  jsonPrefix: string,
  request: TranscribeRequest,
  forceCpu: boolean,
  onProgress: (pct: number) => void,
): Promise<void> {
  const args = [
    '-m',
    modelPath,
    '-f',
    wavPath,
    '-of',
    jsonPrefix,
    '-ojf',
    '-pp',
    '-sow',
    '--dtw',
    dtwPresetForModel(request.modelSize),
  ]

  if (request.language && request.language !== 'auto') {
    args.push('-l', request.language)
  } else {
    args.push('-l', 'auto')
  }

  if (forceCpu) {
    args.push('-ng')
  }

  const binDir = path.dirname(binary)
  const env = {
    ...process.env,
    LD_LIBRARY_PATH: [binDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { env })
    activeProc = child

    let stderrBuf = ''
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      stderrBuf += text
      const match = /progress\s*=\s*(\d+)%/i.exec(text)
      if (match) {
        onProgress(Math.min(1, Number.parseInt(match[1], 10) / 100))
      }
    })

    child.on('error', (err) => {
      activeProc = null
      reject(err)
    })

    child.on('close', (code) => {
      activeProc = null
      if (code === 0) resolve()
      else reject(new Error(`whisper-cli exited with code ${code}: ${stderrBuf.slice(-400)}`))
    })
  })
}

export async function runLocalWhisper(
  payload: {
    request: TranscribeRequest
    filePath?: string
    range?: { start?: number; end?: number }
  },
  emit: (update: Partial<TranscribeProgress>) => void,
): Promise<{ chunks: SpeechChunk[]; text: string }> {
  if (!payload.filePath) {
    throw new Error('Local whisper transcription requires a video/audio filePath.')
  }

  const modelPath = getModelPath(payload.request.modelSize)
  if (!fs.existsSync(modelPath)) {
    throw new Error(
      `Whisper model "${payload.request.modelSize}" is not downloaded. Download it in Settings -> Transcription.`,
    )
  }

  const mode = payload.request.acceleration ?? 'auto'
  const preferGpu = mode !== 'cpu'
  const { binary, backend } = resolveWhisperBinary(preferGpu)

  emit({ status: 'extracting', progress: 0.05, detail: 'Extracting 16 kHz mono audio…' })
  const wavPath = await extractWav16k(payload.filePath, payload.range)
  const jsonPrefix = path.join(os.tmpdir(), `rzaclipper-whisper-${Date.now()}`)

  try {
    const attemptGpu = mode !== 'cpu' && backend === 'vulkan'
    emit({
      status: 'transcribing',
      progress: 0.1,
      backend: attemptGpu ? 'vulkan' : 'cpu',
      detail: `Transcribing (${attemptGpu ? 'Vulkan GPU' : 'CPU'})…`,
    })

    try {
      await execWhisperCli(binary, modelPath, wavPath, jsonPrefix, payload.request, !attemptGpu, (p) => {
        emit({ status: 'transcribing', progress: 0.1 + p * 0.85 })
      })
    } catch (gpuErr) {
      if (mode === 'auto' && attemptGpu) {
        // Automatic fallback to CPU (-ng) matching windows-gpu.md behavior
        emit({
          status: 'transcribing',
          progress: 0.12,
          backend: 'cpu',
          fallbackNotice: 'Vulkan GPU initialization failed — falling back to CPU (-ng).',
          detail: 'Retrying on CPU (-ng)…',
        })
        await execWhisperCli(binary, modelPath, wavPath, jsonPrefix, payload.request, true, (p) => {
          emit({ status: 'transcribing', progress: 0.12 + p * 0.83 })
        })
      } else {
        throw gpuErr
      }
    }

    const result = parseWhisperJson(`${jsonPrefix}.json`, payload.range?.start ?? 0)
    emit({ status: 'done', progress: 1, detail: 'Transcription complete.' })
    return result
  } finally {
    await fs.promises.unlink(wavPath).catch(() => {})
    await fs.promises.unlink(`${jsonPrefix}.json`).catch(() => {})
  }
}
