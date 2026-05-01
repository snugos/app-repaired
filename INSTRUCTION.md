## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Ghost Notes Preview** - Preview how a drum track sounds with different velocity layers before committing
2. **Clip Loop Stretch** - Non-destructively loop and stretch audio clips to different lengths
3. **MIDI CC Step Sequencer** - Step sequencer for MIDI continuous controllers (knobs, faders)
4. **Adaptive Metronome Pitch** - Metronome changes pitch based on beat position (hi-hat on offbeats)
5. **Track Quick Duplicate** - Double-click track header to duplicate entire track instantly
6. **Arrangement Markers** - Add colored markers on timeline for section labels (Verse, Chorus, etc.)
7. **MIDI Velocity Curve** - Remap incoming MIDI velocity through a custom curve
8. **Audio Bit Depth Selector** - Choose export bit depth (16-bit, 24-bit, 32-bit float)
9. **Session Timer** - Track how long you've been working on a project

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