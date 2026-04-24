// js/FormulaAutomation.js - Mathematical formula-based automation curves
/**
 * Formula Automation - Write mathematical formulas for automation curves
 * 
 * Supported functions:
 * - Basic: sin, cos, tan, abs, sqrt, log, exp, pow, floor, ceil, round
 * - Constants: pi, e
 * - Variables: t (time 0-1), t2 (time squared), t3 (time cubed)
 * - Special: ramp (linear ramp 0-1), tri (triangle wave), saw (sawtooth), sqr (square wave)
 * - Envelope: adsr (attack, decay, sustain, release)
 * 
 * Example formulas:
 *   sin(t * 2 * pi) * 0.5 + 0.5  // Sine wave 0-1
 *   t ^ 2                            // Quadratic ramp
 *   ramp(t, 0.2, 0.8)              // Linear ramp from 0.2 to 0.8
 *   adsr(t, 0.1, 0.2, 0.7, 0.2)    // ADSR envelope
 *   sin(t * 10) * 0.1 + (t * 0.5)  // Modulated signal
 */

import { midiToNoteName, noteNameToMidi } from './midiUtils.js';

/**
 * Formula presets for common automation curves
 */
const FORMULA_PRESETS = [
    { id: 'sine', name: 'Sine Wave', formula: 'sin(t * 2 * pi)', description: 'Smooth oscillating wave' },
    { id: 'cosine', name: 'Cosine Wave', formula: 'cos(t * 2 * pi)', description: 'Phase-shifted sine wave' },
    { id: 'ramp_up', name: 'Ramp Up', formula: 't', description: 'Linear increase from 0 to 1' },
    { id: 'ramp_down', name: 'Ramp Down', formula: '1 - t', description: 'Linear decrease from 1 to 0' },
    { id: 'triangle', name: 'Triangle Wave', formula: 'abs(tri(t, 1) * 2 - 1)', description: 'Linear up/down wave' },
    { id: 'sawtooth', name: 'Sawtooth', formula: 'saw(t, 1)', description: 'Ramping tooth wave' },
    { id: 'square', name: 'Square Wave', formula: 'sqr(t, 0.5)', description: 'Binary on/off wave' },
    { id: 'exponential', name: 'Exponential Rise', formula: '1 - exp(-t * 5)', description: 'Slow start, faster end' },
    { id: 'decay', name: 'Exponential Decay', formula: 'exp(-t * 3)', description: 'Fast start, slower end' },
    { id: 'bell', name: 'Bell Curve', formula: 'exp(-pow((t - 0.5) * 4, 2))', description: 'Bell-shaped envelope' },
    { id: 'adsr', name: 'ADSR', formula: 'adsr(t, 0.1, 0.1, 0.7, 0.2)', description: 'Attack-Decay-Sustain-Release' },
    { id: 's_curce', name: 'S-Curve', formula: 't * t * (3 - 2 * t)', description: 'Smooth ease in/out' },
    { id: 'bounce', name: 'Bounce', formula: 'abs(sin(t * pi * 2) * (1 - t))', description: 'Bouncing effect' },
    { id: 'wobble', name: 'Wobble', formula: 'sin(t * 10) * t * 0.5 + 0.5', description: 'Oscillation with decay' },
    { id: 'stepped', name: 'Stepped', formula: 'floor(t * 8) / 8', description: '8 discrete steps' },
];

/**
 * Parse and evaluate a formula string
 * @param {string} formula - The formula string
 * @param {number} t - Time value (0-1)
 * @param {Object} context - Additional context variables
 * @returns {number} Result value
 */
export function evaluateFormula(formula, t, context = {}) {
    try {
        // Constants
        const pi = Math.PI;
        const e = Math.E;
        
        // Time variables
        const t2 = t * t;
        const t3 = t * t * t;
        
        // Helper functions
        const abs = Math.abs;
        const sqrt = Math.sqrt;
        const log = Math.log;
        const log10 = Math.log10;
        const exp = Math.exp;
        const pow = Math.pow;
        const floor = Math.floor;
        const ceil = Math.ceil;
        const round = Math.round;
        const sin = Math.sin;
        const cos = Math.cos;
        const tan = Math.tan;
        const asin = Math.asin;
        const acos = Math.acos;
        const atan = Math.atan;
        const min = Math.min;
        const max = Math.max;
        const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
        
        // Triangle wave
        const tri = (time, freq) => {
            const x = (time * freq) % 1;
            return x < 0.5 ? x * 2 : 2 - x * 2;
        };
        
        // Sawtooth wave
        const saw = (time, freq) => {
            return (time * freq) % 1;
        };
        
        // Square wave
        const sqr = (time, duty) => {
            const x = (time * 1) % 1;
            return x < duty ? 1 : 0;
        };
        
        // Linear ramp
        const ramp = (time, start, end) => {
            return start + (end - start) * time;
        };
        
        // ADSR envelope
        const adsr = (time, attack, decay, sustain, release) => {
            if (time < attack) {
                return time / attack;
            } else if (time < attack + decay) {
                return 1 - ((time - attack) / decay) * (1 - sustain);
            } else if (time < 1 - release) {
                return sustain;
            } else {
                return sustain * (1 - (time - (1 - release)) / release);
            }
        };
        
        // Noise (pseudo-random)
        const noise = (seed = 0) => {
            const x = Math.sin(seed * 12.9898 + time * 78.233) * 43758.5453;
            return x - Math.floor(x);
        };
        
        // Random value
        const random = () => Math.random();
        
        // Lerp
        const lerp = (a, b, x) => a + (b - a) * x;
        
        // Evaluate the formula
        // eslint-disable-next-line no-new-func
        const result = new Function('t', 't2', 't3', 'pi', 'e', 'abs', 'sqrt', 'log', 'log10', 'exp', 'pow', 'floor', 'ceil', 'round', 
            'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'min', 'max', 'clamp', 'tri', 'saw', 'sqr', 'ramp', 'adsr', 'noise', 'random', 'lerp',
            `${formula}`)
            (t, t2, t3, pi, e, abs, sqrt, log, log10, exp, pow, floor, ceil, round, 
             sin, cos, tan, asin, acos, atan, min, max, clamp, tri, saw, sqr, ramp, adsr, noise, random, lerp,
             formula);
        
        return result;
    } catch (error) {
        console.warn(`[FormulaAutomation] Error evaluating formula: ${error.message}`);
        return 0;
    }
}

/**
 * Generate automation points from a formula
 * @param {string} formula - The formula string
 * @param {number} resolution - Number of points to generate
 * @param {Object} context - Additional context
 * @returns {Array<{time: number, value: number}>}
 */
export function generateAutomationPoints(formula, resolution = 100, context = {}) {
    const points = [];
    
    for (let i = 0; i <= resolution; i++) {
        const t = i / resolution;
        const value = evaluateFormula(formula, t, context);
        points.push({
            time: t,
            value: Math.max(0, Math.min(1, value)) // Clamp to 0-1
        });
    }
    
    return points;
}

/**
 * Evaluate formula at a specific time (for real-time automation)
 * @param {string} formula - The formula string
 * @param {number} currentTime - Current time (seconds)
 * @param {number} duration - Total duration (seconds)
 * @param {number} minValue - Minimum output value
 * @param {number} maxValue - Maximum output value
 * @returns {number} Scaled value
 */
export function evaluateFormulaAtTime(formula, currentTime, duration, minValue = 0, maxValue = 1) {
    const t = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const rawValue = evaluateFormula(formula, t);
    return minValue + (rawValue + 1) * 0.5 * (maxValue - minValue); // Map -1..1 to min..max
}

/**
 * Get all formula presets
 * @returns {Array<Object>}
 */
export function getFormulaPresets() {
    return [...FORMULA_PRESETS];
}

/**
 * Get a specific preset
 * @param {string} presetId
 * @returns {Object|null}
 */
export function getFormulaPreset(presetId) {
    return FORMULA_PRESETS.find(p => p.id === presetId) || null;
}

/**
 * Validate a formula string
 * @param {string} formula - The formula to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateFormula(formula) {
    if (!formula || typeof formula !== 'string') {
        return { valid: false, error: 'Formula must be a non-empty string' };
    }
    
    // Try to evaluate with t=0.5
    const result = evaluateFormula(formula, 0.5);
    
    if (isNaN(result) || !isFinite(result)) {
        return { valid: false, error: 'Formula produces invalid result' };
    }
    
    return { valid: true, error: null };
}

/**
 * Convert automation points to Tone.js automation events
 * @param {Array<{time: number, value: number}>} points - Automation points
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration of automation in seconds
 * @param {Object} param - Tone.js AudioParam to automate
 */
export function applyAutomationToParam(param, points, startTime = 0, duration = 4) {
    if (!param || !param.time) {
        console.warn('[FormulaAutomation] Invalid AudioParam');
        return;
    }
    
    const now = param.time ? Tone.now() : 0;
    
    points.forEach(point => {
        const time = now + startTime + (point.time * duration);
        const value = point.value;
        
        try {
            param.setValueAtTime(value, time);
        } catch (e) {
            console.warn(`[FormulaAutomation] Failed to set value at ${time}:`, e.message);
        }
    });
}

/**
 * Create an automation curve object for storage
 * @param {string} formula - The formula string
 * @param {string} name - Name for this automation curve
 * @param {Object} options - Additional options { min, max, duration, color }
 * @returns {Object}
 */
export function createFormulaAutomationCurve(formula, name, options = {}) {
    const validation = validateFormula(formula);
    
    if (!validation.valid) {
        throw new Error(`Invalid formula: ${validation.error}`);
    }
    
    return {
        id: `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name || 'Untitled Curve',
        formula: formula,
        type: 'formula',
        min: options.min ?? 0,
        max: options.max ?? 1,
        duration: options.duration ?? 4,
        color: options.color || '#6366f1',
        createdAt: new Date().toISOString()
    };
}

/**
 * Sample a formula automation curve at arbitrary times
 * @param {Object} curve - The automation curve object
 * @param {number} time - Time to sample (0-1 normalized)
 * @returns {number} Sampled value
 */
export function sampleFormulaAutomation(curve, time) {
    if (!curve || curve.type !== 'formula') {
        return 0;
    }
    
    const rawValue = evaluateFormula(curve.formula, time);
    return curve.min + (rawValue + 1) * 0.5 * (curve.max - curve.min);
}

export default {
    evaluateFormula,
    generateAutomationPoints,
    evaluateFormulaAtTime,
    getFormulaPresets,
    getFormulaPreset,
    validateFormula,
    applyAutomationToParam,
    createFormulaAutomationCurve,
    sampleFormulaAutomation
};
