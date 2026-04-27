## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Tempo Ramper** - Smoothly automate tempo changes over time with curve editor
2. **Track Freeze** - Freeze audio tracks to CPU-friendly buffer to free processing power
3. **MIDI Arpeggiator** - Built-in arpeggiator with patterns (up, down, ping-pong, random)
4. **Sidechain Visualizer** - Visual feedback showing which track is triggering ducking
5. **Clip Fade Handles** - Drag handles on clips to adjust fade in/out curves
6. **Sample Editor** - Detailed waveform editing with cut, copy, normalize
7. **Track Export Individual** - Export each track as separate audio file
8. **Step Sequencer Drummer** - Grid-based drum programming with velocity layers
9. **CPU Performance Mode** - Reduce visual effects for better performance on low-end devices
10. **Project Notes** - Text notes panel for project documentation

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