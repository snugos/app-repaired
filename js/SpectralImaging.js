/**
 * Spectral Imaging Processor
 * Visual feedback showing frequency spread and stereo field
 * Real-time spectrogram and stereo correlation display
 */

class SpectralImaging {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        
        // Stereo analysis nodes
        this.splitter = audioContext.createChannelSplitter(2);
        this.analyserLeft = audioContext.createAnalyser();
        this.analyserRight = audioContext.createAnalyser();
        this.merger = audioContext.createChannelMerger(2);
        
        // Combined analyser for spectrogram
        this.analyser = audioContext.createAnalyser();
        
        // FFT settings
        this.fftSize = 2048;
        this.analyser.fftSize = this.fftSize;
        this.analyserLeft.fftSize = this.fftSize;
        this.analyserRight.fftSize = this.fftSize;
        
        // Buffer arrays
        this.fftBuffer = new Float32Array(this.fftSize);
        this.leftBuffer = new Float32Array(this.fftSize);
        this.rightBuffer = new Float32Array(this.fftSize);
        
        // Connect nodes
        this.inputNode.connect(this.analyser);
        this.inputNode.connect(this.splitter);
        this.splitter.connect(this.analyserLeft, 0);
        this.splitter.connect(this.analyserRight, 1);
        this.inputNode.connect(this.merger);
        this.merger.connect(this.outputNode);
        this.analyserLeft.connect(this.outputNode);
        this.analyserRight.connect(this.outputNode);
        
        // Analysis data
        this.frequencyBins = [];
        this.stereoCorrelation = 0;
        this.midLevel = 0;
        this.sideLevel = 0;
        this.stereoWidth = 0;
        
        this.initFrequencyBins();
    }
    
    initFrequencyBins() {
        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / (this.fftSize / 2);
        
        // Create frequency bin labels
        this.frequencyBins = [];
        const bands = [
            { name: 'Sub', min: 20, max: 60 },
            { name: 'Bass', min: 60, max: 250 },
            { name: 'Low Mid', min: 250, max: 500 },
            { name: 'Mid', min: 500, max: 2000 },
            { name: 'High Mid', min: 2000, max: 6000 },
            { name: 'Presence', min: 6000, max: 12000 },
            { name: 'Air', min: 12000, max: 20000 }
        ];
        
        for (const band of bands) {
            this.frequencyBins.push(band);
        }
    }
    
    getInput() {
        return this.inputNode;
    }
    
    getOutput() {
        return this.outputNode;
    }
    
    analyze() {
        // Get frequency data
        this.analyser.getFloatFrequencyData(this.fftBuffer);
        
        // Get time domain data for stereo analysis
        this.analyserLeft.getFloatTimeDomainData(this.leftBuffer);
        this.analyserRight.getFloatTimeDomainData(this.rightBuffer);
        
        // Calculate stereo correlation
        this.calculateStereoCorrelation();
        
        // Calculate band levels
        const bandLevels = this.calculateBandLevels();
        
        return {
            bandLevels,
            stereoCorrelation: this.stereoCorrelation,
            midLevel: this.midLevel,
            sideLevel: this.sideLevel,
            stereoWidth: this.stereoWidth
        };
    }
    
    calculateStereoCorrelation() {
        let sumLeftLeft = 0;
        let sumLeftRight = 0;
        let sumRightRight = 0;
        
        const windowSize = Math.min(this.leftBuffer.length, this.rightBuffer.length, 1024);
        
        for (let i = 0; i < windowSize; i++) {
            const l = this.leftBuffer[i];
            const r = this.rightBuffer[i];
            sumLeftLeft += l * l;
            sumLeftRight += l * r;
            sumRightRight += r * r;
        }
        
        const denominator = Math.sqrt(sumLeftLeft * sumRightRight);
        this.stereoCorrelation = denominator > 0 ? sumLeftRight / denominator : 0;
        
        // Calculate mid/side levels
        let midSum = 0;
        let sideSum = 0;
        
        for (let i = 0; i < windowSize; i++) {
            const l = this.leftBuffer[i];
            const r = this.rightBuffer[i];
            const mid = (l + r) / 2;
            const side = (l - r) / 2;
            midSum += mid * mid;
            sideSum += side * side;
        }
        
        this.midLevel = Math.sqrt(midSum / windowSize);
        this.sideLevel = Math.sqrt(sideSum / windowSize);
        this.stereoWidth = this.midLevel > 0 ? this.sideLevel / this.midLevel : 0;
    }
    
    calculateBandLevels() {
        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / (this.fftSize / 2);
        
        const levels = [];
        
        for (const band of this.frequencyBins) {
            const minBin = Math.floor(band.min / binWidth);
            const maxBin = Math.ceil(band.max / binWidth);
            
            let sum = 0;
            let count = 0;
            
            for (let i = minBin; i <= maxBin && i < this.fftBuffer.length; i++) {
                // Convert from dB to linear, sum, then back to dB
                const val = this.fftBuffer[i];
                if (val > -100) { // Ignore very low values
                    sum += Math.pow(10, val / 10);
                    count++;
                }
            }
            
            const avg = count > 0 ? sum / count : 0;
            const db = avg > 0 ? 10 * Math.log10(avg) : -100;
            
            levels.push({
                name: band.name,
                minFreq: band.min,
                maxFreq: band.max,
                level: db
            });
        }
        
        return levels;
    }
    
    getSpectrogramData() {
        const data = new Uint8Array(this.fftSize / 2);
        this.analyser.getByteFrequencyData(data);
        return data;
    }
}

// Panel for spectral imaging
let spectralImagingPanel = null;
let spectralImagingProcessor = null;
let spectrogramCanvas = null;
let spectrogramCtx = null;

export function openSpectralImagingPanel() {
    if (spectralImagingPanel) {
        spectralImagingPanel.remove();
        spectralImagingPanel = null;
    }
    
    const panel = document.createElement('div');
    panel.id = 'spectralImagingPanel';
    panel.className = 'panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 20px;
        width: 400px;
        height: 500px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 12px 16px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #16213e;
        border-radius: 8px 8px 0 0;
    `;
    header.innerHTML = `
        <span style="color: #eee; font-size: 14px; font-weight: 600;">Spectral Imaging</span>
        <button id="si-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px;">×</button>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; display: flex; flex-direction: column; padding: 12px; gap: 12px;';
    
    // Spectrogram display
    const spectroSection = document.createElement('div');
    spectroSection.style.cssText = 'flex: 1; min-height: 200px; background: #0f0f1a; border-radius: 6px; overflow: hidden;';
    spectroSection.innerHTML = '<canvas id="si-spectrogram" style="width: 100%; height: 100%;"></canvas>';
    
    // Band level bars
    const bandsSection = document.createElement('div');
    bandsSection.id = 'si-bands';
    bandsSection.style.cssText = 'display: flex; gap: 4px; height: 80px; align-items: flex-end;';
    
    const bandNames = ['Sub', 'Bass', 'Low Mid', 'Mid', 'High Mid', 'Presence', 'Air'];
    bandNames.forEach(name => {
        const band = document.createElement('div');
        band.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;';
        band.innerHTML = `
            <div style="flex: 1; width: 100%; display: flex; flex-direction: column; justify-content: flex-end;">
                <div id="si-band-${name.replace(' ', '-')}" style="width: 100%; height: 0%; background: linear-gradient(to top, #4a90d9, #7fb8ff); transition: height 0.1s; border-radius: 2px 2px 0 0;"></div>
            </div>
            <span style="color: #666; font-size: 9px; margin-top: 4px;">${name}</span>
        `;
        bandsSection.appendChild(band);
    });
    
    // Stereo correlation meter
    const correlationSection = document.createElement('div');
    correlationSection.style.cssText = 'display: flex; gap: 12px; align-items: center;';
    correlationSection.innerHTML = `
        <div style="flex: 1;">
            <div style="color: #888; font-size: 10px; margin-bottom: 4px;">STEREO CORRELATION</div>
            <div style="background: #0f0f1a; height: 20px; border-radius: 4px; position: relative; overflow: hidden;">
                <div id="si-correlation-bar" style="position: absolute; left: 50%; top: 0; bottom: 0; width: 0%; background: linear-gradient(to right, #dc3545, #28a745, #dc3545); transform: translateX(-50%); transition: width 0.1s;"></div>
                <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: #fff; transform: translateX(-50%);"></div>
            </div>
        </div>
        <div style="width: 60px; text-align: center;">
            <div style="color: #888; font-size: 10px;">WIDTH</div>
            <div id="si-width" style="color: #4a90d9; font-size: 16px; font-weight: 600;">0%</div>
        </div>
    `;
    
    content.appendChild(spectroSection);
    content.appendChild(bandsSection);
    content.appendChild(correlationSection);
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);
    spectralImagingPanel = panel;
    
    // Setup canvas
    spectrogramCanvas = document.getElementById('si-spectrogram');
    spectrogramCtx = spectrogramCanvas.getContext('2d');
    
    // Get audio context
    const audioContext = window.Tone?.context || window.audioContext;
    if (audioContext) {
        spectralImagingProcessor = new SpectralImaging(audioContext);
    }
    
    // Event listeners
    document.getElementById('si-close').onclick = closeSpectralImagingPanel;
    
    // Start animation
    updateSpectralImaging();
}

function updateSpectralImaging() {
    if (!spectralImagingPanel) return;
    
    if (spectralImagingProcessor) {
        const data = spectralImagingProcessor.analyze();
        
        // Update band levels
        for (const band of data.bandLevels) {
            const el = document.getElementById(`si-band-${band.name.replace(' ', '-')}`);
            if (el) {
                const height = Math.max(0, Math.min(100, (band.level + 60) * (100/60)));
                el.style.height = `${height}%`;
            }
        }
        
        // Update correlation meter
        const corrBar = document.getElementById('si-correlation-bar');
        const widthDisplay = document.getElementById('si-width');
        
        if (corrBar) {
            const corrPercent = ((data.stereoCorrelation + 1) / 2) * 100;
            corrBar.style.width = `${corrPercent}%`;
        }
        
        if (widthDisplay) {
            const widthPercent = Math.round(Math.min(100, data.stereoWidth * 100));
            widthDisplay.textContent = `${widthPercent}%`;
        }
        
        // Update spectrogram
        updateSpectrogram();
    }
    
    requestAnimationFrame(updateSpectralImaging);
}

function updateSpectrogram() {
    if (!spectrogramCanvas || !spectrogramCtx || !spectralImagingProcessor) return;
    
    const canvas = spectrogramCanvas;
    const ctx = spectrogramCtx;
    
    // Set canvas resolution
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    
    // Get spectrogram data
    const data = spectralImagingProcessor.getSpectrogramData();
    
    // Scroll effect - shift old data left
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    
    // Map frequency bins to colors
    for (let y = 0; y < canvas.height; y++) {
        const freqIndex = Math.floor((1 - y / canvas.height) * data.length);
        const level = data[freqIndex] || 0;
        
        // Map dB to color
        const intensity = Math.max(0, Math.min(1, (level + 100) / 100));
        const r = Math.floor(intensity * 74);
        const g = Math.floor(intensity * 144);
        const b = Math.floor(intensity * 217);
        
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            imageData.data[idx] = r;
            imageData.data[idx + 1] = g;
            imageData.data[idx + 2] = b;
            imageData.data[idx + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

export function closeSpectralImagingPanel() {
    if (spectralImagingPanel) {
        spectralImagingPanel.remove();
        spectralImagingPanel = null;
        spectralImagingProcessor = null;
        spectrogramCanvas = null;
        spectrogramCtx = null;
    }
}

// Initialize
export function initSpectralImaging() {
    console.log('[SpectralImaging] Initialized');
}

export { SpectralImaging };