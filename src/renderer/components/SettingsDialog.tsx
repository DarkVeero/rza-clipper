import { useEffect, useState } from 'react'
import type {
  AppSettings,
  CustomFontRecord,
  ModelDownloadProgress,
  ModelSize,
  ModelStatus,
  SystemHardwareInfo,
  UpdateState,
} from '#/shared/types'

type SettingsTab = 'general' | 'transcription' | 'ai' | 'prompts' | 'fonts' | 'system'

interface SettingsDialogProps {
  open: boolean
  settings: AppSettings
  onClose: () => void
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}

export function SettingsDialog({ open, settings, onClose, onSave }: SettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>('general')
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [models, setModels] = useState<Record<string, ModelStatus>>({})
  const [dlProgress, setDlProgress] = useState<ModelDownloadProgress | null>(null)
  const [fonts, setFonts] = useState<CustomFontRecord[]>([])
  const [specs, setSpecs] = useState<SystemHardwareInfo | null>(null)
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [testMsg, setTestMsg] = useState<string>('')

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  useEffect(() => {
    if (!open) return
    void window.api.transcription.getModelsStatus().then(setModels)
    void window.customFonts.list().then(setFonts)
    void window.api.system.getSpecs().then(setSpecs)
    void window.api.updater.getState().then(setUpdateState)
    const unsubDl = window.api.transcription.onDownloadProgress(setDlProgress)
    const unsubUp = window.api.updater.onState(setUpdateState)
    return () => {
      unsubDl()
      unsubUp()
    }
  }, [open])

  if (!open) return null

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    await onSave(draft)
    onClose()
  }

  const handleDownloadModel = async (size: ModelSize) => {
    await window.api.transcription.downloadModel(size)
    setDlProgress(null)
    setModels(await window.api.transcription.getModelsStatus())
  }

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'transcription', label: 'Transcription' },
    { id: 'ai', label: 'AI Provider' },
    { id: 'prompts', label: 'Viral Prompts' },
    { id: 'fonts', label: 'Fonts' },
    { id: 'system', label: 'Linux GPU & Updates' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex h-[560px] w-full max-w-3xl overflow-hidden rounded-xl border shadow-2xl"
        style={{ background: 'var(--background)' }}
      >
        <nav className="w-48 shrink-0 border-r p-3" style={{ background: 'var(--surface)' }}>
          <div className="mb-3 px-2 text-sm font-semibold">Settings</div>
          <div className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                  tab === t.id
                    ? 'bg-[var(--accent)] font-medium text-[var(--accent-foreground)]'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
            {tab === 'general' && (
              <>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">Theme</span>
                  <select
                    value={draft.theme}
                    onChange={(e) => updateField('theme', e.target.value as AppSettings['theme'])}
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </label>
                <div className="space-y-1">
                  <span className="text-xs text-[var(--muted)]">Default Export Directory</span>
                  <div className="flex gap-2">
                    <input
                      value={draft.exportDir}
                      onChange={(e) => updateField('exportDir', e.target.value)}
                      className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const dir = await window.files.chooseDirectory(draft.exportDir)
                        if (dir) updateField('exportDir', dir)
                      }}
                      className="rounded-lg border px-3 py-2 text-xs"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === 'transcription' && (
              <>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">Engine</span>
                  <select
                    value={draft.transcriptionEngine}
                    onChange={(e) =>
                      updateField(
                        'transcriptionEngine',
                        e.target.value as AppSettings['transcriptionEngine'],
                      )
                    }
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="whisper-local">Local Whisper (whisper.cpp Vulkan / CPU)</option>
                    <option value="deepgram">Deepgram Cloud API</option>
                  </select>
                </label>

                {draft.transcriptionEngine === 'whisper-local' ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--muted)]">GPU Acceleration Mode</span>
                      <select
                        value={draft.whisperAcceleration}
                        onChange={(e) =>
                          updateField(
                            'whisperAcceleration',
                            e.target.value as AppSettings['whisperAcceleration'],
                          )
                        }
                        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                      >
                        <option value="auto">Auto (Try Vulkan GPU, fallback to CPU -ng)</option>
                        <option value="gpu">GPU Required (Vulkan)</option>
                        <option value="cpu">CPU Only (-ng)</option>
                      </select>
                    </label>
                    <div className="space-y-2">
                      <span className="text-xs text-[var(--muted)]">Whisper GGML Models</span>
                      {(['tiny', 'base', 'small', 'large-v3-turbo'] as ModelSize[]).map((size) => {
                        const m = models[size]
                        return (
                          <div
                            key={size}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                          >
                            <div>
                              <span className="font-medium">{size}</span>
                              <span className="ml-2 text-[var(--muted)]">
                                {m?.installed ? 'Installed' : 'Not downloaded'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {m?.installed ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateField('whisperModel', size)}
                                    className={`rounded border px-2 py-1 ${
                                      draft.whisperModel === size
                                        ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                                        : ''
                                    }`}
                                  >
                                    {draft.whisperModel === size ? 'Active' : 'Use'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await window.api.transcription.deleteModel(size)
                                      setModels(await window.api.transcription.getModelsStatus())
                                    }}
                                    className="rounded border px-2 py-1 text-red-500"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleDownloadModel(size)}
                                  className="rounded border px-2 py-1"
                                >
                                  Download
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {dlProgress && (
                        <div className="text-xs text-[var(--muted)]">
                          Downloading {dlProgress.modelSize}: {Math.round(dlProgress.progress * 100)}%
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--muted)]">Deepgram API Key</span>
                      <input
                        type="password"
                        value={draft.deepgramApiKey}
                        onChange={(e) => updateField('deepgramApiKey', e.target.value)}
                        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await window.api.transcription.testDeepgramKey(draft.deepgramApiKey)
                        setTestMsg(res.valid ? 'Deepgram key verified.' : res.error || 'Invalid key')
                      }}
                      className="rounded-lg border px-3 py-1.5 text-xs"
                    >
                      Test Deepgram Key
                    </button>
                    {testMsg && <p className="text-xs text-[var(--muted)]">{testMsg}</p>}
                  </div>
                )}
              </>
            )}

            {tab === 'ai' && (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">AI Provider</span>
                  <select
                    value={draft.aiProvider}
                    onChange={(e) =>
                      updateField('aiProvider', e.target.value as AppSettings['aiProvider'])
                    }
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="openai-compatible">OpenAI-Compatible (OpenAI / OpenRouter / Groq / Ollama)</option>
                    <option value="manus">Manus Web Session</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">Base URL</span>
                  <input
                    value={draft.openaiBaseUrl}
                    onChange={(e) => updateField('openaiBaseUrl', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">API Key</span>
                  <input
                    type="password"
                    value={draft.openaiApiKey}
                    onChange={(e) => updateField('openaiApiKey', e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">Model</span>
                  <input
                    value={draft.openaiModel}
                    onChange={(e) => updateField('openaiModel', e.target.value)}
                    placeholder="gpt-4.1-mini"
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await window.openaiCompatible.testConnection(
                      draft.openaiBaseUrl,
                      draft.openaiApiKey,
                      draft.openaiModel,
                    )
                    setTestMsg(res.valid ? 'AI connection verified.' : res.error || 'Failed')
                  }}
                  className="rounded-lg border px-3 py-1.5 text-xs"
                >
                  Test Connection
                </button>
                {testMsg && <p className="text-xs text-[var(--muted)]">{testMsg}</p>}
              </div>
            )}

            {tab === 'prompts' && (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">Discovery Prompt Override</span>
                  <textarea
                    rows={5}
                    value={draft.discoveryPromptOverride}
                    onChange={(e) => updateField('discoveryPromptOverride', e.target.value)}
                    placeholder="Leave blank to use default viral discovery prompt"
                    className="w-full rounded-lg border bg-transparent p-2.5 text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--muted)]">Skeptical Review Prompt Override</span>
                  <textarea
                    rows={5}
                    value={draft.reviewPromptOverride}
                    onChange={(e) => updateField('reviewPromptOverride', e.target.value)}
                    placeholder="Leave blank to use default 5-dimension review prompt"
                    className="w-full rounded-lg border bg-transparent p-2.5 text-xs"
                  />
                </label>
              </div>
            )}

            {tab === 'fonts' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await window.customFonts.pickAndInstall()
                      setFonts(await window.customFonts.list())
                    }}
                    className="rounded-lg border px-3 py-1.5 text-xs"
                  >
                    + Install Font (.ttf / .otf / .woff2)
                  </button>
                  <button
                    type="button"
                    onClick={() => void window.customFonts.openFolder()}
                    className="rounded-lg border px-3 py-1.5 text-xs"
                  >
                    Open Fonts Folder
                  </button>
                </div>
                {fonts.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">No custom fonts installed yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {fonts.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                      >
                        <span>
                          {f.family} ({f.fileName})
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await window.customFonts.delete(f.id)
                            setFonts(await window.customFonts.list())
                          }}
                          className="text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'system' && (
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="font-semibold">Linux Hardware Diagnostics</div>
                  <div>CPU: {specs?.cpuModel} ({specs?.cpuCores} cores)</div>
                  <div>RAM: {specs?.totalMemoryGb} GB</div>
                  <div>Vulkan Available: {specs?.vulkanAvailable ? 'Yes' : 'No'}</div>
                  <div>VAAPI Hardware Encode: {specs?.vaapiAvailable ? 'Yes' : 'No'}</div>
                  <div>Recommended Whisper Backend: {specs?.recommendedWhisperBackend}</div>
                  <div>
                    GPUs: {specs?.gpus.length ? specs.gpus.map((g) => g.name).join(', ') : 'None detected'}
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="font-semibold">Updates (v{updateState?.currentVersion ?? '1.0.0'})</div>
                  <div className="text-[var(--muted)]">Status: {updateState?.status ?? 'idle'}</div>
                  <button
                    type="button"
                    onClick={() => void window.api.updater.check()}
                    className="rounded-lg border px-3 py-1.5"
                  >
                    Check for Updates
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t p-3">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-1.5 text-xs">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-[var(--accent-foreground)]"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
