## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **BPM Nudge Buttons** - +/- 0.1 BPM buttons in transport bar for fine tempo adjustment
2. **Note Length Scaler** - Select notes in piano roll and scale their length by percentage
3. **Track Duplicate with Offset** - `Ctrl+Shift+D` to duplicate track with 1-bar offset
4. **Clip Fade Handles** - Drag handles at clip edges to apply fade in/out curves
5. **Sample-Accurate Grid** - Toggle between beat grid and sample-level grid in timeline
6. **Velocity Curve Editor** - Draw velocity curve for selected notes in piano roll
7. **Track Solo Safe** - `Alt+Click` solo to solo track without muting others
8. **Track Delay Compensation** - Automatically compensate for plugin latency per track
9. **Project Auto-Naming** - Smart naming for clips and tracks based on recorded content

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