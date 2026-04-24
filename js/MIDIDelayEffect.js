/**
 * MIDI Delay Effect
 * MIDI delay/echo effect for patterns with timing and velocity control
 */

export class MIDIDelayEffect {
    constructor() {
        this.time = 0.25; // Delay time in beats
        this.feedback = 0.5; // Amount of feedback (0-1)
        this.dry = 1; // Dry signal level
        this.wet = 0.7; // Wet signal level
        this.pitchShift = 0; // Transpose each repeat in semitones
        this.velocityDecay = 0.8; // Velocity multiplier per repeat
        this.repeats = 4; // Number of repeats
        this.pingPong = false; // Alternate pan for each repeat
        this.swingAmount = 0; // Add swing to repeats
        this.randomizeVelocity = 0; // Random velocity variation
    }

    /**
     * Get built-in presets
     */
    static getPresets() {
        return [
            { name: 'Simple Echo', time: 0.5, feedback: 0.4, repeats: 3, velocityDecay: 0.7 },
            { name: 'Quarter Note', time: 1, feedback: 0.5, repeats: 4, velocityDecay: 0.8 },
            { name: 'Eighth Note', time: 0.5, feedback: 0.5, repeats: 4, velocityDecay: 0.8 },
            { name: 'Sixteenth Note', time: 0.25, feedback: 0.4, repeats: 5, velocityDecay: 0.75 },
            { name: 'Dotted Eighth', time: 0.75, feedback: 0.5, repeats: 4, velocityDecay: 0.8 },
            { name: 'Triplet', time: 0.333, feedback: 0.5, repeats: 4, velocityDecay: 0.8 },
            { name: 'Ping Pong', time: 0.5, feedback: 0.5, repeats: 4, velocityDecay: 0.8, pingPong: true },
            { name: 'Harmony', time: 0.5, feedback: 0.4, repeats: 4, velocityDecay: 0.85, pitchShift: 3 },
            { name: 'Octave Echo', time: 0.75, feedback: 0.4, repeats: 3, velocityDecay: 0.85, pitchShift: 12 },
            { name: 'Cascading', time: 0.333, feedback: 0.35, repeats: 6, velocityDecay: 0.7 },
            { name: 'Dub Style', time: 0.5, feedback: 0.6, repeats: 8, velocityDecay: 0.9 },
            { name: 'Ambient', time: 2, feedback: 0.3, repeats: 2, velocityDecay: 0.95 },
            { name: 'Rhythmic', time: 0.25, feedback: 0.3, repeats: 3, velocityDecay: 0.6 },
            { name: 'Arpeggiator', time: 0.125, feedback: 0.4, repeats: 5, velocityDecay: 0.85, pitchShift: 5 },
            { name: 'Long Tail', time: 0.5, feedback: 0.7, repeats: 10, velocityDecay: 0.95 }
        ];
    }

    /**
     * Apply delay to MIDI notes
     */
    apply(notes) {
        if (!notes || notes.length === 0) return [];
        
        const result = [];
        
        // Add dry signal (original notes)
        notes.forEach(note => {
            if (this.dry > 0) {
                result.push({
                    ...note,
                    velocity: Math.round(note.velocity * this.dry),
                    _original: true
                });
            }
        });
        
        // Generate repeats
        for (let repeat = 1; repeat <= this.repeats; repeat++) {
            const repeatVelocity = Math.pow(this.velocityDecay, repeat);
            const repeatPitch = this.pitchShift * repeat;
            const repeatTime = this.time * repeat;
            
            // Apply swing to repeats
            let swingOffset = 0;
            if (this.swingAmount > 0) {
                swingOffset = this.swingAmount * 0.1 * (repeat % 2 === 1 ? 1 : -1);
            }
            
            notes.forEach(note => {
                // Calculate new velocity with decay and randomization
                let velocity = note.velocity * repeatVelocity * this.wet;
                
                if (this.randomizeVelocity > 0) {
                    const randomAmount = (Math.random() - 0.5) * this.randomizeVelocity;
                    velocity *= (1 + randomAmount);
                }
                
                velocity = Math.round(Math.max(1, Math.min(127, velocity)));
                
                if (velocity < 5) return; // Skip very quiet notes
                
                const newNote = {
                    noteNumber: Math.max(0, Math.min(127, note.noteNumber + repeatPitch)),
                    time: note.time + repeatTime + swingOffset,
                    duration: note.duration,
                    velocity: velocity,
                    _delayed: true,
                    _repeat: repeat
                };
                
                // Ping pong pan
                if (this.pingPong) {
                    newNote.pan = repeat % 2 === 0 ? -0.5 : 0.5;
                }
                
                result.push(newNote);
            });
        }
        
        // Sort by time
        result.sort((a, b) => a.time - b.time);
        
        return result;
    }

    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const presets = MIDIDelayEffect.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            Object.assign(this, preset);
            return true;
        }
        
        return false;
    }

    /**
     * Set delay time in beats
     */
    setTime(beats) {
        this.time = Math.max(0.01, Math.min(4, beats));
    }

    /**
     * Set feedback (0-1)
     */
    setFeedback(value) {
        this.feedback = Math.max(0, Math.min(1, value));
    }

    /**
     * Set number of repeats
     */
    setRepeats(count) {
        this.repeats = Math.max(1, Math.min(20, count));
    }

    /**
     * Sync delay time to tempo
     */
    syncToTempo(tempo, division = 'quarter') {
        const divisions = {
            'whole': 4,
            'half': 2,
            'quarter': 1,
            'eighth': 0.5,
            'sixteenth': 0.25,
            'thirtysecond': 0.125,
            'dotted_half': 3,
            'dotted_quarter': 1.5,
            'dotted_eighth': 0.75,
            'triplet_quarter': 2/3,
            'triplet_eighth': 1/3,
            'triplet_sixteenth': 1/6
        };
        
        if (divisions[division]) {
            const beatDuration = 60 / tempo; // seconds per beat
            this.time = divisions[division];
        }
    }

    /**
     * Get delay time in seconds for a given tempo
     */
    getDelaySeconds(tempo) {
        const beatDuration = 60 / tempo;
        return this.time * beatDuration;
    }

    /**
     * Export settings
     */
    exportSettings() {
        return {
            time: this.time,
            feedback: this.feedback,
            dry: this.dry,
            wet: this.wet,
            pitchShift: this.pitchShift,
            velocityDecay: this.velocityDecay,
            repeats: this.repeats,
            pingPong: this.pingPong,
            swingAmount: this.swingAmount,
            randomizeVelocity: this.randomizeVelocity
        };
    }

    /**
     * Import settings
     */
    importSettings(settings) {
        Object.assign(this, settings);
    }
}

// UI Panel for MIDI delay
let midiDelayPanel = null;

export function openMIDIDelayEffectPanel(services = {}) {
    if (midiDelayPanel) {
        midiDelayPanel.remove();
    }
    
    const delay = new MIDIDelayEffect();
    
    const panel = document.createElement('div');
    panel.className = 'snug-window midi-delay-panel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        width: 500px;
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
            <h3 style="margin: 0; color: #fff; font-size: 16px;">MIDI Delay Effect</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        
        <div class="panel-content" style="padding: 16px;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preset</label>
                <select id="delayPreset" style="
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
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Time (beats): <span id="timeValue">0.25</span>
                    </label>
                    <input type="range" id="delayTime" min="0.0625" max="4" step="0.0625" value="0.25" style="width: 100%;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Repeats: <span id="repeatsValue">4</span>
                    </label>
                    <input type="range" id="repeats" min="1" max="20" step="1" value="4" style="width: 100%;">
                </div>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Dry: <span id="dryValue">100%</span>
                    </label>
                    <input type="range" id="dry" min="0" max="1" step="0.1" value="1" style="width: 100%;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Wet: <span id="wetValue">70%</span>
                    </label>
                    <input type="range" id="wet" min="0" max="1" step="0.1" value="0.7" style="width: 100%;">
                </div>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Velocity Decay: <span id="velDecayValue">80%</span>
                    </label>
                    <input type="range" id="velDecay" min="0.1" max="1" step="0.05" value="0.8" style="width: 100%;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                        Pitch Shift: <span id="pitchValue">0</span> st
                    </label>
                    <input type="range" id="pitchShift" min="-24" max="24" step="1" value="0" style="width: 100%;">
                </div>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px; align-items: center;">
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 12px;">
                    <input type="checkbox" id="pingPong" style="accent-color: #4a9eff;">
                    Ping Pong
                </label>
            </div>
            
            <div id="previewSection" style="
                background: #0a0a1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa; font-size: 12px;">Preview</span>
                    <span id="noteCount" style="color: #fff; font-size: 12px;">Original: 1 → Total: 5</span>
                </div>
                <canvas id="previewCanvas" width="450" height="50" style="width: 100%; background: #050510;"></canvas>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="previewBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Preview</button>
                <button id="applyBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Apply to Selection</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    midiDelayPanel = panel;
    
    // Populate presets
    const presetSelect = panel.querySelector('#delayPreset');
    MIDIDelayEffect.getPresets().forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    // Get elements
    const timeInput = panel.querySelector('#delayTime');
    const timeValue = panel.querySelector('#timeValue');
    const repeatsInput = panel.querySelector('#repeats');
    const repeatsValue = panel.querySelector('#repeatsValue');
    const dryInput = panel.querySelector('#dry');
    const dryValue = panel.querySelector('#dryValue');
    const wetInput = panel.querySelector('#wet');
    const wetValue = panel.querySelector('#wetValue');
    const velDecayInput = panel.querySelector('#velDecay');
    const velDecayValue = panel.querySelector('#velDecayValue');
    const pitchInput = panel.querySelector('#pitchShift');
    const pitchValue = panel.querySelector('#pitchValue');
    const pingPongCheck = panel.querySelector('#pingPong');
    const canvas = panel.querySelector('#previewCanvas');
    const ctx = canvas.getContext('2d');
    const noteCountSpan = panel.querySelector('#noteCount');
    
    // Draw preview
    const drawPreview = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Demo note
        const demoNote = { noteNumber: 60, time: 0, velocity: 100 };
        const delayedNotes = delay.apply([demoNote]);
        
        noteCountSpan.textContent = `Original: 1 → Total: ${delayedNotes.length}`;
        
        const totalBars = 4;
        
        delayedNotes.forEach(note => {
            const x = (note.time / totalBars) * canvas.width;
            const y = canvas.height / 2 - (note.noteNumber - 60) * 2;
            const width = 4;
            const height = Math.max(4, (note.velocity / 127) * 20);
            
            ctx.fillStyle = note._original ? '#4a9eff' : 
                            (note._repeat % 2 === 0 ? '#00ff88' : '#ffaa00');
            ctx.fillRect(x, y - height / 2, width, height);
        });
    };
    
    // Update function
    const updateDelay = () => {
        delay.time = parseFloat(timeInput.value);
        delay.repeats = parseInt(repeatsInput.value);
        delay.dry = parseFloat(dryInput.value);
        delay.wet = parseFloat(wetInput.value);
        delay.velocityDecay = parseFloat(velDecayInput.value);
        delay.pitchShift = parseInt(pitchInput.value);
        delay.pingPong = pingPongCheck.checked;
        
        timeValue.textContent = delay.time.toFixed(2);
        repeatsValue.textContent = delay.repeats;
        dryValue.textContent = `${Math.round(delay.dry * 100)}%`;
        wetValue.textContent = `${Math.round(delay.wet * 100)}%`;
        velDecayValue.textContent = `${Math.round(delay.velocityDecay * 100)}%`;
        pitchValue.textContent = delay.pitchShift;
        
        drawPreview();
    };
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        midiDelayPanel = null;
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            delay.applyPreset(presetSelect.value);
            timeInput.value = delay.time;
            repeatsInput.value = delay.repeats;
            dryInput.value = delay.dry;
            wetInput.value = delay.wet;
            velDecayInput.value = delay.velocityDecay;
            pitchInput.value = delay.pitchShift;
            pingPongCheck.checked = delay.pingPong;
            updateDelay();
        }
    });
    
    timeInput.addEventListener('input', updateDelay);
    repeatsInput.addEventListener('input', updateDelay);
    dryInput.addEventListener('input', updateDelay);
    wetInput.addEventListener('input', updateDelay);
    velDecayInput.addEventListener('input', updateDelay);
    pitchInput.addEventListener('input', updateDelay);
    pingPongCheck.addEventListener('change', updateDelay);
    
    // Apply button
    const applyBtn = panel.querySelector('#applyBtn');
    applyBtn.addEventListener('click', () => {
        if (services.getSelectedNotes) {
            const notes = services.getSelectedNotes();
            const delayedNotes = delay.apply(notes);
            
            if (services.applyDelayedNotes) {
                services.applyDelayedNotes(delayedNotes);
            }
        }
    });
    
    // Preview button
    const previewBtn = panel.querySelector('#previewBtn');
    previewBtn.addEventListener('click', () => {
        if (services.previewNotes) {
            const demoNote = { noteNumber: 60, time: 0, velocity: 100, duration: 0.5 };
            const delayedNotes = delay.apply([demoNote]);
            services.previewNotes(delayedNotes);
        }
    });
    
    // Initial draw
    drawPreview();
    
    return panel;
}

export default MIDIDelayEffect;