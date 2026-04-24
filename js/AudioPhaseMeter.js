/**
 * Audio Phase Meter - Show phase correlation per track
 * Displays stereo phase correlation to detect mono compatibility issues
 */

class AudioPhaseMeter {
    constructor() {
        this.tracks = new Map(); // trackId -> phase data
        this.updateInterval = 50; // ms
        this.isRunning = false;
        this.onPhaseUpdate = null;
        this.analyserNodes = new Map();
    }

    /**
     * Calculate phase correlation between two channels
     * @param {Float32Array} left - Left channel data
     * @param {Float32Array} right - Right channel data
     * @returns {number} - Correlation (-1 to 1)
     */
    calculateCorrelation(left, right) {
        if (!left || !right || left.length === 0 || right.length === 0) {
            return 0;
        }

        const length = Math.min(left.length, right.length);
        let sumLeft = 0;
        let sumRight = 0;
        let sumProduct = 0;

        for (let i = 0; i < length; i++) {
            sumLeft += left[i] * left[i];
            sumRight += right[i] * right[i];
            sumProduct += left[i] * right[i];
        }

        const rmsLeft = Math.sqrt(sumLeft / length);
        const rmsRight = Math.sqrt(sumRight / length);

        if (rmsLeft === 0 || rmsRight === 0) {
            return 0;
        }

        return sumProduct / (length * rmsLeft * rmsRight);
    }

    /**
     * Calculate stereo width from phase correlation
     * @param {number} correlation - Phase correlation
     * @returns {number} - Width percentage (0-100)
     */
    correlationToWidth(correlation) {
        // Correlation of 1 = mono (width 0)
        // Correlation of 0 = maximum width (width 100)
        // Correlation of -1 = out of phase (width 100+, problematic)
        return Math.round((1 - correlation) * 100);
    }

    /**
     * Get phase status from correlation
     * @param {number} correlation - Phase correlation
     * @returns {Object} - Status info
     */
    getPhaseStatus(correlation) {
        if (correlation > 0.9) {
            return {
                status: 'excellent',
                color: '#10b981',
                message: 'Excellent mono compatibility',
                warning: false
            };
        } else if (correlation > 0.6) {
            return {
                status: 'good',
                color: '#22c55e',
                message: 'Good mono compatibility',
                warning: false
            };
        } else if (correlation > 0.3) {
            return {
                status: 'acceptable',
                color: '#eab308',
                message: 'Acceptable but check in mono',
                warning: true
            };
        } else if (correlation > 0) {
            return {
                status: 'narrow',
                color: '#f97316',
                message: 'Very wide, may cause issues',
                warning: true
            };
        } else if (correlation > -0.3) {
            return {
                status: 'warning',
                color: '#ef4444',
                message: 'Partial phase cancellation',
                warning: true
            };
        } else {
            return {
                status: 'critical',
                color: '#dc2626',
                message: 'Severe phase issues!',
                warning: true
            };
        }
    }

    /**
     * Analyze track for phase issues
     * @param {string} trackId - Track ID
     * @param {AudioNode} leftChannel - Left channel analyzer
     * @param {AudioNode} rightChannel - Right channel analyzer
     * @returns {Object} - Phase analysis
     */
    analyzeTrack(trackId, leftChannel, rightChannel) {
        // This would be called with actual audio nodes in production
        const correlation = this.calculateCorrelation(leftChannel, rightChannel);
        const width = this.correlationToWidth(correlation);
        const status = this.getPhaseStatus(correlation);

        const phaseData = {
            trackId,
            correlation: Math.round(correlation * 100) / 100,
            width,
            ...status,
            timestamp: Date.now()
        };

        this.tracks.set(trackId, phaseData);
        return phaseData;
    }

    /**
     * Analyze stereo buffer
     * @param {AudioBuffer} buffer - Stereo audio buffer
     * @returns {Object} - Phase analysis
     */
    analyzeBuffer(buffer) {
        if (!buffer || buffer.numberOfChannels < 2) {
            return {
                correlation: 1,
                width: 0,
                status: 'mono',
                color: '#6b7280',
                message: 'Mono or no stereo data'
            };
        }

        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        const correlation = this.calculateCorrelation(left, right);
        const width = this.correlationToWidth(correlation);
        const status = this.getPhaseStatus(correlation);

        return {
            correlation: Math.round(correlation * 100) / 100,
            width,
            ...status
        };
    }

    /**
     * Analyze buffer over time (phase tracking)
     * @param {AudioBuffer} buffer - Stereo audio buffer
     * @param {number} windowSize - Analysis window in samples
     * @returns {Array} - Array of phase readings over time
     */
    analyzeBufferOverTime(buffer, windowSize = 4096) {
        if (!buffer || buffer.numberOfChannels < 2) return [];

        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        const sampleRate = buffer.sampleRate;
        const readings = [];

        for (let i = 0; i < left.length - windowSize; i += windowSize) {
            const windowLeft = left.slice(i, i + windowSize);
            const windowRight = right.slice(i, i + windowSize);
            const correlation = this.calculateCorrelation(windowLeft, windowRight);

            readings.push({
                time: i / sampleRate,
                correlation: Math.round(correlation * 100) / 100
            });
        }

        return readings;
    }

    /**
     * Get all track phase data
     * @returns {Array} - Array of track phase data
     */
    getAllTrackPhases() {
        return Array.from(this.tracks.entries()).map(([trackId, data]) => ({
            trackId,
            ...data
        }));
    }

    /**
     * Clear track phase data
     * @param {string} trackId - Track ID (optional, clears all if not provided)
     */
    clearTrackData(trackId) {
        if (trackId) {
            this.tracks.delete(trackId);
        } else {
            this.tracks.clear();
        }
    }

    /**
     * Open phase meter panel
     */
    openPhaseMeterPanel(tracks, audioContext) {
        const existing = document.getElementById('phase-meter-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'phase-meter-panel';

        let tracksHTML = '';
        if (tracks && tracks.length > 0) {
            tracks.forEach(track => {
                const phaseData = this.tracks.get(track.id) || {
                    correlation: 0.8,
                    width: 20,
                    status: 'good',
                    color: '#22c55e'
                };

                tracksHTML += `
                    <div class="phase-track" data-track-id="${track.id}" style="padding: 12px; background: #2a2a4e; border-radius: 4px; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #fff; font-size: 12px;">${track.name}</span>
                            <span style="color: ${phaseData.color}; font-size: 11px;">${phaseData.status.toUpperCase()}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="color: #6b7280; font-size: 10px;">Phase Correlation</div>
                                <div class="correlation-meter" style="height: 8px; background: linear-gradient(to right, #ef4444 0%, #ef4444 30%, #f97316 30%, #f97316 50%, #eab308 50%, #eab308 70%, #22c55e 70%, #22c55e 90%, #10b981 90%, #10b981 100%); border-radius: 4px; position: relative;">
                                    <div class="correlation-indicator" style="position: absolute; top: -2px; width: 4px; height: 12px; background: #fff; border-radius: 2px; left: ${((phaseData.correlation + 1) / 2) * 100}%;"></div>
                                </div>
                            </div>
                            <div style="text-align: right; min-width: 60px;">
                                <div style="color: #6b7280; font-size: 10px;">Width</div>
                                <div style="color: #fff; font-size: 12px;">${phaseData.width}%</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        panel.innerHTML = `
            <div class="phase-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 500px; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🔊 Phase Meter</h3>
                
                <div style="margin-bottom: 16px; background: #2a2a4e; padding: 12px; border-radius: 4px; font-size: 11px; color: #a0a0a0;">
                    <div style="margin-bottom: 8px;"><strong>Phase Correlation Scale:</strong></div>
                    <div style="display: flex; justify-content: space-between; font-size: 10px;">
                        <span style="color: #ef4444;">-1 (Out of Phase)</span>
                        <span style="color: #eab308;">0 (Wide)</span>
                        <span style="color: #10b981;">+1 (Mono)</span>
                    </div>
                </div>

                <div id="phase-tracks">${tracksHTML || '<div style="color: #6b7280; text-align: center;">No stereo tracks found</div>'}</div>

                <div id="phase-master" style="background: #1e3a1e; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #fff; font-size: 14px; font-weight: bold;">Master Output</span>
                        <span id="master-status" style="color: #10b981; font-size: 12px;">ANALYZING...</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="flex: 1;">
                            <div class="correlation-meter" style="height: 12px; background: linear-gradient(to right, #ef4444 0%, #ef4444 30%, #f97316 30%, #f97316 50%, #eab308 50%, #eab308 70%, #22c55e 70%, #22c55e 90%, #10b981 90%, #10b981 100%); border-radius: 4px; position: relative;">
                                <div id="master-indicator" style="position: absolute; top: -3px; width: 6px; height: 18px; background: #fff; border-radius: 3px; left: 90%;"></div>
                            </div>
                        </div>
                        <div id="master-value" style="color: #fff; font-size: 14px; font-weight: bold; min-width: 50px;">+0.80</div>
                    </div>
                </div>

                <div id="phase-history" style="display: none; background: #2a2a4e; padding: 12px; border-radius: 4px; margin-bottom: 16px; height: 100px;">
                    <canvas id="phase-canvas" width="440" height="80"></canvas>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="phase-analyze" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Analyze All
                    </button>
                    <button id="phase-history-btn" style="padding: 12px; background: #6366f1; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        History
                    </button>
                    <button id="phase-close" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #phase-meter-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // State
        let historyData = [];
        let historyVisible = false;

        // Event handlers
        const analyzeBtn = document.getElementById('phase-analyze');
        const historyBtn = document.getElementById('phase-history-btn');
        const closeBtn = document.getElementById('phase-close');
        const historyDiv = document.getElementById('phase-history');

        // Analyze all tracks
        analyzeBtn.addEventListener('click', async () => {
            analyzeBtn.textContent = 'Analyzing...';
            analyzeBtn.disabled = true;

            // Simulate analysis (would connect to real audio nodes)
            for (const track of (tracks || [])) {
                // Generate random correlation for demo
                const correlation = 0.5 + Math.random() * 0.5;
                const width = this.correlationToWidth(correlation);
                const status = this.getPhaseStatus(correlation);

                this.tracks.set(track.id, {
                    trackId: track.id,
                    correlation: Math.round(correlation * 100) / 100,
                    width,
                    ...status
                });
            }

            // Update UI
            const masterCorr = 0.7 + Math.random() * 0.3;
            document.getElementById('master-indicator').style.left = `${((masterCorr + 1) / 2) * 100}%`;
            document.getElementById('master-value').textContent = `+${masterCorr.toFixed(2)}`;

            const masterStatus = this.getPhaseStatus(masterCorr);
            document.getElementById('master-status').textContent = masterStatus.status.toUpperCase();
            document.getElementById('master-status').style.color = masterStatus.color;

            // Update track displays
            this.tracks.forEach((data, trackId) => {
                const trackEl = document.querySelector(`.phase-track[data-track-id="${trackId}"]`);
                if (trackEl) {
                    const indicator = trackEl.querySelector('.correlation-indicator');
                    if (indicator) {
                        indicator.style.left = `${((data.correlation + 1) / 2) * 100}%`;
                    }
                }
            });

            analyzeBtn.textContent = 'Analyze All';
            analyzeBtn.disabled = false;
        });

        // Toggle history view
        historyBtn.addEventListener('click', () => {
            historyVisible = !historyVisible;
            historyDiv.style.display = historyVisible ? 'block' : 'none';

            if (historyVisible) {
                const canvas = document.getElementById('phase-canvas');
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw history
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 1;
                ctx.beginPath();

                for (let i = 0; i < 100; i++) {
                    const x = (i / 100) * canvas.width;
                    const y = canvas.height - ((Math.sin(i * 0.1) * 0.3 + 0.7) * canvas.height * 0.8);

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.stroke();

                // Draw center line
                ctx.strokeStyle = '#6b7280';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(0, canvas.height * 0.5);
                ctx.lineTo(canvas.width, canvas.height * 0.5);
                ctx.stroke();
            }
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });
    }

    /**
     * Get phase warning for mix
     * @returns {Object} - Warning info
     */
    getPhaseWarning() {
        const allPhases = this.getAllTrackPhases();
        const critical = allPhases.filter(p => p.correlation < 0);
        const warning = allPhases.filter(p => p.correlation < 0.3);

        if (critical.length > 0) {
            return {
                level: 'critical',
                message: `${critical.length} track(s) have severe phase issues`,
                tracks: critical.map(t => t.trackId)
            };
        } else if (warning.length > 0) {
            return {
                level: 'warning',
                message: `${warning.length} track(s) may have mono compatibility issues`,
                tracks: warning.map(t => t.trackId)
            };
        }

        return {
            level: 'ok',
            message: 'Phase correlation is healthy',
            tracks: []
        };
    }
}

// Export singleton
const audioPhaseMeter = new AudioPhaseMeter();

export { AudioPhaseMeter, audioPhaseMeter };