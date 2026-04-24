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

## New Feature Queue (2026-04-24 15:40 UTC)

**Status: 3 NEW FEATURES IMPLEMENTED ✅**

All queued features from the previous sessions are now complete:
1. **Track Latency Compensation** ✅ - `js/TrackLatencyCompensation.js`
2. **Sample Import Preview** ✅ - `js/SampleImportPreview.js`
3. **Chord Memory** ✅ - `js/ChordMemory.js`
4. **Formula Automation** ✅ - `js/FormulaAutomation.js`
5. **Ghost Track** ✅ - `js/GhostTrack.js`
6. **Smart Duplicate** ✅ - `js/SmartDuplicate.js`
7. **Ruler Mode Toggle** ✅ - `js/RulerModeToggle.js`

**Remaining Queue:**
1. **Project Template Save/Load** - Save and load project templates with all tracks/settings
2. **MIDI Learn Visualization** - Show MIDI CC mappings visually on knobs and sliders
3. **Audio Waveform Overlay** - Overlay multiple audio clip waveforms for comparison
4. **Track Lane Height Memory** - Remember track lane heights across sessions
5. **Quantize Strength Control** - Adjust how strongly notes snap to grid (0-100%)
6. **Random Note Generator** - Add random notes within a scale/range

**Commit:** `eea4eb6`

**Total Features: 357+**

---

## Non-Browser Features (Cannot Implement):
- VST3 Plugin Loading (requires native bridge)
- AU Plugin Support (requires native bridge)
- ReWire Support (requires native bridge)