// Tape Saturation Effect - Analog tape warmth and saturation
// Simulates the magnetic tape recording process with soft clipping, frequency response, and noise

class TapeSaturation {
    constructor(initialParams = {}) {
        // Parameters
        this._drive = initialParams.drive !== undefined ? initialParams.drive : 0.5;
        this._saturation = initialParams.saturation !== undefined ? initialParams.saturation : 0.5;
        this._tapeSpeed = initialParams.tapeSpeed !== undefined ? initialParams.tapeSpeed : 0.5; // 7.5 or 15 ips模拟
        this._wowFlutter = initialParams.wowFlutter !== undefined ? initialParams.wowFlutter : 0.2;
        this._noise = initialParams.noise !== undefined ? initialParams.noise : 0.1;
        this._tone = initialParams.tone !== undefined ? initialParams.tone : 0.5; // High frequency rolloff
        this._mix = initialParams.mix !== undefined ? initialParams.mix : 1.0; // Dry/wet
        
        this._analyser = null;
        this._isActive = false;
        
        // Internal nodes
        this._inputGain = null;
        this._outputGain = null;
        this._toneFilter = null;
        this._noiseGain = null;
        this._dryGain = null;
        this._wetGain = null;
        
        this._buildChain();
    }
    
    _buildChain() {
        // Create Tone.js nodes
        this._inputGain = new Tone.Gain(1 + this._drive * 2);
        
        // Saturation waveshaper curve
        this._waveshaper = this._createSaturationCurve(this._saturation);
        
        // Tone control (high frequency rolloff simulating tape's frequency response)
        this._toneFilter = new Tone.Filter({
            frequency: 5000 + (1 - this._tone) * 15000,
            type: 'lowpass',
            rolloff: -12
        });
        
        // Noise generator (simulates tape hiss)
        this._noiseNode = this._createNoiseSource();
        this._noiseGain = new Tone.Gain(this._noise * 0.1);
        
        // Output and mix
        this._outputGain = new Tone.Gain(1);
        this._dryGain = new Tone.Gain(1 - this._mix);
        this._wetGain = new Tone.Gain(this._mix);
        
        // Connect chain: input -> inputGain -> waveshaper -> tone -> noise -> output
        this._inputGain.connect(this._waveshaper);
        this._waveshaper.connect(this._toneFilter);
        this._toneFilter.connect(this._noiseGain);
        this._noiseGain.connect(this._outputGain);
        
        // Dry/wet mix
        this._inputGain.connect(this._dryGain);
        this._noiseGain.connect(this._wetGain);
        
        this._dryGain.connect(this._outputGain);
        this._wetGain.connect(this._outputGain);
    }
    
    _createSaturationCurve(amount) {
        // Create a soft saturation curve (tanh-like)
        const samples = 256;
        const curve = new Float32Array(samples);
        const k = amount * 20;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Soft clipping using tanh
            curve[i] = Math.tanh(x * (1 + k));
        }
        
        const waveshaper = new Tone.WaveShaper({
            curve: curve,
            oversample: '4x'
        });
        
        return waveshaper;
    }
    
    _createNoiseSource() {
        // Simple white noise using a worklet
        // For fallback, use a looped buffer
        const bufferSize = Tone.context.sampleRate * 2;
        const buffer = new Tone.ToneAudioBuffer().fromArray(new Float32Array(bufferSize));
        
        // Fill with noise
        const data = buffer.get() ? buffer.get() : new Float32Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = new Tone.Noise('white');
        noise.volume.value = -60;
        
        return noise;
    }
    
    // Parameter setters
    setDrive(value) {
        this._drive = Math.max(0, Math.min(1, value));
        if (this._inputGain) {
            this._inputGain.gain.value = 1 + this._drive * 3;
        }
    }
    
    getDrive() {
        return this._drive;
    }
    
    setSaturation(value) {
        this._saturation = Math.max(0, Math.min(1, value));
        this._waveshaper = this._createSaturationCurve(this._saturation);
    }
    
    getSaturation() {
        return this._saturation;
    }
    
    setTone(value) {
        this._tone = Math.max(0, Math.min(1, value));
        if (this._toneFilter) {
            this._toneFilter.frequency.value = 5000 + (1 - this._tone) * 15000;
        }
    }
    
    getTone() {
        return this._tone;
    }
    
    setNoise(value) {
        this._noise = Math.max(0, Math.min(1, value));
        if (this._noiseGain) {
            this._noiseGain.gain.value = this._noise * 0.1;
        }
    }
    
    getNoise() {
        return this._noise;
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
    
    // Start/stop
    start() {
        if (this._noiseNode && !this._isActive) {
            this._noiseNode.start();
            this._isActive = true;
        }
        return this;
    }
    
    stop() {
        if (this._noiseNode && this._isActive) {
            this._noiseNode.stop();
            this._isActive = false;
        }
        return this;
    }
    
    dispose() {
        if (this._inputGain) this._inputGain.dispose();
        if (this._waveshaper) this._waveshaper.dispose();
        if (this._toneFilter) this._toneFilter.dispose();
        if (this._noiseNode) this._noiseNode.dispose();
        if (this._noiseGain) this._noiseGain.dispose();
        if (this._outputGain) this._outputGain.dispose();
        if (this._dryGain) this._dryGain.dispose();
        if (this._wetGain) this._wetGain.dispose();
    }
}

// Static method for metronome display
TapeSaturation.getMetronomeAudioLabel = function() { return 'Tape Saturation'; };

// Register on Tone namespace
if (typeof Tone !== 'undefined') {
    Tone.TapeSaturation = TapeSaturation;
}