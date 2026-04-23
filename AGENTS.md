## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

All previous feature queues are COMPLETE. The following new features were generated through brainstorming:

### New Feature Queue (2026-04-23 10:45 UTC)

1. **Track Lane Resize** - Drag track lane dividers to resize track heights
2. **Snap-to-Grid Options** - Per-track snap resolution (1/4, 1/8, 1/16, etc.)
3. **Audio Spectrum Analyzer** - Real-time FFT spectrum display per track
4. **MIDI CC Keyboard Map** - Visual map of MIDI CC assignments
5. **Track Solo Groups** - Create solo groups where only one track can be soloed at a time
6. **Audio Bitcrusher Effect** - Lo-fi bitcrush effect for distortion
7. **Clip Fade Curves** - Visual curve editor for clip fade in/out shapes
8. **Project Auto-save** - Automatic periodic project saving
9. **Tempo Tap Calculator** - Tap tempo to calculate BPM display
10. **Keyboard Shortcut Customizer** - Customize key bindings from UI

### Conclusion

All browser-implementable features have been completed. The codebase is feature-complete with 125+ features implemented.

Features requiring native bridges (NOT IMPLEMENTABLE in browser):
- VST3 Plugin Loading
- AU Plugin Support
- ReWire Support

## Completed Features

- **MIDI Chord Player** - On-screen piano that plays chords from single key press ✅ COMPLETED (2026-04-23)
- **AI Mastering** - Apply AI-driven loudness normalization and EQ matching ✅ COMPLETED (2026-04-23)
- **Mixdown Visualizer** - Real-time stereo field and correlation meter ✅ COMPLETED
- **Clip Graffiti** - Freehand drawing and memo overlay on audio clips ✅ COMPLETED (2026-04-23)

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
