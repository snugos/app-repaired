# Snaw Feature Builder Agent Instructions

## Purpose
Run to add new features to the SnugOS DAW (Snugos/snaw).

## Current Feature Queue

1. **Audio Reverse** - Reverse audio clips with one click
2. **Step Velocity Editor** - Visual velocity lanes per step in sequencer
3. **Track Icon Picker** - Assign icons/emoji to tracks for visual identification
4. **Loop Crossfade** - Smooth loop points with crossfade curves
5. **Keyboard Octave Shift** - Global octave shift for MIDI keyboard input
6. **Metronome Count-In** - Play count-in beats before recording starts
7. **CPU Usage Panel** - Detailed per-track CPU usage display

## Workflow

### Step 1: Pick Next Feature
- Work on features IN ORDER (1, then 2, then 3...)

### Step 2: Implement Feature
- Keep it SIMPLE and MINIMAL
- Follow existing code patterns
- Add necessary UI, state, and audio logic

### Step 3: Commit & Push
- Commit: `feat: [feature name]`
- Push to `LWB-with-Bugs` branch

### Step 4: Verify
- Open https://snugos.github.io/snaw/ in browser
- Test the new feature works

### Step 5: Update Queue
After successfully implementing a feature:
- Remove it from the queue
- Renumber the remaining features
- Update this instruction with new queue

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`

## Rules
- ONE feature per run
- Always commit working code
- Keep features minimal and focused

## Session: 2026-04-30 05:25 UTC (Snaw Repair Agent Run)

**Status: NO BUGS FOUND ✅**

### Verification Summary
- `removeCustomDesktopBackground` IS properly defined at `main.js:614` within `appServices`
- `eventHandlers.js:124` correctly guards the call with `if(localAppServices.removeCustomDesktopBackground)`  
- Line 342 is blank — no code reference exists there (stale error line number)
- All JS files pass `node --check`
- Git Status: Clean (only INSTRUCTION.md modified, not a code file)