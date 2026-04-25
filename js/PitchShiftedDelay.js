// Pitch-Shifted Delay Effect
// Delay effect with pitch shifting for sci-fi effects

class PitchShiftedDelay {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.delay = audioContext.createDelay(5.0);
        this.feedback = audioContext.createGain();
        this.pitchShift = audioContext.createPitchShifter(audioContext, 2048);
        this.pitchAmount = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.merge = audioContext.createGain();
        
        // Parameters
        this.delayTime = 0.3; // seconds
        this.feedbackAmount = 0.4; // 0-1
        this.pitchShiftCents = 700; // semitones (700 = 1 octave up)
        this.mix = 0.5; // 0 = dry, 1 = wet
        this.pitchMode = 'up'; // 'up' or 'down'
        
        // Set initial values
        this.delay.delayTime.value = this.delayTime;
        this.feedback.gain.value = this.feedbackAmount;
        this.pitchAmount.gain.value = this.pitchShiftCents / 1200; // normalized
        this.wetGain.gain.value = this.mix;
        this.dryGain.gain.value = 1 - this.mix;
        
        // Connect the graph
        // Input → Split → Dry → Merge
        //          └→ Delay → PitchShift → Wet → Merge → Output
        //          └───────────feedback───────────┘
        
        this.inputGain.connect(this.dryGain);
        this.inputGain.connect(this.delay);
        
        this.delay.connect(this.pitchShift);
        this.pitchShift.connect(this.wetGain);
        this.wetGain.connect(this.merge);
        
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        
        this.dryGain.connect(this.merge);
        this.merge.connect(this.outputGain);
    }
    
    setDelayTime(seconds) {
        this.delayTime = Math.max(0.01, Math.min(5, seconds));
        this.delay.delayTime.setTargetAtTime(this.delayTime, this.audioContext.currentTime, 0.01);
    }
    
    setFeedback(value) {
        this.feedbackAmount = Math.max(0, Math.min(0.95, value));
        this.feedback.gain.setTargetAtTime(this.feedbackAmount, this.audioContext.currentTime, 0.01);
    }
    
    setPitchShiftCents(cents) {
        this.pitchShiftCents = Math.max(-2400, Math.min(2400, cents));
        this.pitchAmount.gain.setTargetAtTime(this.pitchShiftCents / 1200, this.audioContext.currentTime, 0.01);
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
    }
    
    setPitchMode(mode) {
        this.pitchMode = mode === 'down' ? 'down' : 'up';
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
        this.pitchShift.disconnect();
        this.pitchAmount.disconnect();
    }
    
    getParams() {
        return {
            delayTime: this.delayTime,
            feedback: this.feedbackAmount,
            pitchShiftCents: this.pitchShiftCents,
            mix: this.mix,
            pitchMode: this.pitchMode,
            enabled: this.enabled
        };
    }
    
    setParams(params) {
        if (params.delayTime !== undefined) this.setDelayTime(params.delayTime);
        if (params.feedback !== undefined) this.setFeedback(params.feedback);
        if (params.pitchShiftCents !== undefined) this.setPitchShiftCents(params.pitchShiftCents);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.pitchMode !== undefined) this.setPitchMode(params.pitchMode);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.PitchShiftedDelay = PitchShiftedDelay;