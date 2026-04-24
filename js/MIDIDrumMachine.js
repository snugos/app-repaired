/**
 * MIDI Drum Machine - Drum machine interface with step sequencer
 * Provides a classic drum machine interface with pattern editing and MIDI output
 */

export class MIDIDrumMachine {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Parameters
        this.bpm = options.bpm ?? 120;
        this.steps = options.steps ?? 16;
        this swing = options.swing ?? 0; // 0-100%
        this.humanize = options.humanize ?? 0; // 0-100%
        this.isPlaying = false;
        this.currentStep = 0;
        
        // Drum kit configuration
        this.kit = options.kit ?? this._getDefaultKit();
        this.patterns = [];
        this.activePatternIndex = 0;
        
        // Audio nodes
        this.output = audioContext.createGain();
        this.compressor = audioContext.createDynamicsCompressor();
        this.compressor.connect(this.output);
        
        // Sequencer timing
        this.nextNoteTime = 0;
        this.timerID = null;
        this.scheduleAheadTime = 0.1; // seconds
        this.lookAhead = 25; // ms
        
        // UI container
        this.container = null;
        this.padElements = [];
        
        // Initialize
        this._createDefaultPattern();
        this._loadKitSounds();
        
        console.log('[MIDIDrumMachine] Initialized with', this.steps, 'steps');
    }
    
    _getDefaultKit() {
        return {
            kick: { name: 'Kick', note: 36, color: '#ef4444', sample: null },
            snare: { name: 'Snare', note: 38, color: '#f97316', sample: null },
            hihat: { name: 'Hi-Hat', note: 42, color: '#eab308', sample: null },
            openHihat: { name: 'Open HH', note: 46, color: '#84cc16', sample: null },
            tom1: { name: 'Tom 1', note: 48, color: '#22c55e', sample: null },
            tom2: { name: 'Tom 2', note: 45, color: '#14b8a6', sample: null },
            tom3: { name: 'Tom 3', note: 43, color: '#06b6d4', sample: null },
            clap: { name: 'Clap', note: 39, color: '#3b82f6', sample: null },
            rim: { name: 'Rim', note: 37, color: '#8b5cf6', sample: null },
            cowbell: { name: 'Cowbell', note: 56, color: '#a855f7', sample: null },
            crash: { name: 'Crash', note: 49, color: '#ec4899', sample: null },
            ride: { name: 'Ride', note: 51, color: '#f43f5e', sample: null }
        };
    }
    
    _createDefaultPattern() {
        const pattern = {
            name: 'Pattern 1',
            steps: this.steps,
            data: {}
        };
        
        // Initialize all drums with empty steps
        Object.keys(this.kit).forEach(drumName => {
            pattern.data[drumName] = new Array(this.steps).fill(null).map(() => ({
                active: false,
                velocity: 100,
                probability: 100
            }));
        });
        
        this.patterns.push(pattern);
    }
    
    _loadKitSounds() {
        // Create synthetic drum sounds using Web Audio
        Object.keys(this.kit).forEach(drumName => {
            const drum = this.kit[drumName];
            drum.sample = this._createDrumSynth(drumName);
        });
    }
    
    _createDrumSynth(drumName) {
        const ctx = this.audioContext;
        
        switch (drumName) {
            case 'kick':
                return () => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.frequency.setValueAtTime(150, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                    
                    gain.gain.setValueAtTime(1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                    
                    osc.connect(gain);
                    gain.connect(this.compressor);
                    
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.5);
                };
                
            case 'snare':
                return () => {
                    // Noise + tone for snare
                    const noise = ctx.createBufferSource();
                    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
                    const noiseData = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < noiseData.length; i++) {
                        noiseData[i] = Math.random() * 2 - 1;
                    }
                    noise.buffer = noiseBuffer;
                    
                    const noiseGain = ctx.createGain();
                    noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                    
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.value = 1000;
                    
                    noise.connect(filter);
                    filter.connect(noiseGain);
                    noiseGain.connect(this.compressor);
                    
                    // Tone
                    const osc = ctx.createOscillator();
                    const oscGain = ctx.createGain();
                    osc.frequency.value = 180;
                    oscGain.gain.setValueAtTime(0.7, ctx.currentTime);
                    oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                    
                    osc.connect(oscGain);
                    oscGain.connect(this.compressor);
                    
                    noise.start(ctx.currentTime);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.1);
                };
                
            case 'hihat':
                return () => {
                    const noise = ctx.createBufferSource();
                    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
                    const noiseData = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < noiseData.length; i++) {
                        noiseData[i] = Math.random() * 2 - 1;
                    }
                    noise.buffer = noiseBuffer;
                    
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    
                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0.3, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.compressor);
                    
                    noise.start(ctx.currentTime);
                };
                
            case 'openHihat':
                return () => {
                    const noise = ctx.createBufferSource();
                    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
                    const noiseData = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < noiseData.length; i++) {
                        noiseData[i] = Math.random() * 2 - 1;
                    }
                    noise.buffer = noiseBuffer;
                    
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    
                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0.3, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.compressor);
                    
                    noise.start(ctx.currentTime);
                };
                
            case 'clap':
                return () => {
                    // Multiple noise bursts for clap
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            const noise = ctx.createBufferSource();
                            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
                            const noiseData = noiseBuffer.getChannelData(0);
                            for (let j = 0; j < noiseData.length; j++) {
                                noiseData[j] = Math.random() * 2 - 1;
                            }
                            noise.buffer = noiseBuffer;
                            
                            const filter = ctx.createBiquadFilter();
                            filter.type = 'bandpass';
                            filter.frequency.value = 2000;
                            filter.Q.value = 2;
                            
                            const gain = ctx.createGain();
                            gain.gain.setValueAtTime(0.5, ctx.currentTime);
                            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                            
                            noise.connect(filter);
                            filter.connect(gain);
                            gain.connect(this.compressor);
                            
                            noise.start(ctx.currentTime);
                        }, i * 10);
                    }
                };
                
            default:
                // Generic drum sound
                return () => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.frequency.value = 200 + Math.random() * 300;
                    gain.gain.setValueAtTime(0.5, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                    
                    osc.connect(gain);
                    gain.connect(this.compressor);
                    
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.2);
                };
        }
    }
    
    // Play a drum sound
    playDrum(drumName, velocity = 100) {
        const drum = this.kit[drumName];
        if (!drum || !drum.sample) return;
        
        // Adjust velocity
        const normalizedVelocity = velocity / 127;
        // Velocity would affect gain - simplified here
        
        drum.sample();
        
        console.log(`[MIDIDrumMachine] Played ${drumName} with velocity ${velocity}`);
    }
    
    // Toggle a step
    toggleStep(drumName, stepIndex) {
        const pattern = this.patterns[this.activePatternIndex];
        if (!pattern.data[drumName]) return;
        if (stepIndex < 0 || stepIndex >= pattern.steps) return;
        
        pattern.data[drumName][stepIndex].active = !pattern.data[drumName][stepIndex].active;
        
        console.log(`[MIDIDrumMachine] Toggled ${drumName} step ${stepIndex}: ${pattern.data[drumName][stepIndex].active}`);
        
        return pattern.data[drumName][stepIndex].active;
    }
    
    setStepVelocity(drumName, stepIndex, velocity) {
        const pattern = this.patterns[this.activePatternIndex];
        if (!pattern.data[drumName]) return;
        if (stepIndex < 0 || stepIndex >= pattern.steps) return;
        
        pattern.data[drumName][stepIndex].velocity = Math.max(1, Math.min(127, velocity));
    }
    
    setStepProbability(drumName, stepIndex, probability) {
        const pattern = this.patterns[this.activePatternIndex];
        if (!pattern.data[drumName]) return;
        if (stepIndex < 0 || stepIndex >= pattern.steps) return;
        
        pattern.data[drumName][stepIndex].probability = Math.max(0, Math.min(100, probability));
    }
    
    // Sequencer control
    start() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.currentStep = 0;
        this.nextNoteTime = this.audioContext.currentTime;
        
        this._scheduler();
        
        console.log('[MIDIDrumMachine] Started');
    }
    
    stop() {
        this.isPlaying = false;
        
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
        
        console.log('[MIDIDrumMachine] Stopped');
    }
    
    _scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this._scheduleStep(this.currentStep);
            this._advanceStep();
        }
        
        if (this.isPlaying) {
            this.timerID = setTimeout(() => this._scheduler(), this.lookAhead);
        }
    }
    
    _scheduleStep(stepIndex) {
        const pattern = this.patterns[this.activePatternIndex];
        
        Object.keys(this.kit).forEach(drumName => {
            const stepData = pattern.data[drumName][stepIndex];
            
            if (stepData.active) {
                // Check probability
                if (Math.random() * 100 < stepData.probability) {
                    // Apply humanize
                    let time = this.nextNoteTime;
                    if (this.humanize > 0) {
                        const maxOffset = (this.humanize / 100) * (60 / this.bpm / 4) * 0.5;
                        time += (Math.random() - 0.5) * maxOffset;
                    }
                    
                    // Schedule the drum hit
                    setTimeout(() => {
                        this.playDrum(drumName, stepData.velocity);
                    }, Math.max(0, (time - this.audioContext.currentTime) * 1000));
                }
            }
        });
    }
    
    _advanceStep() {
        const secondsPerBeat = 60 / this.bpm;
        const secondsPerStep = secondsPerBeat / 4; // 16th notes
        
        // Apply swing to even-numbered steps
        let swingOffset = 0;
        if (this.swing > 0 && this.currentStep % 2 === 0) {
            swingOffset = secondsPerStep * (this.swing / 100) * 0.5;
        }
        
        this.nextNoteTime += secondsPerStep + swingOffset;
        this.currentStep = (this.currentStep + 1) % this.steps;
    }
    
    // Pattern management
    createPattern(name) {
        const pattern = {
            name: name,
            steps: this.steps,
            data: {}
        };
        
        Object.keys(this.kit).forEach(drumName => {
            pattern.data[drumName] = new Array(this.steps).fill(null).map(() => ({
                active: false,
                velocity: 100,
                probability: 100
            }));
        });
        
        this.patterns.push(pattern);
        
        console.log(`[MIDIDrumMachine] Created pattern: ${name}`);
        
        return this.patterns.length - 1;
    }
    
    deletePattern(index) {
        if (index < 0 || index >= this.patterns.length) return;
        if (this.patterns.length <= 1) {
            console.warn('[MIDIDrumMachine] Cannot delete the last pattern');
            return;
        }
        
        this.patterns.splice(index, 1);
        
        if (this.activePatternIndex >= this.patterns.length) {
            this.activePatternIndex = this.patterns.length - 1;
        }
        
        console.log(`[MIDIDrumMachine] Deleted pattern at index ${index}`);
    }
    
    setActivePattern(index) {
        if (index < 0 || index >= this.patterns.length) return;
        
        this.activePatternIndex = index;
        console.log(`[MIDIDrumMachine] Active pattern: ${this.patterns[index].name}`);
    }
    
    duplicatePattern(index) {
        if (index < 0 || index >= this.patterns.length) return;
        
        const source = this.patterns[index];
        const copy = JSON.parse(JSON.stringify(source));
        copy.name = `${source.name} (copy)`;
        
        this.patterns.push(copy);
        
        console.log(`[MIDIDrumMachine] Duplicated pattern: ${source.name}`);
        
        return this.patterns.length - 1;
    }
    
    clearPattern(index) {
        if (index < 0 || index >= this.patterns.length) return;
        
        const pattern = this.patterns[index];
        
        Object.keys(this.kit).forEach(drumName => {
            pattern.data[drumName].forEach(step => {
                step.active = false;
            });
        });
        
        console.log(`[MIDIDrumMachine] Cleared pattern: ${pattern.name}`);
    }
    
    // Parameter setters
    setBPM(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
    }
    
    getBPM() {
        return this.bpm;
    }
    
    setSwing(swing) {
        this.swing = Math.max(0, Math.min(100, swing));
    }
    
    getSwing() {
        return this.swing;
    }
    
    setHumanize(humanize) {
        this.humanize = Math.max(0, Math.min(100, humanize));
    }
    
    getHumanize() {
        return this.humanize;
    }
    
    setSteps(steps) {
        this.steps = Math.max(4, Math.min(64, steps));
        // Resize patterns
        this.patterns.forEach(pattern => {
            pattern.steps = this.steps;
            Object.keys(this.kit).forEach(drumName => {
                while (pattern.data[drumName].length < this.steps) {
                    pattern.data[drumName].push({ active: false, velocity: 100, probability: 100 });
                }
                while (pattern.data[drumName].length > this.steps) {
                    pattern.data[drumName].pop();
                }
            });
        });
    }
    
    getSteps() {
        return this.steps;
    }
    
    getCurrentStep() {
        return this.currentStep;
    }
    
    // Export pattern as MIDI
    exportMIDI() {
        // This would create a MIDI file with the pattern
        // Simplified version - just return pattern data
        return {
            bpm: this.bpm,
            steps: this.steps,
            pattern: this.patterns[this.activePatternIndex]
        };
    }
    
    // Audio routing
    connect(destination) {
        this.output.connect(destination);
        return this;
    }
    
    disconnect(destination) {
        this.output.disconnect(destination);
        return this;
    }
    
    dispose() {
        this.stop();
        this.output.disconnect();
        this.compressor.disconnect();
        
        console.log('[MIDIDrumMachine] Disposed');
    }
}

// Static methods
MIDIDrumMachine.getMetronomeAudioLabel = function() { return 'MIDI Drum Machine'; };

console.log('[MIDIDrumMachine] Module loaded');