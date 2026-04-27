## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **MIDI CC Matrix** - Visual grid for MIDI CC modulation mapping with drag-connect routing
2. **Clip Fade Editor** - Draw custom fade curves (exponential, S-curve, logarithmic) on audio clips with handles
3. **BPM Detector** - Auto-detect tempo from imported audio using onset detection and beat tracking
4. **Track Grouping** - Group tracks into folders with solo/mute hierarchy and color inheritance
5. **Export Stem per Track** - Export individual track stems as separate audio files with naming templates
6. **Audio Tonearm Loop** - Scratch-style loop where you can scrub audio like a vinyl turntable
7. **Scale Highlight Overlay** - Show which keys/notes are in the selected scale as colored overlay on piano roll and keys
8. **Score Editor** - Visual staff notation display that shows notes as musical notation with transposition and clef display ✅ (implemented c6bd35b)
9. **Audio Normalizer** - Batch audio normalization with target dB selection and true peak limiting ✅ (implemented 80ba45a)

## Workflow

### Step 1: Pick Next Feature
- Read this instruction to see which feature you're on
- Work on features IN ORDER (1, then 2, then 3...)

### Step 2: Implement Feature
- Keep it SIMPLE and MINIMAL
- Follow existing code patterns
- Add necessary UI, state, and audio logic
- Test locally before committing

### Step 3: Commit & Push
- Commit: `feat: [feature name]`
- Push to `LWB-with-Bugs` branch
- Wait ~60 seconds for GitHub Pages deploy

### Step 4: Verify
- Open https://snugos.github.io/snaw/ in browser
- Test the new feature works
- Check console for errors

### Step 5: Update Queue
After successfully implementing a feature:
- Remove it from the queue
- Renumber the remaining features
- Update this instruction with new queue

## When Queue is Empty

Run this brainstorming process:

```
Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support

Generate 10 NEW feature ideas that are:
1. Achievable in a single session
2. Complement existing features
3. Enhance creative workflow

Output as numbered list and update this instruction.
```

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`