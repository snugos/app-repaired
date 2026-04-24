/**
 * Track Sidechain Routing UI - Visual sidechain setup
 * Provides a visual interface for configuring sidechain routing
 */

class TrackSidechainRoutingUI {
    constructor() {
        this.routingConfig = new Map(); // trackId -> routing config
        this.availableTracks = [];
        this.onRoutingChange = null;
    }

    /**
     * Set available tracks for routing
     * @param {Array} tracks - Array of track objects
     */
    setAvailableTracks(tracks) {
        this.availableTracks = tracks || [];
    }

    /**
     * Get routing configuration for a track
     * @param {string} trackId - Track ID
     * @returns {Object} - Routing configuration
     */
    getRouting(trackId) {
        return this.routingConfig.get(trackId) || {
            sourceTrackId: null,
            threshold: -24,
            ratio: 4,
            attack: 5,
            release: 50,
            enabled: false,
            gainReduction: 0
        };
    }

    /**
     * Set routing configuration for a track
     * @param {string} trackId - Track ID
     * @param {Object} config - Routing configuration
     */
    setRouting(trackId, config) {
        const existing = this.getRouting(trackId);
        this.routingConfig.set(trackId, { ...existing, ...config });

        if (this.onRoutingChange) {
            this.onRoutingChange(trackId, this.routingConfig.get(trackId));
        }
    }

    /**
     * Enable/disable sidechain for a track
     * @param {string} trackId - Track ID
     * @param {boolean} enabled - Whether sidechain is enabled
     */
    setEnabled(trackId, enabled) {
        const routing = this.getRouting(trackId);
        routing.enabled = enabled;
        this.routingConfig.set(trackId, routing);
    }

    /**
     * Remove sidechain routing
     * @param {string} trackId - Track ID
     */
    removeRouting(trackId) {
        this.routingConfig.delete(trackId);
    }

    /**
     * Get all sidechain routings
     * @returns {Array} - Array of {trackId, config} objects
     */
    getAllRoutings() {
        return Array.from(this.routingConfig.entries()).map(([trackId, config]) => ({
            trackId,
            ...config
        }));
    }

    /**
     * Get tracks that are being used as sidechain sources
     * @returns {Array} - Array of source track IDs
     */
    getUsedSourceTracks() {
        const sources = new Set();
        this.routingConfig.forEach(config => {
            if (config.sourceTrackId) {
                sources.add(config.sourceTrackId);
            }
        });
        return Array.from(sources);
    }

    /**
     * Open sidechain routing panel
     */
    openRoutingPanel(tracks, onApply) {
        const existing = document.getElementById('sidechain-routing-panel');
        if (existing) existing.remove();

        this.setAvailableTracks(tracks);

        const panel = document.createElement('div');
        panel.id = 'sidechain-routing-panel';

        // Build routing matrix
        let routingMatrixHTML = '';
        tracks.forEach(track => {
            const routing = this.getRouting(track.id);
            const sourceOptions = tracks
                .filter(t => t.id !== track.id)
                .map(t => `<option value="${t.id}" ${routing.sourceTrackId === t.id ? 'selected' : ''}>${t.name}</option>`)
                .join('');

            routingMatrixHTML += `
                <div class="routing-row" data-track-id="${track.id}" style="display: grid; grid-template-columns: 120px 140px 1fr; gap: 12px; padding: 12px; background: ${routing.enabled ? '#2a4a2e' : '#2a2a4e'}; border-radius: 4px; margin-bottom: 8px; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="routing-enable" data-track-id="${track.id}" ${routing.enabled ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #10b981;">
                        <span style="color: #fff; font-size: 12px;">${track.name}</span>
                    </div>
                    <select class="routing-source" data-track-id="${track.id}" ${!routing.enabled ? 'disabled' : ''} style="padding: 6px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px; font-size: 11px;">
                        <option value="">Select source...</option>
                        ${sourceOptions}
                    </select>
                    <div class="routing-controls" style="display: ${routing.enabled ? 'grid' : 'none'}; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                        <div style="text-align: center;">
                            <div style="color: #6b7280; font-size: 10px;">Thresh</div>
                            <input type="number" class="routing-threshold" data-track-id="${track.id}" value="${routing.threshold}" min="-60" max="0" step="1"
                                style="width: 50px; padding: 4px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 2px; font-size: 10px; text-align: center;">
                            <span style="color: #6b7280; font-size: 9px;">dB</span>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #6b7280; font-size: 10px;">Ratio</div>
                            <input type="number" class="routing-ratio" data-track-id="${track.id}" value="${routing.ratio}" min="1" max="20" step="0.5"
                                style="width: 50px; padding: 4px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 2px; font-size: 10px; text-align: center;">
                            <span style="color: #6b7280; font-size: 9px;">:1</span>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #6b7280; font-size: 10px;">Attack</div>
                            <input type="number" class="routing-attack" data-track-id="${track.id}" value="${routing.attack}" min="0" max="100" step="1"
                                style="width: 50px; padding: 4px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 2px; font-size: 10px; text-align: center;">
                            <span style="color: #6b7280; font-size: 9px;">ms</span>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #6b7280; font-size: 10px;">Release</div>
                            <input type="number" class="routing-release" data-track-id="${track.id}" value="${routing.release}" min="10" max="1000" step="10"
                                style="width: 50px; padding: 4px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 2px; font-size: 10px; text-align: center;">
                            <span style="color: #6b7280; font-size: 9px;">ms</span>
                        </div>
                    </div>
                </div>
            `;
        });

        panel.innerHTML = `
            <div class="routing-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🔀 Sidechain Routing</h3>
                
                <div style="margin-bottom: 16px; background: #2a2a4e; padding: 12px; border-radius: 4px;">
                    <div style="color: #a0a0a0; font-size: 11px; margin-bottom: 8px;">
                        Sidechain compression ducks a track when another track plays.
                        Common use: Duck bass when kick drum hits.
                    </div>
                    <div style="display: grid; grid-template-columns: 120px 140px 1fr; gap: 12px; color: #6b7280; font-size: 10px; text-transform: uppercase;">
                        <span>Target Track</span>
                        <span>Sidechain Source</span>
                        <span>Settings</span>
                    </div>
                </div>

                <div id="routing-matrix">${routingMatrixHTML}</div>

                <div id="routing-preview" style="display: none; background: #2a2a4e; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
                    <div style="color: #a0a0a0; font-size: 12px; margin-bottom: 12px;">Active Sidechains</div>
                    <div id="active-sidechains" style="display: grid; gap: 8px;"></div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="routing-preview-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Show Active
                    </button>
                    <button id="routing-apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Apply Routings
                    </button>
                    <button id="routing-clear-btn" style="padding: 12px 16px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Clear All
                    </button>
                    <button id="routing-close-btn" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #sidechain-routing-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
            .routing-row:hover {
                background: #3a3a5e !important;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Event handlers
        const previewBtn = document.getElementById('routing-preview-btn');
        const applyBtn = document.getElementById('routing-apply-btn');
        const clearBtn = document.getElementById('routing-clear-btn');
        const closeBtn = document.getElementById('routing-close-btn');
        const previewDiv = document.getElementById('routing-preview');
        const activeSidechains = document.getElementById('active-sidechains');

        // Enable/disable routing
        document.querySelectorAll('.routing-enable').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const trackId = e.target.dataset.trackId;
                const row = document.querySelector(`.routing-row[data-track-id="${trackId}"]`);
                const sourceSelect = row.querySelector('.routing-source');
                const controls = row.querySelector('.routing-controls');

                const enabled = e.target.checked;
                sourceSelect.disabled = !enabled;
                controls.style.display = enabled ? 'grid' : 'none';
                row.style.background = enabled ? '#2a4a2e' : '#2a2a4e';

                this.setEnabled(trackId, enabled);
            });
        });

        // Source selection
        document.querySelectorAll('.routing-source').forEach(select => {
            select.addEventListener('change', (e) => {
                const trackId = e.target.dataset.trackId;
                const routing = this.getRouting(trackId);
                routing.sourceTrackId = e.target.value;
                this.setRouting(trackId, routing);
            });
        });

        // Parameter inputs
        ['threshold', 'ratio', 'attack', 'release'].forEach(param => {
            document.querySelectorAll(`.routing-${param}`).forEach(input => {
                input.addEventListener('change', (e) => {
                    const trackId = e.target.dataset.trackId;
                    const routing = this.getRouting(trackId);
                    routing[param] = parseFloat(e.target.value);
                    this.setRouting(trackId, routing);
                });
            });
        });

        // Preview active sidechains
        previewBtn.addEventListener('click', () => {
            const active = this.getAllRoutings().filter(r => r.enabled && r.sourceTrackId);

            if (active.length === 0) {
                previewDiv.style.display = 'none';
                return;
            }

            previewDiv.style.display = 'block';
            activeSidechains.innerHTML = active.map(r => {
                const targetTrack = tracks.find(t => t.id === r.trackId);
                const sourceTrack = tracks.find(t => t.id === r.sourceTrackId);
                return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #1a1a2e; border-radius: 4px;">
                        <span style="color: #fff; font-size: 12px;">${targetTrack?.name}</span>
                        <span style="color: #6b7280;">→</span>
                        <span style="color: #10b981; font-size: 12px;">${sourceTrack?.name}</span>
                        <span style="color: #6b7280; font-size: 11px; margin-left: auto;">
                            ${r.threshold}dB, ${r.ratio}:1
                        </span>
                    </div>
                `;
            }).join('');
        });

        // Apply
        applyBtn.addEventListener('click', () => {
            const routings = this.getAllRoutings();

            if (onApply) {
                onApply(routings);
            }

            panel.remove();
            style.remove();
        });

        // Clear all
        clearBtn.addEventListener('click', () => {
            this.routingConfig.clear();

            document.querySelectorAll('.routing-enable').forEach(checkbox => {
                checkbox.checked = false;
            });
            document.querySelectorAll('.routing-source').forEach(select => {
                select.disabled = true;
                select.value = '';
            });
            document.querySelectorAll('.routing-controls').forEach(controls => {
                controls.style.display = 'none';
            });
            document.querySelectorAll('.routing-row').forEach(row => {
                row.style.background = '#2a2a4e';
            });

            previewDiv.style.display = 'none';
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });
    }

    /**
     * Get routing diagram SVG
     * @returns {string} - SVG string
     */
    getRoutingDiagram() {
        const routings = this.getAllRoutings().filter(r => r.enabled && r.sourceTrackId);

        if (routings.length === 0) return '';

        let svg = '<svg width="400" height="200" viewBox="0 0 400 200">';
        svg += '<rect width="400" height="200" fill="#1a1a2e"/>';

        routings.forEach((r, i) => {
            const y = 30 + i * 40;
            const targetTrack = this.availableTracks.find(t => t.id === r.trackId);
            const sourceTrack = this.availableTracks.find(t => t.id === r.sourceTrackId);

            // Source node
            svg += `<circle cx="50" cy="${y}" r="20" fill="#3b82f6"/>`;
            svg += `<text x="50" y="${y + 4}" text-anchor="middle" fill="white" font-size="10">${sourceTrack?.name?.substring(0, 4) || 'Src'}</text>`;

            // Arrow
            svg += `<line x1="75" y1="${y}" x2="175" y2="${y}" stroke="#10b981" stroke-width="2"/>`;
            svg += `<polygon points="175,${y} 165,${y - 5} 165,${y + 5}" fill="#10b981"/>`;

            // Target node
            svg += `<circle cx="200" cy="${y}" r="20" fill="#f59e0b"/>`;
            svg += `<text x="200" y="${y + 4}" text-anchor="middle" fill="white" font-size="10">${targetTrack?.name?.substring(0, 4) || 'Tgt'}</text>`;

            // Output
            svg += `<line x1="225" y1="${y}" x2="350" y2="${y}" stroke="#6b7280" stroke-width="1"/>`;
            svg += `<text x="280" y="${y - 8}" fill="#6b7280" font-size="8">${r.threshold}dB ${r.ratio}:1</text>`;
        });

        svg += '</svg>';
        return svg;
    }
}

// Export singleton
const trackSidechainRoutingUI = new TrackSidechainRoutingUI();

export { TrackSidechainRoutingUI, trackSidechainRoutingUI };