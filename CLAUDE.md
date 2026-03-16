# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cross-platform desktop tool for video subtitle generation and translation. Extracts audio from video via FFmpeg, performs speech recognition via FunASR API, translates via OpenAI-compatible LLM API, and exports bilingual SRT subtitles.

## Tech Stack

- **Frontend**: Next.js (React) with TypeScript
- **Desktop Framework**: Tauri (cross-platform: Windows, macOS, Linux)
- **ASR**: FunASR API (default: `http://127.0.0.1:8000`)
- **Translation**: OpenAI-compatible chat completions API (batch of 10 subtitles per request)
- **Local Tool**: FFmpeg (auto-detected with priority: user config → `./ffmpeg` → system PATH)

## Architecture

```
Next.js GUI → Tauri → Local capabilities (FFmpeg, file system, config)
                    → Remote services (FunASR API, LLM API)
```

**Processing pipeline**: Video → FFmpeg audio extraction → FunASR recognition → Subtitle generation → LLM translation → Bilingual SRT export

## Build & Development Commands

```bash
# Frontend dev server
npm run dev

# Build for production
npm run build

# Tauri development
npm run tauri dev

# Tauri production build
npm run tauri build
```

## Project Structure (Planned)

```
src/
├── app/page.tsx              # Main page
├── components/               # UI components (FilePicker, ProgressBar, SubtitlePreview, SettingsPanel)
├── lib/
│   ├── ffmpeg.ts             # FFmpeg execution wrapper
│   ├── ffmpegDetector.ts     # FFmpeg auto-detection (3-tier priority)
│   ├── funasr.ts             # FunASR API client
│   ├── translator.ts         # LLM translation (OpenAI-compatible API)
│   ├── subtitle.ts           # SRT parsing and generation
│   └── config.ts             # JSON config management
src-tauri/                    # Tauri backend (Rust)
```

## Key Design Decisions

- **FFmpeg detection**: 3-tier priority — (1) user-configured path, (2) local `./ffmpeg` or `./ffmpeg.exe`, (3) system PATH. Validate by running `ffmpeg -version`.
- **Cross-platform paths**: Use `@tauri-apps/api/path` and `appConfigDir()` for config file location.
- **Translation batching**: 10 subtitles per LLM request to balance API calls vs context coherence.
- **Config storage**: JSON file at OS-appropriate location (`%APPDATA%` / `~/Library/Application Support` / `~/.config`).

## Planning Documentation

Detailed project specification is in `docs/plan/` (gitignored, local-only).
