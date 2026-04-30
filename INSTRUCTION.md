# Snaw Feature Builder Agent Instructions

## Purpose
Run to add new features to the SnugOS DAW (Snugos/snaw).

## Current Feature Queue

1. **Chord Voicing Modes** - Change how chords are voiced (close, open, drop 2, drop 3 inversions)
2. **Scale Quantize** - Snap notes to scale degrees, not just grid
3. **Rhythm Randomizer** - Apply probability-based randomization to drum patterns
4. **Audio Reverse** - Reverse audio clips with one click
5. **Step Velocity Editor** - Visual velocity lanes per step in sequencer
6. **Track Icon Picker** - Assign icons/emoji to tracks for visual identification
7. **Loop Crossfade** - Smooth loop points with crossfade curves
8. **Keyboard Octave Shift** - Global octave shift for MIDI keyboard input
9. **Metronome Count-In** - Play count-in beats before recording starts
10. **CPU Usage Panel** - Detailed per-track CPU usage display

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
