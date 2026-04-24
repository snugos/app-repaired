/**
 * Clipping Detection
 * Visual clip indicator on meters
 */

class ClippingDetection {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            threshold: options.threshold || -0.3, // dB below 0
            holdTime: options.holdTime || 2000, // ms to show clip indicator
            sampleThreshold: options.sampleThreshold || 0.99, // Sample value threshold
            windowSize: options.windowSize || 2048, // Samples to analyze
            autoReset: options.autoReset ?? true,
            showHistory: options.showHistory ?? true,
        };
        
        // State
        this.channels = new Map();
        this.isRunning = false;
        this.clipHistory = [];
        this.maxHistorySize = 100;
    }
    
    // Add a channel to monitor
    addChannel(channelId, options = {}) {
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = this.config.windowSize;
        analyzer.smoothingTimeConstant = 0;
        
        const channel = {
            id: channelId,
            name: options.name || `Channel ${channelId}`,
            analyzer,
            isClipping: false,
            lastClipTime: 0,
            peakSinceReset: -Infinity,
            clipCount: 0,
            color: options.color || '#ef4444',
        };
        
        this.channels.set(channelId, channel);
        return analyzer;
    }
    
    // Remove a channel
    removeChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.analyzer.disconnect();
            this.channels.delete(channelId);
        }
    }
    
    // Check for clipping
    checkClipping() {
        const now = Date.now();
        const results = [];
        
        for (const channel of this.channels.values()) {
            const analyzer = channel.analyzer;
            const data = new Float32Array(analyzer.fftSize);
            analyzer.getFloatTimeDomainData(data);
            
            // Find peak
            let peak = 0;
            let clipSamples = 0;
            
            for (let i = 0; i < data.length; i++) {
                const abs = Math.abs(data[i]);
                if (abs > peak) peak = abs;
                if (abs >= this.config.sampleThreshold) clipSamples++;
            }
            
            // Check for clipping
            const isClipping = peak >= this.config.sampleThreshold;
            const peakDb = 20 * Math.log10(peak + 0.00001);
            
            // Update state
            if (peak > channel.peakSinceReset) {
                channel.peakSinceReset = peak;
            }
            
            if (isClipping) {
                channel.isClipping = true;
                channel.lastClipTime = now;
                channel.clipCount++;
                
                // Add to history
                this.clipHistory.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    time: now,
                    peak: peak,
                    peakDb: peakDb,
                    clipSamples: clipSamples,
                });
                
                // Trim history
                if (this.clipHistory.length > this.maxHistorySize) {
                    this.clipHistory.shift();
                }
            } else if (channel.isClipping && now - channel.lastClipTime > this.config.holdTime) {
                channel.isClipping = false;
            }
            
            results.push({
                id: channel.id,
                name: channel.name,
                peak: peak,
                peakDb: peakDb,
                isClipping: channel.isClipping,
                clipCount: channel.clipCount,
                peakSinceReset: channel.peakSinceReset,
                isNearClipping: peakDb > this.config.threshold && !isClipping,
            });
        }
        
        return results;
    }
    
    // Reset peak readings
    resetPeaks() {
        for (const channel of this.channels.values()) {
            channel.peakSinceReset = -Infinity;
            channel.clipCount = 0;
        }
        this.clipHistory = [];
    }
    
    // Get clip history
    getClipHistory() {
        return [...this.clipHistory];
    }
    
    // Start monitoring
    start() {
        this.isRunning = true;
    }
    
    // Stop monitoring
    stop() {
        this.isRunning = false;
    }
    
    // Create UI panel
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'clipping-detection-panel';
        panel.innerHTML = `
            <style>
                .clipping-detection-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .cdp-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .cdp-global-clip {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    background: #0a0a14;
                    border-radius: 4px;
                    font-size: 12px;
                }
                .cdp-clip-indicator {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #333;
                }
                .cdp-clip-indicator.clipping {
                    background: #ef4444;
                    animation: cdp-blink 0.5s infinite;
                }
                @keyframes cdp-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                .cdp-section {
                    margin-bottom: 16px;
                }
                .cdp-label {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .cdp-channels {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .cdp-channel {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: #0a0a14;
                    border-radius: 6px;
                    padding: 12px;
                }
                .cdp-channel-indicator {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #333;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 14px;
                }
                .cdp-channel-indicator.clipping {
                    background: #ef4444;
                    animation: cdp-blink 0.5s infinite;
                }
                .cdp-channel-indicator.warning {
                    background: #f59e0b;
                }
                .cdp-channel-indicator.ok {
                    background: #10b981;
                }
                .cdp-channel-info {
                    flex: 1;
                }
                .cdp-channel-name {
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 4px;
                }
                .cdp-channel-meter {
                    height: 8px;
                    background: #1a1a2e;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .cdp-channel-meter-fill {
                    height: 100%;
                    background: #10b981;
                    transition: width 0.05s, background 0.1s;
                }
                .cdp-channel-meter-fill.warning {
                    background: #f59e0b;
                }
                .cdp-channel-meter-fill.clipping {
                    background: #ef4444;
                }
                .cdp-channel-stats {
                    font-size: 11px;
                    color: #888;
                    display: flex;
                    gap: 12px;
                    margin-top: 4px;
                }
                .cdp-stat {
                    font-family: monospace;
                }
                .cdp-history {
                    background: #0a0a14;
                    border-radius: 6px;
                    padding: 12px;
                    max-height: 150px;
                    overflow-y: auto;
                }
                .cdp-history-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 6px 0;
                    border-bottom: 1px solid #1a1a2e;
                    font-size: 11px;
                }
                .cdp-history-item:last-child {
                    border-bottom: none;
                }
                .cdp-btn {
                    padding: 10px 16px;
                    background: #10b981;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                }
                .cdp-btn:hover { background: #059669; }
                .cdp-btn-secondary {
                    background: #333;
                }
                .cdp-btn-secondary:hover { background: #444; }
                .cdp-btn-danger {
                    background: #ef4444;
                }
                .cdp-btn-danger:hover { background: #dc2626; }
            </style>
            
            <div class="cdp-header">
                <span>Clipping Detection</span>
                <div class="cdp-global-clip">
                    <div class="cdp-clip-indicator" id="cdp-global-indicator"></div>
                    <span id="cdp-global-status">OK</span>
                </div>
            </div>
            
            <div class="cdp-section">
                <div class="cdp-label">Channels</div>
                <div class="cdp-channels" id="cdp-channels"></div>
            </div>
            
            <div class="cdp-section">
                <div class="cdp-label">Clip History</div>
                <div class="cdp-history" id="cdp-history">
                    <div style="color: #666; font-size: 11px;">No clips recorded</div>
                </div>
            </div>
            
            <div class="cdp-section">
                <button class="cdp-btn cdp-btn-secondary" id="cdp-reset">Reset Peaks</button>
                <button class="cdp-btn cdp-btn-danger" id="cdp-clear-history" style="margin-left: 8px;">Clear History</button>
            </div>
        `;
        
        container.appendChild(panel);
        this.panel = panel;
        
        // Event handlers
        panel.querySelector('#cdp-reset').addEventListener('click', () => {
            this.resetPeaks();
        });
        
        panel.querySelector('#cdp-clear-history').addEventListener('click', () => {
            this.clipHistory = [];
            this._updateHistory();
        });
        
        // Start monitoring
        this.start();
        this._monitor();
        
        return panel;
    }
    
    _monitor() {
        if (!this.isRunning || !this.panel) return;
        
        const results = this.checkClipping();
        
        // Update global indicator
        const anyClipping = results.some(r => r.isClipping);
        const globalIndicator = this.panel.querySelector('#cdp-global-indicator');
        const globalStatus = this.panel.querySelector('#cdp-global-status');
        
        globalIndicator.classList.toggle('clipping', anyClipping);
        globalStatus.textContent = anyClipping ? 'CLIPPING!' : 'OK';
        globalStatus.style.color = anyClipping ? '#ef4444' : '#10b981';
        
        // Update channel displays
        const channelsContainer = this.panel.querySelector('#cdp-channels');
        channelsContainer.innerHTML = results.map(r => {
            const meterWidth = Math.min(100, (60 + r.peakDb) / 60 * 100);
            const statusClass = r.isClipping ? 'clipping' : r.isNearClipping ? 'warning' : 'ok';
            const meterClass = r.isClipping ? 'clipping' : r.isNearClipping ? 'warning' : '';
            
            return `
                <div class="cdp-channel">
                    <div class="cdp-channel-indicator ${statusClass}">
                        ${r.isClipping ? '!' : r.isNearClipping ? '⚠' : '✓'}
                    </div>
                    <div class="cdp-channel-info">
                        <div class="cdp-channel-name">${r.name}</div>
                        <div class="cdp-channel-meter">
                            <div class="cdp-channel-meter-fill ${meterClass}" style="width: ${meterWidth}%"></div>
                        </div>
                        <div class="cdp-channel-stats">
                            <span class="cdp-stat">Peak: ${r.peakDb.toFixed(1)} dB</span>
                            <span class="cdp-stat">Clips: ${r.clipCount}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update history
        this._updateHistory();
        
        setTimeout(() => this._monitor(), 50);
    }
    
    _updateHistory() {
        const historyContainer = this.panel.querySelector('#cdp-history');
        
        if (this.clipHistory.length === 0) {
            historyContainer.innerHTML = '<div style="color: #666; font-size: 11px;">No clips recorded</div>';
            return;
        }
        
        historyContainer.innerHTML = this.clipHistory.slice(-10).reverse().map(item => {
            const time = new Date(item.time);
            const timeStr = time.toLocaleTimeString();
            
            return `
                <div class="cdp-history-item">
                    <span>${item.channelName}</span>
                    <span style="color: #ef4444;">${item.peakDb.toFixed(1)} dB</span>
                    <span style="color: #666;">${timeStr}</span>
                </div>
            `;
        }).join('');
    }
    
    destroy() {
        this.stop();
        for (const channel of this.channels.values()) {
            channel.analyzer.disconnect();
        }
        this.channels.clear();
    }
}

// Export for use in main DAW
export function createClippingDetection(audioContext, options = {}) {
    return new ClippingDetection(audioContext, options);
}

export function openClippingDetectionPanel(services = {}) {
    const { audioContext, container, channels } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for Clipping Detection panel');
        return null;
    }
    
    const detector = new ClippingDetection(audioContext);
    
    // Add channels if provided
    if (channels && Array.isArray(channels)) {
        for (const ch of channels) {
            detector.addChannel(ch.id, { name: ch.name, color: ch.color });
        }
    }
    
    return detector.createPanel(container);
}