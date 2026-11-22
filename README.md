# Rza Clipper (Linux Desktop Edition)

**By Rza Official** — Clean-room Linux desktop application that turns long-form videos into viral 9:16 vertical short clips with automatic word-level captions, AI viral clip discovery, and ONNX active-speaker face tracking.

Community: https://whatsapp.com/channel/0029VbASCFE4tRs0xSB7E61B

## Placeholders to Fill Before Public Release

Search the repo for `[PLACEHOLDER` (primarily in `src/config/branding.ts`, `index.html`, and `assets/`):

1. **Rza Clipper Logo**: Replace `assets/icon.svg`, `assets/icon.png` (512x512+), and the inline `#splash-icon` SVG in `index.html`.
2. **GitHub Releases API URL** (`BRANDING.githubReleasesApiUrl`): Point to your Rza Clipper GitHub repo `/releases/latest` endpoint to enable Linux AppImage/.deb/.rpm update checks (currently stays idle safely).
3. **Announcements API URL** (`BRANDING.announcementsApiUrl`): Point to your Rza Official announcements endpoint (currently hidden cleanly).
4. **AI Provider Default** (`BRANDING.defaultAiProvider`): Defaults to `openai-compatible` (works with OpenAI, OpenRouter, Groq, DeepSeek, or local Ollama); optional Manus login uses plain `https://manus.im/`.

## Quick Start (Linux)

```bash
# 1. Install system build & runtime dependencies (Ubuntu/Debian example)
sudo apt update && sudo apt install -y \
  build-essential cmake ninja-build git ffmpeg \
  libvulkan1 libvulkan-dev glslc vulkan-tools pciutils

# 2. Install Node dependencies (Node.js 22+ recommended)
npm install

# 3. Build Linux whisper.cpp v1.9.2 with Vulkan GPU support (or add --cpu-only)
npm run build:whisper

# 4. Launch in development mode
npm run dev
```

See `docs/LINUX-BUILD.md` for Ubuntu/Debian, Fedora, and Arch packaging (`.deb`, `.rpm`, `.AppImage`) and `docs/TESTING-CHECKLIST.md` for full feature verification.
