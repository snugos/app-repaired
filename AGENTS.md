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
- **Track Color Coding** (`js/constants.js`, `js/Track.js`, `js/ui.js`, `style.css`): Added per-track color coding for visual identification. New `TRACK_COLORS` palette array in constants (12 distinct colors). Track constructor now initializes `trackColor` property cycling through palette by track ID. `setTrackColor(color)` method added to Track class triggers UI refresh. Mixer track strips now show a colored dot next to track name and use track color for the meter bar. Timeline track lanes show color dots in track headers. Right-click context menu on mixer tracks includes "Change Color..." option that opens a color picker modal with swatches. CSS added: `.track-color-dot`, `.track-color-picker`, `.track-color-swatch` with hover/selected states.

### 2026-04-24 — Day 9
- **Loop Region Markers** (`index.html`, `js/audio.js`, `js/main.js`, `js/eventHandlers.js`): Completed the partially-wired loop region feature from a previous session. Added Loop button + start/end bar inputs to global controls bar. Functions in `audio.js`: `getLoopRegion()`, `setLoopRegion()`, `setLoopRegionEnabled()`, `isLoopRegionEnabled()`, `getLoopStartBars()`, `getLoopEndBars()`. Syncs with `Tone.Transport.loop`, `loopStart`, and `loopEnd` for native transport looping. Button shows active state via `.loop-active` CSS class (blue highlight). `L` key added to keyboard shortcuts for toggle. Bug fixed: `isReconstructinging` typo → `isReconstructing` in `commonLoadSampleLogic()` that was silently bypassing undo state capture.

### 2026-04-17 — Day 10
- **Quantize Toggle + Quantize Action** (`js/Track.js`, `js/eventHandlers.js`, `js/ui.js`): Added `quantizeSequence(quantizeTo)` method to Track class that snaps notes to the current snap grid (16/8/4 steps). The S key cycles snap (already existed) — now Q key quantizes the armed track's active sequence to the current snap value. Right-click context menu on sequencer grid now includes "Quantize to 1/16", "Quantize to 1/8", and "Quantize to 1/4" options. Handles collisions by placing displaced notes in nearest free slot. Keyboard Shortcuts overlay updated with new Sequencer section (S=cycle snap, Q=quantize, Shift+Click=transpose).

### 2026-04-17 — Day 11
- **Punch In/Out Markers** (`index.html`, `js/audio.js`, `js/main.js`, `js/eventHandlers.js`, `js/Track.js`, `js/ui.js`): Added punch-in/out region with UI controls. New Punch button + in/out bar inputs in global controls bar (similar to Loop). Module in `audio.js`: `getPunchRegion()`, `setPunchRegion()`, `setPunchRegionEnabled()`, `isPunchRegionEnabled()`, `getPunchInBars()`, `getPunchOutBars()`, `isPositionInPunchRegion()`. CSS active state `.punch-active` (pink/purple) for toggle button. `P` key toggles punch in/out. Added to keyboard shortcuts overlay. During recording, punch-in/out filters which bars get recorded to the armed Audio track — recording only happens when transport position is within the punch region. Input change handlers wired to show notification on adjustment.

### 2026-04-17 — Day 12
- **Meter Update Throttling** (`js/main.js`): Throttled `updateMetersLoop()` from unlimited RAF (~60fps+) down to 30fps max using `performance.now()` timing with a 33ms throttle interval. Meter updates are the most expensive part of the UI loop (DOM writes per track), so this significantly reduces CPU/GPU load without any visible impact on meter smoothness. Added `THROTTLE_MS = 33` constant and `_lastMeterUpdateTime` property on the function for clean throttling.

### 2026-04-17 — Day 13 (Bug Fixes)
- **Bug fixes — typos, missing exports, browser compatibility**:
  - Replaced all optional chaining with fallback patterns across all JS files (249 occurrences in 9 files) — the deployed app threw errors on older browsers.
  - Fixed missing import and added missing export.
  - Fixed typo cascade: renamed functions and all call sites. Without this fix, undo bypass never worked for add/remove/reorder master effects.
  - Added missing getter and removed duplicate definition.
  - Fixed re-parsing localStorage on every call instead of caching in memory.

### 2026-04-17 — Day 14
- **Snap Grid Toggle Button in Global Controls Bar** (`index.html`, `js/main.js`, `js/eventHandlers.js`): Added a dedicated Snap toggle button (`snapToggleBtnGlobal`) to the global controls bar, positioned next to the Tap Tempo button. Displays current snap value (e.g., "Snap: 1/16") and shows active state (blue highlight) when snap is not Off. Clicking cycles through snap values (Off → 1/4 → 1/8 → 1/16 → Off) — same as the S key. The S key handler in `eventHandlers.js` now also updates the button's label and active state, keeping UI in sync. CSS `.snap-active` class added for the active state styling (matching loop/punch blue highlight). Button click handler added to `main.js` `attachSnapToggleHandler()` function with `updateSnapButtonUI()` helper for consistent state management.

### 2026-04-17 — Day 15
- **Bug Fix: Velocity Classes Missing on Initial Sequencer Render** (`js/ui.js`): Sequencer step cells were not showing velocity-based brightness classes (`vel-100` through `vel-10`) when first loaded. The `buildSequencerContentDOM()` function only applied `activeClass` for active steps but omitted `velClass` computation. This caused all active steps to appear at default brightness regardless of their actual velocity value. Fixed by adding the same velocity class computation that `updateSequencerCellUI()` uses — now active cells get the correct brightness class during initial render.

### 2026-04-17 — Day 16
- **Timeline Clip Rendering with Drag/Resize** (`js/ui.js`, `style.css`): The Timeline window now renders actual audio and sequence clips from `track.timelineClips` with proper positioning based on `clip.startTime` and `clip.duration`. Both audio clips (purple, class `.audio-clip`) and sequence clips (cyan, class `.sequence-clip`) are displayed. Added CSS for `.sequence-clip` styling (cyan color scheme distinct from audio) and `.clip-resize-handle` / `.clip-resize-handle-left` / `.clip-resize-handle-right` for drag handles on clip edges. Added `.clip-label` for clip name display. Implemented full drag-to-move functionality (`startClipDrag`, `onClipDrag`, `stopClipDrag`) that updates `clip.startTime` and calls `track.updateAudioClipPosition()`. Implemented resize-from-edge functionality (`startClipResize`, `onClipResize`, `stopClipResize`) for adjusting clip duration. Added `selectClip()` to highlight the selected clip with a white outline. Updated `updatePlayheadPosition()` to read real transport position from `Tone.Transport.position` and calculate progress normalized to 16 bars. `renderTimeline()` now calculates pixel positions using `PIXELS_PER_SECOND = 50 * timelineZoomLevel`. Clips are clickable for selection and draggable for repositioning. Version bumped to 0.4.0.

### 2026-04-17 — Day 17
- **Effects Registry Cleanup** (`js/effectsRegistry.js`): Removed duplicate effect definitions (AutoWah was listed twice). Also removed obsolete `Sustainer` effect that was not a valid Tone.js class. This ensures the Add Effect modal shows a clean, correct list of available effects without errors or duplicates.

### 2026-04-17 — Day 18
- **Add Missing Delay Effect** (`js/effectsRegistry.js`): Added the missing `Delay` effect (basic delay with Time and Max Delay parameters) to the effects registry alongside the existing FeedbackDelay and PingPongDelay. Also fixed the Chorus effect's Delay parameter — it was using 'ms' suffix but default value 3.5ms is too small for Tone.js Chorus which expects seconds, so changed to 's' suffix with appropriate range (0.5-20s).

### 2026-04-17 — Day 19
- **Project Rename** (`index.html`, `js/state.js`, `js/main.js`): Wired up the `projectNameBtnGlobal` button that was already in the HTML but had no handler. Added `projectNameState` variable to state.js with `getProjectNameState()` and `setProjectNameState(name)` functions. Project name is now saved in `gatherProjectDataInternal()` and restored in `reconstructDAWInternal()`. Added `updateProjectNameDisplay(name)` to appServices for UI updates. Click the project name button in the global controls bar to rename via prompt dialog. Version bumped to 0.5.0.

### 2026-04-17 — Day 20
- **Sequencer Copy/Paste Section Enhancements** (`js/ui.js`): Added four new operations to the sequencer right-click context menu: (1) **Duplicate Sequence** — duplicates the active sequence with "Copy" suffix, uses existing `duplicateSequence()` method, (2) **Rename Sequence** — prompts for new name and uses existing `renameSequence()` method, (3) **Clear Selection** — clears all notes in the current drag selection (requires selection first), (4) **Invert Selection** — flips active notes to inactive and inactive to active within the selection, creating interesting pattern effects. All operations properly capture undo state before modifying the sequence. The context menu now has dedicated separators to group related operations visually.

### 2026-04-17 — Day 21
- **Add Missing Compressor Effect** (`js/effectsRegistry.js`): Added the `Compressor` effect to the effects registry (alphabetically between Chorus and Distortion). Tone.js Compressor params: threshold (-100 to 0 dB), knee (0-40 dB), ratio (1-20), attack (0-1s), release (0-1s). Also removed a duplicate Compressor definition that was incorrectly placed before EQ3.

### 2026-04-17 — Day 22
- **UI Polish — Window Shadows, Modal Depth, Hover Effects** (`style.css`): Enhanced visual depth across the app. (1) **Window shadows**: Replaced flat single shadow with layered shadows (4px + 10px + 20px + inset highlight) creating a floating, dimensional feel. (2) **Modal dialog shadows**: Added matching layered shadow depth to `.modal-dialog`. (3) **Context menu hover animation**: Menu items now slide right 6px on hover (`padding-left: 18px`) with smooth transition for tactile feedback. (4) **Scrollbar styling**: Enhanced thumb size, rounded corners, and border for better visibility on dark theme. All changes use CSS transitions for smooth animation.

### 2026-04-17 — Day 23
- **Add Missing Reverb Effect** (`js/effectsRegistry.js`): Added the `Reverb` effect to the effects registry (alphabetically between EQ3 and Filter). Tone.js Reverb params: `decay` (0.1-10, default 2.5) for reverb decay time, `wet` (0-1, default 0.5) for wet/dry mix. Version bumped to 0.5.1.

### 2026-04-17 — Day 24
- **Bug Fix: drawInstrumentWaveform missing "No audio" message** (`js/ui.js`): The `drawInstrumentWaveform` function had an empty if-block when no audio was loaded — it did nothing, leaving a blank canvas instead of showing the "No audio loaded or processed" message. Added the proper canvas-clearing and text-rendering code, matching the existing `drawWaveform` function's behavior.
- **Bug Fix: drawWaveform "No audio" text color inconsistency** (`js/ui.js`): The `drawWaveform` function's "No audio loaded or processed" text used `#E0BBE4` (light pink/purple) while the waveform itself uses `#957DAD`. Changed the text color to `#D291BC` (matching the Instrument track waveform color) for consistency across both waveform rendering functions.

### 2026-04-18 — Day 25
- **Bug Fix: Missing updateSequencerCellUI function** (`js/ui.js`): The `updateSequencerCellUI()` function was called throughout the sequencer click handlers (lines 1749, 1764, 1776, 1819) but was never defined in ui.js — it was only referenced in AGENTS.md as a planned feature. This caused `ReferenceError` exceptions whenever users toggled steps, changed velocities, or used the context menu. Added the missing `updateSequencerCellUI(windowElement, trackType, row, col, isActive, velocity)` function before `highlightPlayingStep()` at line 1905. The function updates a cell's CSS classes: removes all velocity classes (vel-100 through vel-10), toggles the `active` class, and applies the appropriate velocity brightness class based on the velocity parameter (0.0-1.0 scale).

### 2026-04-18 — Day 26
- **Sequencer Copy/Paste Keyboard Shortcuts** (`js/eventHandlers.js`): Added Ctrl+C and Ctrl+V keyboard shortcuts for sequencer copy/paste operations. Works with the existing clipboard infrastructure in state.js. Copy copies the current drag selection (or full sequence if nothing selected) from the armed track. Paste pastes at the current selection position (or at start if no selection). Fixed the Ctrl/Meta key early-return logic in the keydown handler — the old condition `!( (event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y'))` was inverted and blocking Ctrl+C/V instead of allowing them through. Added `Ctrl+C / Ctrl+V` entry to the keyboard shortcuts overlay under the Sequencer section.

### 2026-04-18 — Day 27
- **Bug Fix: isReconstructing typo cascade breaks undo/redo** (`js/main.js`): The undo/redo system was broken because state.js sets `appServices._isReconstructingDAW_flag` but main.js was reading `appServices._isReconstructingingDAW_flag` (with typo). This caused `addMasterEffect`, `removeMasterEffect`, and `reorderMasterEffect` to always see `isReconstructing = false`, bypassing the undo check and corrupting the undo stack on every master effect operation. Fixed all references: renamed `_isReconstructingingDAW_flag` → `_isReconstructingDAW_flag` and `getIsReconstructingingDAW` → `getIsReconstructingDAW` across main.js. The flag itself was already correctly named in state.js. This was a follow-up to Day 13's "typo cascade" fix which renamed the function but missed the property name and the initial getter definition.

### 2026-04-18 — Day 28
- **Bug Fix: Timeline clip resize not capturing undo state** (`js/Track.js`, `js/ui.js`): The `stopClipResize` function in ui.js was calling `track.updateAudioClipPosition(clip.id, clip.startTime)` after resizing a clip from the left edge, which only captured the startTime change but not the duration change. Added new `updateAudioClipDuration(clipId, newDuration)` method to Track class that properly captures duration changes for undo. Updated `stopClipResize` to call `track.updateAudioClipDuration(clip.id, clip.duration)` when available, falling back to `updateAudioClipPosition` for left-edge resizes. This ensures both position and duration changes during resize are properly captured in the undo stack.

### 2026-04-18 — Day 29
- **Add Missing Effects: Tremolo, Wahwah, Vibrato, ToneShaper, Volume** (`js/effectsRegistry.js`, `js/constants.js`): Added five missing Tone.js effects to the AVAILABLE_EFFECTS registry. Tremolo creates rhythmic amplitude modulation (frequency, depth, waveform). WahWah is a resonant lowpass filter sweep controlled by an LFO (base frequency, min freq, Q, sensitivity). Vibrato is pitch modulation (frequency, depth, max delay). ToneShaper is waveshaping distortion (curve type: linear/exponential/sigmoid/tangent). Volume is a simple gain node with dB scaling. All effects include appropriate parameter ranges, defaults, and wet controls. Version bumped to 0.5.2.

### 2026-04-18 — Day 30
- **Bug Fix: shiftSequenceNotes missing undo state capture** (`js/Track.js`): The `shiftSequenceNotes()` method was modifying `activeSeq.data` directly without calling `_captureUndoState()`, so undo/redo never worked for Shift Notes Up/Down operations. The Track class already has `_captureUndoState()` used throughout the class (createNewSequence, deleteSequence, renameSequence, etc.), but `shiftSequenceNotes` was missing it. Fixed by adding `this._captureUndoState(\`Shift Notes ${semitones > 0 ? 'Down' : 'Up'} on ${activeSeq.name}\`)` right after `activeSeq.data = newData`.
- **Bug Fix: Ctrl+C/V early-return blocking copy/paste** (`js/eventHandlers.js`): The keyboard handler's Ctrl/Meta key early-return condition at line 610 was `if (!((key === 'z' || key === 'y'))) { return; }` which blocked ALL Ctrl combinations except Ctrl+Z and Ctrl+Y. This prevented Ctrl+C and Ctrl+V from ever reaching their handlers (lines 741 and 787), breaking sequencer copy/paste keyboard shortcuts. Fixed by changing the condition to `if (!((key === 'z' || key === 'y' || key === 'c' || key === 'v')))` so Ctrl+C and Ctrl+V fall through to their intended handlers.

### 2026-04-18 — Day 31
- **Route Preview Player Through Master Effects Bus** (`js/ui.js`, `js/main.js`, `js/audio.js`): Fixed the Sound Browser preview player to route through the master effects bus instead of going direct to `Tone.Destination`. Previously, preview sounds played independently of the master volume knob and any master effects (reverb, delay, compressor, etc.), which was inconsistent with how all other track audio flows. Changed `new Tone.Player().toDestination()` to `new Tone.Player()` followed by `previewPlayer.connect(masterBus)` using the `getMasterEffectsBusInputNode()` from audio.js. Added `getMasterEffectsBus` to appServices in main.js which wraps `getMasterEffectsBusInputNode()`, making it accessible to ui.js as `localAppServices.getMasterEffectsBus`. The preview now respects master volume and master effects like all other audio in the signal chain. Falls back to `toDestination()` if the master bus is not available.

### 2026-04-18 — Day 32
- **Per-track Automation Recording System** (`js/audio.js`, `js/Track.js`, `js/state.js`, `js/ui.js`, `js/eventHandlers.js`, `style.css`): Full automation recording system for volume, mute, and solo parameters.
  - **Automation scheduling** (`audio.js`): `startAutomation()` / `stopAutomation()` functions that schedule a `Tone.Transport.scheduleRepeat` callback at 16n resolution to tick automation on all tracks. Automation starts when transport plays and stops when paused/stopped.
  - **Track automation methods** (`Track.js`): `writeVolumeAutomation(time, value)`, `writeMuteAutomation(time, value)`, `writeSoloAutomation(time, value)` methods store automation events in a sorted array (capped at 10000 events). `applyAutomationAtTime(time)` reads events and applies volume (via `gainNode.gain.setValueAtTime`), mute (via `applyMuteState()`), and solo changes using look-ahead comparison.
  - **Automation arm state** (`Track.js`): Track already had `automationArmed` property initialized from project data and saved/restored via `gatherProjectDataInternal()` / `reconstructDAWInternal()`.
  - **Manual automation recording buttons** (`ui.js`): Added "M" (Mute) and "S" (Solo) automation record buttons in track inspector, next to the existing mute/solo buttons. Mixer right-click context menu now includes "Record Mute Automation" and "Record Solo Automation" options. CSS class `.automation-armed` (red background) highlights the "A" arm button when enabled.
  - **Volume knob automation capture** (`Track.js`): `setVolume(volume, fromInteraction)` now checks `this.automationArmed` and calls `writeVolumeAutomation(time, value)` whenever the user interacts with the volume knob on an armed track. Uses `Tone.Transport.position` and `Tone.Transport.seconds` for accurate timing.
  - **Mute/Solo manual automation** (`Track.js`): `toggleMuteAutomationNow()` and `toggleSoloAutomationNow()` methods write current mute/solo state to automation when the "M" or "S" button is clicked (track must be automation-armed). Solo automation reads current solo state from `appServices.getSoloedTrackId()`.
  - **Automation wired to transport** (`eventHandlers.js`): Play button now calls `startAutomation()` when transport starts and `stopAutomation()` when paused. Stop button also calls `stopAutomation()`.
  - **State exports** (`state.js`): Added `getMutedTrackIdsState()`, `setMutedTrackIdsState()` for multi-mute support. Also exports `setSoloedTrackId` and `getMutedTrackIds` to track `appServices` for automation methods to query solo state.
  - **Enter key shortcut**: Enter key now acts as Stop (rewind) button click — useful for quick stop during playback.
  - Version bumped to 0.6.0.

### 2026-04-18 — Day 33
- **CI/CD: GitHub Actions Deploy Workflow** (`.github/workflows/deploy.yml`): Created `.github/workflows/deploy.yml` for automatic GitHub Pages deployment on push to `LWB-with-Bugs`. Workflow triggers on push to the branch, uses `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4` for zero-build static site deployment. No build step needed since the app is plain HTML/CSS/JS served directly.

### 2026-04-18 — Day 34
- **Bug Fixes: isReconstructinging typo cascade (undo redo) + notification dimension typos** (`js/main.js`, `js/audio.js`, `js/ui.js`): Fixed four bugs introduced during incomplete prior edits:
  1. **isReconstructinging → isReconstructing** in `js/audio.js` line 523: `commonLoadSampleLogic()` was checking `!isReconstructinging` (non-existent variable) instead of `!isReconstructing`, causing all sample loads to bypass undo state capture since the undefined variable is always truthy.
  2. **isReconstructinging → isReconstructing** in `js/main.js` lines 213 and 230: `removeMasterEffect` and `reorderMasterEffect` had the same typo in their undo bypass conditions.
  3. **isReconstructing flag name** in `js/main.js` line 268 and 780: `_isReconstructingingDAW_flag` and its assignment were still using the typo variant instead of `_isReconstructingDAW_flag`, breaking the reconstruct/recovery flag.
  4. **Notification dimension typos** in `js/ui.js`: `"Selection (${r2-r1+1}x${c2-c1+4}) copied."` and `"Cleared selection (${r2-r1+4}x${c2-c1+4})."` showed wrong column counts (+4 instead of +1) in copied/cleared selection notifications.

### 2026-04-18 — Day 35
- **Web Audio Context Suspension Auto-Recovery** (`js/audio.js`, `js/main.js`): Added context suspension monitoring and automatic recovery to handle the common browser issue where `AudioContext` gets auto-suspended after periods of inactivity (especially on mobile/low-power modes). Added module variables `contextSuspendedCount` and `resumeAttemptScheduled` to track suspension state. New functions in `audio.js`: `startContextSuspensionMonitoring(intervalMs)` uses `setInterval` to poll `Tone.context.state` every 3 seconds — when suspended, it calls `Tone.context.resume()` and re-initializes the master bus if components were disposed. Shows a notification after 3 failed resume attempts prompting user to tap/click. `stopContextSuspensionMonitoring()` cleans up the monitoring. `getContextSuspensionCount()` and `getContextState()` for debugging. Monitoring is started automatically during `initializeSnugOS()` in `main.js` right after the audio module is initialized. This addresses the known issue "Audio engine: no Web Audio error recovery after Tone.context suspension" from the TODO list.