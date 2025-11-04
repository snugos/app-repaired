// js/daw/effectsRegistry.js - Definitions for modular effects

export const synthEngineControlDefinitions = {
    MonoSynth: [
        { idPrefix: 'portamento', label: 'Porta', type: 'knob', min: 0, max: 0.2, step: 0.001, defaultValue: 0.01, decimals: 3, path: 'portamento' },
        { idPrefix: 'oscType', label: 'Osc Type', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle', 'pulse', 'pwm'], defaultValue: 'sine', path: 'oscillator.type' },
        { idPrefix: 'envAttack', label: 'Attack', type: 'knob', min: 0.001, max: 2, step: 0.001, defaultValue: 0.005, decimals: 3, path: 'envelope.attack' },
        { idPrefix: 'envDecay', label: 'Decay', type: 'knob', min: 0.01, max: 2, step: 0.01, defaultValue: 2, decimals: 2, path: 'envelope.decay' },
        { idPrefix: 'envSustain', label: 'Sustain', type: 'knob', min: 0, max: 1, step: 0.01, defaultValue: 0, decimals: 2, path: 'envelope.sustain' },
        { idPrefix: 'envRelease', label: 'Release', type: 'knob', min: 0.01, max: 5, step: 0.01, defaultValue: 1, decimals: 2, path: 'envelope.release' },
        { idPrefix: 'filtType', label: 'Filt Type', type: 'select', options: ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'notch', 'allpass', 'peaking'], defaultValue: 'lowpass' },
        { idPrefix: 'filtFreq', label: 'Filt Freq', type: 'knob', min: 20, max: 20000, step: 10, defaultValue: 1000, decimals: 0, displaySuffix: 'Hz', isSignal: true },
        { idPrefix: 'filtQ', label: 'Filt Q', type: 'knob', min: 0.1, max: 20, step: 0.1, defaultValue: 1, decimals: 1, isSignal: true },
        { idPrefix: 'filtEnvAttack', label: 'F.Atk', type: 'knob', min:0.001, max:2, step:0.001, defaultValue:0.06, decimals:3, path:'filterEnvelope.attack'},
        { idPrefix: 'filtEnvDecay', label: 'F.Dec', type: 'knob', min:0.01, max:2, step:0.01, defaultValue:0.2, decimals:2, path:'filterEnvelope.decay'},
        { idPrefix: 'filtEnvSustain', label: 'F.Sus', type: 'knob', min:0, max:1, step:0.01, defaultValue:0.5, decimals:2, path:'filterEnvelope.sustain'},
        { idPrefix: 'filtEnvRelease', label: 'F.Rel', type: 'knob', min:0.01, max:5, step:0.01, defaultValue:2, decimals:2, path:'filterEnvelope.release'},
        { idPrefix: 'filtEnvBaseFreq', label: 'F.Base', type: 'knob', min:20, max:5000, step:1, defaultValue:200, decimals:0, path:'filterEnvelope.baseFrequency'},
        { idPrefix: 'filtEnvOctaves', label: 'F.Oct', type: 'knob', min:0, max:10, step:0.1, defaultValue:7, decimals:1, path:'filterEnvelope.octaves'},
    ]
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
        params: [] 
    },
};

export function createEffectInstance(effectType, initialParams = {}) {
    // Ensure Tone is accessed from the global scope or passed context
    // This is crucial for environments where modules might not have direct global 'Tone' access
    const ToneContext = window.Tone || {}; // Fallback in case window.Tone is not defined

    if (typeof ToneContext === 'undefined' || Object.keys(ToneContext).length === 0) { // Check if ToneContext is empty
        console.error(`[EffectsRegistry createEffectInstance] Tone.js is not loaded or accessible. Cannot create effect "${effectType}".`);
        return null;
    }

    const definition = AVAILABLE_EFFECTS[effectType];
    if (!definition) {
        console.error(`[EffectsRegistry createEffectInstance] Effect type definition for "${effectType}" not found.`);
        return null;
    }
    if (!ToneContext[definition.toneClass]) {
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

    // Explicitly handle 'wet' parameter if it exists in initialParams but not in definition.params hierarchy
    // This addresses a potential issue where 'wet' might be a top-level param but not part of a nested path in the definition
    if (initialParams.hasOwnProperty('wet') && !paramsForInstance.hasOwnProperty('wet')) { 
         paramsForInstance.wet = initialParams.wet;
    }


    try {
        console.log(`[EffectsRegistry createEffectInstance] Attempting to instantiate Tone.${definition.toneClass} with params:`, JSON.parse(JSON.stringify(paramsForInstance)));
        const instance = new ToneContext[definition.toneClass](paramsForInstance);
        return instance;
    } catch (e) {
        console.warn(`[EffectsRegistry createEffectInstance] Error during primary instantiation of Tone.${definition.toneClass} with structured params (Error: ${e.message}). Attempting fallback... Params:`, JSON.parse(JSON.stringify(paramsForInstance)));
        try {
            // Fallback: Try instantiating without initial params, then set them
            const instance = new ToneContext[definition.toneClass]();
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
                         let paramDefForPath = definition.params.find(p => p.key === keyPath); // Find the param definition for 'isSignal'

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
                              // Check if it's a Tone.js Signal/Param and if it's explicitly marked as 'isSignal' in definition
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