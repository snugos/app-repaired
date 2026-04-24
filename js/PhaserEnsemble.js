// Phaser Ensemble Effect - Multi-stage phaser with stereo and tempo sync
// Creates a rich, animated phase-shifting effect using multiple all-pass filters

class PhaserEnsemble {
    constructor(initialParams = {}) {
        // Parameters
        this._rate = initialParams.rate !== undefined ? initialParams.rate : 1.0;
        this._depth = initialParams.depth !== undefined ? initialParams.depth : 0.7;
        this._stages = initialParams.stages !== undefined ? initialParams.stages : 8;
        this._baseFrequency = initialParams.baseFrequency !== undefined ? initialParams.baseFrequency : 1000;
        this._octaves = initialParams.octaves !== undefined ? initialParams.octaves : 3;
        this._Q = initialParams.Q !== undefined ? initialParams.Q : 1.5;
        this._stereo = initialParams.stereo !== undefined ? initialParams.stereo : 0.5;
        this._syncToBPM = initialParams.syncToBPM !== undefined ? initialParams.syncToBPM : false;
        this._mix = initialParams.mix !== undefined ? initialParams.mix : 0.5;
        
        // Stage filters
        this._filters = [];
        this._lfos = [];
        
        // Stereo processing
        this._leftSplitter = null;
        this._rightSplitter = null;
        this._leftMerger = null;
        this._rightMerger = null;
        
        // Mix nodes
        this._dryGain = null;
        this._wetGain = null;
        this._outputGain = null;
        
        this._buildChain();
    }
    
    _buildChain() {
        // Create LFO(s) for modulation
        const lfoCount = this._stereo > 0.3 ? 2 : 1;
        
        for (let i = 0; i < lfoCount; i++) {
            const lfo = new Tone.LFO({
                frequency: this._syncToBPM ? this._getSyncedRate() : this._rate,
                min: 0,
                max: this._depth * this._octaves * this._baseFrequency,
                type: 'sine'
            });
            lfo.start();
            this._lfos.push(lfo);
        }
        
        // Create all-pass filter stages
        for (let i = 0; i < this._stages; i++) {
            // Each stage gets progressively higher base frequency
            const stageFreq = this._baseFrequency * Math.pow(2, i);
            
            const filter = new Tone.AllPass({
                frequency: stageFreq,
                Q: this._Q
            });
            
            this._filters.push(filter);
        }
        
        // Connect first LFO to all stages
        if (this._lfos.length > 0) {
            this._lfos[0].connect(this._filters[0].frequency);
            for (let i = 1; i < this._filters.length; i++) {
                this._lfos[0].connect(this._filters[i].frequency);
            }
        }
        
        // Second LFO for stereo (slight detune)
        if (this._lfos.length > 1) {
            const stereoOffset = this._stereo * 0.2;
            this._lfos[1].frequency.value = this._lfos[1].frequency.value * (1 + stereoOffset);
            this._lfos[1].connect(this._filters[Math.floor(this._filters.length / 2)].frequency);
        }
        
        // Mix
        this._dryGain = new Tone.Gain(1 - this._mix);
        this._wetGain = new Tone.Gain(this._mix);
        this._outputGain = new Tone.Gain(1);
        
        // Connect in series
        let lastNode = null;
        this._filters.forEach((filter, i) => {
            if (i === 0) {
                // First filter gets input
            } else {
                // Connect previous to current
                lastNode.connect(filter);
            }
            lastNode = filter;
        });
        
        // Wet path
        this._filters[0].connect(this._wetGain);
        this._wetGain.connect(this._outputGain);
        
        // Dry path  
        this._dryGain.connect(this._outputGain);
    }
    
    _getSyncedRate() {
        const bpm = Tone.Transport.bpm.value || 120;
        return (bpm / 60) * this._rate;
    }
    
    // Parameter setters
    setRate(value) {
        this._rate = Math.max(0.01, Math.min(20, value));
        this._lfos.forEach(lfo => {
            lfo.frequency.value = this._syncToBPM ? this._getSyncedRate() : this._rate;
        });
    }
    
    getRate() {
        return this._rate;
    }
    
    setDepth(value) {
        this._depth = Math.max(0, Math.min(1, value));
        this._lfos.forEach(lfo => {
            lfo.max = this._depth * this._octaves * this._baseFrequency;
        });
    }
    
    getDepth() {
        return this._depth;
    }
    
    setStages(stages) {
        this._stages = Math.max(2, Math.min(24, stages));
        // Recreate chain
        const oldMix = this._mix;
        this.dispose();
        this._buildChain();
        this.setMix(oldMix);
    }
    
    getStages() {
        return this._stages;
    }
    
    setBaseFrequency(freq) {
        this._baseFrequency = Math.max(100, Math.min(5000, freq));
        // Update filter frequencies
        this._filters.forEach((filter, i) => {
            filter.frequency.value = this._baseFrequency * Math.pow(2, i);
        });
    }
    
    getBaseFrequency() {
        return this._baseFrequency;
    }
    
    setQ(q) {
        this._Q = Math.max(0.1, Math.min(20, q));
        this._filters.forEach(filter => {
            filter.Q.value = this._Q;
        });
    }
    
    getQ() {
        return this._Q;
    }
    
    setOctaves(octaves) {
        this._octaves = Math.max(1, Math.min(6, octaves));
        this.setDepth(this._depth); // Updates LFO max
    }
    
    getOctaves() {
        return this._octaves;
    }
    
    setStereo(value) {
        this._stereo = Math.max(0, Math.min(1, value));
    }
    
    getStereo() {
        return this._stereo;
    }
    
    setSyncToBPM(sync) {
        this._syncToBPM = sync;
        this._lfos.forEach(lfo => {
            lfo.frequency.value = sync ? this._getSyncedRate() : this._rate;
        });
    }
    
    getSyncToBPM() {
        return this._syncToBPM;
    }
    
    setMix(value) {
        this._mix = Math.max(0, Math.min(1, value));
        if (this._dryGain && this._wetGain) {
            this._dryGain.gain.value = 1 - this._mix;
            this._wetGain.gain.value = this._mix;
        }
    }
    
    getMix() {
        return this._mix;
    }
    
    // Connect to audio graph
    connect(destination) {
        if (this._outputGain) {
            this._outputGain.connect(destination);
        }
        return this;
    }
    
    disconnect(destination) {
        if (this._outputGain) {
            this._outputGain.disconnect(destination);
        }
        return this;
    }
    
    dispose() {
        this._filters.forEach(f => f.dispose());
        this._lfos.forEach(l => l.dispose());
        if (this._dryGain) this._dryGain.dispose();
        if (this._wetGain) this._wetGain.dispose();
        if (this._outputGain) this._outputGain.dispose();
    }
}

// Static method for metronome display
PhaserEnsemble.getMetronomeAudioLabel = function() { return 'Phaser Ensemble'; };

// Register on Tone namespace
if (typeof Tone !== 'undefined') {
    Tone.PhaserEnsemble = PhaserEnsemble;
}