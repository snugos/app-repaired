// BPM Tap Detector - Tap to set tempo
// Averages the last N taps to determine BPM

const TapTempo = (() => {
    let taps = [];
    const MAX_TAPS = 8;
    let tapTimeout = null;
    const TIMEOUT_MS = 3000; // Reset if no tap within 3 seconds

    function addTap(bpm = 120) {
        const now = Date.now();
        
        // Clear old timeout
        if (tapTimeout) clearTimeout(tapTimeout);
        
        // Reset if too long since last tap
        if (taps.length > 0 && now - taps[taps.length - 1] > TIMEOUT_MS) {
            taps = [];
        }
        
        taps.push(now);
        
        // Keep only last MAX_TAPS
        if (taps.length > MAX_TAPS) {
            taps.shift();
        }
        
        // Set timeout to reset
        tapTimeout = setTimeout(() => { taps = []; }, TIMEOUT_MS);
        
        // Need at least 2 taps to calculate
        if (taps.length < 2) return bpm;
        
        // Calculate average interval
        let totalInterval = 0;
        for (let i = 1; i < taps.length; i++) {
            totalInterval += taps[i] - taps[i - 1];
        }
        const avgInterval = totalInterval / (taps.length - 1);
        
        // Convert ms to BPM
        const detectedBpm = Math.round(60000 / avgInterval);
        
        // Clamp to reasonable range
        return Math.max(20, Math.min(300, detectedBpm));
    }
    
    function reset() {
        taps = [];
        if (tapTimeout) clearTimeout(tapTimeout);
        tapTimeout = null;
    }
    
    function getTapCount() {
        return taps.length;
    }
    
    function getLastInterval() {
        if (taps.length < 2) return null;
        return taps[taps.length - 1] - taps[taps.length - 2];
    }
    
    return { addTap, reset, getTapCount, getLastInterval };
})();

// Export for use
window.TapTempo = TapTempo;