// js/state.js - Application State Management
import * as Constants from './constants.js';
import { Track } from './Track.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry } from './effectsRegistry.js';
import {
    initAudioContextAndMasterMeter as audioInitAudioContextAndMasterMeter
} from './audio.js';


// --- Centralized State Variables ---
let tracks = [];
let trackIdCounter = 0;

let openWindowsMap = new Map();
let highestZ = 100;

let masterEffectsChainState = [];
let masterGainValueState = Tone.dbToGain(0); 

let midiAccessGlobal = null;
let activeMIDIInputGlobal = null;

let loadedZipFilesGlobal = {};
let soundLibraryFileTreesGlobal = {};
let currentLibraryNameGlobal = null;
let currentSoundFileTreeGlobal = null;
let currentSoundBrowserPathGlobal = [];
let previewPlayerGlobal = null;

let clipboardDataGlobal = { type: null, data: null, sourceTrackType: null, sequenceLength: null };

let activeSequencerTrackId = null; 
let soloedTrackId = null;
let armedTrackId = null;
let isRecordingGlobal = false;
let recordingTrackIdGlobal = null;
let recordingStartTimeGlobal = 0; 

let playbackMode = 'sequencer'; 

let isReconstructingDAW = false;
let undoStack = [];
let redoStack = [];
const MAX_UNDO_HISTORY = 50;

let selectedTimelineClipInfo = { 
    clipId: null,
    trackId: null,
    originalLeft: 0, 
    originalStartBeat: 0, 
};

let currentUserThemePreference = 'system'; 

let appServices = {}; 

export function initializeStateModule(appServicesFromMain) {
    appServices = appServicesFromMain || {};
    // Ensure the Imports library exists in the state from the beginning
    if (!soundLibraryFileTreesGlobal['Imports']) {
        soundLibraryFileTreesGlobal['Imports'] = {};
    }
    console.log("[State] State module initialized. AppServices keys:", Object.keys(appServices));
}

export async function addFileToSoundLibraryInternal(fileName, audioBlob) {
    if (!appServices.dbStoreAudio || !appServices.dbGetAudio) {
        console.error("Database services not available.");
        appServices.showNotification?.("Error: Database not ready.", 3000);
        return;
    }

    try {
        const dbKey = `imports/${fileName}`;
        await appServices.dbStoreAudio(dbKey, audioBlob);

        if (!soundLibraryFileTreesGlobal['Imports']) {
            soundLibraryFileTreesGlobal['Imports'] = {};
        }
        
        soundLibraryFileTreesGlobal['Imports'][fileName] = { 
            type: 'file', 
            fullPath: dbKey, 
            fileName: fileName 
        };
        
        appServices.renderSoundBrowser?.();

    } catch (error) {
        console.error("Failed to add file to sound library:", error);
        appServices.showNotification?.("Error saving imported file.", 3000);
    }
}

// --- Getters ---
export function getTracksState() { return [...tracks]; }
export function getTrackByIdState(trackId) { return tracks.find(t => t.id === trackId); }
export function getOpenWindowsState() { return openWindowsMap; }
export function getWindowByIdState(windowId) { return openWindowsMap.get(windowId); }
export function getHighestZState() { return highestZ; }
export function getMasterEffectsState() { return [...masterEffectsChainState]; }
export function getMasterGainValueState() { return masterGainValueState; }
export function getMidiAccessState() { return midiAccessGlobal; }
export function getActiveMIDIInputState() { return activeMIDIInputGlobal; }
export function getLoadedZipFilesState() { return loadedZipFilesGlobal; }
export function getSoundLibraryFileTreesState() { return soundLibraryFileTreesGlobal; }
export function getCurrentLibraryNameState() { return currentLibraryNameGlobal; }
export function getCurrentSoundFileTreeState() { return currentSoundFileTreeGlobal; }
export function getCurrentSoundBrowserPathState() { return [...currentSoundBrowserPathGlobal]; }
export function getPreviewPlayerState() { return previewPlayerGlobal; }
export function getClipboardDataState() { return { ...clipboardDataGlobal }; }
export function getArmedTrackIdState() { return armedTrackId; }
export function getSoloedTrackIdState() { return soloedTrackId; }
export function isTrackRecordingState() { return isRecordingGlobal; }
export function getRecordingTrackIdState() { return recordingTrackIdGlobal; }
export function getRecordingStartTimeState() { return recordingStartTimeGlobal; }
export function getActiveSequencerTrackIdState() { return activeSequencerTrackId; }
export function getUndoStackState() { return [...undoStack]; }
export function getRedoStackState() { return [...redoStack]; }
export function getPlaybackModeState() { return playbackMode; }
export function getSelectedTimelineClipInfoState() { return {...selectedTimelineClipInfo}; }
export function getCurrentUserThemePreferenceState() { return currentUserThemePreference; }
export function getIsReconstructingDAWState() { return isReconstructingDAW; }


// --- Setters ---
export function addWindowToStoreState(windowInstance) { if (windowInstance) openWindowsMap.set(windowInstance.id, windowInstance); }
export function removeWindowFromStoreState(windowId) { openWindowsMap.delete(windowId); }
export function setHighestZState(zIndex) { highestZ = zIndex; }
export function incrementHighestZState() { highestZ++; return highestZ; }
export function setIsReconstructingDAWState(state) { isReconstructingDAW = !!state; }

export function setMasterEffectsState(effectsArray) { 
    masterEffectsChainState = effectsArray || []; 
    appServices.updateMasterEffectsUI?.();
}
export function setMasterGainValueState(gainValue) { masterGainValueState = gainValue; }

export function setMidiAccessState(midi) { midiAccessGlobal = midi; }
export function setActiveMIDIInputState(input) { activeMIDIInputGlobal = input; }

export function setLoadedZipFilesState(libraryName, zipInstance, status = 'loaded') {
    loadedZipFilesGlobal[libraryName] = { zip: zipInstance, status: status, lastAccessed: Date.now() };
}
export function setSoundLibraryFileTreesState(libraryName, tree) {
    soundLibraryFileTreesGlobal[libraryName] = tree;
}
export function setCurrentLibraryNameState(name) { currentLibraryNameGlobal = name; }
export function setCurrentSoundFileTreeState(tree) { currentSoundFileTreeGlobal = tree; }
export function setCurrentSoundBrowserPathState(pathArray) { currentSoundBrowserPathGlobal = pathArray || []; }
export function setPreviewPlayerState(player) { previewPlayerGlobal = player; }

export function setClipboardDataState(data) { clipboardDataGlobal = data || { type: null, data: null, sourceTrackType: null, sequenceLength: null }; }

export function setArmedTrackIdState(trackId) {
    armedTrackId = trackId;
}

export function setSoloedTrackIdState(trackId) {
    const tracks = getTracksState();
    const oldSoloId = soloedTrackId;
    soloedTrackId = trackId;

    if (appServices.updateTrackUI) {
        if (oldSoloId !== null) {
            appServices.updateTrackUI(oldSoloId, 'soloChanged');
        }
        if (soloedTrackId !== null) {
            appServices.updateTrackUI(soloedTrackId, 'soloChanged');
        }
        tracks.forEach(t => {
            if (t.id !== oldSoloId && t.id !== soloedTrackId) {
                appServices.updateTrackUI(t.id, 'soloChanged');
            }
        });
    }
}

export function setIsRecordingState(isRec) { isRecordingGlobal = !!isRec; }
export function setRecordingTrackIdState(trackId) { recordingTrackIdGlobal = trackId; }
export function setRecordingStartTimeState(time) { recordingStartTimeGlobal = time; }
export function setActiveSequencerTrackIdState(trackId) { activeSequencerTrackId = trackId; }

export function setPlaybackModeState(newMode, skipUIUpdate = false) {
    if (playbackMode === newMode) return;
    const oldMode = playbackMode;
    playbackMode = newMode;
    if (appServices.captureStateForUndo) {
        appServices.captureStateForUndo(`Set Playback Mode to ${newMode}`);
    }
    if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
    }
    Tone.Transport.cancel(0);
    if (appServices.onPlaybackModeChange && !skipUIUpdate) {
        appServices.onPlaybackModeChange(newMode, oldMode);
    }
}

export function setSelectedTimelineClipInfoState(info) { selectedTimelineClipInfo = info || { clipId: null, trackId: null, originalLeft: 0, originalStartBeat: 0 }; }
export function setCurrentUserThemePreferenceState(preference) {
    if (['light', 'dark', 'system'].includes(preference)) {
        currentUserThemePreference = preference;
        localStorage.setItem('snugos-theme', preference);
        appServices.applyUserThemePreference?.();
    }
}

// --- Core State Actions ---
// --- FIX: Make this function async to handle instrument initialization ---
export async function addTrackToStateInternal(type, initialData = null, isUserAction = true) {
    let newTrack = null;
    try {
        const newTrackId = initialData?.id ?? trackIdCounter++;
        newTrack = new Track(newTrackId, type, initialData, appServices);
        if (newTrackId >= trackIdCounter) {
            trackIdCounter = newTrackId + 1;
        }
        tracks.push(newTrack);
        
        if (typeof newTrack.initializeInstrument === 'function') {
            // --- FIX: Await the instrument initialization to ensure audio path is complete ---
            await newTrack.initializeInstrument();
        }

        if (isUserAction) {
            appServices.captureStateForUndo?.(`Add Track: ${newTrack.name}`);
        }
        appServices.updateMixerWindow?.();
        appServices.renderTimeline?.();
        return newTrack;
    } catch (error) {
        console.error(`[State] CRITICAL ERROR while adding ${type} track:`, error);
        appServices.showNotification?.(`Failed to add ${type} track. See console for details.`, 5000);
        return null; 
    }
}

export function removeTrackFromStateInternal(trackId, isUserAction = true) {
    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex > -1) {
        const removedTrackData = tracks[trackIndex].serialize(); 
        if (isUserAction) {
            appServices.captureStateForUndo?.(`Remove Track ${removedTrackData.name}`, {
                undo: () => addTrackToStateInternal(removedTrackData.type, removedTrackData, false),
                redo: () => removeTrackFromStateInternal(trackId, false)
            });
        }
        tracks[trackIndex].dispose();
        tracks.splice(trackIndex, 1);
        appServices.updateMixerWindow?.();
        appServices.renderTimeline?.();
    }
}

export function addMasterEffectToState(effectType) {
    const effectDef = appServices.effectsRegistryAccess?.AVAILABLE_EFFECTS[effectType];
    if (!effectDef) {
        console.error(`Master effect definition for "${effectType}" not found.`);
        return;
    }
    const initialParams = appServices.effectsRegistryAccess.getEffectDefaultParams(effectType);
    const effectData = {
        id: `master-effect-${Date.now()}`,
        type: effectType,
        params: JSON.parse(JSON.stringify(initialParams))
    };
    masterEffectsChainState.push(effectData);
    appServices.addMasterEffectToAudio?.(effectData.id, effectData.type, effectData.params);
    appServices.updateMasterEffectsUI?.();
    appServices.captureStateForUndo?.(`Add Master Effect: ${effectDef.displayName}`);
}

export function removeMasterEffectFromState(effectId) {
    const index = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (index > -1) {
        const effect = masterEffectsChainState.splice(index, 1)[0];
        appServices.removeMasterEffectFromAudio?.(effect.id);
        appServices.updateMasterEffectsUI?.();
        appServices.captureStateForUndo?.(`Remove Master Effect: ${effect.type}`);
    }
}
export function updateMasterEffectParamInState(effectId, paramPath, value) {
    const effect = masterEffectsChainState.find(e => e.id === effectId);
    if (effect) {
        let paramState = effect.params;
        const keys = paramPath.split('.');
        const finalKey = keys.pop();
        for (const key of keys) {
           paramState[key] = paramState[key] || {};
           paramState = paramState[key];
        }
        paramState[finalKey] = value;
        appServices.updateMasterEffectParamInAudio?.(effectId, paramPath, value);
    }
}
export function reorderMasterEffectInState(effectId, newIndex) {
    const effectIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (effectIndex > -1 && newIndex >= 0 && newIndex < masterEffectsChainState.length) {
        const [effectToMove] = masterEffectsChainState.splice(effectIndex, 1);
        masterEffectsChainState.splice(newIndex, 0, effectToMove);
        appServices.reorderMasterEffectInAudio?.();
        appServices.updateMasterEffectsUI?.();
    }
}

export async function reconstructDAWInternal(projectData) {}
export function captureStateForUndoInternal(actionDescription, customRedo) {}
export function undoLastActionInternal() {}
export function redoLastActionInternal() {}
export function gatherProjectDataInternal(includeEffectsRegistry = false) {}
export async function saveProjectInternal() {}
export async function loadProjectInternal(file) {}
export async function handleProjectFileLoadInternal(event) {}
export async function exportToWavInternal() {}
