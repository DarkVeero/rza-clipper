import { app, BrowserWindow, safeStorage, session } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { BRANDING } from '#/config/branding'
import type { ManusAccountProfile, ManusAccountStatus } from '#/shared/types'

let expiredDismissed = false

function tokenFilePath(): string {
  return path.join(app.getPath('userData'), 'manus-session-token.bin')
}

function readStoredToken(): string | null {
  const file = tokenFilePath()
  if (!fs.existsSync(file)) return null
  try {
    const buf = fs.readFileSync(file)
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
    return buf.toString('utf-8')
  } catch {
    return null
  }
}

function writeStoredToken(token: string): void {
  const file = tokenFilePath()
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, 'utf-8')
  fs.writeFileSync(file, payload)
}

export async function getManusProfile(): Promise<ManusAccountProfile | null> {
  const token = readStoredToken()
  if (!token) return null

  try {
    const res = await fetch(BRANDING.manusUserInfoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      email?: string
      name?: string
      avatar?: string
      credits?: number
    }
    return {
      email: data.email,
      name: data.name,
      avatarUrl: data.avatar,
      credits: typeof data.credits === 'number' ? data.credits : null,
    }
  } catch {
    return null
  }
}

export async function getManusStatus(): Promise<ManusAccountStatus> {
  const token = readStoredToken()
  if (!token) return { connected: false }
  const profile = await getManusProfile()
  if (!profile) {
    return { connected: false, expired: !expiredDismissed }
  }
  return {
    connected: true,
    email: profile.email,
    credits: profile.credits,
  }
}

export async function connectManusAccount(): Promise<void> {
  expiredDismissed = false
  const ses = session.fromPartition(BRANDING.manusSessionPartition)

  await new Promise<void>((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 700,
      title: `Sign in to Manus — ${BRANDING.appName}`,
      autoHideMenuBar: true,
      webPreferences: {
        partition: BRANDING.manusSessionPartition,
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    const captureToken = async () => {
      try {
        const cookies = await ses.cookies.get({ domain: 'manus.im' })
        const authCookie = cookies.find((c) => /token|session|auth/i.test(c.name) && c.value.length > 20)
        if (authCookie) {
          writeStoredToken(authCookie.value)
          win.close()
        }
      } catch {
        // Ignore transient cookie errors
      }
    }

    win.webContents.on('did-navigate', (_e, url) => {
      if (url.startsWith(BRANDING.manusAppUrl)) {
        void captureToken()
      }
    })
    win.on('closed', () => resolve())
    void win.loadURL(BRANDING.manusLoginUrl)
  })
}

export async function signOutManusAccount(): Promise<void> {
  try {
    await fs.promises.unlink(tokenFilePath())
  } catch {
    // Ignore
  }
  const ses = session.fromPartition(BRANDING.manusSessionPartition)
  await ses.clearStorageData()
}

export async function dismissManusExpired(): Promise<void> {
  expiredDismissed = true
}
