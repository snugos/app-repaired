// js/main.js - Main Application Logic Orchestrator

// --- bgDb (IndexedDB for desktop backgrounds) ---
let bgDb;
const BG_DB_NAME = 'SnugOSBgDb';
const BG_DB_VERSION = 1;
const BG_STORE_NAME = 'backgrounds';
const DESKTOP_BACKGROUND_KEY = 'snaw_custom_desktop_bg';
const DESKTOP_BG_TYPE_KEY = 'snaw_custom_desktop_bg_type';

function initBgDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(BG_DB_NAME, BG_DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { bgDb = request.result; resolve(); };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(BG_STORE_NAME)) {
                db.createObjectStore(BG_STORE_NAME);
            }
        };
    });
}

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
// setupGenericDropZoneListeners is imported here but used via appServices by ui.js
import { showNotification as utilShowNotification, createContextMenu, showCustomModal, createDropZoneHTML, setupGenericDropZoneListeners } from './utils.js';
import {
    initializeEventHandlersModule, initializePrimaryEventListeners, setupMIDI, attachGlobalControlEvents,
    selectMIDIInput as eventSelectMIDIInput, 
    handleTrackMute as eventHandleTrackMute,
    handleTrackSolo as eventHandleTrackSolo,
    handleTrackArm as eventHandleTrackArm,
    handleRemoveTrack as eventHandleRemoveTrack,
    handleOpenTrackInspector as eventHandleOpenTrackInspector,
    handleOpenEffectsRack as eventHandleOpenEffectsRack,
    handleOpenSequencer as eventHandleOpenSequencer,
    handleBounceTrack as eventHandleBounceTrack,
    handleDuplicateTrack as eventHandleDuplicateTrack,
    handleTrackFreeze as eventHandleTrackFreeze,
    handleTimelineLaneDrop
} from './eventHandlers.js';
import {
    initializeStateModule, 
    // State Getters
    getTracksState, getTrackByIdState, getOpenWindowsState, getWindowByIdState, getHighestZState,
    getMasterEffectsState, getMasterGainValueState,
    getMidiAccessState, getActiveMIDIInputState,
    getLoadedZipFilesState, getSoundLibraryFileTreesState, getCurrentLibraryNameState,
    getCurrentSoundFileTreeState, getCurrentSoundBrowserPathState, getPreviewPlayerState,
    getClipboardDataState, getArmedTrackIdState, getSoloedTrackIdState, isTrackRecordingState,
    getRecordingTrackIdState,
    getActiveSequencerTrackIdState, getUndoStackState, getRedoStackState, getPlaybackModeState,
    getTrackEffectsPresetsState, saveTrackEffectPreset, deleteTrackEffectPreset, getTrackEffectPreset, getTrackEffectPresetNames,
    // MIDI Learn / Mapping
    getMidiLearnModeState, getMidiLearnTargetState, getMidiMappingsState,
    setMidiLearnModeState, setMidiLearnTargetState,
    addMidiMapping, removeMidiMapping, clearAllMidiMappings, getMidiMappingForCC,
    // MIDI CC Recording
    getCcRecordingEnabled, setCcRecordingEnabled,
    getCcRecordingStartTime, setCcRecordingStartTime,
    getCcRecordingTrackId, setCcRecordingTrackId,
    getCcRecordingBuffer, clearCcRecordingBuffer, addCcRecordingPoint,
    finalizeCcRecording, startCcRecording, stopCcRecording,
    // Loop Region State
    getLoopRegion, getLoopRegionEnabled, setLoopRegionEnabled, setLoopRegionStart, setLoopRegionEnd,
    // Scale Hint
    getScaleHintEnabled, setScaleHintEnabled, getScaleHintRoot, setScaleHintRoot,
    getScaleHintType, setScaleHintType, isNoteInScale, isNoteNameInScale, getScaleTypes, getScaleNotes,
    // State Setters
    addWindowToStoreState, removeWindowFromStoreState, setHighestZState, incrementHighestZState,
    setMasterEffectsState, setMasterGainValueState,
    setMidiAccessState, setActiveMIDIInputState,
    setLoadedZipFilesState,
    setSoundLibraryFileTreesState,
    setCurrentLibraryNameState, setCurrentSoundFileTreeState, setCurrentSoundBrowserPathState, setPreviewPlayerState,
    setClipboardDataState, setArmedTrackIdState, setSoloedTrackIdState, setIsRecordingState,
    setRecordingTrackIdState, setRecordingStartTimeState, setActiveSequencerTrackIdState,
    setPlaybackModeState,
    addMasterEffectToState, removeMasterEffectFromState,
    updateMasterEffectParamInState, reorderMasterEffectInState,
    toggleMasterEffectBypass,
} from './state.js';
import { removeMasterEffectFromAudio } from './audio.js';