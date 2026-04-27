## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Lyrics Karaoke Mode** - Display lyrics synced to playback with word-by-word highlighting
2. **Auto-Compression** - Analyze audio and suggest/apply compression settings automatically
3. **Track Headphone Mix** - Per-track headphone volume control separate from main mix
4. **MIDI Velocity-to-CC** - Route MIDI velocity to any MIDI CC parameter for modulation
5. **Audio Ducker** - Sidechain input for automatic volume reduction based on another track
6. **Chord Keyboard Overlay** - Visual keyboard showing chord shapes in real-time
7. **Audio Tap Tempo** - Tap to set tempo from audio input timing detection
8. **Mixer Channel Strip** - Visual channel strip with fader, pan, sends, and routing
9. **Project Version Manager** - Manage multiple project versions/snapshots
10. **MIDI Monitor Panel** - Display MIDI input/output activity in real-time

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
- 419+ features already implemented

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