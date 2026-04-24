/**
 * Audio Spectrum Comparison - Compare frequency content across tracks
 * Allows A/B comparison of frequency spectra between tracks
 */

export class AudioSpectrumComparison {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Analyzers for each track
        this.trackAnalyzers = new Map(); // trackId -> { analyzer, canvas, data }
        
        // Comparison state
        this.enabled = false;
        this.comparisonMode = options.comparisonMode || 'overlay'; // 'overlay', 'side-by-side', 'difference'
        this.selectedTracks = []; // Array of trackIds to compare (max 4)
        this.maxTracks = 4;
        
        // FFT settings
        this.fftSize = options.fftSize || 2048;
        this.smoothing = options.smoothing || 0.8;
        
        // Display settings
        this.frequencyScale = options.frequencyScale || 'log'; // 'log', 'linear'
        this.dbRange = options.dbRange || 80;
        this.colorScheme = options.colorScheme || 'default'; // 'default', 'warm', 'cool', 'high-contrast'
        
        // Animation
        this.animationId = null;
        this.lastFrameTime = 0;
        this.frameRate = options.frameRate || 30;
        
        // History for comparison
        this.spectrumHistory = new Map(); // trackId -> Array of spectrum data
        this.historyLength = options.historyLength || 10;
        
        // Callbacks
        this.onTrackAdded = null;
        this.onTrackRemoved = null;
        this.onComparisonUpdate = null;
        
        // Color schemes
        this.colorSchemes = {
            'default': ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899'],
            'warm': ['#ef4444', '#f97316', '#eab308', '#84cc16'],
            'cool': ['#06b6d4', '#3b82f6', '#8b5cf6', '#6366f1'],
            'high-contrast': ['#ffffff', '#00ff00', '#ff00ff', '#ffff00']
        };
    }
    
    /**
     * Add a track to the comparison
     */
    addTrack(trackId, trackNode, trackName = 'Track') {
        if (this.trackAnalyzers.has(trackId)) {
            console.warn(`[AudioSpectrumComparison] Track ${trackId} already added`);
            return false;
        }
        
        if (this.selectedTracks.length >= this.maxTracks) {
            console.warn(`[AudioSpectrumComparison] Maximum tracks (${this.maxTracks}) reached`);
            return false;
        }
        
        // Create analyzer
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = this.fftSize;
        analyzer.smoothingTimeConstant = this.smoothing;
        
        // Connect track node to analyzer (but don't disconnect original routing)
        try {
            trackNode.connect(analyzer);
        } catch (e) {
            console.warn(`[AudioSpectrumComparison] Could not connect analyzer to track ${trackId}`, e);
            return false;
        }
        
        const trackData = {
            id: trackId,
            name: trackName,
            analyzer: analyzer,
            trackNode: trackNode,
            frequencyData: new Uint8Array(analyzer.frequencyBinCount),
            color: this.colorSchemes[this.colorScheme][this.selectedTracks.length],
            visible: true
        };
        
        this.trackAnalyzers.set(trackId, trackData);
        this.selectedTracks.push(trackId);
        this.spectrumHistory.set(trackId, []);
        
        if (this.onTrackAdded) {
            this.onTrackAdded(trackId, trackName);
        }
        
        console.log(`[AudioSpectrumComparison] Added track ${trackId} (${trackName})`);
        return true;
    }
    
    /**
     * Remove a track from the comparison
     */
    removeTrack(trackId) {
        const trackData = this.trackAnalyzers.get(trackId);
        if (!trackData) return false;
        
        // Disconnect analyzer
        try {
            trackData.trackNode.disconnect(trackData.analyzer);
        } catch (e) {
            // Ignore disconnection errors
        }
        
        this.trackAnalyzers.delete(trackId);
        this.selectedTracks = this.selectedTracks.filter(id => id !== trackId);
        this.spectrumHistory.delete(trackId);
        
        // Update colors for remaining tracks
        const colors = this.colorSchemes[this.colorScheme];
        this.selectedTracks.forEach((id, index) => {
            const data = this.trackAnalyzers.get(id);
            if (data) {
                data.color = colors[index];
            }
        });
        
        if (this.onTrackRemoved) {
            this.onTrackRemoved(trackId);
        }
        
        console.log(`[AudioSpectrumComparison] Removed track ${trackId}`);
        return true;
    }
    
    /**
     * Start the comparison visualization
     */
    start() {
        if (this.enabled) return;
        
        this.enabled = true;
        this.lastFrameTime = performance.now();
        this.animate();
        
        console.log('[AudioSpectrumComparison] Started');
    }
    
    /**
     * Stop the comparison visualization
     */
    stop() {
        this.enabled = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('[AudioSpectrumComparison] Stopped');
    }
    
    /**
     * Animation loop
     */
    animate() {
        if (!this.enabled) return;
        
        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        
        if (elapsed >= 1000 / this.frameRate) {
            this.lastFrameTime = now;
            this.update();
        }
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    /**
     * Update spectrum data for all tracks
     */
    update() {
        const spectrumData = new Map();
        
        for (const [trackId, trackData] of this.trackAnalyzers) {
            if (!trackData.visible) continue;
            
            trackData.analyzer.getByteFrequencyData(trackData.frequencyData);
            
            // Store in history
            const history = this.spectrumHistory.get(trackId);
            if (history) {
                history.push(new Uint8Array(trackData.frequencyData));
                if (history.length > this.historyLength) {
                    history.shift();
                }
            }
            
            spectrumData.set(trackId, {
                frequencyData: trackData.frequencyData,
                color: trackData.color,
                name: trackData.name
            });
        }
        
        if (this.onComparisonUpdate) {
            this.onComparisonUpdate(spectrumData, this.comparisonMode);
        }
    }
    
    /**
     * Get the frequency data for a specific track
     */
    getTrackSpectrum(trackId) {
        const trackData = this.trackAnalyzers.get(trackId);
        if (!trackData) return null;
        
        trackData.analyzer.getByteFrequencyData(trackData.frequencyData);
        return {
            frequencyData: trackData.frequencyData,
            color: trackData.color,
            name: trackData.name
        };
    }
    
    /**
     * Get average spectrum across selected tracks
     */
    getAverageSpectrum() {
        const spectra = [];
        
        for (const trackData of this.trackAnalyzers.values()) {
            if (trackData.visible) {
                spectra.push(trackData.frequencyData);
            }
        }
        
        if (spectra.length === 0) return null;
        
        const average = new Uint8Array(spectra[0].length);
        
        for (let i = 0; i < average.length; i++) {
            let sum = 0;
            for (const spectrum of spectra) {
                sum += spectrum[i];
            }
            average[i] = Math.round(sum / spectra.length);
        }
        
        return average;
    }
    
    /**
     * Get the difference between two tracks' spectra
     */
    getSpectrumDifference(trackId1, trackId2) {
        const data1 = this.trackAnalyzers.get(trackId1);
        const data2 = this.trackAnalyzers.get(trackId2);
        
        if (!data1 || !data2) return null;
        
        const diff = new Int16Array(data1.frequencyData.length);
        
        for (let i = 0; i < diff.length; i++) {
            diff[i] = data1.frequencyData[i] - data2.frequencyData[i];
        }
        
        return diff;
    }
    
    /**
     * Set the comparison mode
     */
    setComparisonMode(mode) {
        if (['overlay', 'side-by-side', 'difference'].includes(mode)) {
            this.comparisonMode = mode;
            console.log(`[AudioSpectrumComparison] Mode set to ${mode}`);
        }
    }
    
    /**
     * Set the color scheme
     */
    setColorScheme(scheme) {
        if (this.colorSchemes[scheme]) {
            this.colorScheme = scheme;
            
            // Update track colors
            const colors = this.colorSchemes[scheme];
            this.selectedTracks.forEach((id, index) => {
                const data = this.trackAnalyzers.get(id);
                if (data) {
                    data.color = colors[index];
                }
            });
        }
    }
    
    /**
     * Set track visibility
     */
    setTrackVisible(trackId, visible) {
        const trackData = this.trackAnalyzers.get(trackId);
        if (trackData) {
            trackData.visible = visible;
        }
    }
    
    /**
     * Clear all tracks
     */
    clearAll() {
        for (const trackId of this.selectedTracks) {
            this.removeTrack(trackId);
        }
        
        this.selectedTracks = [];
        this.trackAnalyzers.clear();
        this.spectrumHistory.clear();
    }
    
    /**
     * Get frequency at bin index
     */
    getFrequencyForBin(binIndex) {
        return binIndex * this.audioContext.sampleRate / this.fftSize;
    }
    
    /**
     * Get bin index for frequency
     */
    getBinForFrequency(frequency) {
        return Math.round(frequency * this.fftSize / this.audioContext.sampleRate);
    }
    
    /**
     * Analyze frequency band levels for a track
     */
    getBandLevels(trackId) {
        const trackData = this.trackAnalyzers.get(trackId);
        if (!trackData) return null;
        
        trackData.analyzer.getByteFrequencyData(trackData.frequencyData);
        const data = trackData.frequencyData;
        
        // Define frequency bands
        const bands = {
            sub: { min: 20, max: 60, average: 0 },
            bass: { min: 60, max: 250, average: 0 },
            lowMid: { min: 250, max: 500, average: 0 },
            mid: { min: 500, max: 2000, average: 0 },
            highMid: { min: 2000, max: 4000, average: 0 },
            presence: { min: 4000, max: 6000, average: 0 },
            brilliance: { min: 6000, max: 20000, average: 0 }
        };
        
        for (const [name, band] of Object.entries(bands)) {
            const minBin = this.getBinForFrequency(band.min);
            const maxBin = Math.min(this.getBinForFrequency(band.max), data.length - 1);
            
            let sum = 0;
            let count = 0;
            
            for (let i = minBin; i <= maxBin; i++) {
                sum += data[i];
                count++;
            }
            
            band.average = count > 0 ? sum / count : 0;
        }
        
        return bands;
    }
    
    /**
     * Compare two tracks' band levels
     */
    compareBandLevels(trackId1, trackId2) {
        const bands1 = this.getBandLevels(trackId1);
        const bands2 = this.getBandLevels(trackId2);
        
        if (!bands1 || !bands2) return null;
        
        const comparison = {};
        
        for (const band of Object.keys(bands1)) {
            comparison[band] = {
                track1: bands1[band].average,
                track2: bands2[band].average,
                difference: bands1[band].average - bands2[band].average
            };
        }
        
        return comparison;
    }
    
    /**
     * Get statistics for export
     */
    getStatistics() {
        const stats = {
            tracks: [],
            timestamp: Date.now(),
            sampleRate: this.audioContext.sampleRate,
            fftSize: this.fftSize
        };
        
        for (const [trackId, trackData] of this.trackAnalyzers) {
            const bandLevels = this.getBandLevels(trackId);
            stats.tracks.push({
                id: trackId,
                name: trackData.name,
                color: trackData.color,
                bandLevels: bandLevels
            });
        }
        
        return stats;
    }
    
    /**
     * Destroy the analyzer
     */
    destroy() {
        this.stop();
        this.clearAll();
    }
}

/**
 * Create the comparison panel UI
 */
export function createAudioSpectrumComparisonPanel(comparison, appServices) {
    const container = document.createElement('div');
    container.className = 'audio-spectrum-comparison-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 600px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Audio Spectrum Comparison';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Mode selector
    const modeContainer = document.createElement('div');
    modeContainer.style.cssText = 'margin-bottom: 16px; display: flex; gap: 8px;';
    modeContainer.innerHTML = `
        <span style="color: #9ca3af;">Mode:</span>
        <select id="comparisonMode" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white;">
            <option value="overlay">Overlay</option>
            <option value="side-by-side">Side by Side</option>
            <option value="difference">Difference</option>
        </select>
        <select id="colorScheme" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white;">
            <option value="default">Default Colors</option>
            <option value="warm">Warm</option>
            <option value="cool">Cool</option>
            <option value="high-contrast">High Contrast</option>
        </select>
    `;
    container.appendChild(modeContainer);
    
    // Canvas for visualization
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = 'position: relative; margin-bottom: 16px;';
    
    const canvas = document.createElement('canvas');
    canvas.id = 'spectrumCanvas';
    canvas.width = 560;
    canvas.height = 200;
    canvas.style.cssText = 'background: #0a0a14; border-radius: 4px;';
    canvasContainer.appendChild(canvas);
    
    container.appendChild(canvasContainer);
    
    // Legend
    const legendContainer = document.createElement('div');
    legendContainer.id = 'legendContainer';
    legendContainer.style.cssText = 'display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;';
    container.appendChild(legendContainer);
    
    // Track selection
    const trackSelectionContainer = document.createElement('div');
    trackSelectionContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    trackSelectionContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Add Tracks to Compare (max 4)</div>
        <div id="trackList" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
    `;
    container.appendChild(trackSelectionContainer);
    
    // Band comparison
    const bandContainer = document.createElement('div');
    bandContainer.id = 'bandContainer';
    bandContainer.style.cssText = 'margin-bottom: 16px;';
    container.appendChild(bandContainer);
    
    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'display: flex; gap: 8px;';
    actionsContainer.innerHTML = `
        <button id="startBtn" style="flex: 1; padding: 10px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
            Start Comparison
        </button>
        <button id="stopBtn" style="flex: 1; padding: 10px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600; display: none;">
            Stop
        </button>
        <button id="exportBtn" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Export Stats
        </button>
    `;
    container.appendChild(actionsContainer);
    
    const ctx = canvas.getContext('2d');
    let isRunning = false;
    
    // Update track list
    function updateTrackList() {
        const trackList = document.getElementById('trackList');
        const tracks = appServices?.getTracks?.() || [];
        
        trackList.innerHTML = tracks.map(track => {
            const isSelected = comparison.selectedTracks.includes(track.id);
            return `
                <button class="track-btn" data-track-id="${track.id}" style="
                    padding: 6px 12px;
                    background: ${isSelected ? '#22c55e' : '#374151'};
                    border: none;
                    border-radius: 4px;
                    color: white;
                    cursor: pointer;
                ">
                    ${track.name || `Track ${track.id}`}
                </button>
            `;
        }).join('');
        
        // Add event listeners
        trackList.querySelectorAll('.track-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const trackId = parseInt(btn.dataset.trackId);
                const track = tracks.find(t => t.id === trackId);
                
                if (comparison.selectedTracks.includes(trackId)) {
                    comparison.removeTrack(trackId);
                } else if (track?.gainNode) {
                    comparison.addTrack(trackId, track.gainNode, track.name || `Track ${trackId}`);
                }
                
                updateTrackList();
                updateLegend();
            });
        });
    }
    
    // Update legend
    function updateLegend() {
        const legendContainer = document.getElementById('legendContainer');
        legendContainer.innerHTML = comparison.selectedTracks.map((trackId, index) => {
            const data = comparison.trackAnalyzers.get(trackId);
            const color = data?.color || comparison.colorSchemes[comparison.colorScheme][index];
            return `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 12px; height: 12px; background: ${color}; border-radius: 2px;"></div>
                    <span>${data?.name || `Track ${trackId}`}</span>
                </div>
            `;
        }).join('');
    }
    
    // Draw spectrum
    function drawSpectrum() {
        if (!isRunning) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const width = canvas.width;
        const height = canvas.height;
        const numBins = 1024;
        
        // Draw grid
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        
        // Frequency lines
        const freqLabels = [100, 500, 1000, 5000, 10000];
        freqLabels.forEach(freq => {
            const x = freqToX(freq, width, numBins, comparison.audioContext.sampleRate);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px system-ui';
            ctx.fillText(`${freq >= 1000 ? freq/1000 + 'k' : freq}Hz`, x + 2, height - 4);
        });
        
        // Draw spectra based on mode
        if (comparison.comparisonMode === 'overlay') {
            for (const [trackId, trackData] of comparison.trackAnalyzers) {
                if (!trackData.visible) continue;
                
                ctx.beginPath();
                ctx.strokeStyle = trackData.color;
                ctx.lineWidth = 2;
                
                const data = trackData.frequencyData;
                for (let i = 0; i < Math.min(data.length, numBins); i++) {
                    const x = (i / numBins) * width;
                    const y = height - (data[i] / 255) * height;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
            }
        } else if (comparison.comparisonMode === 'side-by-side') {
            const numTracks = comparison.selectedTracks.length;
            if (numTracks > 0) {
                const sectionWidth = width / numTracks;
                
                comparison.selectedTracks.forEach((trackId, index) => {
                    const trackData = comparison.trackAnalyzers.get(trackId);
                    if (!trackData) return;
                    
                    ctx.save();
                    ctx.translate(index * sectionWidth, 0);
                    ctx.beginPath();
                    ctx.strokeStyle = trackData.color;
                    ctx.lineWidth = 2;
                    
                    const data = trackData.frequencyData;
                    for (let i = 0; i < Math.min(data.length, numBins); i++) {
                        const x = (i / numBins) * sectionWidth;
                        const y = height - (data[i] / 255) * height;
                        
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    ctx.stroke();
                    ctx.restore();
                    
                    // Label
                    ctx.fillStyle = trackData.color;
                    ctx.font = '12px system-ui';
                    ctx.fillText(trackData.name, index * sectionWidth + 4, 16);
                });
            }
        } else if (comparison.comparisonMode === 'difference' && comparison.selectedTracks.length >= 2) {
            const diff = comparison.getSpectrumDifference(comparison.selectedTracks[0], comparison.selectedTracks[1]);
            
            if (diff) {
                ctx.beginPath();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                
                const maxDiff = 255;
                for (let i = 0; i < Math.min(diff.length, numBins); i++) {
                    const x = (i / numBins) * width;
                    const y = height / 2 - (diff[i] / maxDiff) * (height / 2);
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                
                // Center line
                ctx.strokeStyle = '#6b7280';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, height / 2);
                ctx.lineTo(width, height / 2);
                ctx.stroke();
            }
        }
        
        // Update band comparison
        updateBandComparison();
        
        requestAnimationFrame(drawSpectrum);
    }
    
    function freqToX(freq, width, numBins, sampleRate) {
        const minFreq = 20;
        const maxFreq = sampleRate / 2;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const logFreq = Math.log10(freq);
        
        return ((logFreq - logMin) / (logMax - logMin)) * width;
    }
    
    // Update band comparison display
    function updateBandComparison() {
        const bandContainer = document.getElementById('bandContainer');
        
        if (comparison.selectedTracks.length < 2) {
            bandContainer.innerHTML = '';
            return;
        }
        
        const bandComparison = comparison.compareBandLevels(
            comparison.selectedTracks[0],
            comparison.selectedTracks[1]
        );
        
        if (!bandComparison) {
            bandContainer.innerHTML = '';
            return;
        }
        
        const bandNames = {
            sub: 'Sub',
            bass: 'Bass',
            lowMid: 'Low-Mid',
            mid: 'Mid',
            highMid: 'High-Mid',
            presence: 'Presence',
            brilliance: 'Brilliance'
        };
        
        bandContainer.innerHTML = `
            <div style="font-size: 14px; color: #9ca3af; margin-bottom: 8px;">Band Comparison</div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
                ${Object.entries(bandComparison).map(([band, data]) => {
                    const diffColor = data.difference > 0 ? '#22c55e' : data.difference < 0 ? '#ef4444' : '#6b7280';
                    return `
                        <div style="text-align: center; padding: 8px; background: #0a0a14; border-radius: 4px;">
                            <div style="font-size: 10px; color: #9ca3af;">${bandNames[band]}</div>
                            <div style="font-size: 12px; color: ${diffColor};">
                                ${data.difference > 0 ? '+' : ''}${data.difference.toFixed(0)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // Event handlers
    document.getElementById('comparisonMode').addEventListener('change', (e) => {
        comparison.setComparisonMode(e.target.value);
    });
    
    document.getElementById('colorScheme').addEventListener('change', (e) => {
        comparison.setColorScheme(e.target.value);
        updateLegend();
    });
    
    document.getElementById('startBtn').addEventListener('click', () => {
        if (comparison.selectedTracks.length < 1) {
            appServices?.showNotification?.('Add at least 1 track to compare', 2000);
            return;
        }
        
        isRunning = true;
        comparison.start();
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'block';
        drawSpectrum();
    });
    
    document.getElementById('stopBtn').addEventListener('click', () => {
        isRunning = false;
        comparison.stop();
        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('stopBtn').style.display = 'none';
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => {
        const stats = comparison.getStatistics();
        const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spectrum-comparison.json';
        a.click();
        
        URL.revokeObjectURL(url);
        appServices?.showNotification?.('Exported spectrum statistics', 2000);
    });
    
    // Initialize
    updateTrackList();
    
    return container;
}

// Factory function
export function createAudioSpectrumComparison(audioContext, options = {}) {
    return new AudioSpectrumComparison(audioContext, options);
}

export default AudioSpectrumComparison;