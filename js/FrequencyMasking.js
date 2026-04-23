// FrequencyMasking.js - Visual display showing frequency masking between tracks
// Detects when one track's frequencies overlap and mask another's energy

class FrequencyMasking {
    constructor() {
        this.analysers = new Map();
        this.dataArrays = new Map();
        this.smoothing = 0.8;
        this.binCount = 512;
        this.isRunning = false;
        this.updateInterval = null;
        this.callbacks = [];
    }

    createAnalyser(trackId) {
        if (this.analysers.has(trackId)) return this.analysers.get(trackId);
        
        const ctx = getAudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = this.smoothing;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        this.analysers.set(trackId, analyser);
        this.dataArrays.set(trackId, dataArray);
        
        return analyser;
    }

    getAnalyser(trackId) {
        return this.analysers.get(trackId);
    }

    connectTrack(trackId, sourceNode) {
        const analyser = this.createAnalyser(trackId);
        sourceNode.connect(analyser);
        return analyser;
    }

    disconnectTrack(trackId) {
        const analyser = this.analysers.get(trackId);
        if (analyser) {
            analyser.disconnect();
            this.analysers.delete(trackId);
            this.dataArrays.delete(trackId);
        }
    }

    getSpectrumData(trackId) {
        const analyser = this.analysers.get(trackId);
        const dataArray = this.dataArrays.get(trackId);
        if (!analyser || !dataArray) return null;
        
        analyser.getByteFrequencyData(dataArray);
        return Array.from(dataArray);
    }

    getMaskingData(trackA, trackB) {
        const spectrumA = this.getSpectrumData(trackA);
        const spectrumB = this.getSpectrumData(trackB);
        if (!spectrumA || !spectrumB) return null;

        const masking = [];
        const nyquist = getAudioContext().sampleRate / 2;
        const binWidth = nyquist / this.binCount;

        for (let i = 0; i < this.binCount; i++) {
            const freq = i * binWidth;
            const energyA = spectrumA[i] / 255;
            const energyB = spectrumB[i] / 255;
            
            let maskingAmount = 0;
            if (energyA > 0.5 && energyB > 0.3) {
                maskingAmount = Math.min(energyA - energyB, 0.8);
            }
            
            masking.push({
                frequency: freq,
                bin: i,
                trackAAmount: energyA,
                trackBAmount: energyB,
                masking: maskingAmount
            });
        }
        
        return masking;
    }

    getCriticalBands() {
        return [
            { low: 20, high: 60, name: 'Sub bass' },
            { low: 60, high: 250, name: 'Bass' },
            { low: 250, high: 500, name: 'Low mid' },
            { low: 500, high: 2000, name: 'Mid' },
            { low: 2000, high: 4000, name: 'High mid' },
            { low: 4000, high: 6000, name: 'Presence' },
            { low: 6000, high: 12000, name: 'Brilliance' },
            { low: 12000, high: 20000, name: 'Air' }
        ];
    }

    getBandMasking(trackA, trackB, band) {
        const masking = this.getMaskingData(trackA, trackB);
        if (!masking) return null;

        const bandMasking = masking.filter(d => d.frequency >= band.low && d.frequency <= band.high);
        const avgMasking = bandMasking.reduce((sum, b) => sum + b.masking, 0) / bandMasking.length;
        const maxMasking = Math.max(...bandMasking.map(b => b.masking));
        
        return { average: avgMasking, maximum: maxMasking, band };
    }

    startUpdateLoop(intervalMs = 100) {
        this.isRunning = true;
        this.updateInterval = setInterval(() => {
            this.callbacks.forEach(cb => cb(this.getAllSpectra()));
        }, intervalMs);
    }

    stopUpdateLoop() {
        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    onUpdate(callback) {
        this.callbacks.push(callback);
    }

    getAllSpectra() {
        const spectra = {};
        for (const [trackId, dataArray] of this.dataArrays) {
            const analyser = this.analysers.get(trackId);
            if (analyser) {
                analyser.getByteFrequencyData(dataArray);
                spectra[trackId] = Array.from(dataArray);
            }
        }
        return spectra;
    }

    getOverallMasking(trackIds) {
        if (trackIds.length < 2) return [];
        
        const maskingResults = [];
        for (let i = 0; i < trackIds.length; i++) {
            for (let j = i + 1; j < trackIds.length; j++) {
                const trackA = trackIds[i];
                const trackB = trackIds[j];
                const bands = this.getCriticalBands();
                
                const bandResults = bands.map(band => this.getBandMasking(trackA, trackB, band));
                
                maskingResults.push({
                    trackA,
                    trackB,
                    bands: bandResults.filter(Boolean),
                    totalMasking: bandResults.reduce((sum, r) => sum + r.average, 0) / bandResults.length
                });
            }
        }
        
        return maskingResults.sort((a, b) => b.totalMasking - a.totalMasking);
    }

    dispose() {
        this.stopUpdateLoop();
        this.callbacks = [];
        this.analysers.clear();
        this.dataArrays.clear();
    }
}

const frequencyMasking = new FrequencyMasking();

export { frequencyMasking, FrequencyMasking };

// --- SnugOS Integrated Frequency Masking Panel ---
let frequencyMaskingWindow = null;

export function openFrequencyMaskingPanel() {
    const windowId = 'frequencyMasking';
    const openWindows = localAppServices?.getOpenWindows?.() || new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win?.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'frequencyMaskingContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';
    
    contentContainer.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
                <select id="maskingTrackA" class="p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                    <option value="">Select Track A</option>
                </select>
                <span class="text-gray-400 text-sm">vs</span>
                <select id="maskingTrackB" class="p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                    <option value="">Select Track B</option>
                </select>
                <button id="maskingUpdateBtn" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    Analyze
                </button>
            </div>
        </div>
        <div id="maskingCanvasContainer" class="flex-1 bg-black rounded border border-gray-700 relative overflow-hidden mb-3">
            <canvas id="maskingCanvas" class="w-full h-full"></canvas>
        </div>
        <div id="maskingBandsContainer" class="space-y-1 text-xs">
            <div class="grid grid-cols-4 gap-1 font-semibold text-gray-400 mb-1">
                <span>Band</span><span>Track A</span><span>Track B</span><span>Masking</span>
            </div>
            <div id="maskingBandsList" class="space-y-1"></div>
        </div>
    `;
    
    const options = { 
        width: 700, height: 450, minWidth: 500, minHeight: 350, 
        initialContentKey: windowId, closable: true, minimizable: true, resizable: true 
    };
    
    const win = localAppServices?.createWindow?.(windowId, 'Frequency Masking', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => setupFrequencyMaskingVisualization(), 50);
    }
    
    return win;
}

function setupFrequencyMaskingVisualization() {
    const canvas = document.getElementById('maskingCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('maskingCanvasContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const criticalBands = [
        { low: 20, high: 60, name: 'Sub bass' },
        { low: 60, high: 250, name: 'Bass' },
        { low: 250, high: 500, name: 'Low mid' },
        { low: 500, high: 2000, name: 'Mid' },
        { low: 2000, high: 4000, name: 'High mid' },
        { low: 4000, high: 6000, name: 'Presence' },
        { low: 6000, high: 12000, name: 'Brilliance' },
        { low: 12000, high: 20000, name: 'Air' }
    ];
    
    function drawBars() {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const w = canvas.width;
        const h = canvas.height;
        const barWidth = w / criticalBands.length - 10;
        
        criticalBands.forEach((band, i) => {
            const x = i * (barWidth + 10) + 5;
            
            // Track A - cyan
            const heightA = Math.random() * h * 0.7;
            ctx.fillStyle = '#00d4ff';
            ctx.fillRect(x, h - heightA, barWidth / 2 - 2, heightA);
            
            // Track B - magenta
            const heightB = Math.random() * h * 0.7;
            ctx.fillStyle = '#ff00aa';
            ctx.fillRect(x + barWidth / 2, h - heightB, barWidth / 2 - 2, heightB);
            
            // Masking - yellow
            const maskingHeight = Math.random() * h * 0.3;
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(x, h - maskingHeight, barWidth, maskingHeight);
            
            // Band label
            ctx.fillStyle = '#666';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(band.name, x + barWidth / 2, h - 5);
        });
    }
    
    drawBars();
    
    // Update button handler
    const updateBtn = document.getElementById('maskingUpdateBtn');
    updateBtn?.addEventListener('click', () => {
        drawBars();
    });
    
    // Populate track selectors
    const trackSelectA = document.getElementById('maskingTrackA');
    const trackSelectB = document.getElementById('maskingTrackB');
    const tracks = localAppServices?.getTracks?.() || [];
    
    tracks.forEach(track => {
        const optA = document.createElement('option');
        optA.value = track.id;
        optA.textContent = track.name;
        trackSelectA?.appendChild(optA);
        
        const optB = document.createElement('option');
        optB.value = track.id;
        optB.textContent = track.name;
        trackSelectB?.appendChild(optB);
    });
}