// js/main.js - Main Application Logic Orchestrator

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
// setupGenericDropZoneListeners is imported here but used via appServices by ui.js
import { showNotification as utilShowNotification, createContextMenu, createDropZoneHTML, setupGenericDropZoneListeners } from './utils.js';
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
    // Core State Actions
    addTrackToStateInternal, removeTrackFromStateInternal, renameTrackInState,
    captureStateForUndoInternal, undoLastActionInternal, redoLastActionInternal,
    gatherProjectDataInternal, reconstructDAWInternal, saveProjectInternal,
    loadProjectInternal, handleProjectFileLoadInternal, exportToWavInternal, exportStemsInternal
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
    stopAudioRecording,
    isMetronomeEnabled,
    setMetronomeEnabled,
    setCountInBars,
    getCountInBars
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
    openTimelineWindow
} from './ui.js';

console.log(`SCRIPT EXECUTION STARTED - SnugOS (main.js - Version ${Constants.APP_VERSION})`);

// --- Global UI Elements Cache ---
const uiElementsCache = {
    desktop: null, taskbar: null, startButton: null, startMenu: null,
    taskbarButtonsContainer: null, taskbarTempoDisplay: null, loadProjectInput: null,
    customBgInput: null, sampleFileInput: null, notificationArea: null, modalContainer: null,
    menuAddSynthTrack: null, menuAddSamplerTrack: null, menuAddDrumSamplerTrack: null,
    menuAddInstrumentSamplerTrack: null, menuAddAudioTrack: null,
    menuOpenSoundBrowser: null, menuOpenTimeline: null,
    menuUndo: null, menuRedo: null,
    menuSaveProject: null, menuLoadProject: null, menuExportWav: null,
    menuExportStems: null, menuOpenGlobalControls: null,
    menuOpenMixer: null, menuOpenMasterEffects: null,
    menuToggleFullScreen: null, playBtnGlobal: null, recordBtnGlobal: null, stopBtnGlobal: null,
    tempoGlobalInput: null, midiInputSelectGlobal: null, masterMeterContainerGlobal: null,
    masterMeterBarGlobal: null, midiIndicatorGlobal: null, keyboardIndicatorGlobal: null,
    playbackModeToggleBtnGlobal: null,
    metronomeBtnGlobal: null
};

const DESKTOP_BACKGROUND_KEY = 'snugosDesktopBackground';
const DESKTOP_BG_TYPE_KEY = 'snugosDesktopBgType'; // 'image' or 'video'

// Simple IndexedDB helper for video backgrounds (too large for localStorage)
const bgDb = {
    db: null,
    async init() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SnugOSBackgrounds', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(this.db); };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('backgrounds')) {
                    db.createObjectStore('backgrounds');
                }
            };
        });
    },
    async save(key, blob) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('backgrounds', 'readwrite');
            const store = tx.objectStore('backgrounds');
            store.put(blob, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
    async get(key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('backgrounds', 'readonly');
            const store = tx.objectStore('backgrounds');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    async remove(key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('backgrounds', 'readwrite');
            const store = tx.objectStore('backgrounds');
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
};

async function handleCustomBackgroundUpload(event) {
    if (!event?.target?.files?.[0]) return;
    const file = event.target.files[0];
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
        showSafeNotification("Invalid file type. Please select an image or video.", 3000);
        return;
    }

    try {
        if (isImage) {
            // For images, use data URL in localStorage (smaller files)
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataURL = e.target.result;
                localStorage.setItem(DESKTOP_BACKGROUND_KEY, dataURL);
                localStorage.setItem(DESKTOP_BG_TYPE_KEY, 'image');
                await applyDesktopBackground(dataURL, 'image');
                showSafeNotification("Image background applied.", 2000);
            };
            reader.readAsDataURL(file);
        } else if (isVideo) {
            // For videos, store in IndexedDB and create object URL
            showSafeNotification("Processing video background...", 2000);
            await bgDb.save('desktopVideo', file);
            localStorage.setItem(DESKTOP_BG_TYPE_KEY, 'video');
            localStorage.removeItem(DESKTOP_BACKGROUND_KEY); // Clear any image
            const objectUrl = URL.createObjectURL(file);
            await applyDesktopBackground(objectUrl, 'video');
            showSafeNotification("Video background applied.", 2000);
        }
    } catch (error) {
        console.error("Error saving background:", error);
        showSafeNotification("Could not save background: " + error.message, 4000);
    }
    
    if (event.target) event.target.value = null;
}

async function removeCustomDesktopBackground() {
    try {
        localStorage.removeItem(DESKTOP_BACKGROUND_KEY);
        localStorage.removeItem(DESKTOP_BG_TYPE_KEY);
        await bgDb.remove('desktopVideo');
        await applyDesktopBackground(null, null);
        showSafeNotification("Custom background removed.", 2000);
    } catch (error) {
        console.error("Error removing background from storage:", error);
        showSafeNotification("Could not remove background from storage.", 3000);
    }
}

function showSafeNotification(message, duration) {
    if (typeof utilShowNotification === 'function') {
        utilShowNotification(message, duration);
    } else {
        console.warn("showNotification utility not available, logging to console:", message);
    }
}

const appServices = {
    // UI Module Functions
    openTrackInspectorWindow, openTrackEffectsRackWindow, openTrackSequencerWindow,
    openMixerWindow, updateMixerWindow, openSoundBrowserWindow, openMasterEffectsRackWindow,
    renderSoundBrowserDirectory, updateSoundBrowserDisplayForLibrary, highlightPlayingStep,
    drawWaveform, drawInstrumentWaveform, renderSamplePads, updateSliceEditorUI,
    updateDrumPadControlsUI, renderDrumSamplerPads, renderEffectsList, renderEffectControls,
    createKnob, updateSequencerCellUI,
    renderTimeline, openTimelineWindow,
    showNotification: showSafeNotification, 
    createContextMenu, 

    // Audio Module Functions
    initAudioContextAndMasterMeter, updateMeters, fetchSoundLibrary, loadSoundFromBrowserToTarget,
    playSlicePreview, playDrumSamplerPadPreview, loadSampleFile, loadDrumSamplerPadFile,
    autoSliceSample, getMimeTypeFromFilename,
    getMasterEffectsBusInputNode,

    // Drum Sampler specific function
    selectDrumPad: (trackId, padIndex) => {
        const track = getTrackByIdState ? getTrackByIdState(trackId) : null;
        if (!track || track.type !== 'DrumSampler') {
            console.warn(`[Main selectDrumPad] Invalid track ${trackId} or not a DrumSampler`);
            return;
        }
        console.log(`[Main selectDrumPad] Selecting pad ${padIndex} for track ${trackId}`);
        track.selectedDrumPadForEdit = padIndex;
        
        // Re-render the pad grid and update controls
        if (typeof renderDrumSamplerPads === 'function') renderDrumSamplerPads(track);
        if (typeof updateDrumPadControlsUI === 'function') updateDrumPadControlsUI(track);
        
        // Set up the drop zone for the newly selected pad
        const inspectorWindow = getWindowByIdState(`trackInspector-${trackId}`);
        if (inspectorWindow?.element && !inspectorWindow.isMinimized) {
            const dzContainer = inspectorWindow.element.querySelector(`#drumPadDropZoneContainer-${trackId}-${padIndex}`);
            if (dzContainer) {
                const existingAudioData = track.drumSamplerPads && track.drumSamplerPads[padIndex] ?
                    { fileName: track.drumSamplerPads[padIndex].fileName, status: 'loaded' } :
                    { fileName: null, status: 'empty' };
                dzContainer.innerHTML = createDropZoneHTML(trackId, `drumPadFileInput-${trackId}-${padIndex}`, 'DrumSampler', padIndex, existingAudioData);
                const dzEl = dzContainer.querySelector('.drop-zone');
                const fileInputEl = dzContainer.querySelector(`#drumPadFileInput-${trackId}-${padIndex}`);
                if (dzEl) setupGenericDropZoneListeners(dzEl, trackId, 'DrumSampler', padIndex, appServices.loadSoundFromBrowserToTarget, appServices.loadDrumSamplerPadFile);
                if (fileInputEl) fileInputEl.onchange = (e) => { appServices.loadDrumSamplerPadFile(e, trackId, padIndex); };
            }
        }
    },
    getActualMasterGainNode: getActualMasterGainNodeFromAudio,
    clearAllMasterEffectNodes: clearAllMasterEffectNodesInAudio,
    startAudioRecording, stopAudioRecording,

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
    getPlaybackMode: getPlaybackModeState,

    // State Module Setters & Core Actions
    addWindowToStore: addWindowToStoreState, removeWindowFromStore: removeWindowFromStoreState,
    setHighestZ: setHighestZState, incrementHighestZ: incrementHighestZState,
    setMasterEffects: setMasterEffectsState, setMasterGainValue: setMasterGainValueState,
    setMidiAccess: setMidiAccessState, setActiveMIDIInput: setActiveMIDIInputState,
    setLoadedZipFilesState: setLoadedZipFilesState,
    setSoundLibraryFileTreesState: setSoundLibraryFileTreesState,
    setCurrentLibraryNameState, setCurrentSoundFileTreeState, setCurrentSoundBrowserPathState, setPreviewPlayerState,
    setClipboardDataState, setArmedTrackIdState, setSoloedTrackIdState, setIsRecordingState,
    setRecordingTrackIdState, setRecordingStartTimeState, setActiveSequencerTrackIdState,
    setPlaybackModeState,
    addMasterEffectToState, removeMasterEffectFromState,
    updateMasterEffectParamInState, reorderMasterEffectInState,
    // Core State Actions
    addTrack: addTrackToStateInternal, removeTrack: removeTrackFromStateInternal,
    renameTrack: renameTrackInState,
    captureStateForUndo: captureStateForUndoInternal, undoLastAction: undoLastActionInternal,
    redoLastAction: redoLastActionInternal, gatherProjectData: gatherProjectDataInternal,
    reconstructDAW: reconstructDAWInternal, saveProject: saveProjectInternal,
    loadProject: loadProjectInternal, handleProjectFileLoad: handleProjectFileLoadInternal,
    exportToWav: exportToWavInternal,
    exportStems: exportStemsInternal,

    // Event Handler Passthroughs
    selectMIDIInput: eventSelectMIDIInput, 
    handleTrackMute: eventHandleTrackMute,
    handleTrackSolo: eventHandleTrackSolo,
    handleTrackArm: eventHandleTrackArm,
    handleRemoveTrack: eventHandleRemoveTrack,
    handleOpenTrackInspector: eventHandleOpenTrackInspector,
    handleOpenEffectsRack: eventHandleOpenEffectsRack,
    handleOpenSequencer: eventHandleOpenSequencer,
    handleTimelineLaneDrop: handleTimelineLaneDrop,
    attachGlobalControlEvents: attachGlobalControlEvents, // FIX: Expose for reconstruction

    getAudioBlobFromSoundBrowserItem: async (soundData) => {
        if (!soundData || !soundData.libraryName || !soundData.fullPath) {
            console.warn("[AppServices getAudioBlob] Invalid soundData:", soundData);
            return null;
        }
        const loadedZips = getLoadedZipFilesState(); 
        if (loadedZips?.[soundData.libraryName] && loadedZips[soundData.libraryName] !== "loading") {
            const zipEntry = loadedZips[soundData.libraryName].file(soundData.fullPath);
            if (zipEntry) {
                try {
                    const blob = await zipEntry.async("blob");
                    return new File([blob], soundData.fileName, { type: getMimeTypeFromFilename(soundData.fileName) });
                } catch (e) {
                    console.error("[AppServices getAudioBlob] Error getting blob from zipEntry:", e);
                    return null;
                }
            } else {
                console.warn(`[AppServices getAudioBlob] ZipEntry not found for ${soundData.fullPath} in ${soundData.libraryName}`);
            }
        } else {
            console.warn(`[AppServices getAudioBlob] Library ${soundData.libraryName} not loaded or is loading.`);
        }
        return null;
    },

    // MODIFICATION: Refined Panic Stop Service
    panicStopAllAudio: () => {
        console.log("[AppServices] Panic Stop All Audio requested.");
        
        if (typeof Tone !== 'undefined') {
            Tone.Transport.stop();
            Tone.Transport.cancel(0); 
        }

        // Reset play button state
        const playBtn = uiElementsCache.playBtnGlobal;
        if (playBtn) {
            playBtn.textContent = 'Play';
            playBtn.classList.remove('playing');
        }

        const tracks = getTracksState();
        if (tracks) {
            tracks.forEach(track => {
                if (track && typeof track.stopPlayback === 'function') {
                    try {
                        track.stopPlayback(); 
                    } catch (e) {
                        console.warn(`Error in track.stopPlayback() for track ${track.id}:`, e);
                    }
                }

                if (track && track.instrument && !track.instrument.disposed) {
                    if (typeof track.instrument.releaseAll === 'function') {
                        try {
                            track.instrument.releaseAll(Tone.now()); 
                        } catch (e) {
                            console.warn(`Error during instrument.releaseAll() for track ${track.id}:`, e);
                        }
                    }
                    // Aggressive gain ramp-down for synth types
                    if ((track.type === 'Synth' || track.type === 'InstrumentSampler') && 
                        track.gainNode && track.gainNode.gain && 
                        typeof track.gainNode.gain.cancelScheduledValues === 'function' &&
                        typeof track.gainNode.gain.linearRampToValueAtTime === 'function' &&
                        !track.gainNode.disposed) {
                        console.log(`[AppServices Panic] Ramping down gain for synth track ${track.id}`);
                        try {
                            track.gainNode.gain.cancelScheduledValues(Tone.now());
                            track.gainNode.gain.linearRampToValueAtTime(0, Tone.now() + 0.02); 
                        } catch (e) {
                            console.warn(`Error ramping down gain for track ${track.id}:`, e);
                        }
                    }
                }
                
                if (track && track.type === 'Sampler' && !track.slicerIsPolyphonic && track.slicerMonoPlayer && track.slicerMonoEnvelope) {
                    if (track.slicerMonoPlayer.state === 'started' && !track.slicerMonoPlayer.disposed) {
                        try { track.slicerMonoPlayer.stop(Tone.now()); } catch(e) { console.warn("Error stopping mono slicer player during panic", e); }
                    }
                    if (!track.slicerMonoEnvelope.disposed) {
                        try { track.slicerMonoEnvelope.triggerRelease(Tone.now()); } catch(e) { console.warn("Error releasing mono slicer envelope during panic", e); }
                    }
                }
                if (track && track.type === 'DrumSampler' && track.drumPadPlayers) {
                    track.drumPadPlayers.forEach(player => {
                        if (player && player.state === 'started' && !player.disposed) {
                            try { player.stop(Tone.now()); } catch(e) { console.warn("Error stopping drum pad player during panic", e); }
                        }
                    });
                }
            });
        }

        console.log("All audio and transport stopped via panic.");
        showSafeNotification("All audio stopped.", 1500);
    },
    // END MODIFICATION

    updateTaskbarTempoDisplay: (tempo) => {
        if (uiElementsCache.taskbarTempoDisplay) {
            uiElementsCache.taskbarTempoDisplay.textContent = `${parseFloat(tempo).toFixed(1)} BPM`;
        } else { console.warn("Taskbar tempo display element not found in cache."); }
    },
    updateUndoRedoButtonsUI: (undoState, redoState) => {
        if (uiElementsCache.menuUndo) {
            uiElementsCache.menuUndo.classList.toggle('disabled', !undoState);
            uiElementsCache.menuUndo.title = undoState ? `Undo: ${undoState.description || 'action'}` : 'Undo (Nothing to undo)';
        } else { console.warn("Undo menu item not found in cache."); }
        if (uiElementsCache.menuRedo) {
            uiElementsCache.menuRedo.classList.toggle('disabled', !redoState);
            uiElementsCache.menuRedo.title = redoState ? `Redo: ${redoState.description || 'action'}` : 'Redo (Nothing to redo)';
        } else { console.warn("Redo menu item not found in cache."); }
    },
    updateRecordButtonUI: (isRec) => {
        if (uiElementsCache.recordBtnGlobal) {
            uiElementsCache.recordBtnGlobal.textContent = isRec ? 'Stop Rec' : 'Record';
            uiElementsCache.recordBtnGlobal.classList.toggle('recording', isRec);
        } else { console.warn("Global record button not found in cache."); }
    },
    closeAllWindows: (isReconstruction = false) => {
        const openWindows = getOpenWindowsState();
        if (openWindows && typeof openWindows.forEach === 'function') {
            openWindows.forEach(win => {
                if (win && typeof win.close === 'function') win.close(isReconstruction);
            });
        }
        if (appServices.clearOpenWindowsMap) appServices.clearOpenWindowsMap();
    },
    clearOpenWindowsMap: () => {
        const map = getOpenWindowsState();
        if(map && typeof map.clear === 'function') map.clear();
    },
    closeAllTrackWindows: (trackIdToClose) => {
        console.log(`[Main appServices.closeAllTrackWindows] Called for trackId: ${trackIdToClose}`);
        const windowIdsToClose = [
            `trackInspector-${trackIdToClose}`, `effectsRack-${trackIdToClose}`, `sequencerWin-${trackIdToClose}`
        ];
        windowIdsToClose.forEach(winId => {
            const win = getWindowByIdState(winId);
            if (win && typeof win.close === 'function') {
                win.close(true); 
            }
        });
    },
    updateTrackUI: handleTrackUIUpdate, 
    createWindow: (id, title, content, options) => new SnugWindow(id, title, content, options, appServices),
    uiElementsCache: uiElementsCache, 

    addMasterEffect: async (effectType) => {
        try {
            const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
            if (!isReconstructing && appServices.captureStateForUndo) appServices.captureStateForUndo(`Add ${effectType} to Master`);

            if (!appServices.effectsRegistryAccess?.getEffectDefaultParams) {
                console.error("effectsRegistryAccess.getEffectDefaultParams not available."); return;
            }
            const defaultParams = appServices.effectsRegistryAccess.getEffectDefaultParams(effectType);
            const effectIdInState = addMasterEffectToState(effectType, defaultParams);
            await addMasterEffectToAudio(effectIdInState, effectType, defaultParams);
            if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        } catch (error) {
            console.error(`[Main addMasterEffect] Error adding ${effectType}:`, error);
            showSafeNotification(`Failed to add master effect ${effectType}.`, 3000);
        }
    },
    removeMasterEffect: async (effectId) => {
        try {
            const effects = getMasterEffectsState();
            const effect = effects ? effects.find(e => e.id === effectId) : null;
            if (effect) {
                const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
                if (!isReconstructing && appServices.captureStateForUndo) appServices.captureStateForUndo(`Remove ${effect.type} from Master`);
                removeMasterEffectFromState(effectId);
                await removeMasterEffectFromAudio(effectId);
                if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
            }
        } catch (error) {
            console.error(`[Main removeMasterEffect] Error removing ${effectId}:`, error);
            showSafeNotification("Failed to remove master effect.", 3000);
        }
    },
    updateMasterEffectParam: (effectId, paramPath, value) => {
        updateMasterEffectParamInState(effectId, paramPath, value);
        updateMasterEffectParamInAudio(effectId, paramPath, value);
    },
    reorderMasterEffect: (effectId, newIndex) => {
        try {
            const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
            if (!isReconstructing && appServices.captureStateForUndo) appServices.captureStateForUndo(`Reorder Master effect`);
            reorderMasterEffectInState(effectId, newIndex);
            reorderMasterEffectInAudio(effectId, newIndex); 
            if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        } catch (error) {
            console.error(`[Main reorderMasterEffect] Error reordering ${effectId}:`, error);
            showSafeNotification("Failed to reorder master effect.", 3000);
        }
    },
    setActualMasterVolume: (volumeValue) => {
        if (typeof getActualMasterGainNodeFromAudio === 'function') {
            const actualMasterNode = getActualMasterGainNodeFromAudio();
            if (actualMasterNode && actualMasterNode.gain && typeof actualMasterNode.gain.setValueAtTime === 'function') {
                try {
                    actualMasterNode.gain.setValueAtTime(volumeValue, Tone.now());
                } catch (e) { console.error("Error setting master volume via Tone:", e); }
            } else { console.warn("Master gain node or its gain property not available."); }
        } else { console.warn("getActualMasterGainNodeFromAudio service missing."); }
    },
    effectsRegistryAccess: {
        AVAILABLE_EFFECTS: null, getEffectParamDefinitions: null,
        getEffectDefaultParams: null, synthEngineControlDefinitions: null,
    },
    getIsReconstructingDAW: () => appServices._isReconstructingDAW_flag === true, 
    _isReconstructingDAW_flag: false,
    _transportEventsInitialized_flag: false,
    getTransportEventsInitialized: () => appServices._transportEventsInitialized_flag,
    setTransportEventsInitialized: (value) => { appServices._transportEventsInitialized_flag = !!value; },
    updateTrackMeterUI: (trackId, level, isClipping) => {
        try {
            const inspectorWindow = getWindowByIdState(`trackInspector-${trackId}`);
            const mixerWindow = getWindowByIdState('mixer');
            if (inspectorWindow?.element && !inspectorWindow.isMinimized) {
                const meterBar = inspectorWindow.element.querySelector(`#trackMeterBar-${trackId}`);
                if (meterBar) {
                    meterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                    meterBar.classList.toggle('clipping', isClipping);
                }
            }
            if (mixerWindow?.element && !mixerWindow.isMinimized) {
                const meterBar = mixerWindow.element.querySelector(`#mixerTrackMeterBar-${trackId}`);
                if (meterBar) {
                    meterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                    meterBar.classList.toggle('clipping', isClipping);
                }
            }
        } catch (error) { console.warn(`[Main updateTrackMeterUI] Error for track ${trackId}:`, error); }
    },
    updateMasterEffectsRackUI: () => {
        try {
            const masterRackWindow = getWindowByIdState('masterEffectsRack');
            if (masterRackWindow?.element && !masterRackWindow.isMinimized && typeof renderEffectsList === 'function') {
                const listDiv = masterRackWindow.element.querySelector('#effectsList-master');
                const controlsContainer = masterRackWindow.element.querySelector('#effectControlsContainer-master');
                if (listDiv && controlsContainer) {
                    renderEffectsList(null, 'master', listDiv, controlsContainer);
                } else { console.warn("Master effects rack UI elements not found for update."); }
            }
        } catch (error) { console.warn("[Main updateMasterEffectsRackUI] Error:", error); }
    },
    triggerCustomBackgroundUpload: () => {
        if (uiElementsCache.customBgInput) uiElementsCache.customBgInput.click();
        else console.warn("Custom background input element not found in cache.");
    },
    removeCustomDesktopBackground: removeCustomDesktopBackground,
    onPlaybackModeChange: (newMode) => {
        console.log(`[Main appServices.onPlaybackModeChange] Called with newMode: ${newMode}`);
        if (uiElementsCache.playbackModeToggleBtnGlobal) {
            uiElementsCache.playbackModeToggleBtnGlobal.textContent = newMode === 'timeline' ? 'Mode: Timeline' : 'Mode: Sequencer';
            uiElementsCache.playbackModeToggleBtnGlobal.classList.toggle('active', newMode === 'timeline');
        } else {
            console.warn("[Main appServices.onPlaybackModeChange] Playback mode toggle button not found in UI cache.");
        }
        if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') {
            appServices.renderTimeline(); 
        }
    },
    renameTrackInState
};

function handleTrackUIUpdate(trackId, reason, detail) {
    if (!getTrackByIdState) { console.warn("[Main UI Update] getTrackByIdState service not available."); return; }
    const track = getTrackByIdState(trackId);
    if (!track) {
        console.warn(`[Main UI Update] Track ${trackId} not found for reason: ${reason}`);
        return;
    }

    const getOpenWindowElement = (winId) => {
        if (!getWindowByIdState) return null;
        const win = getWindowByIdState(winId);
        return (win?.element && !win.isMinimized) ? win.element : null;
    };

    const inspectorElement = getOpenWindowElement(`trackInspector-${trackId}`);
    const effectsRackElement = getOpenWindowElement(`effectsRack-${trackId}`);
    const sequencerElement = getOpenWindowElement(`sequencerWin-${trackId}`);
    const mixerElement = getOpenWindowElement('mixer');

    try {
        switch(reason) {
            case 'muteChanged':
            case 'soloChanged':
            case 'armChanged':
                if (inspectorElement) {
                    const muteBtn = inspectorElement.querySelector(`#muteBtn-${track.id}`);
                    if (muteBtn) muteBtn.classList.toggle('muted', track.isMuted);
                    const soloBtn = inspectorElement.querySelector(`#soloBtn-${track.id}`);
                    if (soloBtn) soloBtn.classList.toggle('soloed', getSoloedTrackIdState() === track.id);
                    const armBtn = inspectorElement.querySelector(`#armInputBtn-${track.id}`);
                    if (armBtn) armBtn.classList.toggle('armed', getArmedTrackIdState() === track.id);
                }
                if (mixerElement && typeof updateMixerWindow === 'function') updateMixerWindow();
                break;
            case 'effectsListChanged':
                 if (effectsRackElement && typeof renderEffectsList === 'function') {
                    const listDiv = effectsRackElement.querySelector(`#effectsList-${track.id}`);
                    const controlsContainer = effectsRackElement.querySelector(`#effectControlsContainer-${track.id}`);
                    if (listDiv && controlsContainer) renderEffectsList(track, 'track', listDiv, controlsContainer);
                 }
                break;
            case 'samplerLoaded':
            case 'instrumentSamplerLoaded':
                if (inspectorElement) {
                    if (track.type === 'Sampler' && typeof drawWaveform === 'function' && typeof renderSamplePads === 'function' && typeof updateSliceEditorUI === 'function') {
                        drawWaveform(track); renderSamplePads(track); updateSliceEditorUI(track);
                    } else if (track.type === 'InstrumentSampler' && typeof drawInstrumentWaveform === 'function') {
                        drawInstrumentWaveform(track);
                    }
                    const dzContainerId = track.type === 'Sampler' ? `#dropZoneContainer-${track.id}-sampler` : `#dropZoneContainer-${track.id}-instrumentsampler`;
                    const dzContainer = inspectorElement.querySelector(dzContainerId);
                    if(dzContainer) {
                        const audioData = track.type === 'Sampler' ? track.samplerAudioData : track.instrumentSamplerSettings;
                        const inputId = track.type === 'Sampler' ? `fileInput-${track.id}` : `instrumentFileInput-${track.id}`;
                        dzContainer.innerHTML = createDropZoneHTML(track.id, inputId, track.type, null, {originalFileName: audioData?.fileName, status: 'loaded'});
                        const fileInputEl = dzContainer.querySelector(`#${inputId}`);
                        const loadFn = appServices.loadSampleFile;
                        if (fileInputEl && loadFn) fileInputEl.onchange = (e) => loadFn(e, track.id, track.type);
                        const newDropZoneDiv = dzContainer.querySelector('.drop-zone');
                        if (newDropZoneDiv && typeof setupGenericDropZoneListeners === 'function') {
                            setupGenericDropZoneListeners(newDropZoneDiv, track.id, track.type, null, appServices.loadSoundFromBrowserToTarget, loadFn, appServices.getTrackById);
                        }
                    }
                }
                break;
            case 'drumPadLoaded':
                 if (inspectorElement && typeof updateDrumPadControlsUI === 'function' && typeof renderDrumSamplerPads === 'function') {
                    updateDrumPadControlsUI(track); renderDrumSamplerPads(track);
                 }
                break;
            case 'sequencerContentChanged':
                if (sequencerElement && typeof openTrackSequencerWindow === 'function') {
                    const seqWinInstance = getWindowByIdState(`sequencerWin-${trackId}`);
                    if(seqWinInstance) openTrackSequencerWindow(trackId, true, seqWinInstance.options);
                }
                if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') appServices.renderTimeline();
                break;
            case 'sampleLoadError':
                if (inspectorElement) {
                    console.warn(`[Main UI Update] sampleLoadError for track ${trackId}, detail: ${detail}. Inspector UI update for dropzone needed.`);
                    if (track.type === 'DrumSampler' && typeof detail === 'number' && typeof updateDrumPadControlsUI === 'function') {
                        updateDrumPadControlsUI(track); 
                    } else if ((track.type === 'Sampler' || track.type === 'InstrumentSampler')) {
                        const dzKey = track.type === 'Sampler' ? 'sampler' : 'instrumentsampler';
                        const dzContainer = inspectorElement.querySelector(`#dropZoneContainer-${track.id}-${dzKey}`);
                        const audioDataSource = track.type === 'Sampler' ? track.samplerAudioData : track.instrumentSamplerSettings;
                        const inputIdForError = track.type === 'Sampler' ? `fileInput-${track.id}` : `instrumentFileInput-${track.id}`;

                        if(dzContainer && audioDataSource) {
                            dzContainer.innerHTML = createDropZoneHTML(track.id, inputIdForError, track.type, null, {originalFileName: audioDataSource.fileName, status: 'error'});
                            const fileInputEl = dzContainer.querySelector(`#${inputIdForError}`);
                            const loadFn = appServices.loadSampleFile;
                            if (fileInputEl && loadFn) fileInputEl.onchange = (e) => loadFn(e, track.id, track.type);
                            const newDropZoneDiv = dzContainer.querySelector('.drop-zone');
                            if (newDropZoneDiv && typeof setupGenericDropZoneListeners === 'function') {
                               setupGenericDropZoneListeners(newDropZoneDiv, track.id, track.type, null, appServices.loadSoundFromBrowserToTarget, loadFn, appServices.getTrackById);
                            }
                        }
                    }
                }
                break;
            default:
                console.warn(`[Main UI Update] Unhandled reason: ${reason} for track ${trackId}`);
        }
    } catch (error) {
        console.error(`[Main handleTrackUIUpdate] Error updating UI for track ${trackId}, reason ${reason}:`, error);
    }
}

async function initializeSnugOS() {
    console.log("[Main initializeSnugOS] Initializing SnugOS...");

    try {
        // Cache UI elements - including the fixed global controls bar
        Object.keys(uiElementsCache).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                 uiElementsCache[key] = element;
            } else {
                if (['desktop', 'taskbar', 'notification-area', 'modalContainer'].includes(key)) {
                    console.warn(`[Main initializeSnugOS] Critical UI Element ID "${key}" not found in DOM.`);
                }
            }
        });

        // The global controls are now in a fixed bar, not a window
        // Wire them up directly
        const globalElements = {
            playBtnGlobal: document.getElementById('playBtnGlobal'),
            recordBtnGlobal: document.getElementById('recordBtnGlobal'),
            stopBtnGlobal: document.getElementById('stopBtnGlobal'),
            tempoGlobalInput: document.getElementById('tempoGlobalInput'),
            midiInputSelectGlobal: document.getElementById('midiInputSelectGlobal'),
            masterMeterContainerGlobal: document.getElementById('masterMeterContainerGlobal'),
            masterMeterBarGlobal: document.getElementById('masterMeterBarGlobal'),
            midiIndicatorGlobal: document.getElementById('midiIndicatorGlobal'),
            keyboardIndicatorGlobal: document.getElementById('keyboardIndicatorGlobal'),
            shortcutsBtnGlobal: document.getElementById('shortcutsBtnGlobal'),
            playbackModeToggleBtnGlobal: document.getElementById('playbackModeToggleBtnGlobal'),
            metronomeBtnGlobal: document.getElementById('metronomeToggleBtnGlobal')
        };
        
        // Add to cache
        Object.assign(uiElementsCache, globalElements);
        
        console.log("[Main initializeSnugOS] Global controls bar elements cached:", Object.keys(globalElements).filter(k => globalElements[k]));

        try {
            const effectsRegistry = await import('./effectsRegistry.js');
            if (appServices.effectsRegistryAccess) {
                appServices.effectsRegistryAccess.AVAILABLE_EFFECTS = effectsRegistry.AVAILABLE_EFFECTS || {};
                appServices.effectsRegistryAccess.getEffectParamDefinitions = effectsRegistry.getEffectParamDefinitions || (() => []);
                appServices.effectsRegistryAccess.getEffectDefaultParams = effectsRegistry.getEffectDefaultParams || (() => ({}));
                appServices.effectsRegistryAccess.synthEngineControlDefinitions = effectsRegistry.synthEngineControlDefinitions || {};
                console.log("[Main initializeSnugOS] Effects registry dynamically imported and assigned.");
            } else {
                console.error("[Main initializeSnugOS] appServices.effectsRegistryAccess is not defined before assigning registry.");
            }
        } catch (registryError) {
            console.error("[Main initializeSnugOS] Failed to import effectsRegistry.js:", registryError);
            showSafeNotification("Critical error: Failed to load audio effects definitions.", 5000);
        }

        if (uiElementsCache.customBgInput) {
            uiElementsCache.customBgInput.addEventListener('change', handleCustomBackgroundUpload);
        }
        
        // Playback mode toggle button handler
        // Try multiple times to attach the handler since DOM might not be ready
        const attachPlaybackModeHandler = () => {
            if (uiElementsCache.playbackModeToggleBtnGlobal) {
                uiElementsCache.playbackModeToggleBtnGlobal.addEventListener('click', () => {
                    const currentMode = getPlaybackModeState ? getPlaybackModeState() : 'sequencer';
                    const newMode = currentMode === 'sequencer' ? 'timeline' : 'sequencer';
                    console.log("[Main] Playback mode toggle clicked, switching to:", newMode);
                    if (typeof setPlaybackModeState === 'function') {
                        setPlaybackModeState(newMode);
                    }
                });
                console.log("[Main] Playback mode toggle handler attached");
            } else {
                console.warn("[Main] Playback mode toggle button not found in cache, retrying...");
                setTimeout(attachPlaybackModeHandler, 500);
            }
        };
        attachPlaybackModeHandler();

        // Metronome toggle button handler
        const attachMetronomeHandler = () => {
            if (uiElementsCache.metronomeBtnGlobal) {
                uiElementsCache.metronomeBtnGlobal.addEventListener('click', async () => {
                    const audioReady = await initAudioContextAndMasterMeter(true);
                    if (!audioReady) {
                        showSafeNotification("Audio not ready. Click the page first.", 2000);
                        return;
                    }
                    const newState = !isMetronomeEnabled();
                    setMetronomeEnabled(newState);
                    uiElementsCache.metronomeBtnGlobal.classList.toggle('active', newState);
                    showSafeNotification(newState ? "Metronome ON" : "Metronome OFF", 1500);
                });
                // Sync button state in case it's already active
                uiElementsCache.metronomeBtnGlobal.classList.toggle('active', isMetronomeEnabled());
                console.log("[Main] Metronome toggle handler attached");
            } else {
                console.warn("[Main] Metronome button not found in cache, retrying...");
                setTimeout(attachMetronomeHandler, 500);
            }
        };
        attachMetronomeHandler();

        // Count-in select dropdown handler
        const attachCountInHandler = () => {
            const countInSelect = document.getElementById('countInSelectGlobal');
            if (countInSelect) {
                countInSelect.addEventListener('change', (e) => {
                    const bars = parseInt(e.target.value, 10);
                    if (typeof setCountInBars === 'function') {
                        setCountInBars(bars);
                        console.log(`[Main] Count-in set to ${bars} bar(s)`);
                    }
                });
                console.log("[Main] Count-in dropdown handler attached");
            } else {
                console.warn("[Main] Count-in select not found in DOM, retrying...");
                setTimeout(attachCountInHandler, 500);
            }
        };
        attachCountInHandler();

        // Restore saved background (image or video)
        await restoreDesktopBackground();

        if (typeof initializeStateModule === 'function') initializeStateModule(appServices); else console.error("initializeStateModule is not a function");
        if (typeof initializeUIModule === 'function') initializeUIModule(appServices); else console.error("initializeUIModule is not a function");
        if (typeof initializeAudioModule === 'function') initializeAudioModule(appServices); else console.error("initializeAudioModule is not a function");
        if (typeof initializeEventHandlersModule === 'function') initializeEventHandlersModule(appServices); else console.error("initializeEventHandlersModule is not a function");

        if (typeof initializePrimaryEventListeners === 'function') {
             initializePrimaryEventListeners(appServices);
        } else { console.error("initializePrimaryEventListeners is not a function");}

        // Attach global controls event listeners directly to the fixed bar
        if (typeof attachGlobalControlEvents === 'function') {
            attachGlobalControlEvents(globalElements);
        } else {
            console.error("attachGlobalControlEvents is not a function");
        }
        
        if (typeof setupMIDI === 'function') setupMIDI(); else console.error("setupMIDI is not a function");

        if (Constants.soundLibraries && typeof fetchSoundLibrary === 'function') {
            Object.entries(Constants.soundLibraries).forEach(([name, url]) => fetchSoundLibrary(name, url, true)); 
        }

        if (appServices.openTimelineWindow && typeof appServices.openTimelineWindow === 'function') {
            appServices.openTimelineWindow();
        } else { console.warn("appServices.openTimelineWindow not available to open by default."); }

        requestAnimationFrame(updateMetersLoop);
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI(null, null);
        if (appServices.onPlaybackModeChange && typeof getPlaybackModeState === 'function') {
            appServices.onPlaybackModeChange(getPlaybackModeState());
        }

        showSafeNotification(`Welcome to SnugOS ${Constants.APP_VERSION}!`, 2500);
        console.log(`[Main initializeSnugOS] SnugOS Version ${Constants.APP_VERSION} Initialized.`);

    } catch (initError) {
        console.error("CRITICAL ERROR during SnugOS Initialization:", initError);
        showSafeNotification("A critical error occurred during application startup. Please refresh.", 7000);
        const body = document.body;
        if (body) {
            body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif; color: #ccc; background-color: #101010; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1>Initialization Error</h1><p>SnugOS could not start due to a critical error. Please check the console for details and try refreshing the page.</p><p style="font-size: 0.8em; margin-top: 20px;">Error: ${initError.message}</p></div>`;
        }
    }
}

function updateMetersLoop() {
    try {
        if (typeof updateMeters === 'function') {
            const mixerWindow = getWindowByIdState ? getWindowByIdState('mixer') : null;
            const mixerMasterMeterBar = mixerWindow?.element && !mixerWindow.isMinimized ? mixerWindow.element.querySelector('#mixerMasterMeterBar') : null;
            const tracks = getTracksState ? getTracksState() : [];
            updateMeters(uiElementsCache.masterMeterBarGlobal, mixerMasterMeterBar, tracks);
        }
        if (typeof updatePlayheadPosition === 'function') {
            updatePlayheadPosition();
        }
    } catch (loopError) {
        console.warn("[Main updateMetersLoop] Error in UI update loop:", loopError);
    }
    requestAnimationFrame(updateMetersLoop);
}

function applyDesktopBackground(sourceUrl, bgType = 'image') {
    const desktop = uiElementsCache.desktop;
    const videoBg = document.getElementById('desktopVideoBg');
    
    if (!desktop) {
        console.warn("Desktop element not found in cache for applying background.");
        return;
    }
    
    try {
        // Reset both image and video backgrounds
        desktop.style.backgroundImage = '';
        if (videoBg) {
            videoBg.style.display = 'none';
            videoBg.pause();
            videoBg.src = '';
        }
        
        if (bgType === 'image' && sourceUrl) {
            // Image background
            desktop.style.backgroundImage = `url('${sourceUrl}')`;
            desktop.style.backgroundSize = 'cover';
            desktop.style.backgroundPosition = 'center center';
            desktop.style.backgroundRepeat = 'no-repeat';
            desktop.style.backgroundColor = '';
        } else if (bgType === 'video' && sourceUrl && videoBg) {
            // Video background
            videoBg.src = sourceUrl;
            videoBg.style.display = 'block';
            videoBg.play().catch(e => console.warn("Video autoplay prevented:", e));
            desktop.style.backgroundColor = '';
        } else {
            // No background - use default
            desktop.style.backgroundColor = Constants.defaultDesktopBg || '#101010';
        }
    } catch (e) {
        console.error("Error applying desktop background style:", e);
    }
}

// Restore background on load
async function restoreDesktopBackground() {
    const bgType = localStorage.getItem(DESKTOP_BG_TYPE_KEY);
    
    if (bgType === 'video') {
        try {
            const videoBlob = await bgDb.get('desktopVideo');
            if (videoBlob) {
                const objectUrl = URL.createObjectURL(videoBlob);
                applyDesktopBackground(objectUrl, 'video');
                console.log("[Main] Restored video background from IndexedDB");
            }
        } catch (e) {
            console.warn("Could not restore video background:", e);
        }
    } else if (bgType === 'image' || !bgType) {
        const imageUrl = localStorage.getItem(DESKTOP_BACKGROUND_KEY);
        if (imageUrl) {
            applyDesktopBackground(imageUrl, 'image');
        }
    }
}


// --- Global Event Listeners ---
window.addEventListener('load', initializeSnugOS);
window.addEventListener('beforeunload', (e) => {
    const tracksExist = getTracksState && getTracksState().length > 0;
    const undoStackExists = getUndoStackState && getUndoStackState().length > 0;

    if (tracksExist || undoStackExists) {
        e.preventDefault(); 
        e.returnValue = ''; 
        return "You have unsaved changes. Are you sure you want to leave?"; 
    }
});

console.log(`SCRIPT EXECUTION FINISHED - SnugOS (main.js - Version ${Constants.APP_VERSION})`);
