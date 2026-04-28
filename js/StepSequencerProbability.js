// js/StepSequencerProbability.js - Per-Step Probability for Step Sequencer
// Adds configurable probability (0-100%) to each step for generative pattern creation

let localAppServices = null;

// Default probability for each step (100% = always triggers)
const DEFAULT_STEP_PROBABILITY = 1.0;

// Extended sequence data structure with probability per step
// Sequence data format: [row][step] = { note, velocity, probability, ... }
let extendedSequences = new Map(); // sequenceId -> Map<"row_step" -> probability>

/**
 * Initialize the Step Sequencer Probability module.
 * @param {Object} appServices - Application services
 */
export function initStepSequencerProbability(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[StepSequencerProbability] Module initialized');
}

/**
 * Get the probability for a specific step in a sequence.
 * @param {number|string} sequenceId - The sequence ID
 * @param {number} row - The row index
 * @param {number} step - The step index
 * @returns {number} Probability (0-1)
 */
export function getStepProbability(sequenceId, row, step) {
    if (!extendedSequences.has(sequenceId)) {
        return DEFAULT_STEP_PROBABILITY;
    }
    const key = `${row}_${step}`;
    return extendedSequences.get(sequenceId).get(key) ?? DEFAULT_STEP_PROBABILITY;
}

/**
 * Set the probability for a specific step.
 * @param {number|string} sequenceId - The sequence ID
 * @param {number} row - The row index
 * @param {number} step - The step index
 * @param {number} probability - Probability value (0-1)
 */
export function setStepProbability(sequenceId, row, step, probability) {
    if (!extendedSequences.has(sequenceId)) {
        extendedSequences.set(sequenceId, new Map());
    }
    const key = `${row}_${step}`;
    const prob = Math.max(0, Math.min(1, probability));
    extendedSequences.get(sequenceId).set(key, prob);
    console.log(`[StepSequencerProbability] Set sequence ${sequenceId} row ${row} step ${step} probability: ${(prob * 100).toFixed(0)}%`);
}

/**
 * Clear all probability data for a sequence.
 * @param {number|string} sequenceId - The sequence ID
 */
export function clearSequenceProbability(sequenceId) {
    extendedSequences.delete(sequenceId);
    console.log(`[StepSequencerProbability] Cleared probability data for sequence ${sequenceId}`);
}

/**
 * Check if a step should trigger based on probability.
 * @param {number|string} sequenceId - The sequence ID
 * @param {number} row - The row index
 * @param {number} step - The step index
 * @returns {boolean} True if the step should trigger
 */
export function shouldTriggerStep(sequenceId, row, step) {
    const probability = getStepProbability(sequenceId, row, step);
    return Math.random() < probability;
}

/**
 * Get all probabilities for a sequence as an array.
 * @param {number|string} sequenceId - The sequence ID
 * @param {number} numRows - Number of rows
 * @param {number} numSteps - Number of steps
 * @returns {Array<Array<number>>} 2D array of probabilities
 */
export function getSequenceProbabilities(sequenceId, numRows, numSteps) {
    const probabilities = [];
    for (let r = 0; r < numRows; r++) {
        const row = [];
        for (let s = 0; s < numSteps; s++) {
            row.push(getStepProbability(sequenceId, r, s));
        }
        probabilities.push(row);
    }
    return probabilities;
}

/**
 * Set probabilities for an entire sequence from a 2D array.
 * @param {number|string} sequenceId - The sequence ID
 * @param {Array<Array<number>>} data - 2D array of probabilities
 */
export function setSequenceProbabilities(sequenceId, data) {
    clearSequenceProbability(sequenceId);
    if (!Array.isArray(data)) return;
    
    for (let r = 0; r < data.length; r++) {
        if (!Array.isArray(data[r])) continue;
        for (let s = 0; s < data[r].length; s++) {
            if (data[r][s] !== DEFAULT_STEP_PROBABILITY) {
                setStepProbability(sequenceId, r, s, data[r][s]);
            }
        }
    }
}

/**
 * Process sequence data with probability filtering.
 * Returns a new data array with steps filtered based on probability.
 * @param {Array<Array>} sequenceData - Original sequence data
 * @param {number|string} sequenceId - The sequence ID
 * @returns {Array<Array>} Filtered sequence data with probability applied
 */
export function applyProbabilityToSequenceData(sequenceData, sequenceId) {
    if (!sequenceData || !Array.isArray(sequenceData)) return sequenceData;
    
    return sequenceData.map((row, rowIndex) => {
        return row.map((step, stepIndex) => {
            if (!step) return step;
            const shouldPlay = shouldTriggerStep(sequenceId, rowIndex, stepIndex);
            // Return null to indicate step should not play, or keep original
            return shouldPlay ? step : null;
        });
    });
}

/**
 * Get probability display color for UI.
 * @param {number} probability - Probability value (0-1)
 * @returns {string} CSS color string
 */
export function getProbabilityColor(probability) {
    if (probability >= 1.0) return ''; // No special color for 100%
    if (probability >= 0.75) return 'rgba(34, 197, 94, 0.4)'; // Green for high
    if (probability >= 0.5) return 'rgba(234, 179, 8, 0.4)'; // Yellow for medium
    if (probability >= 0.25) return 'rgba(249, 115, 22, 0.4)'; // Orange for low
    return 'rgba(239, 68, 68, 0.4)'; // Red for very low
}

// Export for use by other modules
window.getStepProbability = getStepProbability;
window.setStepProbability = setStepProbability;
window.shouldTriggerStep = shouldTriggerStep;
window.getSequenceProbabilities = getSequenceProbabilities;
window.setSequenceProbabilities = setSequenceProbabilities;
window.applyProbabilityToSequenceData = applyProbabilityToSequenceData;
window.getProbabilityColor = getProbabilityColor;