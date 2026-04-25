# AGENTS.md — snugsworth's Workspace

## GitHub Access
- **Org**: snugos | User: snugsworth
- **Auth**: via Zo secrets (not stored in file)

## Repositories (snugos org)

| Repo | Lang | Lines | Description |
|------|------|-------|-------------|
| `snugos/app` | JS | ~22K | SnugOS — browser DAW (Tone.js), v0.5.6 |
| `snugos/space` | TypeScript/React | ~600 | 3D multiplayer world (PeerJS) |
| `snugos/3d-space` | TypeScript/React | ~600 | 3D world variant (PartyKit) |
| `snugos/palopseegame` | JS | ~1K | Chrome Dino-style runner + Firebase + Gemini |
| `snugos/music-store` | TypeScript | ~200 | Stripe beat tape storefront (Vercel) |
| `snugos/dreams` | HTML | ~1 | Audio-reactive particle landing page |
| `snugos/beta` | JS | — | Older SnugOS (deprecated) |
| `snugos/snugos-new` | JS | — | Staging clone of `app` |
| `snugos/scribbleton` | — | — | Empty repo |
| `snugos/scribbletonlive` | Vue | — | SnugOS DAW port to Vue/Nuxt |

## App (snugos/app) — Top Issues Logged

**3 High Severity:**
1. `updateSequencerCellUI` uses undefined `j` instead of `col`
2. `getIsReconstructingingDAW` triple-g typo → always `false` (recovery broken)
3. `rebuildMasterEffectChain` early `return` in `forEach` — entire chain drops

**Full bug log:** `Repos/app/ERROR_LOG.md`

## Space (snugos/space, snugos/3d-space)
- PeerJS vs PartyKit mismatch — different servers for same project type
- `sendPosition` exported but never called
- `localhost:1999` hardcoded in 3d-space useMultiplayer (production break)

## Music Store (snugos/music-store)
- Dead CashApp code path (condition makes it unreachable)
- No email fulfillment wired (webhook logs only)
- In-memory webhook deduplication (lost on cold start)
- `BASE_URL` fallback to localhost in production

## Palopsee Game (snugos/palopseegame)
- `http://` asset URLs (mixed content on HTTPS)
- Firebase anonymous auth every load (no persistence)
- Gemini banter innerHTML injection risk
- No `geminiApiKey` export from config.js

## Dreams (snugos/dreams)
- Static HTML + Tone.js audio — no JS source to study (only index.html)

## SnugOS DAW (app-repaired) — Status: FEATURE-COMPLETE ✅

**Repository**: LWB-with-Bugs branch (up to date)
**Last Verified**: 2026-04-25 00:40 UTC
**Total JS Files**: 283
**Total Lines of Code**: 202,648
**Total Features**: 416+

---

## New Feature Queue (2026-04-25 00:40 UTC)

**Status: ALL 10 NEW FEATURES COMPLETED ✅**

All 10 features from the previous queue are now implemented:
1. **ResonantFilterBank** ✅ - `js/ResonantFilterBank.js` - Multi-band filter with per-band drive
2. **ChorusEnsemble** ✅ - `js/ChorusEnsemble.js` - Thick chorus effect with multiple delay lines
3. **TapeStopEffect** ✅ - `js/TapeStopEffect.js` - Realistic tape slowdown and stop effect
4. **BitcrushFilter** ✅ - `js/BitcrushFilter.js` - Lo-fi sample rate and bit depth reduction
5. **FrequencyIsolator** ✅ - `js/FrequencyIsolator.js` - Isolate specific frequency ranges for analysis
6. **AutoPanSync** ✅ - `js/AutoPanSync.js` - Pan automation synced to tempo
7. **SidechainGate** ✅ - `js/SidechainGate.js` - Gate that responds to sidechain input
8. **SpectralFlanger** ✅ - `js/SpectralFlanger.js` - Flanger with frequency-dependent modulation
9. **TextureSynth** ✅ - `js/TextureSynth.js` - Additive synthesizer for textural pads
10. **DriftOscillator** ✅ - `js/DriftOscillator.js` - Oscillator with pitch drift for analog feel

**Commit:** `a38bb21`

**Total Features: 416+**

---

## Non-Browser Features (Cannot Implement):
- VST3 Plugin Loading (requires native bridge)
- AU Plugin Support (requires native bridge)
- ReWire Support (requires native bridge)

---

## New Feature Queue (2026-04-25 00:35 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support
- 406+ features already implemented

**New Feature Queue:**

1. **Resonant Filter Bank** - Resonant multi-band filter with per-band drive
2. **Chorus Ensemble** - Thick chorus effect with multiple delay lines
3. **Tape Stop Effect** - Realistic tape slowdown and stop effect
4. **Bitcrush Filter** - Lo-fi sample rate and bit depth reduction
5. **Frequency Isolator** - Isolate specific frequency ranges for analysis
6. **AutoPan Sync** - Pan automation synced to tempo
7. **Sidechain Gate** - Gate that responds to sidechain input
8. **Spectral Flanger** - Flanger with frequency-dependent modulation
9. **Texture Synth** - Additive synthesizer for textural pads
10. **Drift Oscillator** - Oscillator with pitch drift for analog feel

**Status: 0 OF 10 NEW FEATURES COMPLETED**

---

## New Feature Queue (2026-04-24 19:20 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support
- 406+ features already implemented

**New Feature Queue:**

1. **Frequency Splitter** - Split audio into multiple frequency bands for parallel processing ✅ COMPLETED (2026-04-24)
2. **Pitch Drift** - Gradual pitch drift effect for creating subtle vibrato/wobble ✅ COMPLETED (2026-04-24)
3. **Harmonic Exciter** - Add harmonic content to dull recordings ✅ COMPLETED (2026-04-24)
4. **Mid-Side Encoder/Decoder** - Convert between stereo and mid-side representation ✅ COMPLETED (2026-04-24 17:50)
5. **Timestretch Display** - Visual preview of how audio will be stretched ✅ COMPLETED (2026-04-24 17:50)
6. **Frequency Shifter** - Shift frequencies without changing pitch (for special effects) ✅ COMPLETED (2026-04-24 17:50)
7. **Phase Scope** - Real-time phase correlation visualization ✅ COMPLETED (2026-04-24 17:50)
8. **Noise Gate Enhancement** - Advanced gate with frequency-aware triggering ✅ COMPLETED (2026-04-24 17:50)
9. **Sub-Harmonic Generator** - Add sub-bass content for weight and power ✅ COMPLETED (2026-04-24 17:50)
10. **Sample Slicer** - Slice audio samples into rhythmic segments with transient detection ✅ COMPLETED (2026-04-24)

**Status: ALL 10 NEW FEATURES COMPLETED ✅**

**Commit:** `6e8afea`

**Total Features: 387+**

---

## New Feature Queue (2026-04-24 18:10 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support
- 387+ features already implemented

**New Feature Queue:**
1. **Track Freeze** - Freeze tracks to audio to save CPU, with defrost functionality
2. **Audio Spectrogram** - Real-time spectrogram visualization for tracks
3. **Envelope Shaper** - Volume/pan envelope automation for clips
4. **Tempo Curve Editor** - Edit tempo automation curve with visual points
5. **Track Color Palette** - Multiple track color palettes (neon, pastel, dark)
6. **Smart Quantize** - Intelligent quantization with strength and scale controls
7. **MIDI Monitor** - MIDI input/output monitor panel
8. **Clip Stretcher** - Time-stretch audio clips without changing pitch
9. **Pitch Shift Preview** - Preview pitch-shifted audio before applying
10. **Project Version Manager** - Manage multiple project versions/snapshots
**Status: ALL 10 NEW FEATURES COMPLETED ✅**

**Commit:** `c843cbb`

**Total Features: 397+**

---

## New Feature Queue (2026-04-24 18:40 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support
- 397+ features already implemented

**New Feature Queue:**

1. **Vocoder** - Vocoder effect for robot/voice synthesis ✅ COMPLETED
2. **Ring Modulator** - Classic ring modulation for metallic/distant sounds ✅ COMPLETED (2026-04-24 18:50)
3. **Pitch-Shifted Delay** - Delay with pitch shifting for sci-fi effects ✅ COMPLETED (2026-04-24 18:55)
4. **Granular Reverb** - Grain-based reverb for ambient textures ✅ COMPLETED (2026-04-24 19:10)
5. **Distortion Enhancements** - Add more distortion types (tube, wave, fuzz) ✅ COMPLETED (2026-04-24 19:10)
6. **Filter Chain** - Multiple filters in series for complex sweeps ✅ COMPLETED (2026-04-24 19:15)
7. **Compressor Enhancements** - Add RMS/peak detection modes ✅ COMPLETED (2026-04-24 19:15)
8. **Limiter Modes** - Different limiter release modes (fast, program) ✅ COMPLETED (2026-04-24 19:00)
9. **Tape Echo** - Tape-style echo with natural degradation ✅ COMPLETED (2026-04-24 19:00)
10. **Reverse Reverb** - Reverse reverb tails for atmospheric effects ✅ COMPLETED (2026-04-24 19:05)

**Status: ALL 10 NEW FEATURES COMPLETED ✅**

**Commit:** `e6fb18b`

**Total Features: 406+**