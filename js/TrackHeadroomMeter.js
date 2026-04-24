/**
 * Track Headroom Meter
 * Per-track headroom display for mixing
 */

class TrackHeadroomMeter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            peakHoldTime: options.peakHoldTime || 2000, // ms
            integrationTime: options.integrationTime || 300, // ms for RMS
            targetLevel: options.targetLevel || -18, // dB target headroom
            warningLevel: options.warningLevel || -6, // dB warning threshold
            clipLevel: options.clipLevel || -0.3, // dB clip threshold
            updateInterval: options.updateInterval || 50, // ms
        };
        
        // State
        this.tracks = new Map();
        this.isRunning = false;
        
        // Master meters
        this.masterPeak = -Infinity;
        this.masterRms = -Infinity;
        this.masterPeakTime = 0;
    }
    
    // Add a track to monitor
    addTrack(trackId, options = {}) {
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = 2048;
        analyzer.smoothingTimeConstant = 0;
        
        const trackMeter = {
            id: trackId,
            analyzer,
            peak: -Infinity,
            rms: -Infinity,
            peakTime: 0,
            history: [],
            maxHistoryLength: 100,
            name: options.name || `Track ${trackId}`,
            color: options.color || '#10b981',
        };
        
        this.tracks.set(trackId, trackMeter);
        return analyzer;
    }
    
    // Remove a track
    removeTrack(trackId) {
        const meter = this.tracks.get(trackId);
        if (meter) {
            meter.analyzer.disconnect();
            this.tracks.delete(trackId);
        }
    }
    
    // Get headroom data for a track
    getTrackHeadroom(trackId) {
        const meter = this.tracks.get(trackId);
        if (!meter) return null;
        
        const analyzer = meter.analyzer;
        const dataArray = new Float32Array(analyzer.fftSize);
        analyzer.getFloatTimeDomainData(dataArray);
        
        // Calculate peak
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const abs = Math.abs(dataArray[i]);
            if (abs > peak) peak = abs;
        }
        const peakDb = 20 * Math.log10(peak + 0.00001);
        
        // Calculate RMS
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const rmsDb = 20 * Math.log10(rms + 0.00001);
        
        // Update peak with hold
        const now = Date.now();
        if (peakDb > meter.peak || now - meter.peakTime > this.config.peakHoldTime) {
            meter.peak = peakDb;
            meter.peakTime = now;
        }
        
        meter.rms = rmsDb;
        
        // Add to history
        meter.history.push({ peak: meter.peak, rms: meter.rms, time: now });
        if (meter.history.length > meter.maxHistoryLength) {
            meter.history.shift();
        }
        
        // Calculate headroom (distance from 0 dBFS)
        const headroom = 0 - meter.peak;
        
        return {
            id: trackId,
            name: meter.name,
            color: meter.color,
            peak: meter.peak,
            rms: meter.rms,
            headroom,
            targetHeadroom: this.config.targetLevel,
            isClipping: meter.peak > this.config.clipLevel,
            isWarning: meter.peak > this.config.warningLevel,
            isGood: headroom >= Math.abs(this.config.targetLevel),
        };
    }
    
    // Get all track headrooms
    getAllHeadrooms() {
        const headrooms = [];
        for (const trackId of this.tracks.keys()) {
            headrooms.push(this.getTrackHeadroom(trackId));
        }
        return headrooms;
    }
    
    // Update master meter
    updateMasterMeter(analyzer) {
        const dataArray = new Float32Array(analyzer.fftSize);
        analyzer.getFloatTimeDomainData(dataArray);
        
        // Calculate peak
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const abs = Math.abs(dataArray[i]);
            if (abs > peak) peak = abs;
        }
        const peakDb = 20 * Math.log10(peak + 0.00001);
        
        // Calculate RMS
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const rmsDb = 20 * Math.log10(rms + 0.00001);
        
        // Update peak with hold
        const now = Date.now();
        if (peakDb > this.masterPeak || now - this.masterPeakTime > this.config.peakHoldTime) {
            this.masterPeak = peakDb;
            this.masterPeakTime = now;
        }
        
        this.masterRms = rmsDb;
        
        return {
            peak: this.masterPeak,
            rms: this.masterRms,
            headroom: 0 - this.masterPeak,
            isClipping: this.masterPeak > this.config.clipLevel,
            isWarning: this.masterPeak > this.config.warningLevel,
        };
    }
    
    // Create UI panel
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'track-headroom-meter-panel';
        panel.innerHTML = `
            <style>
                .track-headroom-meter-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .thm-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                }
                .thm-master {
                    background: #0a0a14;
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 16px;
                }
                .thm-master-title {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .thm-meter {
                    display: flex;
                    height: 24px;
                    background: #1a1a2e;
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                }
                .thm-meter-fill {
                    height: 100%;
                    transition: width 0.05s;
                }
                .thm-meter-peak {
                    position: absolute;
                    right: 0;
                    top: 0;
                    width: 3px;
                    height: 100%;
                    background: #fff;
                }
                .thm-meter-labels {
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #666;
                    margin-top: 2px;
                }
                .thm-tracks {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .thm-track {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: #0a0a14;
                    border-radius: 4px;
                    padding: 8px 12px;
                }
                .thm-track-color {
                    width: 4px;
                    height: 40px;
                    border-radius: 2px;
                }
                .thm-track-info {
                    flex: 1;
                }
                .thm-track-name {
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 4px;
                }
                .thm-track-meter {
                    height: 16px;
                    background: #1a1a2e;
                    border-radius: 3px;
                    overflow: hidden;
                    position: relative;
                }
                .thm-track-values {
                    display: flex;
                    gap: 12px;
                    font-size: 11px;
                    color: #888;
                }
                .thm-value {
                    font-family: monospace;
                }
                .thm-good { color: #10b981; }
                .thm-warning { color: #f59e0b; }
                .thm-clip { color: #ef4444; }
                .thm-target-marker {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: rgba(16, 185, 129, 0.5);
                }
            </style>
            
            <div class="thm-header">Track Headroom Meter</div>
            
            <div class="thm-master">
                <div class="thm-master-title">MASTER</div>
                <div class="thm-meter" id="thm-master-meter">
                    <div class="thm-meter-fill" id="thm-master-fill"></div>
                    <div class="thm-meter-peak" id="thm-master-peak"></div>
                </div>
                <div class="thm-meter-labels">
                    <span>-60 dB</span>
                    <span>-18 dB</span>
                    <span>-6 dB</span>
                    <span>0 dB</span>
                </div>
                <div class="thm-track-values" id="thm-master-values"></div>
            </div>
            
            <div class="thm-tracks" id="thm-tracks"></div>
        `;
        
        container.appendChild(panel);
        this.panel = panel;
        
        return panel;
    }
    
    // Start monitoring loop
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._monitor();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    _monitor() {
        if (!this.isRunning || !this.panel) return;
        
        const tracksContainer = this.panel.querySelector('#thm-tracks');
        const masterFill = this.panel.querySelector('#thm-master-fill');
        const masterPeak = this.panel.querySelector('#thm-master-peak');
        const masterValues = this.panel.querySelector('#thm-master-values');
        
        // Update track meters
        const headrooms = this.getAllHeadrooms();
        
        // Clear and rebuild track displays
        tracksContainer.innerHTML = '';
        
        for (const headroom of headrooms) {
            if (!headroom) continue;
            
            const trackEl = document.createElement('div');
            trackEl.className = 'thm-track';
            
            // Calculate meter width (0 dB = 100%, -60 dB = 0%)
            const peakPercent = Math.max(0, Math.min(100, (60 + headroom.peak) / 60 * 100));
            const rmsPercent = Math.max(0, Math.min(100, (60 + headroom.rms) / 60 * 100));
            const targetPercent = (60 + this.config.targetLevel) / 60 * 100;
            
            const statusClass = headroom.isClipping ? 'thm-clip' : headroom.isWarning ? 'thm-warning' : 'thm-good';
            
            trackEl.innerHTML = `
                <div class="thm-track-color" style="background: ${headroom.color}"></div>
                <div class="thm-track-info">
                    <div class="thm-track-name">${headroom.name}</div>
                    <div class="thm-track-meter">
                        <div class="thm-meter-fill ${statusClass}" style="width: ${rmsPercent}%"></div>
                        <div class="thm-target-marker" style="left: ${targetPercent}%"></div>
                    </div>
                    <div class="thm-track-values">
                        <span class="thm-value ${statusClass}">Peak: ${headroom.peak.toFixed(1)} dB</span>
                        <span class="thm-value">RMS: ${headroom.rms.toFixed(1)} dB</span>
                        <span class="thm-value">Headroom: ${headroom.headroom.toFixed(1)} dB</span>
                    </div>
                </div>
            `;
            
            tracksContainer.appendChild(trackEl);
        }
        
        setTimeout(() => this._monitor(), this.config.updateInterval);
    }
    
    destroy() {
        this.stop();
        for (const meter of this.tracks.values()) {
            meter.analyzer.disconnect();
        }
        this.tracks.clear();
    }
}

// Export for use in main DAW
export function createTrackHeadroomMeter(audioContext, options = {}) {
    return new TrackHeadroomMeter(audioContext, options);
}

export function openTrackHeadroomMeterPanel(services = {}) {
    const { audioContext, container, tracks } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for Track Headroom Meter panel');
        return null;
    }
    
    const meter = new TrackHeadroomMeter(audioContext);
    
    // Add tracks if provided
    if (tracks && Array.isArray(tracks)) {
        for (const track of tracks) {
            meter.addTrack(track.id, { name: track.name, color: track.color });
        }
    }
    
    const panel = meter.createPanel(container);
    meter.start();
    
    return { meter, panel };
}