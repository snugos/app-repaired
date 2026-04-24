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

1. **Adaptive Dynamics** - Dynamics processor that adapts attack/release based on input character
2. **Spectral Imaging** - Visual feedback showing frequency spread and stereo field
3. **Smart Panic** - Panic button with gradual fade option to avoid clicks
4. **Track Lane Sync** - Auto-alignment of multiple selected tracks to the grid
5. **Loop Remover** - Detect and remove dead loops/regions in audio clips
6. **Scale Suggestion** - AI-powered scale suggestions based on audio content
7. **Signal Routing Matrix** - Visual node-based routing for complex signal chains
8. **Clip Gain Envelope** - Draw volume automation directly on audio clips
9. **MIDI Channel Remap** - Remap MIDI channels across tracks/buses
10. **Waveform Overlay Mode** - Compare audio takes by overlaying waveforms

**Status: 10 NEW FEATURES TO IMPLEMENT**

**Total Features: 367+**

---

## Non-Browser Features (Cannot Implement):
- VST3 Plugin Loading (requires native bridge)
- AU Plugin Support (requires native bridge)
- ReWire Support (requires native bridge)