import type { BrandingFinish, Cue, TrajectoryKeyframe } from '#/shared/types'
import type { CaptionPreset } from '#/renderer/data/caption-presets'

function findCropForTime(keyframes: TrajectoryKeyframe[], time: number): TrajectoryKeyframe {
  if (keyframes.length === 0) {
    return {
      time,
      layout: 'general',
      cropX: 0.5 - 9 / 32,
      cropY: 0,
      cropWidth: 9 / 16,
      cropHeight: 1,
      faces: [],
    }
  }
  let best = keyframes[0]
  for (const kf of keyframes) {
    if (kf.time <= time) best = kf
    else break
  }
  return best
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  cue: Cue | undefined,
  currentTime: number,
  preset: CaptionPreset,
  width: number,
  height: number,
) {
  if (!cue) return
  const text = preset.uppercase ? cue.text.toUpperCase() : cue.text
  const y = Math.round(height * preset.positionY)

  ctx.save()
  ctx.font = `${preset.fontWeight} ${preset.fontSizePx}px "${preset.fontFamily}", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const maxLineWidth = width * 0.86
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxLineWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  const lineHeight = preset.fontSizePx * 1.25
  const totalHeight = lines.length * lineHeight
  const startY = y - totalHeight / 2 + lineHeight / 2

  if (preset.backgroundColor) {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
    ctx.fillStyle = preset.backgroundColor
    ctx.beginPath()
    ctx.roundRect(
      width / 2 - widest / 2 - 22,
      startY - lineHeight / 2 - 12,
      widest + 44,
      totalHeight + 24,
      16,
    )
    ctx.fill()
  }

  lines.forEach((ln, idx) => {
    const ly = startY + idx * lineHeight
    if (preset.strokeColor && preset.strokeWidth) {
      ctx.lineWidth = preset.strokeWidth
      ctx.strokeStyle = preset.strokeColor
      ctx.lineJoin = 'round'
      ctx.strokeText(ln, width / 2, ly)
    }
    const activeWord = cue.words?.find((w) => currentTime >= w.start && currentTime <= w.end)
    ctx.fillStyle = activeWord ? preset.highlightColor : preset.textColor
    ctx.fillText(ln, width / 2, ly)
  })

  ctx.restore()
}

/**
 * Renders a 1080x1920 9:16 clip with face-tracked reframing + burned captions,
 * streaming encoded bytes to main process for FFmpeg H.264 + branding finalization.
 */
export async function exportVerticalClip(opts: {
  videoUrl: string
  outputPath: string
  start: number
  end: number
  cues: Cue[]
  keyframes: TrajectoryKeyframe[]
  preset: CaptionPreset
  branding?: BrandingFinish
  onProgress?: (pct: number) => void
}): Promise<{ filePath: string; size: number } | null> {
  const width = 1080
  const height = 1920

  const video = document.createElement('video')
  video.src = opts.videoUrl
  video.crossOrigin = 'anonymous'
  video.muted = false
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load source video for export'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const canvasStream = canvas.captureStream(30)
  const audioCtx = new AudioContext()
  const sourceNode = audioCtx.createMediaElementSource(video)
  const destNode = audioCtx.createMediaStreamDestination()
  sourceNode.connect(destNode)
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destNode.stream.getAudioTracks(),
  ])

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm'

  const writeId = await window.files.openWrite(opts.outputPath, true, opts.branding)
  let byteOffset = 0
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })

  const writeQueue: Promise<void>[] = []
  recorder.ondataavailable = (ev) => {
    if (ev.data.size === 0) return
    const p = ev.data.arrayBuffer().then(async (buf) => {
      const pos = byteOffset
      byteOffset += buf.byteLength
      await window.files.write(writeId, pos, new Uint8Array(buf))
    })
    writeQueue.push(p)
  }

  video.currentTime = opts.start
  await new Promise<void>((r) => {
    video.onseeked = () => r()
  })

  recorder.start(500)
  await video.play()

  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      const t = video.currentTime
      if (t >= opts.end || video.ended) {
        video.pause()
        recorder.stop()
        resolve()
        return
      }
      const kf = findCropForTime(opts.keyframes, t)
      const sx = kf.cropX * video.videoWidth
      const sy = kf.cropY * video.videoHeight
      const sw = kf.cropWidth * video.videoWidth
      const sh = kf.cropHeight * video.videoHeight
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height)

      const cue = opts.cues.find((c) => t >= c.start && t <= c.end)
      drawCaption(ctx, cue, t, opts.preset, width, height)

      const pct = Math.min(1, Math.max(0, (t - opts.start) / Math.max(0.1, opts.end - opts.start)))
      opts.onProgress?.(pct)
      requestAnimationFrame(drawFrame)
    }
    requestAnimationFrame(drawFrame)
  })

  await new Promise<void>((r) => {
    recorder.onstop = () => r()
  })
  await Promise.all(writeQueue)
  await audioCtx.close()

  return window.files.closeWrite(writeId, false)
}
