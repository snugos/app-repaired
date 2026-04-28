## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Tempo Sync Grid** - Lock timeline grid to musical divisions and adjust swing amount per track
2. **Batch Clip Effects** - Apply effects (fade, reverse, pitch shift) to multiple selected clips at once
3. **Track Grouping** - Group tracks with linked solo/mute/fader behavior
4. **MIDI Learn Mode** - Click any knob/fader to learn MIDI CC mapping for real-time control
5. **Clip Loop Preview** - Preview loop region without affecting full clip playback position
6. **Export Stem Preview** - Listen to individual stems before final export
7. **Grid Snap Probability** - Notes have configurable chance to snap to grid vs stay humanized
8. **Track Activity Monitor** - Real-time visual of which tracks are producing audio
9. **Bounce in Place** - Render track to audio with effects applied, replace original clips
10. **Quick Quantize Menu** - Right-click quantization presets (1/4, 1/8, 1/16, triplet, swing)

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