## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Templates** - Save/load track configurations as presets
2. **Automation Lanes** - Visual automation editor for all parameters
3. **Clip Multiplication** - Repeat clips with optional variations
4. **Note Probability** - Set probability for each note (random playback)
5. **Scale Lock** - Force all notes to stay within a musical scale
6. **Micro Tuning** - Custom tuning tables for non-standard scales
7. **MIDI Output** - Send MIDI to external devices via Web MIDI API

## When Queue is Empty - New Feature Ideas

New Feature Queue:
1. **MIDI Learn Panel** - Visual panel to configure MIDI CC mappings for all parameters
2. **Sample Browser Search** - Search/filter sounds in the sound browser by name
3. **Export Stems** - Export each track as a separate audio file
4. **Track Color Picker** - Change track colors from a color palette
5. **Keyboard Shortcuts Panel** - Press `?` to show all keyboard shortcuts

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

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`