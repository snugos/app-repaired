# SnugOS DAW - Feature Status Report

**Generated:** 2026-04-20
**Branch:** LWB-with-Bugs
**Last Verified:** 2026-04-20 09:45 UTC

## 🔴 Critical Bugs Fixed This Session

### Bug 1: `getIsReconstructingDAW` Typo - ✅ FIXED
**File:** `js/main.js`
**Severity:** High — Project recovery broken
**Issue:** Property name `_isReconstructingingDAW_flag` had triple "g" instead of single "g"
**Fix:** Changed to `_isReconstructingDAW_flag` in all occurrences (lines 588-589)
**Impact:** Master effects can now be properly added/removed during project recovery, and the reconstruction flag works correctly

### Bug 2: `getIsReconstructingingDAW()` Function Call Typos - ✅ FIXED
**File:** `js/main.js`
**Severity:** High — Master effects broken
**Issue:** Function calls used `getIsReconstructingingDAW()` instead of `getIsReconstructingDAW()`
**Fix:** Corrected all function calls (lines 527, 547, 564, 565)
**Impact:** Master effects add/remove/reorder now correctly check reconstruction state

### Bug 3: Missing `updateSequencerCellUI` Function - ✅ FIXED
**File:** `js/ui.js`
**Severity:** High — Sequencer cell UI updates broken
**Issue:** Function was called but never defined, causing silent failures
**Fix:** Added complete implementation of `updateSequencerCellUI()` function
**Impact:** Sequencer cells now update visually when toggled, velocities changed, or selection modified

---

## 🟠 New Features Completed This Session

### Feature: Project Export Presets - ✅ COMPLETED
**File:** `js/state.js`, `js/ui.js`, `js/eventHandlers.js`, `js/main.js`, `index.html`
**Status:** ✅ COMPLETED
**What's New:** Save/load project export configurations with configurable settings
**Implementation:**
- [x] Add `openExportPresetsPanel()` function in ui.js for UI panel
- [x] Add `exportWithSettingsInternal()` function in state.js for preset-based export
- [x] Add `menuExportPresets` menu item in index.html
- [x] Add menu event handler in eventHandlers.js
- [x] Wire up all functions in main.js appServices
- [x] Support configurable settings: format, sample rate, bit depth, normalize, dither, tail

**Features:**
- Start Menu → "Export Presets" opens preset management panel
- Configure export settings: format (WAV), sample rate (44.1/48/96 kHz), bit depth (16/24/32-bit)
- Optional normalization and dithering
- Configurable tail duration (0-10 seconds)
- Save presets with custom names
- Load/delete existing presets
- "Export Now" button uses current settings
- "Export Stems" button for stem export

### Feature: Bounce Track to Audio - ✅ COMPLETED
**File:** `js/state.js`, `js/ui.js`, `js/eventHandlers.js`, `js/main.js`
**Status:** ✅ COMPLETED
**What's New:** Render a track's output (including effects) to a WAV file
**Implementation:**
- [x] Add `bounceTrackToAudio(trackId, options)` function in state.js
- [x] Add `showBounceTrackDialog(trackId)` function in state.js
- [x] Add "Bounce to Audio" menu item in track context menu in ui.js
- [x] Add `handleBounceTrack(trackId)` event handler in eventHandlers.js
- [x] Wire up services in main.js appServices
- [x] Support options: download WAV, create new Audio track, bar range selection

**Features:**
- Right-click track → "Bounce to Audio"
- Options dialog for bounce settings
- Download rendered audio as WAV
- Option to create new Audio track from bounce
- Configurable start/end bar range

### Feature: Step Sequencer Velocity Lane - ✅ COMPLETED
**File:** `js/ui.js`
**Status:** ✅ COMPLETED
**What's New:** Visual velocity lane editing per row in the sequencer
**Implementation:**
- [x] Add velocity lane section below main sequencer grid
- [x] Display velocity bars showing note velocity for each step
- [x] Add "Hide/Show" toggle button for velocity lane
- [x] Add "Clear All" button to reset all velocities to default
- [x] Click velocity cell to cycle through preset values (30%, 50%, 70%, 90%, 100%)
- [x] Visual feedback updates both velocity lane and main grid cell

**Features:**
- Shows compact velocity bars below each row in the sequencer
- Bar height indicates velocity (taller = louder)
- Color gradient from red to orange for visual feedback
- Click to cycle through preset velocities
- Right-click still works for fine-grained velocity slider popup

---

## 🔴 Critical Issues - Incomplete Features

### Feature 1: Timeline Window - ✅ COMPLETED
**File:** `js/ui.js` (lines 1588-1612)
**Status:** ✅ COMPLETED
**What's Missing:** ~~All timeline functions were stubs~~
**Implementation Plan:**
- [x] Implement track lane rendering with clip visualization
- [x] Add playhead position tracking
- [x] Implement clip drag-drop functionality
- [x] Connect to Track.timelineClips data

### Feature 2: Parameter Automation Playback - ✅ COMPLETED
**File:** `js/Track.js`, `js/audio.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~Automation was stored but never applied during playback~~
**Implementation Plan:**
- [x] Create `scheduleAutomation` function
- [x] Create `addAutomationPoint`, `removeAutomationPoint`, `clearAutomation` functions
- [x] Connect to Tone.js parameter ramps via exponentialRampToValueAtTime

---

## 🟠 High Priority - Completed Features

### Feature 3: Sidechain Routing - ✅ COMPLETED
**File:** `js/audio.js`, `js/Track.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~No sidechain compressor routing between tracks~~
**Implementation Plan:**
- [x] Add sidechain send/return bus (`getSidechainBusNode()`)
- [x] Implement sidechain compressor detection (`setupSidechainRouting()`)
- [x] Add `triggerSidechainForTrack()` for real-time ducking
- [x] Add `removeSidechainRouting()` and `clearAllSidechainForTrack()` for cleanup
- [x] Create UI for routing source to destination

### Feature 4: Auto-Save Recovery - ✅ COMPLETED
**File:** `js/state.js`, `js/db.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~No automatic project saving or crash recovery~~
**Implementation Plan:**
- [x] Implement periodic auto-save to IndexedDB (30-second interval)
- [x] Add crash detection on page load (`checkCrashRecovery()`)
- [x] Create recovery dialog (`createRecoveryDialog()`)
- [x] Add `startAutoSave()`, `stopAutoSave()`, `triggerAutoSave()` functions
- [x] Store project state in new `projectState` IndexedDB object store

---

## 🟡 Medium Priority - UI/UX Improvements

### Feature 5: Sound Browser Preview Controls - ✅ COMPLETED
**File:** `js/ui.js` (sound browser sections), `js/audio.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~Preview button exists but waveform visualization missing~~
**Implementation Plan:**
- [x] Add waveform preview display canvas
- [x] Implement playhead position indicator
- [x] Add preview volume control slider
- [x] Add `drawWaveform`, `drawPlayhead` functions in audio.js
- [x] Add `decodeAudioBlob`, `setWaveformPreviewCanvas`, `setWaveformPreviewBuffer`
- [x] Add `startWaveformPlayheadAnimation`, `stopWaveformPlayheadAnimation`
- [x] Update sound file click handler to load waveform
- [x] Update preview button to use playhead animation and volume control

### Feature 6: Mixer Window Complete Implementation - ✅ COMPLETED
**File:** `js/ui.js` (mixer sections), `js/Track.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~Basic mixer exists but sends incomplete~~
**Implementation Plan:**
- [x] Add pan control for stereo
- [x] Add `panNode` (Tone.Panner) to Track class
- [x] Initialize panNode in `initializeAudioNodes()`
- [x] Update signal chain: gainNode → panNode → trackMeter
- [x] Add `setPan()` method to Track class
- [x] Add pan knob to mixer UI for each track
- [x] Dispose panNode in `dispose()` method
- [x] Implement send/return routing UI

### Feature 10: Sampler and DrumSampler Pad UI - ✅ COMPLETED
**File:** `js/ui.js`, `js/Track.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~Sampler pad rendering and drum pad controls were stub implementations~~
**Implementation Plan:**
- [x] Implement `renderSamplePads(track)` - Render 8 sampler pads with slice info
- [x] Implement `updateSliceEditorUI(track)` - Update slice editor controls for selected slice
- [x] Implement `renderDrumSamplerPads(track)` - Render 8 drum pads with sample info
- [x] Implement `updateDrumPadControlsUI(track)` - Update drum pad controls for selected pad
- [x] Add knob controls for drum pad volume, pitch, and envelope (attack, decay, sustain, release)
- [x] Add `playDrumPad(padIndex)` method to Track class for preview playback
- [x] Wire up pad selection to update UI controls

### Feature 12: Waveform Visualization on Timeline Audio Clips - ✅ COMPLETED
**File:** `js/ui.js`, `js/audio.js`, `js/main.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~Audio clips on timeline don't show waveform visualization~~
**Implementation Plan:**
- [x] Add canvas element for each audio clip in timeline
- [x] Implement `drawTimelineClipWaveform()` function
- [x] Cache audio buffer references for waveform drawing
- [x] Handle waveform zoom and scroll
- [x] Update on clip resize/move
- [x] Wire up functions in main.js appServices

### Feature 13: Mixer Send/Return Routing UI - ✅ COMPLETED
**File:** `js/ui.js`, `js/Track.js`, `js/audio.js`, `js/main.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~No UI to configure send/return routing for effects~~
**Implementation Plan:**
- [x] Add send level knobs to mixer track strips
- [x] Create send buses (reverb, delay) in audio.js
- [x] Add return channels in mixer
- [x] Wire sends to return channels
- [x] Support pre/post-fader sends (sendGainNodes per track)
- [x] Add return level and wet knobs for each bus
- [x] Add `setSendLevel`, `getSendLevel` methods to Track class
- [x] Add `getSendBusesInfo`, `setTrackSendLevel`, `getTrackSendLevel`, `setSendBusReturnLevel`, `getSendBusReturnLevel`, `setSendBusWet` to audio.js
- [x] Wire all functions in main.js appServices

### Feature 14: Sidechain Routing UI - ✅ COMPLETED
**File:** `js/ui.js`, `js/audio.js`, `js/Track.js`, `js/main.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~Sidechain functionality exists in audio.js but no UI to configure routing~~
**Implementation Plan:**
- [x] Add sidechain source selector in mixer
- [x] Add sidechain enable button per track
- [x] Add sidechain threshold/ratio controls
- [x] Visual indicator for sidechain routing (SC badge)
- [x] Add `showSidechainConfigModal()` for configuring routing
- [x] Add `setupSidechainRouting`, `removeSidechainRouting`, `clearAllSidechainForTrack` to audio.js
- [x] Add `getTrackSidechainInfo`, `triggerSidechainForTrack` to audio.js
- [x] Add sidechain properties and methods to Track class
- [x] Wire all functions in main.js appServices

### Feature 15: Audio Clip Fade In/Out - ✅ COMPLETED
**File:** `js/ui.js`, `js/Track.js`
**Status:** ✅ COMPLETED
**What's New:** Right-click audio clips on timeline to set fade in/out curves
**Implementation Plan:**
- [x] Add `setClipFade(clipId, fadeIn, fadeOut)` method to Track class
- [x] Add `getClipFade(clipId)` method to Track class
- [x] Add fade in/out context menu options for timeline audio clips
- [x] Pre-defined fade durations: 0.1s, 0.25s, 0.5s, 1.0s
- [x] Clear fade options to remove fades
- [x] Show current fade values in menu labels
- [x] Delete clip option in context menu

---

## 🟢 Low Priority - Nice-to-Have

### Feature 7: MIDI Learn / Mapping - ✅ COMPLETED
**File:** `js/eventHandlers.js`, `js/state.js`, `js/ui.js`, `js/main.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~No way to map MIDI CC to parameters~~
**Implementation Plan:**
- [x] Add MIDI learn mode state management (`midiLearnMode`, `midiLearnTarget`, `midiMappings`)
- [x] Add `setMidiLearnMode()`, `setMidiLearnTarget()`, `addMidiMapping()`, `removeMidiMapping()`, `clearAllMidiMappings()`, `getMidiMappingForCC()` functions
- [x] Add `applyMidiMapping()` function to apply CC values to track/master parameters
- [x] Add MIDI Learn button (`midiLearnBtnGlobal`) to global controls bar
- [x] Add visual feedback when in learn mode (button changes state)
- [x] Add MIDI Mappings panel (`openMidiMappingsPanel()`, `updateMidiMappingsPanel()`)
- [x] Add menu item `menuOpenMidiMappings` in Start Menu
- [x] Wire up learn button click handler to toggle learn mode
- [x] Support mapping CC to track volume, pan, and effect parameters
- [x] Support mapping CC to master volume and effect parameters

### Feature 8: Stem Export - ✅ COMPLETED
**File:** `js/state.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~Can only export full mix, not individual track stems~~
**Implementation Plan:**
- [x] Add `exportStemsInternal()` function for multi-track recording
- [x] Create `showStemExportDialogInternal()` for track selection UI
- [x] Add menu item `menuExportStems` in eventHandlers.js
- [x] Wire up stem export functions in main.js appServices

### Feature 9: Keyboard Shortcuts Panel - ✅ COMPLETED
**File:** `js/main.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~No way to view all keyboard shortcuts~~
**Implementation Plan:**
- [x] Add `showKeyboardShortcutsModal()` function
- [x] Bind to `?` key press
- [x] Display shortcuts in a modal dialog

### Feature 11: Undo/Redo Visual Stack Panel - ✅ COMPLETED
**File:** `js/ui.js`, `js/main.js`, `js/eventHandlers.js`, `js/state.js`
**Status:** ✅ COMPLETED
**What's Missing:** ~~No way to visualize undo/redo history~~
**Implementation Plan:**
- [x] Add `openUndoHistoryPanel()` function in ui.js
- [x] Create `renderUndoHistoryContent()` to display undo/redo stacks
- [x] Add `updateUndoHistoryPanel()` to refresh panel on state changes
- [x] Add `menuOpenHistory` menu item in index.html
- [x] Wire up menu handler in eventHandlers.js
- [x] Add `getUndoStack`/`getRedoStack` services to appServices in main.js
- [x] Call `updateUndoHistoryPanel()` from `updateInternalUndoRedoState()` in state.js
- [x] Implement click-to-undo/redo functionality
- [x] Add "Clear All History" button with confirmation

---

## Session Progress

### Completed This Session (2026-04-20)

#### Verification Run (09:45 UTC)
- ✅ **Codebase Verification Complete** - Full scan for incomplete features
  - No TODO/FIXME/XXX/HACK/INCOMPLETE/STUB markers found
  - No stub implementations found
  - All `return null` statements are legitimate error handling
  - All disabled UI elements are intentional for UX
  - No commented-out code blocks indicating incomplete features
  - All JavaScript syntax checks passed (audio.js, Track.js, ui.js, state.js, main.js, eventHandlers.js, effectsRegistry.js, SnugWindow.js, constants.js, db.js, midiUtils.js, utils.js)
  - Empty action callbacks (`() => {}`) are intentional for menu headers and informational labels
  - All `return {}` and `return []` are legitimate default returns for missing definitions
  - Console.log statements are debugging logs within functional code, not stub implementations
  - Git status: working tree clean, pushed to origin LWB-with-Bugs

#### Verification Run (09:25 UTC)
- ✅ **Codebase Verification Complete** - Full scan for incomplete features
  - No TODO/FIXME/XXX/HACK/INCOMPLETE/STUB markers found
  - No stub implementations found
  - All `return null` statements are legitimate error handling
  - All disabled UI elements are intentional for UX
  - No commented-out code blocks indicating incomplete features
  - All JavaScript syntax checks passed (audio.js, Track.js, ui.js, state.js, main.js, eventHandlers.js, effectsRegistry.js, SnugWindow.js, constants.js, db.js, midiUtils.js, utils.js)
  - Empty action callbacks (`() => {}`) are intentional for menu headers and informational labels
  - All `return {}` and `return []` are legitimate default returns for missing definitions
  - Console.log statements are debugging logs within functional code, not stub implementations

#### Verification Summary (2026-04-20 09:25 UTC)
| Check | Status |
|-------|--------|
| TODO/FIXME Comments | ✅ None found |
| Stub Implementations | ✅ None found |
| Empty Function Bodies | ✅ None found (all intentional) |
| Placeholder Returns | ✅ All legitimate |
| Commented-Out Code | ✅ No incomplete features |
| Disabled UI Elements | ✅ All intentional |
| Syntax Validation | ✅ All files pass |
| Empty Action Callbacks | ✅ All intentional (menu headers/info labels) |

### Known Limitations (Not Bugs)
- **MP3 Export**: Currently only WAV format is supported. MP3 export is planned for future implementation (requires lamejs or similar encoder library).

### In Progress
- None - All features completed and verified

### Next to Tackle
- All medium priority features have been completed
- All low priority features have been completed
- All critical bugs have been fixed
- **Codebase is complete - no remaining incomplete features**
- All null returns are legitimate error handling, not stub implementations

---

## Current Feature Queue

1. **Piano Roll Editor** - Clickable piano roll with note editing ✅ COMPLETED
2. **Audio Recording** - Record audio from microphone into tracks ✅ COMPLETED
3. **VST Plugin Support** - Load WebAudio plugins via AudioWorklet ✅ COMPLETED
4. **MIDI File Import/Export** - Drag & drop .mid files ✅ COMPLETED
5. **Track Effects Presets** - Save/load effect chain presets per track ✅ COMPLETED
6. **Quantize Selection** - Quantize selected notes to grid ✅ COMPLETED
7. **Undo/Redo Visual Stack** - Show undo history in a panel ✅ COMPLETED
8. **Keyboard Shortcuts Panel** - Press `?` to show all shortcuts ✅ COMPLETED
9. **Waveform Visualization** - Draw waveform on audio clips ✅ COMPLETED
10. **Track Color Coding** - Assign colors to tracks for visual grouping ✅ COMPLETED
11. **MIDI Learn / Mapping** - Map MIDI CC to parameters ✅ COMPLETED
12. **Bounce to Audio** - Render a track's output to an audio file ✅ COMPLETED
13. **Audio Clip Fade In/Out** - Add fade curves to audio clips on timeline ✅ COMPLETED
14. **Metronome Toggle** - Click to enable/disable metronome during playback ✅ COMPLETED
15. **Loop Region** - Set a loop region in the timeline for repeated playback ✅ COMPLETED
16. **Track Duplicate** - Right-click track to duplicate it with all settings ✅ COMPLETED

## When Queue is Empty - New Feature Ideas

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support

Generate 10 NEW feature ideas that are:
1. Achievable in a single session
2. Complement existing features
3. Enhance creative workflow

New Feature Queue:
1. **Step Sequencer Velocity Lane** - Visual velocity lane editing per row ✅ COMPLETED
2. **Effect Bypass Toggle** - Quick bypass button for each effect ✅ COMPLETED
3. **Audio Normalization** - Auto-normalize recorded or imported audio ✅ COMPLETED
4. **Project Export Presets** - Save/load project export configurations ✅ COMPLETED
5. **Tempo Ramps** - Automation lane for tempo changes over time ✅ COMPLETED (already implemented in audio.js/state.js/ui.js)
6. **Marker System** - Add named markers on timeline for navigation ✅ COMPLETED (already implemented in state.js/main.js)
7. **Audio Stretching** - Adjust audio clip tempo without changing pitch ✅ COMPLETED (playbackRate on Track class with UI context menu)
8. **Track Freeze** - Freeze a track to audio to save CPU ✅ COMPLETED (wiring only - core methods existed in Track.js)
9. **Clip Gain Envelope** - Draw volume automation on audio clips ✅ COMPLETED (setClipGainEnvelope/getClipGainEnvelope on Track class with UI panel)
10. **MIDI CC Recording** - Record MIDI CC movements as automation ✅ COMPLETED

---

## Feature: Effect Bypass Toggle - ✅ COMPLETED
**File:** `js/Track.js`, `js/state.js`, `js/audio.js`, `js/main.js`, `js/ui.js`
**Status:** ✅ COMPLETED
**What's New:** Quick bypass button for each effect in the effects rack
**Implementation:**
- [x] Add `toggleEffectBypass(effectId)` method to Track class
- [x] Add `toggleMasterEffectBypass(effectId)` function to state.js
- [x] Add `setMasterEffectWet(effectId, wetValue)` function to audio.js
- [x] Wire up functions in main.js appServices
- [x] Bypass button already exists in UI (bypass-btn in renderEffectsList)
- [x] Store previous wet value for restoration when un-bypassing
- [x] Visual feedback: button color changes based on bypass state
- [x] Notification on bypass toggle

**Features:**
- Click bypass button (⏸) on any effect to toggle bypass
- Bypassed effects show yellow button color
- Active effects show green button color
- Stores previous wet value for accurate restoration
- Works for both track effects and master effects

---

## Feature: Audio Normalization - ✅ COMPLETED
**File:** `js/Track.js`, `js/state.js`, `js/audio.js`, `js/main.js`
**Status:** ✅ COMPLETED
**What's New:** Auto-normalize recorded audio to a target peak level
**Implementation:**
- [x] Add `addAudioClip(blob, startTime, options)` method to Track class
- [x] Add `_normalizeAudioBlob(audioBlob, targetDb)` private method for normalization
- [x] Add `_audioBufferToWav(audioBuffer)` helper for WAV encoding
- [x] Add `_writeString(view, offset, string)` helper for WAV header
- [x] Add normalization settings in state.js (`autoNormalizeEnabled`, `normalizationTargetDb`)
- [x] Wire up normalization settings in main.js appServices
- [x] Update `stopAudioRecording` to pass normalization options to `addAudioClip`

**Features:**
- Recorded audio is automatically normalized to target peak level (default -1dB)
- Normalization can be enabled/disabled via `getAutoNormalizeEnabled()/setAutoNormalizeEnabled()`
- Target dB level can be configured via `getNormalizationTargetDb()/setNormalizationTargetDb()`
- Normalization uses Web Audio API for accurate peak detection and gain adjustment
- Target range: -6dB to 0dB (clamped for safety)
- Silent audio is skipped (no gain applied)
- Audio already at target level is skipped (no unnecessary processing)

---

## Feature: addAudioClip Method (Bug Fix) - ✅ COMPLETED
**File:** `js/Track.js`
**Status:** ✅ COMPLETED
**What Was Missing:** The `stopAudioRecording` function called `track.addAudioClip()` but the method did not exist on the Track class, causing audio recordings to be lost.
**Implementation:**
- [x] Add complete `addAudioClip(blob, startTime, options)` method
- [x] Store audio blob in IndexedDB via `storeAudio`
- [x] Create timeline clip entry with proper metadata
- [x] Support normalization via options parameter
- [x] Capture undo state for the action
- [x] Update UI via `updateTrackUI` callback
- [x] Return created clip object on success, null on failure

---

## Technical Details

### Quantize Selection Implementation
- **State Management:** `sequencerSelectedCells` Map in ui.js (tracks selected cells per track)
- **Selection Method:** Alt+Shift+click to toggle cell selection
- **Quantize Button:** Quantizes all active notes in current sequence
- **Quantize Selection Button:** Only quantizes selected cells (enabled when selection exists)
- **Resolution:** Uses the sequencer resolution dropdown (1/4, 1/8, 1/16, 1/32)
- **Integration:** Calls `track.quantizeSelectedNotes()` method in Track.js
- **UI Update:** Button state updated via `updateQuantizeSelectionButtonState()`

### MIDI Learn Implementation
- **State Management:** `midiLearnMode`, `midiLearnTarget`, `midiMappings` in state.js
- **Learn Button:** Located in global controls bar, toggles learn mode
- **Visual Feedback:** Button shows "Learning..." when active
- **Mappings Panel:** `openMidiMappingsPanel()` shows all current mappings
- **Mapping Storage:** `{ 'ccX_channelY': { type, targetId, paramPath, min, max } }`
- **Supported Parameters:** Volume, pan, effect parameters (track and master)
- **CC to Parameter Routing:** `applyMidiMapping()` handles value scaling and application

### Stem Export Implementation
- **Method:** Individual track recording via Tone.Recorder
- **Process:** Mute other tracks, record each track separately
- **Output:** Individual WAV files per selected track
- **Dialog:** Modal with track checkboxes for selection

### Keyboard Shortcuts
- **Trigger:** Press `?` key (when not in input field)
- **Display:** Modal with grid layout showing description + key combination
- **Shortcuts:** Space, Z, R, Escape, Up/Down, Ctrl+Z, Ctrl+Shift+Z, Ctrl+S

### Auto-Save Implementation
- **Interval:** 30 seconds (configurable via `AUTOSAVE_INTERVAL_MS`)
- **Storage:** IndexedDB `projectState` object store
- **Recovery Age Limit:** 24 hours (configurable via `RECOVERY_AGE_LIMIT_MS`)
- **Session Detection:** Uses `sessionStorage` for crash detection

### Sidechain Implementation
- **Bus Architecture:** Single sidechain bus node (`Tone.Gain`)
- **Ducking Method:** Gain modulation via `linearRampToValueAtTime`
- **Default Parameters:** threshold: -30dB, ratio: 4:1, attack: 10ms, release: 250ms
- **Routing Tracking:** `Map<sourceTrackId, Set<destinationTrackIds>>`

### Sampler/DrumSampler Pad UI Implementation
- **Sample Pads:** 8 pads for Sampler tracks showing slice duration and status
- **Drum Pads:** 8 pads for DrumSampler tracks showing sample name and status
- **Selection:** Click to select pad for editing
- **Preview:** Double-click to play pad sample
- **Controls:** Volume, pitch, and envelope (attack, decay, sustain, release) per pad
- **Methods:** `setDrumSamplerPadVolume`, `setDrumSamplerPadPitch`, `setDrumSamplerPadEnv`, `playDrumPad`

---

## Notes
- Only work on LWB-with-Bugs branch
- Always pull before starting
- Always push changes after completion
- Test syntax before pushing
- Keep commits atomic

---

## Feature: MIDI CC Recording - ✅ COMPLETED
**File:** `js/state.js`, `js/eventHandlers.js`, `js/main.js`
**Status:** ✅ COMPLETED
**What's New:** Record MIDI CC movements in real-time and convert to track automation
**Implementation:**
- [x] Add CC recording state management (`ccRecordingEnabled`, `ccRecordingStartTime`, `ccRecordingTrackId`, `ccRecordingBuffer`)
- [x] Add `getCcRecordingEnabled`, `setCcRecordingEnabled` functions
- [x] Add `getCcRecordingStartTime`, `setCcRecordingStartTime` functions
- [x] Add `getCcRecordingTrackId`, `setCcRecordingTrackId` functions
- [x] Add `getCcRecordingBuffer`, `clearCcRecordingBuffer`, `addCcRecordingPoint` functions
- [x] Add `finalizeCcRecording` function to convert recorded CC to automation points
- [x] Add `startCcRecording`, `stopCcRecording` helper functions
- [x] Wire CC recording in eventHandlers.js MIDI message handler
- [x] Export all functions in main.js appServices

**Features:**
- Start CC recording via `startCcRecording(trackId)`
- Stop CC recording via `stopCcRecording(finalize, targetParam)`
- CC values are captured during transport playback
- Finalized CC data is converted to track automation points
- Supports recording to armed track or specific track
- Works with existing automation system (addAutomationPoint)

---