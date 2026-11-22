import { BRANDING } from '#/config/branding'

export type NavRoute = 'projects' | 'viral-clips' | 'new-project' | 'editor'

interface SidebarProps {
  activeRoute: NavRoute
  onNavigate: (route: NavRoute) => void
  onOpenSettings: () => void
  announcementsCount: number
  onOpenAnnouncements: () => void
}

export function Sidebar({
  activeRoute,
  onNavigate,
  onOpenSettings,
  announcementsCount,
  onOpenAnnouncements,
}: SidebarProps) {
  const navBtn = (route: NavRoute, label: string) => {
    const active = activeRoute === route
    return (
      <button
        type="button"
        onClick={() => onNavigate(route)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
          active
            ? 'bg-[var(--accent)] font-medium text-[var(--accent-foreground)]'
            : 'hover:bg-black/5 dark:hover:bg-white/5'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <aside
      className="flex w-56 shrink-0 flex-col justify-between border-r p-3"
      style={{ background: 'var(--surface)' }}
    >
      <div className="space-y-1">
        <div className="mb-3 px-2 pt-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {BRANDING.appName}
        </div>
        {navBtn('projects', 'Projects')}
        {navBtn('viral-clips', 'Viral Clips')}
        {navBtn('new-project', '+ New Project')}
      </div>

      <div className="space-y-2 border-t pt-3">
        {announcementsCount > 0 && (
          <button
            type="button"
            onClick={onOpenAnnouncements}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span>Updates</span>
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {announcementsCount}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Settings
        </button>

        {/* Community/Join area: STRICTLY ONLY the Rza Official WhatsApp Channel URL and nothing else */}
        <a
          href={BRANDING.communityUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all px-3 py-1.5 text-xs underline opacity-80 hover:opacity-100"
        >
          {BRANDING.communityUrl}
        </a>
      </div>
    </aside>
  )
}
