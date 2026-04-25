// js/RhythmPatternBrush.js
// Rhythm Pattern Brush - Draw rhythmic patterns by clicking and dragging on the sequencer

import * as Constants from './constants.js';

// Built-in rhythm patterns (row indices and step patterns)
// Row indices: 36=kick, 38=snare, 42=closed hat, 46=open hat
const BUILT_IN_PATTERNS = {
    'kick_hat': {
        name: 'Kick + Hi-Hat',
        description: 'Basic four-on-the-floor with hi-hats',
        rows: { 36: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 42: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] }
    },
    'kick_snare': {
        name: 'Kick + Snare',
        description: 'Classic rock/pop pattern',
        rows: { 36: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], 38: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] }
    },
    'backbeat': {
        name: 'Backbeat',
        description: 'Emphasized snare on beats 2 and 4',
        rows: { 36: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 38: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] }
    },
    'sparse': {
        name: 'Sparse',
        description: 'Minimal pattern with only essential hits',
        rows: { 36: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 38: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0] }
    },
    'drummy': {
        name: 'Drummy',
        description: 'More complex drum groove',
        rows: { 36: [1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0], 38: [0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0], 42: [1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1] }
    },
    'hat_8ths': {
        name: 'Hi-Hat 8ths',
        description: 'Continuous 8th note hi-hats',
        rows: { 42: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], 36: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }
    },
    'syncopated': {
        name: 'Syncopated',
        description: 'Off-beat emphasis pattern',
        rows: { 36: [0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0], 38: [0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,1] }
    },
    'broken_hats': {
        name: 'Broken Hats',
        description: 'Irregular hi-hat pattern',
        rows: { 42: [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0], 36: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] }
    }
};

export const RHYTHM_PATTERNS = BUILT_IN_PATTERNS;

export class RhythmPatternBrush {
    constructor(options = {}) {
        this.appServices = options.appServices || {};
        this.isBrushActive = false;
        this.currentPattern = 'kick_hat';
        this.brushSize = 1; // 1 = single steps, 2 = two adjacent steps
        this.velocity = 0.85;
        this.targetTrackId = null;
        
        // Track which steps have been painted in current stroke
        this._paintedSteps = new Set();
        
        // Bind methods
        this.startBrushStroke = this.startBrushStroke.bind(this);
        this.continueBrushStroke = this.continueBrushStroke.bind(this);
        this.endBrushStroke = this.endBrushStroke.bind(this);
    }

    /**
     * Set the target track for pattern painting
     */
    setTargetTrack(trackId) {
        this.targetTrackId = trackId;
    }

    /**
     * Set the current pattern to paint
     */
    setPattern(patternKey) {
        if (BUILT_IN_PATTERNS[patternKey]) {
            this.currentPattern = patternKey;
        }
    }

    /**
     * Set brush velocity
     */
    setVelocity(vel) {
        this.velocity = Math.max(0.1, Math.min(1.0, vel));
    }

    /**
     * Start a brush stroke at given row/col
     */
    startBrushStroke(row, col) {
        if (!this.targetTrackId) return;
        
        this.isBrushActive = true;
        this._paintedSteps.clear();
        
        this._paintAtStep(row, col);
    }

    /**
     * Continue brush stroke to new row/col
     */
    continueBrushStroke(row, col) {
        if (!this.isBrushActive) return;
        
        this._paintAtStep(row, col);
    }

    /**
     * End the current brush stroke
     */
    endBrushStroke() {
        if (this.isBrushActive) {
            this.isBrushActive = false;
            this._paintedSteps.clear();
        }
    }

    /**
     * Paint pattern at a specific step
     * @private
     */
    _paintAtStep(row, col) {
        const key = `${row},${col}`;
        if (this._paintedSteps.has(key)) return;
        this._paintedSteps.add(key);

        const track = this.appServices.getTrackById?.(this.targetTrackId);
        if (!track) return;

        const activeSeq = track.getActiveSequence?.();
        if (!activeSeq || !activeSeq.data) return;

        const pattern = BUILT_IN_PATTERNS[this.currentPattern];
        if (!pattern) return;

        // Get the base pitch from the row (MIDI note number)
        const basePitch = this._getBasePitchForRow(row, track);
        if (basePitch === null) return;

        // Apply the pattern to the grid
        const patternRows = pattern.rows;
        for (const [midiNote, steps] of Object.entries(patternRows)) {
            const patternRow = parseInt(midiNote);
            // Calculate the target row in the sequence for this MIDI note
            const targetRow = this._getRowForPitch(patternRow, track, activeSeq);
            if (targetRow === null) continue;

            // Paint the pattern steps at this row
            for (let s = 0; s < steps.length; s++) {
                const targetCol = (col + s) % activeSeq.length;
                if (steps[s]) {
                    this._activateNote(targetRow, targetCol);
                }
            }
        }
    }

    /**
     * Get base pitch for a row based on track type
     * @private
     */
    _getBasePitchForRow(row, track) {
        // For drum tracks, row maps to specific MIDI notes
        // For melodic tracks, row maps to C row to C+1 range
        if (track.type === 'Drums' || track.type === 'Sampler') {
            return 36 + row; // Default drum map starting at C1 (36)
        }
        // Melodic: default to C3 (48) + row offset
        return 48 + row;
    }

    /**
     * Find the row index in sequence data for a given MIDI pitch
     * @private
     */
    _getRowForPitch(pitch, track, activeSeq) {
        if (!activeSeq.data || !Array.isArray(activeSeq.data)) return null;

        // Calculate octaves and find matching row
        const resolution = activeSeq.resolution || 12; // 12 rows per octave
        const baseNote = 36; // C1
        
        // Try to find a row that maps to this pitch
        for (let row = 0; row < activeSeq.data.length; row++) {
            const rowBasePitch = baseNote + Math.floor(row / resolution) * 12 + (row % resolution);
            if (rowBasePitch === pitch) {
                return row;
            }
        }
        
        // If no exact match, use the closest row
        const defaultRow = pitch - baseNote;
        if (defaultRow >= 0 && defaultRow < activeSeq.data.length) {
            return defaultRow;
        }
        
        return null;
    }

    /**
     * Activate a note at the given row/col
     * @private
     */
    _activateNote(row, col) {
        const track = this.appServices.getTrackById?.(this.targetTrackId);
        if (!track) return;

        const activeSeq = track.getActiveSequence?.();
        if (!activeSeq || !activeSeq.data) return;

        if (row >= 0 && row < activeSeq.data.length && col >= 0 && col < activeSeq.length) {
            if (!activeSeq.data[row]) {
                activeSeq.data[row] = [];
            }
            activeSeq.data[row][col] = {
                active: true,
                velocity: this.velocity,
                timingOffset: 0
            };
        }
    }

    /**
     * Paint a complete pattern at a starting column
     */
    paintPatternAt(startCol) {
        if (!this.targetTrackId) return 0;

        const track = this.appServices.getTrackById?.(this.targetTrackId);
        if (!track) return 0;

        const activeSeq = track.getActiveSequence?.();
        if (!activeSeq || !activeSeq.data) return 0;

        const pattern = BUILT_IN_PATTERNS[this.currentPattern];
        if (!pattern) return 0;

        let paintedCount = 0;
        const patternRows = pattern.rows;

        for (const [midiNote, steps] of Object.entries(patternRows)) {
            const patternRow = parseInt(midiNote);
            const targetRow = this._getRowForPitch(patternRow, track, activeSeq);
            if (targetRow === null) continue;

            for (let s = 0; s < steps.length; s++) {
                const targetCol = (startCol + s) % activeSeq.length;
                if (steps[s]) {
                    this._activateNote(targetRow, targetCol);
                    paintedCount++;
                }
            }
        }

        return paintedCount;
    }

    /**
     * Get available patterns
     */
    getPatterns() {
        return Object.entries(BUILT_IN_PATTERNS).map(([key, val]) => ({
            id: key,
            name: val.name,
            description: val.description
        }));
    }

    /**
     * Get a specific pattern
     */
    getPattern(key) {
        return BUILT_IN_PATTERNS[key] || null;
    }
}

/**
 * Open the Rhythm Pattern Brush panel
 */
export function openRhythmPatternBrushPanel(savedState = null) {
    const windowId = 'rhythmPatternBrush';
    const openWindows = localAppServices?.getOpenWindows?.() || new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'rhythmPatternBrushContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
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
    
    const win = localAppServices?.createWindow?.(windowId, 'Rhythm Pattern Brush', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderRhythmPatternBrushContent(), 50);
    }
    return win;
}

/**
 * Render the Rhythm Pattern Brush content
 */
function renderRhythmPatternBrushContent() {
    const container = document.getElementById('rhythmPatternBrushContent');
    if (!container) return;

    const patterns = Object.entries(RHYTHM_PATTERNS).map(([key, val]) => ({
        id: key,
        name: val.name,
        description: val.description
    }));

    let html = `<div class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Draw rhythmic patterns on the sequencer. Select a pattern and click/drag on the grid to paint notes.
    </div>`;

    // Pattern selection
    html += `<div class="mb-4">
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Rhythm Pattern:</label>
        <select id="rpb-pattern" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
            ${patterns.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <div id="rpb-pattern-desc" class="text-xs text-gray-500 dark:text-gray-400 mt-1"></div>
    </div>`;

    // Velocity control
    html += `<div class="mb-4">
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Velocity: <span id="rpb-vel-val">85%</span></label>
        <input type="range" id="rpb-velocity" min="20" max="100" value="85" class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
    </div>`;

    // Pattern preview
    html += `<div class="mb-4">
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Pattern Preview (16 steps):</label>
        <div id="rpb-preview" class="grid grid-cols-16 gap-[1px] bg-gray-300 dark:bg-slate-600 p-2 rounded">
            <!-- Steps will be rendered here -->
        </div>
    </div>`;

    // Track selection
    html += `<div class="mb-4">
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Target Track:</label>
        <select id="rpb-track" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
            <option value="">Select a track...</option>
        </select>
    </div>`;

    // Instructions
    html += `<div class="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-100 dark:bg-slate-700 rounded">
        <b>How to use:</b><br>
        1. Select a rhythm pattern<br>
        2. Choose target track<br>
        3. Click on sequencer grid to paint<br>
        4. Drag to paint across multiple columns
    </div>`;

    container.innerHTML = html;

    // Initialize brush
    const brush = new RhythmPatternBrush({ appServices: localAppServices });
    const patternSelect = document.getElementById('rpb-pattern');
    const descDiv = document.getElementById('rpb-pattern-desc');
    const velSlider = document.getElementById('rpb-velocity');
    const trackSelect = document.getElementById('rpb-track');
    const preview = document.getElementById('rpb-preview');

    // Populate track select
    if (trackSelect && localAppServices?.getTracks) {
        const tracks = localAppServices.getTracks();
        tracks.forEach(t => {
            if (t.type !== 'Audio') {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `${t.name} (${t.type})`;
                trackSelect.appendChild(opt);
            }
        });
    }

    function updatePreview() {
        const pattern = brush.getPattern(patternSelect.value);
        if (!pattern || !preview) return;

        const steps = Object.values(pattern.rows)[0] || [];
        preview.innerHTML = steps.map((s, i) => 
            `<div class="h-4 rounded-sm ${s ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-500'}"></div>`
        ).join('');

        descDiv.textContent = pattern.description;
    }

    function updateVelocity() {
        const vel = parseInt(velSlider.value);
        document.getElementById('rpb-vel-val').textContent = `${vel}%`;
        brush.setVelocity(vel / 100);
    }

    // Event listeners
    patternSelect?.addEventListener('change', (e) => {
        brush.setPattern(e.target.value);
        updatePreview();
    });

    velSlider?.addEventListener('input', updateVelocity);

    trackSelect?.addEventListener('change', (e) => {
        brush.setTargetTrack(parseInt(e.target.value));
    });

    // Initial update
    brush.setPattern(patternSelect?.value || 'kick_hat');
    updatePreview();
    updateVelocity();

    // Store brush instance for external access
    window._rhythmPatternBrush = brush;

    console.log('[RhythmPatternBrush] Panel rendered');
}