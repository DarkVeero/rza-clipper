# Rza Clipper (Linux) — Feature Verification & Testing Checklist

Run this checklist on a Linux desktop (X11 and Wayland) before shipping a release.

## 1. Branding, UI & Frameless Window Controls
- [ ] Window title, `.desktop` entry, splash screen, and sidebar show **Rza Clipper** (zero FuseClip/Amfaiz text).
- [ ] Frameless titlebar renders working **Minimize**, **Maximize/Restore**, and **Close** buttons on Linux.
- [ ] Double-clicking the titlebar toggles maximize state and updates the button icon.
- [ ] Sidebar community area shows **ONLY** `https://whatsapp.com/channel/0029VbASCFE4tRs0xSB7E61B` and opens in the default Linux browser when clicked.
- [ ] Theme toggle (`Dark` / `Light` / `System`) persists across restart with zero white flash on dark startup (`window.settings.getThemeSync()`).

## 2. Media Protocol & Project Management
- [ ] Dragging and dropping `.mp4`, `.mkv`, `.mov`, and `.webm` files creates a project and plays smoothly via `media://local/...`.
- [ ] Scrubbing to arbitrary timestamps triggers HTTP 206 byte-range responses without stalling.
- [ ] Projects persist in `~/.config/Rza Clipper/projects/` and reload cleanly after restart.

## 3. Linux GPU Detection & Local Transcription (`whisper.cpp`)
- [ ] `Settings -> Linux GPU & Updates` accurately reports CPU, RAM, NVIDIA/AMD/Intel GPU, Vulkan availability, and VAAPI status.
- [ ] Downloading `base` and `large-v3-turbo` GGML models shows progress and saves under `~/.config/Rza Clipper/whisper-models/`.
- [ ] **GPU Mode**: Transcribe a 60s clip with Vulkan enabled; confirm backend reports `vulkan` and word-level DTW timestamps align.
- [ ] **CPU Mode**: Switch to `CPU Only (-ng)`; verify transcription succeeds with `-ng`.
- [ ] **Auto Fallback**: Temporarily run with `VK_ICD_FILENAMES=/nonexistent`; verify `Auto` falls back to CPU with notice and `GPU Required` surfaces a clear error.
- [ ] **Offline Check**: Disconnect network and verify local Whisper transcription works 100% offline.

## 4. Cloud Transcription (Deepgram)
- [ ] `Test Deepgram Key` validates a real key and rejects an invalid key cleanly.
- [ ] Transcribing a >30-minute video splits into 30-min Opus Ogg chunks and preserves continuous timestamps and speaker IDs.

## 5. Viral Clip Detection & Caption AI
- [ ] Configure an OpenAI-compatible endpoint (e.g., OpenAI, OpenRouter, Groq, or local Ollama) and verify `Test Connection`.
- [ ] Run `Find Viral Clips` on a transcribed video; confirm Pass 1 discovery, boundary alignment, Pass 2 weighted scoring (`>=75` pass / `>=60` suggested), and deduplication.
- [ ] Interrupt mid-run and re-run to confirm SHA-256 checkpoints in `~/.config/Rza Clipper/ai-checkpoints/` resume without duplicate LLM calls.

## 6. ONNX Face Tracking & 9:16 Vertical Reframing
- [ ] Run `Track Faces (9:16)` on single-speaker and two-speaker clips; verify YuNet ONNX model loads on `onnxruntime-node` Linux CPU provider.
- [ ] Confirm camera pans smoothly on continuous shots and snaps cleanly on hard scene cuts.
- [ ] Switch between `track`, `split`, `three`, `four`, and `general` layouts.

## 7. 18 Caption Presets, Custom Fonts & 9:16 MP4 Export
- [ ] Switch across all 18 presets (including Urdu `Numaya`, Arabic `Noor`, Hindi `Bayan`) and confirm live preview renders.
- [ ] Install a custom `.ttf`/`.otf`/`.woff2` font in `Settings -> Fonts` and verify it persists in `~/.config/Rza Clipper/fonts/`.
- [ ] Export a 9:16 clip; verify output MP4 is 1080x1920 H.264/AAC (`yuv420p`, `+faststart`), plays in VLC/mpv, and opens in the Linux file manager via `Reveal`.
