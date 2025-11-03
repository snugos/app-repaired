// js/effectsRegistry.js - Definitions for modular effects

export const synthEngineControlDefinitions = {
    MonoSynth: [
        { idPrefix: 'portamento', label: 'Porta', type: 'knob', min: 0, max: 0.2, step: 0.001, defaultValue: 0.01, decimals: 3, path: 'portamento' },
        { idPrefix: 'oscType', label: 'Osc Type', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle', 'pulse', 'pwm'], defaultValue: 'sawtooth', path: 'oscillator.type' },
        { idPrefix: 'envAttack', label: 'Attack', type: 'knob', min: 0.001, max: 2, step: 0.001, defaultValue: 0.005, decimals: 3, path: 'envelope.attack' },
        { idPrefix: 'envDecay', label: 'Decay', type: 'knob', min: 0.01, max: 2, step: 0.01, defaultValue: 0.1, decimals: 2, path: 'envelope.decay' },
        { idPrefix: 'envSustain', label: 'Sustain', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0.9, decimals: 2, path: 'envelope.sustain' },
        { idPrefix: 'envRelease', label: 'Release', type: 'knob', min: 0.01, max: 5, step: 0.01, defaultValue: 1, decimals: 2, path: 'envelope.release' },
        { idPrefix: 'filtType', label: 'Filt Type', type: 'select', options: ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'notch', 'allpass', 'peaking'], defaultValue: 'lowpass', path: 'filter.type' },
        { idPrefix: 'filtFreq', label: 'Filt Freq', type: 'knob', min: 20, max: 20000, step: 1, defaultValue: 1000, decimals: 0, path: 'filter.frequency.value' },
        { idPrefix: 'filtQ', label: 'Filt Q', type: 'knob', min: 0.1, max: 20, step: 0.1, defaultValue: 1, decimals: 1, path: 'filter.Q.value' },
        { idPrefix: 'filtEnvAttack', label: 'F.Atk', type: 'knob', min:0.001, max:2, step:0.001, defaultValue:0.06, decimals:3, path:'filterEnvelope.attack'},
        { idPrefix: 'filtEnvDecay', label: 'F.Dec', type: 'knob', min:0.01, max:2, step:0.01, defaultValue:0.2, decimals:2, path:'filterEnvelope.decay'},
        { idPrefix: 'filtEnvSustain', label: 'F.Sus', type: 'knob', min:0, max:1, step:0.01, defaultValue:0.5, decimals:2, path:'filterEnvelope.sustain'},
        { idPrefix: 'filtEnvRelease', label: 'F.Rel', type: 'knob', min:0.01, max:5, step:0.01, defaultValue:2, decimals:2, path:'filterEnvelope.release'},
        { idPrefix: 'filtEnvBaseFreq', label: 'F.Base', type: 'knob', min:20, max:5000, step:1, defaultValue:200, decimals:0, path:'filterEnvelope.baseFrequency'},
        { idPrefix: 'filtEnvOctaves', label: 'F.Oct', type: 'knob', min:0, max:10, step:0.1, defaultValue:7, decimals:1, path:'filterEnvelope.octaves'},
    ]
    // Add other synth engine definitions here
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
        ]
    },
    EQ3: {
        displayName: '3-Band EQ',
        toneClass: 'EQ3',
        params: [
            { key: 'low', label: 'Low Gain', type: 'knob', min: -40, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: 'dB', isSignal: true },
            { key: 'mid', label: 'Mid Gain', type: 'knob', min: -40, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: 'dB', isSignal: true },
            { key: 'high', label: 'High Gain', type: 'knob', min: -40, max: 12, step: 0.5, defaultValue: 0, decimals: 1, displaySuffix: 'dB', isSignal: true },
            { key: 'lowFrequency', label: 'Low Freq', type: 'knob', min: 20, max: 800, step: 10, defaultValue: 400, decimals: 0, displaySuffix: 'Hz', isSignal: true },
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
        params: [] // Mono has no adjustable parameters
    },
};

export function createEffectInstance(effectType, initialParams = {}) {
    const definition = AVAILABLE_EFFECTS[effectType];
    if (!definition || typeof Tone === 'undefined' || !Tone[definition.toneClass]) {
        console.error(`Effect type "${effectType}" or Tone class "Tone.${definition?.toneClass}" not found.`);
        return null;
    }

    const paramsForInstance = {};
    if (definition.params) {
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

    if (initialParams.hasOwnProperty('wet') && !paramsForInstance.hasOwnProperty('wet') && definition.params.some(p => p.key === 'wet')) {
         paramsForInstance.wet = initialParams.wet;
    }

    try {
        const instance = new Tone[definition.toneClass](paramsForInstance);
        return instance;
    } catch (e) {
        console.error(`Error instantiating Tone.${definition.toneClass} with params:`, JSON.parse(JSON.stringify(paramsForInstance)), e);
        try {
            const instance = new Tone[definition.toneClass](); // Try with no params
            if (typeof instance.set === 'function') {
                instance.set(paramsForInstance);
            } else {
                // Manual assignment attempt for deeply nested params or non-signal params
                for (const keyPath in paramsForInstance) {
                    if (Object.hasOwnProperty.call(paramsForInstance, keyPath)) {
                         const value = paramsForInstance[keyPath];
                         const keys = keyPath.split('.');
                         let target = instance;
                         let paramDefForPath = definition.params.find(p => p.key === keyPath);
                         for (let i = 0; i < keys.length - 1; i++) {
                             target = target[keys[i]];
                             if (!target) break;
                         }
                         if (target && typeof target[keys[keys.length-1]] !== 'undefined') {
                              if (target[keys[keys.length-1]] && typeof target[keys[keys.length-1]].value !== 'undefined' && paramDefForPath?.isSignal) {
                                 target[keys[keys.length-1]].value = value;
                              } else {
                                 target[keys[keys.length-1]] = value;
                              }
                         }
                    }
                }
            }
            return instance;
        } catch (e2) {
            console.error(`Fallback instantiation for Tone.${definition.toneClass} also failed:`, e2);
            return null;
        }
    }
}

export function getEffectDefaultParams(effectType) {
    const definition = AVAILABLE_EFFECTS[effectType];
    if (!definition) return {};
    const defaults = {};
    if (definition.params) {
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
    }
    return defaults;
}

export function getEffectParamDefinitions(effectType) {
    return AVAILABLE_EFFECTS[effectType]?.params || [];
}
