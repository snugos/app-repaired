# INSTRUCTION.md - Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Granular Processor** - Granular synthesis effect for time-stretching and pitch manipulation ✅ COMPLETED
2. **Convolution Reverb** - Impulse response-based reverb ✅ COMPLETED
3. **Formant Filter** - Vowel-shaped filter for vocal synthesis ✅ COMPLETED
4. **Ring Modulator** - Classic ring modulation effect ✅ COMPLETED
5. **Frequency Shifter** - Linear frequency shifting (not pitch shifting) ✅ COMPLETED
6. **Envelope Generator** - ADSR envelope generator for modulation ✅ COMPLETED

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

## When Queue is Empty - New Feature Ideas (2026-04-24 02:00 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support

New Feature Queue:
1. **Vocoder** - Classic vocoder effect with carrier and modulator
2. **Phaser Effect** - All-pass filter-based phase shifting effect
3. **Flanger Effect** - Time-based delay modulation effect
4. **Chorus Effect** - Detune-based stereo widening effect
5. **Tremolo Effect** - Amplitude modulation effect
6. **Distortion** - Waveshaping distortion effect
7. **Bitcrusher** - Sample rate and bit depth reduction
8. **Compressor** - Full-band dynamics compressor with sidechain
9. **Limiter** - Brick-wall limiter with lookahead
10. **Noise Gate** - Threshold-based gate with attack/release

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`