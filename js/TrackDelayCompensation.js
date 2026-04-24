// js/TrackDelayCompensation.js - Per-track delay offset for latency compensation

export class TrackDelayCompensation {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.trackDelays = new Map(); // trackId -> { delayNode, delayMs, enabled }
        this.masterDelayNode = null;
        this.maxDelayMs = 1000; // Maximum delay compensation (1 second)
    }

    /**
     * Create a delay compensation node for a track
     * @param {string} trackId - The track ID
     * @param {number} delayMs - Delay in milliseconds (can be negative for advance)
     * @returns {DelayNode} The delay node
     */
    createTrackDelay(trackId, delayMs = 0) {
        if (!this.audioContext) {
            console.error('[TrackDelayCompensation] No audio context available');
            return null;
        }

        // Create delay node
        const delayNode = this.audioContext.createDelay(this.maxDelayMs / 1000);
        delayNode.delayTime.value = Math.max(0, Math.abs(delayMs) / 1000);

        this.trackDelays.set(trackId, {
            delayNode,
            delayMs,
            enabled: true,
            negative: delayMs < 0 // Track if delay is negative (advance)
        });

        console.log(`[TrackDelayCompensation] Created delay node for track ${trackId}: ${delayMs}ms`);
        return delayNode;
    }

    /**
     * Update the delay value for a track
     * @param {string} trackId - The track ID
     * @param {number} delayMs - New delay in milliseconds
     */
    setTrackDelay(trackId, delayMs) {
        const trackDelay = this.trackDelays.get(trackId);
        if (!trackDelay) {
            console.warn(`[TrackDelayCompensation] No delay node for track ${trackId}`);
            return;
        }

        // Clamp to max delay
        const clampedDelay = Math.max(-this.maxDelayMs, Math.min(this.maxDelayMs, delayMs));
        trackDelay.delayMs = clampedDelay;
        trackDelay.negative = clampedDelay < 0;

        // Set delay time (absolute value for delay node)
        const delayTime = Math.abs(clampedDelay) / 1000;
        trackDelay.delayNode.delayTime.setTargetAtTime(delayTime, this.audioContext.currentTime, 0.01);

        console.log(`[TrackDelayCompensation] Set delay for track ${trackId}: ${clampedDelay}ms`);
    }

    /**
     * Get the current delay value for a track
     * @param {string} trackId - The track ID
     * @returns {number} Delay in milliseconds
     */
    getTrackDelay(trackId) {
        const trackDelay = this.trackDelays.get(trackId);
        return trackDelay ? trackDelay.delayMs : 0;
    }

    /**
     * Enable/disable delay compensation for a track
     * @param {string} trackId - The track ID
     * @param {boolean} enabled - Whether delay is enabled
     */
    setTrackDelayEnabled(trackId, enabled) {
        const trackDelay = this.trackDelays.get(trackId);
        if (!trackDelay) {
            console.warn(`[TrackDelayCompensation] No delay node for track ${trackId}`);
            return;
        }

        trackDelay.enabled = enabled;

        if (enabled) {
            const delayTime = Math.abs(trackDelay.delayMs) / 1000;
            trackDelay.delayNode.delayTime.setTargetAtTime(delayTime, this.audioContext.currentTime, 0.01);
        } else {
            trackDelay.delayNode.delayTime.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
        }

        console.log(`[TrackDelayCompensation] Delay ${enabled ? 'enabled' : 'disabled'} for track ${trackId}`);
    }

    /**
     * Check if delay compensation is enabled for a track
     * @param {string} trackId - The track ID
     * @returns {boolean} Whether delay is enabled
     */
    isTrackDelayEnabled(trackId) {
        const trackDelay = this.trackDelays.get(trackId);
        return trackDelay ? trackDelay.enabled : false;
    }

    /**
     * Remove delay compensation for a track
     * @param {string} trackId - The track ID
     */
    removeTrackDelay(trackId) {
        const trackDelay = this.trackDelays.get(trackId);
        if (trackDelay) {
            trackDelay.delayNode.disconnect();
            this.trackDelays.delete(trackId);
            console.log(`[TrackDelayCompensation] Removed delay for track ${trackId}`);
        }
    }

    /**
     * Auto-calculate delay compensation based on effect chain
     * @param {string} trackId - The track ID
     * @param {Array} effects - Array of effects with latency info
     * @returns {number} Calculated total latency in milliseconds
     */
    calculateEffectLatency(trackId, effects) {
        let totalLatencyMs = 0;

        for (const effect of effects) {
            if (effect.enabled && effect.latencyMs) {
                totalLatencyMs += effect.latencyMs;
            }
        }

        console.log(`[TrackDelayCompensation] Calculated latency for track ${trackId}: ${totalLatencyMs}ms`);
        return totalLatencyMs;
    }

    /**
     * Auto-compensate for effect latency
     * @param {string} trackId - The track ID
     * @param {Array} effects - Array of effects with latency info
     */
    autoCompensateLatency(trackId, effects) {
        const totalLatency = this.calculateEffectLatency(trackId, effects);
        
        if (this.trackDelays.has(trackId)) {
            this.setTrackDelay(trackId, totalLatency);
        }
    }

    /**
     * Get the delay node for connecting to audio graph
     * @param {string} trackId - The track ID
     * @returns {DelayNode|null} The delay node or null
     */
    getDelayNode(trackId) {
        const trackDelay = this.trackDelays.get(trackId);
        return trackDelay ? trackDelay.delayNode : null;
    }

    /**
     * Get all track delays for state serialization
     * @returns {Object} Track delays state
     */
    getState() {
        const state = {};
        for (const [trackId, data] of this.trackDelays) {
            state[trackId] = {
                delayMs: data.delayMs,
                enabled: data.enabled,
                negative: data.negative
            };
        }
        return state;
    }

    /**
     * Restore track delays from state
     * @param {Object} state - Track delays state
     */
    restoreState(state) {
        for (const [trackId, data] of Object.entries(state)) {
            this.createTrackDelay(trackId, data.delayMs);
            this.setTrackDelayEnabled(trackId, data.enabled);
        }
    }

    /**
     * Dispose of all delay nodes
     */
    dispose() {
        for (const [trackId, data] of this.trackDelays) {
            data.delayNode.disconnect();
        }
        this.trackDelays.clear();
        console.log('[TrackDelayCompensation] Disposed all delay nodes');
    }
}

/**
 * Open the track delay compensation panel
 * @param {Object} appServices - App services object
 */
export function openTrackDelayPanel(appServices) {
    const { getTracks, showNotification } = appServices;
    const tracks = getTracks ? getTracks() : [];

    // Remove existing panel
    const existingPanel = document.getElementById('track-delay-panel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'track-delay-panel';
    panel.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 w-96 max-h-[80vh] overflow-y-auto';

    let trackDelayRows = '';
    for (const track of tracks) {
        const currentDelay = track.trackDelayCompensation?.delayMs || 0;
        const isEnabled = track.trackDelayCompensation?.enabled !== false;
        const isNegative = currentDelay < 0;

        trackDelayRows += `
            <div class="flex items-center gap-3 py-2 px-3 hover:bg-zinc-800/50 border-b border-zinc-800">
                <div class="w-3 h-3 rounded-full" style="background-color: ${track.color || '#3b82f6'}"></div>
                <div class="flex-1 text-sm truncate">${track.name || `Track ${track.id}`}</div>
                <div class="flex items-center gap-2">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer delay-toggle" data-track-id="${track.id}" ${isEnabled ? 'checked' : ''}>
                        <div class="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <input type="number" 
                           class="w-20 px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded text-center delay-input" 
                           data-track-id="${track.id}"
                           value="${currentDelay}" 
                           min="-1000" 
                           max="1000" 
                           step="1">
                    <span class="text-xs text-zinc-400 w-6">ms</span>
                </div>
            </div>
        `;
    }

    panel.innerHTML = `
        <div class="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex justify-between items-center">
            <h2 class="text-lg font-bold text-white">Track Delay Compensation</h2>
            <button id="close-delay-panel" class="text-zinc-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        
        <div class="p-4">
            <p class="text-xs text-zinc-400 mb-4">
                Adjust delay per track to compensate for latency. Positive values delay the track, negative values advance it.
            </p>
            
            <div class="bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
                <div class="flex items-center gap-3 py-2 px-3 bg-zinc-800 border-b border-zinc-700 text-xs text-zinc-400 font-medium">
                    <div class="w-3"></div>
                    <div class="flex-1">Track</div>
                    <div class="flex items-center gap-2">
                        <span>Enable</span>
                        <span>Delay</span>
                    </div>
                </div>
                ${trackDelayRows || '<div class="p-4 text-center text-zinc-500 text-sm">No tracks available</div>'}
            </div>
            
            <div class="mt-4 flex gap-2">
                <button id="reset-all-delays" class="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors">
                    Reset All
                </button>
                <button id="auto-compensate" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors">
                    Auto Compensate
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Event handlers
    panel.querySelector('#close-delay-panel').addEventListener('click', () => panel.remove());

    panel.querySelectorAll('.delay-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const trackId = e.target.dataset.trackId;
            const enabled = e.target.checked;
            const track = tracks.find(t => t.id == trackId);
            if (track && track.setTrackDelayCompensation) {
                track.setTrackDelayCompensation(track.trackDelayCompensation?.delayMs || 0, enabled);
                showNotification?.(`Delay ${enabled ? 'enabled' : 'disabled'} for ${track.name}`, 1500);
            }
        });
    });

    panel.querySelectorAll('.delay-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const trackId = e.target.dataset.trackId;
            const delayMs = parseFloat(e.target.value) || 0;
            const track = tracks.find(t => t.id == trackId);
            if (track && track.setTrackDelayCompensation) {
                track.setTrackDelayCompensation(delayMs, track.trackDelayCompensation?.enabled !== false);
                showNotification?.(`Delay set to ${delayMs}ms for ${track.name}`, 1500);
            }
        });
    });

    panel.querySelector('#reset-all-delays').addEventListener('click', () => {
        for (const track of tracks) {
            if (track.setTrackDelayCompensation) {
                track.setTrackDelayCompensation(0, true);
            }
        }
        showNotification?.('All track delays reset to 0ms', 1500);
        panel.querySelectorAll('.delay-input').forEach(input => input.value = 0);
        panel.querySelectorAll('.delay-toggle').forEach(toggle => toggle.checked = true);
    });

    panel.querySelector('#auto-compensate').addEventListener('click', () => {
        for (const track of tracks) {
            if (track.calculateAndSetDelayCompensation) {
                track.calculateAndSetDelayCompensation();
            }
        }
        showNotification?.('Auto-compensated latency for all tracks', 1500);
    });

    // Close on escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Close on outside click
    panel.addEventListener('click', (e) => {
        if (e.target === panel) panel.remove();
    });
}

export default TrackDelayCompensation;