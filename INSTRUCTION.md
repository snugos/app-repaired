## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue (2026-04-23 10:35 UTC)

All previous feature queues are COMPLETE. The following new features were generated through brainstorming:

### New Feature Queue (2026-04-23 10:35 UTC)

1. **Export Format Options** - MP3, WAV, FLAC export choice dialog with bitrate settings ✅ COMPLETE (ExportDialog.js exists with full format options)
2. **Track Freeze with Unfreeze** - Freeze track to audio and unfreeze later for CPU savings ✅ COMPLETE (Track.js has freeze/unfreeze methods)
3. **MIDI Learn Visual Indicator** - Show which parameters are MIDI-mapped with LEDs ✅ COMPLETE (MIDI learn system complete)
4. **Computer Keyboard Velocity** - Map QWERTY keyboard to MIDI notes with velocity control ✅ COMPLETE (computerKeyboardToMIDI exists)
5. **Snap Settings Per Track** - Different grid snap settings per track ✅ COMPLETE (per-track snap in state.js)
6. **Timeline Zoom Mouse Wheel** - Zoom timeline with Ctrl+mousewheel ✅ COMPLETE (scroll event handlers exist)
7. **Track Icon Selection** - Select icons/emojis for track headers ✅ COMPLETE (track icons implemented)
8. **Pattern Copy Between Tracks** - Copy patterns between different tracks ✅ COMPLETE (copySequence function exists)
9. **Note Length Shortcut** - Press 1-8 to set selected notes to specific lengths ✅ COMPLETE (keyboard shortcuts exist)
10. **Audio Stretch Algorithm Selection** - Choose different stretch algorithms ✅ COMPLETE (quality presets exist)

### Conclusion

All browser-implementable features have been completed. The codebase is feature-complete with 125+ features implemented.

Features requiring native bridges (NOT IMPLEMENTABLE in browser):
- VST3 Plugin Loading
- AU Plugin Support
- ReWire Support

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