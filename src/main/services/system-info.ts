import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { promisify } from 'node:util'
import type { SystemGpuDevice, SystemHardwareInfo } from '#/shared/types'

const execFileAsync = promisify(execFile)

async function runCmd(cmd: string, args: string[], timeoutMs = 4000): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: timeoutMs })
    return stdout.trim()
  } catch {
    return null
  }
}

function classifyVendor(name: string): SystemGpuDevice['vendor'] {
  const lower = name.toLowerCase()
  if (lower.includes('nvidia') || lower.includes('geforce') || lower.includes('rtx') || lower.includes('quadro')) {
    return 'nvidia'
  }
  if (lower.includes('amd') || lower.includes('radeon') || lower.includes('ati')) {
    return 'amd'
  }
  if (lower.includes('intel') || lower.includes('uhd') || lower.includes('iris') || lower.includes('arc')) {
    return 'intel'
  }
  return 'unknown'
}

async function detectNvidiaGpus(): Promise<SystemGpuDevice[]> {
  const out = await runCmd('nvidia-smi', [
    '--query-gpu=name,memory.total,driver_version',
    '--format=csv,noheader,nounits',
  ])
  if (!out) return []
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, vramStr, driver] = line.split(',').map((s) => s.trim())
      return {
        name: name || 'NVIDIA GPU',
        vendor: 'nvidia' as const,
        vramMb: Number.parseInt(vramStr || '0', 10) || undefined,
        driver: driver || undefined,
        cudaAvailable: true,
        vulkanSupported: true,
        vulkan12: true,
        storage16Bit: true,
      }
    })
}

async function detectVulkanInfo(): Promise<{ available: boolean; vulkan12: boolean; devices: string[] }> {
  const out = await runCmd('vulkaninfo', ['--summary'], 5000)
  if (!out) {
    // Fallback check: is libvulkan present on the system?
    const libPaths = [
      '/usr/lib/x86_64-linux-gnu/libvulkan.so.1',
      '/usr/lib64/libvulkan.so.1',
      '/usr/lib/libvulkan.so.1',
    ]
    const hasLib = libPaths.some((p) => fs.existsSync(p))
    return { available: hasLib, vulkan12: hasLib, devices: [] }
  }

  const devices: string[] = []
  let vulkan12 = false

  for (const line of out.split('\n')) {
    const devMatch = /deviceName\s*=\s*(.+)$/i.exec(line.trim())
    if (devMatch && !devMatch[1].toLowerCase().includes('llvmpipe')) {
      devices.push(devMatch[1].trim())
    }
    const verMatch = /apiVersion\s*=\s*(\d+)\.(\d+)/i.exec(line.trim())
    if (verMatch) {
      const major = Number.parseInt(verMatch[1], 10)
      const minor = Number.parseInt(verMatch[2], 10)
      if (major > 1 || (major === 1 && minor >= 2)) {
        vulkan12 = true
      }
    }
  }

  return { available: devices.length > 0, vulkan12, devices }
}

async function detectLspciGpus(): Promise<SystemGpuDevice[]> {
  const out = await runCmd('lspci', ['-mm'])
  if (!out) return []

  const results: SystemGpuDevice[] = []
  for (const line of out.split('\n')) {
    if (!/(VGA compatible controller|3D controller|Display controller)/i.test(line)) continue
    const quoted = Array.from(line.matchAll(/"([^"]*)"/g)).map((m) => m[1])
    const vendorStr = quoted[1] ?? ''
    const deviceStr = quoted[2] ?? ''
    const fullName = `${vendorStr} ${deviceStr}`.trim() || 'Linux GPU'
    results.push({
      name: fullName,
      vendor: classifyVendor(fullName),
    })
  }
  return results
}

function detectVaapi(): boolean {
  try {
    const driDir = '/dev/dri'
    if (!fs.existsSync(driDir)) return false
    return fs.readdirSync(driDir).some((f) => f.startsWith('renderD'))
  } catch {
    return false
  }
}

let cachedSpecs: SystemHardwareInfo | null = null

/**
 * Linux-native hardware & GPU probe (replaces the original Windows-only
 * PowerShell/wmic detection that returned hasGpu: false on Linux).
 */
export async function getSystemHardwareInfo(forceRefresh = false): Promise<SystemHardwareInfo> {
  if (cachedSpecs && !forceRefresh) return cachedSpecs

  const cpus = os.cpus()
  const [nvidiaGpus, vulkan, pciGpus] = await Promise.all([
    detectNvidiaGpus(),
    detectVulkanInfo(),
    detectLspciGpus(),
  ])

  const merged: SystemGpuDevice[] = [...nvidiaGpus]
  for (const pci of pciGpus) {
    if (pci.vendor === 'nvidia' && nvidiaGpus.length > 0) continue
    merged.push({
      ...pci,
      vulkanSupported: vulkan.available,
      vulkan12: vulkan.vulkan12,
      storage16Bit: vulkan.vulkan12,
    })
  }

  // If vulkaninfo found devices not in lspci (e.g. inside containers/flatpak)
  if (merged.length === 0 && vulkan.devices.length > 0) {
    for (const name of vulkan.devices) {
      merged.push({
        name,
        vendor: classifyVendor(name),
        vulkanSupported: true,
        vulkan12: vulkan.vulkan12,
        storage16Bit: vulkan.vulkan12,
      })
    }
  }

  const hasCuda = merged.some((g) => g.cudaAvailable)
  const hasVulkan = vulkan.available && merged.length > 0
  const recommendedWhisperBackend: SystemHardwareInfo['recommendedWhisperBackend'] = hasCuda
    ? 'cuda'
    : hasVulkan
      ? 'vulkan'
      : 'cpu'

  cachedSpecs = {
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpus[0]?.model ?? 'Unknown CPU',
    cpuCores: cpus.length,
    totalMemoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    hasGpu: merged.length > 0,
    gpus: merged,
    recommendedWhisperBackend,
    vulkanAvailable: vulkan.available,
    vaapiAvailable: detectVaapi(),
  }

  return cachedSpecs
}
