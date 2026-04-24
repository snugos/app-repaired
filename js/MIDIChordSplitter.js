// js/MIDIChordSplitter.js - MIDI Chord Splitter for SnugOS DAW
// Split polyphonic MIDI into separate notes

import { getDAW } from './main.js';

export class MIDIChordSplitter {
    constructor() {
        this.minVoices = 2; // Minimum notes to consider a chord
        this.toleranceMs = 50; // Time tolerance for chord detection
        this.outputMode = 'arpeggiated'; // 'arpeggiated', 'simultaneous', 'separate-tracks'
        this.arpPattern = 'up'; // 'up', 'down', 'up-down', 'random', 'as-played'
        this.arpDuration = 0.1; // Duration of each note in arpeggiated mode
        this.humanizeAmount = 0; // Random timing variation (ms)
        this.velocitySpread = 0; // Velocity variation amount
        
        this.onSplitCallback = null;
    }

    // Analyze MIDI sequence for chords
    analyzeChords(notes) {
        if (!notes || notes.length === 0) return [];
        
        // Sort notes by time
        const sortedNotes = [...notes].sort((a, b) => a.time - b.time);
        
        const chords = [];
        let currentChord = null;
        
        sortedNotes.forEach(note => {
            if (!currentChord) {
                // Start new chord
                currentChord = {
                    time: note.time,
                    notes: [note],
                    duration: note.duration || 0.5
                };
            } else {
                // Check if note is within tolerance of chord start
                const timeDiff = Math.abs(note.time - currentChord.time);
                
                if (timeDiff <= this.toleranceMs / 1000) {
                    // Add to current chord
                    currentChord.notes.push(note);
                    // Update chord duration to longest note
                    if (note.duration > currentChord.duration) {
                        currentChord.duration = note.duration;
                    }
                } else {
                    // Finalize current chord if it has enough notes
                    if (currentChord.notes.length >= this.minVoices) {
                        // Sort notes by pitch within chord
                        currentChord.notes.sort((a, b) => a.pitch - b.pitch);
                        chords.push(currentChord);
                    }
                    
                    // Start new chord
                    currentChord = {
                        time: note.time,
                        notes: [note],
                        duration: note.duration || 0.5
                    };
                }
            }
        });
        
        // Don't forget the last chord
        if (currentChord && currentChord.notes.length >= this.minVoices) {
            currentChord.notes.sort((a, b) => a.pitch - b.pitch);
            chords.push(currentChord);
        }
        
        return chords;
    }

    // Split a sequence into separate tracks (one per voice)
    splitToSeparateTracks(trackId, sequenceId) {
        const daw = getDAW();
        if (!daw) return null;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return null;
        
        const sequence = track.sequences?.find(s => s.id === sequenceId);
        if (!sequence) return null;
        
        const notes = sequence.notes || [];
        const chords = this.analyzeChords(notes);
        
        if (chords.length === 0) return null;
        
        // Find max polyphony
        let maxVoices = 0;
        chords.forEach(chord => {
            if (chord.notes.length > maxVoices) {
                maxVoices = chord.notes.length;
            }
        });
        
        // Create separate tracks for each voice
        const newTracks = [];
        
        for (let voiceIndex = 0; voiceIndex < maxVoices; voiceIndex++) {
            const voiceNotes = [];
            
            chords.forEach(chord => {
                if (voiceIndex < chord.notes.length) {
                    const note = chord.notes[voiceIndex];
                    voiceNotes.push({
                        ...note,
                        time: chord.time,
                        duration: chord.duration
                    });
                }
            });
            
            // Add non-chord notes to voice 0
            if (voiceIndex === 0) {
                notes.forEach(note => {
                    const isInChord = chords.some(c => c.notes.some(n => n.id === note.id));
                    if (!isInChord) {
                        voiceNotes.push(note);
                    }
                });
            }
            
            // Sort voice notes by time
            voiceNotes.sort((a, b) => a.time - b.time);
            
            newTracks.push({
                name: `${track.name || 'Track'} Voice ${voiceIndex + 1}`,
                notes: voiceNotes,
                instrument: track.instrument,
                instrumentSettings: { ...track.instrumentSettings }
            });
        }
        
        if (this.onSplitCallback) {
            this.onSplitCallback({
                type: 'separateTracks',
                originalTrackId: trackId,
                newTracks: newTracks.map(t => ({ name: t.name, noteCount: t.notes.length }))
            });
        }
        
        return newTracks;
    }

    // Split chord to arpeggiated notes
    splitToArpeggiated(notes, pattern = this.arpPattern) {
        const chords = this.analyzeChords(notes);
        const outputNotes = [];
        
        chords.forEach(chord => {
            const chordNotes = [...chord.notes];
            
            // Apply pattern
            switch (pattern) {
                case 'up':
                    chordNotes.sort((a, b) => a.pitch - b.pitch);
                    break;
                case 'down':
                    chordNotes.sort((a, b) => b.pitch - a.pitch);
                    break;
                case 'up-down':
                    chordNotes.sort((a, b) => a.pitch - b.pitch);
                    // Add reversed at end
                    chordNotes.push(...[...chordNotes].reverse().slice(1, -1));
                    break;
                case 'random':
                    for (let i = chordNotes.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [chordNotes[i], chordNotes[j]] = [chordNotes[j], chordNotes[i]];
                    }
                    break;
                case 'as-played':
                    // Keep original order
                    break;
            }
            
            // Create arpeggiated notes
            chordNotes.forEach((note, index) => {
                let time = chord.time + (index * this.arpDuration);
                
                // Apply humanization
                if (this.humanizeAmount > 0) {
                    const variation = (Math.random() - 0.5) * 2 * (this.humanizeAmount / 1000);
                    time += variation;
                }
                
                let velocity = note.velocity || 80;
                
                // Apply velocity spread
                if (this.velocitySpread > 0) {
                    const variation = (Math.random() - 0.5) * 2 * this.velocitySpread;
                    velocity = Math.max(1, Math.min(127, velocity + variation));
                }
                
                outputNotes.push({
                    ...note,
                    id: `split_${note.id}_${index}`,
                    time,
                    duration: this.arpDuration,
                    velocity
                });
            });
        });
        
        return outputNotes;
    }

    // Split to simultaneous (keep timing, separate for analysis)
    splitToSimultaneous(notes) {
        const chords = this.analyzeChords(notes);
        
        return chords.map(chord => ({
            time: chord.time,
            duration: chord.duration,
            pitches: chord.notes.map(n => n.pitch),
            velocities: chord.notes.map(n => n.velocity || 80),
            notes: chord.notes
        }));
    }

    // Detect chord type (major, minor, diminished, etc.)
    detectChordType(pitches) {
        if (!pitches || pitches.length < 3) return 'unknown';
        
        // Get intervals from root
        const root = Math.min(...pitches);
        const intervals = pitches.map(p => (p - root) % 12).sort((a, b) => a - b);
        
        // Common chord patterns
        const patterns = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'diminished': [0, 3, 6],
            'augmented': [0, 4, 8],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            'major7': [0, 4, 7, 11],
            'minor7': [0, 3, 7, 10],
            'dominant7': [0, 4, 7, 10],
            'diminished7': [0, 3, 6, 9],
            'half-diminished': [0, 3, 6, 10]
        };
        
        // Match against patterns
        for (const [name, pattern] of Object.entries(patterns)) {
            if (this.matchPattern(intervals, pattern)) {
                return name;
            }
        }
        
        return 'unknown';
    }

    matchPattern(intervals, pattern) {
        if (intervals.length !== pattern.length) return false;
        
        for (let i = 0; i < pattern.length; i++) {
            if (intervals[i] !== pattern[i]) return false;
        }
        
        return true;
    }

    // Get chord root note name
    getPitchName(pitch) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return noteNames[pitch % 12];
    }

    // Full chord name with type
    getChordName(pitches) {
        if (!pitches || pitches.length === 0) return 'Unknown';
        
        const root = Math.min(...pitches);
        const rootName = this.getPitchName(root);
        const chordType = this.detectChordType(pitches);
        
        if (chordType === 'unknown') {
            return `${rootName} (?)`;
        }
        
        if (chordType === 'major') {
            return rootName;
        }
        
        if (chordType === 'minor') {
            return `${rootName}m`;
        }
        
        return `${rootName}${chordType}`;
    }

    // Process a track's sequence
    processSequence(trackId, sequenceId, mode = this.outputMode) {
        const daw = getDAW();
        if (!daw) return null;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return null;
        
        const sequence = track.sequences?.find(s => s.id === sequenceId);
        if (!sequence) return null;
        
        const notes = sequence.notes || [];
        
        switch (mode) {
            case 'arpeggiated':
                return this.splitToArpeggiated(notes);
            case 'simultaneous':
                return this.splitToSimultaneous(notes);
            case 'separate-tracks':
                return this.splitToSeparateTracks(trackId, sequenceId);
            default:
                return this.analyzeChords(notes);
        }
    }

    // Settings
    setMinVoices(voices) {
        this.minVoices = Math.max(2, voices);
        return this.minVoices;
    }

    setTolerance(ms) {
        this.toleranceMs = Math.max(1, ms);
        return this.toleranceMs;
    }

    setOutputMode(mode) {
        this.outputMode = mode;
        return this.outputMode;
    }

    setArpPattern(pattern) {
        this.arpPattern = pattern;
        return this.arpPattern;
    }

    setArpDuration(duration) {
        this.arpDuration = Math.max(0.01, duration);
        return this.arpDuration;
    }

    setHumanize(amount) {
        this.humanizeAmount = Math.max(0, amount);
        return this.humanizeAmount;
    }

    setVelocitySpread(spread) {
        this.velocitySpread = Math.max(0, Math.min(127, spread));
        return this.velocitySpread;
    }

    setOnSplitCallback(callback) {
        this.onSplitCallback = callback;
    }

    dispose() {
        this.onSplitCallback = null;
    }
}

// Singleton instance
let chordSplitterInstance = null;

export function getMIDIChordSplitter() {
    if (!chordSplitterInstance) {
        chordSplitterInstance = new MIDIChordSplitter();
    }
    return chordSplitterInstance;
}

export function openChordSplitterPanel() {
    const splitter = getMIDIChordSplitter();
    
    const panel = document.createElement('div');
    panel.id = 'chord-splitter-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-lg p-6 w-full max-w-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">MIDI Chord Splitter</h2>
                <button id="close-splitter-panel" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="text-zinc-300 text-sm">Min Voices</label>
                    <input type="number" id="split-min-voices" value="${splitter.minVoices}" min="2" max="10"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">Tolerance (ms)</label>
                    <input type="number" id="split-tolerance" value="${splitter.toleranceMs}" min="1" max="500"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Output Mode</label>
                <select id="split-output-mode" class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                    <option value="arpeggiated" ${splitter.outputMode === 'arpeggiated' ? 'selected' : ''}>Arpeggiated</option>
                    <option value="simultaneous" ${splitter.outputMode === 'simultaneous' ? 'selected' : ''}>Simultaneous</option>
                    <option value="separate-tracks" ${splitter.outputMode === 'separate-tracks' ? 'selected' : ''}>Separate Tracks</option>
                </select>
            </div>
            
            <div id="arp-options" class="${splitter.outputMode === 'arpeggiated' ? '' : 'opacity-50 pointer-events-none'} mb-4">
                <label class="text-zinc-300 text-sm">Arp Pattern</label>
                <select id="split-arp-pattern" class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                    <option value="up" ${splitter.arpPattern === 'up' ? 'selected' : ''}>Up</option>
                    <option value="down" ${splitter.arpPattern === 'down' ? 'selected' : ''}>Down</option>
                    <option value="up-down" ${splitter.arpPattern === 'up-down' ? 'selected' : ''}>Up-Down</option>
                    <option value="random" ${splitter.arpPattern === 'random' ? 'selected' : ''}>Random</option>
                    <option value="as-played" ${splitter.arpPattern === 'as-played' ? 'selected' : ''}>As Played</option>
                </select>
                
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <label class="text-zinc-300 text-sm">Note Duration</label>
                        <input type="number" id="split-arp-duration" value="${splitter.arpDuration}" min="0.01" max="2" step="0.01"
                            class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                    </div>
                    <div>
                        <label class="text-zinc-300 text-sm">Humanize (ms)</label>
                        <input type="number" id="split-humanize" value="${splitter.humanizeAmount}" min="0" max="100"
                            class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                    </div>
                </div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Velocity Spread</label>
                <input type="range" id="split-velocity-spread" value="${splitter.velocitySpread}" min="0" max="50"
                    class="w-full mt-1">
                <span id="velocity-spread-value" class="text-zinc-400 text-sm">${splitter.velocitySpread}</span>
            </div>
            
            <div class="flex gap-4">
                <button id="split-analyze" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">
                    Analyze Current
                </button>
                <button id="split-apply" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded">
                    Apply Split
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-splitter-panel').onclick = () => {
        panel.remove();
    };
    
    document.getElementById('split-min-voices').onchange = (e) => {
        splitter.setMinVoices(parseInt(e.target.value));
    };
    
    document.getElementById('split-tolerance').onchange = (e) => {
        splitter.setTolerance(parseInt(e.target.value));
    };
    
    document.getElementById('split-output-mode').onchange = (e) => {
        splitter.setOutputMode(e.target.value);
        const arpOptions = document.getElementById('arp-options');
        if (e.target.value === 'arpeggiated') {
            arpOptions.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            arpOptions.classList.add('opacity-50', 'pointer-events-none');
        }
    };
    
    document.getElementById('split-arp-pattern').onchange = (e) => {
        splitter.setArpPattern(e.target.value);
    };
    
    document.getElementById('split-arp-duration').onchange = (e) => {
        splitter.setArpDuration(parseFloat(e.target.value));
    };
    
    document.getElementById('split-humanize').onchange = (e) => {
        splitter.setHumanize(parseInt(e.target.value));
    };
    
    document.getElementById('split-velocity-spread').oninput = (e) => {
        const value = parseInt(e.target.value);
        splitter.setVelocitySpread(value);
        document.getElementById('velocity-spread-value').textContent = value;
    };
    
    document.getElementById('split-analyze').onclick = () => {
        const daw = getDAW();
        if (!daw || !daw.tracks || daw.tracks.length === 0) {
            console.log('No tracks to analyze');
            return;
        }
        
        const track = daw.tracks[0];
        if (track.sequences && track.sequences.length > 0) {
            const sequence = track.sequences[0];
            const chords = splitter.analyzeChords(sequence.notes);
            console.log('Detected chords:', chords.map(c => ({
                time: c.time,
                name: splitter.getChordName(c.notes.map(n => n.pitch)),
                notes: c.notes.length
            })));
        }
    };
    
    document.getElementById('split-apply').onclick = () => {
        const daw = getDAW();
        if (!daw || !daw.tracks || daw.tracks.length === 0) {
            console.log('No tracks to process');
            return;
        }
        
        const track = daw.tracks[0];
        if (track.sequences && track.sequences.length > 0) {
            const sequence = track.sequences[0];
            const result = splitter.processSequence(track.id, sequence.id);
            console.log('Split result:', result);
        }
    };
    
    return panel;
}