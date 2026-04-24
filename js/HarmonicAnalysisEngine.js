/**
 * Harmonic Analysis Engine - Deep harmonic analysis of chord progressions
 * Provides comprehensive analysis of harmonic content, chord functions, and voice leading
 */

class HarmonicAnalysisEngine {
    constructor() {
        this.analysisHistory = [];
        this.maxHistory = 30;
        
        // Circle of fifths for key detection
        this.circleOfFifths = {
            major: ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'],
            minor: ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm', 'Dm']
        };
        
        // Roman numeral functions
        this.chordFunctions = {
            major: {
                I: { name: 'Tonic', stability: 1.0, tendency: 'I', emotional: 'resolved' },
                ii: { name: 'Supertonic', stability: 0.4, tendency: 'V', emotional: 'preparing' },
                iii: { name: 'Mediant', stability: 0.6, tendency: 'vi', emotional: 'moderately stable' },
                IV: { name: 'Subdominant', stability: 0.5, tendency: 'V', emotional: 'preparing' },
                V: { name: 'Dominant', stability: 0.2, tendency: 'I', emotional: 'tense' },
                vi: { name: 'Submediant', stability: 0.7, tendency: 'ii', emotional: 'relaxed' },
                vii: { name: 'Leading Tone', stability: 0.1, tendency: 'I', emotional: 'highly tense' },
                V7: { name: 'Dominant 7th', stability: 0.1, tendency: 'I', emotional: 'resolving' },
                viiDim7: { name: 'Diminished 7th', stability: 0.05, tendency: 'I', emotional: 'extremely tense' }
            },
            minor: {
                i: { name: 'Tonic', stability: 1.0, tendency: 'i', emotional: 'resolved (dark)' },
                iiDim: { name: 'Supertonic', stability: 0.3, tendency: 'V', emotional: 'preparing' },
                III: { name: 'Mediant', stability: 0.7, tendency: 'VI', emotional: 'stable' },
                iv: { name: 'Subdominant', stability: 0.5, tendency: 'V', emotional: 'preparing' },
                V: { name: 'Dominant', stability: 0.2, tendency: 'i', emotional: 'tense' },
                VI: { name: 'Submediant', stability: 0.8, tendency: 'iiDim', emotional: 'stable' },
                VII: { name: 'Subtonic', stability: 0.4, tendency: 'iii', emotional: 'moderately tense' },
                viiDim: { name: 'Leading Tone', stability: 0.1, tendency: 'i', emotional: 'highly tense' }
            }
        };
        
        // Chord types with intervals
        this.chordTypes = {
            major: { intervals: [0, 4, 7], symbol: '', quality: 'major' },
            minor: { intervals: [0, 3, 7], symbol: 'm', quality: 'minor' },
            dim: { intervals: [0, 3, 6], symbol: '°', quality: 'diminished' },
            aug: { intervals: [0, 4, 8], symbol: '+', quality: 'augmented' },
            maj7: { intervals: [0, 4, 7, 11], symbol: 'maj7', quality: 'major' },
            min7: { intervals: [0, 3, 7, 10], symbol: 'm7', quality: 'minor' },
            dom7: { intervals: [0, 4, 7, 10], symbol: '7', quality: 'dominant' },
            dim7: { intervals: [0, 3, 6, 9], symbol: '°7', quality: 'diminished' },
            halfDim7: { intervals: [0, 3, 6, 10], symbol: 'm7b5', quality: 'half-diminished' },
            sus2: { intervals: [0, 2, 7], symbol: 'sus2', quality: 'suspended' },
            sus4: { intervals: [0, 5, 7], symbol: 'sus4', quality: 'suspended' },
            add9: { intervals: [0, 4, 7, 14], symbol: 'add9', quality: 'major' },
            min9: { intervals: [0, 3, 7, 10, 14], symbol: 'm9', quality: 'minor' },
            maj9: { intervals: [0, 4, 7, 11, 14], symbol: 'maj9', quality: 'major' },
            dom9: { intervals: [0, 4, 7, 10, 14], symbol: '9', quality: 'dominant' },
            min11: { intervals: [0, 3, 7, 10, 14, 17], symbol: 'm11', quality: 'minor' },
            maj13: { intervals: [0, 4, 7, 11, 14, 21], symbol: 'maj13', quality: 'major' },
            dom13: { intervals: [0, 4, 7, 10, 14, 21], symbol: '13', quality: 'dominant' }
        };
        
        // Common chord progressions
        this.commonProgressions = [
            { name: 'I-IV-V-I', degrees: [0, 3, 4, 0], key: 'major', usage: 'classical, pop' },
            { name: 'I-V-vi-IV', degrees: [0, 4, 5, 3], key: 'major', usage: 'pop, rock' },
            { name: 'ii-V-I', degrees: [1, 4, 0], key: 'major', usage: 'jazz' },
            { name: 'I-vi-IV-V', degrees: [0, 5, 3, 4], key: 'major', usage: 'pop' },
            { name: 'vi-IV-I-V', degrees: [5, 3, 0, 4], key: 'major', usage: 'pop, alternative' },
            { name: 'i-VI-VII-i', degrees: [0, 5, 6, 0], key: 'minor', usage: 'rock, metal' },
            { name: 'i-VII-VI-V', degrees: [0, 6, 5, 4], key: 'minor', usage: 'progressive' },
            { name: 'i-iv-VII-III', degrees: [0, 3, 6, 2], key: 'minor', usage: 'dark pop' },
            { name: 'I-iii-IV-I', degrees: [0, 2, 3, 0], key: 'major', usage: 'folk' },
            { name: 'I-IV-vii-iii', degrees: [0, 3, 6, 2], key: 'major', usage: 'jazz, bossa' },
            { name: 'I-V-IV-I', degrees: [0, 4, 3, 0], key: 'major', usage: 'blues' },
            { name: 'ii-V-I-vi', degrees: [1, 4, 0, 5], key: 'major', usage: 'jazz' },
            { name: 'IV-V-iii-vi', degrees: [3, 4, 2, 5], key: 'major', usage: 'pop ballad' },
            { name: 'I-bVII-IV-I', degrees: [0, 10, 3, 0], key: 'major', usage: 'rock' },
            { name: 'i-iv-i-V', degrees: [0, 3, 0, 4], key: 'minor', usage: 'dark ambient' }
        ];
        
        // Emotional mappings
        this.emotionalMap = {
            major: { mood: 'happy, bright, uplifting', energy: 'positive' },
            minor: { mood: 'sad, melancholic, introspective', energy: 'contemplative' },
            diminished: { mood: 'tense, unstable, mysterious', energy: 'anxious' },
            augmented: { mood: 'dreamy, ethereal, unresolved', energy: 'suspended' },
            dominant: { mood: 'tense, expectant, energetic', energy: 'anticipatory' }
        };
    }
    
    /**
     * Analyze a chord progression
     * @param {Array} chords - Array of chord objects or pitch arrays
     * @returns {Object} - Comprehensive analysis
     */
    analyzeProgression(chords) {
        if (!chords || chords.length === 0) {
            return { error: 'No chords provided' };
        }
        
        // Parse chords
        const parsedChords = chords.map(c => this.parseChord(c));
        
        // Detect key
        const keyAnalysis = this.detectKey(parsedChords);
        
        // Analyze chord functions
        const functionalAnalysis = this.analyzeChordFunctions(parsedChords, keyAnalysis);
        
        // Voice leading analysis
        const voiceLeading = this.analyzeVoiceLeading(parsedChords);
        
        // Progression recognition
        const progressionMatch = this.matchProgression(parsedChords, keyAnalysis);
        
        // Emotional analysis
        const emotionalAnalysis = this.analyzeEmotion(parsedChords, functionalAnalysis);
        
        // Tension/Resolution analysis
        const tensionAnalysis = this.analyzeTensionResolution(parsedChords, functionalAnalysis);
        
        // Cadence detection
        const cadences = this.detectCadences(parsedChords, functionalAnalysis);
        
        const analysis = {
            chords: parsedChords,
            key: keyAnalysis,
            functions: functionalAnalysis,
            voiceLeading,
            progressionMatch,
            emotional: emotionalAnalysis,
            tension: tensionAnalysis,
            cadences,
            timestamp: Date.now()
        };
        
        // Add to history
        this.analysisHistory.push(analysis);
        if (this.analysisHistory.length > this.maxHistory) {
            this.analysisHistory.shift();
        }
        
        return analysis;
    }
    
    /**
     * Parse a chord from various formats
     */
    parseChord(chord) {
        if (typeof chord === 'string') {
            return this.parseChordSymbol(chord);
        } else if (Array.isArray(chord)) {
            return this.identifyChordFromPitches(chord);
        } else if (chord.pitches) {
            return this.identifyChordFromPitches(chord.pitches);
        }
        return { root: 0, type: 'major', pitches: [0, 4, 7] };
    }
    
    /**
     * Parse chord symbol (e.g., "Cmaj7", "Am", "F#m7")
     */
    parseChordSymbol(symbol) {
        const cleanSymbol = symbol.trim();
        let root = 0;
        let remaining = cleanSymbol;
        
        // Parse root note
        const rootMatch = remaining.match(/^([A-G][#b]?)/i);
        if (rootMatch) {
            root = this.noteNameToNumber(rootMatch[1]);
            remaining = remaining.slice(rootMatch[1].length);
        }
        
        // Identify chord type
        let type = 'major';
        const typeLower = remaining.toLowerCase();
        
        for (const [typeName, info] of Object.entries(this.chordTypes)) {
            if (typeLower === info.symbol.toLowerCase() || 
                typeLower.includes(info.symbol.toLowerCase())) {
                type = typeName;
                break;
            }
        }
        
        const chordInfo = this.chordTypes[type];
        const pitches = chordInfo.intervals.map(i => (root + i) % 12);
        
        return {
            symbol: cleanSymbol,
            root,
            rootName: this.noteNumberToName(root),
            type,
            quality: chordInfo.quality,
            pitches,
            intervals: chordInfo.intervals
        };
    }
    
    /**
     * Identify chord from pitch classes
     */
    identifyChordFromPitches(pitches) {
        if (!pitches || pitches.length === 0) {
            return { root: 0, type: 'major', pitches: [0, 4, 7] };
        }
        
        // Convert to pitch classes
        const pitchClasses = [...new Set(pitches.map(p => p % 12))].sort((a, b) => a - b);
        
        // Try each pitch as root
        let bestMatch = null;
        let bestScore = 0;
        
        for (const rootCandidate of pitchClasses) {
            for (const [typeName, info] of Object.entries(this.chordTypes)) {
                const expected = info.intervals.map(i => (rootCandidate + i) % 12).sort((a, b) => a - b);
                const score = this.comparePitchSets(pitchClasses, expected);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        root: rootCandidate,
                        rootName: this.noteNumberToName(rootCandidate),
                        type: typeName,
                        quality: info.quality,
                        pitches: pitchClasses,
                        intervals: info.intervals,
                        confidence: score
                    };
                }
            }
        }
        
        return bestMatch || { root: pitchClasses[0], type: 'major', pitches: pitchClasses, intervals: [0, 4, 7] };
    }
    
    /**
     * Detect the key of a progression
     */
    detectKey(chords) {
        // Count chord occurrences
        const chordCounts = {};
        chords.forEach(c => {
            const key = `${c.root}-${c.type}`;
            chordCounts[key] = (chordCounts[key] || 0) + 1;
        });
        
        // Analyze for major and minor keys
        const majorScores = {};
        const minorScores = {};
        
        // Score each possible key
        for (let keyRoot = 0; keyRoot < 12; keyRoot++) {
            // Major key scoring
            let majorScore = 0;
            const majorScale = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
            
            chords.forEach(c => {
                // Tonic chord (I)
                if (c.root === keyRoot && c.quality === 'major') {
                    majorScore += 3;
                }
                // Dominant (V)
                if (c.root === (keyRoot + 7) % 12 && c.quality === 'major') {
                    majorScore += 2;
                }
                // Subdominant (IV)
                if (c.root === (keyRoot + 5) % 12 && c.quality === 'major') {
                    majorScore += 1.5;
                }
                // Supertonic (ii)
                if (c.root === (keyRoot + 2) % 12 && c.quality === 'minor') {
                    majorScore += 1;
                }
                // Submediant (vi)
                if (c.root === (keyRoot + 9) % 12 && c.quality === 'minor') {
                    majorScore += 1;
                }
                // Mediant (iii)
                if (c.root === (keyRoot + 4) % 12 && c.quality === 'minor') {
                    majorScore += 0.5;
                }
            });
            
            majorScores[keyRoot] = majorScore;
            
            // Minor key scoring
            let minorScore = 0;
            
            chords.forEach(c => {
                // Tonic chord (i)
                if (c.root === keyRoot && c.quality === 'minor') {
                    minorScore += 3;
                }
                // Dominant (V)
                if (c.root === (keyRoot + 7) % 12 && c.quality === 'major') {
                    minorScore += 2;
                }
                // Subdominant (iv)
                if (c.root === (keyRoot + 5) % 12 && c.quality === 'minor') {
                    minorScore += 1.5;
                }
                // Mediant (III)
                if (c.root === (keyRoot + 3) % 12 && c.quality === 'major') {
                    minorScore += 1;
                }
                // Subtonic (VII)
                if (c.root === (keyRoot + 10) % 12 && c.quality === 'major') {
                    minorScore += 0.5;
                }
            });
            
            minorScores[keyRoot] = minorScore;
        }
        
        // Find best key
        let bestMajor = { root: 0, score: 0 };
        let bestMinor = { root: 0, score: 0 };
        
        for (let root = 0; root < 12; root++) {
            if (majorScores[root] > bestMajor.score) {
                bestMajor = { root, score: majorScores[root] };
            }
            if (minorScores[root] > bestMinor.score) {
                bestMinor = { root, score: minorScores[root] };
            }
        }
        
        const detected = bestMajor.score >= bestMinor.score ? 
            { mode: 'major', root: bestMajor.root, score: bestMajor.score } :
            { mode: 'minor', root: bestMinor.root, score: bestMinor.score };
        
        // Calculate alternatives
        const alternatives = [];
        for (let root = 0; root < 12; root++) {
            if (root !== detected.root) {
                const score = detected.mode === 'major' ? majorScores[root] : minorScores[root];
                if (score > 0) {
                    alternatives.push({
                        root,
                        rootName: this.noteNumberToName(root),
                        mode: detected.mode,
                        score
                    });
                }
            }
        }
        
        alternatives.sort((a, b) => b.score - a.score);
        
        return {
            root: detected.root,
            rootName: this.noteNumberToName(detected.root),
            mode: detected.mode,
            fullName: `${this.noteNumberToName(detected.root)} ${detected.mode}`,
            confidence: Math.min(1, detected.score / (chords.length * 3)),
            alternatives: alternatives.slice(0, 3)
        };
    }
    
    /**
     * Analyze chord functions in key context
     */
    analyzeChordFunctions(chords, keyAnalysis) {
        const functions = [];
        const scaleDegrees = keyAnalysis.mode === 'major' ? 
            { 0: 'I', 1: 'ii', 2: 'iii', 3: 'IV', 4: 'V', 5: 'vi', 6: 'viiDim' } :
            { 0: 'i', 1: 'iiDim', 2: 'III', 3: 'iv', 4: 'V', 5: 'VI', 6: 'VII' };
        
        chords.forEach((chord, index) => {
            const interval = (chord.root - keyAnalysis.root + 12) % 12;
            const scaleIntervals = keyAnalysis.mode === 'major' ? 
                [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
            
            const degreeIndex = scaleIntervals.indexOf(interval);
            const degree = degreeIndex >= 0 ? scaleDegrees[degreeIndex] : '?';
            
            // Get function info
            const functionMap = this.chordFunctions[keyAnalysis.mode];
            const funcInfo = functionMap[degree] || { name: 'Unknown', stability: 0.5 };
            
            functions.push({
                index,
                chord,
                degree,
                romanNumeral: degree,
                functionName: funcInfo.name,
                stability: funcInfo.stability,
                tendency: funcInfo.tendency,
                emotional: funcInfo.emotional
            });
        });
        
        return functions;
    }
    
    /**
     * Analyze voice leading between chords
     */
    analyzeVoiceLeading(chords) {
        if (chords.length < 2) return { smoothness: 1, issues: [] };
        
        const issues = [];
        let totalMovement = 0;
        
        for (let i = 1; i < chords.length; i++) {
            const prev = chords[i - 1].pitches;
            const curr = chords[i].pitches;
            
            // Check parallel fifths/octaves
            const prevFifths = this.findIntervals(prev, 7);
            const currFifths = this.findIntervals(curr, 7);
            
            prevFifths.forEach(pf => {
                currFifths.forEach(cf => {
                    if (Math.abs(pf[0] - cf[0]) <= 2 && pf[1] === cf[1]) {
                        issues.push({
                            type: 'parallelFifths',
                            position: i,
                            description: `Parallel fifths detected between chord ${i-1} and ${i}`
                        });
                    }
                });
            });
            
            // Check for large leaps
            const movement = this.calculateMovement(prev, curr);
            totalMovement += movement.total;
            
            if (movement.maxLeap > 7) {
                issues.push({
                    type: 'largeLeap',
                    position: i,
                    description: `Large leap of ${movement.maxLeap} semitones`
                });
            }
        }
        
        // Calculate smoothness (lower is smoother)
        const avgMovement = totalMovement / (chords.length - 1);
        const smoothness = Math.max(0, 1 - avgMovement / 12);
        
        return {
            smoothness,
            averageMovement: avgMovement,
            issues
        };
    }
    
    /**
     * Match progression to common patterns
     */
    matchProgression(chords, keyAnalysis) {
        const chordDegrees = chords.map(c => {
            const interval = (c.root - keyAnalysis.root + 12) % 12;
            const scaleIntervals = keyAnalysis.mode === 'major' ? 
                [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
            return scaleIntervals.indexOf(interval);
        });
        
        const matches = [];
        
        this.commonProgressions.forEach(prog => {
            if (prog.key !== keyAnalysis.mode) return;
            
            const similarity = this.calculateProgressionSimilarity(
                chordDegrees, 
                prog.degrees
            );
            
            if (similarity > 0.3) {
                matches.push({
                    name: prog.name,
                    similarity,
                    usage: prog.usage,
                    degrees: prog.degrees
                });
            }
        });
        
        matches.sort((a, b) => b.similarity - a.similarity);
        
        return {
            bestMatch: matches[0] || null,
            allMatches: matches.slice(0, 5)
        };
    }
    
    /**
     * Analyze emotional content
     */
    analyzeEmotion(chords, functionalAnalysis) {
        const emotions = [];
        let tensionSum = 0;
        let majorCount = 0;
        let minorCount = 0;
        
        functionalAnalysis.forEach(f => {
            tensionSum += 1 - f.stability;
            
            if (f.chord.quality === 'major') majorCount++;
            if (f.chord.quality === 'minor') minorCount++;
            
            emotions.push({
                chord: f.chord.rootName,
                emotion: f.emotional
            });
        });
        
        const avgTension = tensionSum / chords.length;
        const modeRatio = (majorCount - minorCount) / chords.length;
        
        let overallMood;
        if (modeRatio > 0.3) {
            overallMood = 'predominantly major - happy, bright, uplifting';
        } else if (modeRatio < -0.3) {
            overallMood = 'predominantly minor - sad, melancholic, introspective';
        } else {
            overallMood = 'modal mixture - complex, bittersweet';
        }
        
        return {
            overallMood,
            averageTension: avgTension,
            chordEmotions: emotions,
            majorCount,
            minorCount,
            otherCount: chords.length - majorCount - minorCount
        };
    }
    
    /**
     * Analyze tension and resolution
     */
    analyzeTensionResolution(chords, functionalAnalysis) {
        const curve = [];
        let currentState = 0;
        
        functionalAnalysis.forEach((f, i) => {
            const tension = 1 - f.stability;
            
            // Add tension
            currentState += tension * 0.5;
            
            // Natural decay
            currentState *= 0.9;
            
            // Resolution effect
            if (f.stability > 0.8) {
                currentState *= 0.3;
            }
            
            curve.push({
                index: i,
                chord: f.chord.rootName,
                tension: currentState,
                stability: f.stability
            });
        });
        
        // Find peaks and valleys
        const peaks = [];
        const valleys = [];
        
        for (let i = 1; i < curve.length - 1; i++) {
            if (curve[i].tension > curve[i-1].tension && curve[i].tension > curve[i+1].tension) {
                peaks.push({ index: i, tension: curve[i].tension });
            }
            if (curve[i].tension < curve[i-1].tension && curve[i].tension < curve[i+1].tension) {
                valleys.push({ index: i, tension: curve[i].tension });
            }
        }
        
        return {
            curve,
            peaks,
            valleys,
            averageTension: curve.reduce((sum, c) => sum + c.tension, 0) / curve.length,
            maxTension: Math.max(...curve.map(c => c.tension)),
            minTension: Math.min(...curve.map(c => c.tension))
        };
    }
    
    /**
     * Detect cadences
     */
    detectCadences(chords, functionalAnalysis) {
        const cadences = [];
        
        for (let i = 1; i < chords.length; i++) {
            const prev = functionalAnalysis[i - 1];
            const curr = functionalAnalysis[i];
            
            // Perfect authentic cadence (V-I in major, V-i in minor)
            if ((prev.degree === 'V' || prev.degree === 'V7') && 
                (curr.degree === 'I' || curr.degree === 'i')) {
                cadences.push({
                    type: 'Perfect Authentic',
                    position: i,
                    description: 'Strong resolution'
                });
            }
            // Plagal cadence (IV-I)
            else if ((prev.degree === 'IV' || prev.degree === 'iv') && 
                     (curr.degree === 'I' || curr.degree === 'i')) {
                cadences.push({
                    type: 'Plagal',
                    position: i,
                    description: 'Amen cadence - gentle resolution'
                });
            }
            // Half cadence (any-V)
            else if (curr.degree === 'V' || curr.degree === 'V7') {
                cadences.push({
                    type: 'Half',
                    position: i,
                    description: 'Unresolved - leads to dominant'
                });
            }
            // Deceptive cadence (V-vi)
            else if ((prev.degree === 'V' || prev.degree === 'V7') && 
                     (curr.degree === 'vi' || curr.degree === 'VI')) {
                cadences.push({
                    type: 'Deceptive',
                    position: i,
                    description: 'Surprise resolution'
                });
            }
            // Phrygian cadence (iv-V in minor)
            else if (prev.degree === 'iv' && curr.degree === 'V') {
                cadences.push({
                    type: 'Phrygian',
                    position: i,
                    description: 'Exotic half cadence'
                });
            }
        }
        
        return cadences;
    }
    
    // Utility methods
    
    noteNameToNumber(name) {
        const notes = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 
                       'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 
                       'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
        return notes[name] || 0;
    }
    
    noteNumberToName(num) {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return names[num % 12];
    }
    
    comparePitchSets(a, b) {
        const setA = new Set(a);
        const setB = new Set(b);
        let matches = 0;
        
        setA.forEach(p => { if (setB.has(p)) matches++; });
        
        const total = Math.max(setA.size, setB.size);
        return total > 0 ? matches / total : 0;
    }
    
    findIntervals(pitches, interval) {
        const results = [];
        for (let i = 0; i < pitches.length; i++) {
            for (let j = i + 1; j < pitches.length; j++) {
                if ((pitches[j] - pitches[i]) % 12 === interval) {
                    results.push([pitches[i], pitches[j]]);
                }
            }
        }
        return results;
    }
    
    calculateMovement(prevPitches, currPitches) {
        let total = 0;
        let maxLeap = 0;
        
        const sortedPrev = [...prevPitches].sort((a, b) => a - b);
        const sortedCurr = [...currPitches].sort((a, b) => a - b);
        
        const maxLen = Math.max(sortedPrev.length, sortedCurr.length);
        
        for (let i = 0; i < maxLen; i++) {
            const p = sortedPrev[i] || sortedPrev[sortedPrev.length - 1];
            const c = sortedCurr[i] || sortedCurr[sortedCurr.length - 1];
            const movement = Math.abs(c - p);
            total += movement;
            maxLeap = Math.max(maxLeap, movement);
        }
        
        return { total, maxLeap };
    }
    
    calculateProgressionSimilarity(degrees, pattern) {
        if (degrees.length < pattern.length) {
            // Check if degrees starts with pattern
            let matches = 0;
            for (let i = 0; i < Math.min(degrees.length, pattern.length); i++) {
                if (degrees[i] === pattern[i]) matches++;
            }
            return matches / pattern.length;
        }
        
        // Sliding window comparison
        let bestScore = 0;
        
        for (let start = 0; start <= degrees.length - pattern.length; start++) {
            let matches = 0;
            for (let i = 0; i < pattern.length; i++) {
                if (degrees[start + i] === pattern[i]) matches++;
            }
            bestScore = Math.max(bestScore, matches / pattern.length);
        }
        
        return bestScore;
    }
    
    // Generate analysis report
    generateReport(analysis) {
        let report = `=== Harmonic Analysis Report ===\n\n`;
        
        report += `Key: ${analysis.key.fullName} (confidence: ${(analysis.key.confidence * 100).toFixed(1)}%)\n`;
        report += `Alternatives: ${analysis.key.alternatives.map(a => `${a.rootName} ${a.mode}`).join(', ')}\n\n`;
        
        report += `Chord Progression:\n`;
        analysis.functions.forEach((f, i) => {
            report += `  ${i + 1}. ${f.chord.rootName}${f.chord.type !== 'major' ? this.chordTypes[f.chord.type].symbol : ''} (${f.romanNumeral}) - ${f.functionName}\n`;
        });
        report += `\n`;
        
        if (analysis.progressionMatch.bestMatch) {
            report += `Progression Match: ${analysis.progressionMatch.bestMatch.name} (${(analysis.progressionMatch.bestMatch.similarity * 100).toFixed(0)}%)\n`;
            report += `Usage: ${analysis.progressionMatch.bestMatch.usage}\n\n`;
        }
        
        report += `Voice Leading:\n`;
        report += `  Smoothness: ${(analysis.voiceLeading.smoothness * 100).toFixed(1)}%\n`;
        if (analysis.voiceLeading.issues.length > 0) {
            report += `  Issues: ${analysis.voiceLeading.issues.length}\n`;
        }
        report += `\n`;
        
        report += `Emotional Analysis:\n`;
        report += `  Overall: ${analysis.emotional.overallMood}\n`;
        report += `  Average Tension: ${(analysis.tension.averageTension * 100).toFixed(1)}%\n\n`;
        
        if (analysis.cadences.length > 0) {
            report += `Cadences:\n`;
            analysis.cadences.forEach(c => {
                report += `  Position ${c.position}: ${c.type} - ${c.description}\n`;
            });
        }
        
        return report;
    }
    
    getHistory() {
        return [...this.analysisHistory];
    }
}

// UI Panel
function openHarmonicAnalysisPanel() {
    const existing = document.getElementById('harmonic-analysis-panel');
    if (existing) {
        existing.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'harmonic-analysis-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3b82f6;
        border-radius: 12px;
        padding: 24px;
        width: 600px;
        max-height: 85vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #3b82f6; font-size: 20px;">🎹 Harmonic Analysis Engine</h2>
            <button id="close-harmonic-panel" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Chord Progression (comma-separated)</label>
            <input type="text" id="chord-input" placeholder="e.g., C, Am, F, G or Cmaj7, Dm7, G7" style="width: 100%; padding: 10px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white; font-family: monospace;">
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button id="analyze-chords" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Analyze Progression
            </button>
            <button id="analyze-from-track" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                From Track
            </button>
        </div>
        
        <div id="analysis-results" style="background: #0a0a14; border-radius: 6px; padding: 16px; min-height: 200px; color: #d1d5db; font-family: monospace; font-size: 12px; white-space: pre-wrap;">
            Enter a chord progression and click "Analyze" to see results
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-harmonic-panel').onclick = () => panel.remove();
    
    document.getElementById('analyze-chords').onclick = () => {
        const input = document.getElementById('chord-input').value;
        const chordSymbols = input.split(',').map(s => s.trim()).filter(s => s);
        
        if (chordSymbols.length === 0) {
            document.getElementById('analysis-results').textContent = 'Please enter at least one chord';
            return;
        }
        
        const engine = new HarmonicAnalysisEngine();
        const analysis = engine.analyzeProgression(chordSymbols);
        const report = engine.generateReport(analysis);
        
        document.getElementById('analysis-results').textContent = report;
    };
    
    document.getElementById('analyze-from-track').onclick = () => {
        // Get chords from selected track
        const chords = window.getSelectedTrackChords ? window.getSelectedTrackChords() : [];
        
        if (chords.length === 0) {
            document.getElementById('analysis-results').textContent = 'No chords found in selected track';
            return;
        }
        
        const engine = new HarmonicAnalysisEngine();
        const analysis = engine.analyzeProgression(chords);
        const report = engine.generateReport(analysis);
        
        document.getElementById('analysis-results').textContent = report;
    };
}

// Export
window.HarmonicAnalysisEngine = HarmonicAnalysisEngine;
window.openHarmonicAnalysisPanel = openHarmonicAnalysisPanel;

console.log('[HarmonicAnalysisEngine] Module loaded');
