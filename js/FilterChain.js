// Filter Chain Effect
// Multiple filters in series for complex sweeps and sound design

class FilterChain {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.merge = audioContext.createGain();
        
        // Create multiple filters
        this.filter1 = audioContext.createBiquadFilter();
        this.filter2 = audioContext.createBiquadFilter();
        this.filter3 = audioContext.createBiquadFilter();
        this.filter4 = audioContext.createBiquadFilter();
        
        // Configure filters
        this.filter1.type = 'lowpass';
        this.filter1.frequency.value = 5000;
        this.filter1.Q.value = 1;
        
        this.filter2.type = 'highpass';
        this.filter2.frequency.value = 200;
        this.filter2.Q.value = 1;
        
        this.filter3.type = 'bandpass';
        this.filter3.frequency.value = 1000;
        this.filter3.Q.value = 2;
        
        this.filter4.type = 'peaking';
        this.filter4.frequency.value = 3000;
        this.filter4.Q.value = 3;
        this.filter4.gain.value = 0;
        
        // Parameters
        this.filter1Enabled = true;
        this.filter2Enabled = true;
        this.filter3Enabled = false;
        this.filter4Enabled = false;
        this.mix = 1.0;
        
        // Connect the graph
        this.inputGain.connect(this.dryGain);
        this.inputGain.connect(this.filter1);
        
        this.filter1.connect(this.filter2);
        this.filter2.connect(this.filter3);
        this.filter3.connect(this.filter4);
        this.filter4.connect(this.wetGain);
        
        this.wetGain.connect(this.merge);
        this.dryGain.connect(this.merge);
        this.merge.connect(this.outputGain);
    }
    
    setFilter1Enabled(enabled) {
        this.filter1Enabled = enabled;
        if (enabled) {
            this.filter1.disconnect();
            this.filter1.connect(this.filter2);
        } else {
            this.filter1.disconnect();
            this.inputGain.disconnect();
            this.inputGain.connect(this.filter2);
            this.filter2.connect(this.filter1);
        }
    }
    
    setFilter2Enabled(enabled) {
        this.filter2Enabled = enabled;
        if (enabled) {
            this.filter2.disconnect();
            this.filter2.connect(this.filter3);
        } else {
            this.filter2.disconnect();
        }
    }
    
    setFilter3Enabled(enabled) {
        this.filter3Enabled = enabled;
        if (enabled) {
            this.filter3.disconnect();
            this.filter3.connect(this.filter4);
        } else {
            this.filter3.disconnect();
            this.filter2.connect(this.filter4);
        }
    }
    
    setFilter4Enabled(enabled) {
        this.filter4Enabled = enabled;
        if (enabled) {
            this.filter4.disconnect();
            this.filter4.connect(this.wetGain);
        } else {
            this.filter4.disconnect();
            this.filter3.connect(this.wetGain);
        }
    }
    
    setFilter1Params(type, freq, q) {
        if (type) this.filter1.type = type;
        if (freq !== undefined) this.filter1.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
        if (q !== undefined) this.filter1.Q.setTargetAtTime(q, this.audioContext.currentTime, 0.01);
    }
    
    setFilter2Params(type, freq, q) {
        if (type) this.filter2.type = type;
        if (freq !== undefined) this.filter2.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
        if (q !== undefined) this.filter2.Q.setTargetAtTime(q, this.audioContext.currentTime, 0.01);
    }
    
    setFilter3Params(type, freq, q) {
        if (type) this.filter3.type = type;
        if (freq !== undefined) this.filter3.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
        if (q !== undefined) this.filter3.Q.setTargetAtTime(q, this.audioContext.currentTime, 0.01);
    }
    
    setFilter4Params(type, freq, q, gain) {
        if (type) this.filter4.type = type;
        if (freq !== undefined) this.filter4.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
        if (q !== undefined) this.filter4.Q.setTargetAtTime(q, this.audioContext.currentTime, 0.01);
        if (gain !== undefined) this.filter4.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
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
        this.filter1.disconnect();
        this.filter2.disconnect();
        this.filter3.disconnect();
        this.filter4.disconnect();
        this.wetGain.disconnect();
        this.dryGain.disconnect();
        this.merge.disconnect();
    }
    
    getParams() {
        return {
            filter1Enabled: this.filter1Enabled,
            filter2Enabled: this.filter2Enabled,
            filter3Enabled: this.filter3Enabled,
            filter4Enabled: this.filter4Enabled,
            mix: this.mix,
            filter1Type: this.filter1.type,
            filter1Freq: this.filter1.frequency.value,
            filter1Q: this.filter1.Q.value,
            filter2Type: this.filter2.type,
            filter2Freq: this.filter2.frequency.value,
            filter2Q: this.filter2.Q.value,
            filter3Type: this.filter3.type,
            filter3Freq: this.filter3.frequency.value,
            filter3Q: this.filter3.Q.value,
            filter4Type: this.filter4.type,
            filter4Freq: this.filter4.frequency.value,
            filter4Q: this.filter4.Q.value,
            filter4Gain: this.filter4.gain.value,
            enabled: this.enabled
        };
    }
    
    setParams(params) {
        if (params.filter1Enabled !== undefined) this.setFilter1Enabled(params.filter1Enabled);
        if (params.filter2Enabled !== undefined) this.setFilter2Enabled(params.filter2Enabled);
        if (params.filter3Enabled !== undefined) this.setFilter3Enabled(params.filter3Enabled);
        if (params.filter4Enabled !== undefined) this.setFilter4Enabled(params.filter4Enabled);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.filter1Params !== undefined) this.setFilter1Params(params.filter1Params.type, params.filter1Params.freq, params.filter1Params.q);
        if (params.filter2Params !== undefined) this.setFilter2Params(params.filter2Params.type, params.filter2Params.freq, params.filter2Params.q);
        if (params.filter3Params !== undefined) this.setFilter3Params(params.filter3Params.type, params.filter3Params.freq, params.filter3Params.q);
        if (params.filter4Params !== undefined) this.setFilter4Params(params.filter4Params.type, params.filter4Params.freq, params.filter4Params.q, params.filter4Params.gain);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.FilterChain = FilterChain;