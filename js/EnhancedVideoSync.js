// js/EnhancedVideoSync.js - Enhanced Video Sync for SnugOS DAW
// Features: SMPTE timecode, LTC output, video sync, timecode display

/**
 * SMPTE Timecode Frame Rates
 */
export const FrameRate = {
    FPS_23_976: 23.976, // Film
    FPS_24: 24,         // Cinema
    FPS_25: 25,         // PAL
    FPS_29_97_DROP: 29.97, // NTSC Drop Frame
    FPS_29_97_ND: 29.97,   // NTSC Non-Drop
    FPS_30: 30,        // NTSC Non-Drop
    FPS_50: 50,        // PAL High
    FPS_59_94: 59.94,  // NTSC High
    FPS_60: 60         // High Frame Rate
};

/**
 * Timecode Types
 */
export const TimecodeType = {
    SMPTE: 'smpte',
    MIDI: 'midi',
    LINEAR: 'linear',
    VITC: 'vitc', // Vertical Interval Timecode
    LTC: 'ltc'    // Linear Timecode (audio)
};

/**
 * Sync Modes
 */
export const SyncMode = {
    INTERNAL: 'internal',
    EXTERNAL_MIDI: 'external_midi',
    EXTERNAL_LTC: 'external_ltc',
    VIDEO_SLAVE: 'video_slave',
    NETWORK: 'network'
};

/**
 * SMPTE Timecode
 */
export class SMPTETimecode {
    constructor(options = {}) {
        this.hours = options.hours || 0;
        this.minutes = options.minutes || 0;
        this.seconds = options.seconds || 0;
        this.frames = options.frames || 0;
        this.frameRate = options.frameRate || FrameRate.FPS_30;
        this.dropFrame = options.dropFrame || false;
    }

    /**
     * Get total frames
     * @returns {number} Total frames
     */
    getTotalFrames() {
        const framesPerSecond = this.frameRate;
        const framesPerMinute = framesPerSecond * 60;
        const framesPerHour = framesPerMinute * 60;
        
        let total = this.frames;
        total += this.seconds * framesPerSecond;
        total += this.minutes * framesPerMinute;
        total += this.hours * framesPerHour;
        
        // Adjust for drop frame if applicable
        if (this.dropFrame && this.frameRate === 29.97) {
            // Drop frame drops frames 0 and 1 at the start of each minute,
            // except every 10th minute
            const minutesExceptTens = this.minutes - Math.floor(this.minutes / 10);
            total -= minutesExceptTens * 2;
            total -= this.hours * 108; // 2 frames * 54 (minutes except tens per hour)
        }
        
        return Math.floor(total);
    }

    /**
     * Set from total frames
     * @param {number} totalFrames - Total frames
     */
    setFromTotalFrames(totalFrames) {
        const framesPerSecond = this.frameRate;
        const framesPerMinute = framesPerSecond * 60;
        const framesPerHour = framesPerMinute * 60;
        
        // Adjust for drop frame
        let adjustedFrames = totalFrames;
        if (this.dropFrame && this.frameRate === 29.97) {
            const droppedFrames = Math.floor(totalFrames / 17982) * 2;
            const remainingFrames = totalFrames % 17982;
            const extraDropped = Math.floor(remainingFrames / 1800) * 2;
            adjustedFrames = totalFrames + droppedFrames + extraDropped;
        }
        
        this.hours = Math.floor(adjustedFrames / framesPerHour);
        adjustedFrames %= framesPerHour;
        
        this.minutes = Math.floor(adjustedFrames / framesPerMinute);
        adjustedFrames %= framesPerMinute;
        
        this.seconds = Math.floor(adjustedFrames / framesPerSecond);
        this.frames = Math.floor(adjustedFrames % framesPerSecond);
    }

    /**
     * Convert to seconds
     * @returns {number} Time in seconds
     */
    toSeconds() {
        return this.getTotalFrames() / this.frameRate;
    }

    /**
     * Set from seconds
     * @param {number} seconds - Time in seconds
     */
    setFromSeconds(seconds) {
        const totalFrames = seconds * this.frameRate;
        this.setFromTotalFrames(totalFrames);
    }

    /**
     * Format as string
     * @param {boolean} showFrames - Show frames in output
     * @returns {string} Formatted timecode
     */
    toString(showFrames = true) {
        const h = String(this.hours).padStart(2, '0');
        const m = String(this.minutes).padStart(2, '0');
        const s = String(this.seconds).padStart(2, '0');
        const f = String(Math.floor(this.frames)).padStart(2, '0');
        
        const separator = this.dropFrame ? ';' : ':';
        
        if (showFrames) {
            return `${h}:${m}:${s}${separator}${f}`;
        }
        return `${h}:${m}:${s}`;
    }

    /**
     * Parse from string
     * @param {string} str - Timecode string
     * @returns {SMPTETimecode} Parsed timecode
     */
    static fromString(str, frameRate = FrameRate.FPS_30) {
        const parts = str.split(/[:;]/);
        const dropFrame = str.includes(';');
        
        return new SMPTETimecode({
            hours: parseInt(parts[0]) || 0,
            minutes: parseInt(parts[1]) || 0,
            seconds: parseInt(parts[2]) || 0,
            frames: parseInt(parts[3]) || 0,
            frameRate,
            dropFrame
        });
    }

    /**
     * Add frames
     * @param {number} frames - Frames to add
     */
    addFrames(frames) {
        const total = this.getTotalFrames() + frames;
        this.setFromTotalFrames(total);
    }

    /**
     * Subtract frames
     * @param {number} frames - Frames to subtract
     */
    subtractFrames(frames) {
        const total = this.getTotalFrames() - frames;
        if (total >= 0) {
            this.setFromTotalFrames(total);
        }
    }

    /**
     * Compare to another timecode
     * @param {SMPTETimecode} other - Other timecode
     * @returns {number} -1, 0, or 1
     */
    compareTo(other) {
        const thisFrames = this.getTotalFrames();
        const otherFrames = other.getTotalFrames();
        
        if (thisFrames < otherFrames) return -1;
        if (thisFrames > otherFrames) return 1;
        return 0;
    }

    /**
     * Clone this timecode
     * @returns {SMPTETimecode} Cloned timecode
     */
    clone() {
        return new SMPTETimecode({
            hours: this.hours,
            minutes: this.minutes,
            seconds: this.seconds,
            frames: this.frames,
            frameRate: this.frameRate,
            dropFrame: this.dropFrame
        });
    }

    /**
     * Convert to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            hours: this.hours,
            minutes: this.minutes,
            seconds: this.seconds,
            frames: this.frames,
            frameRate: this.frameRate,
            dropFrame: this.dropFrame,
            string: this.toString()
        };
    }
}

/**
 * LTC Generator - Linear Timecode Audio Generator
 */
export class LTCGenerator {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 48000;
        this.frameRate = options.frameRate || FrameRate.FPS_30;
        this.amplitude = options.amplitude || 0.5;
        this.dropFrame = options.dropFrame || false;
        
        // LTC bit patterns
        this.syncWord = [0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1];
    }

    /**
     * Generate LTC audio for a timecode
     * @param {SMPTETimecode} timecode - Timecode to encode
     * @param {number} duration - Duration in seconds
     * @returns {Float32Array} Audio samples
     */
    generateLTC(timecode, duration = 1) {
        const samplesPerFrame = this.sampleRate / this.frameRate;
        const totalSamples = Math.floor(duration * this.sampleRate);
        const audioData = new Float32Array(totalSamples);
        
        let currentFrame = timecode.getTotalFrames();
        const totalFrames = Math.floor(duration * this.frameRate);
        
        for (let frame = 0; frame < totalFrames; frame++) {
            const frameTimecode = new SMPTETimecode({ frameRate: this.frameRate, dropFrame: this.dropFrame });
            frameTimecode.setFromTotalFrames(currentFrame + frame);
            
            const frameBits = this._encodeTimecodeToBits(frameTimecode);
            const frameStartSample = Math.floor(frame * samplesPerFrame);
            
            // Generate audio for this frame
            this._generateFrameAudio(audioData, frameStartSample, samplesPerFrame, frameBits);
        }
        
        return audioData;
    }

    /**
     * Encode timecode to LTC bit pattern
     * @private
     */
    _encodeTimecodeToBits(timecode) {
        const bits = new Array(80).fill(0);
        
        // Frame number (bits 0-3)
        const frameUnits = timecode.frames % 10;
        const frameTens = Math.floor(timecode.frames / 10);
        this._setBCD(bits, 0, frameUnits);
        this._setBCD(bits, 8, frameTens);
        
        // Seconds (bits 16-23)
        const secUnits = timecode.seconds % 10;
        const secTens = Math.floor(timecode.seconds / 10);
        this._setBCD(bits, 16, secUnits);
        this._setBCD(bits, 24, secTens);
        
        // Minutes (bits 32-39)
        const minUnits = timecode.minutes % 10;
        const minTens = Math.floor(timecode.minutes / 10);
        this._setBCD(bits, 32, minUnits);
        this._setBCD(bits, 40, minTens);
        
        // Hours (bits 48-55)
        const hourUnits = timecode.hours % 10;
        const hourTens = Math.floor(timecode.hours / 10);
        this._setBCD(bits, 48, hourUnits);
        this._setBCD(bits, 56, hourTens);
        
        // Sync word (bits 64-79)
        for (let i = 0; i < 16; i++) {
            bits[64 + i] = this.syncWord[i];
        }
        
        // Drop frame flag (bit 10)
        if (timecode.dropFrame) {
            bits[10] = 1;
        }
        
        // Polarity correction bit (bit 27)
        let polarity = 0;
        for (let i = 0; i < 64; i++) {
            polarity += bits[i];
        }
        bits[59] = polarity % 2;
        
        return bits;
    }

    /**
     * Set BCD encoded value
     * @private
     */
    _setBCD(bits, start, value) {
        for (let i = 0; i < 4; i++) {
            bits[start + i] = (value >> i) & 1;
        }
    }

    /**
     * Generate audio for one frame
     * @private
     */
    _generateFrameAudio(audioData, startSample, samplesPerFrame, bits) {
        const samplesPerBit = samplesPerFrame / 80;
        
        for (let bitIndex = 0; bitIndex < 80; bitIndex++) {
            const bit = bits[bitIndex];
            const bitStartSample = startSample + Math.floor(bitIndex * samplesPerBit);
            
            // Generate Manchester encoded signal
            for (let i = 0; i < samplesPerBit && bitStartSample + i < audioData.length; i++) {
                const phase = (i / samplesPerBit) * Math.PI * 2;
                let sample;
                
                if (bit === 0) {
                    // Low-to-high transition
                    sample = Math.sin(phase * 2);
                } else {
                    // High-to-low transition
                    sample = -Math.sin(phase * 2);
                }
                
                audioData[bitStartSample + i] = sample * this.amplitude;
            }
        }
    }

    /**
     * Get LTC as AudioBuffer
     * @param {AudioContext} audioContext - Web Audio context
     * @param {SMPTETimecode} startTimecode - Starting timecode
     * @param {number} duration - Duration in seconds
     * @returns {AudioBuffer} Audio buffer
     */
    getLTCBuffer(audioContext, startTimecode, duration) {
        const samples = this.generateLTC(startTimecode, duration);
        const buffer = audioContext.createBuffer(1, samples.length, this.sampleRate);
        buffer.getChannelData(0).set(samples);
        return buffer;
    }
}

/**
 * LTC Decoder - Parse LTC audio signal
 */
export class LTCDecoder {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 48000;
        this.frameRate = options.frameRate || FrameRate.FPS_30;
        this.threshold = options.threshold || 0.1;
        this.syncWord = [0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1];
        
        this.listeners = new Map();
        this.decoding = false;
    }

    /**
     * Start decoding from audio source
     * @param {AudioNode} source - Audio source node
     */
    startDecoding(source) {
        this.decoding = true;
        this._emit('decodingStarted');
        
        // In real implementation, would set up audio processing
        // to analyze incoming signal
    }

    /**
     * Stop decoding
     */
    stopDecoding() {
        this.decoding = false;
        this._emit('decodingStopped');
    }

    /**
     * Decode audio samples to timecode
     * @param {Float32Array} samples - Audio samples
     * @returns {SMPTETimecode|null} Decoded timecode
     */
    decode(samples) {
        // Detect sync word
        const syncPosition = this._findSyncWord(samples);
        if (syncPosition === -1) return null;
        
        // Extract bits after sync word
        const bits = this._extractBits(samples, syncPosition);
        if (!bits) return null;
        
        // Parse timecode from bits
        return this._parseBitsToTimecode(bits);
    }

    /**
     * Find sync word in samples
     * @private
     */
    _findSyncWord(samples) {
        // Simplified sync detection
        for (let i = 0; i < samples.length - 80; i++) {
            // Check for sync word pattern
            // Real implementation would use correlation
        }
        return 0;
    }

    /**
     * Extract bits from audio
     * @private
     */
    _extractBits(samples, start) {
        const bits = new Array(80);
        const samplesPerBit = this.sampleRate / this.frameRate / 80;
        
        for (let i = 0; i < 80; i++) {
            const bitStart = start + Math.floor(i * samplesPerBit);
            const bitEnd = bitStart + Math.floor(samplesPerBit);
            
            // Analyze signal for this bit period
            let sum = 0;
            for (let j = bitStart; j < bitEnd && j < samples.length; j++) {
                sum += samples[j];
            }
            
            bits[i] = sum > 0 ? 1 : 0;
        }
        
        return bits;
    }

    /**
     * Parse bits to timecode
     * @private
     */
    _parseBitsToTimecode(bits) {
        // Parse BCD encoded values
        const frames = this._getBCD(bits, 0) + this._getBCD(bits, 8) * 10;
        const seconds = this._getBCD(bits, 16) + this._getBCD(bits, 24) * 10;
        const minutes = this._getBCD(bits, 32) + this._getBCD(bits, 40) * 10;
        const hours = this._getBCD(bits, 48) + this._getBCD(bits, 56) * 10;
        const dropFrame = bits[10] === 1;
        
        return new SMPTETimecode({
            hours, minutes, seconds, frames,
            frameRate: this.frameRate,
            dropFrame
        });
    }

    /**
     * Get BCD value from bits
     * @private
     */
    _getBCD(bits, start) {
        let value = 0;
        for (let i = 0; i < 4; i++) {
            if (bits[start + i]) {
                value += 1 << i;
            }
        }
        return value;
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }
}

/**
 * Enhanced Video Sync Manager
 */
export class EnhancedVideoSync {
    constructor(options = {}) {
        this.syncMode = options.syncMode || SyncMode.INTERNAL;
        this.frameRate = options.frameRate || FrameRate.FPS_30;
        this.dropFrame = options.dropFrame || false;
        
        this.currentTimecode = new SMPTETimecode({
            frameRate: this.frameRate,
            dropFrame: this.dropFrame
        });
        
        this.offset = options.offset || 0; // Offset in frames
        this.videoElement = null;
        this.isPlaying = false;
        
        this.ltcGenerator = new LTCGenerator({
            frameRate: this.frameRate,
            dropFrame: this.dropFrame
        });
        
        this.ltcDecoder = new LTCDecoder({
            frameRate: this.frameRate
        });
        
        this.listeners = new Map();
        this.updateInterval = null;
    }

    /**
     * Set video element to sync
     * @param {HTMLVideoElement} video - Video element
     */
    setVideoElement(video) {
        this.videoElement = video;
        
        // Set up video event listeners
        video.addEventListener('timeupdate', () => {
            this._updateTimecodeFromVideo();
        });
        
        video.addEventListener('play', () => {
            this.isPlaying = true;
            this._emit('play');
        });
        
        video.addEventListener('pause', () => {
            this.isPlaying = false;
            this._emit('pause');
        });
    }

    /**
     * Update timecode from video position
     * @private
     */
    _updateTimecodeFromVideo() {
        if (!this.videoElement) return;
        
        const seconds = this.videoElement.currentTime;
        this.currentTimecode.setFromSeconds(seconds);
        this.currentTimecode.addFrames(this.offset);
        
        this._emit('timecodeUpdate', this.currentTimecode.toJSON());
    }

    /**
     * Set sync mode
     * @param {string} mode - Sync mode
     */
    setSyncMode(mode) {
        this.syncMode = mode;
        this._emit('syncModeChange', mode);
    }

    /**
     * Seek to timecode
     * @param {SMPTETimecode} timecode - Target timecode
     */
    seekToTimecode(timecode) {
        if (this.videoElement) {
            const seconds = timecode.toSeconds() - this.offset / this.frameRate;
            this.videoElement.currentTime = Math.max(0, seconds);
        }
        
        this.currentTimecode = timecode.clone();
        this._emit('timecodeUpdate', this.currentTimecode.toJSON());
    }

    /**
     * Seek to timecode string
     * @param {string} timecodeStr - Timecode string (HH:MM:SS:FF)
     */
    seekToTimecodeString(timecodeStr) {
        const timecode = SMPTETimecode.fromString(timecodeStr, this.frameRate);
        timecode.dropFrame = this.dropFrame;
        this.seekToTimecode(timecode);
    }

    /**
     * Get current timecode
     * @returns {SMPTETimecode} Current timecode
     */
    getCurrentTimecode() {
        return this.currentTimecode.clone();
    }

    /**
     * Get current timecode as string
     * @returns {string} Timecode string
     */
    getCurrentTimecodeString() {
        return this.currentTimecode.toString();
    }

    /**
     * Set frame rate
     * @param {number} frameRate - Frame rate
     */
    setFrameRate(frameRate) {
        this.frameRate = frameRate;
        this.currentTimecode.frameRate = frameRate;
        
        this.ltcGenerator.frameRate = frameRate;
        this.ltcDecoder.frameRate = frameRate;
        
        this._emit('frameRateChange', frameRate);
    }

    /**
     * Set offset
     * @param {number} frames - Offset in frames
     */
    setOffset(frames) {
        this.offset = frames;
        this._emit('offsetChange', frames);
    }

    /**
     * Generate LTC output
     * @param {AudioContext} audioContext - Web Audio context
     * @param {number} duration - Duration in seconds
     * @returns {AudioBuffer} LTC audio buffer
     */
    generateLTCOutput(audioContext, duration = 10) {
        return this.ltcGenerator.getLTCBuffer(audioContext, this.currentTimecode, duration);
    }

    /**
     * Create timecode display element
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement} Display element
     */
    createTimecodeDisplay(container) {
        const display = document.createElement('div');
        display.className = 'timecode-display';
        display.style.cssText = `
            font-family: 'Courier New', monospace;
            font-size: 24px;
            background: #000;
            color: #ff0000;
            padding: 8px 16px;
            border-radius: 4px;
            display: inline-block;
        `;
        
        // Update display
        this.on('timecodeUpdate', (tc) => {
            display.textContent = tc.string;
        });
        
        // Initial display
        display.textContent = this.currentTimecode.toString();
        
        if (container) {
            container.appendChild(display);
        }
        
        return display;
    }

    /**
     * Create sync controls UI
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement} Controls element
     */
    createSyncControls(container) {
        const controls = document.createElement('div');
        controls.className = 'video-sync-controls';
        controls.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
            padding: 10px;
            background: #222;
            border-radius: 4px;
        `;
        
        // Frame rate selector
        const frameRateSelect = document.createElement('select');
        frameRateSelect.innerHTML = `
            <option value="24">24 fps</option>
            <option value="25">25 fps</option>
            <option value="29.97">29.97 fps (NTSC)</option>
            <option value="30" selected>30 fps</option>
            <option value="60">60 fps</option>
        `;
        frameRateSelect.addEventListener('change', (e) => {
            this.setFrameRate(parseFloat(e.target.value));
        });
        
        // Drop frame checkbox
        const dropFrameCheck = document.createElement('input');
        dropFrameCheck.type = 'checkbox';
        dropFrameCheck.id = 'dropFrame';
        const dropFrameLabel = document.createElement('label');
        dropFrameLabel.textContent = 'Drop Frame';
        dropFrameLabel.htmlFor = 'dropFrame';
        
        dropFrameCheck.addEventListener('change', (e) => {
            this.dropFrame = e.target.checked;
            this.currentTimecode.dropFrame = this.dropFrame;
            this._emit('dropFrameChange', this.dropFrame);
        });
        
        // Offset input
        const offsetInput = document.createElement('input');
        offsetInput.type = 'number';
        offsetInput.value = this.offset;
        offsetInput.style.width = '60px';
        offsetInput.title = 'Offset (frames)';
        offsetInput.addEventListener('change', (e) => {
            this.setOffset(parseInt(e.target.value) || 0);
        });
        
        // Timecode input for seeking
        const timecodeInput = document.createElement('input');
        timecodeInput.type = 'text';
        timecodeInput.placeholder = '00:00:00:00';
        timecodeInput.style.width = '120px';
        const seekBtn = document.createElement('button');
        seekBtn.textContent = 'Seek';
        seekBtn.addEventListener('click', () => {
            this.seekToTimecodeString(timecodeInput.value);
        });
        
        // Assemble controls
        controls.appendChild(frameRateSelect);
        controls.appendChild(dropFrameCheck);
        controls.appendChild(dropFrameLabel);
        controls.appendChild(document.createTextNode(' Offset: '));
        controls.appendChild(offsetInput);
        controls.appendChild(document.createTextNode(' frames '));
        controls.appendChild(timecodeInput);
        controls.appendChild(seekBtn);
        
        if (container) {
            container.appendChild(controls);
        }
        
        return controls;
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    /**
     * Export configuration
     * @returns {Object} Configuration
     */
    toJSON() {
        return {
            syncMode: this.syncMode,
            frameRate: this.frameRate,
            dropFrame: this.dropFrame,
            offset: this.offset,
            currentTimecode: this.currentTimecode.toJSON()
        };
    }

    /**
     * Import configuration
     * @param {Object} config - Configuration
     */
    fromJSON(config) {
        if (config.syncMode) this.setSyncMode(config.syncMode);
        if (config.frameRate) this.setFrameRate(config.frameRate);
        if (config.dropFrame !== undefined) {
            this.dropFrame = config.dropFrame;
            this.currentTimecode.dropFrame = config.dropFrame;
        }
        if (config.offset !== undefined) this.setOffset(config.offset);
    }
}

/**
 * Create a default instance
 */
export function createEnhancedVideoSync(options = {}) {
    return new EnhancedVideoSync(options);
}

/**
 * Create SMPTE timecode
 */
export function createTimecode(options = {}) {
    return new SMPTETimecode(options);
}

/**
 * Quick function to format seconds as timecode
 */
export function formatTimecode(seconds, frameRate = 30, dropFrame = false) {
    const tc = new SMPTETimecode({ frameRate, dropFrame });
    tc.setFromSeconds(seconds);
    return tc.toString();
}