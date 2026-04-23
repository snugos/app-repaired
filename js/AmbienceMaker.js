// js/AmbienceMaker.js - Generate ambient drone layers from audio input
// Creates harmonic content for ambient texture based on pitch analysis

const AMBIENCE_PRESETS = [
    { id: 'ethereal', name: 'Ethereal', baseFreq: 55, harmonics: [1, 2, 3, 5, 8, 13], waveType: 'sine', detune: 0.02 },
    { id: 'dark', name: 'Dark Drone', baseFreq: 40, harmonics: [1, 2, 4, 8], waveType: 'sawtooth', detune: 0.05 },
    { id: 'bright', name: 'Bright Shimmer', baseFreq: 110, harmonics: [1, 3, 5, 7, 9, 11], waveType: 'triangle', detune: 0.01 },
    { id: 'deep', name: 'Deep Space', baseFreq: 27.5, harmonics: [1, 2, 3, 4, 6, 8], waveType: 'sine', detune: 0.08 },
    { id: 'warm', name: 'Warm Pad', baseFreq: 65.41, harmonics: [1, 2, 3, 4, 5], waveType: 'sine', detune: 0.03 }
];

let ambienceEngine = null;
let ambienceNodes = [];
let ambienceAnalyser = null;

export function getAmbiencePresets() {
    return AMBIENCE_PRESETS.map(p => ({ ...p }));
}

export function getPresetById(id) {
    return AMBIENCE_PRESETS.find(p => p.id === id) || AMBIENCE_PRESETS[0];
}

export function initAmbienceEngine(audioContext, destination) {
    if (!audioContext) {
        console.warn('[AmbienceMaker] No audio context provided');
        return false;
    }

    disposeAmbienceEngine();

    ambienceAnalyser = audioContext.createAnalyser();
    ambienceAnalyser.fftSize = 256;
    ambienceAnalyser.connect(destination);

    ambienceEngine = {
        audioContext,
        destination,
        isPlaying: false,
        currentPreset: null,
        baseFreq: 55,
        gainNode: audioContext.createGain(),
        oscillators: []
    };

    ambienceEngine.gainNode.gain.value = 0;
    ambienceEngine.gainNode.connect(ambienceAnalyser);

    console.log('[AmbienceMaker] Engine initialized');
    return true;
}

export function disposeAmbienceEngine() {
    stopAmbience();
    if (ambienceEngine) {
        ambienceEngine = null;
    }
    if (ambienceAnalyser) {
        try { ambienceAnalyser.disconnect(); } catch (e) {}
        ambienceAnalyser = null;
    }
}

export function createAmbienceOscillators(presetId, options = {}) {
    if (!ambienceEngine) {
        console.warn('[AmbienceMaker] Engine not initialized');
        return false;
    }

    const preset = typeof presetId === 'object' ? presetId : getPresetById(presetId);
    if (!preset) return false;

    ambienceNodes.forEach(node => {
        try { node.disconnect(); } catch (e) {}
        try { node.stop(); } catch (e) {}
    });
    ambienceNodes = [];
    const ctx = ambienceEngine.audioContext;
    const masterGain = ctx.createGain();
    masterGain.gain.value = options.volume || 0.3;
    masterGain.connect(ambienceEngine.gainNode);

    const waveType = preset.waveType || 'sine';
    const detuneAmount = options.detune || preset.detune || 0.01;
    preset.harmonics.forEach((harmonic, index) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        osc.type = waveType;
        osc.frequency.value = preset.baseFreq * harmonic;

        const detuneVariation = (Math.random() - 0.5) * 2 * detuneAmount * 100;
        osc.detune.value = detuneVariation;
        const harmonicGain = 1 / (index + 1);
        oscGain.gain.value = harmonicGain * (options.gainMultiplier || 1);

        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start();

        ambienceNodes.push(osc, oscGain);
    });

    ambienceNodes.push(masterGain);
    ambienceEngine.masterGainNode = masterGain;
    ambienceEngine.currentPreset = preset;
    ambienceEngine.isPlaying = true;

    console.log(`[AmbienceMaker] Created ${preset.harmonics.length} oscillators with preset "${preset.name}"`);
    return true;
}

export function updateAmbienceParams(params) {
    if (!ambienceEngine || !ambienceEngine.isPlaying) return false;

    if (params.volume !== undefined && ambienceEngine.masterGainNode) {
        ambienceEngine.masterGainNode.gain.linearRampToValueAtTime(
            params.volume,
            ambienceEngine.audioContext.currentTime + 0.1
        );
    }

    if (params.frequency !== undefined) {
        ambienceNodes.forEach((node, i) => {
            if (node.frequency && node.frequency.value !== undefined) {
                const ratio = node.frequency.value / (ambienceEngine.currentPreset?.baseFreq || 55);
                node.frequency.linearRampToValueAtTime(
                    params.frequency * ratio,
                    ambienceEngine.audioContext.currentTime + 0.1
                );
            }
        });
    }

    return true;
}

export function fadeInAmbience(duration = 2) {
    if (!ambienceEngine || !ambienceEngine.gainNode) return false;

    const ctx = ambienceEngine.audioContext;
    ambienceEngine.gainNode.gain.setValueAtTime(0, ctx.currentTime);
    ambienceEngine.gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + duration);
    console.log(`[AmbienceMaker] Fading in over ${duration}s`);
    return true;
}

export function fadeOutAmbience(duration = 2) {
    if (!ambienceEngine || !ambienceEngine.gainNode) return false;
    const ctx = ambienceEngine.audioContext;
    ambienceEngine.gainNode.gain.setValueAtTime(1, ctx.currentTime);
    ambienceEngine.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    console.log(`[AmbienceMaker] Fading out over ${duration}s`);
    return true;
}

export function stopAmbience() {
    if (ambienceEngine) {
        ambienceEngine.isPlaying = false;
        if (ambienceEngine.gainNode) {
            ambienceEngine.gainNode.gain.setValueAtTime(0, ambienceEngine.audioContext?.currentTime || 0);
        }
    }
    console.log('[AmbienceMaker] Stopped');
}

export function getAmbienceAnalyser() {
    return ambienceAnalyser;
}

export function getAmbienceEngineState() {
    if (!ambienceEngine) return null;
    return {
        isPlaying: ambienceEngine.isPlaying,
        preset: ambienceEngine.currentPreset?.name || null,
        baseFreq: ambienceEngine.baseFreq || 55
    };
}

// Analyze audio input and detect pitch for auto-tuning
export function detectPitchFromAnalyser(analyser) {
    if (!analyser) return null;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let maxVal = 0;
    let maxIndex = 0;
    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
            maxIndex = i;
        }
    }

    const sampleRate = analyser.context?.sampleRate || 44100;
    const binWidth = sampleRate / (bufferLength * 2);
    const frequency = maxIndex * binWidth;

    if (maxVal > 30 && frequency > 20 && frequency < 8000) {
        return Math.round(frequency * 100) / 100;
    }

    return null;
}

// Panel UI - opens in a modal panel for quick access
let ambiencePanelInstance = null;

export function openAmbienceMakerPanel() {
    if (ambiencePanelInstance) {
        ambiencePanelInstance.focus();
        return ambiencePanelInstance;
    }

    const panel = document.createElement('div');
    panel.id = 'ambience-maker-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 12px;
        padding: 20px;
        z-index: 10000;
        min-width: 480px;
        max-width: 600px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    let isPlaying = false;
    let currentPreset = AMBIENCE_PRESETS[0];

    const render = () => {
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #fff; margin: 0; font-size: 18px;">🎛️ Ambience Maker</h3>
                <button id="closeAmbiencePanel" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">✕</button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="margin-bottom: 12px;">
                    <label style="display: block; color: #888; margin-bottom: 8px; font-size: 13px;">Select Preset</label>
                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
                        ${AMBIENCE_PRESETS.map(p => `
                            <button data-preset="${p.id}" class="preset-btn" style="
                                padding: 10px 6px;
                                background: ${currentPreset.id === p.id ? '#4a9eff' : '#2a2a4a'};
                                border: none;
                                border-radius: 6px;
                                color: #fff;
                                cursor: pointer;
                                font-size: 11px;
                                transition: background 0.2s;
                            ">${p.name}</button>
                        `).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; color: #888; margin-bottom: 8px; font-size: 13px;">
                        Volume: <span id="volLabel" style="color: #fff;">${Math.round(0.3 * 100)}%</span>
                    </label>
                    <input type="range" id="volSlider" min="0" max="100" value="30" style="width: 100%;">
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <button id="playBtn" style="
                    flex: 1;
                    padding: 14px;
                    background: #4a9eff;
                    border: none;
                    border-radius: 8px;
                    color: #fff;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.2s;
                ">▶ Play Drone</button>
                <button id="stopBtn" style="
                    flex: 1;
                    padding: 14px;
                    background: #555;
                    border: none;
                    border-radius: 8px;
                    color: #fff;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.2s;
                ">■ Stop</button>
            </div>
            
            <div style="background: #0a0a15; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="color: #666; font-size: 12px;">Status: <span id="statusText" style="color: #4a9eff;">Stopped</span></div>
                <div style="color: #444; font-size: 11px; margin-top: 4px;">${currentPreset.harmonics.length} harmonics @ ${currentPreset.baseFreq}Hz</div>
            </div>
        `;

        const closeBtn = panel.querySelector('#closeAmbiencePanel');
        closeBtn?.addEventListener('click', () => {
            stopAmbience();
            panel.remove();
            ambiencePanelInstance = null;
        });

        const playBtn = panel.querySelector('#playBtn');
        const stopBtn = panel.querySelector('#stopBtn');
        const volSlider = panel.querySelector('#volSlider');
        const volLabel = panel.querySelector('#volLabel');
        const statusText = panel.querySelector('#statusText');

        playBtn?.addEventListener('click', () => {
            if (!isPlaying) {
                isPlaying = true;
                playBtn.textContent = '⏸ Playing...';
                playBtn.style.background = '#2a7a2a';
                statusText.textContent = 'Playing: ' + currentPreset.name;
                
                // Use the audio context from Tone or create a new one
                let ctx = null;
                if (typeof Tone !== 'undefined' && Tone.context) {
                    ctx = Tone.context;
                }
                
                if (!ctx) {
                    console.warn('[AmbienceMaker] No audio context');
                    return;
                }
                
                // Create drone oscillators
                const masterGain = ctx.createGain();
                masterGain.gain.value = 0;
                masterGain.connect(ctx.destination);
                
                currentPreset.harmonics.forEach((harmonic, index) => {
                    const osc = ctx.createOscillator();
                    const oscGain = ctx.createGain();
                    
                    osc.type = currentPreset.waveType || 'sine';
                    osc.frequency.value = currentPreset.baseFreq * harmonic;
                    
                    const detuneVar = (Math.random() - 0.5) * 2 * (currentPreset.detune || 0.02) * 100;
                    osc.detune.value = detuneVar;
                    
                    const harmonicGain = 1 / (index + 1);
                    oscGain.gain.value = harmonicGain * 0.6;
                    
                    osc.connect(oscGain);
                    oscGain.connect(masterGain);
                    osc.start();
                    
                    // Store for cleanup
                    ambienceNodes.push(osc, oscGain);
                });
                
                ambienceNodes.push(masterGain);
                
                // Fade in
                masterGain.gain.setValueAtTime(0, ctx.currentTime);
                masterGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 2);
                
            }
        });

        stopBtn?.addEventListener('click', () => {
            if (isPlaying) {
                isPlaying = false;
                playBtn.textContent = '▶ Play Drone';
                playBtn.style.background = '#4a9eff';
                statusText.textContent = 'Stopped';
                
                // Fade out and stop
                const masterGain = ambienceNodes.find(n => n.gain && ambienceNodes.indexOf(n) === ambienceNodes.length - 1);
                if (masterGain && typeof Tone !== 'undefined' && Tone.context) {
                    masterGain.gain.setValueAtTime(masterGain.gain.value, Tone.context.currentTime);
                    masterGain.gain.linearRampToValueAtTime(0, Tone.context.currentTime + 0.5);
                }
                
                setTimeout(() => {
                    ambienceNodes.forEach(node => {
                        try { node.disconnect(); } catch (e) {}
                        try { node.stop?.(); } catch (e) {}
                    });
                    ambienceNodes = [];
                }, 600);
            }
        });

        volSlider?.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value) / 100;
            volLabel.textContent = `${Math.round(vol * 100)}%`;
            
            // Update volume in real-time if playing
            if (isPlaying && ambienceNodes.length > 0) {
                const masterGain = ambienceNodes[ambienceNodes.length - 1];
                if (masterGain?.gain) {
                    masterGain.gain.setValueAtTime(vol * 2, Tone.context?.currentTime || 0);
                }
            }
        });

        panel.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const presetId = btn.dataset.preset;
                currentPreset = AMBIENCE_PRESETS.find(p => p.id === presetId) || AMBIENCE_PRESETS[0];
                
                // Update button styles
                panel.querySelectorAll('.preset-btn').forEach(b => b.style.background = '#2a2a4a');
                btn.style.background = '#4a9eff';
                
                // If playing, restart with new preset
                if (isPlaying) {
                    stopBtn?.click();
                    setTimeout(() => playBtn?.click(), 700);
                }
            });
        });
    };

    render();
    document.body.appendChild(panel);
    ambiencePanelInstance = panel;

    return panel;
}

console.log('[AmbienceMaker] Module loaded');