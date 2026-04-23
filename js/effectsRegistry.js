// js/effectsRegistry.js - Definitions for modular effects

// Sidechain Compressor - Compressor with external sidechain input
class SidechainCompressor extends Tone.Compressor {
    constructor(initialParams = {}) {
        super({
            threshold: initialParams.threshold !== undefined ? initialParams.threshold : -24,
            ratio: initialParams.ratio !== undefined ? initialParams.ratio : 4,
            knee: initialParams.knee !== undefined ? initialParams.knee : 30,
            attack: initialParams.attack !== undefined ? initialParams.attack : 0.003,
            release: initialParams.release !== undefined ? initialParams.release : 0.25
        });
        this._sidechainGain = new Tone.Gain(1);
        this._sidechainGain.connect(this.sidetone);
    }

    getSidechainInput() {
        return this._sidechainGain;
    }

    dispose() {
        this._sidechainGain.dispose();
        super.dispose();
    }
}

if (typeof Tone !== 'undefined') {
    Tone.SidechainCompressor = SidechainCompressor;
}

// Multi-band Compressor - 3-band dynamics processor
class MultibandCompressor extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);
        
        this._lowComp = new Tone.Compressor({
            threshold: initialParams.lowThreshold !== undefined ? initialParams.lowThreshold : -24,
            ratio: initialParams.lowRatio !== undefined ? initialParams.lowRatio : 4,
            attack: 0.003,
            release: 0.25
        });
        this._midComp = new Tone.Compressor({
            threshold: initialParams.midThreshold !== undefined ? initialParams.midThreshold : -24,
            ratio: initialParams.midRatio !== undefined ? initialParams.midRatio : 4,
            attack: 0.003,
            release: 0.25
        });
        this._highComp = new Tone.Compressor({
            threshold: initialParams.highThreshold !== undefined ? initialParams.highThreshold : -24,
            ratio: initialParams.highRatio !== undefined ? initialParams.highRatio : 4,
            attack: 0.003,
            release: 0.25
        });
        
        this._lowFilter = new Tone.Filter(initialParams.lowCrossover || 250, 'lowpass');
        this._midFilter = new Tone.Filter(initialParams.lowCrossover || 250, 'bandpass');
        this._midFilter.frequency.value = initialParams.midFrequency || 1000;
        this._highFilter = new Tone.Filter(initialParams.highCrossover || 4000, 'highpass');
        
        this._lowGain = new Tone.Gain(initialParams.lowMakeup || 1.0);
        this._midGain = new Tone.Gain(initialParams.midMakeup || 1.0);
        this._highGain = new Tone.Gain(initialParams.highMakeup || 1.0);
        
        this._splitter = new Tone.Splitter(3);
        
        // Low band
        this._splitter.connect(this._lowFilter, 0);
        this._lowFilter.connect(this._lowComp);
        this._lowComp.connect(this._lowGain);
        
        // Mid band
        this._splitter.connect(this._midFilter, 1);
        this._midFilter.connect(this._midComp);
        this._midComp.connect(this._midGain);
        
        // High band
        this._splitter.connect(this._highFilter, 2);
        this._highFilter.connect(this._highComp);
        this._highComp.connect(this._highGain);
        
        this._merger = new Tone.Merger();
        this._lowGain.connect(this._merger, 0, 0);
        this._midGain.connect(this._merger, 0, 1);
        this._highGain.connect(this._merger, 0, 2);
        
        this._dryGain = new Tone.Gain(1.0);
        this._wetGain = new Tone.Gain(1.0);
        this._merger.connect(this._wetGain);
        this._merger.connect(this._dryGain);
        
        this._splitter.connect(this);
    }
    
    static getMetronomeAudioLabel() { return 'Multiband Compressor'; }
    
    setLowCrossover(freq) {
        this._lowFilter.frequency.value = freq;
        this._midFilter.frequency.value = freq * 4;
    }
    
    setHighCrossover(freq) {
        this._highFilter.frequency.value = freq;
    }
    
    dispose() {
        this._lowComp.dispose();
        this._midComp.dispose();
        this._highComp.dispose();
        this._lowFilter.dispose();
        this._midFilter.dispose();
        this._highFilter.dispose();
        this._lowGain.dispose();
        this._midGain.dispose();
        this._highGain.dispose();
        this._splitter.dispose();
        this._merger.dispose();
        this._dryGain.dispose();
        this._wetGain.dispose();
        super.dispose();
    }
}

Tone.MultibandCompressor = MultibandCompressor;

// AI Mastering Effect - Auto-loudness normalization and tonal balance
class AIMasteringEffect extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);
        
        // Analysis
        this._analyser = new Tone.Analyser('fft', 256);
        
        // EQ3 for tonal balance
        this._eq = new Tone.EQ3({
            low: initialParams.eqLow !== undefined ? initialParams.eqLow : 0,
            lowFrequency: initialParams.eqLowFreq || 200,
            mid: initialParams.eqMid !== undefined ? initialParams.eqMid : 0,
            high: initialParams.eqHigh !== undefined ? initialParams.eqHigh : 0,
            highFrequency: initialParams.eqHighFreq || 3000
        });
        
        // Dynamics compressor
        this._compressor = new Tone.Compressor({
            threshold: initialParams.threshold || -20,
            ratio: initialParams.ratio || 3,
            attack: 0.003,
            release: 0.2,
            knee: 10
        });
        
        // Input gain for auto-level
        this._inputGain = new Tone.Gain(initialParams.inputGain || 1.0);
        
        // Wet/dry
        this._dryGain = new Tone.Gain(1.0);
        this._wetGain = new Tone.Gain(1.0);
        
        // State
        this._targetLUFS = initialParams.targetLUFS || -14;
        this._lastGain = 1.0;
        this._analyzeCount = 0;
        this._isAnalyzing = false;
        this._enabled = true;
        
        // Chain: input -> inputGain -> eq -> compressor -> wet path
        this._inputGain.connect(this._eq);
        this._eq.connect(this._compressor);
        this._compressor.connect(this._wetGain);
        
        // Also connect to dry path
        this._inputGain.connect(this._dryGain);
        
        this.connect(this._wetGain);
    }
    
    static getMetronomeAudioLabel() { return 'AI Mastering'; }
    
    start() {
        this._analyser.initialize();
        this._isAnalyzing = true;
        return super.start();
    }
    
    stop() {
        this._isAnalyzing = false;
        return super.stop();
    }
    
    setEnabled(enabled) {
        this._enabled = enabled;
        if (enabled) {
            this._wetGain.gain.value = 1.0;
            this._dryGain.gain.value = 0.0;
        } else {
            this._wetGain.gain.value = 0.0;
            this._dryGain.gain.value = 1.0;
        }
    }
    
    setTargetLUFS(lufs) {
        this._targetLUFS = Math.max(-30, Math.min(-6, lufs));
    }
    
    getTargetLUFS() {
        return this._targetLUFS;
    }
    
    // Analyze spectrum and auto-adjust
    _analyzeSpectrum() {
        if (!this._isAnalyzing || !this._enabled) return;
        
        const values = this._analyser.getValue();
        if (!values || values.length === 0) return;
        
        // RMS level
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            const db = values[i];
            const linear = Math.pow(10, db / 20);
            sum += linear * linear;
        }
        const rms = Math.sqrt(sum / values.length);
        const dbLevel = 20 * Math.log10(Math.max(rms, 0.0001));
        
        // Auto-gain adjustment every 10 frames
        this._analyzeCount++;
        if (this._analyzeCount % 10 === 0) {
            const targetLinear = Math.pow(10, this._targetLUFS / 20);
            const currentLinear = Math.pow(10, dbLevel / 20);
            
            if (currentLinear > 0.0001) {
                let neededGain = targetLinear / currentLinear;
                neededGain = Math.min(Math.max(neededGain, 0.1), 10);
                
                // Smooth transition
                this._lastGain = this._lastGain * 0.95 + neededGain * 0.05;
                this._inputGain.gain.value = this._lastGain;
            }
        }
    }
    
    dispose() {
        this._analyser.dispose();
        this._eq.dispose();
        this._compressor.dispose();
        this._inputGain.dispose();
        this._dryGain.dispose();
        this._wetGain.dispose();
        super.dispose();
    }
}

Tone.AIMasteringEffect = AIMasteringEffect;

// ScatterEffect definition
const ScatterEffectDefinition = {
    ScatterEffect: {
        displayName: 'Scatter',
        toneClass: 'ScatterEffect',
        params: [
            { key: 'enabled', label: 'Enabled', type: 'checkbox', defaultValue: true },
            { key: 'mode', label: 'Mode', type: 'select', options: ['chaos', 'jungle', 'glitch', 'humanize'], defaultValue: 'chaos' },
            { key: 'timingAmount', label: 'Timing', type: 'knob', min: 0, max: 300, step: 1, defaultValue: 50, decimals: 0, displaySuffix: 'ms' },
            { key: 'timingCurve', label: 'Curve', type: 'select', options: ['gaussian', 'uniform', 'swing'], defaultValue: 'gaussian' },
            { key: 'velocityAmount', label: 'Velocity', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.3, decimals: 2 },
            { key: 'noteProbability', label: 'Probability', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1.0, decimals: 2 },
            { key: 'shuffleNotes', label: 'Shuffle', type: 'checkbox', defaultValue: false },
            { key: 'octaveSpread', label: 'Oct Spread', type: 'knob', min: 0, max: 3, step: 1, defaultValue: 0, decimals: 0 },
            { key: 'pitchRandomSemitones', label: 'Pitch', type: 'knob', min: 0, max: 12, step: 1, defaultValue: 0, decimals: 0, displaySuffix: 'st' },
            { key: 'durationAmount', label: 'Duration', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0, decimals: 2 }
        ]
    }
};

export const AVAILABLE_EFFECTS = {
    AutoFilter: {
        displayName: 'Auto Filter',
        toneClass: 'AutoFilter',
        params: [
            { key: 'frequency', label: 'Speed', type: 'knob', min: 0.1, max: 10, step: 0.1, defaultValue: 2, decimals: 1, displaySuffix: 'Hz', isSignal: true },
            { key: 'baseFrequency', label: 'Base Freq', type: 'knob', min: 20, max: 2000, step: 10, defaultValue: 200, decimals: 0, displaySuffix: 'Hz', isSignal: true },
            { key: 'octaves', label: 'Octaves', type: 'knob', min: 1, max: 8, step: 0.1, defaultValue: 2.6, decimals: 1, isSignal: false },
            { key: 'depth', label: 'Depth', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'filter.type', label: 'Filt Type', type: 'select', options: ['lowpass', 'highpass', 'bandpass'], defaultValue: 'lowpass' },
        ]
    },
    AutoPanner: {
        displayName: 'Auto Panner',
        toneClass: 'AutoPanner',
        params: [
            { key: 'frequency', label: 'Speed', type: 'knob', min: 0.1, max: 10, step: 0.1, defaultValue: 2, decimals: 1, displaySuffix: 'Hz', isSignal: true },
            { key: 'depth', label: 'Depth', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'type', label: 'Waveform', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle'], defaultValue: 'sine', isSignal: false },
        ]
    },
    AutoWah: {
        displayName: 'Auto Wah',
        toneClass: 'AutoWah',
        params: [
            { key: 'baseFrequency', label: 'Base Freq', type: 'knob', min: 50, max: 1000, step: 10, defaultValue: 100, decimals: 0, displaySuffix: 'Hz', isSignal: true },
            { key: 'octaves', label: 'Octaves', type: 'knob', min: 1, max: 6, step: 0.1, defaultValue: 6, decimals: 1, isSignal: false },
            { key: 'sensitivity', label: 'Sensitivity', type: 'knob', min: -40, max: 0, step: 1, defaultValue: 0, decimals: 0, displaySuffix: 'dB', isSignal: false },
            { key: 'Q', label: 'Q', type: 'knob', min: 0.1, max: 10, step: 0.1, defaultValue: 2, decimals: 1, isSignal: true },
            { key: 'gain', label: 'Gain', type: 'knob', min: 0.1, max: 10, step: 0.1, defaultValue: 2, decimals: 1, displaySuffix: '', isSignal: true }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
        ]
    },
    BitCrusher: {
        displayName: 'Bit Crusher',
        toneClass: 'BitCrusher',
        params: [
            { key: 'bits', label: 'Bits', type: 'knob', min: 1, max: 16, step: 1, defaultValue: 4, decimals: 0, isSignal: true }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
        ]
    },
    Chebyshev: {
        displayName: 'Chebyshev',
        toneClass: 'Chebyshev',
        params: [
            { key: 'order', label: 'Order', type: 'knob', min: 1, max: 100, step: 1, defaultValue: 50, decimals: 0, isSignal: false }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'oversample', label: 'Oversample', type: 'select', options: ['none', '2x', '4x'], defaultValue: 'none', isSignal: false }
        ]
    },
    Chorus: {
        displayName: 'Chorus',
        toneClass: 'Chorus',
        params: [
            { key: 'frequency', label: 'Speed', type: 'knob', min: 0.1, max: 20, step: 0.1, defaultValue: 1.5, decimals: 1, displaySuffix: 'Hz', isSignal: true },
            { key: 'delayTime', label: 'Delay', type: 'knob', min: 1, max: 20, step: 0.1, defaultValue: 3.5, decimals: 1, displaySuffix: 'ms', isSignal: false }, 
            { key: 'depth', label: 'Depth', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.7, decimals: 2, isSignal: false }, 
            { key: 'feedback', label: 'Feedback', type: 'knob', min: 0, max: 0.99, step: 0.01, defaultValue: 0.1, decimals: 2, isSignal: true },
            { key: 'spread', label: 'Spread', type: 'knob', min: 0, max: 180, step: 1, defaultValue: 180, decimals: 0, displaySuffix: '°', isSignal: false }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
            { key: 'type', label: 'Waveform', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle'], defaultValue: 'sine', isSignal: false },
        ]
    },
    Distortion: {
        displayName: 'Distortion',
        toneClass: 'Distortion',
        params: [
            { key: 'distortion', label: 'Amount', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.4, decimals: 2, isSignal: false }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'oversample', label: 'Oversample', type: 'select', options: ['none', '2x', '4x'], defaultValue: 'none', isSignal: false }
        ]
    },
    // VST Plugin Support - AudioWorklet-based custom effect
    CustomEffect: {
        displayName: 'Custom Effect (Worklet)',
        toneClass: 'CustomEffect',
        params: [
            { key: 'frequency', label: 'Frequency', type: 'knob', min: 20, max: 2000, step: 1, defaultValue: 440, decimals: 0, displaySuffix: 'Hz', isSignal: true },
            { key: 'gain', label: 'Gain', type: 'knob', min: 0, max: 2, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
        ]
    },
    FeedbackDelay: {
        displayName: 'Feedback Delay',
        toneClass: 'FeedbackDelay',
        params: [
            { key: 'delayTime', label: 'Time', type: 'knob', min: 0.001, max: 1, step: 0.001, defaultValue: 0.25, decimals: 3, displaySuffix: 's', isSignal: true },
            { key: 'feedback', label: 'Feedback', type: 'knob', min: 0, max: 0.99, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
        ]
    },
    Freeverb: {
        displayName: 'Freeverb',
        toneClass: 'Freeverb',
        params: [
            { key: 'roomSize', label: 'Room Size', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.7, decimals: 2, isSignal: true },
            { key: 'dampening', label: 'Dampening', type: 'knob', min: 0, max: 10000, step: 100, defaultValue: 3000, decimals: 0, displaySuffix: 'Hz', isSignal: true }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
        ]
    },
    FrequencyShifter: {
        displayName: 'Freq Shifter',
        toneClass: 'FrequencyShifter',
        params: [
            { key: 'frequency', label: 'Shift Amt', type: 'knob', min: -5000, max: 5000, step: 1, defaultValue: 0, decimals: 0, displaySuffix: 'Hz', isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
        ]
    },
    JCReverb: {
        displayName: 'JC Reverb',
        toneClass: 'JCReverb',
        params: [
            { key: 'roomSize', label: 'Room Size', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
        ]
    },
    Phaser: {
        displayName: 'Phaser',
        toneClass: 'Phaser',
        params: [
            { key: 'frequency', label: 'Speed', type: 'knob', min: 0.1, max: 20, step: 0.1, defaultValue: 0.5, decimals: 1, displaySuffix: 'Hz', isSignal: true },
            { key: 'octaves', label: 'Octaves', type: 'knob', min: 0, max: 8, step: 0.1, defaultValue: 3, decimals: 1, isSignal: false }, 
            { key: 'stages', label: 'Stages', type: 'knob', min: 0, max: 12, step: 1, defaultValue: 10, decimals: 0, isSignal: false }, 
            { key: 'Q', label: 'Q', type: 'knob', min: 0, max: 20, step: 0.1, defaultValue: 10, decimals: 1, isSignal: true },
            { key: 'baseFrequency', label: 'Base Freq', type: 'knob', min: 20, max: 2000, step: 10, defaultValue: 350, decimals: 0, displaySuffix: 'Hz', isSignal: false }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
        ]
    },
    PingPongDelay: {
        displayName: 'Ping Pong Delay',
        toneClass: 'PingPongDelay',
        params: [
            { key: 'delayTime', label: 'Time', type: 'knob', min: 0.001, max: 1, step: 0.001, defaultValue: 0.25, decimals: 3, displaySuffix: 's', isSignal: true },
            { key: 'feedback', label: 'Feedback', type: 'knob', min: 0, max: 0.99, step: 0.01, defaultValue: 0.2, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
        ]
    },
    PitchShift: {
        displayName: 'Pitch Shift',
        toneClass: 'PitchShift',
        params: [
            { key: 'pitch', label: 'Pitch', type: 'knob', min: -24, max: 24, step: 1, defaultValue: 0, decimals: 0, displaySuffix: 'st', isSignal: false }, 
            { key: 'windowSize', label: 'Window', type: 'knob', min: 0.03, max: 0.1, step: 0.001, defaultValue: 0.1, decimals: 3, displaySuffix: 's', isSignal: false }, 
            { key: 'feedback', label: 'Feedback', type: 'knob', min: 0, max: 0.99, step: 0.01, defaultValue: 0, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
        ]
    },
    Reverb: { 
        displayName: 'Reverb (Algorithmic)',
        toneClass: 'Reverb',
        params: [
            { key: 'decay', label: 'Decay', type: 'knob', min: 0.001, max: 20, step: 0.01, defaultValue: 1.5, decimals: 2, displaySuffix: 's', isSignal: false }, 
            { key: 'preDelay', label: 'PreDelay', type: 'knob', min: 0, max: 1, step: 0.001, defaultValue: 0.01, decimals: 3, displaySuffix: 's', isSignal: false }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
        ]
    },
    StereoWidener: {
        displayName: 'Stereo Widener',
        toneClass: 'StereoWidener',
        params: [
            { key: 'width', label: 'Width', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
        ]
    },
    Tremolo: {
        displayName: 'Tremolo',
        toneClass: 'Tremolo',
        params: [
            { key: 'frequency', label: 'Speed', type: 'knob', min: 0.1, max: 40, step: 0.1, defaultValue: 10, decimals: 1, displaySuffix: 'Hz', isSignal: true },
            { key: 'depth', label: 'Depth', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.5, decimals: 2, isSignal: true },
            { key: 'spread', label: 'Spread', type: 'knob', min: 0, max: 180, step: 1, defaultValue: 180, decimals: 0, displaySuffix: '°', isSignal: false }, 
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'type', label: 'Waveform', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle'], defaultValue: 'sine', isSignal: false },
        ]
    },
    Vibrato: {
        displayName: 'Vibrato',
        toneClass: 'Vibrato',
        params: [
            { key: 'maxDelay', label: 'Max Delay', type: 'knob', min: 0, max: 0.01, step: 0.0001, defaultValue: 0.005, decimals: 4, displaySuffix: 's', isSignal: false }, 
            { key: 'frequency', label: 'Speed', type: 'knob', min: 0.1, max: 20, step: 0.1, defaultValue: 5, decimals: 1, displaySuffix: 'Hz', isSignal: true },
            { key: 'depth', label: 'Depth', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.1, decimals: 2, isSignal: true },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'type', label: 'Waveform', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle'], defaultValue: 'sine', isSignal: false },
        ]
    },
    Compressor: {
        displayName: 'Compressor',
        toneClass: 'Compressor',
        params: [ 
            { key: 'threshold', label: 'Threshold', type: 'knob', min: -100, max: 0, step: 1, defaultValue: -24, decimals: 0, displaySuffix: 'dB', isSignal: true },
            { key: 'ratio', label: 'Ratio', type: 'knob', min: 1, max: 20, step: 0.1, defaultValue: 12, decimals: 1, isSignal: true },
            { key: 'knee', label: 'Knee', type: 'knob', min: 0, max: 40, step: 1, defaultValue: 30, decimals: 0, displaySuffix: 'dB', isSignal: true },
            { key: 'attack', label: 'Attack', type: 'knob', min: 0.001, max: 1, step: 0.001, defaultValue: 0.003, decimals: 3, displaySuffix: 's', isSignal: true },
            { key: 'release', label: 'Release', type: 'knob', min: 0.01, max: 1, step: 0.001, defaultValue: 0.25, decimals: 3, displaySuffix: 's', isSignal: true },
            { key: 'sidechain', label: 'Sidechain', type: 'select', options: ['off', 'track'], defaultValue: 'off', isSignal: false },
        ]
    },
    SidechainCompressor: {
        displayName: 'Sidechain Comp',
        toneClass: 'SidechainCompressor',
        params: [ 
            { key: 'threshold', label: 'Threshold', type: 'knob', min: -100, max: 0, step: 1, defaultValue: -24, decimals: 0, displaySuffix: 'dB', isSignal: true },
            { key: 'ratio', label: 'Ratio', type: 'knob', min: 1, max: 20, step: 0.1, defaultValue: 4, decimals: 1, isSignal: true },
            { key: 'knee', label: 'Knee', type: 'knob', min: 0, max: 40, step: 1, defaultValue: 30, decimals: 0, displaySuffix: 'dB', isSignal: true },
            { key: 'attack', label: 'Attack', type: 'knob', min: 0.001, max: 1, step: 0.001, defaultValue: 0.003, decimals: 3, displaySuffix: 's', isSignal: true },
            { key: 'release', label: 'Release', type: 'knob', min: 0.01, max: 1, step: 0.001, defaultValue: 0.25, decimals: 3, displaySuffix: 's', isSignal: true },
        ]
    },
    EQ3: {
        displayName: '3-Band EQ',
        toneClass: 'EQ3',
        params: [ 
            { key: 'low', label: 'Low Gain', type: 'knob', min: -40, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: 'dB', isSignal: true },
            { key: 'mid', label: 'Mid Gain', type: 'knob', min: -40, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: 'dB', isSignal: true },
            { key: 'high', label: 'High Gain', type: 'knob', min: -40, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: 'dB', isSignal: true },
            { key: 'lowFrequency', label: 'Low Freq', type: 'knob', min: 20, max: 800, step: 1, defaultValue: 400, decimals: 0, displaySuffix: 'Hz', isSignal: true }, 
            { key: 'highFrequency', label: 'High Freq', type: 'knob', min: 800, max: 18000, step: 100, defaultValue: 2500, decimals: 0, displaySuffix: 'Hz', isSignal: true }, 
        ]
    },
    Filter: { 
        displayName: 'Filter',
        toneClass: 'Filter',
        params: [
            { key: 'type', label: 'Type', type: 'select', options: ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'notch', 'allpass', 'peaking'], defaultValue: 'lowpass', isSignal: false },
            { key: 'frequency', label: 'Frequency', type: 'knob', min: 10, max: 20000, step: 1, defaultValue: 1000, decimals: 0, displaySuffix: 'Hz', isSignal: true },
            { key: 'rolloff', label: 'Rolloff', type: 'select', options: [-12, -24, -48, -96], defaultValue: -12, isSignal: false },
            { key: 'Q', label: 'Q', type: 'knob', min: 0.0001, max: 100, step: 0.01, defaultValue: 1, decimals: 2, isSignal: true },
            { key: 'gain', label: 'Gain (Shelf/Peak)', type: 'knob', min: -40, max: 40, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: 'dB', isSignal: true },
        ]
    },
    Gate: {
        displayName: 'Gate',
        toneClass: 'Gate',
        params: [
            { key: 'threshold', label: 'Threshold', type: 'knob', min: -100, max: 0, step: 1, defaultValue: -40, decimals: 0, displaySuffix: 'dB', isSignal: false }, 
            { key: 'smoothing', label: 'Smoothing', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.1, decimals: 2, isSignal: false }, 
        ]
    },
    Limiter: {
        displayName: 'Limiter',
        toneClass: 'Limiter',
        params: [ 
            { key: 'threshold', label: 'Threshold', type: 'knob', min: -100, max: 0, step: 1, defaultValue: -12, decimals: 0, displaySuffix: 'dB', isSignal: true },
        ]
    },
    Mono: {
        displayName: 'Mono',
        toneClass: 'Mono',
        params: [] 
    },
    MultibandCompressor: {
        displayName: 'Multiband Compressor',
        toneClass: 'MultibandCompressor',
        params: [
            { key: 'lowCrossover', label: 'Low Xover', type: 'knob', min: 60, max: 500, step: 10, defaultValue: 250, decimals: 0, displaySuffix: 'Hz', isSignal: false },
            { key: 'lowThreshold', label: 'Low Thresh', type: 'knob', min: -60, max: 0, step: 1, defaultValue: -24, decimals: 0, displaySuffix: 'dB', isSignal: false },
            { key: 'lowRatio', label: 'Low Ratio', type: 'knob', min: 1, max: 20, step: 0.5, defaultValue: 4, decimals: 1, isSignal: false },
            { key: 'lowMakeup', label: 'Low Makeup', type: 'knob', min: 0, max: 3, step: 0.1, defaultValue: 1, decimals: 2, isSignal: false },
            { key: 'midThreshold', label: 'Mid Thresh', type: 'knob', min: -60, max: 0, step: 1, defaultValue: -24, decimals: 0, displaySuffix: 'dB', isSignal: false },
            { key: 'midRatio', label: 'Mid Ratio', type: 'knob', min: 1, max: 20, step: 0.5, defaultValue: 4, decimals: 1, isSignal: false },
            { key: 'midMakeup', label: 'Mid Makeup', type: 'knob', min: 0, max: 3, step: 0.1, defaultValue: 1, decimals: 2, isSignal: false },
            { key: 'highCrossover', label: 'High Xover', type: 'knob', min: 1000, max: 10000, step: 100, defaultValue: 4000, decimals: 0, displaySuffix: 'Hz', isSignal: false },
            { key: 'highThreshold', label: 'High Thresh', type: 'knob', min: -60, max: 0, step: 1, defaultValue: -24, decimals: 0, displaySuffix: 'dB', isSignal: false },
            { key: 'highRatio', label: 'High Ratio', type: 'knob', min: 1, max: 20, step: 0.5, defaultValue: 4, decimals: 1, isSignal: false },
            { key: 'highMakeup', label: 'High Makeup', type: 'knob', min: 0, max: 3, step: 0.1, defaultValue: 1, decimals: 2, isSignal: false },
            { key: 'wet', label: 'Wet', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 1, decimals: 2, isSignal: false },
        ]
    },
    AIMastering: {
        displayName: 'AI Mastering',
        toneClass: 'AIMasteringEffect',
        params: [
            { key: 'targetLUFS', label: 'Target', type: 'knob', min: -30, max: -6, step: 1, defaultValue: -14, decimals: 0, displaySuffix: ' LUFS', isSignal: false },
            { key: 'threshold', label: 'Thresh', type: 'knob', min: -40, max: 0, step: 1, defaultValue: -20, decimals: 0, displaySuffix: ' dB', isSignal: false },
            { key: 'ratio', label: 'Ratio', type: 'knob', min: 1, max: 20, step: 0.5, defaultValue: 3, decimals: 1, isSignal: false },
            { key: 'eqLow', label: 'Low EQ', type: 'knob', min: -12, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: ' dB', isSignal: false },
            { key: 'eqMid', label: 'Mid EQ', type: 'knob', min: -12, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: ' dB', isSignal: false },
            { key: 'eqHigh', label: 'High EQ', type: 'knob', min: -12, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: ' dB', isSignal: false },
            { key: 'inputGain', label: 'Input', type: 'knob', min: 0.1, max: 3, step: 0.1, defaultValue: 1, decimals: 2, isSignal: false },
        ]
    },
};

// Merge ScatterEffect into AVAILABLE_EFFECTS
Object.assign(AVAILABLE_EFFECTS, ScatterEffectDefinition);

export function createEffectInstance(effectType, initialParams = {}) {
    if (typeof Tone === 'undefined') {
        console.error(`[EffectsRegistry createEffectInstance] Tone.js is not loaded. Cannot create effect "${effectType}".`);
        return null;
    }

    const definition = AVAILABLE_EFFECTS[effectType];
    if (!definition) {
        console.error(`[EffectsRegistry createEffectInstance] Effect type definition for "${effectType}" not found.`);
        return null;
    }
    if (!Tone[definition.toneClass]) {
        console.error(`[EffectsRegistry createEffectInstance] Tone class "Tone.${definition.toneClass}" not found for effect type "${effectType}".`);
        return null;
    }

    const paramsForInstance = {};
    if (definition.params && Array.isArray(definition.params)) {
        definition.params.forEach(pDef => {
            let valueToUse;
            const pathKeys = pDef.key.split('.');
            let tempInitialParam = initialParams;
            let paramFoundInInitial = true;

            for (const key of pathKeys) {
                if (tempInitialParam && typeof tempInitialParam === 'object' && tempInitialParam.hasOwnProperty(key)) {
                    tempInitialParam = tempInitialParam[key];
                } else {
                    paramFoundInInitial = false;
                    break;
                }
            }
            valueToUse = paramFoundInInitial ? tempInitialParam : pDef.defaultValue;

            let currentLevel = paramsForInstance;
            pathKeys.forEach((key, index) => {
                if (index === pathKeys.length - 1) {
                    currentLevel[key] = valueToUse;
                } else {
                    currentLevel[key] = currentLevel[key] || {};
                    currentLevel = currentLevel[key];
                }
            });
        });
    }

    if (initialParams.hasOwnProperty('wet') && definition.params.some(p => p.key === 'wet')) {
         if (!paramsForInstance.hasOwnProperty('wet')) { 
            paramsForInstance.wet = initialParams.wet;
         }
    }


    try {
        console.log(`[EffectsRegistry createEffectInstance] Attempting to instantiate Tone.${definition.toneClass} with params:`, JSON.parse(JSON.stringify(paramsForInstance)));
        const instance = new Tone[definition.toneClass](paramsForInstance);
        return instance;
    } catch (e) {
        console.warn(`[EffectsRegistry createEffectInstance] Error during primary instantiation of Tone.${definition.toneClass} with structured params (Error: ${e.message}). Attempting fallback... Params:`, JSON.parse(JSON.stringify(paramsForInstance)));
        try {
            const instance = new Tone[definition.toneClass]();
            if (typeof instance.set === 'function') {
                console.log(`[EffectsRegistry createEffectInstance Fallback] Using instance.set() for Tone.${definition.toneClass}`);
                instance.set(paramsForInstance);
            } else {
                console.log(`[EffectsRegistry createEffectInstance Fallback] Attempting manual parameter assignment for Tone.${definition.toneClass}`);
                for (const keyPath in paramsForInstance) {
                    if (Object.prototype.hasOwnProperty.call(paramsForInstance, keyPath)) {
                         const value = paramsForInstance[keyPath];
                         const keys = keyPath.split('.');
                         let target = instance;
                         let paramDefForPath = definition.params.find(p => p.key === keyPath);

                         for (let i = 0; i < keys.length - 1; i++) {
                             if (target && target.hasOwnProperty(keys[i])) {
                                 target = target[keys[i]];
                             } else {
                                 console.warn(`[EffectsRegistry Fallback] Path "${keys.slice(0, i + 1).join('.')}" not found on instance of Tone.${definition.toneClass}`);
                                 target = null; 
                                 break;
                             }
                         }

                         if (target && typeof target[keys[keys.length-1]] !== 'undefined') {
                              const finalKey = keys[keys.length-1];
                              if (target[finalKey] && typeof target[finalKey].value !== 'undefined' && paramDefForPath?.isSignal) {
                                 target[finalKey].value = value;
                                 console.log(`[EffectsRegistry Fallback] Set signal ${keyPath}.value = ${value}`);
                              } else {
                                 target[finalKey] = value;
                                 console.log(`[EffectsRegistry Fallback] Set direct property ${keyPath} = ${value}`);
                              }
                         } else if (target) {
                            console.warn(`[EffectsRegistry Fallback] Property "${keys[keys.length-1]}" not found on target for path "${keyPath}" on Tone.${definition.toneClass}. Target object:`, target);
                         }
                    }
                }
            }
            return instance;
        } catch (e2) {
            console.error(`[EffectsRegistry createEffectInstance] CRITICAL: Fallback instantiation for Tone.${definition.toneClass} also failed:`, e2.message, ". Params attempted:", JSON.parse(JSON.stringify(paramsForInstance)));
            return null;
        }
    }
}

export function getEffectDefaultParams(effectType) {
    const definition = AVAILABLE_EFFECTS[effectType];
    if (!definition || !definition.params || !Array.isArray(definition.params)) {
        if (!definition) console.warn(`[EffectsRegistry getEffectDefaultParams] No definition found for effect type: ${effectType}`);
        return {};
    }
    const defaults = {};
    definition.params.forEach(pDef => {
        const keys = pDef.key.split('.');
        let currentLevel = defaults;
        keys.forEach((key, index) => {
            if (index === keys.length - 1) {
                currentLevel[key] = pDef.defaultValue;
            } else {
                currentLevel[key] = currentLevel[key] || {};
                currentLevel = currentLevel[key];
            }
        });
    });
    return defaults;
}

export function getEffectParamDefinitions(effectType) {
    const definition = AVAILABLE_EFFECTS[effectType];
    if (!definition) {
        console.warn(`[EffectsRegistry getEffectParamDefinitions] No definition found for effect type: ${effectType}`);
        return [];
    }
    return definition.params || [];
}

// Custom AudioWorklet-based Effect for VST Plugin Support
// Architecture for loading WebAudio plugins via AudioWorklet
// Users can replace the worklet code with actual VST plugin processing code compiled to WASM
class CustomEffect extends Tone.Gain {
    constructor(initialParams = {}) {
        super(initialParams.gain || 1);
        this._workletNode = null;
        this._isWorkletLoaded = false;
        this._frequency = initialParams.frequency || 440;
        this._wet = initialParams.wet || 1;
        
        this._workletCode = `
            class VSTProcessor extends AudioWorkletProcessor {
                static get parameterDescriptors() {
                    return [
                        { name: 'gain', defaultValue: 1, minValue: 0, maxValue: 2 },
                        { name: 'wet', defaultValue: 1, minValue: 0, maxValue: 1 }
                    ];
                }
                
                process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    const output = outputs[0];
                    if (!input || !input[0]) return true;
                    
                    const gain = parameters.gain[0] || 1;
                    const wet = parameters.wet[0] || 1;
                    
                    for (let channel = 0; channel < input.length; channel++) {
                        const inputChannel = input[channel];
                        const outputChannel = output[channel];
                        for (let i = 0; i < inputChannel.length; i++) {
                            const dry = inputChannel[i];
                            const wetSignal = Math.tanh(dry * gain);
                            outputChannel[i] = dry * (1 - wet) + wetSignal * wet;
                        }
                    }
                    return true;
                }
            }
            registerProcessor('vst-processor', VSTProcessor);
        `;
        
        this._initWorklet();
    }
    
    async _initWorklet() {
        try {
            const blob = new Blob([this._workletCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            await Tone.context.audioWorklet.addModule(url);
            this._workletNode = new AudioWorkletNode(Tone.context, 'vst-processor');
            this._isWorkletLoaded = true;
            // Reconnect: input -> worklet -> output (bypass Tone.Gain chain when worklet active)
            this.disconnect();
            this.connect(this._workletNode);
            this._workletNode.connect(Tone.context.destination);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.warn('[CustomEffect] AudioWorklet not supported, using fallback Gain');
            this._isWorkletLoaded = false;
        }
    }
    
    get isWorkletLoaded() { return this._isWorkletLoaded; }
    
    dispose() {
        if (this._workletNode) {
            this._workletNode.disconnect();
            this._workletNode = null;
        }
        super.dispose();
    }
}

// Register CustomEffect on Tone namespace so createEffectInstance can find it
if (typeof Tone !== 'undefined') {
    Tone.CustomEffect = CustomEffect;
}

// Export the CustomEffect class globally
if (typeof window !== 'undefined') {
    window.CustomEffect = CustomEffect;
}
