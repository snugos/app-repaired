// Reverse Reverb Effect
// Reverse reverb tails for atmospheric and dreamy effects

class ReverseReverb {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.convolver = audioContext.createConvolver();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.merge = audioContext.createGain();
        this.preDelay = audioContext.createDelay(0.1);
        
        // Parameters
        this.mix = 0.5; // 0 = dry, 1 = wet
        this.preDelayTime = 0.02; // seconds
        this.decayTime = 2.0; // seconds
        this.reverbScale = 1.0; // scale factor for IR generation
        
        // Set initial values
        this.wetGain.gain.value = this.mix;
        this.dryGain.gain.value = 1 - this.mix;
        this.preDelay.delayTime.value = this.preDelayTime;
        
        // Generate reverse impulse response
        this.generateReverseIR();
        
        // Connect the graph
        // Input → Split → Dry → Merge → Output
        //          └→ PreDelay → Convolver → Wet → Merge
        
        this.inputGain.connect(this.dryGain);
        this.inputGain.connect(this.preDelay);
        
        this.preDelay.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.merge);
        
        this.dryGain.connect(this.merge);
        this.merge.connect(this.outputGain);
    }
    
    generateReverseIR() {
        // Create a reverse impulse response with exponential decay
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * this.decayTime;
        const impulse = new Float32Array(length);
        
        // Generate reverse envelope (builds up then decays quickly)
        for (let i = 0; i < length; i++) {
            const t = i / length;
            // Reverse: starts quiet, builds up, then decays
            const envelope = Math.exp(-t * 3) * Math.pow(1 - t, 0.5);
            // Random noise for reverb tail
            impulse[i] = (Math.random() * 2 - 1) * envelope;
        }
        
        // Apply the IR
        this.convolver.buffer = this.createIRBuffer(impulse);
    }
    
    createIRBuffer(impulse) {
        const buffer = this.audioContext.createBuffer(2, impulse.length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < impulse.length; i++) {
                // Reverse the impulse
                channelData[i] = impulse[impulse.length - 1 - i] * this.reverbScale;
            }
        }
        
        return buffer;
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
    }
    
    setPreDelay(seconds) {
        this.preDelayTime = Math.max(0, Math.min(0.1, seconds));
        this.preDelay.delayTime.setTargetAtTime(this.preDelayTime, this.audioContext.currentTime, 0.01);
    }
    
    setDecayTime(seconds) {
        this.decayTime = Math.max(0.1, Math.min(10, seconds));
        this.generateReverseIR();
    }
    
    setReverbScale(scale) {
        this.reverbScale = Math.max(0.1, Math.min(2, scale));
        this.generateReverseIR();
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
        this.convolver.disconnect();
        this.wetGain.disconnect();
        this.dryGain.disconnect();
        this.merge.disconnect();
        this.preDelay.disconnect();
    }
    
    getParams() {
        return {
            mix: this.mix,
            preDelay: this.preDelayTime,
            decayTime: this.decayTime,
            reverbScale: this.reverbScale,
            enabled: this.enabled
        };
    }
    
    setParams(params) {
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.preDelay !== undefined) this.setPreDelay(params.preDelay);
        if (params.decayTime !== undefined) this.setDecayTime(params.decayTime);
        if (params.reverbScale !== undefined) this.setReverbScale(params.reverbScale);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.ReverseReverb = ReverseReverb;