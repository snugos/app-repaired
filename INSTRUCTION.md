## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

*Queue is empty - generating new features*

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

## New Feature Ideas (generated 2026-04-20)

Based on SnugOS being a browser-based DAW with Tone.js audio engine, multi-track timeline, effects rack, sequencer mode, and MIDI support:

1. **Track Color Coding** - Assign custom colors to tracks for visual grouping in the mixer and timeline
2. **MIDI Learn / Mapping** - Map MIDI CC messages to any track or master parameter
3. **Audio Clip Normalization** - Right-click audio clips to normalize their volume
4. **Step Sequencer Copy/Paste** - Copy and paste patterns between steps or tracks
5. **Track Freeze** - Freeze a track to audio to reduce CPU usage
6. **Tempo Tap Button** - Tap to set tempo rhythmically
7. **Audio Stretching** - Adjust audio clip tempo without changing pitch
8. **Track Grouping** - Group tracks together for collective mute/solo/volume control
9. **MIDI File Export** - Export sequencer patterns as .mid files
10. **Keyboard Shortcuts Panel** - Press ? to view all keyboard shortcuts