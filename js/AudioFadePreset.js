/**
 * Audio Fade Preset
 * Quick apply common fade curves to audio clips
 */

export class AudioFadePreset {
    constructor() {
        this.fadeInDuration = 0.5; // seconds
        this.fadeOutDuration = 0.5;
        this.fadeInCurve = 'linear';
        this.fadeOutCurve = 'linear';
        this.crossfadeAmount = 0; // For overlapping clips
    }

    /**
     * Get built-in fade presets
     */
    static getPresets() {
        return [
            { name: 'Quick Fade In', fadeIn: 0.1, fadeInCurve: 'linear', fadeOut: 0, fadeOutCurve: 'linear' },
            { name: 'Quick Fade Out', fadeIn: 0, fadeInCurve: 'linear', fadeOut: 0.1, fadeOutCurve: 'linear' },
            { name: 'Standard Fade In', fadeIn: 0.5, fadeInCurve: 'linear', fadeOut: 0, fadeOutCurve: 'linear' },
            { name: 'Standard Fade Out', fadeIn: 0, fadeInCurve: 'linear', fadeOut: 0.5, fadeOutCurve: 'linear' },
            { name: 'Smooth Fade In', fadeIn: 0.5, fadeInCurve: 'exponential', fadeOut: 0, fadeOutCurve: 'linear' },
            { name: 'Smooth Fade Out', fadeIn: 0, fadeInCurve: 'linear', fadeOut: 0.5, fadeOutCurve: 'exponential' },
            { name: 'Full Fade In/Out', fadeIn: 1, fadeInCurve: 'linear', fadeOut: 1, fadeOutCurve: 'linear' },
            { name: 'Gentle Fade In', fadeIn: 2, fadeInCurve: 'sine', fadeOut: 0, fadeOutCurve: 'linear' },
            { name: 'Gentle Fade Out', fadeIn: 0, fadeInCurve: 'linear', fadeOut: 2, fadeOutCurve: 'sine' },
            { name: 'Punchy Fade', fadeIn: 0.05, fadeInCurve: 'exponential', fadeOut: 0.1, fadeOutCurve: 'linear' },
            { name: 'Long Fade In', fadeIn: 3, fadeInCurve: 'linear', fadeOut: 0, fadeOutCurve: 'linear' },
            { name: 'Long Fade Out', fadeIn: 0, fadeInCurve: 'linear', fadeOut: 3, fadeOutCurve: 'linear' },
            { name: 'S-Curve In', fadeIn: 0.5, fadeInCurve: 's-curve', fadeOut: 0, fadeOutCurve: 'linear' },
            { name: 'S-Curve Out', fadeIn: 0, fadeInCurve: 'linear', fadeOut: 0.5, fadeOutCurve: 's-curve' },
            { name: 'S-Curve Both', fadeIn: 0.5, fadeInCurve: 's-curve', fadeOut: 0.5, fadeOutCurve: 's-curve' },
            { name: 'Crossfade 0.5s', fadeIn: 0.5, fadeInCurve: 'linear', fadeOut: 0.5, fadeOutCurve: 'linear' },
            { name: 'Crossfade 1s', fadeIn: 1, fadeInCurve: 'linear', fadeOut: 1, fadeOutCurve: 'linear' },
            { name: 'Smooth Crossfade', fadeIn: 1, fadeInCurve: 'exponential', fadeOut: 1, fadeOutCurve: 'exponential' },
            { name: 'Stinger In', fadeIn: 0.02, fadeInCurve: 'linear', fadeOut: 0, fadeOutCurve: 'linear' },
            { name: 'Stinger Out', fadeIn: 0, fadeInCurve: 'linear', fadeOut: 0.02, fadeOutCurve: 'linear' }
        ];
    }

    /**
     * Calculate fade curve value at position t (0-1)
     */
    calculateCurveValue(t, curveType) {
        switch (curveType) {
            case 'linear':
                return t;
            
            case 'exponential':
                return Math.pow(t, 2);
            
            case 'logarithmic':
                return Math.log(1 + t * 9) / Math.log(10);
            
            case 'sine':
                return Math.sin(t * Math.PI / 2);
            
            case 'cosine':
                return 1 - Math.cos(t * Math.PI / 2);
            
            case 's-curve':
                // Sigmoid-like curve
                const k = 6;
                return 1 / (1 + Math.exp(-k * (t - 0.5)));
            
            case 'equal_power':
                // Equal power crossfade curve
                return Math.cos(t * Math.PI / 2);
            
            case 'fast_in':
                // Quick start, slow end
                return 1 - Math.pow(1 - t, 3);
            
            case 'slow_in':
                // Slow start, quick end
                return Math.pow(t, 3);
            
            default:
                return t;
        }
    }

    /**
     * Apply fade to audio buffer
     */
    applyFade(buffer, fadeIn = null, fadeOut = null) {
        const fadeInDur = fadeIn ?? this.fadeInDuration;
        const fadeOutDur = fadeOut ?? this.fadeOutDuration;
        
        const sampleRate = buffer.sampleRate;
        const fadeInSamples = Math.round(fadeInDur * sampleRate);
        const fadeOutSamples = Math.round(fadeOutDur * sampleRate);
        const totalSamples = buffer.length;
        
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            
            // Apply fade in
            for (let i = 0; i < fadeInSamples && i < totalSamples; i++) {
                const t = i / fadeInSamples;
                const gain = this.calculateCurveValue(t, this.fadeInCurve);
                data[i] *= gain;
            }
            
            // Apply fade out
            for (let i = 0; i < fadeOutSamples && i < totalSamples; i++) {
                const t = i / fadeOutSamples;
                const gain = this.calculateCurveValue(1 - t, this.fadeOutCurve);
                const index = totalSamples - fadeOutSamples + i;
                if (index >= 0 && index < totalSamples) {
                    data[index] *= gain;
                }
            }
        }
        
        return buffer;
    }

    /**
     * Apply fade in only
     */
    applyFadeIn(buffer, duration = null, curve = null) {
        const savedCurve = this.fadeInCurve;
        if (curve) this.fadeInCurve = curve;
        
        const result = this.applyFade(buffer, duration ?? this.fadeInDuration, 0);
        
        this.fadeInCurve = savedCurve;
        return result;
    }

    /**
     * Apply fade out only
     */
    applyFadeOut(buffer, duration = null, curve = null) {
        const savedCurve = this.fadeOutCurve;
        if (curve) this.fadeOutCurve = curve;
        
        const result = this.applyFade(buffer, 0, duration ?? this.fadeOutDuration);
        
        this.fadeOutCurve = savedCurve;
        return result;
    }

    /**
     * Apply crossfade between two buffers
     */
    applyCrossfade(buffer1, buffer2, crossfadeDuration = 0.5) {
        const sampleRate = buffer1.sampleRate;
        const crossfadeSamples = Math.round(crossfadeDuration * sampleRate);
        
        // Create output buffer that can hold both
        const outputLength = buffer1.length + buffer2.length - crossfadeSamples;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const output = audioContext.createBuffer(
            Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels),
            outputLength,
            sampleRate
        );
        
        for (let ch = 0; ch < output.numberOfChannels; ch++) {
            const outData = output.getChannelData(ch);
            const data1 = ch < buffer1.numberOfChannels ? buffer1.getChannelData(ch) : null;
            const data2 = ch < buffer2.numberOfChannels ? buffer2.getChannelData(ch) : null;
            
            // Copy buffer1
            for (let i = 0; i < buffer1.length && i < outputLength; i++) {
                if (data1) {
                    outData[i] = data1[i];
                }
            }
            
            // Apply crossfade region
            const crossfadeStart = buffer1.length - crossfadeSamples;
            
            for (let i = 0; i < crossfadeSamples; i++) {
                const outIndex = crossfadeStart + i;
                if (outIndex >= outputLength) break;
                
                const t = i / crossfadeSamples;
                const fadeOutGain = this.calculateCurveValue(1 - t, 'equal_power');
                const fadeInGain = this.calculateCurveValue(t, 'equal_power');
                
                if (data1 && outIndex < data1.length) {
                    outData[outIndex] = data1[outIndex] * fadeOutGain;
                }
                if (data2 && i < data2.length) {
                    outData[outIndex] += data2[i] * fadeInGain;
                }
            }
            
            // Copy rest of buffer2
            for (let i = crossfadeSamples; i < buffer2.length && (crossfadeStart + i) < outputLength; i++) {
                if (data2) {
                    outData[crossfadeStart + i] = data2[i];
                }
            }
        }
        
        return output;
    }

    /**
     * Get fade curve types
     */
    static getCurveTypes() {
        return [
            { name: 'Linear', value: 'linear', description: 'Straight line fade' },
            { name: 'Exponential', value: 'exponential', description: 'Fast start, slow end' },
            { name: 'Logarithmic', value: 'logarithmic', description: 'Slow start, fast end' },
            { name: 'Sine', value: 'sine', description: 'Smooth sine curve' },
            { name: 'Cosine', value: 'cosine', description: 'Smooth cosine curve' },
            { name: 'S-Curve', value: 's-curve', description: 'Gradual start and end' },
            { name: 'Equal Power', value: 'equal_power', description: 'Best for crossfades' },
            { name: 'Fast In', value: 'fast_in', description: 'Quick attack' },
            { name: 'Slow In', value: 'slow_in', description: 'Gradual attack' }
        ];
    }

    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const presets = AudioFadePreset.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            this.fadeInDuration = preset.fadeIn;
            this.fadeOutDuration = preset.fadeOut;
            this.fadeInCurve = preset.fadeInCurve;
            this.fadeOutCurve = preset.fadeOutCurve;
            return true;
        }
        
        return false;
    }

    /**
     * Set fade in settings
     */
    setFadeIn(duration, curve = 'linear') {
        this.fadeInDuration = duration;
        this.fadeInCurve = curve;
    }

    /**
     * Set fade out settings
     */
    setFadeOut(duration, curve = 'linear') {
        this.fadeOutDuration = duration;
        this.fadeOutCurve = curve;
    }
}

// UI Panel for audio fade presets
let audioFadePresetPanel = null;

export function openAudioFadePresetPanel(services = {}) {
    if (audioFadePresetPanel) {
        audioFadePresetPanel.remove();
    }
    
    const fader = new AudioFadePreset();
    
    const panel = document.createElement('div');
    panel.className = 'snug-window audio-fade-preset-panel';
    panel.style.cssText = `
        position: fixed;
        top: 120px;
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
            <h3 style="margin: 0; color: #fff; font-size: 16px;">Audio Fade Presets</h3>
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
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Quick Preset</label>
                <select id="fadePreset" style="
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
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Fade In (s)</label>
                    <input type="number" id="fadeInDuration" min="0" max="60" step="0.1" value="0.5" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Fade In Curve</label>
                    <select id="fadeInCurve" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    "></select>
                </div>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Fade Out (s)</label>
                    <input type="number" id="fadeOutDuration" min="0" max="60" step="0.1" value="0.5" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Fade Out Curve</label>
                    <select id="fadeOutCurve" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    "></select>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preview</label>
                <canvas id="fadePreview" width="450" height="80" style="
                    width: 100%;
                    background: #0a0a1e;
                    border: 1px solid #333;
                    border-radius: 4px;
                "></canvas>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                <button id="applyFadeInBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Fade In Only</button>
                <button id="applyFadeOutBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Fade Out Only</button>
                <button id="applyBothBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Apply Both</button>
                <button id="removeFadesBtn" style="
                    background: #6e3a3a;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Remove Fades</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    audioFadePresetPanel = panel;
    
    // Populate selects
    const presetSelect = panel.querySelector('#fadePreset');
    const fadeInCurveSelect = panel.querySelector('#fadeInCurve');
    const fadeOutCurveSelect = panel.querySelector('#fadeOutCurve');
    
    AudioFadePreset.getPresets().forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    AudioFadePreset.getCurveTypes().forEach(c => {
        const opt1 = document.createElement('option');
        opt1.value = c.value;
        opt1.textContent = c.name;
        fadeInCurveSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = c.value;
        opt2.textContent = c.name;
        fadeOutCurveSelect.appendChild(opt2);
    });
    
    // Get elements
    const fadeInDurationInput = panel.querySelector('#fadeInDuration');
    const fadeOutDurationInput = panel.querySelector('#fadeOutDuration');
    const canvas = panel.querySelector('#fadePreview');
    const ctx = canvas.getContext('2d');
    
    // Draw preview
    const drawPreview = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const fadeInDur = parseFloat(fadeInDurationInput.value) || 0;
        const fadeOutDur = parseFloat(fadeOutDurationInput.value) || 0;
        const fadeInCurve = fadeInCurveSelect.value;
        const fadeOutCurve = fadeOutCurveSelect.value;
        
        // Total clip duration (arbitrary, for visualization)
        const totalDur = Math.max(1, fadeInDur + fadeOutDur + 0.5);
        
        // Draw waveform placeholder
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw fade in
        if (fadeInDur > 0) {
            ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
            ctx.fillRect(0, 0, (fadeInDur / totalDur) * canvas.width, canvas.height);
            
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const t = i / 100;
                const gain = fader.calculateCurveValue(t, fadeInCurve);
                const x = (t * fadeInDur / totalDur) * canvas.width;
                const y = canvas.height * (1 - gain);
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Draw fade out
        if (fadeOutDur > 0) {
            const startX = ((totalDur - fadeOutDur) / totalDur) * canvas.width;
            ctx.fillStyle = 'rgba(255, 74, 74, 0.3)';
            ctx.fillRect(startX, 0, (fadeOutDur / totalDur) * canvas.width, canvas.height);
            
            ctx.strokeStyle = '#ff4a4a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const t = i / 100;
                const gain = fader.calculateCurveValue(1 - t, fadeOutCurve);
                const x = startX + (t * fadeOutDur / totalDur) * canvas.width;
                const y = canvas.height * (1 - gain);
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    };
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        audioFadePresetPanel = null;
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            fader.applyPreset(presetSelect.value);
            fadeInDurationInput.value = fader.fadeInDuration;
            fadeOutDurationInput.value = fader.fadeOutDuration;
            fadeInCurveSelect.value = fader.fadeInCurve;
            fadeOutCurveSelect.value = fader.fadeOutCurve;
            drawPreview();
        }
    });
    
    fadeInDurationInput.addEventListener('input', () => {
        fader.fadeInDuration = parseFloat(fadeInDurationInput.value) || 0;
        drawPreview();
    });
    
    fadeOutDurationInput.addEventListener('input', () => {
        fader.fadeOutDuration = parseFloat(fadeOutDurationInput.value) || 0;
        drawPreview();
    });
    
    fadeInCurveSelect.addEventListener('change', () => {
        fader.fadeInCurve = fadeInCurveSelect.value;
        drawPreview();
    });
    
    fadeOutCurveSelect.addEventListener('change', () => {
        fader.fadeOutCurve = fadeOutCurveSelect.value;
        drawPreview();
    });
    
    // Apply buttons
    const applyFadeInBtn = panel.querySelector('#applyFadeInBtn');
    const applyFadeOutBtn = panel.querySelector('#applyFadeOutBtn');
    const applyBothBtn = panel.querySelector('#applyBothBtn');
    const removeFadesBtn = panel.querySelector('#removeFadesBtn');
    
    const applyFade = (type) => {
        if (services.getSelectedClips) {
            const clips = services.getSelectedClips();
            clips.forEach(clip => {
                if (clip.audioBuffer) {
                    let buffer;
                    if (type === 'in') {
                        buffer = fader.applyFadeIn(clip.audioBuffer);
                    } else if (type === 'out') {
                        buffer = fader.applyFadeOut(clip.audioBuffer);
                    } else if (type === 'both') {
                        buffer = fader.applyFade(clip.audioBuffer);
                    } else if (type === 'remove') {
                        // Remove fades by applying unity gain (no-op in practice)
                        buffer = clip.audioBuffer;
                    }
                    
                    if (services.applyFadeToClip) {
                        services.applyFadeToClip(clip.id, buffer);
                    }
                }
            });
        }
    };
    
    applyFadeInBtn.addEventListener('click', () => applyFade('in'));
    applyFadeOutBtn.addEventListener('click', () => applyFade('out'));
    applyBothBtn.addEventListener('click', () => applyFade('both'));
    removeFadesBtn.addEventListener('click', () => applyFade('remove'));
    
    // Initial draw
    drawPreview();
    
    return panel;
}

/**
 * Initialize the Audio Fade Preset
 */
export function initAudioFadePreset() {
    // Add menu item listener
    const menuItem = document.getElementById('menuAudioFadePreset');
    if (menuItem) {
        menuItem.addEventListener('click', () => openAudioFadePresetPanel({
            getSelectedClips: () => {
                if (typeof getSelectedObjects === 'function') {
                    const selected = getSelectedObjects();
                    return selected.filter(obj => obj && obj.type === 'clip');
                }
                return [];
            },
            applyFadeToClip: (clipId, buffer) => {
                if (typeof updateClipAudio === 'function') {
                    updateClipAudio(clipId, buffer);
                }
            }
        }));
    }
    
    // Add to start menu
    const startMenu = document.getElementById('startMenu');
    if (startMenu && !document.getElementById('menuAudioFadePreset')) {
        const menuItem = document.createElement('li');
        menuItem.id = 'menuAudioFadePreset';
        menuItem.textContent = 'Audio Fade Presets';
        menuItem.addEventListener('click', () => {
            startMenu.classList.add('hidden');
            openAudioFadePresetPanel({
                getSelectedClips: () => {
                    if (typeof getSelectedObjects === 'function') {
                        const selected = getSelectedObjects();
                        return selected.filter(obj => obj && obj.type === 'clip');
                    }
                    return [];
                },
                applyFadeToClip: (clipId, buffer) => {
                    if (typeof updateClipAudio === 'function') {
                        updateClipAudio(clipId, buffer);
                    }
                }
            });
        });
        
        // Insert after audio normalizer
        const normalizerItem = startMenu.querySelector('#menuAudioNormalizer');
        if (normalizerItem && normalizerItem.nextSibling) {
            startMenu.insertBefore(menuItem, normalizerItem.nextSibling);
        } else {
            startMenu.appendChild(menuItem);
        }
    }
    
    console.log('[AudioFadePreset] Initialized');
}

export default AudioFadePreset;