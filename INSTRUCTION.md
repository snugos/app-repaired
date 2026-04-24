## New Feature Queue (2026-04-24 02:15 UTC)

When all queues are empty, implement these new features:

1. **Audio Limiter** - Brick-wall limiter with lookahead and release ✅ INTEGRATED
2. **MIDI Channel Filter** - Filter MIDI by channel with pass/block lists ✅ INTEGRATED
3. **Track Freeze All** - Freeze all tracks at once for CPU savings ✅ INTEGRATED
4. **Mixdown Ghost** - Real-time dry/wet comparison toggle for effects ✅ INTEGRATED
5. **Scale Suggestion** - AI-powered scale suggestion based on audio melody
6. **Adaptive Q** - Auto-adjust EQ Q based on frequency content
7. **Drum Replace** - Replace drum samples by detected hit type (kick/snare/hat)
8. **One-Knob Master** - Single knob for "loudness maximization" chain

## Previous Completed Features

- Track Stack, Splice Detector, and other features already integrated in prior sessions

---

## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

The feature queue is maintained in AGENTS.md. See the "New Feature Queue (2026-04-24 02:15 UTC)" section above for the current features to implement.

## Workflow

### Step 1: Pick Next Feature
- Read AGENTS.md for the current feature queue
- Work on features IN ORDER

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
- Update AGENTS.md to mark it as completed
- Move to the next feature in the queue

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