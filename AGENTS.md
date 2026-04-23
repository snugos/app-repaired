## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Mute Groups** - Create mute groups where only one track plays at a time
2. **Audio Batch Export** - Export all tracks/stems in one operation
3. **Pattern Morphing** - Smooth transition between two patterns
4. **Clip Transpose Envelope** - Pitch automation on audio clips over time
5. **Harmonic Editor** - Edit individual harmonics of sounds
6. **Sample Slicer** - Auto-slice loops into individual hits
7. **Beatbox Detection** - Convert beatboxing audio to drum MIDI
8. **Vocal Harmony Generator** - Auto-generate harmony vocals from melody
9. **BPM Detector** - Auto-detect tempo from audio files
10. **Clip Stutter Effect** - Real-time stutter/repeat effect on clips

## Completed Features

- **MIDI Chord Player** - On-screen piano that plays chords from single key press ✅ COMPLETED (2026-04-23)
- **AI Mastering** - Apply AI-driven loudness normalization and EQ matching ✅ COMPLETED (2026-04-23)
- **Mixdown Visualizer** - Real-time stereo field and correlation meter ✅ COMPLETED
- **Clip Graffiti** - Freehand drawing and memo overlay on audio clips ✅ COMPLETED (2026-04-23)

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
