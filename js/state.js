// js/state.js - Application State Management
import * as Constants from './constants.js';
// showNotification, showConfirmationDialog are accessed via appServices
// import { showNotification, showConfirmationDialog } from './utils.js';
import { Track } from './Track.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry } from './effectsRegistry.js';
import {
    initAudioContextAndMasterMeter as audioInitAudioContextAndMasterMeter
} from './audio.js';
// import { getAudio, storeAudio } from './db.js'; // Not directly used in this file after refactor to Track class

// --- Centralized State Variables ---
let tracks = [];
let trackIdCounter = 0;

// Window Management
let openWindowsMap = new Map();
let highestZ = 100;

// Master Audio Chain
let masterEffectsChainState = []; // Array of {id, type, params, toneNode (managed by audio.js)}
let masterGainValueState = Tone.dbToGain(0); // Linear gain value

// MIDI State
let midiAccessGlobal = null;
let activeMIDIInputGlobal = null;

// Sound Browser State
let loadedZipFilesGlobal = {};
let soundLibraryFileTreesGlobal = {};
// MODIFICATION START: Add console logs for initialization
console.log('[State Init] Initializing. loadedZipFilesGlobal created:', loadedZipFilesGlobal);
console.log('[State Init] Initializing. soundLibraryFileTreesGlobal created:', soundLibraryFileTreesGlobal);
// MODIFICATION END
let currentLibraryNameGlobal = null;
let currentSoundFileTreeGlobal = null;
let currentSoundBrowserPathGlobal = [];
let previewPlayerGlobal = null;

// Clipboard
let clipboardDataGlobal = { type: null, data: null, sourceTrackType: null, sequenceLength: null };

// Transport/Sequencing State
let activeSequencerTrackId = null;
let soloedTrackId = null;
let armedTrackId = null;
let isRecordingGlobal = false;
let recordingTrackIdGlobal = null;
let recordingStartTime = 0;

let globalPlaybackMode = 'sequencer'; // 'sequencer' or 'timeline'

// Undo/Redo
let undoStack = [];
let redoStack = [];

// --- AppServices Placeholder (will be populated by main.js) ---
let appServices = {}; // Populated by initializeStateModule

export function initializeStateModule(services) {
    appServices = services || {}; // Ensure appServices is an object
    if (!Array.isArray(masterEffectsChainState)) {
        masterEffectsChainState = [];
    }
    // Ensure playback mode services are set up if not already provided
    if (appServices && typeof appServices.getPlaybackMode !== 'function') {
        appServices.getPlaybackMode = getPlaybackModeState;
    }
    if (appServices && typeof appServices.setPlaybackMode !== 'function') {
        appServices.setPlaybackMode = setPlaybackModeStateInternal;
    }
    console.log("[State] State module initialized. AppServices keys:", Object.keys(appServices));
}

// --- Getters for Centralized State ---
export function getTracksState() { return tracks; }
export function getTrackByIdState(id) { return tracks.find(t => t.id === id); }

export function getOpenWindowsState() { return openWindowsMap; }
export function getWindowByIdState(id) { return openWindowsMap.get(id); }
export function getHighestZState() { return highestZ; }

export function getMasterEffectsState() { return masterEffectsChainState; }
export function getMasterGainValueState() { return masterGainValueState; }

export function getMidiAccessState() { return midiAccessGlobal; }
export function getActiveMIDIInputState() { return activeMIDIInputGlobal; }

// MODIFICATION START: Add console logs to getters
export function getLoadedZipFilesState() {
    console.log('[State GET] getLoadedZipFilesState. Keys:', loadedZipFilesGlobal ? Object.keys(loadedZipFilesGlobal) : 'null/undefined');
    return loadedZipFilesGlobal;
}
export function getSoundLibraryFileTreesState() {
    console.log('[State GET] getSoundLibraryFileTreesState. Keys:', soundLibraryFileTreesGlobal ? Object.keys(soundLibraryFileTreesGlobal) : 'null/undefined');
    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"] && Object.keys(soundLibraryFileTreesGlobal["Drums"]).length > 0) {
        console.log('[State GET] "Drums" tree exists and is NOT empty.');
    } else if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.warn('[State GET] "Drums" tree exists but IS EMPTY!');
    }
    return soundLibraryFileTreesGlobal;
}
// MODIFICATION END
export function getCurrentLibraryNameState() { return currentLibraryNameGlobal; }
export function getCurrentSoundFileTreeState() { return currentSoundFileTreeGlobal; }
export function getCurrentSoundBrowserPathState() { return currentSoundBrowserPathGlobal; }
export function getPreviewPlayerState() { return previewPlayerGlobal; }

export function getClipboardDataState() { return clipboardDataGlobal; }

export function getArmedTrackIdState() { return armedTrackId; }
export function getSoloedTrackIdState() { return soloedTrackId; }
export function isTrackRecordingState() { return isRecordingGlobal; }
export function getRecordingTrackIdState() { return recordingTrackIdGlobal; }
export function getRecordingStartTimeState() { return recordingStartTime; }
export function getActiveSequencerTrackIdState() { return activeSequencerTrackId; }
export function getUndoStackState() { return undoStack; }
export function getRedoStackState() { return redoStack; }
export function getPlaybackModeState() { return globalPlaybackMode; }


// --- Setters for Centralized State (called internally or via appServices) ---
export function addWindowToStoreState(id, instance) { openWindowsMap.set(id, instance); }
export function removeWindowFromStoreState(id) { openWindowsMap.delete(id); }
export function setHighestZState(value) { highestZ = Number.isFinite(value) ? value : 100; }
export function incrementHighestZState() { return ++highestZ; }

export function setMasterEffectsState(newChain) { masterEffectsChainState = Array.isArray(newChain) ? newChain : []; }
export function setMasterGainValueState(value) { masterGainValueState = Number.isFinite(value) ? value : Tone.dbToGain(0); }

export function setMidiAccessState(access) { midiAccessGlobal = access; }
export function setActiveMIDIInputState(input) { activeMIDIInputGlobal = input; }

// MODIFICATION START: Add console logs to setters
export function setLoadedZipFilesState(files) {
    console.log('[State SET] setLoadedZipFilesState. Incoming keys:', files ? Object.keys(files) : 'null/undefined');
    loadedZipFilesGlobal = typeof files === 'object' && files !== null ? files : {};
    console.log('[State SET] setLoadedZipFilesState. loadedZipFilesGlobal NOW has keys:', Object.keys(loadedZipFilesGlobal));
    if (loadedZipFilesGlobal && loadedZipFilesGlobal["Drums"]) {
         console.log('[State SET] "Drums" JSZip instance IS in loadedZipFilesGlobal.');
    } else {
         console.log('[State SET] "Drums" JSZip instance IS NOT in loadedZipFilesGlobal after set.');
    }
}
export function setSoundLibraryFileTreesState(trees) {
    console.log('[State SET] setSoundLibraryFileTreesState. Incoming keys:', trees ? Object.keys(trees) : 'null/undefined');
    if (trees && trees["Drums"]) {
        console.log('[State SET] setSoundLibraryFileTreesState: Incoming "Drums" tree has keys count:', Object.keys(trees["Drums"]).length);
    } else if (trees) {
         console.log('[State SET] setSoundLibraryFileTreesState: Incoming trees object does not have "Drums" key.');
    }

    soundLibraryFileTreesGlobal = typeof trees === 'object' && trees !== null ? trees : {};
    console.log('[State SET] setSoundLibraryFileTreesState. soundLibraryFileTreesGlobal NOW has keys:', Object.keys(soundLibraryFileTreesGlobal));

    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.log('[State SET] "Drums" tree IS in soundLibraryFileTreesGlobal. Num children:', Object.keys(soundLibraryFileTreesGlobal["Drums"]).length);
        if (Object.keys(soundLibraryFileTreesGlobal["Drums"]).length === 0) {
            console.warn('[State SET] "Drums" tree in global state IS EMPTY!');
        }
    } else {
         console.log('[State SET] "Drums" tree IS NOT in soundLibraryFileTreesGlobal after set.');
    }
}
// MODIFICATION END

export function setCurrentLibraryNameState(name) { currentLibraryNameGlobal = name; }
export function setCurrentSoundFileTreeState(tree) { currentSoundFileTreeGlobal = tree; }
export function setCurrentSoundBrowserPathState(path) { currentSoundBrowserPathGlobal = Array.isArray(path) ? path : []; }
export function setPreviewPlayerState(player) { previewPlayerGlobal = player; }

export function setClipboardDataState(data) { clipboardDataGlobal = typeof data === 'object' && data !== null ? data : { type: null, data: null }; }

export function setArmedTrackIdState(id) { armedTrackId = id; }
export function setSoloedTrackIdState(id) { soloedTrackId = id; }
export function setIsRecordingState(status) { isRecordingGlobal = !!status; }
export function setRecordingTrackIdState(id) { recordingTrackIdGlobal = id; }
export function setRecordingStartTimeState(time) { recordingStartTime = Number.isFinite(time) ? time : 0; }
export function setActiveSequencerTrackIdState(id) { activeSequencerTrackId = id; }

export function setPlaybackModeStateInternal(mode) {
    const displayMode = typeof mode === 'string' ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Unknown';
    console.log(`[State setPlaybackModeStateInternal] Attempting to set mode to: ${mode} (Display: ${displayMode}). Current mode: ${globalPlaybackMode}`);

    if (mode === 'sequencer' || mode === 'timeline') {
        if (globalPlaybackMode !== mode) {
            if (appServices.captureStateForUndo) {
                appServices.captureStateForUndo(`Set Playback Mode to ${displayMode}`);
            } else {
                captureStateForUndoInternal(`Set Playback Mode to ${displayMode}`); // Fallback
            }
            globalPlaybackMode = mode;
            console.log(`[State setPlaybackModeStateInternal] Playback mode changed to: ${globalPlaybackMode}`);

            if (Tone.Transport.state === 'started') {
                console.log("[State setPlaybackModeStateInternal] Transport was started, stopping it.");
                Tone.Transport.stop();
            }
            Tone.Transport.cancel(0); // Cancel all scheduled events
            console.log("[State setPlaybackModeStateInternal] Tone.Transport events cancelled.");

            if (appServices.uiElementsCache?.playBtnGlobal) {
                appServices.uiElementsCache.playBtnGlobal.textContent = 'Play';
                console.log("[State setPlaybackModeStateInternal] Play button text reset.");
            } else {
                console.warn("[State setPlaybackModeStateInternal] Play button UI element not found in cache.");
            }
            document.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));

            const currentTracks = getTracksState();
            console.log(`[State setPlaybackModeStateInternal] Re-initializing sequences/playback for ${currentTracks.length} tracks for new mode: ${globalPlaybackMode}.`);
            try {
                currentTracks.forEach(track => {
                    if (track && track.type !== 'Audio' && typeof track.recreateToneSequence === 'function') {
                        track.recreateToneSequence(true); // true to force restart
                    }
                    // If switching to sequencer mode, stop any timeline-based audio clip playback
                    if (globalPlaybackMode === 'sequencer' && track && track.type === 'Audio' && typeof track.stopPlayback === 'function') {
                        track.stopPlayback();
                    }
                });
            } catch (error) {
                console.error("[State setPlaybackModeStateInternal] Error during track sequence/playback re-initialization:", error);
                if(appServices.showNotification) appServices.showNotification("Error updating track playback for new mode.", 3000);
            }


            if (appServices.onPlaybackModeChange && typeof appServices.onPlaybackModeChange === 'function') {
                appServices.onPlaybackModeChange(globalPlaybackMode);
            }
             if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') {
                appServices.renderTimeline();
            }
        } else {
            console.log(`[State setPlaybackModeStateInternal] Mode is already ${mode}. No change.`);
        }
    } else {
        console.warn(`[State setPlaybackModeStateInternal] Invalid playback mode attempted: ${mode}. Expected 'sequencer' or 'timeline'.`);
    }
}
export { setPlaybackModeStateInternal as setPlaybackModeState }; // Export with the name expected by other modules

// --- Track Management ---
export async function addTrackToStateInternal(type, initialData = null, isUserAction = true) {
    // _isUserActionPlaceholder is used by UI event handlers to signify a brand new track from user action,
    // vs. a track being added during project load/undo/redo.
    const isBrandNewUserTrack = isUserAction && (!initialData || initialData._isUserActionPlaceholder);
    console.log(`[State addTrackToStateInternal] Adding ${type} track. User Action: ${isUserAction}, Brand New: ${isBrandNewUserTrack}`);

    if (isBrandNewUserTrack) {
        captureStateForUndoInternal(`Add ${type} Track`);
        if (initialData && initialData._isUserActionPlaceholder) initialData = null; // Clear placeholder
    }

    let newTrack;
    try {
        let newTrackId;
        if (initialData && initialData.id != null && Number.isFinite(initialData.id)) {
            newTrackId = initialData.id;
            if (newTrackId >= trackIdCounter) trackIdCounter = newTrackId + 1;
        } else {
            newTrackId = trackIdCounter++;
        }

        const trackAppServices = { // Pass necessary services to the Track instance
            getSoloedTrackId: getSoloedTrackIdState,
            captureStateForUndo: captureStateForUndoInternal,
            updateTrackUI: appServices.updateTrackUI, // These come from main.js
            highlightPlayingStep: appServices.highlightPlayingStep,
            autoSliceSample: appServices.autoSliceSample,
            closeAllTrackWindows: appServices.closeAllTrackWindows,
            getMasterEffectsBusInputNode: appServices.getMasterEffectsBusInputNode,
            showNotification: appServices.showNotification,
            effectsRegistryAccess: appServices.effectsRegistryAccess,
            renderTimeline: appServices.renderTimeline,
            getPlaybackMode: getPlaybackModeState,
            getTrackById: getTrackByIdState, // Track might need to interact with other tracks (e.g. sidechaining in future)
            getTracks: getTracksState
        };

        newTrack = new Track(newTrackId, type, initialData, trackAppServices);
        tracks.push(newTrack);

        if (typeof newTrack.initializeAudioNodes === 'function') {
            await newTrack.initializeAudioNodes();
        }
        // fullyInitializeAudioResources handles loading samples from DB/URL etc.
        await newTrack.fullyInitializeAudioResources();

        if (isBrandNewUserTrack && appServices.showNotification) {
            appServices.showNotification(`${newTrack.name} added successfully.`, 2000);
        }
        if (isBrandNewUserTrack && appServices.openTrackInspectorWindow) {
             // Delay opening inspector slightly to ensure track is fully set up
            setTimeout(() => appServices.openTrackInspectorWindow(newTrack.id), 50);
        }

        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State addTrackToStateInternal] Error adding ${type} track:`, error);
        if (appServices.showNotification) {
            appServices.showNotification(`Failed to add ${type} track: ${error.message}`, 4000);
        }
        // If track creation failed, ensure it's not in the tracks array if partially added
        if (newTrack && tracks.includes(newTrack)) {
            tracks = tracks.filter(t => t.id !== newTrack.id);
        }
        return null; // Indicate failure
    }
    return newTrack;
}

export function removeTrackFromStateInternal(trackId) {
    try {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex === -1) {
            console.warn(`[State removeTrackFromStateInternal] Track ID ${trackId} not found for removal.`);
            return;
        }

        const track = tracks[trackIndex];
        captureStateForUndoInternal(`Remove Track "${track.name}"`);

        if (typeof track.dispose === 'function') {
            track.dispose();
        }
        tracks.splice(trackIndex, 1);

        if (armedTrackId === trackId) setArmedTrackIdState(null);
        if (soloedTrackId === trackId) {
            setSoloedTrackIdState(null);
            // Re-evaluate solo states for all other tracks
            tracks.forEach(t => {
                if (t) {
                    t.isSoloed = false; // Explicitly set, then applySoloState will use global state
                    if (typeof t.applySoloState === 'function') t.applySoloState();
                    if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                }
            });
        }
        if (activeSequencerTrackId === trackId) setActiveSequencerTrackIdState(null);

        if (appServices.showNotification) appServices.showNotification(`Track "${track.name}" removed.`, 2000);
        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State removeTrackFromStateInternal] Error removing track ${trackId}:`, error);
        if (appServices.showNotification) appServices.showNotification(`Error removing track: ${error.message}`, 3000);
    }
}

// --- Master Effects Chain Management ---
export function addMasterEffectToState(effectType, initialParams) {
    const effectId = `mastereffect_${effectType}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const defaultParams = appServices.effectsRegistryAccess?.getEffectDefaultParams
        ? appServices.effectsRegistryAccess.getEffectDefaultParams(effectType)
        : getEffectDefaultParamsFromRegistry(effectType); // Fallback

    masterEffectsChainState.push({
        id: effectId,
        type: effectType,
        params: initialParams || defaultParams
    });
    return effectId;
}

export function removeMasterEffectFromState(effectId) {
    const effectIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (effectIndex > -1) {
        masterEffectsChainState.splice(effectIndex, 1);
    }
}

export function updateMasterEffectParamInState(effectId, paramPath, value) {
    const effectWrapper = masterEffectsChainState.find(e => e.id === effectId);
    if (!effectWrapper || !effectWrapper.params) {
        console.warn(`[State updateMasterEffectParamInState] Effect wrapper or params not found for ID: ${effectId}`);
        return;
    }
    try {
        const keys = paramPath.split('.');
        let currentStoredParamLevel = effectWrapper.params;
        for (let i = 0; i < keys.length - 1; i++) {
            currentStoredParamLevel[keys[i]] = currentStoredParamLevel[keys[i]] || {};
            currentStoredParamLevel = currentStoredParamLevel[keys[i]];
        }
        currentStoredParamLevel[keys[keys.length - 1]] = value;
    } catch (error) {
        console.error(`[State updateMasterEffectParamInState] Error updating param ${paramPath} for effect ${effectId}:`, error);
    }
}

export function reorderMasterEffectInState(effectId, newIndex) {
    const oldIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (oldIndex === -1 || oldIndex === newIndex || newIndex < 0 || newIndex >= masterEffectsChainState.length) {
        if (oldIndex === -1) console.warn(`[State reorderMasterEffectInState] Effect ID ${effectId} not found.`);
        return;
    }
    const [effectToMove] = masterEffectsChainState.splice(oldIndex, 1);
    masterEffectsChainState.splice(newIndex, 0, effectToMove);
}

// --- Undo/Redo Logic ---
function updateInternalUndoRedoState() {
    if (appServices.updateUndoRedoButtonsUI && typeof appServices.updateUndoRedoButtonsUI === 'function') {
        try {
            appServices.updateUndoRedoButtonsUI(
                undoStack.length > 0 ? undoStack[undoStack.length - 1] : null,
                redoStack.length > 0 ? redoStack[redoStack.length - 1] : null
            );
        } catch (error) {
            console.error("[State updateInternalUndoRedoState] Error calling appServices.updateUndoRedoButtonsUI:", error);
        }
    }
}

export function captureStateForUndoInternal(description = "Unknown action") {
    try {
        const currentState = gatherProjectDataInternal();
        if (!currentState) {
            console.error("[State captureStateForUndoInternal] Failed to gather project data. Aborting undo capture.");
            return;
        }
        currentState.description = description; // Add description to the state object
        undoStack.push(JSON.parse(JSON.stringify(currentState))); // Deep copy
        if (undoStack.length > Constants.MAX_HISTORY_STATES) {
            undoStack.shift();
        }
        redoStack = []; // Clear redo stack on new action
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State captureStateForUndoInternal] Error capturing state for undo:", error);
        if (appServices.showNotification) appServices.showNotification("Error capturing undo state. See console.", 3000);
    }
}

export async function undoLastActionInternal() {
    if (undoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to undo.", 1500);
        return;
    }
    try {
        const stateToRestore = undoStack.pop();
        const currentStateForRedo = gatherProjectDataInternal();
        if (!currentStateForRedo) {
            console.error("[State undoLastActionInternal] Failed to gather current project data for redo stack. Undoing without pushing to redo.");
        } else {
            currentStateForRedo.description = stateToRestore.description; // Use the undone action's description for redo
            redoStack.push(JSON.parse(JSON.stringify(currentStateForRedo)));
            if (redoStack.length > Constants.MAX_HISTORY_STATES) redoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Undoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true; // Signal reconstruction globally
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State undoLastActionInternal] Error during undo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during undo operation: ${error.message}. Project may be unstable.`, 4000);
        // Potentially try to restore the popped state back to undoStack if reconstruction fails badly? Complex.
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

export async function redoLastActionInternal() {
    if (redoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to redo.", 1500);
        return;
    }
    try {
        const stateToRestore = redoStack.pop();
        const currentStateForUndo = gatherProjectDataInternal();
        if (!currentStateForUndo) {
            console.error("[State redoLastActionInternal] Failed to gather current project data for undo stack. Redoing without pushing to undo.");
        } else {
            currentStateForUndo.description = stateToRestore.description;
            undoStack.push(JSON.parse(JSON.stringify(currentStateForUndo)));
            if (undoStack.length > Constants.MAX_HISTORY_STATES) undoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Redoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true;
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State redoLastActionInternal] Error during redo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during redo operation: ${error.message}. Project may be unstable.`, 4000);
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

// --- Project Data Handling ---
export function gatherProjectDataInternal() {
    console.log("[State gatherProjectDataInternal] Starting to gather project data...");
    try {
        const projectData = {
            version: Constants.APP_VERSION || "5.9.1", // Use a constant for app version
            globalSettings: {
                tempo: Tone.Transport.bpm.value,
                masterVolume: getMasterGainValueState(),
                activeMIDIInputId: getActiveMIDIInputState() ? getActiveMIDIInputState().id : null,
                soloedTrackId: getSoloedTrackIdState(),
                armedTrackId: getArmedTrackIdState(),
                highestZIndex: getHighestZState(),
                playbackMode: getPlaybackModeState(),
            },
            masterEffects: getMasterEffectsState().map(effect => ({
                id: effect.id,
                type: effect.type,
                params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {} // Ensure params exist
            })),
            tracks: getTracksState().map(track => {
                if (!track || typeof track.id === 'undefined') {
                    console.warn("[State gatherProjectDataInternal] Invalid track object found, skipping:", track);
                    return null; // Skip invalid tracks
                }
                const trackData = { // Base data
                    id: track.id, type: track.type, name: track.name,
                    isMuted: track.isMuted,
                    volume: track.previousVolumeBeforeMute, // Store the actual volume, not the muted one
                    activeEffects: (track.activeEffects || []).map(effect => ({
                        id: effect.id, type: effect.type,
                        params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {}
                    })),
                    automation: track.automation ? JSON.parse(JSON.stringify(track.automation)) : { volume: [] },
                    // Type-specific sequence/clip data
                    sequences: track.type !== 'Audio' && track.sequences ? JSON.parse(JSON.stringify(track.sequences)) : [],
                    activeSequenceId: track.type !== 'Audio' ? track.activeSequenceId : null,
                    timelineClips: track.timelineClips ? JSON.parse(JSON.stringify(track.timelineClips)) : [],
                };
                // Type-specific parameters
                if (track.type === 'Synth') {
                    trackData.synthEngineType = track.synthEngineType || 'MonoSynth';
                    trackData.synthParams = track.synthParams ? JSON.parse(JSON.stringify(track.synthParams)) : {};
                } else if (track.type === 'Sampler') {
                    trackData.samplerAudioData = {
                        fileName: track.samplerAudioData?.fileName,
                        dbKey: track.samplerAudioData?.dbKey,
                        // status is runtime, not strictly needed for save, but useful for rehydration hint
                        status: track.samplerAudioData?.dbKey ? 'persisted' : (track.samplerAudioData?.fileName ? 'volatile' : 'empty')
                    };
                    trackData.slices = track.slices ? JSON.parse(JSON.stringify(track.slices)) : [];
                    trackData.selectedSliceForEdit = track.selectedSliceForEdit;
                    trackData.slicerIsPolyphonic = track.slicerIsPolyphonic;
                } else if (track.type === 'DrumSampler') {
                    trackData.drumSamplerPads = (track.drumSamplerPads || []).map(p => ({
                        originalFileName: p.originalFileName, dbKey: p.dbKey,
                        volume: p.volume, pitchShift: p.pitchShift,
                        envelope: p.envelope ? JSON.parse(JSON.stringify(p.envelope)) : {},
                        status: p.dbKey ? 'persisted' : (p.originalFileName ? 'volatile' : 'empty')
                    }));
                    trackData.selectedDrumPadForEdit = track.selectedDrumPadForEdit;
                } else if (track.type === 'InstrumentSampler') {
                    trackData.instrumentSamplerSettings = {
                        originalFileName: track.instrumentSamplerSettings?.originalFileName,
                        dbKey: track.instrumentSamplerSettings?.dbKey,
                        rootNote: track.instrumentSamplerSettings?.rootNote,
                        loop: track.instrumentSamplerSettings?.loop,
                        loopStart: track.instrumentSamplerSettings?.loopStart,
                        loopEnd: track.instrumentSamplerSettings?.loopEnd,
                        envelope: track.instrumentSamplerSettings?.envelope ? JSON.parse(JSON.stringify(track.instrumentSamplerSettings.envelope)) : {},
                        status: track.instrumentSamplerSettings?.dbKey ? 'persisted' : (track.instrumentSamplerSettings?.originalFileName ? 'volatile' : 'empty')
                    };
                    trackData.instrumentSamplerIsPolyphonic = track.instrumentSamplerIsPolyphonic;
                }
                 if (track.type === 'Audio') { // Audio track specific settings
                    trackData.isMonitoringEnabled = track.isMonitoringEnabled;
                }
                // Remove deprecated/runtime-only properties if they accidentally get included
                delete trackData.sequenceData; delete trackData.sequenceLength;
                return trackData;
            }).filter(td => td !== null), // Filter out any skipped invalid tracks
            windowStates: Array.from(getOpenWindowsState().values())
                .map(win => {
                    if (!win || !win.element) return null;
                    return {
                        id: win.id, title: win.title,
                        left: win.element.style.left, top: win.element.style.top,
                        width: win.element.style.width, height: win.element.style.height,
                        zIndex: parseInt(win.element.style.zIndex, 10) || 100,
                        isMinimized: win.isMinimized,
                        isMaximized: win.isMaximized, // Save maximized state
                        restoreState: win.isMaximized ? JSON.parse(JSON.stringify(win.restoreState)) : {},
                        initialContentKey: win.initialContentKey || win.id // Ensure this is saved
                    };
                }).filter(ws => ws !== null)
        };
        console.log("[State gatherProjectDataInternal] Project data gathered successfully.");
        return projectData;
    } catch (error) {
        console.error("[State gatherProjectDataInternal] Error gathering project data:", error);
        if (appServices.showNotification) appServices.showNotification("Error preparing project data for saving/undo.", 4000);
        return null;
    }
}

export async function reconstructDAWInternal(projectData, isUndoRedo = false) {
    if (!projectData) {
        console.error("[State reconstructDAWInternal] projectData is null or undefined. Aborting reconstruction.");
        if (appServices.showNotification) appServices.showNotification("Error: Invalid project data for loading.", 4000);
        return;
    }
    if (appServices) appServices._isReconstructingDAW_flag = true;
    console.log(`[State reconstructDAWInternal] Starting reconstruction. IsUndoRedo: ${isUndoRedo}`);

    try { // --- Global Stop and Reset ---
        if (Tone.Transport.state === 'started') Tone.Transport.stop();
        Tone.Transport.cancel();
        await audioInitAudioContextAndMasterMeter(true); // Ensure audio context is running, true for user initiated context
        (getTracksState() || []).forEach(track => { if (track && typeof track.dispose === 'function') track.dispose(); });
        tracks = [];
        trackIdCounter = 0;
        if (appServices.clearAllMasterEffectNodes) appServices.clearAllMasterEffectNodes(); else console.warn("clearAllMasterEffectNodes service missing");
        masterEffectsChainState = [];
        if (appServices.closeAllWindows) appServices.closeAllWindows(true); else console.warn("closeAllWindows service missing");
        if (appServices.clearOpenWindowsMap) appServices.clearOpenWindowsMap(); else console.warn("clearOpenWindowsMap service missing");
        highestZ = 100;
        setArmedTrackIdState(null); setSoloedTrackIdState(null); setActiveSequencerTrackIdState(null);
        setIsRecordingState(false); setRecordingTrackIdState(null);
        if (appServices.updateRecordButtonUI) appServices.updateRecordButtonUI(false);
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during global reset phase:", error);
        if (appServices.showNotification) appServices.showNotification("Critical error during project reset.", 5000);
        if (appServices) appServices._isReconstructingDAW_flag = false;
        return; // Abort further reconstruction
    }

    try { // --- Global Settings ---
        const gs = projectData.globalSettings || {};
        Tone.Transport.bpm.value = Number.isFinite(gs.tempo) ? gs.tempo : 120;
        setMasterGainValueState(Number.isFinite(gs.masterVolume) ? gs.masterVolume : Tone.dbToGain(0));
        if (appServices.setActualMasterVolume) appServices.setActualMasterVolume(getMasterGainValueState());
        setPlaybackModeStateInternal(gs.playbackMode === 'timeline' || gs.playbackMode === 'sequencer' ? gs.playbackMode : 'sequencer');
        if (appServices.updateTaskbarTempoDisplay) appServices.updateTaskbarTempoDisplay(Tone.Transport.bpm.value);
        setHighestZState(Number.isFinite(gs.highestZIndex) ? gs.highestZIndex : 100);
        // Armed and Soloed will be set after tracks are created
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error applying global settings:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading global settings.", 3000);
    }

    try { // --- Master Effects ---
        if (projectData.masterEffects && Array.isArray(projectData.masterEffects)) {
            for (const effectData of projectData.masterEffects) {
                if (effectData && effectData.type) {
                    const effectIdInState = addMasterEffectToState(effectData.type, effectData.params || {});
                    if (appServices.addMasterEffectToAudio) {
                         await appServices.addMasterEffectToAudio(effectIdInState, effectData.type, effectData.params || {});
                    }
                } else { console.warn("[State reconstructDAWInternal] Invalid master effect data found:", effectData); }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructing master effects:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading master effects.", 3000);
    }

    try { // --- Tracks ---
        if (projectData.tracks && Array.isArray(projectData.tracks)) {
            const trackPromises = projectData.tracks.map(trackData => {
                if (trackData && trackData.type) {
                    return addTrackToStateInternal(trackData.type, trackData, false); // false for isUserAction
                } else { console.warn("[State reconstructDAWInternal] Invalid track data found:", trackData); return Promise.resolve(null); }
            });
            await Promise.all(trackPromises);
            // After all tracks and their audio resources are initialized:
            console.log(`[State reconstructDAWInternal] All track instances created. Now setting armed/soloed states.`);
            const globalSettings = projectData.globalSettings || {};
            if (globalSettings.armedTrackId !== null && typeof globalSettings.armedTrackId !== 'undefined') {
                setArmedTrackIdState(globalSettings.armedTrackId);
            }
            if (globalSettings.soloedTrackId !== null && typeof globalSettings.soloedTrackId !== 'undefined') {
                setSoloedTrackIdState(globalSettings.soloedTrackId);
                getTracksState().forEach(t => { // Apply solo state after all tracks are potentially available
                    if (t) {
                        t.isSoloed = (t.id === getSoloedTrackIdState());
                        if (typeof t.applySoloState === 'function') t.applySoloState();
                        if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructing tracks:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading tracks.", 3000);
    }

    // Window reconstruction needs to happen after tracks are potentially created, as some windows depend on track IDs.
    try {
        if (projectData.windowStates && Array.isArray(projectData.windowStates)) {
            const sortedWindowStates = projectData.windowStates.sort((a, b) => (a?.zIndex || 0) - (b?.zIndex || 0));
            for (const winState of sortedWindowStates) {
                if (!winState || !winState.id) { console.warn("[State reconstructDAWInternal] Invalid window state found:", winState); continue; }
                const key = winState.initialContentKey || winState.id; // Use initialContentKey for routing
                console.log(`[State reconstructDAWInternal] Reconstructing window: ${key}, ID: ${winState.id}`);
                if (key === 'globalControls' && appServices.openGlobalControlsWindow) appServices.openGlobalControlsWindow(null, winState); // null for onReady, state will set it
                else if (key === 'mixer' && appServices.openMixerWindow) appServices.openMixerWindow(winState);
                else if (key === 'soundBrowser' && appServices.openSoundBrowserWindow) appServices.openSoundBrowserWindow(winState);
                else if (key === 'masterEffectsRack' && appServices.openMasterEffectsRackWindow) appServices.openMasterEffectsRackWindow(winState);
                else if (key === 'timeline' && appServices.openTimelineWindow) appServices.openTimelineWindow(winState);
                else if (key.startsWith('trackInspector-') && appServices.openTrackInspectorWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackInspectorWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for inspector ${key} not found or ID invalid.`);
                } else if (key.startsWith('effectsRack-') && appServices.openTrackEffectsRackWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackEffectsRackWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for effects rack ${key} not found or ID invalid.`);
                } else if (key.startsWith('sequencerWin-') && appServices.openTrackSequencerWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    const trackForSeq = getTrackByIdState(trackIdNum);
                    if (!isNaN(trackIdNum) && trackForSeq && trackForSeq.type !== 'Audio') {
                        appServices.openTrackSequencerWindow(trackIdNum, true, winState); // true for forceRedraw
                    } else { console.warn(`[State reconstructDAWInternal] Track for sequencer ${key} not found, ID invalid, or is Audio type.`);}
                } else {
                    console.warn(`[State reconstructDAWInternal] Unknown window key "${key}" during reconstruction.`);
                }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructing windows:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading window layout.", 3000);
    }

    // Final UI updates and MIDI setup
    try {
        const gs = projectData.globalSettings || {};
        if(gs && gs.activeMIDIInputId && appServices.selectMIDIInput) {
            appServices.selectMIDIInput(gs.activeMIDIInputId, true); // true for silent
        }
        if(appServices.updateMixerWindow) appServices.updateMixerWindow();
        if(appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        if(appServices.renderTimeline) appServices.renderTimeline();
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during final UI updates/MIDI setup:", error);
    }

    if (appServices) appServices._isReconstructingDAW_flag = false;
    if (!isUndoRedo && appServices.showNotification) appServices.showNotification(`Project loaded successfully.`, 3500);
    console.log("[State reconstructDAWInternal] Reconstruction finished.");
}


export function saveProjectInternal() {
    try {
        const projectData = gatherProjectDataInternal();
        if (!projectData) throw new Error("Failed to gather project data for saving.");

        const jsonString = JSON.stringify(projectData, null, 2); // Beautify JSON
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-project-${timestamp}.snug`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (appServices.showNotification) appServices.showNotification(`Project saved as ${a.download}`, 2000);
    } catch (error) {
        console.error("[State saveProjectInternal] Error saving project:", error);
        if (appServices.showNotification) appServices.showNotification(`Error saving project: ${error.message}. See console.`, 4000);
    }
}

export function loadProjectInternal() {
    const loadProjectInputEl = appServices.uiElementsCache?.loadProjectInput;
    if (loadProjectInputEl) {
        loadProjectInputEl.click();
    } else {
        console.error("[State loadProjectInternal] Load project input element not found.");
        if (appServices.showNotification) appServices.showNotification("Error: File input for loading project not found.", 3000);
    }
}

export async function handleProjectFileLoadInternal(event) {
    if (!event || !event.target || !event.target.files || event.target.files.length === 0) {
        console.warn("[State handleProjectFileLoadInternal] No file selected or event invalid.");
        if (event && event.target) event.target.value = null; // Reset file input
        return;
    }
    const file = event.target.files[0];
    if (file && file.name.endsWith('.snug')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!e.target || !e.target.result) throw new Error("FileReader did not produce a result.");
                const projectData = JSON.parse(e.target.result);
                undoStack = []; // Clear undo/redo stacks for new project
                redoStack = [];
                await reconstructDAWInternal(projectData, false); // false for isUndoRedo
                captureStateForUndoInternal("Load Project: " + file.name.substring(0, 20)); // Initial state for undo
            } catch (error) {
                console.error("[State handleProjectFileLoadInternal] Error loading project from file:", error);
                if (appServices.showNotification) appServices.showNotification(`Error loading project: ${error.message}. File might be corrupt or invalid.`, 5000);
            }
        };
        reader.onerror = (err) => {
            console.error("[State handleProjectFileLoadInternal] FileReader error:", err);
            if (appServices.showNotification) appServices.showNotification("Error reading project file.", 3000);
        };
        reader.readAsText(file);
    } else if (file) {
        if (appServices.showNotification) appServices.showNotification("Invalid file type. Please select a .snug project file.", 3000);
    }
    if (event.target) event.target.value = null; // Reset file input
}

export async function exportToWavInternal() {
    if (!appServices.showNotification || !appServices.getActualMasterGainNode || !audioInitAudioContextAndMasterMeter) {
        console.error("[State exportToWavInternal] Required appServices (showNotification, getActualMasterGainNode, audioInitAudioContextAndMasterMeter) not available.");
        alert("Export WAV feature is currently unavailable due to an internal error.");
        return;
    }

    appServices.showNotification("Preparing export...", 3000);
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            appServices.showNotification("Audio system not ready for export. Please try again.", 4000);
            return;
        }

        if (Tone.Transport.state === 'started') {
            Tone.Transport.pause(); // Pause instead of stop to preserve position for rescheduling later if needed
            await new Promise(resolve => setTimeout(resolve, 200)); // Give time for audio to settle
        }
        const originalTransportPosition = Tone.Transport.seconds; // Save current position
        Tone.Transport.position = 0; // Export from the beginning
        let maxDuration = 0;

        const currentPlaybackMode = getPlaybackModeState();

        if (currentPlaybackMode === 'timeline') {
            (getTracksState() || []).forEach(track => {
                if (track && track.timelineClips && Array.isArray(track.timelineClips)) {
                    track.timelineClips.forEach(clip => {
                        if (clip && typeof clip.startTime === 'number' && typeof clip.duration === 'number') {
                             maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                        }
                    });
                }
            });
        } else { // 'sequencer' mode
            (getTracksState() || []).forEach(track => {
                if (track && track.type !== 'Audio') {
                    const activeSeq = track.getActiveSequence();
                    if (activeSeq && activeSeq.length > 0) {
                        const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                        maxDuration = Math.max(maxDuration, activeSeq.length * sixteenthNoteTime);
                    }
                }
            });
        }

        if (maxDuration === 0) maxDuration = 5; // Default duration if nothing to export
        maxDuration = Math.min(maxDuration + 2, 600); // Add buffer, cap at 10 minutes for sanity
        console.log(`[State exportToWavInternal] Calculated export duration: ${maxDuration.toFixed(1)}s`);

        const recorder = new Tone.Recorder();
        const recordSource = appServices.getActualMasterGainNode();

        if (!recordSource || recordSource.disposed) {
            appServices.showNotification("Master output node not available for recording export.", 4000);
            console.error("[State exportToWavInternal] Master output node is not available or disposed.");
            Tone.Transport.position = originalTransportPosition; // Restore position
            return;
        }
        recordSource.connect(recorder);

        appServices.showNotification(`Recording for export (${maxDuration.toFixed(1)}s)... This may take a moment.`, Math.max(4000, maxDuration * 1000 + 1000));

        // Schedule all tracks for offline rendering
        for (const track of getTracksState()) {
            if (track && typeof track.schedulePlayback === 'function') {
                await track.schedulePlayback(0, maxDuration); // Schedule from 0 up to maxDuration
            }
        }

        recorder.start();
        Tone.Transport.start(Tone.now(), 0); // Start transport from beginning for recording

        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000 + 500)); // Wait for duration + buffer

        const recording = await recorder.stop();
        Tone.Transport.stop(); // Stop transport after recording
        Tone.Transport.position = originalTransportPosition; // Restore original transport position

        // Cleanup scheduled playback for all tracks
        (getTracksState() || []).forEach(track => {
            if (track && typeof track.stopPlayback === 'function') track.stopPlayback();
        });
        Tone.Transport.cancel(0); // Clear all transport events

        try {
            if (recordSource && !recordSource.disposed && recorder && !recorder.disposed) {
                recordSource.disconnect(recorder);
            }
        } catch (e) { console.warn("Error disconnecting recorder from source:", e.message); }
        if (recorder && !recorder.disposed) recorder.dispose();

        const url = URL.createObjectURL(recording);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-export-${timestamp}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        appServices.showNotification("Export to WAV successful!", 3000);

    } catch (error) {
        console.error("[State exportToWavInternal] Error exporting WAV:", error);
        appServices.showNotification(`Error exporting WAV: ${error.message}. See console.`, 5000);
        // Attempt to restore transport state on error
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        // Potentially reschedule tracks to their original state if possible, or advise user to reload.
    }
}
