/**
 * Spectral Expander - Frequency-selective expansion for mastering
 * Applies expansion (reverse compression) per frequency band for surgical dynamics control
 */

export class SpectralExpander {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Parameters
        this.threshold = options.threshold ?? -40; // dB - signals below this are expanded
        this.ratio = options.ratio ?? 2; // Expansion ratio (2:1 means 2x expansion)
        this.attack = options.attack ?? 0.001; // seconds
        this.release = options.release ?? 0.1; // seconds
        this.range = options.range ?? 24; // dB - maximum gain reduction
        this.knee = options.knee ?? 6; // dB - soft knee width
        this.stereoLink = options.stereoLink ?? true;
        this.bands = options.bands ?? 4; // Number of frequency bands
        this.crossoverFreqs = options.crossoverFreqs ?? [200, 1000, 4000]; // Hz
        
        // Create audio nodes
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Create band-splitting filters and expanders
        this.bandExpanders = [];
        this.bandFilters = [];
        this.bandAnalyzers = [];
        this.bandGains = [];
        
        this._buildBandProcessors();
        this._connectNodes();
    }
    
    _buildBandProcessors() {
        const bandFreqs = [0, ...this.crossoverFreqs, 20000];
        
        for (let i = 0; i < this.bands; i++) {
            const lowFreq = bandFreqs[i];
            const highFreq = bandFreqs[i + 1];
            
            // Create band filter
            const filter = this._createBandFilter(lowFreq, highFreq);
            this.bandFilters.push(filter);
            
            // Create gain node for band level control
            const bandGain = this.audioContext.createGain();
            bandGain.gain.value = 1;
            this.bandGains.push(bandGain);
            
            // Create analyzer for this band
            const analyzer = this.audioContext.createAnalyser();
            analyzer.fftSize = 2048;
            analyzer.smoothingTimeConstant = 0.3;
            this.bandAnalyzers.push(analyzer);
            
            // Create expander for this band
            const expander = new BandExpander(this.audioContext, {
                threshold: this.threshold,
                ratio: this.ratio,
                attack: this.attack,
                release: this.release,
                range: this.range,
                knee: this.knee
            });
            this.bandExpanders.push(expander);
        }
    }
    
    _createBandFilter(lowFreq, highFreq) {
        // Create bandpass filter using lowpass + highpass combination
        const filter = {
            lowpass: this.audioContext.createBiquadFilter(),
            highpass: this.audioContext.createBiquadFilter(),
            output: this.audioContext.createGain()
        };
        
        filter.lowpass.type = 'lowpass';
        filter.lowpass.frequency.value = highFreq;
        filter.lowpass.Q.value = 0.7;
        
        filter.highpass.type = 'highpass';
        filter.highpass.frequency.value = Math.max(20, lowFreq);
        filter.highpass.Q.value = 0.7;
        
        // Chain: highpass -> lowpass -> output
        filter.highpass.connect(filter.lowpass);
        filter.lowpass.connect(filter.output);
        
        return filter;
    }
    
    _connectNodes() {
        // Connect input to each band filter
        for (let i = 0; i < this.bands; i++) {
            this.input.connect(this.bandFilters[i].highpass);
            this.bandFilters[i].output.connect(this.bandAnalyzers[i]);
            this.bandAnalyzers[i].connect(this.bandExpanders[i].input);
            this.bandExpanders[i].connect(this.bandGains[i]);
            this.bandGains[i].connect(this.output);
        }
    }
    
    // Parameter setters
    setThreshold(value) {
        this.threshold = Math.max(-80, Math.min(0, value));
        this.bandExpanders.forEach(exp => exp.setThreshold(this.threshold));
    }
    
    getThreshold() {
        return this.threshold;
    }
    
    setRatio(value) {
        this.ratio = Math.max(1, Math.min(20, value));
        this.bandExpanders.forEach(exp => exp.setRatio(this.ratio));
    }
    
    getRatio() {
        return this.ratio;
    }
    
    setAttack(value) {
        this.attack = Math.max(0.0001, Math.min(1, value));
        this.bandExpanders.forEach(exp => exp.setAttack(this.attack));
    }
    
    getAttack() {
        return this.attack;
    }
    
    setRelease(value) {
        this.release = Math.max(0.01, Math.min(2, value));
        this.bandExpanders.forEach(exp => exp.setRelease(this.release));
    }
    
    getRelease() {
        return this.release;
    }
    
    setRange(value) {
        this.range = Math.max(0, Math.min(60, value));
        this.bandExpanders.forEach(exp => exp.setRange(this.range));
    }
    
    getRange() {
        return this.range;
    }
    
    setKnee(value) {
        this.knee = Math.max(0, Math.min(24, value));
        this.bandExpanders.forEach(exp => exp.setKnee(this.knee));
    }
    
    getKnee() {
        return this.knee;
    }
    
    setBandGain(bandIndex, value) {
        if (bandIndex >= 0 && bandIndex < this.bands) {
            this.bandGains[bandIndex].gain.value = Math.max(0, Math.min(2, value));
        }
    }
    
    getBandGain(bandIndex) {
        if (bandIndex >= 0 && bandIndex < this.bands) {
            return this.bandGains[bandIndex].gain.value;
        }
        return 1;
    }
    
    // Get band levels for metering
    getBandLevels() {
        const levels = [];
        for (let i = 0; i < this.bands; i++) {
            const dataArray = new Float32Array(this.bandAnalyzers[i].fftSize);
            this.bandAnalyzers[i].getFloatTimeDomainData(dataArray);
            
            // Calculate RMS
            let sum = 0;
            for (let j = 0; j < dataArray.length; j++) {
                sum += dataArray[j] * dataArray[j];
            }
            const rms = Math.sqrt(sum / dataArray.length);
            levels.push(20 * Math.log10(Math.max(rms, 0.00001)));
        }
        return levels;
    }
    
    // Get reduction amounts for each band
    getReductionAmounts() {
        return this.bandExpanders.map(exp => exp.getReduction());
    }
    
    connect(destination) {
        this.output.connect(destination);
        return this;
    }
    
    disconnect(destination) {
        this.output.disconnect(destination);
        return this;
    }
    
    dispose() {
        this.input.disconnect();
        this.output.disconnect();
        
        for (let i = 0; i < this.bands; i++) {
            this.bandFilters[i].lowpass.disconnect();
            this.bandFilters[i].highpass.disconnect();
            this.bandFilters[i].output.disconnect();
            this.bandAnalyzers[i].disconnect();
            this.bandExpanders[i].dispose();
            this.bandGains[i].disconnect();
        }
    }
}

/**
 * BandExpander - Single band expander
 */
class BandExpander {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        this.threshold = options.threshold ?? -40;
        this.ratio = options.ratio ?? 2;
        this.attack = options.attack ?? 0.001;
        this.release = options.release ?? 0.1;
        this.range = options.range ?? 24;
        this.knee = options.knee ?? 6;
        
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Analyzer for level detection
        this.analyzer = audioContext.createAnalyser();
        this.analyzer.fftSize = 2048;
        
        // Gain reduction node
        this.gainReduction = audioContext.createGain();
        this.gainReduction.gain.value = 1;
        
        // Connect
        this.input.connect(this.analyzer);
        this.input.connect(this.gainReduction);
        this.gainReduction.connect(this.output);
        
        // State
        this.currentReduction = 0;
        this.envelopeFollower = 0;
        
        // Start processing
        this._startProcessing();
    }
    
    _startProcessing() {
        const process = () => {
            const dataArray = new Float32Array(this.analyzer.fftSize);
            this.analyzer.getFloatTimeDomainData(dataArray);
            
            // Calculate RMS
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i] * dataArray[i];
            }
            const rms = Math.sqrt(sum / dataArray.length);
            const db = 20 * Math.log10(Math.max(rms, 0.00001));
            
            // Calculate expansion
            const targetReduction = this._calculateExpansion(db);
            
            // Smooth the reduction
            const attackCoeff = Math.exp(-1 / (this.attack * this.audioContext.sampleRate / 100));
            const releaseCoeff = Math.exp(-1 / (this.release * this.audioContext.sampleRate / 100));
            
            if (targetReduction > this.currentReduction) {
                this.currentReduction = this.currentReduction * attackCoeff + targetReduction * (1 - attackCoeff);
            } else {
                this.currentReduction = this.currentReduction * releaseCoeff + targetReduction * (1 - releaseCoeff);
            }
            
            // Apply gain reduction (expansion = increase gain for signals above threshold)
            this.gainReduction.gain.value = Math.pow(10, this.currentReduction / 20);
            
            requestAnimationFrame(process);
        };
        
        process();
    }
    
    _calculateExpansion(db) {
        // For expander: signals BELOW threshold are reduced
        // This is the opposite of a compressor
        
        if (db >= this.threshold + this.knee / 2) {
            // Above threshold + knee - no expansion
            return 0;
        } else if (db <= this.threshold - this.knee / 2) {
            // Below threshold - apply full expansion
            const diff = this.threshold - db;
            return -Math.min(diff * (this.ratio - 1) / this.ratio, this.range);
        } else {
            // In the knee - soft transition
            const kneeStart = this.threshold - this.knee / 2;
            const kneeEnd = this.threshold + this.knee / 2;
            const kneePosition = (db - kneeStart) / this.knee;
            const fullExpansion = -Math.min((this.threshold - db) * (this.ratio - 1) / this.ratio, this.range);
            return fullExpansion * (1 - kneePosition);
        }
    }
    
    setThreshold(value) {
        this.threshold = value;
    }
    
    setRatio(value) {
        this.ratio = value;
    }
    
    setAttack(value) {
        this.attack = value;
    }
    
    setRelease(value) {
        this.release = value;
    }
    
    setRange(value) {
        this.range = value;
    }
    
    setKnee(value) {
        this.knee = value;
    }
    
    getReduction() {
        return this.currentReduction;
    }
    
    connect(destination) {
        this.output.connect(destination);
        return this;
    }
    
    disconnect(destination) {
        this.output.disconnect(destination);
        return this;
    }
    
    dispose() {
        this.input.disconnect();
        this.output.disconnect();
        this.analyzer.disconnect();
        this.gainReduction.disconnect();
    }
}

// Static methods
SpectralExpander.getMetronomeAudioLabel = function() { return 'Spectral Expander'; };

console.log('[SpectralExpander] Module loaded');