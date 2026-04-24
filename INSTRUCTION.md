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
**Last Verified**: 2026-04-24 16:15 UTC
**Total JS Files**: 273
**Total Lines of Code**: 201,451
**Total Features**: 367+

## New Feature Queue (2026-04-24 16:15 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support
- 367+ features already implemented

Generate 10 NEW feature ideas that are:
1. Achievable in a single session
2. Complement existing features
3. Enhance creative workflow

**New Feature Queue:**

1. **Ripple Edit Mode** - When clips are deleted/moved, automatically close gaps across tracks ✅ COMPLETED
2. **Adaptive Dynamics** - Dynamics processor that adapts attack/release based on input character ✅ COMPLETED
3. **Spectral Imaging** - Visual feedback showing frequency spread and stereo field ✅ COMPLETED
4. **Smart Panic** - Panic button with gradual fade option to avoid clicks ✅ COMPLETED
5. **Track Lane Sync** - Auto-alignment of multiple selected tracks to the grid ✅ COMPLETED
6. **Loop Remover** - Detect and remove dead loops/regions in audio clips ✅ COMPLETED
7. **Scale Suggestion** - AI-powered scale suggestions based on audio content ✅ COMPLETED
8. **Signal Routing Matrix** - Visual node-based routing for complex signal chains ✅ COMPLETED
9. **Clip Gain Envelope** - Draw volume automation directly on audio clips ✅ COMPLETED
10. **MIDI Channel Remap** - Remap MIDI channels across tracks/buses ✅ COMPLETED
11. **Waveform Overlay Mode** - Compare audio takes by overlaying waveforms ✅ COMPLETED
12. **Formant Shift** - Vocal formant shifting for gender/character effects ✅ COMPLETED
13. **Resonator Bank** - Resonant filters for metallic/bell-like sound design ✅ COMPLETED

**Status: ALL FEATURES COMPLETE ✅**

**Total Features: 371+**

---

## Non-Browser Features (Cannot Implement):
- VST3 Plugin Loading (requires native bridge)
- AU Plugin Support (requires native bridge)
- ReWire Support (requires native bridge)

---

## New Feature Queue (2026-04-24 17:00 UTC)

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support
- 377+ features already implemented

**New Feature Queue:**

1. **Frequency Splitter** - Split audio into multiple frequency bands for parallel processing ✅ COMPLETED (2026-04-24)
2. **Pitch Drift** - Gradual pitch drift effect for creating subtle vibrato/wobble ✅ COMPLETED (2026-04-24)
3. **Harmonic Exciter** - Add harmonic content to dull recordings ✅ COMPLETED (2026-04-24)
4. **Mid-Side Encoder/Decoder** - Convert between stereo and mid-side representation
5. **Timestretch Display** - Visual preview of how audio will be stretched
6. **Frequency Shifter** - Shift frequencies without changing pitch (for special effects)
7. **Phase Scope** - Real-time phase correlation visualization
8. **Noise Gate Enhancement** - Advanced gate with frequency-aware triggering
9. **Sub-Harmonic Generator** - Add sub-bass content for weight and power
10. **Sample Slicer** - Slice audio samples into rhythmic segments with transient detection ✅ COMPLETED (2026-04-24)

**Status: 6 NEW FEATURES TO IMPLEMENT**

**Total Features: 381+**