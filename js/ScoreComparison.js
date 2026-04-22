// js/ScoreComparison.js - Score Comparison for SnugOS DAW
// Features: Compare different versions of a score, highlight differences, merge changes

/**
 * Comparison Result Types
 */
export const DifferenceType = {
    NOTE_ADDED: 'note_added',
    NOTE_REMOVED: 'note_removed',
    NOTE_PITCH_CHANGED: 'note_pitch_changed',
    NOTE_DURATION_CHANGED: 'note_duration_changed',
    NOTE_VELOCITY_CHANGED: 'note_velocity_changed',
    NOTE_TIME_SHIFTED: 'note_time_shifted',
    TIME_SIGNATURE_CHANGED: 'time_signature_changed',
    KEY_SIGNATURE_CHANGED: 'key_signature_changed',
    TEMPO_CHANGED: 'tempo_changed',
    DYNAMIC_ADDED: 'dynamic_added',
    DYNAMIC_REMOVED: 'dynamic_removed',
    DYNAMIC_CHANGED: 'dynamic_changed',
    ARTICULATION_ADDED: 'articulation_added',
    ARTICULATION_REMOVED: 'articulation_removed',
    LYRIC_ADDED: 'lyric_added',
    LYRIC_REMOVED: 'lyric_removed',
    LYRIC_CHANGED: 'lyric_changed',
    CHORD_SYMBOL_ADDED: 'chord_symbol_added',
    CHORD_SYMBOL_REMOVED: 'chord_symbol_removed',
    CHORD_SYMBOL_CHANGED: 'chord_symbol_changed'
};

/**
 * Difference between two scores
 */
export class ScoreDifference {
    constructor(options = {}) {
        this.id = options.id || `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = options.type || DifferenceType.NOTE_ADDED;
        this.partId = options.partId || null;
        this.measureNumber = options.measureNumber || null;
        this.time = options.time || 0;
        this.oldValue = options.oldValue || null;
        this.newValue = options.newValue || null;
        this.description = options.description || '';
        this.severity = options.severity || 'info'; // 'info', 'warning', 'error'
        this.confirmed = options.confirmed || false;
    }

    /**
     * Get human-readable description
     * @returns {string} Description
     */
    getDescription() {
        const typeDescriptions = {
            [DifferenceType.NOTE_ADDED]: `Note added at measure ${this.measureNumber}`,
            [DifferenceType.NOTE_REMOVED]: `Note removed at measure ${this.measureNumber}`,
            [DifferenceType.NOTE_PITCH_CHANGED]: `Pitch changed from ${this.oldValue?.pitch} to ${this.newValue?.pitch}`,
            [DifferenceType.NOTE_DURATION_CHANGED]: `Duration changed from ${this.oldValue?.duration} to ${this.newValue?.duration}`,
            [DifferenceType.NOTE_VELOCITY_CHANGED]: `Velocity changed from ${this.oldValue?.velocity} to ${this.newValue?.velocity}`,
            [DifferenceType.NOTE_TIME_SHIFTED]: `Note moved by ${this.newValue?.offset} ticks`,
            [DifferenceType.TIME_SIGNATURE_CHANGED]: `Time signature changed to ${this.newValue}`,
            [DifferenceType.KEY_SIGNATURE_CHANGED]: `Key signature changed to ${this.newValue}`,
            [DifferenceType.TEMPO_CHANGED]: `Tempo changed from ${this.oldValue} to ${this.newValue} BPM`,
            [DifferenceType.DYNAMIC_ADDED]: `Dynamic "${this.newValue}" added`,
            [DifferenceType.DYNAMIC_REMOVED]: `Dynamic "${this.oldValue}" removed`,
            [DifferenceType.DYNAMIC_CHANGED]: `Dynamic changed from ${this.oldValue} to ${this.newValue}`,
            [DifferenceType.ARTICULATION_ADDED]: `Articulation added`,
            [DifferenceType.ARTICULATION_REMOVED]: `Articulation removed`,
            [DifferenceType.LYRIC_ADDED]: `Lyric "${this.newValue}" added`,
            [DifferenceType.LYRIC_REMOVED]: `Lyric "${this.oldValue}" removed`,
            [DifferenceType.LYRIC_CHANGED]: `Lyric changed from "${this.oldValue}" to "${this.newValue}"`,
            [DifferenceType.CHORD_SYMBOL_ADDED]: `Chord "${this.newValue}" added`,
            [DifferenceType.CHORD_SYMBOL_REMOVED]: `Chord "${this.oldValue}" removed`,
            [DifferenceType.CHORD_SYMBOL_CHANGED]: `Chord changed from "${this.oldValue}" to "${this.newValue}"`
        };
        
        return this.description || typeDescriptions[this.type] || 'Unknown change';
    }

    /**
     * Convert to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            partId: this.partId,
            measureNumber: this.measureNumber,
            time: this.time,
            oldValue: this.oldValue,
            newValue: this.newValue,
            description: this.description,
            severity: this.severity,
            confirmed: this.confirmed
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON data
     * @returns {ScoreDifference} Difference instance
     */
    static fromJSON(json) {
        return new ScoreDifference(json);
    }
}

/**
 * Comparison Session
 */
export class ComparisonSession {
    constructor(options = {}) {
        this.id = options.id || `session_${Date.now()}`;
        this.name = options.name || 'Untitled Comparison';
        this.scoreA = options.scoreA || null;
        this.scoreB = options.scoreB || null;
        this.differences = options.differences || [];
        this.created = options.created || new Date().toISOString();
        this.modified = options.modified || new Date().toISOString();
    }

    /**
     * Add a difference
     * @param {ScoreDifference} difference - Difference to add
     */
    addDifference(difference) {
        this.differences.push(difference);
        this.modified = new Date().toISOString();
    }

    /**
     * Remove a difference
     * @param {string} differenceId - Difference ID
     */
    removeDifference(differenceId) {
        this.differences = this.differences.filter(d => d.id !== differenceId);
        this.modified = new Date().toISOString();
    }

    /**
     * Get differences by type
     * @param {string} type - Difference type
     * @returns {ScoreDifference[]} Filtered differences
     */
    getDifferencesByType(type) {
        return this.differences.filter(d => d.type === type);
    }

    /**
     * Get differences by measure
     * @param {number} measure - Measure number
     * @returns {ScoreDifference[]} Filtered differences
     */
    getDifferencesByMeasure(measure) {
        return this.differences.filter(d => d.measureNumber === measure);
    }

    /**
     * Confirm a difference
     * @param {string} differenceId - Difference ID
     */
    confirmDifference(differenceId) {
        const diff = this.differences.find(d => d.id === differenceId);
        if (diff) {
            diff.confirmed = true;
            this.modified = new Date().toISOString();
        }
    }

    /**
     * Get summary statistics
     * @returns {Object} Statistics
     */
    getSummary() {
        const stats = {
            totalDifferences: this.differences.length,
            byType: {},
            byMeasure: {},
            confirmed: 0,
            unconfirmed: 0
        };
        
        this.differences.forEach(diff => {
            // Count by type
            stats.byType[diff.type] = (stats.byType[diff.type] || 0) + 1;
            
            // Count by measure
            if (diff.measureNumber) {
                stats.byMeasure[diff.measureNumber] = (stats.byMeasure[diff.measureNumber] || 0) + 1;
            }
            
            // Count confirmed/unconfirmed
            if (diff.confirmed) {
                stats.confirmed++;
            } else {
                stats.unconfirmed++;
            }
        });
        
        return stats;
    }

    /**
     * Convert to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            scoreA: this.scoreA,
            scoreB: this.scoreB,
            differences: this.differences.map(d => d.toJSON()),
            created: this.created,
            modified: this.modified
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON data
     * @returns {ComparisonSession} Session instance
     */
    static fromJSON(json) {
        return new ComparisonSession({
            ...json,
            differences: json.differences?.map(d => ScoreDifference.fromJSON(d)) || []
        });
    }
}

/**
 * Score Comparison Manager
 */
export class ScoreComparison {
    constructor(options = {}) {
        this.sessions = new Map();
        this.comparisonSettings = {
            tolerance: 10, // Tick tolerance for time comparisons
            comparePitch: true,
            compareDuration: true,
            compareVelocity: true,
            compareDynamics: true,
            compareArticulations: true,
            compareLyrics: true,
            compareChordSymbols: true,
            compareTimeSignatures: true,
            compareKeySignatures: true,
            compareTempo: true,
            ignoreMinorDifferences: false
        };
        
        this.listeners = new Map();
    }

    /**
     * Compare two scores
     * @param {Object} scoreA - First score
     * @param {Object} scoreB - Second score
     * @param {string} name - Session name
     * @returns {ComparisonSession} Comparison session
     */
    compare(scoreA, scoreB, name = 'Score Comparison') {
        const session = new ComparisonSession({
            name,
            scoreA: { id: scoreA.id, name: scoreA.name || 'Score A' },
            scoreB: { id: scoreB.id, name: scoreB.name || 'Score B' }
        });
        
        // Compare notes
        this._compareNotes(session, scoreA, scoreB);
        
        // Compare time signatures
        if (this.comparisonSettings.compareTimeSignatures) {
            this._compareTimeSignatures(session, scoreA, scoreB);
        }
        
        // Compare key signatures
        if (this.comparisonSettings.compareKeySignatures) {
            this._compareKeySignatures(session, scoreA, scoreB);
        }
        
        // Compare tempo
        if (this.comparisonSettings.compareTempo) {
            this._compareTempo(session, scoreA, scoreB);
        }
        
        // Compare dynamics
        if (this.comparisonSettings.compareDynamics) {
            this._compareDynamics(session, scoreA, scoreB);
        }
        
        // Compare lyrics
        if (this.comparisonSettings.compareLyrics) {
            this._compareLyrics(session, scoreA, scoreB);
        }
        
        // Compare chord symbols
        if (this.comparisonSettings.compareChordSymbols) {
            this._compareChordSymbols(session, scoreA, scoreB);
        }
        
        this.sessions.set(session.id, session);
        this._emit('comparisonComplete', session);
        
        return session;
    }

    /**
     * Compare notes between two scores
     * @private
     */
    _compareNotes(session, scoreA, scoreB) {
        const notesA = this._extractAllNotes(scoreA);
        const notesB = this._extractAllNotes(scoreB);
        
        const tolerance = this.comparisonSettings.tolerance;
        
        // Create maps for faster lookup
        const notesByTimeA = this._groupNotesByTime(notesA, tolerance);
        const notesByTimeB = this._groupNotesByTime(notesB, tolerance);
        
        // Find all unique time points
        const allTimes = new Set([...notesByTimeA.keys(), ...notesByTimeB.keys()]);
        
        allTimes.forEach(time => {
            const notesAtA = notesByTimeA.get(time) || [];
            const notesAtB = notesByTimeB.get(time) || [];
            
            // Compare notes at this time
            this._compareNotesAtTime(session, time, notesAtA, notesAtB);
        });
    }

    /**
     * Compare notes at a specific time
     * @private
     */
    _compareNotesAtTime(session, time, notesA, notesB) {
        const tolerance = this.comparisonSettings.tolerance;
        const matchedB = new Set();
        
        // Try to match notes from A to B
        notesA.forEach(noteA => {
            let matched = false;
            
            for (let i = 0; i < notesB.length; i++) {
                if (matchedB.has(i)) continue;
                
                const noteB = notesB[i];
                
                // Check if notes match (same pitch within tolerance)
                if (Math.abs(noteA.pitch - noteB.pitch) <= 0) {
                    matched = true;
                    matchedB.add(i);
                    
                    // Check for differences in matched notes
                    if (this.comparisonSettings.comparePitch && noteA.pitch !== noteB.pitch) {
                        session.addDifference(new ScoreDifference({
                            type: DifferenceType.NOTE_PITCH_CHANGED,
                            measureNumber: noteA.measure,
                            time: time,
                            oldValue: { pitch: noteA.pitch },
                            newValue: { pitch: noteB.pitch }
                        }));
                    }
                    
                    if (this.comparisonSettings.compareDuration && 
                        Math.abs(noteA.duration - noteB.duration) > tolerance) {
                        session.addDifference(new ScoreDifference({
                            type: DifferenceType.NOTE_DURATION_CHANGED,
                            measureNumber: noteA.measure,
                            time: time,
                            oldValue: { duration: noteA.duration },
                            newValue: { duration: noteB.duration }
                        }));
                    }
                    
                    if (this.comparisonSettings.compareVelocity && 
                        noteA.velocity !== noteB.velocity) {
                        session.addDifference(new ScoreDifference({
                            type: DifferenceType.NOTE_VELOCITY_CHANGED,
                            measureNumber: noteA.measure,
                            time: time,
                            oldValue: { velocity: noteA.velocity },
                            newValue: { velocity: noteB.velocity }
                        }));
                    }
                    
                    break;
                }
            }
            
            if (!matched) {
                // Note in A but not in B - removed
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.NOTE_REMOVED,
                    measureNumber: noteA.measure,
                    time: time,
                    oldValue: {
                        pitch: noteA.pitch,
                        duration: noteA.duration,
                        velocity: noteA.velocity
                    }
                }));
            }
        });
        
        // Find notes in B but not in A - added
        notesB.forEach((noteB, index) => {
            if (!matchedB.has(index)) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.NOTE_ADDED,
                    measureNumber: noteB.measure,
                    time: time,
                    newValue: {
                        pitch: noteB.pitch,
                        duration: noteB.duration,
                        velocity: noteB.velocity
                    }
                }));
            }
        });
    }

    /**
     * Extract all notes from a score
     * @private
     */
    _extractAllNotes(score) {
        const notes = [];
        
        if (score.notes) {
            notes.push(...score.notes);
        }
        
        if (score.tracks) {
            score.tracks.forEach(track => {
                if (track.sequences) {
                    track.sequences.forEach(seq => {
                        if (seq.data) {
                            seq.data.forEach(note => {
                                notes.push({
                                    ...note,
                                    trackId: track.id
                                });
                            });
                        }
                    });
                }
            });
        }
        
        if (score.parts) {
            score.parts.forEach(part => {
                if (part.notes) {
                    notes.push(...part.notes.map(n => ({
                        ...n,
                        partId: part.id
                    })));
                }
            });
        }
        
        return notes;
    }

    /**
     * Group notes by time
     * @private
     */
    _groupNotesByTime(notes, tolerance) {
        const groups = new Map();
        
        notes.forEach(note => {
            const time = note.time || 0;
            // Round to tolerance for grouping
            const roundedTime = Math.round(time / tolerance) * tolerance;
            
            if (!groups.has(roundedTime)) {
                groups.set(roundedTime, []);
            }
            groups.get(roundedTime).push(note);
        });
        
        return groups;
    }

    /**
     * Compare time signatures
     * @private
     */
    _compareTimeSignatures(session, scoreA, scoreB) {
        const tsA = scoreA.timeSignatures || [];
        const tsB = scoreB.timeSignatures || [];
        
        const maxLen = Math.max(tsA.length, tsB.length);
        
        for (let i = 0; i < maxLen; i++) {
            const a = tsA[i];
            const b = tsB[i];
            
            if (!a && b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.TIME_SIGNATURE_CHANGED,
                    measureNumber: b.measure,
                    newValue: `${b.beats}/${b.beatType}`
                }));
            } else if (a && !b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.TIME_SIGNATURE_CHANGED,
                    measureNumber: a.measure,
                    oldValue: `${a.beats}/${a.beatType}`
                }));
            } else if (a && b && (a.beats !== b.beats || a.beatType !== b.beatType)) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.TIME_SIGNATURE_CHANGED,
                    measureNumber: b.measure,
                    oldValue: `${a.beats}/${a.beatType}`,
                    newValue: `${b.beats}/${b.beatType}`
                }));
            }
        }
    }

    /**
     * Compare key signatures
     * @private
     */
    _compareKeySignatures(session, scoreA, scoreB) {
        const ksA = scoreA.keySignatures || [];
        const ksB = scoreB.keySignatures || [];
        
        const maxLen = Math.max(ksA.length, ksB.length);
        
        for (let i = 0; i < maxLen; i++) {
            const a = ksA[i];
            const b = ksB[i];
            
            if (!a && b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.KEY_SIGNATURE_CHANGED,
                    measureNumber: b.measure,
                    newValue: `Fifths: ${b.fifths}`
                }));
            } else if (a && !b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.KEY_SIGNATURE_CHANGED,
                    measureNumber: a.measure,
                    oldValue: `Fifths: ${a.fifths}`
                }));
            } else if (a && b && a.fifths !== b.fifths) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.KEY_SIGNATURE_CHANGED,
                    measureNumber: b.measure,
                    oldValue: `Fifths: ${a.fifths}`,
                    newValue: `Fifths: ${b.fifths}`
                }));
            }
        }
    }

    /**
     * Compare tempo
     * @private
     */
    _compareTempo(session, scoreA, scoreB) {
        const tempoA = scoreA.tempo || scoreA.bpm || 120;
        const tempoB = scoreB.tempo || scoreB.bpm || 120;
        
        if (tempoA !== tempoB) {
            session.addDifference(new ScoreDifference({
                type: DifferenceType.TEMPO_CHANGED,
                oldValue: tempoA,
                newValue: tempoB
            }));
        }
        
        // Compare tempo changes
        const tcA = scoreA.tempoChanges || [];
        const tcB = scoreB.tempoChanges || [];
        
        const maxLen = Math.max(tcA.length, tcB.length);
        
        for (let i = 0; i < maxLen; i++) {
            const a = tcA[i];
            const b = tcB[i];
            
            if (a && b && a.bpm !== b.bpm) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.TEMPO_CHANGED,
                    time: b.time,
                    oldValue: a.bpm,
                    newValue: b.bpm
                }));
            }
        }
    }

    /**
     * Compare dynamics
     * @private
     */
    _compareDynamics(session, scoreA, scoreB) {
        const dynA = scoreA.dynamics || [];
        const dynB = scoreB.dynamics || [];
        
        // Compare dynamics arrays
        const maxLen = Math.max(dynA.length, dynB.length);
        
        for (let i = 0; i < maxLen; i++) {
            const a = dynA[i];
            const b = dynB[i];
            
            if (!a && b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.DYNAMIC_ADDED,
                    time: b.time,
                    newValue: b.type
                }));
            } else if (a && !b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.DYNAMIC_REMOVED,
                    time: a.time,
                    oldValue: a.type
                }));
            } else if (a && b && a.type !== b.type) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.DYNAMIC_CHANGED,
                    time: b.time,
                    oldValue: a.type,
                    newValue: b.type
                }));
            }
        }
    }

    /**
     * Compare lyrics
     * @private
     */
    _compareLyrics(session, scoreA, scoreB) {
        const lyricsA = scoreA.lyrics || [];
        const lyricsB = scoreB.lyrics || [];
        
        // Simple comparison by index
        const maxLen = Math.max(lyricsA.length, lyricsB.length);
        
        for (let i = 0; i < maxLen; i++) {
            const a = lyricsA[i];
            const b = lyricsB[i];
            
            if (!a && b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.LYRIC_ADDED,
                    time: b.time,
                    newValue: b.text
                }));
            } else if (a && !b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.LYRIC_REMOVED,
                    time: a.time,
                    oldValue: a.text
                }));
            } else if (a && b && a.text !== b.text) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.LYRIC_CHANGED,
                    time: b.time,
                    oldValue: a.text,
                    newValue: b.text
                }));
            }
        }
    }

    /**
     * Compare chord symbols
     * @private
     */
    _compareChordSymbols(session, scoreA, scoreB) {
        const chordsA = scoreA.chordSymbols || [];
        const chordsB = scoreB.chordSymbols || [];
        
        const maxLen = Math.max(chordsA.length, chordsB.length);
        
        for (let i = 0; i < maxLen; i++) {
            const a = chordsA[i];
            const b = chordsB[i];
            
            if (!a && b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.CHORD_SYMBOL_ADDED,
                    time: b.time,
                    newValue: b.symbol
                }));
            } else if (a && !b) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.CHORD_SYMBOL_REMOVED,
                    time: a.time,
                    oldValue: a.symbol
                }));
            } else if (a && b && a.symbol !== b.symbol) {
                session.addDifference(new ScoreDifference({
                    type: DifferenceType.CHORD_SYMBOL_CHANGED,
                    time: b.time,
                    oldValue: a.symbol,
                    newValue: b.symbol
                }));
            }
        }
    }

    /**
     * Get a comparison session
     * @param {string} sessionId - Session ID
     * @returns {ComparisonSession|null} Session or null
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get all sessions
     * @returns {ComparisonSession[]} All sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * Delete a session
     * @param {string} sessionId - Session ID
     */
    deleteSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            this.sessions.delete(sessionId);
            this._emit('sessionDeleted', sessionId);
        }
    }

    /**
     * Merge changes from B into A
     * @param {Object} scoreA - Original score
     * @param {Object} scoreB - Score with changes
     * @param {string[]} differenceIds - IDs of differences to apply
     * @returns {Object} Merged score
     */
    mergeChanges(scoreA, scoreB, differenceIds) {
        // Deep clone scoreA
        const merged = JSON.parse(JSON.stringify(scoreA));
        
        // Build lookup for merged tracks/parts
        const tracksMap = new Map();
        if (merged.tracks) {
            merged.tracks.forEach(track => {
                tracksMap.set(track.id, track);
                if (track.sequences) {
                    track.sequences.forEach(seq => {
                        if (seq.data) {
                            seq.data.forEach((note, idx) => {
                                note._idx = idx;
                                note._seqId = seq.id;
                            });
                        }
                    });
                }
            });
        }
        
        // Apply selected differences
        differenceIds.forEach(diffId => {
            // Find the difference by ID in session differences
            const diff = this._findDifferenceById(diffId);
            if (!diff) return;
            
            switch (diff.type) {
                case DifferenceType.NOTE_ADDED: {
                    // Add note from scoreB to merged
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences && diff.newValue) {
                        const seq = targetTrack.sequences[0];
                        if (seq && seq.data) {
                            seq.data.push({ ...diff.newValue });
                        }
                    }
                    break;
                }
                
                case DifferenceType.NOTE_REMOVED: {
                    // Remove note from merged
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences && diff.oldValue) {
                        targetTrack.sequences.forEach(seq => {
                            if (seq.data) {
                                const idx = seq.data.findIndex(n => 
                                    n.time === diff.time && 
                                    n.pitch === diff.oldValue.pitch
                                );
                                if (idx !== -1) {
                                    seq.data.splice(idx, 1);
                                }
                            }
                        });
                    }
                    break;
                }
                
                case DifferenceType.NOTE_PITCH_CHANGED: {
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences) {
                        targetTrack.sequences.forEach(seq => {
                            if (seq.data) {
                                const note = seq.data.find(n => n.time === diff.time);
                                if (note) {
                                    note.pitch = diff.newValue?.pitch;
                                    note.midi = diff.newValue?.midi;
                                }
                            }
                        });
                    }
                    break;
                }
                
                case DifferenceType.NOTE_DURATION_CHANGED: {
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences) {
                        targetTrack.sequences.forEach(seq => {
                            if (seq.data) {
                                const note = seq.data.find(n => n.time === diff.time);
                                if (note) {
                                    note.duration = diff.newValue?.duration;
                                    note.durationTicks = diff.newValue?.durationTicks;
                                }
                            }
                        });
                    }
                    break;
                }
                
                case DifferenceType.NOTE_VELOCITY_CHANGED: {
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences) {
                        targetTrack.sequences.forEach(seq => {
                            if (seq.data) {
                                const note = seq.data.find(n => n.time === diff.time);
                                if (note) {
                                    note.velocity = diff.newValue?.velocity;
                                }
                            }
                        });
                    }
                    break;
                }
                
                case DifferenceType.NOTE_TIME_SHIFTED: {
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences) {
                        targetTrack.sequences.forEach(seq => {
                            if (seq.data) {
                                const note = seq.data.find(n => n.time === diff.oldValue?.time);
                                if (note) {
                                    note.time = diff.newValue?.time;
                                }
                            }
                        });
                    }
                    break;
                }
                
                case DifferenceType.TIME_SIGNATURE_CHANGED: {
                    if (merged.timeSignatures) {
                        const idx = merged.timeSignatures.findIndex(ts => ts.time === diff.time);
                        if (idx !== -1) {
                            merged.timeSignatures[idx] = { 
                                ...merged.timeSignatures[idx], 
                                ...diff.newValue 
                            };
                        } else {
                            merged.timeSignatures.push({ time: diff.time, ...diff.newValue });
                        }
                    } else {
                        merged.timeSignatures = [{ time: diff.time, ...diff.newValue }];
                    }
                    break;
                }
                
                case DifferenceType.KEY_SIGNATURE_CHANGED: {
                    if (merged.keySignatures) {
                        const idx = merged.keySignatures.findIndex(ks => ks.time === diff.time);
                        if (idx !== -1) {
                            merged.keySignatures[idx] = { 
                                ...merged.keySignatures[idx], 
                                ...diff.newValue 
                            };
                        } else {
                            merged.keySignatures.push({ time: diff.time, ...diff.newValue });
                        }
                    } else {
                        merged.keySignatures = [{ time: diff.time, ...diff.newValue }];
                    }
                    break;
                }
                
                case DifferenceType.TEMPO_CHANGED: {
                    if (merged.tempoChanges) {
                        const idx = merged.tempoChanges.findIndex(tc => tc.time === diff.time);
                        if (idx !== -1) {
                            merged.tempoChanges[idx] = { 
                                ...merged.tempoChanges[idx], 
                                bpm: diff.newValue 
                            };
                        } else {
                            merged.tempoChanges.push({ time: diff.time, bpm: diff.newValue });
                        }
                    } else {
                        merged.tempoChanges = [{ time: diff.time, bpm: diff.newValue }];
                    }
                    if (merged.bpm) {
                        merged.bpm = diff.newValue;
                    }
                    break;
                }
                
                case DifferenceType.DYNAMIC_ADDED: {
                    if (!merged.dynamics) merged.dynamics = [];
                    merged.dynamics.push({
                        time: diff.time,
                        value: diff.newValue,
                        type: diff.partId
                    });
                    break;
                }
                
                case DifferenceType.DYNAMIC_REMOVED: {
                    if (merged.dynamics) {
                        merged.dynamics = merged.dynamics.filter(d => 
                            !(d.time === diff.time && d.value === diff.oldValue)
                        );
                    }
                    break;
                }
                
                case DifferenceType.DYNAMIC_CHANGED: {
                    if (merged.dynamics) {
                        const dyn = merged.dynamics.find(d => d.time === diff.time);
                        if (dyn) {
                            dyn.value = diff.newValue;
                        }
                    }
                    break;
                }
                
                case DifferenceType.LYRIC_ADDED: {
                    if (!merged.lyrics) merged.lyrics = [];
                    merged.lyrics.push({
                        time: diff.time,
                        text: diff.newValue,
                        partId: diff.partId
                    });
                    break;
                }
                
                case DifferenceType.LYRIC_REMOVED: {
                    if (merged.lyrics) {
                        merged.lyrics = merged.lyrics.filter(l => 
                            !(l.time === diff.time && l.text === diff.oldValue)
                        );
                    }
                    break;
                }
                
                case DifferenceType.LYRIC_CHANGED: {
                    if (merged.lyrics) {
                        const lyric = merged.lyrics.find(l => l.time === diff.time);
                        if (lyric) {
                            lyric.text = diff.newValue;
                        }
                    }
                    break;
                }
                
                case DifferenceType.CHORD_SYMBOL_ADDED: {
                    if (!merged.chordSymbols) merged.chordSymbols = [];
                    merged.chordSymbols.push({
                        time: diff.time,
                        symbol: diff.newValue
                    });
                    break;
                }
                
                case DifferenceType.CHORD_SYMBOL_REMOVED: {
                    if (merged.chordSymbols) {
                        merged.chordSymbols = merged.chordSymbols.filter(c => 
                            !(c.time === diff.time && c.symbol === diff.oldValue)
                        );
                    }
                    break;
                }
                
                case DifferenceType.CHORD_SYMBOL_CHANGED: {
                    if (merged.chordSymbols) {
                        const chord = merged.chordSymbols.find(c => c.time === diff.time);
                        if (chord) {
                            chord.symbol = diff.newValue;
                        }
                    }
                    break;
                }
                
                case DifferenceType.ARTICULATION_ADDED: {
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences) {
                        targetTrack.sequences.forEach(seq => {
                            if (seq.data) {
                                const note = seq.data.find(n => n.time === diff.time);
                                if (note) {
                                    if (!note.articulations) note.articulations = [];
                                    note.articulations.push(diff.newValue);
                                }
                            }
                        });
                    }
                    break;
                }
                
                case DifferenceType.ARTICULATION_REMOVED: {
                    const targetTrack = tracksMap.get(diff.partId);
                    if (targetTrack && targetTrack.sequences) {
                        targetTrack.sequences.forEach(seq => {
                            if (seq.data) {
                                const note = seq.data.find(n => n.time === diff.time);
                                if (note && note.articulations) {
                                    note.articulations = note.articulations.filter(a => a !== diff.oldValue);
                                }
                            }
                        });
                    }
                    break;
                }
            }
        });
        
        // Sort notes by time in each track
        if (merged.tracks) {
            merged.tracks.forEach(track => {
                if (track.sequences) {
                    track.sequences.forEach(seq => {
                        if (seq.data) {
                            seq.data.sort((a, b) => a.time - b.time);
                            // Clean up temporary properties
                            seq.data.forEach(note => {
                                delete note._idx;
                                delete note._seqId;
                            });
                        }
                    });
                }
            });
        }
        
        return merged;
    }
    
    /**
     * Find a difference by ID across all sessions
     * @private
     * @param {string} diffId - Difference ID
     * @returns {ScoreDifference|null} Difference or null
     */
    _findDifferenceById(diffId) {
        for (const session of this.sessions.values()) {
            const diff = session.differences.find(d => d.id === diffId);
            if (diff) return diff;
        }
        return null;
    }

    /**
     * Create comparison report
     * @param {ComparisonSession} session - Comparison session
     * @returns {string} HTML report
     */
    createReport(session) {
        const stats = session.getSummary();
        
        let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Score Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .difference { padding: 10px; border-bottom: 1px solid #eee; }
        .difference.added { background: #e8f5e9; }
        .difference.removed { background: #ffebee; }
        .difference.changed { background: #fff3e0; }
        .type { font-weight: bold; color: #666; }
        .measure { color: #999; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>Score Comparison Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Comparing: ${session.scoreA?.name || 'Score A'} vs ${session.scoreB?.name || 'Score B'}</p>
        <p>Total differences: ${stats.totalDifferences}</p>
        <p>Confirmed: ${stats.confirmed} | Unconfirmed: ${stats.unconfirmed}</p>
    </div>
    <div class="differences">
        <h2>Differences</h2>`;
        
        session.differences.forEach(diff => {
            const typeClass = diff.type.includes('ADDED') ? 'added' : 
                             diff.type.includes('REMOVED') ? 'removed' : 'changed';
            html += `
        <div class="difference ${typeClass}">
            <span class="type">${diff.type}</span>
            <span class="measure">Measure ${diff.measureNumber || 'N/A'}</span>
            <p>${diff.getDescription()}</p>
        </div>`;
        });
        
        html += `
    </div>
</body>
</html>`;
        
        return html;
    }

    /**
     * Update comparison settings
     * @param {Object} settings - New settings
     */
    updateSettings(settings) {
        Object.assign(this.comparisonSettings, settings);
        this._emit('settingsChange', this.comparisonSettings);
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }
}

/**
 * Create a default instance
 */
export function createScoreComparison(options = {}) {
    return new ScoreComparison(options);
}

/**
 * Quick function to compare two scores
 */
export function compareScores(scoreA, scoreB, name = 'Score Comparison') {
    const comparison = new ScoreComparison();
    return comparison.compare(scoreA, scoreB, name);
}