// js/MIDITransposeTrack.js - Transpose MIDI notes by track setting

export class MIDITransposeTrack {
    constructor(config = {}) {
        this.id = config.id || `transpose-${Date.now()}`;
        this.enabled = config.enabled !== undefined ? config.enabled : true;
        
        // Transpose settings
        this.semitones = config.semitones || 0; // -12 to +12 (one octave range)
        this.octaves = config.octaves || 0; // Octave shift (typically -2 to +2)
        this.mode = config.mode || 'semitone'; // 'semitone', 'octave', 'interval'
        
        // Scale-aware transposition
        this.scaleAware = config.scaleAware || false;
        this.scale = config.scale || 'chromatic'; // 'chromatic', 'major', 'minor', 'pentatonic', etc.
        this.scaleRoot = config.scaleRoot || 0; // 0=C, 1=C#, etc.
        
        // Per-note transposition map (for individual note overrides)
        this.noteTransposeMap = new Map(); // midiNote -> semitoneOffset
        
        // Interval-based transposition
        this.interval = config.interval || 0; // In semitones for interval mode
        
        // Harmony mode (intelligent transposition)
        this.harmonyMode = config.harmonyMode || false;
        this.harmonyInterval = config.harmonyInterval || 5; // Perfect 4th default
        
        console.log(`[MIDITransposeTrack] Created transpose track: ${this.semitones} semitones, ${this.octaves} octaves`);
    }

    /**
     * Transpose a single MIDI note
     * @param {number} midiNote - The original MIDI note (0-127)
     * @param {number} velocity - Note velocity (for possible velocity modifications)
     * @returns {Object} { note: transposedNote, velocity: modifiedVelocity }
     */
    transposeNote(midiNote, velocity = 100) {
        if (!this.enabled) {
            return { note: midiNote, velocity };
        }

        // Check for per-note override
        if (this.noteTransposeMap.has(midiNote)) {
            const offset = this.noteTransposeMap.get(midiNote);
            const transposed = this._clampMidiNote(midiNote + offset);
            console.log(`[MIDITransposeTrack] Note ${midiNote} -> ${transposed} (per-note: ${offset})`);
            return { note: transposed, velocity };
        }

        // Calculate total transposition
        let totalOffset = this.semitones + (this.octaves * 12);

        // Apply scale-aware transposition
        if (this.scaleAware && this.scale !== 'chromatic') {
            totalOffset = this._scaleAwareOffset(midiNote, totalOffset);
        }

        // Apply harmony mode
        if (this.harmonyMode) {
            totalOffset += this.harmonyInterval;
        }

        const transposedNote = this._clampMidiNote(midiNote + totalOffset);

        return { note: transposedNote, velocity };
    }

    /**
     * Transpose a chord (array of MIDI notes)
     * @param {Array<number>} midiNotes - Array of MIDI notes
     * @returns {Array<number>} Array of transposed MIDI notes
     */
    transposeChord(midiNotes) {
        if (!this.enabled || !midiNotes || midiNotes.length === 0) {
            return midiNotes;
        }

        return midiNotes.map(note => this.transposeNote(note).note);
    }

    /**
     * Transpose a sequence of MIDI events
     * @param {Array<Object>} events - Array of MIDI events with note, velocity, duration
     * @returns {Array<Object>} Array of transposed events
     */
    transposeSequence(events) {
        if (!this.enabled || !events) {
            return events;
        }

        return events.map(event => {
            const transposed = this.transposeNote(event.note || event.midiNote, event.velocity);
            return {
                ...event,
                note: transposed.note,
                midiNote: transposed.note,
                velocity: transposed.velocity
            };
        });
    }

    /**
     * Set the transposition in semitones
     * @param {number} semitones - Number of semitones (-24 to +24)
     */
    setSemitones(semitones) {
        this.semitones = Math.max(-24, Math.min(24, semitones));
        console.log(`[MIDITransposeTrack] Set semitones: ${this.semitones}`);
    }

    /**
     * Set the octave transposition
     * @param {number} octaves - Number of octaves (-3 to +3)
     */
    setOctaves(octaves) {
        this.octaves = Math.max(-3, Math.min(3, octaves));
        console.log(`[MIDITransposeTrack] Set octaves: ${this.octaves}`);
    }

    /**
     * Set per-note transposition
     * @param {number} midiNote - The MIDI note to override
     * @param {number} semitoneOffset - The semitone offset for this note
     */
    setNoteTranspose(midiNote, semitoneOffset) {
        this.noteTransposeMap.set(midiNote, semitoneOffset);
        console.log(`[MIDITransposeTrack] Set note ${midiNote} transposition: ${semitoneOffset}`);
    }

    /**
     * Clear per-note transposition
     * @param {number} midiNote - The MIDI note to clear
     */
    clearNoteTranspose(midiNote) {
        this.noteTransposeMap.delete(midiNote);
        console.log(`[MIDITransposeTrack] Cleared note ${midiNote} transposition`);
    }

    /**
     * Clear all per-note transpositions
     */
    clearAllNoteTransposes() {
        this.noteTransposeMap.clear();
        console.log('[MIDITransposeTrack] Cleared all per-note transpositions');
    }

    /**
     * Set scale for scale-aware transposition
     * @param {string} scale - Scale name
     * @param {number} root - Root note (0-11)
     */
    setScale(scale, root = 0) {
        this.scale = scale;
        this.scaleRoot = root % 12;
        console.log(`[MIDITransposeTrack] Set scale: ${scale} root: ${root}`);
    }

    /**
     * Enable/disable scale-aware transposition
     * @param {boolean} enabled - Whether to use scale-aware transposition
     */
    setScaleAware(enabled) {
        this.scaleAware = enabled;
        console.log(`[MIDITransposeTrack] Scale-aware: ${enabled}`);
    }

    /**
     * Set harmony mode
     * @param {boolean} enabled - Whether to enable harmony mode
     * @param {number} interval - Harmony interval in semitones
     */
    setHarmonyMode(enabled, interval = 5) {
        this.harmonyMode = enabled;
        this.harmonyInterval = interval;
        console.log(`[MIDITransposeTrack] Harmony mode: ${enabled}, interval: ${interval}`);
    }

    /**
     * Get the scale degrees for a given scale
     * @param {string} scale - Scale name
     * @returns {Array<number>} Array of scale degrees (semitones from root)
     */
    _getScaleDegrees(scale) {
        const scales = {
            'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            'major': [0, 2, 4, 5, 7, 9, 11],
            'minor': [0, 2, 3, 5, 7, 8, 10],
            'pentatonic-major': [0, 2, 4, 7, 9],
            'pentatonic-minor': [0, 3, 5, 7, 10],
            'blues': [0, 3, 5, 6, 7, 10],
            'dorian': [0, 2, 3, 5, 7, 9, 10],
            'phrygian': [0, 1, 3, 5, 7, 8, 10],
            'lydian': [0, 2, 4, 6, 7, 9, 11],
            'mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'locrian': [0, 1, 3, 5, 6, 8, 10]
        };
        
        return scales[scale] || scales['chromatic'];
    }

    /**
     * Calculate scale-aware transposition offset
     * @param {number} midiNote - The MIDI note
     * @param {number} baseOffset - The base semitone offset
     * @returns {number} The scale-aware offset
     */
    _scaleAwareOffset(midiNote, baseOffset) {
        const scaleDegrees = this._getScaleDegrees(this.scale);
        const noteInOctave = (midiNote - this.scaleRoot + 12) % 12;
        
        // Find the nearest scale degree
        let nearestDegree = 0;
        let minDistance = 12;
        
        for (const degree of scaleDegrees) {
            const distance = Math.abs(degree - noteInOctave);
            if (distance < minDistance) {
                minDistance = distance;
                nearestDegree = degree;
            }
        }
        
        // Adjust transposition to stay in scale
        const currentPos = scaleDegrees.indexOf(nearestDegree);
        if (currentPos === -1) return baseOffset;
        
        // Calculate scale steps instead of semitones
        const scaleSteps = Math.round(baseOffset / (this.scale === 'chromatic' ? 1 : 1.7));
        const newPos = (currentPos + scaleSteps + scaleDegrees.length) % scaleDegrees.length;
        
        // Return the difference between target and current position
        return scaleDegrees[newPos] - noteInOctave + (Math.floor(baseOffset / 12) * 12);
    }

    /**
     * Clamp MIDI note to valid range (0-127)
     * @param {number} note - The MIDI note
     * @returns {number} Clamped note
     */
    _clampMidiNote(note) {
        return Math.max(0, Math.min(127, Math.round(note)));
    }

    /**
     * Get the total transposition in semitones
     * @returns {number} Total semitones
     */
    getTotalTransposition() {
        let total = this.semitones + (this.octaves * 12);
        if (this.harmonyMode) {
            total += this.harmonyInterval;
        }
        return total;
    }

    /**
     * Quick preset transpositions
     * @param {string} preset - Preset name
     */
    applyPreset(preset) {
        const presets = {
            'none': { semitones: 0, octaves: 0 },
            'octave-up': { semitones: 0, octaves: 1 },
            'octave-down': { semitones: 0, octaves: -1 },
            '2-octaves-up': { semitones: 0, octaves: 2 },
            '2-octaves-down': { semitones: 0, octaves: -2 },
            'fifth-up': { semitones: 7, octaves: 0 },
            'fifth-down': { semitones: -7, octaves: 0 },
            'fourth-up': { semitones: 5, octaves: 0 },
            'fourth-down': { semitones: -5, octaves: 0 },
            'major-third-up': { semitones: 4, octaves: 0 },
            'minor-third-up': { semitones: 3, octaves: 0 },
            'tritone': { semitones: 6, octaves: 0 },
            'octave-plus-fifth': { semitones: 7, octaves: 1 }
        };

        const presetConfig = presets[preset];
        if (presetConfig) {
            this.semitones = presetConfig.semitones;
            this.octaves = presetConfig.octaves;
            console.log(`[MIDITransposeTrack] Applied preset: ${preset}`);
        }
    }

    /**
     * Get state for serialization
     * @returns {Object} State object
     */
    getState() {
        const noteMap = {};
        for (const [note, offset] of this.noteTransposeMap) {
            noteMap[note] = offset;
        }
        
        return {
            id: this.id,
            enabled: this.enabled,
            semitones: this.semitones,
            octaves: this.octaves,
            mode: this.mode,
            scaleAware: this.scaleAware,
            scale: this.scale,
            scaleRoot: this.scaleRoot,
            noteTransposeMap: noteMap,
            harmonyMode: this.harmonyMode,
            harmonyInterval: this.harmonyInterval
        };
    }

    /**
     * Restore from state
     * @param {Object} state - State object
     */
    restoreState(state) {
        if (state.id) this.id = state.id;
        if (state.enabled !== undefined) this.enabled = state.enabled;
        if (state.semitones !== undefined) this.semitones = state.semitones;
        if (state.octaves !== undefined) this.octaves = state.octaves;
        if (state.mode) this.mode = state.mode;
        if (state.scaleAware !== undefined) this.scaleAware = state.scaleAware;
        if (state.scale) this.scale = state.scale;
        if (state.scaleRoot !== undefined) this.scaleRoot = state.scaleRoot;
        if (state.harmonyMode !== undefined) this.harmonyMode = state.harmonyMode;
        if (state.harmonyInterval !== undefined) this.harmonyInterval = state.harmonyInterval;
        
        if (state.noteTransposeMap) {
            this.noteTransposeMap.clear();
            for (const [note, offset] of Object.entries(state.noteTransposeMap)) {
                this.noteTransposeMap.set(parseInt(note), offset);
            }
        }
        
        console.log(`[MIDITransposeTrack] Restored state`);
    }
}

/**
 * Open the MIDI transpose track panel
 * @param {Object} appServices - App services object
 * @param {string} trackId - The track ID
 */
export function openMIDITransposePanel(appServices, trackId) {
    const { getTracks, showNotification } = appServices;
    const tracks = getTracks ? getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        showNotification?.('Track not found', 2000);
        return;
    }

    // Get or create transpose settings
    const transpose = track.midiTranspose || new MIDITransposeTrack({ enabled: true });
    track.midiTranspose = transpose;

    // Remove existing panel
    const existingPanel = document.getElementById('midi-transpose-panel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'midi-transpose-panel';
    panel.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 w-96';

    const scales = [
        { value: 'chromatic', label: 'Chromatic' },
        { value: 'major', label: 'Major' },
        { value: 'minor', label: 'Minor' },
        { value: 'pentatonic-major', label: 'Pentatonic Major' },
        { value: 'pentatonic-minor', label: 'Pentatonic Minor' },
        { value: 'blues', label: 'Blues' },
        { value: 'dorian', label: 'Dorian' },
        { value: 'phrygian', label: 'Phrygian' },
        { value: 'lydian', label: 'Lydian' },
        { value: 'mixolydian', label: 'Mixolydian' },
        { value: 'locrian', label: 'Locrian' }
    ];

    const presets = [
        { value: 'none', label: 'None' },
        { value: 'octave-up', label: '+1 Octave' },
        { value: 'octave-down', label: '-1 Octave' },
        { value: 'fifth-up', label: '+5th (7 semitones)' },
        { value: 'fifth-down', label: '-5th (-7 semitones)' },
        { value: 'fourth-up', label: '+4th (5 semitones)' },
        { value: 'major-third-up', label: '+M3 (4 semitones)' },
        { value: 'minor-third-up', label: '+m3 (3 semitones)' },
        { value: 'tritone', label: 'Tritone (6 semitones)' }
    ];

    panel.innerHTML = `
        <div class="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex justify-between items-center">
            <h2 class="text-lg font-bold text-white">MIDI Transpose: ${track.name}</h2>
            <button id="close-transpose-panel" class="text-zinc-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
            <div class="flex items-center gap-2">
                <input type="checkbox" id="transpose-enabled" ${transpose.enabled ? 'checked' : ''} class="w-4 h-4 rounded">
                <label for="transpose-enabled" class="text-sm text-zinc-300">Enable Transposition</label>
            </div>
            
            <div class="space-y-2">
                <label class="block text-sm text-zinc-300">Semitones</label>
                <input type="range" id="transpose-semitones" min="-24" max="24" value="${transpose.semitones}" 
                       class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer">
                <div class="flex justify-between text-xs text-zinc-500">
                    <span>-24</span>
                    <span id="semitone-value">${transpose.semitones}</span>
                    <span>+24</span>
                </div>
            </div>
            
            <div class="space-y-2">
                <label class="block text-sm text-zinc-300">Octaves</label>
                <select id="transpose-octaves" class="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded">
                    <option value="-3" ${transpose.octaves === -3 ? 'selected' : ''}>-3 Octaves</option>
                    <option value="-2" ${transpose.octaves === -2 ? 'selected' : ''}>-2 Octaves</option>
                    <option value="-1" ${transpose.octaves === -1 ? 'selected' : ''}>-1 Octave</option>
                    <option value="0" ${transpose.octaves === 0 ? 'selected' : ''}>0 Octaves</option>
                    <option value="1" ${transpose.octaves === 1 ? 'selected' : ''}>+1 Octave</option>
                    <option value="2" ${transpose.octaves === 2 ? 'selected' : ''}>+2 Octaves</option>
                    <option value="3" ${transpose.octaves === 3 ? 'selected' : ''}>+3 Octaves</option>
                </select>
            </div>
            
            <div class="space-y-2">
                <label class="block text-sm text-zinc-300">Quick Presets</label>
                <select id="transpose-preset" class="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded">
                    <option value="">Select preset...</option>
                    ${presets.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
                </select>
            </div>
            
            <div class="border-t border-zinc-700 pt-4 space-y-2">
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="scale-aware" ${transpose.scaleAware ? 'checked' : ''} class="w-4 h-4 rounded">
                    <label for="scale-aware" class="text-sm text-zinc-300">Scale-Aware Transposition</label>
                </div>
                
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs text-zinc-500">Scale</label>
                        <select id="transpose-scale" class="w-full px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded">
                            ${scales.map(s => `<option value="${s.value}" ${transpose.scale === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-zinc-500">Root</label>
                        <select id="transpose-root" class="w-full px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded">
                            ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((n, i) => 
                                `<option value="${i}" ${transpose.scaleRoot === i ? 'selected' : ''}>${n}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="border-t border-zinc-700 pt-4 space-y-2">
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="harmony-mode" ${transpose.harmonyMode ? 'checked' : ''} class="w-4 h-4 rounded">
                    <label for="harmony-mode" class="text-sm text-zinc-300">Harmony Mode (auto-harmonize)</label>
                </div>
                
                <div>
                    <label class="text-xs text-zinc-500">Harmony Interval</label>
                    <select id="harmony-interval" class="w-full px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded">
                        <option value="3" ${transpose.harmonyInterval === 3 ? 'selected' : ''}>Minor 3rd</option>
                        <option value="4" ${transpose.harmonyInterval === 4 ? 'selected' : ''}>Major 3rd</option>
                        <option value="5" ${transpose.harmonyInterval === 5 ? 'selected' : ''}>Perfect 4th</option>
                        <option value="7" ${transpose.harmonyInterval === 7 ? 'selected' : ''}>Perfect 5th</option>
                        <option value="9" ${transpose.harmonyInterval === 9 ? 'selected' : ''}>Major 6th</option>
                        <option value="12" ${transpose.harmonyInterval === 12 ? 'selected' : ''}>Octave</option>
                    </select>
                </div>
            </div>
            
            <div class="bg-zinc-800 rounded p-3 text-center">
                <div class="text-xs text-zinc-400">Total Transposition</div>
                <div class="text-2xl font-bold text-white" id="total-transpose">${transpose.getTotalTransposition()}</div>
                <div class="text-xs text-zinc-500">semitones</div>
            </div>
            
            <button id="reset-transpose" class="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors">
                Reset to Default
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    // Update total display
    const updateTotal = () => {
        document.getElementById('total-transpose').textContent = transpose.getTotalTransposition();
    };

    // Event handlers
    panel.querySelector('#close-transpose-panel').addEventListener('click', () => panel.remove());

    panel.querySelector('#transpose-enabled').addEventListener('change', (e) => {
        transpose.enabled = e.target.checked;
        showNotification?.(`Transposition ${e.target.checked ? 'enabled' : 'disabled'}`, 1500);
    });

    panel.querySelector('#transpose-semitones').addEventListener('input', (e) => {
        transpose.setSemitones(parseInt(e.target.value));
        document.getElementById('semitone-value').textContent = e.target.value;
        updateTotal();
    });

    panel.querySelector('#transpose-octaves').addEventListener('change', (e) => {
        transpose.setOctaves(parseInt(e.target.value));
        updateTotal();
    });

    panel.querySelector('#transpose-preset').addEventListener('change', (e) => {
        if (e.target.value) {
            transpose.applyPreset(e.target.value);
            // Update UI
            panel.querySelector('#transpose-semitones').value = transpose.semitones;
            document.getElementById('semitone-value').textContent = transpose.semitones;
            panel.querySelector('#transpose-octaves').value = transpose.octaves;
            updateTotal();
            showNotification?.(`Applied preset: ${e.target.options[e.target.selectedIndex].text}`, 1500);
        }
    });

    panel.querySelector('#scale-aware').addEventListener('change', (e) => {
        transpose.setScaleAware(e.target.checked);
    });

    panel.querySelector('#transpose-scale').addEventListener('change', (e) => {
        const root = parseInt(panel.querySelector('#transpose-root').value);
        transpose.setScale(e.target.value, root);
    });

    panel.querySelector('#transpose-root').addEventListener('change', (e) => {
        const scale = panel.querySelector('#transpose-scale').value;
        transpose.setScale(scale, parseInt(e.target.value));
    });

    panel.querySelector('#harmony-mode').addEventListener('change', (e) => {
        const interval = parseInt(panel.querySelector('#harmony-interval').value);
        transpose.setHarmonyMode(e.target.checked, interval);
        updateTotal();
    });

    panel.querySelector('#harmony-interval').addEventListener('change', (e) => {
        transpose.setHarmonyMode(transpose.harmonyMode, parseInt(e.target.value));
        updateTotal();
    });

    panel.querySelector('#reset-transpose').addEventListener('click', () => {
        transpose.enabled = true;
        transpose.semitones = 0;
        transpose.octaves = 0;
        transpose.scaleAware = false;
        transpose.harmonyMode = false;
        transpose.clearAllNoteTransposes();
        
        // Update UI
        panel.querySelector('#transpose-enabled').checked = true;
        panel.querySelector('#transpose-semitones').value = 0;
        document.getElementById('semitone-value').textContent = '0';
        panel.querySelector('#transpose-octaves').value = '0';
        panel.querySelector('#scale-aware').checked = false;
        panel.querySelector('#harmony-mode').checked = false;
        updateTotal();
        
        showNotification?.('Transposition reset to default', 1500);
    });

    // Close on escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

export default MIDITransposeTrack;