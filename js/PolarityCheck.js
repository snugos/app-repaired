/**
 * Polarity Check
 * Automatic polarity detection for recordings
 */

class PolarityCheck {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            analysisDuration: options.analysisDuration || 1000, // ms
            correlationThreshold: options.correlationThreshold || 0.5,
            autoCorrect: options.autoCorrect ?? false,
        };
        
        // State
        this.analyzers = new Map();
        this.recordings = new Map();
    }
    
    // Add a recording to analyze
    addRecording(recordingId, audioBuffer, options = {}) {
        const recording = {
            id: recordingId,
            buffer: audioBuffer,
            name: options.name || `Recording ${recordingId}`,
            polarity: null,
            correlation: null,
            issues: [],
        };
        
        this.recordings.set(recordingId, recording);
        return recording;
    }
    
    // Analyze polarity of a recording
    async analyzeRecording(recordingId) {
        const recording = this.recordings.get(recordingId);
        if (!recording) return null;
        
        const buffer = recording.buffer;
        const issues = [];
        
        // Check DC offset
        const dcOffset = this._detectDCOffset(buffer);
        if (Math.abs(dcOffset) > 0.01) {
            issues.push({
                type: 'dc_offset',
                severity: 'warning',
                value: dcOffset,
                message: `DC offset detected: ${dcOffset.toFixed(4)}`
            });
        }
        
        // Check stereo polarity (if applicable)
        if (buffer.numberOfChannels >= 2) {
            const correlation = this._calculateCorrelation(
                buffer.getChannelData(0),
                buffer.getChannelData(1)
            );
            
            recording.correlation = correlation;
            
            if (correlation < -this.config.correlationThreshold) {
                issues.push({
                    type: 'polarity_inversion',
                    severity: 'critical',
                    value: correlation,
                    message: 'Channels are out of phase (polarity inverted)'
                });
                recording.polarity = 'inverted';
            } else if (correlation < this.config.correlationThreshold) {
                issues.push({
                    type: 'phase_issue',
                    severity: 'warning',
                    value: correlation,
                    message: `Low phase correlation: ${correlation.toFixed(2)}`
                });
                recording.polarity = 'partial';
            } else {
                recording.polarity = 'normal';
            }
        } else {
            // Mono - check overall polarity characteristics
            const monoData = buffer.getChannelData(0);
            const asymmetry = this._calculateAsymmetry(monoData);
            
            if (Math.abs(asymmetry) > 0.1) {
                issues.push({
                    type: 'waveform_asymmetry',
                    severity: 'info',
                    value: asymmetry,
                    message: `Waveform asymmetry detected: ${(asymmetry * 100).toFixed(1)}%`
                });
            }
            
            recording.polarity = 'normal';
        }
        
        recording.issues = issues;
        return recording;
    }
    
    // Analyze all recordings
    async analyzeAll() {
        const results = [];
        for (const recordingId of this.recordings.keys()) {
            const result = await this.analyzeRecording(recordingId);
            if (result) results.push(result);
        }
        return results;
    }
    
    // Detect DC offset
    _detectDCOffset(buffer) {
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
    
    // Calculate correlation between two channels
    _calculateCorrelation(channel1, channel2) {
        const length = Math.min(channel1.length, channel2.length);
        
        // Calculate means
        let mean1 = 0, mean2 = 0;
        for (let i = 0; i < length; i++) {
            mean1 += channel1[i];
            mean2 += channel2[i];
        }
        mean1 /= length;
        mean2 /= length;
        
        // Calculate covariance and variances
        let covariance = 0;
        let variance1 = 0;
        let variance2 = 0;
        
        for (let i = 0; i < length; i++) {
            const diff1 = channel1[i] - mean1;
            const diff2 = channel2[i] - mean2;
            covariance += diff1 * diff2;
            variance1 += diff1 * diff1;
            variance2 += diff2 * diff2;
        }
        
        const correlation = covariance / Math.sqrt(variance1 * variance2 + 0.00001);
        return Math.max(-1, Math.min(1, correlation));
    }
    
    // Calculate waveform asymmetry (for mono signals)
    _calculateAsymmetry(data) {
        let positiveSum = 0;
        let negativeSum = 0;
        let positiveCount = 0;
        let negativeCount = 0;
        
        for (let i = 0; i < data.length; i++) {
            if (data[i] > 0) {
                positiveSum += data[i];
                positiveCount++;
            } else if (data[i] < 0) {
                negativeSum += Math.abs(data[i]);
                negativeCount++;
            }
        }
        
        const positiveAvg = positiveCount > 0 ? positiveSum / positiveCount : 0;
        const negativeAvg = negativeCount > 0 ? negativeSum / negativeCount : 0;
        
        return (positiveAvg - negativeAvg) / (positiveAvg + negativeAvg + 0.00001);
    }
    
    // Get suggested corrections
    getSuggestedCorrections(recordingId) {
        const recording = this.recordings.get(recordingId);
        if (!recording || !recording.issues) return [];
        
        const corrections = [];
        
        for (const issue of recording.issues) {
            switch (issue.type) {
                case 'polarity_inversion':
                    corrections.push({
                        action: 'invert_polarity',
                        channel: 'right', // Common fix for stereo recordings
                        description: 'Invert right channel polarity'
                    });
                    corrections.push({
                        action: 'invert_polarity',
                        channel: 'left',
                        description: 'Invert left channel polarity'
                    });
                    break;
                    
                case 'dc_offset':
                    corrections.push({
                        action: 'remove_dc_offset',
                        description: 'Apply high-pass filter at 20 Hz'
                    });
                    break;
                    
                case 'phase_issue':
                    corrections.push({
                        action: 'align_phase',
                        description: 'Apply phase alignment correction'
                    });
                    break;
                    
                case 'waveform_asymmetry':
                    corrections.push({
                        action: 'monitor',
                        description: 'Monitor for potential distortion issues'
                    });
                    break;
            }
        }
        
        return corrections;
    }
    
    // Apply correction
    applyCorrection(recordingId, correction) {
        const recording = this.recordings.get(recordingId);
        if (!recording) return false;
        
        // Create offline context for processing
        const offlineCtx = new OfflineAudioContext(
            recording.buffer.numberOfChannels,
            recording.buffer.length,
            recording.buffer.sampleRate
        );
        
        const source = offlineCtx.createBufferSource();
        source.buffer = recording.buffer;
        
        switch (correction.action) {
            case 'invert_polarity': {
                const gain = offlineCtx.createGain();
                gain.gain.value = -1;
                source.connect(gain);
                gain.connect(offlineCtx.destination);
                break;
            }
            
            case 'remove_dc_offset': {
                const filter = offlineCtx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 20;
                source.connect(filter);
                filter.connect(offlineCtx.destination);
                break;
            }
            
            default:
                source.connect(offlineCtx.destination);
        }
        
        source.start(0);
        
        return offlineCtx.startRendering().then(newBuffer => {
            recording.buffer = newBuffer;
            return true;
        });
    }
    
    // Real-time polarity monitoring
    startRealtimeMonitoring(sourceNode, callback) {
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = 2048;
        sourceNode.connect(analyzer);
        
        const monitorInterval = setInterval(() => {
            const data1 = new Float32Array(analyzer.fftSize);
            const data2 = new Float32Array(analyzer.fftSize);
            
            analyzer.getFloatTimeDomainData(data1);
            // For stereo, we'd need a splitter
            const correlation = this._calculateCorrelation(data1, data1); // Simplified for mono
            
            callback({
                correlation,
                status: correlation > this.config.correlationThreshold ? 'good' : 'warning'
            });
        }, this.config.analysisDuration);
        
        return {
            stop: () => {
                clearInterval(monitorInterval);
                analyzer.disconnect();
            }
        };
    }
    
    // Create UI panel
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'polarity-check-panel';
        panel.innerHTML = `
            <style>
                .polarity-check-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .pcp-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                }
                .pcp-section {
                    margin-bottom: 16px;
                }
                .pcp-label {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .pcp-recordings {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .pcp-recording {
                    background: #0a0a14;
                    border-radius: 6px;
                    padding: 12px;
                }
                .pcp-rec-name {
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }
                .pcp-rec-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                }
                .pcp-status-indicator {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }
                .pcp-status-good { background: #10b981; }
                .pcp-status-warning { background: #f59e0b; }
                .pcp-status-critical { background: #ef4444; }
                .pcp-issues {
                    margin-top: 8px;
                    font-size: 11px;
                    color: #888;
                }
                .pcp-issue {
                    padding: 4px 8px;
                    background: #1a1a2e;
                    border-radius: 4px;
                    margin-top: 4px;
                }
                .pcp-btn {
                    padding: 10px 16px;
                    background: #10b981;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                }
                .pcp-btn:hover { background: #059669; }
                .pcp-btn-secondary {
                    background: #333;
                }
                .pcp-btn-secondary:hover { background: #444; }
            </style>
            
            <div class="pcp-header">Polarity Check</div>
            
            <div class="pcp-section">
                <div class="pcp-label">Recordings</div>
                <div class="pcp-recordings" id="pcp-recordings">
                    <div style="color: #666; font-size: 13px;">No recordings to analyze</div>
                </div>
            </div>
            
            <div class="pcp-section">
                <button class="pcp-btn" id="pcp-analyze">Analyze All</button>
                <button class="pcp-btn pcp-btn-secondary" id="pcp-clear" style="margin-left: 8px;">Clear</button>
            </div>
        `;
        
        container.appendChild(panel);
        this.panel = panel;
        
        // Event handlers
        panel.querySelector('#pcp-analyze').addEventListener('click', () => {
            this._updatePanel();
        });
        
        panel.querySelector('#pcp-clear').addEventListener('click', () => {
            this.recordings.clear();
            this._updatePanel();
        });
        
        return panel;
    }
    
    async _updatePanel() {
        const results = await this.analyzeAll();
        const container = this.panel.querySelector('#pcp-recordings');
        
        if (results.length === 0) {
            container.innerHTML = '<div style="color: #666; font-size: 13px;">No recordings to analyze</div>';
            return;
        }
        
        container.innerHTML = results.map(rec => {
            const statusClass = rec.polarity === 'normal' ? 'pcp-status-good' : 
                               rec.polarity === 'partial' ? 'pcp-status-warning' : 'pcp-status-critical';
            
            return `
                <div class="pcp-recording">
                    <div class="pcp-rec-name">${rec.name}</div>
                    <div class="pcp-rec-status">
                        <div class="pcp-status-indicator ${statusClass}"></div>
                        <span>${rec.polarity === 'normal' ? 'Normal Polarity' : rec.polarity === 'partial' ? 'Phase Issues' : 'Inverted Polarity'}</span>
                    </div>
                    ${rec.issues.length > 0 ? `
                        <div class="pcp-issues">
                            ${rec.issues.map(issue => `
                                <div class="pcp-issue">${issue.message}</div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    destroy() {
        this.recordings.clear();
        for (const analyzer of this.analyzers.values()) {
            analyzer.disconnect();
        }
        this.analyzers.clear();
    }
}

// Export for use in main DAW
export function createPolarityCheck(audioContext, options = {}) {
    return new PolarityCheck(audioContext, options);
}

export function openPolarityCheckPanel(services = {}) {
    const { audioContext, container, recordings } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for Polarity Check panel');
        return null;
    }
    
    const checker = new PolarityCheck(audioContext);
    
    // Add recordings if provided
    if (recordings && Array.isArray(recordings)) {
        for (const rec of recordings) {
            checker.addRecording(rec.id, rec.buffer, { name: rec.name });
        }
    }
    
    return checker.createPanel(container);
}