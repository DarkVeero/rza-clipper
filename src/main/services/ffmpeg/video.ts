import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveFfmpegBinary } from '#/main/services/ffmpeg/binary'

const execFileAsync = promisify(execFile)

/**
 * Transcodes an exported clip to broadly compatible H.264/AAC MP4 (yuv420p, +faststart).
 */
export async function transcodeToH264Mp4(inputPath: string, outputPath: string): Promise<void> {
  const ffmpeg = resolveFfmpegBinary()
  await execFileAsync(ffmpeg, [
    '-y',
    '-i',
    inputPath,
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
  ])
}
