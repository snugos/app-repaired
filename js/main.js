// js/main.js - Main Application Logic Orchestrator

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
import { showNotification, createContextMenu, createDropZoneHTML, setupGenericDropZoneListeners } from './utils.js';
import {
    initializeEventHandlersModule, initializePrimaryEventListeners, setupMIDI, attachGlobalControlEvents,
    selectMIDIInput, handleTrackMute, handleTrackSolo, handleTrackArm, handleRemoveTrack,
    handleOpenTrackInspector, handleOpenEffectsRack, handleOpenSequencer
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
    getActiveSequencerTrackIdState, getUndoStackState, getRedoStackState,
    // State Setters
    addWindowToStoreState, removeWindowFromStoreState, setHighestZState, incrementHighestZState,
    setMasterEffectsState, setMasterGainValueState,
    setMidiAccessState, setActiveMIDIInputState,
    setLoadedZipFilesState, setSoundLibraryFileTreesState, setCurrentLibraryNameState,
    setCurrentSoundFileTreeState, setCurrentSoundBrowserPathState, setPreviewPlayerState,
    setClipboardDataState, setArmedTrackIdState, setSoloedTrackIdState, setIsRecordingState,
    setRecordingTrackIdState, setRecordingStartTimeState, setActiveSequencerTrackIdState,
    addMasterEffectToState, removeMasterEffectFromState,
    updateMasterEffectParamInState, reorderMasterEffectInState,
    // Core State Actions
    addTrackToStateInternal, removeTrackFromStateInternal,
    captureStateForUndoInternal, undoLastActionInternal, redoLastActionInternal,
    gatherProjectDataInternal, reconstructDAWInternal, saveProjectInternal,
    loadProjectInternal, handleProjectFileLoadInternal, exportToWavInternal
} from './state.js';
import {
    initializeAudioModule, initAudioContextAndMasterMeter, updateMeters, fetchSoundLibrary,
    loadSoundFromBrowserToTarget, playSlicePreview, playDrumSamplerPadPreview,
    loadSampleFile, loadDrumSamplerPadFile, autoSliceSample,
    addMasterEffectToAudio,
    removeMasterEffectFromAudio,
    updateMasterEffectParamInAudio,
    reorderMasterEffectInAudio,
    getMimeTypeFromFilename, getMasterEffectsBusInputNode,
    getActualMasterGainNode as getActualMasterGainNodeFromAudio,
    clearAllMasterEffectNodes as clearAllMasterEffectNodesInAudio,
    startAudioRecording, 
    stopAudioRecording 
} from './audio.js';
import {
    initializeUIModule, openTrackEffectsRackWindow, openTrackSequencerWindow, openGlobalControlsWindow,
    openTrackInspectorWindow, openMixerWindow, updateMixerWindow, openSoundBrowserWindow,
    renderSoundBrowserDirectory, updateSoundBrowserDisplayForLibrary, highlightPlayingStep, drawWaveform,
    drawInstrumentWaveform, renderSamplePads, updateSliceEditorUI, updateDrumPadControlsUI, renderDrumSamplerPads,
    renderEffectsList, renderEffectControls, createKnob,
    updateSequencerCellUI,
    openMasterEffectsRackWindow,
    renderTimeline, 
    updatePlayheadPosition,
    openTimelineWindow // Added for timeline window
} from './ui.js';

console.log("SCRIPT EXECUTION STARTED - SnugOS (main.js refactored v11 - Timeline Window)");

// --- Global UI Elements Cache ---
const uiElementsCache = {
    desktop: null, taskbar: null, startButton: null, startMenu: null,
    taskbarButtonsContainer: null, taskbarTempoDisplay: null, loadProjectInput: null,
    customBgInput: null, sampleFileInput: null, notificationArea: null, modalContainer: null,
    menuAddSynthTrack: null, menuAddSamplerTrack: null, menuAddDrumSamplerTrack: null,
    menuAddInstrumentSamplerTrack: null, menuAddAudioTrack: null, 
    menuOpenSoundBrowser: null, 
    menuOpenTimeline: null, // Added Timeline menu item
    menuUndo: null, menuRedo: null,
    menuSaveProject: null, menuLoadProject: null, menuExportWav: null, menuOpenGlobalControls: null,
    menuOpenMixer: null, menuOpenMasterEffects: null, 
    // menuUploadCustomBg and menuRemoveCustomBg are removed as they are no longer in Start Menu
    menuToggleFullScreen: null, playBtnGlobal: null, recordBtnGlobal: null,
    tempoGlobalInput: null, midiInputSelectGlobal: null, masterMeterContainerGlobal: null,
    masterMeterBarGlobal: null, midiIndicatorGlobal: null, keyboardIndicatorGlobal: null,
    // Timeline elements are now inside a window, so not cached globally here.
    // They will be accessed via the window instance if needed.
};

const DESKTOP_BACKGROUND_KEY = 'snugosDesktopBackground';

// Forward declaration for functions used in appServices
function handleCustomBackgroundUpload(event) {
    const file = event.target.files[0];
    if (file?.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataURL = e.target.result;
            try {
                localStorage.setItem(DESKTOP_BACKGROUND_KEY, dataURL);
                applyDesktopBackground(dataURL);
                showNotification("Custom background applied.", 2000);
            } catch (error) {
                console.error("Error saving background to localStorage:", error);
                showNotification("Could not save background: Storage full or image too large.", 4000);
            }
        };
        reader.onerror = (err) => {
            console.error("Error reading background file:", err);
            showNotification("Error reading background file.", 3000);
        };
        reader.readAsDataURL(file);
    } else if (file) {
        showNotification("Invalid file type. Please select an image.", 3000);
    }
    if (event.target) event.target.value = null;
}

function removeCustomDesktopBackground() {
    localStorage.removeItem(DESKTOP_BACKGROUND_KEY);
    applyDesktopBackground(null);
    showNotification("Custom background removed.", 2000);
}


const appServices = {
    // UI Module Functions
    openTrackInspectorWindow, openTrackEffectsRackWindow, openTrackSequencerWindow,
    openMixerWindow, updateMixerWindow, openSoundBrowserWindow, openMasterEffectsRackWindow,
    renderSoundBrowserDirectory, updateSoundBrowserDisplayForLibrary, highlightPlayingStep,
    drawWaveform, drawInstrumentWaveform, renderSamplePads, updateSliceEditorUI,
    updateDrumPadControlsUI, renderDrumSamplerPads, renderEffectsList, renderEffectControls,
    createKnob, updateSequencerCellUI, showNotification, createContextMenu,
    renderTimeline, 
    openTimelineWindow, // Added openTimelineWindow service
    
    // Audio Module Functions
    initAudioContextAndMasterMeter, updateMeters, fetchSoundLibrary, loadSoundFromBrowserToTarget,
    playSlicePreview, playDrumSamplerPadPreview, loadSampleFile, loadDrumSamplerPadFile,
    autoSliceSample, getMimeTypeFromFilename,
    getMasterEffectsBusInputNode,
    getActualMasterGainNode: getActualMasterGainNodeFromAudio,
    clearAllMasterEffectNodes: clearAllMasterEffectNodesInAudio,
    startAudioRecording, 
    stopAudioRecording,  

    // State Module Getters
    getTracks: getTracksState, getTrackById: getTrackByIdState,
    getOpenWindows: getOpenWindowsState, getWindowById: getWindowByIdState,
    getHighestZ: getHighestZState,
    getMasterEffects: getMasterEffectsState, getMasterGainValue: getMasterGainValueState,
    getMidiAccess: getMidiAccessState, getActiveMIDIInput: getActiveMIDIInputState,
    getLoadedZipFiles: getLoadedZipFilesState, getSoundLibraryFileTrees: getSoundLibraryFileTreesState,
    getCurrentLibraryName: getCurrentLibraryNameState, getCurrentSoundFileTree: getCurrentSoundFileTreeState,
    getCurrentSoundBrowserPath: getCurrentSoundBrowserPathState, getPreviewPlayer: getPreviewPlayerState,
    getClipboardData: getClipboardDataState, getArmedTrackId: getArmedTrackIdState,
    getSoloedTrackId: getSoloedTrackIdState, isTrackRecording: isTrackRecordingState,
    getRecordingTrackId: getRecordingTrackIdState,
    getActiveSequencerTrackId: getActiveSequencerTrackIdState,
    getUndoStack: getUndoStackState, getRedoStack: getRedoStackState,

    // State Module Setters
    addWindowToStore: addWindowToStoreState, removeWindowFromStore: removeWindowFromStoreState,
    setHighestZ: setHighestZState, incrementHighestZ: incrementHighestZState,
    setMasterEffects: setMasterEffectsState, setMasterGainValue: setMasterGainValueState,
    setMidiAccess: setMidiAccessState, setActiveMIDIInput: setActiveMIDIInputState,
    setLoadedZipFiles: setLoadedZipFilesState, setSoundLibraryFileTrees: setSoundLibraryFileTreesState,
    setCurrentLibraryName: setCurrentLibraryNameState, setCurrentSoundFileTree: setCurrentSoundFileTreeState,
    setCurrentSoundBrowserPath: setCurrentSoundBrowserPathState, setPreviewPlayer: setPreviewPlayerState,
    setClipboardData: setClipboardDataState, setArmedTrackId: setArmedTrackIdState,
    setSoloedTrackId: setSoloedTrackIdState, setIsRecording: setIsRecordingState,
    setRecordingTrackId: setRecordingTrackIdState, setRecordingStartTime: setRecordingStartTimeState,
    setActiveSequencerTrackId: setActiveSequencerTrackIdState,

    // Core State Actions
    addTrack: addTrackToStateInternal, removeTrack: removeTrackFromStateInternal,
    captureStateForUndo: captureStateForUndoInternal, undoLastAction: undoLastActionInternal,
    redoLastAction: redoLastActionInternal, gatherProjectData: gatherProjectDataInternal,
    reconstructDAW: reconstructDAWInternal, saveProject: saveProjectInternal,
    loadProject: loadProjectInternal, handleProjectFileLoad: handleProjectFileLoadInternal,
    exportToWav: exportToWavInternal,

    // Event Handler Passthroughs
    selectMIDIInput, handleTrackMute, handleTrackSolo, handleTrackArm, handleRemoveTrack,
    handleOpenTrackInspector, handleOpenEffectsRack, handleOpenSequencer,

    // UI Update Triggers / Callbacks
    updateTaskbarTempoDisplay: (tempo) => {
        if (uiElementsCache.taskbarTempoDisplay) {
            uiElementsCache.taskbarTempoDisplay.textContent = `${parseFloat(tempo).toFixed(1)} BPM`;
        }
    },
    updateUndoRedoButtonsUI: (undoState, redoState) => {
        if (uiElementsCache.menuUndo) {
            uiElementsCache.menuUndo.classList.toggle('disabled', !undoState);
            uiElementsCache.menuUndo.title = undoState ? `Undo: ${undoState.description}` : 'Undo (Nothing to undo)';
        }
        if (uiElementsCache.menuRedo) {
            uiElementsCache.menuRedo.classList.toggle('disabled', !redoState);
            uiElementsCache.menuRedo.title = redoState ? `Redo: ${redoState.description}` : 'Redo (Nothing to redo)';
        }
    },
    updateRecordButtonUI: (isRec) => {
        if (uiElementsCache.recordBtnGlobal) {
            uiElementsCache.recordBtnGlobal.textContent = isRec ? 'Stop Rec' : 'Record';
            uiElementsCache.recordBtnGlobal.classList.toggle('recording', isRec);
        }
    },
    closeAllWindows: (isReconstruction = false) => {
        getOpenWindowsState().forEach(win => win.close(isReconstruction));
        if (appServices.clearOpenWindowsMap) appServices.clearOpenWindowsMap();
    },
    clearOpenWindowsMap: () => {
        const map = getOpenWindowsState();
        if(map && typeof map.clear === 'function') map.clear();
    },
    closeAllTrackWindows: (trackIdToClose) => {
        const windowIdsToClose = [
            `trackInspector-${trackIdToClose}`, `effectsRack-${trackIdToClose}`, `sequencerWin-${trackIdToClose}`
        ];
        windowIdsToClose.forEach(winId => {
            const win = getWindowByIdState(winId);
            if (win && typeof win.close === 'function') win.close(true);
        });
    },
    updateTrackUI: handleTrackUIUpdate,
    createWindow: (id, title, content, options) => new SnugWindow(id, title, content, options, appServices),
    uiElementsCache: uiElementsCache,

    // Master Effects Chain - State and Audio interaction
    addMasterEffect: async (effectType) => {
        const isReconstructing = appServices.getIsReconstructingDAW();
        if (!isReconstructing) captureStateForUndoInternal(`Add ${effectType} to Master`);
        const defaultParams = appServices.effectsRegistryAccess.getEffectDefaultParams(effectType);
        const effectIdInState = addMasterEffectToState(effectType, defaultParams);
        await addMasterEffectToAudio(effectIdInState, effectType, defaultParams);
        if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
    },
    removeMasterEffect: async (effectId) => {
        const effect = getMasterEffectsState().find(e => e.id === effectId);
        if (effect) {
            const isReconstructing = appServices.getIsReconstructingDAW();
            if (!isReconstructing) captureStateForUndoInternal(`Remove ${effect.type} from Master`);
            removeMasterEffectFromState(effectId);
            await removeMasterEffectFromAudio(effectId);
            if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        }
    },
    updateMasterEffectParam: (effectId, paramPath, value) => {
        updateMasterEffectParamInState(effectId, paramPath, value);
        updateMasterEffectParamInAudio(effectId, paramPath, value);
    },
    reorderMasterEffect: (effectId, newIndex) => {
        const isReconstructing = appServices.getIsReconstructingDAW();
        if (!isReconstructing) captureStateForUndoInternal(`Reorder Master effect`);
        reorderMasterEffectInState(effectId, newIndex);
        reorderMasterEffectInAudio(effectId, newIndex);
        if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
    },
    setActualMasterVolume: (volumeValue) => {
        const actualMasterNode = getActualMasterGainNodeFromAudio();
        if (actualMasterNode && actualMasterNode.gain) {
            actualMasterNode.gain.value = volumeValue;
        }
    },
    effectsRegistryAccess: {
        AVAILABLE_EFFECTS: null, getEffectParamDefinitions: null,
        getEffectDefaultParams: null, synthEngineControlDefinitions: null,
    },
    getIsReconstructingDAW: () => appServices._isReconstructingDAW_flag,
    _isReconstructingDAW_flag: false,
    _transportEventsInitialized_flag: false,
    getTransportEventsInitialized: () => appServices._transportEventsInitialized_flag,
    setTransportEventsInitialized: (value) => { appServices._transportEventsInitialized_flag = value; },
    updateTrackMeterUI: (trackId, level, isClipping) => {
        const inspectorWindow = getWindowByIdState(`trackInspector-${trackId}`);
        const mixerWindow = getWindowByIdState('mixer');
        if (inspectorWindow?.element && !inspectorWindow.isMinimized) {
            const meterBar = inspectorWindow.element.querySelector(`#trackMeterBar-${trackId}`);
            if (meterBar) {
                meterBar.style.width = `${Math.min(100, level * 100)}%`;
                meterBar.classList.toggle('clipping', isClipping);
            }
        }
        if (mixerWindow?.element && !mixerWindow.isMinimized) {
            const meterBar = mixerWindow.element.querySelector(`#mixerTrackMeterBar-${trackId}`);
            if (meterBar) {
                meterBar.style.width = `${Math.min(100, level * 100)}%`;
                meterBar.classList.toggle('clipping', isClipping);
            }
        }
    },
    updateMasterEffectsRackUI: () => {
        const masterRackWindow = getWindowByIdState('masterEffectsRack');
        if (masterRackWindow?.element && !masterRackWindow.isMinimized) {
            renderEffectsList(null, 'master', masterRackWindow.element.querySelector('#effectsList-master'), masterRackWindow.element.querySelector('#effectControlsContainer-master'));
        }
    },
    // Background handling functions for context menu
    triggerCustomBackgroundUpload: () => {
        if (uiElementsCache.customBgInput) {
            uiElementsCache.customBgInput.click();
        }
    },
    removeCustomDesktopBackground: removeCustomDesktopBackground,
};

// --- UI Update Router ---
function handleTrackUIUpdate(trackId, reason, detail) {
    const track = getTrackByIdState(trackId);
    if (!track) {
        console.warn(`[Main UI Update] Track ${trackId} not found for reason: ${reason}`);
        return;
    }

    const inspectorWindow = getWindowByIdState(`trackInspector-${trackId}`);
    const effectsRackWindow = getWindowByIdState(`effectsRack-${trackId}`);
    const sequencerWindow = getWindowByIdState(`sequencerWin-${trackId}`);
    const mixerWindow = getWindowByIdState('mixer');

    switch(reason) {
        case 'muteChanged':
        case 'soloChanged':
        case 'armChanged':
            if (inspectorWindow?.element && !inspectorWindow.isMinimized) {
                const muteBtn = inspectorWindow.element.querySelector(`#muteBtn-${track.id}`);
                const soloBtn = inspectorWindow.element.querySelector(`#soloBtn-${track.id}`);
                const armBtn = inspectorWindow.element.querySelector(`#armInputBtn-${track.id}`);
                if (muteBtn) muteBtn.classList.toggle('muted', track.isMuted);
                if (soloBtn) soloBtn.classList.toggle('soloed', getSoloedTrackIdState() === track.id);
                if (armBtn) armBtn.classList.toggle('armed', getArmedTrackIdState() === track.id);
            }
            if (mixerWindow?.element && !mixerWindow.isMinimized) updateMixerWindow();
            break;
        case 'effectsListChanged':
             if (effectsRackWindow?.element && !effectsRackWindow.isMinimized) {
                renderEffectsList(track, 'track', effectsRackWindow.element.querySelector(`#effectsList-${track.id}`), effectsRackWindow.element.querySelector(`#effectControlsContainer-${track.id}`));
             }
            break;
        case 'samplerLoaded':
        case 'instrumentSamplerLoaded':
        case 'sampleSliced':
            if (inspectorWindow?.element && !inspectorWindow.isMinimized) {
                if (track.type === 'Sampler') { drawWaveform(track); renderSamplePads(track); updateSliceEditorUI(track); }
                else if (track.type === 'InstrumentSampler') drawInstrumentWaveform(track);

                const dzContainerId = track.type === 'Sampler' ? `#dropZoneContainer-${track.id}-sampler` : `#dropZoneContainer-${track.id}-instrumentsampler`;
                const dzContainer = inspectorWindow.element.querySelector(dzContainerId);
                if(dzContainer) {
                    const audioData = track.type === 'Sampler' ? track.samplerAudioData : track.instrumentSamplerSettings;
                    const inputId = track.type === 'Sampler' ? `fileInput-${track.id}` : `instrumentFileInput-${track.id}`;
                    dzContainer.innerHTML = createDropZoneHTML(track.id, inputId, track.type, null, {originalFileName: audioData.fileName, status: 'loaded'});
                    const fileInputEl = dzContainer.querySelector(`#${inputId}`);
                    const loadFn = appServices.loadSampleFile; 
                    if (fileInputEl && loadFn) fileInputEl.onchange = (e) => loadFn(e, track.id, track.type);
                }
            }
            break;
        case 'drumPadLoaded':
             if (inspectorWindow?.element && !inspectorWindow.isMinimized) { updateDrumPadControlsUI(track); renderDrumSamplerPads(track); }
            break;
        case 'sequencerContentChanged':
            if (sequencerWindow?.element && !sequencerWindow.isMinimized) openTrackSequencerWindow(trackId, true, sequencerWindow.options);
            break;
        case 'sampleLoadError':
            if (inspectorWindow?.element && !inspectorWindow.isMinimized) {
                let dzContainerId, audioDataKey, inputIdBase;
                if (track.type === 'DrumSampler' && typeof detail === 'number') {
                    dzContainerId = `#drumPadDropZoneContainer-${track.id}-${detail}`;
                    audioDataKey = track.drumSamplerPads[detail];
                    inputIdBase = `drumPadFileInput-${track.id}-${detail}`;
                } else if (track.type === 'Sampler') {
                    dzContainerId = `#dropZoneContainer-${track.id}-sampler`; audioDataKey = track.samplerAudioData; inputIdBase = `fileInput-${track.id}`;
                } else if (track.type === 'InstrumentSampler') {
                    dzContainerId = `#dropZoneContainer-${track.id}-instrumentsampler`; audioDataKey = track.instrumentSamplerSettings; inputIdBase = `instrumentFileInput-${track.id}`;
                }

                if (dzContainerId && audioDataKey) {
                    const dzContainer = inspectorWindow.element.querySelector(dzContainerId);
                    if (dzContainer) {
                        dzContainer.innerHTML = createDropZoneHTML(track.id, inputIdBase, track.type, (track.type === 'DrumSampler' ? detail : null), {originalFileName: audioDataKey.fileName, status: 'error'});
                        const fileInputEl = dzContainer.querySelector(`#${inputIdBase}`);
                        const loadDrumFn = appServices.loadDrumSamplerPadFile;
                        const loadSampleFn = appServices.loadSampleFile;
                        if (fileInputEl) {
                            if (track.type === 'DrumSampler' && loadDrumFn) fileInputEl.onchange = (e) => loadDrumFn(e, track.id, detail);
                            else if (loadSampleFn) fileInputEl.onchange = (e) => loadSampleFn(e, track.id, track.type);
                        }
                    }
                }
            }
            break;
    }
}

// --- Main Application Initialization ---
async function initializeSnugOS() {
    console.log("[Main] Initializing SnugOS...");

    Object.keys(uiElementsCache).forEach(key => {
        // Cache elements that are always present or frequently accessed
        // Menu items are handled by eventhandlers.js directly by ID if not found in cache
        if (document.getElementById(key)) { // Check if element exists before caching
             uiElementsCache[key] = document.getElementById(key);
        }
    });
    
    const effectsRegistry = await import('./effectsRegistry.js');
    appServices.effectsRegistryAccess.AVAILABLE_EFFECTS = effectsRegistry.AVAILABLE_EFFECTS;
    appServices.effectsRegistryAccess.getEffectParamDefinitions = effectsRegistry.getEffectParamDefinitions;
    appServices.effectsRegistryAccess.getEffectDefaultParams = effectsRegistry.getEffectDefaultParams;
    appServices.effectsRegistryAccess.synthEngineControlDefinitions = effectsRegistry.synthEngineControlDefinitions;


    applyDesktopBackground(localStorage.getItem(DESKTOP_BACKGROUND_KEY));
    if (uiElementsCache.customBgInput) { // This listener is for the hidden input file element
        uiElementsCache.customBgInput.addEventListener('change', handleCustomBackgroundUpload);
    }

    initializeStateModule(appServices);
    initializeUIModule(appServices);
    initializeAudioModule(appServices);
    initializeEventHandlersModule(appServices); // Pass appServices here

    initializePrimaryEventListeners(appServices); // Pass appServices here

    openGlobalControlsWindow((elements) => {
        uiElementsCache.playBtnGlobal = elements.playBtnGlobal;
        uiElementsCache.recordBtnGlobal = elements.recordBtnGlobal;
        uiElementsCache.tempoGlobalInput = elements.tempoGlobalInput;
        uiElementsCache.midiInputSelectGlobal = elements.midiInputSelectGlobal;
        uiElementsCache.masterMeterContainerGlobal = elements.masterMeterContainerGlobal;
        uiElementsCache.masterMeterBarGlobal = elements.masterMeterBarGlobal;
        uiElementsCache.midiIndicatorGlobal = elements.midiIndicatorGlobal;
        uiElementsCache.keyboardIndicatorGlobal = elements.keyboardIndicatorGlobal;
        attachGlobalControlEvents(elements);
        setupMIDI();
    }, null);

    Object.entries(Constants.soundLibraries).forEach(([name, url]) => fetchSoundLibrary(name, url, true));

    // Open timeline window by default on startup
    if (appServices.openTimelineWindow) {
        appServices.openTimelineWindow();
    }
    
    requestAnimationFrame(updateMetersLoop);
    appServices.updateUndoRedoButtonsUI(null, null);

    showNotification("Welcome to SnugOS!", 2500);
    console.log("[Main] SnugOS Initialized.");
}

function updateMetersLoop() {
    const mixerWindow = getWindowByIdState('mixer');
    const mixerMasterMeterBar = mixerWindow?.element && !mixerWindow.isMinimized ? mixerWindow.element.querySelector('#mixerMasterMeterBar') : null;
    updateMeters(uiElementsCache.masterMeterBarGlobal, mixerMasterMeterBar, getTracksState());
    updatePlayheadPosition(); 
    requestAnimationFrame(updateMetersLoop);
}

function applyDesktopBackground(imageUrl) {
    if (uiElementsCache.desktop && imageUrl) {
        uiElementsCache.desktop.style.backgroundImage = `url('${imageUrl}')`;
        uiElementsCache.desktop.style.backgroundSize = 'cover';
        uiElementsCache.desktop.style.backgroundPosition = 'center center';
        uiElementsCache.desktop.style.backgroundRepeat = 'no-repeat';
        uiElementsCache.desktop.style.backgroundColor = '';
    } else if (uiElementsCache.desktop) {
        uiElementsCache.desktop.style.backgroundImage = '';
        uiElementsCache.desktop.style.backgroundColor = Constants.defaultDesktopBg || '#101010';
    }
}

// handleCustomBackgroundUpload and removeCustomDesktopBackground are now defined above appServices

window.addEventListener('load', initializeSnugOS);
window.addEventListener('beforeunload', (e) => {
    if (getTracksState().length > 0 || getUndoStackState().length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

console.log("SCRIPT EXECUTION FINISHED - SnugOS (main.js refactored v11 - Timeline Window)");
