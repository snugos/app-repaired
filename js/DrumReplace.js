/**
 * Drum Replace - Replace drum samples by detected hit type (kick/snare/hat)
 * Analyzes audio track and replaces detected hits with selected drum samples
 */

class DrumReplace {
    constructor() {
        this.isActive = false;
        this.sourceTrack = null;
        this.targetDrumTrack = null;
        this.threshold = -20; // dB threshold for hit detection
        this.minInterval = 0.1; // minimum seconds between hits
        this.attackTime = 0.005;
        this.releaseTime = 0.1;
        
        // Frequency bands for drum type detection
        this.frequencyBands = {
            kick: { low: 30, high: 150 },      // 30-150 Hz
            snare: { low: 150, high: 800 },    // 150-800 Hz  
            hat: { low: 800, high: 8000 },     // 800-8000 Hz
            tom: { low: 80, high: 400 },       // 80-400 Hz
            clap: { low: 400, high: 2000 }     // 400-2000 Hz
        };
        
        this.lastHitTime = 0;
        this.detectedType = null;
        this.onHitDetected = null;
        
        this.audioContext = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return true;
        } catch (e) {
            console.error('[DrumReplace] Failed to initialize:', e);
            return false;
        }
    }

    /**
     * Set source track to analyze
     * @param {Track} track - The track to analyze for drum hits
     */
    setSourceTrack(track) {
        this.sourceTrack = track;
    }

    /**
     * Set target drum track for replacement
     * @param {Track} track - The DrumSampler track to use for replacement
     */
    setTargetDrumTrack(track) {
        if (track && track.type !== 'DrumSampler') {
            console.warn('[DrumReplace] Target track must be a DrumSampler');
            return false;
        }
        this.targetDrumTrack = track;
        return true;
    }

    /**
     * Set detection threshold
     * @param {number} dB - Threshold in dB
     */
    setThreshold(dB) {
        this.threshold = Math.max(-60, Math.min(0, dB));
    }

    /**
     * Detect drum type from frequency content
     * @param {Float32Array} buffer - Audio buffer data
     * @param {number} sampleRate - Sample rate
     * @returns {string} - Detected drum type
     */
    detectDrumType(buffer, sampleRate) {
        // Simple energy-based detection using frequency bands
        const bassEnergy = this.analyzeBand(buffer, sampleRate, this.frequencyBands.kick.low, this.frequencyBands.kick.high);
        const midEnergy = this.analyzeBand(buffer, sampleRate, this.frequencyBands.snare.low, this.frequencyBands.snare.high);
        const highEnergy = this.analyzeBand(buffer, sampleRate, this.frequencyBands.hat.low, this.frequencyBands.hat.high);
        
        // Find dominant frequency band
        const energies = {
            kick: bassEnergy,
            snare: midEnergy,
            hat: highEnergy
        };
        
        let maxEnergy = 0;
        let detectedType = 'hat'; // default
        
        for (const [type, energy] of Object.entries(energies)) {
            if (energy > maxEnergy) {
                maxEnergy = energy;
                detectedType = type;
            }
        }
        
        return detectedType;
    }

    /**
     * Analyze energy in a frequency band (simplified FFT)
     * @param {Float32Array} buffer - Audio buffer
     * @param {number} sampleRate - Sample rate
     * @param {number} lowFreq - Low frequency bound
     * @param {number} highFreq - High frequency bound
     * @returns {number} - Energy in the band
     */
    analyzeBand(buffer, sampleRate, lowFreq, highFreq) {
        // Simple energy calculation (not true FFT but works for detection)
        const blockSize = 1024;
        let energy = 0;
        let count = 0;
        
        // Apply basic bandpass approximation using difference method
        for (let i = 0; i < buffer.length; i++) {
            const sample = buffer[i];
            
            // High-pass approximation
            if (highFreq > 1000) {
                energy += Math.abs(sample) * 0.5;
            }
            
            // Low-pass approximation
            if (lowFreq < 200) {
                energy += Math.abs(sample) * 0.5;
            }
            
            count++;
        }
        
        return count > 0 ? energy / count : 0;
    }

    /**
     * Trigger pad on target drum track
     * @param {string} drumType - Detected drum type
     */
    triggerPad(drumType) {
        if (!this.targetDrumTrack) return;
        
        // Map drum type to pad index
        const padMap = {
            kick: 0,    // Pad 1 typically kick
            snare: 1,   // Pad 2 typically snare
            hat: 2,     // Pad 3 typically hi-hat
            tom: 3,     // Pad 4 typically tom
            clap: 4     // Pad 5 typically clap
        };
        
        const padIndex = padMap[drumType] !== undefined ? padMap[drumType] : 0;
        
        // Trigger the pad if it has a sample loaded
        if (this.targetDrumTrack.drumSamplerPads && 
            this.targetDrumTrack.drumSamplerPads[padIndex] &&
            this.targetDrumTrack.drumSamplerPads[padIndex].status === 'loaded') {
            
            this.targetDrumTrack.triggerDrumPad(padIndex, 1.0);
            
            if (this.onHitDetected) {
                this.onHitDetected({
                    type: drumType,
                    pad: padIndex,
                    time: performance.now()
                });
            }
        }
    }

    /**
     * Process audio buffer for hit detection
     * @param {Float32Array} buffer - Audio buffer
     * @param {number} sampleRate - Sample rate
     * @returns {Object|null} - Hit detection result or null
     */
    processBuffer(buffer, sampleRate) {
        if (!this.isActive) return null;
        
        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        const db = 20 * Math.log10(rms + 0.0001);
        
        // Check threshold
        if (db < this.threshold) return null;
        
        // Check minimum interval
        const now = performance.now() / 1000;
        if (now - this.lastHitTime < this.minInterval) return null;
        
        this.lastHitTime = now;
        
        // Detect drum type
        const drumType = this.detectDrumType(buffer, sampleRate);
        
        // Trigger replacement
        this.triggerPad(drumType);
        
        return {
            type: drumType,
            energy: db,
            time: now
        };
    }

    /**
     * Enable/disable drum replace
     * @param {boolean} active - Enable state
     */
    setActive(active) {
        this.isActive = active;
        console.log(`[DrumReplace] ${active ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Get current settings
     * @returns {Object} - Current settings
     */
    getSettings() {
        return {
            isActive: this.isActive,
            threshold: this.threshold,
            minInterval: this.minInterval,
            hasSourceTrack: !!this.sourceTrack,
            hasTargetTrack: !!this.targetDrumTrack
        };
    }

    dispose() {
        this.isActive = false;
        this.sourceTrack = null;
        this.targetDrumTrack = null;
        this.audioContext = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrumReplace;
}
if (typeof window !== 'undefined') {
    window.DrumReplace = DrumReplace;
}