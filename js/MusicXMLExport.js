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
     * Parse MusicXML back to notes (for import)
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
            tracks: []
        };

        // Parse work-title
        const workTitle = doc.querySelector('work-title');
        if (workTitle) result.title = workTitle.textContent;

        // Parse composer
        const composer = doc.querySelector('creator[type="composer"]');
        if (composer) result.composer = composer.textContent;

        // Parse divisions for timing
        const divisions = parseInt(doc.querySelector('divisions')?.textContent || '480', 10);

        // Parse parts
        const parts = doc.querySelectorAll('part');
        for (const part of parts) {
            const track = {
                id: part.getAttribute('id').replace('P', ''),
                name: '',
                notes: []
            };

            // Get part name
            const partId = part.getAttribute('id');
            const partName = doc.querySelector(`score-part[id="${partId}"] part-name`);
            if (partName) track.name = partName.textContent;

            // Parse measures
            const measures = part.querySelectorAll('measure');
            let currentTime = 0;
            const divisionsPerBeat = divisions;
            const secondsPerBeat = 60 / result.tempo;

            for (const measure of measures) {
                const notes = measure.querySelectorAll('note');
                for (const note of notes) {
                    // Skip rests
                    const rest = note.querySelector('rest');
                    if (rest) {
                        const duration = parseInt(note.querySelector('duration')?.textContent || '0', 10);
                        currentTime += (duration / divisionsPerBeat) * secondsPerBeat;
                        continue;
                    }

                    // Parse pitch
                    const pitchElement = note.querySelector('pitch');
                    if (pitchElement) {
                        const step = pitchElement.querySelector('step')?.textContent || 'C';
                        const alter = parseInt(pitchElement.querySelector('alter')?.textContent || '0', 10);
                        const octave = parseInt(pitchElement.querySelector('octave')?.textContent || '4', 10);
                        
                        // Convert to MIDI
                        const pitch = this._pitchToMidi(step, alter, octave);
                        
                        // Parse duration
                        const duration = parseInt(note.querySelector('duration')?.textContent || '0', 10);
                        const durationSeconds = (duration / divisionsPerBeat) * secondsPerBeat;

                        // Parse lyrics
                        const lyricsElement = note.querySelector('lyric text');
                        const lyrics = lyricsElement ? lyricsElement.textContent : null;

                        track.notes.push({
                            pitch,
                            startTime: currentTime,
                            duration: durationSeconds,
                            velocity: 0.8,
                            lyrics
                        });

                        currentTime += durationSeconds;
                    }
                }
            }

            result.tracks.push(track);
        }

        return result;
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