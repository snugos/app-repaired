/**
 * Tremoloauto - Tempo-synced tremolo that locks to project BPM
 * Automatically syncs LFO frequency to musical note values based on tempo
 */

class Tremoloauto {
    constructor() {
        this.isActive = false;
        this.baseFrequency = 10; // Base LFO frequency in Hz (overridden when synced)
        this.depth = 0.7; // Tremolo depth (0-1)
        this.spread = 180; // Stereo spread in degrees
        
        // Note sync options (will be calculated from BPM)
        this.syncNote = '8n'; // Default to 8th notes
        this.syncOptions = [
            '1n',    // Whole note
            '2n',    // Half note
            '4n',    // Quarter note
            '8n',    // Eighth note
            '16n',   // Sixteenth note
            '32n',   // Thirty-second note
            '4t',    // Quarter triplet
            '8t',    // Eighth triplet
            '16t'    // Sixteenth triplet
        ];
        
        this.bpm = 120; // Current BPM
        this.toneNode = null;
        this.lfo = null;
        this.depthNode = null;
        this.spreadNode = null;
        
        this.audioContext = null;
        this.onSyncChanged = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create Tone.js nodes for tremolo
            if (typeof Tone !== 'undefined') {
                this.toneNode = new Tone.Tremolo({
                    frequency: this.baseFrequency,
                    depth: this.depth,
                    type: 'sine',
                    spread: this.spread
                }).start();
                
                this.toneNode.wet.value = 1;
            }
            
            return true;
        } catch (e) {
            console.error('[Tremoloauto] Failed to initialize:', e);
            return false;
        }
    }

    /**
     * Get Tone.js node for integration with effect chains
     * @returns {Tremolo} - Tone.js Tremolo node
     */
    getToneNode() {
        return this.toneNode;
    }

    /**
     * Connect to audio source
     * @param {AudioNode} source - Audio source
     * @returns {AudioNode} - Connected destination
     */
    connect(source) {
        if (this.toneNode) {
            return source.connect(this.toneNode);
        }
        return source;
    }

    /**
     * Set BPM for tempo sync calculation
     * @param {number} bpm - Beats per minute
     */
    setBPM(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
        this.updateSyncFrequency();
    }

    /**
     * Get frequency for a given note value at current BPM
     * @param {string} noteValue - Note value (e.g., '4n', '8n')
     * @returns {number} - Frequency in Hz
     */
    noteToFrequency(noteValue) {
        // Tone.js compatible note durations
        const noteDurations = {
            '1n': 4,      // Whole note = 4 beats
            '2n': 2,      // Half note = 2 beats
            '4n': 1,      // Quarter note = 1 beat
            '8n': 0.5,    // Eighth note = 0.5 beats
            '16n': 0.25,  // Sixteenth note = 0.25 beats
            '32n': 0.125, // Thirty-second note = 0.125 beats
            '4t': 2/3,    // Quarter triplet
            '8t': 1/3,    // Eighth triplet
            '16t': 0.125/1.5 // Sixteenth triplet
        };
        
        const beats = noteDurations[noteValue] || 1;
        const beatsPerSecond = this.bpm / 60;
        const noteFrequency = beatsPerSecond * beats;
        
        return noteFrequency;
    }

    /**
     * Update LFO frequency based on current sync note and BPM
     */
    updateSyncFrequency() {
        if (!this.toneNode) return;
        
        const frequency = this.noteToFrequency(this.syncNote);
        this.toneNode.frequency.value = frequency;
        
        if (this.onSyncChanged) {
            this.onSyncChanged({
                note: this.syncNote,
                frequency: frequency,
                bpm: this.bpm
            });
        }
    }

    /**
     * Set sync note value (tempo-locked subdivision)
     * @param {string} note - Note value from syncOptions
     */
    setSyncNote(note) {
        if (!this.syncOptions.includes(note)) {
            console.warn(`[Tremoloauto] Invalid sync note: ${note}`);
            return;
        }
        
        this.syncNote = note;
        this.updateSyncFrequency();
    }

    /**
     * Set tremolo depth
     * @param {number} depth - Depth value (0-1)
     */
    setDepth(depth) {
        this.depth = Math.max(0, Math.min(1, depth));
        if (this.toneNode) {
            this.toneNode.depth.value = this.depth;
        }
    }

    /**
     * Set LFO waveform type
     * @param {string} type - Waveform type (sine, square, sawtooth, triangle)
     */
    setType(type) {
        if (this.toneNode) {
            this.toneNode.type = type;
        }
    }

    /**
     * Set stereo spread
     * @param {number} spread - Spread in degrees (0-180)
     */
    setSpread(spread) {
        this.spread = Math.max(0, Math.min(180, spread));
        if (this.toneNode) {
            this.toneNode.spread.value = this.spread;
        }
    }

    /**
     * Get current frequency in Hz
     * @returns {number} - Current LFO frequency
     */
    getFrequency() {
        return this.toneNode ? this.toneNode.frequency.value : this.baseFrequency;
    }

    /**
     * Enable/disable tremolo
     * @param {boolean} active - Enable state
     */
    setActive(active) {
        this.isActive = active;
        
        if (this.toneNode) {
            if (active) {
                this.toneNode.wet.value = 1;
            } else {
                this.toneNode.wet.value = 0;
            }
        }
        
        console.log(`[Tremoloauto] ${active ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Get current settings
     * @returns {Object} - Current settings
     */
    getSettings() {
        return {
            isActive: this.isActive,
            syncNote: this.syncNote,
            frequency: this.getFrequency(),
            depth: this.depth,
            spread: this.spread,
            bpm: this.bpm,
            syncOptions: this.syncOptions,
            waveformType: this.toneNode ? this.toneNode.type : 'sine'
        };
    }

    /**
     * Get beat duration in seconds for current BPM and note
     * @returns {number} - Duration in seconds
     */
    getBeatDuration() {
        return 60 / (this.bpm * this.noteToFrequency('4n'));
    }

    dispose() {
        this.isActive = false;
        if (this.toneNode) {
            this.toneNode.dispose();
            this.toneNode = null;
        }
        this.audioContext = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tremoloauto;
}
if (typeof window !== 'undefined') {
    window.Tremoloauto = Tremoloauto;
}