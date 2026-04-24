/**
 * Ghost Track - Creates a quieter reference copy of a track for A/B comparison
 * without affecting the main mix
 */

export class GhostTrack {
    constructor(options = {}) {
        this.trackId = options.trackId || null;
        this.sourceTrack = options.sourceTrack || null;
        this.volume = options.volume ?? 0.3; // -10dB default (quieter reference)
        this.pan = options.pan ?? 0;
        this.enabled = options.enabled ?? false;
        this.muted = options.muted ?? false;
        this.solo = options.solo ?? false;
        
        // Audio nodes
        this.inputNode = null;
        this.gainNode = null;
        this.panNode = null;
        this.outputNode = null;
        
        // Ghost-specific
        this.ghostBuffer = null;
        this.ghostPlayer = null;
        this.isProcessing = false;
        
        // Reference info
        this.referenceInfo = {
            originalVolume: 1,
            originalPan: 0,
            originalMuted: false,
            originalSolo: false,
            originalEffects: [],
            createdAt: Date.now()
        };
        
        if (options.audioContext) {
            this.init(options.audioContext);
        }
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        
        // Create audio nodes
        this.inputNode = audioContext.createGain();
        this.gainNode = audioContext.createGain();
        this.panNode = audioContext.createStereoPanner();
        this.outputNode = audioContext.createGain();
        
        // Set initial values
        this.gainNode.gain.value = this.volume;
        this.panNode.pan.value = this.pan;
        
        // Connect chain
        this.inputNode.connect(this.gainNode);
        this.gainNode.connect(this.panNode);
        this.panNode.connect(this.outputNode);
        
        console.log('[GhostTrack] Initialized');
    }
    
    /**
     * Create a ghost copy of a track
     */
    createFromTrack(sourceTrack, audioContext) {
        if (!sourceTrack) {
            console.warn('[GhostTrack] No source track provided');
            return false;
        }
        
        this.sourceTrack = sourceTrack;
        this.trackId = sourceTrack.id;
        
        if (!this.audioContext) {
            this.init(audioContext);
        }
        
        // Store original state
        this.referenceInfo = {
            originalVolume: sourceTrack.volume ?? 1,
            originalPan: sourceTrack.pan ?? 0,
            originalMuted: sourceTrack.muted ?? false,
            originalSolo: sourceTrack.solo ?? false,
            originalEffects: sourceTrack.effects ? [...sourceTrack.effects] : [],
            createdAt: Date.now()
        };
        
        // Copy audio buffer if available
        if (sourceTrack.audioBuffer) {
            this.ghostBuffer = sourceTrack.audioBuffer;
        }
        
        // Copy clips if available
        if (sourceTrack.clips) {
            this.ghostClips = sourceTrack.clips.map(clip => ({...clip}));
        }
        
        console.log(`[GhostTrack] Created ghost of track ${this.trackId}`);
        return true;
    }
    
    /**
     * Enable ghost track playback
     */
    enable() {
        if (!this.sourceTrack) {
            console.warn('[GhostTrack] No source track set');
            return;
        }
        
        this.enabled = true;
        this.isProcessing = true;
        
        console.log('[GhostTrack] Enabled');
    }
    
    /**
     * Disable ghost track
     */
    disable() {
        this.enabled = false;
        this.isProcessing = false;
        this.stop();
        
        console.log('[GhostTrack] Disabled');
    }
    
    /**
     * Toggle ghost track
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }
    
    /**
     * Play ghost track in sync with main track
     */
    play(startTime = 0) {
        if (!this.enabled || !this.ghostBuffer) return;
        
        // Create a new player
        if (this.ghostPlayer) {
            this.ghostPlayer.stop();
            this.ghostPlayer.disconnect();
        }
        
        this.ghostPlayer = this.audioContext.createBufferSource();
        this.ghostPlayer.buffer = this.ghostBuffer;
        this.ghostPlayer.connect(this.inputNode);
        
        const offset = Math.max(0, startTime);
        this.ghostPlayer.start(0, offset);
        
        console.log('[GhostTrack] Playing');
    }
    
    /**
     * Stop ghost track
     */
    stop() {
        if (this.ghostPlayer) {
            try {
                this.ghostPlayer.stop();
            } catch (e) {
                // Already stopped
            }
            this.ghostPlayer.disconnect();
            this.ghostPlayer = null;
        }
    }
    
    /**
     * Set ghost volume (relative to original)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        }
    }
    
    /**
     * Set ghost pan
     */
    setPan(pan) {
        this.pan = Math.max(-1, Math.min(1, pan));
        if (this.panNode) {
            this.panNode.pan.setValueAtTime(this.pan, this.audioContext.currentTime);
        }
    }
    
    /**
     * Mute ghost track
     */
    mute() {
        this.muted = true;
        if (this.outputNode) {
            this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        }
    }
    
    /**
     * Unmute ghost track
     */
    unmute() {
        this.muted = false;
        if (this.outputNode && this.enabled) {
            this.outputNode.gain.setValueAtTime(1, this.audioContext.currentTime);
        }
    }
    
    /**
     * Solo ghost track (mute original)
     */
    setSolo(solo) {
        this.solo = solo;
        
        // When soloing ghost, we mute the original track
        if (this.sourceTrack && this.sourceTrack.setMuted) {
            this.sourceTrack.setMuted(solo);
        }
        
        // Unmute ghost when solo
        if (solo) {
            this.unmute();
        }
    }
    
    /**
     * Compare with original (A/B)
     */
    compareWithOriginal() {
        return {
            ghost: {
                volume: this.volume,
                pan: this.pan,
                muted: this.muted,
                solo: this.solo,
                enabled: this.enabled
            },
            original: {
                volume: this.referenceInfo.originalVolume,
                pan: this.referenceInfo.originalPan,
                muted: this.referenceInfo.originalMuted,
                solo: this.referenceInfo.originalSolo
            },
            difference: {
                volumeDiff: this.volume - this.referenceInfo.originalVolume,
                panDiff: this.pan - this.referenceInfo.originalPan
            }
        };
    }
    
    /**
     * Connect to destination
     */
    connect(destination) {
        if (this.outputNode) {
            this.outputNode.connect(destination);
        }
    }
    
    /**
     * Disconnect from destination
     */
    disconnect() {
        if (this.outputNode) {
            this.outputNode.disconnect();
        }
    }
    
    /**
     * Get current state
     */
    getState() {
        return {
            trackId: this.trackId,
            volume: this.volume,
            pan: this.pan,
            enabled: this.enabled,
            muted: this.muted,
            solo: this.solo,
            isProcessing: this.isProcessing,
            referenceInfo: {...this.referenceInfo}
        };
    }
    
    /**
     * Restore state
     */
    setState(state) {
        this.trackId = state.trackId;
        this.volume = state.volume;
        this.pan = state.pan;
        this.enabled = state.enabled;
        this.muted = state.muted;
        this.solo = state.solo;
        this.referenceInfo = state.referenceInfo || this.referenceInfo;
        
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        if (this.panNode) {
            this.panNode.pan.value = this.pan;
        }
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.stop();
        
        if (this.inputNode) {
            this.inputNode.disconnect();
            this.inputNode = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.panNode) {
            this.panNode.disconnect();
            this.panNode = null;
        }
        if (this.outputNode) {
            this.outputNode.disconnect();
            this.outputNode = null;
        }
        
        this.ghostBuffer = null;
        this.sourceTrack = null;
        this.isProcessing = false;
        
        console.log('[GhostTrack] Disposed');
    }
}

/**
 * Ghost Track Manager - Manages ghost tracks across the project
 */
export class GhostTrackManager {
    constructor() {
        this.ghostTracks = new Map();
        this.audioContext = null;
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        console.log('[GhostTrackManager] Initialized');
    }
    
    createGhost(trackId, sourceTrack) {
        if (this.ghostTracks.has(trackId)) {
            return this.ghostTracks.get(trackId);
        }
        
        const ghost = new GhostTrack({trackId, sourceTrack, audioContext: this.audioContext});
        this.ghostTracks.set(trackId, ghost);
        
        console.log(`[GhostTrackManager] Created ghost for track ${trackId}`);
        return ghost;
    }
    
    getGhost(trackId) {
        return this.ghostTracks.get(trackId);
    }
    
    removeGhost(trackId) {
        const ghost = this.ghostTracks.get(trackId);
        if (ghost) {
            ghost.dispose();
            this.ghostTracks.delete(trackId);
            console.log(`[GhostTrackManager] Removed ghost for track ${trackId}`);
        }
    }
    
    enableGhost(trackId) {
        const ghost = this.ghostTracks.get(trackId);
        if (ghost) {
            ghost.enable();
        }
    }
    
    disableGhost(trackId) {
        const ghost = this.ghostTracks.get(trackId);
        if (ghost) {
            ghost.disable();
        }
    }
    
    toggleGhost(trackId) {
        const ghost = this.ghostTracks.get(trackId);
        if (ghost) {
            return ghost.toggle();
        }
        return false;
    }
    
    setGhostVolume(trackId, volume) {
        const ghost = this.ghostTracks.get(trackId);
        if (ghost) {
            ghost.setVolume(volume);
        }
    }
    
    setGhostPan(trackId, pan) {
        const ghost = this.ghostTracks.get(trackId);
        if (ghost) {
            ghost.setPan(pan);
        }
    }
    
    soloGhost(trackId, solo) {
        const ghost = this.ghostTracks.get(trackId);
        if (ghost) {
            ghost.setSolo(solo);
        }
    }
    
    /**
     * Get all ghost tracks
     */
    getAllGhosts() {
        return Array.from(this.ghostTracks.values());
    }
    
    /**
     * Clear all ghost tracks
     */
    clearAll() {
        this.ghostTracks.forEach(ghost => ghost.dispose());
        this.ghostTracks.clear();
        console.log('[GhostTrackManager] Cleared all ghosts');
    }
    
    /**
     * Export state for project save
     */
    exportState() {
        const state = {};
        this.ghostTracks.forEach((ghost, trackId) => {
            state[trackId] = ghost.getState();
        });
        return state;
    }
    
    /**
     * Import state from project load
     */
    importState(state) {
        Object.entries(state).forEach(([trackId, ghostState]) => {
            const ghost = new GhostTrack({trackId, audioContext: this.audioContext});
            ghost.setState(ghostState);
            this.ghostTracks.set(trackId, ghost);
        });
    }
    
    dispose() {
        this.clearAll();
        this.audioContext = null;
    }
}

// Global instance
let ghostTrackManager = null;

export function getGhostTrackManager() {
    if (!ghostTrackManager) {
        ghostTrackManager = new GhostTrackManager();
    }
    return ghostTrackManager;
}

export function openGhostTrackPanel(trackId, sourceTrack) {
    const manager = getGhostTrackManager();
    const ghost = manager.getGhost(trackId) || manager.createGhost(trackId, sourceTrack);
    
    const panel = document.createElement('div');
    panel.className = 'ghost-track-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #333;
        color: white;
        z-index: 10000;
        min-width: 350px;
        font-family: system-ui, sans-serif;
    `;
    
    const state = ghost.getState();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px;">Ghost Track: ${trackId}</h3>
            <button class="close-btn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 20px;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #888;">Reference Level</span>
                <span id="ghost-volume-display">${Math.round(state.volume * 100)}%</span>
            </div>
            <input type="range" id="ghost-volume" min="0" max="100" value="${state.volume * 100}" style="width: 100%;">
        </div>
        
        <div style="margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #888;">Pan</span>
                <span id="ghost-pan-display">${state.pan === 0 ? 'C' : (state.pan < 0 ? `L${Math.abs(state.pan * 100)}` : `R${state.pan * 100}`)}</span>
            </div>
            <input type="range" id="ghost-pan" min="-100" max="100" value="${state.pan * 100}" style="width: 100%;">
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button id="ghost-enable" class="ghost-btn" style="flex: 1; padding: 10px; background: ${state.enabled ? '#10b981' : '#374151'}; border: none; color: white; border-radius: 4px; cursor: pointer;">
                ${state.enabled ? 'Disable' : 'Enable'}
            </button>
            <button id="ghost-solo" class="ghost-btn" style="flex: 1; padding: 10px; background: ${state.solo ? '#f59e0b' : '#374151'}; border: none; color: white; border-radius: 4px; cursor: pointer;">
                Solo
            </button>
            <button id="ghost-mute" class="ghost-btn" style="flex: 1; padding: 10px; background: ${state.muted ? '#ef4444' : '#374151'}; border: none; color: white; border-radius: 4px; cursor: pointer;">
                Mute
            </button>
        </div>
        
        <div style="display: flex; gap: 8px;">
            <button id="ghost-compare" style="flex: 1; padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                A/B Compare
            </button>
            <button id="ghost-remove" style="flex: 1; padding: 10px; background: #dc2626; border: none; color: white; border-radius: 4px; cursor: pointer;">
                Remove Ghost
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.onclick = () => panel.remove();
    
    const volumeSlider = panel.querySelector('#ghost-volume');
    const volumeDisplay = panel.querySelector('#ghost-volume-display');
    volumeSlider.oninput = () => {
        const vol = volumeSlider.value / 100;
        ghost.setVolume(vol);
        volumeDisplay.textContent = `${volumeSlider.value}%`;
    };
    
    const panSlider = panel.querySelector('#ghost-pan');
    const panDisplay = panel.querySelector('#ghost-pan-display');
    panSlider.oninput = () => {
        const pan = panSlider.value / 100;
        ghost.setPan(pan);
        panDisplay.textContent = pan === 0 ? 'C' : (pan < 0 ? `L${Math.abs(pan * 100).toFixed(0)}` : `R${(pan * 100).toFixed(0)}`);
    };
    
    const enableBtn = panel.querySelector('#ghost-enable');
    enableBtn.onclick = () => {
        const enabled = ghost.toggle();
        enableBtn.textContent = enabled ? 'Disable' : 'Enable';
        enableBtn.style.background = enabled ? '#10b981' : '#374151';
    };
    
    const soloBtn = panel.querySelector('#ghost-solo');
    soloBtn.onclick = () => {
        ghost.solo = !ghost.solo;
        ghost.setSolo(ghost.solo);
        soloBtn.style.background = ghost.solo ? '#f59e0b' : '#374151';
    };
    
    const muteBtn = panel.querySelector('#ghost-mute');
    muteBtn.onclick = () => {
        ghost.muted = !ghost.muted;
        if (ghost.muted) {
            ghost.mute();
        } else {
            ghost.unmute();
        }
        muteBtn.style.background = ghost.muted ? '#ef4444' : '#374151';
    };
    
    const compareBtn = panel.querySelector('#ghost-compare');
    compareBtn.onclick = () => {
        const comparison = ghost.compareWithOriginal();
        console.log('[GhostTrack] A/B Comparison:', comparison);
        
        // Toggle between ghost and original
        if (ghost.enabled) {
            ghost.disable();
            if (sourceTrack && sourceTrack.setMuted) {
                sourceTrack.setMuted(false);
            }
            compareBtn.textContent = 'Show Ghost';
        } else {
            ghost.enable();
            compareBtn.textContent = 'Show Original';
        }
    };
    
    const removeBtn = panel.querySelector('#ghost-remove');
    removeBtn.onclick = () => {
        manager.removeGhost(trackId);
        panel.remove();
    };
    
    return panel;
}

// Module initialized
console.log('[GhostTrack] Module loaded');