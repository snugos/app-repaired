# Snaw Feature Builder Agent Instructions

## Purpose
Run to add new features to the SnugOS DAW (Snugos/snaw).

## Current Feature Queue

All features from previous queues have been implemented. New queue:

1. **AI Tempo Suggestion** - Analyze the rhythm of recorded audio and suggest optimal BPM
2. **Clip Envelope Shaper** - Draw custom amplitude envelopes on clips for precise dynamics control
3. **Track Template Library** - Save and browse track templates (instrument + effects + settings)
4. **Clip Fade Presets** - Save and apply common fade in/out curves (exponential, S-curve, etc.)
5. **Track Delay Compensation** - Automatically compensate for plugin latency per track
6. **Project Auto-Naming** - Smart naming for clips and tracks based on recorded content
7. **MIDI Learn Bulk Assign** - Assign multiple MIDI CCs at once via visual matrix
8. **Stereo Phase Correction** - Detect and fix phase issues in recorded audio
9. **BPM/MIDI Sync Lock** - Lock MIDI devices to project BPM for tight sync
10. **Export Stem Preview** - Preview individual stems before exporting full project

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