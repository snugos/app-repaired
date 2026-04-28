## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Auto-Ducking Threshold** - Set automatic threshold for track ducking based on content analysis
2. **Chord Progression Saver** - Save and recall chord progressions as templates for song sections
3. **Multi-FX Preset Bank** - Browse and apply bundled multi-effect chain presets
4. **Region Duplicate Mode** - Duplicate a selected region across the timeline with offset clips
5. **Track Solo PFL** - Pre-fader solo for isolated monitoring of track signal chain
6. **Clip Reverse Playback** - Play audio/MIDI clips in reverse for experimental sounds
7. **Tempo Grid Snap** - Snap note placement to a grid that adjusts with tempo changes
8. **Mixer Snapshot** - Save and recall complete mixer states (faders, pans, sends, mute/solo)
9. **Audio Quantize Strength** - Adjustable strength slider for audio beat alignment (0-100%)
10. **Send Level Envelope** - Draw automation for track send levels over time

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