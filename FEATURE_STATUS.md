# SnugOS DAW - Feature Status Report

**Generated:** 2026-04-19
**Branch:** LWB-with-Bugs

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
- [ ] Create UI for routing source to destination (future enhancement)

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

### Feature 5: Sound Browser Preview Controls
**File:** `js/ui.js` (sound browser sections)
**Status:** ⚠️ Partially Implemented
**What's Missing:** Preview button exists but waveform visualization missing
**Implementation Plan:**
- [ ] Add waveform preview display
- [ ] Implement playhead position indicator
- [ ] Add preview volume control

### Feature 6: Mixer Window Complete Implementation
**File:** `js/ui.js` (mixer sections)
**Status:** ⚠️ Partially Implemented
**What's Missing:** Basic mixer exists but sends incomplete
**Implementation Plan:**
- [ ] Implement send/return routing UI
- [ ] Add pan control for stereo

---

## 🟢 Low Priority - Nice-to-Have

### Feature 7: MIDI Learn / Mapping
**File:** `js/eventHandlers.js`
**Status:** ⚠️ Not Implemented
**What's Missing:** No way to map MIDI CC to parameters
**Implementation Plan:**
- [ ] Add MIDI learn mode
- [ ] Store CC mappings in track state
- [ ] Implement CC to parameter routing

### Feature 8: Stem Export
**File:** `js/state.js`
**Status:** ⚠️ Not Implemented
**What's Missing:** Can only export full mix, not individual track stems
**Implementation Plan:**
- [ ] Add multi-track recording capability
- [ ] Create stem export dialog

---

## Session Progress

### Completed This Session
- ✅ **Implemented Auto-Save Recovery** - Full functionality including:
  - `storeProjectState()`, `getProjectState()`, `deleteProjectState()` in `js/db.js`
  - New `projectState` IndexedDB object store for project state persistence
  - `startAutoSave()` - Periodic auto-save every 30 seconds
  - `checkCrashRecovery()` - Detects and recovers from crashes
  - `createRecoveryDialog()` - User-friendly recovery UI
  - Session end detection via `beforeunload` and `pagehide` events
- ✅ **Implemented Sidechain Routing** - Full functionality including:
  - `getSidechainBusNode()` - Sidechain bus for routing
  - `setupSidechainRouting()` - Configure source/destination routing
  - `triggerSidechainForTrack()` - Apply ducking during playback
  - `removeSidechainRouting()`, `clearAllSidechainForTrack()` - Cleanup functions
  - `getActiveSidechainRoutings()` - Query current routings

### In Progress
- (none)

### Next to Tackle
1. Add Sound Browser waveform preview
2. Implement Mixer send/return routing UI
3. Add MIDI Learn / Mapping

---

## Current Feature Queue

1. **Audio Recording** - Record audio from microphone into tracks
2. **VST Plugin Support** - Load WebAudio plugins via AudioWorklet
3. **MIDI File Import/Export** - Drag & drop .mid files
4. **Track Effects Presets** - Save/load effect chain presets per track
5. **Quantize Selection** - Quantize selected notes to grid
6. **Undo/Redo Visual Stack** - Show undo history in a panel
7. **Keyboard Shortcuts Panel** - Press `?` to show all shortcuts
8. **Waveform Visualization** - Draw waveform on audio clips
9. **Track Color Coding** - Assign colors to tracks for visual grouping

---

## Technical Details

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

---

## Notes
- Only work on LWB-with-Bugs branch
- Always pull before starting
- Always push changes after completion
- Test syntax before pushing
- Keep commits atomic
