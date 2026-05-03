## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

> All 10 features from the previous queue have been implemented. Brainstorming new features...

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

---

## Updated Feature Queue (2026-05-02)

1. **Track Lane Reorder Drag** - Drag to reorder track lanes in the arrangement view with visual drop indicators
2. **Clip Fade Handles** - Drag handles on clip edges to adjust fade in/out with visual curve preview
3. **Tempo Nudge Buttons** - +/- buttons next to BPM display to nudge tempo by 1 BPM increments
4. **Track Duplicate** - Right-click track menu to duplicate track with all clips and settings
5. **Mute Group Assignment** - Assign tracks to mute groups so muting one mutes others in the group
6. **Clip Split at Playhead** - Keyboard shortcut `S` splits selected clip at playhead position
7. **Velocity Draw Tool** - Draw velocity values directly on MIDI/audio clips with a pencil tool
8. **Master Limiter** - Add a brickwall limiter to the master chain for loudness control
9. **Track Solo Defeat** - Hold Alt+click solo to solo ONLY that track, defeating other solo states
10. **Auto-Save Interval Setting** - User-configurable auto-save interval (30s, 1min, 2min, 5min, off)

