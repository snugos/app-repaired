// js/ClipRippleDelete.js - Clip Ripple Delete for SnugOS DAW
// Delete clips with automatic gap close

import { getDAW } from './main.js';

export class ClipRippleDelete {
    constructor() {
        this.isEnabled = true;
        this.rippleMode = 'forward'; // 'forward', 'backward', 'all'
        this.crossfadeDuration = 0.01; // seconds
        this.onRippleCallback = null;
    }

    // Delete a single clip and ripple subsequent clips
    deleteClip(trackId, clipId) {
        const daw = getDAW();
        if (!daw) return false;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return false;
        
        const clips = track.clips || [];
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return false;
        
        const deletedClip = clips[clipIndex];
        const gapDuration = deletedClip.duration || (deletedClip.end - deletedClip.start);
        
        // Remove the clip
        clips.splice(clipIndex, 1);
        
        // Ripple subsequent clips forward
        if (this.rippleMode === 'forward' || this.rippleMode === 'all') {
            for (let i = clipIndex; i < clips.length; i++) {
                const clip = clips[i];
                clip.start -= gapDuration;
                clip.end -= gapDuration;
                
                // Update audio buffer timing if present
                if (clip.audioBuffer) {
                    clip.timelineStart = clip.start;
                }
            }
        }
        
        // Ripple previous clips backward (rarely used, but supported)
        if (this.rippleMode === 'backward') {
            for (let i = clipIndex - 1; i >= 0; i--) {
                const clip = clips[i];
                clip.end = Math.max(clip.start, clip.end + gapDuration);
            }
        }
        
        // Call callback
        if (this.onRippleCallback) {
            this.onRippleCallback({
                type: 'delete',
                trackId,
                clipId,
                gapDuration,
                affectedClips: clips.slice(clipIndex)
            });
        }
        
        return true;
    }

    // Delete multiple clips and ripple
    deleteClips(trackId, clipIds) {
        const results = [];
        
        // Sort clips by start time (earliest first) for proper ripple
        const sortedIds = this.sortClipIdsByPosition(trackId, clipIds);
        
        for (const clipId of sortedIds) {
            const result = this.deleteClip(trackId, clipId);
            results.push({ clipId, success: result });
        }
        
        return results;
    }

    // Delete clips across multiple tracks
    deleteClipsAcrossTracks(clipTrackPairs) {
        // Group by track
        const byTrack = {};
        
        clipTrackPairs.forEach(({ trackId, clipId }) => {
            if (!byTrack[trackId]) byTrack[trackId] = [];
            byTrack[trackId].push(clipId);
        });
        
        const results = {};
        
        for (const [trackId, clipIds] of Object.entries(byTrack)) {
            results[trackId] = this.deleteClips(trackId, clipIds);
        }
        
        return results;
    }

    // Delete range and ripple
    deleteRange(trackId, start, end) {
        const daw = getDAW();
        if (!daw) return false;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return false;
        
        const clips = track.clips || [];
        const rangeDuration = end - start;
        
        // Find clips within range
        const clipsToDelete = [];
        const clipsToAdjust = [];
        
        clips.forEach(clip => {
            if (clip.start >= end) {
                // After range - will be shifted
                clipsToAdjust.push(clip);
            } else if (clip.end <= start) {
                // Before range - no change
            } else if (clip.start >= start && clip.end <= end) {
                // Fully within range - delete
                clipsToDelete.push(clip);
            } else if (clip.start < start && clip.end > end) {
                // Spans entire range - split
                const newDuration = clip.duration - rangeDuration;
                clip.end = start;
                if (clip.audioBuffer) {
                    clip.duration = newDuration;
                }
                clipsToAdjust.push(clip);
            } else if (clip.start < start && clip.end > start && clip.end <= end) {
                // Partially in range (left side)
                clip.end = start;
            } else if (clip.start >= start && clip.start < end && clip.end > end) {
                // Partially in range (right side)
                clip.start = end - rangeDuration; // Will be shifted
                clip.end -= rangeDuration;
                clipsToAdjust.push(clip);
            }
        });
        
        // Delete clips
        clipsToDelete.forEach(clip => {
            const idx = clips.indexOf(clip);
            if (idx !== -1) clips.splice(idx, 1);
        });
        
        // Ripple (shift clips after the range)
        clipsToAdjust.forEach(clip => {
            clip.start -= rangeDuration;
            clip.end -= rangeDuration;
        });
        
        if (this.onRippleCallback) {
            this.onRippleCallback({
                type: 'deleteRange',
                trackId,
                start,
                end,
                rangeDuration,
                deletedCount: clipsToDelete.length,
                adjustedCount: clipsToAdjust.length
            });
        }
        
        return true;
    }

    // Insert space and ripple clips
    insertSpace(trackId, position, duration) {
        const daw = getDAW();
        if (!daw) return false;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return false;
        
        const clips = track.clips || [];
        
        // Shift all clips at or after position
        clips.forEach(clip => {
            if (clip.start >= position) {
                clip.start += duration;
                clip.end += duration;
            }
        });
        
        if (this.onRippleCallback) {
            this.onRippleCallback({
                type: 'insertSpace',
                trackId,
                position,
                duration
            });
        }
        
        return true;
    }

    // Move clip with ripple
    moveClip(trackId, clipId, newStart, rippleMode = 'forward') {
        const daw = getDAW();
        if (!daw) return false;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return false;
        
        const clips = track.clips || [];
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return false;
        
        const clip = clips[clipIndex];
        const oldStart = clip.start;
        const oldEnd = clip.end;
        const duration = clip.duration || (oldEnd - oldStart);
        const newEnd = newStart + duration;
        const delta = newStart - oldStart;
        
        // Update clip position
        clip.start = newStart;
        clip.end = newEnd;
        
        // Ripple other clips if moving creates/removes space
        if (rippleMode === 'forward') {
            clips.forEach((otherClip, i) => {
                if (i === clipIndex) return;
                
                // If clip moved earlier, shift clips that were in the gap
                if (delta < 0 && otherClip.start >= oldStart) {
                    otherClip.start += delta;
                    otherClip.end += delta;
                }
                // If clip moved later, shift clips that are now in the gap
                else if (delta > 0 && otherClip.start >= oldEnd && otherClip.start < newStart) {
                    otherClip.start += duration;
                    otherClip.end += duration;
                }
            });
        }
        
        if (this.onRippleCallback) {
            this.onRippleCallback({
                type: 'move',
                trackId,
                clipId,
                oldStart,
                newStart,
                delta
            });
        }
        
        return true;
    }

    // Get ripple preview (without actually doing it)
    getRipplePreview(trackId, clipId) {
        const daw = getDAW();
        if (!daw) return null;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return null;
        
        const clips = [...(track.clips || [])];
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return null;
        
        const deletedClip = clips[clipIndex];
        const gapDuration = deletedClip.duration || (deletedClip.end - deletedClip.start);
        
        const affectedClips = [];
        
        for (let i = clipIndex + 1; i < clips.length; i++) {
            affectedClips.push({
                clip: clips[i],
                oldStart: clips[i].start,
                newStart: clips[i].start - gapDuration,
                oldEnd: clips[i].end,
                newEnd: clips[i].end - gapDuration
            });
        }
        
        return {
            deletedClip,
            gapDuration,
            affectedClips
        };
    }

    // Helper to sort clip IDs by position
    sortClipIdsByPosition(trackId, clipIds) {
        const daw = getDAW();
        if (!daw) return clipIds;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return clipIds;
        
        const clips = track.clips || [];
        
        return [...clipIds].sort((a, b) => {
            const clipA = clips.find(c => c.id === a);
            const clipB = clips.find(c => c.id === b);
            return (clipA?.start || 0) - (clipB?.start || 0);
        });
    }

    setRippleMode(mode) {
        this.rippleMode = mode;
        return this.rippleMode;
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }

    setCrossfadeDuration(duration) {
        this.crossfadeDuration = Math.max(0, duration);
        return this.crossfadeDuration;
    }

    setOnRippleCallback(callback) {
        this.onRippleCallback = callback;
    }

    // Undo support - restore clips
    restoreClips(trackId, clipsData) {
        const daw = getDAW();
        if (!daw) return false;
        
        const track = daw.tracks?.find(t => t.id === trackId);
        if (!track) return false;
        
        // Restore clips to their original positions
        clipsData.forEach(clipData => {
            const existingClip = track.clips.find(c => c.id === clipData.id);
            if (existingClip) {
                // Update position
                existingClip.start = clipData.oldStart;
                existingClip.end = clipData.oldEnd;
            } else {
                // Re-add clip
                track.clips.push(clipData);
            }
        });
        
        // Re-sort clips by start time
        track.clips.sort((a, b) => a.start - b.start);
        
        return true;
    }

    dispose() {
        this.onRippleCallback = null;
    }
}

// Singleton instance
let clipRippleDeleteInstance = null;

export function getClipRippleDelete() {
    if (!clipRippleDeleteInstance) {
        clipRippleDeleteInstance = new ClipRippleDelete();
    }
    return clipRippleDeleteInstance;
}

export function openRippleDeletePanel() {
    const ripple = getClipRippleDelete();
    
    const panel = document.createElement('div');
    panel.id = 'ripple-delete-panel';
    panel.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-zinc-900 rounded-lg p-4 z-50';
    panel.innerHTML = `
        <div class="flex items-center gap-4">
            <span class="text-white font-medium">Ripple Delete</span>
            <label class="flex items-center gap-2 text-zinc-300">
                <input type="checkbox" id="ripple-enabled" ${ripple.isEnabled ? 'checked' : ''}>
                Enabled
            </label>
            <select id="ripple-mode" class="bg-zinc-800 text-white rounded px-2 py-1">
                <option value="forward" ${ripple.rippleMode === 'forward' ? 'selected' : ''}>Forward</option>
                <option value="backward" ${ripple.rippleMode === 'backward' ? 'selected' : ''}>Backward</option>
                <option value="all" ${ripple.rippleMode === 'all' ? 'selected' : ''}>All</option>
            </select>
            <button id="close-ripple-panel" class="text-zinc-400 hover:text-white">&times;</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('ripple-enabled').onchange = (e) => {
        ripple.setEnabled(e.target.checked);
    };
    
    document.getElementById('ripple-mode').onchange = (e) => {
        ripple.setRippleMode(e.target.value);
    };
    
    document.getElementById('close-ripple-panel').onclick = () => {
        panel.remove();
    };
    
    return panel;
}