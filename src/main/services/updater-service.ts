import { app, BrowserWindow, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { BRANDING, isConfiguredUrl } from '#/config/branding'
import type { UpdateState } from '#/shared/types'

let state: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
}

function broadcast(next: UpdateState): UpdateState {
  state = next
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:state', state)
  }
  return state
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

function selectLinuxAsset(
  assets: Array<{ name: string; browser_download_url: string }>,
): string | undefined {
  const isAppImage = Boolean(process.env.APPIMAGE)
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64|amd64|x64'
  const archRe = new RegExp(arch, 'i')

  if (isAppImage) {
    const ai = assets.find((a) => /\.AppImage$/i.test(a.name) && archRe.test(a.name))
    if (ai) return ai.browser_download_url
  }

  const preferred = [
    (a: { name: string }) => /\.AppImage$/i.test(a.name),
    (a: { name: string }) => /\.deb$/i.test(a.name),
    (a: { name: string }) => /\.rpm$/i.test(a.name),
  ]

  for (const match of preferred) {
    const found = assets.find((a) => match(a) && archRe.test(a.name)) || assets.find(match)
    if (found) return found.browser_download_url
  }
  return undefined
}

export function getUpdaterState(): UpdateState {
  return state
}

export function getCurrentVersion(): string {
  return app.getVersion()
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!isConfiguredUrl(BRANDING.githubReleasesApiUrl)) {
    return broadcast({
      status: 'idle',
      currentVersion: app.getVersion(),
    })
  }

  broadcast({ ...state, status: 'checking', error: undefined })

  try {
    const res = await fetch(BRANDING.githubReleasesApiUrl, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'RzaClipper-Linux' },
    })
    if (!res.ok) throw new Error(`Release check failed (${res.status})`)

    const data = (await res.json()) as {
      tag_name?: string
      body?: string
      html_url?: string
      assets?: Array<{ name: string; browser_download_url: string }>
    }

    const latestVersion = (data.tag_name || '').replace(/^v/, '')
    if (!latestVersion || compareSemver(latestVersion, app.getVersion()) <= 0) {
      return broadcast({
        status: 'up-to-date',
        currentVersion: app.getVersion(),
        latestVersion: latestVersion || app.getVersion(),
      })
    }

    const assetUrl = selectLinuxAsset(data.assets ?? []) ?? data.html_url
    return broadcast({
      status: 'available',
      currentVersion: app.getVersion(),
      latestVersion,
      releaseNotes: data.body || '',
      downloadUrl: assetUrl,
    })
  } catch (err) {
    return broadcast({
      status: 'error',
      currentVersion: app.getVersion(),
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (!state.downloadUrl) return state
  if (!state.downloadUrl.endsWith('.AppImage')) {
    await shell.openExternal(state.downloadUrl)
    return state
  }

  broadcast({ ...state, status: 'downloading', progress: 0 })
  try {
    const res = await fetch(state.downloadUrl)
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)

    const total = Number(res.headers.get('content-length') || 0)
    const dest = path.join(app.getPath('temp'), `RzaClipper-${state.latestVersion}.AppImage`)
    const out = fs.createWriteStream(dest)
    const reader = res.body.getReader()
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      out.write(value)
      loaded += value.byteLength
      if (total > 0) {
        broadcast({ ...state, status: 'downloading', progress: loaded / total })
      }
    }
    await new Promise<void>((resolve, reject) => {
      out.on('finish', resolve)
      out.on('error', reject)
      out.end()
    })
    await fs.promises.chmod(dest, 0o755)

    return broadcast({
      ...state,
      status: 'ready',
      progress: 1,
      downloadedPath: dest,
    })
  } catch (err) {
    return broadcast({
      ...state,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function installUpdate(): Promise<boolean> {
  const currentAppImage = process.env.APPIMAGE
  if (currentAppImage && state.downloadedPath && fs.existsSync(state.downloadedPath)) {
    const backup = `${currentAppImage}.old`
    await fs.promises.rename(currentAppImage, backup)
    await fs.promises.copyFile(state.downloadedPath, currentAppImage)
    await fs.promises.chmod(currentAppImage, 0o755)
    app.relaunch({ execPath: currentAppImage })
    app.exit(0)
    return true
  }
  if (state.downloadUrl) {
    await shell.openExternal(state.downloadUrl)
    return true
  }
  return false
}
