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

---

## Updated Feature Queue (2026-05-01)

All 10 features from the previous queue were already implemented. New queue:

1. **Track Lane Reorder** - Drag and drop to reorder tracks in the arrangement view
2. **Clip Reverse Playback** - Reverse audio clips for glitch/creative effects
3. **MIDI CC Learn shortcuts** - Assign MIDI CC messages to toggle features
4. **Loop Region Markers** - Named markers for quick loop region selection
5. **Track Freeze with FX** - Render track including effects to audio to save CPU
6. **Multi-Select Edit** - Select multiple clips/tracks and edit properties together
7. **BPM Range Presets** - Quick switch between tempo ranges (fast/slow practice)
8. **Export Selection** - Export only the selected region of the timeline
9. **Note Velocity Edit** - Visual velocity ramp editor for selected notes
10. **Project Version History** - Save snapshots and compare project versions