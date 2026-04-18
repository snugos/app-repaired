// js/main.js - Main Application Logic Orchestrator

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
// setupGenericDropZoneListeners is imported here but used via appServices by ui.js
import { showNotification as utilShowNotification, createContextMenu, createDropZoneHTML, setupGenericDropZoneListeners, showConfirmationDialog } from './utils.js';
import { getActualMasterGainNode, getMasterEffectsBusInputNode, writeMasterVolumeAutomation, getMasterVolumeAutomation, setMasterVolumeAutomation, startContextSuspensionMonitoring } from './audio.js';
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
    loadProjectInternal, handleProjectFileLoadInternal, exportToWavInternal, exportStemsInternal,
    // Auto-save
    startAutoSave, stopAutoSave, autoSaveToLocalStorage, recoverAutoSavedProject, hasAutoSavedProject, getAutoSavedProjectTimestamp, clearAutoSavedProject,
    // Auto-save
    autoSaveNow: autoSaveToLocalStorage,
    clearAutoSave: clearAutoSavedProject,
    hasAutoSavedProject: hasAutoSavedProject,
    getAutoSavedTimestamp: getAutoSavedProjectTimestamp,
    // Sound Browser Favorites & Recent
    getFavoriteSounds,
    isFavorite,
    addToRecentlyPlayed,
    getRecentlyPlayedSounds,
    clearRecentlyPlayed,
    // Loop Region
    setLoopRegion, setLoopRegionEnabled, isLoopRegionEnabled, getLoopStartBars, getLoopEndBars,
    // Project Name
    getProjectNameState, setProjectNameState,
    // Synth Presets
    getSynthPresets, saveSynthPreset, deleteSynthPreset,
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

            if (!((appServices.effectsRegistryAccess) && (appServices.effectsRegistryAccess).getEffectDefaultParams)) {
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
    setActualMasterVolume: (volumeValue, fromInteraction = false) => {
        if (typeof getActualMasterGainNode === 'function') {
            const actualMasterNode = getActualMasterGainNode();
            if (actualMasterNode && actualMasterNode.gain && typeof actualMasterNode.gain.setValueAtTime === 'function') {
                try {
                    actualMasterNode.gain.setValueAtTime(volumeValue, Tone.now());
                } catch (e) { console.error("Error setting master volume via Tone:", e); }
            } else { console.warn("Master gain node or its gain property not available."); }
        } else { console.warn("getActualMasterGainNode not available."); }
        // Record master volume automation when user interacts with the knob
        if (fromInteraction && appServices.masterAutomationArmed) {
            const timeInSeconds = Tone.Transport.seconds;
            writeMasterVolumeAutomation(timeInSeconds, volumeValue);
            console.log(`[Main] Master volume automation recorded at time ${timeInSeconds.toFixed(3)}s, value ${volumeValue.toFixed(3)}`);
        }
    },
    getMasterEffectsBus: () => {
        if (typeof getMasterEffectsBusInputNode === 'function') {
            return getMasterEffectsBusInputNode();
        } else {
            console.warn("getMasterEffectsBusInputNode not available.");
            return null;
        }
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
            if (((inspectorWindow) && (inspectorWindow).element) && !inspectorWindow.isMinimized) {
                const meterBar = inspectorWindow.element.querySelector(`#trackMeterBar-${trackId}`);
                if (meterBar) {
                    meterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                    meterBar.classList.toggle('clipping', isClipping);
                }
            }
            if (((mixerWindow) && (mixerWindow).element) && !mixerWindow.isMinimized) {
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
            if (((masterRackWindow) && (masterRackWindow).element) && !masterRackWindow.isMinimized && typeof renderEffectsList === 'function') {
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
        if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') appServices.renderTimeline();
    },
    updateProjectNameDisplay: (name) => {
        if (uiElementsCache.projectNameBtnGlobal) {
            uiElementsCache.projectNameBtnGlobal.textContent = name || 'Untitled Project';
        }
    },
    renameTrackInState,

    // Punch-in/out recording scheduling
    scheduleRecordingForPunch,
    cancelScheduledRecording,
    cleanupRecordingScheduling,
    exportToWav: exportToWavInternal,
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
        return (((win) && (win).element) && !win.isMinimized) ? win.element : null;
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
                        dzContainer.innerHTML = createDropZoneHTML(track.id, inputId, track.type, null, {originalFileName: ((audioData) && (audioData).fileName), status: 'loaded'});
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
                if (['desktop', 'taskbar', 'notification-area', 'modal-container'].includes(key)) {
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
            metronomeBtnGlobal: document.getElementById('metronomeToggleBtnGlobal'),
            loopToggleBtnGlobal: document.getElementById('loopToggleBtnGlobal'),
            loopStartInputGlobal: document.getElementById('loopStartInputGlobal'),
            loopEndInputGlobal: document.getElementById('loopEndInputGlobal'),
            punchToggleBtnGlobal: document.getElementById('punchToggleBtnGlobal'),
            punchInInputGlobal: document.getElementById('punchInInputGlobal'),
            punchOutInputGlobal: document.getElementById('punchOutInputGlobal'),
            projectNameBtnGlobal: document.getElementById('projectNameBtnGlobal')
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

        // Tap tempo button handler
        const attachTapTempoHandler = () => {
            const tapBtn = document.getElementById('tapTempoBtnGlobal');
            const tempoInput = document.getElementById('tempoGlobalInput');
            if (tapBtn && tempoInput) {
                tapBtn.addEventListener('click', () => {
                    tapTempo();
                    const bpm = getTapTempoBpm();
                    if (bpm !== null) {
                        Tone.Transport.bpm.value = bpm;
                        tempoInput.value = bpm;
                        if (appServices.updateTaskbarTempoDisplay) appServices.updateTaskbarTempoDisplay(bpm);
                        showSafeNotification(`Tempo: ${bpm} BPM`, 800);
                    } else {
                        showSafeNotification("Keep tapping...", 500);
                    }
                });
                console.log("[Main] Tap tempo handler attached");
            } else {
                console.warn("[Main] Tap tempo button or tempo input not found, retrying...");
                setTimeout(attachTapTempoHandler, 500);
            }
        };
        attachTapTempoHandler();

        // Snap Grid toggle button handler
        const attachSnapToggleHandler = () => {
            const snapToggleBtn = document.getElementById('snapToggleBtnGlobal');
            if (snapToggleBtn) {
                const updateSnapButtonUI = () => {
                    const currentSnap = window.SEQUENCER_SNAP_VALUE || 16;
                    const snapLabel = currentSnap === 0 ? 'Off' : (currentSnap === 4 ? '1/4' : (currentSnap === 8 ? '1/8' : '1/16'));
                    snapToggleBtn.textContent = `Snap: ${snapLabel}`;
                    snapToggleBtn.classList.toggle('snap-active', currentSnap !== 0);
                };
                snapToggleBtn.addEventListener('click', () => {
                    const currentSnap = window.SEQUENCER_SNAP_VALUE || 16;
                    let nextSnap = 16;
                    if (currentSnap === 16) nextSnap = 8;
                    else if (currentSnap === 8) nextSnap = 4;
                    else if (currentSnap === 4) nextSnap = 0;
                    else if (currentSnap === 0) nextSnap = 16;
                    window.SEQUENCER_SNAP_VALUE = nextSnap;
                    updateSnapButtonUI();
                    const snapLabel = nextSnap === 0 ? 'Off' : (nextSnap === 4 ? '1/4' : (nextSnap === 8 ? '1/8' : '1/16'));
                    showSafeNotification(`Snap: ${snapLabel}`, 1500);
                });
                updateSnapButtonUI();
                console.log("[Main] Snap toggle handler attached");
            } else {
                console.warn("[Main] Snap toggle button not found, retrying...");
                setTimeout(attachSnapToggleHandler, 500);
            }
        };
        attachSnapToggleHandler();

        // Loop Region toggle button handler
        const attachLoopRegionHandler = () => {
            const loopToggleBtn = uiElementsCache.loopToggleBtnGlobal;
            const loopStartInput = uiElementsCache.loopStartInputGlobal;
            const loopEndInput = uiElementsCache.loopEndInputGlobal;
            if (loopToggleBtn && loopStartInput && loopEndInput) {
                loopToggleBtn.addEventListener('click', () => {
                    const newEnabled = !isLoopRegionEnabled();
                    setLoopRegionEnabled(newEnabled);
                    loopToggleBtn.classList.toggle('loop-active', newEnabled);
                    showSafeNotification(newEnabled ? "Loop ON" : "Loop OFF", 1500);
                });
                // Sync button state
                loopToggleBtn.classList.toggle('loop-active', isLoopRegionEnabled());

                loopStartInput.addEventListener('change', (e) => {
                    const startBars = parseInt(e.target.value, 10) || 0;
                    const endBars = parseInt(loopEndInput.value, 10) || 16;
                    if (setLoopRegion(startBars, endBars)) {
                        if (isLoopRegionEnabled()) {
                            Tone.Transport.loopStart = `${startBars}:0:0`;
                            Tone.Transport.loopEnd = `${endBars}:0:0`;
                        }
                        showSafeNotification(`Loop: ${startBars} - ${endBars} bars`, 1000);
                    }
                });

                loopEndInput.addEventListener('change', (e) => {
                    const startBars = parseInt(loopStartInput.value, 10) || 0;
                    const endBars = parseInt(e.target.value, 10) || 16;
                    if (setLoopRegion(startBars, endBars)) {
                        if (isLoopRegionEnabled()) {
                            Tone.Transport.loopStart = `${startBars}:0:0`;
                            Tone.Transport.loopEnd = `${endBars}:0:0`;
                        }
                        showSafeNotification(`Loop: ${startBars} - ${endBars} bars`, 1000);
                    }
                });

                console.log("[Main] Loop region handlers attached");
            } else {
                console.warn("[Main] Loop region elements not found in cache, retrying...");
                setTimeout(attachLoopRegionHandler, 500);
            }
        };
        attachLoopRegionHandler();

        // Punch In/Out toggle button handler
        const attachPunchRegionHandler = () => {
            const punchToggleBtn = uiElementsCache.punchToggleBtnGlobal;
            const punchInInput = uiElementsCache.punchInInputGlobal;
            const punchOutInput = uiElementsCache.punchOutInputGlobal;
            if (punchToggleBtn && punchInInput && punchOutInput) {
                punchToggleBtn.addEventListener('click', () => {
                    const newEnabled = !isPunchRegionEnabled();
                    setPunchRegionEnabled(newEnabled);
                    punchToggleBtn.classList.toggle('punch-active', newEnabled);
                    showSafeNotification(newEnabled ? "Punch In/Out ON" : "Punch In/Out OFF", 1500);
                });
                punchToggleBtn.classList.toggle('punch-active', isPunchRegionEnabled());

                punchInInput.addEventListener('change', (e) => {
                    const inBars = parseInt(e.target.value, 10) || 0;
                    const outBars = parseInt(punchOutInput.value, 10) || 16;
                    if (setPunchRegion(inBars, outBars)) {
                        showSafeNotification(`Punch: ${inBars} - ${outBars} bars`, 1000);
                    }
                });

                punchOutInput.addEventListener('change', (e) => {
                    const inBars = parseInt(punchInInput.value, 10) || 0;
                    const outBars = parseInt(e.target.value, 10) || 16;
                    if (setPunchRegion(inBars, outBars)) {
                        showSafeNotification(`Punch: ${inBars} - ${outBars} bars`, 1000);
                    }
                });

                console.log("[Main] Punch region handlers attached");
            } else {
                console.warn("[Main] Punch region elements not found in cache, retrying...");
                setTimeout(attachPunchRegionHandler, 500);
            }
        };
        attachPunchRegionHandler();

        // Project name button handler - click to rename
        const attachProjectNameHandler = () => {
            const projectNameBtn = uiElementsCache.projectNameBtnGlobal;
            if (projectNameBtn) {
                projectNameBtn.addEventListener('click', () => {
                    const currentName = getProjectNameState ? getProjectNameState() : 'Untitled Project';
                    const newName = prompt('Enter project name:', currentName);
                    if (newName !== null && newName.trim()) {
                        const trimmedName = newName.trim();
                        if (typeof setProjectNameState === 'function') {
                            setProjectNameState(trimmedName);
                        }
                        projectNameBtn.textContent = trimmedName;
                        projectNameBtn.title = 'Rename Project';
                        showSafeNotification(`Project renamed to "${trimmedName}"`, 1500);
                    }
                });
                console.log("[Main] Project name handler attached");
            } else {
                console.warn("[Main] Project name button not found in cache, retrying...");
                setTimeout(attachProjectNameHandler, 500);
            }
        };
        attachProjectNameHandler();

        if (typeof initializeStateModule === 'function') initializeStateModule(appServices); else console.error("initializeStateModule is not a function");
        if (typeof initializeUIModule === 'function') initializeUIModule(appServices); else console.error("initializeUIModule is not a function");
        if (typeof initializeAudioModule === 'function') initializeAudioModule(appServices); else console.error("initializeAudioModule is not a function");
        // Start context suspension monitoring for auto-recovery after browser tab inactivity
        if (typeof startContextSuspensionMonitoring === 'function') startContextSuspensionMonitoring(3000);

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

        // --- Auto-Save & Recovery ---
        if (typeof startAutoSave === 'function') {
            startAutoSave();
        }
        if (typeof hasAutoSavedProject === 'function' && hasAutoSavedProject()) {
            const timestamp = typeof getAutoSavedProjectTimestamp === 'function' ? getAutoSavedProjectTimestamp() : null;
            const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : 'unknown';
            if (typeof showConfirmationDialog === 'function') {
                showConfirmationDialog(
                    'Recover Project?',
                    `An auto-saved project was found from ${timeStr}. Would you like to recover it?`,
                    async () => {
                        // User clicked Recover
                        try {
                            const audioReady = await initAudioContextAndMasterMeter(false);
                            if (!audioReady) {
                                showSafeNotification("Audio not ready. Click the page first to recover.", 3000);
                                return;
                            }
                            const savedProject = typeof recoverAutoSavedProject === 'function' ? await recoverAutoSavedProject() : null;
                            if (savedProject) {
                                appServices._isReconstructingDAW_flag = true;
                                await reconstructDAWInternal(savedProject, false);
                                appServices._isReconstructingDAW_flag = false;
                                showSafeNotification("Project recovered from auto-save!", 3000);
                                console.log("[Main] Auto-saved project recovered successfully");
                            } else {
                                showSafeNotification("Could not load auto-saved project.", 3000);
                            }
                        } catch (err) {
                            console.error("[Main] Error recovering auto-saved project:", err);
                            showSafeNotification("Error recovering project.", 3000);
                        }
                    },
                    () => {
                        // User clicked Dismiss - just keep current session
                        if (typeof clearAutoSavedProject === 'function') clearAutoSavedProject();
                        showSafeNotification("Auto-save dismissed. Current session kept.", 2000);
                    }
                );
            }
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
    const now = performance.now();
    const THROTTLE_MS = 33; // ~30fps
    if (!updateMetersLoop._lastMeterUpdateTime) updateMetersLoop._lastMeterUpdateTime = 0;

    if (now - updateMetersLoop._lastMeterUpdateTime >= THROTTLE_MS) {
        updateMetersLoop._lastMeterUpdateTime = now;
        try {
            if (typeof updateMeters === 'function') {
                const mixerWindow = getWindowByIdState ? getWindowByIdState('mixer') : null;
                const mixerMasterMeterBar = ((mixerWindow) && (mixerWindow).element) && !mixerWindow.isMinimized ? mixerWindow.element.querySelector('#mixerMasterMeterBar') : null;
                const tracks = getTracksState ? getTracksState() : [];
                updateMeters(uiElementsCache.masterMeterBarGlobal, mixerMasterMeterBar, tracks);
            }
            if (typeof updatePlayheadPosition === 'function') {
                updatePlayheadPosition();
            }
        } catch (loopError) {
            console.warn("[Main updateMetersLoop] Error in UI update loop:", loopError);
        }
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
