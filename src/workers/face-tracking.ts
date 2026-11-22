import { app } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as ort from 'onnxruntime-node'
import type {
  FaceBox,
  SpeakerLayoutMode,
  TrackFacesPayload,
  TrajectoryKeyframe,
} from '#/shared/types'
import { resolveFfmpegBinary } from '#/main/services/ffmpeg/binary'

const INPUT_SIZE = 640
const YUNET_FILENAME = 'face_detection_yunet_2023mar.onnx'
const YUNET_DOWNLOAD_URL =
  'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'

let cachedSession: ort.InferenceSession | null = null

async function resolveYunetModel(): Promise<string> {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'models', YUNET_FILENAME) : '',
    path.resolve(process.cwd(), 'assets', 'models', YUNET_FILENAME),
    path.join(app.getPath('userData'), 'models', YUNET_FILENAME),
  ].filter(Boolean)

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }

  // Fallback: download official YuNet ONNX model into userData/models
  const dest = path.join(app.getPath('userData'), 'models', YUNET_FILENAME)
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  const res = await fetch(YUNET_DOWNLOAD_URL)
  if (!res.ok) throw new Error(`Failed to download YuNet ONNX model (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.promises.writeFile(dest, buf)
  return dest
}

async function getDetectorSession(): Promise<ort.InferenceSession> {
  if (cachedSession) return cachedSession
  const modelPath = await resolveYunetModel()
  cachedSession = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
  })
  return cachedSession
}

function frameMeanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  let sum = 0
  const step = 48 // Subsample for fast cut detection
  let count = 0
  for (let i = 0; i < a.length; i += step) {
    sum += Math.abs(a[i] - b[i])
    count++
  }
  return count > 0 ? sum / count : 0
}

function computeMouthActivity(
  curr: Uint8Array,
  prev: Uint8Array | null,
  box: FaceBox,
): number {
  if (!prev) return 0
  const x0 = Math.max(0, Math.floor(box.x * INPUT_SIZE))
  const x1 = Math.min(INPUT_SIZE - 1, Math.floor((box.x + box.width) * INPUT_SIZE))
  const yMid = Math.floor((box.y + box.height * 0.55) * INPUT_SIZE)
  const y0 = Math.max(0, Math.floor(box.y * INPUT_SIZE))
  const y1 = Math.min(INPUT_SIZE - 1, Math.floor((box.y + box.height) * INPUT_SIZE))

  let lowerDiff = 0
  let lowerCount = 0
  let upperDiff = 0
  let upperCount = 0

  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const idx = (y * INPUT_SIZE + x) * 3
      const diff =
        Math.abs(curr[idx] - prev[idx]) +
        Math.abs(curr[idx + 1] - prev[idx + 1]) +
        Math.abs(curr[idx + 2] - prev[idx + 2])
      if (y >= yMid) {
        lowerDiff += diff
        lowerCount++
      } else {
        upperDiff += diff
        upperCount++
      }
    }
  }

  const lowerMean = lowerCount > 0 ? lowerDiff / lowerCount : 0
  const upperMean = upperCount > 0 ? upperDiff / upperCount : 1
  return Math.max(0, lowerMean - upperMean * 0.65)
}

function decodeYunetOutputs(outputs: Record<string, ort.Tensor>, scoreThreshold = 0.62): FaceBox[] {
  const strides = [8, 16, 32]
  const rawBoxes: FaceBox[] = []

  for (const stride of strides) {
    const cls = outputs[`cls_${stride}`]?.data as Float32Array | undefined
    const obj = outputs[`obj_${stride}`]?.data as Float32Array | undefined
    const bbox = outputs[`bbox_${stride}`]?.data as Float32Array | undefined
    if (!cls || !obj || !bbox) continue

    const cols = INPUT_SIZE / stride
    const rows = INPUT_SIZE / stride

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const score = Math.sqrt(Math.max(0, cls[idx]) * Math.max(0, obj[idx]))
        if (score < scoreThreshold) continue

        const cx = (c + bbox[idx * 4]) * stride
        const cy = (r + bbox[idx * 4 + 1]) * stride
        const w = Math.exp(bbox[idx * 4 + 2]) * stride
        const h = Math.exp(bbox[idx * 4 + 3]) * stride

        rawBoxes.push({
          x: Math.max(0, (cx - w / 2) / INPUT_SIZE),
          y: Math.max(0, (cy - h / 2) / INPUT_SIZE),
          width: Math.min(1, w / INPUT_SIZE),
          height: Math.min(1, h / INPUT_SIZE),
          score,
        })
      }
    }
  }

  // Greedy NMS
  rawBoxes.sort((a, b) => b.score - a.score)
  const kept: FaceBox[] = []
  for (const box of rawBoxes) {
    const overlaps = kept.some((k) => {
      const ix = Math.max(0, Math.min(k.x + k.width, box.x + box.width) - Math.max(k.x, box.x))
      const iy = Math.max(0, Math.min(k.y + k.height, box.y + box.height) - Math.max(k.y, box.y))
      const inter = ix * iy
      const union = k.width * k.height + box.width * box.height - inter
      return union > 0 && inter / union > 0.35
    })
    if (!overlaps) kept.push(box)
    if (kept.length >= 4) break
  }

  return kept
}

function chooseLayout(faces: FaceBox[], pref?: SpeakerLayoutMode | 'auto'): SpeakerLayoutMode {
  if (pref && pref !== 'auto') return pref
  if (faces.length === 0) return 'general'
  if (faces.length === 1) return 'track'
  if (faces.length === 2) return 'split'
  if (faces.length === 3) return 'three'
  return 'four'
}

/**
 * Runs Linux ONNX face tracking + active-speaker scoring + cut detection on a
 * video segment and returns smoothed 9:16 vertical reframing keyframes.
 */
export async function trackFacesInVideo(payload: TrackFacesPayload): Promise<TrajectoryKeyframe[]> {
  const ffmpeg = resolveFfmpegBinary()
  const session = await getDetectorSession()
  const fps = payload.sampleFps ?? 2
  const startSec = payload.start ?? 0

  const args: string[] = ['-hide_banner', '-loglevel', 'error']
  if (payload.start !== undefined) args.push('-ss', String(payload.start))
  if (payload.end !== undefined) args.push('-to', String(payload.end))
  args.push(
    '-i',
    payload.filePath,
    '-vf',
    `fps=${fps},scale=${INPUT_SIZE}:${INPUT_SIZE}`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'bgr24',
    'pipe:1',
  )

  const frameByteLen = INPUT_SIZE * INPUT_SIZE * 3
  const keyframes: TrajectoryKeyframe[] = []
  let prevFrame: Uint8Array | null = null
  let smoothCropX = 0.5 - 9 / 32
  let frameIndex = 0

  const proc = spawn(ffmpeg, args)
  let pending = Buffer.alloc(0)

  const processFrame = async (frame: Uint8Array) => {
    const time = startSec + frameIndex / fps
    frameIndex++

    const isCut = prevFrame ? frameMeanAbsDiff(frame, prevFrame) > 26 : true

    // Convert BGR24 HWC -> NCHW Float32 tensor
    const planeSize = INPUT_SIZE * INPUT_SIZE
    const tensorData = new Float32Array(3 * planeSize)
    for (let i = 0; i < planeSize; i++) {
      tensorData[i] = frame[i * 3]
      tensorData[planeSize + i] = frame[i * 3 + 1]
      tensorData[planeSize * 2 + i] = frame[i * 3 + 2]
    }

    const inputName = session.inputNames[0] || 'input'
    const tensor = new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE])
    const outputs = await session.run({ [inputName]: tensor })
    const faces = decodeYunetOutputs(outputs).map((face) => ({
      ...face,
      speakingScore: computeMouthActivity(frame, prevFrame, face),
    }))

    // Active speaker = highest speakingScore (fallback to largest face)
    const activeFace =
      faces.length > 0
        ? [...faces].sort(
            (a, b) =>
              (b.speakingScore ?? 0) - (a.speakingScore ?? 0) ||
              b.width * b.height - a.width * a.height,
          )[0]
        : null

    const cropWidth = 9 / 16
    const targetX = activeFace
      ? Math.max(0, Math.min(1 - cropWidth, activeFace.x + activeFace.width / 2 - cropWidth / 2))
      : 0.5 - cropWidth / 2

    // Snap immediately on scene cut, otherwise exponentially smooth camera pan
    smoothCropX = isCut ? targetX : smoothCropX * 0.72 + targetX * 0.28

    keyframes.push({
      time: Number(time.toFixed(3)),
      layout: chooseLayout(faces, payload.layoutPreference),
      cropX: Number(smoothCropX.toFixed(4)),
      cropY: 0,
      cropWidth: Number(cropWidth.toFixed(4)),
      cropHeight: 1,
      faces,
      isCut,
    })

    prevFrame = new Uint8Array(frame)
  }

  const framesQueue: Uint8Array[] = []

  await new Promise<void>((resolve, reject) => {
    proc.stdout.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk])
      while (pending.length >= frameByteLen) {
        const frame = new Uint8Array(pending.subarray(0, frameByteLen))
        pending = pending.subarray(frameByteLen)
        framesQueue.push(frame)
      }
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0 || framesQueue.length > 0) resolve()
      else reject(new Error(`FFmpeg frame reader exited with code ${code}`))
    })
  })

  for (const frame of framesQueue) {
    await processFrame(frame)
  }

  return keyframes
}
