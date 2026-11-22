import { contextBridge, ipcRenderer, webUtils } from 'electron'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('manus', {
  status: () => ipcRenderer.invoke('manus:status'),
  profile: () => ipcRenderer.invoke('manus:profile'),
  connect: () => ipcRenderer.invoke('manus:connect'),
  signOut: () => ipcRenderer.invoke('manus:sign-out'),
  dismissExpired: () => ipcRenderer.invoke('manus:dismiss-expired'),
})

contextBridge.exposeInMainWorld('openaiCompatible', {
  testConnection: (baseUrl: string, apiKey: string, model: string) =>
    ipcRenderer.invoke('openai-compatible:test', { baseUrl, apiKey, model }),
})

contextBridge.exposeInMainWorld('api', {
  announcements: {
    list: () => ipcRenderer.invoke('announcements:list'),
  },
  system: {
    getSpecs: () => ipcRenderer.invoke('system:get-specs'),
  },
  faceTracking: {
    trackFaces: (payload: unknown) => ipcRenderer.invoke('face-tracking:track', payload),
  },
  updater: {
    getState: () => ipcRenderer.invoke('updater:get-state'),
    currentVersion: () => ipcRenderer.invoke('updater:current-version'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onState: (cb: (state: unknown) => void) => subscribe('updater:state', cb),
  },
  transcription: {
    getModelsStatus: () => ipcRenderer.invoke('transcription:models-status'),
    deleteModel: (modelSize: string) => ipcRenderer.invoke('transcription:delete-model', modelSize),
    downloadModel: (modelSize: string) =>
      ipcRenderer.invoke('transcription:download-model', modelSize),
    cancelDownload: () => ipcRenderer.invoke('transcription:cancel-download'),
    onDownloadProgress: (cb: (progress: unknown) => void) =>
      subscribe('transcription:download-progress', cb),
    testDeepgramKey: (apiKey: string) =>
      ipcRenderer.invoke('transcription:test-deepgram', apiKey),
    transcribeDeepgram: (payload: unknown) =>
      ipcRenderer.invoke('transcription:deepgram', payload),
    extractAudio: (filePath: string, range?: { start?: number; end?: number }) =>
      ipcRenderer.invoke('transcription:extract-audio', { filePath, range }),
    start: (payload: unknown) => ipcRenderer.invoke('transcription:start', payload),
    cancel: () => ipcRenderer.invoke('transcription:cancel'),
    onUpdate: (cb: (update: unknown) => void) => subscribe('transcription:update', cb),
  },
  viralClips: {
    detect: (payload: unknown) => ipcRenderer.invoke('viral-clips:detect', payload),
    cancel: () => ipcRenderer.invoke('viral-clips:cancel'),
    onProgress: (cb: (progress: unknown) => void) => subscribe('viral-clips:progress', cb),
  },
  ai: {
    fixCaptions: (request: unknown) => ipcRenderer.invoke('ai:fix-captions', request),
    selectCaptionEmphasis: (request: unknown) => ipcRenderer.invoke('ai:select-emphasis', request),
    generatePublishingCopy: (request: unknown) =>
      ipcRenderer.invoke('ai:publishing-copy', request),
    cancel: (requestId: string) => ipcRenderer.invoke('ai:cancel', requestId),
    onProgress: (cb: (event: unknown) => void) => subscribe('ai:progress', cb),
    onCheckpoint: (cb: (event: unknown) => void) => subscribe('ai:checkpoint', cb),
  },
})

contextBridge.exposeInMainWorld('projects', {
  readAll: () => ipcRenderer.invoke('projects:read-all'),
  write: (id: string, project: unknown) => ipcRenderer.invoke('projects:write', { id, project }),
  delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
})

contextBridge.exposeInMainWorld('settings', {
  getThemeSync: () => ipcRenderer.sendSync('settings:get-theme-sync'),
  read: () => ipcRenderer.invoke('settings:read'),
  write: (settings: unknown) => ipcRenderer.invoke('settings:write', settings),
})

contextBridge.exposeInMainWorld('presets', {
  read: () => ipcRenderer.invoke('presets:read'),
  write: (presets: unknown) => ipcRenderer.invoke('presets:write', presets),
})

contextBridge.exposeInMainWorld('customFonts', {
  list: () => ipcRenderer.invoke('fonts:list'),
  install: (filePaths: string[]) => ipcRenderer.invoke('fonts:install', filePaths),
  pickAndInstall: () => ipcRenderer.invoke('fonts:pick-and-install'),
  delete: (id: string) => ipcRenderer.invoke('fonts:delete', id),
  getData: (id: string) => ipcRenderer.invoke('fonts:get-data', id),
  openFolder: () => ipcRenderer.invoke('fonts:open-folder'),
})

contextBridge.exposeInMainWorld('files', {
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  chooseBrandingMedia: (kind: string) => ipcRenderer.invoke('files:choose-branding-media', kind),
  chooseSavePath: (target: unknown) => ipcRenderer.invoke('files:choose-save-path', target),
  chooseDirectory: (defaultPath?: string) =>
    ipcRenderer.invoke('files:choose-directory', defaultPath),
  saveText: (target: unknown, contents: string) =>
    ipcRenderer.invoke('files:save-text', { target, contents }),
  openWrite: (filePath: string, transcodeToH264?: boolean, branding?: unknown) =>
    ipcRenderer.invoke('files:open-write', { filePath, transcodeToH264, branding }),
  write: (id: number, position: number, data: Uint8Array) =>
    ipcRenderer.invoke('files:write', { id, position, data }),
  closeWrite: (id: number, discard?: boolean) =>
    ipcRenderer.invoke('files:close-write', { id, discard }),
  getExportDir: (projectTitle: string, customBaseDir?: string) =>
    ipcRenderer.invoke('files:get-export-dir', { projectTitle, customBaseDir }),
  renameProjectFolder: (payload: unknown) =>
    ipcRenderer.invoke('files:rename-project-folder', payload),
  reveal: (filePath: string) => ipcRenderer.invoke('files:reveal', filePath),
  readFile: (filePath: string) => ipcRenderer.invoke('files:read-file', filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('files:delete-file', filePath),
  deleteProjectFolder: (payload: unknown) =>
    ipcRenderer.invoke('files:delete-project-folder', payload),
})

contextBridge.exposeInMainWorld('windowControls', {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
  enterProject: () => ipcRenderer.invoke('window:enter-project'),
  leaveProject: () => ipcRenderer.invoke('window:leave-project'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  showTransitionSpinner: () => ipcRenderer.invoke('window:show-spinner'),
  hideTransitionSpinner: () => ipcRenderer.invoke('window:hide-spinner'),
  moveBy: (dx: number, dy: number) => ipcRenderer.invoke('window:move-by', { dx, dy }),
  onMaximizedChange: (cb: (maximized: boolean) => void) => subscribe('window:maximized-change', cb),
})
