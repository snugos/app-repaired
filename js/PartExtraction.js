// js/PartExtraction.js - Part Extraction for SnugOS DAW
// Features: Extract individual parts from full score, create parts from tracks

/**
 * Part Types
 */
export const PartType = {
    FLUTE: 'flute',
    OBOE: 'oboe',
    CLARINET: 'clarinet',
    BASSOON: 'bassoon',
    SAXOPHONE: 'saxophone',
    TRUMPET: 'trumpet',
    HORN: 'horn',
    TROMBONE: 'trombone',
    TUBA: 'tuba',
    VIOLIN1: 'violin1',
    VIOLIN2: 'violin2',
    VIOLA: 'viola',
    CELLO: 'cello',
    DOUBLE_BASS: 'double_bass',
    PIANO: 'piano',
    GUITAR: 'guitar',
    DRUMS: 'drums',
    VOCAL: 'vocal',
    SYNTH: 'synth'
};

/**
 * Standard Orchestral Layout
 */
export const OrchestralLayout = {
    WOODWINDS: ['piccolo', 'flute', 'oboe', 'english_horn', 'clarinet', 'bass_clarinet', 'bassoon', 'contrabassoon'],
    BRASS: ['horn', 'trumpet', 'trombone', 'tuba'],
    PERCUSSION: ['timpani', 'percussion', 'xylophone', 'glockenspiel', 'celesta'],
    STRINGS: ['violin1', 'violin2', 'viola', 'cello', 'double_bass'],
    KEYBOARDS: ['piano', 'harpsichord', 'organ', 'celesta']
};

/**
 * Clef Assignments by Instrument
 */
export const InstrumentClefs = {
    flute: 'treble',
    piccolo: 'treble',
    oboe: 'treble',
    english_horn: 'treble',
    clarinet_bb: 'treble',
    clarinet: 'treble',
    bass_clarinet: 'treble',
    bassoon: 'bass',
    contrabassoon: 'bass',
    sax_soprano: 'treble',
    sax_alto: 'treble',
    sax_tenor: 'treble',
    sax_baritone: 'treble',
    trumpet_bb: 'treble',
    trumpet: 'treble',
    horn_f: 'treble',
    horn: 'treble',
    trombone: 'bass',
    bass_trombone: 'bass',
    tuba: 'bass',
    violin1: 'treble',
    violin2: 'treble',
    violin: 'treble',
    viola: 'alto',
    cello: 'bass',
    double_bass: 'bass',
    piano: 'grand', // Both treble and bass
    guitar: 'treble',
    bass_guitar: 'bass',
    drums: 'percussion',
    vocal: 'treble',
    synth: 'treble'
};

/**
 * Extracted Part
 */
export class ExtractedPart {
    constructor(options = {}) {
        this.id = options.id || `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Untitled Part';
        this.partType = options.partType || PartType.SYNTH;
        this.instrument = options.instrument || 'unknown';
        this.clef = options.clef || 'treble';
        this.transpose = options.transpose || 0; // Semitones
        this.trackId = options.trackId || null;
        this.notes = options.notes || [];
        this.measures = options.measures || [];
        this.timeSignatures = options.timeSignatures || [];
        this.keySignatures = options.keySignatures || [];
        this.tempoChanges = options.tempoChanges || [];
        this.dynamics = options.dynamics || [];
        this.articulations = options.articulations || [];
        this.lyrics = options.lyrics || [];
        this.chordSymbols = options.chordSymbols || [];
        this.pageLayout = options.pageLayout || null;
        this.created = options.created || new Date().toISOString();
        this.modified = options.modified || new Date().toISOString();
    }

    /**
     * Add notes to the part
     * @param {Object[]} notes - Array of note objects
     */
    addNotes(notes) {
        this.notes.push(...notes);
        this.modified = new Date().toISOString();
    }

    /**
     * Set time signature
     * @param {number} measure - Measure number
     * @param {Object} timeSig - Time signature {beats, beatType}
     */
    setTimeSignature(measure, timeSig) {
        const existing = this.timeSignatures.findIndex(ts => ts.measure === measure);
        if (existing >= 0) {
            this.timeSignatures[existing] = { measure, ...timeSig };
        } else {
            this.timeSignatures.push({ measure, ...timeSig });
        }
        this.timeSignatures.sort((a, b) => a.measure - b.measure);
    }

    /**
     * Set key signature
     * @param {number} measure - Measure number
     * @param {Object} keySig - Key signature {fifths, mode}
     */
    setKeySignature(measure, keySig) {
        const existing = this.keySignatures.findIndex(ks => ks.measure === measure);
        if (existing >= 0) {
            this.keySignatures[existing] = { measure, ...keySig };
        } else {
            this.keySignatures.push({ measure, ...keySig });
        }
        this.keySignatures.sort((a, b) => a.measure - b.measure);
    }

    /**
     * Transpose the part
     * @param {number} semitones - Transposition in semitones
     */
    transpose(semitones) {
        this.notes = this.notes.map(note => ({
            ...note,
            pitch: note.pitch + semitones,
            midi: note.midi !== undefined ? note.midi + semitones : undefined
        }));
        this.transpose += semitones;
        this.modified = new Date().toISOString();
    }

    /**
     * Get notes in a measure range
     * @param {number} startMeasure - Start measure (1-indexed)
     * @param {number} endMeasure - End measure (inclusive)
     * @returns {Object[]} Notes in range
     */
    getNotesInMeasures(startMeasure, endMeasure) {
        return this.notes.filter(note => 
            note.measure >= startMeasure && note.measure <= endMeasure
        );
    }

    /**
     * Export to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            partType: this.partType,
            instrument: this.instrument,
            clef: this.clef,
            transpose: this.transpose,
            trackId: this.trackId,
            notes: this.notes,
            measures: this.measures,
            timeSignatures: this.timeSignatures,
            keySignatures: this.keySignatures,
            tempoChanges: this.tempoChanges,
            dynamics: this.dynamics,
            articulations: this.articulations,
            lyrics: this.lyrics,
            chordSymbols: this.chordSymbols,
            pageLayout: this.pageLayout,
            created: this.created,
            modified: this.modified
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON data
     * @returns {ExtractedPart} Part instance
     */
    static fromJSON(json) {
        return new ExtractedPart(json);
    }
}

/**
 * Part Extraction Manager
 */
export class PartExtraction {
    constructor(options = {}) {
        this.parts = new Map();
        this.extractionSettings = {
            includeDynamics: true,
            includeArticulations: true,
            includeLyrics: true,
            includeChordSymbols: true,
            autoTranspose: true,
            autoClef: true,
            splitVoices: true,
            mergeRests: true
        };
        
        this.listeners = new Map();
    }

    /**
     * Extract part from a track
     * @param {Object} track - Track object
     * @param {Object} options - Extraction options
     * @returns {ExtractedPart} Extracted part
     */
    extractFromTrack(track, options = {}) {
        const settings = { ...this.extractionSettings, ...options };
        
        // Determine instrument type from track
        const partType = this._determinePartType(track);
        const instrument = this._getInstrumentName(track, partType);
        const clef = settings.autoClef ? this._determineClef(partType, track) : 'treble';
        const transpose = settings.autoTranspose ? this._determineTransposition(partType) : 0;
        
        // Extract notes
        const notes = this._extractNotes(track, settings);
        
        // Extract other elements
        const dynamics = settings.includeDynamics ? this._extractDynamics(track) : [];
        const articulations = settings.includeArticulations ? this._extractArticulations(track) : [];
        const lyrics = settings.includeLyrics ? this._extractLyrics(track) : [];
        const chordSymbols = settings.includeChordSymbols ? this._extractChordSymbols(track) : [];
        
        const part = new ExtractedPart({
            name: track.name || `${instrument} Part`,
            partType,
            instrument,
            clef,
            transpose,
            trackId: track.id,
            notes,
            timeSignatures: this._extractTimeSignatures(track),
            keySignatures: this._extractKeySignatures(track),
            tempoChanges: this._extractTempoChanges(track),
            dynamics,
            articulations,
            lyrics,
            chordSymbols
        });
        
        this.parts.set(part.id, part);
        this._emit('partExtracted', part);
        
        return part;
    }

    /**
     * Extract parts from multiple tracks
     * @param {Object[]} tracks - Array of track objects
     * @param {Object} options - Extraction options
     * @returns {ExtractedPart[]} Extracted parts
     */
    extractFromTracks(tracks, options = {}) {
        return tracks.map(track => this.extractFromTrack(track, options));
    }

    /**
     * Extract individual voice as separate part
     * @param {Object} track - Track object
     * @param {number} voiceNumber - Voice number (1-indexed)
     * @param {Object} options - Extraction options
     * @returns {ExtractedPart} Extracted part
     */
    extractVoice(track, voiceNumber, options = {}) {
        const settings = { ...this.extractionSettings, ...options };
        
        // Filter notes by voice
        const notes = this._extractNotes(track, settings)
            .filter(note => note.voice === voiceNumber);
        
        const partType = this._determinePartType(track);
        const instrument = `${this._getInstrumentName(track, partType)} Voice ${voiceNumber}`;
        
        const part = new ExtractedPart({
            name: instrument,
            partType,
            instrument,
            clef: this._determineClef(partType, track),
            trackId: track.id,
            notes,
            timeSignatures: this._extractTimeSignatures(track),
            keySignatures: this._extractKeySignatures(track)
        });
        
        this.parts.set(part.id, part);
        this._emit('partExtracted', part);
        
        return part;
    }

    /**
     * Split track into multiple parts by voice
     * @param {Object} track - Track object
     * @param {Object} options - Extraction options
     * @returns {ExtractedPart[]} Array of parts
     */
    splitByVoice(track, options = {}) {
        const settings = { ...this.extractionSettings, ...options };
        
        if (!settings.splitVoices) {
            return [this.extractFromTrack(track, options)];
        }
        
        // Get unique voice numbers
        const voices = new Set();
        if (track.sequences) {
            track.sequences.forEach(seq => {
                if (seq.data) {
                    seq.data.forEach(note => {
                        voices.add(note.voice || 1);
                    });
                }
            });
        }
        
        // If only one voice, return single part
        if (voices.size <= 1) {
            return [this.extractFromTrack(track, options)];
        }
        
        // Extract each voice as separate part
        const parts = [];
        voices.forEach(voiceNum => {
            const part = this.extractVoice(track, voiceNum, options);
            parts.push(part);
        });
        
        return parts;
    }

    /**
     * Get extracted part by ID
     * @param {string} partId - Part ID
     * @returns {ExtractedPart|null} Part or null
     */
    getPart(partId) {
        return this.parts.get(partId) || null;
    }

    /**
     * Get all extracted parts
     * @returns {ExtractedPart[]} Array of parts
     */
    getAllParts() {
        return Array.from(this.parts.values());
    }

    /**
     * Remove a part
     * @param {string} partId - Part ID
     */
    removePart(partId) {
        if (this.parts.has(partId)) {
            this.parts.delete(partId);
            this._emit('partRemoved', partId);
        }
    }

    /**
     * Create score from extracted parts
     * @param {ExtractedPart[]} parts - Array of parts
     * @param {Object} options - Score options
     * @returns {Object} Score data
     */
    createScore(parts, options = {}) {
        const scoreParts = parts.map(part => ({
            id: part.id,
            name: part.name,
            instrument: part.instrument,
            clef: part.clef,
            transpose: part.transpose,
            notes: part.notes,
            timeSignatures: part.timeSignatures,
            keySignatures: part.keySignatures
        }));
        
        // Calculate common time/key signatures
        const commonTimeSigs = this._findCommonTimeSignatures(parts);
        const commonKeySigs = this._findCommonKeySignatures(parts);
        
        return {
            title: options.title || 'Extracted Score',
            composer: options.composer || '',
            parts: scoreParts,
            timeSignatures: commonTimeSigs,
            keySignatures: commonKeySigs,
            tempoChanges: parts[0]?.tempoChanges || [],
            created: new Date().toISOString()
        };
    }

    /**
     * Export parts to MusicXML format
     * @param {ExtractedPart[]} parts - Array of parts
     * @returns {string} MusicXML string
     */
    exportToMusicXML(parts) {
        // This would integrate with MusicXMLExport.js
        const score = this.createScore(parts);
        
        // Build MusicXML structure
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${this._escapeXml(score.title)}</work-title>
  </work>
  <identification>
    <creator type="composer">${this._escapeXml(score.composer)}</creator>
    <encoding>
      <software>SnugOS DAW Part Extraction</software>
      <encoding-date>${new Date().toISOString().split('T')[0]}</encoding-date>
    </encoding>
  </identification>
  <part-list>`;
        
        // Add part list
        parts.forEach(part => {
            xml += `
    <score-part id="${part.id}">
      <part-name>${this._escapeXml(part.name)}</part-name>
      <part-abbreviation>${this._escapeXml(part.instrument.substring(0, 3))}</part-abbreviation>
    </score-part>`;
        });
        
        xml += `
  </part-list>`;
        
        // Add parts
        parts.forEach(part => {
            xml += `
  <part id="${part.id}">`;
            
            // Group notes by measure
            const measures = this._groupNotesByMeasure(part.notes);
            
            measures.forEach((measureNotes, measureNum) => {
                xml += `
    <measure number="${measureNum}">`;
                
                // Add attributes for first measure
                if (measureNum === 1) {
                    xml += `
      <attributes>
        <divisions>4</divisions>
        <key>
          <fifths>${part.keySignatures[0]?.fifths || 0}</fifths>
          <mode>${part.keySignatures[0]?.mode || 'major'}</mode>
        </key>
        <time>
          <beats>${part.timeSignatures[0]?.beats || 4}</beats>
          <beat-type>${part.timeSignatures[0]?.beatType || 4}</beat-type>
        </time>
        <clef>
          <sign>${part.clef === 'treble' ? 'G' : part.clef === 'bass' ? 'F' : part.clef === 'alto' ? 'C' : 'G'}</sign>
          <line>${part.clef === 'treble' ? 2 : part.clef === 'bass' ? 4 : part.clef === 'alto' ? 3 : 2}</line>
        </clef>
      </attributes>`;
                }
                
                // Add notes
                measureNotes.forEach(note => {
                    xml += this._noteToMusicXML(note, part.clef, part.transpose);
                });
                
                xml += `
    </measure>`;
            });
            
            xml += `
  </part>`;
        });
        
        xml += `
</score-partwise>`;
        
        return xml;
    }

    /**
     * Determine part type from track
     * @private
     */
    _determinePartType(track) {
        const type = track.type?.toLowerCase();
        const name = track.name?.toLowerCase();
        
        // Check track type
        if (type === 'synth') return PartType.SYNTH;
        if (type === 'audio' && name?.includes('drum')) return PartType.DRUMS;
        if (type === 'audio' && name?.includes('vocal')) return PartType.VOCAL;
        
        // Check name patterns
        if (name?.includes('piano')) return PartType.PIANO;
        if (name?.includes('guitar')) return PartType.GUITAR;
        if (name?.includes('drum')) return PartType.DRUMS;
        if (name?.includes('vocal')) return PartType.VOCAL;
        if (name?.includes('violin') || name?.includes('violin1')) return PartType.VIOLIN1;
        if (name?.includes('violin2')) return PartType.VIOLIN2;
        if (name?.includes('viola')) return PartType.VIOLA;
        if (name?.includes('cello')) return PartType.CELLO;
        if (name?.includes('bass')) return PartType.DOUBLE_BASS;
        if (name?.includes('flute')) return PartType.FLUTE;
        if (name?.includes('clarinet')) return PartType.CLARINET;
        if (name?.includes('trumpet')) return PartType.TRUMPET;
        if (name?.includes('horn')) return PartType.HORN;
        if (name?.includes('trombone')) return PartType.TROMBONE;
        
        return PartType.SYNTH;
    }

    /**
     * Get instrument name
     * @private
     */
    _getInstrumentName(track, partType) {
        if (track.name && track.name !== `${track.type} Track ${track.id}`) {
            return track.name;
        }
        
        const names = {
            [PartType.FLUTE]: 'Flute',
            [PartType.OBOE]: 'Oboe',
            [PartType.CLARINET]: 'Clarinet',
            [PartType.BASSOON]: 'Bassoon',
            [PartType.SAXOPHONE]: 'Saxophone',
            [PartType.TRUMPET]: 'Trumpet',
            [PartType.HORN]: 'French Horn',
            [PartType.TROMBONE]: 'Trombone',
            [PartType.TUBA]: 'Tuba',
            [PartType.VIOLIN1]: 'Violin I',
            [PartType.VIOLIN2]: 'Violin II',
            [PartType.VIOLA]: 'Viola',
            [PartType.CELLO]: 'Cello',
            [PartType.DOUBLE_BASS]: 'Double Bass',
            [PartType.PIANO]: 'Piano',
            [PartType.GUITAR]: 'Guitar',
            [PartType.DRUMS]: 'Drums',
            [PartType.VOCAL]: 'Voice',
            [PartType.SYNTH]: 'Synthesizer'
        };
        
        return names[partType] || 'Unknown Instrument';
    }

    /**
     * Determine clef for part
     * @private
     */
    _determineClef(partType, track) {
        // Check track's average pitch range
        if (track.sequences) {
            let totalPitch = 0;
            let noteCount = 0;
            
            track.sequences.forEach(seq => {
                if (seq.data) {
                    seq.data.forEach(note => {
                        if (note.pitch !== undefined) {
                            totalPitch += note.pitch;
                            noteCount++;
                        }
                    });
                }
            });
            
            if (noteCount > 0) {
                const avgPitch = totalPitch / noteCount;
                if (avgPitch >= 60) return 'treble'; // Middle C and above
                if (avgPitch >= 48) return 'alto'; // C3 to C4
                return 'bass'; // Below C3
            }
        }
        
        // Use default clef by instrument
        return InstrumentClefs[partType] || 'treble';
    }

    /**
     * Determine transposition for part
     * @private
     */
    _determineTransposition(partType) {
        const transpositions = {
            [PartType.CLARINET]: 2, // Bb clarinet
            [PartType.TRUMPET]: 2, // Bb trumpet
            [PartType.HORN]: -7, // Horn in F
            [PartType.SAXOPHONE]: -3 // Alto sax (default)
        };
        
        return transpositions[partType] || 0;
    }

    /**
     * Extract notes from track
     * @private
     */
    _extractNotes(track, settings) {
        const notes = [];
        
        if (track.sequences) {
            track.sequences.forEach(seq => {
                if (seq.data) {
                    seq.data.forEach(note => {
                        notes.push({
                            pitch: note.pitch || note.midi,
                            midi: note.midi || note.pitch,
                            duration: note.duration,
                            durationTicks: note.durationTicks,
                            time: note.time,
                            velocity: note.velocity,
                            voice: note.voice || 1,
                            measure: note.measure || 1,
                            tieStart: note.tieStart,
                            tieEnd: note.tieEnd
                        });
                    });
                }
            });
        }
        
        // Sort notes by time first
        notes.sort((a, b) => a.time - b.time);
        
        // Merge rests if enabled
        if (settings.mergeRests) {
            // Find and merge consecutive rests
            // Identify gaps between notes as rests
            const rests = [];
            let lastEndTime = 0;
            let lastMeasure = 1;
            
            // Calculate ticks per measure (assuming 4/4 time, 480 ticks per quarter note)
            const ticksPerBeat = 480;
            const beatsPerMeasure = 4;
            const ticksPerMeasure = ticksPerBeat * beatsPerMeasure;
            
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                const noteEndTime = note.time + (note.durationTicks || note.duration * ticksPerBeat);
                
                // Check if there's a gap (rest) between last note and current note
                if (note.time > lastEndTime) {
                    const restDuration = note.time - lastEndTime;
                    const restDurationTicks = restDuration;
                    
                    // Calculate measure for the rest
                    const restMeasure = Math.floor(lastEndTime / ticksPerMeasure) + 1;
                    
                    rests.push({
                        isRest: true,
                        time: lastEndTime,
                        duration: restDuration / ticksPerBeat,
                        durationTicks: restDurationTicks,
                        measure: restMeasure,
                        voice: note.voice || 1
                    });
                }
                
                lastEndTime = Math.max(lastEndTime, noteEndTime);
                lastMeasure = note.measure || lastMeasure;
            }
            
            // Merge consecutive rests in the same measure and voice
            const mergedRests = [];
            const restsByMeasure = new Map();
            
            rests.forEach(rest => {
                const key = `${rest.measure}_${rest.voice}`;
                if (!restsByMeasure.has(key)) {
                    restsByMeasure.set(key, []);
                }
                restsByMeasure.get(key).push(rest);
            });
            
            restsByMeasure.forEach((measureRests, key) => {
                // Sort by time
                measureRests.sort((a, b) => a.time - b.time);
                
                // Merge consecutive rests
                let currentRest = null;
                measureRests.forEach(rest => {
                    if (!currentRest) {
                        currentRest = { ...rest };
                    } else {
                        const currentEnd = currentRest.time + currentRest.durationTicks;
                        // Check if rests are consecutive (within small tolerance)
                        if (Math.abs(rest.time - currentEnd) < 10) {
                            // Merge
                            currentRest.durationTicks += rest.durationTicks;
                            currentRest.duration += rest.duration;
                        } else {
                            // Gap between rests, push current and start new
                            mergedRests.push(currentRest);
                            currentRest = { ...rest };
                        }
                    }
                });
                if (currentRest) {
                    mergedRests.push(currentRest);
                }
            });
            
            // Add merged rests to notes array
            mergedRests.forEach(rest => {
                notes.push({
                    isRest: true,
                    pitch: null,
                    midi: null,
                    duration: rest.duration,
                    durationTicks: rest.durationTicks,
                    time: rest.time,
                    velocity: 0,
                    voice: rest.voice,
                    measure: rest.measure
                });
            });
        }
        
        return notes.sort((a, b) => a.time - b.time);
    }

    /**
     * Extract dynamics from track
     * @private
     */
    _extractDynamics(track) {
        if (!track.automation) return [];
        
        return track.automation
            .filter(auto => auto.parameter === 'volume' || auto.parameter === 'velocity')
            .map(auto => ({
                time: auto.time,
                value: auto.value,
                type: this._getDynamicType(auto.value)
            }));
    }

    /**
     * Get dynamic marking from value
     * @private
     */
    _getDynamicType(value) {
        if (value < 0.2) return 'pp';
        if (value < 0.35) return 'p';
        if (value < 0.5) return 'mp';
        if (value < 0.65) return 'mf';
        if (value < 0.8) return 'f';
        return 'ff';
    }

    /**
     * Extract articulations from track
     * @private
     */
    _extractArticulations(track) {
        // Would extract articulation data from track notes
        return [];
    }

    /**
     * Extract lyrics from track
     * @private
     */
    _extractLyrics(track) {
        if (!track.lyrics) return [];
        return track.lyrics.map(lyric => ({
            time: lyric.time,
            text: lyric.text,
            duration: lyric.duration
        }));
    }

    /**
     * Extract chord symbols from track
     * @private
     */
    _extractChordSymbols(track) {
        if (!track.chordSymbols) return [];
        return track.chordSymbols.map(chord => ({
            time: chord.time,
            symbol: chord.symbol,
            duration: chord.duration
        }));
    }

    /**
     * Extract time signatures from track
     * @private
     */
    _extractTimeSignatures(track) {
        if (!track.timeSignatures) return [{ measure: 1, beats: 4, beatType: 4 }];
        return track.timeSignatures;
    }

    /**
     * Extract key signatures from track
     * @private
     */
    _extractKeySignatures(track) {
        if (!track.keySignatures) return [{ measure: 1, fifths: 0, mode: 'major' }];
        return track.keySignatures;
    }

    /**
     * Extract tempo changes from track
     * @private
     */
    _extractTempoChanges(track) {
        if (!track.tempoChanges) return [];
        return track.tempoChanges;
    }

    /**
     * Find common time signatures across parts
     * @private
     */
    _findCommonTimeSignatures(parts) {
        const timeSigs = parts[0]?.timeSignatures || [{ measure: 1, beats: 4, beatType: 4 }];
        return timeSigs;
    }

    /**
     * Find common key signatures across parts
     * @private
     */
    _findCommonKeySignatures(parts) {
        const keySigs = parts[0]?.keySignatures || [{ measure: 1, fifths: 0, mode: 'major' }];
        return keySigs;
    }

    /**
     * Group notes by measure
     * @private
     */
    _groupNotesByMeasure(notes) {
        const measures = new Map();
        
        notes.forEach(note => {
            const measure = note.measure || 1;
            if (!measures.has(measure)) {
                measures.set(measure, []);
            }
            measures.get(measure).push(note);
        });
        
        return measures;
    }

    /**
     * Convert note to MusicXML
     * @private
     */
    _noteToMusicXML(note, clef, transpose) {
        const pitch = note.pitch + (transpose || 0);
        const pitchClass = pitch % 12;
        const octave = Math.floor(pitch / 12) - 1;
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const step = noteNames[pitchClass].replace('#', '');
        const alter = noteNames[pitchClass].includes('#') ? 1 : 0;
        
        let xml = `
      <note>
        <pitch>
          <step>${step}</step>
          ${alter ? `<alter>${alter}</alter>` : ''}
          <octave>${octave}</octave>
        </pitch>
        <duration>${note.durationTicks || Math.round(note.duration * 4)}</duration>
        <voice>${note.voice || 1}</voice>
        <type>quarter</type>
        <stem>up</stem>
      </note>`;
        
        return xml;
    }

    /**
     * Escape XML characters
     * @private
     */
    _escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Update extraction settings
     * @param {Object} settings - New settings
     */
    updateSettings(settings) {
        Object.assign(this.extractionSettings, settings);
        this._emit('settingsChange', this.extractionSettings);
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

    /**
     * Export to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            parts: Array.from(this.parts.values()).map(p => p.toJSON()),
            extractionSettings: this.extractionSettings
        };
    }

    /**
     * Import from JSON
     * @param {Object} json - JSON data
     */
    fromJSON(json) {
        this.parts.clear();
        if (json.parts) {
            json.parts.forEach(partData => {
                const part = ExtractedPart.fromJSON(partData);
                this.parts.set(part.id, part);
            });
        }
        if (json.extractionSettings) {
            Object.assign(this.extractionSettings, json.extractionSettings);
        }
    }
}

/**
 * Create a default instance
 */
export function createPartExtraction(options = {}) {
    return new PartExtraction(options);
}

/**
 * Quick function to extract a part from a track
 */
export function extractPart(track, options = {}) {
    const extraction = new PartExtraction();
    return extraction.extractFromTrack(track, options);
}

/**
 * Quick function to extract all parts from tracks
 */
export function extractAllParts(tracks, options = {}) {
    const extraction = new PartExtraction();
    return extraction.extractFromTracks(tracks, options);
}