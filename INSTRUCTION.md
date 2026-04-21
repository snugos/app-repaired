## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Send Effects Routing** - Create dedicated reverb/delay send buses with per-track send levels ✅ COMPLETED
2. **Sidechain Compression** - Easy sidechain input selector for compressor effect ✅ COMPLETED

## When Queue is Empty - New Feature Ideas

New Feature Queue:
3. **Automation Curves** - Different curve types (linear, exponential, stepped) for automation lanes
4. **Track Archive** - Archive tracks to save CPU without deleting
5. **MIDI Multi-Channel** - Support multiple MIDI channels per track
6. **Session Templates** - Save/load full session configurations
7. **Step Sequencer Probability** - Per-step chance of note triggering
8. **Clip Gain Envelope** - Draw volume automation directly on audio clips
9. **Audio Reverse** - Reverse audio clips with a button
10. **Tempo Nudge** - Fine tempo adjustment with arrow keys

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

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`