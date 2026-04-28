/**
 * BPM Nudge - Fine-tune project BPM by ±0.01 BPM increments
 * Adds micro-nudge buttons and keyboard shortcuts for precise tempo control
 */

let bpmNudgeInterval = null;
let bpmNudgeDirection = 0;

const NUDGE_STEP_FINE = 0.01;
const NUDGE_STEP_COARSE = 0.1;

/**
 * Nudge BPM by a specific amount
 * @param {number} amount - BPM change amount (can be negative)
 */
export function nudgeBPM(amount) {
    const currentBpm = Tone.Transport.bpm.value;
    const newBpm = Math.max(Constants.MIN_TEMPO, Math.min(Constants.MAX_TEMPO, currentBpm + amount));
    Tone.Transport.bpm.value = newBpm;
    
    // Update UI
    const tempoInput = document.getElementById('tempoGlobalInput');
    if (tempoInput) tempoInput.value = newBpm.toFixed(2);
    
    const taskbarDisplay = document.getElementById('taskbarTempoDisplay');
    if (taskbarDisplay) taskbarDisplay.textContent = `${newBpm.toFixed(2)} BPM`;
    
    localAppServices?.captureStateForUndo?.(`Tempo to ${newBpm.toFixed(2)}`);
    
    return newBpm;
}

/**
 * Start continuous nudge when button is held
 * @param {number} direction - 1 for up, -1 for down
 * @param {number} step - nudge amount per tick
 */
export function startBPMNudge(direction, step = NUDGE_STEP_FINE) {
    stopBPMNudge();
    bpmNudgeDirection = direction;
    
    // Immediate first nudge
    nudgeBPM(direction * step);
    
    // Then continuous nudges
    bpmNudgeInterval = setInterval(() => {
        nudgeBPM(direction * step);
    }, 80);
}

/**
 * Stop continuous BPM nudge
 */
export function stopBPMNudge() {
    if (bpmNudgeInterval) {
        clearInterval(bpmNudgeInterval);
        bpmNudgeInterval = null;
    }
    bpmNudgeDirection = 0;
}

/**
 * Nudge BPM by fine amount (+/- 0.01)
 */
export function nudgeBPMFineUp() {
    nudgeBPM(NUDGE_STEP_FINE);
}

export function nudgeBPMFineDown() {
    nudgeBPM(-NUDGE_STEP_FINE);
}

/**
 * Nudge BPM by coarse amount (+/- 0.1)
 */
export function nudgeBPMCoarseUp() {
    nudgeBPM(NUDGE_STEP_COARSE);
}

export function nudgeBPMCoarseDown() {
    nudgeBPM(-NUDGE_STEP_COARSE);
}

/**
 * Set BPM to a specific value
 * @param {number} bpm 
 */
export function setBPM(bpm) {
    const newBpm = Math.max(Constants.MIN_TEMPO, Math.min(Constants.MAX_TEMPO, parseFloat(bpm) || 120));
    Tone.Transport.bpm.value = newBpm;
    
    const tempoInput = document.getElementById('tempoGlobalInput');
    if (tempoInput) tempoInput.value = newBpm.toFixed(2);
    
    const taskbarDisplay = document.getElementById('taskbarTempoDisplay');
    if (taskbarDisplay) taskbarDisplay.textContent = `${newBpm.toFixed(2)} BPM`;
    
    return newBpm;
}

/**
 * Get current BPM
 */
export function getBPM() {
    return Tone.Transport.bpm.value;
}

// Make available globally for event handlers
window.BPMNudge = {
    nudgeBPMFineUp,
    nudgeBPMFineDown,
    nudgeBPMCoarseUp,
    nudgeBPMCoarseDown,
    startBPMNudge,
    stopBPMNudge,
    setBPM,
    getBPM,
    NUDGE_STEP_FINE,
    NUDGE_STEP_COARSE
};

console.log('[BPMNudge] Module loaded');
