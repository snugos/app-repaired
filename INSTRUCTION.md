## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Archive** - Archive tracks to save CPU without deleting ✅ COMPLETED
2. **MIDI Multi-Channel** - Support multiple MIDI channels per track ✅ COMPLETED
3. **Session Templates** - Save/load full session configurations ✅ COMPLETED
4. **Step Sequencer Probability** - Per-step chance of note triggering ✅ COMPLETED
5. **Clip Gain Envelope** - Draw volume automation directly on audio clips ✅ COMPLETED
6. **Audio Reverse** - Reverse audio clips with a button ✅ COMPLETED
7. **Tempo Nudge** - Fine tempo adjustment with arrow keys ✅ COMPLETED

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