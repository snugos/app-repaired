// js/MIDIChordPlayer.js - On-screen MIDI Chord Player
import * as Constants from './constants.js';
import { getTracksState as getTracks, getScaleHighlightEnabled, setScaleHighlightEnabled, getScaleLockRoot, getScaleLockType, isNoteInScale, getScaleHighlightNotes } from './state.js';
import { setupScalePreview } from './ScalePreviewKeys.js';

// --- Local App Services ---
let localAppServices = {};

/**
 * Initialize the MIDI Chord Player module with app services.
 * @param {Object} appServices - Services from main.js
 */
export function initializeMIDIChordPlayer(appServices) {
    localAppServices = appServices || {};
    console.log('[MIDIChordPlayer] Module initialized');
}

// --- State ---
let isPanelOpen = false;
let currentTrackId = null;
let currentChordType = 'major';
let currentOctave = 4;
let activeNotes = new Set();
let chordPlayerElement = null;
let heldKeys = new Set(); // Track held keys for release handling

// --- Chord Player State Getters ---
export function getChordPlayerState() {
    return {
        isOpen: isPanelOpen,
        trackId: currentTrackId,
        chordType: currentChordType,
        octave: currentOctave
    };
}

// --- Get Track for Chord Playing ---
function getTargetTrack() {
    if (!currentTrackId) return null;
    // Access tracks via global - need to use appServices approach
    if (typeof getTracks === 'function') {
        const tracks = getTracks();
        return tracks.find(t => t.id === currentTrackId);
    }
    return null;
}

// --- Play a Single Note ---
function playNote(pitch, velocity = 0.7) {
    const track = getTargetTrack();
    if (!track) return;
    
    const now = Tone.now();
    activeNotes.add(pitch);
    heldKeys.add(pitch);
    
    if (track.playNote) {
        track.playNote(pitch, now, undefined, velocity);
    } else if (track.instrument && track.instrument.triggerAttack) {
        const freq = Tone.Frequency(pitch, 'midi').toFrequency();
        track.instrument.triggerAttack(freq, now, velocity);
    }
}

// --- Release a Single Note ---
function releaseNote(pitch) {
    const track = getTargetTrack();
    if (!track) return;
    
    const now = Tone.now();
    activeNotes.delete(pitch);
    heldKeys.delete(pitch);
    
    if (track.releaseNote) {
        track.releaseNote(pitch, now);
    } else if (track.instrument && track.instrument.triggerRelease) {
        const freq = Tone.Frequency(pitch, 'midi').toFrequency();
        track.instrument.triggerRelease(freq, now);
    }
}

// --- Play a Chord (multiple notes) ---
export function playChord(rootPitch, chordType, velocity = 0.7) {
    const pattern = Constants.CHORD_PATTERNS[chordType];
    if (!pattern) {
        console.warn(`[MIDIChordPlayer] Unknown chord type: ${chordType}`);
        return;
    }
    
    // Release any currently held notes first
    releaseAllNotes();
    
    // Play all notes in the chord
    pattern.intervals.forEach(interval => {
        const pitch = rootPitch + interval;
        playNote(pitch, velocity);
    });
}

// --- Release All Notes ---
export function releaseAllNotes() {
    activeNotes.forEach(pitch => {
        releaseNote(pitch);
    });
    activeNotes.clear();
}

// --- Release Chord ---
export function releaseChord() {
    releaseAllNotes();
}

// --- Get Note Name from MIDI ---
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = noteNames[midi % 12];
    return `${noteName}${octave}`;
}

// --- Create Piano Key Element ---
function createPianoKey(pitch, isBlack = false) {
    const key = document.createElement('div');
    key.className = `piano-key ${isBlack ? 'black' : 'white'}`;
    key.dataset.pitch = pitch;
    key.dataset.noteName = midiToNoteName(pitch);
    
    const basePitch = currentOctave * 12 + (pitch % 12);
    const displayPitch = pitch >= basePitch && pitch < basePitch + 12 ? pitch : basePitch + (pitch % 12);
    key.dataset.displayPitch = displayPitch;
    key.dataset.noteName = midiToNoteName(displayPitch);
    
    key.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const pitch = parseInt(key.dataset.displayPitch);
        const velocity = 0.7;
        
        // Calculate root note based on which key was clicked
        const rootPitch = pitch - (pitch % 12) + (currentOctave * 12);
        playChord(rootPitch, currentChordType, velocity);
    });
    
    key.addEventListener('mouseup', () => {
        releaseChord();
    });
    
    key.addEventListener('mouseleave', () => {
        if (heldKeys.size > 0) {
            releaseChord();
        }
    });
    
    // Touch events for mobile
    key.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const pitch = parseInt(key.dataset.displayPitch);
        const velocity = 0.7;
        const rootPitch = pitch - (pitch % 12) + (currentOctave * 12);
        playChord(rootPitch, currentChordType, velocity);
    });
    
    key.addEventListener('touchend', () => {
        releaseChord();
    });
    
    return key;
}

// --- Render Piano Keyboard ---
function renderPianoKeys(container) {
    if (!container) return;
    container.innerHTML = '';
    
    // Create one octave of keys (C to B)
    const baseOctave = currentOctave;
    
    // White keys: C, D, E, F, G, A, B (semitones 0, 2, 4, 5, 7, 9, 11)
    const whiteKeyPattern = [0, 2, 4, 5, 7, 9, 11];
    const blackKeyPattern = [1, 3, 6, 8, 10]; // Positioned after white keys
    
    for (let octaveOffset = 0; octaveOffset < 2; octaveOffset++) {
        const octave = baseOctave + octaveOffset;
        
        // White keys
        whiteKeyPattern.forEach((semitone, idx) => {
            const pitch = (octave * 12) + semitone;
            const key = createPianoKey(pitch, false);
            key.dataset.octave = octave;
            container.appendChild(key);
        });
        
        // Black keys (positioned with CSS)
        blackKeyPattern.forEach((semitone, idx) => {
            const pitch = (octave * 12) + semitone;
            const key = createPianoKey(pitch, true);
            key.dataset.octave = octave;
            container.appendChild(key);
        });
    }
}

// --- Render Chord Player Panel ---
function renderChordPlayerContent(container) {
    if (!container) return;
    
    const tracks = typeof getTracks === 'function' ? getTracks() : [];
    const instrumentTracks = tracks.filter(t => t.type !== 'Audio');
    const scaleHighlightEnabled = getScaleHighlightEnabled();
    const scaleLockRoot = getScaleLockRoot();
    const scaleLockType = getScaleLockType();
    
    let html = `
        <div id="midiChordPlayerContent" style="padding: 12px; color: #e5e5e5; height: 100%; display: flex; flex-direction: column;">
            <div style="margin-bottom: 12px;">
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #888;">Track:</label>
                    <select id="chordPlayerTrackSelect" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff; font-size: 12px;">
                        ${instrumentTracks.length === 0 ? '<option value="">No instrument tracks</option>' : 
                            instrumentTracks.map(t => `<option value="${t.id}" ${t.id === currentTrackId ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
                
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #888;">Chord:</label>
                    <select id="chordPlayerTypeSelect" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff; font-size: 12px;">
                        ${Object.entries(Constants.CHORD_PATTERNS).map(([id, pattern]) => 
                            `<option value="${id}" ${id === currentChordType ? 'selected' : ''}>${pattern.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #888;">Octave:</label>
                    <input type="range" id="chordPlayerOctaveSlider" min="2" max="6" value="${currentOctave}" 
                        style="flex: 1; accent-color: #00b0b0;">
                    <span id="chordPlayerOctaveValue" style="font-size: 12px; color: #aaa; min-width: 30px;">${currentOctave}</span>
                </div>
                
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <button id="scaleHighlightToggle" style="padding: 4px 8px; border-radius: 4px; border: 1px solid ${scaleHighlightEnabled ? '#00b0b0' : '#444'}; background: ${scaleHighlightEnabled ? '#004040' : '#222'}; color: ${scaleHighlightEnabled ? '#00b0b0' : '#888'}; font-size: 11px; cursor: pointer;">
                        Scale: ${scaleHighlightEnabled ? 'ON' : 'OFF'}
                    </button>
                    <span style="font-size: 10px; color: #666;">${scaleLockRoot} ${scaleLockType}</span>
                </div>
                
                <div style="font-size: 10px; color: #666; margin-bottom: 4px;">
                    Click a key to play a chord. Release to stop.
                </div>
            </div>
            
            <div id="chordPlayerPianoContainer" class="piano-container" style="flex: 1; display: flex; justify-content: center; align-items: flex-end; padding: 8px 0;">
                <!-- Piano keys rendered here -->
            </div>
            
            <div style="font-size: 10px; color: #555; text-align: center; margin-top: 4px;">
                Current: ${Constants.CHORD_PATTERNS[currentChordType]?.name || 'Major'}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Render piano keys
    const pianoContainer = container.querySelector('#chordPlayerPianoContainer');
    if (pianoContainer) {
        renderPianoKeys(pianoContainer);
        // Apply scale highlight if enabled
        if (scaleHighlightEnabled) {
            updatePianoKeyScaleHighlight(pianoContainer);
        }
    }
    
    // Attach event listeners
    attachChordPlayerEventListeners(container);
}

// --- Attach Event Listeners ---
function attachChordPlayerEventListeners(container) {
    // Track selector
    const trackSelect = container.querySelector('#chordPlayerTrackSelect');
    trackSelect?.addEventListener('change', (e) => {
        currentTrackId = parseInt(e.target.value) || null;
        if (currentTrackId) {
            localAppServices.showNotification?.(`Chord Player track: ${e.target.options[e.target.selectedIndex].text}`, 1500);
        }
    });
    
    // Chord type selector
    const typeSelect = container.querySelector('#chordPlayerTypeSelect');
    typeSelect?.addEventListener('change', (e) => {
        currentChordType = e.target.value;
        localAppServices.showNotification?.(`Chord type: ${Constants.CHORD_PATTERNS[currentChordType]?.name}`, 1500);
    });
    
    // Octave slider
    const octaveSlider = container.querySelector('#chordPlayerOctaveSlider');
    const octaveValue = container.querySelector('#chordPlayerOctaveValue');
    octaveSlider?.addEventListener('input', (e) => {
        currentOctave = parseInt(e.target.value);
        if (octaveValue) octaveValue.textContent = currentOctave;
        // Re-render piano keys with new octave
        const pianoContainer = container.querySelector('#chordPlayerPianoContainer');
        if (pianoContainer) {
            renderPianoKeys(pianoContainer);
        }
    });
    
    // Scale highlight toggle
    const scaleToggle = container.querySelector('#scaleHighlightToggle');
    scaleToggle?.addEventListener('click', () => {
        const pianoContainer = container.querySelector('#chordPlayerPianoContainer');
        const newState = toggleScaleHighlight(pianoContainer);
        // Update button appearance
        scaleToggle.style.borderColor = newState ? '#00b0b0' : '#444';
        scaleToggle.style.background = newState ? '#004040' : '#222';
        scaleToggle.style.color = newState ? '#00b0b0' : '#888';
        scaleToggle.textContent = `Scale: ${newState ? 'ON' : 'OFF'}`;
        localAppServices.showNotification?.(`Scale Highlight: ${newState ? 'ON' : 'OFF'}`, 1000);
    });
    
    // Scale preview on hover
    const pianoContainer = container.querySelector('#chordPlayerPianoContainer');
    if (pianoContainer) {
        setupScalePreview(pianoContainer);
    }
}

// --- Open MIDI Chord Player Panel ---
export function openMIDIChordPlayerPanel() {
    const windowId = 'midiChordPlayer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'midiChordPlayerWindowContent';
    contentContainer.className = 'p-2 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 480, 
        height: 320, 
        minWidth: 350, 
        minHeight: 220,
        initialContentKey: windowId,
        closable: true, 
        minimizable: true, 
        resizable: true 
    };
    
    const win = localAppServices.createWindow(windowId, 'MIDI Chord Player', contentContainer, options);
    
    if (win?.element) {
        // Apply custom styling for piano keys
        const style = document.createElement('style');
        style.textContent = `
            .piano-container {
                user-select: none;
                -webkit-user-select: none;
            }
            .piano-key {
                cursor: pointer;
                transition: background-color 0.1s;
            }
            .piano-key.white {
                width: 32px;
                height: 120px;
                background: linear-gradient(180deg, #fafafa 0%, #e8e8e8 100%);
                border: 1px solid #333;
                border-radius: 0 0 4px 4px;
                margin: 0 1px;
                display: inline-block;
                vertical-align: bottom;
            }
            .piano-key.white:hover {
                background: linear-gradient(180deg, #fff 0%, #ddd 100%);
            }
            .piano-key.white:active {
                background: linear-gradient(180deg, #ddd 0%, #ccc 100%);
            }
            .piano-key.black {
                width: 22px;
                height: 75px;
                background: linear-gradient(180deg, #333 0%, #111 100%);
                border: 1px solid #000;
                border-radius: 0 0 3px 3px;
                margin: 0 -11px;
                display: inline-block;
                vertical-align: bottom;
                z-index: 1;
                position: relative;
            }
            .piano-key.black:hover {
                background: linear-gradient(180deg, #444 0%, #222 100%);
            }
            .piano-key.black:active {
                background: linear-gradient(180deg, #222 0%, #111 100%);
            }
            .piano-key.active {
                background: #00b0b0 !important;
            }
            .piano-key.in-scale.white {
                background: linear-gradient(180deg, #a0e0a0 0%, #80c880 100%) !important;
            }
            .piano-key.in-scale.black {
                background: linear-gradient(180deg, #2a5a2a 0%, #1a3a1a 100%) !important;
            }
            .piano-key.out-of-scale.white {
                background: linear-gradient(180deg, #808080 0%, #606060 100%) !important;
            }
            .piano-key.out-of-scale.black {
                background: linear-gradient(180deg, #404040 0%, #202020 100%) !important;
            }
        `;
        win.element.appendChild(style);
        
        setTimeout(() => renderChordPlayerContent(contentContainer), 50);
    }
    
    isPanelOpen = true;
    return win;
}

// --- Update Panel ---
export function updateMIDIChordPlayerPanel() {
    const container = document.getElementById('midiChordPlayerWindowContent');
    if (container) {
        renderChordPlayerContent(container);
    }
}

// --- Close Panel ---
export function closeMIDIChordPlayerPanel() {
    releaseAllNotes();
    isPanelOpen = false;
    currentTrackId = null;
}

// --- Scale Highlight Toggle for Piano Keys ---
function updatePianoKeyScaleHighlight(container) {
    if (!container) return;
    const scaleEnabled = getScaleHighlightEnabled();
    const scaleNotes = getScaleHighlightNotes();
    const keys = container.querySelectorAll('.piano-key');
    
    keys.forEach(key => {
        const pitch = parseInt(key.dataset.displayPitch);
        const isInScale = scaleNotes.includes(pitch);
        
        if (scaleEnabled) {
            if (isInScale) {
                key.classList.add('in-scale');
            } else {
                key.classList.add('out-of-scale');
            }
        } else {
            key.classList.remove('in-scale', 'out-of-scale');
        }
    });
}

// --- Toggle Scale Highlight Mode ---
function toggleScaleHighlight(container) {
    const current = getScaleHighlightEnabled();
    setScaleHighlightEnabled(!current);
    updatePianoKeyScaleHighlight(container);
    return !current;
}

// --- Update Piano Key Colors After Scale/Harmonic Mode Change ---
export function updateChordPlayerScaleHighlight() {
    const container = document.getElementById('chordPlayerPianoContainer');
    if (container) {
        updatePianoKeyScaleHighlight(container);
    }
}