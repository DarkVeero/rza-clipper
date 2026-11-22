#!/usr/bin/env node
/**
 * Builds whisper.cpp v1.9.2 from upstream source on Linux with Vulkan GPU
 * acceleration (-DGGML_VULKAN=1) or CPU-only fallback (--cpu-only), then writes
 * a SHA-256 verified BUILD.json manifest into assets/bin/linux-<arch>[-vulkan].
 *
 * Prerequisites (Ubuntu/Debian):
 *   sudo apt install -y build-essential cmake ninja-build git libvulkan-dev glslc vulkan-tools
 * Prerequisites (Fedora):
 *   sudo dnf install -y gcc-c++ cmake ninja-build git vulkan-loader-devel glslc vulkan-tools
 * Prerequisites (Arch):
 *   sudo pacman -S --needed base-devel cmake ninja git vulkan-headers vulkan-icd-loader shaderc
 */
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const WHISPER_TAG = 'v1.9.2'
const WHISPER_REPO = 'https://github.com/ggml-org/whisper.cpp.git'
const cpuOnly = process.argv.includes('--cpu-only')
const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
const variant = cpuOnly ? `linux-${arch}` : `linux-${arch}-vulkan`

const rootDir = path.resolve(import.meta.dirname, '..')
const workDir = path.join(rootDir, '.build-cache', 'whisper.cpp')
const buildDir = path.join(workDir, `build-${variant}`)
const outDir = path.join(rootDir, 'assets', 'bin', variant)

function run(cmd, args, cwd = rootDir) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

fs.mkdirSync(path.dirname(workDir), { recursive: true })

if (!fs.existsSync(workDir)) {
  run('git', ['clone', '--depth', '1', '--branch', WHISPER_TAG, WHISPER_REPO, workDir])
} else {
  run('git', ['fetch', '--depth', '1', 'origin', 'tag', WHISPER_TAG], workDir)
  run('git', ['checkout', WHISPER_TAG], workDir)
}

const cmakeArgs = [
  '-B',
  buildDir,
  '-G',
  'Ninja',
  '-DCMAKE_BUILD_TYPE=Release',
  '-DBUILD_SHARED_LIBS=ON',
  '-DWHISPER_BUILD_TESTS=OFF',
  '-DWHISPER_BUILD_EXAMPLES=ON',
  `-DGGML_VULKAN=${cpuOnly ? 'OFF' : 'ON'}`,
  '-DCMAKE_INSTALL_RPATH=$ORIGIN',
  '-DCMAKE_BUILD_WITH_INSTALL_RPATH=ON',
]

run('cmake', cmakeArgs, workDir)
run('cmake', ['--build', buildDir, '--target', 'whisper-cli', '-j', String(os.cpus().length)], workDir)

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const binCandidates = [
  path.join(buildDir, 'bin', 'whisper-cli'),
  path.join(buildDir, 'whisper-cli'),
]
const cliSrc = binCandidates.find((p) => fs.existsSync(p))
if (!cliSrc) {
  throw new Error('whisper-cli binary not found after build')
}

fs.copyFileSync(cliSrc, path.join(outDir, 'whisper-cli'))
fs.chmodSync(path.join(outDir, 'whisper-cli'), 0o755)

// Copy co-located libwhisper / libggml shared libraries (never system libvulkan.so.1)
function collectLibs(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectLibs(full)
    } else if (/^lib(whisper|ggml).*\.so(\.\d+)*$/.test(entry.name)) {
      const dest = path.join(outDir, entry.name)
      fs.copyFileSync(full, dest)
    }
  }
}
collectLibs(buildDir)

const files = {}
for (const name of fs.readdirSync(outDir).sort()) {
  files[name] = sha256(path.join(outDir, name))
}

const manifest = {
  engine: 'whisper.cpp',
  version: WHISPER_TAG,
  variant,
  backend: cpuOnly ? 'cpu' : 'vulkan',
  builtAt: new Date().toISOString(),
  note: 'System graphics driver supplies libvulkan.so.1; never bundle driver shared libs.',
  files,
}

fs.writeFileSync(path.join(outDir, 'BUILD.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`\nBuilt Rza Clipper whisper engine (${variant}) -> ${outDir}`)
