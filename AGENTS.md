# SnugOS — Browser-Based DAW

## Overview
SnugOS is a browser-based DAW (Digital Audio Workstation) powered by Tone.js. It runs as a static site deployed via GitHub Pages from the `LWB-with-Bugs` branch.

**Live:** https://snugos.github.io/app/
**Repo:** https://github.com/snugos/app
**Repo branch deployed:** `LWB-with-Bugs` ← ALL development happens here
**v1 snapshot:** branch `v1` — frozen snapshot of the deployed app at the start of the improvement project

## Tech Stack
- Tone.js (audio engine) loaded via CDN
- Tailwind CSS (CDN)
- JSZip (sound library loading)
- Vanilla JS modules (no build step, ES modules via import/export)
- GitHub Pages (static hosting)
- GitHub Actions (CI/CD)

## Key Files
| File | Purpose |
|---|---|
| `js/main.js` | App orchestrator, init, transport |
| `js/state.js` | Central state (tracks, windows, undo/redo) |
| `js/audio.js` | Tone.js audio engine, sample loading, recording |
| `js/Track.js` | Track class (Synth, Sampler, DrumSampler, InstrumentSampler, Audio) |
| `js/ui.js` | Window/DOM rendering, knobs, pads, sequencer grid |
| `js/eventHandlers.js` | Global keyboard/MIDI/click event handling |
| `js/SnugWindow.js` | Draggable/resizable window class |
| `js/utils.js` | Notifications, modals, context menus, drop zones |
| `js/effectsRegistry.js` | Tone.js effect definitions and param schemas |
| `js/constants.js` | App version, synth pitches, keyboard maps |
| `style.css` | Dark theme CSS |
| `index.html` | Entry point, global controls bar |
| `assets/drums.zip` | Built-in drum sounds |
| `assets/instruments.zip`, `instruments2.zip`, `instruments3.zip` | Built-in instruments |

## Branch Strategy
- **`LWB-with-Bugs`** — Working branch. All improvements land here. Auto-deployed to GitHub Pages.
- **`main`** — Has divergent history from past force-pushes; do NOT use as base.
- **`v1`** — Frozen snapshot of the initial deployed version.
- **Other branches** — Discard (`Main-Backup`, `THIS-BUILD-WORKS`, etc.)

## Deployment
GitHub Pages serves the root of `LWB-with-Bugs`. The `/.github/workflows/` directory does NOT currently exist — CI/CD needs to be set up.

## Development Workflow
1. All changes made to files in `/home/workspace/app/`
2. Committed to `LWB-with-Bugs` branch
3. Pushed to `origin/LWB-with-Bugs`
4. GitHub Pages auto-deploys (or manual trigger)

## CI/CD (TODO)
Need to create `.github/workflows/deploy.yml` that:
- Triggers on push to `LWB-with-Bugs`
- Runs no build step (static site)
- Deploys to GitHub Pages

## Known Issues / TODO
- [ ] Duplicate function cleanup in ui.js (historical issue, many "fix duplicate" commits)
- [ ] `main` branch diverged via force-push; do not merge into working branch
- [ ] `.tmp` files scattered in js/ directory
- [ ] No automated tests
- [ ] Audio engine: no Web Audio error recovery after Tone.context suspension
- [ ] DrumSampler: pad drop zones need verification after pad selection
- [ ] Recording: needs end-to-end test with real microphone
- [ ] Undo/redo: verify all state mutations go through the capture mechanism

## Improvement Log
### 2026-04-16 — Project start
- Saved `v1` branch snapshot
- Set up daily improvement mandate
- App loads and is functional (basic track creation, sound browser, transport)
