/**
 * Harmonic Synthesizer - Add harmonics to audio for thickness and presence
 * Provides harmonic generation with multiple synthesis modes
 */

class HarmonicSynthesizer {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Configuration
        this.mode = options.mode || 'even'; // even, odd, sub, all
        this.depth = options.depth || 0.5;
        this.tone = options.tone || 0.5;
        this.mix = options.mix || 0.3;
        
        // Analysis setup
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        // Harmonic oscillators
        this.oscillators = [];
        this.oscillatorGains = [];
        this.harmonicCount = options.harmonicCount || 8;
        
        // Create harmonic generators
        this.createHarmonicGenerators();
        
        // Connect dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        this.dryGain.gain.value = 1 - this.mix;
        
        // Connect wet path
        this.input.connect(this.analyser);
        this.wetGain.connect(this.output);
        this.wetGain.gain.value = this.mix;
        
        // Frequency tracking
        this.detectedFrequency = 440;
        this.pitchDetectionInterval = null;
        
        // Presets
        this.presets = {
            'Subtle Warmth': {
                mode: 'even',
                depth: 0.3,
                tone: 0.6,
                mix: 0.15,
                harmonics: [0.5, 0.3, 0.15, 0.08, 0.04, 0.02, 0.01, 0.005]
            },
            'Bright Presence': {
                mode: 'odd',
                depth: 0.5,
                tone: 0.8,
                mix: 0.25,
                harmonics: [0.1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005]
            },
            'Thick Bass': {
                mode: 'sub',
                depth: 0.7,
                tone: 0.3,
                mix: 0.4,
                harmonics: [1, 0.8, 0.5, 0.3, 0.15, 0.08, 0.04, 0.02]
            },
            'Rich Harmonics': {
                mode: 'all',
                depth: 0.6,
                tone: 0.5,
                mix: 0.35,
                harmonics: [0.5, 0.4, 0.35, 0.25, 0.2, 0.15, 0.1, 0.08]
            },
            'Exciter': {
                mode: 'odd',
                depth: 0.4,
                tone: 0.9,
                mix: 0.2,
                harmonics: [0.05, 0.1, 0.5, 0.3, 0.15, 0.1, 0.05, 0.03]
            },
            'Organ Tone': {
                mode: 'all',
                depth: 0.8,
                tone: 0.5,
                mix: 0.5,
                harmonics: [1, 0.5, 0.75, 0.25, 0.6, 0.15, 0.4, 0.1]
            },
            'Synth Pad': {
                mode: 'even',
                depth: 0.5,
                tone: 0.4,
                mix: 0.3,
                harmonics: [0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1]
            },
            'Glassy': {
                mode: 'odd',
                depth: 0.3,
                tone: 0.95,
                mix: 0.15,
                harmonics: [0.1, 0.2, 0.4, 0.6, 0.5, 0.3, 0.15, 0.05]
            }
        };
        
        this.harmonicLevels = [0.5, 0.3, 0.15, 0.08, 0.04, 0.02, 0.01, 0.005];
    }
    
    createHarmonicGenerators() {
        for (let i = 0; i < this.harmonicCount; i++) {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 440 * (i + 1);
            
            const gain = this.audioContext.createGain();
            gain.gain.value = 0;
            
            // Create envelope follower for dynamic response
            const envelope = this.audioContext.createGain();
            envelope.gain.value = 1;
            
            osc.connect(gain);
            gain.connect(envelope);
            envelope.connect(this.wetGain);
            
            this.oscillators.push(osc);
            this.oscillatorGains.push({ gain, envelope, oscillator: osc });
            
            osc.start();
        }
    }
    
    setMode(mode) {
        this.mode = mode;
        this.updateHarmonics();
    }
    
    setDepth(depth) {
        this.depth = Math.max(0, Math.min(1, depth));
        this.updateHarmonics();
    }
    
    setTone(tone) {
        this.tone = Math.max(0, Math.min(1, tone));
        this.updateHarmonics();
    }
    
    setMix(mix) {
        this.mix = Math.max(0, Math.min(1, mix));
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    setHarmonicLevel(index, level) {
        if (index >= 0 && index < this.harmonicCount) {
            this.harmonicLevels[index] = Math.max(0, Math.min(1, level));
            this.updateHarmonics();
        }
    }
    
    updateHarmonics() {
        for (let i = 0; i < this.harmonicCount; i++) {
            let level = this.harmonicLevels[i] * this.depth;
            
            // Apply mode filtering
            const harmonicNumber = i + 1;
            
            if (this.mode === 'even' && harmonicNumber % 2 !== 0) {
                level *= 0.1; // Reduce odd harmonics
            } else if (this.mode === 'odd' && harmonicNumber % 2 === 0) {
                level *= 0.1; // Reduce even harmonics
            } else if (this.mode === 'sub' && harmonicNumber > 3) {
                level *= 0.2; // Emphasize lower harmonics
            }
            
            // Apply tone filtering (tone affects high frequency rolloff)
            const toneFactor = Math.pow(this.tone, i * 0.3);
            level *= toneFactor;
            
            this.oscillatorGains[i].gain.gain.setTargetAtTime(level, this.audioContext.currentTime, 0.05);
        }
    }
    
    setBaseFrequency(frequency) {
        this.detectedFrequency = frequency;
        for (let i = 0; i < this.harmonicCount; i++) {
            const harmonicFreq = frequency * (i + 1);
            // Clamp to valid frequency range
            const clampedFreq = Math.max(20, Math.min(20000, harmonicFreq));
            this.oscillators[i].frequency.setTargetAtTime(clampedFreq, this.audioContext.currentTime, 0.01);
        }
    }
    
    startPitchDetection() {
        const bufferLength = this.analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        
        this.pitchDetectionInterval = setInterval(() => {
            this.analyser.getFloatTimeDomainData(dataArray);
            
            // Simple autocorrelation for pitch detection
            const frequency = this.detectPitch(dataArray);
            if (frequency > 50 && frequency < 2000) {
                this.setBaseFrequency(frequency);
            }
        }, 50);
    }
    
    detectPitch(buffer) {
        // Autocorrelation-based pitch detection
        const sampleRate = this.audioContext.sampleRate;
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;
        let foundGoodCorrelation = false;
        
        // Calculate RMS
        for (let i = 0; i < SIZE; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / SIZE);
        
        if (rms < 0.01) return -1; // Not enough signal
        
        let lastCorrelation = 1;
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            
            if (correlation > 0.9 && correlation > lastCorrelation) {
                foundGoodCorrelation = true;
                if (correlation > bestCorrelation) {
                    bestCorrelation = correlation;
                    bestOffset = offset;
                }
            } else if (foundGoodCorrelation) {
                const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
                return sampleRate / (bestOffset + (shift * 0.5));
            }
            lastCorrelation = correlation;
        }
        
        if (bestCorrelation > 0.01) {
            return sampleRate / bestOffset;
        }
        return -1;
    }
    
    stopPitchDetection() {
        if (this.pitchDetectionInterval) {
            clearInterval(this.pitchDetectionInterval);
            this.pitchDetectionInterval = null;
        }
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;
        
        this.mode = preset.mode;
        this.depth = preset.depth;
        this.tone = preset.tone;
        this.mix = preset.mix;
        this.harmonicLevels = [...preset.harmonics];
        
        // Apply to UI
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
        this.updateHarmonics();
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
}

/**
 * Create Harmonic Synthesizer UI Panel
 */
export function openHarmonicSynthesizerPanel(services = {}) {
    const { audioContext, masterOutput, container = document.body } = services;
    
    if (!audioContext) {
        console.error('Harmonic Synthesizer: audioContext required');
        return null;
    }
    
    // Create synthesizer instance
    const synth = new HarmonicSynthesizer(audioContext);
    
    // Create UI container
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3a3a5e;
        border-radius: 12px;
        padding: 20px;
        min-width: 500px;
        max-width: 700px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #3a3a5e;
    `;
    header.innerHTML = `
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #f39c12;">🎵 Harmonic Synthesizer</h2>
        <button id="close-btn" style="background: #f39c12; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: white;">✕ Close</button>
    `;
    panel.appendChild(header);
    
    // Preset selector
    const presetSection = document.createElement('div');
    presetSection.style.cssText = 'margin-bottom: 20px;';
    presetSection.innerHTML = `
        <label style="font-size: 14px; color: #a0a0a0; display: block; margin-bottom: 8px;">Preset</label>
        <select id="preset-select" style="
            width: 100%;
            padding: 10px;
            background: #0a0a14;
            border: 1px solid #3a3a5e;
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 14px;
        ">
            <option value="">-- Select Preset --</option>
            ${Object.keys(synth.presets).map(name => `<option value="${name}">${name}</option>`).join('')}
        </select>
    `;
    panel.appendChild(presetSection);
    
    // Mode selector
    const modeSection = document.createElement('div');
    modeSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 20px;
    `;
    modeSection.innerHTML = `
        <label style="font-size: 14px; color: #a0a0a0; grid-column: span 4;">Harmonic Mode</label>
        <button class="mode-btn" data-mode="even" style="padding: 12px; background: #0a0a14; border: 1px solid #3a3a5e; border-radius: 6px; color: #e0e0e0; cursor: pointer;">Even</button>
        <button class="mode-btn" data-mode="odd" style="padding: 12px; background: #0a0a14; border: 1px solid #3a3a5e; border-radius: 6px; color: #e0e0e0; cursor: pointer;">Odd</button>
        <button class="mode-btn" data-mode="sub" style="padding: 12px; background: #0a0a14; border: 1px solid #3a3a5e; border-radius: 6px; color: #e0e0e0; cursor: pointer;">Sub</button>
        <button class="mode-btn active" data-mode="all" style="padding: 12px; background: #f39c12; border: 1px solid #f39c12; border-radius: 6px; color: white; cursor: pointer;">All</button>
    `;
    panel.appendChild(modeSection);
    
    // Global controls
    const globalSection = document.createElement('div');
    globalSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    globalSection.innerHTML = `
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Depth</label>
            <input type="range" id="depth-control" min="0" max="100" value="50" style="width: 100%;">
            <span id="depth-val" style="font-size: 12px; color: #f39c12;">50%</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Tone</label>
            <input type="range" id="tone-control" min="0" max="100" value="50" style="width: 100%;">
            <span id="tone-val" style="font-size: 12px; color: #f39c12;">50%</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Mix</label>
            <input type="range" id="mix-control" min="0" max="100" value="30" style="width: 100%;">
            <span id="mix-val" style="font-size: 12px; color: #f39c12;">30%</span>
        </div>
    `;
    panel.appendChild(globalSection);
    
    // Harmonic sliders
    const harmonicsSection = document.createElement('div');
    harmonicsSection.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    harmonicsSection.innerHTML = `
        <label style="font-size: 14px; color: #a0a0a0; display: block; margin-bottom: 15px;">Harmonic Levels</label>
        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px;">
            ${Array(8).fill(0).map((_, i) => `
                <div style="text-align: center;">
                    <div style="font-size: 10px; color: #a0a0a0; margin-bottom: 5px;">H${i + 1}</div>
                    <input type="range" id="harmonic-${i}" min="0" max="100" value="${synth.harmonicLevels[i] * 100}" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 20px; height: 80px; direction: rtl;">
                    <div id="harmonic-val-${i}" style="font-size: 10px; color: #f39c12; margin-top: 5px;">${Math.round(synth.harmonicLevels[i] * 100)}%</div>
                </div>
            `).join('')}
        </div>
    `;
    panel.appendChild(harmonicsSection);
    
    // Frequency display
    const freqSection = document.createElement('div');
    freqSection.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        background: #1a1a2e;
        border-radius: 8px;
        margin-bottom: 15px;
    `;
    freqSection.innerHTML = `
        <div>
            <span style="font-size: 12px; color: #a0a0a0;">Detected Frequency</span>
            <div id="freq-display" style="font-size: 24px; font-weight: bold; color: #f39c12;">440 Hz</div>
        </div>
        <div>
            <button id="pitch-detect-btn" style="padding: 10px 20px; background: #f39c12; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: white;">
                Start Pitch Detection
            </button>
        </div>
    `;
    panel.appendChild(freqSection);
    
    container.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-btn').onclick = () => {
        synth.stopPitchDetection();
        panel.remove();
    };
    
    document.getElementById('preset-select').onchange = (e) => {
        if (e.target.value) {
            synth.applyPreset(e.target.value);
            updateUIFromSynth();
        }
    };
    
    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => {
                b.style.background = '#0a0a14';
                b.style.color = '#e0e0e0';
                b.classList.remove('active');
            });
            e.target.style.background = '#f39c12';
            e.target.style.color = 'white';
            e.target.classList.add('active');
            synth.setMode(e.target.dataset.mode);
        };
    });
    
    // Global controls
    document.getElementById('depth-control').oninput = (e) => {
        synth.setDepth(parseInt(e.target.value) / 100);
        document.getElementById('depth-val').textContent = `${e.target.value}%`;
    };
    
    document.getElementById('tone-control').oninput = (e) => {
        synth.setTone(parseInt(e.target.value) / 100);
        document.getElementById('tone-val').textContent = `${e.target.value}%`;
    };
    
    document.getElementById('mix-control').oninput = (e) => {
        synth.setMix(parseInt(e.target.value) / 100);
        document.getElementById('mix-val').textContent = `${e.target.value}%`;
    };
    
    // Harmonic sliders
    for (let i = 0; i < 8; i++) {
        document.getElementById(`harmonic-${i}`).oninput = (e) => {
            synth.setHarmonicLevel(i, parseInt(e.target.value) / 100);
            document.getElementById(`harmonic-val-${i}`).textContent = `${e.target.value}%`;
        };
    }
    
    // Pitch detection button
    let pitchDetecting = false;
    document.getElementById('pitch-detect-btn').onclick = (e) => {
        pitchDetecting = !pitchDetecting;
        if (pitchDetecting) {
            synth.startPitchDetection();
            e.target.textContent = 'Stop Pitch Detection';
            e.target.style.background = '#e74c3c';
            
            // Update frequency display
            setInterval(() => {
                document.getElementById('freq-display').textContent = `${Math.round(synth.detectedFrequency)} Hz`;
            }, 100);
        } else {
            synth.stopPitchDetection();
            e.target.textContent = 'Start Pitch Detection';
            e.target.style.background = '#f39c12';
        }
    };
    
    function updateUIFromSynth() {
        document.getElementById('depth-control').value = synth.depth * 100;
        document.getElementById('depth-val').textContent = `${Math.round(synth.depth * 100)}%`;
        
        document.getElementById('tone-control').value = synth.tone * 100;
        document.getElementById('tone-val').textContent = `${Math.round(synth.tone * 100)}%`;
        
        document.getElementById('mix-control').value = synth.mix * 100;
        document.getElementById('mix-val').textContent = `${Math.round(synth.mix * 100)}%`;
        
        for (let i = 0; i < 8; i++) {
            document.getElementById(`harmonic-${i}`).value = synth.harmonicLevels[i] * 100;
            document.getElementById(`harmonic-val-${i}`).textContent = `${Math.round(synth.harmonicLevels[i] * 100)}%`;
        }
        
        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.style.background = '#0a0a14';
            btn.style.color = '#e0e0e0';
            if (btn.dataset.mode === synth.mode) {
                btn.style.background = '#f39c12';
                btn.style.color = 'white';
            }
        });
    }
    
    return synth;
}

export { HarmonicSynthesizer };
export default HarmonicSynthesizer;
// Register on Tone namespace for effectsRegistry.createEffectInstance
if (typeof Tone !== 'undefined') {
    Tone.HarmonicSynthesizer = HarmonicSynthesizer;
}
