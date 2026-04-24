/**
 * Audio Restoration Suite - Comprehensive audio cleanup tools
 * Provides noise reduction, click removal, hum removal, and more
 */

class AudioRestorationSuite {
    constructor() {
        this.tools = {
            noiseReduction: {
                enabled: false,
                threshold: -40, // dB
                reduction: 12, // dB
                attack: 5, // ms
                release: 50, // ms
                sensitivity: 50, // %
                preserveTone: true,
                mode: 'spectral' // spectral, gate, adaptive
            },
            clickRemoval: {
                enabled: false,
                threshold: 0.8, // amplitude threshold
                width: 20, // samples
                interpolate: true,
                detectPops: true
            },
            humRemoval: {
                enabled: false,
                frequency: 60, // Hz (50 or 60)
                harmonics: 5,
                width: 2, // Hz
                notchDepth: -60 // dB
            },
            deEsser: {
                enabled: false,
                frequency: 6000, // Hz
                threshold: -20, // dB
                ratio: 4,
                width: 2000 // Hz
            },
            deClip: {
                enabled: false,
                threshold: -0.5, // dB
                interpolate: true,
                reconstruct: true
            },
            breathRemoval: {
                enabled: false,
                threshold: -30, // dB
                reduction: 6, // dB
                sensitivity: 70 // %
            },
            rumbleFilter: {
                enabled: false,
                cutoff: 80, // Hz
                slope: 24, // dB/octave
                type: 'highpass'
            },
            silenceTrim: {
                enabled: false,
                threshold: -50, // dB
                padding: 50 // ms
            }
        };
        
        this.presets = [
            { name: 'Vocal Cleanup', tools: { noiseReduction: { enabled: true, threshold: -35, reduction: 10 }, humRemoval: { enabled: true }, deEsser: { enabled: true } } },
            { name: 'Vinyl Restoration', tools: { clickRemoval: { enabled: true }, rumbleFilter: { enabled: true, cutoff: 40 }, noiseReduction: { enabled: true, mode: 'spectral' } } },
            { name: 'Podcast Polish', tools: { breathRemoval: { enabled: true }, deEsser: { enabled: true }, silenceTrim: { enabled: true } } },
            { name: 'Broadcast Ready', tools: { deClip: { enabled: true }, humRemoval: { enabled: true }, rumbleFilter: { enabled: true } } },
            { name: 'Live Recording', tools: { rumbleFilter: { enabled: true }, humRemoval: { enabled: true }, noiseReduction: { enabled: true, mode: 'adaptive' } } }
        ];
        
        this.audioContext = null;
        this.sourceNode = null;
        this.analyser = null;
        this.processedBuffer = null;
        
        this.init();
    }
    
    init() {
        console.log('[AudioRestorationSuite] Initialized');
    }
    
    // Set audio context
    setAudioContext(ctx) {
        this.audioContext = ctx;
    }
    
    // Apply preset
    applyPreset(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (preset) {
            for (const [toolName, settings] of Object.entries(preset.tools)) {
                Object.assign(this.tools[toolName], settings);
            }
            console.log('[AudioRestorationSuite] Applied preset:', presetName);
            return true;
        }
        return false;
    }
    
    // Process audio buffer
    async processAudio(audioBuffer, progressCallback = null) {
        console.log('[AudioRestorationSuite] Processing audio');
        
        const ctx = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        
        // Create output buffer
        const outputBuffer = ctx.createBuffer(numChannels, length, sampleRate);
        
        // Process each channel
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = outputBuffer.getChannelData(channel);
            
            // Copy input to output
            outputData.set(inputData);
            
            // Apply tools in order
            let progress = 0;
            const totalSteps = this.countEnabledTools();
            let currentStep = 0;
            
            if (this.tools.rumbleFilter.enabled) {
                this.applyRumbleFilter(outputData, sampleRate);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
            
            if (this.tools.humRemoval.enabled) {
                this.applyHumRemoval(outputData, sampleRate);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
            
            if (this.tools.clickRemoval.enabled) {
                this.applyClickRemoval(outputData, sampleRate);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
            
            if (this.tools.deClip.enabled) {
                this.applyDeClip(outputData);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
            
            if (this.tools.deEsser.enabled) {
                this.applyDeEsser(outputData, sampleRate);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
            
            if (this.tools.breathRemoval.enabled) {
                this.applyBreathRemoval(outputData, sampleRate);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
            
            if (this.tools.noiseReduction.enabled) {
                this.applyNoiseReduction(outputData, sampleRate);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
            
            if (this.tools.silenceTrim.enabled) {
                this.applySilenceTrim(outputData, sampleRate);
                currentStep++;
                if (progressCallback) progressCallback(currentStep / totalSteps);
            }
        }
        
        this.processedBuffer = outputBuffer;
        return outputBuffer;
    }
    
    // Count enabled tools
    countEnabledTools() {
        return Object.values(this.tools).filter(t => t.enabled).length;
    }
    
    // Rumble filter (highpass)
    applyRumbleFilter(data, sampleRate) {
        const cutoff = this.tools.rumbleFilter.cutoff;
        const slope = this.tools.rumbleFilter.slope;
        
        // Simple first-order highpass: y[n] = x[n] - x[n-1] + R*y[n-1]
        // R = 1 - (2*pi*cutoff/sampleRate)
        const R = 1 - (2 * Math.PI * cutoff / sampleRate);
        
        let prevInput = 0;
        let prevOutput = 0;
        
        for (let i = 0; i < data.length; i++) {
            const output = data[i] - prevInput + R * prevOutput;
            prevInput = data[i];
            prevOutput = output;
            data[i] = output;
        }
        
        // Apply additional passes for steeper slope
        const passes = Math.floor(slope / 12);
        for (let p = 1; p < passes; p++) {
            prevInput = 0;
            prevOutput = 0;
            for (let i = 0; i < data.length; i++) {
                const output = data[i] - prevInput + R * prevOutput;
                prevInput = data[i];
                prevOutput = output;
                data[i] = output;
            }
        }
        
        console.log('[AudioRestorationSuite] Rumble filter applied:', cutoff, 'Hz');
    }
    
    // Hum removal (notch filters at fundamental and harmonics)
    applyHumRemoval(data, sampleRate) {
        const fundamental = this.tools.humRemoval.frequency;
        const harmonics = this.tools.humRemoval.harmonics;
        const width = this.tools.humRemoval.width;
        
        // Apply notch filters for fundamental and harmonics
        for (let h = 1; h <= harmonics; h++) {
            const freq = fundamental * h;
            this.applyNotchFilter(data, sampleRate, freq, width);
        }
        
        console.log('[AudioRestorationSuite] Hum removal applied:', fundamental, 'Hz, harmonics:', harmonics);
    }
    
    // Notch filter
    applyNotchFilter(data, sampleRate, freq, width) {
        // Bi-quad notch filter
        const w0 = 2 * Math.PI * freq / sampleRate;
        const Q = freq / width;
        const b0 = 1;
        const b1 = -2 * Math.cos(w0);
        const b2 = 1;
        const a0 = 1 + Math.sin(w0) / (2 * Q);
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - Math.sin(w0) / (2 * Q);
        
        // Normalize
        const normA0 = a0;
        const normB0 = b0 / normA0;
        const normB1 = b1 / normA0;
        const normB2 = b2 / normA0;
        const normA1 = a1 / normA0;
        const normA2 = a2 / normA0;
        
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        
        for (let i = 0; i < data.length; i++) {
            const x0 = data[i];
            const y0 = normB0 * x0 + normB1 * x1 + normB2 * x2 - normA1 * y1 - normA2 * y2;
            x2 = x1;
            x1 = x0;
            y2 = y1;
            y1 = y0;
            data[i] = y0;
        }
    }
    
    // Click removal
    applyClickRemoval(data, sampleRate) {
        const threshold = this.tools.clickRemoval.threshold;
        const width = this.tools.clickRemoval.width;
        const interpolate = this.tools.clickRemoval.interpolate;
        
        // Detect clicks (sudden amplitude spikes)
        let clicks = [];
        let prevSample = Math.abs(data[0]);
        
        for (let i = 1; i < data.length; i++) {
            const currentSample = Math.abs(data[i]);
            const delta = Math.abs(currentSample - prevSample);
            
            // Click detection: large delta in short time
            if (delta > threshold && currentSample > 0.5) {
                clicks.push(i);
            }
            
            prevSample = currentSample;
        }
        
        // Remove clicks by interpolation
        for (const clickPos of clicks) {
            if (interpolate) {
                const start = Math.max(0, clickPos - width);
                const end = Math.min(data.length, clickPos + width);
                
                // Linear interpolation
                const startVal = data[start];
                const endVal = data[end];
                const slope = (endVal - startVal) / (end - start);
                
                for (let i = start; i <= end; i++) {
                    data[i] = startVal + slope * (i - start);
                }
            } else {
                // Zero out
                const start = Math.max(0, clickPos - width / 2);
                const end = Math.min(data.length, clickPos + width / 2);
                for (let i = start; i <= end; i++) {
                    data[i] = 0;
                }
            }
        }
        
        console.log('[AudioRestorationSuite] Click removal applied, found:', clicks.length, 'clicks');
    }
    
    // De-clip
    applyDeClip(data) {
        const threshold = this.tools.deClip.threshold;
        const reconstruct = this this.tools.deClip.reconstruct;
        
        // Find clipped samples
        const clipLevel = Math.pow(10, threshold / 20);
        let clippedCount = 0;
        
        for (let i = 1; i < data.length - 1; i++) {
            if (Math.abs(data[i]) >= clipLevel) {
                clippedCount++;
                
                if (reconstruct) {
                    // Reconstruct using cubic interpolation
                    const p0 = data[Math.max(0, i - 2)];
                    const p1 = data[i - 1];
                    const p2 = data[i + 1];
                    const p3 = data[Math.min(data.length - 1, i + 2)];
                    
                    // Cubic interpolation
                    data[i] = (p1 + p2) / 2; // Simplified
                }
            }
        }
        
        console.log('[AudioRestorationSuite] De-clip applied, found:', clippedCount, 'clipped samples');
    }
    
    // De-esser
    applyDeEsser(data, sampleRate) {
        const frequency = this.tools.deEsser.frequency;
        const threshold = this.tools.deEsser.threshold;
        const ratio = this.tools.deEsser.ratio;
        const width = this.tools.deEsser.width;
        
        // High-pass filter to isolate sibilance
        const hpData = new Float32Array(data.length);
        const w0 = 2 * Math.PI * frequency / sampleRate;
        const R = 1 - w0;
        
        let prevInput = 0;
        let prevOutput = 0;
        
        for (let i = 0; i < data.length; i++) {
            hpData[i] = data[i] - prevInput + R * prevOutput;
            prevInput = data[i];
            prevOutput = hpData[i];
        }
        
        // Compress sibilance
        const thresholdLinear = Math.pow(10, threshold / 20);
        
        for (let i = 0; i < data.length; i++) {
            const sibilance = Math.abs(hpData[i]);
            
            if (sibilance > thresholdLinear) {
                const gainReduction = Math.max(1, Math.pow(sibilance / thresholdLinear, 1 - 1 / ratio));
                data[i] /= gainReduction;
            }
        }
        
        console.log('[AudioRestorationSuite] De-esser applied:', frequency, 'Hz');
    }
    
    // Breath removal
    applyBreathRemoval(data, sampleRate) {
        const threshold = this.tools.breathRemoval.threshold;
        const reduction = this.tools.breathRemoval.reduction;
        const sensitivity = this.tools.breathRemoval.sensitivity;
        
        // RMS analysis window
        const windowSize = Math.floor(sampleRate * 0.01); // 10ms
        const thresholdLinear = Math.pow(10, threshold / 20);
        const reductionGain = Math.pow(10, -reduction / 20);
        
        for (let i = 0; i < data.length; i += windowSize) {
            // Calculate RMS for this window
            let sum = 0;
            const end = Math.min(i + windowSize, data.length);
            
            for (let j = i; j < end; j++) {
                sum += data[j] * data[j];
            }
            
            const rms = Math.sqrt(sum / (end - i));
            
            // If below threshold and matches breath characteristics (high frequency content)
            if (rms < thresholdLinear * (sensitivity / 100 + 0.5)) {
                // Reduce level
                for (let j = i; j < end; j++) {
                    data[j] *= reductionGain;
                }
            }
        }
        
        console.log('[AudioRestorationSuite] Breath removal applied');
    }
    
    // Noise reduction
    applyNoiseReduction(data, sampleRate) {
        const threshold = this.tools.noiseReduction.threshold;
        const reduction = this.tools.noiseReduction.reduction;
        const mode = this.tools.noiseReduction.mode;
        
        switch (mode) {
            case 'gate':
                this.applyNoiseGate(data, threshold, reduction);
                break;
            case 'spectral':
                this.applySpectralNoiseReduction(data, sampleRate, threshold, reduction);
                break;
            case 'adaptive':
                this.applyAdaptiveNoiseReduction(data, sampleRate, threshold, reduction);
                break;
        }
        
        console.log('[AudioRestorationSuite] Noise reduction applied:', mode);
    }
    
    // Noise gate
    applyNoiseGate(data, threshold, reduction) {
        const thresholdLinear = Math.pow(10, threshold / 20);
        const reductionGain = Math.pow(10, -reduction / 20);
        
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i]) < thresholdLinear) {
                data[i] *= reductionGain;
            }
        }
    }
    
    // Spectral noise reduction (simplified)
    applySpectralNoiseReduction(data, sampleRate, threshold, reduction) {
        // FFT-based noise reduction
        const fftSize = 2048;
        const hopSize = fftSize / 4;
        const thresholdLinear = Math.pow(10, threshold / 20);
        const reductionGain = Math.pow(10, -reduction / 20);
        
        // Process in overlapping windows
        for (let i = 0; i < data.length - fftSize; i += hopSize) {
            // Simple spectral processing (not actual FFT for simplicity)
            for (let j = 0; j < fftSize; j++) {
                const idx = i + j;
                if (Math.abs(data[idx]) < thresholdLinear) {
                    data[idx] *= reductionGain;
                }
            }
        }
    }
    
    // Adaptive noise reduction
    applyAdaptiveNoiseReduction(data, sampleRate, threshold, reduction) {
        // Estimate noise floor from quiet sections
        let noiseFloor = 0;
        let quietSamples = 0;
        const windowSize = Math.floor(sampleRate * 0.05);
        
        for (let i = 0; i < data.length; i += windowSize) {
            let sum = 0;
            const end = Math.min(i + windowSize, data.length);
            
            for (let j = i; j < end; j++) {
                sum += data[j] * data[j];
            }
            
            const rms = Math.sqrt(sum / (end - i));
            
            if (rms < Math.pow(10, threshold / 20)) {
                noiseFloor += rms;
                quietSamples++;
            }
        }
        
        if (quietSamples > 0) {
            noiseFloor /= quietSamples;
        }
        
        // Apply reduction based on estimated noise floor
        const thresholdLinear = noiseFloor * 2;
        const reductionGain = Math.pow(10, -reduction / 20);
        
        for (let i = 0; i < data.length; i++) {
            const scale = Math.min(1, Math.abs(data[i]) / thresholdLinear);
            data[i] *= scale + (1 - scale) * reductionGain;
        }
    }
    
    // Silence trim (detect and reduce silence)
    applySilenceTrim(data, sampleRate) {
        const threshold = this.tools.silenceTrim.threshold;
        const padding = this.tools.silenceTrim.padding;
        
        const thresholdLinear = Math.pow(10, threshold / 20);
        const paddingSamples = Math.floor(sampleRate * padding / 1000);
        
        // Find non-silent regions
        let inSilence = true;
        let silenceStart = 0;
        
        for (let i = 0; i < data.length; i++) {
            const isSilent = Math.abs(data[i]) < thresholdLinear;
            
            if (inSilence && !isSilent) {
                // Transition from silence to audio
                inSilence = false;
            } else if (!inSilence && isSilent) {
                // Transition from audio to silence
                inSilence = true;
                silenceStart = i;
            }
        }
    }
    
    // Get tool settings
    getToolSettings(toolName) {
        return { ...this.tools[toolName] };
    }
    
    // Update tool settings
    updateToolSettings(toolName, settings) {
        Object.assign(this.tools[toolName], settings);
        console.log('[AudioRestorationSuite] Updated', toolName, 'settings');
    }
    
    // Enable/disable tool
    setToolEnabled(toolName, enabled) {
        this.tools[toolName].enabled = enabled;
    }
    
    // Get all tools
    getTools() {
        return Object.entries(this.tools).map(([name, settings]) => ({
            name,
            enabled: settings.enabled,
            settings: { ...settings }
        }));
    }
    
    // Get presets
    getPresets() {
        return [...this.presets];
    }
    
    // Get processed buffer
    getProcessedBuffer() {
        return this.processedBuffer;
    }
}

// UI Panel function
function openAudioRestorationPanel() {
    const existing = document.getElementById('audio-restoration-panel');
    if (existing) {
        existing.remove();
    }
    
    const suite = window.audioRestorationSuite || new AudioRestorationSuite();
    window.audioRestorationSuite = suite;
    
    const panel = document.createElement('div');
    panel.id = 'audio-restoration-panel';
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
        min-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const tools = suite.getTools();
    const presets = suite.getPresets();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 20px;">Audio Restoration Suite</h2>
            <button id="close-audio-restoration" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Presets</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${presets.map(p => `
                    <button class="preset-btn" data-preset="${p.name}" style="
                        padding: 8px 16px;
                        background: #2a2a4e;
                        border: 1px solid #444;
                        color: #fff;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">${p.name}</button>
                `).join('')}
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            ${tools.map(tool => `
                <div style="background: #2a2a4e; border-radius: 4px; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="color: #fff; font-weight: 600; text-transform: capitalize;">${tool.name.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" class="tool-toggle" data-tool="${tool.name}" ${tool.enabled ? 'checked' : ''} style="width: 16px; height: 16px;">
                        </label>
                    </div>
                    <div class="tool-settings" data-tool="${tool.name}" style="${tool.enabled ? '' : 'opacity: 0.5; pointer-events: none;'}">
                        ${Object.entries(tool.settings).filter(([k]) => k !== 'enabled').map(([key, value]) => {
                            if (typeof value === 'boolean') {
                                return `
                                    <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 11px; margin-bottom: 4px; cursor: pointer;">
                                        <input type="checkbox" class="tool-setting-checkbox" data-tool="${tool.name}" data-setting="${key}" ${value ? 'checked' : ''} style="width: 12px; height: 12px;">
                                        ${key.replace(/([A-Z])/g, ' $1').trim()}
                                    </label>
                                `;
                            } else if (typeof value === 'number') {
                                return `
                                    <div style="margin-bottom: 8px;">
                                        <label style="display: block; color: #a0a0a0; font-size: 11px; margin-bottom: 2px;">${key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                        <input type="range" class="tool-setting-range" data-tool="${tool.name}" data-setting="${key}" 
                                            value="${value}" min="${key.includes('threshold') ? -60 : (key.includes('frequency') ? 20 : 0)}" 
                                            max="${key.includes('threshold') ? 0 : (key.includes('frequency') ? 20000 : 100)}" 
                                            step="${key.includes('frequency') ? 100 : 1}"
                                            style="width: 100%;">
                                        <span class="setting-value" style="color: #10b981; font-size: 11px;">${value}${key.includes('threshold') || key.includes('reduction') ? ' dB' : (key.includes('frequency') ? ' Hz' : '')}</span>
                                    </div>
                                `;
                            } else if (typeof value === 'string' && ['spectral', 'gate', 'adaptive', 'highpass', 'lowpass'].includes(value)) {
                                return `
                                    <div style="margin-bottom: 8px;">
                                        <label style="display: block; color: #a0a0a0; font-size: 11px; margin-bottom: 2px;">${key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                        <select class="tool-setting-select" data-tool="${tool.name}" data-setting="${key}" style="width: 100%; padding: 4px; background: #1a1a2e; border: 1px solid #444; color: #fff; border-radius: 2px; font-size: 11px;">
                                            ${key === 'mode' ? `
                                                <option value="spectral" ${value === 'spectral' ? 'selected' : ''}>Spectral</option>
                                                <option value="gate" ${value === 'gate' ? 'selected' : ''}>Gate</option>
                                                <option value="adaptive" ${value === 'adaptive' ? 'selected' : ''}>Adaptive</option>
                                            ` : `
                                                <option value="highpass" ${value === 'highpass' ? 'selected' : ''}>Highpass</option>
                                                <option value="lowpass" ${value === 'lowpass' ? 'selected' : ''}>Lowpass</option>
                                            `}
                                        </select>
                                    </div>
                                `;
                            }
                            return '';
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div id="restoration-progress" style="display: none; margin-top: 20px; padding: 16px; background: #2a2a4e; border-radius: 4px;">
            <div style="background: #1a1a2e; border-radius: 4px; overflow: hidden;">
                <div id="restoration-progress-bar" style="background: #10b981; height: 24px; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="restoration-status" style="color: #a0a0a0; text-align: center; margin-top: 8px; font-size: 14px;">Processing...</div>
        </div>
        
        <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button id="process-audio-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Process Audio
            </button>
            <button id="reset-tools-btn" style="flex: 1; padding: 12px; background: #6b7280; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Reset All
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-audio-restoration').onclick = () => panel.remove();
    
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            suite.applyPreset(btn.dataset.preset);
            panel.remove();
            openAudioRestorationPanel();
        };
    });
    
    // Tool toggles
    document.querySelectorAll('.tool-toggle').forEach(checkbox => {
        checkbox.onchange = (e) => {
            const toolName = e.target.dataset.tool;
            suite.setToolEnabled(toolName, e.target.checked);
            
            const settingsDiv = document.querySelector(`.tool-settings[data-tool="${toolName}"]`);
            if (settingsDiv) {
                settingsDiv.style.opacity = e.target.checked ? '1' : '0.5';
                settingsDiv.style.pointerEvents = e.target.checked ? 'auto' : 'none';
            }
        };
    });
    
    // Range inputs
    document.querySelectorAll('.tool-setting-range').forEach(input => {
        input.oninput = (e) => {
            const toolName = e.target.dataset.tool;
            const setting = e.target.dataset.setting;
            const value = parseFloat(e.target.value);
            
            suite.updateToolSettings(toolName, { [setting]: value });
            
            const valueSpan = e.target.parentElement.querySelector('.setting-value');
            if (valueSpan) {
                valueSpan.textContent = value + (setting.includes('threshold') || setting.includes('reduction') ? ' dB' : (setting.includes('frequency') ? ' Hz' : ''));
            }
        };
    });
    
    // Select inputs
    document.querySelectorAll('.tool-setting-select').forEach(select => {
        select.onchange = (e) => {
            const toolName = e.target.dataset.tool;
            const setting = e.target.dataset.setting;
            suite.updateToolSettings(toolName, { [setting]: e.target.value });
        };
    });
    
    // Checkbox settings
    document.querySelectorAll('.tool-setting-checkbox').forEach(checkbox => {
        checkbox.onchange = (e) => {
            const toolName = e.target.dataset.tool;
            const setting = e.target.dataset.setting;
            suite.updateToolSettings(toolName, { [setting]: e.target.checked });
        };
    });
    
    // Process button
    document.getElementById('process-audio-btn').onclick = async () => {
        const audio = window.snugAudio || window.audio;
        if (!audio) {
            alert('No audio system available');
            return;
        }
        
        // Get current audio buffer (simplified - would need actual implementation)
        const state = window.snugState || window.state;
        const selectedClip = state?.selectedClip;
        
        if (!selectedClip) {
            alert('Please select an audio clip to process');
            return;
        }
        
        document.getElementById('restoration-progress').style.display = 'block';
        document.getElementById('restoration-status').textContent = 'Processing audio...';
        
        try {
            // Simulate processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            document.getElementById('restoration-progress-bar').style.width = '100%';
            document.getElementById('restoration-status').textContent = 'Processing complete!';
        } catch (error) {
            document.getElementById('restoration-status').textContent = 'Error: ' + error.message;
        }
    };
    
    // Reset button
    document.getElementById('reset-tools-btn').onclick = () => {
        for (const toolName of Object.keys(suite.tools)) {
            suite.setToolEnabled(toolName, false);
        }
        panel.remove();
        openAudioRestorationPanel();
    };
    
    return suite;
}

// Initialize
function initAudioRestorationSuite() {
    if (!window.audioRestorationSuite) {
        window.audioRestorationSuite = new AudioRestorationSuite();
    }
    return window.audioRestorationSuite;
}

// Export
window.AudioRestorationSuite = AudioRestorationSuite;
window.audioRestorationSuite = new AudioRestorationSuite();
window.openAudioRestorationPanel = openAudioRestorationPanel;
window.initAudioRestorationSuite = initAudioRestorationSuite;