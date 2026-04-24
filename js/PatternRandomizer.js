/**
 * Pattern Randomizer
 * Randomize pattern variations with musical constraints
 */

export class PatternRandomizer {
    constructor() {
        this.pattern = null;
        this.constraints = {
            noteRange: { min: 36, max: 84 }, // MIDI note range
            density: 0.5, // 0-1: how many notes
            velocityRange: { min: 40, max: 120 },
            durationRange: { min: 0.25, max: 1 }, // In beats
            preserveRhythm: false,
            preserveMelody: false,
            scaleLock: null, // Scale name to lock to
            chordTones: false, // Prioritize chord tones
            swingAmount: 0, // 0-1
            humanize: 0, // 0-1: timing/velocity variation
            maxInterval: 12, // Max interval between consecutive notes
            directionBias: 0, // -1 descending, 0 neutral, 1 ascending
            repetitionAvoidance: 0.5 // 0-1: avoid repeating patterns
        };
        
        this.scales = PatternRandomizer.getScales();
    }

    /**
     * Get built-in musical scales
     */
    static getScales() {
        return {
            'major': [0, 2, 4, 5, 7, 9, 11],
            'minor': [0, 2, 3, 5, 7, 8, 10],
            'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
            'melodic minor': [0, 2, 3, 5, 7, 9, 11],
            'dorian': [0, 2, 3, 5, 7, 9, 10],
            'phrygian': [0, 1, 3, 5, 7, 8, 10],
            'lydian': [0, 2, 4, 6, 7, 9, 11],
            'mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'locrian': [0, 1, 3, 5, 6, 8, 10],
            'pentatonic major': [0, 2, 4, 7, 9],
            'pentatonic minor': [0, 3, 5, 7, 10],
            'blues': [0, 3, 5, 6, 7, 10],
            'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            'whole tone': [0, 2, 4, 6, 8, 10],
            'diminished': [0, 2, 3, 5, 6, 8, 9, 11]
        };
    }

    /**
     * Set pattern to randomize
     */
    setPattern(pattern) {
        this.pattern = pattern;
    }

    /**
     * Set constraints
     */
    setConstraints(constraints) {
        Object.assign(this.constraints, constraints);
    }

    /**
     * Get a random note within constraints
     */
    getRandomNote() {
        const { noteRange, scaleLock } = this.constraints;
        
        let note;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
            note = Math.floor(
                noteRange.min + Math.random() * (noteRange.max - noteRange.min + 1)
            );
            attempts++;
        } while (
            scaleLock &&
            !this.isNoteInScale(note, scaleLock) &&
            attempts < maxAttempts
        );
        
        return note;
    }

    /**
     * Check if note is in scale
     */
    isNoteInScale(note, scaleName) {
        const scale = this.scales[scaleName.toLowerCase()];
        if (!scale) return true;
        
        const pitchClass = note % 12;
        return scale.includes(pitchClass);
    }

    /**
     * Get random velocity
     */
    getRandomVelocity() {
        const { velocityRange, humanize } = this.constraints;
        let velocity = Math.floor(
            velocityRange.min + Math.random() * (velocityRange.max - velocityRange.min + 1)
        );
        
        // Add humanization
        if (humanize > 0) {
            const variation = (Math.random() - 0.5) * 20 * humanize;
            velocity = Math.max(1, Math.min(127, velocity + variation));
        }
        
        return Math.round(velocity);
    }

    /**
     * Get random duration
     */
    getRandomDuration() {
        const { durationRange } = this.constraints;
        const durations = [0.25, 0.5, 1, 2]; // Common note values
        const validDurations = durations.filter(d => 
            d >= durationRange.min && d <= durationRange.max
        );
        
        return validDurations.length > 0 
            ? validDurations[Math.floor(Math.random() * validDurations.length)]
            : durationRange.min;
    }

    /**
     * Apply swing to timing
     */
    applySwing(time) {
        const { swingAmount } = this.constraints;
        if (swingAmount <= 0) return time;
        
        const beatPosition = time % 1;
        const isOffBeat = beatPosition >= 0.5;
        
        if (isOffBeat) {
            const swingDelay = swingAmount * 0.25;
            return time + swingDelay;
        }
        
        return time;
    }

    /**
     * Randomize a melody pattern
     */
    randomizeMelody(length = 4, stepsPerBeat = 4) {
        const totalSteps = length * stepsPerBeat;
        const notes = [];
        
        let lastNote = null;
        
        for (let step = 0; step < totalSteps; step++) {
            const time = step / stepsPerBeat;
            
            // Apply density - not every step needs a note
            if (Math.random() > this.constraints.density) {
                continue;
            }
            
            // Get note with interval constraint
            let note;
            if (lastNote !== null && this.constraints.maxInterval < 12) {
                const minNote = Math.max(
                    this.constraints.noteRange.min,
                    lastNote - this.constraints.maxInterval
                );
                const maxNote = Math.min(
                    this.constraints.noteRange.max,
                    lastNote + this.constraints.maxInterval
                );
                
                // Apply direction bias
                if (this.constraints.directionBias > 0) {
                    // Ascending bias
                    note = lastNote + Math.floor(Math.random() * (maxNote - lastNote + 1));
                } else if (this.constraints.directionBias < 0) {
                    // Descending bias
                    note = lastNote - Math.floor(Math.random() * (lastNote - minNote + 1));
                } else {
                    // Neutral
                    note = Math.floor(minNote + Math.random() * (maxNote - minNote + 1));
                }
            } else {
                note = this.getRandomNote();
            }
            
            // Scale lock check
            if (this.constraints.scaleLock && !this.isNoteInScale(note, this.constraints.scaleLock)) {
                note = this.getNearestScaleNote(note, this.constraints.scaleLock);
            }
            
            // Apply humanization to timing
            let humanizedTime = time;
            if (this.constraints.humanize > 0) {
                const timingVariation = (Math.random() - 0.5) * 0.05 * this.constraints.humanize;
                humanizedTime = Math.max(0, time + timingVariation);
            }
            
            notes.push({
                noteNumber: note,
                time: this.applySwing(humanizedTime),
                duration: this.getRandomDuration(),
                velocity: this.getRandomVelocity()
            });
            
            lastNote = note;
        }
        
        return notes;
    }

    /**
     * Get nearest note in scale
     */
    getNearestScaleNote(note, scaleName) {
        const scale = this.scales[scaleName.toLowerCase()];
        if (!scale) return note;
        
        const pitchClass = note % 12;
        const octave = Math.floor(note / 12);
        
        // Find nearest scale note
        let nearest = scale[0];
        let minDist = 12;
        
        for (const scaleNote of scale) {
            const dist = Math.abs(scaleNote - pitchClass);
            if (dist < minDist) {
                minDist = dist;
                nearest = scaleNote;
            }
        }
        
        return octave * 12 + nearest;
    }

    /**
     * Randomize a drum pattern
     */
    randomizeDrums(length = 4, stepsPerBeat = 4) {
        const totalSteps = length * stepsPerBeat;
        const notes = [];
        
        // Drum map (General MIDI)
        const drums = {
            kick: { note: 36, probability: 0.5 },
            snare: { note: 38, probability: 0.4 },
            hihat: { note: 42, probability: 0.7 },
            hihatOpen: { note: 46, probability: 0.3 },
            tomHigh: { note: 50, probability: 0.2 },
            tomMid: { note: 48, probability: 0.2 },
            tomLow: { note: 45, probability: 0.2 },
            crash: { note: 49, probability: 0.1 },
            ride: { note: 51, probability: 0.2 }
        };
        
        for (let step = 0; step < totalSteps; step++) {
            const time = step / stepsPerBeat;
            const isDownbeat = step % stepsPerBeat === 0;
            
            // Kick - more likely on downbeats
            if (Math.random() < (isDownbeat ? 0.8 : drums.kick.probability * this.constraints.density)) {
                notes.push({
                    noteNumber: drums.kick.note,
                    time: this.applySwing(time),
                    duration: 0.25,
                    velocity: isDownbeat ? 120 : this.getRandomVelocity()
                });
            }
            
            // Snare - on beats 2 and 4
            const isBeat2or4 = (step / stepsPerBeat) % 2 >= 1;
            if (isBeat2or4 && step % stepsPerBeat === 0) {
                notes.push({
                    noteNumber: drums.snare.note,
                    time: this.applySwing(time),
                    duration: 0.25,
                    velocity: this.getRandomVelocity()
                });
            }
            
            // Hi-hat
            if (Math.random() < drums.hihat.probability * this.constraints.density) {
                notes.push({
                    noteNumber: Math.random() < 0.3 ? drums.hihatOpen.note : drums.hihat.note,
                    time: this.applySwing(time),
                    duration: 0.25,
                    velocity: this.getRandomVelocity()
                });
            }
        }
        
        return notes;
    }

    /**
     * Randomize a bass pattern
     */
    randomizeBass(length = 4, stepsPerBeat = 4, rootNote = 36) {
        const totalSteps = length * stepsPerBeat;
        const notes = [];
        
        // Bass typically uses root, 5th, and octave
        const bassNotes = [rootNote, rootNote + 7, rootNote + 12];
        
        for (let step = 0; step < totalSteps; step++) {
            const time = step / stepsPerBeat;
            const isDownbeat = step % stepsPerBeat === 0;
            
            if (Math.random() < this.constraints.density) {
                // Prioritize root on downbeats
                let note;
                if (isDownbeat && Math.random() < 0.7) {
                    note = rootNote;
                } else {
                    note = bassNotes[Math.floor(Math.random() * bassNotes.length)];
                }
                
                // Scale lock
                if (this.constraints.scaleLock && !this.isNoteInScale(note, this.constraints.scaleLock)) {
                    note = this.getNearestScaleNote(note, this.constraints.scaleLock);
                }
                
                notes.push({
                    noteNumber: note,
                    time: this.applySwing(time),
                    duration: this.getRandomDuration(),
                    velocity: isDownbeat ? 100 : this.getRandomVelocity()
                });
            }
        }
        
        return notes;
    }

    /**
     * Generate variation of existing pattern
     */
    generateVariation(originalNotes, variationAmount = 0.5) {
        return originalNotes.map(note => {
            // Randomly modify notes based on variation amount
            if (Math.random() < variationAmount) {
                return {
                    ...note,
                    noteNumber: this.getRandomNote(),
                    velocity: this.getRandomVelocity()
                };
            }
            
            // Add humanization even to unchanged notes
            if (this.constraints.humanize > 0) {
                const timingVariation = (Math.random() - 0.5) * 0.05 * this.constraints.humanize;
                return {
                    ...note,
                    time: Math.max(0, note.time + timingVariation),
                    velocity: Math.round(
                        note.velocity + (Math.random() - 0.5) * 10 * this.constraints.humanize
                    )
                };
            }
            
            return note;
        });
    }

    /**
     * Get randomization presets
     */
    static getPresets() {
        return [
            { 
                name: 'Simple Melody', 
                type: 'melody',
                constraints: { density: 0.4, maxInterval: 5, scaleLock: 'major' }
            },
            { 
                name: 'Complex Melody', 
                type: 'melody',
                constraints: { density: 0.6, maxInterval: 12, scaleLock: null, humanize: 0.3 }
            },
            { 
                name: 'Basic Drums', 
                type: 'drums',
                constraints: { density: 0.5, swingAmount: 0 }
            },
            { 
                name: 'Funky Drums', 
                type: 'drums',
                constraints: { density: 0.7, swingAmount: 0.5, humanize: 0.2 }
            },
            { 
                name: 'Simple Bass', 
                type: 'bass',
                constraints: { density: 0.6, scaleLock: 'minor' }
            },
            { 
                name: 'Walking Bass', 
                type: 'bass',
                constraints: { density: 0.9, maxInterval: 5, directionBias: 0.5 }
            },
            { 
                name: 'Pentatonic Solo', 
                type: 'melody',
                constraints: { density: 0.5, scaleLock: 'pentatonic major', maxInterval: 7 }
            },
            { 
                name: 'Blues Riff', 
                type: 'melody',
                constraints: { density: 0.6, scaleLock: 'blues', humanize: 0.2 }
            },
            { 
                name: 'Ambient Texture', 
                type: 'melody',
                constraints: { density: 0.2, humanize: 0.5, durationRange: { min: 1, max: 4 } }
            },
            { 
                name: 'Techno Pattern', 
                type: 'drums',
                constraints: { density: 0.8, swingAmount: 0, humanize: 0.1 }
            }
        ];
    }

    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const presets = PatternRandomizer.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            this.constraints = { ...this.constraints, ...preset.constraints };
            return preset.type;
        }
        
        return null;
    }

    /**
     * Generate random pattern by type
     */
    generate(type = 'melody', length = 4, stepsPerBeat = 4, options = {}) {
        switch (type) {
            case 'drums':
                return this.randomizeDrums(length, stepsPerBeat);
            case 'bass':
                return this.randomizeBass(length, stepsPerBeat, options.rootNote ?? 36);
            case 'melody':
            default:
                return this.randomizeMelody(length, stepsPerBeat);
        }
    }
}

// UI Panel for pattern randomizer
let patternRandomizerPanel = null;

export function openPatternRandomizerPanel(services = {}) {
    if (patternRandomizerPanel) {
        patternRandomizerPanel.remove();
    }
    
    const randomizer = new PatternRandomizer();
    let currentPattern = null;
    let currentType = 'melody';
    
    const panel = document.createElement('div');
    panel.className = 'snug-window pattern-randomizer-panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        max-height: 600px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div class="panel-header" style="
            padding: 12px 16px;
            background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <h3 style="margin: 0; color: #fff; font-size: 16px;">Pattern Randomizer</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        
        <div class="panel-content" style="padding: 16px; max-height: 500px; overflow-y: auto;">
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preset</label>
                    <select id="randomPreset" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="">-- Select Preset --</option>
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Type</label>
                    <select id="patternType" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="melody">Melody</option>
                        <option value="drums">Drums</option>
                        <option value="bass">Bass</option>
                    </select>
                </div>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Length (beats)</label>
                    <select id="patternLength" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="4" selected>4</option>
                        <option value="8">8</option>
                        <option value="16">16</option>
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Steps per Beat</label>
                    <select id="stepsPerBeat" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="4" selected>4</option>
                        <option value="8">8</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                    Density: <span id="densityValue">50%</span>
                </label>
                <input type="range" id="density" min="0.1" max="1" step="0.1" value="0.5" style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Scale Lock</label>
                <select id="scaleLock" style="
                    width: 100%;
                    background: #2a2a4e;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 6px;
                ">
                    <option value="">None (Chromatic)</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Swing: <span id="swingValue">0%</span>
                    </label>
                    <input type="range" id="swingAmount" min="0" max="1" step="0.1" value="0" style="width: 100%;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Humanize: <span id="humanizeValue">0%</span>
                    </label>
                    <input type="range" id="humanize" min="0" max="1" step="0.1" value="0" style="width: 100%;">
                </div>
            </div>
            
            <div id="previewSection" style="
                background: #0a0a1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
                min-height: 100px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa; font-size: 12px;">Preview (<span id="noteCount">0</span> notes)</span>
                    <button id="previewBtn" style="
                        background: #3a3a6e;
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        padding: 4px 12px;
                        cursor: pointer;
                        font-size: 12px;
                    ">▶ Preview</button>
                </div>
                <canvas id="previewCanvas" width="550" height="60" style="width: 100%; background: #050510;"></canvas>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="generateBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Generate</button>
                <button id="variationBtn" style="
                    background: linear-gradient(180deg, #00ff88 0%, #00aa55 100%);
                    color: #000;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Variation</button>
                <button id="applyBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                ">Apply to Track</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    patternRandomizerPanel = panel;
    
    // Populate presets and scales
    const presetSelect = panel.querySelector('#randomPreset');
    const scaleSelect = panel.querySelector('#scaleLock');
    
    PatternRandomizer.getPresets().forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    Object.keys(randomizer.scales).forEach(scale => {
        const option = document.createElement('option');
        option.value = scale;
        option.textContent = scale.charAt(0).toUpperCase() + scale.slice(1);
        scaleSelect.appendChild(option);
    });
    
    // Get elements
    const typeSelect = panel.querySelector('#patternType');
    const lengthSelect = panel.querySelector('#patternLength');
    const stepsSelect = panel.querySelector('#stepsPerBeat');
    const densityInput = panel.querySelector('#density');
    const densityValue = panel.querySelector('#densityValue');
    const swingInput = panel.querySelector('#swingAmount');
    const swingValue = panel.querySelector('#swingValue');
    const humanizeInput = panel.querySelector('#humanize');
    const humanizeValue = panel.querySelector('#humanizeValue');
    const noteCount = panel.querySelector('#noteCount');
    const canvas = panel.querySelector('#previewCanvas');
    const ctx = canvas.getContext('2d');
    
    // Draw preview
    const drawPreview = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!currentPattern || currentPattern.length === 0) {
            ctx.fillStyle = '#444';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click Generate to create a pattern', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // Find note range
        const minNote = Math.min(...currentPattern.map(n => n.noteNumber));
        const maxNote = Math.max(...currentPattern.map(n => n.noteNumber));
        const noteRange = maxNote - minNote + 1;
        
        // Draw notes
        currentPattern.forEach(note => {
            const x = (note.time / (parseInt(lengthSelect.value))) * canvas.width;
            const y = canvas.height - ((note.noteNumber - minNote + 1) / noteRange) * canvas.height;
            const width = Math.max(4, (note.duration / parseInt(lengthSelect.value)) * canvas.width);
            const height = Math.max(4, canvas.height / noteRange);
            
            // Color based on velocity
            const brightness = Math.round(100 + (note.velocity / 127) * 155);
            ctx.fillStyle = `hsl(210, 70%, ${brightness}%)`;
            ctx.fillRect(x, y - height / 2, width, height);
        });
        
        noteCount.textContent = currentPattern.length;
    };
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        patternRandomizerPanel = null;
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            const type = randomizer.applyPreset(presetSelect.value);
            if (type) {
                typeSelect.value = type;
                currentType = type;
                densityInput.value = randomizer.constraints.density;
                densityValue.textContent = `${Math.round(randomizer.constraints.density * 100)}%`;
                swingInput.value = randomizer.constraints.swingAmount;
                swingValue.textContent = `${Math.round(randomizer.constraints.swingAmount * 100)}%`;
                humanizeInput.value = randomizer.constraints.humanize;
                humanizeValue.textContent = `${Math.round(randomizer.constraints.humanize * 100)}%`;
                if (randomizer.constraints.scaleLock) {
                    scaleSelect.value = randomizer.constraints.scaleLock;
                }
            }
        }
    });
    
    typeSelect.addEventListener('change', () => {
        currentType = typeSelect.value;
    });
    
    densityInput.addEventListener('input', () => {
        const val = parseFloat(densityInput.value);
        randomizer.constraints.density = val;
        densityValue.textContent = `${Math.round(val * 100)}%`;
    });
    
    swingInput.addEventListener('input', () => {
        const val = parseFloat(swingInput.value);
        randomizer.constraints.swingAmount = val;
        swingValue.textContent = `${Math.round(val * 100)}%`;
    });
    
    humanizeInput.addEventListener('input', () => {
        const val = parseFloat(humanizeInput.value);
        randomizer.constraints.humanize = val;
        humanizeValue.textContent = `${Math.round(val * 100)}%`;
    });
    
    scaleSelect.addEventListener('change', () => {
        randomizer.constraints.scaleLock = scaleSelect.value || null;
    });
    
    // Generate button
    const generateBtn = panel.querySelector('#generateBtn');
    generateBtn.addEventListener('click', () => {
        const length = parseInt(lengthSelect.value);
        const stepsPerBeat = parseInt(stepsSelect.value);
        
        currentPattern = randomizer.generate(currentType, length, stepsPerBeat);
        drawPreview();
    });
    
    // Variation button
    const variationBtn = panel.querySelector('#variationBtn');
    variationBtn.addEventListener('click', () => {
        if (currentPattern) {
            currentPattern = randomizer.generateVariation(currentPattern, 0.5);
            drawPreview();
        } else {
            generateBtn.click();
        }
    });
    
    // Preview button
    const previewBtn = panel.querySelector('#previewBtn');
    previewBtn.addEventListener('click', () => {
        if (services.previewPattern && currentPattern) {
            services.previewPattern(currentPattern);
        }
    });
    
    // Apply button
    const applyBtn = panel.querySelector('#applyBtn');
    applyBtn.addEventListener('click', () => {
        if (services.applyPattern && currentPattern) {
            services.applyPattern(currentPattern);
        }
    });
    
    return panel;
}

export default PatternRandomizer;