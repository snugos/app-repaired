// js/main.js - Main Application Logic Orchestrator

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
import { AICompositionAssistant, openAICompositionPanel } from './AICompositionAssistant.js';
import { DrumPatternGenerator, initDrumPatternGenerator, getDrumGenerator, generateDrumPattern, DRUM_STYLES, COMPLEXITY_LEVELS as DRUM_COMPLEXITY_LEVELS } from './DrumPatternGenerator.js';
import { MelodyGenerator, initMelodyGenerator, getMelodyGenerator, generateMelody, MELODY_STYLES, MELODY_MOODS } from './MelodyGenerator.js';
import { initQuickActionsMenu, openQuickActionsMenu, closeQuickActionsMenu } from './QuickActionsMenu.js';
import { initTimelineMarkers, openTimelineMarkersPanel } from './TimelineMarkers.js';
import { initPlayheadMarkerDrop, openPlayheadMarkerDropSettings } from './PlayheadMarkerDrop.js';
import { AIMasteringEnhancement, initAIMasteringEnhancement, openAIMasteringEnhancementPanel } from './AIMasteringEnhancement.js';
import { AudioStemExportEnhancement, initAudioStemExportEnhancement, openAudioStemExportEnhancementPanel } from './AudioStemExportEnhancement.js';
import { MIDIPatternVariationEnhancement, initMIDIPatternVariationEnhancement, openMIDIPatternVariationEnhancementPanel } from './MIDIPatternVariationEnhancement.js';
import { PluginPresetBrowser, initPluginPresetBrowser, openPluginPresetBrowserPanel } from './PluginPresetBrowser.js';
import { initVideoExportEnhancement, openVideoExportPanel } from './VideoExportEnhancement.js';
import { initCloudSyncEnhancement, openCloudSyncPanel } from './CloudSyncEnhancement.js';
import { initNotationExportEnhancement, openNotationExportPanel } from './NotationExportEnhancement.js';
import { initAudioRestorationSuite, openAudioRestorationPanel } from './AudioRestorationSuite.js';
import { initMIDIGuitarSupport, openMIDIGuitarPanel } from './MIDIGuitarSupport.js';
import { initSpatialAudioPanning, openSpatialAudioPanel } from './SpatialAudioPanning.js';
import { CollaborationSessionRecording, collaborationSessionRecording, initCollaborationSessionRecording, openCollaborationSessionPanel } from './CollaborationSessionRecording.js';
import { AIMixingSuggestions, aiMixingSuggestions, initAIMixingSuggestions, openAICompositionPanel } from './AIMixingSuggestions.js';
import { AITempoSuggestion, initAITempoSuggestion, openAITempoSuggestionPanel } from './AITempoSuggestion.js';
import { FrequencySpectrumMatching, frequencySpectrumMatching, initFrequencySpectrumMatching, openFrequencySpectrumMatchingPanel } from './FrequencySpectrumMatching.js';
import { SmartTrackGrouping, smartTrackGrouping, initSmartTrackGrouping, openSmartTrackGroupingPanel } from './SmartTrackGrouping.js';
import { AudioEventDetection, audioEventDetection, initAudioEventDetection, openAudioEventDetectionPanel } from './AudioEventDetection.js';
import { CrossTrackPitchAnalysis, crossTrackPitchAnalysis, initCrossTrackPitchAnalysis, openCrossTrackPitchAnalysisPanel } from './CrossTrackPitchAnalysis.js';
// New Feature Modules - Session 2026-04-24
import { AICompositionVariations } from './AICompositionVariations.js';
import { HarmonicAnalysisEngine } from './HarmonicAnalysisEngine.js';
import { AudioStemSeparation } from './AudioStemSeparation.js';
import { MIDIToAudioConversion } from './MIDIToAudioConversion.js';
import { SmartFXChain } from './SmartFXChain.js';
import { MidiMonitor } from './MidiMonitor.js';
import { initMIDILearnWizard, openMIDILearnWizard } from './MIDILearnWizard.js';
import { initBulkAssign, startBulkAssign, stopBulkAssign, isBulkAssignActive } from './MIDILearnBulkAssign.js';
import { AudioFingerprinting } from './AudioFingerprinting.js';
import { initAudioTapTempo } from './AudioTapTempo.js';
import { initAudioNormalizer, openAudioNormalizerPanel } from './AudioNormalizer.js';
import { initAutoScrollSync, toggleAutoScroll, autoScrollTimeline } from './AutoScrollSync.js';
import { initProjectRecoveryManager, createManualBackup, listBackups, restoreBackup, setRecoveryEnabled, getRecoveryStatus } from './ProjectRecoveryManager.js';
// Pattern Generation & Frequency Processing
import { AIPatternGenerator, getAIPatternGenerator, openAIPatternGeneratorPanel } from './AIPatternGenerator.js';
import { FrequencyBandSplitter, MultibandProcessor, getFrequencyBandSplitter, openFrequencyBandSplitterPanel } from './FrequencyBandSplitter.js';
// Performance & Workflow - Session 2026-04-26
import { openPerformanceTriggerPadsPanel, getPerformanceTriggerPads } from './PerformanceTriggerPads.js';
import { initTrackHeadphoneMix, openTrackHeadphoneMixPanel } from './TrackHeadphoneMix.js';
import { openStepSequencerView } from './StepSequencerView.js';
import { openPianoRollEditor, initPianoRollEditor } from './PianoRollEditor.js';
import { initScaleHighlightMode, openScaleHighlightPanel, isNoteInScale, getNoteScaleClass, quantizeNoteToScale } from './ScaleHighlightMode.js';
import { initAudioRecorder, startRecording, stopRecording, isRecordingActive, requestMicAccess, getRecordingStatus, cleanupRecording } from './AudioRecorder.js';
import { initClipContextMenu } from './ClipContextMenu.js';
import { initTrackContextMenu } from './TrackContextMenu.js';
import { initTrackLaneResize } from './TrackLaneResize.js';
import { initPerformanceMonitor, initPerformanceIndicator, openPerformancePanel, closePerformancePanel, getPerformanceSnapshot } from './PerformanceMonitor.js';
import { initUndoHistoryPanel, openUndoHistoryPanel } from './UndoHistoryPanel.js';
import { initSpectrumAnalyzer, openSpectrumAnalyzerPanel } from './SpectrumAnalyzer.js';
import { initBeatSyncedLFOPanel, openBeatSyncedLFOPanel } from './BeatSyncedLFOPanel.js';
// Effect panel imports - Session 2026-04-24
import { openTubeSaturationPanel } from './DynamicTubeSaturation.js';
import { openMultibandGatePanel } from './MultibandGate.js';
import { openTransientModulatorPanel } from './TransientModulator.js';
import { openStereoWidthControllerPanel } from './StereoWidthController.js';
import { openDynamicResonanceFilterPanel } from './DynamicResonanceFilter.js';
import { openVocalDoublerPanel } from './VocalDoubler.js';
import { SpectralCompressor, openSpectralCompressorPanel } from './SpectralCompressor.js';
import { HarmonicSynthesizer, openHarmonicSynthesizerPanel } from './HarmonicSynthesizer.js';
import { DynamicEQ, openDynamicEQPanel } from './DynamicEQ.js';
import { StereoImagerEnhancement, openStereoImagerEnhancementPanel } from './StereoImagerEnhancement.js';
import { MultibandSaturator, openMultibandSaturatorPanel } from './MultibandSaturator.js';
import { AutoPanner, openAutoPannerPanel } from './AutoPanner.js';
import { GranularProcessor, openGranularProcessorPanel } from './GranularProcessor.js';
import { ConvolutionReverb, openConvolutionReverbPanel } from './ConvolutionReverb.js';
import { FormantFilter, openFormantFilterPanel } from './FormantFilter.js';
import { RingModulator, openRingModulatorPanel } from './RingModulator.js';
import { FrequencyShifter, openFrequencyShifterPanel } from './FrequencyShifter.js';
import { EnvelopeGenerator, openEnvelopeGeneratorPanel } from './EnvelopeGenerator.js';
// Status bar display imports
import { initSampleRateDisplay, startSampleRateDisplayLoop } from './SampleRateDisplay.js';
import * as FeatureAdditions from './FeatureAdditions.js';
// setupGenericDropZoneListeners is imported here but used via appServices by ui.js
import { showNotification as utilShowNotification, createContextMenu, createDropZoneHTML, setupGenericDropZoneListeners } from './utils.js';
import { openKeyboardShortcutsPanel } from './ui.js';
import {
    initializeEventHandlersModule, initializePrimaryEventListeners, setupMIDI, attachGlobalControlEvents,
    selectMIDIInput as eventSelectMIDIInput, 
    handleTrackMute as eventHandleTrackMute,
    handleTrackSolo as eventHandleTrackSolo,
    handleTrackSoloExclusive as eventHandleTrackSoloExclusive,
    handleTrackArm as eventHandleTrackArm,
    handleRemoveTrack as eventHandleRemoveTrack,
    handleTrackArchive as eventHandleTrackArchive,
    handleTrackFreeze as eventHandleTrackFreeze,
    handleDuplicateTrack as eventHandleDuplicateTrack,
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
    getMidiOutputDevices, sendMidiNoteOn, sendMidiNoteOff, sendMidiCC, selectMidiOutput, getActiveMidiOutputState,
    getLoadedZipFilesState, getSoundLibraryFileTreesState, getCurrentLibraryNameState,
    getCurrentSoundFileTreeState, getCurrentSoundBrowserPathState, getPreviewPlayerState,
    getClipboardDataState, getAutomationClipboardState, getArmedTrackIdState, getSoloedTrackIdState, isTrackRecordingState,
    getRecordingTrackIdState,
    getActiveSequencerTrackIdState, getUndoStackState, getRedoStackState, getPlaybackModeState,
    // State Setters
    addWindowToStoreState, removeWindowFromStoreState, setHighestZState, incrementHighestZState,
    setMasterEffectsState, setMasterGainValueState,
    setMidiAccessState, setActiveMIDIInputState,
    setLoadedZipFilesState,
    setSoundLibraryFileTreesState,
    setCurrentLibraryNameState, setCurrentSoundFileTreeState, setCurrentSoundBrowserPathState, setPreviewPlayerState,
    setClipboardDataState, setAutomationClipboardState, setArmedTrackIdState, setSoloedTrackIdState, setIsRecordingState,
    setRecordingTrackIdState, setRecordingStartTimeState, setActiveSequencerTrackIdState,
    setPlaybackModeState,
    addMasterEffectToState, removeMasterEffectFromState,
    updateMasterEffectParamInState, reorderMasterEffectInState,
    // MIDI Learn
    getMidiLearnMode, setMidiLearnMode, getMidiLearnTarget, setMidiLearnTarget,
    getMidiMappings, addMidiMapping, removeMidiMapping, getMidiMappingForCC, clearAllMidiMappings,
    // MIDI CC Visualizer
    getCcVisualizerValues, updateCcVisualizerValue,
    // Loop Region
    getLoopRegionEnabled, setLoopRegionEnabled, getLoopRegionStart, setLoopRegionStart, getLoopRegionEnd, setLoopRegionEnd, getLoopRegion,
    // Metronome
    getMetronomeEnabled, setMetronomeEnabled, getMetronomeVolume, setMetronomeVolume,
    // Performance Monitor
    getPerformanceSnapshot, openPerformancePanel,
    // Core State Actions
    addTrackToStateInternal, removeTrackFromStateInternal, reorderTrackInState,
    captureStateForUndoInternal, undoLastActionInternal, redoLastActionInternal,
    gatherProjectDataInternal, reconstructDAWInternal, saveProjectInternal,
    saveProjectTemplate, loadProjectTemplate, getProjectTemplateNames, getProjectTemplate, deleteProjectTemplate,
    
    // Event Handler Passthroughs
    selectMIDIInput: eventSelectMIDIInput, 
    handleTrackMute: eventHandleTrackMute,
    handleTrackSolo: eventHandleTrackSolo,
    handleTrackSoloExclusive: eventHandleTrackSoloExclusive,
    handleTrackArm: eventHandleTrackArm,
    handleRemoveTrack: eventHandleRemoveTrack,
    handleTrackArchive: eventHandleTrackArchive,
    handleTrackFreeze: eventHandleTrackFreeze,
    handleDuplicateTrack: eventHandleDuplicateTrack,
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

    // --- Custom Background Helpers ---
    DESKTOP_BACKGROUND_KEY: 'snugosDesktopBackground',
    DESKTOP_BG_TYPE_KEY: 'snugosDesktopBgType',
    bgDb: {
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
    },

    // MIDI Chord Player Services
    playMidiChord: (trackId, rootNote, octave, chordType, options = {}) => {
        const track = getTrackByIdState(trackId);
        if (!track) return null;
        
        const pattern = Constants.CHORD_PATTERNS[chordType];
        if (!pattern) {
            console.warn(`[MIDIChordPlayer] Unknown chord type: ${chordType}`);
            return null;
        }
        
        const rootSemitone = Constants.MIDI_CHORD_ROOT_NOTES.find(n => n.note === rootNote)?.semitone ?? 0;
        const rootMidi = (octave + 1) * 12 + rootSemitone;
        const notes = pattern.intervals.map(interval => rootMidi + interval);
        
        // Apply inversion if specified
        const inversion = options.inversion || 0;
        let invertedNotes = [...notes];
        if (inversion !== 0) {
            for (let i = 0; i < Math.abs(inversion); i++) {
                if (inversion > 0) {
                    // Move bottom note up an octave
                    const lowest = invertedNotes.shift();
                    invertedNotes.push(lowest + 12);
                } else {
                    // Move top note down an octave
                    const highest = invertedNotes.pop();
                    invertedNotes.unshift(highest - 12);
                }
            }
        }
        
        // Apply voicing
        const voicing = options.voicing || 'close';
        // For now, just use the notes as-is
        const velocity = options.velocity || 0.8;
        
        const now = Tone.now();
        const midiNotes = invertedNotes.map(n => ({
            pitch: n,
            freq: Tone.Frequency(n, 'midi').toFrequency()
        }));
        
        // Play all notes
        midiNotes.forEach(({ pitch, freq }) => {
            if (track.playNote) {
                track.playNote(pitch, now, undefined, velocity);
            } else if (track.instrument?.triggerAttack) {
                track.instrument.triggerAttack(freq, now, velocity);
            }
        });
        
        // Store active notes for later release
        track._activeChordNotes = invertedNotes;
        track._chordPlayerActive = true;
        
        return { notes: invertedNotes.map(n => Tone.Frequency(n, 'midi').toNote()), root: `${rootNote}${octave}` };
    },
    
    stopMidiChord: (trackId) => {
        const track = getTrackByIdState(trackId);
        if (!track || !track._chordPlayerActive) return;
        
        const now = Tone.now();
        const notes = track._activeChordNotes || [];
        
        notes.forEach(pitch => {
            if (track.releaseNote) {
                track.releaseNote(pitch, now);
            } else if (track.instrument?.triggerRelease) {
                const freq = Tone.Frequency(pitch, 'midi').toFrequency();
                track.instrument.triggerRelease(freq, now);
            }
        });
        
        track._chordPlayerActive = false;
        track._activeChordNotes = [];
    },
    
    getMidiChordPlayerSettings: () => {
        return localStorage.getItem('midiChordPlayerSettings') ? 
            JSON.parse(localStorage.getItem('midiChordPlayerSettings')) : 
            { chordType: 'major', inversion: 0, voicing: 'close', octave: 4, velocity: 0.8 };
    },
    
    setMidiChordPlayerSettings: (settings) => {
        localStorage.setItem('midiChordPlayerSettings', JSON.stringify(settings));
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
                
                if (track && track.type === 'Sampler' && track.slicerIsPolyphonic && track.slicerMonoPlayer && track.slicerMonoEnvelope) {
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
    updateTrackColor: (trackId, color) => {
        const track = getTrackByIdState(trackId);
        if (!track) return;
        if (captureStateForUndoInternal) captureStateForUndoInternal(`Change track color to ${color}`);
        track.color = color;
        if (typeof updateMixerWindow === 'function') updateMixerWindow();
        if (typeof renderTimeline === 'function') renderTimeline();
    },
    createWindow: (id, title, content, options) => new SnugWindow(id, title, content, options, appServices),
    openWindowWithContent: (id, title, contentHTML, options) => {
        const win = new SnugWindow(id, title, contentHTML, options, appServices);
        return win;
    },
    uiElementsCache: uiElementsCache, 

    addMasterEffect: async (effectType) => {
        try {
            const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
            if (!isReconstructinging && appServices.captureStateForUndo) appServices.captureStateForUndo(`Add ${effectType} to Master`);

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
            if (!isReconstructinging && appServices.captureStateForUndo) appServices.captureStateForUndo(`Reorder Master effect`);
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

    // --- Custom Background Functions ---
    DESKTOP_BACKGROUND_KEY: 'snugosDesktopBackground',
    DESKTOP_BG_TYPE_KEY: 'snugosDesktopBgType',
    bgDb: {
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
    },

    triggerCustomBackgroundUpload: () => {
        if (uiElementsCache.customBgInput) uiElementsCache.customBgInput.click();
        else console.warn("Custom background input element not found in cache.");
    },
    removeCustomDesktopBackground: async () => {
        try {
            localStorage.removeItem('snugosDesktopBackground');
            localStorage.removeItem('snugosDesktopBgType');
            const db = await bgDb.init();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('backgrounds', 'readwrite');
                const store = tx.objectStore('backgrounds');
                store.delete('desktopVideo');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            if (typeof applyDesktopBackground === 'function') applyDesktopBackground(null, null);
            if (typeof showSafeNotification === 'function') showSafeNotification("Background removed.", 2000);
        } catch (e) {
            console.error("Error removing custom background:", e);
            if (typeof showSafeNotification === 'function') showSafeNotification("Could not remove background.", 2000);
        }
    },
    showSafeNotification: (message, duration) => {
        if (typeof utilShowNotification === 'function') {
            utilShowNotification(message, duration);
        } else {
            console.warn("showNotification utility not available, logging to console:", message);
        }
    },

    // Master Effect Presets
    saveMasterEffectPreset,
    loadMasterEffectPreset,
    getAvailableMasterEffectPresets,
    deleteMasterEffectPreset,
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
    openUndoHistoryPanel,
    openSpectrumAnalyzerPanel,
    openBeatSyncedLFOPanel,
    openMidiMappingsPanel,
    openExportPresetsPanel,
    openAICompositionPanel,
    // New Feature Panels
    openRandomPatternGeneratorPanel,
    openCpuMonitorPanel,
    openKeyBindingsPanel,
    openKeyboardShortcutsPanel,
    openProjectNotesPanel,
    openDrumMapEditorPanel,
    openTimelineMarkersPanel,
    openPlayheadMarkerDropSettings,
    openGroupEditPanel,
    
    // Pattern Chains
    openPatternChainsPanel,
    
    // Micro Tuning
    getMicroTuningEnabled, setMicroTuningEnabled, getMicroTuningPreset, setMicroTuningPreset,
    getMicroTuningCents, setMicroTuningCents, getMicroTuningRootNote, setMicroTuningRootNote,
    getMicroTuningPresets, getMicroTuningPresetById, midiNoteToFrequencyWithMicroTuning, getMicroTuningFrequencyRatio,
    openMicroTuningPanel,
    
    // Track Templates
    getTrackTemplatesState, saveTrackTemplate, getTrackTemplate, getTrackTemplateNames, deleteTrackTemplate, applyTrackTemplate, renameTrackTemplate,
    
    // Instrument Rack
    openInstrumentRackPanel,
    updateInstrumentRackPanel,
    openMIDIChordPlayerPanel,

    // EQ Preset Library
    openEQPresetLibraryPanel,
    
    // Effect Panels - Session 2026-04-24
    openTubeSaturationPanel,
    openMultibandGatePanel,
    openTransientModulatorPanel,
    openStereoWidthControllerPanel,
    openDynamicResonanceFilterPanel,
    openVocalDoublerPanel,
    
    // New Effect Panels - Session 2026-04-24 (continued)
    openSpectralCompressorPanel,
    openHarmonicSynthesizerPanel,
    openDynamicEQPanel,
    openStereoImagerEnhancementPanel,
    openMultibandSaturatorPanel,
    openAutoPannerPanel,
    
    // New Effect Panels - Session 2026-04-24 (additional)
    openGranularProcessorPanel,
    openConvolutionReverbPanel,
    openFormantFilterPanel,
    openRingModulatorPanel,
    openFrequencyShifterPanel,
    openEnvelopeGeneratorPanel,
    
    
    // Performance & Workflow - Session 2026-04-26
    openPerformanceTriggerPadsPanel,
    getPerformanceTriggerPads,
    openTrackHeadphoneMixPanel,
    openStepSequencerView,
    openPianoRollEditor,
    openScaleHighlightPanel,
    
    // Audio Recording
    initAudioRecorder,
    startRecording,
    stopRecording,
    isRecordingActive,
    requestMicAccess,
    getRecordingStatus,
    cleanupRecording,

    // Pattern Generation and Frequency Processing
    AIPatternGenerator,
    getAIPatternGenerator,
    openAIPatternGeneratorPanel,
    FrequencyBandSplitter,
    MultibandProcessor,
    getFrequencyBandSplitter,
    openFrequencyBandSplitterPanel,
    // AI Mastering Enhancement
    AIMasteringEnhancement,
    initAIMasteringEnhancement,
    openAIMasteringEnhancementPanel,
    
    // Audio Stem Export Enhancement
    AudioStemExportEnhancement,
    initAudioStemExportEnhancement,
    openAudioStemExportEnhancementPanel,
    
    // MIDI Pattern Variation Enhancement
    MIDIPatternVariationEnhancement,
    initMIDIPatternVariationEnhancement,
    openMIDIPatternVariationEnhancementPanel,
    
    // Plugin Preset Browser
    PluginPresetBrowser,
    initPluginPresetBrowser,
    openPluginPresetBrowserPanel,

    // Video Export Enhancement
    initVideoExportEnhancement,
    openVideoExportPanel,

    // Cloud Sync Enhancement
    initCloudSyncEnhancement,
    openCloudSyncPanel,
    
    // Notation Export Enhancement
    initNotationExportEnhancement,
    openNotationExportPanel,
    
    // Audio Restoration Suite
    initAudioRestorationSuite,
    openAudioRestorationPanel,
    
    // MIDI Guitar Support
    initMIDIGuitarSupport,
    openMIDIGuitarPanel,
    
    // Spatial Audio Panning
    initSpatialAudioPanning,
    openSpatialAudioPanel,

    // MIDI Learn Wizard
    openMIDILearnWizard,

    // Collaboration Session Recording
    CollaborationSessionRecording,
    collaborationSessionRecording,
    initCollaborationSessionRecording,
    openCollaborationSessionPanel,
    
    // AI Mixing Suggestions
    AIMixingSuggestions,
    aiMixingSuggestions,
    initAIMixingSuggestions,
    openAICompositionPanel,
    
    // AI Tempo Suggestion
    AITempoSuggestion,
    initAITempoSuggestion,
    openAITempoSuggestionPanel,
    
    // Frequency Spectrum Matching
    FrequencySpectrumMatching,
    frequencySpectrumMatching,
    initFrequencySpectrumMatching,
    openFrequencySpectrumMatchingPanel,
    
    // Smart Track Grouping
    SmartTrackGrouping,
    smartTrackGrouping,
    initSmartTrackGrouping,
    openSmartTrackGroupingPanel,
    
    // Audio Event Detection
    AudioEventDetection,
    audioEventDetection,
    initAudioEventDetection,
    openAudioEventDetectionPanel,
    
    // Cross-Track Pitch Analysis
    CrossTrackPitchAnalysis,
    crossTrackPitchAnalysis,
    initCrossTrackPitchAnalysis,
    openCrossTrackPitchAnalysisPanel,

    // AI Composition Variations
    initAICompositionVariations,
    openAICompositionVariationsPanel,
    
    // Harmonic Analysis Engine
    initHarmonicAnalysisEngine,
    openHarmonicAnalysisPanel,
    
    // Audio Stem Separation
    initAudioStemSeparation,
    openAudioStemSeparationPanel,
    
    // Audio Tap Tempo
    openAudioTapTempoPanel,
    
    // Audio Normalizer
    openAudioNormalizerPanel,
    
    // Beat Detective
    openBeatDetectivePanel,
    
    // MIDI to Audio Conversion
    initMIDIToAudioConversion,
    openMIDIToAudioPanel,
    
    // Smart FX Chain
    initSmartFXChain,
    openSmartFXChainPanel,

    // Sample Library Browser
    openSampleLibraryBrowserPanel,

    // Project Statistics
    openProjectStatisticsPanel,

    // AI Music Generation
    DrumPatternGenerator,
    initDrumPatternGenerator,
    getDrumGenerator,
    generateDrumPattern,
    DRUM_STYLES,
    MelodyGenerator,
    initMelodyGenerator,
    getMelodyGenerator,
    generateMelody,
    MELODY_STYLES,
    MELODY_MOODS,

    // FeatureAdditions exports
    ...FeatureAdditions,
    openSmartQuantizePanel,
    
    // Enhancement modules exports
    smartQuantizeEnhance: window.smartQuantizeEnhance,
    applyQuantizeStylePreset: window.applyQuantizeStylePreset,
    getQuantizeStylePresets: window.getQuantizeStylePresets,
    getQuantizeModes: window.getQuantizeModes,
    createCustomQuantizeTemplate: window.createCustomQuantizeTemplate,
    smartQuantizeEnhanceState: window.smartQuantizeEnhanceState,
    
    exportVisualizationImage: window.exportVisualizationImage,
    exportVisualizationSVG: window.exportVisualizationSVG,
    startVisualizationRecording: window.startVisualizationRecording,
    captureVisualizationFrame: window.captureVisualizationFrame,
    stopVisualizationRecording: window.stopVisualizationRecording,
    exportVisualizationWithWatermark: window.exportVisualizationWithWatermark,
    batchExportVisualization: window.batchExportVisualization,
    getExportFormats: window.getExportFormats,
    getQualityPresets: window.getQualityPresets,
    vizExportState: window.vizExportState,
    
    startPerformanceRecording: window.startPerformanceRecording,
    stopPerformanceRecording: window.stopPerformanceRecording,
    recordPerformanceEvent: window.recordPerformanceEvent,
    playPerformanceRecording: window.playPerformanceRecording,
    stopPerformancePlayback: window.stopPerformancePlayback,
    pausePerformancePlayback: window.pausePerformancePlayback,
    resumePerformancePlayback: window.resumePerformancePlayback,
    setPerformancePlaybackSpeed: window.setPerformancePlaybackSpeed,
    setPerformancePlaybackLoop: window.setPerformancePlaybackLoop,
    seekPerformancePlayback: window.seekPerformancePlayback,
    savePerformanceRecording: window.savePerformanceRecording,
    loadPerformanceRecording: window.loadPerformanceRecording,
    deletePerformanceRecording: window.deletePerformanceRecording,
    getPerformanceRecordings: window.getPerformanceRecordings,
    getPerformanceRecordingDetails: window.getPerformanceRecordingDetails,
    perfRecordState: window.perfRecordState,
    
    createClipAutomation: window.createClipAutomation,
    addAutomationPoint: window.addAutomationPoint,
    removeAutomationPoint: window.removeAutomationPoint,
    moveAutomationPoint: window.moveAutomationPoint,
    getAutomationValue: window.getAutomationValue,
    applyCurvePreset: window.applyCurvePreset,
    generateCurveAutomation: window.generateCurveAutomation,
    copyAutomation: window.copyAutomation,
    clearAutomation: window.clearAutomation,
    toggleAutomation: window.toggleAutomation,
    getAutomationCurve: window.getAutomationCurve,
    exportAutomation: window.exportAutomation,
    importAutomation: window.importAutomation,
    getAutomationTypes: window.getAutomationTypes,
    getCurvePresets: window.getCurvePresets,
    clipAutomationState: window.clipAutomationState,
    
    createTrackGroup: window.createTrackGroup,
    deleteTrackGroup: window.deleteTrackGroup,
    addTrackToGroup: window.addTrackToGroup,
    removeTrackFromGroup: window.removeTrackFromGroup,
    getTrackGroup: window.getTrackGroup,
    getGroupAncestry: window.getGroupAncestry,
    getGroupDescendants: window.getGroupDescendants,
    getAllGroupTracks: window.getAllGroupTracks,
    setGroupMute: window.setGroupMute,
    setGroupSolo: window.setGroupSolo,
    setGroupVolume: window.setGroupVolume,
    setGroupPan: window.setGroupPan,
    toggleGroupCollapse: window.toggleGroupCollapse,
    setGroupLinked: window.setGroupLinked,
    setGroupColor: window.setGroupColor,
    renameGroup: window.renameGroup,
    moveGroup: window.moveGroup,
    duplicateGroup: window.duplicateGroup,
    getGroupHierarchy: window.getGroupHierarchy,
    getAllGroups: window.getAllGroups,
    getGroupById: window.getGroupById,
    getGroupDepth: window.getGroupDepth,
    exportGroups: window.exportGroups,
    importGroups: window.importGroups,
    nestedGroupState: window.nestedGroupState,
    
    setStepProbability: window.setStepProbability,
    getEffectiveProbability: window.getEffectiveProbability,
    shouldStepPlay: window.shouldStepPlay,
    createConditionalRule: window.createConditionalRule,
    applyProbabilityPreset: window.applyProbabilityPreset,
    clearAllProbabilities: window.clearAllProbabilities,
    getProbabilityStatistics: window.getProbabilityStatistics,
    getConditionalRules: window.getConditionalRules,
    deleteConditionalRule: window.deleteConditionalRule,
    toggleConditionalRule: window.toggleConditionalRule,
    getRuleTypes: window.getRuleTypes,
    getProbabilityPresets: window.getProbabilityPresets,
    exportProbabilitySettings: window.exportProbabilitySettings,
    importProbabilitySettings: window.importProbabilitySettings,
    conditionalProbState: window.conditionalProbState,
    
    setComparisonSourceA: window.setComparisonSourceA,
    setComparisonSourceB: window.setComparisonSourceB,
    analyzeSourceSpectrum: window.analyzeSourceSpectrum,
    performSpectrumComparison: window.performSpectrumComparison,
    setComparisonMode: window.setComparisonMode,
    generateComparisonReport: window.generateComparisonReport,
    selectComparisonBand: window.selectComparisonBand,
    exportComparisonImage: window.exportComparisonImage,
    exportComparisonData: window.exportComparisonData,
    importComparisonSettings: window.importComparisonSettings,
    resetComparison: window.resetComparison,
    getComparisonModes: window.getComparisonModes,
    getFrequencyBands: window.getFrequencyBands,
    setComparisonFFTSize: window.setComparisonFFTSize,
    startContinuousComparison: window.startContinuousComparison,
    stopContinuousComparison: window.stopContinuousComparison,
    spectrumCompareState: window.spectrumCompareState,
    
    initEnhancedMIDIMonitor: window.initEnhancedMIDIMonitor,
    getAvailableInputs: window.getAvailableInputs,
    getAvailableOutputs: window.getAvailableOutputs,
    connectMIDIInput: window.connectMIDIInput,
    connectMIDIOutput: window.connectMIDIOutput,
    startMIDIMonitoring: window.startMIDIMonitoring,
    stopMIDIMonitoring: window.stopMIDIMonitoring,
    pauseMIDIMonitoring: window.pauseMIDIMonitoring,
    resumeMIDIMonitoring: window.resumeMIDIMonitoring,
    clearMIDIMessageLog: window.clearMIDIMessageLog,
    resetMIDIStatistics: window.resetMIDIStatistics,
    exportMIDIMessageLog: window.exportMIDIMessageLog,
    setMessageTypeFilter: window.setMessageTypeFilter,
    setChannelFilter: window.setChannelFilter,
    getMIDIMessageLog: window.getMIDIMessageLog,
    getMIDIStatistics: window.getMIDIStatistics,
    getMIDIFilters: window.getMIDIFilters,
    getMIDITransforms: window.getMIDITransforms,
    setMIDITransform: window.setMIDITransform,
    midiMonitorEnhanceState: window.midiMonitorEnhanceState,
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
                    const dzKey = track.type === 'Sampler' ? 'sampler' : 'instrumentsampler';
                    const dzContainer = inspectorElement.querySelector(`#dropZoneContainer-${track.id}-${dzKey}`);
                    const fileInputEl = dzContainer.querySelector(`#fileInput-${track.id}`);
                    const loadFn = appServices.loadSampleFile;
                    if (fileInputEl && loadFn) fileInputEl.onchange = (e) => loadFn(e, track.id, track.type);
                    const newDropZoneDiv = dzContainer.querySelector('.drop-zone');
                    if (newDropZoneDiv && typeof setupGenericDropZoneListeners === 'function') {
                        setupGenericDropZoneListeners(newDropZoneDiv, track.id, track.type, null, appServices.loadSoundFromBrowserToTarget, loadFn, appServices.getTrackById);
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


console.log('[SnugOS] main.js loaded - version', Constants.APP_VERSION);
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
            playbackModeToggleBtnGlobal: document.getElementById('playbackModeToggleBtnGlobal'),
            metronomeToggleBtnGlobal: document.getElementById('metronomeToggleBtnGlobal'),
            metronomeVolumeSlider: document.getElementById('metronomeVolumeSlider'),
            metronomeVolumeDisplay: document.getElementById('metronomeVolumeDisplay'),
            metronomeVolumeControl: document.getElementById('metronomeVolumeControl'),
            beatLfoToggleBtnGlobal: document.getElementById('beatLfoToggleBtnGlobal'),
            performanceMonitorBtn: document.getElementById('performanceMonitorBtn'),
            scaleSelectGlobal: document.getElementById('scaleSelectGlobal'),
            keySelectGlobal: document.getElementById('keySelectGlobal'),
            scaleNotesDisplay: document.getElementById('scaleNotesDisplay')
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
        // Restore saved background (image or video)
        await restoreDesktopBackground();

        if (typeof initializeStateModule === 'function') initializeStateModule(appServices); else console.error("initializeStateModule is not a function");
        if (typeof initializeUIModule === 'function') initializeUIModule(appServices); else console.error("initializeUIModule is not a function");
        if (typeof initializeAudioModule === 'function') initializeAudioModule(appServices); else console.error("initializeAudioModule is not a function");
        if (typeof initializeEventHandlersModule === 'function') initializeEventHandlersModule(appServices); else console.error("initializeEventHandlersModule is not a function");
        if (typeof initPianoRollSequencer === 'function') initPianoRollSequencer(appServices); // Piano Roll Sequencer initialization
        if (typeof initScoreEditor === 'function') initScoreEditor(appServices); // Score Editor initialization
        if (typeof initClipReverse === 'function') initClipReverse(appServices); // Clip Reverse feature initialization
        if (typeof initTrackHeadphoneMix === 'function') initTrackHeadphoneMix(appServices); // Headphone Mix initialization
        if (typeof initClipContextMenu === 'function') initClipContextMenu(appServices); // Clip context menu with reverse
        if (typeof openStepSequencerView === 'function') openStepSequencerView(appServices); // Step Sequencer View initialization
        if (typeof initPianoRollEditor === 'function') initPianoRollEditor(appServices); // Piano Roll Editor initialization
        if (typeof initScaleHighlightMode === 'function') initScaleHighlightMode(appServices); // Scale Highlight Mode initialization
        if (typeof initAudioRecorder === 'function') initAudioRecorder(appServices); // Audio Recorder initialization
        if (typeof initTrackContextMenu === 'function') initTrackContextMenu(appServices); // Track context menu with duplicate
        if (typeof initTrackLaneResize === 'function') initTrackLaneResize(appServices); // Track lane resize
        if (typeof initPerformanceMonitor === 'function') initPerformanceMonitor(); // Performance monitor initialization
        if (typeof initPerformanceIndicator === 'function') initPerformanceIndicator(); // Performance indicator initialization
        if (typeof initUndoHistoryPanel === 'function') initUndoHistoryPanel(); // Undo history panel initialization
        if (typeof initSpectrumAnalyzer === 'function') initSpectrumAnalyzer(appServices); // Spectrum Analyzer initialization
        if (typeof initBeatSyncedLFOPanel === 'function') initBeatSyncedLFOPanel(appServices); // Beat-synced LFO panel initialization
        if (typeof initAutoBeatSync === 'function') initAutoBeatSync(appServices); // Auto-Beat Sync initialization
        if (typeof initTimelineMarkers === 'function') initTimelineMarkers(appServices); // Auto-Beat Sync initialization
        if (typeof initPlayheadMarkerDrop === 'function') initPlayheadMarkerDrop(appServices); // Playhead Marker Drop initialization
        if (typeof initProjectRecoveryManager === 'function') initProjectRecoveryManager(appServices); // Project crash recovery manager
        if (typeof initAudioTapTempo === 'function') initAudioTapTempo(appServices); // Audio Tap Tempo initialization
        if (typeof initAITempoSuggestion === 'function') initAITempoSuggestion(appServices); // AI Tempo Suggestion initialization
        if (typeof initAudioNormalizer === 'function') initAudioNormalizer(); // Audio Normalizer initialization
        if (typeof initMIDILearnWizard === 'function') initMIDILearnWizard(appServices); // MIDI Learn Wizard initialization
        if (typeof initBulkAssign === 'function') initBulkAssign(); // MIDI Bulk Assign initialization
        if (typeof initBeatDetective === 'function') initBeatDetective(appServices); // Beat Detective initialization
        if (typeof initTransportLoopCount === 'function') initTransportLoopCount(appServices); // Transport Loop Count initialization
        if (window.TransportMemory && typeof window.TransportMemory.init === 'function') window.TransportMemory.init(); // Transport Memory restoration
        if (typeof initClipGainEnvelope === 'function') initClipGainEnvelope(appServices); // Clip Gain Envelope Core initialization
        if (typeof initClipGainEnvelopeEditor === 'function') initClipGainEnvelopeEditor(appServices); // Clip Gain Envelope Editor UI initialization
        if (typeof initLoopCountStateReferences === 'function') initLoopCountStateReferences(
            () => getLoopRegionEnabled(),
            () => getLoopRegionStart(),
            () => getLoopRegionEnd()
        ); // Connect loop count to state functions
        if (typeof initAutoScrollSync === 'function') initAutoScrollSync(); // Auto-Scroll Sync initialization
        if (typeof initTrackLaneReorder === 'function') initTrackLaneReorder(appServices); // Track Lane Reorder initialization
        if (typeof initChordProgressionAssistant === 'function') initChordProgressionAssistant(appServices); // Chord Progression Assistant initialization
        if (typeof initLoopbackAudioRouting === 'function') initLoopbackAudioRouting(appServices); // Loopback Audio Routing initialization
        
        if (typeof initializePrimaryEventListeners === 'function') {
             initializePrimaryEventListeners(appServices);
        } else { console.error("initializePrimaryEventListeners is not a function");}

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
        
        // Initialize sample rate display in status bar
        initSampleRateDisplay();
        startSampleRateDisplayLoop();
        
        // Initialize performance monitor and indicator
        if (typeof initPerformanceMonitor === 'function') initPerformanceMonitor();
        if (typeof initPerformanceIndicator === 'function') initPerformanceIndicator();
        
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

// Performance monitoring state
let lastFrameTime = performance.now();
let frameCount = 0;
let fpsValue = 60;
let cpuHistory = [];
const CPU_HISTORY_MAX_LENGTH = 50;

function updatePerformanceStats() {
    const now = performance.now();
    frameCount++;
    
    // Calculate FPS every second
    const elapsed = now - lastFrameTime;
    if (elapsed >= 1000) {
        fpsValue = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastFrameTime = now;
        
        // Update FPS display
        const fpsEl = document.getElementById('statusFpsValue');
        if (fpsEl) {
            fpsEl.textContent = fpsValue;
            // Color coding
            if (fpsValue >= 50) {
                fpsEl.className = 'text-green-400';
            } else if (fpsValue >= 30) {
                fpsEl.className = 'text-yellow-400';
            } else {
                fpsEl.className = 'text-red-400';
            }
        }
        
        // Estimate CPU load (rough approximation based on frame time)
        const cpuLoad = Math.min(100, Math.max(0, 100 - (fpsValue / 60 * 100)));
        cpuHistory.push(cpuLoad);
        if (cpuHistory.length > CPU_HISTORY_MAX_LENGTH) {
            cpuHistory.shift();
        }
        
        // Update CPU display
        const cpuEl = document.getElementById('statusCpuValue');
        if (cpuEl) {
            cpuEl.textContent = `${Math.round(cpuLoad)}%`;
            // Color coding
            if (cpuLoad <= 30) {
                cpuEl.className = 'text-green-400';
            } else if (cpuLoad <= 60) {
                cpuEl.className = 'text-yellow-400';
            } else {
                cpuEl.className = 'text-red-400';
            }
        }
        
        // Update CPU history sparkline
        updateCpuHistorySparkline();
        
        // Update memory display (if available)
        if (performance.memory) {
            const memEl = document.getElementById('statusMemValue');
            if (memEl) {
                const usedMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
                memEl.textContent = `${usedMB} MB`;
            }
        }
    }
}

function updateCpuHistorySparkline() {
    const container = document.getElementById('statusCpuHistory');
    if (!container) return;
    
    container.innerHTML = cpuHistory.map(val => {
        const height = Math.max(1, Math.min(12, Math.round((val / 100) * 12)));
        const color = val <= 30 ? 'bg-green-400' : (val <= 60 ? 'bg-yellow-400' : 'bg-red-400');
        return `<div class="${color}" style="width: 2px; height: ${height}px;"></div>`;
    }).join('');
}

function getCpuMonitorData() {
    return {
        fps: fpsValue,
        cpuHistory: [...cpuHistory],
        currentCpu: cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1] : 0,
        memory: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        } : null,
        tracks: getTracksState ? getTracksState().map(t => ({
            id: t.id,
            name: t.name,
            type: t.type,
            isPlaying: t.isPlaying,
            hasActiveSequence: t.activeSequenceId !== null
        })) : []
    };
}

function updateMetersLoop() {
    try {
        if (typeof updateMeters === 'function') {
            const mixerWindow = getWindowByIdState ? getWindowByIdState('mixer') : null;
            const mixerMasterMeterBar = mixerWindow?.element && !mixerWindow.isMinimized ? mixerWindow.element.querySelector('#mixerMasterMeterBar') : null;
            const tracks = getTracksState ? getTracksState() : [];
            updateMeters(uiElementsCache.masterMeterBarGlobal, mixerMasterMeterBar, tracks);
        }
        // Update CC Visualizer bars
        if (typeof updateCcVisualizerBars === 'function') {
            updateCcVisualizerBars();
        }
        if (typeof updatePlayheadPosition === 'function') {
            updatePlayheadPosition();
        }
        // Auto-scroll timeline during playback
        if (typeof autoScrollTimeline === 'function') {
            autoScrollTimeline();
        }
        // Update performance stats (FPS/CPU/Memory)
        if (typeof updatePerformanceStats === 'function') {
            updatePerformanceStats();
        }
        // Transport Loop Count - Check if loop count limit reached
        if (typeof checkTransportLoopCount === 'function') {
            checkTransportLoopCount();
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
    const bgType = localStorage.getItem('snugosDesktopBgType');
    
    if (bgType === 'video') {
        try {
            const videoBlob = await this.bgDb.get('desktopVideo');
            if (videoBlob) {
                const objectUrl = URL.createObjectURL(videoBlob);
                applyDesktopBackground(objectUrl, 'video');
                console.log("[Main] Restored video background from IndexedDB");
            }
        } catch (e) {
            console.warn("Could not restore video background:", e);
        }
    } else if (bgType === 'image' || !bgType) {
        const imageUrl = localStorage.getItem('snugosDesktopBackground');
        if (imageUrl) {
            applyDesktopBackground(imageUrl, 'image');
        }
    }
}


// --- Global Event Listeners ---
if (typeof window !== 'undefined') {
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
}
console.log(`SCRIPT EXECUTION FINISHED - SnugOS (main.js - Version ${Constants.APP_VERSION})`);