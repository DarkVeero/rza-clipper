import { BRANDING, isConfiguredUrl } from '#/config/branding'
import type { Announcement } from '#/shared/types'

/**
 * Fetches Rza Official announcements when BRANDING.announcementsApiUrl is configured.
 * Returns an empty list gracefully when still set to placeholder.
 */
export async function listAnnouncements(): Promise<Announcement[]> {
  if (!isConfiguredUrl(BRANDING.announcementsApiUrl)) {
    return []
  }

  try {
    const res = await fetch(BRANDING.announcementsApiUrl, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const items = (await res.json()) as Announcement[]
    if (!Array.isArray(items)) return []

    return items.map((item) => ({
      ...item,
      imageUrl:
        item.imageUrl &&
        isConfiguredUrl(BRANDING.announcementsImagePrefix) &&
        item.imageUrl.startsWith(BRANDING.announcementsImagePrefix)
          ? item.imageUrl
          : undefined,
    }))
  } catch {
    return []
  }
}
