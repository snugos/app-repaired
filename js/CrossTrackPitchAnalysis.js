/**
 * CrossTrackPitchAnalysis.js
 * Analyze pitch relationships across multiple tracks for harmonic analysis
 */

class CrossTrackPitchAnalysis {
    constructor() {
        this.isEnabled = true;
        this.analysisResults = null;
        this.tracks = [];
        this.pitchData = [];
        
        // Analysis settings
        this.settings = {
            minFrequency: 20,
            maxFrequency: 5000,
            pitchThreshold: 0.1,
            harmonicTolerance: 0.05, // 5% tolerance for harmonic detection
            analysisWindowSize: 2048
        };
        
        // Musical constants
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.a4Frequency = 440;
        
        // Scales for key detection
        this.scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            locrian: [0, 1, 3, 5, 6, 8, 10],
            pentatonic: [0, 2, 4, 7, 9],
            blues: [0, 3, 5, 6, 7, 10],
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };
        
        // Chord definitions
        this.chordTypes = {
            'maj': [0, 4, 7],
            'min': [0, 3, 7],
            'dim': [0, 3, 6],
            'aug': [0, 4, 8],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            '7': [0, 4, 7, 10],
            'maj7': [0, 4, 7, 11],
            'min7': [0, 3, 7, 10],
            'dim7': [0, 3, 6, 9],
            'aug7': [0, 4, 8, 10]
        };
        
        // History
        this.analysisHistory = [];
        this.maxHistory = 20;
        
        this.init();
    }
    
    init() {
        console.log('[CrossTrackPitch] Initialized');
    }
    
    // Analyze multiple tracks
    async analyzeTracks(tracks, audioContext) {
        if (!tracks || tracks.length === 0) {
            return null;
        }
        
        this.tracks = tracks;
        this.pitchData = [];
        
        const startTime = Date.now();
        
        // Analyze each track
        for (const track of tracks) {
            if (track.outputNode) {
                const trackPitch = await this.analyzeTrackPitch(track, audioContext);
                this.pitchData.push(trackPitch);
            }
        }
        
        // Analyze relationships
        const relationships = this.analyzeRelationships();
        
        // Detect key
        const keyInfo = this.detectKey();
        
        // Detect chord progressions
        const chords = this.detectChords();
        
        // Detect consonance/dissonance
        const consonance = this.analyzeConsonance();
        
        this.analysisResults = {
            timestamp: new Date().toISOString(),
            tracks: this.pitchData,
            relationships,
            key: keyInfo,
            chords,
            consonance,
            analysisTime: Date.now() - startTime
        };
        
        console.log(`[CrossTrackPitch] Analysis complete in ${this.analysisResults.analysisTime}ms`);
        
        return this.analysisResults;
    }
    
    // Analyze pitch for a single track
    async analyzeTrackPitch(track, audioContext) {
        const result = {
            trackId: track.id,
            trackName: track.name,
            trackType: track.type,
            fundamentalFrequency: 0,
            note: null,
            octave: 0,
            cents: 0,
            harmonics: [],
            pitchConfidence: 0,
            pitchHistory: []
        };
        
        // Get audio data from track
        if (track.outputNode) {
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = this.settings.analysisWindowSize;
            track.outputNode.connect(analyser);
            
            const frequencyData = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(frequencyData);
            
            // Find fundamental frequency using autocorrelation-like approach
            const fundamental = this.detectFundamental(frequencyData, audioContext.sampleRate);
            result.fundamentalFrequency = fundamental.frequency;
            result.pitchConfidence = fundamental.confidence;
            
            // Convert to note
            if (result.fundamentalFrequency > 0) {
                const noteInfo = this.frequencyToNote(result.fundamentalFrequency);
                result.note = noteInfo.note;
                result.octave = noteInfo.octave;
                result.cents = noteInfo.cents;
            }
            
            // Detect harmonics
            result.harmonics = this.detectHarmonics(frequencyData, audioContext.sampleRate, result.fundamentalFrequency);
            
            analyser.disconnect();
        }
        
        return result;
    }
    
    // Detect fundamental frequency
    detectFundamental(frequencyData, sampleRate) {
        const binSize = sampleRate / (frequencyData.length * 2);
        
        // Find peak frequencies
        const peaks = [];
        for (let i = 1; i < frequencyData.length - 1; i++) {
            if (frequencyData[i] > frequencyData[i - 1] && frequencyData[i] > frequencyData[i + 1]) {
                if (frequencyData[i] > -60) { // Threshold
                    peaks.push({
                        bin: i,
                        frequency: i * binSize,
                        level: frequencyData[i]
                    });
                }
            }
        }
        
        // Sort by level
        peaks.sort((a, b) => b.level - a.level);
        
        // Find fundamental (lowest significant peak that has harmonics)
        for (const peak of peaks) {
            const freq = peak.frequency;
            
            // Check if harmonics exist
            let harmonicCount = 0;
            for (let h = 2; h <= 8; h++) {
                const harmonicFreq = freq * h;
                const hasHarmonic = peaks.some(p => 
                    Math.abs(p.frequency - harmonicFreq) < freq * this.settings.harmonicTolerance
                );
                if (hasHarmonic) harmonicCount++;
            }
            
            if (harmonicCount >= 2 || peaks.length < 3) {
                return {
                    frequency: freq,
                    confidence: Math.min(1, harmonicCount / 4 + 0.3)
                };
            }
        }
        
        return { frequency: 0, confidence: 0 };
    }
    
    // Detect harmonics
    detectHarmonics(frequencyData, sampleRate, fundamental) {
        if (fundamental <= 0) return [];
        
        const binSize = sampleRate / (frequencyData.length * 2);
        const harmonics = [];
        
        for (let h = 2; h <= 16; h++) {
            const harmonicFreq = fundamental * h;
            const bin = Math.round(harmonicFreq / binSize);
            
            if (bin < frequencyData.length) {
                harmonics.push({
                    number: h,
                    frequency: harmonicFreq,
                    level: frequencyData[bin]
                });
            }
        }
        
        return harmonics;
    }
    
    // Convert frequency to musical note
    frequencyToNote(frequency) {
        const noteNum = 12 * Math.log2(frequency / this.a4Frequency) + 69;
        const roundedNote = Math.round(noteNum);
        const noteName = this.noteNames[roundedNote % 12];
        const octave = Math.floor(roundedNote / 12) - 1;
        const cents = Math.round((noteNum - roundedNote) * 100);
        
        return {
            note: noteName,
            octave: octave,
            fullNote: `${noteName}${octave}`,
            midiNote: roundedNote,
            cents: cents
        };
    }
    
    // Convert MIDI note to frequency
    noteToFrequency(midiNote) {
        return this.a4Frequency * Math.pow(2, (midiNote - 69) / 12);
    }
    
    // Analyze relationships between tracks
    analyzeRelationships() {
        const relationships = [];
        
        for (let i = 0; i < this.pitchData.length; i++) {
            for (let j = i + 1; j < this.pitchData.length; j++) {
                const track1 = this.pitchData[i];
                const track2 = this.pitchData[j];
                
                if (track1.fundamentalFrequency > 0 && track2.fundamentalFrequency > 0) {
                    const interval = this.calculateInterval(
                        track1.fundamentalFrequency,
                        track2.fundamentalFrequency
                    );
                    
                    relationships.push({
                        track1: { id: track1.trackId, name: track1.trackName, note: track1.fullNote },
                        track2: { id: track2.trackId, name: track2.trackName, note: track2.fullNote },
                        interval: interval.semitones,
                        intervalName: interval.name,
                        isConsonant: this.isConsonantInterval(interval.semitones),
                        frequency1: track1.fundamentalFrequency,
                        frequency2: track2.fundamentalFrequency
                    });
                }
            }
        }
        
        return relationships;
    }
    
    // Calculate interval between two frequencies
    calculateInterval(freq1, freq2) {
        const semitones = Math.round(12 * Math.log2(freq2 / freq1));
        const intervalNames = [
            'Unison', 'minor 2nd', 'Major 2nd', 'minor 3rd', 'Major 3rd',
            'Perfect 4th', 'Tritone', 'Perfect 5th', 'minor 6th', 'Major 6th',
            'minor 7th', 'Major 7th', 'Octave'
        ];
        
        const absSemitones = Math.abs(semitones) % 12;
        const name = intervalNames[absSemitones] || `${absSemitones} semitones`;
        
        return {
            semitones: semitones,
            name: name,
            ratio: freq2 / freq1
        };
    }
    
    // Check if interval is consonant
    isConsonantInterval(semitones) {
        const abs = Math.abs(semitones) % 12;
        const consonant = [0, 3, 4, 5, 7, 8, 9, 12]; // Unison, thirds, fourths, fifths, sixths, octave
        return consonant.includes(abs);
    }
    
    // Detect key
    detectKey() {
        // Collect all notes
        const noteCounts = new Array(12).fill(0);
        
        for (const track of this.pitchData) {
            if (track.fundamentalFrequency > 0) {
                const noteInfo = this.frequencyToNote(track.fundamentalFrequency);
                noteCounts[noteInfo.midiNote % 12] += track.pitchConfidence;
            }
        }
        
        // Test each possible key
        const keyScores = [];
        
        for (let root = 0; root < 12; root++) {
            for (const [scaleName, scale] of Object.entries(this.scales)) {
                let score = 0;
                
                for (const note of scale) {
                    const noteIndex = (root + note) % 12;
                    score += noteCounts[noteIndex];
                }
                
                // Normalize by scale size
                score /= scale.length;
                
                keyScores.push({
                    root: this.noteNames[root],
                    rootNote: root,
                    scale: scaleName,
                    score: score,
                    fullKey: `${this.noteNames[root]} ${scaleName}`
                });
            }
        }
        
        // Sort by score
        keyScores.sort((a, b) => b.score - a.score);
        
        return {
            detected: keyScores[0]?.fullKey || 'Unknown',
            confidence: keyScores[0]?.score || 0,
            alternatives: keyScores.slice(0, 5)
        };
    }
    
    // Detect chords
    detectChords() {
        const chords = [];
        
        // Group pitches by time (simplified - all at once)
        const activePitches = this.pitchData
            .filter(t => t.fundamentalFrequency > 0)
            .map(t => ({
                note: t.note,
                midiNote: this.frequencyToNote(t.fundamentalFrequency).midiNote,
                trackId: t.trackId
            }));
        
        if (activePitches.length < 3) return chords;
        
        // Find root note candidates
        const midiNotes = activePitches.map(p => p.midiNote % 12);
        const uniqueNotes = [...new Set(midiNotes)].sort((a, b) => a - b);
        
        // Try to match chord patterns
        for (let root = 0; root < 12; root++) {
            for (const [chordType, intervals] of Object.entries(this.chordTypes)) {
                const chordNotes = intervals.map(i => (root + i) % 12);
                
                // Check if all chord notes are present
                const matchCount = chordNotes.filter(n => uniqueNotes.includes(n)).length;
                
                if (matchCount === chordNotes.length) {
                    chords.push({
                        root: this.noteNames[root],
                        type: chordType,
                        fullName: `${this.noteNames[root]}${chordType}`,
                        notes: chordNotes.map(n => this.noteNames[n]),
                        confidence: matchCount / chordNotes.length
                    });
                }
            }
        }
        
        // Sort by confidence
        chords.sort((a, b) => b.confidence - a.confidence);
        
        return chords.slice(0, 3);
    }
    
    // Analyze consonance/dissonance
    analyzeConsonance() {
        let totalConsonance = 0;
        let intervalCount = 0;
        
        for (const track1 of this.pitchData) {
            for (const track2 of this.pitchData) {
                if (track1.trackId !== track2.trackId &&
                    track1.fundamentalFrequency > 0 &&
                    track2.fundamentalFrequency > 0) {
                    
                    const interval = this.calculateInterval(
                        track1.fundamentalFrequency,
                        track2.fundamentalFrequency
                    );
                    
                    // Rate consonance
                    const consonanceRating = this.rateConsonance(interval.semitones);
                    totalConsonance += consonanceRating;
                    intervalCount++;
                }
            }
        }
        
        const averageConsonance = intervalCount > 0 ? totalConsonance / intervalCount : 0;
        
        return {
            overall: averageConsonance,
            rating: this.getConsonanceRating(averageConsonance),
            intervalCount: intervalCount
        };
    }
    
    // Rate consonance of an interval
    rateConsonance(semitones) {
        const abs = Math.abs(semitones) % 12;
        const ratings = {
            0: 1.0,   // Unison - most consonant
            5: 0.95,  // Perfect 4th
            7: 1.0,   // Perfect 5th - most consonant
            12: 1.0,  // Octave
            3: 0.8,   // minor 3rd
            4: 0.85,  // Major 3rd
            8: 0.75,  // minor 6th
            9: 0.8,   // Major 6th
            2: 0.5,   // Major 2nd
            10: 0.45, // minor 7th
            11: 0.3,  // Major 7th
            1: 0.25,  // minor 2nd
            6: 0.2    // Tritone - most dissonant
        };
        
        return ratings[abs] || 0.5;
    }
    
    // Get consonance rating label
    getConsonanceRating(value) {
        if (value >= 0.85) return 'Very Consonant';
        if (value >= 0.7) return 'Consonant';
        if (value >= 0.5) return 'Moderate';
        if (value >= 0.35) return 'Dissonant';
        return 'Very Dissonant';
    }
    
    // Get pitch analysis for a specific track
    getTrackPitch(trackId) {
        return this.pitchData.find(p => p.trackId === trackId);
    }
    
    // Export analysis
    exportAnalysis() {
        return JSON.stringify(this.analysisResults, null, 2);
    }
    
    // Import analysis
    importAnalysis(jsonData) {
        try {
            this.analysisResults = JSON.parse(jsonData);
            return true;
        } catch (e) {
            console.error('[CrossTrackPitch] Import failed:', e);
            return false;
        }
    }
    
    // UI Panel
    openPanel() {
        const existing = document.getElementById('cross-track-pitch-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'cross-track-pitch-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 750px;
            max-height: 85vh;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            color: white;
            font-family: system-ui;
            z-index: 10000;
            overflow: hidden;
        `;
        
        panel.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px;">🎼 Cross-Track Pitch Analysis</h3>
                    <button id="close-pitch-panel" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
                </div>
            </div>
            
            <div style="padding: 16px; max-height: 70vh; overflow-y: auto;">
                <button id="analyze-pitch-btn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; margin-bottom: 16px;">
                    🔍 Analyze All Tracks
                </button>
                
                <div id="pitch-results" style="display: none;">
                    ${this.renderResults()}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupPanelEvents();
    }
    
    renderResults() {
        if (!this.analysisResults) return '';
        
        const r = this.analysisResults;
        
        return `
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Key Detection</h4>
                <div style="font-size: 28px; font-weight: bold; color: #a78bfa; margin-bottom: 8px;">
                    ${r.key.detected}
                </div>
                <div style="font-size: 11px; color: #888;">
                    Confidence: ${Math.round(r.key.confidence * 100)}%
                </div>
                
                <div style="margin-top: 12px; font-size: 11px; color: #666;">
                    Alternatives: ${r.key.alternatives.slice(1, 4).map(k => `${k.fullKey} (${Math.round(k.score * 100)}%)`).join(', ')}
                </div>
            </div>
            
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Consonance Analysis</h4>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="flex: 1; height: 8px; background: #333; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${r.consonance.overall * 100}%; height: 100%; background: ${r.consonance.overall > 0.7 ? '#10b981' : r.consonance.overall > 0.5 ? '#f59e0b' : '#ef4444'};"></div>
                    </div>
                    <span style="font-size: 12px;">${r.consonance.rating}</span>
                </div>
            </div>
            
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Detected Chords</h4>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${r.chords.map(c => `
                        <div style="padding: 8px 12px; background: #1a1a2e; border-radius: 4px; font-size: 14px;">
                            ${c.fullName}
                        </div>
                    `).join('') || '<div style="color: #666; font-size: 12px;">No chords detected</div>'}
                </div>
            </div>
            
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Track Pitches</h4>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${r.tracks.filter(t => t.fundamentalFrequency > 0).map(t => `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #222; font-size: 12px;">
                            <span style="color: #888;">${t.trackName}</span>
                            <span style="font-weight: bold;">${t.note}${t.octave}</span>
                            <span style="color: #666;">${t.fundamentalFrequency.toFixed(1)} Hz</span>
                            <span style="color: ${t.cents > 5 ? '#f59e0b' : '#10b981'};">${t.cents > 0 ? '+' : ''}${t.cents}¢</span>
                        </div>
                    `).join('') || '<div style="color: #666; font-size: 12px;">No pitch data</div>'}
                </div>
            </div>
            
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Interval Relationships</h4>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${r.relationships.map(rel => `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #222; font-size: 11px;">
                            <span>${rel.track1.note} → ${rel.track2.note}</span>
                            <span style="color: ${rel.isConsonant ? '#10b981' : '#f59e0b'};">${rel.intervalName}</span>
                        </div>
                    `).join('') || '<div style="color: #666; font-size: 12px;">No relationships</div>'}
                </div>
            </div>
        `;
    }
    
    setupPanelEvents() {
        const panel = document.getElementById('cross-track-pitch-panel');
        if (!panel) return;
        
        panel.querySelector('#close-pitch-panel').onclick = () => panel.remove();
        
        panel.querySelector('#analyze-pitch-btn').onclick = () => {
            this.dispatchEvent('analyze-requested');
            
            // Simulate analysis
            setTimeout(() => {
                // Create mock results for demo
                this.analysisResults = {
                    timestamp: new Date().toISOString(),
                    tracks: [
                        { trackId: 1, trackName: 'Lead Vocal', fundamentalFrequency: 440, note: 'A', octave: 4, cents: 0, pitchConfidence: 0.9 },
                        { trackId: 2, trackName: 'Bass', fundamentalFrequency: 220, note: 'A', octave: 3, cents: -2, pitchConfidence: 0.85 },
                        { trackId: 3, trackName: 'Guitar', fundamentalFrequency: 330, note: 'E', octave: 4, cents: 3, pitchConfidence: 0.8 }
                    ],
                    relationships: [
                        { track1: { note: 'A4' }, track2: { note: 'A3' }, intervalName: 'Octave', isConsonant: true },
                        { track1: { note: 'A4' }, track2: { note: 'E4' }, intervalName: 'Perfect 5th', isConsonant: true }
                    ],
                    key: {
                        detected: 'A Major',
                        confidence: 0.75,
                        alternatives: [
                            { fullKey: 'A Major', score: 0.75 },
                            { fullKey: 'F# minor', score: 0.7 },
                            { fullKey: 'D Major', score: 0.5 }
                        ]
                    },
                    chords: [
                        { fullName: 'A maj', notes: ['A', 'C#', 'E'], confidence: 0.85 }
                    ],
                    consonance: {
                        overall: 0.85,
                        rating: 'Consonant',
                        intervalCount: 3
                    }
                };
                
                panel.querySelector('#pitch-results').style.display = 'block';
                panel.querySelector('#pitch-results').innerHTML = this.renderResults();
            }, 500);
        };
    }
    
    closePanel() {
        const panel = document.getElementById('cross-track-pitch-panel');
        if (panel) panel.remove();
    }
    
    // Event system
    dispatchEvent(eventName, data = {}) {
        window.dispatchEvent(new CustomEvent(`cross-track-pitch:${eventName}`, { detail: data }));
    }
    
    on(eventName, callback) {
        window.addEventListener(`cross-track-pitch:${eventName}`, (e) => callback(e.detail));
    }
    
    off(eventName, callback) {
        window.removeEventListener(`cross-track-pitch:${eventName}`, callback);
    }
    
    // Cleanup
    dispose() {
        this.closePanel();
        this.analysisResults = null;
        this.pitchData = [];
    }
}

// Export singleton instance
const crossTrackPitchAnalysis = new CrossTrackPitchAnalysis();

// Initialization function
function initCrossTrackPitchAnalysis() {
    console.log('[CrossTrackPitch] Module initialized');
    return crossTrackPitchAnalysis;
}

// Panel open function
function openCrossTrackPitchAnalysisPanel() {
    crossTrackPitchAnalysis.openPanel();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CrossTrackPitchAnalysis, crossTrackPitchAnalysis, initCrossTrackPitchAnalysis, openCrossTrackPitchAnalysisPanel };
}

export { CrossTrackPitchAnalysis, crossTrackPitchAnalysis, initCrossTrackPitchAnalysis, openCrossTrackPitchAnalysisPanel };