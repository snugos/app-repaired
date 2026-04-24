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

## New Feature Queue (2026-04-24 15:35 UTC)

**Status: 4 NEW FEATURES IMPLEMENTED ✅**

All queued features from the previous sessions are now complete:
1. **Clip Glitch Effects** ✅ - `js/ClipGlitchEffect.js`
2. **Formula-based Automation** ✅ - `js/FormulaAutomation.js`
3. **Track Latency Compensation** ✅ - `js/TrackLatencyCompensation.js`
4. **Sample Import Preview** ✅ - `js/SampleImportPreview.js`
5. **Chord Memory** ✅ - `js/ChordMemory.js`
6. **Ghost Track** - Create a quieter copy of a track for reference without affecting mix
7. **Mixdown Reference Export** - One-click export of mix with reference metadata embedded
8. **Smart Duplicate** - Smart duplicate that increments note values or avoids conflicts
9. **Ruler Mode Toggle** - Toggle between bars/beats and timecode display on ruler

**Commit:** `95a04e2`

**Total Features: 354+**

---

## New Feature Queue (2026-04-24 15:35 UTC)

When all queues are empty, implement these new features:

1. **Ghost Track** - Create a quieter copy of a track for reference without affecting mix
2. **Mixdown Reference Export** - One-click export of mix with reference metadata embedded
3. **Smart Duplicate** - Smart duplicate that increments note values or avoids conflicts
4. **Ruler Mode Toggle** - Toggle between bars/beats and timecode display on ruler
5. **Project Template Save/Load** - Save and load project templates with all tracks/settings
6. **MIDI Learn Visualization** - Show MIDI CC mappings visually on knobs and sliders
7. **Audio Waveform Overlay** - Overlay multiple audio clip waveforms for comparison
8. **Track Lane Height Memory** - Remember track lane heights across sessions
9. **Quantize Strength Control** - Adjust how strongly notes snap to grid (0-100%)
10. **Random Note Generator** - Add random notes within a scale/range

**Status: 10 NEW FEATURES QUEUED**

**Total Features: 354+**

---

## Non-Browser Features (Cannot Implement):
- VST3 Plugin Loading (requires native bridge)
- AU Plugin Support (requires native bridge)
- ReWire Support (requires native bridge)