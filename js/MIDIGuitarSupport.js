/**
 * MIDI Guitar Support - MIDI guitar input support
 * Provides support for guitar-to-MIDI converters and MIDI guitar controllers
 */

class MIDIGuitarSupport {
    constructor() {
        this.settings = {
            enabled: false,
            mode: 'polyphonic', // polyphonic, monophonic, bass
            pitchDetection: 'auto', // auto, fast, accurate
            latencyCompensation: 0, // ms
            sensitivity: 50, // %
            velocityTracking: true,
            bendRange: 2, // semitones
            fretNoise: false, // include fret noise detection
            stringSeparation: true, // detect individual strings
            tuningMode: 'standard', // standard, drop-d, open, custom
            customTuning: [64, 59, 55, 50, 45, 40], // E2-B3 standard
            pickAttack: true, // detect pick attack dynamics
            palmMuteDetection: false,
            harmonicsDetection: false,
            slideDetection: false,
            vibratoDetection: true,
            autoOctave: false // auto-transpose to guitar range
        };
        
        this.tunings = {
            'standard': [64, 59, 55, 50, 45, 40], // E4, B3, G3, D3, A2, E2
            'drop-d': [64, 59, 55, 50, 45, 38], // E4, B3, G3, D3, A2, D2
            'open-g': [62, 59, 55, 50, 43, 38], // D4, B3, G3, D3, G2, D2
            'open-d': [62, 57, 54, 50, 45, 38], // D4, A3, F#3, D3, A2, D2
            'dadgad': [62, 57, 55, 50, 45, 38], // D4, A3, G3, D3, A2, D2
            'open-e': [64, 59, 56, 52, 47, 40], // E4, B3, G#3, E3, B2, E2
            'bass-4': [43, 38, 33, 28], // G2, D2, A1, E1
            'bass-5': [43, 38, 33, 28, 23], // G2, D2, A1, E1, B0
            'bass-6': [48, 43, 38, 33, 28, 23] // C3, G2, D2, A1, E1, B0
        };
        
        this.stringRanges = {
            'standard': [
                { string: 1, min: 64, max: 96 }, // High E
                { string: 2, min: 59, max: 91 }, // B
                { string: 3, min: 55, max: 87 }, // G
                { string: 4, min: 50, max: 82 }, // D
                { string: 5, min: 45, max: 77 }, // A
                { string: 6, min: 40, max: 72 }  // Low E
            ]
        };
        
        this.detection = {
            lastNoteTime: 0,
            lastNote: null,
            activeNotes: [],
            pitchHistory: [],
            velocityHistory: [],
            bendHistory: []
        };
        
        this.callbacks = {
            onNote: null,
            onBend: null,
            onPalmMute: null,
            onHarmonic: null,
            onSlide: null,
            onVibrato: null
        };
        
        this.audioContext = null;
        this.analyser = null;
        this.inputStream = null;
        this.inputNode = null;
        
        this.init();
    }
    
    init() {
        console.log('[MIDIGuitarSupport] Initialized');
    }
    
    // Enable guitar MIDI mode
    enable() {
        this.settings.enabled = true;
        console.log('[MIDIGuitarSupport] Enabled');
        
        // Start pitch detection if audio context available
        this.startPitchDetection();
    }
    
    // Disable guitar MIDI mode
    disable() {
        this.settings.enabled = false;
        this.stopPitchDetection();
        console.log('[MIDIGuitarSupport] Disabled');
    }
    
    // Set tuning
    setTuning(tuningName) {
        if (this.tunings[tuningName]) {
            this.settings.tuningMode = tuningName;
            this.settings.customTuning = [...this.tunings[tuningName]];
            console.log('[MIDIGuitarSupport] Tuning set to:', tuningName);
            return true;
        }
        return false;
    }
    
    // Set custom tuning
    setCustomTuning(pitches) {
        this.settings.tuningMode = 'custom';
        this.settings.customTuning = [...pitches];
        console.log('[MIDIGuitarSupport] Custom tuning set:', pitches);
    }
    
    // Get string for note
    getStringForNote(note) {
        const tuning = this.settings.customTuning;
        const ranges = this.stringRanges['standard'];
        
        for (const range of ranges) {
            if (note >= range.min && note <= range.max) {
                // Check if note is in optimal range for this string
                const stringOpen = tuning[range.string - 1];
                const fret = note - stringOpen;
                
                if (fret >= 0 && fret <= 24) {
                    return {
                        string: range.string,
                        fret: fret,
                        openPitch: stringOpen
                    };
                }
            }
        }
        
        return null;
    }
    
    // Process audio input for pitch detection
    startPitchDetection() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create analyser
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 4096;
        
        console.log('[MIDIGuitarSupport] Pitch detection started');
        
        // Start detection loop
        this.detectionLoop();
    }
    
    // Stop pitch detection
    stopPitchDetection() {
        if (this.inputStream) {
            this.inputStream.getTracks().forEach(track => track.stop());
        }
        if (this.inputNode) {
            this.inputNode.disconnect();
        }
        console.log('[MIDIGuitarSupport] Pitch detection stopped');
    }
    
    // Detection loop
    detectionLoop() {
        if (!this.settings.enabled) return;
        
        // This would normally process audio data
        // For now, it's a placeholder for actual pitch detection
        
        requestAnimationFrame(() => this.detectionLoop());
    }
    
    // Process MIDI input from guitar controller
    processMIDIInput(message) {
        if (!this.settings.enabled) return;
        
        const [status, data1, data2] = message;
        const command = status & 0xf0;
        
        switch (command) {
            case 0x90: // Note On
                this.handleNoteOn(data1, data2);
                break;
            case 0x80: // Note Off
                this.handleNoteOff(data1, data2);
                break;
            case 0xe0: // Pitch Bend
                this.handlePitchBend(data1, data2);
                break;
            case 0xb0: // Control Change
                this.handleControlChange(data1, data2);
                break;
        }
    }
    
    // Handle note on
    handleNoteOn(note, velocity) {
        // Get string/fret information
        const stringInfo = this.getStringForNote(note);
        
        // Apply velocity tracking
        let adjustedVelocity = velocity;
        if (this.settings.velocityTracking) {
            adjustedVelocity = this.trackVelocity(velocity);
        }
        
        // Auto-octave if needed
        if (this.settings.autoOctave) {
            while (note > 84) note -= 12;
            while (note < 40) note += 12;
        }
        
        // Add to active notes
        this.detection.activeNotes.push({
            note,
            velocity: adjustedVelocity,
            string: stringInfo?.string,
            fret: stringInfo?.fret,
            time: Date.now()
        });
        
        // Trigger callback
        if (this.callbacks.onNote) {
            this.callbacks.onNote({
                type: 'on',
                note,
                velocity: adjustedVelocity,
                string: stringInfo?.string,
                fret: stringInfo?.fret
            });
        }
        
        console.log('[MIDIGuitarSupport] Note On:', note, 'velocity:', adjustedVelocity);
    }
    
    // Handle note off
    handleNoteOff(note, velocity) {
        // Remove from active notes
        this.detection.activeNotes = this.detection.activeNotes.filter(n => n.note !== note);
        
        // Trigger callback
        if (this.callbacks.onNote) {
            this.callbacks.onNote({
                type: 'off',
                note,
                velocity: 0
            });
        }
        
        console.log('[MIDIGuitarSupport] Note Off:', note);
    }
    
    // Handle pitch bend
    handlePitchBend(lsb, msb) {
        const bendValue = (msb << 7) | lsb;
        const bendRange = this.settings.bendRange;
        
        // Convert to semitones (-bendRange to +bendRange)
        const semitones = ((bendValue - 8192) / 8192) * bendRange;
        
        // Store in history
        this.detection.bendHistory.push({
            value: semitones,
            time: Date.now()
        });
        
        // Keep history manageable
        if (this.detection.bendHistory.length > 100) {
            this.detection.bendHistory.shift();
        }
        
        // Detect vibrato
        if (this.settings.vibratoDetection) {
            this.detectVibrato();
        }
        
        // Trigger callback
        if (this.callbacks.onBend) {
            this.callbacks.onBend({
                semitones,
                bendValue
            });
        }
    }
    
    // Handle control change
    handleControlChange(controller, value) {
        // Common guitar MIDI controllers
        switch (controller) {
            case 1: // Modulation wheel - often used for vibrato depth
                break;
            case 11: // Expression
                break;
            case 64: // Sustain pedal
                break;
            case 65: // Portamento
                break;
        }
    }
    
    // Track velocity for dynamics
    trackVelocity(velocity) {
        this.detection.velocityHistory.push(velocity);
        
        if (this.detection.velocityHistory.length > 10) {
            this.detection.velocityHistory.shift();
        }
        
        // Apply pick attack dynamics
        if (this.settings.pickAttack) {
            const avgVelocity = this.detection.velocityHistory.reduce((a, b) => a + b, 0) / this.detection.velocityHistory.length;
            const delta = velocity - avgVelocity;
            
            // Enhance dynamics
            if (Math.abs(delta) > 20) {
                velocity = Math.min(127, Math.max(1, velocity + (delta * 0.3)));
            }
        }
        
        return velocity;
    }
    
    // Detect vibrato from pitch bend history
    detectVibrato() {
        const history = this.detection.bendHistory;
        if (history.length < 10) return false;
        
        // Look for oscillation pattern
        const recent = history.slice(-10);
        let crossings = 0;
        
        for (let i = 1; i < recent.length; i++) {
            if ((recent[i].value >= 0 && recent[i-1].value < 0) ||
                (recent[i].value < 0 && recent[i-1].value >= 0)) {
                crossings++;
            }
        }
        
        // If 3+ zero crossings in 10 samples, likely vibrato
        if (crossings >= 3) {
            if (this.callbacks.onVibrato) {
                this.callbacks.onVibrato({
                    rate: crossings / 10,
                    depth: Math.max(...recent.map(r => Math.abs(r.value)))
                });
            }
            return true;
        }
        
        return false;
    }
    
    // Detect palm mute (simplified - would need audio analysis)
    detectPalmMute() {
        // This would analyze audio for muted high frequencies
        return false;
    }
    
    // Detect harmonics (simplified)
    detectHarmonics(note) {
        // Harmonics are typically at 12, 7, 5, 4, 3 frets
        const stringInfo = this.getStringForNote(note);
        if (!stringInfo) return false;
        
        const harmonicFrets = [12, 7, 5, 4, 3, 2.4, 2, 1.8];
        const fret = stringInfo.fret;
        
        const isHarmonic = harmonicFrets.some(h => Math.abs(fret - h) < 0.5);
        
        if (isHarmonic && this.callbacks.onHarmonic) {
            this.callbacks.onHarmonic({
                note,
                string: stringInfo.string,
                fret
            });
        }
        
        return isHarmonic;
    }
    
    // Set callback
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }
    
    // Convert fret position to MIDI note
    fretToNote(string, fret) {
        const tuning = this.settings.customTuning;
        if (string < 1 || string > tuning.length) return null;
        
        return tuning[string - 1] + fret;
    }
    
    // Convert MIDI note to fret position
    noteToFret(note) {
        return this.getStringForNote(note);
    }
    
    // Get current tuning
    getCurrentTuning() {
        return {
            name: this.settings.tuningMode,
            pitches: [...this.settings.customTuning]
        };
    }
    
    // Get all available tunings
    getAvailableTunings() {
        return Object.entries(this.tunings).map(([name, pitches]) => ({
            name,
            pitches: [...pitches]
        }));
    }
    
    // Update settings
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        console.log('[MIDIGuitarSupport] Settings updated');
    }
    
    // Get settings
    getSettings() {
        return { ...this.settings };
    }
    
    // Get active notes
    getActiveNotes() {
        return [...this.detection.activeNotes];
    }
    
    // Connect to audio input
    async connectAudioInput() {
        try {
            this.inputStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            this.inputNode = this.audioContext.createMediaStreamSource(this.inputStream);
            this.inputNode.connect(this.analyser);
            
            console.log('[MIDIGuitarSupport] Audio input connected');
            return true;
        } catch (error) {
            console.error('[MIDIGuitarSupport] Failed to connect audio input:', error);
            return false;
        }
    }
}

// UI Panel function
function openMIDIGuitarPanel() {
    const existing = document.getElementById('midi-guitar-panel');
    if (existing) {
        existing.remove();
    }
    
    const support = window.midiGuitarSupport || new MIDIGuitarSupport();
    window.midiGuitarSupport = support;
    
    const panel = document.createElement('div');
    panel.id = 'midi-guitar-panel';
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
    
    const settings = support.getSettings();
    const tunings = support.getAvailableTunings();
    const currentTuning = support.getCurrentTuning();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 20px;">🎸 MIDI Guitar Support</h2>
            <button id="close-midi-guitar" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input type="checkbox" id="guitar-enabled" ${settings.enabled ? 'checked' : ''} style="width: 24px; height: 24px;">
                <span style="color: #fff; font-size: 16px;">Enable MIDI Guitar Mode</span>
            </label>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Tuning</label>
                <select id="guitar-tuning" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    ${tunings.map(t => `<option value="${t.name}" ${t.name === currentTuning.name ? 'selected' : ''}>${t.name.toUpperCase()}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Mode</label>
                <select id="guitar-mode" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="polyphonic" ${settings.mode === 'polyphonic' ? 'selected' : ''}>Polyphonic</option>
                    <option value="monophonic" ${settings.mode === 'monophonic' ? 'selected' : ''}>Monophonic</option>
                    <option value="bass" ${settings.mode === 'bass' ? 'selected' : ''}>Bass</option>
                </select>
            </div>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 16px; color: #fff; font-size: 14px;">Current Tuning</h3>
            <div style="display: flex; gap: 8px; justify-content: center;">
                ${currentTuning.pitches.map((p, i) => {
                    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                    const noteName = noteNames[p % 12];
                    const octave = Math.floor(p / 12) - 1;
                    const stringNum = currentTuning.pitches.length - i;
                    return `
                        <div style="background: #1a1a2e; border-radius: 4px; padding: 8px 12px; text-align: center;">
                            <div style="color: #888; font-size: 10px;">String ${stringNum}</div>
                            <div style="color: #10b981; font-size: 16px; font-weight: bold;">${noteName}${octave}</div>
                            <div style="color: #666; font-size: 10px;">MIDI ${p}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px; color: #fff; font-size: 14px;">Detection Settings</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="velocity-tracking" ${settings.velocityTracking ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Velocity Tracking
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="pick-attack" ${settings.pickAttack ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Pick Attack Detection
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="vibrato-detection" ${settings.vibratoDetection ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Vibrato Detection
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="string-separation" ${settings.stringSeparation ? 'checked' : ''} style="width: 16px; height: 16px;">
                    String Separation
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="palm-mute" ${settings.palmMuteDetection ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Palm Mute Detection
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="harmonics" ${settings.harmonicsDetection ? 'checked' : ''} style="width: 16px; height: 16px;">
                    Harmonics Detection
                </label>
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Bend Range (semitones)</label>
            <input type="range" id="bend-range" min="1" max="24" value="${settings.bendRange}" style="width: 100%;">
            <span style="color: #10b981;">${settings.bendRange} semitones</span>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Sensitivity</label>
            <input type="range" id="sensitivity" min="0" max="100" value="${settings.sensitivity}" style="width: 100%;">
            <span style="color: #10b981;">${settings.sensitivity}%</span>
        </div>
        
        <div style="display: flex; gap: 12px;">
            <button id="connect-audio-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Connect Audio Input
            </button>
            <button id="test-guitar-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Test Mode
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-midi-guitar').onclick = () => panel.remove();
    
    document.getElementById('guitar-enabled').onchange = (e) => {
        if (e.target.checked) {
            support.enable();
        } else {
            support.disable();
        }
    };
    
    document.getElementById('guitar-tuning').onchange = (e) => {
        support.setTuning(e.target.value);
        // Refresh panel to show new tuning
        panel.remove();
        openMIDIGuitarPanel();
    };
    
    document.getElementById('guitar-mode').onchange = (e) => {
        support.updateSettings({ mode: e.target.value });
    };
    
    // Detection settings
    ['velocity-tracking', 'pick-attack', 'vibrato-detection', 'string-separation', 'palm-mute', 'harmonics'].forEach(id => {
        document.getElementById(id).onchange = (e) => {
            const key = id.split('-').map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('');
            support.updateSettings({ [key]: e.target.checked });
        };
    });
    
    // Range inputs
    document.getElementById('bend-range').oninput = (e) => {
        support.updateSettings({ bendRange: parseInt(e.target.value) });
        e.target.nextElementSibling.textContent = `${e.target.value} semitones`;
    };
    
    document.getElementById('sensitivity').oninput = (e) => {
        support.updateSettings({ sensitivity: parseInt(e.target.value) });
        e.target.nextElementSibling.textContent = `${e.target.value}%`;
    };
    
    // Buttons
    document.getElementById('connect-audio-btn').onclick = async () => {
        const success = await support.connectAudioInput();
        if (success) {
            alert('Audio input connected successfully');
        } else {
            alert('Failed to connect audio input');
        }
    };
    
    document.getElementById('test-guitar-btn').onclick = () => {
        // Simulate guitar input
        const testNotes = [40, 45, 50, 55, 59, 64]; // E2 to E4
        testNotes.forEach((note, i) => {
            setTimeout(() => {
                support.handleNoteOn(note, 100);
                setTimeout(() => support.handleNoteOff(note, 0), 500);
            }, i * 600);
        });
        alert('Playing test notes E2 to E4');
    };
    
    return support;
}

// Initialize
function initMIDIGuitarSupport() {
    if (!window.midiGuitarSupport) {
        window.midiGuitarSupport = new MIDIGuitarSupport();
    }
    return window.midiGuitarSupport;
}

// Export
window.MIDIGuitarSupport = MIDIGuitarSupport;
window.midiGuitarSupport = new MIDIGuitarSupport();
window.openMIDIGuitarPanel = openMIDIGuitarPanel;
window.initMIDIGuitarSupport = initMIDIGuitarSupport;