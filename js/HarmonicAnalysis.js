// js/HarmonicAnalysis.js - Real-time Harmonic Analysis for SnugOS DAW
// Provides chord detection, key detection, and harmonic analysis from audio input

/**
 * HarmonicAnalysis provides:
 * - Real-time chord detection
 * - Key detection from audio
 * - Chord progression analysis
 * - Harmonic content visualization
 * - Beat-synchronous analysis
 */

/**
 * Musical keys
 */
export const MusicalKey = {
    C_MAJOR: 'C major',
    C_SHARP_MAJOR: 'C# major',
    D_MAJOR: 'D major',
    E_FLAT_MAJOR: 'Eb major',
    E_MAJOR: 'E major',
    F_MAJOR: 'F major',
    F_SHARP_MAJOR: 'F# major',
    G_MAJOR: 'G major',
    A_FLAT_MAJOR: 'Ab major',
    A_MAJOR: 'A major',
    B_FLAT_MAJOR: 'Bb major',
    B_MAJOR: 'B major',
    C_MINOR: 'C minor',
    C_SHARP_MINOR: 'C# minor',
    D_MINOR: 'D minor',
    E_FLAT_MINOR: 'Eb minor',
    E_MINOR: 'E minor',
    F_MINOR: 'F minor',
    F_SHARP_MINOR: 'F# minor',
    G_MINOR: 'G minor',
    G_SHARP_MINOR: 'G# minor',
    A_MINOR: 'A minor',
    B_FLAT_MINOR: 'Bb minor',
    B_MINOR: 'B minor'
};

/**
 * Common chord types
 */
export const ChordType = {
    MAJOR: { intervals: [0, 4, 7], symbol: '', name: 'major' },
    MINOR: { intervals: [0, 3, 7], symbol: 'm', name: 'minor' },
    DIMINISHED: { intervals: [0, 3, 6], symbol: 'dim', name: 'diminished' },
    AUGMENTED: { intervals: [0, 4, 8], symbol: 'aug', name: 'augmented' },
    SUS2: { intervals: [0, 2, 7], symbol: 'sus2', name: 'suspended 2' },
    SUS4: { intervals: [0, 5, 7], symbol: 'sus4', name: 'suspended 4' },
    SEVENTH: { intervals: [0, 4, 7, 10], symbol: '7', name: 'dominant 7th' },
    MAJOR_SEVENTH: { intervals: [0, 4, 7, 11], symbol: 'maj7', name: 'major 7th' },
    MINOR_SEVENTH: { intervals: [0, 3, 7, 10], symbol: 'm7', name: 'minor 7th' },
    MINOR_MAJOR_SEVENTH: { intervals: [0, 3, 7, 11], symbol: 'mMaj7', name: 'minor-major 7th' },
    DIMINISHED_SEVENTH: { intervals: [0, 3, 6, 9], symbol: 'dim7', name: 'diminished 7th' },
    HALF_DIMINISHED: { intervals: [0, 3, 6, 10], symbol: 'm7b5', name: 'half diminished' },
    NINTH: { intervals: [0, 4, 7, 10, 14], symbol: '9', name: 'dominant 9th' },
    MAJOR_NINTH: { intervals: [0, 4, 7, 11, 14], symbol: 'maj9', name: 'major 9th' },
    MINOR_NINTH: { intervals: [0, 3, 7, 10, 14], symbol: 'm9', name: 'minor 9th' },
    POWER: { intervals: [0, 7], symbol: '5', name: 'power chord' }
};

/**
 * Note names
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Krumhansl-Schmuckler key profiles for major and minor keys
 */
const KEY_PROFILES = {
    major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
};

/**
 * DetectedChord - Represents a detected chord
 */
export class DetectedChord {
    constructor(options = {}) {
        this.root = options.root || 0;           // Root note (0-11)
        this.rootName = options.rootName || 'C'; // Root note name
        this.type = options.type || ChordType.MAJOR;
        this.typeName = options.typeName || 'major';
        this.symbol = options.symbol || '';     // Chord symbol (e.g., 'Am', 'C7')
        this.fullName = options.fullName || ''; // Full name (e.g., 'A minor', 'C dominant 7th')
        this.confidence = options.confidence || 0; // Detection confidence (0-1)
        this.time = options.time || 0;          // Detection time
        this.duration = options.duration || 0;  // Duration held
        this.notes = options.notes || [];       // Detected notes (MIDI numbers)
        this.bass = options.bass || 0;          // Bass note (lowest detected)
    }
    
    /**
     * Get chord as string
     */
    toString() {
        return this.symbol || this.fullName;
    }
    
    /**
     * Check if chord is major
     */
    isMajor() {
        return this.type === ChordType.MAJOR || this.type === ChordType.MAJOR_SEVENTH || this.type === ChordType.MAJOR_NINTH;
    }
    
    /**
     * Check if chord is minor
     */
    isMinor() {
        return this.type === ChordType.MINOR || this.type === ChordType.MINOR_SEVENTH || this.type === ChordType.MINOR_NINTH;
    }
    
    /**
     * Check if chord is diminished
     */
    isDiminished() {
        return this.type === ChordType.DIMINISHED || this.type === ChordType.DIMINISHED_SEVENTH || this.type === ChordType.HALF_DIMINISHED;
    }
}

/**
 * DetectedKey - Represents a detected musical key
 */
export class DetectedKey {
    constructor(options = {}) {
        this.tonic = options.tonic || 0;         // Tonic note (0-11)
        this.tonicName = options.tonicName || 'C';
        this.mode = options.mode || 'major';     // 'major' or 'minor'
        this.name = options.name || 'C major';
        this.confidence = options.confidence || 0;
        this.correlation = options.correlation || 0;
        this.time = options.time || Date.now();
    }
    
    /**
     * Get relative key
     */
    getRelativeKey() {
        if (this.mode === 'major') {
            // Relative minor is 3 semitones below
            const minorTonic = (this.tonic + 9) % 12;
            return new DetectedKey({
                tonic: minorTonic,
                tonicName: NOTE_NAMES[minorTonic],
                mode: 'minor',
                name: `${NOTE_NAMES[minorTonic]} minor`,
                confidence: this.confidence * 0.9
            });
        } else {
            // Relative major is 3 semitones above
            const majorTonic = (this.tonic + 3) % 12;
            return new DetectedKey({
                tonic: majorTonic,
                tonicName: NOTE_NAMES[majorTonic],
                mode: 'major',
                name: `${NOTE_NAMES[majorTonic]} major`,
                confidence: this.confidence * 0.9
            });
        }
    }
    
    /**
     * Get key signature (number of sharps/flats)
     */
    getKeySignature() {
        const majorSignatures = {
            'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6,
            'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6
        };
        
        const minorSignatures = {
            'A': 0, 'E': 1, 'B': 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6,
            'D': -1, 'G': -2, 'C': -3, 'F': -4, 'Bb': -5, 'Eb': -6
        };
        
        if (this.mode === 'major') {
            return majorSignatures[this.tonicName] || 0;
        } else {
            return minorSignatures[this.tonicName] || 0;
        }
    }
    
    /**
     * Check if a note is in key
     */
    isNoteInKey(noteNumber) {
        const pitchClass = noteNumber % 12;
        const scale = this.mode === 'major' 
            ? [0, 2, 4, 5, 7, 9, 11]  // Major scale intervals
            : [0, 2, 3, 5, 7, 8, 10]; // Minor scale intervals
        
        const inScale = scale.map(interval => (this.tonic + interval) % 12);
        return inScale.includes(pitchClass);
    }
}

/**
 * HarmonicAnalyzer - Main analysis engine
 */
export class HarmonicAnalyzer {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = options.sampleRate || 44100;
        
        // Analysis settings
        this.settings = {
            fftSize: 4096,
            hopSize: 2048,
            minFrequency: 80,      // Minimum frequency for analysis
            maxFrequency: 2000,     // Maximum frequency for analysis
            minAmplitude: 0.01,     // Minimum amplitude threshold
            chordHoldTime: 0.5,     // Time to hold chord before changing
            keyAnalysisWindow: 10   // Seconds of audio for key detection
        };
        
        // Analysis state
        this.analyserNode = null;
        this.isAnalyzing = false;
        this.analysisInterval = null;
        
        // Detection results
        this.currentChord = null;
        this.currentKey = null;
        this.chordHistory = [];
        this.keyHistory = [];
        this.noteBuffer = [];       // Recent detected notes
        
        // Frequency data
        this.frequencyData = null;
        this.pitchClasses = new Array(12).fill(0); // Chromagram
        
        // Callbacks
        this.onChordDetected = null;
        this.onKeyDetected = null;
        this.onNotesDetected = null;
    }
    
    /**
     * Initialize analyzer with audio context
     */
    init(audioContext) {
        this.audioContext = audioContext;
        this.sampleRate = audioContext.sampleRate;
        
        // Create analyser node
        this.analyserNode = audioContext.createAnalyser();
        this.analyserNode.fftSize = this.settings.fftSize;
        this.analyserNode.smoothingTimeConstant = 0.3;
        
        this.frequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
    }
    
    /**
     * Connect to audio source
     */
    connect(sourceNode) {
        if (!this.analyserNode) {
            console.error('[HarmonicAnalysis] Not initialized');
            return;
        }
        sourceNode.connect(this.analyserNode);
    }
    
    /**
     * Start real-time analysis
     */
    startAnalysis(callbacks = {}) {
        if (!this.analyserNode) {
            console.error('[HarmonicAnalysis] Not initialized');
            return;
        }
        
        this.onChordDetected = callbacks.onChordDetected;
        this.onKeyDetected = callbacks.onKeyDetected;
        this.onNotesDetected = callbacks.onNotesDetected;
        
        this.isAnalyzing = true;
        this.chordHistory = [];
        this.keyHistory = [];
        
        const analysisInterval = Math.floor(this.settings.hopSize / this.sampleRate * 1000);
        
        this.analysisInterval = setInterval(() => {
            this.analyze();
        }, analysisInterval);
        
        console.log('[HarmonicAnalysis] Started analysis');
    }
    
    /**
     * Stop real-time analysis
     */
    stopAnalysis() {
        this.isAnalyzing = false;
        
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        
        console.log('[HarmonicAnalysis] Stopped analysis');
    }
    
    /**
     * Perform analysis on current audio frame
     */
    analyze() {
        if (!this.analyserNode || !this.isAnalyzing) return;
        
        // Get frequency data
        this.analyserNode.getFloatFrequencyData(this.frequencyData);
        
        // Convert to pitch classes (chromagram)
        this.computeChromagram();
        
        // Detect notes
        const notes = this.detectNotes();
        
        if (this.onNotesDetected) {
            this.onNotesDetected(notes);
        }
        
        // Detect chord
        const chord = this.detectChord();
        
        if (chord && (!this.currentChord || chord.symbol !== this.currentChord.symbol)) {
            this.currentChord = chord;
            this.chordHistory.push(chord);
            
            if (this.onChordDetected) {
                this.onChordDetected(chord);
            }
        }
        
        // Detect key periodically
        if (this.noteBuffer.length > 50 && this.keyHistory.length === 0) {
            this.detectKey();
        }
    }
    
    /**
     * Compute chromagram from frequency data
     */
    computeChromagram() {
        // Reset pitch classes
        this.pitchClasses.fill(0);
        
        const binCount = this.analyserNode.frequencyBinCount;
        const binFrequency = this.sampleRate / this.settings.fftSize;
        
        for (let i = 0; i < binCount; i++) {
            const frequency = i * binFrequency;
            
            // Skip out of range frequencies
            if (frequency < this.settings.minFrequency || frequency > this.settings.maxFrequency) {
                continue;
            }
            
            // Convert frequency to pitch class
            const pitchClass = this.frequencyToPitchClass(frequency);
            
            // Add magnitude to pitch class
            const magnitude = Math.pow(10, this.frequencyData[i] / 20); // dB to linear
            this.pitchClasses[pitchClass] += magnitude;
        }
        
        // Normalize
        const max = Math.max(...this.pitchClasses);
        if (max > 0) {
            this.pitchClasses = this.pitchClasses.map(p => p / max);
        }
    }
    
    /**
     * Convert frequency to pitch class (0-11)
     */
    frequencyToPitchClass(frequency) {
        // A4 = 440Hz = note 69 in MIDI
        const noteNumber = 69 + 12 * Math.log2(frequency / 440);
        return Math.round(noteNumber) % 12;
    }
    
    /**
     * Convert MIDI note to frequency
     */
    midiToFrequency(noteNumber) {
        return 440 * Math.pow(2, (noteNumber - 69) / 12);
    }
    
    /**
     * Detect active notes
     */
    detectNotes() {
        const notes = [];
        const threshold = this.settings.minAmplitude;
        
        for (let pc = 0; pc < 12; pc++) {
            if (this.pitchClasses[pc] > threshold) {
                // Find best octave
                const bestOctave = this.findBestOctave(pc);
                const midiNote = pc + (bestOctave + 1) * 12;
                
                notes.push({
                    pitchClass: pc,
                    noteName: NOTE_NAMES[pc],
                    midiNote: midiNote,
                    amplitude: this.pitchClasses[pc],
                    frequency: this.midiToFrequency(midiNote)
                });
                
                // Add to note buffer for key detection
                this.noteBuffer.push(pc);
                if (this.noteBuffer.length > 1000) {
                    this.noteBuffer.shift();
                }
            }
        }
        
        return notes;
    }
    
    /**
     * Find best octave for a pitch class
     */
    findBestOctave(pitchClass) {
        // Simplified - just return octave 4 as default
        return 4;
    }
    
    /**
     * Detect chord from chromagram
     */
    detectChord() {
        // Find root candidate (strongest pitch class)
        let maxVal = 0;
        let root = 0;
        
        for (let i = 0; i < 12; i++) {
            if (this.pitchClasses[i] > maxVal) {
                maxVal = this.pitchClasses[i];
                root = i;
            }
        }
        
        if (maxVal < this.settings.minAmplitude) {
            return null;
        }
        
        // Test each chord type at this root
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [typeName, chordType] of Object.entries(ChordType)) {
            const score = this.scoreChord(root, chordType.intervals);
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    root,
                    type: chordType,
                    typeName,
                    score
                };
            }
        }
        
        if (!bestMatch || bestScore < 0.5) {
            return null;
        }
        
        // Build detected chord
        const rootName = NOTE_NAMES[bestMatch.root];
        const symbol = rootName + bestMatch.type.symbol;
        const fullName = `${rootName} ${bestMatch.type.name}`;
        
        return new DetectedChord({
            root: bestMatch.root,
            rootName,
            type: bestMatch.type,
            typeName: bestMatch.typeName,
            symbol,
            fullName,
            confidence: bestScore,
            time: Date.now(),
            notes: this.detectNotes().map(n => n.midiNote)
        });
    }
    
    /**
     * Score a chord candidate
     */
    scoreChord(root, intervals) {
        let score = 0;
        let total = intervals.length;
        
        for (const interval of intervals) {
            const pc = (root + interval) % 12;
            score += this.pitchClasses[pc];
        }
        
        // Penalize non-chord tones
        for (let pc = 0; pc < 12; pc++) {
            if (!intervals.map(i => (root + i) % 12).includes(pc)) {
                if (this.pitchClasses[pc] > 0.3) {
                    score -= this.pitchClasses[pc] * 0.3;
                }
            }
        }
        
        return Math.max(0, score / total);
    }
    
    /**
     * Detect key from note buffer
     */
    detectKey() {
        if (this.noteBuffer.length < 50) {
            return null;
        }
        
        // Count pitch class occurrences
        const pcCounts = new Array(12).fill(0);
        for (const pc of this.noteBuffer) {
            pcCounts[pc]++;
        }
        
        // Normalize
        const total = pcCounts.reduce((a, b) => a + b, 0);
        const normalized = pcCounts.map(c => c / total);
        
        // Correlate with key profiles
        let bestKey = null;
        let bestCorrelation = -Infinity;
        
        for (let tonic = 0; tonic < 12; tonic++) {
            // Test major
            const majorCorr = this.correlate(normalized, KEY_PROFILES.major, tonic);
            if (majorCorr > bestCorrelation) {
                bestCorrelation = majorCorr;
                bestKey = new DetectedKey({
                    tonic,
                    tonicName: NOTE_NAMES[tonic],
                    mode: 'major',
                    name: `${NOTE_NAMES[tonic]} major`,
                    confidence: (majorCorr + 1) / 2,
                    correlation: majorCorr
                });
            }
            
            // Test minor
            const minorCorr = this.correlate(normalized, KEY_PROFILES.minor, tonic);
            if (minorCorr > bestCorrelation) {
                bestCorrelation = minorCorr;
                bestKey = new DetectedKey({
                    tonic,
                    tonicName: NOTE_NAMES[tonic],
                    mode: 'minor',
                    name: `${NOTE_NAMES[tonic]} minor`,
                    confidence: (minorCorr + 1) / 2,
                    correlation: minorCorr
                });
            }
        }
        
        if (bestKey) {
            this.currentKey = bestKey;
            this.keyHistory.push(bestKey);
            
            if (this.onKeyDetected) {
                this.onKeyDetected(bestKey);
            }
        }
        
        return bestKey;
    }
    
    /**
     * Correlate pitch class profile with key profile
     */
    correlate(pitchClasses, keyProfile, tonic) {
        // Rotate key profile to start at tonic
        const rotatedProfile = [];
        for (let i = 0; i < 12; i++) {
            rotatedProfile.push(keyProfile[(i + tonic) % 12]);
        }
        
        // Calculate Pearson correlation
        const mean1 = pitchClasses.reduce((a, b) => a + b, 0) / 12;
        const mean2 = rotatedProfile.reduce((a, b) => a + b, 0) / 12;
        
        let numerator = 0;
        let denom1 = 0;
        let denom2 = 0;
        
        for (let i = 0; i < 12; i++) {
            const diff1 = pitchClasses[i] - mean1;
            const diff2 = rotatedProfile[i] - mean2;
            
            numerator += diff1 * diff2;
            denom1 += diff1 * diff1;
            denom2 += diff2 * diff2;
        }
        
        const denominator = Math.sqrt(denom1 * denom2);
        
        if (denominator === 0) return 0;
        
        return numerator / denominator;
    }
    
    /**
     * Analyze audio buffer (offline analysis)
     */
    analyzeAudioBuffer(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        const results = {
            chords: [],
            key: null,
            notes: []
        };
        
        // Process in windows
        const windowSize = Math.floor(this.settings.fftSize);
        const hopSize = Math.floor(this.settings.hopSize);
        
        for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
            // Extract window
            const window = channelData.slice(i, i + windowSize);
            const time = i / sampleRate;
            
            // Simple FFT approximation (would use proper FFT in production)
            const pitchClasses = this.simplePitchDetection(window, sampleRate);
            
            // Detect chord at this window
            const chord = this.detectChordFromPitchClasses(pitchClasses, time);
            
            if (chord) {
                results.chords.push(chord);
            }
        }
        
        // Detect overall key
        results.key = this.detectKeyFromChords(results.chords);
        
        return results;
    }
    
    /**
     * Simple pitch detection (autocorrelation-based)
     */
    simplePitchDetection(samples, sampleRate) {
        const pitchClasses = new Array(12).fill(0);
        const minPeriod = Math.floor(sampleRate / this.settings.maxFrequency);
        const maxPeriod = Math.floor(sampleRate / this.settings.minFrequency);
        
        // Autocorrelation
        for (let period = minPeriod; period < maxPeriod; period++) {
            let correlation = 0;
            
            for (let i = 0; i < samples.length - period; i++) {
                correlation += samples[i] * samples[i + period];
            }
            
            // Normalize
            correlation /= (samples.length - period);
            
            // Find peaks
            if (correlation > 0.5) {
                const frequency = sampleRate / period;
                const pc = this.frequencyToPitchClass(frequency);
                pitchClasses[pc] = Math.max(pitchClasses[pc], correlation);
            }
        }
        
        return pitchClasses;
    }
    
    /**
     * Detect chord from pitch classes
     */
    detectChordFromPitchClasses(pitchClasses, time) {
        // Find strongest pitch class as root
        let maxVal = 0;
        let root = 0;
        
        for (let i = 0; i < 12; i++) {
            if (pitchClasses[i] > maxVal) {
                maxVal = pitchClasses[i];
                root = i;
            }
        }
        
        if (maxVal < 0.1) return null;
        
        // Score each chord type
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [typeName, chordType] of Object.entries(ChordType)) {
            let score = 0;
            
            for (const interval of chordType.intervals) {
                const pc = (root + interval) % 12;
                score += pitchClasses[pc];
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { root, type: chordType, typeName };
            }
        }
        
        if (!bestMatch) return null;
        
        const rootName = NOTE_NAMES[bestMatch.root];
        
        return new DetectedChord({
            root: bestMatch.root,
            rootName,
            type: bestMatch.type,
            typeName: bestMatch.typeName,
            symbol: rootName + bestMatch.type.symbol,
            fullName: `${rootName} ${bestMatch.type.name}`,
            confidence: bestScore / bestMatch.type.intervals.length,
            time
        });
    }
    
    /**
     * Detect key from chord progression
     */
    detectKeyFromChords(chords) {
        if (chords.length === 0) return null;
        
        // Count chord occurrences by root
        const rootCounts = new Array(12).fill(0);
        
        for (const chord of chords) {
            rootCounts[chord.root]++;
        }
        
        // Most common chord is likely the key
        let maxCount = 0;
        let tonic = 0;
        
        for (let i = 0; i < 12; i++) {
            if (rootCounts[i] > maxCount) {
                maxCount = rootCounts[i];
                tonic = i;
            }
        }
        
        // Determine major or minor based on chord types
        let majorCount = 0;
        let minorCount = 0;
        
        for (const chord of chords) {
            if (chord.root === tonic) {
                if (chord.isMajor()) majorCount++;
                else if (chord.isMinor()) minorCount++;
            }
        }
        
        const mode = majorCount >= minorCount ? 'major' : 'minor';
        
        return new DetectedKey({
            tonic,
            tonicName: NOTE_NAMES[tonic],
            mode,
            name: `${NOTE_NAMES[tonic]} ${mode}`,
            confidence: maxCount / chords.length
        });
    }
    
    /**
     * Get chord progression analysis
     */
    getChordProgression() {
        if (this.chordHistory.length < 2) return null;
        
        // Remove duplicates (same chord held)
        const uniqueChords = [];
        let lastChord = null;
        
        for (const chord of this.chordHistory) {
            if (!lastChord || chord.symbol !== lastChord.symbol) {
                uniqueChords.push(chord);
                lastChord = chord;
            }
        }
        
        return {
            chords: uniqueChords,
            numerals: this.toRomanNumerals(uniqueChords),
            symbols: uniqueChords.map(c => c.symbol)
        };
    }
    
    /**
     * Convert chord progression to Roman numerals
     */
    toRomanNumerals(chords) {
        if (!this.currentKey || chords.length === 0) return [];
        
        const numerals = [];
        const tonic = this.currentKey.tonic;
        const mode = this.currentKey.mode;
        
        // Scale degrees
        const majorNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
        const minorNumerals = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
        
        for (const chord of chords) {
            const interval = (chord.root - tonic + 12) % 12;
            const scaleDegrees = mode === 'major'
                ? [0, 2, 4, 5, 7, 9, 11]
                : [0, 2, 3, 5, 7, 8, 10];
            
            const degreeIndex = scaleDegrees.indexOf(interval);
            
            if (degreeIndex !== -1) {
                const numeral = mode === 'major'
                    ? majorNumerals[degreeIndex]
                    : minorNumerals[degreeIndex];
                numerals.push(numeral);
            } else {
                numerals.push('?' + NOTE_NAMES[chord.root]);
            }
        }
        
        return numerals;
    }
    
    /**
     * Clear history
     */
    clearHistory() {
        this.chordHistory = [];
        this.keyHistory = [];
        this.noteBuffer = [];
        this.currentChord = null;
        this.currentKey = null;
    }
    
    /**
     * Dispose analyzer
     */
    dispose() {
        this.stopAnalysis();
        this.analyserNode = null;
        this.clearHistory();
    }
}

/**
 * Create a HarmonicAnalyzer instance
 */
export function createHarmonicAnalyzer(options = {}) {
    return new HarmonicAnalyzer(options);
}

// Default export
export default {
    MusicalKey,
    ChordType,
    DetectedChord,
    DetectedKey,
    HarmonicAnalyzer,
    createHarmonicAnalyzer
};