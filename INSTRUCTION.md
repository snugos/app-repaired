# INSTRUCTION.md - Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Granular Synthesis Engine** - Granular synthesis with position, density, and pitch controls
2. **Modulation Matrix** - Complex modulation routing between parameters
3. **Scripting Engine** - Custom JavaScript-based effects and generators

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

## When Queue is Empty - New Feature Ideas (2026-04-24 12:00 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support

New Feature Queue:
1. **Modulation Matrix** - Complex modulation routing between parameters
2. **Scripting Engine** - Custom JavaScript-based effects and generators
3. **AI Mixing Assistant** - AI-powered mixing suggestions and auto-balance
4. **Sample Library Integration** - Built-in sample library browser with preview
5. **Voice Characterization** - Vocal character analysis and enhancement
6. **Audio-to-Score Enhancement** - Improved polyphonic transcription
7. **Spatial Reverb** - 3D position-aware reverb
8. **MIDI Effect Rack** - Chainable MIDI effects (arpeggiator, chord, etc.)
9. **Stem Separation** - AI-based stem separation from mixed audio
10. **Adaptive Resonance** - Self-oscillating filter with auto-tracking