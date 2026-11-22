import { app, dialog, shell } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { CustomFontRecord } from '#/shared/types'

const EXT_INFO: Record<string, { mimeType: string; format: CustomFontRecord['format'] }> = {
  '.ttf': { mimeType: 'font/ttf', format: 'truetype' },
  '.otf': { mimeType: 'font/otf', format: 'opentype' },
  '.woff': { mimeType: 'font/woff', format: 'woff' },
  '.woff2': { mimeType: 'font/woff2', format: 'woff2' },
}

function fontsDir(): string {
  const dir = path.join(app.getPath('userData'), 'fonts')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function indexPath(): string {
  return path.join(fontsDir(), 'index.json')
}

function readIndex(): CustomFontRecord[] {
  try {
    const raw = fs.readFileSync(indexPath(), 'utf-8')
    const parsed = JSON.parse(raw) as CustomFontRecord[]
    return parsed.filter((r) => fs.existsSync(r.filePath))
  } catch {
    return []
  }
}

function writeIndex(records: CustomFontRecord[]): void {
  fs.writeFileSync(indexPath(), JSON.stringify(records, null, 2), 'utf-8')
}

function deriveFamilyName(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath))
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b(regular|bold|italic|medium|semibold|light|variable)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || base
}

export async function listCustomFonts(): Promise<CustomFontRecord[]> {
  return readIndex()
}

export async function installCustomFonts(filePaths: string[]): Promise<CustomFontRecord[]> {
  const existing = readIndex()
  const added: CustomFontRecord[] = []

  for (const src of filePaths) {
    const ext = path.extname(src).toLowerCase()
    const info = EXT_INFO[ext]
    if (!info || !fs.existsSync(src)) continue

    const id = crypto.randomUUID()
    const fileName = `${id}${ext}`
    const dest = path.join(fontsDir(), fileName)
    await fs.promises.copyFile(src, dest)

    const record: CustomFontRecord = {
      id,
      family: deriveFamilyName(src),
      fileName: path.basename(src),
      filePath: dest,
      mimeType: info.mimeType,
      format: info.format,
      installedAt: new Date().toISOString(),
    }
    existing.push(record)
    added.push(record)
  }

  writeIndex(existing)
  return added
}

export async function pickAndInstallCustomFonts(): Promise<CustomFontRecord[]> {
  const result = await dialog.showOpenDialog({
    title: 'Install Custom Caption Fonts — Rza Clipper',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Font Files', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return []
  return installCustomFonts(result.filePaths)
}

export async function deleteCustomFont(id: string): Promise<boolean> {
  const existing = readIndex()
  const target = existing.find((f) => f.id === id)
  if (!target) return false
  try {
    await fs.promises.unlink(target.filePath)
  } catch {
    // Ignore if already removed
  }
  writeIndex(existing.filter((f) => f.id !== id))
  return true
}

export async function getCustomFontData(
  id: string,
): Promise<{ buffer: Uint8Array; mimeType: string } | null> {
  const target = readIndex().find((f) => f.id === id)
  if (!target || !fs.existsSync(target.filePath)) return null
  const buf = await fs.promises.readFile(target.filePath)
  return { buffer: new Uint8Array(buf), mimeType: target.mimeType }
}

export async function openFontsFolder(): Promise<void> {
  await shell.openPath(fontsDir())
}
