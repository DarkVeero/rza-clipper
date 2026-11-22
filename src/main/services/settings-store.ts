import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { BRANDING } from '#/config/branding'
import type { AppSettings, ThemePreference } from '#/shared/types'

export function getDefaultSettings(): AppSettings {
  return {
    theme: 'dark',
    onboardingCompleted: false,
    exportDir: path.join(app.getPath('videos'), BRANDING.exportFolderName),
    transcriptionEngine: 'whisper-local',
    whisperModel: 'base',
    whisperAcceleration: 'auto',
    deepgramApiKey: '',
    deepgramModel: 'nova-3',
    aiProvider: BRANDING.defaultAiProvider,
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiApiKey: '',
    openaiModel: 'gpt-4.1-mini',
    defaultClipLength: '30-60s',
    defaultClipsCount: '5',
    discoveryPromptOverride: '',
    reviewPromptOverride: '',
    hardwareVideoEncoding: true,
  }
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function presetsPath(): string {
  return path.join(app.getPath('userData'), 'presets.json')
}

export function readSettingsSync(): AppSettings {
  const defaults = getDefaultSettings()
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

export function getThemeSync(): ThemePreference | null {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as { theme?: ThemePreference }
    return parsed.theme ?? null
  } catch {
    return null
  }
}

export async function readSettings(): Promise<AppSettings> {
  return readSettingsSync()
}

export async function writeSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = readSettingsSync()
  const next = { ...current, ...patch }
  const target = settingsPath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
  fs.renameSync(tmp, target)
}

export async function readCustomPresets(): Promise<unknown | null> {
  try {
    const raw = await fs.promises.readFile(presetsPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function writeCustomPresets(presets: unknown): Promise<void> {
  const target = presetsPath()
  await fs.promises.mkdir(path.dirname(target), { recursive: true })
  const tmp = `${target}.tmp`
  await fs.promises.writeFile(tmp, JSON.stringify(presets, null, 2), 'utf-8')
  await fs.promises.rename(tmp, target)
}
