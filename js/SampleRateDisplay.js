// js/SampleRateDisplay.js - Sample Rate Display in Status Bar

/**
 * Gets the current audio sample rate.
 * @returns {number} Sample rate in Hz (e.g., 44100, 48000)
 */
export function getSampleRate() {
    if (typeof Tone !== 'undefined' && Tone.context) {
        return Tone.context.sampleRate;
    }
    // Fallback: try to get from AudioContext directly
    if (typeof AudioContext !== 'undefined') {
        const ctx = new AudioContext();
        const rate = ctx.sampleRate;
        ctx.close();
        return rate;
    }
    return 0;
}

/**
 * Gets the sample rate formatted as a human-readable string.
 * @returns {string} Formatted sample rate (e.g., "48.0 kHz")
 */
export function getSampleRateFormatted() {
    const rate = getSampleRate();
    if (rate === 0) return 'N/A';
    if (rate >= 1000) {
        return `${(rate / 1000).toFixed(1)} kHz`;
    }
    return `${rate} Hz`;
}

/**
 * Updates the sample rate display in the status bar.
 */
export function updateSampleRateDisplay() {
    const el = document.getElementById('statusSampleRateValue');
    if (el) {
        el.textContent = getSampleRateFormatted();
    }
}

/**
 * Initializes the sample rate display in the status bar.
 * Adds the display element if not already present.
 */
export function initSampleRateDisplay() {
    // Check if element already exists
    if (document.getElementById('statusSampleRateValue')) {
        return;
    }

    // Find the status bar
    const statusBar = document.getElementById('statusBar');
    if (!statusBar) {
        console.warn('[SampleRateDisplay] Status bar not found');
        return;
    }

    // Create sample rate display element
    const sampleRateDiv = document.createElement('div');
    sampleRateDiv.className = 'flex items-center gap-1 cursor-pointer hover:text-gray-300';
    sampleRateDiv.id = 'statusSampleRate';
    sampleRateDiv.title = 'Audio Sample Rate';
    sampleRateDiv.innerHTML = `
        <span class="text-gray-500">SR:</span>
        <span id="statusSampleRateValue" class="text-gray-400">--</span>
    `;

    // Insert after CPU (before the first separator)
    const cpuDiv = document.getElementById('statusCpu');
    if (cpuDiv && cpuDiv.nextSibling) {
        statusBar.insertBefore(sampleRateDiv, cpuDiv.nextSibling);
    } else {
        statusBar.insertBefore(sampleRateDiv, statusBar.firstChild);
    }

    // Update initial value
    updateSampleRateDisplay();
    console.log('[SampleRateDisplay] Initialized with sample rate:', getSampleRateFormatted());
}

/**
 * Starts periodic sample rate display updates.
 */
export function startSampleRateDisplayLoop() {
    // Update immediately
    updateSampleRateDisplay();
    
    // Update every 5 seconds
    setInterval(() => {
        updateSampleRateDisplay();
    }, 5000);
}