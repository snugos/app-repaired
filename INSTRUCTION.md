## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Tempo Ramper Visual Editor** - Draw tempo automation curves on a timeline for gradual BPM changes
2. **Lyrics Track Timeline** - Display lyrics synced to the timeline for vocal recording/visualization
3. **Time Signature Per Track** - Allow different time signatures per track for polyrhythmic compositions
4. **Sidechain Volume Envelope** - Draw ducking volume curves directly on clips for sidechain effects
5. **Clip Gain Envelope Quick** - Double-click clip top to add gain envelope points without opening full editor
6. **Track Freeze Export** - One-click export of frozen track stems to audio files
7. **MIDI Chord Display** - Show chord names (Cmaj7, D7, etc.) above MIDI clip sections
8. **Loop Region Markers** - Add named markers at loop boundaries for section referencing
9. **BPM Tap Avg Display** - Show rolling average of last N tap tempo values in transport bar
10. **Audio Clip Stretch Markers** - Visual markers showing where audio was time-stretched

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