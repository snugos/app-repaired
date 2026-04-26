/**
 * TrackReversePlayback.js
 * Adds right-click context menu option to enable/disable reverse playback on audio tracks.
 * When enabled, timeline audio clips play backwards.
 */

class TrackReversePlayback {
    constructor() {
        this.enabledTracks = new Set(); // Track IDs with reverse playback enabled
        this.contextMenuListener = null;
        this.init();
    }

    init() {
        // Listen for context menu on track elements
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        console.log('[TrackReversePlayback] Initialized');
    }

    handleContextMenu(event) {
        // Find track element from context menu target
        const trackElement = this.findTrackElement(event.target);
        if (!trackElement) return;

        const trackId = this.getTrackIdFromElement(trackElement);
        if (trackId === null) return;

        // Check if this track supports reverse playback
        const track = window.trackCache?.get?.(trackId) || window.tracksState?.find?.(t => t.id === trackId);
        if (!track) return;

        // Only apply to Audio tracks with timeline clips
        if (track.type !== 'Audio' && track.type !== 'Sampler') return;
        if (!track.timelineClips || track.timelineClips.length === 0) return;

        // Show context menu with reverse option
        const menuItems = [
            { 
                label: this.enabledTracks.has(trackId) ? '✓ Reverse Playback' : 'Reverse Playback', 
                action: () => this.toggleReversePlayback(trackId) 
            }
        ];

        if (typeof createContextMenu === 'function') {
            event.preventDefault();
            createContextMenu(event, menuItems, window.appServices);
        }
    }

    findTrackElement(element) {
        let current = element;
        while (current && current !== document.body) {
            if (current.dataset?.trackId || current.classList?.contains('track-item') || current.classList?.contains('track-header')) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    getTrackIdFromElement(element) {
        if (element.dataset?.trackId) {
            return parseInt(element.dataset.trackId, 10);
        }
        // Try to find track id from parent elements
        let current = element;
        while (current && current !== document.body) {
            if (current.dataset?.trackId) {
                return parseInt(current.dataset.trackId, 10);
            }
            current = current.parentElement;
        }
        return null;
    }

    toggleReversePlayback(trackId) {
        if (this.enabledTracks.has(trackId)) {
            this.enabledTracks.delete(trackId);
            console.log(`[TrackReversePlayback] Disabled for track ${trackId}`);
        } else {
            this.enabledTracks.add(trackId);
            console.log(`[TrackReversePlayback] Enabled for track ${trackId}`);
        }

        // Update track state if possible
        const track = this.getTrackById(trackId);
        if (track && typeof track.setReversePlayback === 'function') {
            track.setReversePlayback(this.enabledTracks.has(trackId));
        }

        // Force UI update
        if (window.appServices?.renderTimeline) {
            window.appServices.renderTimeline();
        }
    }

    isReverseEnabled(trackId) {
        return this.enabledTracks.has(trackId);
    }

    getTrackById(trackId) {
        if (window.trackCache?.get) {
            return window.trackCache.get(trackId);
        }
        if (window.getTracksState) {
            const tracks = window.getTracksState();
            return tracks?.find(t => t.id === trackId);
        }
        return null;
    }

    // Clean up
    destroy() {
        document.removeEventListener('contextmenu', this.handleContextMenu.bind(this));
        this.enabledTracks.clear();
    }
}

// Auto-initialize
const trackReversePlayback = new TrackReversePlayback();