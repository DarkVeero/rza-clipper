import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, Cue, ProjectRecord, SpeakerLayoutMode } from '#/shared/types'
import { BUILTIN_CAPTION_PRESETS } from '#/renderer/data/caption-presets'
import { exportVerticalClip } from '#/renderer/services/exporter'

function toMediaUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/')
  return `media://local${encoded.startsWith('/') ? '' : '/'}${encoded}`
}

interface VideoEditorProps {
  project: ProjectRecord
  settings: AppSettings
  onChange: (next: ProjectRecord) => void
  onBack: () => void
}

export function VideoEditor({ project, settings, onChange, onBack }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [exportPct, setExportPct] = useState<number | null>(null)

  const activePreset = useMemo(
    () => BUILTIN_CAPTION_PRESETS.find((p) => p.id === project.presetId) ?? BUILTIN_CAPTION_PRESETS[0],
    [project.presetId],
  )

  const activeClip = useMemo(
    () => project.clips.find((c) => c.id === project.activeClipId) ?? null,
    [project.clips, project.activeClipId],
  )

  const currentCue = useMemo(
    () => project.cues.find((c) => currentTime >= c.start && currentTime <= c.end),
    [project.cues, currentTime],
  )

  useEffect(() => {
    void window.windowControls?.enterProject()
    return () => {
      void window.windowControls?.leaveProject()
    }
  }, [])

  const handleTranscribe = async () => {
    setBusyLabel('Transcribing audio…')
    try {
      if (settings.transcriptionEngine === 'deepgram') {
        const res = await window.api.transcription.transcribeDeepgram({
          filePath: project.videoPath,
          duration: project.duration,
          apiKey: settings.deepgramApiKey,
          model: settings.deepgramModel,
        })
        onChange({ ...project, cues: res.cues })
      } else {
        const res = await window.api.transcription.start({
          filePath: project.videoPath,
          request: {
            modelSize: settings.whisperModel,
            acceleration: settings.whisperAcceleration,
          },
        })
        if (res) {
          const cues: Cue[] = res.chunks.map((ch, idx) => ({
            id: `cue-${idx}`,
            start: ch.timestamp[0],
            end: ch.timestamp[1],
            text: ch.text,
            words: ch.words,
            speaker: ch.speaker,
          }))
          onChange({ ...project, cues })
        }
      }
    } finally {
      setBusyLabel(null)
    }
  }

  const handleFindViralClips = async () => {
    if (project.cues.length === 0) return
    setBusyLabel('Finding viral clips with AI…')
    try {
      const clips = await window.api.viralClips.detect({
        cues: project.cues,
        duration: project.duration || 300,
        clipLength: settings.defaultClipLength,
        clipsCount: settings.defaultClipsCount,
        prompts:
          settings.discoveryPromptOverride || settings.reviewPromptOverride
            ? {
                discovery: settings.discoveryPromptOverride,
                review: settings.reviewPromptOverride,
              }
            : undefined,
      })
      onChange({ ...project, clips, activeClipId: clips[0]?.id ?? null })
    } finally {
      setBusyLabel(null)
    }
  }

  const handleTrackFaces = async () => {
    setBusyLabel('Tracking faces for 9:16 reframing…')
    try {
      const keyframes = await window.api.faceTracking.trackFaces({
        filePath: project.videoPath,
        start: activeClip?.start,
        end: activeClip?.end,
        layoutPreference: project.layoutMode,
        cues: project.cues,
      })
      onChange({ ...project, keyframes })
    } finally {
      setBusyLabel(null)
    }
  }

  const handleExport = async () => {
    const dir = await window.files.getExportDir(project.title, settings.exportDir)
    const slug = (activeClip?.title || project.title).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48)
    const outPath = await window.files.chooseSavePath({
      defaultDir: dir,
      defaultName: `${slug}.mp4`,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    })
    if (!outPath) return

    setExportPct(0)
    try {
      const saved = await exportVerticalClip({
        videoUrl: toMediaUrl(project.videoPath),
        outputPath: outPath,
        start: activeClip?.start ?? 0,
        end: activeClip?.end ?? Math.min(project.duration || 60, 60),
        cues: project.cues,
        keyframes: project.keyframes,
        preset: activePreset,
        onProgress: setExportPct,
      })
      if (saved) {
        await window.files.reveal(saved.filePath)
      }
    } finally {
      setExportPct(null)
    }
  }

  const layouts: SpeakerLayoutMode[] = ['track', 'split', 'three', 'four', 'general']

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border px-2.5 py-1 text-xs">
            &larr; Projects
          </button>
          <input
            value={project.title}
            onChange={(e) => onChange({ ...project, title: e.target.value })}
            className="bg-transparent text-sm font-semibold outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={Boolean(busyLabel)}
            onClick={() => void handleTranscribe()}
            className="rounded-lg border px-3 py-1.5 text-xs"
          >
            Transcribe
          </button>
          <button
            type="button"
            disabled={Boolean(busyLabel) || project.cues.length === 0}
            onClick={() => void handleFindViralClips()}
            className="rounded-lg border px-3 py-1.5 text-xs"
          >
            Find Viral Clips
          </button>
          <button
            type="button"
            disabled={Boolean(busyLabel)}
            onClick={() => void handleTrackFaces()}
            className="rounded-lg border px-3 py-1.5 text-xs"
          >
            Track Faces (9:16)
          </button>
          <button
            type="button"
            disabled={exportPct !== null}
            onClick={() => void handleExport()}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-[var(--accent-foreground)]"
          >
            {exportPct !== null ? `Exporting ${Math.round(exportPct * 100)}%` : 'Export 9:16 MP4'}
          </button>
        </div>
      </div>

      {busyLabel && (
        <div className="border-b bg-blue-500/10 px-4 py-1.5 text-xs text-blue-400">{busyLabel}</div>
      )}

      <div className="grid flex-1 grid-cols-12 overflow-hidden">
        {/* Left: Clips & Transcript Cues */}
        <section className="col-span-4 flex flex-col border-r overflow-hidden">
          <div className="border-b p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              Viral Clips ({project.clips.length})
            </div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {project.clips.map((clip) => (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => {
                    onChange({ ...project, activeClipId: clip.id })
                    if (videoRef.current) videoRef.current.currentTime = clip.start
                  }}
                  className={`w-full rounded-lg border p-2 text-left text-xs ${
                    clip.id === project.activeClipId ? 'border-blue-500 bg-blue-500/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="truncate">{clip.title}</span>
                    <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      {clip.score}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--muted)]">
                    {clip.start.toFixed(1)}s – {clip.end.toFixed(1)}s ({clip.tier})
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">
              Captions ({project.cues.length})
            </div>
            {project.cues.map((cue, idx) => (
              <div key={cue.id} className="rounded-lg border p-2 text-xs">
                <div className="mb-1 text-[10px] text-[var(--muted)]">
                  {cue.start.toFixed(2)}s – {cue.end.toFixed(2)}s
                </div>
                <input
                  value={cue.text}
                  onChange={(e) => {
                    const nextCues = [...project.cues]
                    nextCues[idx] = { ...cue, text: e.target.value }
                    onChange({ ...project, cues: nextCues })
                  }}
                  className="w-full bg-transparent text-xs outline-none"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Center: 9:16 Vertical Preview */}
        <section className="col-span-4 flex flex-col items-center justify-center bg-black/20 p-4">
          <div className="relative aspect-[9/16] h-full max-h-[580px] overflow-hidden rounded-xl border bg-black shadow-lg">
            <video
              ref={videoRef}
              src={toMediaUrl(project.videoPath)}
              controls
              onLoadedMetadata={(e) => {
                const v = e.currentTarget
                if (project.duration !== v.duration) {
                  onChange({
                    ...project,
                    duration: v.duration,
                    width: v.videoWidth,
                    height: v.videoHeight,
                  })
                }
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              className="h-full w-full object-cover"
            />
            {currentCue && (
              <div
                className="pointer-events-none absolute inset-x-4 text-center font-bold"
                style={{
                  top: `${Math.round(activePreset.positionY * 100)}%`,
                  color: activePreset.textColor,
                  background: activePreset.backgroundColor,
                  fontFamily: activePreset.fontFamily,
                  textTransform: activePreset.uppercase ? 'uppercase' : 'none',
                  padding: activePreset.backgroundColor ? '4px 10px' : undefined,
                  borderRadius: '8px',
                  textShadow: activePreset.shadow ?? '0 2px 8px rgba(0,0,0,0.9)',
                }}
              >
                {currentCue.text}
              </div>
            )}
          </div>
        </section>

        {/* Right: 18 Caption Presets & Speaker Layout */}
        <section className="col-span-4 flex flex-col border-l overflow-y-auto p-4 space-y-5">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              9:16 Reframing Layout
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {layouts.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...project, layoutMode: mode })}
                  className={`rounded-lg border py-1.5 text-xs capitalize ${
                    project.layoutMode === mode
                      ? 'bg-[var(--accent)] font-medium text-[var(--accent-foreground)]'
                      : ''
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              Caption Presets (18)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BUILTIN_CAPTION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange({ ...project, presetId: preset.id })}
                  className={`rounded-lg border p-2.5 text-left text-xs transition ${
                    project.presetId === preset.id ? 'border-blue-500 bg-blue-500/10' : ''
                  }`}
                >
                  <div className="font-semibold">{preset.name}</div>
                  <div className="text-[10px] text-[var(--muted)]">
                    {preset.fontFamily} &middot; {preset.animation}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
