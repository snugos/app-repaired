## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Clip Reverse** - Reverse audio/MIDI clips with one click, with preview before applying
2. **Track Grouping** - Group multiple tracks into folders with nested mixing and collapse/expand
3. **Step Sequencer Mode** - Classic 16-step drum sequencer grid for programming beats
4. **Tempo Tap Pad** - Tap to set tempo from rhythmic input with averaging
5. **Clip Fade Handles** - Drag handles on clip edges to create fade in/out curves
6. **Track Solo Mode** - Solo button isolates track, replacing global solo behavior
7. **Audio Normalize** - Auto-normalize audio clips to peak or loudness target
8. **MIDI CC Automation** - Draw MIDI controller automation lanes on tracks
9. **Transport Loop Count** - Set number of loop repetitions before stopping playback
10. **Mixer Snapshot** - Save and recall full mixer states (fader levels, pans, mutes)

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
