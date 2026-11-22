#!/usr/bin/env node
/**
 * Packages Electron Forge's Linux output directory into a portable .AppImage.
 * Requires `appimagetool` in PATH (download from https://github.com/AppImage/appimagetool/releases).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')
const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
const appImageArch = arch === 'arm64' ? 'aarch64' : 'x86_64'
const packagedDir = path.join(rootDir, 'out', `Rza Clipper-linux-${arch}`)
const appDir = path.join(rootDir, 'out', 'RzaClipper.AppDir')
const outFile = path.join(rootDir, 'out', `Rza-Clipper-linux-${appImageArch}.AppImage`)

if (!fs.existsSync(packagedDir)) {
  console.error(`Packaged directory not found: ${packagedDir}\nRun "npm run package" first.`)
  process.exit(1)
}

fs.rmSync(appDir, { recursive: true, force: true })
fs.mkdirSync(path.join(appDir, 'usr', 'bin'), { recursive: true })
fs.cpSync(packagedDir, path.join(appDir, 'usr', 'lib', 'rza-clipper'), { recursive: true })

const appRun = `#!/bin/sh
SELF=$(readlink -f "$0")
HERE=\${SELF%/*}
exec "$HERE/usr/lib/rza-clipper/rza-clipper" "$@"
`
fs.writeFileSync(path.join(appDir, 'AppRun'), appRun, { mode: 0o755 })

const desktopEntry = `[Desktop Entry]
Name=Rza Clipper
Comment=Turn long videos into viral short clips with automatic captions and 9:16 vertical reframing
Exec=rza-clipper %U
Icon=rza-clipper
Type=Application
Categories=AudioVideo;Video;AudioVideoEditing;
MimeType=video/mp4;video/x-matroska;video/webm;video/quicktime;
StartupWMClass=Rza Clipper
`
fs.writeFileSync(path.join(appDir, 'rza-clipper.desktop'), desktopEntry, 'utf-8')

const iconSrc = path.join(rootDir, 'assets', 'icon.png')
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(appDir, 'rza-clipper.png'))
}

execFileSync('appimagetool', [appDir, outFile], {
  stdio: 'inherit',
  env: { ...process.env, ARCH: appImageArch },
})

console.log(`\nCreated AppImage -> ${outFile}`)
