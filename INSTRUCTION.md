## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Beat-synced LFO** - LFO with tempo-locked rate divisions (1/4, 1/8, 1/16, etc.) for filter/amp modulation ✅ COMPLETED
2. **Audio Scrubbing** - Scrub through audio by dragging on the timeline with audible playback ✅ COMPLETED
3. **Octave Layer** - Add octave-up and octave-down layers to MIDI instrument tracks
4. **Mixer Snapshot** - Save and recall complete mixer states (volume, pan, mute, solo, effects)
5. **Sample Rate Display** - Show current audio sample rate in the status bar
6. **Rhythm Pattern Brush** - Draw rhythmic patterns by clicking and dragging patterns on the sequencer
7. **Per-track Spectrum Analyzer** - Real-time FFT display for each track channel
8. **Note Echo Effect** - Per-note delay with feedback for arpeggiation effects
9. **Preset Morphing** - Morph between two effect presets over a specified time duration
10. **Distortion Curves Editor** - Visual curve editor for waveshaper distortion with preset shapes (tube, fuzz, asymmetric) ✅ COMPLETED

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