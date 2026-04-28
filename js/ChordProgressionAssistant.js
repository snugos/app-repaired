// js/ChordProgressionAssistant.js - Visual chord progression generator
// Feature: Chord Progression Assistant - Generate progressions based on music theory

let localAppServices = {};

/**
 * Music theory constants
 */
const SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'harmonic_minor': [0, 2, 3, 5, 7, 8, 11],
};

const CHORD_DEGREES = {
    'major': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    'minor': ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'vii°'],
    'dorian': ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
    'mixolydian': ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII'],
    'harmonic_minor': ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'],
};

const CHORD_TYPES_BY_DEGREE = {
    'major': ['maj7', 'min7', 'min7', 'maj7', '7', 'min7', 'min7b5'],
    'minor': ['min7', 'min7b5', 'maj7', 'min7', '7', 'maj7', 'min7'],
    'dorian': ['min7', 'min7', 'maj7', 'min7', '7', 'min7b5', 'maj7'],
    'mixolydian': ['maj7', 'min7', 'min7', 'maj7', 'min7', 'min7', 'maj7'],
    'harmonic_minor': ['min7', 'min7b5', 'maj7', 'min7', '7', 'maj7', 'dim7'],
};

// Common progressions by genre
const COMMON_PROGRESSIONS = {
    'pop': ['I V vi IV', 'I IV V I', 'vi IV I V', 'I V vi iii IV'],
    'jazz': ['ii V I', 'I vi ii V', 'ii V vi ii', 'I III vi ii'],
    'blues': ['I I I I', 'IV IV I I', 'V IV I I'],
    'rock': ['I IV V I', 'I bVII IV', 'i VI III VII'],
    'folk': ['I IV V I', 'I V vi IV', 'I ii V I'],
};

export function initChordProgressionAssistant(services) {
    localAppServices = services;
    console.log('[ChordProgressionAssistant] Initialized');
}

/**
 * Get scale degrees for a scale type
 */
function getScaleDegrees(scaleType) {
    return SCALES[scaleType] || SCALES['major'];
}

/**
 * Build chord name from degree
 */
function buildChordName(rootNote, degreeIndex, scaleType) {
    const degrees = CHORD_DEGREES[scaleType] || CHORD_DEGREES['major'];
    const chordSymbol = degrees[degreeIndex] || 'I';
    // Strip case formatting for display
    return `${rootNote} ${chordSymbol}`;
}

/**
 * Generate a chord progression from a Roman numeral pattern
 */
export function generateProgression(rootNote, scaleType, numeralPattern) {
    const scaleDegrees = getScaleDegrees(scaleType);
    const parts = numeralPattern.split(' ');
    const chords = [];
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIndex = noteNames.indexOf(rootNote.replace(/\d+/, ''));
    
    for (const part of parts) {
        // Parse degree (I, ii, iii, IV, V, vi, vii)
        const degreeChar = part.match(/[ivx]+/i)?.[0] || part[0];
        const isMinor = degreeChar === degreeChar.toLowerCase() && degreeChar !== degreeChar.toUpperCase();
        let degreeIndex = 0;
        
        if (isMinor) {
            // lowercase = minor chords
            const lowerDegrees = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
            degreeIndex = lowerDegrees.indexOf(degreeChar.toLowerCase());
        } else {
            // UPPERCASE = major chords
            const upperDegrees = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
            degreeIndex = upperDegrees.indexOf(degreeChar.toUpperCase());
        }
        
        if (degreeIndex < 0) degreeIndex = 0;
        
        const semitone = scaleDegrees[degreeIndex] || 0;
        const midiNote = rootIndex + semitone;
        const noteName = noteNames[midiNote % 12];
        const octave = Math.floor(midiNote / 12) - 1;
        
        // Determine chord type from degree
        const chordTypes = CHORD_TYPES_BY_DEGREE[scaleType] || CHORD_TYPES_BY_DEGREE['major'];
        const chordType = chordTypes[degreeIndex] || 'maj7';
        
        chords.push({
            name: `${noteName}${octave} ${chordType}`,
            root: `${noteName}${octave}`,
            type: chordType,
            degree: degreeChar
        });
    }
    
    return chords;
}

/**
 * Get common progressions for a genre
 */
export function getCommonProgressions(genre) {
    return COMMON_PROGRESSIONS[genre] || COMMON_PROGRESSIONS['pop'];
}

/**
 * Open the chord progression assistant panel
 */
export function openChordProgressionPanel() {
    const windowId = 'chordProgressionAssistant';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'chordProgressionContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = {
        width: 480,
        height: 580,
        minWidth: 400,
        minHeight: 450,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Chord Progression Assistant', contentContainer, options);
    
    if (win?.element) {
        renderChordProgressionContent();
    }
    
    return win;
}

/**
 * Render the chord progression content
 */
function renderChordProgressionContent() {
    const container = document.getElementById('chordProgressionContent');
    if (!container) return;
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const html = `
        <div class="space-y-4">
            <!-- Key Selection -->
            <div class="bg-white dark:bg-slate-700 rounded-lg p-3 shadow">
                <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Key</label>
                <div class="flex gap-2">
                    <select id="cpRootNote" class="flex-1 rounded px-3 py-2 bg-white dark:bg-slate-600 border">
                        ${noteNames.map(n => `<option value="${n}">${n}</option>`).join('')}
                    </select>
                    <select id="cpScaleType" class="flex-1 rounded px-3 py-2 bg-white dark:bg-slate-600 border">
                        <option value="major">Major</option>
                        <option value="minor">Natural Minor</option>
                        <option value="dorian">Dorian</option>
                        <option value="mixolydian">Mixolydian</option>
                        <option value="harmonic_minor">Harmonic Minor</option>
                    </select>
                </div>
            </div>
            
            <!-- Genre Presets -->
            <div class="bg-white dark:bg-slate-700 rounded-lg p-3 shadow">
                <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Genre Presets</label>
                <div class="flex flex-wrap gap-2">
                    <button class="cp-genre-btn px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200" data-genre="pop">Pop</button>
                    <button class="cp-genre-btn px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded hover:bg-purple-200" data-genre="jazz">Jazz</button>
                    <button class="cp-genre-btn px-3 py-1 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded hover:bg-green-200" data-genre="blues">Blues</button>
                    <button class="cp-genre-btn px-3 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded hover:bg-red-200" data-genre="rock">Rock</button>
                    <button class="cp-genre-btn px-3 py-1 text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded hover:bg-yellow-200" data-genre="folk">Folk</button>
                </div>
            </div>
            
            <!-- Common Progressions -->
            <div class="bg-white dark:bg-slate-700 rounded-lg p-3 shadow">
                <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Common Progressions</label>
                <div id="cpProgressionList" class="space-y-2"></div>
            </div>
            
            <!-- Custom Progression -->
            <div class="bg-white dark:bg-slate-700 rounded-lg p-3 shadow">
                <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Custom Progression</label>
                <input type="text" id="cpCustomProgression" placeholder="e.g., I V vi IV" 
                    class="w-full rounded px-3 py-2 bg-white dark:bg-slate-600 border mb-2">
                <button id="cpApplyCustomBtn" class="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    Apply Custom
                </button>
            </div>
            
            <!-- Preview -->
            <div class="bg-white dark:bg-slate-700 rounded-lg p-3 shadow">
                <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Preview</label>
                <div id="cpPreview" class="flex flex-wrap gap-2 p-3 bg-gray-100 dark:bg-slate-800 rounded min-h-16">
                    <span class="text-gray-500 italic">Select a progression</span>
                </div>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-2">
                <button id="cpApplyBtn" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Apply to Project
                </button>
                <button id="cpSendToChordMemoryBtn" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                    Send to Chord Memory
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    attachChordProgressionListeners();
    updateProgressionList();
}

/**
 * Attach event listeners
 */
function attachChordProgressionListeners() {
    // Genre buttons
    document.querySelectorAll('.cp-genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const genre = btn.dataset.genre;
            const progressions = getCommonProgressions(genre);
            document.getElementById('cpCustomProgression').value = progressions[0];
            updateProgressionList();
        });
    });
    
    // Apply custom button
    document.getElementById('cpApplyCustomBtn')?.addEventListener('click', () => {
        const custom = document.getElementById('cpCustomProgression').value;
        updatePreview(custom);
    });
    
    // Apply to project button
    document.getElementById('cpApplyBtn')?.addEventListener('click', async () => {
        const custom = document.getElementById('cpCustomProgression').value;
        if (custom) {
            await applyProgression(custom);
        }
    });
    
    // Send to Chord Memory button
    document.getElementById('cpSendToChordMemoryBtn')?.addEventListener('click', () => {
        const custom = document.getElementById('cpCustomProgression').value;
        if (custom) {
            sendToChordMemory(custom);
        }
    });
}

/**
 * Update the progression list
 */
function updateProgressionList() {
    const list = document.getElementById('cpProgressionList');
    if (!list) return;
    
    const rootNote = document.getElementById('cpRootNote')?.value || 'C';
    const scaleType = document.getElementById('cpScaleType')?.value || 'major';
    
    const allProgressions = [
        ...COMMON_PROGRESSIONS['pop'],
        ...COMMON_PROGRESSIONS['jazz'],
    ].filter((v, i, a) => a.indexOf(v) === i);
    
    list.innerHTML = allProgressions.map(prog => {
        const chords = generateProgression(rootNote, scaleType, prog);
        const chordNames = chords.map(c => c.name.split(' ')[1]).join(' - ');
        return `
            <div class="cp-progression-item flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-600 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-500" data-progression="${prog}">
                <span class="font-mono text-sm">${prog}</span>
                <span class="text-xs text-gray-500">${chordNames}</span>
            </div>
        `;
    }).join('');
    
    // Add click listeners
    list.querySelectorAll('.cp-progression-item').forEach(item => {
        item.addEventListener('click', () => {
            const prog = item.dataset.progression;
            document.getElementById('cpCustomProgression').value = prog;
            updatePreview(prog);
        });
    });
}

/**
 * Update the preview display
 */
function updatePreview(progression) {
    const preview = document.getElementById('cpPreview');
    if (!preview) return;
    
    const rootNote = document.getElementById('cpRootNote')?.value || 'C';
    const scaleType = document.getElementById('cpScaleType')?.value || 'major';
    
    const chords = generateProgression(rootNote, scaleType, progression);
    
    preview.innerHTML = chords.map((chord, i) => `
        <div class="cp-chord-badge flex flex-col items-center p-2 bg-blue-100 dark:bg-blue-800 rounded" data-index="${i}">
            <span class="font-bold text-blue-800 dark:text-blue-200">${chord.name.split(' ')[1]}</span>
            <span class="text-xs text-blue-600 dark:text-blue-300">${chord.degree}</span>
        </div>
    `).join('');
    
    // Store for later use
    preview.dataset.progression = progression;
    preview.dataset.chords = JSON.stringify(chords);
}

/**
 * Apply the progression to the project
 */
async function applyProgression(progression) {
    const preview = document.getElementById('cpPreview');
    const chordsJson = preview?.dataset?.chords;
    
    if (!chordsJson) {
        console.warn('[ChordProgressionAssistant] No chords to apply');
        return;
    }
    
    const chords = JSON.parse(chordsJson);
    const rootNote = document.getElementById('cpRootNote')?.value || 'C';
    const scaleType = document.getElementById('cpScaleType')?.value || 'major';
    
    console.log('[ChordProgressionAssistant] Applying progression:', chords);
    
    // Find active track or create one
    let targetTrack = localAppServices.getActiveTrack?.();
    if (!targetTrack && typeof getFirstMidiTrack === 'function') {
        targetTrack = getFirstMidiTrack();
    }
    if (!targetTrack && typeof getTracks === 'function') {
        const tracks = getTracks();
        targetTrack = tracks?.find(t => t.type === 'MIDI' || t.type === 'Synth');
    }
    
    if (!targetTrack) {
        // Create a new MIDI track
        if (typeof createTrack === 'function') {
            targetTrack = createTrack('MIDI', 'Chord Progression');
        }
    }
    
    if (targetTrack) {
        // Send to chord memory
        if (typeof window?.saveChordToMemory === 'function') {
            for (const chord of chords) {
                const chordData = buildChord(chord.root, chord.type);
                window.saveChordToMemory(chord.root + ' ' + chord.type, chordData);
            }
        }
        
        localAppServices.showNotification?.(`Applied ${chords.length} chords`, 2000);
    }
}

/**
 * Send progression to Chord Memory
 */
function sendToChordMemory(progression) {
    const preview = document.getElementById('cpPreview');
    const chordsJson = preview?.dataset?.chords;
    
    if (!chordsJson) return;
    
    const chords = JSON.parse(chordsJson);
    
    if (typeof window?.saveChordToMemory === 'function') {
        for (const chord of chords) {
            const chordData = buildChord(chord.root, chord.type);
            window.saveChordToMemory(`${chord.root} ${chord.type}`, chordData);
        }
        localAppServices.showNotification?.(`Sent ${chords.length} chords to Chord Memory`, 2000);
    } else {
        localAppServices.showNotification?.('Chord Memory not available', 2000);
    }
}

// Export functions
export { generateProgression, getCommonProgressions, openChordProgressionPanel };