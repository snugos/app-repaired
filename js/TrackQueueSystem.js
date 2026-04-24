/**
 * Track Queue System - Queue tracks for sequential playback
 * Manages a playlist-style queue of tracks for automated playback sequencing
 */

export class TrackQueueSystem {
    constructor(options = {}) {
        // Queue state
        this.queue = [];
        this.playedItems = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        
        // Settings
        this.repeatMode = options.repeatMode ?? 'none'; // none, one, all
        this.shuffleEnabled = options.shuffleEnabled ?? false;
        this.crossfadeEnabled = options.crossfadeEnabled ?? false;
        this.crossfadeDuration = options.crossfadeDuration ?? 2; // seconds
        this.autoPlay = options.autoPlay ?? true; // Auto-play next track
        
        // Playback state
        this.currentTrack = null;
        this.nextTrack = null;
        this.crossfadeTimer = null;
        
        // Callbacks
        this.onTrackStart = null;
        this.onTrackEnd = null;
        this.onQueueChange = null;
        this.onQueueEnd = null;
        
        console.log('[TrackQueueSystem] Initialized');
    }
    
    // Add track to queue
    addTrack(track, position = null) {
        const queueItem = {
            id: this._generateId(),
            track: track,
            trackId: track.id,
            trackName: track.name,
            duration: track.duration || 0,
            addedAt: Date.now(),
            metadata: {
                artist: track.artist || 'Unknown',
                album: track.album || 'Unknown',
                genre: track.genre || 'Unknown'
            }
        };
        
        if (position !== null && position >= 0 && position <= this.queue.length) {
            this.queue.splice(position, 0, queueItem);
        } else {
            this.queue.push(queueItem);
        }
        
        this._triggerQueueChange();
        
        console.log(`[TrackQueueSystem] Added track: ${queueItem.trackName}`);
        
        return queueItem.id;
    }
    
    // Add multiple tracks
    addTracks(tracks, position = null) {
        const ids = [];
        
        if (position !== null) {
            tracks.reverse().forEach((track, i) => {
                ids.unshift(this.addTrack(track, position));
            });
        } else {
            tracks.forEach(track => {
                ids.push(this.addTrack(track));
            });
        }
        
        return ids;
    }
    
    // Remove track from queue
    removeTrack(queueItemId) {
        const index = this.queue.findIndex(item => item.id === queueItemId);
        
        if (index === -1) {
            console.warn(`[TrackQueueSystem] Track not found: ${queueItemId}`);
            return false;
        }
        
        const removed = this.queue.splice(index, 1)[0];
        
        // Adjust current index if necessary
        if (index < this.currentIndex) {
            this.currentIndex--;
        }
        
        this._triggerQueueChange();
        
        console.log(`[TrackQueueSystem] Removed track: ${removed.trackName}`);
        
        return true;
    }
    
    // Move track in queue
    moveTrack(queueItemId, newPosition) {
        const currentIndex = this.queue.findIndex(item => item.id === queueItemId);
        
        if (currentIndex === -1) return false;
        if (newPosition < 0 || newPosition >= this.queue.length) return false;
        
        const item = this.queue.splice(currentIndex, 1)[0];
        this.queue.splice(newPosition, 0, item);
        
        // Adjust current index
        if (currentIndex === this.currentIndex) {
            this.currentIndex = newPosition;
        } else if (currentIndex < this.currentIndex && newPosition >= this.currentIndex) {
            this.currentIndex--;
        } else if (currentIndex > this.currentIndex && newPosition <= this.currentIndex) {
            this.currentIndex++;
        }
        
        this._triggerQueueChange();
        
        console.log(`[TrackQueueSystem] Moved track to position ${newPosition}`);
        
        return true;
    }
    
    // Clear queue
    clearQueue() {
        this.stop();
        this.queue = [];
        this.playedItems = [];
        this.currentIndex = -1;
        this.currentTrack = null;
        this.nextTrack = null;
        
        this._triggerQueueChange();
        
        console.log('[TrackQueueSystem] Queue cleared');
    }
    
    // Playback control
    play() {
        if (this.queue.length === 0) {
            console.warn('[TrackQueueSystem] Queue is empty');
            return;
        }
        
        if (this.currentIndex === -1) {
            this.currentIndex = 0;
        }
        
        this.isPlaying = true;
        this.currentTrack = this.queue[this.currentIndex];
        
        if (this.currentTrack && this.currentTrack.track) {
            // Start playback
            if (typeof this.currentTrack.track.play === 'function') {
                this.currentTrack.track.play();
            }
            
            if (this.onTrackStart) {
                this.onTrackStart(this.currentTrack);
            }
            
            // Schedule crossfade if enabled
            if (this.crossfadeEnabled) {
                this._scheduleCrossfade();
            }
            
            // Schedule auto-play next
            if (this.autoPlay) {
                this._scheduleNextTrack();
            }
        }
        
        console.log(`[TrackQueueSystem] Playing: ${this.currentTrack?.trackName}`);
    }
    
    pause() {
        this.isPlaying = false;
        
        if (this.currentTrack && this.currentTrack.track) {
            if (typeof this.currentTrack.track.pause === 'function') {
                this.currentTrack.track.pause();
            }
        }
        
        if (this.crossfadeTimer) {
            clearTimeout(this.crossfadeTimer);
            this.crossfadeTimer = null;
        }
        
        console.log('[TrackQueueSystem] Paused');
    }
    
    stop() {
        this.isPlaying = false;
        
        if (this.currentTrack && this.currentTrack.track) {
            if (typeof this.currentTrack.track.stop === 'function') {
                this.currentTrack.track.stop();
            }
        }
        
        if (this.crossfadeTimer) {
            clearTimeout(this.crossfadeTimer);
            this.crossfadeTimer = null;
        }
        
        console.log('[TrackQueueSystem] Stopped');
    }
    
    next() {
        if (this.queue.length === 0) return;
        
        // Move current to played
        if (this.currentTrack) {
            this.playedItems.push(this.currentTrack);
        }
        
        // Get next index
        let nextIndex = this._getNextIndex();
        
        if (nextIndex === -1) {
            // Queue ended
            if (this.onQueueEnd) {
                this.onQueueEnd();
            }
            this.stop();
            return;
        }
        
        this.currentIndex = nextIndex;
        this.currentTrack = this.queue[nextIndex];
        
        if (this.isPlaying) {
            this.play();
        }
        
        console.log(`[TrackQueueSystem] Next track: ${this.currentTrack?.trackName}`);
    }
    
    previous() {
        if (this.playedItems.length === 0) return;
        
        // Move current back to queue front
        if (this.currentTrack) {
            this.queue.unshift(this.currentTrack);
        }
        
        // Get last played
        const lastPlayed = this.playedItems.pop();
        this.queue.unshift(lastPlayed);
        this.currentIndex = 0;
        this.currentTrack = lastPlayed;
        
        if (this.isPlaying) {
            this.play();
        }
        
        this._triggerQueueChange();
        
        console.log(`[TrackQueueSystem] Previous track: ${this.currentTrack?.trackName}`);
    }
    
    goToIndex(index) {
        if (index < 0 || index >= this.queue.length) return;
        
        // Move tracks between current and target to played
        if (index < this.currentIndex) {
            // Going backwards - move tracks to played
            for (let i = this.currentIndex - 1; i >= index; i--) {
                this.playedItems.push(this.queue[i]);
            }
        } else if (index > this.currentIndex) {
            // Going forwards - current track to played
            if (this.currentTrack) {
                this.playedItems.push(this.currentTrack);
            }
        }
        
        this.currentIndex = index;
        this.currentTrack = this.queue[index];
        
        if (this.isPlaying) {
            this.play();
        }
        
        console.log(`[TrackQueueSystem] Jumped to: ${this.currentTrack?.trackName}`);
    }
    
    // Get next index based on repeat mode and shuffle
    _getNextIndex() {
        if (this.shuffleEnabled) {
            // Get random unplayed track
            const unplayed = this.queue.filter((item, idx) => 
                !this.playedItems.includes(item) && idx !== this.currentIndex
            );
            
            if (unplayed.length === 0) {
                if (this.repeatMode === 'all') {
                    this.playedItems = [];
                    return Math.floor(Math.random() * this.queue.length);
                }
                return -1;
            }
            
            const randomItem = unplayed[Math.floor(Math.random() * unplayed.length)];
            return this.queue.indexOf(randomItem);
        }
        
        // Sequential playback
        const nextIdx = this.currentIndex + 1;
        
        if (nextIdx >= this.queue.length) {
            if (this.repeatMode === 'all') {
                return 0;
            } else if (this.repeatMode === 'one') {
                return this.currentIndex;
            }
            return -1;
        }
        
        return nextIdx;
    }
    
    _scheduleCrossfade() {
        if (!this.crossfadeEnabled || !this.currentTrack) return;
        
        const duration = this.currentTrack.duration;
        const fadeStartTime = duration - this.crossfadeDuration;
        
        if (fadeStartTime > 0) {
            this.crossfadeTimer = setTimeout(() => {
                this._performCrossfade();
            }, fadeStartTime * 1000);
        }
    }
    
    _performCrossfade() {
        const nextIndex = this._getNextIndex();
        
        if (nextIndex === -1) return;
        
        const nextTrack = this.queue[nextIndex];
        
        // Start next track at low volume
        if (nextTrack.track && typeof nextTrack.track.play === 'function') {
            nextTrack.track.play();
            // Fade in next track
            this._fadeIn(nextTrack.track, this.crossfadeDuration);
        }
        
        // Fade out current track
        if (this.currentTrack.track) {
            this._fadeOut(this.currentTrack.track, this.crossfadeDuration);
        }
        
        console.log(`[TrackQueueSystem] Crossfading to: ${nextTrack.trackName}`);
    }
    
    _fadeIn(track, duration) {
        // Fade in implementation
        if (track.gainNode) {
            track.gainNode.gain.setValueAtTime(0, this.audioContext?.currentTime || 0);
            track.gainNode.gain.linearRampToValueAtTime(
                1,
                (this.audioContext?.currentTime || 0) + duration
            );
        }
    }
    
    _fadeOut(track, duration) {
        // Fade out implementation
        if (track.gainNode) {
            track.gainNode.gain.linearRampToValueAtTime(
                0,
                (this.audioContext?.currentTime || 0) + duration
            );
        }
        
        // Stop after fade
        setTimeout(() => {
            if (typeof track.stop === 'function') {
                track.stop();
            }
        }, duration * 1000);
    }
    
    _scheduleNextTrack() {
        if (!this.autoPlay || !this.currentTrack) return;
        
        // Listen for track end
        if (this.currentTrack.track && typeof this.currentTrack.track.onEnded === 'function') {
            this.currentTrack.track.onEnded = () => {
                this.next();
            };
        }
    }
    
    // Settings
    setRepeatMode(mode) {
        if (['none', 'one', 'all'].includes(mode)) {
            this.repeatMode = mode;
            console.log(`[TrackQueueSystem] Repeat mode: ${mode}`);
        }
    }
    
    getRepeatMode() {
        return this.repeatMode;
    }
    
    setShuffle(enabled) {
        this.shuffleEnabled = enabled;
        console.log(`[TrackQueueSystem] Shuffle: ${enabled}`);
    }
    
    isShuffleEnabled() {
        return this.shuffleEnabled;
    }
    
    setCrossfade(enabled, duration = 2) {
        this.crossfadeEnabled = enabled;
        this.crossfadeDuration = duration;
        console.log(`[TrackQueueSystem] Crossfade: ${enabled}, ${duration}s`);
    }
    
    setAutoPlay(enabled) {
        this.autoPlay = enabled;
    }
    
    // Queue info
    getQueue() {
        return this.queue.map(item => ({
            id: item.id,
            trackId: item.trackId,
            trackName: item.trackName,
            duration: item.duration,
            metadata: item.metadata
        }));
    }
    
    getQueueLength() {
        return this.queue.length;
    }
    
    getCurrentTrack() {
        return this.currentTrack;
    }
    
    getCurrentIndex() {
        return this.currentIndex;
    }
    
    getUpcoming(count = 5) {
        return this.queue.slice(this.currentIndex + 1, this.currentIndex + 1 + count);
    }
    
    getRecentlyPlayed(count = 5) {
        return this.playedItems.slice(-count).reverse();
    }
    
    getTotalDuration() {
        return this.queue.reduce((sum, item) => sum + item.duration, 0);
    }
    
    // Save/load queue
    exportQueue() {
        return {
            items: this.queue.map(item => ({
                trackId: item.trackId,
                trackName: item.trackName,
                duration: item.duration,
                metadata: item.metadata
            })),
            settings: {
                repeatMode: this.repeatMode,
                shuffleEnabled: this.shuffleEnabled,
                crossfadeEnabled: this.crossfadeEnabled,
                crossfadeDuration: this.crossfadeDuration,
                autoPlay: this.autoPlay
            }
        };
    }
    
    importQueue(data, trackLoader) {
        this.clearQueue();
        
        // Restore settings
        if (data.settings) {
            this.repeatMode = data.settings.repeatMode || 'none';
            this.shuffleEnabled = data.settings.shuffleEnabled || false;
            this.crossfadeEnabled = data.settings.crossfadeEnabled || false;
            this.crossfadeDuration = data.settings.crossfadeDuration || 2;
            this.autoPlay = data.settings.autoPlay ?? true;
        }
        
        // Load tracks
        if (data.items && trackLoader) {
            data.items.forEach(async item => {
                const track = await trackLoader(item.trackId);
                if (track) {
                    this.addTrack(track);
                }
            });
        }
        
        console.log('[TrackQueueSystem] Queue imported');
    }
    
    // Utility
    _generateId() {
        return 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    _triggerQueueChange() {
        if (this.onQueueChange) {
            this.onQueueChange(this.getQueue());
        }
    }
    
    dispose() {
        this.stop();
        this.clearQueue();
        
        this.onTrackStart = null;
        this.onTrackEnd = null;
        this.onQueueChange = null;
        this.onQueueEnd = null;
        
        console.log('[TrackQueueSystem] Disposed');
    }
}

// Static methods
TrackQueueSystem.getMetronomeAudioLabel = function() { return 'Track Queue System'; };

console.log('[TrackQueueSystem] Module loaded');