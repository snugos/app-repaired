// Tape Echo Effect
// Tape-style echo with natural degradation and saturation

class TapeEcho {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.delay = audioContext.createDelay(5.0);
        this.feedback = audioContext.createGain();
        this.tapeSaturation = audioContext.createWaveshaper();
        this.highCutFilter = audioContext.createBiquadFilter();
        this.lowCutFilter = audioContext.createBiquadFilter();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.merge = audioContext.createGain();
        
        // Parameters
        this.delayTime = 0.5; // seconds
        this.feedbackAmount = 0.5; // 0-1
        this.mix = 0.4; // 0 = dry, 1 = wet
        this.tapeSaturationAmount = 0.3; // 0-1
        this.highCutFreq = 5000; // Hz
        this.lowCutFreq = 200; // Hz
        
        // Set initial values
        this.delay.delayTime.value = this.delayTime;
        this.feedback.gain.value = this.feedbackAmount;
        this.wetGain.gain.value = this.mix;
        this.dryGain.gain.value = 1 - this.mix;
        
        // Configure tape saturation (soft clipping curve)
        this.tapeSaturation.curve = this.createTapeCurve(tapeSaturationAmount);
        this.tapeSaturation.oversample = '4x';
        
        // Configure filters
        this.highCutFilter.type = 'lowpass';
        this.highCutFilter.frequency.value = this.highCutFreq;
        this.highCutFilter.Q.value = 0.5;
        
        this.lowCutFilter.type = 'highpass';
        this.lowCutFilter.frequency.value = this.lowCutFreq;
        this.lowCutFilter.Q.value = 0.5;
        
        // Connect the graph
        // Input → Split → Dry → Merge → Output
        //          └→ Delay → LowCut → TapeSat → HighCut → Wet → Merge
        //          └───────────feedback───────────┘
        
        this.inputGain.connect(this.dryGain);
        this.inputGain.connect(this.delay);
        
        this.delay.connect(this.lowCutFilter);
        this.lowCutFilter.connect(this.tapeSaturation);
        this.tapeSaturation.connect(this.highCutFilter);
        this.highCutFilter.connect(this.wetGain);
        this.wetGain.connect(this.merge);
        
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        
        this.dryGain.connect(this.merge);
        this.merge.connect(this.outputGain);
    }
    
    createTapeCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Soft clipping tape simulation
            curve[i] = ((3 + amount * 10) * x * 20 * deg) / (Math.PI + amount * 10 * Math.abs(x));
        }
        
        return curve;
    }
    
    setDelayTime(seconds) {
        this.delayTime = Math.max(0.01, Math.min(5, seconds));
        this.delay.delayTime.setTargetAtTime(this.delayTime, this.audioContext.currentTime, 0.01);
    }
    
    setFeedback(value) {
        this.feedbackAmount = Math.max(0, Math.min(0.95, value));
        this.feedback.gain.setTargetAtTime(this.feedbackAmount, this.audioContext.currentTime, 0.01);
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
    }
    
    setTapeSaturation(amount) {
        this.tapeSaturationAmount = Math.max(0, Math.min(1, amount));
        this.tapeSaturation.curve = this.createTapeCurve(this.tapeSaturationAmount);
    }
    
    setHighCutFreq(freq) {
        this.highCutFreq = Math.max(1000, Math.min(20000, freq));
        this.highCutFilter.frequency.setTargetAtTime(this.highCutFreq, this.audioContext.currentTime, 0.01);
    }
    
    setLowCutFreq(freq) {
        this.lowCutFreq = Math.max(20, Math.min(1000, freq));
        this.lowCutFilter.frequency.setTargetAtTime(this.lowCutFreq, this.audioContext.currentTime, 0.01);
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
        this.delay.disconnect();
        this.feedback.disconnect();
        this.wetGain.disconnect();
        this.dryGain.disconnect();
        this.merge.disconnect();
        this.tapeSaturation.disconnect();
        this.highCutFilter.disconnect();
        this.lowCutFilter.disconnect();
    }
    
    getParams() {
        return {
            delayTime: this.delayTime,
            feedback: this.feedbackAmount,
            mix: this.mix,
            tapeSaturation: this.tapeSaturationAmount,
            highCutFreq: this.highCutFreq,
            lowCutFreq: this.lowCutFreq,
            enabled: this.enabled
        };
    }
    
    setParams(params) {
        if (params.delayTime !== undefined) this.setDelayTime(params.delayTime);
        if (params.feedback !== undefined) this.setFeedback(params.feedback);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.tapeSaturation !== undefined) this.setTapeSaturation(params.tapeSaturation);
        if (params.highCutFreq !== undefined) this.setHighCutFreq(params.highCutFreq);
        if (params.lowCutFreq !== undefined) this.setLowCutFreq(params.lowCutFreq);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.TapeEcho = TapeEcho;