/**
 * DC Offset Removal
 * High-pass filter at 20Hz to remove DC offset
 */

class DCOffsetRemoval {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            cutoffFrequency: options.cutoffFrequency || 20, // Hz
            q: options.q || 0.707, // Quality factor
            enabled: options.enabled ?? true,
        };
        
        // Create filter chain
        this.inputNode = audioContext.createGain();
        this.filter = audioContext.createBiquadFilter();
        this.outputNode = audioContext.createGain();
        
        // Configure filter
        this.filter.type = 'highpass';
        this.filter.frequency.value = this.config.cutoffFrequency;
        this.filter.Q.value = this.config.q;
        
        // Connect
        this.inputNode.connect(this.filter);
        this.filter.connect(this.outputNode);
    }
    
    // Connect to source
    connect(source) {
        source.connect(this.inputNode);
        return this.outputNode;
    }
    
    // Connect to destination
    connectTo(destination) {
        this.outputNode.connect(destination);
        return this;
    }
    
    // Disconnect
    disconnect() {
        this.inputNode.disconnect();
        this.filter.disconnect();
        this.outputNode.disconnect();
    }
    
    // Enable/disable
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (enabled) {
            this.filter.frequency.value = this.config.cutoffFrequency;
        } else {
            // Bypass by setting frequency to 0
            this.filter.frequency.value = 0;
        }
    }
    
    // Toggle
    toggle() {
        const newState = !this.config.enabled;
        this.setEnabled(newState);
        return newState;
    }
    
    // Set cutoff frequency
    setCutoffFrequency(freq) {
        if (freq >= 1 && freq <= 200) {
            this.config.cutoffFrequency = freq;
            if (this.config.enabled) {
                this.filter.frequency.value = freq;
            }
        }
    }
    
    // Get current settings
    getSettings() {
        return {
            enabled: this.config.enabled,
            cutoffFrequency: this.config.cutoffFrequency,
            q: this.config.q,
        };
    }
    
    // Static method to detect DC offset in a buffer
    static detectDCOffset(buffer) {
        let totalOffset = 0;
        let totalSamples = 0;
        
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i];
            }
            totalOffset += sum / data.length;
            totalSamples++;
        }
        
        return totalOffset / totalSamples;
    }
    
    // Static method to remove DC offset from a buffer
    static async removeDCOffsetFromBuffer(audioContext, buffer) {
        const offlineCtx = new OfflineAudioContext(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        
        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 20;
        filter.Q.value = 0.707;
        
        source.connect(filter);
        filter.connect(offlineCtx.destination);
        source.start(0);
        
        return offlineCtx.startRendering();
    }
    
    // Create UI panel
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'dc-offset-removal-panel';
        panel.innerHTML = `
            <style>
                .dc-offset-removal-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .dorp-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                }
                .dorp-section {
                    margin-bottom: 16px;
                }
                .dorp-label {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .dorp-control {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                }
                .dorp-slider {
                    flex: 1;
                    -webkit-appearance: none;
                    height: 6px;
                    background: #333;
                    border-radius: 3px;
                    outline: none;
                }
                .dorp-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    background: #10b981;
                    border-radius: 50%;
                    cursor: pointer;
                }
                .dorp-value {
                    font-family: monospace;
                    font-size: 13px;
                    min-width: 60px;
                    text-align: right;
                }
                .dorp-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .dorp-switch {
                    position: relative;
                    width: 50px;
                    height: 26px;
                    background: #333;
                    border-radius: 13px;
                    cursor: pointer;
                    transition: background 0.3s;
                }
                .dorp-switch.active {
                    background: #10b981;
                }
                .dorp-switch-thumb {
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    width: 20px;
                    height: 20px;
                    background: #fff;
                    border-radius: 50%;
                    transition: transform 0.3s;
                }
                .dorp-switch.active .dorp-switch-thumb {
                    transform: translateX(24px);
                }
                .dorp-info {
                    background: #0a0a14;
                    border-radius: 6px;
                    padding: 12px;
                    font-size: 12px;
                    color: #888;
                }
                .dorp-info-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }
                .dorp-btn {
                    padding: 10px 16px;
                    background: #10b981;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                }
                .dorp-btn:hover { background: #059669; }
                .dorp-btn-secondary {
                    background: #333;
                }
                .dorp-btn-secondary:hover { background: #444; }
            </style>
            
            <div class="dorp-header">DC Offset Removal</div>
            
            <div class="dorp-section">
                <div class="dorp-toggle">
                    <div class="dorp-switch ${this.config.enabled ? 'active' : ''}" id="dorp-switch">
                        <div class="dorp-switch-thumb"></div>
                    </div>
                    <span>${this.config.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
            </div>
            
            <div class="dorp-section">
                <div class="dorp-label">Cutoff Frequency</div>
                <div class="dorp-control">
                    <input type="range" class="dorp-slider" id="dorp-cutoff" min="1" max="100" value="${this.config.cutoffFrequency}">
                    <span class="dorp-value" id="dorp-cutoff-value">${this.config.cutoffFrequency} Hz</span>
                </div>
            </div>
            
            <div class="dorp-section">
                <div class="dorp-label">Quality Factor (Q)</div>
                <div class="dorp-control">
                    <input type="range" class="dorp-slider" id="dorp-q" min="0.1" max="10" step="0.1" value="${this.config.q}">
                    <span class="dorp-value" id="dorp-q-value">${this.config.q.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="dorp-section">
                <div class="dorp-info">
                    <div class="dorp-info-item">
                        <span>Filter Type:</span>
                        <span>High-Pass</span>
                    </div>
                    <div class="dorp-info-item">
                        <span>Typical DC Offset:</span>
                        <span id="dorp-dc-value">Not measured</span>
                    </div>
                </div>
            </div>
            
            <div class="dorp-section">
                <button class="dorp-btn" id="dorp-measure">Measure DC Offset</button>
            </div>
        `;
        
        container.appendChild(panel);
        
        // Event handlers
        const switchEl = panel.querySelector('#dorp-switch');
        const switchLabel = switchEl.nextElementSibling;
        
        switchEl.addEventListener('click', () => {
            const active = this.toggle();
            switchEl.classList.toggle('active', active);
            switchLabel.textContent = active ? 'Enabled' : 'Disabled';
        });
        
        const cutoffSlider = panel.querySelector('#dorp-cutoff');
        const cutoffValue = panel.querySelector('#dorp-cutoff-value');
        
        cutoffSlider.addEventListener('input', () => {
            const freq = parseFloat(cutoffSlider.value);
            this.setCutoffFrequency(freq);
            cutoffValue.textContent = `${freq} Hz`;
        });
        
        const qSlider = panel.querySelector('#dorp-q');
        const qValue = panel.querySelector('#dorp-q-value');
        
        qSlider.addEventListener('input', () => {
            const q = parseFloat(qSlider.value);
            this.config.q = q;
            this.filter.Q.value = q;
            qValue.textContent = q.toFixed(2);
        });
        
        panel.querySelector('#dorp-measure').addEventListener('click', async () => {
            // Create an analyzer to measure DC offset
            const analyzer = this.audioContext.createAnalyser();
            analyzer.fftSize = 2048;
            this.inputNode.connect(analyzer);
            
            const data = new Float32Array(analyzer.fftSize);
            analyzer.getFloatTimeDomainData(data);
            
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i];
            }
            const dcOffset = sum / data.length;
            
            panel.querySelector('#dorp-dc-value').textContent = `${(dcOffset * 100).toFixed(4)}%`;
            
            analyzer.disconnect();
        });
        
        return panel;
    }
    
    // Get nodes for connection
    get input() {
        return this.inputNode;
    }
    
    get output() {
        return this.outputNode;
    }
}

// Export for use in main DAW
export function createDCOffsetRemoval(audioContext, options = {}) {
    return new DCOffsetRemoval(audioContext, options);
}

export function openDCOffsetRemovalPanel(services = {}) {
    const { audioContext, container } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for DC Offset Removal panel');
        return null;
    }
    
    const dcRemoval = new DCOffsetRemoval(audioContext);
    return dcRemoval.createPanel(container);
}