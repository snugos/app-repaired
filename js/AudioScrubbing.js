/**
 * Audio Scrubbing
 * Scrub through audio by dragging on the timeline with audible playback
 * Allows pitch-preserved preview playback at different speeds
 */

class AudioScrubber {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isScrubbing = false;
        this.scrubPosition = 0;
        this.scrubSpeed = 1;
        this.playbackNode = null;
        this.gainNode = null;
        this.activeBuffer = null;
        this.activeSource = null;
        this.onPositionChange = null;
        this.scrubRate = 1; // Playback rate multiplier
        
        // Scrub control parameters
        this.minSpeed = 0.25;
        this.maxSpeed = 2;
        this.defaultSpeed = 1;
    }
    
    /**
     * Load an audio buffer for scrubbing
     */
    loadBuffer(buffer) {
        this.activeBuffer = buffer;
    }
    
    /**
     * Start scrubbing at a position
     */
    startScrub(position, options = {}) {
        if (!this.activeBuffer) {
            console.warn('[AudioScrubber] No buffer loaded');
            return false;
        }
        
        this.stopScrub();
        
        this.isScrubbing = true;
        this.scrubPosition = Math.max(0, Math.min(position, this.activeBuffer.duration));
        this.scrubSpeed = options.speed || this.defaultSpeed;
        
        // Create playback chain
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = options.volume || 0.8;
        this.gainNode.connect(this.audioContext.destination);
        
        this.playbackNode = this.audioContext.createBufferSource();
        this.playbackNode.buffer = this.activeBuffer;
        this.playbackNode.playbackRate.value = this.scrubSpeed;
        this.playbackNode.connect(this.gainNode);
        
        this.playbackNode.start(0, this.scrubPosition);
        this._startPositionTracking();
        
        console.log(`[AudioScrubber] Started at ${this.scrubPosition.toFixed(2)}s, speed: ${this.scrubSpeed}`);
        return true;
    }
    
    /**
     * Update scrub position and speed
     */
    updateScrub(position, speed = null) {
        if (!this.isScrubbing) return;
        
        this.scrubPosition = Math.max(0, Math.min(position, this.activeBuffer?.duration || 0));
        if (speed !== null) {
            this.scrubSpeed = Math.max(this.minSpeed, Math.min(this.maxSpeed, speed));
        }
        
        // Restart from new position with new speed
        if (this.playbackNode && this.activeBuffer) {
            try {
                this.playbackNode.stop();
            } catch (e) {}
            
            this.playbackNode = this.audioContext.createBufferSource();
            this.playbackNode.buffer = this.activeBuffer;
            this.playbackNode.playbackRate.value = this.scrubSpeed;
            this.playbackNode.connect(this.gainNode);
            this.playbackNode.start(0, this.scrubPosition);
        }
    }
    
    /**
     * Stop scrubbing
     */
    stopScrub() {
        if (!this.isScrubbing) return;
        
        this.isScrubbing = false;
        
        if (this.playbackNode) {
            try {
                this.playbackNode.stop();
            } catch (e) {}
            this.playbackNode.disconnect();
            this.playbackNode = null;
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        
        if (this.positionInterval) {
            clearInterval(this.positionInterval);
            this.positionInterval = null;
        }
        
        console.log(`[AudioScrubber] Stopped at ${this.scrubPosition.toFixed(2)}s`);
    }
    
    /**
     * Set scrub volume
     */
    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.setTargetAtTime(
                Math.max(0, Math.min(1, volume)),
                this.audioContext.currentTime,
                0.01
            );
        }
    }
    
    /**
     * Set scrub speed
     */
    setSpeed(speed) {
        this.scrubSpeed = Math.max(this.minSpeed, Math.min(this.maxSpeed, speed));
        if (this.playbackNode) {
            this.playbackNode.playbackRate.setTargetAtTime(
                this.scrubSpeed,
                this.audioContext.currentTime,
                0.01
            );
        }
    }
    
    /**
     * Get current scrub position
     */
    getPosition() {
        return this.scrubPosition;
    }
    
    /**
     * Get current speed
     */
    getSpeed() {
        return this.scrubSpeed;
    }
    
    /**
     * Check if currently scrubbing
     */
    getIsScrubbing() {
        return this.isScrubbing;
    }
    
    /**
     * Position tracking interval
     */
    _startPositionTracking() {
        if (this.positionInterval) {
            clearInterval(this.positionInterval);
        }
        
        this.positionInterval = setInterval(() => {
            if (!this.isScrubbing || !this.playbackNode || !this.activeBuffer) return;
            
            // Calculate current position based on playback
            const elapsed = this.playbackNode.context.currentTime - this.playbackNode.startTime;
            const calculatedPos = this.scrubPosition + (elapsed * this.scrubSpeed);
            
            if (calculatedPos >= this.activeBuffer.duration) {
                // Reached end, loop or stop
                this.scrubPosition = 0;
                this.updateScrub(0);
            } else {
                this.scrubPosition = calculatedPos;
            }
            
            if (this.onPositionChange) {
                this.onPositionChange(this.scrubPosition);
            }
        }, 50);
    }
    
    /**
     * Dispose
     */
    dispose() {
        this.stopScrub();
        this.activeBuffer = null;
    }
}

/**
 * Create AudioScrubber instance
 */
function createAudioScrubber(audioContext) {
    return new AudioScrubber(audioContext);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioScrubber, createAudioScrubber };
}