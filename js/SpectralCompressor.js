// SpectralCompressor.js - Frequency-aware compression with independent band control
class SpectralCompressor {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.compressor = audioContext.createDynamicsCompressor();
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        // Multiband split (3 bands)
        this.lowFilter = audioContext.createBiquadFilter();
        this.lowFilter.type = 'lowpass';
        this.lowFilter.frequency.value = 250;
        
        this.midFilter = audioContext.createBiquadFilter();
        this.midFilter.type = 'bandpass';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 0.5;
        
        this.highFilter = audioContext.createBiquadFilter();
        this.highFilter.type = 'highpass';
        this.highFilter.frequency.value = 2500;
        
        // Per-band compressors
        this.lowComp = audioContext.createDynamicsCompressor();
        this.lowComp.threshold.value = -24;
        this.lowComp.knee.value = 10;
        this.lowComp.ratio.value = 4;
        this.lowComp.attack.value = 10;
        this.lowComp.release.value = 100;
        
        this.midComp = audioContext.createDynamicsCompressor();
        this.midComp.threshold.value = -20;
        this.midComp.knee.value = 10;
        this.midComp.ratio.value = 4;
        this.midComp.attack.value = 5;
        this.midComp.release.value = 80;
        
        this.highComp = audioContext.createDynamicsCompressor();
        this.highComp.threshold.value = -18;
        this.highComp.knee.value = 8;
        this.highComp.ratio.value = 6;
        this.highComp.attack.value = 3;
        this.highComp.release.value = 60;
        
        // Gain controls per band
        this.lowGain = audioContext.createGain();
        this.lowGain.gain.value = 1;
        this.midGain = audioContext.createGain();
        this.midGain.gain.value = 1;
        this.highGain = audioContext.createGain();
        this.highGain.gain.value = 1;
        
        // Makeup gain
        this.makeupGain = audioContext.createGain();
        this.makeupGain.gain.value = 1;
        
        // Merge node
        this Merger = audioContext.createChannelMerger(3);
        
        // Bind bands
        this.lowFilter.connect(this.lowComp);
        this.lowComp.connect(this.lowGain);
        this.lowGain.connect(this.Merger, 0, 0);
        
        this.midFilter.connect(this.midComp);
        this.midComp.connect(this.midGain);
        this.midGain.connect(this.Merger, 0, 1);
        
        this.highFilter.connect(this.highComp);
        this.highComp.connect(this.highGain);
        this.highGain.connect(this.Merger, 0, 2);
        
        this.Merger.connect(this.makeupGain);
        this.makeupGain.connect(this.compressor);
        this.compressor.connect(this.analyser);
        
        // Input/Output
        this.input = this.lowFilter;
        this.output = this.analyser;
        
        // Mid filter also feeds into the merger for band 2
        // Set up crossover routing
        this.lowFilter.connect(this.midFilter);
        this.midFilter.connect(this.highFilter);
        
        // Reconnect for proper routing
        this.lowFilter.disconnect();
        this.midFilter.disconnect();
        this.highFilter.disconnect();
        
        this.lowFilter.connect(this.lowComp);
        this.lowComp.connect(this.lowGain);
        this.lowGain.connect(this.Merger, 0, 0);
        
        this.midFilter.connect(this.midComp);
        this.midComp.connect(this.midGain);
        this.midGain.connect(this.Merger, 0, 1);
        
        this.highFilter.connect(this.highComp);
        this.highComp.connect(this.highGain);
        this.highGain.connect(this.Merger, 0, 2);
        
        this.Merger.connect(this.makeupGain);
        this.makeupGain.connect(this.compressor);
        this.compressor.connect(this.analyser);
        
        this.input = audioContext.createGain();
        this.input.connect(this.lowFilter);
        this.input.connect(this.midFilter);
        this.input.connect(this.highFilter);
        this.output = this.analyser;
        
        // Frequency data for visualization
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    
    getInput() { return this.input; }
    getOutput() { return this.output; }
    
    setLowThreshold(v) { this.lowComp.threshold.value = v; }
    setMidThreshold(v) { this.midComp.threshold.value = v; }
    setHighThreshold(v) { this.highComp.threshold.value = v; }
    
    setLowRatio(v) { this.lowComp.ratio.value = v; }
    setMidRatio(v) { this.midComp.ratio.value = v; }
    setHighRatio(v) { this.highComp.ratio.value = v; }
    
    setLowFreq(v) { this.lowFilter.frequency.value = v; }
    setHighFreq(v) { this.highFilter.frequency.value = v; }
    
    setMakeupGain(v) { this.makeupGain.gain.value = Math.pow(10, v / 20); }
    
    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }
    
    dispose() {
        this.lowFilter.disconnect();
        this.midFilter.disconnect();
        this.highFilter.disconnect();
        this.lowComp.disconnect();
        this.midComp.disconnect();
        this.highComp.disconnect();
        this.lowGain.disconnect();
        this.midGain.disconnect();
        this.highGain.disconnect();
        this.Merger.disconnect();
        this.makeupGain.disconnect();
        this.compressor.disconnect();
        this.analyser.disconnect();
        this.input.disconnect();
    }
}

// Register with effects registry if available
if (typeof effectsRegistry !== 'undefined') {
    effectsRegistry.register('SpectralCompressor', SpectralCompressor, {
        category: 'dynamics',
        parameters: {
            lowThreshold: { default: -24, min: -60, max: 0, step: 1, unit: 'dB' },
            midThreshold: { default: -20, min: -60, max: 0, step: 1, unit: 'dB' },
            highThreshold: { default: -18, min: -60, max: 0, step: 1, unit: 'dB' },
            lowRatio: { default: 4, min: 1, max: 20, step: 0.5 },
            midRatio: { default: 4, min: 1, max: 20, step: 0.5 },
            highRatio: { default: 6, min: 1, max: 20, step: 0.5 },
            lowFreq: { default: 250, min: 60, max: 500, step: 10, unit: 'Hz' },
            highFreq: { default: 2500, min: 1000, max: 8000, step: 100, unit: 'Hz' },
            makeupGain: { default: 0, min: 0, max: 24, step: 0.5, unit: 'dB' }
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpectralCompressor;
}