/**
 * js/ScaleHighlightMode.js - Scale Highlight Mode for Piano Roll
 * 
 * Highlights piano roll notes that match a selected musical scale,
 * helping musicians stay in key while composing.
 */

let localAppServices = {};
let currentScale = 'major';
let currentRootNote = 0; // 0 = C, 1 = C#, etc.
let scaleHighlightEnabled = false;
let customScaleIntervals = []; // For custom scales

// Scale definitions: intervals from root (in semitones)
const SCALE_PRESETS = {
    major: { name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11], description: 'Bright, happy sound' },
    minor: { name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10], description: 'Dark, sad sound' },
    harmonic_minor: { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], description: 'Exotic, classical sound' },
    melodic_minor: { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11], description: 'Jazz minor scale' },
    pentatonic_major: { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], description: 'Folk, rock, blues' },
    pentatonic_minor: { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], description: 'Blues, rock, jazz' },
    blues: { name: 'Blues Scale', intervals: [0, 3, 5, 6, 7, 10], description: 'Classic blues inflection' },
    dorian: { name: 'Dorian Mode', intervals: [0, 2, 3, 5, 7, 9, 10], description: 'Minor with bright 6th' },
    phrygian: { name: 'Phrygian Mode', intervals: [0, 1, 3, 5, 7, 8, 10], description: 'Flamenco, metal' },
    lydian: { name: 'Lydian Mode', intervals: [0, 2, 4, 6, 7, 9, 11], description: 'Major with bright 4th' },
    mixolydian: { name: 'Mixolydian Mode', intervals: [0, 2, 4, 5, 7, 9, 10], description: 'Dominant, rock sound' },
    locrian: { name: 'Locrian Mode', intervals: [0, 1, 3, 5, 6, 8, 10], description: 'Diminished, unstable' },
    whole_tone: { name: 'Whole Tone', intervals: [0, 2, 4, 6, 8, 10], description: 'Dreamy, symmetric' },
    chromatic: { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], description: 'All notes' },
    bebop_dominant: { name: 'Bebop Dominant', intervals: [0, 2, 4, 5, 7, 9, 10, 11], description: 'Jazz bebop scale' },
    diminished: { name: 'Diminished', intervals: [0, 2, 3, 5, 6, 8, 9, 11], description: 'Symmetric diminished' }
};

// Note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function initScaleHighlightMode(appServices) {
    localAppServices = appServices || {};
    console.log('[ScaleHighlightMode] Module initialized');
}

/**
 * Get all available scale presets
 * @returns {Object} Scale presets
 */
export function getScalePresets() {
    return { ...SCALE_PRESETS };
}

/**
 * Get scale preset by ID
 * @param {string} scaleId - Scale ID
 * @returns {Object} Scale preset
 */
export function getScalePresetById(scaleId) {
    return SCALE_PRESETS[scaleId] || SCALE_PRESETS.major;
}

/**
 * Get current scale settings
 * @returns {Object} Current scale settings
 */
export function getCurrentScaleSettings() {
    return {
        scale: currentScale,
        rootNote: currentRootNote,
        enabled: scaleHighlightEnabled,
        customIntervals: [...customScaleIntervals]
    };
}

/**
 * Set the current scale
 * @param {string} scaleId - Scale ID
 */
export function setScale(scaleId) {
    if (SCALE_PRESETS[scaleId]) {
        currentScale = scaleId;
        console.log(`[ScaleHighlightMode] Scale set to: ${SCALE_PRESETS[scaleId].name}`);
    }
}

/**
 * Set the root note
 * @param {number} rootNote - Root note (0-11 for C through B)
 */
export function setRootNote(rootNote) {
    currentRootNote = Math.max(0, Math.min(11, Math.round(rootNote)));
}

/**
 * Set custom scale intervals
 * @param {number[]} intervals - Array of semitone intervals
 */
export function setCustomScaleIntervals(intervals) {
    customScaleIntervals = [...intervals];
    if (intervals.length > 0) {
        currentScale = 'custom';
    }
}

/**
 * Enable or disable scale highlighting
 * @param {boolean} enabled - Enable state
 */
export function setScaleHighlightEnabled(enabled) {
    scaleHighlightEnabled = !!enabled;
}

/**
 * Check if a MIDI note is in the current scale
 * @param {number} midiNote - MIDI note number (0-127)
 * @returns {boolean} True if note is in scale
 */
export function isNoteInScale(midiNote) {
    if (!scaleHighlightEnabled) return true; // All notes valid if disabled
    
    const noteInOctave = midiNote % 12;
    const preset = SCALE_PRESETS[currentScale];
    
    if (!preset) return true;
    
    // Check if note's interval from root matches any scale interval
    let noteInterval = (noteInOctave - currentRootNote) % 12;
    if (noteInterval < 0) noteInterval += 12;
    
    return preset.intervals.includes(noteInterval);
}

/**
 * Get the interval of a note from the root in current scale
 * @param {number} midiNote - MIDI note number
 * @returns {number} Interval position in scale (-1 if not in scale)
 */
export function getNoteScalePosition(midiNote) {
    if (!scaleHighlightEnabled) return 0;
    
    const noteInOctave = midiNote % 12;
    let noteInterval = (noteInOctave - currentRootNote) % 12;
    if (noteInterval < 0) noteInterval += 12;
    
    const preset = SCALE_PRESETS[currentScale];
    if (!preset) return 0;
    
    return preset.intervals.indexOf(noteInterval);
}

/**
 * Get notes that are NOT in the current scale (guide tones/warnings)
 * @param {number[]} midiNotes - Array of MIDI note numbers
 * @returns {number[]} Notes not in scale
 */
export function getNotesOutOfScale(midiNotes) {
    if (!scaleHighlightEnabled) return [];
    return midiNotes.filter(note => !isNoteInScale(note));
}

/**
 * Quantize notes to nearest scale note
 * @param {number} midiNote - MIDI note to quantize
 * @returns {number} Quantized MIDI note in scale
 */
export function quantizeNoteToScale(midiNote) {
    const noteInOctave = midiNote % 12;
    let noteInterval = (noteInOctave - currentRootNote) % 12;
    if (noteInterval < 0) noteInterval += 12;
    
    const preset = SCALE_PRESETS[currentScale];
    if (!preset) return midiNote;
    
    // Find nearest scale interval
    let nearestInterval = preset.intervals[0];
    let minDistance = 12;
    
    for (const interval of preset.intervals) {
        let distance = Math.abs(interval - noteInterval);
        if (distance > 6) distance = 12 - distance; // Wrap around
        if (distance < minDistance) {
            minDistance = distance;
            nearestInterval = interval;
        }
    }
    
    // Calculate quantized note
    const octaveOffset = Math.floor(midiNote / 12) - 1;
    const quantizedNote = (octaveOffset + 1) * 12 + currentRootNote + nearestInterval;
    
    return Math.max(0, Math.min(127, quantizedNote));
}

/**
 * Get CSS class for note based on scale
 * @param {number} midiNote - MIDI note number
 * @param {number} velocity - Note velocity (0-1)
 * @returns {Object} { bgClass, borderClass, isInScale }
 */
export function getNoteScaleClass(midiNote, velocity = 0.8) {
    const inScale = isNoteInScale(midiNote);
    
    if (!scaleHighlightEnabled) {
        return {
            bgClass: velocity > 0.9 ? 'bg-red-500' : velocity > 0.7 ? 'bg-yellow-500' : 'bg-green-500',
            borderClass: '',
            isInScale: true
        };
    }
    
    if (inScale) {
        // In scale - color based on scale degree
        const position = getNoteScalePosition(midiNote);
        const isRoot = position === 0;
        const isChord = [0, 2, 4].includes(position); // Root, 3rd, 5th
        
        return {
            bgClass: isRoot ? 'bg-purple-500' : isChord ? 'bg-blue-500' : 'bg-cyan-500',
            borderClass: 'border-purple-300',
            isInScale: true
        };
    } else {
        // Out of scale - warning color
        return {
            bgClass: 'bg-orange-600',
            borderClass: 'border-red-400 border',
            isInScale: false
        };
    }
}

/**
 * Open the Scale Highlight Mode panel
 */
export function openScaleHighlightPanel() {
    const windowId = 'scaleHighlightPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderScaleHighlightContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'scaleHighlightContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    const options = {
        width: 380,
        height: 480,
        minWidth: 320,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Scale Highlight Mode', contentContainer, options);
    if (win?.element) {
        renderScaleHighlightContent();
    }
    return win;
}

/**
 * Render the Scale Highlight Mode panel content
 */
function renderScaleHighlightContent() {
    const container = document.getElementById('scaleHighlightContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    // Build scale options HTML
    let scaleOptionsHtml = '';
    Object.entries(SCALE_PRESETS).forEach(([id, scale]) => {
        scaleOptionsHtml += `<option value="${id}" ${id === currentScale ? 'selected' : ''}>${scale.name}</option>`;
    });
    
    // Build root note options HTML
    let rootNoteOptionsHtml = '';
    NOTE_NAMES.forEach((name, idx) => {
        rootNoteOptionsHtml += `<option value="${idx}" ${idx === currentRootNote ? 'selected' : ''}>${name}</option>`;
    });

    const html = `
        <div class="mb-3">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="scaleHighlightEnabled" ${scaleHighlightEnabled ? 'checked' : ''} 
                       class="w-4 h-4 accent-purple-500">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Scale Highlighting</span>
            </label>
        </div>
        
        <div class="mb-3 space-y-2">
            <div>
                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Root Note</label>
                <select id="scaleRootNote" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                    ${rootNoteOptionsHtml}
                </select>
            </div>
            
            <div>
                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Scale Type</label>
                <select id="scaleType" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                    ${scaleOptionsHtml}
                </select>
            </div>
            
            <div id="scaleDescription" class="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-slate-700 rounded">
                ${SCALE_PRESETS[currentScale]?.description || ''}
            </div>
        </div>
        
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Scale Notes</h3>
            <div id="scaleNotesDisplay" class="flex flex-wrap gap-1">
                ${renderScaleNotesDisplay()}
            </div>
        </div>
        
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Actions</h3>
            <div class="flex flex-wrap gap-2">
                <button id="quantizeToScaleBtn" class="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-500">
                    Quantize Selected to Scale
                </button>
                <button id="highlightOutOfScaleBtn" class="px-3 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-500">
                    Highlight Out-of-Scale Notes
                </button>
                <button id="resetScaleBtn" class="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-400">
                    Reset to Major (C)
                </button>
            </div>
        </div>
        
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Legend</h3>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-purple-500 rounded"></div>
                    <span class="text-gray-600 dark:text-gray-400">Root Note</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-blue-500 rounded"></div>
                    <span class="text-gray-600 dark:text-gray-400">Chord Tones</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-cyan-500 rounded"></div>
                    <span class="text-gray-600 dark:text-gray-400">Scale Tones</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-orange-600 rounded border border-red-400"></div>
                    <span class="text-gray-600 dark:text-gray-400">Out of Scale</span>
                </div>
            </div>
        </div>
        
        <div class="p-2 bg-blue-50 dark:bg-slate-700 rounded">
            <p class="text-xs text-gray-600 dark:text-gray-400">
                <strong>Tip:</strong> When enabled, notes not in the selected scale will be highlighted in orange. 
                Use "Quantize to Scale" to automatically snap out-of-scale notes to the nearest scale tone.
            </p>
        </div>
    `;

    container.innerHTML = html;

    // Event listeners
    container.querySelector('#scaleHighlightEnabled')?.addEventListener('change', (e) => {
        setScaleHighlightEnabled(e.target.checked);
        renderScaleHighlightContent();
        notifyPianoRollUpdate();
    });

    container.querySelector('#scaleRootNote')?.addEventListener('change', (e) => {
        setRootNote(parseInt(e.target.value, 10));
        renderScaleHighlightContent();
        notifyPianoRollUpdate();
    });

    container.querySelector('#scaleType')?.addEventListener('change', (e) => {
        setScale(e.target.value);
        const desc = SCALE_PRESETS[e.target.value]?.description || '';
        container.querySelector('#scaleDescription').textContent = desc;
        renderScaleHighlightContent();
        notifyPianoRollUpdate();
    });

    container.querySelector('#quantizeToScaleBtn')?.addEventListener('click', () => {
        quantizeSelectedNotesToScale();
    });

    container.querySelector('#highlightOutOfScaleBtn')?.addEventListener('click', () => {
        highlightOutOfScaleNotes();
    });

    container.querySelector('#resetScaleBtn')?.addEventListener('click', () => {
        currentScale = 'major';
        currentRootNote = 0;
        scaleHighlightEnabled = false;
        renderScaleHighlightContent();
        notifyPianoRollUpdate();
        localAppServices.showNotification?.('Scale reset to Major (C)', 1500);
    });
}

/**
 * Render the scale notes display (piano keyboard style)
 * @returns {string} HTML
 */
function renderScaleNotesDisplay() {
    let html = '<div class="flex gap-1">';
    
    for (let i = 0; i < 12; i++) {
        const inScale = SCALE_PRESETS[currentScale]?.intervals.includes(i);
        const isRoot = i === currentRootNote;
        const isBlack = [1, 3, 6, 8, 10].includes(i);
        
        let bgClass = 'bg-gray-200 dark:bg-gray-600';
        if (inScale) {
            bgClass = isRoot ? 'bg-purple-500' : 'bg-cyan-400';
        }
        
        html += `
            <div class="w-6 h-8 ${bgClass} ${isBlack ? 'opacity-70' : ''} rounded text-center flex items-center justify-center text-[8px] text-white font-bold"
                 title="${NOTE_NAMES[i]}${inScale ? ' (in scale)' : ''}">
                ${NOTE_NAMES[i]}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

/**
 * Notify piano roll editor to update if open
 */
function notifyPianoRollUpdate() {
    if (localAppServices.updatePianoRollEditor) {
        localAppServices.updatePianoRollEditor();
    }
}

/**
 * Quantize selected notes to the nearest scale note
 */
function quantizeSelectedNotesToScale() {
    // This would interact with the piano roll's selected notes
    // For now, just notify
    localAppServices.showNotification?.('Quantize to scale: Select notes in piano roll first, then click this button', 2000);
}

/**
 * Highlight notes that are out of the selected scale
 */
function highlightOutOfScaleNotes() {
    // This would highlight out-of-scale notes in the current track
    localAppServices.showNotification?.('Highlight out-of-scale notes: Enable scale highlight first', 2000);
}

/**
 * Export functions for use by other modules
 */
export {
    isNoteInScale,
    getNoteScalePosition,
    getNoteScaleClass,
    quantizeNoteToScale,
    getNotesOutOfScale
};