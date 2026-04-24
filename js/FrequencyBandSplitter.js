/**
 * Frequency Band Splitter - Split audio into frequency bands
 * Divides audio signal into multiple frequency bands for parallel processing
 */

export class FrequencyBandSplitter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Band definitions (frequencies in Hz)
        this.settings = {
            bandCount: options.bandCount || 4,
            frequencies: options.frequencies || [200, 1000, 4000, 8000], // Crossover points
            types: options.types || ['lowpass', 'bandpass', 'bandpass', 'highpass'],
            ...options
        };
        
        // Create filters for each band
        this.filters = [];
        this.gains = [];
        this.splitChannels = [];
        
        // Master output
        this.output = null;
        this.outputGain = null;
        
        // Band outputs for routing
        this.bandOutputs = [];
        
        this.initialized = false;
    }
    
    /**
     * Initialize the band splitter
     */
    initialize(inputChannel) {
        this.dispose();
        
        // Create crossover filters
        const numBands = this.settings.bandCount + 1;
        const freqs = [20, ...this.settings.frequencies, 20000];
        
        for (let i = 0; i < numBands; i++) {
            const lowFreq = freqs[i];
            const highFreq = freqs[i + 1];
            
            // Create filter node
            const filter = this.audioContext.createBiquadFilter();
            
            if (i === 0) {
                // First band - lowpass
                filter.type = 'lowpass';
                filter.frequency.value = highFreq;
            } else if (i === numBands - 1) {
                // Last band - highpass
                filter.type = 'highpass';
                filter.frequency.value = lowFreq;
            } else {
                // Middle bands - bandpass
                filter.type = 'bandpass';
                filter.frequency.value = (lowFreq + highFreq) / 2;
                filter.Q.value = (highFreq - lowFreq) / (lowFreq + highFreq);
            }
            
            filter.gain.value = 1;
            
            // Create gain node for mixing
            const gain = this.audioContext.createGain();
            gain.gain.value = 1;
            
            this.filters.push(filter);
            this.gains.push(gain);
            
            // Create band output
            const bandOutput = this.audioContext.createGain();
            this.bandOutputs.push(bandOutput);
            
            // Connect filter -> gain -> band output
            filter.connect(gain);
            gain.connect(bandOutput);
        }
        
        // Connect input to all filters
        for (const filter of this.filters) {
            inputChannel.connect(filter);
        }
        
        // Create master output
        this.outputGain = this.audioContext.createGain();
        
        // Mix all bands back together
        for (const bandOutput of this.bandOutputs) {
            bandOutput.connect(this.outputGain);
        }
        
        this.output = this.outputGain;
        this.initialized = true;
        
        return this;
    }
    
    /**
     * Get output for a specific band
     */
    getBandOutput(bandIndex) {
        if (bandIndex >= 0 && bandIndex < this.bandOutputs.length) {
            return this.bandOutputs[bandIndex];
        }
        return null;
    }
    
    /**
     * Get all band outputs
     */
    getAllBandOutputs() {
        return this.bandOutputs;
    }
    
    /**
     * Set gain for a specific band
     */
    setBandGain(bandIndex, gainDb) {
        if (bandIndex >= 0 && bandIndex < this.gains.length) {
            const gainLinear = Math.pow(10, gainDb / 20);
            this.gains[bandIndex].gain.setTargetAtTime(gainLinear, this.audioContext.currentTime, 0.01);
        }
    }
    
    /**
     * Set crossover frequency
     */
    setCrossoverFrequency(bandIndex, frequency) {
        if (bandIndex >= 0 && bandIndex < this.filters.length) {
            this.filters[bandIndex].frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.01);
        }
    }
    
    /**
     * Get frequency bands info
     */
    getBandInfo() {
        const numBands = this.settings.bandCount + 1;
        const freqs = [20, ...this.settings.frequencies, 20000];
        const bands = [];
        
        for (let i = 0; i < numBands; i++) {
            bands.push({
                index: i,
                lowFreq: freqs[i],
                highFreq: freqs[i + 1],
                centerFreq: Math.sqrt(freqs[i] * freqs[i + 1]),
                bandwidth: freqs[i + 1] - freqs[i]
            });
        }
        
        return bands;
    }
    
    /**
     * Apply different processing to each band
     */
    processBands(callback) {
        for (let i = 0; i < this.bandOutputs.length; i++) {
            const bandOutput = this.bandOutputs[i];
            const bandInfo = this.getBandInfo()[i];
            callback(bandOutput, bandInfo, i);
        }
    }
    
    /**
     * Get master output
     */
    getOutput() {
        return this.output;
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        for (const filter of this.filters) {
            try {
                filter.disconnect();
            } catch (e) {}
        }
        
        for (const gain of this.gains) {
            try {
                gain.disconnect();
            } catch (e) {}
        }
        
        for (const output of this.bandOutputs) {
            try {
                output.disconnect();
            } catch (e) {}
        }
        
        if (this.outputGain) {
            try {
                this.outputGain.disconnect();
            } catch (e) {}
        }
        
        this.filters = [];
        this.gains = [];
        this.bandOutputs = [];
        this.outputGain = null;
        this.output = null;
        this.initialized = false;
    }
}

/**
 * Multiband Processor - Apply different effects to each frequency band
 */
export class MultibandProcessor {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.splitter = new FrequencyBandSplitter(audioContext, options);
        
        // Band processors (effects to apply)
        this.bandProcessors = [];
        
        // Merge back
        this.merger = null;
        this.output = null;
        
        this.initialized = false;
    }
    
    /**
     * Initialize with input channel
     */
    initialize(inputChannel) {
        this.splitter.initialize(inputChannel);
        
        // Create band processors
        for (let i = 0; i < this.splitter.settings.bandCount + 1; i++) {
            this.bandProcessors.push({
                effects: [],
                output: this.audioContext.createGain()
            });
        }
        
        // Create merger
        this.merger = this.audioContext.createGain();
        
        // Connect each band through its processor to merger
        const bandOutputs = this.splitter.getAllBandOutputs();
        for (let i = 0; i < bandOutputs.length; i++) {
            bandOutputs[i].connect(this.merger);
        }
        
        this.output = this.merger;
        this.initialized = true;
        
        return this;
    }
    
    /**
     * Add effect to a specific band
     */
    addEffectToBand(bandIndex, effect) {
        if (bandIndex >= 0 && bandIndex < this.bandProcessors.length) {
            this.bandProcessors[bandIndex].effects.push(effect);
        }
    }
    
    /**
     * Remove effect from band
     */
    removeEffectFromBand(bandIndex, effect) {
        if (bandIndex >= 0 && bandIndex < this.bandProcessors.length) {
            const idx = this.bandProcessors[bandIndex].effects.indexOf(effect);
            if (idx >= 0) {
                this.bandProcessors[bandIndex].effects.splice(idx, 1);
            }
        }
    }
    
    /**
     * Set compression per band
     */
    setBandCompression(bandIndex, threshold, ratio, attack, release) {
        const bandOutput = this.splitter.getBandOutput(bandIndex);
        if (!bandOutput) return;
        
        // Create compressor if needed
        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = threshold;
        compressor.ratio.value = ratio;
        compressor.attack.value = attack;
        compressor.release.value = release;
        
        // Insert compressor into chain
        const processor = this.bandProcessors[bandIndex];
        const lastNode = processor.effects.length > 0 
            ? processor.effects[processor.effects.length - 1].output || processor.effects[processor.effects.length - 1]
            : bandOutput;
        
        // Disconnect band from merger
        bandOutput.disconnect(this.merger);
        
        // Connect through compressor
        bandOutput.connect(compressor);
        compressor.connect(this.merger);
        
        processor.effects.push({ input: bandOutput, output: compressor, compressor });
    }
    
    /**
     * Set EQ per band
     */
    setBandEQ(bandIndex, lowGain, highGain) {
        const bandOutput = this.splitter.getBandOutput(bandIndex);
        if (!bandOutput) return;
        
        const eq = this.audioContext.createBiquadFilter();
        eq.type = 'peaking';
        eq.frequency.value = this.splitter.getBandInfo()[bandIndex].centerFreq;
        eq.gain.value = (lowGain + highGain) / 2;
        eq.Q.value = 1;
        
        // Insert EQ into chain
        bandOutput.disconnect(this.merger);
        bandOutput.connect(eq);
        eq.connect(this.merger);
    }
    
    /**
     * Get output
     */
    getOutput() {
        return this.output;
    }
    
    /**
     * Get band outputs for external processing
     */
    getBandOutput(bandIndex) {
        return this.splitter.getBandOutput(bandIndex);
    }
    
    /**
     * Dispose
     */
    dispose() {
        this.splitter.dispose();
        this.bandProcessors = [];
        if (this.merger) {
            try {
                this.merger.disconnect();
            } catch (e) {}
        }
        this.merger = null;
        this.output = null;
        this.initialized = false;
    }
}

// UI Panel for Frequency Band Splitter
export function openFrequencyBandSplitterPanel() {
    // Check if panel already exists
    const existing = document.getElementById('frequency-band-splitter-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'frequency-band-splitter-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #3a3a5e;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 450px;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    panel.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Frequency Band Splitter</h2>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Number of Bands</label>
            <select id="fb-band-count" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                <option value="2">2 Bands (Sub/Mid/High)</option>
                <option value="3">3 Bands (Low/Mid/High)</option>
                <option value="4" selected>4 Bands (Quad)</option>
                <option value="5">5 Bands</option>
                <option value="6">6 Bands</option>
            </select>
        </div>
        
        <div id="band-settings" style="margin-bottom: 16px;">
            <!-- Band settings populated by JS -->
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px;">
            <div id="band-vis-0" style="height: 80px; background: #0a0a14; border-radius: 4px;"></div>
            <div id="band-vis-1" style="height: 80px; background: #0a0a14; border-radius: 4px;"></div>
            <div id="band-vis-2" style="height: 80px; background: #0a0a14; border-radius: 4px;"></div>
            <div id="band-vis-3" style="height: 80px; background: #0a0a14; border-radius: 4px;"></div>
        </div>
        
        <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button id="fb-apply" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                Apply to Selected Track
            </button>
            <button id="fb-close" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Setup event handlers
    panel.querySelector('#fb-band-count').addEventListener('change', (e) => {
        updateBandSettings(parseInt(e.target.value));
    });
    
    panel.querySelector('#fb-close').addEventListener('click', () => {
        panel.remove();
    });
    
    panel.querySelector('#fb-apply').addEventListener('click', () => {
        // Apply band splitter to selected track
        const bandCount = parseInt(panel.querySelector('#fb-band-count').value);
        console.log('Applying frequency band splitter with', bandCount, 'bands');
        panel.remove();
    });
    
    // Initial band settings
    updateBandSettings(4);
    
    function updateBandSettings(bandCount) {
        const container = document.getElementById('band-settings');
        if (!container) return;
        
        const frequencies = [200, 1000, 4000, 8000, 12000];
        const bandNames = ['Sub Bass', 'Bass', 'Low Mid', 'Mid', 'High Mid', 'Presence', 'Brilliance'];
        
        let html = '<div style="display: grid; gap: 12px;">';
        for (let i = 0; i < bandCount - 1; i++) {
            html += `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 80px; font-size: 12px; color: #888;">${bandNames[i]} - ${bandNames[i + 1]}</span>
                    <input type="range" id="fb-freq-${i}" min="50" max="16000" value="${frequencies[i]}" style="flex: 1;">
                    <span id="fb-freq-val-${i}" style="width: 60px; font-size: 12px;">${frequencies[i]} Hz</span>
                </div>
            `;
        }
        html += '</div>';
        
        container.innerHTML = html;
        
        // Add listeners to frequency sliders
        for (let i = 0; i < bandCount - 1; i++) {
            const slider = document.getElementById(`fb-freq-${i}`);
            const display = document.getElementById(`fb-freq-val-${i}`);
            if (slider && display) {
                slider.addEventListener('input', () => {
                    display.textContent = slider.value + ' Hz';
                });
            }
        }
    }
}

// Export singleton
let frequencyBandSplitterInstance = null;

export function getFrequencyBandSplitter(audioContext, options = {}) {
    if (!frequencyBandSplitterInstance) {
        frequencyBandSplitterInstance = new FrequencyBandSplitter(audioContext, options);
    }
    return frequencyBandSplitterInstance;
}