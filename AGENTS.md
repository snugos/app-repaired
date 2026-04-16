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
### 2026-04-16 — Day 1
- Saved `v1` branch snapshot
- Set up daily improvement mandate
- App loads and is functional (basic track creation, sound browser, transport)
- **Metronome** (`audio.js`): Added Tone.Transport-synced metronome with triangle-wave click synth. Bar 1 uses C6 accent, beat 1 uses C5, all other 16ths silent. Connected directly to `Tone.Destination` (bypasses master bus so it's always audible). Toggle wired to global control bar "Metronome" button. Functions: `setMetronomeEnabled`, `isMetronomeEnabled`, `setMetronomeVolume`.
- **Global controls bar**: Added "Metronome" toggle button between Master meter and MIDI/KBD indicators. Blue active state when on.
- **Bug fixes**: Fixed typos `isReconstructinging` → `isReconstructing` in main.js.
- **Version**: Bumped to 0.2.0 in `constants.js`.

### 2026-04-17 — Day 2
- **Count-in before playback** (`audio.js`, `eventHandlers.js`, `index.html`, `main.js`): Added configurable count-in (1, 2, or 4 bars) that plays before transport starts. Uses existing metronome clicks during count-in. Only triggers on fresh start (not resume from pause). Selector dropdown in global controls bar next to Metronome button. Functions added to `audio.js`: `getCountInBars()`, `setCountInBars()`, `isCountInActive()`, `startCountIn()`, `cleanupCountIn()`.
- **Keyboard Shortcuts Overlay** (`eventHandlers.js`, `style.css`, `index.html`, `main.js`): Added `showKeyboardShortcutsModal()` function that displays a styled modal with all keyboard shortcuts organized by category (Transport, Track Navigation, Keyboard Input, Undo/Redo, General). Triggered by pressing `?` key or clicking new `?` button in the global controls bar. Tab key cycles through armed tracks (Shift+Tab goes backwards). Button added to global controls bar with id `shortcutsBtnGlobal`. CSS custom styling for `.keyboard-shortcuts-modal` class. Shortcuts include: Space=play/pause, Tab=cycle track, Z/X=octave, Ctrl+Z/Y=undo/redo, ?=help overlay.

### 2026-04-16 — Day 3
- **Auto-save to localStorage** (`state.js`, `main.js`): Added automatic project saving to browser localStorage every 2 minutes. Project is only saved when at least one track exists. Functions added to `state.js`: `startAutoSave()`, `stopAutoSave()`, `autoSaveToLocalStorage()`, `hasAutoSavedProject()`, `getAutoSavedProjectTimestamp()`, `recoverAutoSavedProject()`, `clearAutoSavedProject()`. On startup, a recovery dialog offers to restore any auto-saved project (with timestamp). Exposed via `appServices`: `autoSaveNow`, `clearAutoSave`, `hasAutoSavedProject`, `getAutoSavedTimestamp`. Handles localStorage quota exceeded errors gracefully.

### 2026-04-18 — Day 3
- **Tap Tempo** (`index.html`, `audio.js`, `main.js`, `eventHandlers.js`): Added tap tempo functionality. Tap the "Tap" button (or press T key) multiple times to set tempo from your tap interval. Uses rolling average of last 8 taps, resets if gap > 2 seconds. New button `tapTempoBtnGlobal` added next to BPM input in global controls bar. Functions added to `audio.js`: `resetTapTempo()`, `tapTempo()`, `getTapTempoBpm()`, `isTapTempoReady()`. When ready, updates both the Tone.Transport BPM and the tempo input field, with notification showing the detected BPM. `T` key added to keyboard shortcuts overlay under Transport section.

### 2026-04-19 — Day 4
- **Sound Browser Search/Filter** (`ui.js`): Added search input field to Sound Browser window for filtering sounds by filename. Type in the search box to instantly filter the current directory's files. Folders are recursively searched for matching filenames. When a search query matches no files, a helpful message "No sounds match 'query'" is shown. Module-level variable `soundBrowserSearchQuery` tracks current search. New function `renderSoundBrowserDirectoryFiltered()` handles the filtering logic. Original `renderSoundBrowserDirectory()` refactored to delegate to the filtered version with empty query. Search is case-insensitive and updates in real-time as user types.
