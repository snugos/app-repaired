## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

**NEW FEATURES (2026-04-23 18:45 UTC)**

1. **Ambience Maker** - Generate ambient drone layers from any audio input
2. **Rhythm Coach** - Visual metronome trainer with timing accuracy feedback
3. **Auto-Spill** - Auto-duplicate clips to fill timeline regions
4. **Track Stack** - Collapse/expand multi-track arrangements
5. **Splice Detector** - Auto-detect and mark transient events in audio
6. **Mixdown Ghost** - Real-time dry/wet comparison toggle for effects
7. **Scale Suggestion** - AI-powered scale suggestion based on audio melody
8. **Adaptive Q** - Auto-adjust EQ Q based on frequency content
9. **Drum Replace** - Replace drum samples by detected hit type (kick/snare/hat)
10. **One-Knob Master** - Single knob for "loudness maximization" chain

**Status: All browser-implementable features from previous queues are COMPLETE ✅**

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