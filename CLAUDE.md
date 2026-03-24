# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static, serverless English listening practice web app. Two components:
1. **`generate.js`** — Node.js CLI that generates bilingual script JSON via Claude API
2. **`index.html`** — Single-file browser app for listening practice (no build step)

## Commands

```bash
# Install dependencies (required for generate.js only)
npm install

# Generate a new listening script
node generate.js --topic "Travel" --level "beginner"
# Levels: beginner | intermediate | advanced
# Creates scripts/{id}.json and updates scripts/index.json automatically
```

First-time setup: `cp .env.example .env` and set `ANTHROPIC_API_KEY`.

## Architecture

### Script Generation Flow
`generate.js` → Claude API (`claude-sonnet-4-20250514`) → `scripts/{id}.json` → auto-updates `scripts/index.json`

### Browser App (`index.html`)
Pure HTML/CSS/JS with no framework or build step. Three display modes:
- **Normal**: English + Korean visible
- **Korean Hidden (👁)**: Korean text blurred
- **Image Mode (🧠)**: Full blur + dark background for audio-only

Audio playback supports two sources:
1. Pre-cached MP3 from `audio/{id}.mp3`
2. On-demand OpenAI TTS (user's API key stored in localStorage)

**Sentence timing**: Duration distributed proportionally by character count — no manual annotations needed.

### Script JSON Format
```json
{
  "title": "...",
  "topic": "...",
  "level": "beginner",
  "sentences": [
    { "p": true },
    { "en": "English sentence.", "ko": "한국어 번역." }
  ]
}
```
`{ "p": true }` inserts paragraph breaks; sentence objects have `en` and `ko` fields.

### Deployment
GitHub Pages (static hosting). The app fetches scripts and audio via raw GitHub URLs configured in `index.html`.
