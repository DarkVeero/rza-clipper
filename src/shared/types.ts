export type ModelSize = 'tiny' | 'base' | 'small' | 'large-v3-turbo'

export type WhisperAccelerationMode = 'auto' | 'gpu' | 'cpu'

export type ThemePreference = 'light' | 'dark' | 'system'

export type AiProviderMode = 'openai-compatible' | 'manus'

export type BrandingMediaKind = 'logo' | 'music' | 'intro' | 'outro'

export interface BrandingFinish {
  watermarkPath?: string | null
  watermarkOpacity?: number
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  musicPath?: string | null
  musicVolume?: number
}

export interface WordTimestamp {
  word: string
  start: number
  end: number
  confidence?: number
  speaker?: number
}

export interface Cue {
  id: string
  start: number
  end: number
  text: string
  words?: WordTimestamp[]
  speaker?: number
  emphasisWordIndex?: number | null
}

export interface SpeechChunk {
  text: string
  timestamp: [number, number]
  words?: WordTimestamp[]
  speaker?: number
}

export interface TranscribeRequest {
  modelSize: ModelSize
  language?: string
  acceleration?: WhisperAccelerationMode
  granularity?: 'words' | 'sentences'
}

export interface TranscribeProgress {
  status: 'idle' | 'extracting' | 'loading' | 'transcribing' | 'done' | 'error' | 'cancelled'
  progress: number
  detail?: string
  backend?: 'vulkan' | 'cuda' | 'cpu'
  fallbackNotice?: string
  error?: string
}

export interface ModelStatus {
  size: ModelSize
  installed: boolean
  filePath: string
  bytes: number
  expectedBytes: number
}

export interface ModelDownloadProgress {
  modelSize: ModelSize
  loaded: number
  total: number
  progress: number
}

export interface DeepgramTranscribeResult {
  text: string
  chunks: SpeechChunk[]
  cues: Cue[]
  language?: string
}

export interface ViralClipScoreBreakdown {
  hookStrength: number
  engagement: number
  standaloneClarity: number
  payoff: number
  specificity: number
  weightedTotal: number
  problems: string[]
}

export interface ViralClipCandidate {
  id: string
  title: string
  start: number
  end: number
  reason: string
  hookEvidence?: string
  payoffEvidence?: string
  score: number
  tier: 'pass' | 'suggested' | 'fallback'
  breakdown?: ViralClipScoreBreakdown
  hashtags?: string[]
  captionCopy?: string
}

export type SpeakerLayoutMode = 'track' | 'split' | 'three' | 'four' | 'general'

export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
  score: number
  speakingScore?: number
}

export interface TrajectoryKeyframe {
  time: number
  layout: SpeakerLayoutMode
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  faces: FaceBox[]
  isCut?: boolean
}

export interface TrackFacesPayload {
  filePath: string
  start?: number
  end?: number
  sampleFps?: number
  layoutPreference?: SpeakerLayoutMode | 'auto'
  cues?: Cue[]
}

export interface SystemGpuDevice {
  name: string
  vendor: 'nvidia' | 'amd' | 'intel' | 'unknown'
  vramMb?: number
  driver?: string
  cudaAvailable?: boolean
  vulkanSupported?: boolean
  vulkan12?: boolean
  storage16Bit?: boolean
}

export interface SystemHardwareInfo {
  platform: NodeJS.Platform
  arch: string
  cpuModel: string
  cpuCores: number
  totalMemoryGb: number
  hasGpu: boolean
  gpus: SystemGpuDevice[]
  recommendedWhisperBackend: 'cuda' | 'vulkan' | 'cpu'
  vulkanAvailable: boolean
  vaapiAvailable: boolean
}

export interface CustomFontRecord {
  id: string
  family: string
  fileName: string
  filePath: string
  mimeType: string
  format: 'truetype' | 'opentype' | 'woff' | 'woff2'
  installedAt: string
}

export interface SaveTarget {
  defaultName: string
  defaultDir?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'
  currentVersion: string
  latestVersion?: string
  releaseNotes?: string
  downloadUrl?: string
  downloadedPath?: string
  progress?: number
  error?: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  imageUrl?: string
  linkUrl?: string
  publishedAt: string
}

export interface ManusAccountStatus {
  connected: boolean
  expired?: boolean
  email?: string
  credits?: number | null
}

export interface ManusAccountProfile {
  email?: string
  name?: string
  avatarUrl?: string
  credits?: number | null
}

export interface AppSettings {
  theme: ThemePreference
  onboardingCompleted: boolean
  exportDir: string
  transcriptionEngine: 'whisper-local' | 'deepgram'
  whisperModel: ModelSize
  whisperAcceleration: WhisperAccelerationMode
  deepgramApiKey: string
  deepgramModel: 'nova-3' | 'nova-2' | 'enhanced'
  aiProvider: AiProviderMode
  openaiBaseUrl: string
  openaiApiKey: string
  openaiModel: string
  defaultClipLength: string
  defaultClipsCount: string
  discoveryPromptOverride: string
  reviewPromptOverride: string
  hardwareVideoEncoding: boolean
}

export interface ProjectRecord {
  id: string
  title: string
  videoPath: string
  duration: number
  width: number
  height: number
  createdAt: string
  updatedAt: string
  cues: Cue[]
  clips: ViralClipCandidate[]
  activeClipId?: string | null
  presetId: string
  layoutMode: SpeakerLayoutMode
  keyframes: TrajectoryKeyframe[]
  savedPath?: string | null
  savedClipPaths?: Record<string, string>
}
