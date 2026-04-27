## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Clip Gain Envelope** - Draw volume automation directly on audio clips with bezier curves
2. **Send Effect Rack** - Dedicated UI for managing send/return effect buses (reverb, delay)
3. **Audio Spectrum Analyzer** - Real-time FFT display showing frequency content per track
4. **MIDI Learn Wizard** - Step-by-step guided MIDI mapping for any knob/slider
5. **Clip Fade Handles** - Drag handles on clip edges to set fade in/out curves
6. **Track Solo Groups** - Create solo groups where soloing one mutes others in group
7. **Export Stem Bundles** - Export multiple stems as a single ZIP archive
8. **Scale Quantize** - Quantize notes to selected musical scale intervals
9. **Transport记忆** - Remember and restore transport position, loop region, and tempo on reopen

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
- 430+ features already implemented

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