// js/eventHandlers.js - Global Event Listeners and Input Handling Module
import * as Constants from './constants.js';
import { showNotification, showConfirmationDialog, createContextMenu } from './utils.js';
import { parseMidiFile, midiNotesToSequenceData, encodeSequenceToMidi, midiToNoteName, noteNameToMidi } from './midiUtils.js';
import {
    getTracksState as getTracks,
    getTrackByIdState as getTrackById,
    captureStateForUndoInternal as captureStateForUndo,
    setSoloedTrackIdState as setSoloedTrackId,
    getSoloedTrackIdState as getSoloedTrackId,
    setArmedTrackIdState as setArmedTrackId,
    getArmedTrackIdState as getArmedTrackId,
    setActiveSequencerTrackIdState as setActiveSequencerTrackId,
    setIsRecordingState as setIsRecording,
    isTrackRecordingState as isTrackRecording,
    setRecordingTrackIdState as setRecordingTrackId,
    getRecordingTrackIdState as getRecordingTrackId,
    getRecordingStartTimeState as getRecordingStartTime,
    removeTrackFromStateInternal as coreRemoveTrackFromState,
    getPlaybackModeState,
    setPlaybackModeState,
    getMidiAccessState, 
    getActiveMIDIInputState,
    // Loop Region State
    getLoopRegionEnabled, setLoopRegionEnabled, setLoopRegionStart, setLoopRegionEnd,
    // Metronome State
    getMetronomeEnabled, setMetronomeEnabled, getMetronomeVolume, setMetronomeVolume,
    getAdaptiveMetronomeEnabled, setAdaptiveMetronomeEnabled, recordNoteTiming
} from './state.js';

let localAppServices = {};
let transportKeepAliveBufferSource = null;
let silentKeepAliveBuffer = null;

export function initializeEventHandlersModule(appServicesFromMain) {
    localAppServices = appServicesFromMain || {}; 
    if (!localAppServices.setPlaybackMode && setPlaybackModeState) {
        localAppServices.setPlaybackMode = setPlaybackModeState;
    }
    if (!localAppServices.getPlaybackMode && getPlaybackModeState) {
        localAppServices.getPlaybackMode = getPlaybackModeState;
    }
}

export let currentlyPressedComputerKeys = {};
let currentOctaveShift = 0;
const MIN_OCTAVE_SHIFT = -2;
const MAX_OCTAVE_SHIFT = 2;

export function initializePrimaryEventListeners(appContext) {
    const services = appContext || localAppServices;
    const uiCache = services.uiElementsCache || {};
    console.log('[EventHandlers initializePrimaryEventListeners] Initializing. uiCache keys:', Object.keys(uiCache));

    try {
        if (uiCache.startButton) {
            uiCache.startButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (uiCache.startMenu) {
                    uiCache.startMenu.classList.toggle('hidden');
                } else {
                    console.error('[EventHandlers] Start Menu (uiCache.startMenu) not found when Start Button clicked!');
                }
            });
        } else {
            console.warn('[EventHandlers initializePrimaryEventListeners] Start Button (uiCache.startButton) NOT found in uiCache!');
        }

        if (uiCache.desktop) {
            uiCache.desktop.addEventListener('click', () => {
                if (uiCache.startMenu && !uiCache.startMenu.classList.contains('hidden')) {
                    uiCache.startMenu.classList.add('hidden');
                }
                const activeContextMenu = document.querySelector('.context-menu#snug-context-menu');
                if (activeContextMenu) {
                    activeContextMenu.remove();
                }
            });

            uiCache.desktop.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const menuItems = [
                    { label: "Add Synth Track", action: () => { if(services.addTrack) services.addTrack('Synth', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Slicer Sampler Track", action: () => { if(services.addTrack) services.addTrack('Sampler', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Sampler (Pads)", action: () => { if(services.addTrack) services.addTrack('DrumSampler', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Instrument Sampler Track", action: () => { if(services.addTrack) services.addTrack('InstrumentSampler', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Audio Track", action: () => { if(services.addTrack) services.addTrack('Audio', {_isUserActionPlaceholder: true}); } },
                    { separator: true },
                    { label: "Open Sound Browser", action: () => { if(services.openSoundBrowserWindow) services.openSoundBrowserWindow(); } },
                    { label: "Open Timeline", action: () => { if(services.openTimelineWindow) services.openTimelineWindow(); } },
                    { label: "Open Global Controls", action: () => { if(services.openGlobalControlsWindow) services.openGlobalControlsWindow(); } },
                    { label: "Open Mixer", action: () => { if(services.openMixerWindow) services.openMixerWindow(); } },
                    { label: "Open Master Effects", action: () => { if(services.openMasterEffectsRackWindow) services.openMasterEffectsRackWindow(); } },
                    { separator: true },
                    { label: "Upload Custom Background (Image/Video)", action: () => { if(services.triggerCustomBackgroundUpload) services.triggerCustomBackgroundUpload(); } },
                    { label: "Remove Custom Background", action: () => { if(appContext.removeCustomDesktopBackground) appContext.removeCustomDesktopBackground(); } },
                    { separator: true },
                    { label: "Toggle Full Screen", action: toggleFullScreen }
                ];
                if (typeof createContextMenu === 'function') {
                    createContextMenu(e, menuItems, services);
                } else {
                    console.error("[EventHandlers] createContextMenu function not available.");
                }
            });
        } else {
             console.warn('[EventHandlers initializePrimaryEventListeners] Desktop element (uiCache.desktop) NOT found in uiCache!');
        }

        const menuActions = {
            menuAddSynthTrack: () => {
                console.log('[Menu] Add Synth Track clicked');
                try {
                    services.addTrack?.('Synth', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Add Synth Track error:', e); }
            },
            menuAddSamplerTrack: () => {
                console.log('[Menu] Add Sampler Track clicked');
                try {
                    services.addTrack?.('Sampler', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Add Sampler error:', e); }
            },
            menuAddDrumSamplerTrack: () => {
                console.log('[Menu] Add Drum Sampler clicked');
                try {
                    services.addTrack?.('DrumSampler', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Drum Sampler error:', e); }
            },
            menuAddInstrumentSamplerTrack: () => {
                console.log('[Menu] Add Instrument Sampler clicked');
                try {
                    services.addTrack?.('InstrumentSampler', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Instrument Sampler error:', e); }
            },
            menuAddAudioTrack: () => {
                console.log('[Menu] Add Audio Track clicked');
                try {
                    services.addTrack?.('Audio', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Audio Track error:', e); }
            },
            menuOpenSoundBrowser: () => {
                console.log('[Menu] Sound Browser clicked');
                try {
                    services.openSoundBrowserWindow?.();
                } catch(e) { console.error('[Menu] Sound Browser error:', e); }
            },
            menuOpenTimeline: () => {
                console.log('[Menu] Timeline clicked');
                try {
                    services.openTimelineWindow?.();
                } catch(e) { console.error('[Menu] Timeline error:', e); }
            },
            menuOpenGlobalControls: () => {
                console.log('[Menu] Global Controls clicked');
                try {
                    services.openGlobalControlsWindow?.();
                } catch(e) { console.error('[Menu] Global Controls error:', e); }
            },
            menuOpenMixer: () => {
                console.log('[Menu] Mixer clicked');
                try {
                    services.openMixerWindow?.();
                } catch(e) { console.error('[Menu] Mixer error:', e); }
            },
            menuOpenMasterEffects: () => {
                console.log('[Menu] Master Effects clicked');
                try {
                    services.openMasterEffectsRackWindow?.();
                } catch(e) { console.error('[Menu] Master Effects error:', e); }
            },
            menuOpenMidiMappings: () => {
                console.log('[Menu] MIDI Mappings clicked');
                try {
                    services.openMidiMappingsPanel?.();
                } catch(e) { console.error('[Menu] MIDI Mappings error:', e); }
            },
            menuChordMemory: () => {
                console.log('[Menu] Chord Memory clicked');
                try {
                    services.openChordMemoryPanel?.();
                } catch(e) { console.error('[Menu] Chord Memory error:', e); }
            },
            menuTempoAutomation: () => {
                console.log('[Menu] Tempo Automation clicked');
                try {
                    services.openTempoAutomationPanel?.();
                } catch(e) { console.error('[Menu] Tempo Automation error:', e); }
            },
            menuTrackGroups: () => {
                console.log('[Menu] Track Groups clicked');
                try {
                    services.openTrackGroupsPanel?.();
                } catch(e) { console.error('[Menu] Track Groups error:', e); }
            },
            menuScaleHint: () => {
                console.log('[Menu] Scale Hint Overlay clicked');
                try {
                    services.openScaleHintPanel?.();
                } catch(e) { console.error('[Menu] Scale Hint Overlay error:', e); }
            },
            menuScaleLock: () => {
                console.log('[Menu] Scale Lock clicked');
                try {
                    services.openScaleLockPanel?.();
                } catch(e) { console.error('[Menu] Scale Lock error:', e); }
            },
            menuMicroTuning: () => {
                console.log('[Menu] Micro Tuning clicked');
                try {
                    services.openMicroTuningPanel?.();
                } catch(e) { console.error('[Menu] Micro Tuning error:', e); }
            },
            menuGrooveTemplates: () => {
                console.log('[Menu] Groove Templates clicked');
                try {
                    services.openGrooveTemplatesPanel?.();
                } catch(e) { console.error('[Menu] Groove Templates error:', e); }
            },
            menuPatternChains: () => {
                console.log('[Menu] Pattern Chains clicked');
                try {
                    services.openPatternChainsPanel?.();
                } catch(e) { console.error('[Menu] Pattern Chains error:', e); }
            },
            menuAutomationLanes: () => {
                console.log('[Menu] Automation Lanes clicked');
                try {
                    services.openAutomationLanesPanel?.();
                } catch(e) { console.error('[Menu] Automation Lanes error:', e); }
            },
            menuUndo: () => { console.log('[Menu] Undo clicked'); services.undoLastAction?.(); },
            menuRedo: () => { console.log('[Menu] Redo clicked'); services.redoLastAction?.(); },
            menuOpenHistory: () => { console.log('[Menu] History Panel clicked'); services.openUndoHistoryPanel?.(); },
            menuSaveProject: () => { console.log('[Menu] Save clicked'); services.saveProject?.(); },
            menuLoadProject: () => { console.log('[Menu] Load clicked'); services.loadProject?.(); },
            menuExportWav: () => { console.log('[Menu] Export clicked'); services.exportToWav?.(); },
            menuExportMidi: () => { console.log('[Menu] Export MIDI clicked'); services.exportToMidi?.(); },
            menuExportStems: () => { console.log('[Menu] Export Stems clicked'); services.showStemExportDialog?.(); },
            menuProjectTemplates: () => { console.log('[Menu] Project Templates clicked'); services.openProjectTemplatesPanel?.(); },
            menuExportPresets: () => { console.log('[Menu] Export Presets clicked'); services.openExportPresetsPanel?.(); },
            menuTrackTemplates: () => { console.log('[Menu] Track Templates clicked'); services.openTrackTemplatesPanel?.(); },
            menuToggleFullScreen: () => { console.log('[Menu] Fullscreen clicked'); toggleFullScreen(); },
            menuTetris: () => window.open("https://snugos.github.io/app/tetris.html", "_blank"),
        };

        for (const menuItemId in menuActions) {
            if (uiCache[menuItemId]) {
                uiCache[menuItemId].addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log(`[Menu] CLICK FIRED: ${menuItemId}`);
                    menuActions[menuItemId]();
                    if (uiCache.startMenu) uiCache.startMenu.classList.add('hidden');
                });
            } else {
                console.warn(`[Menu] NOT FOUND: ${menuItemId}`);
            }
        }

        if (uiCache.loadProjectInput) {
            uiCache.loadProjectInput.addEventListener('change', (e) => {
                if (services.handleProjectFileLoad) {
                    services.handleProjectFileLoad(e);
                } else {
                    console.error("[EventHandlers] handleProjectFileLoad service not available.");
                }
            });
        } else {
            console.warn("[EventHandlers] Load project input (uiCache.loadProjectInput) not found.");
        }

    } catch (error) {
        console.error("[EventHandlers initializePrimaryEventListeners] Error during initialization:", error);
        showNotification("Error setting up primary interactions. Some UI might not work.", 5000);
    }
}

export function attachGlobalControlEvents(elements) {
    if (!elements) {
        console.error('[EventHandlers attachGlobalControlEvents] Elements object is null or undefined.');
        return;
    }
    const { playBtnGlobal, recordBtnGlobal, stopBtnGlobal, tempoGlobalInput, midiInputSelectGlobal, playbackModeToggleBtnGlobal, midiLearnBtnGlobal, tapBtnGlobal, loopToggleBtnGlobal, loopStartInput, loopEndInput, metronomeToggleBtnGlobal, scaleSelectGlobal, keySelectGlobal, scaleNotesDisplay } = elements;
    // Helper function to toggle play/pause icons
    function setPlayButtonState(isPlaying) {
        if (!playBtnGlobal) return;
        const playIcon = playBtnGlobal.querySelector('.play-icon');
        const pauseIcon = playBtnGlobal.querySelector('.pause-icon');
        if (isPlaying) {
            playBtnGlobal.classList.add('playing');
            if (playIcon) playIcon.classList.add('hidden');
            if (pauseIcon) pauseIcon.classList.remove('hidden');
        } else {
            playBtnGlobal.classList.remove('playing');
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
        }
    }
    // Initialize to stopped state
    setPlayButtonState(false);

    // === Loop Region Controls ===
    if (loopToggleBtnGlobal) {
        // Update loop button state from current state
        const updateLoopButtonState = () => {
            const loopEnabled = typeof getLoopRegionEnabled === 'function' ? getLoopRegionEnabled() : false;
            loopToggleBtnGlobal.textContent = loopEnabled ? 'Loop: On' : 'Loop: Off';
            loopToggleBtnGlobal.classList.toggle('playing', loopEnabled);
        };
        updateLoopButtonState();
        loopToggleBtnGlobal.addEventListener('click', () => {
            const currentEnabled = typeof getLoopRegionEnabled === 'function' ? getLoopRegionEnabled() : false;
            if (typeof setLoopRegionEnabled === 'function') {
                setLoopRegionEnabled(!currentEnabled);
                updateLoopButtonState();
                showNotification(`Loop region ${!currentEnabled ? 'enabled' : 'disabled'}`, 1500);
            }
        });
    }

    if (loopStartInput) {
        loopStartInput.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value) || 0;
            if (typeof setLoopRegionStart === 'function') {
                setLoopRegionStart(value);
                showNotification(`Loop start: ${value}s`, 1500);
            }
        });
    }

    if (loopEndInput) {
        loopEndInput.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value) || 16;
            if (typeof setLoopRegionEnd === 'function') {
                setLoopRegionEnd(value);
                showNotification(`Loop end: ${value}s`, 1500);
            }
        });
    }
    // === End Loop Region Controls ===

    // === Metronome Controls ===
    if (metronomeToggleBtnGlobal) {
        const updateMetronomeButtonState = () => {
            const metronomeEnabled = typeof getMetronomeEnabled === 'function' ? getMetronomeEnabled() : false;
            metronomeToggleBtnGlobal.textContent = metronomeEnabled ? '🔔 Metronome' : '🔲 Metronome';
            metronomeToggleBtnGlobal.classList.toggle('playing', metronomeEnabled);
        };
        updateMetronomeButtonState();

        metronomeToggleBtnGlobal.addEventListener('click', async () => {
            const currentEnabled = typeof getMetronomeEnabled === 'function' ? getMetronomeEnabled() : false;
            if (typeof setMetronomeEnabled === 'function') {
                setMetronomeEnabled(!currentEnabled);
                updateMetronomeButtonState();
                showNotification(`Metronome ${!currentEnabled ? 'enabled' : 'disabled'}`, 1500);
                
                // If enabling, initialize audio context if needed and start scheduling
                if (!currentEnabled) {
                    if (localAppServices.initAudioContextAndMasterMeter) {
                        await localAppServices.initAudioContextAndMasterMeter(true);
                    }
                    // Start metronome scheduling if transport is running
                    if (typeof Tone !== 'undefined' && Tone.Transport.state === 'started') {
                        startMetronomeScheduling('4n');
                    }
                } else {
                    // If disabling, stop metronome scheduling
                    stopMetronomeScheduling();
                }
            }
        });
    }
    // === End Metronome Controls ===

    // === Scale/Key Selector Controls ===
    function updateScaleNotesDisplay() {
        if (!scaleSelectGlobal || !keySelectGlobal || !scaleNotesDisplay) return;
        const scaleId = scaleSelectGlobal.value;
        const keyRoot = keySelectGlobal.value;
        const scaleObj = Constants.AVAILABLE_SCALES.find(s => s.id === scaleId);
        if (scaleObj) {
            const notes = Constants.getScaleNotes(keyRoot, scaleObj.intervals);
            scaleNotesDisplay.textContent = notes.join(' - ');
        }
    }

    if (scaleSelectGlobal) {
        scaleSelectGlobal.addEventListener('change', () => {
            updateScaleNotesDisplay();
            if (localAppServices.setGlobalScale) {
                localAppServices.setGlobalScale(scaleSelectGlobal.value);
            }
        });
    }

    if (keySelectGlobal) {
        keySelectGlobal.addEventListener('change', () => {
            updateScaleNotesDisplay();
            if (localAppServices.setGlobalKey) {
                localAppServices.setGlobalKey(keySelectGlobal.value);
            }
        });
    }

    if (scaleNotesDisplay) {
        updateScaleNotesDisplay();
    }
    // === End Scale/Key Controls ===

    if (playBtnGlobal) {
        playBtnGlobal.addEventListener('click', async () => {
            try {
                if (!localAppServices.initAudioContextAndMasterMeter) {
                    console.error("initAudioContextAndMasterMeter service not available.");
                    showNotification("Audio system error.", 3000); return;
                }
                const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
                if (!audioReady) {
                    showNotification("Audio context not ready. Please interact with the page.", 3000);
                    return;
                }

                const transport = Tone.Transport;
                console.log(`[EventHandlers Play/Resume] Clicked. Transport state: ${transport.state}, time: ${transport.seconds.toFixed(2)}`);

                const tracks = getTracks();
                tracks.forEach(track => { if (typeof track.stopPlayback === 'function') track.stopPlayback(); });
                transport.cancel(0);

                if (transportKeepAliveBufferSource && !transportKeepAliveBufferSource.disposed) {
                    try { transportKeepAliveBufferSource.stop(0); transportKeepAliveBufferSource.dispose(); } catch (e) {}
                    transportKeepAliveBufferSource = null;
                }

                if (transport.state === 'stopped' || transport.state === 'paused') {
                    const wasPaused = transport.state === 'paused';
                    const startTime = wasPaused ? transport.seconds : 0;
                    if (!wasPaused) transport.position = 0;

                    console.log(`[EventHandlers Play/Resume] Starting/Resuming from ${startTime.toFixed(2)}s.`);
                    
                    // Get loop region settings from state
                    const loopRegion = typeof getLoopRegion === 'function' ? getLoopRegion() : { enabled: false, start: 0, end: 16 };
                    
                    transport.loop = loopRegion.enabled;
                    transport.loopStart = loopRegion.start;
                    transport.loopEnd = loopRegion.end;
                    console.log(`[EventHandlers Play/Resume] Loop region: ${loopRegion.enabled ? 'enabled' : 'disabled'} (${loopRegion.start}s - ${loopRegion.end}s)`);
                    
                    if (!silentKeepAliveBuffer && Tone.context) {
                        try {
                            silentKeepAliveBuffer = Tone.context.createBuffer(1, 1, Tone.context.sampleRate);
                            silentKeepAliveBuffer.getChannelData(0)[0] = 0;
                        } catch (e) { console.error("Error creating silent buffer:", e); silentKeepAliveBuffer = null; }
                    }
                    if (silentKeepAliveBuffer) {
                        transportKeepAliveBufferSource = new Tone.BufferSource(silentKeepAliveBuffer).toDestination();
                        transportKeepAliveBufferSource.loop = true;
                        transportKeepAliveBufferSource.start(Tone.now() + 0.02, 0, transport.loopEnd);
                    }

                    for (const track of tracks) {
                        if (typeof track.schedulePlayback === 'function') {
                            await track.schedulePlayback(startTime, transport.loopEnd);
                        }
                    }
                    transport.start(Tone.now() + 0.05, startTime);
                    
                    // Start metronome if enabled
                    if (getMetronomeEnabled()) {
                        startMetronomeScheduling('4n');
                    }
                    
                    playBtnGlobal.textContent = 'Pause';
                    playBtnGlobal.classList.add('playing');
                } else { 
                    console.log(`[EventHandlers Play/Resume] Pausing transport.`);
                    transport.pause();
                    playBtnGlobal.textContent = 'Play';
                    playBtnGlobal.classList.remove('playing');
                }
            } catch (error) {
                console.error("[EventHandlers Play/Pause] Error:", error);
                showNotification(`Error during playback: ${error.message}`, 4000);
                if (playBtnGlobal) {
                    playBtnGlobal.textContent = 'Play';
                    playBtnGlobal.classList.remove('playing');
                }
            }
        });
    } else { console.warn("[EventHandlers] playBtnGlobal not found in provided elements."); }

    if (stopBtnGlobal) {
        stopBtnGlobal.addEventListener('click', () => {
            console.log("[EventHandlers StopAll] Stop All button clicked.");
            if (localAppServices.panicStopAllAudio) {
                localAppServices.panicStopAllAudio();
            } else {
                console.error("[EventHandlers StopAll] panicStopAllAudio service not available.");
                if (typeof Tone !== 'undefined') {
                    Tone.Transport.stop();
                    Tone.Transport.cancel(0);
                    // Stop metronome when transport stops
                    stopMetronomeScheduling();
                }
                const playButton = localAppServices.uiElementsCache?.playBtnGlobal;
                if(playButton) {
                    playButton.textContent = 'Play';
                    playButton.classList.remove('playing');
                }
                showNotification("Emergency stop executed (minimal).", 2000);
            }
        });
    } else {
        console.warn("[EventHandlers] stopBtnGlobal not found in provided elements.");
    }

    if (recordBtnGlobal) {
        recordBtnGlobal.addEventListener('click', async () => {
            try {
                if (!localAppServices.initAudioContextAndMasterMeter) {
                    console.error("initAudioContextAndMasterMeter service not available.");
                    showNotification("Audio system error.", 3000); return;
                }
                const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
                if (!audioReady) { showNotification("Audio context not ready.", 3000); return; }

                const isCurrentlyRec = isTrackRecording();
                const trackToRecordId = getArmedTrackId();
                const trackToRecord = trackToRecordId !== null ? getTrackById(trackToRecordId) : null;

                if (!isCurrentlyRec) {
                    if (!trackToRecord) { showNotification("No track armed for recording.", 2000); return; }
                    let recordingInitialized = false;
                    if (trackToRecord.type === 'Audio') {
                        if (localAppServices.startAudioRecording) {
                            recordingInitialized = await localAppServices.startAudioRecording(trackToRecord, trackToRecord.isMonitoringEnabled);
                        } else { console.error("[EventHandlers] startAudioRecording service not available."); showNotification("Recording service unavailable.", 3000); }
                    } else { recordingInitialized = true; } 

                    if (recordingInitialized) {
                        setIsRecording(true);
                        setRecordingTrackId(trackToRecord.id);
                        if (Tone.Transport.state !== 'started') { Tone.Transport.cancel(0); Tone.Transport.position = 0; }
                        setRecordingStartTime(Tone.Transport.seconds);
                        if (Tone.Transport.state !== 'started') Tone.Transport.start(); 
                        if (localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(true);
                        showNotification(`Recording started for ${trackToRecord.name}.`, 2000);
                    } else { showNotification(`Failed to initialize recording for ${trackToRecord.name}.`, 3000); }
                } else { 
                    if (localAppServices.stopAudioRecording && getRecordingTrackId() !== null && getTrackById(getRecordingTrackId())?.type === 'Audio') {
                        await localAppServices.stopAudioRecording();
                    } 
                    setIsRecording(false);
                    const previouslyRecordingTrackId = getRecordingTrackId();
                    setRecordingTrackId(null);
                    if (localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(false);
                    const prevTrack = previouslyRecordingTrackId !== null ? getTrackById(previouslyRecordingTrackId) : null;
                    showNotification(`Recording stopped${prevTrack ? ` for ${prevTrack.name}` : ''}.`, 2000);
                }
            } catch (error) {
                console.error("[EventHandlers Record] Error:", error);
                showNotification(`Error during recording: ${error.message}`, 4000);
                if (localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(false); 
                setIsRecording(false); setRecordingTrackId(null); 
            }
        });
    } else { console.warn("[EventHandlers] recordBtnGlobal not found."); }

    if (tempoGlobalInput) {
        tempoGlobalInput.addEventListener('input', (e) => {
            try {
                const newTempo = parseFloat(e.target.value);
                if (!isNaN(newTempo) && newTempo >= Constants.MIN_TEMPO && newTempo <= Constants.MAX_TEMPO) {
                    Tone.Transport.bpm.value = newTempo;
                    if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
                }
            } catch (error) { console.error("[EventHandlers Tempo Input] Error:", error); }
        });
        tempoGlobalInput.addEventListener('change', () => { 
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Set Tempo to ${Tone.Transport.bpm.value.toFixed(1)}`);
            }
        });
    } else { console.warn("[EventHandlers] tempoGlobalInput not found."); }

    if (midiInputSelectGlobal) {
        midiInputSelectGlobal.addEventListener('change', (e) => {
            if (localAppServices.selectMIDIInput) localAppServices.selectMIDIInput(e.target.value);
            else console.error("[EventHandlers] selectMIDIInput service not available.");
        });
    } else { console.warn("[EventHandlers] midiInputSelectGlobal not found."); }

    if (playbackModeToggleBtnGlobal) {
        playbackModeToggleBtnGlobal.addEventListener('click', () => {
            try {
                const currentGetMode = localAppServices.getPlaybackMode || getPlaybackModeState;
                const currentSetMode = localAppServices.setPlaybackMode || setPlaybackModeState;
                if (currentGetMode && currentSetMode) {
                    const currentMode = currentGetMode();
                    const newMode = currentMode === 'sequencer' ? 'timeline' : 'sequencer';
                    currentSetMode(newMode); 
                } else {
                    console.warn("[EventHandlers PlaybackModeToggle] getPlaybackMode or setPlaybackMode service not available.");
                }
            } catch (error) { console.error("[EventHandlers PlaybackModeToggle] Error:", error); }
        });
    } else { console.warn("[EventHandlers] playbackModeToggleBtnGlobal not found."); }

    // MIDI Learn button handler
    if (midiLearnBtnGlobal) {
        midiLearnBtnGlobal.addEventListener('click', () => {
            try {
                const currentMode = localAppServices.getMidiLearnMode ? localAppServices.getMidiLearnMode() : false;
                const newMode = !currentMode;
                
                if (localAppServices.setMidiLearnMode) {
                    localAppServices.setMidiLearnMode(newMode);
                }
                
                // Update button visual state
                if (newMode) {
                    midiLearnBtnGlobal.classList.add('playing');
                    midiLearnBtnGlobal.textContent = 'Learning...';
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification('MIDI Learn: Move a CC knob to map it', 3000);
                    }
                } else {
                    midiLearnBtnGlobal.classList.remove('playing');
                    midiLearnBtnGlobal.textContent = 'Learn';
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification('MIDI Learn cancelled', 2000);
                    }
                }
            } catch (error) {
                console.error('[EventHandlers midiLearnBtnGlobal] Error:', error);
            }
        });
    }
}

    // Tap Tempo button handler
    if (tapBtnGlobal) {
        tapBtnGlobal.addEventListener('click', async () => {
            try {
                const { handleTapTempo } = await import('./ui.js');
                const tappedBpm = handleTapTempo();
                if (tappedBpm !== null) {
                    Tone.Transport.bpm.value = tappedBpm;
                    if (tempoGlobalInput) {
                        tempoGlobalInput.value = tappedBpm.toFixed(1);
                    }
                    if (localAppServices.updateTaskbarTempoDisplay) {
                        localAppServices.updateTaskbarTempoDisplay(tappedBpm);
                    }
                    tapBtnGlobal.style.backgroundColor = '#3a3a3a';
                    setTimeout(() => { tapBtnGlobal.style.backgroundColor = ''; }, 100);
                }
            } catch (error) {
                console.error("[EventHandlers TapTempo] Error:", error);
            }
        });
    }



export function setupMIDI() {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess()
            .then(onMIDISuccess, onMIDIFailure)
            .catch(onMIDIFailure); 
    } else {
        console.warn("WebMIDI is not supported in this browser.");
        showNotification("WebMIDI not supported. Cannot use MIDI devices.", 3000);
    }
}

function onMIDISuccess(midiAccess) {
    if (localAppServices.setMidiAccess) {
        localAppServices.setMidiAccess(midiAccess);
    } else {
        console.error("[EventHandlers onMIDISuccess] setMidiAccess service not available.");
    }

    const inputs = midiAccess.inputs.values();
    const selectElement = localAppServices.uiElementsCache?.midiInputSelectGlobal;

    if (!selectElement) {
        console.warn("[EventHandlers onMIDISuccess] MIDI input select element not found in UI cache.");
        return;
    }

    selectElement.innerHTML = '<option value="">No MIDI Input</option>'; 
    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
        if (input.value) {
            const option = document.createElement('option');
            option.value = input.value.id;
            option.textContent = input.value.name || `Unknown MIDI Device ${input.value.id.slice(-4)}`;
            selectElement.appendChild(option);
        }
    }

    const activeMIDIId = getActiveMIDIInputState()?.id; 
    if (activeMIDIId) {
        selectElement.value = activeMIDIId;
    }

    midiAccess.onstatechange = (event) => {
        console.log(`[MIDI] State change: ${event.port.name}, State: ${event.port.state}, Type: ${event.port.type}`);
        setupMIDI(); 
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`MIDI device ${event.port.name} ${event.port.state}.`, 2500);
        }
    };
}

function onMIDIFailure(msg) {
    console.error(`[MIDI] Failed to get MIDI access - ${msg}`);
    showNotification(`Failed to access MIDI devices: ${msg.toString()}`, 4000);
}

export function selectMIDIInput(deviceId, silent = false) {
    try {
        const midi = getMidiAccessState(); 
        const currentActiveInput = getActiveMIDIInputState(); 

        if (currentActiveInput && typeof currentActiveInput.close === 'function') {
            currentActiveInput.onmidimessage = null; 
            try {
                currentActiveInput.close();
            } catch (e) {
                console.warn(`[MIDI] Error closing previously active input "${currentActiveInput.name}":`, e.message);
            }
        }

        if (deviceId && midi && midi.inputs) {
            const input = midi.inputs.get(deviceId);
            if (input) {
                input.open().then((port) => {
                    port.onmidimessage = handleMIDIMessage;
                    if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(port);
                    if (!silent && localAppServices.showNotification) localAppServices.showNotification(`MIDI Input: ${port.name} selected.`, 2000);
                    console.log(`[MIDI] Input selected: ${port.name}`);
                }).catch(err => {
                    console.error(`[MIDI] Error opening port ${input.name}:`, err);
                    if (!silent && localAppServices.showNotification) localAppServices.showNotification(`Error opening MIDI port: ${input.name}`, 3000);
                    if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(null); 
                });
            } else {
                if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(null);
                if (!silent && deviceId !== "" && localAppServices.showNotification) showNotification("Selected MIDI input not found.", 2000);
                console.warn(`[MIDI] Input with ID ${deviceId} not found.`);
            }
        } else {
            if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(null);
            if (!silent && deviceId !== "" && localAppServices.showNotification) showNotification("MIDI input disconnected.", 2000);
        }
    } catch (error) {
        console.error("[EventHandlers selectMIDIInput] Error:", error);
        if (!silent && localAppServices.showNotification) localAppServices.showNotification("Error selecting MIDI input.", 3000);
    }
}

function handleMIDIMessage(message) {
    try {
        const [status, data1, data2] = message.data;
        const command = status & 0xF0; // Extract command (upper 4 bits)
        const channel = status & 0x0F; // Extract channel (lower 4 bits)
        const note = data1;
        const velocity = data2;
        
        const armedTrackId = getArmedTrackId();
        const armedTrack = armedTrackId !== null ? getTrackById(armedTrackId) : null;
        const midiIndicator = localAppServices.uiElementsCache?.midiIndicatorGlobal;

        if (midiIndicator) {
            midiIndicator.classList.add('active');
            setTimeout(() => midiIndicator.classList.remove('active'), 100);
        }

        // Handle MIDI Learn mode
        if (localAppServices.getMidiLearnMode && localAppServices.getMidiLearnMode()) {
            // In learn mode - capture CC messages for mapping
            if (command === 176) { // CC message
                const ccNumber = note;
                const ccValue = velocity;
                const learnTarget = localAppServices.getMidiLearnTarget ? localAppServices.getMidiLearnTarget() : null;
                
                if (learnTarget) {
                    // Create the mapping
                    if (localAppServices.addMidiMapping) {
                        localAppServices.addMidiMapping(ccNumber, channel, learnTarget);
                    }
                    
                    // Exit learn mode
                    if (localAppServices.setMidiLearnMode) {
                        localAppServices.setMidiLearnMode(false);
                    }
                    
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification(`Mapped CC${ccNumber} to ${learnTarget.paramPath}`, 2000);
                    }
                    
                    console.log(`[MIDI Learn] Mapped CC${ccNumber} ch${channel} to:`, learnTarget);
                    return;
                }
            }
        }

        // Handle CC messages for mapped parameters
        if (command === 176) { // CC message (176 = 0xB0)
            const ccNumber = note;
            const ccValue = velocity; // 0-127
            const normalizedValue = ccValue / 127; // 0-1
            const channelNum = channel;
            
            // Update CC visualizer
            if (localAppServices.updateCcVisualizerValue) {
                localAppServices.updateCcVisualizerValue(ccNumber, channelNum, normalizedValue);
            }
            
            // Record CC if recording is enabled
            if (localAppServices.getCcRecordingEnabled && localAppServices.getCcRecordingEnabled()) {
                const recordingStartTime = localAppServices.getCcRecordingStartTime ? localAppServices.getCcRecordingStartTime() : 0;
                const currentTime = Tone.Transport.seconds;
                const relativeTime = currentTime - recordingStartTime;
                
                if (relativeTime >= 0) {
                    const ccKey = `cc${ccNumber}_channel${channelNum}`;
                    if (localAppServices.addCcRecordingPoint) {
                        localAppServices.addCcRecordingPoint(ccKey, relativeTime, normalizedValue);
                    }
                }
            }
            
            // Check if this CC is mapped to something
            const mapping = localAppServices.getMidiMappingForCC ? localAppServices.getMidiMappingForCC(ccNumber, channel) : null;
            
            if (mapping) {
                applyMidiMapping(mapping, normalizedValue);
                return;
            }
        }

        // Handle Note On/Off for armed track
        if (!armedTrack) return;

        // Check MIDI channel filtering for armed track
        if (armedTrack.midiChannel !== 0 && armedTrack.midiChannel !== (channel + 1)) {
            // Track is set to a specific MIDI channel, but this message is on a different channel
            return;
        }

        const isNoteOn = command === 144 && velocity > 0;
        const isNoteOff = command === 128 || (command === 144 && velocity === 0);

        // Handle different track types
        if (armedTrack.type === 'DrumSampler') {
            // DrumSampler: MIDI notes 36-43 map to pads 0-7
            const padIndex = note - Constants.samplerMIDINoteStart;
            if (padIndex >= 0 && padIndex < Constants.numDrumSamplerPads) {
                const player = armedTrack.drumPadPlayers[padIndex];
                const padData = armedTrack.drumSamplerPads[padIndex];
                if (player && !player.disposed && player.loaded && padData) {
                    if (isNoteOn) {
                        player.volume.value = Tone.gainToDb((padData.volume || 0.7) * (velocity / 127) * 0.7);
                        player.playbackRate = Math.pow(2, (padData.pitchShift || 0) / 12);
                        player.start(Tone.now());
                    }
                }
            }
        } else if (armedTrack.type === 'InstrumentSampler') {
            // InstrumentSampler: uses toneSampler with chromatic mapping
            if (armedTrack.toneSampler && !armedTrack.toneSampler.disposed && armedTrack.toneSampler.loaded) {
                const freq = Tone.Frequency(note, "midi").toNote();
                if (isNoteOn) {
                    armedTrack.toneSampler.triggerAttack(freq, Tone.now(), velocity / 127);
                } else if (isNoteOff) {
                    armedTrack.toneSampler.triggerRelease(freq, Tone.now() + 0.05);
                }
            }
        } else if (armedTrack.type === 'Synth') {
            // Synth: uses instrument.triggerAttack/triggerRelease
            if (armedTrack.instrument && !armedTrack.instrument.disposed) {
                const freq = Tone.Frequency(note, "midi").toNote();
                if (isNoteOn) {
                    if (typeof armedTrack.instrument.triggerAttack === 'function') {
                        armedTrack.instrument.triggerAttack(freq, Tone.now(), velocity / 127);
                    }
                } else if (isNoteOff) {
                    if (typeof armedTrack.instrument.triggerRelease === 'function') {
                        armedTrack.instrument.triggerRelease(freq, Tone.now() + 0.05);
                    }
                }
            }
        }
    } catch (error) {
        console.error("[EventHandlers handleMIDIMessage] Error:", error, "Message Data:", message.data);
    }
}

/**
 * Applies a MIDI mapping to control a parameter.
 */
function applyMidiMapping(mapping, normalizedValue) {
    const { type, targetId, paramPath, min, max } = mapping;
    const actualValue = min + (normalizedValue * (max - min));
    
    try {
        if (type === 'master') {
            // Master parameter
            if (paramPath === 'volume') {
                if (localAppServices.setActualMasterVolume) {
                    localAppServices.setActualMasterVolume(actualValue);
                }
            } else if (paramPath.startsWith('effects.')) {
                // Master effect parameter: effects.0.wet
                const parts = paramPath.split('.');
                const effectIndex = parseInt(parts[1], 10);
                const paramName = parts[2];
                const masterEffects = localAppServices.getMasterEffects ? localAppServices.getMasterEffects() : [];
                if (masterEffects[effectIndex]) {
                    if (localAppServices.updateMasterEffectParam) {
                        localAppServices.updateMasterEffectParam(masterEffects[effectIndex].id, paramName, actualValue);
                    }
                }
            }
        } else if (type === 'track' && targetId !== null) {
            // Track parameter
            const track = getTrackById(targetId);
            if (!track) return;
            
            if (paramPath === 'volume') {
                track.setVolume(actualValue, false);
            } else if (paramPath === 'pan') {
                track.setPan(actualValue, false);
            } else if (paramPath.startsWith('effects.')) {
                // Track effect parameter: effects.0.wet
                const parts = paramPath.split('.');
                const effectIndex = parseInt(parts[1], 10);
                const paramName = parts[2];
                const trackEffects = track.effects || [];
                if (trackEffects[effectIndex] && trackEffects[effectIndex].params) {
                    trackEffects[effectIndex].params[paramName] = actualValue;
                    if (trackEffects[effectIndex].toneNode && trackEffects[effectIndex].toneNode[paramName]) {
                        trackEffects[effectIndex].toneNode[paramName].value = actualValue;
                    }
                }
            }
        }
    } catch (error) {
        console.error('[MIDI Mapping] Error applying mapping:', error);
    }
}

const keyToMIDIMap = Constants.computerKeySynthMap || { 
    'a': 48, 'w': 49, 's': 50, 'e': 51, 'd': 52, 'f': 53, 't': 54, 'g': 55, 'y': 56, 'h': 57, 'u': 58, 'j': 59, 'k': 60
};


if (typeof document !== 'undefined') {
document.addEventListener('keydown', (event) => {
    try {
        if (event.repeat) return;
        const key = event.key.toLowerCase();
        const kbdIndicator = localAppServices.uiElementsCache?.keyboardIndicatorGlobal;

        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            if (key === 'escape') activeEl.blur();
            return; 
        }
        if (event.metaKey || event.ctrlKey) {
            if (!( (event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y'))) { 
                 return;
            }
        }

        if (key === 'z' && (event.ctrlKey || event.metaKey)) {
            if (localAppServices.undoLastAction) localAppServices.undoLastAction();
            return;
        }
        if (key === 'y' && (event.ctrlKey || event.metaKey)) {
             if (localAppServices.redoLastAction) localAppServices.redoLastAction();
            return;
        }
        if (key === 'z' && !(event.ctrlKey || event.metaKey)) {
            currentOctaveShift = Math.max(MIN_OCTAVE_SHIFT, currentOctaveShift - 1);
            if (localAppServices.showNotification) localAppServices.showNotification(`Octave: ${currentOctaveShift}`, 1000);
            return;
        }
        if (key === 'x' && !(event.ctrlKey || event.metaKey)) {
            currentOctaveShift = Math.min(MAX_OCTAVE_SHIFT, currentOctaveShift + 1);
            if (localAppServices.showNotification) localAppServices.showNotification(`Octave: ${currentOctaveShift}`, 1000);
            return;
        }
        if (key === ' ' && !(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'))) { 
            event.preventDefault(); 
            const playBtn = localAppServices.uiElementsCache?.playBtnGlobal;
            if (playBtn) playBtn.click();
            return;
        }
        if (key === 'Enter' && !(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'))) { 
            event.preventDefault(); 
            const recordBtn = localAppServices.uiElementsCache?.recordBtnGlobal;
            if (recordBtn) recordBtn.click();
            return;
        }
        if (key === 'Escape' || key === 'esc') {
            const allWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : [];
            allWindows.forEach(w => { if (w.close) w.close(); });
            if (localAppServices.showNotification) localAppServices.showNotification('Closed all windows', 800);
            return;
        }
        if (key === 'arrowleft') {
            const currentTempo = Tone.Transport.bpm.value;
            const newTempo = Math.max(Constants.MIN_TEMPO, currentTempo - 0.1);
            Tone.Transport.bpm.value = newTempo;
            if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
            const input = localAppServices.uiElementsCache?.tempoGlobalInput;
            if (input) input.value = newTempo.toFixed(1);
            return;
        }
        if (key === 'arrowright') {
            const currentTempo = Tone.Transport.bpm.value;
            const newTempo = Math.min(Constants.MAX_TEMPO, currentTempo + 0.1);
            Tone.Transport.bpm.value = newTempo;
            if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
            const input = localAppServices.uiElementsCache?.tempoGlobalInput;
            if (input) input.value = newTempo.toFixed(1);
            return;
        }
        if (key === 'm' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.toggleMute) localAppServices.toggleMute(-1);
            return;
        }
        if (key === 's' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.toggleSolo) localAppServices.toggleSolo(-1);
            return;
        }
        if (key === 'r' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.toggleRecordArm) localAppServices.toggleRecordArm(-1);
            return;
        }
        
        const midNote = keyToMIDIMap[key];
        if (midNote !== undefined) {
            if (localAppServices.uiElementsCache?.keyboardIndicatorGlobal) {
                localAppServices.uiElementsCache.keyboardIndicatorGlobal.textContent = key.toUpperCase();
                localAppServices.uiElementsCache.keyboardIndicatorGlobal.style.fill = 'var(--theme-keyboard-key-active, #00ff88)';
                setTimeout(() => {
                    if (localAppServices.uiElementsCache?.keyboardIndicatorGlobal) {
                        localAppServices.uiElementsCache.keyboardIndicatorGlobal.textContent = key.toUpperCase();
                        localAppServices.uiElementsCache.keyboardIndicatorGlobal.style.fill = ''; 
                    }
                }, 100);
            }
            if (localAppServices.handleComputerKeyOn) localAppServices.handleComputerKeyOn(midNote + (currentOctaveShift * 12));
            return;
        }
    } catch (error) {
        console.error("[EventHandlers keydown] Error:", error);
    }
});
}

if (typeof document !== 'undefined') {
document.addEventListener('keyup', (event) => {
    let armedTrack = null; 
    let midiNote = undefined;
    let freq = ''; 

    try {
        const key = event.key.toLowerCase();
        const kbdIndicator = localAppServices.uiElementsCache?.keyboardIndicatorGlobal;
        if (kbdIndicator) kbdIndicator.classList.remove('active');

        const armedTrackId = getArmedTrackId();
        armedTrack = armedTrackId !== null ? getTrackById(armedTrackId) : null; 

        if (!armedTrack || !armedTrack.instrument || typeof armedTrack.instrument.triggerRelease !== 'function' || armedTrack.instrument.disposed) {
            Object.keys(currentlyPressedComputerKeys).forEach(noteKey => delete currentlyPressedComputerKeys[noteKey]);
            return;
        }

        midiNote = keyToMIDIMap[event.key]; 
        if (midiNote === undefined && keyToMIDIMap[key]) midiNote = keyToMIDIMap[key]; 

        if (midiNote !== undefined && currentlyPressedComputerKeys[midiNote]) {
            const finalNote = midiNote + (currentOctaveShift * 12);
             if (finalNote >=0 && finalNote <= 127) { 
                freq = Tone.Frequency(finalNote, "midi").toNote(); 
                armedTrack.instrument.triggerRelease(freq, Tone.now()); 
            }
            delete currentlyPressedComputerKeys[midiNote];
        }
    } catch (error) {
        console.error("[EventHandlers Keyup] Error during specific note release:", error, 
            "Key:", event.key, 
            "Armed Track ID:", armedTrack ? armedTrack.id : 'N/A',
            "Instrument Type:", armedTrack && armedTrack.instrument ? armedTrack.instrument.name : 'N/A', 
            "Target Frequency:", freq,
            "Calculated MIDI Note:", midiNote
        );
        
        if (armedTrack && armedTrack.instrument && typeof armedTrack.instrument.releaseAll === 'function' && !armedTrack.instrument.disposed) {
            try {
                console.warn(`[EventHandlers Keyup] Forcing releaseAll on ${armedTrack.name} (instrument: ${armedTrack.instrument.name}) due to error on keyup for note ${freq || 'unknown'}.`);
                armedTrack.instrument.releaseAll(Tone.now());
            } catch (releaseAllError) {
                console.error("[EventHandlers Keyup] Error during emergency releaseAll:", releaseAllError);
            }
        }

        if (midiNote !== undefined && currentlyPressedComputerKeys[midiNote]) {
            delete currentlyPressedComputerKeys[midiNote];
        }
    }
});
}


// --- Track Control Handlers ---
export function handleTrackMute(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Mute: Track ${trackId} not found.`); return; }
        captureStateForUndo(`Toggle Mute for ${track.name}`);
        track.isMuted = !track.isMuted;
        track.applyMuteState();
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'muteChanged');
    } catch (error) { console.error(`[EventHandlers handleTrackMute] Error for track ${trackId}:`, error); }
}

export function handleTrackSolo(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Solo: Track ${trackId} not found.`); return; }
        const currentSoloed = getSoloedTrackId();
        captureStateForUndo(`Toggle Solo for ${track.name}`);
        setSoloedTrackId(currentSoloed === trackId ? null : trackId);

        const tracks = getTracks();
        if (tracks && Array.isArray(tracks)) {
            tracks.forEach(t => {
                if (t) {
                    t.isSoloed = (t.id === getSoloedTrackId());
                    t.applySoloState();
                    if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
                }
            });
        }
    } catch (error) { console.error(`[EventHandlers handleTrackSolo] Error for track ${trackId}:`, error); }
}

export function handleTrackSoloExclusive(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Exclusive Solo: Track ${trackId} not found.`); return; }
        const currentSoloed = getSoloedTrackId();
        const isCurrentlyExclusiveSoloed = currentSoloed === trackId && !track.isSoloed;
        
        captureStateForUndo(`Exclusive Solo for ${track.name}`);
        
        if (isCurrentlyExclusiveSoloed || currentSoloed !== trackId) {
            setSoloedTrackId(trackId);
            const tracks = getTracks();
            if (tracks && Array.isArray(tracks)) {
                tracks.forEach(t => {
                    if (t) {
                        t.isSoloed = (t.id === trackId);
                        t.applySoloState();
                        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
            if (localAppServices.showNotification) localAppServices.showNotification(`Exclusive Solo: ${track.name}`, 1500);
        } else {
            setSoloedTrackId(null);
            const tracks = getTracks();
            if (tracks && Array.isArray(tracks)) {
                tracks.forEach(t => {
                    if (t) {
                        t.isSoloed = false;
                        t.applySoloState();
                        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
            if (localAppServices.showNotification) localAppServices.showNotification('All tracks unsoloed.', 1500);
        }
    } catch (error) { console.error(`[EventHandlers handleTrackSoloExclusive] Error for track ${trackId}:`, error); }
}

export function handleTrackArm(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Arm: Track ${trackId} not found.`); return; }
        const currentArmedId = getArmedTrackId();
        const isCurrentlyArmed = currentArmedId === track.id;
        captureStateForUndo(`${isCurrentlyArmed ? "Disarm" : "Arm"} Track "${track.name}" for Input`);
        setArmedTrackId(isCurrentlyArmed ? null : track.id);

        const newArmedTrack = getTrackById(getArmedTrackId()); 
        const notificationMessage = newArmedTrack ? `${newArmedTrack.name} armed for input.` : "All tracks disarmed.";
        if (localAppServices.showNotification) localAppServices.showNotification(notificationMessage, 1500);
        else showNotification(notificationMessage, 1500); 

        const tracks = getTracks();
        if (tracks && Array.isArray(tracks)) {
            tracks.forEach(t => {
                if (t && localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'armChanged');
            });
        }
    } catch (error) { console.error(`[EventHandlers handleTrackArm] Error for track ${trackId}:`, error); }
}

export function handleRemoveTrack(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Remove: Track ${trackId} not found.`); return; }
        if (typeof showConfirmationDialog !== 'function') {
            console.error("[EventHandlers] showConfirmationDialog function not available.");
            if (confirm(`Are you sure you want to remove track "${track.name}"? This can be undone.`)) {
                if (localAppServices.removeTrack) localAppServices.removeTrack(trackId);
                else coreRemoveTrackFromState(trackId); 
            }
            return;
        }
        showConfirmationDialog(
            'Confirm Delete Track',
            `Are you sure you want to remove track "${track.name}"? This can be undone.`,
            () => {
                if (localAppServices.removeTrack) {
                    localAppServices.removeTrack(trackId);
                } else {
                    console.warn("[EventHandlers] removeTrack service not available, calling coreRemoveTrackFromState.");
                    coreRemoveTrackFromState(trackId);
                }
            }
        );
    } catch (error) { console.error(`[EventHandlers handleRemoveTrack] Error for track ${trackId}:`, error); }
}

export function handleBounceTrack(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) {
            console.warn(`[EventHandlers] Bounce: Track ${trackId} not found.`);
            return;
        }
        
        // Check if track has content to bounce
        if (track.type === 'Audio' && (!track.timelineClips || track.timelineClips.length === 0)) {
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Track "${track.name}" has no audio clips to bounce.`, 3000);
            }
            return;
        }
        
        if (track.type !== 'Audio') {
            const activeSeq = track.getActiveSequence();
            if (!activeSeq || activeSeq.length === 0) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification(`Track "${track.name}" has no notes to bounce.`, 3000);
                }
                return;
            }
        }
        
        // Open bounce dialog
        if (localAppServices.showBounceTrackDialog) {
            localAppServices.showBounceTrackDialog(trackId);
        } else {
            console.error("[EventHandlers] showBounceTrackDialog service not available.");
        }
    } catch (error) {
        console.error(`[EventHandlers handleBounceTrack] Error for track ${trackId}:`, error);
    }
}

export function handleDuplicateTrack(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Duplicate: Track ${trackId} not found.`); return; }
        if (localAppServices.duplicateTrack) {
            localAppServices.duplicateTrack(trackId);
        } else {
            console.warn("[EventHandlers] duplicateTrack service not available.");
        }
    } catch (error) { console.error(`[EventHandlers handleDuplicateTrack] Error for track ${trackId}:`, error); }
}

export function handleTrackFreeze(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) {
            console.warn(`[EventHandlers] Freeze: Track ${trackId} not found.`);
            return;
        }
        
        if (track.frozen) {
            // Unfreeze the track
            if (typeof track.unfreeze === 'function') {
                track.unfreeze();
            } else {
                console.warn("[EventHandlers] unfreeze method not available on track.");
            }
        } else {
            // Freeze the track
            if (typeof track.freeze === 'function') {
                track.freeze();
            } else {
                console.warn("[EventHandlers] freeze method not available on track.");
            }
        }
    } catch (error) { console.error(`[EventHandlers handleTrackFreeze] Error for track ${trackId}:`, error); }
}

export function handleTrackArchive(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) {
            console.warn(`[EventHandlers] Archive: Track ${trackId} not found.`);
            return;
        }
        
        captureStateForUndo(`Toggle Archive for ${track.name}`);
        track.isArchived = !track.isArchived;
        
        if (track.isArchived) {
            // Stop playback and mute the track when archiving
            if (typeof track.stopPlayback === 'function') {
                track.stopPlayback();
            }
            if (!track.isMuted) {
                track.isMuted = true;
                track.applyMuteState();
            }
            console.log(`[EventHandlers] Archived track ${track.name}`);
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Archived track: ${track.name}`, 2000);
            }
        } else {
            console.log(`[EventHandlers] Unarchived track ${track.name}`);
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Unarchived track: ${track.name}`, 2000);
            }
        }
        
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'archiveChanged');
        if (localAppServices.updateMixerWindow) localAppServices.updateMixerWindow();
        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    } catch (error) { console.error(`[EventHandlers handleTrackArchive] Error for track ${trackId}:`, error); }
}

export function handleOpenTrackInspector(trackId) {
    if (localAppServices.openTrackInspectorWindow) {
        localAppServices.openTrackInspectorWindow(trackId);
    } else { console.error("[EventHandlers] openTrackInspectorWindow service not available."); }
}
export function handleOpenEffectsRack(trackId) {
    if (localAppServices.openTrackEffectsRackWindow) {
        localAppServices.openTrackEffectsRackWindow(trackId);
    } else { console.error("[EventHandlers] openTrackEffectsRackWindow service not available."); }
}
export function handleOpenSequencer(trackId) {
    if (localAppServices.openTrackSequencerWindow) {
        localAppServices.openTrackSequencerWindow(trackId);
    } else { console.error("[EventHandlers] openTrackSequencerWindow service not available."); }
}

function toggleFullScreen() {
    try {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                const message = `Error attempting to enable full-screen mode: ${err.message} (${err.name})`;
                if (localAppServices.showNotification) localAppServices.showNotification(message, 3000);
                else showNotification(message, 3000);
                console.error(message, err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    } catch (error) {
        console.error("[EventHandlers toggleFullScreen] Error:", error);
        if (localAppServices.showNotification) localAppServices.showNotification("Fullscreen toggle error.", 3000);
    }
}

export async function handleTimelineLaneDrop(event, targetTrackId, startTime, appServicesPassed) {
    const services = appServicesPassed || localAppServices;

    if (!services || !services.getTrackById || !services.showNotification || !services.captureStateForUndo || !services.renderTimeline) {
        console.error("Required appServices not available in handleTimelineLaneDrop");
        utilShowNotification("Internal error handling timeline drop.", 3000); 
        return;
    }

    const targetTrack = services.getTrackById(targetTrackId);
    if (!targetTrack) {
        services.showNotification("Target track not found for drop.", 3000);
        return;
    }

    const jsonDataString = event.dataTransfer.getData('application/json');
    const files = event.dataTransfer.files;

    try {
        if (jsonDataString) {
            const droppedData = JSON.parse(jsonDataString);
            if (droppedData.type === 'sequence-timeline-drag') {
                if (targetTrack.type === 'Audio') {
                    services.showNotification("Cannot place sequence clips on Audio tracks.", 3000);
                    return;
                }
                if (typeof targetTrack.addSequenceClipToTimeline === 'function') {
                    targetTrack.addSequenceClipToTimeline(droppedData.sourceSequenceId, startTime, droppedData.clipName);
                } else {
                    services.showNotification("Error: Track cannot accept sequence clips.", 3000);
                }
            } else if (droppedData.type === 'sound-browser-item') {
                if (targetTrack.type !== 'Audio') {
                    services.showNotification("Sound browser audio files can only be dropped onto Audio Track timeline lanes.", 3000);
                    return;
                }
                if (services.getAudioBlobFromSoundBrowserItem && typeof targetTrack.addExternalAudioFileAsClip === 'function') {
                    const audioBlob = await services.getAudioBlobFromSoundBrowserItem(droppedData);
                    if (audioBlob) {
                        targetTrack.addExternalAudioFileAsClip(audioBlob, startTime, droppedData.fileName);
                    } else {
                        services.showNotification(`Could not load audio for "${droppedData.fileName}".`, 3000);
                    }
                } else {
                     services.showNotification("Error: Cannot process sound browser item for timeline.", 3000);
                }
            } else {
                services.showNotification("Unrecognized item dropped on timeline.", 2000);
            }
        } else if (files && files.length > 0) {
            const file = files[0];
            if (targetTrack.type !== 'Audio') {
                services.showNotification("Audio files can only be dropped onto Audio Track timeline lanes.", 3000);
                return;
            }
            if (file.type.startsWith('audio/')) {
                if (typeof targetTrack.addExternalAudioFileAsClip === 'function') {
                    targetTrack.addExternalAudioFileAsClip(file, startTime, file.name);
                } else {
                    services.showNotification("Error: Track cannot accept audio file clips.", 3000);
                }
            } else {
                services.showNotification("Invalid file type. Please drop an audio file.", 3000);
            }
        } else {
            console.log("[EventHandlers handleTimelineLaneDrop] No recognized data in drop event for timeline.");
        }
    } catch (e) {
        console.error("[EventHandlers handleTimelineLaneDrop] Error processing dropped data:", e);
        services.showNotification("Error processing dropped item.", 3000);
    }
}

// --- MIDI File Import/Export Functions ---

export function handleMIDIDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
        console.log('[MIDI Drop] No files in drop event');
        return;
    }

    const file = files[0];
    const fileName = file.name.toLowerCase();

    // Check if it's a MIDI file
    if (!fileName.endsWith('.mid') && !fileName.endsWith('.midi') && file.type !== 'audio/midi' && file.type !== 'audio/x-midi') {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Please drop a .mid MIDI file.', 3000);
        }
        return;
    }

    console.log('[MIDI Drop] Processing MIDI file:', file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const arrayBuffer = e.target.result;
            const midiData = parseMidiFile(arrayBuffer);

            if (!midiData || !midiData.notes || midiData.notes.length === 0) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('No notes found in MIDI file.', 3000);
                }
                return;
            }

            // Get first non-audio track or create one
            let targetTrack = null;
            const tracks = getTracks();
            for (const t of tracks) {
                if (t.type !== 'Audio') {
                    targetTrack = t;
                    break;
                }
            }

            // If no track found, create a synth track
            if (!targetTrack && localAppServices.addTrack) {
                targetTrack = await localAppServices.addTrack('Synth', { _isUserActionPlaceholder: true });
            }

            if (!targetTrack) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('No suitable track found for MIDI import.', 3000);
                }
                return;
            }

            // Capture state for undo
            captureStateForUndo(`Import MIDI to ${targetTrack.name}`);

            // Get the active sequence
            const activeSeq = targetTrack.getActiveSequence();
            if (!activeSeq) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('Track has no sequence to import to.', 3000);
                }
                return;
            }

            // Convert MIDI notes to sequence data
            const targetSteps = activeSeq.length || Constants.defaultStepsPerBar;
            const sequenceData = midiNotesToSequenceData(midiData, targetSteps);

            // Apply to the track's sequence
            if (sequenceData && sequenceData.length > 0) {
                // Merge with existing sequence data
                const existingData = activeSeq.data || [];
                for (let row = 0; row < Math.min(sequenceData.length, existingData.length); row++) {
                    for (let step = 0; step < targetSteps; step++) {
                        if (sequenceData[row][step] && sequenceData[row][step].active) {
                            existingData[row][step] = sequenceData[row][step];
                        }
                    }
                }
                activeSeq.data = existingData;

                // Recreate the Tone.Sequence
                if (typeof targetTrack.recreateToneSequence === 'function') {
                    targetTrack.recreateToneSequence(true);
                }

                // Update UI
                if (localAppServices.updateTrackUI) {
                    localAppServices.updateTrackUI(targetTrack.id, 'sequencerContentChanged');
                }

                if (localAppServices.showNotification) {
                    localAppServices.showNotification(`Imported ${midiData.notes.length} notes to ${targetTrack.name}.`, 3000);
                }
            }
        } catch (error) {
            console.error('[MIDI Drop] Error parsing MIDI file:', error);
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Error parsing MIDI file: ' + error.message, 4000);
            }
        }
    };

    reader.onerror = (e) => {
        console.error('[MIDI Drop] FileReader error:', e);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Error reading MIDI file.', 3000);
        }
    };

    reader.readAsArrayBuffer(file);
}

export function handleMIDIDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
}

export function exportTrackToMIDI(trackId) {
    const track = getTrackById(trackId);
    if (!track) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Track not found.', 2000);
        }
        return null;
    }

    if (track.type === 'Audio') {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Audio tracks cannot be exported to MIDI.', 3000);
        }
        return null;
    }

    const activeSeq = track.getActiveSequence();
    if (!activeSeq || !activeSeq.data) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('No sequence data to export.', 3000);
        }
        return null;
    }

    try {
        const tempoBPM = Tone.Transport.bpm.value || 120;
        const midiBytes = encodeSequenceToMidi(activeSeq.data, activeSeq.length, {
            tempoBPM: tempoBPM,
            trackName: track.name,
            channel: 0
        });

        // Create blob and download
        const blob = new Blob([midiBytes], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${track.name.replace(/[^a-zA-Z0-9]/g, '_')}.mid`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Exported ${track.name} to MIDI.`, 3000);
        }

        console.log('[MIDI Export] Exported track', track.name, 'with', activeSeq.length, 'steps');
        return true;
    } catch (error) {
        console.error('[MIDI Export] Error exporting track:', error);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Error exporting to MIDI: ' + error.message, 4000);
        }
        return false;
    }
}

// Initialize MIDI drop zone on desktop
export function initializeMIDIDropZone(desktopElement) {
    if (!desktopElement) {
        console.warn('[MIDI DropZone] Desktop element not provided');
        return;
    }

    // Add MIDI drop listeners
    desktopElement.addEventListener('dragover', handleMIDIDragOver);
    desktopElement.addEventListener('drop', handleMIDIDrop);

    console.log('[MIDI DropZone] MIDI drop zone initialized on desktop');
}
