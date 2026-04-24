/**
 * PatternMIDIExport.js
 * Export patterns to MIDI with tempo map
 * Full MIDI file generation with tempo changes and timing information
 */

export class PatternMIDIExport {
    constructor(options = {}) {
        // Export settings
        this.settings = {
            format: options.format ?? 1,           // 0 = single track, 1 = multi-track
            ticksPerBeat: options.ticksPerBeat ?? 480,  // Standard MIDI resolution
            defaultTempo: options.defaultTempo ?? 120,
            includeTempoMap: options.includeTempoMap ?? true,
            includeMetaEvents: options.includeMetaEvents ?? true,
            quantizeOutput: options.quantizeOutput ?? false,
            quantizeResolution: options.quantizeResolution ?? 16  // 16th note
        };
        
        // MIDI constants
        this.MIDI_STATUS = {
            NOTE_OFF: 0x80,
            NOTE_ON: 0x90,
            POLY_PRESSURE: 0xA0,
            CONTROL_CHANGE: 0xB0,
            PROGRAM_CHANGE: 0xC0,
            CHANNEL_PRESSURE: 0xD0,
            PITCH_BEND: 0xE0,
            SYSTEM: 0xF0,
            META: 0xFF
        };
        
        this.META_EVENTS = {
            SEQUENCE_NUMBER: 0x00,
            TEXT: 0x01,
            COPYRIGHT: 0x02,
            TRACK_NAME: 0x03,
            INSTRUMENT: 0x04,
            LYRIC: 0x05,
            MARKER: 0x06,
            CUE_POINT: 0x07,
            CHANNEL_PREFIX: 0x20,
            MIDI_PORT: 0x21,
            END_OF_TRACK: 0x2F,
            TEMPO: 0x51,
            SMPTE_OFFSET: 0x54,
            TIME_SIGNATURE: 0x58,
            KEY_SIGNATURE: 0x59,
            SEQUENCER_SPECIFIC: 0x7F
        };
    }
    
    /**
     * Export pattern to MIDI file
     * @param {Object} pattern - Pattern data with notes, tempo, etc.
     * @returns {Blob} MIDI file blob
     */
    exportPattern(pattern) {
        const { ticksPerBeat, format } = this.settings;
        
        // Create MIDI data structure
        const midiData = {
            format: format,
            nTracks: format === 0 ? 1 : this._countTracks(pattern),
            ticksPerBeat: ticksPerBeat,
            tracks: []
        };
        
        // Create tempo track (format 1 only)
        if (format === 1 && this.settings.includeTempoMap) {
            midiData.tracks.push(this._createTempoTrack(pattern));
        }
        
        // Create note tracks
        if (pattern.sequences) {
            pattern.sequences.forEach((seq, index) => {
                const track = this._createNoteTrack(seq, pattern, index);
                midiData.tracks.push(track);
            });
        }
        
        // Create single track (format 0)
        if (format === 0) {
            midiData.tracks = [this._mergeTracks(midiData.tracks)];
        }
        
        // Convert to bytes
        const bytes = this._toMIDIBytes(midiData);
        
        return new Blob([bytes], { type: 'audio/midi' });
    }
    
    /**
     * Export multiple patterns as single MIDI file
     */
    exportPatterns(patterns) {
        const mergedPattern = this._mergePatterns(patterns);
        return this.exportPattern(mergedPattern);
    }
    
    /**
     * Export pattern with tempo map from DAW project
     */
    exportWithTempoMap(pattern, tempoChanges, timeSignatureChanges) {
        const enhancedPattern = {
            ...pattern,
            tempoChanges: tempoChanges || [],
            timeSignatureChanges: timeSignatureChanges || []
        };
        
        return this.exportPattern(enhancedPattern);
    }
    
    /**
     * Count tracks from pattern
     */
    _countTracks(pattern) {
        let count = 1; // Tempo track
        
        if (pattern.sequences) {
            count += pattern.sequences.filter(s => s.data && s.data.length > 0).length;
        }
        
        return count;
    }
    
    /**
     * Create tempo track
     */
    _createTempoTrack(pattern) {
        const { ticksPerBeat } = this.settings;
        const events = [];
        
        // Initial tempo
        const initialTempo = pattern.tempo || this.settings.defaultTempo;
        events.push({
            delta: 0,
            status: this.MIDI_STATUS.META,
            metaType: this.META_EVENTS.TEMPO,
            data: this._tempoToMicroseconds(initialTempo)
        });
        
        // Time signature
        events.push({
            delta: 0,
            status: this.MIDI_STATUS.META,
            metaType: this.META_EVENTS.TIME_SIGNATURE,
            data: [4, 2, 24, 8] // 4/4, 24 clocks per click, 8 32nd notes per quarter
        });
        
        // Tempo changes
        if (pattern.tempoChanges) {
            pattern.tempoChanges.forEach(tc => {
                const tickPosition = this._timeToTicks(tc.time, initialTempo, ticksPerBeat);
                events.push({
                    delta: tickPosition,
                    status: this.MIDI_STATUS.META,
                    metaType: this.META_EVENTS.TEMPO,
                    data: this._tempoToMicroseconds(tc.tempo)
                });
            });
        }
        
        // Time signature changes
        if (pattern.timeSignatureChanges) {
            pattern.timeSignatureChanges.forEach(tsc => {
                events.push({
                    delta: this._timeToTicks(tsc.time, initialTempo, ticksPerBeat),
                    status: this.MIDI_STATUS.META,
                    metaType: this.META_EVENTS.TIME_SIGNATURE,
                    data: [tsc.numerator, this._denominatorToPower(tsc.denominator), 24, 8]
                });
            });
        }
        
        // Track name
        if (this.settings.includeMetaEvents) {
            events.unshift({
                delta: 0,
                status: this.MIDI_STATUS.META,
                metaType: this.META_EVENTS.TRACK_NAME,
                data: this._stringToBytes('Tempo Map')
            });
        }
        
        // End of track
        events.push({
            delta: 0,
            status: this.MIDI_STATUS.META,
            metaType: this.META_EVENTS.END_OF_TRACK,
            data: []
        });
        
        return this._sortAndDelta(events);
    }
    
    /**
     * Create note track from sequence
     */
    _createNoteTrack(sequence, pattern, trackIndex) {
        const { ticksPerBeat, defaultTempo } = this.settings;
        const tempo = pattern.tempo || defaultTempo;
        const events = [];
        
        // Track name
        if (this.settings.includeMetaEvents && sequence.name) {
            events.push({
                delta: 0,
                status: this.MIDI_STATUS.META,
                metaType: this.META_EVENTS.TRACK_NAME,
                data: this._stringToBytes(sequence.name)
            });
        }
        
        // Program change
        if (sequence.program !== undefined) {
            const channel = (sequence.channel || trackIndex) % 16;
            events.push({
                delta: 0,
                status: this.MIDI_STATUS.PROGRAM_CHANGE | channel,
                data: [sequence.program]
            });
        }
        
        // Convert notes to MIDI events
        if (sequence.data) {
            sequence.data.forEach(note => {
                const startTick = this._timeToTicks(note.time, tempo, ticksPerBeat);
                const durationTicks = this._timeToTicks(note.duration || 0.25, tempo, ticksPerBeat);
                const channel = (note.channel || sequence.channel || trackIndex) % 16;
                const velocity = Math.round((note.velocity || 0.8) * 127);
                
                // Quantize if enabled
                let noteStart = startTick;
                let noteEnd = startTick + durationTicks;
                
                if (this.settings.quantizeOutput) {
                    const gridSize = ticksPerBeat / (this.settings.quantizeResolution / 4);
                    noteStart = Math.round(noteStart / gridSize) * gridSize;
                    noteEnd = Math.round(noteEnd / gridSize) * gridSize;
                }
                
                // Note on
                events.push({
                    delta: noteStart,
                    status: this.MIDI_STATUS.NOTE_ON | channel,
                    data: [note.midi || note.note, velocity]
                });
                
                // Note off
                events.push({
                    delta: noteEnd,
                    status: this.MIDI_STATUS.NOTE_OFF | channel,
                    data: [note.midi || note.note, 0]
                });
            });
        }
        
        // Add CC events if present
        if (sequence.ccEvents) {
            sequence.ccEvents.forEach(cc => {
                const tick = this._timeToTicks(cc.time, tempo, ticksPerBeat);
                const channel = (cc.channel || sequence.channel || trackIndex) % 16;
                
                events.push({
                    delta: tick,
                    status: this.MIDI_STATUS.CONTROL_CHANGE | channel,
                    data: [cc.controller, Math.round(cc.value * 127)]
                });
            });
        }
        
        // Add pitch bend if present
        if (sequence.pitchBendEvents) {
            sequence.pitchBendEvents.forEach(pb => {
                const tick = this._timeToTicks(pb.time, tempo, ticksPerBeat);
                const channel = (pb.channel || sequence.channel || trackIndex) % 16;
                const bendValue = Math.round(pb.value * 8192 + 8192);
                
                events.push({
                    delta: tick,
                    status: this.MIDI_STATUS.PITCH_BEND | channel,
                    data: [bendValue & 0x7F, (bendValue >> 7) & 0x7F]
                });
            });
        }
        
        // End of track
        events.push({
            delta: 0,
            status: this.MIDI_STATUS.META,
            metaType: this.META_EVENTS.END_OF_TRACK,
            data: []
        });
        
        return this._sortAndDelta(events);
    }
    
    /**
     * Merge multiple tracks into one
     */
    _mergeTracks(tracks) {
        const allEvents = [];
        
        tracks.forEach((track, trackIndex) => {
            track.forEach(event => {
                allEvents.push({
                    ...event,
                    trackIndex
                });
            });
        });
        
        // Sort by absolute time
        allEvents.sort((a, b) => a.delta - b.delta);
        
        return this._sortAndDelta(allEvents);
    }
    
    /**
     * Merge multiple patterns
     */
    _mergePatterns(patterns) {
        const merged = {
            tempo: patterns[0]?.tempo || this.settings.defaultTempo,
            sequences: [],
            tempoChanges: [],
            timeSignatureChanges: []
        };
        
        patterns.forEach((pattern, patternIndex) => {
            if (pattern.sequences) {
                pattern.sequences.forEach(seq => {
                    const offsetSeq = {
                        ...seq,
                        data: seq.data?.map(note => ({
                            ...note,
                            time: note.time + (pattern.startTime || 0)
                        }))
                    };
                    merged.sequences.push(offsetSeq);
                });
            }
            
            // Merge tempo changes
            if (pattern.tempoChanges) {
                pattern.tempoChanges.forEach(tc => {
                    merged.tempoChanges.push({
                        ...tc,
                        time: tc.time + (pattern.startTime || 0)
                    });
                });
            }
        });
        
        return merged;
    }
    
    /**
     * Convert time in seconds to ticks
     */
    _timeToTicks(time, tempo, ticksPerBeat) {
        const beatsPerSecond = tempo / 60;
        const beats = time * beatsPerSecond;
        return Math.round(beats * ticksPerBeat);
    }
    
    /**
     * Convert tempo to microseconds per quarter note
     */
    _tempoToMicroseconds(tempo) {
        const microsecondsPerBeat = Math.round(60000000 / tempo);
        return [
            (microsecondsPerBeat >> 16) & 0xFF,
            (microsecondsPerBeat >> 8) & 0xFF,
            microsecondsPerBeat & 0xFF
        ];
    }
    
    /**
     * Convert denominator to power of 2
     */
    _denominatorToPower(denominator) {
        return Math.log2(denominator);
    }
    
    /**
     * Convert string to bytes
     */
    _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    }
    
    /**
     * Sort events and calculate delta times
     */
    _sortAndDelta(events) {
        // Sort by absolute time
        const sorted = [...events].sort((a, b) => a.delta - b.delta);
        
        // Convert to delta times
        let lastTime = 0;
        return sorted.map(event => {
            const deltaTime = event.delta - lastTime;
            lastTime = event.delta;
            return {
                ...event,
                delta: deltaTime
            };
        });
    }
    
    /**
     * Convert MIDI data structure to bytes
     */
    _toMIDIBytes(midiData) {
        const bytes = [];
        
        // Header
        this._writeString(bytes, 'MThd');
        this._writeInt32(bytes, 6); // Header length
        this._writeInt16(bytes, midiData.format);
        this._writeInt16(bytes, midiData.nTracks);
        this._writeInt16(bytes, midiData.ticksPerBeat);
        
        // Tracks
        midiData.tracks.forEach(track => {
            this._writeTrack(bytes, track);
        });
        
        return new Uint8Array(bytes);
    }
    
    /**
     * Write track to bytes
     */
    _writeTrack(bytes, track) {
        const trackBytes = [];
        
        track.forEach(event => {
            // Delta time as variable-length quantity
            this._writeVarInt(trackBytes, event.delta);
            
            // Status byte
            trackBytes.push(event.status);
            
            // Meta type for meta events
            if (event.status === this.MIDI_STATUS.META) {
                trackBytes.push(event.metaType);
                this._writeVarInt(trackBytes, event.data.length);
            }
            
            // Data bytes
            event.data.forEach(b => trackBytes.push(b));
        });
        
        // Track header
        this._writeString(bytes, 'MTrk');
        this._writeInt32(bytes, trackBytes.length);
        
        // Track data
        trackBytes.forEach(b => bytes.push(b));
    }
    
    /**
     * Write variable-length integer
     */
    _writeVarInt(bytes, value) {
        if (value < 0) value = 0;
        
        const bytes_array = [];
        bytes_array.push(value & 0x7F);
        value >>= 7;
        
        while (value > 0) {
            bytes_array.unshift((value & 0x7F) | 0x80);
            value >>= 7;
        }
        
        bytes_array.forEach(b => bytes.push(b));
    }
    
    /**
     * Write string to bytes
     */
    _writeString(bytes, str) {
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
    }
    
    /**
     * Write 32-bit integer (big endian)
     */
    _writeInt32(bytes, value) {
        bytes.push((value >> 24) & 0xFF);
        bytes.push((value >> 16) & 0xFF);
        bytes.push((value >> 8) & 0xFF);
        bytes.push(value & 0xFF);
    }
    
    /**
     * Write 16-bit integer (big endian)
     */
    _writeInt16(bytes, value) {
        bytes.push((value >> 8) & 0xFF);
        bytes.push(value & 0xFF);
    }
    
    /**
     * Create export UI panel
     */
    static createExportPanel(pattern, onExport) {
        const container = document.createElement('div');
        container.className = 'midi-export-panel';
        container.style.cssText = `
            padding: 16px;
            background: #1a1a2e;
            border-radius: 8px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
            min-width: 300px;
        `;
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Export to MIDI';
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px;';
        container.appendChild(title);
        
        // Pattern info
        const info = document.createElement('div');
        info.style.cssText = `
            padding: 8px;
            background: #2a2a4e;
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 12px;
        `;
        info.innerHTML = `
            <div><strong>Pattern:</strong> ${pattern.name || 'Unnamed'}</div>
            <div><strong>Sequences:</strong> ${pattern.sequences?.length || 0}</div>
            <div><strong>Tempo:</strong> ${pattern.tempo || 120} BPM</div>
        `;
        container.appendChild(info);
        
        // Format selection
        const formatGroup = document.createElement('div');
        formatGroup.style.cssText = 'margin-bottom: 12px;';
        formatGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Format:</label>
            <select id="midi-format" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
                <option value="1">Format 1 (Multi-track)</option>
                <option value="0">Format 0 (Single track)</option>
            </select>
        `;
        container.appendChild(formatGroup);
        
        // Resolution
        const resGroup = document.createElement('div');
        resGroup.style.cssText = 'margin-bottom: 12px;';
        resGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Resolution (ticks/beat):</label>
            <select id="midi-resolution" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
                <option value="96">96 (Low)</option>
                <option value="192">192 (Medium)</option>
                <option value="480" selected>480 (Standard)</option>
                <option value="960">960 (High)</option>
            </select>
        `;
        container.appendChild(resGroup);
        
        // Options
        const optionsGroup = document.createElement('div');
        optionsGroup.style.cssText = 'margin-bottom: 12px;';
        
        const tempoCheck = document.createElement('label');
        tempoCheck.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        tempoCheck.innerHTML = `
            <input type="checkbox" id="include-tempo" checked>
            <span>Include tempo map</span>
        `;
        optionsGroup.appendChild(tempoCheck);
        
        const quantizeCheck = document.createElement('label');
        quantizeCheck.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        quantizeCheck.innerHTML = `
            <input type="checkbox" id="quantize-output">
            <span>Quantize output</span>
        `;
        optionsGroup.appendChild(quantizeCheck);
        
        container.appendChild(optionsGroup);
        
        // Export button
        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export MIDI File';
        exportBtn.style.cssText = `
            width: 100%;
            padding: 12px;
            background: #3b82f6;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-weight: 600;
        `;
        
        exportBtn.onclick = () => {
            const exporter = new PatternMIDIExport({
                format: parseInt(document.getElementById('midi-format').value),
                ticksPerBeat: parseInt(document.getElementById('midi-resolution').value),
                includeTempoMap: document.getElementById('include-tempo').checked,
                quantizeOutput: document.getElementById('quantize-output').checked
            });
            
            const blob = exporter.exportPattern(pattern);
            
            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${pattern.name || 'pattern'}.mid`;
            a.click();
            URL.revokeObjectURL(url);
            
            if (onExport) {
                onExport(blob, pattern);
            }
        };
        
        container.appendChild(exportBtn);
        
        return container;
    }
    
    /**
     * Quick export function
     */
    static quickExport(pattern, filename) {
        const exporter = new PatternMIDIExport();
        const blob = exporter.exportPattern(pattern);
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${pattern.name || 'pattern'}.mid`;
        a.click();
        URL.revokeObjectURL(url);
        
        return blob;
    }
}

export default PatternMIDIExport;