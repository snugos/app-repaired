/**
 * AI Composition Variations - Generate variations of existing compositions
 * Uses music theory heuristics to create intelligent variations
 */

class AICompositionVariations {
    constructor() {
        this.variationHistory = [];
        this.maxHistory = 50;
        
        // Scales for constraint-based generation
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
            harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
            melodicMinor: [0, 2, 3, 5, 7, 9, 11]
        };
        
        // Variation algorithms
        this.variationTypes = {
            melodicInversion: this.melodicInversion.bind(this),
            retrograde: this.retrograde.bind(this),
            retrogradeInversion: this.retrogradeInversion.bind(this),
            transposition: this.transposition.bind(this),
            rhythmicDisplacement: this.rhythmicDisplacement.bind(this),
            augmentation: this.augmentation.bind(this),
            diminution: this.diminution.bind(this),
            ornamentation: this.ornamentation.bind(this),
            fragmentation: this.fragmentation.bind(this),
            sequence: this.sequenceVariation.bind(this),
            intervalExpansion: this.intervalExpansion.bind(this),
            intervalContraction: this.intervalContraction.bind(this),
            motivicDevelopment: this.motivicDevelopment.bind(this),
            callAndResponse: this.callAndResponse.bind(this),
            echoEffect: this.echoEffect.bind(this),
            harmonization: this.harmonization.bind(this),
            arpeggiation: this.arpeggiation.bind(this),
            chordToneFocus: this.chordToneFocus.bind(this),
            passingToneAddition: this.passingToneAddition.bind(this),
            graceNoteAddition: this.graceNoteAddition.bind(this)
        };
        
        // Presets combining multiple variations
        this.presets = {
            classical: {
                name: 'Classical Variation',
                variations: ['melodicInversion', 'retrograde', 'augmentation', 'diminution'],
                weights: [0.3, 0.2, 0.25, 0.25]
            },
            jazz: {
                name: 'Jazz Variation',
                variations: ['intervalExpansion', 'ornamentation', 'sequence', 'harmonization'],
                weights: [0.25, 0.25, 0.25, 0.25]
            },
            minimalist: {
                name: 'Minimalist Variation',
                variations: ['fragmentation', 'rhythmicDisplacement', 'augmentation'],
                weights: [0.3, 0.35, 0.35]
            },
            romantic: {
                name: 'Romantic Variation',
                variations: ['ornamentation', 'augmentation', 'graceNoteAddition', 'intervalExpansion'],
                weights: [0.25, 0.25, 0.25, 0.25]
            },
            modern: {
                name: 'Modern Variation',
                variations: ['fragmentation', 'intervalContraction', 'callAndResponse'],
                weights: [0.35, 0.35, 0.3]
            },
            baroque: {
                name: 'Baroque Variation',
                variations: ['melodicInversion', 'retrograde', 'ornamentation', 'arpeggiation'],
                weights: [0.25, 0.25, 0.25, 0.25]
            },
            pop: {
                name: 'Pop Variation',
                variations: ['sequence', 'echoEffect', 'ornamentation'],
                weights: [0.35, 0.35, 0.3]
            },
            electronic: {
                name: 'Electronic Variation',
                variations: ['rhythmicDisplacement', 'fragmentation', 'callAndResponse'],
                weights: [0.35, 0.35, 0.3]
            }
        };
    }
    
    /**
     * Generate a variation from source notes
     * @param {Array} notes - Array of note objects {pitch, velocity, time, duration}
     * @param {Object} options - Variation options
     * @returns {Array} - Varied notes
     */
    generateVariation(notes, options = {}) {
        if (!notes || notes.length === 0) return [];
        
        const {
            variationType = 'melodicInversion',
            intensity = 0.5,
            key = 'C',
            scale = 'major',
            preserveRhythm = false,
            preserveContour = false,
            applyConstraints = true
        } = options;
        
        const variationFn = this.variationTypes[variationType];
        if (!variationFn) {
            console.warn(`Unknown variation type: ${variationType}`);
            return [...notes];
        }
        
        let variedNotes = variationFn(notes, { intensity, key, scale, preserveRhythm, preserveContour });
        
        if (applyConstraints) {
            variedNotes = this.applyScaleConstraints(variedNotes, key, scale);
        }
        
        // Add to history
        this.addToHistory({
            original: notes,
            variation: variedNotes,
            type: variationType,
            options,
            timestamp: Date.now()
        });
        
        return variedNotes;
    }
    
    /**
     * Generate multiple variations using a preset
     * @param {Array} notes - Source notes
     * @param {string} presetName - Preset name
     * @param {Object} options - Additional options
     * @returns {Array} - Array of varied note sets
     */
    generatePresetVariations(notes, presetName = 'classical', options = {}) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.warn(`Unknown preset: ${presetName}`);
            return [this.generateVariation(notes, options)];
        }
        
        const variations = [];
        for (let i = 0; i < preset.variations.length; i++) {
            const varied = this.generateVariation(notes, {
                ...options,
                variationType: preset.variations[i],
                intensity: preset.weights[i]
            });
            variations.push({
                name: `${preset.name} - ${preset.variations[i]}`,
                notes: varied
            });
        }
        
        return variations;
    }
    
    // Variation Algorithms
    
    melodicInversion(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        if (notes.length < 2) return [...notes];
        
        // Find the center pitch
        const pitches = notes.map(n => n.pitch);
        const minPitch = Math.min(...pitches);
        const maxPitch = Math.max(...pitches);
        const center = (minPitch + maxPitch) / 2;
        
        return notes.map(note => {
            // Invert around center
            const invertedPitch = Math.round(2 * center - note.pitch);
            const diff = invertedPitch - note.pitch;
            const appliedDiff = diff * intensity;
            
            return {
                ...note,
                pitch: Math.max(0, Math.min(127, Math.round(note.pitch + appliedDiff)))
            };
        });
    }
    
    retrograde(notes, options = {}) {
        // Reverse the order of notes
        const reversed = [...notes].reverse();
        const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);
        const firstTime = notes[0]?.time || 0;
        
        let currentTime = firstTime;
        return reversed.map(note => {
            const newNote = {
                ...note,
                time: currentTime
            };
            currentTime += note.duration;
            return newNote;
        });
    }
    
    retrogradeInversion(notes, options = {}) {
        // First invert, then reverse
        const inverted = this.melodicInversion(notes, options);
        return this.retrograde(inverted, options);
    }
    
    transposition(notes, options = {}) {
        const { intensity = 0.5, key = 'C', scale = 'major' } = options;
        
        // Transpose by scale degrees based on intensity
        const scaleDegrees = this.scales[scale] || this.scales.major;
        const transpositionAmount = Math.round(intensity * 12) % 12;
        
        return notes.map(note => ({
            ...note,
            pitch: Math.max(0, Math.min(127, note.pitch + transpositionAmount))
        }));
    }
    
    rhythmicDisplacement(notes, options = {}) {
        const { intensity = 0.5, preserveRhythm = false } = options;
        
        if (preserveRhythm) return [...notes];
        
        const displacement = intensity * 2; // Beats
        const firstTime = notes[0]?.time || 0;
        
        return notes.map(note => ({
            ...note,
            time: note.time + displacement
        }));
    }
    
    augmentation(notes, options = {}) {
        const { intensity = 0.5 } = options;
        const factor = 1 + intensity; // 1x to 2x
        
        const firstTime = notes[0]?.time || 0;
        let currentTime = firstTime;
        
        return notes.map(note => {
            const newDuration = note.duration * factor;
            const newNote = {
                ...note,
                time: currentTime,
                duration: newDuration
            };
            currentTime += newDuration;
            return newNote;
        });
    }
    
    diminution(notes, options = {}) {
        const { intensity = 0.5 } = options;
        const factor = 1 - (intensity * 0.5); // 1x to 0.5x
        
        const firstTime = notes[0]?.time || 0;
        let currentTime = firstTime;
        
        return notes.map(note => {
            const newDuration = note.duration * factor;
            const newNote = {
                ...note,
                time: currentTime,
                duration: Math.max(0.0625, newDuration) // Minimum 16th note
            };
            currentTime += newNote.duration;
            return newNote;
        });
    }
    
    ornamentation(notes, options = {}) {
        const { intensity = 0.5 } = options;
        const ornamentalNotes = [];
        
        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            ornamentalNotes.push(note);
            
            // Add ornaments based on intensity
            if (Math.random() < intensity && note.duration > 0.25) {
                // Add mordent or trill
                const ornamentType = Math.random();
                const ornamentTime = note.time + note.duration * 0.1;
                
                if (ornamentType < 0.5) {
                    // Upper mordent
                    ornamentalNotes.push({
                        pitch: note.pitch + 1,
                        velocity: note.velocity * 0.7,
                        time: ornamentTime,
                        duration: note.duration * 0.15
                    });
                } else {
                    // Turn
                    ornamentalNotes.push({
                        pitch: note.pitch + 1,
                        velocity: note.velocity * 0.6,
                        time: ornamentTime,
                        duration: note.duration * 0.1
                    });
                    ornamentalNotes.push({
                        pitch: note.pitch,
                        velocity: note.velocity * 0.6,
                        time: ornamentTime + note.duration * 0.1,
                        duration: note.duration * 0.1
                    });
                    ornamentalNotes.push({
                        pitch: note.pitch - 1,
                        velocity: note.velocity * 0.6,
                        time: ornamentTime + note.duration * 0.2,
                        duration: note.duration * 0.1
                    });
                }
            }
        }
        
        return ornamentalNotes.sort((a, b) => a.time - b.time);
    }
    
    fragmentation(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        // Extract fragments and repeat them
        const fragmentSize = Math.max(1, Math.floor(notes.length * (1 - intensity * 0.5)));
        const fragments = [];
        
        for (let i = 0; i < notes.length; i += fragmentSize) {
            fragments.push(notes.slice(i, i + fragmentSize));
        }
        
        // Select and repeat fragments
        const result = [];
        let currentTime = notes[0]?.time || 0;
        
        fragments.forEach((fragment, index) => {
            if (Math.random() < 0.5 + intensity * 0.5) {
                // Repeat fragment
                for (let rep = 0; rep < 2; rep++) {
                    fragment.forEach(note => {
                        result.push({
                            ...note,
                            time: currentTime
                        });
                        currentTime += note.duration;
                    });
                }
            } else {
                // Use fragment once
                fragment.forEach(note => {
                    result.push({
                        ...note,
                        time: currentTime
                    });
                    currentTime += note.duration;
                });
            }
        });
        
        return result;
    }
    
    sequenceVariation(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        if (notes.length < 2) return [...notes];
        
        // Create a sequence by transposing a pattern
        const patternSize = Math.max(2, Math.floor(notes.length / 3));
        const pattern = notes.slice(0, patternSize);
        const sequence = [];
        
        let currentTime = notes[0]?.time || 0;
        const transpositions = [0, 2, 4, 5, 7]; // Common sequence intervals
        
        for (let i = 0; i < Math.ceil(notes.length / patternSize); i++) {
            const trans = transpositions[i % transpositions.length];
            
            pattern.forEach(note => {
                sequence.push({
                    ...note,
                    pitch: note.pitch + trans,
                    time: currentTime
                });
                currentTime += note.duration;
            });
        }
        
        return sequence.slice(0, Math.ceil(notes.length * (1 + intensity)));
    }
    
    intervalExpansion(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        if (notes.length < 2) return [...notes];
        
        const result = [notes[0]];
        
        for (let i = 1; i < notes.length; i++) {
            const prevPitch = result[i - 1].pitch;
            const currentPitch = notes[i].pitch;
            const interval = currentPitch - prevPitch;
            
            // Expand interval
            const expandedInterval = interval * (1 + intensity * 0.5);
            
            result.push({
                ...notes[i],
                pitch: Math.round(prevPitch + expandedInterval)
            });
        }
        
        return result;
    }
    
    intervalContraction(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        if (notes.length < 2) return [...notes];
        
        const result = [notes[0]];
        
        for (let i = 1; i < notes.length; i++) {
            const prevPitch = result[i - 1].pitch;
            const currentPitch = notes[i].pitch;
            const interval = currentPitch - prevPitch;
            
            // Contract interval
            const contractedInterval = interval * (1 - intensity * 0.5);
            
            result.push({
                ...notes[i],
                pitch: Math.round(prevPitch + contractedInterval)
            });
        }
        
        return result;
    }
    
    motivicDevelopment(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        if (notes.length < 3) return [...notes];
        
        // Extract a motif and develop it
        const motifLength = Math.max(2, Math.floor(notes.length * 0.3));
        const motif = notes.slice(0, motifLength);
        
        const developments = [];
        let currentTime = notes[0]?.time || 0;
        
        // Original motif
        motif.forEach(note => {
            developments.push({ ...note, time: currentTime });
            currentTime += note.duration;
        });
        
        // Develop motif in different ways
        const developmentMethods = [
            n => this.transposition(n, { intensity: 0.5 }),
            n => this.melodicInversion(n, { intensity: 0.7 }),
            n => this.augmentation(n, { intensity: 0.3 })
        ];
        
        for (let i = 0; i < Math.ceil(notes.length / motifLength) - 1; i++) {
            const method = developmentMethods[i % developmentMethods.length];
            const developed = method(motif);
            
            developed.forEach(note => {
                developments.push({
                    ...note,
                    time: currentTime
                });
                currentTime += note.duration;
            });
        }
        
        return developments;
    }
    
    callAndResponse(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        if (notes.length < 4) return [...notes];
        
        // Split into call and create response
        const halfLength = Math.floor(notes.length / 2);
        const call = notes.slice(0, halfLength);
        const response = this.melodicInversion(notes.slice(halfLength), { intensity });
        
        return [...call, ...response];
    }
    
    echoEffect(notes, options = {}) {
        const { intensity = 0.5 } = options;
        const echoDelay = 0.25; // Quarter note delay
        const echoDecay = 0.7;
        
        const echoed = [...notes];
        
        // Add echo notes
        notes.forEach(note => {
            if (Math.random() < intensity) {
                echoed.push({
                    ...note,
                    pitch: note.pitch,
                    velocity: note.velocity * echoDecay,
                    time: note.time + echoDelay
                });
            }
        });
        
        return echoed.sort((a, b) => a.time - b.time);
    }
    
    harmonization(notes, options = {}) {
        const { intensity = 0.5 } = options;
        const harmonized = [...notes];
        
        notes.forEach(note => {
            if (Math.random() < intensity) {
                // Add harmony note (third or sixth above)
                const interval = Math.random() < 0.5 ? 3 : 5; // Minor third or fourth
                harmonized.push({
                    pitch: note.pitch + interval,
                    velocity: note.velocity * 0.6,
                    time: note.time,
                    duration: note.duration
                });
            }
        });
        
        return harmonized.sort((a, b) => a.time - b.time);
    }
    
    arpeggiation(notes, options = {}) {
        const { intensity = 0.5 } = options;
        const arpeggiated = [];
        
        notes.forEach(note => {
            if (note.duration > 0.5 && Math.random() < intensity) {
                // Arpeggiate held notes
                const arpeggioPattern = [0, 4, 7]; // Major triad pattern
                const duration = note.duration / arpeggioPattern.length;
                
                arpeggioPattern.forEach((interval, i) => {
                    arpeggiated.push({
                        pitch: note.pitch + interval,
                        velocity: note.velocity * (1 - i * 0.15),
                        time: note.time + i * duration,
                        duration: duration * 0.9
                    });
                });
            } else {
                arpeggiated.push(note);
            }
        });
        
        return arpeggiated.sort((a, b) => a.time - b.time);
    }
    
    chordToneFocus(notes, options = {}) {
        const { intensity = 0.5, key = 'C', scale = 'major' } = options;
        const scaleNotes = this.getScaleNotes(key, scale);
        
        return notes.map(note => {
            if (Math.random() < intensity) {
                // Move to nearest chord tone
                const nearest = this.findNearestScaleTone(note.pitch, scaleNotes);
                return { ...note, pitch: nearest };
            }
            return note;
        });
    }
    
    passingToneAddition(notes, options = {}) {
        const { intensity = 0.5 } = options;
        
        if (notes.length < 2) return [...notes];
        
        const result = [notes[0]];
        
        for (let i = 1; i < notes.length; i++) {
            const prevNote = notes[i - 1];
            const currNote = notes[i];
            const interval = Math.abs(currNote.pitch - prevNote.pitch);
            
            // Add passing tone for larger intervals
            if (interval > 2 && Math.random() < intensity) {
                const passingPitch = (prevNote.pitch + currNote.pitch) / 2;
                const passingDuration = Math.min(prevNote.duration, currNote.duration) * 0.5;
                
                result.push({
                    pitch: Math.round(passingPitch),
                    velocity: (prevNote.velocity + currNote.velocity) / 2 * 0.8,
                    time: prevNote.time + prevNote.duration,
                    duration: passingDuration
                });
            }
            
            result.push(currNote);
        }
        
        return result;
    }
    
    graceNoteAddition(notes, options = {}) {
        const { intensity = 0.5 } = options;
        const graced = [];
        
        notes.forEach(note => {
            if (Math.random() < intensity) {
                // Add grace note before main note
                graced.push({
                    pitch: note.pitch - 1,
                    velocity: note.velocity * 0.6,
                    time: note.time - 0.0625, // 16th note before
                    duration: 0.0625
                });
            }
            graced.push(note);
        });
        
        return graced.sort((a, b) => a.time - b.time);
    }
    
    // Utility Methods
    
    getScaleNotes(key, scaleName) {
        const keyOffset = this.getKeyOffset(key);
        const scale = this.scales[scaleName] || this.scales.major;
        return scale.map(interval => keyOffset + interval);
    }
    
    getKeyOffset(key) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return keys.indexOf(key.toUpperCase()) || 0;
    }
    
    findNearestScaleTone(pitch, scaleNotes) {
        const pitchClass = pitch % 12;
        let nearest = scaleNotes[0];
        let minDiff = 12;
        
        scaleNotes.forEach(note => {
            const diff = Math.abs(note - pitchClass);
            if (diff < minDiff) {
                minDiff = diff;
                nearest = note;
            }
        });
        
        // Adjust octave
        const octave = Math.floor(pitch / 12);
        return octave * 12 + nearest;
    }
    
    applyScaleConstraints(notes, key, scaleName) {
        const scaleNotes = this.getScaleNotes(key, scaleName);
        
        return notes.map(note => {
            const constrained = this.findNearestScaleTone(note.pitch, scaleNotes);
            return { ...note, pitch: constrained };
        });
    }
    
    addToHistory(entry) {
        this.variationHistory.push(entry);
        if (this.variationHistory.length > this.maxHistory) {
            this.variationHistory.shift();
        }
    }
    
    getHistory() {
        return [...this.variationHistory];
    }
    
    clearHistory() {
        this.variationHistory = [];
    }
    
    // Export/Import
    exportVariation(notes, format = 'json') {
        const data = {
            notes,
            timestamp: Date.now(),
            version: '1.0'
        };
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return notes.map(n => `${n.pitch},${n.velocity},${n.time},${n.duration}`).join('\n');
            default:
                return JSON.stringify(data);
        }
    }
    
    importVariation(data, format = 'json') {
        try {
            switch (format) {
                case 'json':
                    return JSON.parse(data).notes;
                case 'csv':
                    return data.split('\n').map(line => {
                        const [pitch, velocity, time, duration] = line.split(',').map(Number);
                        return { pitch, velocity, time, duration };
                    });
                default:
                    return JSON.parse(data).notes;
            }
        } catch (e) {
            console.error('Import failed:', e);
            return [];
        }
    }
}

// UI Panel
function openAICompositionVariationsPanel() {
    const existing = document.getElementById('ai-composition-variations-panel');
    if (existing) {
        existing.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'ai-composition-variations-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3b82f6;
        border-radius: 12px;
        padding: 24px;
        width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #3b82f6; font-size: 20px;">🎵 AI Composition Variations</h2>
            <button id="close-variations-panel" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Variation Type</label>
            <select id="variation-type" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                <option value="melodicInversion">Melodic Inversion</option>
                <option value="retrograde">Retrograde</option>
                <option value="retrogradeInversion">Retrograde Inversion</option>
                <option value="transposition">Transposition</option>
                <option value="rhythmicDisplacement">Rhythmic Displacement</option>
                <option value="augmentation">Augmentation</option>
                <option value="diminution">Diminution</option>
                <option value="ornamentation">Ornamentation</option>
                <option value="fragmentation">Fragmentation</option>
                <option value="sequence">Sequence</option>
                <option value="intervalExpansion">Interval Expansion</option>
                <option value="intervalContraction">Interval Contraction</option>
                <option value="motivicDevelopment">Motivic Development</option>
                <option value="callAndResponse">Call and Response</option>
                <option value="echoEffect">Echo Effect</option>
                <option value="harmonization">Harmonization</option>
                <option value="arpeggiation">Arpeggiation</option>
                <option value="chordToneFocus">Chord Tone Focus</option>
                <option value="passingToneAddition">Passing Tone Addition</option>
                <option value="graceNoteAddition">Grace Note Addition</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Preset</label>
            <select id="variation-preset" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                <option value="">-- Custom --</option>
                <option value="classical">Classical</option>
                <option value="jazz">Jazz</option>
                <option value="minimalist">Minimalist</option>
                <option value="romantic">Romantic</option>
                <option value="modern">Modern</option>
                <option value="baroque">Baroque</option>
                <option value="pop">Pop</option>
                <option value="electronic">Electronic</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Intensity: <span id="intensity-value">50%</span></label>
            <input type="range" id="variation-intensity" min="0" max="100" value="50" style="width: 100%;">
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
                <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Key</label>
                <select id="variation-key" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                    ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => `<option value="${k}">${k}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Scale</label>
                <select id="variation-scale" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                    ${['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'pentatonic', 'blues', 'harmonicMinor', 'melodicMinor'].map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; color: #9ca3af; font-size: 12px;">
                <input type="checkbox" id="apply-constraints" checked style="margin-right: 8px;">
                Apply Scale Constraints
            </label>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button id="generate-variation" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Generate Variation
            </button>
            <button id="apply-to-track" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Apply to Track
            </button>
        </div>
        
        <div id="variation-preview" style="background: #0a0a14; border-radius: 6px; padding: 12px; min-height: 100px; color: #9ca3af; font-size: 12px;">
            Select notes and click "Generate Variation" to preview
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-variations-panel').onclick = () => panel.remove();
    
    document.getElementById('variation-intensity').oninput = (e) => {
        document.getElementById('intensity-value').textContent = e.target.value + '%';
    };
    
    document.getElementById('generate-variation').onclick = () => {
        const type = document.getElementById('variation-type').value;
        const preset = document.getElementById('variation-preset').value;
        const intensity = document.getElementById('variation-intensity').value / 100;
        const key = document.getElementById('variation-key').value;
        const scale = document.getElementById('variation-scale').value;
        const applyConstraints = document.getElementById('apply-constraints').checked;
        
        // Get selected notes from piano roll (placeholder)
        const selectedNotes = window.getSelectedNotes ? window.getSelectedNotes() : [];
        
        if (selectedNotes.length === 0) {
            document.getElementById('variation-preview').innerHTML = '<span style="color: #ef4444;">No notes selected</span>';
            return;
        }
        
        const variation = new AICompositionVariations();
        const varied = variation.generateVariation(selectedNotes, {
            variationType: type,
            intensity,
            key,
            scale,
            applyConstraints
        });
        
        document.getElementById('variation-preview').innerHTML = `
            <strong style="color: #3b82f6;">Variation: ${type}</strong><br>
            Original: ${selectedNotes.length} notes<br>
            Varied: ${varied.length} notes<br>
            <div style="margin-top: 8px; font-family: monospace;">
                ${varied.slice(0, 10).map(n => `Note: ${n.pitch} (${n.duration})`).join('<br>')}
                ${varied.length > 10 ? `<br>... and ${varied.length - 10} more` : ''}
            </div>
        `;
    };
}

// Export
window.AICompositionVariations = AICompositionVariations;
window.openAICompositionVariationsPanel = openAICompositionVariationsPanel;

console.log('[AICompositionVariations] Module loaded');
