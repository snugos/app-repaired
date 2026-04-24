/**
 * MIDI Harmonizer - Auto-add harmony to MIDI notes
 * Generates harmony parts based on input melody
 */

class MIDIHarmonizer {
    constructor() {
        this.harmonyMode = 'diatonic'; // diatonic, parallel, chromatic
        this.interval = 4; // Semitones (default: major third up)
        this.voiceCount = 1; // Number of harmony voices
        this.scale = 'major'; // Scale for diatonic harmony
        this.key = 'C'; // Key signature
        this.octaveRange = true; // Keep within octave range
        this.inversion = 0; // Chord inversion
        this.voiceLead = true; // Apply voice leading rules
        this.harmonyPresets = new Map();
        this.initializePresets();
    }

    initializePresets() {
        this.harmonyPresets.set('thirds-up', {
            name: 'Thirds Up',
            mode: 'diatonic',
            intervals: [4],
            voiceCount: 1,
            description: 'Classic harmony a third above'
        });

        this.harmonyPresets.set('thirds-down', {
            name: 'Thirds Down',
            mode: 'diatonic',
            intervals: [-3],
            voiceCount: 1,
            description: 'Harmony a third below'
        });

        this.harmonyPresets.set('sixths-up', {
            name: 'Sixths Up',
            mode: 'diatonic',
            intervals: [9],
            voiceCount: 1,
            description: 'Harmony a sixth above'
        });

        this.harmonyPresets.set('octave-double', {
            name: 'Octave Double',
            mode: 'parallel',
            intervals: [12],
            voiceCount: 1,
            description: 'Double at the octave'
        });

        this.harmonyPresets.set('triad-up', {
            name: 'Triad Up',
            mode: 'diatonic',
            intervals: [4, 7],
            voiceCount: 2,
            description: 'Complete triad harmony'
        });

        this.harmonyPresets.set('parallel-fifths', {
            name: 'Parallel Fifths',
            mode: 'parallel',
            intervals: [7],
            voiceCount: 1,
            description: 'Classic parallel fifths'
        });

        this.harmonyPresets.set('chromatic-third', {
            name: 'Chromatic Third',
            mode: 'chromatic',
            intervals: [4],
            voiceCount: 1,
            description: 'Always a major third up'
        });

        this.harmonyPresets.set('barbershop', {
            name: 'Barbershop',
            mode: 'diatonic',
            intervals: [-4, -9], // Tenor and bass
            voiceCount: 2,
            voiceLead: true,
            description: 'Barbershop quartet style'
        });
    }

    /**
     * Get scale degrees for a key/scale
     * @param {string} key - Key (C, D, E, etc.)
     * @param {string} scale - Scale type
     * @returns {Array} - Array of semitone intervals from root
     */
    getScaleDegrees(key, scale) {
        const keyMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
        const rootNote = keyMap[key] || 0;

        const scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
            melodicMinor: [0, 2, 3, 5, 7, 9, 11],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            locrian: [0, 1, 3, 5, 6, 8, 10],
            pentatonic: [0, 2, 4, 7, 9],
            blues: [0, 3, 5, 6, 7, 10]
        };

        return scales[scale] || scales.major;
    }

    /**
     * Get diatonic interval for a note
     * @param {number} note - MIDI note number
     * @param {number} diatonicInterval - Diatonic interval (1-7)
     * @param {string} key - Key
     * @param {string} scale - Scale type
     * @returns {number} - MIDI note number
     */
    getDiatonicNote(note, diatonicInterval, key, scale) {
        const scaleDegrees = this.getScaleDegrees(key, scale);
        const noteInOctave = note % 12;

        // Find the scale degree of the input note
        let degree = -1;
        for (let i = 0; i < scaleDegrees.length; i++) {
            if (scaleDegrees[i] === noteInOctave) {
                degree = i;
                break;
            }
        }

        // If note not in scale, use closest
        if (degree === -1) {
            let minDist = 12;
            for (let i = 0; i < scaleDegrees.length; i++) {
                const dist = Math.abs(scaleDegrees[i] - noteInOctave);
                if (dist < minDist) {
                    minDist = dist;
                    degree = i;
                }
            }
        }

        // Calculate new degree
        let newDegree = (degree + diatonicInterval) % 7;
        if (newDegree < 0) newDegree += 7;

        // Calculate octave changes
        const octaveShift = Math.floor((degree + diatonicInterval) / 7);

        // Get new note
        const newNoteInOctave = scaleDegrees[newDegree];
        const octave = Math.floor(note / 12);

        return newNoteInOctave + (octave + octaveShift) * 12;
    }

    /**
     * Harmonize a single note
     * @param {number} note - MIDI note number
     * @param {Object} options - Harmonization options
     * @returns {Array} - Array of harmony notes
     */
    harmonizeNote(note, options = {}) {
        const {
            mode = this.harmonyMode,
            intervals = [this.interval],
            key = this.key,
            scale = this.scale
        } = options;

        const harmonyNotes = [];

        for (const interval of intervals) {
            let harmonyNote;

            switch (mode) {
                case 'diatonic':
                    // Convert semitone interval to diatonic step
                    const diatonicStep = this.semitonesToDiatonic(interval);
                    harmonyNote = this.getDiatonicNote(note, diatonicStep, key, scale);
                    break;

                case 'parallel':
                    harmonyNote = note + interval;
                    break;

                case 'chromatic':
                    harmonyNote = note + interval;
                    break;

                default:
                    harmonyNote = note + interval;
            }

            // Keep within reasonable range
            if (harmonyNote >= 21 && harmonyNote <= 108) {
                harmonyNotes.push(harmonyNote);
            }
        }

        return harmonyNotes;
    }

    /**
     * Convert semitones to approximate diatonic step
     * @param {number} semitones - Semitone interval
     * @returns {number} - Diatonic step (1-7)
     */
    semitonesToDiatonic(semitones) {
        const map = {
            1: 1, 2: 1, // Minor/Major 2nd
            3: 2, 4: 2, // Minor/Major 3rd
            5: 3, // Perfect 4th
            6: 4, 7: 4, // Tritone/Perfect 5th
            8: 5, 9: 5, // Minor/Major 6th
            10: 6, 11: 6, // Minor/Major 7th
            12: 7 // Octave
        };

        const absSemi = Math.abs(semitones);
        const sign = semitones >= 0 ? 1 : -1;

        return (map[absSemi] || Math.round(absSemi / 1.7)) * sign;
    }

    /**
     * Harmonize a melody (array of notes)
     * @param {Array} notes - Array of note objects with midi/velocity/start/duration
     * @param {Object} options - Harmonization options
     * @returns {Array} - Array of original notes plus harmony notes
     */
    harmonizeMelody(notes, options = {}) {
        if (!notes || notes.length === 0) return [];

        const {
            mode = this.harmonyMode,
            intervals = [this.interval],
            key = this.key,
            scale = this.scale,
            voiceLead = this.voiceLead,
            harmonyVelocity = 0.8 // Relative to original velocity
        } = options;

        const allNotes = [...notes];
        const harmonyNotes = [];
        let prevHarmony = null;

        for (const note of notes) {
            const harmonized = this.harmonizeNote(note.pitch || note.midi, { mode, intervals, key, scale });

            for (let i = 0; i < harmonized.length; i++) {
                const harmonyNote = {
                    pitch: harmonized[i],
                    velocity: Math.round((note.velocity || 100) * harmonyVelocity),
                    start: note.start,
                    duration: note.duration,
                    isHarmony: true,
                    voiceIndex: i
                };

                // Apply voice leading
                if (voiceLead && prevHarmony) {
                    const prevNote = prevHarmony[i];
                    if (prevNote) {
                        // Prefer stepwise motion
                        const diff = harmonyNote.pitch - prevNote.pitch;
                        if (Math.abs(diff) > 7) {
                            // Try to stay closer
                            const octaveShift = diff > 0 ? -12 : 12;
                            const closerNote = harmonyNote.pitch + octaveShift;
                            if (closerNote >= 21 && closerNote <= 108) {
                                harmonyNote.pitch = closerNote;
                            }
                        }
                    }
                }

                harmonyNotes.push(harmonyNote);
            }

            prevHarmony = harmonized;
        }

        return [...allNotes, ...harmonyNotes];
    }

    /**
     * Apply preset to melody
     * @param {string} presetId - Preset ID
     * @param {Array} notes - Notes to harmonize
     * @returns {Array} - Harmonized notes
     */
    applyPreset(presetId, notes) {
        const preset = this.harmonyPresets.get(presetId);
        if (!preset) return notes;

        return this.harmonizeMelody(notes, {
            mode: preset.mode,
            intervals: preset.intervals,
            voiceCount: preset.voiceCount,
            voiceLead: preset.voiceLead
        });
    }

    /**
     * Get all presets
     * @returns {Array} - Array of presets
     */
    getPresets() {
        return Array.from(this.harmonyPresets.entries()).map(([id, preset]) => ({
            id,
            ...preset
        }));
    }

    /**
     * Analyze existing harmony
     * @param {Array} notes - Array of notes
     * @returns {Object} - Harmony analysis
     */
    analyzeHarmony(notes) {
        if (!notes || notes.length === 0) {
            return { intervals: [], chordProgression: [] };
        }

        // Group notes by time
        const timeGroups = new Map();
        notes.forEach(note => {
            const time = Math.round(note.start * 100) / 100;
            if (!timeGroups.has(time)) {
                timeGroups.set(time, []);
            }
            timeGroups.get(time).push(note.pitch || note.midi);
        });

        const intervals = [];
        const chords = [];

        timeGroups.forEach((pitches, time) => {
            if (pitches.length >= 2) {
                // Find intervals between notes
                for (let i = 1; i < pitches.length; i++) {
                    intervals.push({
                        time,
                        interval: pitches[i] - pitches[0],
                        notes: [pitches[0], pitches[i]]
                    });
                }

                // Identify chord
                const sortedPitches = [...pitches].sort((a, b) => a - b);
                const chordIntervals = sortedPitches.slice(1).map(p => p - sortedPitches[0]);
                chords.push({
                    time,
                    pitches: sortedPitches,
                    intervals: chordIntervals
                });
            }
        });

        return { intervals, chords, timeGroups: Array.from(timeGroups.entries()) };
    }

    /**
     * Open harmonizer panel
     */
    openHarmonizerPanel(notes, onApply) {
        const existing = document.getElementById('midi-harmonizer-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'midi-harmonizer-panel';

        const presets = this.getPresets();
        const presetOptions = presets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            .map(k => `<option value="${k}" ${this.key === k ? 'selected' : ''}>${k}</option>`).join('');

        const scaleOptions = ['major', 'minor', 'harmonicMinor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'pentatonic', 'blues']
            .map(s => `<option value="${s}" ${this.scale === s ? 'selected' : ''}>${s}</option>`).join('');

        panel.innerHTML = `
            <div class="harmonizer-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 500px;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🎵 MIDI Harmonizer</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Preset</label>
                    <select id="harm-preset" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        <option value="">Custom</option>
                        ${presetOptions}
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Key</label>
                        <select id="harm-key" style="width: 100%; margin-top: 8px; padding: 8px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                            ${keyOptions}
                        </select>
                    </div>
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Scale</label>
                        <select id="harm-scale" style="width: 100%; margin-top: 8px; padding: 8px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                            ${scaleOptions}
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Harmony Mode</label>
                    <select id="harm-mode" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        <option value="diatonic">Diatonic (stays in key)</option>
                        <option value="parallel">Parallel (fixed intervals)</option>
                        <option value="chromatic">Chromatic (fixed semitones)</option>
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Interval: <span id="interval-value">${this.interval}</span> semitones</label>
                    <input type="range" id="harm-interval" min="-12" max="12" value="${this.interval}"
                        style="width: 100%; margin-top: 8px; accent-color: #8b5cf6;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Voice Count</label>
                    <input type="number" id="harm-voices" value="${this.voiceCount}" min="1" max="4"
                        style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px;">
                        <input type="checkbox" id="harm-voice-lead" ${this.voiceLead ? 'checked' : ''} style="accent-color: #10b981;">
                        Apply voice leading
                    </label>
                </div>

                <div id="harm-preview" style="display: none; background: #2a2a4e; padding: 12px; border-radius: 4px; margin-bottom: 16px; font-size: 12px; color: #a0a0a0;">
                    <div>Original: <span id="orig-notes">${notes?.length || 0} notes</span></div>
                    <div>Harmony: <span id="harm-notes">0 notes</span></div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="harm-preview-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Preview
                    </button>
                    <button id="harm-apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Add Harmony
                    </button>
                    <button id="harm-close-btn" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #midi-harmonizer-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Event handlers
        const presetSelect = document.getElementById('harm-preset');
        const keySelect = document.getElementById('harm-key');
        const scaleSelect = document.getElementById('harm-scale');
        const modeSelect = document.getElementById('harm-mode');
        const intervalSlider = document.getElementById('harm-interval');
        const voicesInput = document.getElementById('harm-voices');
        const voiceLeadCheck = document.getElementById('harm-voice-lead');
        const previewBtn = document.getElementById('harm-preview-btn');
        const applyBtn = document.getElementById('harm-apply-btn');
        const closeBtn = document.getElementById('harm-close-btn');
        const previewDiv = document.getElementById('harm-preview');

        // Update handlers
        keySelect.addEventListener('change', e => this.key = e.target.value);
        scaleSelect.addEventListener('change', e => this.scale = e.target.value);
        modeSelect.addEventListener('change', e => this.harmonyMode = e.target.value);
        intervalSlider.addEventListener('input', e => {
            this.interval = parseInt(e.target.value);
            document.getElementById('interval-value').textContent = e.target.value;
        });
        voicesInput.addEventListener('change', e => this.voiceCount = parseInt(e.target.value));
        voiceLeadCheck.addEventListener('change', e => this.voiceLead = e.target.checked);

        // Preset selection
        presetSelect.addEventListener('change', e => {
            const preset = this.harmonyPresets.get(e.target.value);
            if (preset) {
                modeSelect.value = preset.mode;
                this.harmonyMode = preset.mode;
                this.interval = preset.intervals[0];
                intervalSlider.value = preset.intervals[0];
                document.getElementById('interval-value').textContent = preset.intervals[0];
                this.voiceCount = preset.voiceCount;
                voicesInput.value = preset.voiceCount;
            }
        });

        // Preview
        previewBtn.addEventListener('click', () => {
            if (!notes || notes.length === 0) return;

            const harmonized = this.harmonizeMelody(notes);
            const harmonyCount = harmonized.filter(n => n.isHarmony).length;

            previewDiv.style.display = 'block';
            document.getElementById('harm-notes').textContent = `${harmonyCount} notes`;
        });

        // Apply
        applyBtn.addEventListener('click', () => {
            if (!notes || notes.length === 0) return;

            const harmonized = this.harmonizeMelody(notes);

            if (onApply) {
                onApply(harmonized);
            }

            panel.remove();
            style.remove();
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });
    }
}

// Export singleton
const midiHarmonizer = new MIDIHarmonizer();

export { MIDIHarmonizer, midiHarmonizer };