/**
 * Scale Suggestion - AI-powered scale suggestion based on audio melody
 * Analyzes melodic content of audio/ MIDI input and suggests appropriate scales
 */

import { AICompositionEngine } from './AIComposition.js';

class ScaleSuggestion {
    constructor() {
        // AI composition engine for scale data
        this.aiEngine = new AICompositionEngine();
        
        // Scale matching thresholds
        this.matchThreshold = 0.6; // 60% match required
        
        // Note frequency map for pitch detection
        this.noteFrequencies = this.buildNoteFrequencies();
        
        // Analysis state
        this.detectedNotes = [];
        this.noteHistory = [];
        this.maxHistoryLength = 500;
        
        // Current suggestion
        this.currentSuggestion = null;
        this.suggestionConfidence = 0;
        
        // Scale weights for matching (based on how well notes fit)
        this.scaleWeights = {};
        
        // Learning from user corrections
        this.userCorrections = [];
    }
    
    /**
     * Build note frequency map for pitch detection
     */
    buildNoteFrequencies() {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const frequencies = {};
        
        // A4 = 440Hz, MIDI note 69
        for (let octave = -1; octave <= 9; octave++) {
            for (let i = 0; i < 12; i++) {
                const midiNote = (octave + 1) * 12 + i;
                const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
                const noteName = notes[i] + octave;
                frequencies[noteName] = frequency;
                frequencies[midiNote] = frequency;
            }
        }
        
        return frequencies;
    }
    
    /**
     * Analyze MIDI notes from a track or sequence
     * @param {Array} notes - Array of {pitch, time, duration} objects
     * @returns {Object} - {suggestedScale, confidence, matchingNotes}
     */
    analyzeMidiNotes(notes) {
        if (!notes || notes.length === 0) {
            return this.getDefaultSuggestion();
        }
        
        // Extract pitch histogram
        const pitchCounts = {};
        const pitchSet = new Set();
        
        notes.forEach(note => {
            if (note.pitch !== undefined) {
                const pitchClass = note.pitch % 12;
                pitchCounts[pitchClass] = (pitchCounts[pitchClass] || 0) + 1;
                pitchSet.add(pitchClass);
            }
        });
        
        // Convert to percentage distribution
        const totalNotes = notes.length;
        const pitchDistribution = {};
        for (const pc in pitchCounts) {
            pitchDistribution[pc] = pitchCounts[pc] / totalNotes;
        }
        
        // Analyze melodic intervals
        const intervals = this.calculateMelodicIntervals(notes);
        
        // Find best matching scales
        const scaleMatches = this.matchScales(pitchDistribution, pitchSet, intervals);
        
        // Get best match
        const bestMatch = scaleMatches[0];
        this.currentSuggestion = bestMatch;
        this.suggestionConfidence = bestMatch.confidence;
        
        return bestMatch;
    }
    
    /**
     * Calculate melodic intervals from note sequence
     */
    calculateMelodicIntervals(notes) {
        const intervals = [];
        const sortedNotes = [...notes].sort((a, b) => {
            return (a.time || 0) - (b.time || 0);
        });
        
        for (let i = 1; i < sortedNotes.length; i++) {
            const interval = Math.abs(sortedNotes[i].pitch - sortedNotes[i - 1].pitch);
            intervals.push(interval);
        }
        
        return intervals;
    }
    
    /**
     * Match pitch distribution against all scales
     */
    matchScales(pitchDistribution, pitchSet, intervals) {
        const scales = this.aiEngine.SCALES;
        const matches = [];
        
        for (const [scaleName, scaleIntervals] of Object.entries(scales)) {
            let matchScore = 0;
            let noteMatches = 0;
            
            // Check how many detected pitches fit in this scale
            for (const pc in pitchDistribution) {
                const noteInScale = scaleIntervals.some(i => i % 12 === parseInt(pc));
                if (noteInScale) {
                    matchScore += pitchDistribution[pc];
                    noteMatches++;
                }
            }
            
            // Bonus for interval patterns (thirds, fifths, sevenths)
            const intervalBonus = this.analyzeIntervalFit(intervals, scaleIntervals);
            
            // Calculate confidence
            const coverage = noteMatches / Object.keys(pitchDistribution).length;
            const confidence = (matchScore * 0.7) + (intervalBonus * 0.3);
            
            matches.push({
                scale: scaleName,
                root: this.guessRoot(pitchDistribution, scaleIntervals),
                confidence: Math.min(confidence, 0.95),
                coverage: coverage,
                noteMatches: noteMatches,
                totalNotes: Object.keys(pitchDistribution).length,
                intervalBonus: intervalBonus
            });
        }
        
        // Sort by confidence
        matches.sort((a, b) => b.confidence - a.confidence);
        
        return matches;
    }
    
    /**
     * Analyze how well intervals fit a scale
     */
    analyzeIntervalFit(intervals, scaleIntervals) {
        if (intervals.length === 0) return 0.5;
        
        let fitCount = 0;
        const scaleIntervalSet = new Set(scaleIntervals.map(i => i % 12));
        
        intervals.forEach(interval => {
            const normalizedInterval = interval % 12;
            if (scaleIntervalSet.has(normalizedInterval)) {
                fitCount++;
            }
        });
        
        return fitCount / intervals.length;
    }
    
    /**
     * Guess the root note based on pitch distribution
     */
    guessRoot(pitchDistribution, scaleIntervals) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Find most common pitch class
        let maxCount = 0;
        let likelyRoot = 0;
        
        for (const pc in pitchDistribution) {
            if (pitchDistribution[pc] > maxCount) {
                maxCount = pitchDistribution[pc];
                likelyRoot = parseInt(pc);
            }
        }
        
        return notes[likelyRoot];
    }
    
    /**
     * Analyze audio buffer for melodic content
     * @param {Float32Array} audioBuffer - Audio sample data
     * @param {number} sampleRate - Sample rate in Hz
     * @returns {Object} - {suggestedScale, confidence, detectedNotes}
     */
    analyzeAudioBuffer(audioBuffer, sampleRate) {
        // Detect pitches using autocorrelation (simplified pitch detection)
        const detectedPitches = this.detectPitches(audioBuffer, sampleRate);
        
        // Convert to note events
        const notes = detectedPitches.map(p => ({
            pitch: p.pitch,
            time: p.time,
            velocity: p.amplitude
        }));
        
        // Add to history
        this.addToHistory(notes);
        
        // Analyze the collected notes
        return this.analyzeMidiNotes(notes);
    }
    
    /**
     * Simple pitch detection using autocorrelation
     */
    detectPitches(audioBuffer, sampleRate) {
        const pitches = [];
        const windowSize = 2048;
        const hopSize = 512;
        
        for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
            const window = audioBuffer.slice(i, i + windowSize);
            const pitch = this.autocorrelate(window, sampleRate);
            
            if (pitch.frequency > 20 && pitch.frequency < 4000) {
                pitches.push({
                    pitch: this.frequencyToMidi(pitch.frequency),
                    time: i / sampleRate,
                    amplitude: pitch.amplitude
                });
            }
        }
        
        return pitches;
    }
    
    /**
     * Autocorrelation-based pitch detection
     */
    autocorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        
        let bestOffset = -1;
        let bestCorrelation = 0;
        
        // Calculate RMS to skip silent frames
        let rms = 0;
        for (let i = 0; i < SIZE; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / SIZE);
        
        if (rms < 0.01) {
            return { frequency: 0, amplitude: 0 };
        }
        
        // Find best correlation
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += buffer[i] * buffer[i + offset];
            }
            
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }
        
        if (bestOffset <= 0 || bestOffset >= MAX_SAMPLES) {
            return { frequency: 0, amplitude: 0 };
        }
        
        const frequency = sampleRate / bestOffset;
        const amplitude = bestCorrelation / MAX_SAMPLES;
        
        return { frequency, amplitude };
    }
    
    /**
     * Convert frequency to MIDI note number
     */
    frequencyToMidi(frequency) {
        return Math.round(69 + 12 * Math.log2(frequency / 440));
    }
    
    /**
     * Add notes to history
     */
    addToHistory(notes) {
        this.noteHistory.push(...notes);
        
        // Trim history if too long
        if (this.noteHistory.length > this.maxHistoryLength) {
            this.noteHistory = this.noteHistory.slice(-this.maxHistoryLength);
        }
    }
    
    /**
     * Get current suggestion
     */
    getSuggestion() {
        if (!this.currentSuggestion) {
            return this.getDefaultSuggestion();
        }
        return this.currentSuggestion;
    }
    
    /**
     * Get default suggestion
     */
    getDefaultSuggestion() {
        return {
            scale: 'major',
            root: 'C',
            confidence: 0,
            coverage: 0,
            noteMatches: 0,
            totalNotes: 0,
            intervalBonus: 0
        };
    }
    
    /**
     * Learn from user selection (scale override)
     */
    learnFromCorrection(selectedScale, selectedRoot) {
        this.userCorrections.push({
            time: Date.now(),
            scale: selectedScale,
            root: selectedRoot,
            originalSuggestion: this.currentSuggestion
        });
        
        // Adjust confidence weighting based on corrections
        // (future suggestions will weight toward user's preferences)
    }
    
    /**
     * Get all scales ranked by current analysis
     */
    getAllSuggestions() {
        if (this.noteHistory.length === 0) {
            return this.aiEngine.getAvailableScales().map(name => ({
                scale: name,
                confidence: 0,
                rank: 'unknown'
            }));
        }
        
        // Re-analyze with current history
        const analysis = this.analyzeMidiNotes(this.noteHistory);
        
        return this.aiEngine.getAvailableScales().map(name => {
            const match = this.currentSuggestion;
            return {
                scale: name,
                confidence: name === match?.scale ? match.confidence : 0,
                root: name === match?.scale ? match.root : 'C'
            };
        }).sort((a, b) => b.confidence - a.confidence);
    }
    
    /**
     * Clear analysis history
     */
    clearHistory() {
        this.noteHistory = [];
        this.currentSuggestion = null;
        this.suggestionConfidence = 0;
    }
    
    /**
     * Get scale info with notes
     */
    getScaleInfo(scaleName, rootNote = 'C') {
        const scales = this.aiEngine.SCALES;
        if (!scales[scaleName]) return null;
        
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const rootIndex = notes.indexOf(rootNote);
        
        if (rootIndex === -1) return null;
        
        const scaleNotes = scales[scaleName].map(interval => {
            const noteIndex = (rootIndex + interval) % 12;
            return notes[noteIndex];
        });
        
        return {
            name: scaleName,
            root: rootNote,
            notes: scaleNotes,
            intervals: scales[scaleName]
        };
    }
}

// Singleton instance
export const scaleSuggestion = new ScaleSuggestion();

// Export class for multiple instances
export default ScaleSuggestion;