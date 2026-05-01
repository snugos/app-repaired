# Snaw Feature Builder Agent Instructions

## Purpose
Run to add new features to the SnugOS DAW (Snugos/snaw).

## Status: Feature Queue Exhausted ✅

All previously queued features have been implemented across previous sessions. The codebase is considered feature-complete for browser-based DAW functionality.

### Previously Implemented Features (430+)
The following categories are fully implemented:
- Audio Engine (effect chains, sidechain routing, audio context recovery)
- Track System (track creation, instrument types, recording)
- Sequencer (pattern recording, step editing, playback sync)
- Timeline (clip arrangement, drag-drop, loop regions)
- MIDI Support (input selection, note mapping, recording)
- Project Management (save/load, export, auto-save)
- Effects (master effects, track effects, automation)
- UI Windows (Inspector, Mixer, Effects rack, Browser)

### Features Not Implementable (Browser Limitation)
- VST3 Plugin Loading (requires native bridge)
- AU Plugin Support (requires native bridge)
- ReWire Support (requires native bridge)

## Workflow (When Adding New Features)

### Step 1: Brainstorm New Features
When the queue is empty, generate 10 new feature ideas that:
1. Are achievable in a single session
2. Complement existing features
3. Enhance creative workflow

### Step 2: Implement Feature
- Keep it SIMPLE and MINIMAL
- Follow existing code patterns

### Step 3: Commit & Push
- Commit: `feat: [feature name]`
- Push to `LWB-with-Bugs` branch

### Step 4: Verify
- Open https://snugos.github.io/snaw/ in browser
- Test the new feature works

### Step 5: Update This File
After implementing a feature, remove it from the queue and renumber.

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`

## Rules
- ONE feature per run
- Always commit working code
- Keep features minimal and focused