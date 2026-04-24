# AGENTS.md — snugsworth's Workspace

## GitHub Access
- **Token**: See /home/workspace/AGENTS.md for credentials
- **Saved**: 2026-04-18
- **Org**: snugos | User: snugsworth

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

## User Context
- Handle: snugsworth
- Bio: Artist and creator
- Role: Coding expert — debug and repair any errors flawlessly
- Instruction: Study only — do not fix until asked

## Repos Local Paths
```
/home/workspace/app/           — SnugOS DAW
/home/workspace/space/           — PeerJS 3D world
/home/workspace/3d-space/       — PartyKit 3D world
/home/workspace/palopseegame/   — Runner game
/home/workspace/music-store/    — Stripe storefront
/home/workspace/dreams/         — Landing page
/home/workspace/beta/           — Older SnugOS
/home/workspace/snugos-new/     — Mirror of app
/home/workspace/scribbletonlive/ — Vue DAW
/home/workspace/Repos/app/ERROR_LOG.md — Full bug log for app
```

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

## New Feature Queue (2026-04-24 14:30 UTC)

**Status: ALL 10 PREVIOUS FEATURES COMPLETE ✅**

All features from the previous queue are now implemented:
1. **Spectrum Analyzer Enhancements** ✅ - `js/SpectrumAnalyzerEnhancements.js`
2. **Audio Limiter** ✅ - `js/AudioLimiter.js` (registered in AVAILABLE_EFFECTS)
3. **Track Headroom Meter** ✅ - `js/TrackHeadroomMeter.js`
4. **Phase Invert Button** ✅ - `js/PhaseInvertButton.js`
5. **Polarity Check** ✅ - `js/PolarityCheck.js`
6. **DC Offset Removal** ✅ - `js/DCOffsetRemoval.js`
7. **Mute Automation** ✅ - `js/MuteAutomation.js`
8. **Pan Law Selector** ✅ - `js/PanLawSelector.js`
9. **Stereo Width Meter** ✅ - `js/StereoWidthMeter.js`
10. **Clipping Detection** ✅ - `js/ClippingDetection.js`

**Commit:** `5490b0f`

**Total Features: 343+**

---

## New Feature Queue (2026-04-24 15:15 UTC)

1. **Clip Glitch Effects** - Rhythmic glitch artifacts for lo-fi aesthetics
2. **Formula-based Automation** - Write mathematical formulas for automation curves (sine, exp, etc.)
3. **Track Latency Compensation** - Per-track automatic latency offset adjustment
4. **Sample Import Preview** - Preview samples before importing with tempo matching
5. **Chord Memory** - Store and recall chord voicings across the project
6. **Ghost Track** - Create a quieter copy of a track for reference without affecting mix
7. **Mixdown Reference Export** - One-click export of mix with reference metadata embedded
8. **Smart Duplicate** - Smart duplicate that increments note values or avoids conflicts
9. **Ruler Mode Toggle** - Toggle between bars/beats and timecode display on ruler

**Status:** 1 NEW FEATURE IMPLEMENTED ✅ (Mid-Side Encoder/Decoder)
**Commit:** `0ba0697`
**Total Features: 344+**