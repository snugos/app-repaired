/**
 * Stereo Imager Enhancement - Advanced stereo manipulation with mono maker
 * Provides comprehensive stereo field control and mono compatibility tools
 */

class StereoImagerEnhancement {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Create channel splitter and merger
        this.splitter = audioContext.createChannelSplitter(2);
        this.merger = audioContext.createChannelMerger(2);
        
        // Left and right channel processing
        this.leftGain = audioContext.createGain();
        this.rightGain = audioContext.createGain();
        this.leftDelay = audioContext.createDelay();
        this.rightDelay = audioContext.createDelay();
        
        // Mid/Side components
        this.midGain = audioContext.createGain();
        this.sideGain = audioContext.createGain();
        
        // Width control
        this.widthGain = audioContext.createGain();
        this.widthGain.gain.value = 1;
        
        // Mono maker
        this.monoGain = audioContext.createGain();
        this.monoGain.gain.value = 0;
        
        // Low frequency mono
        this.lowSplitter = audioContext.createChannelSplitter(2);
        this.lowMerger = audioContext.createChannelMerger(2);
        this.lowPassFilter = audioContext.createBiquadFilter();
        this.lowPassFilter.type = 'lowpass';
        this.lowPassFilter.frequency.value = 200;
        this.lowPassFilter.Q.value = 0.707;
        
        // High frequency stereo
        this.highPassFilterL = audioContext.createBiquadFilter();
        this.highPassFilterR = audioContext.createBiquadFilter();
        this.highPassFilterL.type = 'highpass';
        this.highPassFilterR.type = 'highpass';
        this.highPassFilterL.frequency.value = 200;
        this.highPassFilterR.frequency.value = 200;
        
        // Analysis nodes
        this.leftAnalyser = audioContext.createAnalyser();
        this.rightAnalyser = audioContext.createAnalyser();
        this.correlationAnalyser = audioContext.createAnalyser();
        this.leftAnalyser.fftSize = 2048;
        this.rightAnalyser.fftSize = 2048;
        this.correlationAnalyser.fftSize = 2048;
        
        // Connect signal path
        this.connectNodes();
        
        // Configuration
        this.width = options.width || 1;
        this.pan = options.pan || 0;
        this.rotation = options.rotation || 0;
        this.lowFreqMono = options.lowFreqMono || 200;
        this.lowFreqMonoEnabled = options.lowFreqMonoEnabled || false;
        this.invertPhase = options.invertPhase || false;
        this.autoMono = options.autoMono || false;
        
        // Presets
        this.presets = {
            'Normal Stereo': {
                width: 1,
                pan: 0,
                rotation: 0,
                lowFreqMono: 200,
                lowFreqMonoEnabled: false,
                mono: 0
            },
            'Mono': {
                width: 0,
                pan: 0,
                rotation: 0,
                lowFreqMono: 20000,
                lowFreqMonoEnabled: true,
                mono: 1
            },
            'Wide Stereo': {
                width: 1.5,
                pan: 0,
                rotation: 0,
                lowFreqMono: 200,
                lowFreqMonoEnabled: true,
                mono: 0
            },
            'Super Wide': {
                width: 2,
                pan: 0,
                rotation: 15,
                lowFreqMono: 300,
                lowFreqMonoEnabled: true,
                mono: 0
            },
            'Bass Mono': {
                width: 1,
                pan: 0,
                rotation: 0,
                lowFreqMono: 150,
                lowFreqMonoEnabled: true,
                mono: 0
            },
            'Club Ready': {
                width: 1.2,
                pan: 0,
                rotation: 0,
                lowFreqMono: 80,
                lowFreqMonoEnabled: true,
                mono: 0
            },
            'Vocal Center': {
                width: 0.8,
                pan: 0,
                rotation: 0,
                lowFreqMono: 200,
                lowFreqMonoEnabled: false,
                mono: 0
            },
            'Phase Fix': {
                width: 1,
                pan: 0,
                rotation: 0,
                lowFreqMono: 200,
                lowFreqMonoEnabled: false,
                invertPhase: true,
                mono: 0
            }
        };
    }
    
    connectNodes() {
        // Split input into L/R
        this.input.connect(this.splitter);
        
        // Connect L/R to their respective gains
        this.splitter.connect(this.leftGain, 0);
        this.splitter.connect(this.rightGain, 1);
        
        // Connect through delays for width control
        this.leftGain.connect(this.leftDelay);
        this.rightGain.connect(this.rightDelay);
        
        // Connect delays to merger
        this.leftDelay.connect(this.merger, 0, 0);
        this.rightDelay.connect(this.merger, 0, 1);
        
        // Connect merger to output
        this.merger.connect(this.widthGain);
        this.widthGain.connect(this.output);
        
        // Connect to analyzers for metering
        this.leftGain.connect(this.leftAnalyser);
        this.rightGain.connect(this.rightAnalyser);
        
        // Mono path
        this.input.connect(this.monoGain);
        this.monoGain.connect(this.output);
    }
    
    setWidth(width) {
        this.width = Math.max(0, Math.min(3, width));
        
        // Width control using delay-based technique
        // width = 1 is normal, <1 narrows, >1 widens
        const delayTime = Math.abs(width - 1) * 0.0005; // Max 1ms delay
        
        if (width > 1) {
            // Widen by adding slight delay difference
            this.leftDelay.delayTime.value = delayTime;
            this.rightDelay.delayTime.value = 0;
        } else if (width < 1) {
            // Narrow by mixing channels
            const mix = (1 - width) * 0.5;
            this.leftGain.gain.value = 1 - mix;
            this.rightGain.gain.value = 1 - mix;
        } else {
            this.leftDelay.delayTime.value = 0;
            this.rightDelay.delayTime.value = 0;
            this.leftGain.gain.value = 1;
            this.rightGain.gain.value = 1;
        }
        
        this.widthGain.gain.value = 1 - Math.abs(width - 1) * 0.1; // Slight compensation
    }
    
    setPan(pan) {
        this.pan = Math.max(-1, Math.min(1, pan));
        
        // Pan using constant power panning
        const angle = pan * Math.PI / 4; // -45 to 45 degrees
        this.leftGain.gain.value = Math.cos(angle) * this.leftGain.gain.value;
        this.rightGain.gain.value = Math.sin(angle) * this.rightGain.gain.value;
    }
    
    setRotation(degrees) {
        this.rotation = Math.max(-45, Math.min(45, degrees));
        
        // Rotation using phase manipulation
        const radians = degrees * Math.PI / 180;
        // Simplified rotation - in practice would use allpass filters
        const delayOffset = Math.sin(radians) * 0.001;
        this.leftDelay.delayTime.value = this.leftDelay.delayTime.value + delayOffset;
        this.rightDelay.delayTime.value = this.rightDelay.delayTime.value - delayOffset;
    }
    
    setMono(monoAmount) {
        this.monoGain.gain.value = monoAmount;
        this.widthGain.gain.value = 1 - monoAmount * 0.5;
    }
    
    setLowFreqMono(frequency) {
        this.lowFreqMono = frequency;
        this.lowPassFilter.frequency.value = frequency;
        this.highPassFilterL.frequency.value = frequency;
        this.highPassFilterR.frequency.value = frequency;
    }
    
    setLowFreqMonoEnabled(enabled) {
        this.lowFreqMonoEnabled = enabled;
        if (enabled) {
            // Route low frequencies to mono
            this.lowPassFilter.connect(this.merger);
        } else {
            this.lowPassFilter.disconnect();
        }
    }
    
    setInvertPhase(invert) {
        this.invertPhase = invert;
        if (invert) {
            this.rightGain.gain.value = -Math.abs(this.rightGain.gain.value);
        } else {
            this.rightGain.gain.value = Math.abs(this.rightGain.gain.value);
        }
    }
    
    setAutoMono(enabled) {
        this.autoMono = enabled;
        // Auto-mono would analyze correlation and apply mono when needed
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;
        
        this.setWidth(preset.width);
        this.setPan(preset.pan);
        this.setRotation(preset.rotation);
        this.setLowFreqMono(preset.lowFreqMono);
        this.setLowFreqMonoEnabled(preset.lowFreqMonoEnabled);
        if (preset.invertPhase) this.setInvertPhase(preset.invertPhase);
        if (preset.mono !== undefined) this.setMono(preset.mono);
    }
    
    getCorrelation() {
        // Calculate stereo correlation coefficient
        const leftData = new Float32Array(this.leftAnalyser.fftSize);
        const rightData = new Float32Array(this.rightAnalyser.fftSize);
        
        this.leftAnalyser.getFloatTimeDomainData(leftData);
        this.rightAnalyser.getFloatTimeDomainData(rightData);
        
        // Calculate correlation
        let sumL = 0, sumR = 0, sumLR = 0;
        for (let i = 0; i < leftData.length; i++) {
            sumL += leftData[i] * leftData[i];
            sumR += rightData[i] * rightData[i];
            sumLR += leftData[i] * rightData[i];
        }
        
        const correlation = sumLR / (Math.sqrt(sumL * sumR) + 0.00001);
        return Math.max(-1, Math.min(1, correlation));
    }
    
    getStereoWidth() {
        // Calculate actual stereo width
        const leftData = new Float32Array(this.leftAnalyser.fftSize);
        const rightData = new Float32Array(this.rightAnalyser.fftSize);
        
        this.leftAnalyser.getFloatTimeDomainData(leftData);
        this.rightAnalyser.getFloatTimeDomainData(rightData);
        
        let leftRMS = 0, rightRMS = 0, midRMS = 0, sideRMS = 0;
        
        for (let i = 0; i < leftData.length; i++) {
            const left = leftData[i];
            const right = rightData[i];
            const mid = (left + right) / 2;
            const side = (left - right) / 2;
            
            leftRMS += left * left;
            rightRMS += right * right;
            midRMS += mid * mid;
            sideRMS += side * side;
        }
        
        leftRMS = Math.sqrt(leftRMS / leftData.length);
        rightRMS = Math.sqrt(rightRMS / rightData.length);
        midRMS = Math.sqrt(midRMS / leftData.length);
        sideRMS = Math.sqrt(sideRMS / leftData.length);
        
        // Width is ratio of side to mid
        return sideRMS / (midRMS + 0.00001);
    }
    
    isMonoCompatible() {
        const correlation = this.getCorrelation();
        return correlation > 0.5; // Good mono compatibility threshold
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
}

/**
 * Create Stereo Imager Enhancement UI Panel
 */
export function openStereoImagerEnhancementPanel(services = {}) {
    const { audioContext, masterOutput, container = document.body } = services;
    
    if (!audioContext) {
        console.error('Stereo Imager Enhancement: audioContext required');
        return null;
    }
    
    // Create stereo imager instance
    const imager = new StereoImagerEnhancement(audioContext);
    
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
        min-width: 550px;
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
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #9b59b6;">🎧 Stereo Imager</h2>
        <button id="close-btn" style="background: #9b59b6; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: white;">✕ Close</button>
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
            ${Object.keys(imager.presets).map(name => `<option value="${name}">${name}</option>`).join('')}
        </select>
    `;
    panel.appendChild(presetSection);
    
    // Main controls
    const controlsSection = document.createElement('div');
    controlsSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    controlsSection.innerHTML = `
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Width</label>
            <input type="range" id="width-control" min="0" max="300" value="100" style="width: 100%;">
            <span id="width-val" style="font-size: 12px; color: #9b59b6;">100%</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Pan</label>
            <input type="range" id="pan-control" min="-100" max="100" value="0" style="width: 100%;">
            <span id="pan-val" style="font-size: 12px; color: #9b59b6;">C</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Rotation</label>
            <input type="range" id="rotation-control" min="-45" max="45" value="0" style="width: 100%;">
            <span id="rotation-val" style="font-size: 12px; color: #9b59b6;">0°</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Mono</label>
            <input type="range" id="mono-control" min="0" max="100" value="0" style="width: 100%;">
            <span id="mono-val" style="font-size: 12px; color: #9b59b6;">0%</span>
        </div>
    `;
    panel.appendChild(controlsSection);
    
    // Low frequency mono section
    const lfSection = document.createElement('div');
    lfSection.style.cssText = `
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
        margin-bottom: 20px;
    `;
    lfSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 14px; color: #a0a0a0;">Low Frequency Mono</span>
            <input type="checkbox" id="lf-mono-enable" style="transform: scale(1.2);">
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="lf-mono-freq" min="20" max="500" value="200" style="flex: 1;">
            <span id="lf-mono-val" style="font-size: 12px; color: #9b59b6; min-width: 60px;">200 Hz</span>
        </div>
    `;
    panel.appendChild(lfSection);
    
    // Phase and auto-mono options
    const optionsSection = document.createElement('div');
    optionsSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    optionsSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: #a0a0a0;">Invert Phase (R)</span>
            <input type="checkbox" id="invert-phase" style="transform: scale(1.2);">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: #a0a0a0;">Auto Mono</span>
            <input type="checkbox" id="auto-mono" style="transform: scale(1.2);">
        </div>
    `;
    panel.appendChild(optionsSection);
    
    // Meters section
    const metersSection = document.createElement('div');
    metersSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        padding: 15px;
        background: #1a1a2e;
        border-radius: 8px;
    `;
    metersSection.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 12px; color: #a0a0a0; margin-bottom: 5px;">Correlation</div>
            <div id="correlation-meter" style="font-size: 24px; font-weight: bold; color: #27ae60;">1.00</div>
            <div id="correlation-status" style="font-size: 10px; color: #27ae60;">✓ Mono Safe</div>
        </div>
        <div style="text-align: center;">
            <div style="font-size: 12px; color: #a0a0a0; margin-bottom: 5px;">Actual Width</div>
            <div id="width-meter" style="font-size: 24px; font-weight: bold; color: #9b59b6;">1.00</div>
            <div style="font-size: 10px; color: #a0a0a0;">S/M ratio</div>
        </div>
        <div style="text-align: center;">
            <div style="font-size: 12px; color: #a0a0a0; margin-bottom: 5px;">Mono Check</div>
            <div id="mono-check" style="font-size: 24px; font-weight: bold; color: #27ae60;">✓</div>
            <div style="font-size: 10px; color: #27ae60;">Compatible</div>
        </div>
    `;
    panel.appendChild(metersSection);
    
    container.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-btn').onclick = () => {
        panel.remove();
    };
    
    document.getElementById('preset-select').onchange = (e) => {
        if (e.target.value) {
            imager.applyPreset(e.target.value);
            updateUIFromImager();
        }
    };
    
    // Width control
    document.getElementById('width-control').oninput = (e) => {
        imager.setWidth(parseInt(e.target.value) / 100);
        document.getElementById('width-val').textContent = `${e.target.value}%`;
    };
    
    // Pan control
    document.getElementById('pan-control').oninput = (e) => {
        const pan = parseInt(e.target.value) / 100;
        imager.setPan(pan);
        if (pan === 0) {
            document.getElementById('pan-val').textContent = 'C';
        } else if (pan < 0) {
            document.getElementById('pan-val').textContent = `L${Math.abs(pan * 100)}`;
        } else {
            document.getElementById('pan-val').textContent = `R${pan * 100}`;
        }
    };
    
    // Rotation control
    document.getElementById('rotation-control').oninput = (e) => {
        imager.setRotation(parseInt(e.target.value));
        document.getElementById('rotation-val').textContent = `${e.target.value}°`;
    };
    
    // Mono control
    document.getElementById('mono-control').oninput = (e) => {
        imager.setMono(parseInt(e.target.value) / 100);
        document.getElementById('mono-val').textContent = `${e.target.value}%`;
    };
    
    // Low frequency mono
    document.getElementById('lf-mono-enable').onchange = (e) => {
        imager.setLowFreqMonoEnabled(e.target.checked);
    };
    
    document.getElementById('lf-mono-freq').oninput = (e) => {
        imager.setLowFreqMono(parseInt(e.target.value));
        document.getElementById('lf-mono-val').textContent = `${e.target.value} Hz`;
    };
    
    // Phase invert
    document.getElementById('invert-phase').onchange = (e) => {
        imager.setInvertPhase(e.target.checked);
    };
    
    // Auto mono
    document.getElementById('auto-mono').onchange = (e) => {
        imager.setAutoMono(e.target.checked);
    };
    
    function updateUIFromImager() {
        document.getElementById('width-control').value = imager.width * 100;
        document.getElementById('width-val').textContent = `${Math.round(imager.width * 100)}%`;
        
        document.getElementById('lf-mono-freq').value = imager.lowFreqMono;
        document.getElementById('lf-mono-val').textContent = `${imager.lowFreqMono} Hz`;
        
        document.getElementById('lf-mono-enable').checked = imager.lowFreqMonoEnabled;
        document.getElementById('invert-phase').checked = imager.invertPhase;
        document.getElementById('auto-mono').checked = imager.autoMono;
    }
    
    // Update meters
    function updateMeters() {
        const correlation = imager.getCorrelation();
        document.getElementById('correlation-meter').textContent = correlation.toFixed(2);
        
        const width = imager.getStereoWidth();
        document.getElementById('width-meter').textContent = width.toFixed(2);
        
        const monoCheck = imager.isMonoCompatible();
        const monoCheckEl = document.getElementById('mono-check');
        const monoStatusEl = document.getElementById('correlation-status');
        
        if (monoCheck) {
            monoCheckEl.textContent = '✓';
            monoCheckEl.style.color = '#27ae60';
            monoStatusEl.textContent = '✓ Mono Safe';
            monoStatusEl.style.color = '#27ae60';
        } else {
            monoCheckEl.textContent = '⚠';
            monoCheckEl.style.color = '#e74c3c';
            monoStatusEl.textContent = '⚠ Phase Issue';
            monoStatusEl.style.color = '#e74c3c';
        }
        
        requestAnimationFrame(updateMeters);
    }
    updateMeters();
    
    return imager;
}

export { StereoImagerEnhancement };
export default StereoImagerEnhancement;
// Register on Tone namespace for effectsRegistry.createEffectInstance
if (typeof Tone !== 'undefined') {
    Tone.StereoImagerEnhancement = StereoImagerEnhancement;
}
