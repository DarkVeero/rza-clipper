import { protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export function registerMediaProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false,
      },
    },
  ])
}

/**
 * Registers the `media://local/<encoded-abs-path>` protocol with full HTTP 206
 * byte-range support so HTML5 <video> seeking works smoothly on Linux.
 */
export function registerMediaProtocolHandler(): void {
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'local') {
        return new Response('Forbidden', { status: 403 })
      }

      const decodedPath = decodeURIComponent(url.pathname)
      const normalized = path.resolve(decodedPath)
      if (!fs.existsSync(normalized)) {
        return new Response('Not Found', { status: 404 })
      }

      const stat = fs.statSync(normalized)
      if (!stat.isFile()) {
        return new Response('Not Found', { status: 404 })
      }

      const ext = path.extname(normalized).toLowerCase()
      const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream'
      const fileSize = stat.size
      const rangeHeader = request.headers.get('range')

      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
        if (!match) {
          return new Response('Invalid Range', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          })
        }

        const start = match[1] ? Number.parseInt(match[1], 10) : 0
        const end = match[2] ? Math.min(Number.parseInt(match[2], 10), fileSize - 1) : fileSize - 1

        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          })
        }

        const chunkLength = end - start + 1
        const nodeStream = fs.createReadStream(normalized, { start, end })
        const webStream = Readable.toWeb(nodeStream) as ReadableStream

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunkLength),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-store',
          },
        })
      }

      const nodeStream = fs.createReadStream(normalized)
      const webStream = Readable.toWeb(nodeStream) as ReadableStream
      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error'
      return new Response(msg, { status: 500 })
    }
  })
}

export function toMediaUrl(absolutePath: string): string {
  const encoded = encodeURIComponent(path.resolve(absolutePath)).replace(/%2F/g, '/')
  return `media://local${encoded.startsWith('/') ? '' : '/'}${encoded}`
}
