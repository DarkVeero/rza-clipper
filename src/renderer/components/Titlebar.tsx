import { useEffect, useState } from 'react'
import { BRANDING } from '#/config/branding'

/**
 * Custom frameless titlebar.
 * Linux fix: renders minimize / maximize / close controls on BOTH 'linux' and
 * 'win32' (the original only checked platform === 'win32').
 */
export function Titlebar({ title }: { title?: string }) {
  const [maximized, setMaximized] = useState(false)
  const platform = window.windowControls?.platform ?? 'linux'
  const showWindowButtons = platform === 'linux' || platform === 'win32'

  useEffect(() => {
    void window.windowControls?.isMaximized().then(setMaximized)
    return window.windowControls?.onMaximizedChange(setMaximized)
  }, [])

  return (
    <header
      className="app-drag-region flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs"
      style={{ background: 'var(--surface)' }}
      onDoubleClick={() => void window.windowControls?.toggleMaximize()}
    >
      <div className="flex items-center gap-2 font-medium tracking-tight">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--accent)] text-[10px] font-bold text-[var(--accent-foreground)]">
          RC
        </span>
        <span>{title ? `${title} — ${BRANDING.appName}` : BRANDING.appName}</span>
      </div>

      {showWindowButtons && (
        <div className="app-no-drag flex items-center gap-1">
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => void window.windowControls?.minimize()}
            className="flex h-7 w-8 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
          >
            &#8722;
          </button>
          <button
            type="button"
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => void window.windowControls?.toggleMaximize()}
            className="flex h-7 w-8 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
          >
            {maximized ? '❐' : '□'}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={() => void window.windowControls?.close()}
            className="flex h-7 w-8 items-center justify-center rounded hover:bg-red-600 hover:text-white"
          >
            &#10005;
          </button>
        </div>
      )}
    </header>
  )
}
