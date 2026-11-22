/**
 * Centralized branding and external endpoint configuration for Rza Clipper.
 *
 * PLACEHOLDER NOTICE:
 * Replace any value prefixed with "[PLACEHOLDER" below once you have your
 * Rza Official URLs and assets ready. Services bound to placeholder URLs
 * degrade cleanly (e.g., updater stays idle, announcements stay hidden)
 * rather than throwing errors.
 */
export const BRANDING = {
  appName: 'Rza Clipper',
  publisher: 'Rza Official',
  bundleId: 'com.rzaclipper.app',
  exportFolderName: 'RzaClipper',
  tempFilePrefix: '.rzaclipper-',
  storagePrefix: 'rzaclipper:',
  manusSessionPartition: 'persist:rzaclipper-manus',

  /**
   * Community / Join area:
   * Strictly ONLY this URL is displayed in the community/join area —
   * no extra text, buttons, or sections.
   */
  communityUrl: 'https://whatsapp.com/channel/0029VbASCFE4tRs0xSB7E61B',

  /**
   * [PLACEHOLDER: GITHUB_RELEASES_API]
   * Replace with your GitHub repo releases endpoint, e.g.:
   * 'https://api.github.com/repos/RzaOfficial/rza-clipper/releases/latest'
   * Leave as placeholder to disable auto-update polling.
   */
  githubReleasesApiUrl: 'https://api.github.com/repos/DarkVeero/rza-clipper/releases/latest',
  githubReleasesPageUrl: 'https://github.com/DarkVeero/rza-clipper/releases',

  /**
   * [PLACEHOLDER: ANNOUNCEMENTS_API]
   * Replace with your announcements JSON endpoint, e.g.:
   * 'https://rzaofficial.example/api/announcements?product=rza-clipper'
   * Leave as placeholder to hide the announcements bell.
   */
  announcementsApiUrl: '[PLACEHOLDER_ANNOUNCEMENTS_API_URL]',
  announcementsImagePrefix: '[PLACEHOLDER_ANNOUNCEMENTS_IMAGE_PREFIX]',

  /**
   * [PLACEHOLDER: AI_PROVIDER_DEFAULT]
   * Options: 'openai-compatible' | 'manus'
   * Defaulting to 'openai-compatible' so Linux users can plug in any OpenAI,
   * OpenRouter, Groq, DeepSeek, or local Ollama endpoint immediately.
   * Manus web-session support is also wired (using plain https://manus.im/
   * unless you insert your own referral URL below).
   */
  defaultAiProvider: 'openai-compatible' as 'openai-compatible' | 'manus',
  manusLoginUrl: 'https://manus.im/',
  manusAppUrl: 'https://manus.im/app',
  manusUserInfoUrl: 'https://api.manus.im/user.v1.UserService/UserInfo',
} as const

export function isConfiguredUrl(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.startsWith('https://') &&
    !value.includes('[PLACEHOLDER')
  )
}
