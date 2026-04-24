/**
 * Audio Spectrum Freeze - Freeze spectrum analysis for study
 * 
 * Features:
 * - Real-time spectrum analysis
 * - Freeze frame for detailed analysis
 * - Multiple freeze slots
 * - Compare frozen spectrums
 * - Export spectrum data
 */

// Spectrum Freeze Analyzer
export class AudioSpectrumFreeze {
    constructor(options = {}) {
        this.options = {
            fftSize: options.fftSize || 2048,
            smoothing: options.smoothing || 0.8,
            maxFreezes: options.maxFreezes || 10,
            ...options
        };
        
        // Audio nodes
        this.analyser = null;
        this.inputNode = null;
        
        // Spectrum data
        this.currentSpectrum = null;
        this.frozenSpectrums = [];
        this.isFrozen = false;
        this.selectedFreezeIndex = -1;
        
        // State
        this.isEnabled = true;
        this.animationFrame = null;
        
        console.log('[AudioSpectrumFreeze] Initialized');
    }
    
    /**
     * Initialize with audio context
     */
    initialize(audioContext) {
        this.audioContext = audioContext;
        
        // Create analyser
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = this.options.fftSize;
        this.analyser.smoothingTimeConstant = this.options.smoothing;
        
        // Create input node
        this.inputNode = audioContext.createGain();
        this.inputNode.connect(this.analyser);
        
        // Allocate data arrays
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.currentSpectrum = new Float32Array(this.analyser.frequencyBinCount);
        
        // Start analysis loop
        this._startAnalysis();
        
        console.log('[AudioSpectrumFreeze] Audio nodes initialized');
        return this;
    }
    
    /**
     * Start spectrum analysis loop
     */
    _startAnalysis() {
        const analyze = () => {
            if (!this.isEnabled) {
                this.animationFrame = requestAnimationFrame(analyze);
                return;
            }
            
            if (!this.isFrozen && this.analyser) {
                this.analyser.getByteFrequencyData(this.frequencyData);
                
                // Convert to normalized float
                for (let i = 0; i < this.frequencyData.length; i++) {
                    this.currentSpectrum[i] = this.frequencyData[i] / 255;
                }
            }
            
            this.animationFrame = requestAnimationFrame(analyze);
        };
        
        this.animationFrame = requestAnimationFrame(analyze);
    }
    
    /**
     * Freeze current spectrum
     */
    freeze() {
        if (this.frozenSpectrums.length >= this.options.maxFreezes) {
            // Remove oldest freeze
            this.frozenSpectrums.shift();
        }
        
        const frozenData = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            data: new Float32Array(this.currentSpectrum),
            fftSize: this.options.fftSize,
            sampleRate: this.audioContext.sampleRate,
            label: `Freeze ${this.frozenSpectrums.length + 1}`
        };
        
        this.frozenSpectrums.push(frozenData);
        this.selectedFreezeIndex = this.frozenSpectrums.length - 1;
        
        console.log(`[AudioSpectrumFreeze] Frozen spectrum ${frozenData.id}`);
        return frozenData;
    }
    
    /**
     * Unfreeze (resume live analysis)
     */
    unfreeze() {
        this.isFrozen = false;
        console.log('[AudioSpectrumFreeze] Resumed live analysis');
    }
    
    /**
     * Toggle freeze state
     */
    toggleFreeze() {
        if (!this.isFrozen) {
            this.freeze();
            this.isFrozen = true;
        } else {
            this.unfreeze();
        }
        return this.isFrozen;
    }
    
    /**
     * Select a frozen spectrum
     */
    selectFreeze(index) {
        if (index >= 0 && index < this.frozenSpectrums.length) {
            this.selectedFreezeIndex = index;
            this.isFrozen = true;
            console.log(`[AudioSpectrumFreeze] Selected freeze ${index}`);
            return true;
        }
        return false;
    }
    
    /**
     * Delete a frozen spectrum
     */
    deleteFreeze(index) {
        if (index >= 0 && index < this.frozenSpectrums.length) {
            const deleted = this.frozenSpectrums.splice(index, 1);
            if (this.selectedFreezeIndex >= this.frozenSpectrums.length) {
                this.selectedFreezeIndex = this.frozenSpectrums.length - 1;
            }
            console.log(`[AudioSpectrumFreeze] Deleted freeze ${index}`);
            return deleted[0];
        }
        return null;
    }
    
    /**
     * Clear all frozen spectrums
     */
    clearAllFreezes() {
        this.frozenSpectrums = [];
        this.selectedFreezeIndex = -1;
        this.isFrozen = false;
        console.log('[AudioSpectrumFreeze] Cleared all freezes');
    }
    
    /**
     * Rename a frozen spectrum
     */
    renameFreeze(index, newLabel) {
        if (index >= 0 && index < this.frozenSpectrums.length) {
            this.frozenSpectrums[index].label = newLabel;
            return true;
        }
        return false;
    }
    
    /**
     * Get current display spectrum
     */
    getDisplaySpectrum() {
        if (this.isFrozen && this.selectedFreezeIndex >= 0) {
            return this.frozenSpectrums[this.selectedFreezeIndex].data;
        }
        return this.currentSpectrum;
    }
    
    /**
     * Get spectrum for comparison (multiple freezes)
     */
    getComparisonSpectrums() {
        return this.frozenSpectrums.map(f => ({
            label: f.label,
            data: f.data
        }));
    }
    
    /**
     * Calculate frequency from bin index
     */
    binToFrequency(binIndex) {
        return binIndex * this.audioContext.sampleRate / this.options.fftSize;
    }
    
    /**
     * Get frequency data with labels
     */
    getLabeledSpectrum(spectrum = null) {
        const data = spectrum || this.getDisplaySpectrum();
        const result = [];
        
        for (let i = 0; i < data.length; i++) {
            const freq = this.binToFrequency(i);
            // Only include meaningful frequency range (20Hz - 20kHz)
            if (freq >= 20 && freq <= 20000) {
                result.push({
                    frequency: freq,
                    amplitude: data[i],
                    binIndex: i
                });
            }
        }
        
        return result;
    }
    
    /**
     * Find peaks in spectrum
     */
    findPeaks(threshold = 0.3, minDistance = 5) {
        const data = this.getDisplaySpectrum();
        const peaks = [];
        
        for (let i = minDistance; i < data.length - minDistance; i++) {
            if (data[i] >= threshold) {
                // Check if it's a local maximum
                let isPeak = true;
                for (let j = i - minDistance; j <= i + minDistance; j++) {
                    if (j !== i && data[j] > data[i]) {
                        isPeak = false;
                        break;
                    }
                }
                
                if (isPeak) {
                    peaks.push({
                        frequency: this.binToFrequency(i),
                        amplitude: data[i],
                        binIndex: i
                    });
                }
            }
        }
        
        return peaks.sort((a, b) => b.amplitude - a.amplitude);
    }
    
    /**
     * Export spectrum data as JSON
     */
    exportSpectrum(index = -1) {
        const data = index >= 0 ? this.frozenSpectrums[index] : {
            label: 'Current',
            data: this.currentSpectrum,
            timestamp: new Date().toISOString(),
            fftSize: this.options.fftSize,
            sampleRate: this.audioContext?.sampleRate || 44100
        };
        
        const labeled = this.getLabeledSpectrum(data.data);
        const peaks = this.findPeaks();
        
        return JSON.stringify({
            ...data,
            labeledData: labeled,
            peaks: peaks.slice(0, 10)
        }, null, 2);
    }
    
    /**
     * Connect audio source
     */
    connect(source) {
        if (source.output) {
            source.output.connect(this.inputNode);
        } else if (source.connect) {
            source.connect(this.inputNode);
        }
        return this;
    }
    
    /**
     * Set FFT size
     */
    setFFTSize(size) {
        this.options.fftSize = size;
        if (this.analyser) {
            this.analyser.fftSize = size;
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.currentSpectrum = new Float32Array(this.analyser.frequencyBinCount);
        }
    }
    
    /**
     * Set smoothing
     */
    setSmoothing(value) {
        this.options.smoothing = value;
        if (this.analyser) {
            this.analyser.smoothingTimeConstant = value;
        }
    }
    
    /**
     * Get state for UI
     */
    getState() {
        return {
            isEnabled: this.isEnabled,
            isFrozen: this.isFrozen,
            currentSpectrum: Array.from(this.currentSpectrum || []),
            frozenSpectrums: this.frozenSpectrums.map(f => ({
                id: f.id,
                label: f.label,
                timestamp: f.timestamp
            })),
            selectedFreezeIndex: this.selectedFreezeIndex,
            fftSize: this.options.fftSize,
            smoothing: this.options.smoothing
        };
    }
    
    /**
     * Dispose
     */
    dispose() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        
        if (this.inputNode) {
            this.inputNode.disconnect();
            this.inputNode = null;
        }
        
        this.frozenSpectrums = [];
        this.currentSpectrum = null;
        
        console.log('[AudioSpectrumFreeze] Disposed');
    }
}

/**
 * Open Spectrum Freeze Panel
 */
export function openSpectrumFreezePanel(services) {
    const { showNotification, getTracks, getTrackById } = services;
    
    const panel = document.createElement('div');
    panel.id = 'spectrum-freeze-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-xl p-6 w-[1000px] max-h-[90vh] overflow-y-auto border border-zinc-700">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Spectrum Freeze Analyzer</h2>
                <button id="close-spectrum-freeze" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="col-span-2 bg-zinc-800 rounded-lg p-4">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="text-lg font-semibold text-white">Spectrum</h3>
                        <div class="flex gap-2">
                            <button id="freeze-btn" class="px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm">
                                Freeze
                            </button>
                            <button id="unfreeze-btn" class="px-4 py-1 bg-zinc-600 hover:bg-zinc-500 text-white rounded text-sm">
                                Resume Live
                            </button>
                        </div>
                    </div>
                    <canvas id="spectrum-canvas" width="700" height="300" class="w-full bg-zinc-900 rounded"></canvas>
                    <div class="flex justify-between text-zinc-500 text-xs mt-1">
                        <span>20 Hz</span>
                        <span>200 Hz</span>
                        <span>2 kHz</span>
                        <span>20 kHz</span>
                    </div>
                </div>
                
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-lg font-semibold text-white mb-2">Frozen Spectrums</h3>
                    <div id="frozen-list" class="space-y-2 max-h-[200px] overflow-y-auto mb-4">
                        <div class="text-zinc-500 text-sm">No frozen spectrums</div>
                    </div>
                    <button id="clear-freezes-btn" class="w-full px-4 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded text-sm">
                        Clear All
                    </button>
                    
                    <h3 class="text-lg font-semibold text-white mt-4 mb-2">Analysis</h3>
                    <div id="peak-analysis" class="text-zinc-400 text-sm">
                        Peaks will appear here
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-sm font-semibold text-white mb-2">FFT Size</h3>
                    <select id="fft-size-select" class="w-full bg-zinc-700 text-white rounded p-2">
                        <option value="512">512</option>
                        <option value="1024">1024</option>
                        <option value="2048" selected>2048</option>
                        <option value="4096">4096</option>
                        <option value="8192">8192</option>
                    </select>
                </div>
                
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-sm font-semibold text-white mb-2">Smoothing</h3>
                    <input type="range" id="smoothing-slider" min="0" max="0.99" step="0.01" value="0.8" 
                        class="w-full accent-blue-500">
                    <span id="smoothing-val" class="text-white text-sm">0.80</span>
                </div>
                
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-sm font-semibold text-white mb-2">Source Track</h3>
                    <select id="source-track-select" class="w-full bg-zinc-700 text-white rounded p-2">
                        <option value="">Select track...</option>
                        <option value="master">Master Output</option>
                    </select>
                </div>
            </div>
            
            <div class="bg-zinc-800 rounded-lg p-4">
                <h3 class="text-lg font-semibold text-white mb-2">Comparison View</h3>
                <canvas id="comparison-canvas" width="900" height="150" class="w-full bg-zinc-900 rounded"></canvas>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // State
    let spectrumFreeze = null;
    let animationFrame = null;
    
    // Get elements
    const canvas = panel.querySelector('#spectrum-canvas');
    const ctx = canvas.getContext('2d');
    const compCanvas = panel.querySelector('#comparison-canvas');
    const compCtx = compCanvas.getContext('2d');
    
    // Populate track select
    const tracks = getTracks ? getTracks() : [];
    const sourceSelect = panel.querySelector('#source-track-select');
    tracks.forEach(track => {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = track.name;
        sourceSelect.appendChild(opt);
    });
    
    // Initialize spectrum freeze
    const audioContext = window.Tone?.context?.rawContext || window.Tone?.context;
    if (audioContext) {
        spectrumFreeze = new AudioSpectrumFreeze();
        spectrumFreeze.initialize(audioContext);
    }
    
    // Event handlers
    panel.querySelector('#close-spectrum-freeze').onclick = () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        if (spectrumFreeze) spectrumFreeze.dispose();
        panel.remove();
    };
    
    panel.querySelector('#freeze-btn').onclick = () => {
        if (spectrumFreeze) {
            spectrumFreeze.freeze();
            updateFrozenList();
            if (showNotification) showNotification('Spectrum frozen', 1500);
        }
    };
    
    panel.querySelector('#unfreeze-btn').onclick = () => {
        if (spectrumFreeze) {
            spectrumFreeze.unfreeze();
            if (showNotification) showNotification('Resumed live analysis', 1500);
        }
    };
    
    panel.querySelector('#clear-freezes-btn').onclick = () => {
        if (spectrumFreeze) {
            spectrumFreeze.clearAllFreezes();
            updateFrozenList();
        }
    };
    
    panel.querySelector('#fft-size-select').onchange = (e) => {
        if (spectrumFreeze) {
            spectrumFreeze.setFFTSize(parseInt(e.target.value));
        }
    };
    
    panel.querySelector('#smoothing-slider').oninput = (e) => {
        const val = parseFloat(e.target.value);
        panel.querySelector('#smoothing-val').textContent = val.toFixed(2);
        if (spectrumFreeze) {
            spectrumFreeze.setSmoothing(val);
        }
    };
    
    // Update frozen list
    function updateFrozenList() {
        const listEl = panel.querySelector('#frozen-list');
        if (!spectrumFreeze || spectrumFreeze.frozenSpectrums.length === 0) {
            listEl.innerHTML = '<div class="text-zinc-500 text-sm">No frozen spectrums</div>';
            return;
        }
        
        listEl.innerHTML = spectrumFreeze.frozenSpectrums.map((f, i) => `
            <div class="flex items-center justify-between bg-zinc-700 rounded p-2 cursor-pointer hover:bg-zinc-600 ${spectrumFreeze.selectedFreezeIndex === i ? 'ring-2 ring-blue-500' : ''}" data-index="${i}">
                <span class="text-white text-sm">${f.label}</span>
                <div class="flex gap-1">
                    <button class="delete-freeze text-red-400 hover:text-red-300 text-xs" data-index="${i}">✕</button>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        listEl.querySelectorAll('[data-index]').forEach(el => {
            el.onclick = (e) => {
                if (e.target.classList.contains('delete-freeze')) {
                    spectrumFreeze.deleteFreeze(parseInt(e.target.dataset.index));
                    updateFrozenList();
                } else {
                    spectrumFreeze.selectFreeze(parseInt(el.dataset.index));
                    updateFrozenList();
                }
            };
        });
    }
    
    // Visualization loop
    function draw() {
        // Main spectrum
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (spectrumFreeze) {
            const data = spectrumFreeze.getDisplaySpectrum();
            const barWidth = canvas.width / data.length;
            
            // Draw bars
            for (let i = 0; i < data.length; i++) {
                const barHeight = data[i] * canvas.height;
                const x = i * barWidth;
                
                // Color gradient based on frequency
                const hue = (i / data.length) * 240; // Blue to red
                ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            }
            
            // Draw frozen spectrums overlay
            if (spectrumFreeze.isFrozen || spectrumFreeze.frozenSpectrums.length > 0) {
                ctx.globalAlpha = 0.3;
                spectrumFreeze.frozenSpectrums.forEach((f, idx) => {
                    if (idx !== spectrumFreeze.selectedFreezeIndex) {
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        for (let i = 0; i < f.data.length; i++) {
                            const x = i * barWidth;
                            const y = canvas.height - f.data[i] * canvas.height;
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.stroke();
                    }
                });
                ctx.globalAlpha = 1;
            }
            
            // Status indicator
            ctx.fillStyle = spectrumFreeze.isFrozen ? '#fbbf24' : '#22c55e';
            ctx.beginPath();
            ctx.arc(15, 15, 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = '12px sans-serif';
            ctx.fillText(spectrumFreeze.isFrozen ? 'FROZEN' : 'LIVE', 25, 19);
            
            // Peak analysis
            const peaks = spectrumFreeze.findPeaks(0.3, 10).slice(0, 5);
            const peakEl = panel.querySelector('#peak-analysis');
            if (peaks.length > 0) {
                peakEl.innerHTML = peaks.map(p => 
                    `<div>${p.frequency.toFixed(0)} Hz: ${(p.amplitude * 100).toFixed(0)}%</div>`
                ).join('');
            }
        }
        
        // Comparison view
        compCtx.fillStyle = '#18181b';
        compCtx.fillRect(0, 0, compCanvas.width, compCanvas.height);
        
        if (spectrumFreeze && spectrumFreeze.frozenSpectrums.length > 1) {
            const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];
            spectrumFreeze.frozenSpectrums.slice(-5).forEach((f, idx) => {
                compCtx.strokeStyle = colors[idx % colors.length];
                compCtx.lineWidth = 1;
                compCtx.beginPath();
                
                const barWidth = compCanvas.width / f.data.length;
                for (let i = 0; i < f.data.length; i++) {
                    const x = i * barWidth;
                    const y = compCanvas.height - f.data[i] * compCanvas.height;
                    if (i === 0) compCtx.moveTo(x, y);
                    else compCtx.lineTo(x, y);
                }
                compCtx.stroke();
            });
            
            // Legend
            compCtx.fillStyle = '#fff';
            compCtx.font = '10px sans-serif';
            spectrumFreeze.frozenSpectrums.slice(-5).forEach((f, idx) => {
                compCtx.fillStyle = colors[idx % colors.length];
                compCtx.fillText(f.label, 10 + idx * 100, 12);
            });
        }
        
        animationFrame = requestAnimationFrame(draw);
    }
    
    draw();
    
    console.log('[AudioSpectrumFreeze] Panel opened');
}

// Default export
export default AudioSpectrumFreeze;