## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Headphone Preview** - Route individual tracks to a dedicated headphone mix with separate volume control
2. ~~**Audio Tap Tempo**~~ ✅ - Tap a button rhythmically to detect and set project tempo from input timing (COMMITTED: d7c47a5)
3. **Clip Gain Envelope Editor** - Visual envelope editor for clip-level volume automation with drawable curves
4. **MIDI Note Editor** - Dedicated MIDI note editor window with velocity, duration, and start time per note
5. **Mixer Routing Matrix** - Visual matrix showing track-to-bus routing with drag-drop connections
6. **Track Lane Reorder** - Drag tracks to reorder them in the timeline with smooth animation
7. **Tempo Ramp Automation** - Draw tempo changes over time with smooth ramping between points
8. ~~**Audio Phase Invert**~~ ✅ - One-click phase invert for correcting out-of-phase audio recordings (COMMITTED: 5f935ad)
9. **Clip Time Stretch** - Time-stretch audio clips with preserved pitch usingws algorithms
10. **Marker Navigation** - Add markers at specific positions and jump between them during playback

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