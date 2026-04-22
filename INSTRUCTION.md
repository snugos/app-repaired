## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue (2026-04-22 14:00 UTC)

All previous feature queues are COMPLETE. The following new features were generated through brainstorming:

### New Feature Queue (2026-04-22 14:00 UTC)

1. **Scatter/Chaos Effect** - Randomize note timing/velocity for experimental patterns ✅ COMPLETE
2. **Lyrics Track** - Add text lyrics that sync to timeline position
3. **Video Sync Output** - Send LTC timecode for video sync applications
4. **Clip Envelope Editor** - Draw AHDSR envelopes on audio clips
5. **Rhythmical Groove Drawing** - Draw custom groove patterns visually
6. **VST Host Foundation** - Prepare architecture for VST/AU plugin hosting
7. **Cloud Project Storage** - Save/load projects to cloud storage
8. **Share Link Generator** - Generate shareable links to exported audio
9. **Instrument Rack** - Group multiple instruments into a single rack with layered sounds ✅ COMPLETE (2026-04-22)

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