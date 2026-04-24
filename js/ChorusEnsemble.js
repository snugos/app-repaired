// Chorus Ensemble Effect - Enhanced chorus with multiple voices and stereo spread
// Creates a rich, lush chorus effect using multiple modulated delay lines

class ChorusEnsemble {
    constructor(initialParams = {}) {
        // Parameters
        this._voiceCount = initialParams.voiceCount !== undefined ? initialParams.voiceCount : 3;
        this._rate = initialParams.rate !== undefined ? initialParams.rate : 1.0;
        this._depth = initialParams.depth !== undefined ? initialParams.depth : 0.7;
        this._delayTime = initialParams.delayTime !== undefined ? initialParams.delayTime : 7;
        this._spread = initialParams.spread !== undefined ? initialParams.spread : 0.8;
        this._feedback = initialParams.feedback !== undefined ? initialParams.feedback : 0.3;
        this._tone = initialParams.tone !== undefined ? initialParams.tone : 0.5;
        this._mix = initialParams.mix !== undefined ? initialParams.mix : 0.5;
        
        // Delay nodes for each voice
        this._delays = [];
        this._lfos = [];
        
        // Low-pass filter for tone control
        this._toneFilter = null;
        
        // Mix nodes
        this._dryGain = null;
        this._wetGain = null;
        this._outputGain = null;
        
        this._buildChain();
    }
    
    _buildChain() {
        // Create voice LFOs and delays
        for (let i = 0; i < this._voiceCount; i++) {
            const lfo = new Tone.LFO({
                frequency: this._rate * (1 + (i * 0.1)),
                min: -this._depth * this._delayTime,
                max: this._depth * this._delayTime,
                type: 'sine'
            });
            
            const delay = new Tone.FeedbackDelay({
                delayTime: this._delayTime,
                feedback: this._feedback * 0.3,
                maxDelay: 50
            });
            
            // Set initial LFO offset for each voice
            lfo.phase = (360 / this._voiceCount) * i;
            
            this._delays.push(delay);
            this._lfos.push(lfo);
        }
        
        // Tone filter
        this._toneFilter = new Tone.Filter({
            frequency: 3000 + this._tone * 7000,
            type: 'lowpass',
            rolloff: -12
        });
        
        // Mix
        this._dryGain = new Tone.Gain(1 - this._mix);
        this._wetGain = new Tone.Gain(this._mix);
        this._outputGain = new Tone.Gain(1);
        
        // Connect LFOs to delay times
        this._lfos.forEach((lfo, i) => {
            lfo.connect(this._delays[i].delayTime);
            lfo.start();
        });
        
        // Connect in parallel to delays
        this._delays.forEach((delay, i) => {
            // Each delay gets slightly different feedback
            delay.feedback.value = this._feedback * (0.3 + i * 0.1);
            delay.connect(this._toneFilter);
        });
        
        // Tone filter to wet gain
        this._toneFilter.connect(this._wetGain);
        
        // Dry path
        // (input goes to dryGain directly)
        
        // Final mix
        this._dryGain.connect(this._outputGain);
        this._wetGain.connect(this._outputGain);
    }
    
    // Parameter setters
    setRate(value) {
        this._rate = Math.max(0.1, Math.min(20, value));
        this._lfos.forEach((lfo, i) => {
            lfo.frequency.value = this._rate * (1 + (i * 0.1));
        });
    }
    
    getRate() {
        return this._rate;
    }
    
    setDepth(value) {
        this._depth = Math.max(0, Math.min(1, value));
        this._lfos.forEach((lfo, i) => {
            lfo.min = -this._depth * this._delayTime;
            lfo.max = this._depth * this._delayTime;
        });
    }
    
    getDepth() {
        return this._depth;
    }
    
    setDelayTime(value) {
        this._delayTime = Math.max(1, Math.min(30, value));
        this._delays.forEach(delay => {
            delay.delayTime.value = this._delayTime;
        });
        // Update LFO range
        this.setDepth(this._depth);
    }
    
    getDelayTime() {
        return this._delayTime;
    }
    
    setFeedback(value) {
        this._feedback = Math.max(0, Math.min(0.9, value));
        this._delays.forEach((delay, i) => {
            delay.feedback.value = this._feedback * (0.3 + i * 0.1);
        });
    }
    
    getFeedback() {
        return this._feedback;
    }
    
    setTone(value) {
        this._tone = Math.max(0, Math.min(1, value));
        if (this._toneFilter) {
            this._toneFilter.frequency.value = 3000 + this._tone * 7000;
        }
    }
    
    getTone() {
        return this._tone;
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
    
    setSpread(value) {
        this._spread = Math.max(0, Math.min(1, value));
        // Spread affects stereo width through pan positions
    }
    
    getSpread() {
        return this._spread;
    }
    
    setVoiceCount(count) {
        // Recreate chain with new voice count
        const oldMix = this._mix;
        this.dispose();
        
        this._voiceCount = Math.max(1, Math.min(8, Math.floor(count)));
        this._delays = [];
        this._lfos = [];
        
        this._buildChain();
        this.setMix(oldMix);
    }
    
    getVoiceCount() {
        return this._voiceCount;
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
        this._delays.forEach(d => d.dispose());
        this._lfos.forEach(l => l.dispose());
        if (this._toneFilter) this._toneFilter.dispose();
        if (this._dryGain) this._dryGain.dispose();
        if (this._wetGain) this._wetGain.dispose();
        if (this._outputGain) this._outputGain.dispose();
    }
}

// Static method for metronome display
ChorusEnsemble.getMetronomeAudioLabel = function() { return 'Chorus Ensemble'; };

// Register on Tone namespace
if (typeof Tone !== 'undefined') {
    Tone.ChorusEnsemble = ChorusEnsemble;
}