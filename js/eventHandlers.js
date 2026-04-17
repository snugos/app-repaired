// js/eventHandlers.js - Global Event Listeners and Input Handling Module
import * as Constants from './constants.js';
import { showNotification, showConfirmationDialog, createContextMenu, showCustomModal } from './utils.js';
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
    setRecordingStartTimeState as setRecordingStartTime,
    removeTrackFromStateInternal as coreRemoveTrackFromState,
    getPlaybackModeState,
    setPlaybackModeState,
    getMidiAccessState, 
    getActiveMIDIInputState
} from './state.js';

import { isMetronomeEnabled, getCountInBars, isCountInActive, startCountIn, getPunchRegion, setPunchRegion, setPunchRegionEnabled, isPunchRegionEnabled } from './audio.js';

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
                    { label: "Remove Custom Background", action: () => { if(services.removeCustomDesktopBackground) services.removeCustomDesktopBackground(); } },
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
            menuAddSynthTrack: () => services.addTrack?.('Synth', {_isUserActionPlaceholder: true}),
            menuAddSamplerTrack: () => services.addTrack?.('Sampler', {_isUserActionPlaceholder: true}),
            menuAddDrumSamplerTrack: () => services.addTrack?.('DrumSampler', {_isUserActionPlaceholder: true}),
            menuAddInstrumentSamplerTrack: () => services.addTrack?.('InstrumentSampler', {_isUserActionPlaceholder: true}),
            menuAddAudioTrack: () => services.addTrack?.('Audio', {_isUserActionPlaceholder: true}),
            menuOpenSoundBrowser: () => services.openSoundBrowserWindow?.(),
            menuOpenTimeline: () => services.openTimelineWindow?.(),
            menuOpenGlobalControls: () => services.openGlobalControlsWindow?.(),
            menuOpenMixer: () => services.openMixerWindow?.(),
            menuOpenMasterEffects: () => services.openMasterEffectsRackWindow?.(),
            menuUndo: () => services.undoLastAction?.(),
            menuRedo: () => services.redoLastAction?.(),
            menuSaveProject: () => services.saveProject?.(),
            menuLoadProject: () => services.loadProject?.(),
            menuExportWav: () => services.exportToWav?.(),
            menuToggleFullScreen: toggleFullScreen,
            menuTetris: () => window.open("https://snugos.github.io/app/tetris.html", "_blank"),
        };

        for (const menuItemId in menuActions) {
            if (uiCache[menuItemId]) {
                uiCache[menuItemId].addEventListener('click', () => {
                    menuActions[menuItemId]();
                    if (uiCache.startMenu) uiCache.startMenu.classList.add('hidden');
                });
            } else {
                console.log(`[Menu] Element not found: ${menuItemId}`);
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
        console.error("[EventHandlers attachGlobalControlEvents] Elements object is null or undefined.");
        return;
    }
    const { playBtnGlobal, recordBtnGlobal, stopBtnGlobal, tempoGlobalInput, midiInputSelectGlobal, playbackModeToggleBtnGlobal, shortcutsBtnGlobal } = elements;

    // Shortcuts button
    if (shortcutsBtnGlobal) {
        shortcutsBtnGlobal.addEventListener('click', () => {
            showKeyboardShortcutsModal();
        });
    } else {
        console.warn("[EventHandlers] shortcutsBtnGlobal not found in provided elements.");
    }

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

                    const countInBars = getCountInBars();
                    const metronomeOn = isMetronomeEnabled();

                    // Helper function to actually start playback
                    const doStartPlayback = () => {
                        transport.loop = true; 
                        transport.loopStart = 0;
                        transport.loopEnd = 3600; 

                        if (!silentKeepAliveBuffer && Tone.context) {
                            try {
                                silentKeepAliveBuffer = Tone.context.createBuffer(1, 1, Tone.context.sampleRate);
                                silentKeepAliveBuffer.getChannelData(0)[0] = 0;
                            } catch (e) { console.error("Error creating silent buffer:", e); silentKeepAliveBuffer = null; }
                        }
                        if (silentKeepAliveBuffer) {
                            transportKeepAliveBufferSource = new Tone.BufferSource(silentKeepAliveBuffer).toDestination();
                            transportKeepAliveBufferSource.loop = true;
                            transportKeepAliveBufferSource.loopEnd = 3600;
                            transportKeepAliveBufferSource.start(Tone.now() + 0.02, 0, transport.loopEnd);
                        }

                        for (const track of tracks) {
                            if (typeof track.schedulePlayback === 'function') {
                                await track.schedulePlayback(startTime, transport.loopEnd);
                            }
                        }
                        transport.start(Tone.now() + 0.05, startTime);
                        playBtnGlobal.textContent = 'Pause';
                        playBtnGlobal.classList.add('playing');
                    };

                    if (countInBars > 0 && !wasPaused && metronomeOn) {
                        // Count-in before playback: schedule count-in then start
                        showNotification(`Count-in: ${countInBars} bar${countInBars > 1 ? 's' : ''}...`, 1500);
                        startCountIn(() => {
                            doStartPlayback();
                        }, 0);
                    } else {
                        // No count-in, start immediately
                        doStartPlayback();
                    }
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
                            // FIX: Capture the recording start position BEFORE starting transport
                            // This ensures we know where recording actually began for accurate timeline placement
                            let recordingStartPosition = Tone.Transport.position;
                            if (Tone.Transport.state !== 'started') { 
                                Tone.Transport.cancel(0); 
                                Tone.Transport.position = 0; 
                                recordingStartPosition = 0; // Reset to 0 if we reset transport
                            }
                            // FIX: Store the transport position (in measures:beats:sixteenths) not seconds
                            // This ensures accurate timeline placement regardless of tempo
                            setRecordingStartTime(recordingStartPosition);
                            recordingInitialized = await localAppServices.startAudioRecording(trackToRecord, trackToRecord.isMonitoringEnabled);
                        } else { console.error("[EventHandlers] startAudioRecording service not available."); showNotification("Recording service unavailable.", 3000); }
                    } else { recordingInitialized = true; } 

                    if (recordingInitialized) {
                        setIsRecording(true);
                        setRecordingTrackId(trackToRecord.id);
                        // FIX: Capture the recording start position BEFORE starting transport
                        // This ensures we know where recording actually began for accurate timeline placement
                        let recordingStartPosition = Tone.Transport.position;
                        if (Tone.Transport.state !== 'started') { 
                            Tone.Transport.cancel(0); 
                            Tone.Transport.position = 0; 
                            recordingStartPosition = 0; // Reset to 0 if we reset transport
                        }
                        // FIX: Store the transport position (in measures:beats:sixteenths) not seconds
                        // This ensures accurate timeline placement regardless of tempo
                        setRecordingStartTime(recordingStartPosition);
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
                if (!silent && localAppServices.showNotification) localAppServices.showNotification("Selected MIDI input not found.", 2000);
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
        const [command, note, velocity] = message.data;
        const armedTrackId = getArmedTrackId();
        const armedTrack = armedTrackId !== null ? getTrackById(armedTrackId) : null;
        const midiIndicator = localAppServices.uiElementsCache?.midiIndicatorGlobal;

        if (midiIndicator) {
            midiIndicator.classList.add('active');
            setTimeout(() => midiIndicator.classList.remove('active'), 100);
        }

        if (!armedTrack) return;

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

const keyToMIDIMap = Constants.computerKeySynthMap || { 
    'a': 48, 'w': 49, 's': 50, 'e': 51, 'd': 52, 'f': 53, 't': 54, 'g': 55, 'y': 56, 'h': 57, 'u': 58, 'j': 59, 'k': 60
};


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

        // Tab - cycle through armed tracks
        if (key === 'tab' && !(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'))) {
            event.preventDefault();
            const tracks = getTracks().filter(t => t && t.instrument && !t.instrument.disposed);
            if (tracks.length === 0) return;
            const currentArmedId = getArmedTrackId();
            const currentIdx = currentArmedId ? tracks.findIndex(t => t.id === currentArmedId) : -1;
            const direction = event.shiftKey ? -1 : 1;
            const nextIdx = currentIdx === -1 ? 0 : (currentIdx + direction + tracks.length) % tracks.length;
            setArmedTrackId(tracks[nextIdx].id);
            showNotification(`Armed: ${tracks[nextIdx].name}`, 1000);
            return;
        }

        // T - Tap Tempo
        if (key === 't') {
            if (typeof tapTempo === 'function') tapTempo();
            const bpm = typeof getTapTempoBpm === 'function' ? getTapTempoBpm() : null;
            if (bpm !== null) {
                Tone.Transport.bpm.value = bpm;
                const tempoInput = document.getElementById('tempoGlobalInput');
                if (tempoInput) tempoInput.value = bpm;
                showNotification(`Tempo: ${bpm} BPM`, 800);
            } else {
                showNotification("Keep tapping...", 500);
            }
            return;
        }

        // L - Toggle loop region
        if (key === 'l') {
            if (typeof isLoopRegionEnabled === 'function' && typeof setLoopRegionEnabled === 'function') {
                const newEnabled = !isLoopRegionEnabled();
                setLoopRegionEnabled(newEnabled);
                showNotification(newEnabled ? "Loop ON" : "Loop OFF", 1500);
            }
            return;
        }

        // P - Toggle punch in/out
        if (key === 'p') {
            if (typeof isPunchRegionEnabled === 'function' && typeof setPunchRegionEnabled === 'function') {
                const newEnabled = !isPunchRegionEnabled();
                setPunchRegionEnabled(newEnabled);
                showNotification(newEnabled ? "Punch In/Out ON" : "Punch In/Out OFF", 1500);
            }
            return;
        }

        // S - Toggle snap-to-grid for sequencer
        if (key === 's' && !(event.ctrlKey || event.metaKey)) {
            const currentSnap = window.SEQUENCER_SNAP_VALUE || 16;
            let nextSnap = 16;
            if (currentSnap === 16) nextSnap = 8;
            else if (currentSnap === 8) nextSnap = 4;
            else if (currentSnap === 4) nextSnap = 0;
            else if (currentSnap === 0) nextSnap = 16;
            window.SEQUENCER_SNAP_VALUE = nextSnap;
            const snapLabel = nextSnap === 0 ? 'Off' : (nextSnap === 4 ? '1/4' : (nextSnap === 8 ? '1/8' : '1/16'));
            showNotification(`Snap: ${snapLabel}`, 1500);
            return;
        }

        // Q - Quantize active sequence (snap notes to grid)
        if (key === 'q') {
            const armedTrackId = getArmedTrackId();
            if (armedTrackId !== null) {
                const track = getTrackById(armedTrackId);
                if (track && typeof track.quantizeSequence === 'function') {
                    const snapValue = window.SEQUENCER_SNAP_VALUE || 16;
                    if (snapValue === 0) {
                        showNotification("Quantize: Snap is Off. Set a snap value first (S key).", 2000);
                        return;
                    }
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Quantize ${track.name}`);
                    const quantized = track.quantizeSequence(snapValue);
                    if (quantized > 0) {
                        track.recreateToneSequence(true);
                        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged');
                        showNotification(`Quantized ${quantized} note(s) to 1/${snapValue}`, 2000);
                    } else {
                        showNotification("No notes to quantize.", 1500);
                    }
                }
            }
            return;
        }

        // ? - show keyboard shortcuts
        if (key === '?') {
            showKeyboardShortcutsModal();
            return;
        }

        let midiNote = keyToMIDIMap[event.key]; 
        if (midiNote === undefined && keyToMIDIMap[key]) midiNote = keyToMIDIMap[key]; 

        if (midiNote !== undefined && !currentlyPressedComputerKeys[midiNote]) {
            if (kbdIndicator) kbdIndicator.classList.add('active');
            const finalNote = midiNote + (currentOctaveShift * 12);
            if (finalNote >=0 && finalNote <= 127 && typeof armedTrack.instrument.triggerAttack === 'function') {
                const freq = Tone.Frequency(finalNote, "midi").toNote();
                armedTrack.instrument.triggerAttack(freq, Tone.now(), 0.7);
                currentlyPressedComputerKeys[midiNote] = true;
            }
        }
    } catch (error) { console.error("[EventHandlers Keydown] Error:", error); }
});

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


// --- Keyboard Shortcuts Overlay ---
export function showKeyboardShortcutsModal() {
    const shortcuts = [
        { section: "Transport", items: [
            { keys: "Space", desc: "Play / Pause" },
            { keys: "Enter", desc: "Stop and Rewind" },
            { keys: "T", desc: "Tap Tempo" },
            { keys: "L", desc: "Toggle Loop Region" },
            { keys: "P", desc: "Toggle Punch In/Out" },
        ]},
        { section: "Sequencer", items: [
            { keys: "S", desc: "Cycle snap grid (Off / 1/4 / 1/8 / 1/16)" },
            { keys: "Q", desc: "Quantize notes to current snap grid" },
            { keys: "Shift+Click", desc: "Transpose notes up 1 semitone" },
        ]},
        { section: "Track Navigation", items: [
            { keys: "Tab", desc: "Cycle to next armed track" },
            { keys: "Shift+Tab", desc: "Cycle to previous armed track" },
        ]},
        { section: "Keyboard Input", items: [
            { keys: "A–Z, 0–9", desc: "Play note on armed track (piano keyboard)" },
            { keys: "Z / X", desc: "Octave shift down / up" },
        ]},
        { section: "Undo / Redo", items: [
            { keys: "Ctrl+Z", desc: "Undo" },
            { keys: "Ctrl+Y", desc: "Redo" },
        ]},
        { section: "General", items: [
            { keys: "?", desc: "Show this shortcut overlay" },
            { keys: "Esc", desc: "Close modal / blur input" },
        ]},
    ];

    let html = `<div style="font-size:0.85rem; min-width: 300px;">`;
    shortcuts.forEach(section => {
        html += `<div style="margin-bottom:12px;">
            <div style="color:#00b0b0; font-weight:bold; margin-bottom:6px; border-bottom:1px solid #3a3a3a; padding-bottom:3px;">${section.section}</div>`;
        section.items.forEach(item => {
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#c0c0c0;">
                <span style="color:#e0e0e0; font-family:monospace; background:#2a2a2a; padding:2px 8px; border-radius:3px; border:1px solid #4a4a4a; min-width:100px; text-align:center;">${item.keys}</span>
                <span style="flex:1; text-align:right; margin-right:10px;">${item.desc}</span>
            </div>`;
        });
        html += `</div>`;
    });
    html += `</div>`;

    showCustomModal("Keyboard Shortcuts", html, [
        { text: "Close", action: () => {} }
    ], 'keyboard-shortcuts-modal');
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
