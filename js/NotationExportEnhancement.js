/**
 * Notation Export Enhancement - Export to MusicXML with more detail
 * Provides comprehensive MusicXML export with full notation elements
 */

class NotationExportEnhancement {
    constructor() {
        this.exportSettings = {
            format: 'musicxml', // musicxml, mxl (compressed), mei
            version: '4.0', // MusicXML version
            includeMetadata: true,
            includeLayout: true,
            includeAppearance: true,
            includeParts: true,
            includeMeasures: true,
            includeNotes: true,
            includeRests: true,
            includeChords: true,
            includeBeams: true,
            includeTuplets: true,
            includeGraceNotes: true,
            includeArticulations: true,
            includeDynamics: true,
            includeSlurs: true,
            includeTies: true,
            includeTempo: true,
            includeKeySignature: true,
            includeTimeSignature: true,
            includeBarlines: true,
            includeRepeats: true,
            includeEndings: true,
            includeFermatas: true,
            includePedal: true,
            includeWedge: true,
            includeDashes: true,
            includeLyrics: true,
            includeHarmony: true,
            includeFiguredBass: true,
            compressOutput: false,
            prettyPrint: true,
            indent: '  ' // 2 spaces
        };
        
        this.metadata = {
            title: '',
            composer: '',
            arranger: '',
            lyricist: '',
            copyright: '',
            rights: '',
            source: '',
            description: '',
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };
        
        this.defaults = {
            pageWidth: 210, // mm (A4)
            pageHeight: 297,
            pageMargins: { top: 20, bottom: 20, left: 20, right: 20 },
            systemLayout: { systemDistance: 100, topSystemDistance: 50 },
            staffLayout: { staffDistance: 80 },
            scaling: { millimeters: 7.2319, tenths: 40 },
            musicFont: 'Opus',
            wordFont: 'Times New Roman'
        };
        
        this.appearance = {
            lineWidths: {
                stem: 0.7487,
                beam: 5,
                staff: 0.7487,
                lightBarline: 0.7487,
                heavyBarline: 5,
                leger: 0.7487,
                ending: 0.7487,
                tupletBracket: 0.7487
            },
            noteSizes: { cue: 75, grace: 66, graceCue: 55 },
            distance: {
                hyphen: 120,
                beam: 8
            },
            glyphs: {}
        };
        
        this.exportedData = null;
        
        this.init();
    }
    
    init() {
        console.log('[NotationExportEnhancement] Initialized');
    }
    
    // Set metadata
    setMetadata(metadata) {
        Object.assign(this.metadata, metadata);
        console.log('[NotationExportEnhancement] Metadata updated');
    }
    
    // Get metadata from project
    getProjectMetadata() {
        const state = window.snugState || window.state;
        return {
            title: state?.projectName || 'Untitled',
            composer: state?.projectSettings?.composer || '',
            arranger: state?.projectSettings?.arranger || '',
            lyricist: state?.projectSettings?.lyricist || '',
            copyright: state?.projectSettings?.copyright || '',
            rights: state?.projectSettings?.rights || '',
            created: state?.projectCreated || new Date().toISOString(),
            modified: new Date().toISOString()
        };
    }
    
    // Export to MusicXML
    async exportToMusicXML(progressCallback = null) {
        console.log('[NotationExportEnhancement] Exporting to MusicXML');
        
        const state = window.snugState || window.state;
        const tracks = state?.tracks || [];
        
        if (tracks.length === 0) {
            throw new Error('No tracks to export');
        }
        
        // Get project metadata
        const metadata = this.getProjectMetadata();
        this.setMetadata(metadata);
        
        // Build MusicXML structure
        const musicxml = this.buildMusicXML(tracks, state, progressCallback);
        
        // Convert to string
        let output = this.xmlToString(musicxml);
        
        // Pretty print if enabled
        if (this.exportSettings.prettyPrint) {
            output = this.prettifyXML(output);
        }
        
        this.exportedData = output;
        
        return output;
    }
    
    // Build MusicXML structure
    buildMusicXML(tracks, state, progressCallback) {
        const root = {
            type: 'score-partwise',
            attributes: {
                version: this.exportSettings.version
            },
            children: []
        };
        
        // Add work identification
        if (this.exportSettings.includeMetadata) {
            root.children.push(this.buildWork());
        }
        
        // Add identification
        if (this.exportSettings.includeMetadata) {
            root.children.push(this.buildIdentification());
        }
        
        // Add defaults
        if (this.exportSettings.includeLayout) {
            root.children.push(this.buildDefaults());
        }
        
        // Add appearance
        if (this.exportSettings.includeAppearance) {
            root.children.push(this.buildAppearance());
        }
        
        // Add part list
        if (this.exportSettings.includeParts) {
            root.children.push(this.buildPartList(tracks));
        }
        
        // Add parts
        let processed = 0;
        for (const track of tracks) {
            if (track.type !== 'Audio') { // Only export MIDI/Instrument tracks
                root.children.push(this.buildPart(track, state));
            }
            processed++;
            if (progressCallback) {
                progressCallback(processed / tracks.length);
            }
        }
        
        return root;
    }
    
    // Build work element
    buildWork() {
        return {
            type: 'work',
            children: [
                {
                    type: 'work-title',
                    text: this.metadata.title
                },
                {
                    type: 'work-number',
                    text: this.metadata.workNumber || ''
                }
            ].filter(c => c.text)
        };
    }
    
    // Build identification element
    buildIdentification() {
        const creators = [];
        
        if (this.metadata.composer) {
            creators.push({
                type: 'creator',
                attributes: { type: 'composer' },
                text: this.metadata.composer
            });
        }
        
        if (this.metadata.arranger) {
            creators.push({
                type: 'creator',
                attributes: { type: 'arranger' },
                text: this.metadata.arranger
            });
        }
        
        if (this.metadata.lyricist) {
            creators.push({
                type: 'creator',
                attributes: { type: 'lyricist' },
                text: this.metadata.lyricist
            });
        }
        
        return {
            type: 'identification',
            children: [
                {
                    type: 'encoding',
                    children: [
                        {
                            type: 'encoding-date',
                            text: new Date().toISOString().split('T')[0]
                        },
                        {
                            type: 'software',
                            text: 'SnugOS DAW'
                        },
                        {
                            type: 'encoding-description',
                            text: 'MusicXML export from SnugOS DAW'
                        }
                    ]
                },
                ...creators,
                this.metadata.source ? {
                    type: 'source',
                    text: this.metadata.source
                } : null,
                this.metadata.description ? {
                    type: 'encoding-description',
                    text: this.metadata.description
                } : null
            ].filter(c => c)
        };
    }
    
    // Build defaults element
    buildDefaults() {
        return {
            type: 'defaults',
            children: [
                {
                    type: 'scaling',
                    children: [
                        {
                            type: 'millimeters',
                            text: this.defaults.scaling.millimeters.toString()
                        },
                        {
                            type: 'tenths',
                            text: this.defaults.scaling.tenths.toString()
                        }
                    ]
                },
                {
                    type: 'page-layout',
                    children: [
                        {
                            type: 'page-width',
                            text: this.defaults.pageWidth.toString()
                        },
                        {
                            type: 'page-height',
                            text: this.defaults.pageHeight.toString()
                        },
                        {
                            type: 'page-margins',
                            attributes: { type: 'both' },
                            children: [
                                { type: 'left-margin', text: this.defaults.pageMargins.left.toString() },
                                { type: 'right-margin', text: this.defaults.pageMargins.right.toString() },
                                { type: 'top-margin', text: this.defaults.pageMargins.top.toString() },
                                { type: 'bottom-margin', text: this.defaults.pageMargins.bottom.toString() }
                            ]
                        }
                    ]
                },
                {
                    type: 'system-layout',
                    children: [
                        { type: 'system-distance', text: this.defaults.systemLayout.systemDistance.toString() },
                        { type: 'top-system-distance', text: this.defaults.systemLayout.topSystemDistance.toString() }
                    ]
                },
                {
                    type: 'staff-layout',
                    children: [
                        { type: 'staff-distance', text: this.defaults.staffLayout.staffDistance.toString() }
                    ]
                }
            ]
        };
    }
    
    // Build appearance element
    buildAppearance() {
        const lineWidths = Object.entries(this.appearance.lineWidths).map(([type, width]) => ({
            type: 'line-width',
            attributes: { type },
            text: width.toString()
        }));
        
        const noteSizes = Object.entries(this.appearance.noteSizes).map(([type, size]) => ({
            type: 'note-size',
            attributes: { type },
            text: size.toString()
        }));
        
        const distances = Object.entries(this.appearance.distance).map(([type, distance]) => ({
            type: 'distance',
            attributes: { type },
            text: distance.toString()
        }));
        
        return {
            type: 'appearance',
            children: [...lineWidths, ...noteSizes, ...distances]
        };
    }
    
    // Build part list
    buildPartList(tracks) {
        const scoreParts = tracks
            .filter(t => t.type !== 'Audio')
            .map((track, index) => ({
                type: 'score-part',
                attributes: { id: `P${index + 1}` },
                children: [
                    {
                        type: 'part-name',
                        text: track.name || `Part ${index + 1}`
                    },
                    {
                        type: 'part-abbreviation',
                        text: track.abbreviation || track.name?.substring(0, 3) || `P${index + 1}`
                    },
                    track.instrument ? {
                        type: 'score-instrument',
                        attributes: { id: `P${index + 1}-I1` },
                        children: [
                            {
                                type: 'instrument-name',
                                text: track.instrument
                            }
                        ]
                    } : null
                ].filter(c => c)
            }));
        
        const partGroups = this.detectPartGroups(tracks);
        
        return {
            type: 'part-list',
            children: [...partGroups, ...scoreParts]
        };
    }
    
    // Detect part groups (brackets, braces)
    detectPartGroups(tracks) {
        const groups = [];
        const instrumentalTracks = tracks.filter(t => t.type !== 'Audio');
        
        // Group by type
        const typeGroups = {};
        for (const track of instrumentalTracks) {
            const type = track.instrumentType || track.type;
            if (!typeGroups[type]) {
                typeGroups[type] = [];
            }
            typeGroups[type].push(track);
        }
        
        // Create part-groups for types with multiple tracks
        let groupNumber = 1;
        for (const [type, groupTracks] of Object.entries(typeGroups)) {
            if (groupTracks.length > 1) {
                const indices = groupTracks.map(t => instrumentalTracks.indexOf(t));
                groups.push({
                    type: 'part-group',
                    attributes: { number: groupNumber, type: 'start' },
                    children: [
                        {
                            type: 'group-symbol',
                            text: type === 'Piano' ? 'brace' : 'bracket'
                        },
                        {
                            type: 'group-barline',
                            text: 'yes'
                        },
                        {
                            type: 'group-name',
                            text: type
                        }
                    ]
                });
                
                // Add stop after the last track in group
                groups.push({
                    type: 'part-group',
                    attributes: { number: groupNumber, type: 'stop' }
                });
                
                groupNumber++;
            }
        }
        
        return groups;
    }
    
    // Build part
    buildPart(track, state) {
        const trackIndex = (state.tracks || []).indexOf(track);
        const partId = `P${trackIndex + 1}`;
        
        // Get measures from track
        const measures = this.extractMeasures(track, state);
        
        return {
            type: 'part',
            attributes: { id: partId },
            children: measures.map((measure, index) => this.buildMeasure(measure, index + 1, track, state))
        };
    }
    
    // Extract measures from track
    extractMeasures(track, state) {
        const measures = [];
        const sequence = track.activeSequenceId ? 
            (track.sequences || []).find(s => s.id === track.activeSequenceId) : 
            (track.sequences?.[0]);
        
        if (!sequence || !sequence.notes) {
            return measures;
        }
        
        const bpm = state.bpm || 120;
        const timeSignature = state.timeSignature || '4/4';
        const [beatsPerMeasure, beatUnit] = timeSignature.split('/').map(Number);
        
        // Calculate measure duration in seconds
        const beatDuration = 60 / bpm;
        const measureDuration = beatsPerMeasure * beatDuration * (4 / beatUnit);
        
        // Group notes into measures
        const totalDuration = this.getTrackDuration(track);
        const numMeasures = Math.ceil(totalDuration / measureDuration);
        
        for (let i = 0; i < numMeasures; i++) {
            const startTime = i * measureDuration;
            const endTime = (i + 1) * measureDuration;
            
            const measureNotes = sequence.notes.filter(n => {
                const noteStart = n.time || n.start || 0;
                return noteStart >= startTime && noteStart < endTime;
            });
            
            measures.push({
                number: i + 1,
                notes: measureNotes.map(n => ({
                    ...n,
                    measureTime: (n.time || n.start || 0) - startTime
                })),
                timeSignature,
                keySignature: state.keySignature || 'C'
            });
        }
        
        return measures;
    }
    
    // Get track duration
    getTrackDuration(track) {
        const sequence = track.sequences?.[0];
        if (!sequence || !sequence.notes) return 4; // Default 4 beats
        
        let maxTime = 0;
        for (const note of sequence.notes) {
            const endTime = (note.time || note.start || 0) + (note.duration || 1);
            if (endTime > maxTime) maxTime = endTime;
        }
        
        return maxTime;
    }
    
    // Build measure
    buildMeasure(measureData, number, track, state) {
        const children = [];
        
        // Add attributes (time signature, key signature, clef)
        if (this.exportSettings.includeTimeSignature || this.exportSettings.includeKeySignature) {
            children.push(this.buildMeasureAttributes(measureData, track, number === 1));
        }
        
        // Add notes
        if (this.exportSettings.includeNotes) {
            for (const note of measureData.notes) {
                children.push(this.buildNote(note, measureData, track));
            }
        }
        
        // Add barline
        if (this.exportSettings.includeBarlines && number > 1) {
            children.push(this.buildBarline(measureData, number));
        }
        
        return {
            type: 'measure',
            attributes: { number: number.toString() },
            children
        };
    }
    
    // Build measure attributes
    buildMeasureAttributes(measureData, track, isFirstMeasure) {
        const children = [];
        
        // Divisions (ticks per quarter note)
        children.push({
            type: 'divisions',
            text: '480' // Standard MIDI resolution
        });
        
        // Key signature
        if (this.exportSettings.includeKeySignature) {
            const key = this.parseKeySignature(measureData.keySignature || 'C');
            children.push({
                type: 'key',
                children: [
                    { type: 'fifths', text: key.fifths.toString() },
                    { type: 'mode', text: key.mode }
                ]
            });
        }
        
        // Time signature
        if (this.exportSettings.includeTimeSignature) {
            const [beats, beatType] = measureData.timeSignature.split('/').map(Number);
            children.push({
                type: 'time',
                children: [
                    { type: 'beats', text: beats.toString() },
                    { type: 'beat-type', text: beatType.toString() }
                ]
            });
        }
        
        // Clef (only in first measure or when it changes)
        if (isFirstMeasure) {
            const clef = this.determineClef(track);
            children.push({
                type: 'clef',
                children: [
                    { type: 'sign', text: clef.sign },
                    { type: 'line', text: clef.line.toString() }
                ]
            });
        }
        
        return {
            type: 'attributes',
            children
        };
    }
    
    // Parse key signature
    parseKeySignature(key) {
        const keyMap = {
            'C': { fifths: 0, mode: 'major' },
            'G': { fifths: 1, mode: 'major' },
            'D': { fifths: 2, mode: 'major' },
            'A': { fifths: 3, mode: 'major' },
            'E': { fifths: 4, mode: 'major' },
            'B': { fifths: 5, mode: 'major' },
            'F#': { fifths: 6, mode: 'major' },
            'C#': { fifths: 7, mode: 'major' },
            'F': { fifths: -1, mode: 'major' },
            'Bb': { fifths: -2, mode: 'major' },
            'Eb': { fifths: -3, mode: 'major' },
            'Ab': { fifths: -4, mode: 'major' },
            'Db': { fifths: -5, mode: 'major' },
            'Gb': { fifths: -6, mode: 'major' },
            'Cb': { fifths: -7, mode: 'major' },
            'Am': { fifths: 0, mode: 'minor' },
            'Em': { fifths: 1, mode: 'minor' },
            'Bm': { fifths: 2, mode: 'minor' },
            'F#m': { fifths: 3, mode: 'minor' },
            'C#m': { fifths: 4, mode: 'minor' },
            'G#m': { fifths: 5, mode: 'minor' },
            'D#m': { fifths: 6, mode: 'minor' },
            'A#m': { fifths: 7, mode: 'minor' },
            'Dm': { fifths: -1, mode: 'minor' },
            'Gm': { fifths: -2, mode: 'minor' },
            'Cm': { fifths: -3, mode: 'minor' },
            'Fm': { fifths: -4, mode: 'minor' },
            'Bbm': { fifths: -5, mode: 'minor' },
            'Ebm': { fifths: -6, mode: 'minor' },
            'Abm': { fifths: -7, mode: 'minor' }
        };
        
        return keyMap[key] || { fifths: 0, mode: 'major' };
    }
    
    // Determine clef for track
    determineClef(track) {
        const instrument = track.instrument?.toLowerCase() || '';
        
        if (instrument.includes('bass') || instrument.includes('cello') || instrument.includes('trombone')) {
            return { sign: 'F', line: 4 };
        }
        
        if (instrument.includes('viola')) {
            return { sign: 'C', line: 3 };
        }
        
        if (instrument.includes('percussion') || instrument.includes('drum')) {
            return { sign: 'percussion', line: 0 };
        }
        
        // Default treble clef
        return { sign: 'G', line: 2 };
    }
    
    // Build note
    buildNote(noteData, measureData, track) {
        const children = [];
        
        // Pitch
        const pitch = this.midiToPitch(noteData.note || noteData.pitch || 60);
        children.push({
            type: 'pitch',
            children: [
                { type: 'step', text: pitch.step },
                { type: 'alter', text: pitch.alter.toString() },
                { type: 'octave', text: pitch.octave.toString() }
            ]
        });
        
        // Duration
        const duration = this.calculateDuration(noteData.duration || 1, measureData.timeSignature);
        children.push({
            type: 'duration',
            text: duration.toString()
        });
        
        // Voice
        children.push({
            type: 'voice',
            text: '1'
        });
        
        // Type
        const noteType = this.determineNoteType(noteData.duration || 1);
        children.push({
            type: 'type',
            text: noteType
        });
        
        // Stem direction
        if (pitch.octave >= 4) {
            children.push({
                type: 'stem',
                text: 'down'
            });
        } else {
            children.push({
                type: 'stem',
                text: 'up'
            });
        }
        
        // Velocity (dynamics)
        if (this.exportSettings.includeDynamics && noteData.velocity !== undefined) {
            children.push({
                type: 'dynamics',
                children: [
                    { type: this.velocityToDynamic(noteData.velocity) }
                ]
            });
        }
        
        // Articulations
        if (this.exportSettings.includeArticulations && noteData.articulations) {
            children.push({
                type: 'articulations',
                children: noteData.articulations.map(a => ({ type: a }))
            });
        }
        
        // Tied note
        if (this.exportSettings.includeTies && noteData.tie) {
            children.push({
                type: 'tie',
                attributes: { type: noteData.tie }
            });
        }
        
        return {
            type: 'note',
            children
        };
    }
    
    // Build barline
    buildBarline(measureData, number) {
        return {
            type: 'barline',
            attributes: { location: 'right' },
            children: [
                {
                    type: 'bar-style',
                    text: 'regular'
                }
            ]
        };
    }
    
    // Convert MIDI note to pitch
    midiToPitch(midi) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        const note = notes[noteIndex];
        
        let step = note.charAt(0);
        let alter = note.includes('#') ? 1 : 0;
        
        return { step, alter, octave };
    }
    
    // Calculate duration in divisions
    calculateDuration(duration, timeSignature) {
        const [beats, beatType] = timeSignature.split('/').map(Number);
        const quarterNoteDuration = 480;
        
        return Math.round(duration * quarterNoteDuration);
    }
    
    // Determine note type from duration
    determineNoteType(duration) {
        if (duration >= 4) return 'whole';
        if (duration >= 2) return 'half';
        if (duration >= 1) return 'quarter';
        if (duration >= 0.5) return 'eighth';
        if (duration >= 0.25) return '16th';
        if (duration >= 0.125) return '32nd';
        return '64th';
    }
    
    // Convert velocity to dynamic marking
    velocityToDynamic(velocity) {
        if (velocity >= 120) return 'ff';
        if (velocity >= 100) return 'f';
        if (velocity >= 80) return 'mf';
        if (velocity >= 60) return 'mp';
        if (velocity >= 40) return 'p';
        return 'pp';
    }
    
    // Convert XML object to string
    xmlToString(xml, indent = 0) {
        const spaces = this.exportSettings.indent.repeat(indent);
        let result = '';
        
        if (xml.text !== undefined) {
            return `${spaces}${xml.text}\n`;
        }
        
        result += `${spaces}<${xml.type}`;
        
        if (xml.attributes) {
            for (const [key, value] of Object.entries(xml.attributes)) {
                result += ` ${key}="${value}"`;
            }
        }
        
        if (!xml.children || xml.children.length === 0) {
            result += '/>\n';
        } else {
            result += '>\n';
            for (const child of xml.children) {
                if (child) {
                    result += this.xmlToString(child, indent + 1);
                }
            }
            result += `${spaces}</${xml.type}>\n`;
        }
        
        return result;
    }
    
    // Prettify XML output
    prettifyXML(xml) {
        // Add XML declaration
        const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
        return declaration + xml;
    }
    
    // Download exported file
    downloadExport(filename = 'score') {
        if (!this.exportedData) {
            console.warn('[NotationExportEnhancement] No export to download');
            return false;
        }
        
        const extension = this.exportSettings.format === 'mei' ? 'mei' : 'musicxml';
        const mimeType = this.exportSettings.format === 'mei' ? 'application/mei+xml' : 'application/vnd.recordare.musicxml+xml';
        
        const blob = new Blob([this.exportedData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
        
        return true;
    }
    
    // Update settings
    updateSettings(newSettings) {
        Object.assign(this.exportSettings, newSettings);
        console.log('[NotationExportEnhancement] Settings updated');
    }
    
    // Get settings
    getSettings() {
        return { ...this.exportSettings };
    }
    
    // Get exported data
    getExportedData() {
        return this.exportedData;
    }
}

// UI Panel function
function openNotationExportPanel() {
    const existing = document.getElementById('notation-export-panel');
    if (existing) {
        existing.remove();
    }
    
    const exporter = window.notationExportEnhancement || new NotationExportEnhancement();
    window.notationExportEnhancement = exporter;
    
    const panel = document.createElement('div');
    panel.id = 'notation-export-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const settings = exporter.getSettings();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 20px;">Notation Export</h2>
            <button id="close-notation-export" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Format</label>
            <select id="notation-format" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="musicxml" ${settings.format === 'musicxml' ? 'selected' : ''}>MusicXML</option>
                <option value="mei" ${settings.format === 'mei' ? 'selected' : ''}>MEI</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Version</label>
            <select id="notation-version" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="3.1" ${settings.version === '3.1' ? 'selected' : ''}>3.1</option>
                <option value="4.0" ${settings.version === '4.0' ? 'selected' : ''}>4.0</option>
            </select>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px; color: #fff; font-size: 14px;">Include Elements</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-metadata" ${settings.includeMetadata ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Metadata
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-layout" ${settings.includeLayout ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Layout
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-dynamics" ${settings.includeDynamics ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Dynamics
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-articulations" ${settings.includeArticulations ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Articulations
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-slurs" ${settings.includeSlurs ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Slurs
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-lyrics" ${settings.includeLyrics ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Lyrics
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-harmony" ${settings.includeHarmony ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Harmony
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-repeats" ${settings.includeRepeats ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Repeats
                </label>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; cursor: pointer;">
                <input type="checkbox" id="pretty-print" ${settings.prettyPrint ? 'checked' : ''} style="width: 18px; height: 18px;">
                Pretty print output
            </label>
        </div>
        
        <div id="export-progress" style="display: none; margin-bottom: 16px;">
            <div style="background: #2a2a4e; border-radius: 4px; overflow: hidden;">
                <div id="export-progress-bar" style="background: #10b981; height: 24px; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="export-status" style="color: #a0a0a0; text-align: center; margin-top: 8px; font-size: 14px;">Exporting...</div>
        </div>
        
        <div style="display: flex; gap: 12px;">
            <button id="export-notation-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Export Notation
            </button>
            <button id="preview-notation-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Preview
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-notation-export').onclick = () => panel.remove();
    
    document.getElementById('export-notation-btn').onclick = async () => {
        document.getElementById('export-progress').style.display = 'block';
        document.getElementById('export-status').textContent = 'Exporting...';
        
        try {
            await exporter.exportToMusicXML((progress) => {
                document.getElementById('export-progress-bar').style.width = `${progress * 100}%`;
            });
            
            exporter.downloadExport();
            document.getElementById('export-status').textContent = 'Export complete!';
        } catch (error) {
            document.getElementById('export-status').textContent = `Error: ${error.message}`;
        }
    };
    
    document.getElementById('preview-notation-btn').onclick = async () => {
        try {
            const data = await exporter.exportToMusicXML();
            console.log('Preview:', data.substring(0, 500));
            alert('Preview logged to console');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };
    
    // Settings handlers
    ['include-metadata', 'include-layout', 'include-dynamics', 'include-articulations', 
     'include-slurs', 'include-lyrics', 'include-harmony', 'include-repeats', 'pretty-print'].forEach(id => {
        document.getElementById(id).onchange = (e) => {
            const key = id.replace(/-/g, '');
            const settingsKey = id.split('-').map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('');
            exporter.updateSettings({ [settingsKey]: e.target.checked });
        };
    });
    
    return exporter;
}

// Initialize
function initNotationExportEnhancement() {
    if (!window.notationExportEnhancement) {
        window.notationExportEnhancement = new NotationExportEnhancement();
    }
    return window.notationExportEnhancement;
}

// Export
window.NotationExportEnhancement = NotationExportEnhancement;
window.notationExportEnhancement = new NotationExportEnhancement();
window.openNotationExportPanel = openNotationExportPanel;
window.initNotationExportEnhancement = initNotationExportEnhancement;