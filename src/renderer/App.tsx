import { useEffect, useState } from 'react'
import { BRANDING } from '#/config/branding'
import type { Announcement, AppSettings, ProjectRecord } from '#/shared/types'
import { Sidebar, type NavRoute } from '#/renderer/components/Sidebar'
import { Titlebar } from '#/renderer/components/Titlebar'
import { SettingsDialog } from '#/renderer/components/SettingsDialog'
import { VideoEditor } from '#/renderer/components/VideoEditor'

const FALLBACK_SETTINGS: AppSettings = {
  theme: 'dark',
  onboardingCompleted: true,
  exportDir: '',
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

function applyThemeClass(theme: AppSettings['theme']) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.classList.toggle('light', !isDark)
}

export function App() {
  const [route, setRoute] = useState<NavRoute>('projects')
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const [loadedSettings, loadedProjects, loadedAnnouncements] = await Promise.all([
        window.settings?.read(),
        window.projects?.readAll(),
        window.api?.announcements.list(),
      ])
      if (loadedSettings) {
        setSettings(loadedSettings)
        applyThemeClass(loadedSettings.theme)
      }
      if (loadedProjects) setProjects(loadedProjects)
      if (loadedAnnouncements) setAnnouncements(loadedAnnouncements)

      // Fade out inline HTML splash
      const splash = document.getElementById('splash')
      if (splash) {
        splash.classList.add('is-hiding')
        setTimeout(() => splash.remove(), 220)
      }
    })()
  }, [])

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null

  const saveSettings = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    applyThemeClass(next.theme)
    localStorage.setItem(`${BRANDING.storagePrefix}settings`, JSON.stringify({ theme: next.theme }))
    await window.settings?.write(patch)
  }

  const upsertProject = async (next: ProjectRecord) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === next.id)
      return exists ? prev.map((p) => (p.id === next.id ? next : p)) : [next, ...prev]
    })
    await window.projects?.write(next.id, next)
  }

  const handleVideoFile = async (file: File) => {
    const filePath = window.files.pathForFile(file)
    if (!filePath) return
    const now = new Date().toISOString()
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^.]+$/, ''),
      videoPath: filePath,
      duration: 0,
      width: 1920,
      height: 1080,
      createdAt: now,
      updatedAt: now,
      cues: [],
      clips: [],
      presetId: 'mumbai',
      layoutMode: 'track',
      keyframes: [],
    }
    await upsertProject(project)
    setActiveProjectId(project.id)
    setRoute('editor')
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <Titlebar title={route === 'editor' ? activeProject?.title : undefined} />

      <div className="flex flex-1 overflow-hidden">
        {route !== 'editor' && (
          <Sidebar
            activeRoute={route}
            onNavigate={setRoute}
            onOpenSettings={() => setSettingsOpen(true)}
            announcementsCount={announcements.length}
            onOpenAnnouncements={() => setAnnouncementsOpen(true)}
          />
        )}

        <main className="flex-1 overflow-y-auto">
          {route === 'projects' && (
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h1 className="text-lg font-semibold">Projects</h1>
                <button
                  type="button"
                  onClick={() => setRoute('new-project')}
                  className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-medium text-[var(--accent-foreground)]"
                >
                  + New Project
                </button>
              </div>
              {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-sm text-[var(--muted)]">
                  No projects yet. Click &ldquo;+ New Project&rdquo; to import a video and start clipping.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setActiveProjectId(p.id)
                        setRoute('editor')
                      }}
                      className="cursor-pointer rounded-xl border p-4 transition hover:border-blue-500"
                      style={{ background: 'var(--surface)' }}
                    >
                      <div className="truncate font-medium">{p.title}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {p.clips.length} clips &middot; {p.cues.length} captions
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {route === 'viral-clips' && (
            <div className="p-6 space-y-4">
              <h1 className="text-lg font-semibold">Viral Clips</h1>
              <p className="text-sm text-[var(--muted)]">
                Open any project to run two-pass AI viral clip detection, boundary alignment, and
                5-metric scoring.
              </p>
              <div className="space-y-2">
                {projects.flatMap((p) =>
                  p.clips.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveProjectId(p.id)
                        setRoute('editor')
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-xl border p-3.5 text-sm hover:border-blue-500"
                    >
                      <div>
                        <div className="font-medium">{c.title}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {p.title} &middot; {c.start.toFixed(1)}s–{c.end.toFixed(1)}s
                        </div>
                      </div>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                        Score {c.score}
                      </span>
                    </div>
                  )),
                )}
              </div>
            </div>
          )}

          {route === 'new-project' && (
            <div className="flex h-full items-center justify-center p-8">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file) void handleVideoFile(file)
                }}
                className="flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center hover:border-blue-500"
              >
                <div className="text-base font-semibold">Drop a video file here</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  MP4, MKV, MOV, or WebM — click to browse on Linux
                </div>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleVideoFile(file)
                  }}
                />
              </label>
            </div>
          )}

          {route === 'editor' && activeProject && (
            <VideoEditor
              project={activeProject}
              settings={settings}
              onChange={(next) => void upsertProject(next)}
              onBack={() => setRoute('projects')}
            />
          )}
        </main>
      </div>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />

      {announcementsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-xl border p-5 space-y-3"
            style={{ background: 'var(--background)' }}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>{BRANDING.publisher} Announcements</span>
              <button type="button" onClick={() => setAnnouncementsOpen(false)}>
                &#10005;
              </button>
            </div>
            {announcements.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 text-xs space-y-1">
                <div className="font-medium">{a.title}</div>
                <p className="text-[var(--muted)]">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
