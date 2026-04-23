// js/AudioPhaseMeter.js - Audio Phase Correlation Meter
// Displays phase correlation from -1 (out of phase) to +1 (in phase)

let phaseAnalyserLeft = null;
let phaseAnalyserRight = null;
let splitter = null;
let masterInputConnected = false;

// Correlation buffer
let leftBuffer = null;
let rightBuffer = null;
const BUFFER_SIZE = 2048;

/**
 * Initialize the phase meter with stereo analysis nodes.
 * @param {Object} masterGainNode - The master gain node to analyze
 */
export function initPhaseMeter(masterGainNode) {
    if (typeof Tone === 'undefined') {
        console.warn('[PhaseMeter] Tone.js not loaded');
        return false;
    }

    try {
        // Create waveform analysers for left and right channels
        phaseAnalyserLeft = new Tone.Waveform(1024);
        phaseAnalyserRight = new Tone.Waveform(1024);
        
        // Create channel splitter to separate stereo
        splitter = new Tone.ChannelSplitter(' stereo');
        
        // Create buffers for correlation calculation
        leftBuffer = new Float32Array(BUFFER_SIZE);
        rightBuffer = new Float32Array(BUFFER_SIZE);
        
        // Connect: masterGain -> splitter -> analysers
        if (masterGainNode) {
            masterGainNode.connect(splitter);
            splitter.connect(phaseAnalyserLeft, 0);
            splitter.connect(phaseAnalyserRight, 1);
            masterInputConnected = true;
        }
        
        console.log('[PhaseMeter] Initialized successfully');
        return true;
    } catch (e) {
        console.error('[PhaseMeter] Failed to initialize:', e);
        return false;
    }
}

/**
 * Reconnect the phase meter to a new master gain node.
 * @param {Object} masterGainNode - The master gain node
 */
export function reconnectPhaseMeter(masterGainNode) {
    if (splitter && masterGainNode) {
        try {
            masterGainNode.connect(splitter);
            masterInputConnected = true;
        } catch (e) {
            console.warn('[PhaseMeter] Error reconnecting:', e);
        }
    }
}

/**
 * Calculate the correlation coefficient between two signals.
 * @param {Float32Array} left - Left channel data
 * @param {Float32Array} right - Right channel data
 * @returns {number} Correlation from -1 to +1
 */
function calculateCorrelation(left, right) {
    if (!left || !right || left.length === 0 || right.length === 0) {
        return 0;
    }
    
    const n = Math.min(left.length, right.length);
    
    // Calculate means
    let sumLeft = 0, sumRight = 0;
    for (let i = 0; i < n; i++) {
        sumLeft += left[i];
        sumRight += right[i];
    }
    const meanLeft = sumLeft / n;
    const meanRight = sumRight / n;
    
    // Calculate correlation coefficient
    let numerator = 0;
    let denomLeft = 0;
    let denomRight = 0;
    
    for (let i = 0; i < n; i++) {
        const l = left[i] - meanLeft;
        const r = right[i] - meanRight;
        numerator += l * r;
        denomLeft += l * l;
        denomRight += r * r;
    }
    
    const denominator = Math.sqrt(denomLeft * denomRight);
    
    if (denominator === 0) return 0;
    return numerator / denominator;
}

/**
 * Get the current phase correlation value.
 * @returns {number} Correlation from -1 (out of phase) to +1 (in phase)
 */
export function getPhaseCorrelation() {
    try {
        if (!phaseAnalyserLeft || !phaseAnalyserRight) {
            return 0;
        }
        
        const leftData = phaseAnalyserLeft.getValue();
        const rightData = phaseAnalyserRight.getValue();
        
        if (!leftData || !rightData) return 0;
        
        return calculateCorrelation(leftData, rightData);
    } catch (e) {
        return 0;
    }
}

/**
 * Check if the phase meter is initialized.
 * @returns {boolean}
 */
export function isPhaseMeterInitialized() {
    return phaseAnalyserLeft !== null && phaseAnalyserRight !== null;
}

/**
 * Dispose of phase meter resources.
 */
export function disposePhaseMeter() {
    try {
        if (phaseAnalyserLeft) {
            phaseAnalyserLeft.dispose();
            phaseAnalyserLeft = null;
        }
        if (phaseAnalyserRight) {
            phaseAnalyserRight.dispose();
            phaseAnalyserRight = null;
        }
        if (splitter) {
            splitter.dispose();
            splitter = null;
        }
        leftBuffer = null;
        rightBuffer = null;
        masterInputConnected = false;
    } catch (e) {
        console.warn('[PhaseMeter] Error disposing:', e);
    }
}