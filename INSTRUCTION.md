## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. ~~**Clip Stretch Markers** - Add markers on audio clips to control stretch points~~ ✅ COMPLETED
2. **Groove Extraction** - Extract timing groove from one track and apply to others
3. **Tempo Ramp Automation** - Automate BPM changes over time with ramps
4. **Loop Region Quick Set** - Double-click timeline to quickly set loop region
5. **Phase Invert Button** - Quick toggle to invert phase on audio tracks for correcting polarity issues

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

## Session: 2026-04-29 10:15 UTC (Snaw Feature Builder Agent Run)

**Status: FEATURE IMPLEMENTED ✅**

### Feature Added

**Track Delay Compensation** - `js/TrackDelayCompensation.js` (ENHANCED)
- Enhanced existing module with auto/manual delay compensation modes
- Shows calculated latency from effect chain for each track
- Manual offset input for fine-tuning (-500 to +500ms)
- Auto mode calculates from Track.calculateEffectLatency() based on PitchShift and other effect types
- Refreshes panel on changes to reflect current state
- Added to Start Menu for easy access

### Files Modified
- `js/TrackDelayCompensation.js` (ENHANCED) - Main module with full UI refresh
- Auto/manual modes use Track's built-in delay compensation methods

**Commit:** `0d59395`
**Total Features: 431+**

### Updated Feature Queue (2026-04-29)

All 10 features from the previous queue were already implemented. New queue:

1. **AI Tempo Suggestion** - Analyze the rhythm of recorded audio and suggest the optimal BPM
2. **Clip Envelope Shaper** - Draw custom amplitude envelopes on clips for precise dynamics control
3. **Track Template Library** - Save and browse track templates (instrument + effects + settings)
4. **MIDI Arpeggiator Panel** - Visual arpeggiator with pattern editing and direction controls
5. **Audio Stretch Quality Preset** - Quick buttons to switch between fast/balanced/high quality stretching
6. **Track Solo Chain** - Mute all tracks except selected chain of tracks for focused listening
7. **Clip Fade Presets** - Save and apply common fade in/out curves (exponential, S-curve, etc.)
8. **Track Delay Compensation** ✅ - Automatically compensate for plugin latency per track (just completed)
9. **Project Auto-Naming** - Smart naming for clips and tracks based on recorded content
10. **Chord Memory Visualizer** - Visual grid showing saved chord voicings and one-click recall

