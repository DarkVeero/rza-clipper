import { app, dialog, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { BRANDING } from '#/config/branding'
import type { BrandingFinish, BrandingMediaKind, SaveTarget } from '#/shared/types'
import { applyBrandingOverlay } from '#/main/services/ffmpeg/branding'
import { transcodeToH264Mp4 } from '#/main/services/ffmpeg/video'

interface ActiveWriter {
  fd: fs.promises.FileHandle
  tempPath: string
  finalPath: string
  transcodeToH264: boolean
  branding?: BrandingFinish
}

let nextWriteId = 1
const writers = new Map<number, ActiveWriter>()

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Untitled Project'
}

export function resolveExportDir(projectTitle: string, customBaseDir?: string): string {
  const base = customBaseDir || path.join(app.getPath('videos'), BRANDING.exportFolderName)
  const dir = path.join(base, sanitizeFolderName(projectTitle))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function chooseBrandingMedia(kind: BrandingMediaKind): Promise<string | null> {
  const filters =
    kind === 'music'
      ? [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac'] }]
      : kind === 'logo'
        ? [{ name: 'Images', extensions: ['png', 'webp', 'jpg', 'jpeg'] }]
        : [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv'] }]

  const res = await dialog.showOpenDialog({
    title: `Select ${kind} — ${BRANDING.appName}`,
    properties: ['openFile'],
    filters,
  })
  return res.canceled ? null : res.filePaths[0] ?? null
}

export async function chooseSavePath(target: SaveTarget): Promise<string | null> {
  const res = await dialog.showSaveDialog({
    title: `Save — ${BRANDING.appName}`,
    defaultPath: target.defaultDir
      ? path.join(target.defaultDir, target.defaultName)
      : target.defaultName,
    filters: target.filters,
  })
  return res.canceled ? null : res.filePath ?? null
}

export async function chooseDirectory(defaultPath?: string): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: `Choose Folder — ${BRANDING.appName}`,
    defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  })
  return res.canceled ? null : res.filePaths[0] ?? null
}

export async function saveTextFile(target: SaveTarget, contents: string): Promise<string | null> {
  const dest = await chooseSavePath(target)
  if (!dest) return null
  await fs.promises.writeFile(dest, contents, 'utf-8')
  return dest
}

export async function openWriteStream(
  filePath: string,
  transcodeToH264 = false,
  branding?: BrandingFinish,
): Promise<number> {
  const dir = path.dirname(filePath)
  await fs.promises.mkdir(dir, { recursive: true })
  const tempPath = path.join(dir, `${BRANDING.tempFilePrefix}${Date.now()}-${path.basename(filePath)}`)
  const fd = await fs.promises.open(tempPath, 'w')
  const id = nextWriteId++
  writers.set(id, { fd, tempPath, finalPath: filePath, transcodeToH264, branding })
  return id
}

export async function writeChunk(id: number, position: number, data: Uint8Array): Promise<void> {
  const writer = writers.get(id)
  if (!writer) throw new Error(`Unknown write handle: ${id}`)
  await writer.fd.write(data, 0, data.byteLength, position)
}

export async function closeWriteStream(
  id: number,
  discard = false,
): Promise<{ filePath: string; size: number } | null> {
  const writer = writers.get(id)
  if (!writer) return null
  writers.delete(id)
  await writer.fd.close()

  if (discard) {
    await fs.promises.unlink(writer.tempPath).catch(() => {})
    return null
  }

  let currentFile = writer.tempPath
  const hasBranding = Boolean(writer.branding?.watermarkPath || writer.branding?.musicPath)

  try {
    if (hasBranding && writer.branding) {
      const branded = `${writer.tempPath}.branded.mp4`
      await applyBrandingOverlay(currentFile, branded, writer.branding)
      await fs.promises.unlink(currentFile).catch(() => {})
      currentFile = branded
    } else if (writer.transcodeToH264) {
      const transcoded = `${writer.tempPath}.h264.mp4`
      await transcodeToH264Mp4(currentFile, transcoded)
      await fs.promises.unlink(currentFile).catch(() => {})
      currentFile = transcoded
    }

    await fs.promises.rename(currentFile, writer.finalPath)
    const stat = await fs.promises.stat(writer.finalPath)
    return { filePath: writer.finalPath, size: stat.size }
  } catch (err) {
    await fs.promises.unlink(currentFile).catch(() => {})
    throw err
  }
}

export async function renameProjectFolder(payload: {
  oldTitle: string
  newTitle: string
  customBaseDir?: string
  savedPath?: string | null
  savedClipPaths?: Record<string, string>
}) {
  const base = payload.customBaseDir || path.join(app.getPath('videos'), BRANDING.exportFolderName)
  const oldDir = path.join(base, sanitizeFolderName(payload.oldTitle))
  const newDir = path.join(base, sanitizeFolderName(payload.newTitle))
  if (oldDir === newDir || !fs.existsSync(oldDir)) {
    return { success: true, renamed: false, oldDir, newDir }
  }
  try {
    await fs.promises.rename(oldDir, newDir)
    const remap = (p?: string | null) => (p && p.startsWith(oldDir) ? newDir + p.slice(oldDir.length) : p)
    const newSavedClipPaths: Record<string, string> = {}
    if (payload.savedClipPaths) {
      for (const [k, v] of Object.entries(payload.savedClipPaths)) {
        newSavedClipPaths[k] = remap(v) || v
      }
    }
    return {
      success: true,
      renamed: true,
      oldDir,
      newDir,
      newSavedPath: remap(payload.savedPath),
      newSavedClipPaths,
    }
  } catch (err) {
    return {
      success: false,
      renamed: false,
      oldDir,
      newDir,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function revealFile(filePath: string): Promise<void> {
  shell.showItemInFolder(filePath)
}

export async function readLocalFile(
  filePath: string,
): Promise<{ buffer: Uint8Array; name: string } | null> {
  try {
    const buf = await fs.promises.readFile(filePath)
    return { buffer: new Uint8Array(buf), name: path.basename(filePath) }
  } catch {
    return null
  }
}

export async function deleteLocalFile(filePath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(filePath)
    return true
  } catch {
    return false
  }
}

export async function deleteProjectFolder(payload: {
  title?: string
  customBaseDir?: string
}) {
  if (!payload.title) return { success: true, deleted: false }
  const base = payload.customBaseDir || path.join(app.getPath('videos'), BRANDING.exportFolderName)
  const dir = path.join(base, sanitizeFolderName(payload.title))
  if (!fs.existsSync(dir)) return { success: true, deleted: false }
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
    return { success: true, deleted: true, deletedDir: dir }
  } catch (err) {
    return {
      success: false,
      deleted: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
