// AdaptiveResonance.js - Self-oscillating filter with auto-tracking
class AdaptiveResonance {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.resonance = 0.5;
        this.frequency = 1000;
        this.autoTrack = true;
        this.drive = 1.0;
        this.inputGain = this.ctx.createGain();
        this.outputGain = this.ctx.createGain();
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'bandpass';
        this.filter.frequency.value = this.frequency;
        this.filter.Q.value = this.resonance;
        this.inputGain.connect(this.filter);
        this.filter.connect(this.outputGain);
    }
    process(input, computedFreq) {
        if (this.autoTrack && computedFreq) {
            this.filter.frequency.setTargetAtTime(computedFreq, this.ctx.currentTime, 0.01);
        }
        return this.outputGain;
    }
    setResonance(val) { this.resonance = val; this.filter.Q.value = val; }
    setFrequency(val) { this.frequency = val; this.filter.frequency.value = val; }
    getFrequencyResponse(freq) {
        const mag = this.filter.frequency * Math.sqrt(this.resonance);
        return mag / Math.sqrt(Math.pow(this.filter.frequency, 2) + Math.pow(freq, 2));
    }
}
if (typeof module !== 'undefined' && module.exports) module.exports = AdaptiveResonance;
