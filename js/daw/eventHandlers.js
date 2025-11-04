// js/daw/eventHandlers.js - Global Event Listeners and Input Handling Module

// Import state functions
import { getTracks, getTrackById, getSoloedTrackId, setSoloedTrackId, getArmedTrackId, setArmedTrackId, isRecording, setIsRecording, getRecordingTrackId, setRecordingTrackId, getRecordingStartTime, setRecordingStartTime } from '/app/js/daw/state/trackState.js';
import { getPlaybackMode, setPlaybackMode, getMidiAccess, setActiveMIDIInput, getActiveMIDIInput, getMidiRecordModeState, setCurrentUserThemePreference, setMidiRecordModeState } from '/app/js/daw/state/appState.js';
import { getUndoStack, getRedoStack, captureStateForUndo } from '/app/js/daw/state/projectState.js';
import { getWindowById } from '/app/js/daw/state/windowState.js';
import { getClipboardData } from '/app/js/daw/state/projectState.js';

// Corrected import for Constants - directly from current directory
import * as Constants from '/app/js/daw/constants.js';

let localAppServices = {};
const currentlyPressedKeys = new Set();
let isSustainPedalDown = false;
const sustainedNotes = new Map(); // Map to hold notes currently being sustained by pedal

// --- MIDI Helper Functions (defined as local functions, used internally or passed directly) ---

/**
 * Callback function for incoming MIDI messages.
 * @param {MIDIMessageEvent} message - The MIDI message event.
 */
function onMIDIMessage(message) {
    const [command, noteNumber, velocity] = message.data;
    const commandType = command & 0xF0; 
    const noteOn = commandType === 0x90 && velocity > 0; 
    const noteOff = commandType === 0x80 || (commandType === 0x90 && velocity === 0); 

    const armedTrackId = getArmedTrackId();
    if (armedTrackId === null) return; 
    const armedTrack = getTrackById(armedTrackId);
    if (!armedTrack || !armedTrack.instrument) return; 

    if (commandType === 0xB0 && noteNumber === 64) { 
        if (velocity > 63) { 
            isSustainPedalDown = true;
        } else { 
            isSustainPedalDown = false;
            sustainedNotes.forEach((noteValue, midiNote) => {
                if (armedTrack.instrument) {
                    armedTrack.instrument.triggerRelease(noteValue, localAppServices.Tone.now());
                }
            });
            sustainedNotes.clear(); 
        }
        return; 
    }
    
    if (noteOn || noteOff) {
        const noteName = localAppServices.Tone.Midi(noteNumber).toNote(); 
        
        if (noteOn) {
            if (sustainedNotes.has(noteNumber)) {
                if (armedTrack.instrument) {
                    armedTrack.instrument.triggerRelease(sustainedNotes.get(noteNumber), localAppServices.Tone.now());
                }
                sustainedNotes.delete(noteNumber);
            }
            armedTrack.instrument.triggerAttack(noteName, localAppServices.Tone.now(), velocity / 127); 
        } else { 
            if (isSustainPedalDown) {
                sustainedNotes.set(noteNumber, noteName);
            } else {
                armedTrack.instrument.triggerRelease(noteName, localAppServices.Tone.now());
            }
        }
    }
    
    if (noteOn && isRecording()) {
        const track = armedTrack;
        if (track.type !== 'Audio') {
            const activeSequence = track.sequences.getActiveSequence();
            if (activeSequence) {
                const ticksPerStep = localAppServices.Tone.Transport.PPQ / 4; 
                const currentTick = localAppServices.Tone.Transport.ticks;
                const currentStep = Math.floor(currentTick / ticksPerStep); 
                const loopStep = currentStep % activeSequence.length; 

                let pitchIndex;
                if (track.type === 'DrumSampler') {
                    pitchIndex = noteNumber - Constants.DRUM_MIDI_START_NOTE;
                } else {
                    pitchIndex = Constants.PIANO_ROLL_END_MIDI_NOTE - noteNumber;
                }
                
                if (pitchIndex >= 0 && pitchIndex < activeSequence.data.length) {
                    const recordMode = getMidiRecordModeState();
                    if (recordMode === 'replace') {
                        if (activeSequence.data[pitchIndex][loopStep]) {
                             track.sequences.removeNoteFromSequence(activeSequence.id, pitchIndex, loopStep);
                        }
                    }
                    
                    track.sequences.addNoteToSequence(activeSequence.id, pitchIndex, loopStep, { velocity: velocity / 127, duration: 1 }); 
                    
                    const pianoRollWindow = getWindowById(`pianoRollWin-${track.id}`);
                    if (pianoRollWindow && !pianoRollWindow.isMinimized) {
                       if(localAppServices.openPianoRollWindow) {
                           pianoRollWindow.close(true); 
                           localAppServices.openPianoRollWindow(track.id, activeSequence.id); 
                       }
                    }
                }
            }
        }
    }
}

/**
 * Populates the MIDI input device dropdown selector.
 * @param {MIDIAccess} midiAccess - The MIDIAccess object.
 */
function populateMIDIInputSelector(midiAccess) {
    const midiSelect = document.getElementById('midiInputSelectGlobalTop');
    if (!midiSelect || !midiAccess) {
        return;
    }

    const currentInputs = new Set();
    midiSelect.innerHTML = ''; 

    // Add a default "None" option
    const noneOption = document.createElement('option');
    noneOption.value = "";
    noneOption.textContent = "None";
    midiSelect.appendChild(noneOption);
    
    // Add available MIDI input devices
    if (midiAccess.inputs.size > 0) {
        midiAccess.inputs.forEach(input => {
            currentInputs.add(input.id);
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.name || `MIDI Input ${input.id}`; 
            midiSelect.appendChild(option);
        });
    }

    // Restore previously active MIDI input if it's still available
    const activeInput = localAppServices.getActiveMIDIInput();
    if (activeInput && currentInputs.has(activeInput.id)) {
        midiSelect.value = activeInput.id;
        activeInput.onmidimessage = onMIDIMessage; // Assign local onMIDIMessage
    } else {
        // If the previously active input is no longer available, reset it
        localAppServices.setActiveMIDIInput(null);
        midiSelect.value = ""; // Select "None"
    }
}

/**
 * Callback for successful MIDI access.
 * @param {MIDIAccess} midiAccess - The MIDIAccess object.
 */
function onMIDISuccess(midiAccess) {
    localAppServices.setMidiAccess(midiAccess);
    populateMIDIInputSelector(midiAccess); // Call local function
    // Listen for state changes (e.g., MIDI device connected/disconnected)
    midiAccess.onstatechange = () => {
        populateMIDIInputSelector(midiAccess); // Call local function
    };
}

/**
 * Callback for failed MIDI access.
 * @param {Error} error - The error object.
 */
function onMIDIFailure(error) {
    console.error("Failed to get MIDI access -", error);
    localAppServices.showNotification(`Failed to get MIDI access: ${error.name}`, 4000); 
}

// --- End MIDI Helper Functions ---


/**
 * Handles track mute toggle.
 * @param {number} trackId - The ID of the track to mute/unmute.
 */
export function handleTrackMute(trackId) {
    console.log(`[eventHandlers.js] handleTrackMute called for trackId: ${trackId}`);
    const track = getTrackById(trackId);
    if (!track) {
        console.warn(`[eventHandlers.js] handleTrackMute: Track with ID ${trackId} not found.`);
        return;
    }
    localAppServices.captureStateForUndo?.(`${track.isMuted ? 'Unmute' : 'Mute'} Track: ${track.name}`);
    track.isMuted = !track.isMuted;
    track.applyMuteState(); // Apply the mute state to the track's audio nodes
    if (localAppServices.updateTrackUI) {
        getTracks().forEach(t => localAppServices.updateTrackUI(t.id, 'muteChanged'));
        localAppServices.updateMixerWindow(); 
    }
}

/**
 * Handles track solo toggle.
 * @param {number} trackId - The ID of the track to solo/unsolo.
 */
export function handleTrackSolo(trackId) {
    console.log(`[eventHandlers.js] handleTrackSolo called for trackId: ${trackId}`);
    const track = getTrackById(trackId);
    if (!track) {
        console.warn(`[eventHandlers.js] handleTrackSolo: Track with ID ${trackId} not found.`);
        return;
    }
    localAppServices.captureStateForUndo?.(`Solo Track: ${track.name}`);
    const currentSoloId = getSoloedTrackId();
    const newSoloId = (currentSoloId === trackId) ? null : trackId; // Toggle solo state
    setSoloedTrackId(newSoloId);
    getTracks().forEach(t => {
        if (t.updateSoloMuteState) {
            t.updateSoloMuteState(newSoloId); 
        }
        localAppServices.updateTrackUI(t.id, 'soloChanged'); 
    });
    if (localAppServices.updateMixerWindow) {
        localAppServices.updateMixerWindow(); 
    }
}

/**
 * Handles track arm toggle for recording.
 * @param {number} trackId - The ID of the track to arm/disarm.
 */
export function handleTrackArm(trackId) {
    console.log(`[eventHandlers.js] handleTrackArm called for trackId: ${trackId}`);
    const currentArmedId = getArmedTrackId();
    const newArmedId = (currentArmedId === trackId) ? null : trackId; // Toggle armed state
    setArmedTrackId(newArmedId);
    if (localAppServices.updateTrackUI) {
        localAppServices.updateTrackUI(trackId, 'armChanged'); 
        if (currentArmedId !== null && currentArmedId !== trackId) {
            // If another track was armed, update its UI to reflect disarming
            localAppServices.updateTrackUI(currentArmedId, 'armChanged');
        }
    }
}

/**
 * Handles removal of a track after user confirmation.
 * @param {number} trackId - The ID of the track to remove.
 */
export function handleRemoveTrack(trackId) {
    const track = getTrackById(trackId);
    if (!track) return;
    localAppServices.showConfirmationDialog('Remove Track', `Are you sure you want to remove "${track.name}"? This cannot be undone.`, () => {
        localAppServices.removeTrack(trackId);
    });
}

/**
 * Handles opening the inspector window for a specific track.
 * @param {number} trackId - The ID of the track.
 */
export function handleOpenTrackInspector(trackId) {
    if (localAppServices.openTrackInspectorWindow) {
        localAppServices.openTrackInspectorWindow(trackId);
    }
}

/**
 * Handles opening the effects rack window for a specific track.
 * @param {number} trackId - The ID of the track.
 */
export function handleOpenEffectsRack(trackId) {
    if (localAppServices.openTrackEffectsRackWindow) {
        localAppServices.openTrackEffectsRackWindow(trackId);
    }
}

/**
 * Handles opening the piano roll window for a specific track.
 * @param {number} trackId - The ID of the track.
 */
export function handleOpenPianoRoll(trackId) {
    if (localAppServices.openPianoRollWindow) {
        localAppServices.openPianoRollWindow(trackId);
    } else {
        localAppServices.showNotification("Piano Roll UI is currently unavailable.", 3000);
    }
}

/**
 * Handles drag-and-drop of files or MIDI clips onto a timeline lane.
 * @param {DragEvent} event - The drag event.
 * @param {number} targetTrackId - The ID of the track receiving the drop.
 * @param {number} startTime - The target start time for the clip on the timeline.
 */
export async function handleTimelineLaneDrop(event, targetTrackId, startTime) {
    const files = event.dataTransfer.files;
    const targetTrack = getTrackById(targetTrackId);

    if (!targetTrack) return;
    
    // Handle file drops (audio files)
    if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('audio/')) {
            if (targetTrack.type === 'Audio') {
                // Add audio clip to Audio track
                await targetTrack.clips.addAudioClip(file, startTime, file.name);
                localAppServices.showNotification(`Audio clip "${file.name}" added to ${targetTrack.name}.`, 2000);
            } else {
                localAppServices.showNotification(`Cannot add audio files to a ${targetTrack.type} track. Drop on an Audio track.`, 3500);
            }
        } else {
             localAppServices.showNotification(`Unsupported file type for timeline drop: ${file.type}`, 3000);
        }
    } else {
        // Handle drops of JSON data (e.g., piano-roll sequence from drag handle, sound browser item)
        const jsonDataString = event.dataTransfer.getData("application/json");
        if (jsonDataString) {
            try {
                const soundData = JSON.parse(jsonDataString);
                if (soundData.type === 'piano-roll-sequence') {
                    // Drop from Piano Roll drag handle to create a MIDI clip
                    const sourceTrack = getTrackById(soundData.sourceTrackId);
                    // Find the actual sequence object from the source track's sequences
                    const sequence = sourceTrack?.sequences.sequences.find(s => s.id === soundData.sequenceId);
                    if (targetTrack && sequence) {
                        if (targetTrack.type === 'Synth' || targetTrack.type === 'InstrumentSampler' || targetTrack.type === 'DrumSampler' || targetTrack.type === 'Sampler') {
                            // Add MIDI clip to a compatible track
                            targetTrack.clips.addMidiClip(sequence, startTime);
                            localAppServices.showNotification(`MIDI clip from ${sourceTrack.name} added to ${targetTrack.name}.`, 2000);
                        } else {
                             localAppServices.showNotification(`Cannot add MIDI clips to a ${targetTrack.type} track. Drop on an instrument track.`, 3500);
                        }
                    }
                } else if (soundData.type === 'sound-browser-item') {
                    // Drop from Sound Browser (not yet fully implemented for direct timeline drop)
                    localAppServices.showNotification(`Cannot drag from Sound Browser to timeline yet. Drop on a sampler track's inspector instead.`, 4000);
                }
            } catch(e) {
                console.error("Error parsing dropped JSON data:", e);
                localAppServices.showNotification("Error processing dropped data.", 3000);
            }
        }
    }
}

/**
 * Handles opening the YouTube Importer window.
 */
export function handleOpenYouTubeImporter() {
    if (localAppServices.openYouTubeImporterWindow) {
        localAppServices.openYouTubeImporterWindow();
    } else {
        localAppServices.showNotification("YouTube Importer UI is currently unavailable.", 3000);
    }
}

/**
 * Updates the disabled state and title of the Undo and Redo buttons.
 * This function is exposed to `main.js` via `initializeEventHandlersModule`.
 */
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtnTop');
    const redoBtn = document.getElementById('redoBtnTop');
    
    if (undoBtn) {
        const undoStack = getUndoStack();
        if (undoStack.length > 0) {
            undoBtn.disabled = false;
            undoBtn.title = `Undo: ${undoStack[undoStack.length - 1].actionDescription}`;
        } else {
            undoBtn.disabled = true;
            undoBtn.title = 'Undo';
        }
    }
    if (redoBtn) {
        const redoStack = getRedoStack();
        if (redoStack.length > 0) {
            redoBtn.disabled = false;
            redoBtn.title = `Redo: ${redoStack[redoStack.length - 1].actionDescription}`;
        } else {
            redoBtn.disabled = true;
            redoBtn.title = 'Redo';
        }
    }
}

/**
 * Toggles the browser's full-screen mode.
 */
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            localAppServices.showNotification(`Error attempting to enable full-screen mode: ${err.message}`, 3000);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

/**
 * Handles the selection of a MIDI input device from the dropdown.
 * @param {Event} event - The change event from the select element.
 */
export function selectMIDIInput(event) {
    const midiAccess = localAppServices.getMidiAccess();
    const selectedId = event.target.value;
    const currentActiveInput = localAppServices.getActiveMIDIInput();

    // Disconnect previous active input's listener
    if (currentActiveInput) {
        currentActiveInput.onmidimessage = null;
    }

    // Set new active input and attach listener
    if (selectedId && midiAccess) {
        const newActiveInput = midiAccess.inputs.get(selectedId);
        if (newActiveInput) {
            newActiveInput.onmidimessage = onMIDIMessage; // Assign local onMIDIMessage
            localAppServices.setActiveMIDIInput(newActiveInput);
            localAppServices.showNotification(`MIDI Input: ${newActiveInput.name} selected.`, 1500);
        } else {
            localAppServices.showNotification("MIDI device not found.", 2000);
            localAppServices.setActiveMIDIInput(null);
        }
    } else {
        localAppServices.setActiveMIDIInput(null);
        localAppServices.showNotification("MIDI Input: None selected.", 1500);
    }
}

/**
 * Handles changes to the global playback mode.
 * @param {'piano-roll'|'timeline'} newMode - The new playback mode.
 * @param {'piano-roll'|'timeline'} oldMode - The old playback mode.
 */
export function onPlaybackModeChange(newMode, oldMode) {
    console.log(`Playback mode changed from ${oldMode} to ${newMode}`);
    const tracks = localAppServices.getTracks();

    if (localAppServices.Tone.Transport.state === 'started') {
        localAppServices.Tone.Transport.stop();
    }
    
    tracks.forEach(track => track.sequences.stopSequence?.());

    tracks.forEach(track => track.sequences.recreateToneSequence?.());

    const playbackModeToggle = document.getElementById('playbackModeToggleBtnGlobalTop');
    if (playbackModeToggle) {
        const modeText = newMode.charAt(0).toUpperCase() + newMode.slice(1);
        playbackModeToggle.textContent = `Mode: ${modeText}`;
    }
}

/**
 * Initializes primary global event listeners, mostly related to the desktop and start menu.
 * This function is now EXPORTED and called by main.js.
 */
export function initializePrimaryEventListeners() {
    const startButton = document.getElementById('startButton');
    const startMenu = document.getElementById('startMenu');
    const desktopEl = document.getElementById('desktop');
    const customBgInput = document.getElementById('customBgInput');

    startButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu?.classList.toggle('hidden');
        if (!startMenu?.classList.contains('hidden')) {
            updateUndoRedoButtons();
        }
    });

    document.addEventListener('click', (e) => {
        if (startMenu && !startMenu.classList.contains('hidden')) {
            if (!startMenu.contains(e.target) && e.target !== startButton) {
                startMenu.classList.add('hidden');
            }
        }
    });
    
    desktopEl?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const menuItems = [
            {
                label: 'Change Background',
                action: () => customBgInput?.click()
            }
        ];
        localAppServices.createContextMenu(e, menuItems);
    });
    
    customBgInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            localAppServices.handleBackgroundUpload(file);
        }
        e.target.value = null;
    });


    // Handlers for "Add Track" menu items
    const addTrackHandler = async (type) => {
        await localAppServices.initAudioContextAndMasterMeter?.(true);
        const newTrack = await localAppServices.addTrack(type);
        if (newTrack) {
            localAppServices.openTrackInspectorWindow?.(newTrack.id);
        }
        startMenu?.classList.add('hidden');
    };
    
    document.getElementById('menuAddSynthTrack')?.addEventListener('click', () => addTrackHandler('Synth'));
    document.getElementById('menuAddSamplerTrack')?.addEventListener('click', () => addTrackHandler('Sampler'));
    document.getElementById('menuAddDrumSamplerTrack')?.addEventListener('click', () => addTrackHandler('DrumSampler'));
    document.getElementById('menuAddInstrumentSamplerTrack')?.addEventListener('click', () => addTrackHandler('InstrumentSampler'));
    document.getElementById('menuAddAudioTrack')?.addEventListener('click', () => addTrackHandler('Audio'));
    
    document.getElementById('menuOpenSoundBrowser')?.addEventListener('click', () => {
        localAppServices.openSoundBrowserWindow?.();
        startMenu?.classList.add('hidden');
    });
    
    document.getElementById('menuOpenYouTubeImporter')?.addEventListener('click', () => {
        localAppServices.openYouTubeImporterWindow?.();
        startMenu?.classList.add('hidden');
    });

    document.getElementById('menuOpenPianoRoll')?.addEventListener('click', () => {
        const currentTracks = getTracks();
        const firstInstrumentTrack = currentTracks.find(t => t.type === 'Synth' || t.type === 'InstrumentSampler' || t.type === 'Sampler' || t.type === 'DrumSampler');
        if (firstInstrumentTrack) {
            localAppServices.openPianoRollWindow?.(firstInstrumentTrack.id);
        } else {
            localAppServices.showNotification("Add an instrument or sampler track first.", 3000);
        }
        startMenu?.classList.add('hidden');
    });

    document.getElementById('menuOpenMixer')?.addEventListener('click', () => {
        localAppServices.openMixerWindow?.();
        startMenu?.classList.add('hidden');
    });

    document.getElementById('menuOpenMasterEffects')?.addEventListener('click', () => {
        localAppServices.openMasterEffectsRackWindow?.();
        startMenu?.classList.add('hidden');
    });

    document.getElementById('undoBtnTop')?.addEventListener('click', () => {
        localAppServices.undoLastAction();
        updateUndoRedoButtons();
    });

    document.getElementById('redoBtnTop')?.addEventListener('click', () => {
        localAppServices.redoLastAction();
        updateUndoRedoButtons();
    });


    document.getElementById('menuSaveProject')?.addEventListener('click', () => {
        localAppServices.saveProject();
        startMenu?.classList.add('hidden');
    });

    document.getElementById('menuLoadProject')?.addEventListener('click', () => {
        document.getElementById('loadProjectInput')?.click();
        startMenu?.classList.add('hidden');
    });

    document.getElementById('menuExportWav')?.addEventListener('click', () => {
        localAppServices.exportToWav();
        startMenu?.classList.add('hidden');
    });
    
    document.getElementById('menuOpenTestProfile')?.addEventListener('click', () => {
        const usernameToOpen = 'testuser';
        window.open(`/app/profile.html?user=${usernameToOpen}`, '_blank');
        document.getElementById('startMenu')?.classList.add('hidden');
    });

    document.getElementById('menuRefreshMidi')?.addEventListener('click', () => {
        localAppServices.showNotification('Refreshing MIDI devices...', 1500);
        setupMIDI();
        startMenu?.classList.add('hidden');
    });

    document.getElementById('menuToggleFullScreen')?.addEventListener('click', toggleFullScreen);

    // Event listener for loading project file via file input
    const loadProjectInput = document.getElementById('loadProjectInput');
    if (loadProjectInput) {
        loadProjectInput.addEventListener('change', localAppServices.handleProjectFileLoad);
    }
}

/**
 * Attaches global control event listeners (play, stop, record, tempo, MIDI input, theme toggle).
 * This function is now EXPORTED and called by main.js.
 */
export function attachGlobalControlEvents() {
    const playBtn = document.getElementById('playBtnGlobalTop');
    const stopBtn = document.getElementById('stopBtnGlobalTop');
    const recordBtn = document.getElementById('recordBtnGlobalTop');
    const tempoInput = document.getElementById('tempoGlobalInputTop');
    const midiSelect = document.getElementById('midiInputSelectGlobalTop');
    const playbackModeToggle = document.getElementById('playbackModeToggleBtnGlobalTop');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const metronomeBtn = document.getElementById('metronomeToggleBtn');
    const midiRecordModeBtn = document.getElementById('midiRecordModeBtn');
    
    // Handler for Play/Pause button
    const handlePlayPause = async () => {
        const audioReady = await localAppServices.initAudioContextAndMasterMeter?.(true);
        if (!audioReady) {
            localAppServices.showNotification("Audio context not running. Please interact with the page.", 3000);
            return;
        }

        const transportState = localAppServices.Tone.Transport.state;

        if (transportState === 'started') {
            localAppServices.Tone.Transport.pause();
        } else {
            if (transportState === 'stopped') {
                onPlaybackModeChange(getPlaybackMode(), 'reschedule'); // Correctly call the local function
            }
            localAppServices.Tone.Transport.start();
        }
    };

    // Handler for Play/Stop button (currently only Stop if playing, otherwise Start from beginning)
    const handlePlayStop = async () => {
        const audioReady = await localAppServices.initAudioContextAndMasterMeter?.(true);
        if (!audioReady) {
            localAppServices.showNotification("Audio context not running. Please interact with the page.", 3000);
            return;
        }

        if (localAppServices.Tone.Transport.state === 'started') {
            handleStop(); // Correctly call the local function
        } else {
            onPlaybackModeChange(getPlaybackMode(), 'reschedule'); // Correctly call the local function
            localAppServices.Tone.Transport.start();
        }
    };
    
    // Handler for Stop button (stops all audio playback)
    const handleStop = () => {
        localAppServices.forceStopAllAudio?.();
        
        if (localAppServices.Tone.Transport.state !== 'stopped') {
            localAppServices.Tone.Transport.stop();
        }
    };

    // Handler for Record button
    const handleRecord = async () => {
        const audioReady = await localAppServices.initAudioContextAndMasterMeter?.(true);
        if (!audioReady) return;
    
        const currentlyRecording = isRecording();
        const armedTrackId = getArmedTrackId();
        const armedTrack = getTrackById(armedTrackId);
        
        const recordBtn = document.getElementById('recordBtnGlobalTop');

        if (currentlyRecording) {
            setIsRecording(false);
            recordBtn.classList.remove('recording'); 
            if (getRecordingTrackId() === armedTrackId && armedTrack?.type === 'Audio' && localAppServices.stopAudioRecording) {
                await localAppServices.stopAudioRecording();
            }
            if (localAppServices.Tone.Transport.state === 'started') {
                handleStop(); // Correctly call the local function
            }
        } else if (armedTrack) {
            setRecordingTrackId(armedTrackId);
            setIsRecording(true);
            recordBtn.classList.add('recording'); 
            
            setRecordingStartTime(localAppServices.Tone.Transport.seconds);
    
            if (armedTrack.type === 'Audio') {
                const success = await localAppServices.startAudioRecording(armedTrack, armedTrack.isMonitoringEnabled);
                if (!success) {
                    setIsRecording(false);
                    recordBtn.classList.remove('recording');
                    return;
                }
            }
    
            if (localAppServices.Tone.Transport.state !== 'started') {
                localAppServices.Tone.Transport.start();
            }
        } else {
            localAppServices.showNotification("No track armed for recording. Arm a track by clicking its 'Arm' button.", 2500);
        }
    };

    playBtn?.addEventListener('click', handlePlayPause);
    stopBtn?.addEventListener('click', handleStop);
    recordBtn?.addEventListener('click', handleRecord);
    
    metronomeBtn?.addEventListener('click', () => {
        const isEnabled = localAppServices.toggleMetronome();
        metronomeBtn.classList.toggle('active', isEnabled);
    });

    midiRecordModeBtn?.addEventListener('click', () => {
        const currentMode = getMidiRecordModeState();
        const newMode = currentMode === 'overdub' ? 'replace' : 'overdub';
        setMidiRecordModeState(newMode);
        midiRecordModeBtn.textContent = newMode.charAt(0).toUpperCase() + newMode.slice(1);
        localAppServices.showNotification(`MIDI Record Mode: ${newMode.charAt(0).toUpperCase() + newMode.slice(1)}`, 1500);
    });

    tempoInput?.addEventListener('change', (e) => {
        const newTempo = parseFloat(e.target.value);
        if (!isNaN(newTempo) && newTempo >= Constants.MIN_TEMPO && newTempo <= Constants.MAX_TEMPO) {
            localAppServices.Tone.Transport.bpm.value = newTempo;
        } else {
            e.target.value = localAppServices.Tone.Transport.bpm.value.toFixed(1);
            localAppServices.showNotification(`Tempo must be between ${Constants.MIN_TEMPO} and ${Constants.MAX_TEMPO}.`, 2000);
        }
    });

    document.getElementById('taskbarTempoDisplay')?.addEventListener('click', () => {
        tempoInput?.select();
    });

    midiSelect?.addEventListener('change', selectMIDIInput); // Correctly call the local function

    playbackModeToggle?.addEventListener('click', () => {
        const currentMode = getPlaybackMode();
        const newMode = currentMode === 'piano-roll' ? 'timeline' : 'piano-roll';
        setPlaybackMode(newMode);
    });
    
    themeToggleBtn?.addEventListener('click', () => {
        const isLightTheme = document.body.classList.contains('theme-light');
        const newTheme = isLightTheme ? 'dark' : 'light';
        setCurrentUserThemePreference(newTheme);
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        // Prevent key repeat triggering multiple events
        if (e.repeat) return;
        
        const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';

        if (Constants.computerKeySynthMap[key] && !currentlyPressedKeys.has(key)) {
            e.preventDefault(); 
            const armedTrackId = getArmedTrackId();
            const armedTrack = getTrackById(armedTrackId);
            
            if (armedTrack && armedTrack.instrument) {
                const noteNumber = Constants.computerKeySynthMap[key] + (Constants.COMPUTER_KEY_SYNTH_OCTAVE_SHIFT * 12);
                const noteName = localAppServices.Tone.Midi(noteNumber).toNote(); 
                armedTrack.instrument.triggerAttack(noteName, localAppServices.Tone.now(), 0.75); 
                currentlyPressedKeys.add(key); 
            }
        } else {
            // Global Shortcuts
            if (e.code === 'Space') {
                e.preventDefault(); 
                handlePlayStop(); // Correctly call the local function
            } else if (e.key === 'Escape') {
                handleStop(); // Correctly call the local function
            } else if (key === 'r' && !e.ctrlKey && !e.metaKey) { 
                handleRecord(); // Correctly call the local function
            } else if (key === 'z' && !e.ctrlKey && !e.metaKey) { 
                Constants.decrementOctaveShift();
                localAppServices.showNotification?.(`Keyboard Octave: ${Constants.COMPUTER_KEY_SYNTH_OCTAVE_SHIFT > 0 ? '+' : ''}${Constants.COMPUTER_KEY_SYNTH_OCTAVE_SHIFT}`, 1000);
            } else if (key === 'x' && !e.ctrlKey && !e.metaKey) { 
                Constants.incrementOctaveShift();
                localAppServices.showNotification?.(`Keyboard Octave: ${Constants.COMPUTER_KEY_SYNTH_OCTAVE_SHIFT > 0 ? '+' : ''}${Constants.COMPUTER_KEY_SYNTH_OCTAVE_SHIFT}`, 1000);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Future: Add functionality for deleting selected clips/notes on timeline/piano roll
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                // Future: Add functionality for navigating selected clips/notes
            } else if (e.ctrlKey && key === 'z') { 
                localAppServices.undoLastAction();
            } else if ((e.ctrlKey && key === 'y') || (e.shiftKey && e.ctrlKey && key === 'z')) { 
                localAppServices.redoLastAction();
            } else if (e.ctrlKey && key === 's') { 
                e.preventDefault(); 
                localAppServices.saveProject();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
        // Release note when key is lifted
        if (Constants.computerKeySynthMap[key]) {
            e.preventDefault();
            const armedTrackId = getArmedTrackId();
            const armedTrack = getTrackById(armedTrackId);

            if (armedTrack && armedTrack.instrument) {
                const noteNumber = Constants.computerKeySynthMap[key] + (Constants.COMPUTER_KEY_SYNTH_OCTAVE_SHIFT * 12);
                const noteName = localAppServices.Tone.Midi(noteNumber).toNote(); 
                armedTrack.instrument.triggerRelease(noteName, localAppServices.Tone.now()); 
                currentlyPressedKeys.delete(key); 
            }
        }
    });
}


/**
 * Sets up Web MIDI API access and populates the MIDI input selector.
 * This function is now EXPORTED and called by main.js.
 */
export function setupMIDI() {
    if (!navigator.requestMIDIAccess) {
        localAppServices.showNotification("Web MIDI is not supported in this browser.", 4000);
        return;
    }
    if (!window.isSecureContext) {
        localAppServices.showNotification("MIDI access requires a secure connection (HTTPS).", 6000);
        return;
    }

    navigator.requestMIDIAccess({ sysex: false })
        .then(onMIDISuccess)
        .catch(onMIDIFailure);
}

/**
 * @returns {object} An object containing functions to be exposed via appServices.
 */
export function initializeEventHandlersModule(appServicesFromMain) {
    localAppServices = appServicesFromMain;
    
    // All functions returned here should be DEFINED (export or local) ABOVE this point
    // This ensures they are in scope when the return object is constructed.
return {
    updateUndoRedoButtons: updateUndoRedoButtons,
    initializePrimaryEventListeners: initializePrimaryEventListeners,
    attachGlobalControlEvents: attachGlobalControlEvents,
    setupMIDI: setupMIDI,
    // Add all other publicly callable handlers here
    handleTrackMute: handleTrackMute,
    handleTrackSolo: handleTrackSolo,
    handleTrackArm: handleTrackArm,
    handleRemoveTrack: handleRemoveTrack,
    handleOpenTrackInspector: handleOpenTrackInspector,
    handleOpenEffectsRack: handleOpenEffectsRack,
    handleOpenPianoRoll: handleOpenPianoRoll,
    onPlaybackModeChange: onPlaybackModeChange,
    handleTimelineLaneDrop: handleTimelineLaneDrop,
    handleOpenYouTubeImporter: handleOpenYouTubeImporter,
};
}