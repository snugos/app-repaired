## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Freeze** ✅ - Completed: `js/TrackFreeze.js` + menu integration
2. **Clip Fade Handles** ✅ - Already implemented: `js/ClipFadeHandles.js` with visual drag handles
3. **Metronome Accent Patterns** ✅ - Just completed: `js/MetronomeAccentPatterns.js` + menu integration
4. **CPU Performance Monitor** ✅ - Just completed: `js/PerformanceMonitor.js` + transport bar display
5. **Timeline Snap Resolution Toggle** ✅ - Just completed: `js/TimelineSnapResolution.js` + transport bar button
6. **Note Length Default** ✅ - Just completed: `js/NoteLengthDefault.js` + transport button + menu
7. **Audio Normalization** - Normalize selected audio clips to a target dB level
8. **Export Selection Range** - Export only a selected time range as WAV instead of entire project
9. **MIDI CC Learn** - Click a knob in effects rack then move MIDI CC to map it
10. **Track Grouping** - Group tracks together so solo/mute affects them as a unit

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