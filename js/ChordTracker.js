/**
 * Chord Tracker - Track chord progressions throughout project
 * Detects and monitors chord changes in real-time and from analysis
 */

export class ChordTracker {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Detection settings
        this.settings = {
            updateRate: options.updateRate || 50, // ms
            sensitivity: options.sensitivity || 0.7,
            minConfidence: options.minConfidence || 0.5,
            historyLength: options.historyLength || 64,
            chordTypes: options.chordTypes || ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7']
        };
        
        // Note names
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Chord templates (intervals from root)
        this.chordTemplates = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'dim': [0, 3, 6],
            'aug': [0, 4, 8],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            '7': [0, 4, 7, 10],
            'maj7': [0, 4, 7, 11],
            'm7': [0, 3, 7, 10],
            'dim7': [0, 3, 6, 9],
            'm7b5': [0, 3, 6, 10],
            'add9': [0, 4, 7, 14],
            '6': [0, 4, 7, 9],
            'm6': [0, 3, 7, 9],
            '9': [0, 4, 7, 10, 14],
            '11': [0, 4, 7, 10, 14, 17],
            '13': [0, 4, 7, 10, 14, 17, 21],
            'power': [0, 7]
        };
        
        // State
        this.currentChord = null;
        this.chordHistory = [];
        this.progression = [];
        this.isActive = false;
        this.analyser = null;
        this.frequencyData = null;
    }
    
    /**
     * Start real-time chord tracking
     */
    start(audioContext, sourceNode) {
        this.audioContext = audioContext;
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 8192;
        this.analyser.smoothingTimeConstant = 0.8;
        
        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        
        sourceNode.connect(this.analyser);
        
        this.isActive = true;
        this.trackingInterval = setInterval(() => this.update(), this.settings.updateRate);
        
        console.log('[ChordTracker] Started real-time tracking');
    }
    
    /**
     * Stop tracking
     */
    stop() {
        this.isActive = false;
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        
        console.log('[ChordTracker] Stopped tracking');
    }
    
    /**
     * Update current chord detection
     */
    update() {
        if (!this.isActive || !this.analyser) return;
        
        this.analyser.getFloatFrequencyData(this.frequencyData);
        
        // Detect chord from frequency data
        const chord = this.detectChordFromSpectrum(this.frequencyData);
        
        if (chord && chord.confidence >= this.settings.minConfidence) {
            // Check if chord changed
            if (!this.currentChord || 
                chord.root !== this.currentChord.root || 
                chord.type !== this.currentChord.type) {
                
                this.currentChord = chord;
                
                // Add to history
                this.chordHistory.push({
                    chord,
                    time: Date.now()
                });
                
                // Limit history
                if (this.chordHistory.length > this.settings.historyLength) {
                    this.chordHistory.shift();
                }
                
                // Update progression
                this.updateProgression(chord);
                
                // Emit event
                this.emitChordChange(chord);
            }
        }
    }
    
    /**
     * Detect chord from frequency spectrum
     */
    detectChordFromSpectrum(spectrum) {
        // Convert spectrum to pitch classes (chroma)
        const chroma = this.spectrumToChroma(spectrum);
        
        // Find best matching chord
        let bestChord = null;
        let bestScore = 0;
        
        for (const [type, intervals] of Object.entries(this.chordTemplates)) {
            if (!this.settings.chordTypes.includes(type) && type !== 'major' && type !== 'minor') {
                continue;
            }
            
            for (let root = 0; root < 12; root++) {
                // Create chord chroma
                const chordChroma = new Float32Array(12);
                for (const interval of intervals) {
                    chordChroma[(root + interval) % 12] = 1;
                }
                
                // Calculate similarity (correlation)
                let score = 0;
                for (let i = 0; i < 12; i++) {
                    score += chroma[i] * chordChroma[i];
                }
                
                // Normalize by chord size
                score /= intervals.length;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestChord = {
                        root: this.noteNames[root],
                        rootIndex: root,
                        type,
                        intervals,
                        confidence: score,
                        notes: intervals.map(i => this.noteNames[(root + i) % 12])
                    };
                }
            }
        }
        
        return bestChord;
    }
    
    /**
     * Convert spectrum to chroma vector
     */
    spectrumToChroma(spectrum) {
        const chroma = new Float32Array(12);
        const binCount = spectrum.length;
        const nyquist = this.audioContext.sampleRate / 2;
        const binHz = nyquist / binCount;
        
        // Reference frequency (A4 = 440Hz)
        const refFreq = 440;
        const refBin = refFreq / binHz;
        
        for (let bin = 0; bin < binCount; bin++) {
            // Skip very low and very high bins
            if (bin < 10 || bin > binCount / 2) continue;
            
            const freq = bin * binHz;
            
            // Convert frequency to pitch class
            const midi = 69 + 12 * Math.log2(freq / refFreq);
            const pitchClass = Math.round(midi) % 12;
            
            // Convert from dB to linear
            const magnitude = Math.pow(10, spectrum[bin] / 20);
            
            chroma[pitchClass] += magnitude;
        }
        
        // Normalize
        const max = Math.max(...chroma);
        if (max > 0) {
            for (let i = 0; i < 12; i++) {
                chroma[i] /= max;
            }
        }
        
        return chroma;
    }
    
    /**
     * Update chord progression tracking
     */
    updateProgression(newChord) {
        // Get chord symbol
        const symbol = this.chordToSymbol(newChord);
        
        // Check if this chord is different from the last in progression
        if (this.progression.length === 0 || 
            this.progression[this.progression.length - 1].symbol !== symbol) {
            
            this.progression.push({
                chord: newChord,
                symbol,
                time: Date.now(),
                position: this.progression.length
            });
        }
    }
    
    /**
     * Convert chord to symbol
     */
    chordToSymbol(chord) {
        const root = chord.root;
        const type = chord.type;
        
        // Format chord symbol
        let symbol = root;
        
        switch (type) {
            case 'major': break; // Just root
            case 'minor': symbol += 'm'; break;
            case 'dim': symbol += 'dim'; break;
            case 'aug': symbol += 'aug'; break;
            case 'sus2': symbol += 'sus2'; break;
            case 'sus4': symbol += 'sus4'; break;
            case '7': symbol += '7'; break;
            case 'maj7': symbol += 'maj7'; break;
            case 'm7': symbol += 'm7'; break;
            case 'dim7': symbol += 'dim7'; break;
            case 'm7b5': symbol += 'm7b5'; break;
            case 'add9': symbol += 'add9'; break;
            case '6': symbol += '6'; break;
            case 'm6': symbol += 'm6'; break;
            case 'power': symbol += '5'; break;
            default: symbol += type;
        }
        
        return symbol;
    }
    
    /**
     * Detect chord from MIDI notes
     */
    detectChordFromMIDI(notes) {
        if (notes.length === 0) return null;
        
        // Get pitch classes from notes
        const pitchClasses = new Set(notes.map(n => n % 12));
        const chroma = new Float32Array(12);
        
        for (const pc of pitchClasses) {
            chroma[pc] = 1;
        }
        
        // Find best matching chord
        let bestChord = null;
        let bestScore = 0;
        
        for (const [type, intervals] of Object.entries(this.chordTemplates)) {
            for (let root = 0; root < 12; root++) {
                // Count matching notes
                let matches = 0;
                for (const interval of intervals) {
                    if (pitchClasses.has((root + interval) % 12)) {
                        matches++;
                    }
                }
                
                // Penalize missing notes and extra notes
                const score = matches - (intervals.length - matches) * 0.5;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestChord = {
                        root: this.noteNames[root],
                        rootIndex: root,
                        type,
                        intervals,
                        confidence: matches / intervals.length,
                        notes: intervals.map(i => this.noteNames[(root + i) % 12])
                    };
                }
            }
        }
        
        return bestChord;
    }
    
    /**
     * Analyze audio buffer for chord progression
     */
    async analyzeBuffer(audioBuffer) {
        const sampleRate = audioBuffer.sampleRate;
        const hopSize = 4096;
        const fftSize = 8192;
        
        // Get mono data
        const mono = this.getMonoData(audioBuffer);
        
        const chords = [];
        let lastChord = null;
        
        for (let i = 0; i < mono.length - fftSize; i += hopSize) {
            // Extract frame
            const frame = mono.slice(i, i + fftSize);
            
            // Simple spectrum computation
            const spectrum = this.computeSpectrum(frame, fftSize);
            
            // Detect chord
            const chord = this.detectChordFromSpectrum(spectrum);
            
            if (chord && chord.confidence >= this.settings.minConfidence) {
                const time = i / sampleRate;
                
                // Only add if different from last chord
                if (!lastChord || 
                    chord.root !== lastChord.chord.root || 
                    chord.type !== lastChord.chord.type) {
                    
                    chords.push({
                        chord,
                        time,
                        symbol: this.chordToSymbol(chord)
                    });
                    
                    lastChord = chords[chords.length - 1];
                }
            }
        }
        
        return chords;
    }
    
    /**
     * Get mono data
     */
    getMonoData(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
        const mono = new Float32Array(audioBuffer.length);
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const data = audioBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                mono[i] += data[i] / audioBuffer.numberOfChannels;
            }
        }
        
        return mono;
    }
    
    /**
     * Compute spectrum
     */
    computeSpectrum(frame, fftSize) {
        const spectrum = new Float32Array(fftSize / 2);
        
        // Simple DFT
        for (let k = 0; k < fftSize / 2; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < fftSize; n++) {
                const window = 0.5 * (1 - Math.cos(2 * Math.PI * n / fftSize));
                const sample = (frame[n] || 0) * window;
                real += sample * Math.cos(2 * Math.PI * k * n / fftSize);
                imag -= sample * Math.sin(2 * Math.PI * k * n / fftSize);
            }
            
            // Convert to dB
            const mag = Math.sqrt(real * real + imag * imag);
            spectrum[k] = 20 * Math.log10(mag + 1e-10);
        }
        
        return spectrum;
    }
    
    /**
     * Get current chord
     */
    getCurrentChord() {
        return this.currentChord;
    }
    
    /**
     * Get chord history
     */
    getHistory() {
        return this.chordHistory;
    }
    
    /**
     * Get progression
     */
    getProgression() {
        return this.progression;
    }
    
    /**
     * Analyze progression for patterns
     */
    analyzeProgressionPattern() {
        if (this.progression.length < 4) return null;
        
        // Common progressions
        const commonProgressions = [
            { name: 'I-IV-V-I', pattern: ['I', 'IV', 'V', 'I'] },
            { name: 'I-V-vi-IV', pattern: ['I', 'V', 'vi', 'IV'] },
            { name: 'ii-V-I', pattern: ['ii', 'V', 'I'] },
            { name: 'I-vi-IV-V', pattern: ['I', 'vi', 'IV', 'V'] },
            { name: 'vi-IV-I-V', pattern: ['vi', 'IV', 'I', 'V'] },
            { name: 'I-V-IV-V', pattern: ['I', 'V', 'IV', 'V'] },
            { name: 'I-bVII-IV-I', pattern: ['I', 'bVII', 'IV', 'I'] }
        ];
        
        // Get Roman numeral representation
        const romanSymbols = this.progression.map(c => this.toRomanNumeral(c.chord));
        
        // Check for matches
        for (const prog of commonProgressions) {
            const lastSymbols = romanSymbols.slice(-prog.pattern.length);
            if (JSON.stringify(lastSymbols) === JSON.stringify(prog.pattern)) {
                return prog;
            }
        }
        
        return null;
    }
    
    /**
     * Convert chord to Roman numeral (assuming key)
     */
    toRomanNumeral(chord, key = 0) {
        const degree = (chord.rootIndex - key + 12) % 12;
        const romanNumerals = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
        const minorQualities = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'];
        
        let numeral = romanNumerals[degree];
        
        // Adjust for minor/other qualities
        if (chord.type === 'minor' && !numeral.startsWith('b')) {
            numeral = numeral.toLowerCase();
        }
        
        return numeral;
    }
    
    /**
     * Emit chord change event
     */
    emitChordChange(chord) {
        const event = new CustomEvent('chordchange', { detail: chord });
        window.dispatchEvent(event);
    }
    
    /**
     * Create UI panel
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'chord-tracker-panel';
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
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Chord Tracker</h2>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 20px; margin-bottom: 16px; text-align: center;">
                <div style="font-size: 48px; font-weight: bold; color: #10b981;" id="ct-current-chord">--</div>
                <div style="font-size: 14px; color: #888; margin-top: 8px;" id="ct-chord-type">No chord detected</div>
                <div style="font-size: 12px; color: #666; margin-top: 4px;" id="ct-confidence">Confidence: --</div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Chord Notes</div>
                <div id="ct-notes" style="display: flex; gap: 4px; justify-content: center;">
                    ${this.noteNames.map(n => `<div class="note-indicator" data-note="${n}" style="
                        width: 28px;
                        height: 28px;
                        border-radius: 4px;
                        background: #2a2a4e;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 11px;
                    ">${n}</div>`).join('')}
                </div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px; max-height: 150px; overflow-y: auto;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Progression</div>
                <div id="ct-progression" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <div style="color: #666; font-size: 12px;">No progression yet</div>
                </div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Detected Pattern</div>
                <div id="ct-pattern" style="font-size: 14px; color: #f59e0b;">--</div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="ct-toggle-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Start Tracking
                </button>
                <button id="ct-clear-btn" style="flex: 1; padding: 12px; background: #f59e0b; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Clear History
                </button>
                <button id="ct-close-btn" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        // Listen for chord changes
        window.addEventListener('chordchange', (e) => {
            this.updateUI(e.detail);
        });
        
        return panel;
    }
    
    setupUIEvents(panel) {
        panel.querySelector('#ct-toggle-btn').addEventListener('click', () => {
            if (this.isActive) {
                this.stop();
                panel.querySelector('#ct-toggle-btn').textContent = 'Start Tracking';
                panel.querySelector('#ct-toggle-btn').style.background = '#10b981';
            } else {
                console.log('[ChordTracker] Start - connect to audio source');
                panel.querySelector('#ct-toggle-btn').textContent = 'Stop Tracking';
                panel.querySelector('#ct-toggle-btn').style.background = '#ef4444';
            }
        });
        
        panel.querySelector('#ct-clear-btn').addEventListener('click', () => {
            this.chordHistory = [];
            this.progression = [];
            this.updateProgressionDisplay();
        });
        
        panel.querySelector('#ct-close-btn').addEventListener('click', () => {
            this.stop();
            panel.remove();
        });
    }
    
    updateUI(chord) {
        const panel = document.querySelector('#chord-tracker-panel');
        if (!panel) return;
        
        // Update current chord display
        const symbol = this.chordToSymbol(chord);
        panel.querySelector('#ct-current-chord').textContent = symbol;
        panel.querySelector('#ct-chord-type').textContent = chord.type + ' chord';
        panel.querySelector('#ct-confidence').textContent = `Confidence: ${Math.round(chord.confidence * 100)}%`;
        
        // Update note indicators
        const indicators = panel.querySelectorAll('.note-indicator');
        indicators.forEach(ind => {
            const note = ind.dataset.note;
            if (chord.notes.includes(note)) {
                ind.style.background = '#10b981';
            } else {
                ind.style.background = '#2a2a4e';
            }
        });
        
        // Update progression display
        this.updateProgressionDisplay();
        
        // Check for patterns
        const pattern = this.analyzeProgressionPattern();
        if (pattern) {
            panel.querySelector('#ct-pattern').textContent = `Detected: ${pattern.name}`;
        }
    }
    
    updateProgressionDisplay() {
        const progDiv = document.querySelector('#ct-progression');
        if (!progDiv) return;
        
        if (this.progression.length === 0) {
            progDiv.innerHTML = '<div style="color: #666; font-size: 12px;">No progression yet</div>';
        } else {
            progDiv.innerHTML = this.progression.slice(-16).map(p => `
                <div style="
                    padding: 4px 8px;
                    background: #2a2a4e;
                    border-radius: 4px;
                    font-size: 14px;
                ">${p.symbol}</div>
            `).join('');
        }
    }
}

// Export singleton
let chordTrackerInstance = null;

export function getChordTracker(options = {}) {
    if (!chordTrackerInstance) {
        chordTrackerInstance = new ChordTracker(options);
    }
    return chordTrackerInstance;
}

export function openChordTrackerPanel() {
    const tracker = getChordTracker();
    return tracker.createUI();
}