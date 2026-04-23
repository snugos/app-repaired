## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

**ALL FEATURES COMPLETE ✅** (2026-04-23 12:25 UTC)

The following features from the previous queue have been verified as implemented:

| Feature | Status |
|---------|--------|
| Track Lane Resize | ✅ EXISTS (`js/TrackLaneResize.js`) |
| Snap-to-Grid Options | ✅ EXISTS (`js/Track.js`) |
| Audio Spectrum Analyzer | ✅ EXISTS (`js/ui.js`) |
| MIDI CC Keyboard Map | ✅ EXISTS (`js/ui.js`) |
| Track Solo Groups | ✅ EXISTS (`js/state.js`) |
| Audio Bitcrusher Effect | ✅ COMPLETED (2026-04-23) |
| Clip Fade Curves | ✅ EXISTS (`js/Track.js`) |
| Project Auto-save | ✅ EXISTS (`js/state.js`) |
| Tempo Tap Calculator | ✅ EXISTS (`js/ui.js`) |
| Keyboard Shortcut Customizer | ✅ EXISTS (`js/Track.js`, `js/ui.js`) |

### Conclusion

All browser-implementable features have been completed. The codebase is feature-complete with **126+ features** implemented.

Features requiring native bridges (NOT IMPLEMENTABLE in browser):
- VST3 Plugin Loading
- AU Plugin Support
- ReWire Support

## Completed Features

- **MIDI Chord Player** - On-screen piano that plays chords from single key press ✅ COMPLETED (2026-04-23)
- **AI Mastering** - Apply AI-driven loudness normalization and EQ matching ✅ COMPLETED (2026-04-23)
- **Mixdown Visualizer** - Real-time stereo field and correlation meter ✅ COMPLETED
- **Clip Graffiti** - Freehand drawing and memo overlay on audio clips ✅ COMPLETED (2026-04-23)
- **Audio Bitcrusher Effect** - Lo-fi bitcrush effect for distortion ✅ COMPLETED (2026-04-23)

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
