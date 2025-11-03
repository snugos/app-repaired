// js/state.js - Application State Management
import * as Constants from './constants.js';
import { showNotification, showConfirmationDialog } from './utils.js';
import { Track } from './Track.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry } from './effectsRegistry.js';
import {
    rebuildMasterEffectChain as audioRebuildMasterEffectChain,
    addMasterEffectToAudio as audioAddMasterEffectToChain,
    removeMasterEffectFromAudio as audioRemoveMasterEffectFromChain,
    updateMasterEffectParamInAudio as audioUpdateMasterEffectParamInChain,
    reorderMasterEffectInAudio as audioReorderMasterEffectInChain,
    initAudioContextAndMasterMeter as audioInitAudioContextAndMasterMeter
} from './audio.js';
import { getAudio, storeAudio } from './db.js';

// --- Centralized State Variables ---
let tracks = [];
let trackIdCounter = 0;

// Window Management
let openWindowsMap = new Map();
let highestZ = 100;

// Master Audio Chain
let masterEffectsChainState = [];
let masterGainValueState = Tone.dbToGain(0);

// MIDI State
let midiAccessGlobal = null;
let activeMIDIInputGlobal = null;

// Sound Browser State
let loadedZipFilesGlobal = {};
let soundLibraryFileTreesGlobal = {};
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

// Undo/Redo
let undoStack = [];
let redoStack = [];

// --- AppServices Placeholder (will be populated by main.js) ---
let appServices = {};

export function initializeStateModule(services) {
    appServices = { ...appServices, ...services };
    if (!Array.isArray(masterEffectsChainState)) {
        masterEffectsChainState = [];
    }
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

export function getLoadedZipFilesState() { return loadedZipFilesGlobal; }
export function getSoundLibraryFileTreesState() { return soundLibraryFileTreesGlobal; }
export function getCurrentLibraryNameState() { return currentLibraryNameGlobal; }
export function getCurrentSoundFileTreeState() { return currentSoundFileTreeGlobal; }
export function getCurrentSoundBrowserPathState() { return currentSoundBrowserPathGlobal; }
export function getPreviewPlayerState() { return previewPlayerGlobal; }

export function getClipboardDataState() { return clipboardDataGlobal; }

export function getArmedTrackIdState() { return armedTrackId; }
export function getSoloedTrackIdState() { return soloedTrackId; }
export function isTrackRecordingState() { return isRecordingGlobal; }
export function getRecordingTrackIdState() { return recordingTrackIdGlobal; } // This is correctly exported
export function getActiveSequencerTrackIdState() { return activeSequencerTrackId; }
export function getUndoStackState() { return undoStack; }
export function getRedoStackState() { return redoStack; }


// --- Setters for Centralized State (called internally or via appServices) ---
export function addWindowToStoreState(id, instance) { openWindowsMap.set(id, instance); }
export function removeWindowFromStoreState(id) { openWindowsMap.delete(id); }
export function setHighestZState(value) { highestZ = value; }
export function incrementHighestZState() { return ++highestZ; }

export function setMasterEffectsState(newChain) { masterEffectsChainState = newChain; }
export function setMasterGainValueState(value) { masterGainValueState = value; }

export function setMidiAccessState(access) { midiAccessGlobal = access; }
export function setActiveMIDIInputState(input) { activeMIDIInputGlobal = input; }

export function setLoadedZipFilesState(files) { loadedZipFilesGlobal = files; }
export function setSoundLibraryFileTreesState(trees) { soundLibraryFileTreesGlobal = trees; }
export function setCurrentLibraryNameState(name) { currentLibraryNameGlobal = name; }
export function setCurrentSoundFileTreeState(tree) { currentSoundFileTreeGlobal = tree; }
export function setCurrentSoundBrowserPathState(path) { currentSoundBrowserPathGlobal = path; }
export function setPreviewPlayerState(player) { previewPlayerGlobal = player; }

export function setClipboardDataState(data) { clipboardDataGlobal = data; }

export function setArmedTrackIdState(id) { armedTrackId = id; }
export function setSoloedTrackIdState(id) { soloedTrackId = id; }
export function setIsRecordingState(status) { isRecordingGlobal = status; }
export function setRecordingTrackIdState(id) { recordingTrackIdGlobal = id; }
export function setRecordingStartTimeState(time) { recordingStartTime = time; }
export function setActiveSequencerTrackIdState(id) { activeSequencerTrackId = id; }

// --- Track Management ---
export async function addTrackToStateInternal(type, initialData = null, isUserAction = true) {
    const isBrandNewUserTrack = isUserAction && (!initialData || initialData._isUserActionPlaceholder);

    if (isBrandNewUserTrack) {
        captureStateForUndoInternal(`Add ${type} Track`);
        if (initialData && initialData._isUserActionPlaceholder) initialData = null;
    }

    let newTrackId;
    if (initialData && initialData.id != null) {
        newTrackId = initialData.id;
        if (newTrackId >= trackIdCounter) trackIdCounter = newTrackId + 1;
    } else {
        newTrackId = trackIdCounter++;
    }

    const trackAppServices = {
        getSoloedTrackId: getSoloedTrackIdState,
        captureStateForUndo: captureStateForUndoInternal,
        updateTrackUI: appServices.updateTrackUI,
        highlightPlayingStep: appServices.highlightPlayingStep,
        autoSliceSample: appServices.autoSliceSample,
        closeTrackWindows: appServices.closeAllTrackWindows,
        getMasterEffectsBusInputNode: appServices.getMasterEffectsBusInputNode,
        showNotification: appServices.showNotification,
        effectsRegistryAccess: appServices.effectsRegistryAccess,
    };
    const newTrack = new Track(newTrackId, type, initialData, trackAppServices);
    tracks.push(newTrack);

    if (typeof newTrack.initializeAudioNodes === 'function') {
        await newTrack.initializeAudioNodes();
    }

    try {
        await newTrack.fullyInitializeAudioResources();
        if (isBrandNewUserTrack) {
            showNotification(`${newTrack.name} added.`, 2000);
            if (appServices.openTrackInspectorWindow) {
                appServices.openTrackInspectorWindow(newTrack.id);
            }
        }
        if (appServices.updateMixerWindow) {
            appServices.updateMixerWindow();
        }
    } catch (error) {
        console.error(`[State] Error in fullyInitializeAudioResources for track ${newTrack.id}:`, error);
        showNotification(`Error setting up ${type} track "${newTrack.name}": ${error.message}`, 5000);
        if (isBrandNewUserTrack && appServices.openTrackInspectorWindow) {
            appServices.openTrackInspectorWindow(newTrack.id);
        }
        if (appServices.updateMixerWindow) {
            appServices.updateMixerWindow();
        }
    }
    return newTrack;
}

export function removeTrackFromStateInternal(trackId) {
    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    const track = tracks[trackIndex];
    captureStateForUndoInternal(`Remove Track "${track.name}"`);

    track.dispose();
    tracks.splice(trackIndex, 1);

    if (armedTrackId === trackId) setArmedTrackIdState(null);
    if (soloedTrackId === trackId) {
        setSoloedTrackIdState(null);
        tracks.forEach(t => {
            t.isSoloed = false;
            t.applySoloState();
            if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
        });
    }
    if (activeSequencerTrackId === trackId) setActiveSequencerTrackIdState(null);

    showNotification(`Track "${track.name}" removed.`, 2000);
    if (appServices.updateMixerWindow) appServices.updateMixerWindow();
    if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
}


// --- Master Effects Chain Management ---
export function addMasterEffectToState(effectType, initialParams) {
    const effectId = `mastereffect_${effectType}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const defaultParams = appServices.effectsRegistryAccess?.getEffectDefaultParams
        ? appServices.effectsRegistryAccess.getEffectDefaultParams(effectType)
        : getEffectDefaultParamsFromRegistry(effectType);

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
    if (!effectWrapper) return;

    const keys = paramPath.split('.');
    let currentStoredParamLevel = effectWrapper.params;
    for (let i = 0; i < keys.length - 1; i++) {
        currentStoredParamLevel[keys[i]] = currentStoredParamLevel[keys[i]] || {};
        currentStoredParamLevel = currentStoredParamLevel[keys[i]];
    }
    currentStoredParamLevel[keys[keys.length - 1]] = value;
}

export function reorderMasterEffectInState(effectId, newIndex) {
    const oldIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (oldIndex === -1 || oldIndex === newIndex) return;
    const maxValidInsertIndex = masterEffectsChainState.length;
    const clampedNewIndex = Math.max(0, Math.min(newIndex, maxValidInsertIndex -1));

    const [effectToMove] = masterEffectsChainState.splice(oldIndex, 1);
    masterEffectsChainState.splice(clampedNewIndex, 0, effectToMove);
}


// --- Undo/Redo Logic ---
function updateInternalUndoRedoState() {
    if (appServices.updateUndoRedoButtonsUI) {
        appServices.updateUndoRedoButtonsUI(
            undoStack.length > 0 ? undoStack[undoStack.length - 1] : null,
            redoStack.length > 0 ? redoStack[redoStack.length - 1] : null
        );
    }
}

export function captureStateForUndoInternal(description = "Unknown action") {
    try {
        const currentState = gatherProjectDataInternal();
        currentState.description = description;
        undoStack.push(JSON.parse(JSON.stringify(currentState)));
        if (undoStack.length > Constants.MAX_HISTORY_STATES) {
            undoStack.shift();
        }
        redoStack = [];
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State] Error capturing state for undo:", error);
        showNotification("Error capturing undo state. See console for details.", 3000);
    }
}

export async function undoLastActionInternal() {
    if (undoStack.length === 0) {
        showNotification("Nothing to undo.", 1500);
        return;
    }
    try {
        const stateToRestore = undoStack.pop();
        const currentStateForRedo = gatherProjectDataInternal();
        currentStateForRedo.description = stateToRestore.description;
        redoStack.push(JSON.parse(JSON.stringify(currentStateForRedo)));
        if (redoStack.length > Constants.MAX_HISTORY_STATES) {
            redoStack.shift();
        }

        showNotification(`Undoing: ${stateToRestore.description || 'last action'}...`, 2000);
        appServices._isReconstructingDAW_flag = true;
        await reconstructDAWInternal(stateToRestore, true);
        appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    } catch (error) {
        appServices._isReconstructingDAW_flag = false;
        console.error("[State] Error during undo:", error);
        showNotification(`Error during undo operation: ${error.message}. Project may be unstable.`, 4000);
        updateInternalUndoRedoState();
    }
}

export async function redoLastActionInternal() {
    if (redoStack.length === 0) {
        showNotification("Nothing to redo.", 1500);
        return;
    }
    try {
        const stateToRestore = redoStack.pop();
        const currentStateForUndo = gatherProjectDataInternal();
        currentStateForUndo.description = stateToRestore.description;
        undoStack.push(JSON.parse(JSON.stringify(currentStateForUndo)));
        if (undoStack.length > Constants.MAX_HISTORY_STATES) {
            undoStack.shift();
        }

        showNotification(`Redoing: ${stateToRestore.description || 'last action'}...`, 2000);
        appServices._isReconstructingDAW_flag = true;
        await reconstructDAWInternal(stateToRestore, true);
        appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    } catch (error) {
        appServices._isReconstructingDAW_flag = false;
        console.error("[State] Error during redo:", error);
        showNotification(`Error during redo operation: ${error.message}. Project may be unstable.`, 4000);
        updateInternalUndoRedoState();
    }
}


// --- Project Data Handling ---
export function gatherProjectDataInternal() {
    const projectData = {
        version: "5.8.1", // Increment for any structural change
        globalSettings: {
            tempo: Tone.Transport.bpm.value,
            masterVolume: masterGainValueState,
            activeMIDIInputId: activeMIDIInputGlobal ? activeMIDIInputGlobal.id : null,
            soloedTrackId: soloedTrackId,
            armedTrackId: armedTrackId,
            highestZIndex: highestZ,
        },
        masterEffects: masterEffectsChainState.map(effect => ({
            id: effect.id,
            type: effect.type,
            params: JSON.parse(JSON.stringify(effect.params))
        })),
        tracks: tracks.map(track => {
            const trackData = {
                id: track.id, type: track.type, name: track.name,
                isMuted: track.isMuted,
                volume: track.previousVolumeBeforeMute,
                activeEffects: track.activeEffects.map(effect => ({
                    id: effect.id,
                    type: effect.type,
                    params: JSON.parse(JSON.stringify(effect.params))
                })),
                sequenceLength: track.sequenceLength,
                sequenceData: JSON.parse(JSON.stringify(track.sequenceData)),
                automation: JSON.parse(JSON.stringify(track.automation)),
                selectedSliceForEdit: track.selectedSliceForEdit,
                waveformZoom: track.waveformZoom,
                waveformScrollOffset: track.waveformScrollOffset,
                slicerIsPolyphonic: track.slicerIsPolyphonic,
                selectedDrumPadForEdit: track.selectedDrumPadForEdit,
                instrumentSamplerIsPolyphonic: track.instrumentSamplerIsPolyphonic,
            };
             if (track.type === 'Synth') {
                trackData.synthEngineType = track.synthEngineType || 'MonoSynth';
                trackData.synthParams = JSON.parse(JSON.stringify(track.synthParams));
            } else if (track.type === 'Sampler') {
                trackData.samplerAudioData = {
                    fileName: track.samplerAudioData.fileName,
                    dbKey: track.samplerAudioData.dbKey,
                    status: track.samplerAudioData.dbKey ? 'missing_db' : (track.samplerAudioData.fileName ? 'missing' : 'empty')
                };
                trackData.slices = JSON.parse(JSON.stringify(track.slices));
            } else if (track.type === 'DrumSampler') {
                trackData.drumSamplerPads = track.drumSamplerPads.map(p => ({
                    originalFileName: p.originalFileName,
                    dbKey: p.dbKey,
                    volume: p.volume,
                    pitchShift: p.pitchShift,
                    envelope: JSON.parse(JSON.stringify(p.envelope)),
                    status: p.dbKey ? 'missing_db' : (p.originalFileName ? 'missing' : 'empty')
                }));
            } else if (track.type === 'InstrumentSampler') {
                trackData.instrumentSamplerSettings = {
                    originalFileName: track.instrumentSamplerSettings.originalFileName,
                    dbKey: track.instrumentSamplerSettings.dbKey,
                    rootNote: track.instrumentSamplerSettings.rootNote,
                    loop: track.instrumentSamplerSettings.loop,
                    loopStart: track.instrumentSamplerSettings.loopStart,
                    loopEnd: track.instrumentSamplerSettings.loopEnd,
                    envelope: JSON.parse(JSON.stringify(track.instrumentSamplerSettings.envelope)),
                    status: track.instrumentSamplerSettings.dbKey ? 'missing_db' : (track.instrumentSamplerSettings.originalFileName ? 'missing' : 'empty')
                };
            }
            return trackData;
        }),
        windowStates: Array.from(openWindowsMap.values()).map(win => {
             if (!win || !win.element) return null;
            return {
                id: win.id, title: win.title,
                left: win.element.style.left, top: win.element.style.top,
                width: win.element.style.width, height: win.element.style.height,
                zIndex: parseInt(win.element.style.zIndex),
                isMinimized: win.isMinimized,
                initialContentKey: win.initialContentKey
            };
        }).filter(ws => ws !== null)
    };
    return projectData;
}

export async function reconstructDAWInternal(projectData, isUndoRedo = false) {
    appServices._isReconstructingDAW_flag = true;

    if (Tone.Transport.state === 'started') Tone.Transport.stop();
    Tone.Transport.cancel();

    await audioInitAudioContextAndMasterMeter(true);

    tracks.forEach(track => track.dispose());
    tracks = [];
    trackIdCounter = 0;

    if (appServices.clearAllMasterEffectNodes) appServices.clearAllMasterEffectNodes();
    masterEffectsChainState = [];

    if (appServices.closeAllWindows) appServices.closeAllWindows(true);
    if (appServices.clearOpenWindowsMap) appServices.clearOpenWindowsMap(); // Clears the map in state.js
    highestZ = 100;


    setArmedTrackIdState(null);
    setSoloedTrackIdState(null);
    setActiveSequencerTrackIdState(null);
    setIsRecordingState(false);
    setRecordingTrackIdState(null);
    if (appServices.updateRecordButtonUI) appServices.updateRecordButtonUI(false);

    const gs = projectData.globalSettings || {};
    Tone.Transport.bpm.value = gs.tempo || 120;
    setMasterGainValueState(gs.masterVolume ?? Tone.dbToGain(0));
    if (appServices.setActualMasterVolume) appServices.setActualMasterVolume(getMasterGainValueState());


    if (appServices.updateTaskbarTempoDisplay) appServices.updateTaskbarTempoDisplay(Tone.Transport.bpm.value);
    setHighestZState(gs.highestZIndex || 100);

    setArmedTrackIdState(gs.armedTrackId || null);
    setSoloedTrackIdState(gs.soloedTrackId || null);


    if (projectData.masterEffects && Array.isArray(projectData.masterEffects)) {
        for (const effectData of projectData.masterEffects) {
            const effectIdInState = addMasterEffectToState(effectData.type, effectData.params);
            if (appServices.audioAddMasterEffectToChain) {
                 await appServices.audioAddMasterEffectToChain(effectIdInState, effectData.type, effectData.params);
            }
        }
    }


    const trackPromises = (projectData.tracks || []).map(trackData => addTrackToStateInternal(trackData.type, trackData, false));
    await Promise.all(trackPromises);

    if (projectData.windowStates) {
        const sortedWindowStates = projectData.windowStates.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        for (const winState of sortedWindowStates) {
            if (!winState || !winState.id) continue;
            const key = winState.initialContentKey || winState.id;

            if (key === 'globalControls' && appServices.openGlobalControlsWindow) appServices.openGlobalControlsWindow(null, winState);
            else if (key === 'mixer' && appServices.openMixerWindow) appServices.openMixerWindow(winState);
            else if (key === 'soundBrowser' && appServices.openSoundBrowserWindow) appServices.openSoundBrowserWindow(winState);
            else if (key === 'masterEffectsRack' && appServices.openMasterEffectsRackWindow) appServices.openMasterEffectsRackWindow(winState);
            else if (key.startsWith('trackInspector-') && appServices.openTrackInspectorWindow) {
                const trackIdNum = parseInt(key.split('-')[1]);
                if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackInspectorWindow(trackIdNum, winState);
            } else if (key.startsWith('effectsRack-') && appServices.openTrackEffectsRackWindow) {
                const trackIdNum = parseInt(key.split('-')[1]);
                if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackEffectsRackWindow(trackIdNum, winState);
            } else if (key.startsWith('sequencerWin-') && appServices.openTrackSequencerWindow) {
                const trackIdNum = parseInt(key.split('-')[1]);
                if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackSequencerWindow(trackIdNum, true, winState);
            }
        }
    }

    const resourcePromises = tracks.map(track => track.fullyInitializeAudioResources());
    await Promise.all(resourcePromises);


    tracks.forEach(t => {
        t.isSoloed = (t.id === getSoloedTrackIdState());
        t.applySoloState();
        if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged'); // Update UI for all tracks based on solo
    });

    if (gs && gs.activeMIDIInputId && appServices.selectMIDIInput) {
        appServices.selectMIDIInput(gs.activeMIDIInputId, true);
    }

    if(appServices.updateMixerWindow) appServices.updateMixerWindow();
    if(appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
    updateInternalUndoRedoState();

    appServices._isReconstructingDAW_flag = false;
    if (!isUndoRedo) showNotification(`Project loaded successfully.`, 3500);
}


export function saveProjectInternal() {
    try {
        const projectData = gatherProjectDataInternal();
        const jsonString = JSON.stringify(projectData, null, 2);
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
        showNotification(`Project saved as ${a.download}`, 2000);
    } catch (error) {
        console.error("[State] Error saving project:", error);
        showNotification("Error saving project. See console for details.", 4000);
    }
}

export function loadProjectInternal() {
    const loadProjectInputEl = appServices.uiElementsCache?.loadProjectInput || document.getElementById('loadProjectInput');
    if (loadProjectInputEl) loadProjectInputEl.click();
    else {
        console.error("[State] Load project input element not found.");
        showNotification("Error: File input for loading project not found.", 3000);
    }
}

export async function handleProjectFileLoadInternal(event) {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.snug')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const projectData = JSON.parse(e.target.result);
                undoStack = [];
                redoStack = [];
                await reconstructDAWInternal(projectData, false);
                captureStateForUndoInternal("Load Project: " + file.name.substring(0, 20));
            } catch (error) {
                console.error("[State] Error loading project from file:", error);
                showNotification(`Error loading project: ${error.message}. File might be corrupt or invalid.`, 5000);
            }
        };
        reader.onerror = (err) => {
            console.error("[State] FileReader error:", err);
            showNotification("Error reading project file.", 3000);
        };
        reader.readAsText(file);
    } else if (file) {
        showNotification("Invalid file type. Please select a .snug project file.", 3000);
    }
    if (event.target) event.target.value = null;
}

export async function exportToWavInternal() {
    showNotification("Preparing export...", 3000);
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            showNotification("Audio system not ready for export.", 4000);
            return;
        }

        if (Tone.Transport.state === 'started') {
            Tone.Transport.stop();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        Tone.Transport.position = 0;
        let maxDuration = 0;
        tracks.forEach(track => {
            if (track.sequence && track.sequenceLength > 0) {
                const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                const trackDuration = track.sequenceLength * sixteenthNoteTime;
                if (trackDuration > maxDuration) maxDuration = trackDuration;
            }
        });
        if (maxDuration === 0) maxDuration = 5;
        maxDuration += 1;

        const recorder = new Tone.Recorder();
        const recordSource = appServices.getActualMasterGainNode ? appServices.getActualMasterGainNode() : null;

        if (!recordSource || recordSource.disposed) {
            showNotification("Master output node not available for recording.", 4000);
            console.error("[State ExportWAV] Master output node is not available or disposed.");
            return;
        }
        recordSource.connect(recorder);

        showNotification(`Recording for export (${maxDuration.toFixed(1)}s)...`, Math.max(3000, maxDuration * 1000 + 1000));

        recorder.start();
        Tone.Transport.start("+0.1", 0);

        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000));

        const recording = await recorder.stop();
        Tone.Transport.stop();

        try {
            recordSource.disconnect(recorder);
        } catch (e) {
            console.warn("Error disconnecting recorder, might have already been disconnected:", e);
        }
        recorder.dispose();

        const url = URL.createObjectURL(recording);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-export-${timestamp}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification("Export to WAV successful!", 3000);

    } catch (error) {
        console.error("[State] Error exporting WAV:", error);
        showNotification(`Error exporting WAV: ${error.message}`, 5000);
    }
}
