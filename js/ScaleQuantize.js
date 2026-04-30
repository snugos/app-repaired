// js/ScaleQuantize.js - Scale Quantize Panel
// Snap selected notes to musical scale degrees, not just grid

let localAppServices = {};
let scaleQuantizeWindow = null;

// Import ScaleLock for scale definitions
let ScaleLock = null;

// Scale definitions (same as ScaleLock)
const SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'natural_minor': [0, 2, 3, 5, 7, 8, 10],
    'harmonic_minor': [0, 2, 3, 5, 7, 8, 11],
    'melodic_minor': [0, 2, 3, 5, 7, 9, 11],
    'pentatonic_major': [0, 2, 4, 7, 9],
    'pentatonic_minor': [0, 3, 5, 7, 10],
    'blues': [0, 3, 5, 6, 7, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'locrian': [0, 1, 3, 5, 6, 8, 10],
    'whole_tone': [0, 2, 4, 6, 8, 10],
    'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'diminished': [0, 2, 3, 5, 6, 8, 9, 11],
    'bebop_dominant': [0, 2, 4, 5, 7, 9, 10, 11],
    'enigmatic_major': [0, 1, 4, 6, 8, 10, 11],
    'hirajoshi': [0, 2, 3, 7, 8],
    'gamelan': [0, 1, 3, 7, 8],
    'ritusen': [0, 2, 5, 7, 9],
};

// Note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Current settings
let currentScale = 'major';
let currentRootNote = 0; // C

export function initScaleQuantize(appServices) {
    localAppServices = appServices || {};
    
    // Try to load ScaleLock
    import('./ScaleLock.js').then(m => {
        ScaleLock = m;
        console.log('[ScaleQuantize] ScaleLock loaded');
    }).catch(err => {
        console.warn('[ScaleQuantize] ScaleLock not available, using built-in scales');
    });
    
    console.log('[ScaleQuantize] Module initialized');
}

function getScaleIntervals(scaleName) {
    if (ScaleLock?.getScaleIntervals) {
        return ScaleLock.getScaleIntervals(scaleName);
    }
    return SCALES[scaleName] || SCALES['major'];
}

function snapNoteToScale(midiNote, scaleName, rootNote) {
    const intervals = getScaleIntervals(scaleName);
    const rootInOctave = ((rootNote % 12) + 12) % 12;
    const noteInOctave = ((midiNote % 12) + 12) % 12;
    
    // Check if note is already in scale
    const noteRelativeToRoot = ((noteInOctave - rootInOctave) + 12) % 12;
    if (intervals.includes(noteRelativeToRoot)) {
        return midiNote; // Already in scale
    }
    
    // Find nearest scale degree
    let bestInterval = intervals[0];
    let bestDistance = 12;
    
    for (const interval of intervals) {
        const adjustedInterval = (interval + rootInOctave) % 12;
        const distance = Math.min(
            Math.abs(noteInOctave - adjustedInterval),
            Math.abs(noteInOctave - adjustedInterval - 12),
            Math.abs(noteInOctave - adjustedInterval + 12)
        );
        if (distance < bestDistance) {
            bestDistance = distance;
            bestInterval = interval;
        }
    }
    
    // Calculate octave and snapped note
    const octave = Math.floor(midiNote / 12);
    const snappedNote = (octave * 12) + rootInOctave + bestInterval;
    
    return snappedNote;
}

export function openScaleQuantizePanel() {
    const windowId = 'scaleQuantizePanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !scaleQuantizeWindow) {
        const win = openWindows.get(windowId);
        win.restore();
        renderScaleQuantizeContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'scaleQuantizeContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = {
        width: 380,
        height: 420,
        minWidth: 320,
        minHeight: 380,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Scale Quantize', contentContainer, options);
    if (win?.element) {
        scaleQuantizeWindow = win;
        renderScaleQuantizeContent();
    }
    
    return win;
}

function renderScaleQuantizeContent() {
    const container = document.getElementById('scaleQuantizeContent');
    if (!container) return;
    
    const scaleOptions = Object.keys(SCALES).map(name => {
        const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `<option value="${name}" ${name === currentScale ? 'selected' : ''}>${displayName}</option>`;
    }).join('');
    
    const rootOptions = NOTE_NAMES.map((name, i) => 
        `<option value="${i}" ${i === currentRootNote ? 'selected' : ''}>${name}</option>`
    ).join('');
    
    // Get note preview
    const scaleIntervals = getScaleIntervals(currentScale);
    const scaleNotes = scaleIntervals.map(interval => {
        const noteIndex = (currentRootNote + interval) % 12;
        return NOTE_NAMES[noteIndex];
    }).join(' - ');
    
    container.innerHTML = `
        <div class="space-y-4">
            <div class="text-sm text-gray-600 dark:text-gray-400">
                Snap selected notes to notes within a musical scale
            </div>
            
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scale</label>
                    <select id="scaleQuantizeScale" class="w-full px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-sm text-gray-800 dark:text-gray-200">
                        ${scaleOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Root Note</label>
                    <select id="scaleQuantizeRoot" class="w-full px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-sm text-gray-800 dark:text-gray-200">
                        ${rootOptions}
                    </select>
                </div>
            </div>
            
            <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <div class="text-xs text-gray-500 mb-1">Scale Notes:</div>
                <div class="text-sm font-mono text-gray-800 dark:text-gray-200">${scaleNotes}</div>
            </div>
            
            <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                <input type="checkbox" id="scaleQuantizeSnap" checked class="w-4 h-4 accent-blue-500">
                <label for="scaleQuantizeSnap" class="text-sm text-gray-700 dark:text-gray-300">
                    Snap notes to nearest scale degree
                </label>
            </div>
            
            <div class="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-800">
                <input type="checkbox" id="scaleQuantizeTranspose" class="w-4 h-4 accent-amber-500">
                <label for="scaleQuantizeTranspose" class="text-sm text-gray-700 dark:text-gray-300">
                    Transpose notes to scale octave
                </label>
            </div>
            
            <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <div class="text-xs text-gray-500 mb-2">Preview (C4 = 60):</div>
                <div id="scaleQuantizePreview" class="text-sm font-mono text-gray-800 dark:text-gray-200">
                    Testing snap...
                </div>
            </div>
            
            <div class="flex gap-2">
                <button id="scaleQuantizeApply" class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium text-sm transition-colors">
                    Apply to Selected Notes
                </button>
            </div>
            
            <button id="scaleQuantizeToPianoRoll" class="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-medium text-sm transition-colors">
                Open Piano Roll & Quantize
            </button>
        </div>
    `;
    
    // Attach event listeners
    const scaleSelect = container.querySelector('#scaleQuantizeScale');
    const rootSelect = container.querySelector('#scaleQuantizeRoot');
    const snapCheckbox = container.querySelector('#scaleQuantizeSnap');
    const transposeCheckbox = container.querySelector('#scaleQuantizeTranspose');
    const applyBtn = container.querySelector('#scaleQuantizeApply');
    const pianoRollBtn = container.querySelector('#scaleQuantizeToPianoRoll');
    const preview = container.querySelector('#scaleQuantizePreview');
    
    scaleSelect?.addEventListener('change', (e) => {
        currentScale = e.target.value;
        renderScaleQuantizeContent();
    });
    
    rootSelect?.addEventListener('change', (e) => {
        currentRootNote = parseInt(e.target.value, 10);
        renderScaleQuantizeContent();
    });
    
    // Update preview
    if (preview) {
        const testNote = 60; // C4
        const snapped = snapNoteToScale(testNote, currentScale, currentRootNote);
        const snappedName = NOTE_NAMES[snapped % 12] + Math.floor(snapped / 12);
        const wasChanged = snapped !== testNote;
        preview.innerHTML = `
            <span class="text-gray-500">Input:</span> C4 (60) → 
            <span class="${wasChanged ? 'text-green-600 dark:text-green-400 font-bold' : 'text-gray-600 dark:text-gray-400'}">${snappedName} (${snapped})</span>
            ${wasChanged ? '<span class="text-green-500 ml-1">← snapped</span>' : '<span class="text-gray-400 ml-1">← unchanged</span>'}
        `;
    }
    
    applyBtn?.addEventListener('click', () => {
        const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
        const selectedTrackId = typeof window.currentPianoRollTrackId !== 'undefined' ? window.currentPianoRollTrackId : null;
        const track = tracks.find(t => t.id === selectedTrackId) || tracks[0];
        
        if (!track) {
            localAppServices.showNotification?.('No track found', 2000);
            return;
        }
        
        const snapped = quantizeSelectedNotes(track, snapCheckbox?.checked, transposeCheckbox?.checked);
        localAppServices.showNotification?.(`Scale Quantize: ${snapped} notes adjusted`, 2000);
        renderScaleQuantizeContent();
    });
    
    pianoRollBtn?.addEventListener('click', () => {
        // Apply first then open piano roll
        const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
        const selectedTrackId = typeof window.currentPianoRollTrackId !== 'undefined' ? window.currentPianoRollTrackId : null;
        const track = tracks.find(t => t.id === selectedTrackId) || tracks[0];
        
        if (track) {
            quantizeSelectedNotes(track, snapCheckbox?.checked, transposeCheckbox?.checked);
        }
        
        // Open piano roll if available
        if (window.openPianoRollEditor) {
            window.openPianoRollEditor(track?.id);
        } else {
            localAppServices.showNotification?.('Piano Roll not available', 2000);
        }
    });
}

function quantizeSelectedNotes(track, snapEnabled = true, transposeEnabled = false) {
    if (!track?.sequence?.data) return 0;
    
    if (track.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo('Scale Quantize');
    }
    
    let adjustedCount = 0;
    const seq = track.sequence;
    
    // Check for selected notes from PianoRollEditor
    const hasSelectedNotes = window.selectedNotes && window.selectedNotes.size > 0;
    
    for (let row = 0; row < (seq.data?.length || 0); row++) {
        const rowData = seq.data[row];
        if (!rowData) continue;
        
        for (let step = 0; step < (rowData?.length || 0); step++) {
            const note = rowData[step];
            if (!note) continue;
            
            // If selected notes exist, only process selected ones
            if (hasSelectedNotes) {
                const noteKey = `pr-note-${row}-${step}`;
                if (!window.selectedNotes.has(noteKey)) continue;
            }
            
            // Calculate the actual MIDI note from row
            // For drum tracks, row = pad index (not MIDI)
            // For synth tracks, row typically maps to pitch
            const basePitch = track.type === 'DrumSampler' ? 0 : 36; // C2 for synth
            const midiNote = basePitch + row;
            
            if (snapEnabled) {
                const snapped = snapNoteToScale(midiNote, currentScale, currentRootNote);
                
                if (snapped !== midiNote) {
                    const newRow = snapped - basePitch;
                    
                    // Move note to new row
                    rowData[step] = { ...note, pitch: snapped };
                    
                    // Need to handle row change - move the note
                    if (newRow !== row && seq.data[newRow] !== undefined) {
                        // Clear original
                        rowData[step] = null;
                        // Place in new row
                        if (!seq.data[newRow]) seq.data[newRow] = [];
                        seq.data[newRow][step] = { ...note, pitch: snapped };
                    }
                    
                    adjustedCount++;
                }
            }
            
            if (transposeEnabled) {
                // Transpose to closest scale octave
                const midiPitch = note.pitch || (basePitch + row);
                const snapped = snapNoteToScale(midiPitch, currentScale, currentRootNote);
                const octave = Math.floor(snapped / 12);
                const targetOctave = Math.floor(midiPitch / 12);
                const transposed = snapped + ((targetOctave - octave) * 12);
                
                if (transposed !== midiPitch) {
                    note.pitch = transposed;
                    adjustedCount++;
                }
            }
        }
    }
    
    if (track.recreateToneSequence) {
        track.recreateToneSequence(true);
    }
    if (track.appServices?.updateTrackUI) {
        track.appServices.updateTrackUI(track.id, 'sequenceChanged');
    }
    
    return adjustedCount;
}

export function quantizeTrackToScale(trackId, scaleName, rootNote) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) return 0;
    
    const snapped = quantizeSelectedNotes(track, true, false);
    return snapped;
}

// Expose globally for menu access
window.openScaleQuantizePanel = openScaleQuantizePanel;
window.scaleQuantizePanel = {
    init: initScaleQuantize,
    open: openScaleQuantizePanel,
    quantize: quantizeTrackToScale
};

export default {
    initScaleQuantize,
    openScaleQuantizePanel,
    quantizeTrackToScale
};
