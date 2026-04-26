## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **BPM Detector** - Detect tempo from audio input in real-time using onset detection
2. **Track Freezing** - Freeze tracks to audio to save CPU with one-click defrost
3. **Send Effects (Aux Tracks)** - Add send/aux tracks for reverb, delay send chains
4. **MIDICC Mapper** - Map MIDI CC messages to any plugin parameter for modulation
5. **Track Solo/Mute Groups** - Create groups of tracks that solo/mute together
6. **Plugin Preset Browser** - Browse and manage effect chain presets across the project
7. **Backup Manager** - Auto-backup projects with version history and cloud export
8. **Audio-to-MIDI Batch** - Convert multiple audio regions to MIDI patterns at once
9. **Arrangement Export to Video** - Export arrangement timeline as MP4 video
10. **Track Grouping Panel** - Visual panel to group and color-code track groups

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
