## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

**When Queue is Empty - New Feature Ideas (2026-04-23 05:35 UTC)**

1. **Reverb Pool** - Multiple named reverb spaces that can be saved and shared across tracks ✅ COMPLETED
2. **Tempo Nudge** - Fine-grained tempo adjustment with arrow keys during playback ✅ COMPLETED
3. **Track Mirror** - Real-time duplicate of a track with offset for parallel processing ✅ COMPLETED
4. **Audio Tap Tempo** - Tap to set project tempo from audio/claps ✅ COMPLETED
5. **Clip Governor** - Limit total number of clips visible on timeline to reduce visual clutter ✅ COMPLETED
6. **Signal Flow Diagram** - Visual node-based view of track signal chain ✅ COMPLETED
7. **MIDI Input Filter** - Filter specific notes/channels from MIDI input ✅ COMPLETED
8. **Waveform Overlay** - Overlay multiple audio clip waveforms for comparison ✅ COMPLETED
9. **Scale Highlight Mode** - Highlight selected scale notes in piano roll ✅ COMPLETED
10. **EQ Preset Library** - Built-in EQ presets for common instruments (kick, snare, vocal, etc.) ✅ COMPLETED

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