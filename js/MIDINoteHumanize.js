/**
 * MIDI Note Humanize - Add timing/velocity randomness to MIDI
 * Makes quantized MIDI sound more natural and human-played
 */

class MIDINoteHumanize {
    constructor() {
        this.timingVariance = 10; // ms
        this.velocityVariance = 5; // 0-127 scale
        this.timingMode = 'gaussian'; // gaussian, uniform, swing
        this.velocityMode = 'gaussian'; // gaussian, uniform, scale
        this.swingAmount = 0; // 0-100%
        this.swingDirection = 'both'; // forward, backward, both
        this.humanizationPresets = new Map();
        this.initializePresets();
    }

    initializePresets() {
        this.humanizationPresets.set('subtle', {
            name: 'Subtle',
            timingVariance: 5,
            velocityVariance: 3,
            timingMode: 'gaussian',
            velocityMode: 'gaussian',
            description: 'Very light humanization, barely noticeable'
        });

        this.humanizationPresets.set('natural', {
            name: 'Natural',
            timingVariance: 10,
            velocityVariance: 8,
            timingMode: 'gaussian',
            velocityMode: 'gaussian',
            description: 'Natural sounding, like a good musician'
        });

        this.humanizationPresets.set('loose', {
            name: 'Loose',
            timingVariance: 20,
            velocityVariance: 15,
            timingMode: 'gaussian',
            velocityMode: 'gaussian',
            description: 'Looser feel, more relaxed timing'
        });

        this.humanizationPresets.set('sloppy', {
            name: 'Sloppy',
            timingVariance: 40,
            velocityVariance: 25,
            timingMode: 'uniform',
            velocityMode: 'uniform',
            description: 'Intentionally sloppy, punk rock style'
        });

        this.humanizationPresets.set('drummer', {
            name: 'Drummer Feel',
            timingVariance: 15,
            velocityVariance: 12,
            timingMode: 'gaussian',
            velocityMode: 'gaussian',
            grooveBias: -5, // Slight rush
            description: 'Simulates a live drummer\'s feel'
        });

        this.humanizationPresets.set('pianist', {
            name: 'Pianist Feel',
            timingVariance: 8,
            velocityVariance: 10,
            timingMode: 'gaussian',
            velocityMode: 'scale',
            description: 'Simulates expressive piano playing'
        });

        this.humanizationPresets.set('programmer', {
            name: 'Perfect Quantized',
            timingVariance: 0,
            velocityVariance: 0,
            timingMode: 'gaussian',
            velocityMode: 'gaussian',
            description: 'Reset to perfectly quantized'
        });
    }

    /**
     * Humanize a single note
     * @param {Object} note - Note object with pitch, velocity, start, duration
     * @returns {Object} - Humanized note
     */
    humanizeNote(note) {
        const humanized = { ...note };

        // Humanize timing
        const timingOffset = this.generateTimingOffset();
        humanized.start = Math.max(0, note.start + timingOffset / 1000); // Convert ms to seconds

        // Humanize velocity
        const velocityOffset = this.generateVelocityOffset();
        humanized.velocity = Math.max(1, Math.min(127, Math.round(note.velocity + velocityOffset)));

        // Optionally humanize duration
        humanized.duration = note.duration;

        // Store original values
        humanized.originalStart = note.start;
        humanized.originalVelocity = note.velocity;

        return humanized;
    }

    /**
     * Generate timing offset based on mode
     * @returns {number} - Offset in milliseconds
     */
    generateTimingOffset() {
        switch (this.timingMode) {
            case 'gaussian':
                return this.gaussianRandom(0, this.timingVariance);
            case 'uniform':
                return (Math.random() - 0.5) * 2 * this.timingVariance;
            default:
                return this.gaussianRandom(0, this.timingVariance);
        }
    }

    /**
     * Generate velocity offset based on mode
     * @returns {number} - Offset in velocity units
     */
    generateVelocityOffset() {
        switch (this.velocityMode) {
            case 'gaussian':
                return this.gaussianRandom(0, this.velocityVariance);
            case 'uniform':
                return (Math.random() - 0.5) * 2 * this.velocityVariance;
            case 'scale':
                // Velocity scales based on pitch (higher notes = quieter)
                return this.gaussianRandom(0, this.velocityVariance) - 2;
            default:
                return this.gaussianRandom(0, this.velocityVariance);
        }
    }

    /**
     * Gaussian random number generator (Box-Muller)
     * @param {number} mean - Mean value
     * @param {number} stdDev - Standard deviation
     * @returns {number} - Random number
     */
    gaussianRandom(mean, stdDev) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    /**
     * Humanize all notes in a pattern
     * @param {Array} notes - Array of note objects
     * @returns {Array} - Humanized notes
     */
    humanizePattern(notes) {
        if (!notes || notes.length === 0) return notes;

        return notes.map(note => this.humanizeNote(note));
    }

    /**
     * Humanize with groove bias (tendency to rush or drag)
     * @param {Array} notes - Array of notes
     * @param {number} grooveBias - Bias in ms (positive = drag, negative = rush)
     * @returns {Array} - Humanized notes with groove
     */
    humanizeWithGroove(notes, grooveBias = 0) {
        const humanized = this.humanizePattern(notes);

        // Apply groove bias to all notes
        humanized.forEach(note => {
            note.start = Math.max(0, note.start + grooveBias / 1000);
        });

        return humanized;
    }

    /**
     * Humanize only selected notes
     * @param {Array} notes - All notes
     * @param {Array} selectedIndices - Indices of selected notes
     * @returns {Array} - Notes with humanized selection
     */
    humanizeSelection(notes, selectedIndices) {
        return notes.map((note, index) => {
            if (selectedIndices.includes(index)) {
                return this.humanizeNote(note);
            }
            return note;
        });
    }

    /**
     * Apply swing feel to notes
     * @param {Array} notes - Array of notes
     * @param {number} swingAmount - Swing amount 0-100
     * @param {number} gridSubdivision - Grid subdivision (e.g., 8 for eighth notes)
     * @returns {Array} - Swung notes
     */
    applySwing(notes, swingAmount = 50, gridSubdivision = 8) {
        const swingRatio = 1 + (swingAmount / 100) * 0.666; // Max 2:1 ratio
        const gridDuration = 4 / gridSubdivision; // In beats

        return notes.map(note => {
            const gridPosition = note.start / gridDuration;
            const gridIndex = Math.round(gridPosition);
            const isOffBeat = gridIndex % 2 === 1;

            if (isOffBeat) {
                // Delay off-beat notes
                const swingOffset = gridDuration * (swingRatio - 1);
                return {
                    ...note,
                    start: note.start + swingOffset,
                    originalStart: note.start
                };
            }
            return note;
        });
    }

    /**
     * Apply humanization preset
     * @param {string} presetName - Name of preset
     * @param {Array} notes - Notes to humanize
     * @returns {Array} - Humanized notes
     */
    applyPreset(presetName, notes) {
        const preset = this.humanizationPresets.get(presetName);
        if (!preset) return notes;

        // Apply preset settings
        this.timingVariance = preset.timingVariance;
        this.velocityVariance = preset.velocityVariance;
        this.timingMode = preset.timingMode;
        this.velocityMode = preset.velocityMode;

        // Humanize with groove bias if present
        if (preset.grooveBias) {
            return this.humanizeWithGroove(notes, preset.grooveBias);
        }

        return this.humanizePattern(notes);
    }

    /**
     * Get all presets
     * @returns {Array} - Array of presets
     */
    getPresets() {
        return Array.from(this.humanizationPresets.entries()).map(([id, preset]) => ({
            id,
            ...preset
        }));
    }

    /**
     * Set timing variance
     * @param {number} variance - Variance in ms
     */
    setTimingVariance(variance) {
        this.timingVariance = Math.max(0, Math.min(100, variance));
    }

    /**
     * Set velocity variance
     * @param {number} variance - Variance in velocity units
     */
    setVelocityVariance(variance) {
        this.velocityVariance = Math.max(0, Math.min(50, variance));
    }

    /**
     * Reset notes to original quantized state
     * @param {Array} notes - Notes with originalStart/originalVelocity
     * @returns {Array} - Reset notes
     */
    resetToQuantized(notes) {
        return notes.map(note => {
            const reset = { ...note };
            if (note.originalStart !== undefined) {
                reset.start = note.originalStart;
                delete reset.originalStart;
            }
            if (note.originalVelocity !== undefined) {
                reset.velocity = note.originalVelocity;
                delete reset.originalVelocity;
            }
            return reset;
        });
    }

    /**
     * Open humanization panel UI
     */
    openHumanizePanel(notes, onApply) {
        const existing = document.getElementById('midi-humanize-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'midi-humanize-panel';

        const presets = this.getPresets();
        const presetOptions = presets.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');

        panel.innerHTML = `
            <div class="humanize-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 500px;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🎭 MIDI Note Humanize</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Preset</label>
                    <select id="humanize-preset" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        ${presetOptions}
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Timing Variance: <span id="timing-value">${this.timingVariance}</span> ms</label>
                    <input type="range" id="timing-variance" min="0" max="100" value="${this.timingVariance}"
                        style="width: 100%; margin-top: 8px; accent-color: #8b5cf6;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Velocity Variance: <span id="velocity-value">${this.velocityVariance}</span></label>
                    <input type="range" id="velocity-variance" min="0" max="50" value="${this.velocityVariance}"
                        style="width: 100%; margin-top: 8px; accent-color: #8b5cf6;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Timing Mode</label>
                        <select id="timing-mode" style="width: 100%; margin-top: 8px; padding: 8px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                            <option value="gaussian" ${this.timingMode === 'gaussian' ? 'selected' : ''}>Gaussian</option>
                            <option value="uniform" ${this.timingMode === 'uniform' ? 'selected' : ''}>Uniform</option>
                        </select>
                    </div>
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Velocity Mode</label>
                        <select id="velocity-mode" style="width: 100%; margin-top: 8px; padding: 8px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                            <option value="gaussian" ${this.velocityMode === 'gaussian' ? 'selected' : ''}>Gaussian</option>
                            <option value="uniform" ${this.velocityMode === 'uniform' ? 'selected' : ''}>Uniform</option>
                            <option value="scale" ${this.velocityMode === 'scale' ? 'selected' : ''}>Scale</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Swing Amount: <span id="swing-value">${this.swingAmount}</span>%</label>
                    <input type="range" id="swing-amount" min="0" max="100" value="${this.swingAmount}"
                        style="width: 100%; margin-top: 8px; accent-color: #f59e0b;">
                </div>

                <div id="humanize-preview" style="display: none; background: #2a2a4e; padding: 12px; border-radius: 4px; margin-bottom: 16px; font-size: 12px; color: #a0a0a0;">
                    <div id="preview-stats"></div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="humanize-preview-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Preview
                    </button>
                    <button id="humanize-apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Apply
                    </button>
                    <button id="humanize-reset-btn" style="padding: 12px 16px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Reset
                    </button>
                    <button id="humanize-close-btn" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #midi-humanize-panel {
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
        const presetSelect = document.getElementById('humanize-preset');
        const timingSlider = document.getElementById('timing-variance');
        const velocitySlider = document.getElementById('velocity-variance');
        const timingModeSelect = document.getElementById('timing-mode');
        const velocityModeSelect = document.getElementById('velocity-mode');
        const swingSlider = document.getElementById('swing-amount');
        const previewBtn = document.getElementById('humanize-preview-btn');
        const applyBtn = document.getElementById('humanize-apply-btn');
        const resetBtn = document.getElementById('humanize-reset-btn');
        const closeBtn = document.getElementById('humanize-close-btn');
        const previewDiv = document.getElementById('humanize-preview');
        const previewStats = document.getElementById('preview-stats');

        // Update displays
        timingSlider.addEventListener('input', (e) => {
            this.setTimingVariance(parseInt(e.target.value));
            document.getElementById('timing-value').textContent = e.target.value;
        });

        velocitySlider.addEventListener('input', (e) => {
            this.setVelocityVariance(parseInt(e.target.value));
            document.getElementById('velocity-value').textContent = e.target.value;
        });

        timingModeSelect.addEventListener('change', (e) => {
            this.timingMode = e.target.value;
        });

        velocityModeSelect.addEventListener('change', (e) => {
            this.velocityMode = e.target.value;
        });

        swingSlider.addEventListener('input', (e) => {
            this.swingAmount = parseInt(e.target.value);
            document.getElementById('swing-value').textContent = e.target.value;
        });

        // Preset selection
        presetSelect.addEventListener('change', (e) => {
            const preset = this.humanizationPresets.get(e.target.value);
            if (preset) {
                this.timingVariance = preset.timingVariance;
                this.velocityVariance = preset.velocityVariance;
                this.timingMode = preset.timingMode;
                this.velocityMode = preset.velocityMode;

                timingSlider.value = preset.timingVariance;
                velocitySlider.value = preset.velocityVariance;
                timingModeSelect.value = preset.timingMode;
                velocityModeSelect.value = preset.velocityMode;

                document.getElementById('timing-value').textContent = preset.timingVariance;
                document.getElementById('velocity-value').textContent = preset.velocityVariance;
            }
        });

        // Preview
        previewBtn.addEventListener('click', () => {
            if (!notes || notes.length === 0) return;

            const humanized = this.humanizePattern(notes);

            // Calculate statistics
            let timingChanges = [];
            let velocityChanges = [];

            humanized.forEach((h, i) => {
                timingChanges.push((h.start - notes[i].start) * 1000);
                velocityChanges.push(h.velocity - notes[i].velocity);
            });

            const avgTiming = timingChanges.reduce((a, b) => a + b, 0) / timingChanges.length;
            const avgVelocity = velocityChanges.reduce((a, b) => a + b, 0) / velocityChanges.length;

            previewDiv.style.display = 'block';
            previewStats.innerHTML = `
                <div>Notes: ${notes.length}</div>
                <div>Avg timing shift: ${avgTiming.toFixed(2)} ms</div>
                <div>Avg velocity change: ${avgVelocity.toFixed(2)}</div>
            `;
        });

        // Apply
        applyBtn.addEventListener('click', () => {
            if (!notes || notes.length === 0) return;

            let humanized = this.humanizePattern(notes);

            // Apply swing if set
            if (this.swingAmount > 0) {
                humanized = this.applySwing(humanized, this.swingAmount);
            }

            if (onApply) {
                onApply(humanized);
            }

            panel.remove();
            style.remove();
        });

        // Reset
        resetBtn.addEventListener('click', () => {
            if (!notes || notes.length === 0) return;

            const reset = this.resetToQuantized(notes);

            if (onApply) {
                onApply(reset);
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
const midiNoteHumanize = new MIDINoteHumanize();

export { MIDINoteHumanize, midiNoteHumanize };