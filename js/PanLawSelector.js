/**
 * Pan Law Selector
 * Choose -3dB or -6dB pan law
 */

class PanLawSelector {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            law: options.law || '-3dB', // '-3dB', '-6dB', '0dB' (linear)
            balanceLaw: options.balanceLaw || 'constant_power', // 'constant_power', 'constant_velocity'
        };
        
        // Pan laws
        this.panLaws = {
            '-3dB': {
                name: '-3 dB (Constant Power)',
                description: 'Standard for most DAWs. Signal power remains constant when panning.',
                calculate: this._constantPowerLaw.bind(this),
            },
            '-6dB': {
                name: '-6 dB (Constant Velocity)',
                description: 'Signal velocity (amplitude) remains constant. Louder when centered.',
                calculate: this._constantVelocityLaw.bind(this),
            },
            '0dB': {
                name: '0 dB (Linear)',
                description: 'Linear panning. Can cause volume changes when panning.',
                calculate: this._linearLaw.bind(this),
            },
            '-4.5dB': {
                name: '-4.5 dB (Compromise)',
                description: 'Between -3dB and -6dB. Used by some analog consoles.',
                calculate: this._compromiseLaw.bind(this),
            },
        };
        
        // State
        this.tracks = new Map();
    }
    
    // Calculate panning gains
    _constantPowerLaw(pan) {
        // pan: -1 (left) to 1 (right), 0 = center
        const angle = (pan + 1) * Math.PI / 4; // 0 to PI/2
        const leftGain = Math.cos(angle);
        const rightGain = Math.sin(angle);
        return { left: leftGain, right: rightGain };
    }
    
    _constantVelocityLaw(pan) {
        // Linear amplitude scaling
        const leftGain = Math.max(0, 1 - pan) / 2 + 0.5;
        const rightGain = Math.max(0, 1 + pan) / 2 + 0.5;
        
        // Apply -6dB compensation
        const compensation = Math.sqrt(0.5);
        return {
            left: leftGain * compensation,
            right: rightGain * compensation
        };
    }
    
    _linearLaw(pan) {
        const leftGain = Math.max(0, 1 - pan);
        const rightGain = Math.max(0, 1 + pan);
        return { left: leftGain, right: rightGain };
    }
    
    _compromiseLaw(pan) {
        // Mix between constant power and constant velocity
        const power = this._constantPowerLaw(pan);
        const velocity = this._constantVelocityLaw(pan);
        const factor = 0.5;
        
        return {
            left: power.left * (1 - factor) + velocity.left * factor,
            right: power.right * (1 - factor) + velocity.right * factor
        };
    }
    
    // Set pan law
    setLaw(law) {
        if (this.panLaws[law]) {
            this.config.law = law;
            this._updateAllTracks();
            return true;
        }
        return false;
    }
    
    // Get current law
    getLaw() {
        return this.config.law;
    }
    
    // Get gains for pan position
    getGains(pan, law = null) {
        const lawToUse = law || this.config.law;
        const panLaw = this.panLaws[lawToUse];
        if (panLaw) {
            return panLaw.calculate(pan);
        }
        return this._constantPowerLaw(pan);
    }
    
    // Add track to manage
    addTrack(trackId, options = {}) {
        const track = {
            id: trackId,
            name: options.name || `Track ${trackId}`,
            pan: options.pan || 0,
            leftGain: options.leftGain,
            rightGain: options.rightGain,
            pannerNode: options.pannerNode,
        };
        
        this.tracks.set(trackId, track);
        this._updateTrack(trackId);
        return track;
    }
    
    // Remove track
    removeTrack(trackId) {
        this.tracks.delete(trackId);
    }
    
    // Set pan for a track
    setTrackPan(trackId, pan) {
        const track = this.tracks.get(trackId);
        if (track) {
            track.pan = Math.max(-1, Math.min(1, pan));
            this._updateTrack(trackId);
            return track.pan;
        }
        return null;
    }
    
    // Update a single track's gains
    _updateTrack(trackId) {
        const track = this.tracks.get(trackId);
        if (!track) return;
        
        const gains = this.getGains(track.pan);
        
        if (track.leftGain && track.rightGain) {
            // Using separate gain nodes
            track.leftGain.gain.value = gains.left;
            track.rightGain.gain.value = gains.right;
        } else if (track.pannerNode) {
            // Using stereo panner
            track.pannerNode.pan.value = track.pan;
        }
    }
    
    // Update all tracks
    _updateAllTracks() {
        for (const trackId of this.tracks.keys()) {
            this._updateTrack(trackId);
        }
    }
    
    // Get available pan laws
    getAvailableLaws() {
        return Object.entries(this.panLaws).map(([key, value]) => ({
            id: key,
            name: value.name,
            description: value.description,
        }));
    }
    
    // Create UI panel
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'pan-law-selector-panel';
        panel.innerHTML = `
            <style>
                .pan-law-selector-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .plsp-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                }
                .plsp-section {
                    margin-bottom: 16px;
                }
                .plsp-label {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .plsp-law-options {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .plsp-law-option {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px;
                    background: #0a0a14;
                    border-radius: 6px;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: border-color 0.2s;
                }
                .plsp-law-option:hover {
                    background: #1a1a2e;
                }
                .plsp-law-option.active {
                    border-color: #10b981;
                }
                .plsp-law-radio {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid #333;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .plsp-law-option.active .plsp-law-radio {
                    border-color: #10b981;
                }
                .plsp-law-radio-inner {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #10b981;
                    display: none;
                }
                .plsp-law-option.active .plsp-law-radio-inner {
                    display: block;
                }
                .plsp-law-info {
                    flex: 1;
                }
                .plsp-law-name {
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 4px;
                }
                .plsp-law-desc {
                    font-size: 11px;
                    color: #888;
                }
                .plsp-preview {
                    background: #0a0a14;
                    border-radius: 6px;
                    padding: 16px;
                }
                .plsp-preview-title {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 12px;
                }
                .plsp-preview-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 4px;
                }
                .plsp-preview-cell {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                .plsp-preview-bar {
                    width: 100%;
                    height: 60px;
                    background: #1a1a2e;
                    border-radius: 4px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    overflow: hidden;
                }
                .plsp-preview-fill-left {
                    background: #3b82f6;
                }
                .plsp-preview-fill-right {
                    background: #ef4444;
                }
                .plsp-preview-label {
                    font-size: 10px;
                    color: #666;
                }
            </style>
            
            <div class="plsp-header">Pan Law Selector</div>
            
            <div class="plsp-section">
                <div class="plsp-label">Select Pan Law</div>
                <div class="plsp-law-options" id="plsp-laws"></div>
            </div>
            
            <div class="plsp-section">
                <div class="plsp-preview">
                    <div class="plsp-preview-title">Gain Preview (Left/Right channels at different pan positions)</div>
                    <div class="plsp-preview-grid" id="plsp-preview"></div>
                </div>
            </div>
        `;
        
        container.appendChild(panel);
        this.panel = panel;
        
        this._renderLaws();
        this._renderPreview();
        
        return panel;
    }
    
    _renderLaws() {
        const container = this.panel.querySelector('#plsp-laws');
        const laws = this.getAvailableLaws();
        
        container.innerHTML = laws.map(law => `
            <div class="plsp-law-option ${law.id === this.config.law ? 'active' : ''}" data-law="${law.id}">
                <div class="plsp-law-radio">
                    <div class="plsp-law-radio-inner"></div>
                </div>
                <div class="plsp-law-info">
                    <div class="plsp-law-name">${law.name}</div>
                    <div class="plsp-law-desc">${law.description}</div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.plsp-law-option').forEach(el => {
            el.addEventListener('click', () => {
                this.setLaw(el.dataset.law);
                container.querySelectorAll('.plsp-law-option').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                this._renderPreview();
            });
        });
    }
    
    _renderPreview() {
        const container = this.panel.querySelector('#plsp-preview');
        const panPositions = [-1, -0.5, 0, 0.5, 1];
        const panLabels = ['L100%', 'L50%', 'C', 'R50%', 'R100%'];
        
        container.innerHTML = panPositions.map((pan, i) => {
            const gains = this.getGains(pan);
            const leftPercent = gains.left * 100;
            const rightPercent = gains.right * 100;
            
            return `
                <div class="plsp-preview-cell">
                    <div class="plsp-preview-bar">
                        <div class="plsp-preview-fill-left" style="height: ${leftPercent}%"></div>
                    </div>
                    <div class="plsp-preview-bar">
                        <div class="plsp-preview-fill-right" style="height: ${rightPercent}%"></div>
                    </div>
                    <div class="plsp-preview-label">${panLabels[i]}</div>
                </div>
            `;
        }).join('');
    }
    
    destroy() {
        this.tracks.clear();
    }
}

// Export for use in main DAW
export function createPanLawSelector(audioContext, options = {}) {
    return new PanLawSelector(audioContext, options);
}

export function openPanLawSelectorPanel(services = {}) {
    const { audioContext, container } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for Pan Law Selector panel');
        return null;
    }
    
    const selector = new PanLawSelector(audioContext);
    return selector.createPanel(container);
}