## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. ~~**Tempo Nudge Controls** - Add +/- buttons for fine tempo adjustment (0.1 BPM steps)~~ ✅
2. ~~**Clip Opacity Control** - Slider to adjust clip opacity in timeline for visual layering~~ ✅
3. ~~**Grid Snap Intensity** - Adjustable snap strength (0-100%) for how strongly clips snap to grid~~ ✅
4. ~~**Playhead Marker Drop** - Double-click/double-tap timeline to create quick marker~~ ✅
5. ~~**Audio Normalization** - One-click normalize audio clip to peak/RMS level~~ ✅
6. ~~**Mute Automation** - Automate mute state changes over time on tracks~~ ✅
7. ~~**Track Reverse Playback** - Play track content backwards in real-time~~ ✅
8. ~~**Track Height Memory** - Remember custom track heights across sessions~~ ✅
9. ~~**Marker Navigation** - Jump to timeline markers with number keys (TimelineMarkers already exists)~~ ✅
10. ~~**Track Lane Expand/Collapse** - Collapse MIDI tracks to single row view (TrackStack already exists)~~ ✅

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
