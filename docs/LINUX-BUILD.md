# Rza Clipper — Linux Build, Install & Packaging Guide

## 1. System Prerequisites

### Ubuntu / Debian (22.04 / 24.04+)
```bash
sudo apt update && sudo apt install -y \
  nodejs npm git build-essential cmake ninja-build \
  ffmpeg libvulkan1 libvulkan-dev glslc vulkan-tools pciutils \
  fakeroot dpkg rpm
```

### Fedora (40+)
```bash
sudo dnf install -y \
  nodejs npm git gcc-c++ cmake ninja-build \
  ffmpeg vulkan-loader vulkan-loader-devel glslc vulkan-tools pciutils \
  rpm-build
```

### Arch Linux
```bash
sudo pacman -S --needed \
  nodejs npm git base-devel cmake ninja \
  ffmpeg vulkan-icd-loader vulkan-headers shaderc vulkan-tools pciutils
```

## 2. Build the Local Whisper Engine (Vulkan GPU + CPU Fallback)

```bash
npm install

# Vulkan GPU build (AMD / Intel / NVIDIA — requires Vulkan 1.2 + 16-bit storage driver)
npm run build:whisper

# Optional: also build CPU-only fallback bundle
npm run build:whisper:cpu
```

This compiles upstream `whisper.cpp` v1.9.2 into `assets/bin/linux-x64-vulkan/` (or `linux-arm64-vulkan/`) alongside `BUILD.json` SHA-256 hashes. System drivers supply `libvulkan.so.1`; never copy a host driver `.so` into `assets/bin/`.

## 3. Run in Development Mode

```bash
npm run typecheck
npm run dev
```

## 4. Build Linux Installers (`.deb`, `.rpm`, `.AppImage`)

```bash
# Debian/Ubuntu package (.deb -> out/make/deb/)
npm run make:deb

# Fedora/RHEL package (.rpm -> out/make/rpm/)
npm run make:rpm

# Portable AppImage (requires appimagetool in PATH -> out/Rza-Clipper-linux-x86_64.AppImage)
npm run make:appimage
```

### Installing the Built Packages
- **Ubuntu/Debian**: `sudo apt install ./out/make/deb/x64/rza-clipper_1.0.0_amd64.deb`
- **Fedora**: `sudo dnf install ./out/make/rpm/x64/rza-clipper-1.0.0-1.x86_64.rpm`
- **AppImage**: `chmod +x out/Rza-Clipper-linux-x86_64.AppImage && ./out/Rza-Clipper-linux-x86_64.AppImage`
