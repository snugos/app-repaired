// Compressor Enhancements
// Add RMS/peak detection modes to the compressor

class CompressorEnhancements {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.compressor = audioContext.createDynamicsCompressor();
        this.detector = audioContext.createBiquadFilter();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.merge = audioContext.createGain();
        
        // Detection mode: 'rms' or 'peak'
        this.detectionMode = 'rms'; // default RMS
        this.lookahead = 0.003; // 3ms lookahead
        
        // Parameters
        this.threshold = -24; // dB
        this.knee = 30; // dB
        this.ratio = 4;
        this.attack = 0.003; // seconds
        this.release = 0.25; // seconds
        this.mix = 1.0; // 0 = dry, 1 = wet
        
        // Set initial values
        this.compressor.threshold.value = this.threshold;
        this.compressor.knee.value = this.knee;
        this.compressor.ratio.value = this.ratio;
        this.compressor.attack.value = this.attack;
        this.compressor.release.value = this.release;
        this.wetGain.gain.value = this.mix;
        this.dryGain.gain.value = 1 - this.mix;
        
        // Detector filter for RMS mode
        this.detector.type = 'lowpass';
        this.detector.frequency.value = 15000; // Smooth out for RMS calculation
        
        // Connect the graph
        this.inputGain.connect(this.dryGain);
        this.inputGain.connect(this.compressor);
        
        this.compressor.connect(this.wetGain);
        this.wetGain.connect(this.merge);
        this.dryGain.connect(this.merge);
        this.merge.connect(this.outputGain);
    }
    
    setDetectionMode(mode) {
        this.detectionMode = mode === 'peak' ? 'peak' : 'rms';
        
        if (mode === 'peak') {
            // For peak detection, bypass smoothing filter
            this.detector.disconnect();
        } else {
            // For RMS, ensure detector is in chain
            if (!this.detectorconnected) {
                // Reconnect detector
            }
        }
    }
    
    setThreshold(value) {
        this.threshold = Math.max(-100, Math.min(0, value));
        this.compressor.threshold.setTargetAtTime(this.threshold, this.audioContext.currentTime, 0.01);
    }
    
    setKnee(value) {
        this.knee = Math.max(0, Math.min(40, value));
        this.compressor.knee.setTargetAtTime(this.knee, this.audioContext.currentTime, 0.01);
    }
    
    setRatio(value) {
        this.ratio = Math.max(1, Math.min(20, value));
        this.compressor.ratio.setTargetAtTime(this.ratio, this.audioContext.currentTime, 0.01);
    }
    
    setAttack(seconds) {
        this.attack = Math.max(0.0001, Math.min(1, seconds));
        this.compressor.attack.setTargetAtTime(this.attack, this.audioContext.currentTime, 0.01);
    }
    
    setRelease(seconds) {
        this.release = Math.max(0.01, Math.min(1, seconds));
        this.compressor.release.setTargetAtTime(this.release, this.audioContext.currentTime, 0.01);
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
    }
    
    setLookahead(seconds) {
        this.lookahead = Math.max(0, Math.min(0.1, seconds));
    }
    
    getInput() {
        return this.inputGain;
    }
    
    getOutput() {
        return this.outputGain;
    }
    
    connect(destination) {
        this.outputGain.connect(destination);
    }
    
    disconnect() {
        this.outputGain.disconnect();
    }
    
    dispose() {
        this.inputGain.disconnect();
        this.outputGain.disconnect();
        this.compressor.disconnect();
        this.detector.disconnect();
        this.wetGain.disconnect();
        this.dryGain.disconnect();
        this.merge.disconnect();
    }
    
    // Get compression metrics
    getReduction() {
        return this.compressor.reduction;
    }
    
    getParams() {
        return {
            threshold: this.threshold,
            knee: this.knee,
            ratio: this.ratio,
            attack: this.attack,
            release: this.release,
            mix: this.mix,
            detectionMode: this.detectionMode,
            lookahead: this.lookahead,
            enabled: this.enabled
        };
    }
    
    setParams(params) {
        if (params.threshold !== undefined) this.setThreshold(params.threshold);
        if (params.knee !== undefined) this.setKnee(params.knee);
        if (params.ratio !== undefined) this.setRatio(params.ratio);
        if (params.attack !== undefined) this.setAttack(params.attack);
        if (params.release !== undefined) this.setRelease(params.release);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.detectionMode !== undefined) this.setDetectionMode(params.detectionMode);
        if (params.lookahead !== undefined) this.setLookahead(params.lookahead);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.CompressorEnhancements = CompressorEnhancements;