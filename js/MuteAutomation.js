/**
 * Mute Automation
 * Draw mute automation on tracks
 */

class MuteAutomation {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            resolution: options.resolution || 100, // points per second
            defaultTransition: options.defaultTransition || 'instant', // 'instant', 'fade'
            fadeTime: options.fadeTime || 0.01, // seconds
        };
        
        // State
        this.tracks = new Map();
        this.isPlaying = false;
        this.currentPosition = 0;
    }
    
    // Add a track with automation
    addTrack(trackId, options = {}) {
        const trackAutomation = {
            id: trackId,
            name: options.name || `Track ${trackId}`,
            duration: options.duration || 60, // seconds
            points: [], // { time: seconds, muted: boolean }
            muted: false,
            gainNode: null,
            currentMuteState: false,
        };
        
        // Sort points by time
        this.tracks.set(trackId, trackAutomation);
        return trackAutomation;
    }
    
    // Set gain node for a track
    setTrackGainNode(trackId, gainNode) {
        const track = this.tracks.get(trackId);
        if (track) {
            track.gainNode = gainNode;
        }
    }
    
    // Add mute point
    addMutePoint(trackId, time, muted) {
        const track = this.tracks.get(trackId);
        if (!track) return false;
        
        // Remove existing point at same time (within tolerance)
        const tolerance = 0.01; // 10ms
        track.points = track.points.filter(p => Math.abs(p.time - time) > tolerance);
        
        // Add new point
        track.points.push({ time, muted });
        
        // Sort by time
        track.points.sort((a, b) => a.time - b.time);
        
        return true;
    }
    
    // Remove mute point
    removeMutePoint(trackId, time) {
        const track = this.tracks.get(trackId);
        if (!track) return false;
        
        const tolerance = 0.01;
        const initialLength = track.points.length;
        track.points = track.points.filter(p => Math.abs(p.time - time) > tolerance);
        
        return track.points.length < initialLength;
    }
    
    // Toggle mute at position
    toggleMuteAt(trackId, time) {
        const track = this.tracks.get(trackId);
        if (!track) return false;
        
        // Find current state at this time
        let currentState = false;
        for (const point of track.points) {
            if (point.time <= time) {
                currentState = point.muted;
            } else {
                break;
            }
        }
        
        // Add opposite state
        this.addMutePoint(trackId, time, !currentState);
        return !currentState;
    }
    
    // Get mute state at time
    getMuteStateAt(trackId, time) {
        const track = this.tracks.get(trackId);
        if (!track) return false;
        
        let state = false;
        for (const point of track.points) {
            if (point.time <= time) {
                state = point.muted;
            } else {
                break;
            }
        }
        
        return state;
    }
    
    // Get all automation points for a track
    getAutomationPoints(trackId) {
        const track = this.tracks.get(trackId);
        return track ? [...track.points] : [];
    }
    
    // Clear automation for a track
    clearAutomation(trackId) {
        const track = this.tracks.get(trackId);
        if (track) {
            track.points = [];
            return true;
        }
        return false;
    }
    
    // Update at current position (called during playback)
    update(time) {
        this.currentPosition = time;
        
        for (const track of this.tracks.values()) {
            if (!track.gainNode) continue;
            
            const shouldMute = this.getMuteStateAt(track.id, time);
            
            // Only update if state changed
            if (shouldMute !== track.currentMuteState) {
                track.currentMuteState = shouldMute;
                
                if (this.config.defaultTransition === 'fade') {
                    // Smooth transition
                    const targetGain = shouldMute ? 0 : 1;
                    track.gainNode.gain.setTargetAtTime(
                        targetGain,
                        this.audioContext.currentTime,
                        this.config.fadeTime
                    );
                } else {
                    // Instant
                    track.gainNode.gain.value = shouldMute ? 0 : 1;
                }
            }
        }
    }
    
    // Start playback monitoring
    start() {
        this.isPlaying = true;
    }
    
    // Stop playback monitoring
    stop() {
        this.isPlaying = false;
    }
    
    // Export automation as JSON
    exportAutomation() {
        const data = {
            resolution: this.config.resolution,
            tracks: []
        };
        
        for (const track of this.tracks.values()) {
            data.tracks.push({
                id: track.id,
                name: track.name,
                points: track.points
            });
        }
        
        return JSON.stringify(data, null, 2);
    }
    
    // Import automation from JSON
    importAutomation(json) {
        try {
            const data = JSON.parse(json);
            
            if (data.resolution) {
                this.config.resolution = data.resolution;
            }
            
            if (data.tracks) {
                for (const trackData of data.tracks) {
                    const track = this.tracks.get(trackData.id);
                    if (track) {
                        track.points = trackData.points || [];
                        track.points.sort((a, b) => a.time - b.time);
                    }
                }
            }
            
            return true;
        } catch (e) {
            console.error('Failed to import automation:', e);
            return false;
        }
    }
    
    // Create UI panel
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'mute-automation-panel';
        panel.innerHTML = `
            <style>
                .mute-automation-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .map-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                }
                .map-section {
                    margin-bottom: 16px;
                }
                .map-label {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .map-track {
                    background: #0a0a14;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    overflow: hidden;
                }
                .map-track-header {
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    background: #1a1a2e;
                    gap: 12px;
                }
                .map-track-name {
                    flex: 1;
                    font-size: 13px;
                    font-weight: 500;
                }
                .map-track-btns {
                    display: flex;
                    gap: 4px;
                }
                .map-track-btn {
                    padding: 4px 8px;
                    background: #333;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 11px;
                }
                .map-track-btn:hover { background: #444; }
                .map-track-btn.active { background: #ef4444; }
                .map-timeline {
                    height: 40px;
                    background: #000;
                    position: relative;
                    cursor: crosshair;
                }
                .map-timeline-mute {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    background: rgba(239, 68, 68, 0.5);
                }
                .map-timeline-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: #10b981;
                    display: none;
                }
                .map-time-axis {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 12px;
                    font-size: 10px;
                    color: #666;
                }
                .map-btn {
                    padding: 10px 16px;
                    background: #10b981;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                }
                .map-btn:hover { background: #059669; }
                .map-btn-secondary {
                    background: #333;
                }
                .map-btn-secondary:hover { background: #444; }
            </style>
            
            <div class="map-header">Mute Automation</div>
            
            <div class="map-section">
                <div class="map-label">Tracks</div>
                <div id="map-tracks"></div>
            </div>
            
            <div class="map-section">
                <div class="map-label">Settings</div>
                <div style="display: flex; gap: 8px;">
                    <button class="map-btn map-btn-secondary" id="map-export">Export</button>
                    <button class="map-btn map-btn-secondary" id="map-import">Import</button>
                    <button class="map-btn map-btn-secondary" id="map-clear">Clear All</button>
                </div>
            </div>
        `;
        
        container.appendChild(panel);
        this.panel = panel;
        
        // Event handlers
        panel.querySelector('#map-export').addEventListener('click', () => {
            const data = this.exportAutomation();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mute-automation.json';
            a.click();
            URL.revokeObjectURL(url);
        });
        
        panel.querySelector('#map-import').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    this.importAutomation(text);
                    this._updatePanel();
                }
            };
            input.click();
        });
        
        panel.querySelector('#map-clear').addEventListener('click', () => {
            for (const trackId of this.tracks.keys()) {
                this.clearAutomation(trackId);
            }
            this._updatePanel();
        });
        
        this._updatePanel();
        
        return panel;
    }
    
    _updatePanel() {
        const tracksContainer = this.panel.querySelector('#map-tracks');
        tracksContainer.innerHTML = '';
        
        for (const track of this.tracks.values()) {
            const trackEl = document.createElement('div');
            trackEl.className = 'map-track';
            
            // Create mute regions HTML
            let muteRegionsHtml = '';
            let lastMuted = false;
            let lastTime = 0;
            
            for (const point of track.points) {
                if (point.muted && !lastMuted) {
                    // Start mute region
                    muteRegionsHtml += `<div class="map-timeline-mute" style="left: ${(point.time / track.duration) * 100}%">`;
                } else if (!point.muted && lastMuted) {
                    // End mute region
                    muteRegionsHtml = muteRegionsHtml.replace(/">$/, `; width: ${(point.time / track.duration) * 100}%"></div>`);
                }
                lastMuted = point.muted;
                lastTime = point.time;
            }
            
            // Close open region
            if (lastMuted) {
                muteRegionsHtml = muteRegionsHtml.replace(/">$/, `; width: 100%"></div>`);
            }
            
            trackEl.innerHTML = `
                <div class="map-track-header">
                    <span class="map-track-name">${track.name}</span>
                    <div class="map-track-btns">
                        <button class="map-track-btn" data-track="${track.id}" data-action="mute">Mute</button>
                        <button class="map-track-btn" data-track="${track.id}" data-action="clear">Clear</button>
                    </div>
                </div>
                <div class="map-timeline" data-track="${track.id}">
                    ${muteRegionsHtml}
                </div>
                <div class="map-time-axis">
                    <span>0:00</span>
                    <span>${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60).toString().padStart(2, '0')}</span>
                </div>
            `;
            
            tracksContainer.appendChild(trackEl);
            
            // Add click handler for timeline
            const timeline = trackEl.querySelector('.map-timeline');
            timeline.addEventListener('click', (e) => {
                const rect = timeline.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const time = (x / rect.width) * track.duration;
                this.toggleMuteAt(track.id, time);
                this._updatePanel();
            });
            
            // Mute button
            trackEl.querySelector('.map-track-btn[data-action="mute"]').addEventListener('click', (e) => {
                const btn = e.target;
                const wasMuted = track.muted;
                track.muted = !wasMuted;
                btn.classList.toggle('active', track.muted);
                
                if (track.gainNode) {
                    track.gainNode.gain.value = track.muted ? 0 : 1;
                }
            });
            
            // Clear button
            trackEl.querySelector('.map-track-btn[data-action="clear"]').addEventListener('click', () => {
                this.clearAutomation(track.id);
                this._updatePanel();
            });
        }
    }
    
    destroy() {
        this.stop();
        this.tracks.clear();
    }
}

// Export for use in main DAW
export function createMuteAutomation(audioContext, options = {}) {
    return new MuteAutomation(audioContext, options);
}

export function openMuteAutomationPanel(services = {}) {
    const { audioContext, container, tracks } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for Mute Automation panel');
        return null;
    }
    
    const automation = new MuteAutomation(audioContext);
    
    // Add tracks if provided
    if (tracks && Array.isArray(tracks)) {
        for (const track of tracks) {
            automation.addTrack(track.id, { name: track.name, duration: track.duration });
            if (track.gainNode) {
                automation.setTrackGainNode(track.id, track.gainNode);
            }
        }
    }
    
    return automation.createPanel(container);
}