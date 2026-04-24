// js/SpectralCompressor.js - Frequency-aware compression with independent band control

class SpectralCompressor extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);
        
        this._splitter = new Tone.Splitter(4);
        
        // 4 bands: Sub (20-80Hz), Low (80-500Hz), Mid (500-2000Hz), High (2k-16kHz)
        this._subFilter = new Tone.Filter(50, 'lowpass');
        this._lowFilter = new Tone.Filter(300, 'bandpass');
        this._midFilter = new Tone.Filter(1200, 'bandpass');
        this._highFilter = new Tone.Filter(8000, 'highpass');
        
        // Compressors per band
        this._subComp = new Tone.Compressor({
            threshold: initialParams.subThreshold !== undefined ? initialParams.subThreshold : -20,
            ratio: initialParams.subRatio !== undefined ? initialParams.subRatio : 4,
            attack: initialParams.attack || 0.005,
            release: initialParams.release || 0.1,
            knee: 6
        });
        
        this._lowComp = new Tone.Compressor({
            threshold: initialParams.lowThreshold !== undefined ? initialParams.lowThreshold : -20,
            ratio: initialParams.lowRatio !== undefined ? initialParams.lowRatio : 4,
            attack: initialParams.attack || 0.005,
            release: initialParams.release || 0.1,
            knee: 6
        });
        
        this._midComp = new Tone.Compressor({
            threshold: initialParams.midThreshold !== undefined ? initialParams.midThreshold : -20,
            ratio: initialParams.midRatio !== undefined ? initialParams.midRatio : 4,
            attack: initialParams.attack || 0.005,
            release: initialParams.release || 0.1,
            knee: 6
        });
        
        this._highComp = new Tone.Compressor({
            threshold: initialParams.highThreshold !== undefined ? initialParams.highThreshold : -24,
            ratio: initialParams.highRatio !== undefined ? initialParams.highRatio : 6,
            attack: initialParams.attack || 0.005,
            release: initialParams.release || 0.1,
            knee: 6
        });
        
        // Gain per band (makeup)
        this._subGain = new Tone.Gain(initialParams.subMakeup || 1.0);
        this._lowGain = new Tone.Gain(initialParams.lowMakeup || 1.0);
        this._midGain = new Tone.Gain(initialParams.midMakeup || 1.0);
        this._highGain = new Tone.Gain(initialParams.highMakeup || 1.0);
        
        // Merger
        this._merger = new Tone.Merger(4);
        
        // Wet/dry
        this._dryGain = new Tone.Gain(1.0);
        this._wetGain = new Tone.Gain(1.0);
        
        // Routing
        this._splitter.connect(this._subFilter, 0);
        this._subFilter.connect(this._subComp);
        this._subComp.connect(this._subGain);
        this._subGain.connect(this._merger, 0, 0);
        
        this._splitter.connect(this._lowFilter, 1);
        this._lowFilter.connect(this._lowComp);
        this._lowComp.connect(this._lowGain);
        this._lowGain.connect(this._merger, 0, 1);
        
        this._splitter.connect(this._midFilter, 2);
        this._midFilter.connect(this._midComp);
        this._midComp.connect(this._midGain);
        this._midGain.connect(this._merger, 0, 2);
        
        this._splitter.connect(this._highFilter, 3);
        this._highFilter.connect(this._highComp);
        this._highComp.connect(this._highGain);
        this._highGain.connect(this._merger, 0, 3);
        
        // Output
        this._merger.connect(this._wetGain);
        this._merger.connect(this._dryGain);
        this._wetGain.connect(this);
        this._dryGain.connect(this);
        
        this._splitter.connect(this);
        
        this._enabled = true;
    }
    
    static getMetronomeAudioLabel() { return 'Spectral Compressor'; }
    
    setEnabled(enabled) {
        this._enabled = enabled;
        if (enabled) {
            this._wetGain.gain.value = 1.0;
            this._dryGain.gain.value = 0.0;
        } else {
            this._wetGain.gain.value = 0.0;
            this._dryGain.gain.value = 1.0;
        }
    }
    
    setSubThreshold(db) { this._subComp.threshold.value = db; }
    setLowThreshold(db) { this._lowComp.threshold.value = db; }
    setMidThreshold(db) { this._midComp.threshold.value = db; }
    setHighThreshold(db) { this._highComp.threshold.value = db; }
    
    setSubRatio(r) { this._subComp.ratio.value = r; }
    setLowRatio(r) { this._lowComp.ratio.value = r; }
    setMidRatio(r) { this._midComp.ratio.value = r; }
    setHighRatio(r) { this._highComp.ratio.value = r; }
    
    setSubMakeup(g) { this._subGain.gain.value = g; }
    setLowMakeup(g) { this._lowGain.gain.value = g; }
    setMidMakeup(g) { this._midGain.gain.value = g; }
    setHighMakeup(g) { this._highGain.gain.value = g; }
    
    setAttack(ms) {
        this._subComp.attack.value = ms / 1000;
        this._lowComp.attack.value = ms / 1000;
        this._midComp.attack.value = ms / 1000;
        this._highComp.attack.value = ms / 1000;
    }
    
    setRelease(ms) {
        this._subComp.release.value = ms / 1000;
        this._lowComp.release.value = ms / 1000;
        this._midComp.release.value = ms / 1000;
        this._highComp.release.value = ms / 1000;
    }
    
    dispose() {
        this._splitter.dispose();
        this._subFilter.dispose();
        this._lowFilter.dispose();
        this._midFilter.dispose();
        this._highFilter.dispose();
        this._subComp.dispose();
        this._lowComp.dispose();
        this._midComp.dispose();
        this._highComp.dispose();
        this._subGain.dispose();
        this._lowGain.dispose();
        this._midGain.dispose();
        this._highGain.dispose();
        this._merger.dispose();
        this._dryGain.dispose();
        this._wetGain.dispose();
        super.dispose();
    }
}

if (typeof Tone !== 'undefined') {
    Tone.SpectralCompressor = SpectralCompressor;
}