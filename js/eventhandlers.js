// js/eventHandlers.js - Global Event Listeners and Input Handling Module
import * as Constants from './constants.js';
import { showNotification, showConfirmationDialog, createContextMenu } from './utils.js'; // Added createContextMenu
import {
    getTracksState as getTracks,
    getTrackByIdState as getTrackById,
    captureStateForUndoInternal as captureStateForUndo,
    setSoloedTrackIdState as setSoloedTrackId,
    getSoloedTrackIdState as getSoloedTrackId,
    setArmedTrackIdState as setArmedTrackId,
    getArmedTrackIdState as getArmedTrackId,
    setActiveSequencerTrackIdState as setActiveSequencerTrackId,
    getActiveSequencerTrackIdState as getActiveSequencerTrackId,
    setIsRecordingState as setIsRecording,
    isTrackRecordingState as isTrackRecording,
    setRecordingTrackIdState as setRecordingTrackId,
    getRecordingTrackIdState as getRecordingTrackId,
    setRecordingStartTimeState as setRecordingStartTime,
    removeTrackFromStateInternal as coreRemoveTrackFromState
} from './state.js';

let localAppServices = {};

export function initializeEventHandlersModule(appServicesFromMain) {
    localAppServices = { ...localAppServices, ...appServicesFromMain };
}

export let currentlyPressedComputerKeys = {};
let currentOctaveShift = 0;
const MIN_OCTAVE_SHIFT = -2;
const MAX_OCTAVE_SHIFT = 2;

export function initializePrimaryEventListeners(appContext) {
    const uiCache = appContext.uiElementsCache || {};

    try {
        uiCache.startButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            uiCache.startMenu?.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (uiCache.startMenu && !uiCache.startMenu.classList.contains('hidden') && !uiCache.startMenu.contains(e.target) && e.target !== uiCache.startButton) {
                uiCache.startMenu.classList.add('hidden');
            }
        });

        uiCache.menuAddSynthTrack?.addEventListener('click', () => { localAppServices.addTrack('Synth', {_isUserActionPlaceholder: true}); uiCache.startMenu?.classList.add('hidden'); });
        uiCache.menuAddSamplerTrack?.addEventListener('click', () => { localAppServices.addTrack('Sampler', {_isUserActionPlaceholder: true}); uiCache.startMenu?.classList.add('hidden'); });
        uiCache.menuAddDrumSamplerTrack?.addEventListener('click', () => { localAppServices.addTrack('DrumSampler', {_isUserActionPlaceholder: true}); uiCache.startMenu?.classList.add('hidden'); });
        uiCache.menuAddInstrumentSamplerTrack?.addEventListener('click', () => { localAppServices.addTrack('InstrumentSampler', {_isUserActionPlaceholder: true}); uiCache.startMenu?.classList.add('hidden'); });
        uiCache.menuAddAudioTrack?.addEventListener('click', () => { localAppServices.addTrack('Audio', {_isUserActionPlaceholder: true}); uiCache.startMenu?.classList.add('hidden'); });


        uiCache.menuOpenSoundBrowser?.addEventListener('click', () => { if(localAppServices.openSoundBrowserWindow) localAppServices.openSoundBrowserWindow(); uiCache.startMenu?.classList.add('hidden'); });
        
        // Timeline Menu Item
        const menuOpenTimeline = document.getElementById('menuOpenTimeline'); // Get by ID as it's not in uiCache yet
        if (menuOpenTimeline) {
            menuOpenTimeline.addEventListener('click', () => {
                if (localAppServices.openTimelineWindow) localAppServices.openTimelineWindow();
                if (uiCache.startMenu) uiCache.startMenu.classList.add('hidden');
            });
        }


        uiCache.menuUndo?.addEventListener('click', () => {
            if (!uiCache.menuUndo.classList.contains('disabled') && localAppServices.undoLastAction) {
                localAppServices.undoLastAction(); uiCache.startMenu?.classList.add('hidden');
            }
        });
        uiCache.menuRedo?.addEventListener('click', () => {
            if (!uiCache.menuRedo.classList.contains('disabled') && localAppServices.redoLastAction) {
                localAppServices.redoLastAction(); uiCache.startMenu?.classList.add('hidden');
            }
        });

        uiCache.menuSaveProject?.addEventListener('click', () => { if(localAppServices.saveProject) localAppServices.saveProject(); uiCache.startMenu?.classList.add('hidden'); });
        uiCache.menuLoadProject?.addEventListener('click', () => {
            if (localAppServices.loadProject) localAppServices.loadProject();
            uiCache.startMenu?.classList.add('hidden');
        });
        uiCache.menuExportWav?.addEventListener('click', () => { if(localAppServices.exportToWav) localAppServices.exportToWav(); uiCache.startMenu?.classList.add('hidden'); });

        uiCache.menuOpenGlobalControls?.addEventListener('click', () => { if(localAppServices.openGlobalControlsWindow) localAppServices.openGlobalControlsWindow(attachGlobalControlEvents); uiCache.startMenu?.classList.add('hidden'); });
        uiCache.menuOpenMixer?.addEventListener('click', () => { if(localAppServices.openMixerWindow) localAppServices.openMixerWindow(); uiCache.startMenu?.classList.add('hidden'); });
        uiCache.menuOpenMasterEffects?.addEventListener('click', () => { if(localAppServices.openMasterEffectsRackWindow) localAppServices.openMasterEffectsRackWindow(); uiCache.startMenu?.classList.add('hidden'); });

        // Removed background menu item listeners
        // uiCache.menuUploadCustomBg?.addEventListener('click', ...);
        // uiCache.menuRemoveCustomBg?.addEventListener('click', ...);

        uiCache.menuToggleFullScreen?.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    showNotification(`Error entering full screen: ${err.message}`, 3000);
                });
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
            uiCache.startMenu?.classList.add('hidden');
        });

        uiCache.taskbarTempoDisplay?.addEventListener('click', () => {
            if(localAppServices.openGlobalControlsWindow) localAppServices.openGlobalControlsWindow(attachGlobalControlEvents);
        });

        if (uiCache.loadProjectInput && localAppServices.handleProjectFileLoad) {
            uiCache.loadProjectInput.addEventListener('change', localAppServices.handleProjectFileLoad);
        }

        document.addEventListener('keydown', handleComputerKeyDown);
        document.addEventListener('keyup', handleComputerKeyUp);

        // Desktop Context Menu for Background Options
        if (uiCache.desktop) {
            uiCache.desktop.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                const menuItems = [
                    {
                        label: "Upload Custom Background...",
                        action: () => {
                            if (localAppServices.triggerCustomBackgroundUpload) {
                                localAppServices.triggerCustomBackgroundUpload();
                            } else if (uiCache.customBgInput) { // Fallback if service not yet on appServices
                                uiCache.customBgInput.click();
                            }
                        }
                    },
                    {
                        label: "Remove Custom Background",
                        action: () => {
                            if (localAppServices.removeCustomDesktopBackground) {
                                localAppServices.removeCustomDesktopBackground();
                            }
                        }
                    }
                ];
                createContextMenu(event, menuItems, localAppServices);
            });
        }


        if (typeof Tone !== 'undefined' && Tone.Transport) {
            let transportEventsInitialized = localAppServices.getTransportEventsInitialized ? localAppServices.getTransportEventsInitialized() : false;
            if (!transportEventsInitialized) {
                Tone.Transport.on('start', () => {
                    if (localAppServices.uiElementsCache?.playBtnGlobal) localAppServices.uiElementsCache.playBtnGlobal.textContent = 'Pause';
                });
                Tone.Transport.on('pause', () => {
                    if (localAppServices.uiElementsCache?.playBtnGlobal) localAppServices.uiElementsCache.playBtnGlobal.textContent = 'Play';
                    if (isTrackRecording()) {
                        setIsRecording(false);
                        if(localAppServices.uiElementsCache?.recordBtnGlobal) { localAppServices.uiElementsCache.recordBtnGlobal.textContent = 'Record'; localAppServices.uiElementsCache.recordBtnGlobal.classList.remove('recording');}
                        showNotification("Recording stopped due to transport pause.", 2000);
                        captureStateForUndo(`Stop Recording (transport paused)`);
                        setRecordingTrackId(null);
                    }
                });
                Tone.Transport.on('stop', () => {
                    if (localAppServices.uiElementsCache?.playBtnGlobal) localAppServices.uiElementsCache.playBtnGlobal.textContent = 'Play';
                    document.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));
                    if (isTrackRecording()) {
                        setIsRecording(false);
                        if(localAppServices.uiElementsCache?.recordBtnGlobal) { localAppServices.uiElementsCache.recordBtnGlobal.textContent = 'Record'; localAppServices.uiElementsCache.recordBtnGlobal.classList.remove('recording');}
                        showNotification("Recording stopped due to transport stop.", 2000);
                        captureStateForUndo(`Stop Recording (transport stopped)`);
                        setRecordingTrackId(null);
                    }
                });
                if (localAppServices.setTransportEventsInitialized) localAppServices.setTransportEventsInitialized(true);
            }
        }
    } catch (error) {
        console.error("[EventHandlers] Error during initializePrimaryEventListeners:", error);
    }
}

export function attachGlobalControlEvents(globalControlsElements) {
    if (!globalControlsElements) {
        console.error("[EventHandlers] attachGlobalControlEvents: globalControlsElements is null.");
        return;
    }
    const { playBtnGlobal, recordBtnGlobal, tempoGlobalInput, midiInputSelectGlobal } = globalControlsElements;

    if (playBtnGlobal) {
        playBtnGlobal.addEventListener('click', async () => {
            const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
            if (!audioReady) {
                showNotification("Audio system not ready. Please try again.", 3000);
                return;
            }
            if (Tone.Transport.state !== 'started') {
                Tone.Transport.position = 0;
                document.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));
                
                const tracks = getTracks();
                if (tracks) {
                    tracks.forEach(track => {
                        if (track.type === 'Audio' && typeof track.schedulePlayback === 'function') {
                            track.schedulePlayback(0, Tone.Transport.loopEnd > 0 ? Tone.Transport.loopEnd : 300); 
                        }
                    });
                }
                Tone.Transport.start();

            } else {
                Tone.Transport.pause();
                const tracks = getTracks();
                if (tracks) {
                    tracks.forEach(track => {
                        if (track.type === 'Audio' && typeof track.stopPlayback === 'function') {
                            track.stopPlayback();
                        }
                    });
                }
            }
        });
    }

    if (recordBtnGlobal) {
        recordBtnGlobal.addEventListener('click', async () => {
            const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
            if (!audioReady) {
                showNotification("Audio system not ready for recording.", 3000);
                return;
            }
            if (!isTrackRecording()) {
                const currentArmedTrackId = getArmedTrackId();
                if (currentArmedTrackId === null) {
                    showNotification("No track armed for recording.", 3000);
                    return;
                }
                const trackToRecord = getTrackById(currentArmedTrackId);
                if (!trackToRecord) { showNotification("Armed track not found.", 3000); return; }

                if (trackToRecord.type === 'Audio') {
                    if (localAppServices.startAudioRecording) {
                        await localAppServices.startAudioRecording();
                    } else {
                        showNotification("Audio recording function not available.", 3000);
                        return; 
                    }
                }

                setIsRecording(true);
                setRecordingTrackId(currentArmedTrackId);
                setRecordingStartTime(Tone.Transport.seconds); 
                recordBtnGlobal.textContent = 'Stop Rec'; recordBtnGlobal.classList.add('recording');

                showNotification(`Recording started for ${trackToRecord.name}.`, 2000);
                captureStateForUndo(`Start Recording on ${trackToRecord.name}`);
                if (Tone.Transport.state !== 'started') {
                    Tone.Transport.position = 0;
                    document.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));
                    Tone.Transport.start();
                }
            } else {
                 const recordedTrack = getTrackById(getRecordingTrackId());
                if (recordedTrack && recordedTrack.type === 'Audio') {
                    if (localAppServices.stopAudioRecording) {
                        await localAppServices.stopAudioRecording();
                    } else {
                        showNotification("Audio stopping function not available.", 3000);
                    }
                }
                
                setIsRecording(false);
                recordBtnGlobal.textContent = 'Record'; recordBtnGlobal.classList.remove('recording');
                showNotification("Recording stopped.", 2000);
                captureStateForUndo(`Stop Recording (Track: ${recordedTrack?.name || 'Unknown'})`);
                setRecordingTrackId(null);
            }
        });
    }

    if (tempoGlobalInput) {
        tempoGlobalInput.addEventListener('change', (e) => {
            const newTempo = parseFloat(e.target.value);
            if (!isNaN(newTempo) && newTempo >= Constants.MIN_TEMPO && newTempo <= Constants.MAX_TEMPO) {
                if (Tone.Transport.bpm.value !== newTempo) captureStateForUndo(`Set Tempo to ${newTempo.toFixed(1)} BPM`);
                Tone.Transport.bpm.value = newTempo;
                if(localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
            } else {
                e.target.value = Tone.Transport.bpm.value.toFixed(1);
                showNotification(`Tempo must be between ${Constants.MIN_TEMPO} and ${Constants.MAX_TEMPO}.`, 2500);
            }
        });
    }

    if (midiInputSelectGlobal) {
        midiInputSelectGlobal.onchange = () => {
            const activeMIDI = localAppServices.getActiveMIDIInput ? localAppServices.getActiveMIDIInput() : null;
            const oldMidiName = activeMIDI ? activeMIDI.name : "No MIDI Input";
            const newMidiId = midiInputSelectGlobal.value;

            const midiAccess = localAppServices.getMidiAccess ? localAppServices.getMidiAccess() : null;
            const newMidiDevice = (midiAccess && newMidiId) ? midiAccess.inputs.get(newMidiId) : null;
            const newMidiName = newMidiDevice ? newMidiDevice.name : "No MIDI Input";

            if (oldMidiName !== newMidiName) {
                 captureStateForUndo(`Change MIDI Input to ${newMidiName}`);
            }
            if (localAppServices.selectMIDIInput) localAppServices.selectMIDIInput(newMidiId);
        };
    }
}


export async function setupMIDI() {
    if (typeof window === 'undefined' || !navigator.requestMIDIAccess) {
        showNotification("Web MIDI API not supported in this browser.", 3000);
        return;
    }

    try {
        const midiAccess = await navigator.requestMIDIAccess();
        if (localAppServices.setMidiAccess) localAppServices.setMidiAccess(midiAccess);
        populateMIDIInputs();
        midiAccess.onstatechange = populateMIDIInputs;
    } catch (e) {
        console.error("[EventHandlers] Could not access MIDI devices.", e);
        showNotification(`Could not access MIDI: ${e.message}.`, 6000);
    }
}

function populateMIDIInputs() {
    const midiAccess = localAppServices.getMidiAccess ? localAppServices.getMidiAccess() : null;
    const midiSelect = localAppServices.uiElementsCache?.midiInputSelectGlobal;

    if (!midiAccess || !midiSelect) {
        return;
    }

    const activeMIDI = localAppServices.getActiveMIDIInput ? localAppServices.getActiveMIDIInput() : null;
    const previouslySelectedId = activeMIDI ? activeMIDI.id : midiSelect.value;
    midiSelect.innerHTML = '<option value="">No MIDI Input</option>';

    const inputs = midiAccess.inputs;
    if (inputs.size > 0) {
        inputs.forEach(input => {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.name;
            midiSelect.appendChild(option);
        });
    }

    if (previouslySelectedId && inputs.get(previouslySelectedId)) {
        midiSelect.value = previouslySelectedId;
    } else if (inputs.size > 0) {
        midiSelect.value = inputs.values().next().value.id;
    } else {
        midiSelect.value = "";
    }
    if (localAppServices.selectMIDIInput) localAppServices.selectMIDIInput(midiSelect.value, true);
}

export function selectMIDIInput(selectedId, skipUndoCaptureAndNotification = false) {
    const midiAccess = localAppServices.getMidiAccess ? localAppServices.getMidiAccess() : null;
    let activeMIDI = localAppServices.getActiveMIDIInput ? localAppServices.getActiveMIDIInput() : null;

    if (activeMIDI) {
        activeMIDI.onmidimessage = null;
    }
    activeMIDI = null;

    if (midiAccess && selectedId) {
        const inputDevice = midiAccess.inputs.get(selectedId);
        if (inputDevice) {
            activeMIDI = inputDevice;
            activeMIDI.onmidimessage = handleMIDIMessage;
            if (!skipUndoCaptureAndNotification) {
                showNotification(`MIDI Input: ${activeMIDI.name} selected.`, 2000);
            }
        } else {
             if (!skipUndoCaptureAndNotification) showNotification("Selected MIDI input not found.", 2000);
        }
    } else {
        if (!skipUndoCaptureAndNotification && selectedId === "") showNotification("MIDI Input deselected.", 1500);
    }
    if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(activeMIDI);

    if (localAppServices.uiElementsCache?.midiIndicatorGlobal) {
        localAppServices.uiElementsCache.midiIndicatorGlobal.classList.toggle('active', !!activeMIDI);
    }
}


export async function handleMIDIMessage(message) {
    const [command, note, velocityByte] = message.data;
    const time = Tone.now();
    const normVel = velocityByte / 127;

    if (localAppServices.uiElementsCache?.midiIndicatorGlobal) {
        localAppServices.uiElementsCache.midiIndicatorGlobal.classList.add('active');
        setTimeout(() => localAppServices.uiElementsCache.midiIndicatorGlobal.classList.remove('active'), 100);
    }

    if (command === 144 && velocityByte > 0) {
        const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
        if (!audioReady) return;
    }

    const currentArmedTrackId = getArmedTrackId();
    const currentRecordingTrackId = getRecordingTrackId();

    // MIDI Recording for Sequencer (non-Audio tracks)
    if (isTrackRecording() && currentArmedTrackId === currentRecordingTrackId && command === 144 && velocityByte > 0) {
        const track = getTrackById(currentRecordingTrackId);
        if (track && track.type !== 'Audio') { // Only for non-Audio tracks
            const currentTimeInSeconds = Tone.Transport.seconds;
            const sixteenthNoteDuration = Tone.Time("16n").toSeconds();
            let currentStep = Math.round(currentTimeInSeconds / sixteenthNoteDuration);
            currentStep = (currentStep % track.sequenceLength + track.sequenceLength) % track.sequenceLength;

            let rowIndex = -1;
            if (track.type === 'Synth' || track.type === 'InstrumentSampler') {
                const pitchName = Tone.Frequency(note, "midi").toNote();
                rowIndex = Constants.synthPitches.indexOf(pitchName);
            } else if (track.type === 'Sampler') {
                rowIndex = note - Constants.samplerMIDINoteStart;
                if (rowIndex < 0 || rowIndex >= track.slices.length) rowIndex = -1;
            } else if (track.type === 'DrumSampler') {
                rowIndex = note - Constants.samplerMIDINoteStart;
                if (rowIndex < 0 || rowIndex >= Constants.numDrumSamplerPads) rowIndex = -1;
            }

            if (rowIndex !== -1 && currentStep >= 0 && currentStep < track.sequenceLength) {
                if (!track.sequenceData[rowIndex]) track.sequenceData[rowIndex] = Array(track.sequenceLength).fill(null);
                track.sequenceData[rowIndex][currentStep] = { active: true, velocity: normVel };
                const sequencerWindow = localAppServices.getWindowById ? localAppServices.getWindowById(`sequencerWin-${track.id}`) : null;
                if (sequencerWindow && sequencerWindow.element && localAppServices.updateSequencerCellUI) {
                     localAppServices.updateSequencerCellUI(sequencerWindow.element, track.type, rowIndex, currentStep, true);
                }
            }
        }
    }

    if (currentArmedTrackId === null) return;
    const currentArmedTrack = getTrackById(currentArmedTrackId);
    if (!currentArmedTrack) return;

    // Live MIDI Input (non-Audio tracks)
    if (currentArmedTrack.type !== 'Audio') {
        if (command === 144 && velocityByte > 0) {
            if (currentArmedTrack.type === 'Synth' && currentArmedTrack.instrument) {
                currentArmedTrack.instrument.triggerAttack(Tone.Frequency(note, "midi").toNote(), time, normVel);
            } else if (currentArmedTrack.type === 'Sampler' && localAppServices.playSlicePreview) {
                const sliceIdx = note - Constants.samplerMIDINoteStart;
                if (sliceIdx >= 0 && sliceIdx < currentArmedTrack.slices.length) {
                    localAppServices.playSlicePreview(currentArmedTrack.id, sliceIdx, normVel);
                }
            } else if (currentArmedTrack.type === 'DrumSampler' && localAppServices.playDrumSamplerPadPreview) {
                const padIndex = note - Constants.samplerMIDINoteStart;
                if (padIndex >= 0 && padIndex < Constants.numDrumSamplerPads) {
                    localAppServices.playDrumSamplerPadPreview(currentArmedTrack.id, padIndex, normVel);
                }
            } else if (currentArmedTrack.type === 'InstrumentSampler' && currentArmedTrack.toneSampler?.loaded) {
                if (!currentArmedTrack.instrumentSamplerIsPolyphonic) {
                    currentArmedTrack.toneSampler.releaseAll(time);
                }
                currentArmedTrack.toneSampler.triggerAttack(Tone.Frequency(note, "midi").toNote(), time, normVel);
            }
        } else if (command === 128 || (command === 144 && velocityByte === 0)) {
            if (currentArmedTrack.type === 'Synth' && currentArmedTrack.instrument) {
                currentArmedTrack.instrument.triggerRelease(time + 0.05);
            } else if (currentArmedTrack.type === 'InstrumentSampler' && currentArmedTrack.toneSampler?.loaded) {
                if (currentArmedTrack.instrumentSamplerIsPolyphonic) {
                     currentArmedTrack.toneSampler.triggerRelease(Tone.Frequency(note, "midi").toNote(), time + 0.05);
                }
            }
        }
    }
}

async function handleComputerKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    if (e.code === 'Space') {
        e.preventDefault();
        if (localAppServices.uiElementsCache?.playBtnGlobal?.click) {
            localAppServices.uiElementsCache.playBtnGlobal.click();
        }
        return;
    }
    
    if (e.code === 'KeyZ' || e.code === 'KeyX') {
        if (!currentlyPressedComputerKeys[e.code]) {
            if (e.code === 'KeyZ' && currentOctaveShift > MIN_OCTAVE_SHIFT) currentOctaveShift--;
            else if (e.code === 'KeyX' && currentOctaveShift < MAX_OCTAVE_SHIFT) currentOctaveShift++;
            else { showNotification(`Octave limit reached.`, 1000); return; }
            showNotification(`Octave: ${currentOctaveShift >= 0 ? '+' : ''}${currentOctaveShift}`, 1000);
        }
        currentlyPressedComputerKeys[e.code] = true;
        if(localAppServices.uiElementsCache?.keyboardIndicatorGlobal) localAppServices.uiElementsCache.keyboardIndicatorGlobal.classList.add('active');
        return;
    }

    const baseComputerKeyNote = Constants.computerKeySynthMap[e.code] || Constants.computerKeySamplerMap[e.code];
    
    if (baseComputerKeyNote === undefined || e.repeat || currentlyPressedComputerKeys[e.code]) {
        return;
    }
    
    currentlyPressedComputerKeys[e.code] = true;
    if(localAppServices.uiElementsCache?.keyboardIndicatorGlobal) localAppServices.uiElementsCache.keyboardIndicatorGlobal.classList.add('active');

    const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        console.warn('[EventHandlers] Audio not ready, note play aborted.');
        delete currentlyPressedComputerKeys[e.code];
        if(localAppServices.uiElementsCache?.keyboardIndicatorGlobal && Object.keys(currentlyPressedComputerKeys).filter(k => k !== 'KeyZ' && k !== 'KeyX').length === 0) {
            localAppServices.uiElementsCache.keyboardIndicatorGlobal.classList.remove('active');
        }
        return;
    }
    
    const currentArmedTrackId = getArmedTrackId();
    if (currentArmedTrackId === null) return;

    const currentArmedTrack = getTrackById(currentArmedTrackId);
    if (!currentArmedTrack) {
        console.warn(`[EventHandlers] Armed track with ID ${currentArmedTrackId} not found. Note play aborted.`);
        return;
    }

    // Do not play notes via computer keyboard for Audio tracks
    if (currentArmedTrack.type === 'Audio') return;


    const computerKeyNote = baseComputerKeyNote + (currentOctaveShift * 12); 
    if (computerKeyNote < 0 || computerKeyNote > 127) {
        console.warn(`[EventHandlers] Note ${computerKeyNote} is out of MIDI range.`);
        return;
    }

    const time = Tone.now();
    const noteToPlay = Tone.Frequency(computerKeyNote, "midi").toNote();

    if (!noteToPlay) {
        console.error(`[EventHandlers] Could not determine a valid note for MIDI value ${computerKeyNote}.`);
        return;
    }
    
    // Live note playing logic (non-Audio tracks)
    if (currentArmedTrack.type === 'Synth' && Constants.computerKeySynthMap[e.code]) {
        if (currentArmedTrack.instrument) {
            currentArmedTrack.instrument.triggerAttack(noteToPlay, time, Constants.defaultVelocity);
        }
    } else if (currentArmedTrack.type === 'Sampler' && Constants.computerKeySamplerMap[e.code] !== undefined && localAppServices.playSlicePreview) {
        const sliceIdx = (baseComputerKeyNote - Constants.samplerMIDINoteStart) + (currentOctaveShift * Constants.numSlices);
        if (sliceIdx >= 0 && sliceIdx < currentArmedTrack.slices.length) {
            localAppServices.playSlicePreview(currentArmedTrack.id, sliceIdx, Constants.defaultVelocity);
        }
    } else if (currentArmedTrack.type === 'DrumSampler' && Constants.computerKeySamplerMap[e.code] !== undefined && localAppServices.playDrumSamplerPadPreview) {
        const padIndex = (baseComputerKeyNote - Constants.samplerMIDINoteStart) + (currentOctaveShift * Constants.numDrumSamplerPads);
        if (padIndex >= 0 && padIndex < Constants.numDrumSamplerPads) {
            localAppServices.playDrumSamplerPadPreview(currentArmedTrack.id, padIndex, Constants.defaultVelocity);
        }
    } else if (currentArmedTrack.type === 'InstrumentSampler' && Constants.computerKeySynthMap[e.code] && currentArmedTrack.toneSampler?.loaded) {
        if (!currentArmedTrack.instrumentSamplerIsPolyphonic) {
            currentArmedTrack.toneSampler.releaseAll(time);
        }
        currentArmedTrack.toneSampler.triggerAttack(noteToPlay, time, Constants.defaultVelocity);
    }
    
    // Recording logic (non-Audio tracks)
    if (isTrackRecording() && getRecordingTrackId() === currentArmedTrackId && currentArmedTrack.type !== 'Audio') {
        const track = currentArmedTrack;
        const currentTimeInSeconds = Tone.Transport.seconds;
        const sixteenthNoteDuration = Tone.Time("16n").toSeconds();
        let currentStep = Math.round(currentTimeInSeconds / sixteenthNoteDuration);
        currentStep = (currentStep % track.sequenceLength + track.sequenceLength) % track.sequenceLength;
        
        let rowIndex = -1;
        if ((track.type === 'Synth' || track.type === 'InstrumentSampler') && Constants.computerKeySynthMap[e.code]) {
            rowIndex = Constants.synthPitches.indexOf(noteToPlay);
        } else if (track.type === 'Sampler' && Constants.computerKeySamplerMap[e.code]) {
            rowIndex = (baseComputerKeyNote - Constants.samplerMIDINoteStart) + (currentOctaveShift * Constants.numSlices);
            if (rowIndex < 0 || rowIndex >= track.slices.length) rowIndex = -1;
        } else if (track.type === 'DrumSampler' && Constants.computerKeySamplerMap[e.code]) {
            rowIndex = (baseComputerKeyNote - Constants.samplerMIDINoteStart) + (currentOctaveShift * Constants.numDrumSamplerPads);
            if (rowIndex < 0 || rowIndex >= Constants.numDrumSamplerPads) rowIndex = -1;
        }

        if (rowIndex !== -1 && currentStep >= 0 && currentStep < track.sequenceLength) {
            if (!track.sequenceData[rowIndex]) {
                track.sequenceData[rowIndex] = Array(track.sequenceLength).fill(null);
            }
            track.sequenceData[rowIndex][currentStep] = { active: true, velocity: Constants.defaultVelocity };
            const sequencerWindow = localAppServices.getWindowById ? localAppServices.getWindowById(`sequencerWin-${track.id}`) : null;
            if (sequencerWindow?.element && localAppServices.updateSequencerCellUI) {
                 localAppServices.updateSequencerCellUI(sequencerWindow.element, track.type, rowIndex, currentStep, true);
            }
        }
    }
}


function handleComputerKeyUp(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.code === 'Space') return;

    const isOctaveKey = (e.code === 'KeyZ' || e.code === 'KeyX');
    if (isOctaveKey) {
        delete currentlyPressedComputerKeys[e.code];
    } else if (currentlyPressedComputerKeys[e.code]) {
        const time = Tone.now();
        const currentArmedTrack = getTrackById(getArmedTrackId());
        if (currentArmedTrack && currentArmedTrack.type !== 'Audio') { // Only process key up for non-Audio tracks
            const isSynthKey = Constants.computerKeySynthMap[e.code] !== undefined;
            const baseComputerKeyNote = Constants.computerKeySynthMap[e.code] || Constants.computerKeySamplerMap[e.code];

            if (baseComputerKeyNote !== undefined) {
                const computerKeyNote = baseComputerKeyNote + (currentOctaveShift * 12);
                if (computerKeyNote >= 0 && computerKeyNote <= 127) {
                    const noteToRelease = Tone.Frequency(computerKeyNote, "midi").toNote();
                    if (currentArmedTrack.type === 'Synth' && isSynthKey && currentArmedTrack.instrument) {
                        currentArmedTrack.instrument.triggerRelease(time + 0.05);
                    } else if (currentArmedTrack.type === 'InstrumentSampler' && isSynthKey && currentArmedTrack.toneSampler?.loaded) {
                        if (currentArmedTrack.instrumentSamplerIsPolyphonic) {
                            currentArmedTrack.toneSampler.triggerRelease(noteToRelease, time + 0.05);
                        }
                    }
                }
            }
        }
        delete currentlyPressedComputerKeys[e.code];
    }

    const noteKeysPressed = Object.keys(currentlyPressedComputerKeys).some(key => key !== 'KeyZ' && key !== 'KeyX');
    if(localAppServices.uiElementsCache?.keyboardIndicatorGlobal && !noteKeysPressed && !currentlyPressedComputerKeys['KeyZ'] && !currentlyPressedComputerKeys['KeyX']) {
        localAppServices.uiElementsCache.keyboardIndicatorGlobal.classList.remove('active');
    }
}

export function handleTrackMute(trackId) {
    const track = getTrackById(trackId);
    if (!track) return;
    captureStateForUndo(`${track.isMuted ? "Unmute" : "Mute"} Track "${track.name}"`);
    track.isMuted = !track.isMuted;
    track.applyMuteState();
    if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'muteChanged');
}

export function handleTrackSolo(trackId) {
    const track = getTrackById(trackId);
    if (!track) return;
    const currentGlobalSoloId = getSoloedTrackId();
    const isCurrentlySoloed = currentGlobalSoloId === track.id;
    captureStateForUndo(`${isCurrentlySoloed ? "Unsolo" : "Solo"} Track "${track.name}"`);
    setSoloedTrackId(isCurrentlySoloed ? null : track.id);
    getTracks().forEach(t => {
        t.isSoloed = (getSoloedTrackId() === t.id);
        t.applySoloState();
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
    });
}

export function handleTrackArm(trackId) {
    const track = getTrackById(trackId);
    if (!track) return;
    const currentArmedId = getArmedTrackId();
    const isCurrentlyArmed = currentArmedId === track.id;
    captureStateForUndo(`${isCurrentlyArmed ? "Disarm" : "Arm"} Track "${track.name}" for Input`);
    setArmedTrackId(isCurrentlyArmed ? null : track.id);
    const newArmedTrack = getTrackById(getArmedTrackId());
    showNotification(newArmedTrack ? `${newArmedTrack.name} armed for input.` : "Input disarmed.", 1500);
    getTracks().forEach(t => {
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'armChanged');
    });
}

export function handleRemoveTrack(trackId) {
    const track = getTrackById(trackId);
    if (!track) return;
    showConfirmationDialog(
        'Confirm Delete Track',
        `Are you sure you want to remove track "${track.name}"? This can be undone.`,
        () => {
            if (localAppServices.removeTrack) {
                localAppServices.removeTrack(trackId);
            } else {
                coreRemoveTrackFromState(trackId);
            }
        }
    );
}

export function handleOpenTrackInspector(trackId) {
    if (localAppServices.openTrackInspectorWindow) localAppServices.openTrackInspectorWindow(trackId);
}
export function handleOpenEffectsRack(trackId) {
    if (localAppServices.openTrackEffectsRackWindow) localAppServices.openTrackEffectsRackWindow(trackId);
}
export function handleOpenSequencer(trackId) {
    if (localAppServices.openTrackSequencerWindow) localAppServices.openTrackSequencerWindow(trackId);
}
