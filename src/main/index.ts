import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { BRANDING } from '#/config/branding'
import {
  registerMediaProtocolHandler,
  registerMediaProtocolPrivileges,
} from '#/main/media-protocol'
import { registerIpcHandlers } from '#/main/ipc/register'
import { checkForUpdates } from '#/main/services/updater-service'

// Register media:// before app ready
registerMediaProtocolPrivileges()

// Enable Linux hardware video acceleration (VAAPI) & Wayland/X11 auto-ozone
if (process.platform === 'linux') {
  app.commandLine.appendSwitch(
    'enable-features',
    'VaapiVideoEncoder,VaapiVideoDecoder,VaapiVideoDecodeLinuxGL',
  )
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
}

let mainWindow: BrowserWindow | null = null

function createMainWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.resolve(process.cwd(), 'assets', 'icon.png')

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: BRANDING.appName,
    icon: iconPath,
    frame: false, // Custom Linux-compatible titlebar rendered in renderer
    backgroundColor: '#18181b',
    show: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.on('maximize', () => win.webContents.send('window:maximized-change', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized-change', false))

  // Open external links (including the Rza Official WhatsApp channel) in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Vite Forge dev server URL vs packaged file
  const devUrl = process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(
      path.join(import.meta.dirname, '../renderer/main_window/index.html'),
    )
  }

  return win
}

app.setName(BRANDING.appName)

app.whenReady().then(() => {
  registerMediaProtocolHandler()
  registerIpcHandlers(() => mainWindow)
  mainWindow = createMainWindow()

  // Delayed update check (4s after launch) — stays idle if placeholder URL is untouched
  setTimeout(() => {
    void checkForUpdates()
  }, 4000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
