## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Grouping** ✅ ALREADY COMPLETED - Implemented with UI panel, state management, and full group control (volume, mute, solo)

## When Queue is Empty

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support

New Feature Queue:
1. **Send Effects Routing** - Create dedicated reverb/delay send buses with per-track send levels
2. **Sidechain Compression** - Easy sidechain input selector for compressor effect
3. **Track Color Themes** - Multiple color schemes for the UI
4. **Automation Curves** - Different curve types (linear, exponential, stepped) for automation
5. **Audio Stretching** - Elastique-style audio time stretching without pitch change
6. **Track Archiving** - Mute/unmute archive tracks to save CPU
7. **MIDI Multi-Channel** - Support multiple MIDI channels per track
8. **Session Templates** - Save/load full session configurations
9. **Step Sequencer Probability** - Per-step chance of note triggering
10. **Track Lane Solo** - Solo individual lanes within a track

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
