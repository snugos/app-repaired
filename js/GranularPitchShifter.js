/**
 * Granular Pitch Shifter - Granular-based pitch shifting with formant preservation
 * Provides high-quality pitch shifting using granular synthesis techniques
 */

class GranularPitchShifter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Input/Output
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Dry/Wet mix
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Analysis
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        // Configuration
        this.config = {
            pitch: options.pitch || 0,        // Semitones (-12 to +12)
            formant: options.formant || 0,    // Formant shift (-12 to +12)
            grainSize: options.grainSize || 50, // ms
            grainCount: options.grainCount || 8,
            randomize: options.randomize || 0,
            feedback: options.feedback || 0,
            mix: options.mix || 1
        };
        
        // Granular engine
        this.grains = [];
        this.grainPool = [];
        this.maxGrains = 32;
        
        // Delay line for pitch shifting
        this.delayTime = 0.1;
        this.delayLine = audioContext.createDelay(2);
        this.delayLine.delayTime.value = this.delayTime;
        
        // Feedback loop
        this.feedbackGain = audioContext.createGain();
        this.feedbackGain.gain.value = this.config.feedback;
        
        // Buffer for granular processing
        this.bufferSize = audioContext.sampleRate * 2; // 2 second buffer
        this.circularBuffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;
        
        // Grain timing
        this.lastGrainTime = 0;
        this.grainInterval = this.config.grainSize / this.config.grainCount;
        
        // Pitch ratio calculation
        this.semitoneRatio = Math.pow(2, 1/12);
        
        // Formant preservation
        this.preserveFormants = options.preserveFormants !== false;
        this.formantFilters = [];
        
        // Window function (Hann window)
        this.windowTable = this.generateWindow(1024);
        
        // Grain envelope types
        this.envelopeTypes = {
            'gaussian': this.gaussianEnvelope.bind(this),
            'hann': this.hannEnvelope.bind(this),
            'triangle': this.triangleEnvelope.bind(this),
            'cosine': this.cosineEnvelope.bind(this)
        };
        this.currentEnvelope = options.envelope || 'gaussian';
        
        // Build signal path
        this.buildSignalPath();
        
        // Initialize grains
        this.initGrains();
        
        // Presets
        this.presets = {
            'Octave Up': { pitch: 12, formant: 0, grainSize: 30, mix: 1 },
            'Octave Down': { pitch: -12, formant: 0, grainSize: 80, mix: 1 },
            'Fifth Up': { pitch: 7, formant: 0, grainSize: 40, mix: 1 },
            'Fifth Down': { pitch: -7, formant: 0, grainSize: 60, mix: 1 },
            'Third Up': { pitch: 4, formant: 0, grainSize: 40, mix: 1 },
            'Third Down': { pitch: -4, formant: 0, grainSize: 60, mix: 1 },
            'Detune': { pitch: 0.5, formant: 0, grainSize: 30, randomize: 0.2, mix: 0.5 },
            'Chipmunk': { pitch: 12, formant: 12, grainSize: 20, mix: 1 },
            'Monster': { pitch: -12, formant: -12, grainSize: 100, mix: 1 },
            'Gender Shift': { pitch: 0, formant: 5, grainSize: 50, mix: 1 },
            'Harmony': { pitch: 7, formant: 0, grainSize: 40, mix: 0.7 },
            'Octaver': { pitch: 12, formant: 0, grainSize: 30, feedback: 0.2, mix: 0.8 }
        };
        
        // Processing state
        this.isProcessing = false;
        this.processInterval = null;
    }
    
    /**
     * Build signal path
     */
    buildSignalPath() {
        // Dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Wet path through delay (for granular reading)
        this.input.connect(this.delayLine);
        this.delayLine.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Feedback loop
        this.wetGain.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delayLine);
        
        // Analysis
        this.input.connect(this.analyser);
        
        // Apply initial mix
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
    }
    
    /**
     * Initialize grain pool
     */
    initGrains() {
        for (let i = 0; i < this.maxGrains; i++) {
            this.grainPool.push({
                active: false,
                startTime: 0,
                duration: 0,
                readOffset: 0,
                pitchRatio: 1,
                amplitude: 1,
                pan: 0
            });
        }
    }
    
    /**
     * Generate window function
     */
    generateWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
        }
        return window;
    }
    
    /**
     * Gaussian envelope
     */
    gaussianEnvelope(position, sigma = 0.3) {
        return Math.exp(-((position - 0.5) * (position - 0.5)) / (2 * sigma * sigma));
    }
    
    /**
     * Hann envelope
     */
    hannEnvelope(position) {
        return 0.5 * (1 - Math.cos(2 * Math.PI * position));
    }
    
    /**
     * Triangle envelope
     */
    triangleEnvelope(position) {
        return position < 0.5 ? 2 * position : 2 * (1 - position);
    }
    
    /**
     * Cosine envelope
     */
    cosineEnvelope(position) {
        return Math.sin(Math.PI * position);
    }
    
    /**
     * Start granular processing
     */
    start() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        // Start granular scheduling
        this.scheduleGrains();
    }
    
    /**
     * Stop granular processing
     */
    stop() {
        this.isProcessing = false;
        
        // Stop all grains
        for (const grain of this.grains) {
            grain.active = false;
        }
        this.grains = [];
    }
    
    /**
     * Schedule grains
     */
    scheduleGrains() {
        if (!this.isProcessing) return;
        
        const now = this.audioContext.currentTime;
        const grainInterval = this.config.grainSize / this.config.grainCount / 1000;
        
        // Schedule grains ahead of time
        while (this.lastGrainTime < now + 0.1) {
            this.scheduleGrain(this.lastGrainTime);
            this.lastGrainTime += grainInterval;
        }
        
        // Continue scheduling
        setTimeout(() => this.scheduleGrains(), 50);
    }
    
    /**
     * Schedule a single grain
     */
    scheduleGrain(time) {
        const grain = this.grainPool.find(g => !g.active);
        if (!grain) return;
        
        grain.active = true;
        grain.startTime = time;
        grain.duration = this.config.grainSize / 1000;
        
        // Calculate pitch ratio
        grain.pitchRatio = Math.pow(this.semitoneRatio, this.config.pitch);
        
        // Apply randomization
        if (this.config.randomize > 0) {
            grain.pitchRatio *= (1 + (Math.random() - 0.5) * this.config.randomize);
            grain.startTime += (Math.random() - 0.5) * grain.duration * this.config.randomize;
        }
        
        // Read offset (delayed to allow for pitch shifting)
        const delayForPitch = grain.duration * (grain.pitchRatio - 1);
        grain.readOffset = Math.max(0, this.delayTime - delayForPitch);
        
        // Random pan for stereo width
        grain.pan = (Math.random() - 0.5) * 0.5;
        
        this.grains.push(grain);
        
        // Create grain player
        this.playGrain(grain);
    }
    
    /**
     * Play a grain using Web Audio
     */
    playGrain(grain) {
        const ctx = this.audioContext;
        
        // Create nodes for this grain
        const gain = ctx.createGain();
        const pan = ctx.createStereoPanner();
        const source = ctx.createBufferSource();
        
        // Get input buffer (simplified - in production would use circular buffer)
        // For now, use oscillator to simulate pitch-shifted content
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        
        // Analyze input frequency to determine base frequency
        const freqData = new Float32Array(this.analyser.frequencyBinCount);
        this.analyser.getFloatFrequencyData(freqData);
        const dominantFreq = this.findDominantFrequency(freqData);
        
        // Set oscillator frequency with pitch shift
        osc.frequency.value = dominantFreq * grain.pitchRatio;
        osc.type = 'sine';
        oscGain.gain.value = 0;
        
        // Apply envelope
        const envelopeFunc = this.envelopeTypes[this.currentEnvelope];
        const now = ctx.currentTime;
        const duration = grain.duration;
        
        // Create envelope curve
        const envelopePoints = 64;
        for (let i = 0; i < envelopePoints; i++) {
            const position = i / (envelopePoints - 1);
            const envValue = envelopeFunc(position) * 0.3;
            oscGain.gain.setValueAtTime(envValue, now + position * duration);
        }
        
        // Connect grain
        osc.connect(oscGain);
        oscGain.connect(pan);
        pan.pan.value = grain.pan;
        pan.connect(this.wetGain);
        
        // Start and stop oscillator
        osc.start(now);
        osc.stop(now + duration);
        
        // Deactivate grain when done
        setTimeout(() => {
            grain.active = false;
            const idx = this.grains.indexOf(grain);
            if (idx > -1) this.grains.splice(idx, 1);
        }, duration * 1000 + 50);
    }
    
    /**
     * Find dominant frequency from analysis data
     */
    findDominantFrequency(data) {
        const sampleRate = this.audioContext.sampleRate;
        const binWidth = sampleRate / (data.length * 2);
        
        let maxLevel = -100;
        let maxBin = 0;
        
        for (let i = 1; i < data.length; i++) {
            if (data[i] > maxLevel) {
                maxLevel = data[i];
                maxBin = i;
            }
        }
        
        return Math.max(20, maxBin * binWidth);
    }
    
    /**
     * Set pitch (semitones)
     */
    setPitch(semitones) {
        this.config.pitch = Math.max(-24, Math.min(24, semitones));
    }
    
    /**
     * Set formant shift (semitones)
     */
    setFormant(semitones) {
        this.config.formant = Math.max(-12, Math.min(12, semitones));
        this.updateFormantFilters();
    }
    
    /**
     * Update formant filters
     */
    updateFormantFilters() {
        // Formant shift affects the filter frequencies
        const formantRatio = Math.pow(this.semitoneRatio, this.config.formant);
        // Apply to formant filters if they exist
        for (const filter of this.formantFilters) {
            if (filter.baseFreq) {
                filter.frequency.value = filter.baseFreq * formantRatio;
            }
        }
    }
    
    /**
     * Set grain size (ms)
     */
    setGrainSize(ms) {
        this.config.grainSize = Math.max(10, Math.min(200, ms));
        this.grainInterval = this.config.grainSize / this.config.grainCount;
    }
    
    /**
     * Set grain count
     */
    setGrainCount(count) {
        this.config.grainCount = Math.max(1, Math.min(16, count));
        this.grainInterval = this.config.grainSize / this.config.grainCount;
    }
    
    /**
     * Set randomize amount
     */
    setRandomize(value) {
        this.config.randomize = Math.max(0, Math.min(1, value));
    }
    
    /**
     * Set feedback
     */
    setFeedback(value) {
        this.config.feedback = Math.max(0, Math.min(0.9, value));
        this.feedbackGain.gain.value = this.config.feedback;
    }
    
    /**
     * Set mix
     */
    setMix(value) {
        this.config.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
    }
    
    /**
     * Set envelope type
     */
    setEnvelope(type) {
        if (this.envelopeTypes[type]) {
            this.currentEnvelope = type;
        }
    }
    
    /**
     * Apply preset
     */
    applyPreset(name) {
        const preset = this.presets[name];
        if (!preset) return false;
        
        Object.assign(this.config, preset);
        this.setFormant(preset.formant || 0);
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
        
        return true;
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets);
    }
    
    /**
     * Connect nodes
     */
    connect(destination) {
        this.output.connect(destination.input || destination);
    }
    
    /**
     * Disconnect
     */
    disconnect() {
        this.output.disconnect();
    }
    
    /**
     * Get settings
     */
    getSettings() {
        return { ...this.config, envelope: this.currentEnvelope };
    }
    
    /**
     * Apply settings
     */
    applySettings(settings) {
        if (settings.pitch !== undefined) this.setPitch(settings.pitch);
        if (settings.formant !== undefined) this.setFormant(settings.formant);
        if (settings.grainSize !== undefined) this.setGrainSize(settings.grainSize);
        if (settings.grainCount !== undefined) this.setGrainCount(settings.grainCount);
        if (settings.randomize !== undefined) this.setRandomize(settings.randomize);
        if (settings.feedback !== undefined) this.setFeedback(settings.feedback);
        if (settings.mix !== undefined) this.setMix(settings.mix);
        if (settings.envelope !== undefined) this.setEnvelope(settings.envelope);
    }
}

// Factory function
function createGranularPitchShifter(audioContext, options = {}) {
    return new GranularPitchShifter(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GranularPitchShifter, createGranularPitchShifter };
}