## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Templates** - Save/load track configurations as presets
2. **Automation Lanes** - Visual automation editor for all parameters
3. **Pattern Length Per Track** - Variable pattern lengths per track
4. **Stem Export** - Export each track as a separate audio file
5. **Sample Browser Search** - Search/filter sounds in the sound browser by name

## When Queue is Empty - New Feature Ideas

New Feature Queue:
1. **MIDI Learn Panel** - Visual panel to configure MIDI CC mappings for all parameters
2. **Keyboard Shortcuts Panel** - Press `?` to show all keyboard shortcuts
3. **Track Color Picker** - Change track colors from a color palette
4. **Note Length Editing** - Edit individual note lengths in piano roll
5. **Audio Normalization** - Auto-normalize recorded or imported audio
6. **Ruler Selection** - Click and drag on ruler to select time range
7. **Copy/Paste Patterns** - Copy and paste sequence patterns between tracks
8. **MIDI File Export** - Export sequences to standard .mid files
9. **Audio Resample** - Resample audio at different quality/bitrate
10. **Track Icon** - Assign icons to tracks for visual identification

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