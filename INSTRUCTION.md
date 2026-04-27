## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

All features completed! See above for new ideas.

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

## New Feature Queue (2026-04-27)

1. **Clip Reverse Tool** - One-click button to reverse audio/MIDI clips in-place
2. **Rhythm Pattern Generator** - Generate rhythm patterns with adjustable complexity and style
3. **Track Color Palette Manager** - Multiple color palettes for visual track grouping
4. **Auto-Ducking** - Automatic volume reduction when voiceover/dialog is detected
5. **BPM Tap Pad** - Large touch-friendly pad for tap tempo detection
6. **Audio Spectrum Analyzer** - Real-time FFT visualization per track
7. **MIDI CC Learn Remote** - On-screen knob/fader that sends MIDI CC when dragged
8. **Groove Templates** - Save and apply swing/groove templates to quantize
9. **Project Auto-Save** - Periodic auto-save with recovery on crash
10. **Loop Region Presets** - Save/load named loop regions as presets

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`