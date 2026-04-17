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

### 2026-04-20 — Day 5
- **Bug Fix: Mixer Mute/Solo Buttons** (`js/ui.js`): Fixed the mixer window's Mute and Solo buttons. They were incorrectly using `<div>` tags with a closing `</div>` instead of proper `<button>` elements. This prevented the CSS `.muted` (red) and `.soloed` (yellow) styles from applying since the CSS selectors targeted `button.muted` and `button.soloed`. Changed both buttons in `renderMixer()` to proper `<button>` elements with correct `</button>` closing tags. The inspector's mute/solo buttons were already correct.

### 2026-04-21 — Day 6
- **Step Velocity Visual Feedback** (`js/ui.js`, `style.css`): Added velocity-based brightness coloring to sequencer step cells. Higher velocity = brighter purple shades. Updated `updateSequencerCellUI()` to accept a `velocity` parameter (default 0.7) and apply the appropriate CSS class (`vel-100` through `vel-10`). The sequencer click handler now passes the step's velocity when calling `updateSequencerCellUI()`. Added 10 velocity-based CSS classes spanning from `#6d28d9` (100%) to `#faf5ff` (10%), with lower velocities getting progressively lighter and text color darkening for contrast.

### 2026-04-22 — Day 7
- **Timeline Zoom with Scroll Wheel** (`js/ui.js`): Added zoom controls to the Timeline window. Features: zoom in/out buttons with percentage display (25%-400%), scroll wheel zoom (Ctrl+scroll or Cmd+scroll), reset button (1:1). Ruler and tracks area now sync their scroll position horizontally. Background sizes update dynamically based on zoom level. Module-level variables `timelineZoomLevel` and `timelineScrollX` track state. `updatePlayheadPosition()` now reads real transport position from `Tone.Transport.position` instead of requiring a progress argument, making it work as a live update in the animation frame loop.

### 2026-04-23 — Day 8
- **Favorites and Recently Played** (`js/state.js`, `js/ui.js`, `js/main.js`): Added star/unstar (⭐/☆) on any sound in the Browse tab. Favorites and Recent tabs appear in the Sound Browser — click a sound in Browse or hit Preview to add it to Recent. Favorites persist via `localStorage` (`snugosFavorites` key), Recently Played stores last 20 sounds (`snugosRecentlyPlayed` key). State functions: `getFavoriteSounds()`, `toggleFavorite()`, `addToRecentlyPlayed()`, `getRecentlyPlayedSounds()`, `clearRecentlyPlayed()`, `isFavorite()`. UI adds `soundBrowserActiveTab` state and Browse/Favorites/Recent tab buttons. Star button click toggles favorite without selecting (prevents preview button from activating). Recently Played items show how long ago they were played (e.g. "2 min ago").
- **Bug Fixes** (`js/state.js`): Fixed three bugs found during systematic audit:
  1. **Missing `getSoloedTrackIdState()`** — was referenced throughout the codebase (in `getTrackAppServices()`, `gatherProjectDataInternal()`, `reconstructDAWInternal()`) but never defined, silently breaking solo functionality
  2. **Duplicate `setSoloedTrackIdState()`** — function was exported twice at lines 111 and 187
  3. **`getRecentlyPlayedSounds()` localStorage reload bug** — function was reloading from `localStorage` on every call, discarding the in-memory state that `addToRecentlyPlayed()` had just updated, so the Recent tab would show stale/out-of-order data after previewing sounds
- **Sequencer Shift Notes Up/Down** (`js/Track.js`, `js/ui.js`): Added `shiftSequenceNotes(semitones)` method to Track class. Positive semitones shift notes down (lower pitch), negative shifts up. Context menu items "Shift Notes Up" and "Shift Notes Down" added to sequencer right-click menu. Also added Shift+Click shortcut on sequencer grid to transpose all notes up by 1 semitone.
- **Humanize Velocities** (`js/Track.js`, `js/ui.js`): Added `humanizeVelocity(amount)` method to Track class. Randomly varies note velocities within ±amount range (0.05 to 1.0 bounds). Context menu items "Humanize Velocities (+/- 15%)" and "Humanize Velocities (+/- 25%)" added.
- **Step Velocity Editing** (`js/ui.js`): Added right-click context menu on sequencer cells to edit velocity. Menu options: set to 100/80/60/40/20%, +10%, -10%. Ctrl/Cmd+Click copies velocity to clipboard. Shift+Ctrl/Cmd+Click pastes velocity from clipboard.
- **Track Monitoring Toggle** (`js/audio.js`): Added `setTrackMonitoring(trackId, enabled)` function to connect/disconnect mic from audio track input channel for real-time monitoring during recording.
- **Audio.js Bug Fix**: Fixed recorder disposal log message.
