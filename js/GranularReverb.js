// Granular Reverb Effect
// Grain-based reverb for ambient textures and experimental sounds

class GranularReverb {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.analyser = audioContext.createAnalyser();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.merge = audioContext.createGain();
        
        // Grain processing
        this.grainSize = 0.05; // seconds
        this.grainOverlap = 0.5; // 0-1
        this.grainDensity = 20; // grains per second
        this.positionVariance = 0.5; // how much position varies
        
        // Parameters
        this.mix = 0.5;
        this.decay = 2.0; // seconds
        this.size = 1.0; // room size multiplier
        this.diffusion = 0.8; // scatter amount
        
        // Set initial values
        this.wetGain.gain.value = this.mix;
        this.dryGain.gain.value = 1 - this.mix;
        this.analyser.fftSize = 2048;
        
        // Buffer for grain storage
        this.grainBuffer = audioContext.createBuffer(
            2,
            audioContext.sampleRate * 5,
            audioContext.sampleRate
        );
        
        // Connect the graph
        this.inputGain.connect(this.dryGain);
        this.inputGain.connect(this.analyser);
        
        this.analyser.connect(this.wetGain);
        this.wetGain.connect(this.merge);
        
        this.dryGain.connect(this.merge);
        this.merge.connect(this.outputGain);
    }
    
    createGrain(sourceBuffer, startPos, duration, position, feedback) {
        const sampleRate = this.audioContext.sampleRate;
        const grainLength = Math.floor(sampleRate * duration);
        const grainBuffer = this.audioContext.createBuffer(2, grainLength, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = grainBuffer.getChannelData(channel);
            const sourceData = sourceBuffer.getChannelData(channel);
            
            for (let i = 0; i < grainLength; i++) {
                const t = i / grainLength;
                // Window function (Hanning)
                const window = 0.5 * (1 - Math.cos(2 * Math.PI * t));
                // Position in source
                const pos = Math.floor((startPos + position) % sourceBuffer.length);
                // Read sample with interpolation
                const sample = sourceData[(pos + i) % sourceData.length] || 0;
                // Apply envelope and feedback
                channelData[i] = sample * window * feedback;
            }
        }
        
        return grainBuffer;
    }
    
    setGrainSize(seconds) {
        this.grainSize = Math.max(0.01, Math.min(0.2, seconds));
    }
    
    setGrainDensity(density) {
        this.grainDensity = Math.max(1, Math.min(100, density));
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
    }
    
    setDecay(seconds) {
        this.decay = Math.max(0.1, Math.min(10, seconds));
    }
    
    setSize(scale) {
        this.size = Math.max(0.1, Math.min(3, scale));
    }
    
    setDiffusion(amount) {
        this.diffusion = Math.max(0, Math.min(1, amount));
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
        this.analyser.disconnect();
        this.wetGain.disconnect();
        this.dryGain.disconnect();
        this.merge.disconnect();
    }
    
    getParams() {
        return {
            grainSize: this.grainSize,
            grainDensity: this.grainDensity,
            mix: this.mix,
            decay: this.decay,
            size: this.size,
            diffusion: this.diffusion,
            enabled: this.enabled
        };
    }
    
    setParams(params) {
        if (params.grainSize !== undefined) this.setGrainSize(params.grainSize);
        if (params.grainDensity !== undefined) this.setGrainDensity(params.grainDensity);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.decay !== undefined) this.setDecay(params.decay);
        if (params.size !== undefined) this.setSize(params.size);
        if (params.diffusion !== undefined) this.setDiffusion(params.diffusion);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.GranularReverb = GranularReverb;