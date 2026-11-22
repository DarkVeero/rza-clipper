import { BrowserWindow, ipcMain } from 'electron'
import type {
  AppSettings,
  BrandingFinish,
  BrandingMediaKind,
  Cue,
  ModelSize,
  ProjectRecord,
  SaveTarget,
  TrackFacesPayload,
  TranscribeRequest,
} from '#/shared/types'
import { listAnnouncements } from '#/main/services/announcements-service'
import {
  connectManusAccount,
  dismissManusExpired,
  getManusProfile,
  getManusStatus,
  signOutManusAccount,
} from '#/main/services/ai/manus-session'
import { testOpenAiConnection } from '#/main/services/ai/openai-compatible'
import {
  chooseBrandingMedia,
  chooseDirectory,
  chooseSavePath,
  closeWriteStream,
  deleteLocalFile,
  deleteProjectFolder,
  openWriteStream,
  readLocalFile,
  renameProjectFolder,
  resolveExportDir,
  revealFile,
  saveTextFile,
  writeChunk,
} from '#/main/services/files-service'
import {
  deleteCustomFont,
  getCustomFontData,
  installCustomFonts,
  listCustomFonts,
  openFontsFolder,
  pickAndInstallCustomFonts,
} from '#/main/services/fonts-store'
import { deleteProject, readAllProjects, writeProject } from '#/main/services/projects-store'
import {
  getThemeSync,
  readCustomPresets,
  readSettings,
  writeCustomPresets,
  writeSettings,
} from '#/main/services/settings-store'
import { getSystemHardwareInfo } from '#/main/services/system-info'
import { extractAudioSamples } from '#/main/services/transcription/audio-extract'
import { testDeepgramKey, transcribeWithDeepgram } from '#/main/services/transcription/deepgram'
import {
  cancelModelDownload,
  deleteModel,
  downloadModel,
  getModelsStatus,
} from '#/main/services/transcription/models'
import { cancelWhisperRun, runLocalWhisper } from '#/main/services/transcription/whisper-runner'
import {
  checkForUpdates,
  downloadUpdate,
  getCurrentVersion,
  getUpdaterState,
  installUpdate,
} from '#/main/services/updater-service'
import {
  cancelAiRequest,
  fixOrTransliterateCaptions,
  generatePublishingCopy,
  selectCaptionEmphasis,
} from '#/main/services/viral-clips/caption-ai'
import { cancelViralClipDetection, detectViralClips } from '#/main/services/viral-clips/engine'
import { trackFacesInVideo } from '#/workers/face-tracking'

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Manus account
  ipcMain.handle('manus:status', () => getManusStatus())
  ipcMain.handle('manus:profile', () => getManusProfile())
  ipcMain.handle('manus:connect', () => connectManusAccount())
  ipcMain.handle('manus:sign-out', () => signOutManusAccount())
  ipcMain.handle('manus:dismiss-expired', () => dismissManusExpired())

  // OpenAI-compatible test
  ipcMain.handle(
    'openai-compatible:test',
    (_e, p: { baseUrl: string; apiKey: string; model: string }) =>
      testOpenAiConnection(p.baseUrl, p.apiKey, p.model),
  )

  // Announcements & System specs
  ipcMain.handle('announcements:list', () => listAnnouncements())
  ipcMain.handle('system:get-specs', () => getSystemHardwareInfo())

  // Face tracking
  ipcMain.handle('face-tracking:track', (_e, payload: TrackFacesPayload) =>
    trackFacesInVideo(payload),
  )

  // Updater
  ipcMain.handle('updater:get-state', () => getUpdaterState())
  ipcMain.handle('updater:current-version', () => getCurrentVersion())
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:install', () => installUpdate())

  // Transcription
  ipcMain.handle('transcription:models-status', () => getModelsStatus())
  ipcMain.handle('transcription:delete-model', (_e, size: ModelSize) => deleteModel(size))
  ipcMain.handle('transcription:download-model', (_e, size: ModelSize) => downloadModel(size))
  ipcMain.handle('transcription:cancel-download', () => cancelModelDownload())
  ipcMain.handle('transcription:test-deepgram', (_e, apiKey: string) => testDeepgramKey(apiKey))
  ipcMain.handle('transcription:deepgram', (_e, payload) => transcribeWithDeepgram(payload))
  ipcMain.handle(
    'transcription:extract-audio',
    (_e, p: { filePath: string; range?: { start?: number; end?: number } }) =>
      extractAudioSamples(p.filePath, p.range),
  )
  ipcMain.handle(
    'transcription:start',
    (
      _e,
      payload: {
        request: TranscribeRequest
        filePath?: string
        range?: { start?: number; end?: number }
      },
    ) =>
      runLocalWhisper(payload, (update) => {
        getMainWindow()?.webContents.send('transcription:update', update)
      }),
  )
  ipcMain.handle('transcription:cancel', () => cancelWhisperRun())

  // Viral clips
  ipcMain.handle(
    'viral-clips:detect',
    (
      _e,
      payload: {
        cues: Cue[]
        duration: number
        clipLength?: string
        clipsCount?: string
        prompts?: { discovery: string; review: string }
      },
    ) =>
      detectViralClips(payload, (progress) => {
        getMainWindow()?.webContents.send('viral-clips:progress', progress)
      }),
  )
  ipcMain.handle('viral-clips:cancel', () => cancelViralClipDetection())

  // AI caption utilities
  ipcMain.handle('ai:fix-captions', (_e, req: { requestId: string; payload: unknown }) =>
    fixOrTransliterateCaptions(req.requestId, req.payload),
  )
  ipcMain.handle('ai:select-emphasis', (_e, req: { requestId: string; payload: unknown }) =>
    selectCaptionEmphasis(req.requestId, req.payload),
  )
  ipcMain.handle('ai:publishing-copy', (_e, req: { requestId: string; payload: unknown }) =>
    generatePublishingCopy(req.requestId, req.payload),
  )
  ipcMain.handle('ai:cancel', (_e, requestId: string) => cancelAiRequest(requestId))

  // Projects, Settings, Presets
  ipcMain.handle('projects:read-all', () => readAllProjects())
  ipcMain.handle('projects:write', (_e, p: { id: string; project: ProjectRecord }) =>
    writeProject(p.id, p.project),
  )
  ipcMain.handle('projects:delete', (_e, id: string) => deleteProject(id))

  ipcMain.on('settings:get-theme-sync', (event) => {
    event.returnValue = getThemeSync()
  })
  ipcMain.handle('settings:read', () => readSettings())
  ipcMain.handle('settings:write', (_e, patch: Partial<AppSettings>) => writeSettings(patch))

  ipcMain.handle('presets:read', () => readCustomPresets())
  ipcMain.handle('presets:write', (_e, presets: unknown) => writeCustomPresets(presets))

  // Custom fonts
  ipcMain.handle('fonts:list', () => listCustomFonts())
  ipcMain.handle('fonts:install', (_e, filePaths: string[]) => installCustomFonts(filePaths))
  ipcMain.handle('fonts:pick-and-install', () => pickAndInstallCustomFonts())
  ipcMain.handle('fonts:delete', (_e, id: string) => deleteCustomFont(id))
  ipcMain.handle('fonts:get-data', (_e, id: string) => getCustomFontData(id))
  ipcMain.handle('fonts:open-folder', () => openFontsFolder())

  // Files & Export writer
  ipcMain.handle('files:choose-branding-media', (_e, kind: BrandingMediaKind) =>
    chooseBrandingMedia(kind),
  )
  ipcMain.handle('files:choose-save-path', (_e, target: SaveTarget) => chooseSavePath(target))
  ipcMain.handle('files:choose-directory', (_e, defaultPath?: string) =>
    chooseDirectory(defaultPath),
  )
  ipcMain.handle('files:save-text', (_e, p: { target: SaveTarget; contents: string }) =>
    saveTextFile(p.target, p.contents),
  )
  ipcMain.handle(
    'files:open-write',
    (_e, p: { filePath: string; transcodeToH264?: boolean; branding?: BrandingFinish }) =>
      openWriteStream(p.filePath, p.transcodeToH264, p.branding),
  )
  ipcMain.handle('files:write', (_e, p: { id: number; position: number; data: Uint8Array }) =>
    writeChunk(p.id, p.position, p.data),
  )
  ipcMain.handle('files:close-write', (_e, p: { id: number; discard?: boolean }) =>
    closeWriteStream(p.id, p.discard),
  )
  ipcMain.handle('files:get-export-dir', (_e, p: { projectTitle: string; customBaseDir?: string }) =>
    resolveExportDir(p.projectTitle, p.customBaseDir),
  )
  ipcMain.handle('files:rename-project-folder', (_e, p) => renameProjectFolder(p))
  ipcMain.handle('files:reveal', (_e, filePath: string) => revealFile(filePath))
  ipcMain.handle('files:read-file', (_e, filePath: string) => readLocalFile(filePath))
  ipcMain.handle('files:delete-file', (_e, filePath: string) => deleteLocalFile(filePath))
  ipcMain.handle('files:delete-project-folder', (_e, p) => deleteProjectFolder(p))

  // Window controls (Linux frameless support)
  ipcMain.handle('window:minimize', () => getMainWindow()?.minimize())
  ipcMain.handle('window:maximize', () => getMainWindow()?.maximize())
  ipcMain.handle('window:unmaximize', () => getMainWindow()?.unmaximize())
  ipcMain.handle('window:toggle-maximize', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:close', () => getMainWindow()?.close())
  ipcMain.handle('window:is-maximized', () => getMainWindow()?.isMaximized() ?? false)
  ipcMain.handle('window:enter-project', () => {
    const win = getMainWindow()
    if (win && !win.isMaximized()) win.setMinimumSize(1120, 720)
  })
  ipcMain.handle('window:leave-project', () => {
    getMainWindow()?.setMinimumSize(960, 640)
  })
  ipcMain.handle('window:show-spinner', () => undefined)
  ipcMain.handle('window:hide-spinner', () => undefined)
  ipcMain.handle('window:move-by', (_e, p: { dx: number; dy: number }) => {
    const win = getMainWindow()
    if (!win) return
    const [x, y] = win.getPosition()
    win.setPosition(Math.round(x + p.dx), Math.round(y + p.dy))
  })
}
