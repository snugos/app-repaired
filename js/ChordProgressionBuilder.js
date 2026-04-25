// js/ChordProgressionBuilder.js - Visual Chord Progression Builder
// Feature: Visual chord grid for building chord progressions with drag-and-drop
import { noteNameToMidi, midiToNoteName } from './midiUtils.js';
import { getChordTypes, getChordIntervals, buildChord } from './ChordMemory.js';

let localAppServices = {};
let currentProgression = [];
let draggedChord = null;

/**
 * Initialize the Chord Progression Builder
 * @param {Object} services - App services from main.js
 */
export function initChordProgressionBuilder(services) {
    localAppServices = services || {};
    console.log('[ChordProgressionBuilder] Initialized');
}

/**
 * Get the current progression
 * @returns {Array} Current chord progression
 */
export function getCurrentProgression() {
    return JSON.parse(JSON.stringify(currentProgression));
}

/**
 * Set the current progression
 * @param {Array} progression - Chord progression array
 */
export function setCurrentProgression(progression) {
    currentProgression = progression || [];
}

/**
 * Add a chord to the progression
 * @param {string} root - Root note (e.g., 'C')
 * @param {string} type - Chord type (e.g., 'major')
 * @param {number} duration - Duration in beats
 */
export function addChordToProgression(root, type, duration = 4) {
    currentProgression.push({
        id: `chord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        root: root,
        type: type,
        duration: duration
    });
}

/**
 * Remove a chord from the progression
 * @param {number} index - Index of chord to remove
 */
export function removeChordFromProgression(index) {
    if (index >= 0 && index < currentProgression.length) {
        currentProgression.splice(index, 1);
    }
}

/**
 * Insert a chord at a specific position
 * @param {number} index - Position to insert at
 * @param {string} root - Root note
 * @param {string} type - Chord type
 * @param {number} duration - Duration in beats
 */
export function insertChordAt(index, root, type, duration = 4) {
    currentProgression.splice(index, 0, {
        id: `chord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        root: root,
        type: type,
        duration: duration
    });
}

/**
 * Move a chord from one position to another
 * @param {number} fromIndex - Source index
 * @param {number} toIndex - Destination index
 */
export function moveChordInProgression(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= currentProgression.length) return;
    if (toIndex < 0 || toIndex >= currentProgression.length) return;
    
    const [chord] = currentProgression.splice(fromIndex, 1);
    currentProgression.splice(toIndex, 0, chord);
}

/**
 * Update a chord in the progression
 * @param {number} index - Index of chord to update
 * @param {Object} updates - Updates { root, type, duration }
 */
export function updateChordInProgression(index, updates) {
    if (index < 0 || index >= currentProgression.length) return;
    Object.assign(currentProgression[index], updates);
}

/**
 * Clear the progression
 */
export function clearProgression() {
    currentProgression = [];
}

/**
 * Export progression as chord data for state storage
 * @returns {Array} Progression data
 */
export function exportProgression() {
    return JSON.parse(JSON.stringify(currentProgression));
}

/**
 * Import progression from saved data
 * @param {Array} data - Progression data
 */
export function importProgression(data) {
    if (Array.isArray(data)) {
        currentProgression = data;
    }
}

/**
 * Play a preview of the progression
 * @param {number} tempo - Tempo in BPM
 */
export function previewProgression(tempo = 120) {
    if (currentProgression.length === 0) {
        localAppServices.showNotification?.('No chords in progression', 1500);
        return;
    }
    
    const beatDuration = 60 / tempo;
    let timeOffset = 0;
    
    currentProgression.forEach((chord, index) => {
        const notes = buildChord(`${chord.root}4`, chord.type);
        const durationSec = chord.duration * beatDuration;
        
        // Schedule each note
        notes.forEach(note => {
            const track = getTargetTrack();
            if (track) {
                scheduleNoteAt(track, note.midi, timeOffset, durationSec * 0.9, 0.7);
            }
        });
        
        timeOffset += durationSec;
    });
    
    localAppServices.showNotification?.(`Playing ${currentProgression.length} chords`, 1500);
}

/**
 * Get target track for preview playback
 */
function getTargetTrack() {
    const tracks = localAppServices.getTracks?.() || [];
    return tracks.find(t => t.type !== 'Audio');
}

/**
 * Schedule a note at a specific time offset
 */
function scheduleNoteAt(track, midi, timeOffset, duration, velocity) {
    const startTime = Tone.now() + timeOffset;
    const endTime = startTime + duration;
    
    if (track.playNote) {
        track.playNote(midi, startTime, endTime, velocity);
    } else if (track.instrument?.triggerAttackRelease) {
        track.instrument.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), duration, startTime, velocity);
    }
}

/**
 * Open the Chord Progression Builder panel
 * @param {Object} savedState - Optional saved window state
 */
export function openChordProgressionBuilderPanel(savedState = null) {
    const windowId = 'chordProgressionBuilder';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderProgressionContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'chordProgressionContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 text-white overflow-hidden';
    
    const options = {
        width: 650,
        height: 480,
        minWidth: 500,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    if (savedState) {
        Object.assign(options, {
            x: parseInt(savedState.left, 10),
            y: parseInt(savedState.top, 10),
            width: parseInt(savedState.width, 10),
            height: parseInt(savedState.height, 10),
            zIndex: savedState.zIndex,
            isMinimized: savedState.isMinimized
        });
    }
    
    const win = localAppServices.createWindow(windowId, 'Chord Progression Builder', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderProgressionContent(), 50);
    }
    
    return win;
}

/**
 * Render the progression content
 */
function renderProgressionContent() {
    const container = document.getElementById('chordProgressionContent');
    if (!container) return;
    
    const chordTypes = getChordTypes();
    const rootNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const durations = [1, 2, 4, 8, 16];
    
    let html = `
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <span class="text-sm text-gray-400">Root:</span>
                <select id="cpbRootSelect" class="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white">
                    ${rootNotes.map(n => `<option value="${n}">${n}</option>`).join('')}
                </select>
                <span class="text-sm text-gray-400 ml-2">Type:</span>
                <select id="cpbTypeSelect" class="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white w-32">
                    ${chordTypes.slice(0, 15).map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                </select>
                <span class="text-sm text-gray-400 ml-2">Beats:</span>
                <select id="cpbDurationSelect" class="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white w-20">
                    ${durations.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
                <button id="cpbAddChordBtn" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium">
                    + Add
                </button>
            </div>
            <div class="flex items-center gap-2">
                <button id="cpbPreviewBtn" class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
                    Preview
                </button>
                <button id="cpbClearBtn" class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
                    Clear
                </button>
            </div>
        </div>
        
        <div class="flex items-center gap-3 mb-3 text-xs text-gray-500">
            <span>Drag chords to reorder</span>
            <span>•</span>
            <span>Click to edit</span>
            <span>•</span>
            <span>Double-click to remove</span>
        </div>
        
        <div id="cpbProgressionGrid" class="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700 p-2">
            ${renderProgressionGrid()}
        </div>
        
        <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-700">
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Chords: <span id="cpbChordCount" class="text-white">${currentProgression.length}</span></span>
                <span class="text-xs text-gray-500 ml-4">Total: <span id="cpbTotalBeats" class="text-white">0</span> beats</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="cpbExportBtn" class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
                    Export
                </button>
                <button id="cpbImportBtn" class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
                    Import
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    attachProgressionEventListeners(container);
}

/**
 * Render the progression grid
 */
function renderProgressionGrid() {
    if (currentProgression.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-40 text-gray-500">
                <div class="text-4xl mb-2">🎵</div>
                <div>No chords yet</div>
                <div class="text-xs mt-1">Add chords using the controls above</div>
            </div>
        `;
    }
    
    return `
        <div class="grid gap-2" style="grid-template-columns: repeat(${Math.min(currentProgression.length, 8)}, minmax(80px, 1fr));">
            ${currentProgression.map((chord, index) => `
                <div class="cpb-chord-card relative bg-gray-700 hover:bg-gray-600 rounded p-3 cursor-move transition-all"
                     draggable="true"
                     data-index="${index}"
                     data-chord-id="${chord.id}">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-lg font-bold text-blue-400">${chord.root}</span>
                        <button class="cpb-remove-chord w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded text-xs" data-index="${index}">×</button>
                    </div>
                    <div class="text-sm text-gray-300 mb-1">${chord.type}</div>
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-500">${chord.duration} beat${chord.duration > 1 ? 's' : ''}</span>
                        <span class="text-xs px-1.5 py-0.5 bg-gray-600 rounded">${index + 1}</span>
                    </div>
                    <div class="absolute inset-0 border-2 border-transparent hover:border-blue-400 rounded pointer-events-none transition-all"></div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Attach event listeners to progression panel
 */
function attachProgressionEventListeners(container) {
    // Add chord button
    const addBtn = container.querySelector('#cpbAddChordBtn');
    addBtn?.addEventListener('click', () => {
        const root = container.querySelector('#cpbRootSelect')?.value || 'C';
        const type = container.querySelector('#cpbTypeSelect')?.value || 'major';
        const duration = parseInt(container.querySelector('#cpbDurationSelect')?.value) || 4;
        
        addChordToProgression(root, type, duration);
        updateProgressionUI();
        localAppServices.showNotification?.(`Added ${root} ${type}`, 1000);
    });
    
    // Preview button
    const previewBtn = container.querySelector('#cpbPreviewBtn');
    previewBtn?.addEventListener('click', () => {
        previewProgression(120);
    });
    
    // Clear button
    const clearBtn = container.querySelector('#cpbClearBtn');
    clearBtn?.addEventListener('click', () => {
        if (currentProgression.length === 0) return;
        
        if (confirm('Clear all chords from the progression?')) {
            clearProgression();
            updateProgressionUI();
            localAppServices.showNotification?.('Progression cleared', 1000);
        }
    });
    
    // Export button
    const exportBtn = container.querySelector('#cpbExportBtn');
    exportBtn?.addEventListener('click', () => {
        if (currentProgression.length === 0) {
            localAppServices.showNotification?.('Nothing to export', 1500);
            return;
        }
        
        const data = JSON.stringify(exportProgression(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chord-progression-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        localAppServices.showNotification?.('Progression exported', 1500);
    });
    
    // Import button
    const importBtn = container.querySelector('#cpbImportBtn');
    importBtn?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (Array.isArray(data)) {
                    importProgression(data);
                    updateProgressionUI();
                    localAppServices.showNotification?.(`Imported ${data.length} chords`, 1500);
                }
            } catch (err) {
                localAppServices.showNotification?.('Invalid file format', 1500);
            }
        };
        input.click();
    });
    
    // Remove chord buttons
    container.querySelectorAll('.cpb-remove-chord').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            removeChordFromProgression(index);
            updateProgressionUI();
        });
    });
    
    // Setup drag and drop for chord reordering
    setupChordDragDrop(container);
}

/**
 * Setup drag and drop for chord cards
 */
function setupChordDragDrop(container) {
    const grid = container.querySelector('#cpbProgressionGrid');
    if (!grid) return;
    
    let draggedIndex = null;
    
    grid.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.cpb-chord-card');
        if (!card) return;
        
        draggedIndex = parseInt(card.dataset.index);
        card.classList.add('opacity-50');
        e.dataTransfer.effectAllowed = 'move';
    });
    
    grid.addEventListener('dragend', (e) => {
        const card = e.target.closest('.cpb-chord-card');
        if (card) card.classList.remove('opacity-50');
        draggedIndex = null;
    });
    
    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    
    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetCard = e.target.closest('.cpb-chord-card');
        if (!targetCard || draggedIndex === null) return;
        
        const targetIndex = parseInt(targetCard.dataset.index);
        if (draggedIndex !== targetIndex) {
            moveChordInProgression(draggedIndex, targetIndex);
            updateProgressionUI();
        }
    });
    
    // Double-click to remove
    grid.querySelectorAll('.cpb-chord-card').forEach(card => {
        card.addEventListener('dblclick', () => {
            const index = parseInt(card.dataset.index);
            removeChordFromProgression(index);
            updateProgressionUI();
        });
    });
}

/**
 * Update the progression UI
 */
function updateProgressionUI() {
    const grid = document.getElementById('cpbProgressionGrid');
    const countEl = document.getElementById('cpbChordCount');
    const totalBeatsEl = document.getElementById('cpbTotalBeats');
    
    if (grid) {
        grid.innerHTML = renderProgressionGrid();
        
        // Re-attach remove listeners
        grid.querySelectorAll('.cpb-remove-chord').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                removeChordFromProgression(index);
                updateProgressionUI();
            });
        });
        
        // Setup drag drop again
        const container = document.getElementById('chordProgressionContent');
        if (container) setupChordDragDrop(container);
        
        // Double-click to remove
        grid.querySelectorAll('.cpb-chord-card').forEach(card => {
            card.addEventListener('dblclick', () => {
                const index = parseInt(card.dataset.index);
                removeChordFromProgression(index);
                updateProgressionUI();
            });
        });
    }
    
    if (countEl) countEl.textContent = currentProgression.length;
    if (totalBeatsEl) {
        const total = currentProgression.reduce((sum, c) => sum + (c.duration || 4), 0);
        totalBeatsEl.textContent = total;
    }
}

/**
 * Update panel if open
 */
export function updateChordProgressionBuilderPanel() {
    const container = document.getElementById('chordProgressionContent');
    if (container) {
        renderProgressionContent();
    }
}

export default {
    initChordProgressionBuilder,
    openChordProgressionBuilderPanel,
    getCurrentProgression,
    setCurrentProgression,
    addChordToProgression,
    removeChordFromProgression,
    insertChordAt,
    moveChordInProgression,
    updateChordInProgression,
    clearProgression,
    exportProgression,
    importProgression,
    previewProgression,
    updateChordProgressionBuilderPanel
};