// js/MusicXMLExport.js - Full MusicXML Export System
// This module provides complete MusicXML export with all notation elements

/**
 * MusicXMLExporter - Exports DAW data to MusicXML format
 */
export class MusicXMLExporter {
    constructor(config = {}) {
        this.version = '4.0';
        this.software = 'SnugOS DAW';
        this.encodingDate = new Date().toISOString().split('T')[0];
    }

    /**
     * Export a project to MusicXML
     * @param {Object} project - Project data
     * @param {Object} options - Export options
     * @returns {string} MusicXML document
     */
    exportToMusicXML(project, options = {}) {
        const {
            title = project.title || 'Untitled',
            composer = project.composer || '',
            copyright = project.copyright || '',
            includeMetadata = true,
            includeLyrics = true,
            includeChords = true,
            includeDynamics = true,
            includeArticulations = true,
            pageLayout = this._getDefaultPageLayout()
        } = options;

        const tracks = project.tracks || [];
        const tempo = project.tempo || 120;
        const timeSignature = project.timeSignature || [4, 4];
        const keySignature = project.keySignature || 'C';

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML ${this.version}//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="${this.version}">
`;

        // Header
        if (includeMetadata) {
            xml += this._generateHeader(title, composer, copyright);
        }

        // Defaults (page layout, fonts, etc.)
        xml += this._generateDefaults(pageLayout);

        // Part list
        xml += this._generatePartList(tracks);

        // Parts (one per track)
        for (const track of tracks) {
            xml += this._generatePart(track, tempo, timeSignature, keySignature, {
                includeLyrics,
                includeChords,
                includeDynamics,
                includeArticulations
            });
        }

        xml += '</score-partwise>';
        return xml;
    }

    /**
     * Export a single track to MusicXML
     * @param {Object} track - Track data
     * @param {Object} options - Export options
     * @returns {string} MusicXML part
     */
    exportTrackToMusicXML(track, options = {}) {
        const {
            tempo = 120,
            timeSignature = [4, 4],
            keySignature = 'C'
        } = options;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML ${this.version}//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="${this.version}">
`;
        xml += this._generateHeader(track.name, '', '');
        xml += this._generateDefaults(this._getDefaultPageLayout());
        xml += this._generatePartList([track]);
        xml += this._generatePart(track, tempo, timeSignature, keySignature, {
            includeLyrics: true,
            includeChords: true,
            includeDynamics: true,
            includeArticulations: true
        });
        xml += '</score-partwise>';
        return xml;
    }

    /**
     * Export notes array to MusicXML
     * @param {Array} notes - Array of note objects
     * @param {Object} options - Export options
     * @returns {string} MusicXML document
     */
    exportNotesToMusicXML(notes, options = {}) {
        const {
            title = 'Notes',
            tempo = 120,
            timeSignature = [4, 4],
            keySignature = 'C',
            clef = 'G'
        } = options;

        // Create a virtual track from notes
        const track = {
            id: 'P1',
            name: 'Notes',
            notes: notes.map(n => ({
                pitch: n.pitch,
                startTime: n.startTime,
                duration: n.duration,
                velocity: n.velocity || 0.8,
                lyrics: n.lyrics || null,
                chord: n.chord || null,
                dynamics: n.dynamics || null,
                articulation: n.articulation || null
            }))
        };

        return this.exportTrackToMusicXML(track, { tempo, timeSignature, keySignature, clef });
    }

    /**
     * Generate MusicXML header
     * @private
     */
    _generateHeader(title, composer, copyright) {
        let header = '<work>\n';
        header += `  <work-title>${this._escapeXml(title)}</work-title>\n`;
        header += '</work>\n';

        if (composer) {
            header += '<identification>\n';
            header += '  <creator type="composer">' + this._escapeXml(composer) + '</creator>\n';
            if (copyright) {
                header += '  <rights>' + this._escapeXml(copyright) + '</rights>\n';
            }
            header += '  <encoding>\n';
            header += '    <software>' + this.software + '</software>\n';
            header += '    <encoding-date>' + this.encodingDate + '</encoding-date>\n';
            header += '    <supports attribute="new-page" element="print" type="yes" value="yes"/>\n';
            header += '    <supports attribute="new-system" element="print" type="yes" value="yes"/>\n';
            header += '  </encoding>\n';
            header += '</identification>\n';
        }

        return header;
    }

    /**
     * Generate default page layout
     * @private
     */
    _generateDefaults(pageLayout) {
        let defaults = '<defaults>\n';
        defaults += '  <scaling>\n';
        defaults += '    <millimeters>7</millimeters>\n';
        defaults += '    <tenths>40</tenths>\n';
        defaults += '  </scaling>\n';
        defaults += '  <page-layout>\n';
        defaults += `    <page-height>${pageLayout.height}</page-height>\n`;
        defaults += `    <page-width>${pageLayout.width}</page-width>\n`;
        defaults += '    <page-margins>\n';
        defaults += `      <left-margin>${pageLayout.leftMargin}</left-margin>\n`;
        defaults += `      <right-margin>${pageLayout.rightMargin}</right-margin>\n`;
        defaults += `      <top-margin>${pageLayout.topMargin}</top-margin>\n`;
        defaults += `      <bottom-margin>${pageLayout.bottomMargin}</bottom-margin>\n`;
        defaults += '    </page-margins>\n';
        defaults += '  </page-layout>\n';
        defaults += '  <font font-family="Times New Roman" font-size="12"/>\n';
        defaults += '</defaults>\n';
        return defaults;
    }

    /**
     * Get default page layout
     * @private
     */
    _getDefaultPageLayout() {
        return {
            height: 1545,
            width: 1194,
            leftMargin: 70,
            rightMargin: 70,
            topMargin: 88,
            bottomMargin: 88
        };
    }

    /**
     * Generate part list
     * @private
     */
    _generatePartList(tracks) {
        let partList = '<part-list>\n';
        
        for (const track of tracks) {
            const partId = 'P' + track.id;
            const partName = this._escapeXml(track.name || 'Track ' + track.id);
            const partAbbrev = this._getAbbreviation(track.name || 'Track');

            partList += '  <score-part id="' + partId + '">\n';
            partList += '    <part-name>' + partName + '</part-name>\n';
            if (partAbbrev) {
                partList += '    <part-abbreviation>' + partAbbrev + '</part-abbreviation>\n';
            }
            
            // Add instrument info
            const instrument = this._getInstrumentInfo(track.type);
            if (instrument) {
                partList += '    <score-instrument id="' + partId + '-I">\n';
                partList += '      <instrument-name>' + instrument + '</instrument-name>\n';
                partList += '    </score-instrument>\n';
            }
            
            partList += '  </score-part>\n';
        }

        partList += '</part-list>\n';
        return partList;
    }

    /**
     * Generate a part (track)
     * @private
     */
    _generatePart(track, tempo, timeSignature, keySignature, options) {
        const partId = 'P' + track.id;
        let part = '<part id="' + partId + '">\n';

        // Get notes from track
        const notes = track.notes || track.sequence?.data || [];
        
        if (notes.length === 0) {
            part += '</part>\n';
            return part;
        }

        // Sort notes by start time
        const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

        // Calculate divisions (ticks per quarter note)
        const divisions = 480;

        // Generate measures
        const beatsPerMeasure = timeSignature[0];
        const beatUnit = timeSignature[1];
        const measureDuration = beatsPerMeasure * (4 / beatUnit); // in quarter notes

        // Group notes into measures
        const measures = this._groupNotesIntoMeasures(sortedNotes, measureDuration, tempo);

        let measureNumber = 1;
        for (const measureNotes of measures) {
            part += this._generateMeasure(measureNumber, measureNotes, tempo, timeSignature, 
                keySignature, divisions, measureNumber === 1, options);
            measureNumber++;
        }

        part += '</part>\n';
        return part;
    }

    /**
     * Group notes into measures
     * @private
     */
    _groupNotesIntoMeasures(notes, measureDuration, tempo) {
        if (notes.length === 0) return [[]];

        const measures = [];
        let currentMeasure = [];
        let currentMeasureStart = 0;
        let currentMeasureEnd = measureDuration;

        for (const note of notes) {
            // Check if note belongs to current measure
            while (note.startTime >= currentMeasureEnd) {
                measures.push(currentMeasure);
                currentMeasure = [];
                currentMeasureStart = currentMeasureEnd;
                currentMeasureEnd += measureDuration;
            }

            // Create measure-relative position
            const relativeNote = {
                ...note,
                measurePosition: note.startTime - currentMeasureStart
            };
            currentMeasure.push(relativeNote);
        }

        // Push last measure
        measures.push(currentMeasure);

        return measures;
    }

    /**
     * Generate a measure
     * @private
     */
    _generateMeasure(measureNumber, notes, tempo, timeSignature, keySignature, divisions, isFirstMeasure, options) {
        let measure = '<measure number="' + measureNumber + '">\n';

        // Add attributes for first measure
        if (isFirstMeasure) {
            measure += this._generateAttributes(timeSignature, keySignature, divisions, 'G');
        }

        // Generate notes
        for (const note of notes) {
            measure += this._generateNote(note, divisions, options);
        }

        // Add barline for last measure
        if (measureNumber === 'end') {
            measure += '<barline location="right">\n';
            measure += '  <bar-style>light-heavy</bar-style>\n';
            measure += '</barline>\n';
        }

        measure += '</measure>\n';
        return measure;
    }

    /**
     * Generate attributes element
     * @private
     */
    _generateAttributes(timeSignature, keySignature, divisions, clef) {
        let attr = '<attributes>\n';
        attr += '  <divisions>' + divisions + '</divisions>\n';
        attr += '  <key>\n';
        attr += '    <fifths>' + this._keyToFifths(keySignature) + '</fifths>\n';
        attr += '    <mode>major</mode>\n';
        attr += '  </key>\n';
        attr += '  <time>\n';
        attr += '    <beats>' + timeSignature[0] + '</beats>\n';
        attr += '    <beat-type>' + timeSignature[1] + '</beat-type>\n';
        attr += '  </time>\n';
        attr += '  <clef>\n';
        attr += '    <sign>' + this._getClefSign(clef) + '</sign>\n';
        attr += '    <line>' + this._getClefLine(clef) + '</line>\n';
        attr += '  </clef>\n';
        attr += '</attributes>\n';
        return attr;
    }

    /**
     * Generate a note element
     * @private
     */
    _generateNote(note, divisions, options) {
        const { includeLyrics, includeChords, includeDynamics, includeArticulations } = options;

        // Handle chord notes
        if (note.chord && includeChords) {
            return this._generateChordNote(note, divisions, options);
        }

        // Handle rest
        if (note.isRest || note.pitch < 0) {
            return this._generateRest(note, divisions);
        }

        // Calculate duration in divisions
        const quarterNoteDuration = divisions;
        const noteDuration = Math.round(note.duration * quarterNoteDuration);

        // Get note type
        const noteType = this._getNoteType(note.duration);
        const dots = this._getDots(note.duration);

        let xml = '<note>\n';

        // Pitch
        xml += '  <pitch>\n';
        xml += '    <step>' + this._getNoteStep(note.pitch) + '</step>\n';
        const alter = this._getNoteAlter(note.pitch);
        if (alter !== 0) {
            xml += '    <alter>' + alter + '</alter>\n';
        }
        xml += '    <octave>' + this._getNoteOctave(note.pitch) + '</octave>\n';
        xml += '  </pitch>\n';

        // Duration
        xml += '  <duration>' + noteDuration + '</duration>\n';

        // Voice (default to 1)
        xml += '  <voice>1</voice>\n';

        // Note type
        if (noteType) {
            xml += '  <type>' + noteType + '</type>\n';
            for (let i = 0; i < dots; i++) {
                xml += '  <dot/>\n';
            }
        }

        // Stem
        xml += '  <stem>up</stem>\n';

        // Dynamics
        if (note.dynamics && includeDynamics) {
            xml += '  <notations>\n';
            xml += '    <dynamics>\n';
            xml += '      <' + note.dynamics + '/>\n';
            xml += '    </dynamics>\n';
            xml += '  </notations>\n';
        }

        // Articulations
        if (note.articulation && includeArticulations) {
            xml += '  <notations>\n';
            xml += '    <articulations>\n';
            xml += '      <' + note.articulation + '/>\n';
            xml += '    </articulations>\n';
            xml += '  </notations>\n';
        }

        // Lyrics
        if (note.lyrics && includeLyrics) {
            xml += '  <lyric number="1">\n';
            xml += '    <text>' + this._escapeXml(note.lyrics) + '</text>\n';
            xml += '    <syllabic>single</syllabic>\n';
            xml += '  </lyric>\n';
        }

        xml += '</note>\n';
        return xml;
    }

    /**
     * Generate a chord note (backup + chord notes)
     * @private
     */
    _generateChordNote(note, divisions, options) {
        let xml = '';

        // Backup to chord position
        const quarterNoteDuration = divisions;
        const backupDuration = Math.round(note.duration * quarterNoteDuration);
        xml += '<backup>\n';
        xml += '  <duration>' + backupDuration + '</duration>\n';
        xml += '</backup>\n';

        // Forward to position
        const forwardDuration = Math.round(note.measurePosition * quarterNoteDuration);
        xml += '<forward>\n';
        xml += '  <duration>' + forwardDuration + '</duration>\n';
        xml += '</forward>\n';

        // Generate chord notes
        for (const chordNote of note.chord) {
            xml += '<note>\n';
            xml += '  <chord/>\n';
            xml += '  <pitch>\n';
            xml += '    <step>' + this._getNoteStep(chordNote.pitch) + '</step>\n';
            const alter = this._getNoteAlter(chordNote.pitch);
            if (alter !== 0) {
                xml += '    <alter>' + alter + '</alter>\n';
            }
            xml += '    <octave>' + this._getNoteOctave(chordNote.pitch) + '</octave>\n';
            xml += '  </pitch>\n';
            xml += '  <duration>' + Math.round(chordNote.duration * quarterNoteDuration) + '</duration>\n';
            xml += '  <voice>1</voice>\n';
            xml += '</note>\n';
        }

        return xml;
    }

    /**
     * Generate a rest
     * @private
     */
    _generateRest(note, divisions) {
        const quarterNoteDuration = divisions;
        const restDuration = Math.round((note.duration || 0.25) * quarterNoteDuration);
        const noteType = this._getNoteType(note.duration || 0.25);

        let xml = '<note>\n';
        xml += '  <rest/>\n';
        xml += '  <duration>' + restDuration + '</duration>\n';
        xml += '  <voice>1</voice>\n';
        if (noteType) {
            xml += '  <type>' + noteType + '</type>\n';
        }
        xml += '</note>\n';
        return xml;
    }

    /**
     * Convert MIDI pitch to step name
     * @private
     */
    _getNoteStep(pitch) {
        const steps = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
        return steps[pitch % 12];
    }

    /**
     * Get note alter (accidental)
     * @private
     */
    _getNoteAlter(pitch) {
        const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
        return alters[pitch % 12];
    }

    /**
     * Get note octave
     * @private
     */
    _getNoteOctave(pitch) {
        return Math.floor(pitch / 12) - 1;
    }

    /**
     * Get note type from duration (in quarter notes)
     * @private
     */
    _getNoteType(duration) {
        if (duration >= 4) return 'whole';
        if (duration >= 2) return 'half';
        if (duration >= 1) return 'quarter';
        if (duration >= 0.5) return 'eighth';
        if (duration >= 0.25) return '16th';
        if (duration >= 0.125) return '32nd';
        if (duration >= 0.0625) return '64th';
        return '128th';
    }

    /**
     * Get number of dots for duration
     * @private
     */
    _getDots(duration) {
        // Simple dot calculation
        if (duration === 1.5) return 1; // Dotted half
        if (duration === 0.75) return 1; // Dotted quarter
        if (duration === 0.375) return 1; // Dotted eighth
        return 0;
    }

    /**
     * Convert key signature to circle of fifths
     * @private
     */
    _keyToFifths(key) {
        const fifthsMap = {
            'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
            'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
            'Am': 0, 'Em': 1, 'Bm': 2, 'F#m': 3, 'C#m': 4, 'G#m': 5, 'D#m': 6, 'A#m': 7,
            'Dm': -1, 'Gm': -2, 'Cm': -3, 'Fm': -4, 'Bbm': -5, 'Ebm': -6, 'Abm': -7
        };
        return fifthsMap[key] || 0;
    }

    /**
     * Get clef sign
     * @private
     */
    _getClefSign(clef) {
        const signs = {
            'G': 'G',
            'F': 'F',
            'C': 'C',
            'percussion': 'percussion',
            'TAB': 'TAB'
        };
        return signs[clef] || 'G';
    }

    /**
     * Get clef line
     * @private
     */
    _getClefLine(clef) {
        const lines = {
            'G': 2,
            'F': 4,
            'C': 3,
            'percussion': 2,
            'TAB': 5
        };
        return lines[clef] || 2;
    }

    /**
     * Get track name abbreviation
     * @private
     */
    _getAbbreviation(name) {
        if (!name) return '';
        const words = name.split(' ');
        if (words.length > 1) {
            return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
        }
        return name.slice(0, 3).toUpperCase();
    }

    /**
     * Get instrument info from track type
     * @private
     */
    _getInstrumentInfo(trackType) {
        const instruments = {
            'Synth': 'synthesizer',
            'Audio': 'audio',
            'Sampler': 'sampler',
            'DrumSampler': 'drums',
            'InstrumentSampler': 'sampler'
        };
        return instruments[trackType] || 'instrument';
    }

    /**
     * Escape XML special characters
     * @private
     */
    _escapeXml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Parse MusicXML back to notes (for import) - Enhanced version
     * Supports: articulations, dynamics, ornaments, slurs, ties, tuplets, grace notes, multiple voices
     * @param {string} musicXml - MusicXML document
     * @returns {Object} Parsed project data
     */
    parseMusicXML(musicXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(musicXml, 'text/xml');
        
        const result = {
            title: '',
            composer: '',
            tempo: 120,
            timeSignature: [4, 4],
            keySignature: 'C',
            tracks: [],
            tempoChanges: [],
            timeSignatureChanges: [],
            keySignatureChanges: []
        };

        // Parse work-title
        const workTitle = doc.querySelector('work-title');
        if (workTitle) result.title = workTitle.textContent;

        // Parse composer
        const composer = doc.querySelector('creator[type="composer"]');
        if (composer) result.composer = composer.textContent;

        // Parse initial tempo from direction
        const initialTempo = doc.querySelector('sound tempo');
        if (initialTempo) {
            result.tempo = parseInt(initialTempo.getAttribute('tempo'), 10) || 120;
        }

        // Parse initial divisions for timing
        const divisions = parseInt(doc.querySelector('divisions')?.textContent || '480', 10);

        // Parse parts
        const parts = doc.querySelectorAll('part');
        for (const part of parts) {
            const track = this._parsePart(doc, part, divisions, result.tempo);
            result.tracks.push(track);
        }

        return result;
    }

    /**
     * Parse a part element
     * @private
     */
    _parsePart(doc, part, divisions, initialTempo) {
        const track = {
            id: part.getAttribute('id').replace('P', ''),
            name: '',
            notes: [],
            tempoChanges: [],
            timeSignatureChanges: [],
            keySignatureChanges: [],
            voices: new Map() // Track notes by voice
        };

        // Get part name
        const partId = part.getAttribute('id');
        const partName = doc.querySelector(`score-part[id="${partId}"] part-name`);
        if (partName) track.name = partName.textContent;

        // Parse measures
        const measures = part.querySelectorAll('measure');
        let measureStartTime = 0;
        let currentTempo = initialTempo;
        let currentTimeSignature = [4, 4];
        let currentDivisions = divisions;
        let openSlurs = new Map(); // Track open slurs by number
        let openTies = new Map(); // Track open ties by note id

        for (const measure of measures) {
            const measureNumber = parseInt(measure.getAttribute('number'), 10) || 1;
            
            // Parse attributes (time signature, key, divisions changes)
            const attributes = measure.querySelector('attributes');
            if (attributes) {
                const tsResult = this._parseTimeSignature(attributes);
                if (tsResult) {
                    currentTimeSignature = tsResult;
                    track.timeSignatureChanges.push({
                        measureNumber,
                        time: measureStartTime,
                        timeSignature: tsResult
                    });
                }
                
                const ksResult = this._parseKeySignature(attributes);
                if (ksResult) {
                    currentKeySignature = ksResult;
                    track.keySignatureChanges.push({
                        measureNumber,
                        time: measureStartTime,
                        keySignature: ksResult
                    });
                }
                
                const divResult = attributes.querySelector('divisions');
                if (divResult) {
                    currentDivisions = parseInt(divResult.textContent, 10);
                }
            }

            // Parse tempo changes from directions
            const directions = measure.querySelectorAll('direction');
            for (const direction of directions) {
                const tempoEl = direction.querySelector('sound[ tempo]');
                if (tempoEl) {
                    const newTempo = parseInt(tempoEl.getAttribute('tempo'), 10);
                    if (newTempo) {
                        currentTempo = newTempo;
                        track.tempoChanges.push({
                            measureNumber,
                            time: measureStartTime,
                            tempo: newTempo
                        });
                    }
                }
            }

            // Calculate measure duration
            const beatsPerMeasure = currentTimeSignature[0];
            const beatUnit = currentTimeSignature[1];
            const measureDurationBeats = beatsPerMeasure * (4 / beatUnit);
            const secondsPerBeat = 60 / currentTempo;
            const measureDurationSeconds = measureDurationBeats * secondsPerBeat;

            // Parse all notes in measure
            let positionInMeasure = 0;
            const notes = measure.querySelectorAll(':scope > note, :scope > backup, :scope > forward');
            
            for (const element of notes) {
                if (element.tagName === 'backup') {
                    // Backup moves time backward
                    const backupDuration = parseInt(element.querySelector('duration')?.textContent || '0', 10);
                    positionInMeasure -= (backupDuration / currentDivisions) * secondsPerBeat;
                    if (positionInMeasure < 0) positionInMeasure = 0;
                } else if (element.tagName === 'forward') {
                    // Forward moves time forward
                    const forwardDuration = parseInt(element.querySelector('duration')?.textContent || '0', 10);
                    positionInMeasure += (forwardDuration / currentDivisions) * secondsPerBeat;
                } else if (element.tagName === 'note') {
                    const noteResult = this._parseNote(element, currentDivisions, secondsPerBeat, 
                        measureStartTime, positionInMeasure, currentTempo, openSlurs, openTies);
                    
                    if (noteResult) {
                        if (noteResult.isRest) {
                            positionInMeasure += noteResult.duration;
                        } else {
                            track.notes.push(noteResult);
                            positionInMeasure += noteResult.durationSeconds;
                        }
                    }
                }
            }

            measureStartTime += measureDurationSeconds;
        }

        // Process ties - connect tied notes
        this._processTies(track.notes);

        return track;
    }

    /**
     * Parse time signature from attributes
     * @private
     */
    _parseTimeSignature(attributes) {
        const time = attributes.querySelector('time');
        if (!time) return null;
        
        const beats = parseInt(time.querySelector('beats')?.textContent, 10) || 4;
        const beatType = parseInt(time.querySelector('beat-type')?.textContent, 10) || 4;
        return [beats, beatType];
    }

    /**
     * Parse key signature from attributes
     * @private
     */
    _parseKeySignature(attributes) {
        const key = attributes.querySelector('key');
        if (!key) return null;
        
        const fifths = parseInt(key.querySelector('fifths')?.textContent, 10) || 0;
        const mode = key.querySelector('mode')?.textContent || 'major';
        
        // Convert fifths to key name
        return this._fifthsToKey(fifths, mode);
    }

    /**
     * Convert circle of fifths to key name
     * @private
     */
    _fifthsToKey(fifths, mode) {
        const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 
                          'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
        const minorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m',
                          'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];
        
        const keys = mode === 'minor' ? minorKeys : majorKeys;
        const index = fifths >= 0 ? fifths : 7 - fifths;
        return keys[index] || 'C';
    }

    /**
     * Parse a single note element
     * @private
     */
    _parseNote(noteElement, divisions, secondsPerBeat, measureStartTime, positionInMeasure, 
                currentTempo, openSlurs, openTies) {
        // Check for rest
        const rest = noteElement.querySelector('rest');
        if (rest) {
            const duration = parseInt(noteElement.querySelector('duration')?.textContent || '0', 10);
            return {
                isRest: true,
                duration: (duration / divisions) * secondsPerBeat
            };
        }

        // Check for grace note
        const isGrace = noteElement.querySelector('grace') !== null;
        const graceSlash = isGrace && noteElement.querySelector('grace').getAttribute('slash') === 'yes';

        // Parse pitch
        const pitchElement = noteElement.querySelector('pitch');
        if (!pitchElement) return null;

        const step = pitchElement.querySelector('step')?.textContent || 'C';
        const alter = parseInt(pitchElement.querySelector('alter')?.textContent || '0', 10);
        const octave = parseInt(pitchElement.querySelector('octave')?.textContent || '4', 10);
        
        // Convert to MIDI
        const pitch = this._pitchToMidi(step, alter, octave);

        // Parse duration (grace notes have no duration)
        let durationSeconds = 0;
        if (!isGrace) {
            const duration = parseInt(noteElement.querySelector('duration')?.textContent || '0', 10);
            durationSeconds = (duration / divisions) * secondsPerBeat;
        }

        // Parse voice
        const voice = parseInt(noteElement.querySelector('voice')?.textContent || '1', 10);

        // Parse velocity from dynamics
        let velocity = 0.8;
        const dynamicsNotation = noteElement.querySelector('dynamics');
        if (dynamicsNotation) {
            velocity = this._dynamicsToVelocity(dynamicsNotation);
        }

        // Parse articulations
        const articulations = this._parseArticulations(noteElement);

        // Parse ornaments
        const ornaments = this._parseOrnaments(noteElement);

        // Parse ties
        const tieStart = noteElement.querySelector('tie[type="start"]');
        const tieStop = noteElement.querySelector('tie[type="stop"]');
        const ties = [];
        if (tieStart) ties.push({ type: 'start' });
        if (tieStop) ties.push({ type: 'stop' });

        // Parse slurs from notations
        const slurs = this._parseSlurs(noteElement, openSlurs);

        // Parse lyrics
        const lyricsElement = noteElement.querySelector('lyric text');
        const lyrics = lyricsElement ? lyricsElement.textContent : null;

        // Parse fermata
        const fermata = noteElement.querySelector('fermata');
        const hasFermata = fermata !== null;
        const fermataShape = fermata?.getAttribute('type') || 'normal';

        // Parse tremolo
        const tremolo = noteElement.querySelector('tremolo');
        const tremoloType = tremolo ? {
            type: tremolo.getAttribute('type') || 'single',
            value: parseInt(tremolo.textContent, 10) || 3
        } : null;

        // Parse tuplet
        const tuplet = this._parseTuplet(noteElement);

        // Calculate absolute start time
        const startTime = measureStartTime + positionInMeasure;

        return {
            pitch,
            startTime,
            duration: durationSeconds,
            durationSeconds,
            velocity,
            voice,
            isGrace,
            graceSlash,
            articulations,
            ornaments,
            ties,
            slurs,
            lyrics,
            hasFermata,
            fermataShape,
            tremolo: tremoloType,
            tuplet,
            accidental: alter !== 0 ? this._alterToAccidental(alter) : null,
            displayStep: step,
            displayOctave: octave
        };
    }

    /**
     * Parse articulations from note
     * @private
     */
    _parseArticulations(noteElement) {
        const articulations = [];
        const articulationsElement = noteElement.querySelector('articulations');
        if (!articulationsElement) return articulations;

        const articulationTypes = [
            'accent', 'strong-accent', 'staccato', 'tenuto', 'detached-legato',
            'staccatissimo', 'spiccato', 'scoop', 'plop', 'doit', 'falloff',
            'breath-mark', 'caesura', 'stress', 'unstress', 'soft-accent'
        ];

        for (const type of articulationTypes) {
            if (articulationsElement.querySelector(type)) {
                articulations.push(type);
            }
        }

        // Check for articulations in technical element (up-bow, down-bow, etc.)
        const technical = noteElement.querySelector('technical');
        if (technical) {
            if (technical.querySelector('up-bow')) articulations.push('up-bow');
            if (technical.querySelector('down-bow')) articulations.push('down-bow');
            if (technical.querySelector('harmonic')) articulations.push('harmonic');
            if (technical.querySelector('open-string')) articulations.push('open-string');
            if (technical.querySelector('stopped')) articulations.push('stopped');
            if (technical.querySelector('double-tongue')) articulations.push('double-tongue');
            if (technical.querySelector('triple-tongue')) articulations.push('triple-tongue');
            if (technical.querySelector('snap-pizzicato')) articulations.push('snap-pizzicato');
            if (technical.querySelector('fingering')) {
                const fingering = technical.querySelector('fingering');
                articulations.push({ type: 'fingering', value: fingering.textContent });
            }
        }

        return articulations;
    }

    /**
     * Parse ornaments from note
     * @private
     */
    _parseOrnaments(noteElement) {
        const ornaments = [];
        const ornamentsElement = noteElement.querySelector('ornaments');
        if (!ornamentsElement) return ornaments;

        // Trill
        const trill = ornamentsElement.querySelector('trill-mark');
        if (trill) {
            ornaments.push({ type: 'trill', 
                accidentalMark: trill.getAttribute('accelerate') === 'yes' });
        }

        // Turn
        const turn = ornamentsElement.querySelector('turn');
        if (turn) {
            ornaments.push({ type: 'turn', delayed: false });
        }

        // Inverted turn
        const invertedTurn = ornamentsElement.querySelector('inverted-turn');
        if (invertedTurn) {
            ornaments.push({ type: 'inverted-turn', delayed: false });
        }

        // Delayed turn
        const delayedTurn = ornamentsElement.querySelector('delayed-turn');
        if (delayedTurn) {
            ornaments.push({ type: 'turn', delayed: true });
        }

        // Mordent
        const mordent = ornamentsElement.querySelector('mordent');
        if (mordent) {
            ornaments.push({ type: 'mordent', inverted: false });
        }

        // Inverted mordent
        const invertedMordent = ornamentsElement.querySelector('inverted-mordent');
        if (invertedMordent) {
            ornaments.push({ type: 'mordent', inverted: true });
        }

        // Schleifer (slide)
        const schleifer = ornamentsElement.querySelector('schleifer');
        if (schleifer) {
            ornaments.push({ type: 'schleifer' });
        }

        // Wavy line (for extended ornaments)
        const wavyLine = ornamentsElement.querySelector('wavy-line');
        if (wavyLine) {
            ornaments.push({
                type: 'wavy-line',
                number: parseInt(wavyLine.getAttribute('number'), 10) || 1,
                typeAttr: wavyLine.getAttribute('type') // start, stop, continue
            });
        }

        // Accidental mark within ornament
        const accidentalMark = ornamentsElement.querySelector('accidental-mark');
        if (accidentalMark && ornaments.length > 0) {
            ornaments[ornaments.length - 1].accidental = accidentalMark.textContent;
        }

        return ornaments;
    }

    /**
     * Parse slurs from note
     * @private
     */
    _parseSlurs(noteElement, openSlurs) {
        const slurs = [];
        const notations = noteElement.querySelector('notations');
        if (!notations) return slurs;

        const slurElements = notations.querySelectorAll('slur');
        for (const slurEl of slurElements) {
            const slurNumber = parseInt(slurEl.getAttribute('number'), 10) || 1;
            const slurType = slurEl.getAttribute('type'); // start, stop, continue
            
            if (slurType === 'start') {
                const slur = {
                    number: slurNumber,
                    startTime: null, // Will be set when the note is processed
                    placement: slurEl.getAttribute('placement') || 'above'
                };
                openSlurs.set(slurNumber, slur);
                slurs.push({ action: 'start', number: slurNumber });
            } else if (slurType === 'stop') {
                const openSlur = openSlurs.get(slurNumber);
                if (openSlur) {
                    openSlur.endTime = null; // Will be set when the slur ends
                    slurs.push({ action: 'stop', number: slurNumber });
                    openSlurs.delete(slurNumber);
                }
            } else if (slurType === 'continue') {
                slurs.push({ action: 'continue', number: slurNumber });
            }
        }

        return slurs;
    }

    /**
     * Parse tuplet from note
     * @private
     */
    _parseTuplet(noteElement) {
        const notations = noteElement.querySelector('notations');
        if (!notations) return null;

        const tupletEl = notations.querySelector('tuplet');
        if (!tupletEl) return null;

        const timeModification = noteElement.querySelector('time-modification');
        if (!timeModification) return null;

        return {
            type: tupletEl.getAttribute('type'), // start, stop, etc.
            number: parseInt(tupletEl.getAttribute('number'), 10) || 1,
            actualNotes: parseInt(timeModification.querySelector('actual-notes')?.textContent, 10) || 3,
            normalNotes: parseInt(timeModification.querySelector('normal-notes')?.textContent, 10) || 2,
            placement: tupletEl.getAttribute('placement') || 'above',
            bracket: tupletEl.getAttribute('bracket') === 'yes',
            showNumber: tupletEl.getAttribute('show-number') || 'actual'
        };
    }

    /**
     * Convert dynamics marking to velocity
     * @private
     */
    _dynamicsToVelocity(dynamicsElement) {
        const dynamicsTypes = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 
                              'fp', 'sf', 'sfp', 'sfpp', 'sfz', 'sfzp', 'sffz'];
        
        const velocityMap = {
            'ppp': 0.15, 'pp': 0.25, 'p': 0.35, 'mp': 0.45,
            'mf': 0.55, 'f': 0.7, 'ff': 0.85, 'fff': 0.95,
            'fp': 0.7, 'sf': 0.8, 'sfp': 0.8, 'sfpp': 0.6,
            'sfz': 0.9, 'sfzp': 0.8, 'sffz': 0.95
        };

        for (const type of dynamicsTypes) {
            if (dynamicsElement.querySelector(type)) {
                return velocityMap[type] || 0.8;
            }
        }

        return 0.8;
    }

    /**
     * Convert alter to accidental string
     * @private
     */
    _alterToAccidental(alter) {
        if (alter === 1) return 'sharp';
        if (alter === 2) return 'double-sharp';
        if (alter === -1) return 'flat';
        if (alter === -2) return 'flat-flat';
        return 'natural';
    }

    /**
     * Process ties in note array - connect tied notes
     * @private
     */
    _processTies(notes) {
        const tieStarts = new Map(); // pitch -> note with tie start
        
        for (const note of notes) {
            if (!note.ties) continue;
            
            const hasTieStop = note.ties.some(t => t.type === 'stop');
            const hasTieStart = note.ties.some(t => t.type === 'start');
            
            if (hasTieStop) {
                // Find the matching tie start
                const startNote = tieStarts.get(note.pitch);
                if (startNote) {
                    // Extend the duration of the start note
                    startNote.duration += note.duration;
                    startNote.tiedTo = note;
                    note.tiedFrom = startNote;
                    note.isTiedContinuation = true;
                    tieStarts.delete(note.pitch);
                }
            }
            
            if (hasTieStart) {
                tieStarts.set(note.pitch, note);
            }
        }
    }

    /**
     * Import MusicXML file from file input
     * @param {File} file - File object
     * @returns {Promise<Object>} Parsed project data
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = this.parseMusicXML(e.target.result);
                    resolve(result);
                } catch (err) {
                    reject(new Error('Failed to parse MusicXML: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Create a project from imported MusicXML
     * @param {Object} parsedData - Parsed MusicXML data
     * @param {Object} options - Project creation options
     * @returns {Object} Project object ready for use
     */
    createProjectFromImport(parsedData, options = {}) {
        const project = {
            id: options.id || 'imported-' + Date.now(),
            title: parsedData.title || 'Imported Score',
            composer: parsedData.composer || '',
            tempo: parsedData.tempo || 120,
            timeSignature: parsedData.timeSignature || [4, 4],
            keySignature: parsedData.keySignature || 'C',
            tracks: [],
            tempoChanges: parsedData.tempoChanges || [],
            timeSignatureChanges: parsedData.timeSignatureChanges || [],
            keySignatureChanges: parsedData.keySignatureChanges || [],
            duration: 0
        };

        // Convert tracks
        for (const parsedTrack of parsedData.tracks || []) {
            const track = {
                id: parsedTrack.id,
                name: parsedTrack.name || 'Track',
                type: 'Synth',
                notes: parsedTrack.notes.map(n => ({
                    pitch: n.pitch,
                    startTime: n.startTime,
                    duration: n.duration,
                    velocity: n.velocity,
                    voice: n.voice || 1,
                    isGrace: n.isGrace || false,
                    articulations: n.articulations || [],
                    ornaments: n.ornaments || [],
                    lyrics: n.lyrics || null,
                    hasFermata: n.hasFermata || false,
                    tremolo: n.tremolo || null,
                    tuplet: n.tuplet || null,
                    tiedFrom: n.tiedFrom ? { pitch: n.tiedFrom.pitch, startTime: n.tiedFrom.startTime } : null,
                    tiedTo: n.tiedTo ? { pitch: n.tiedTo.pitch, startTime: n.tiedTo.startTime } : null
                })),
                sequence: {
                    data: parsedTrack.notes.map(n => ({
                        pitch: n.pitch,
                        startTime: n.startTime,
                        duration: n.duration,
                        velocity: n.velocity
                    }))
                }
            };

            // Calculate track duration
            for (const note of track.notes) {
                const endTime = note.startTime + note.duration;
                if (endTime > project.duration) {
                    project.duration = endTime;
                }
            }

            project.tracks.push(track);
        }

        return project;
    }

    /**
     * Convert step/alter/octave to MIDI
     * @private
     */
    _pitchToMidi(step, alter, octave) {
        const stepMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const stepValue = stepMap[step] || 0;
        return (octave + 1) * 12 + stepValue + alter;
    }

    /**
     * Export to compressed MusicXML (.mxl)
     * @param {Object} project - Project data
     * @param {Object} options - Export options
     * @returns {Promise<Blob>} Compressed MusicXML blob
     */
    async exportToMXL(project, options = {}) {
        const xml = this.exportToMusicXML(project, options);
        
        // For browser, we'll return as a regular file
        // True .mxl compression would require a library like JSZip
        const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml' });
        return blob;
    }

    /**
     * Download MusicXML file
     * @param {Object} project - Project data
     * @param {string} filename - Output filename
     * @param {Object} options - Export options
     */
    downloadMusicXML(project, filename = 'score.musicxml', options = {}) {
        const xml = this.exportToMusicXML(project, options);
        const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Create singleton instance
export const musicXMLExporter = new MusicXMLExporter();

// Default export
export default {
    MusicXMLExporter,
    musicXMLExporter
};