/**
 * GranularSynthesisEngine - Granular synthesis effect with position, density, and pitch controls
 * Creates textures from audio by splitting it into tiny grains and reassembling them
 */

export class GranularSynthesisEngine {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.position = options.position ?? 0.5; // 0-1, position in the audio buffer
        this.density = options.density ?? 50; // grains per second
        this.pitch = options.pitch ?? 0; // semitones up/down
        this.scatter = options.scatter ?? 0.1; // random timing variation
        this.grainSize = options.grainSize ?? 0.05; // seconds
        this.spray = options.spray ?? 0; // random position offset
        this.reverb = options.reverb ?? 0; // shimmer reverb mix
        this.mix = options.mix ?? 1.0; // dry/wet
        this.enabled = options.enabled ?? true;
        
        // State
        this._buffer = null;
        this._isRecording = false;
        this._recordedChunks = [];
        this._activeGrains = [];
        this._grainIdCounter = 0;
        
        // Analysis for position tracking
        this._analyser = audioContext.createAnalyser();
        this._analyser.fftSize = 2048;
        this._analyserData = new Float32Array(this._analyser.frequencyBinCount);
        
        // Reverb using delay network
        this._reverbGain = audioContext.createGain();
        this._reverbMix = audioContext.createGain();
        this._delays = [];
        this._feedbackGains = [];
        
        // Create delay-based reverb network
        const reverbTimes = [0.05, 0.08, 0.12, 0.15, 0.2, 0.25];
        const reverbFeedbacks = [0.4, 0.35, 0.3, 0.25, 0.2, 0.15];
        
        for (let i = 0; i < reverbTimes.length; i++) {
            const delay = audioContext.createDelay(1);
            const feedback = audioContext.createGain();
            const wet = audioContext.createGain();
            
            delay.delayTime.value = reverbTimes[i] + Math.random() * 0.02;
            feedback.gain.value = reverbFeedbacks[i];
            wet.gain.value = 0.15;
            
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(wet);
            wet.connect(this._reverbMix);
            
            this._delays.push(delay);
            this._feedbackGains.push(feedback);
        }
        
        this._reverbMix.gain.value = this.reverb;
        
        // Dry/wet
        this._dryGain = audioContext.createGain();
        this._wetGain = audioContext.createGain();
        this._dryGain.gain.value = 1 - this.mix;
        this._wetGain.gain.value = this.mix;
        
        this._dryGain.connect(this.output);
        this._reverbMix.connect(this.output);
        
        // Connect input
        this.input.connect(this._dryGain);
        this.input.connect(this._analyser);
        this.input.connect(this._reverbGain);
        this._reverbGain.connect(this.output);
        
        // Scheduler for grains
        this._nextGrainTime = 0;
        this._lastDensity = this.density;
    }
    
    static getMetronomeAudioLabel() { return 'Granular'; }
    
    // Record incoming audio to buffer
    startRecording(duration = 10) {
        this._recordedChunks = [];
        this._isRecording = true;
        
        const scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (e) => {
            if (this._isRecording) {
                const inputData = e.inputBuffer.getChannelData(0);
                this._recordedChunks.push(new Float32Array(inputData));
            }
        };
        
        this.input.connect(scriptProcessor);
        scriptProcessor.connect(this.audioContext.destination);
        this._scriptProcessor = scriptProcessor;
        
        // Auto-stop after duration
        setTimeout(() => this.stopRecording(), duration * 1000);
    }
    
    stopRecording() {
        this._isRecording = false;
        if (this._scriptProcessor) {
            this._scriptProcessor.disconnect();
            this._scriptProcessor = null;
        }
        
        if (this._recordedChunks.length > 0) {
            const totalLength = this._recordedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            this._buffer = this.audioContext.createBuffer(1, totalLength, this.audioContext.sampleRate);
            const channelData = this._buffer.getChannelData(0);
            
            let offset = 0;
            for (const chunk of this._recordedChunks) {
                channelData.set(chunk, offset);
                offset += chunk.length;
            }
        }
    }
    
    // Load external audio buffer
    loadBuffer(buffer) {
        this._buffer = buffer;
    }
    
    // Create and play a grain
    _playGrain(startTime, id) {
        if (!this._buffer || !this.enabled) return;
        
        const bufferSize = Math.floor(this.grainSize * this.audioContext.sampleRate);
        const bufferDuration = this._buffer.duration;
        
        // Calculate start position with spray/scatter
        const sprayOffset = (Math.random() - 0.5) * 2 * this.spray * bufferDuration;
        const scatterOffset = (Math.random() - 0.5) * 2 * this.scatter;
        const positionInBuffer = Math.max(0, Math.min(1, this.position + sprayOffset / bufferDuration));
        
        let grainStartTime = positionInBuffer * bufferDuration + scatterOffset;
        grainStartTime = Math.max(0, Math.min(bufferDuration - this.grainSize, grainStartTime));
        
        // Create grain source
        const grainSource = this.audioContext.createBufferSource();
        grainSource.buffer = this._buffer;
        
        // Apply pitch shift
        const pitchRatio = Math.pow(2, this.pitch / 12);
        grainSource.playbackRate.value = pitchRatio;
        
        // Grain envelope (Hann window)
        const envelope = this.audioContext.createGain();
        envelope.gain.setValueAtTime(0, startTime);
        envelope.gain.linearRampToValueAtTime(0.5, startTime + this.grainSize * 0.1);
        envelope.gain.linearRampToValueAtTime(0.5, startTime + this.grainSize * 0.9);
        envelope.gain.linearRampToValueAtTime(0, startTime + this.grainSize);
        
        // Output routing
        grainSource.connect(envelope);
        envelope.connect(this._dryGain);
        
        // Also send some to reverb
        const reverbSend = this.audioContext.createGain();
        reverbSend.gain.value = this.reverb * 0.3;
        envelope.connect(reverbSend);
        reverbSend.connect(this._reverbGain);
        
        grainSource.start(startTime, grainStartTime, this.grainSize);
        grainSource.stop(startTime + this.grainSize);
        
        // Track active grains
        const grain = { id, source: grainSource, startTime, endTime: startTime + this.grainSize };
        this._activeGrains.push(grain);
        
        // Cleanup after grain ends
        setTimeout(() => {
            const idx = this._activeGrains.findIndex(g => g.id === id);
            if (idx !== -1) this._activeGrains.splice(idx, 1);
            try { grainSource.disconnect(); envelope.disconnect(); } catch (e) {}
        }, (this.grainSize + 0.1) * 1000);
    }
    
    // Schedule grains for upcoming time window
    scheduleGrains() {
        if (!this._buffer || !this.enabled) return;
        
        const currentTime = this.audioContext.currentTime;
        const scheduleAhead = 0.2; // schedule 200ms ahead
        const minGrainInterval = 0.005; // minimum 5ms between grains
        
        // Recalculate if density changed
        if (this._lastDensity !== this.density) {
            this._nextGrainTime = currentTime;
            this._lastDensity = this.density;
        }
        
        while (this._nextGrainTime < currentTime + scheduleAhead) {
            const grainInterval = 1 / this.density;
            const jitter = (Math.random() - 0.5) * grainInterval * 0.3;
            
            this._playGrain(this._nextGrainTime, this._grainIdCounter++);
            
            this._nextGrainTime += Math.max(minGrainInterval, grainInterval + jitter);
        }
    }
    
    // Start granular processing
    start() {
        this._animationFrame = setInterval(() => this.scheduleGrains(), 50);
    }
    
    // Stop granular processing
    stop() {
        if (this._animationFrame) {
            clearInterval(this._animationFrame);
            this._animationFrame = null;
        }
        
        // Stop all active grains
        for (const grain of this._activeGrains) {
            try {
                grain.source.stop();
                grain.source.disconnect();
            } catch (e) {}
        }
        this._activeGrains = [];
    }
    
    // Setters with parameter change detection
    setPosition(value) {
        this.position = Math.max(0, Math.min(1, value));
    }
    
    setDensity(value) {
        this.density = Math.max(1, Math.min(200, value));
    }
    
    setPitch(value) {
        this.pitch = Math.max(-24, Math.min(24, value));
    }
    
    setScatter(value) {
        this.scatter = Math.max(0, Math.min(1, value));
    }
    
    setGrainSize(value) {
        this.grainSize = Math.max(0.01, Math.min(0.5, value));
    }
    
    setSpray(value) {
        this.spray = Math.max(0, Math.min(1, value));
    }
    
    setReverb(value) {
        this.reverb = Math.max(0, Math.min(1, value));
        this._reverbMix.gain.value = value;
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this._dryGain.gain.value = 1 - value;
        this._wetGain.gain.value = value;
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            for (const grain of this._activeGrains) {
                try { grain.source.stop(); } catch (e) {}
            }
            this._activeGrains = [];
        }
    }
    
    // Get parameters for UI
    getParams() {
        return {
            position: this.position,
            density: this.density,
            pitch: this.pitch,
            scatter: this.scatter,
            grainSize: this.grainSize,
            spray: this.spray,
            reverb: this.reverb,
            mix: this.mix,
            enabled: this.enabled,
            hasBuffer: !!this._buffer,
            isRecording: this._isRecording,
            bufferDuration: this._buffer ? this._buffer.duration : 0
        };
    }
    
    // Load buffer from URL or file
    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            this._buffer = await this.audioContext.decodeAudioData(arrayBuffer);
            return true;
        } catch (e) {
            console.error('[GranularSynthesisEngine] Failed to load audio:', e);
            return false;
        }
    }
    
    dispose() {
        this.stop();
        
        if (this._scriptProcessor) {
            this._scriptProcessor.disconnect();
            this._scriptProcessor = null;
        }
        
        for (const delay of this._delays) {
            try { delay.disconnect(); } catch (e) {}
        }
        
        this.input.disconnect();
        this.output.disconnect();
    }
}

// Register granular synthesis engine
if (typeof Tone !== 'undefined') {
    Tone.GranularSynthesisEngine = GranularSynthesisEngine;
}