import type {
  Announcement,
  AppSettings,
  BrandingFinish,
  BrandingMediaKind,
  Cue,
  CustomFontRecord,
  DeepgramTranscribeResult,
  ManusAccountProfile,
  ManusAccountStatus,
  ModelDownloadProgress,
  ModelSize,
  ModelStatus,
  ProjectRecord,
  SaveTarget,
  SpeechChunk,
  SystemHardwareInfo,
  TrackFacesPayload,
  TrajectoryKeyframe,
  TranscribeProgress,
  TranscribeRequest,
  UpdateState,
  ViralClipCandidate,
} from '#/shared/types'

declare global {
  interface Window {
    manus: {
      status: () => Promise<ManusAccountStatus>
      profile: () => Promise<ManusAccountProfile | null>
      connect: () => Promise<void>
      signOut: () => Promise<void>
      dismissExpired: () => Promise<void>
    }
    openaiCompatible: {
      testConnection: (
        baseUrl: string,
        apiKey: string,
        model: string,
      ) => Promise<{ valid: boolean; error?: string }>
    }
    api: {
      announcements: {
        list: () => Promise<Announcement[]>
      }
      system: {
        getSpecs: () => Promise<SystemHardwareInfo>
      }
      faceTracking: {
        trackFaces: (payload: TrackFacesPayload) => Promise<TrajectoryKeyframe[]>
      }
      updater: {
        getState: () => Promise<UpdateState>
        currentVersion: () => Promise<string>
        check: () => Promise<UpdateState>
        download: () => Promise<UpdateState>
        install: () => Promise<boolean>
        onState: (cb: (state: UpdateState) => void) => () => void
      }
      transcription: {
        getModelsStatus: () => Promise<Record<string, ModelStatus>>
        deleteModel: (modelSize: ModelSize) => Promise<void>
        downloadModel: (modelSize: ModelSize) => Promise<{ success: boolean; filePath: string }>
        cancelDownload: () => Promise<void>
        onDownloadProgress: (cb: (progress: ModelDownloadProgress) => void) => () => void
        testDeepgramKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>
        transcribeDeepgram: (payload: {
          samples?: Float32Array
          filePath?: string
          range?: { start?: number; end?: number }
          duration?: number
          apiKey: string
          model?: string
          language?: string
          granularity?: 'words' | 'sentences'
        }) => Promise<DeepgramTranscribeResult>
        extractAudio: (
          filePath: string,
          range?: { start?: number; end?: number },
        ) => Promise<{ samples: Float32Array; duration: number }>
        start: (payload: {
          request: TranscribeRequest
          samples?: Float32Array
          filePath?: string
          duration?: number
          range?: { start?: number; end?: number }
        }) => Promise<{ chunks: SpeechChunk[]; text: string } | null>
        cancel: () => Promise<void>
        onUpdate: (cb: (update: Partial<TranscribeProgress>) => void) => () => void
      }
      viralClips: {
        detect: (payload: {
          cues: Cue[]
          duration: number
          clipLength?: string
          clipsCount?: string
          prompts?: { discovery: string; review: string }
        }) => Promise<ViralClipCandidate[]>
        cancel: () => Promise<void>
        onProgress: (
          cb: (progress: {
            progressFraction: number | null
            detail: string | null
            candidate?: ViralClipCandidate
          }) => void,
        ) => () => void
      }
      ai: {
        fixCaptions: (request: { requestId: string; payload: unknown }) => Promise<unknown>
        selectCaptionEmphasis: (request: { requestId: string; payload: unknown }) => Promise<unknown>
        generatePublishingCopy: (request: { requestId: string; payload: unknown }) => Promise<unknown>
        cancel: (requestId: string) => Promise<void>
        onProgress: (
          cb: (event: { requestId: string; progress: number; detail?: string }) => void,
        ) => () => void
        onCheckpoint: (
          cb: (event: { requestId: string; completed: unknown }) => void,
        ) => () => void
      }
    }
    projects: {
      readAll: () => Promise<ProjectRecord[]>
      write: (id: string, project: ProjectRecord) => Promise<void>
      delete: (id: string) => Promise<void>
    }
    settings: {
      getThemeSync: () => 'light' | 'dark' | 'system' | null
      read: () => Promise<AppSettings | null>
      write: (settings: Partial<AppSettings>) => Promise<void>
    }
    presets: {
      read: () => Promise<unknown | null>
      write: (presets: unknown) => Promise<void>
    }
    customFonts: {
      list: () => Promise<CustomFontRecord[]>
      install: (filePaths: string[]) => Promise<CustomFontRecord[]>
      pickAndInstall: () => Promise<CustomFontRecord[]>
      delete: (id: string) => Promise<boolean>
      getData: (id: string) => Promise<{ buffer: Uint8Array; mimeType: string } | null>
      openFolder: () => Promise<void>
    }
    files: {
      pathForFile: (file: File) => string
      chooseBrandingMedia: (kind: BrandingMediaKind) => Promise<string | null>
      chooseSavePath: (target: SaveTarget) => Promise<string | null>
      chooseDirectory: (defaultPath?: string) => Promise<string | null>
      saveText: (target: SaveTarget, contents: string) => Promise<string | null>
      openWrite: (
        filePath: string,
        transcodeToH264?: boolean,
        branding?: BrandingFinish,
      ) => Promise<number>
      write: (id: number, position: number, data: Uint8Array) => Promise<void>
      closeWrite: (
        id: number,
        discard?: boolean,
      ) => Promise<{ filePath: string; size: number } | null>
      getExportDir: (projectTitle: string, customBaseDir?: string) => Promise<string>
      renameProjectFolder: (payload: {
        oldTitle: string
        newTitle: string
        customBaseDir?: string
        savedPath?: string | null
        savedClipPaths?: Record<string, string>
      }) => Promise<{
        success: boolean
        renamed: boolean
        oldDir: string
        newDir: string
        newSavedPath?: string | null
        newSavedClipPaths?: Record<string, string>
        error?: string
      }>
      reveal: (filePath: string) => Promise<void>
      readFile: (filePath: string) => Promise<{ buffer: Uint8Array; name: string } | null>
      deleteFile: (filePath: string) => Promise<boolean>
      deleteProjectFolder: (payload: {
        title?: string
        customBaseDir?: string
        savedPath?: string | null
        savedClipPaths?: Record<string, string>
      }) => Promise<{
        success: boolean
        deleted: boolean
        deletedDir?: string
        error?: string
      }>
    }
    windowControls: {
      platform: NodeJS.Platform
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      unmaximize: () => Promise<void>
      enterProject: () => Promise<void>
      leaveProject: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      showTransitionSpinner: () => Promise<void>
      hideTransitionSpinner: () => Promise<void>
      moveBy: (dx: number, dy: number) => Promise<void>
      onMaximizedChange: (cb: (maximized: boolean) => void) => () => void
    }
  }
}

export {}
