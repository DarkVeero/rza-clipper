import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { BrandingFinish } from '#/shared/types'
import { resolveFfmpegBinary } from '#/main/services/ffmpeg/binary'

const execFileAsync = promisify(execFile)

function overlayCoords(position: BrandingFinish['watermarkPosition']): string {
  switch (position) {
    case 'top-left':
      return '36:36'
    case 'bottom-left':
      return '36:H-h-36'
    case 'bottom-right':
      return 'W-w-36:H-h-36'
    case 'top-right':
    default:
      return 'W-w-36:36'
  }
}

/**
 * Applies optional watermark image overlay and looped background music (`amix`)
 * via FFmpeg, encoding to H.264 CRF 18 + AAC 192k.
 */
export async function applyBrandingOverlay(
  inputPath: string,
  outputPath: string,
  branding: BrandingFinish,
): Promise<void> {
  const ffmpeg = resolveFfmpegBinary()
  const args: string[] = ['-y', '-i', inputPath]
  const filterParts: string[] = []

  let nextInputIdx = 1
  let videoLabel = '0:v'
  let audioLabel = '0:a'

  if (branding.watermarkPath) {
    args.push('-i', branding.watermarkPath)
    const wmIdx = nextInputIdx++
    const opacity = Math.max(0.05, Math.min(1, branding.watermarkOpacity ?? 0.85))
    const coords = overlayCoords(branding.watermarkPosition)
    filterParts.push(
      `[${wmIdx}:v]scale=180:-1,format=rgba,colorchannelmixer=aa=${opacity.toFixed(2)}[wm]`,
    )
    filterParts.push(`[${videoLabel}][wm]overlay=${coords}[vout]`)
    videoLabel = 'vout'
  }

  if (branding.musicPath) {
    args.push('-stream_loop', '-1', '-i', branding.musicPath)
    const musicIdx = nextInputIdx++
    const vol = Math.max(0.02, Math.min(1, branding.musicVolume ?? 0.14))
    filterParts.push(`[${musicIdx}:a]volume=${vol.toFixed(2)}[bg]`)
    filterParts.push(`[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`)
    audioLabel = 'aout'
  }

  if (filterParts.length > 0) {
    args.push('-filter_complex', filterParts.join(';'))
  }

  args.push(
    '-map',
    videoLabel === '0:v' ? '0:v' : `[${videoLabel}]`,
    '-map',
    audioLabel === '0:a' ? '0:a?' : `[${audioLabel}]`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outputPath,
  )

  await execFileAsync(ffmpeg, args)
}
