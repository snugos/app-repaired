// js/VideoEditor.js - Advanced Video Editing for SnugOS DAW
// Features: Video clip editing, transitions, effects, canvas rendering, export

/**
 * Video Transition Types
 */
export const VideoTransitionType = {
    NONE: 'none',
    FADE: 'fade',
    CROSS_FADE: 'cross_fade',
    DISSOLVE: 'dissolve',
    WIPE_LEFT: 'wipe_left',
    WIPE_RIGHT: 'wipe_right',
    WIPE_UP: 'wipe_up',
    WIPE_DOWN: 'wipe_down',
    SLIDE_LEFT: 'slide_left',
    SLIDE_RIGHT: 'slide_right',
    SLIDE_UP: 'slide_up',
    SLIDE_DOWN: 'slide_down',
    ZOOM_IN: 'zoom_in',
    ZOOM_OUT: 'zoom_out',
    SPIN: 'spin',
    BLUR: 'blur',
    PIXELATE: 'pixelate'
};

/**
 * Video Effect Types
 */
export const VideoEffectType = {
    NONE: 'none',
    BRIGHTNESS: 'brightness',
    CONTRAST: 'contrast',
    SATURATION: 'saturation',
    HUE_ROTATE: 'hue_rotate',
    INVERT: 'invert',
    SEPIA: 'sepia',
    GRAYSCALE: 'grayscale',
    BLUR: 'blur',
    SHARPEN: 'sharpen',
    VIGNETTE: 'vignette',
    POSTERIZE: 'posterize',
    SOLARIZE: 'solarize',
    EMBOSS: 'emboss',
    EDGE_DETECT: 'edge_detect',
    GLITCH: 'glitch',
    VHS: 'vhs',
    FILM_GRAIN: 'film_grain',
    THERMAL: 'thermal',
    NIGHT_VISION: 'night_vision'
};

/**
 * Video Clip Class
 */
export class VideoClip {
    constructor(options = {}) {
        this.id = options.id || `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Video Clip';
        this.sourceUrl = options.sourceUrl || null;
        this.startTime = options.startTime || 0; // Position on timeline
        this.duration = options.duration || 0;
        this.trimStart = options.trimStart || 0; // Trim point in source
        this.trimEnd = options.trimEnd || 0; // End trim point
        this.volume = options.volume ?? 1;
        this.muted = options.muted || false;
        this.opacity = options.opacity ?? 1;
        this.transform = options.transform || {
            x: 0, y: 0,
            scale: 1,
            rotation: 0,
            anchorX: 0.5, anchorY: 0.5
        };
        this.effects = options.effects || [];
        this.transitionIn = options.transitionIn || { type: VideoTransitionType.NONE, duration: 0.5 };
        this.transitionOut = options.transitionOut || { type: VideoTransitionType.NONE, duration: 0.5 };
        this.keyframes = options.keyframes || [];
        this.locked = options.locked || false;
        this.selected = options.selected || false;
        this.color = options.color || '#3b82f6';
        
        // Internal state
        this._videoElement = null;
        this._loaded = false;
        this._canvas = null;
        this._ctx = null;
    }

    /**
     * Load video source
     */
    async load() {
        if (!this.sourceUrl) {
            throw new Error('No source URL specified');
        }

        return new Promise((resolve, reject) => {
            this._videoElement = document.createElement('video');
            this._videoElement.crossOrigin = 'anonymous';
            this._videoElement.preload = 'metadata';
            
            this._videoElement.onloadedmetadata = () => {
                this.duration = this._videoElement.duration;
                if (!this.trimEnd) {
                    this.trimEnd = this.duration;
                }
                this._loaded = true;
                
                // Create canvas for rendering
                this._canvas = document.createElement('canvas');
                this._canvas.width = this._videoElement.videoWidth || 1920;
                this._canvas.height = this._videoElement.videoHeight || 1080;
                this._ctx = this._canvas.getContext('2d');
                
                resolve({
                    duration: this.duration,
                    width: this._canvas.width,
                    height: this._canvas.height
                });
            };
            
            this._videoElement.onerror = (e) => {
                reject(new Error(`Failed to load video: ${e.message}`));
            };
            
            this._videoElement.src = this.sourceUrl;
        });
    }

    /**
     * Get trimmed duration
     */
    getTrimmedDuration() {
        return this.trimEnd - this.trimStart;
    }

    /**
     * Get end time on timeline
     */
    getEndTime() {
        return this.startTime + this.getTrimmedDuration();
    }

    /**
     * Check if time is within clip
     */
    containsTime(time) {
        return time >= this.startTime && time <= this.getEndTime();
    }

    /**
     * Get source time for timeline time
     */
    getSourceTime(timelineTime) {
        if (!this.containsTime(timelineTime)) return null;
        return this.trimStart + (timelineTime - this.startTime);
    }

    /**
     * Seek to source time
     */
    async seekToTime(time) {
        if (!this._loaded || !this._videoElement) return false;
        
        const sourceTime = this.getSourceTime(time);
        if (sourceTime === null) return false;
        
        this._videoElement.currentTime = sourceTime;
        await new Promise(resolve => {
            this._videoElement.onseeked = resolve;
        });
        return true;
    }

    /**
     * Render current frame to canvas
     */
    renderFrame(time) {
        if (!this._loaded || !this._videoElement || !this._ctx) return null;
        
        const sourceTime = this.getSourceTime(time);
        if (sourceTime === null) return null;
        
        // Sync video time if needed
        if (Math.abs(this._videoElement.currentTime - sourceTime) > 0.1) {
            this._videoElement.currentTime = sourceTime;
        }
        
        // Clear canvas
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        // Apply transform
        this._ctx.save();
        this._ctx.globalAlpha = this.opacity;
        
        // Apply effects via CSS filters
        const filters = this._buildCSSFilters();
        this._ctx.filter = filters;
        
        // Apply transform
        const t = this.transform;
        const centerX = this._canvas.width * t.anchorX;
        const centerY = this._canvas.height * t.anchorY;
        
        this._ctx.translate(centerX + t.x, centerY + t.y);
        this._ctx.rotate(t.rotation * Math.PI / 180);
        this._ctx.scale(t.scale, t.scale);
        this._ctx.translate(-centerX, -centerY);
        
        // Draw video frame
        this._ctx.drawImage(
            this._videoElement,
            0, 0,
            this._canvas.width,
            this._canvas.height
        );
        
        this._ctx.restore();
        
        // Apply additional canvas effects
        this._applyCanvasEffects();
        
        return this._canvas;
    }

    /**
     * Build CSS filter string from effects
     */
    _buildCSSFilters() {
        const filters = [];
        
        for (const effect of this.effects) {
            switch (effect.type) {
                case VideoEffectType.BRIGHTNESS:
                    filters.push(`brightness(${effect.value ?? 1})`);
                    break;
                case VideoEffectType.CONTRAST:
                    filters.push(`contrast(${effect.value ?? 1})`);
                    break;
                case VideoEffectType.SATURATION:
                    filters.push(`saturate(${effect.value ?? 1})`);
                    break;
                case VideoEffectType.HUE_ROTATE:
                    filters.push(`hue-rotate(${effect.value ?? 0}deg)`);
                    break;
                case VideoEffectType.INVERT:
                    filters.push(`invert(${effect.value ?? 0}%)`);
                    break;
                case VideoEffectType.SEPIA:
                    filters.push(`sepia(${effect.value ?? 0}%)`);
                    break;
                case VideoEffectType.GRAYSCALE:
                    filters.push(`grayscale(${effect.value ?? 0}%)`);
                    break;
                case VideoEffectType.BLUR:
                    filters.push(`blur(${effect.value ?? 0}px)`);
                    break;
            }
        }
        
        return filters.join(' ') || 'none';
    }

    /**
     * Apply canvas-based effects
     */
    _applyCanvasEffects() {
        if (!this._ctx || !this._canvas) return;
        
        for (const effect of this.effects) {
            switch (effect.type) {
                case VideoEffectType.VIGNETTE:
                    this._applyVignette(effect);
                    break;
                case VideoEffectType.POSTERIZE:
                    this._applyPosterize(effect);
                    break;
                case VideoEffectType.SOLARIZE:
                    this._applySolarize(effect);
                    break;
                case VideoEffectType.GLITCH:
                    this._applyGlitch(effect);
                    break;
                case VideoEffectType.VHS:
                    this._applyVHS(effect);
                    break;
                case VideoEffectType.FILM_GRAIN:
                    this._applyFilmGrain(effect);
                    break;
                case VideoEffectType.THERMAL:
                    this._applyThermal(effect);
                    break;
                case VideoEffectType.NIGHT_VISION:
                    this._applyNightVision(effect);
                    break;
            }
        }
    }

    /**
     * Apply vignette effect
     */
    _applyVignette(effect) {
        const intensity = effect.value ?? 0.5;
        const gradient = this._ctx.createRadialGradient(
            this._canvas.width / 2, this._canvas.height / 2, 0,
            this._canvas.width / 2, this._canvas.height / 2, this._canvas.width * 0.7
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
        
        this._ctx.fillStyle = gradient;
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    }

    /**
     * Apply posterize effect
     */
    _applyPosterize(effect) {
        const levels = effect.value ?? 4;
        const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        const data = imageData.data;
        const step = 255 / levels;
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / step) * step;
            data[i + 1] = Math.round(data[i + 1] / step) * step;
            data[i + 2] = Math.round(data[i + 2] / step) * step;
        }
        
        this._ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply solarize effect
     */
    _applySolarize(effect) {
        const threshold = effect.value ?? 128;
        const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] > threshold) data[i] = 255 - data[i];
            if (data[i + 1] > threshold) data[i + 1] = 255 - data[i + 1];
            if (data[i + 2] > threshold) data[i + 2] = 255 - data[i + 2];
        }
        
        this._ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply glitch effect
     */
    _applyGlitch(effect) {
        const intensity = effect.value ?? 10;
        const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        const data = imageData.data;
        const width = this._canvas.width;
        
        // Random horizontal shifts
        for (let y = 0; y < this._canvas.height; y++) {
            if (Math.random() < 0.1) {
                const shift = Math.floor((Math.random() - 0.5) * intensity * 2);
                const rowStart = y * width * 4;
                
                for (let x = 0; x < width; x++) {
                    const srcX = Math.max(0, Math.min(width - 1, x + shift));
                    const srcIdx = rowStart + srcX * 4;
                    const dstIdx = rowStart + x * 4;
                    
                    // Red channel offset
                    data[dstIdx] = data[srcIdx];
                }
            }
        }
        
        this._ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply VHS effect
     */
    _applyVHS(effect) {
        const intensity = effect.value ?? 1;
        
        // Add scan lines
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        for (let y = 0; y < this._canvas.height; y += 2) {
            this._ctx.fillRect(0, y, this._canvas.width, 1);
        }
        
        // Add color aberration
        const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        const data = imageData.data;
        const width = this._canvas.width;
        const aberration = Math.floor(3 * intensity);
        
        for (let y = 0; y < this._canvas.height; y++) {
            for (let x = aberration; x < width - aberration; x++) {
                const idx = (y * width + x) * 4;
                const redIdx = (y * width + (x - aberration)) * 4;
                const blueIdx = (y * width + (x + aberration)) * 4;
                
                data[idx] = data[redIdx]; // Red from left
                data[idx + 2] = data[blueIdx + 2]; // Blue from right
            }
        }
        
        this._ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply film grain effect
     */
    _applyFilmGrain(effect) {
        const intensity = effect.value ?? 0.1;
        const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 255 * intensity;
            data[i] += noise;
            data[i + 1] += noise;
            data[i + 2] += noise;
        }
        
        this._ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply thermal effect
     */
    _applyThermal(effect) {
        const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const normalized = avg / 255;
            
            // Thermal color mapping
            if (normalized < 0.25) {
                data[i] = 0;
                data[i + 1] = normalized * 4 * 255;
                data[i + 2] = 255;
            } else if (normalized < 0.5) {
                data[i] = 0;
                data[i + 1] = 255;
                data[i + 2] = (1 - (normalized - 0.25) * 4) * 255;
            } else if (normalized < 0.75) {
                data[i] = (normalized - 0.5) * 4 * 255;
                data[i + 1] = 255;
                data[i + 2] = 0;
            } else {
                data[i] = 255;
                data[i + 1] = (1 - (normalized - 0.75) * 4) * 255;
                data[i + 2] = 0;
            }
        }
        
        this._ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply night vision effect
     */
    _applyNightVision(effect) {
        const intensity = effect.value ?? 1;
        const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
            const enhanced = Math.min(1, brightness * intensity * 1.5);
            
            // Green night vision color
            data[i] = 0;
            data[i + 1] = enhanced * 255;
            data[i + 2] = enhanced * 100;
        }
        
        // Add vignette
        this._applyVignette({ value: 0.3 });
        
        this._ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Add effect
     */
    addEffect(type, value = null, params = {}) {
        const effect = {
            id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            value,
            enabled: true,
            ...params
        };
        this.effects.push(effect);
        return effect;
    }

    /**
     * Remove effect
     */
    removeEffect(effectId) {
        const index = this.effects.findIndex(e => e.id === effectId);
        if (index !== -1) {
            this.effects.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Set effect value
     */
    setEffectValue(effectId, value) {
        const effect = this.effects.find(e => e.id === effectId);
        if (effect) {
            effect.value = value;
            return true;
        }
        return false;
    }

    /**
     * Add keyframe
     */
    addKeyframe(time, property, value, easing = 'linear') {
        const keyframe = {
            id: `kf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            time,
            property,
            value,
            easing
        };
        this.keyframes.push(keyframe);
        this.keyframes.sort((a, b) => a.time - b.time);
        return keyframe;
    }

    /**
     * Get interpolated value at time
     */
    getInterpolatedValue(property, time) {
        const relevantKeyframes = this.keyframes
            .filter(kf => kf.property === property)
            .sort((a, b) => a.time - b.time);
        
        if (relevantKeyframes.length === 0) return null;
        if (relevantKeyframes.length === 1) return relevantKeyframes[0].value;
        
        // Find surrounding keyframes
        let prev = relevantKeyframes[0];
        let next = relevantKeyframes[relevantKeyframes.length - 1];
        
        for (let i = 0; i < relevantKeyframes.length - 1; i++) {
            if (time >= relevantKeyframes[i].time && time <= relevantKeyframes[i + 1].time) {
                prev = relevantKeyframes[i];
                next = relevantKeyframes[i + 1];
                break;
            }
        }
        
        if (time <= prev.time) return prev.value;
        if (time >= next.time) return next.value;
        
        // Interpolate
        const t = (time - prev.time) / (next.time - prev.time);
        return this._interpolate(prev.value, next.value, t, prev.easing);
    }

    /**
     * Interpolate between values
     */
    _interpolate(a, b, t, easing) {
        switch (easing) {
            case 'linear':
                return a + (b - a) * t;
            case 'easeIn':
                return a + (b - a) * t * t;
            case 'easeOut':
                return a + (b - a) * (1 - (1 - t) * (1 - t));
            case 'easeInOut':
                if (t < 0.5) return a + (b - a) * 2 * t * t;
                return a + (b - a) * (1 - 2 * (1 - t) * (1 - t));
            case 'bounce':
                if (t < 0.5) {
                    const tt = t * 2;
                    return a + (b - a) * (tt * tt * 0.5);
                }
                const tt = (t - 0.5) * 2;
                return (a + b) / 2 + (b - a) * 0.5 * (1 - (1 - tt) * (1 - tt));
            default:
                return a + (b - a) * t;
        }
    }

    /**
     * Split clip at time
     */
    splitAt(time) {
        if (!this.containsTime(time)) return null;
        
        const relativeTime = time - this.startTime;
        const splitPoint = this.trimStart + relativeTime;
        
        // Create new clip for the second part
        const newClip = new VideoClip({
            name: `${this.name} (2)`,
            sourceUrl: this.sourceUrl,
            startTime: time,
            trimStart: splitPoint,
            trimEnd: this.trimEnd,
            volume: this.volume,
            muted: this.muted,
            opacity: this.opacity,
            transform: { ...this.transform },
            effects: this.effects.map(e => ({ ...e })),
            transitionIn: { type: VideoTransitionType.NONE, duration: 0.2 },
            transitionOut: { ...this.transitionOut },
            color: this.color
        });
        
        // Trim current clip
        this.trimEnd = splitPoint;
        this.transitionOut = { type: VideoTransitionType.NONE, duration: 0.2 };
        
        return newClip;
    }

    /**
     * Trim start
     */
    trimClipStart(newTrimStart) {
        if (newTrimStart >= this.trimEnd) return false;
        const delta = newTrimStart - this.trimStart;
        this.trimStart = newTrimStart;
        this.startTime += delta;
        return true;
    }

    /**
     * Trim end
     */
    trimClipEnd(newTrimEnd) {
        if (newTrimEnd <= this.trimStart) return false;
        this.trimEnd = newTrimEnd;
        return true;
    }

    /**
     * Duplicate clip
     */
    duplicate() {
        return new VideoClip({
            name: `${this.name} (copy)`,
            sourceUrl: this.sourceUrl,
            startTime: this.startTime + this.getTrimmedDuration(),
            trimStart: this.trimStart,
            trimEnd: this.trimEnd,
            volume: this.volume,
            muted: this.muted,
            opacity: this.opacity,
            transform: { ...this.transform },
            effects: this.effects.map(e => ({ ...e })),
            transitionIn: { ...this.transitionIn },
            transitionOut: { ...this.transitionOut },
            keyframes: this.keyframes.map(kf => ({ ...kf })),
            color: this.color
        });
    }

    /**
     * Get audio data at time
     */
    getAudioAtTime(time) {
        if (!this.muted && this._videoElement) {
            const sourceTime = this.getSourceTime(time);
            if (sourceTime !== null && this._videoElement.currentTime !== sourceTime) {
                this._videoElement.currentTime = sourceTime;
            }
        }
        return {
            volume: this.muted ? 0 : this.volume,
            muted: this.muted
        };
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this._videoElement) {
            this._videoElement.pause();
            this._videoElement.src = '';
            this._videoElement = null;
        }
        this._canvas = null;
        this._ctx = null;
        this.effects = [];
        this.keyframes = [];
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            sourceUrl: this.sourceUrl,
            startTime: this.startTime,
            duration: this.duration,
            trimStart: this.trimStart,
            trimEnd: this.trimEnd,
            volume: this.volume,
            muted: this.muted,
            opacity: this.opacity,
            transform: this.transform,
            effects: this.effects,
            transitionIn: this.transitionIn,
            transitionOut: this.transitionOut,
            keyframes: this.keyframes,
            locked: this.locked,
            color: this.color
        };
    }

    /**
     * Create from JSON
     */
    static fromJSON(data) {
        const clip = new VideoClip(data);
        return clip;
    }
}

/**
 * Video Transition Renderer
 */
export class VideoTransitionRenderer {
    constructor() {
        this._tempCanvas = document.createElement('canvas');
        this._tempCtx = this._tempCanvas.getContext('2d');
    }

    /**
     * Render transition between two clips
     */
    renderTransition(clipA, clipB, progress, transition, outputCanvas) {
        const ctx = outputCanvas.getContext('2d');
        const width = outputCanvas.width;
        const height = outputCanvas.height;
        
        // Ensure temp canvas is sized correctly
        this._tempCanvas.width = width;
        this._tempCanvas.height = height;
        
        ctx.clearRect(0, 0, width, height);
        
        switch (transition.type) {
            case VideoTransitionType.FADE:
                this._renderFade(clipA, clipB, progress, ctx, width, height);
                break;
            case VideoTransitionType.CROSS_FADE:
                this._renderCrossFade(clipA, clipB, progress, ctx, width, height);
                break;
            case VideoTransitionType.DISSOLVE:
                this._renderDissolve(clipA, clipB, progress, ctx, width, height);
                break;
            case VideoTransitionType.WIPE_LEFT:
                this._renderWipe(clipA, clipB, progress, ctx, width, height, 'left');
                break;
            case VideoTransitionType.WIPE_RIGHT:
                this._renderWipe(clipA, clipB, progress, ctx, width, height, 'right');
                break;
            case VideoTransitionType.WIPE_UP:
                this._renderWipe(clipA, clipB, progress, ctx, width, height, 'up');
                break;
            case VideoTransitionType.WIPE_DOWN:
                this._renderWipe(clipA, clipB, progress, ctx, width, height, 'down');
                break;
            case VideoTransitionType.SLIDE_LEFT:
                this._renderSlide(clipA, clipB, progress, ctx, width, height, 'left');
                break;
            case VideoTransitionType.SLIDE_RIGHT:
                this._renderSlide(clipA, clipB, progress, ctx, width, height, 'right');
                break;
            case VideoTransitionType.ZOOM_IN:
                this._renderZoom(clipA, clipB, progress, ctx, width, height, 'in');
                break;
            case VideoTransitionType.ZOOM_OUT:
                this._renderZoom(clipA, clipB, progress, ctx, width, height, 'out');
                break;
            case VideoTransitionType.SPIN:
                this._renderSpin(clipA, clipB, progress, ctx, width, height);
                break;
            case VideoTransitionType.BLUR:
                this._renderBlurTransition(clipA, clipB, progress, ctx, width, height);
                break;
            case VideoTransitionType.PIXELATE:
                this._renderPixelateTransition(clipA, clipB, progress, ctx, width, height);
                break;
            default:
                // No transition - just show clip B
                const canvasB = clipB?._canvas;
                if (canvasB) {
                    ctx.drawImage(canvasB, 0, 0, width, height);
                }
        }
    }

    /**
     * Render fade transition
     */
    _renderFade(clipA, clipB, progress, ctx, width, height) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        // Fade out clip A
        if (canvasA) {
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(canvasA, 0, 0, width, height);
        }
        
        // Fade to black, then fade in clip B
        if (progress < 0.5) {
            ctx.globalAlpha = progress * 2;
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
        } else if (canvasB) {
            ctx.globalAlpha = (progress - 0.5) * 2;
            ctx.drawImage(canvasB, 0, 0, width, height);
        }
        
        ctx.globalAlpha = 1;
    }

    /**
     * Render cross-fade transition
     */
    _renderCrossFade(clipA, clipB, progress, ctx, width, height) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        if (canvasA) {
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(canvasA, 0, 0, width, height);
        }
        
        if (canvasB) {
            ctx.globalAlpha = progress;
            ctx.drawImage(canvasB, 0, 0, width, height);
        }
        
        ctx.globalAlpha = 1;
    }

    /**
     * Render dissolve transition (random pixel dissolve)
     */
    _renderDissolve(clipA, clipB, progress, ctx, width, height) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        // Draw both canvases to temp
        if (canvasA) {
            this._tempCtx.drawImage(canvasA, 0, 0, width, height);
        }
        const imageDataA = this._tempCtx.getImageData(0, 0, width, height);
        
        this._tempCtx.clearRect(0, 0, width, height);
        if (canvasB) {
            this._tempCtx.drawImage(canvasB, 0, 0, width, height);
        }
        const imageDataB = this._tempCtx.getImageData(0, 0, width, height);
        
        // Blend based on random threshold
        const dataA = imageDataA.data;
        const dataB = imageDataB.data;
        const threshold = progress * 255;
        
        for (let i = 0; i < dataA.length; i += 4) {
            const random = Math.random() * 255;
            if (random < threshold) {
                dataA[i] = dataB[i];
                dataA[i + 1] = dataB[i + 1];
                dataA[i + 2] = dataB[i + 2];
                dataA[i + 3] = dataB[i + 3];
            }
        }
        
        ctx.putImageData(imageDataA, 0, 0);
    }

    /**
     * Render wipe transition
     */
    _renderWipe(clipA, clipB, progress, ctx, width, height, direction) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        if (canvasA) {
            ctx.drawImage(canvasA, 0, 0, width, height);
        }
        
        if (canvasB) {
            ctx.save();
            
            let clipX = 0, clipY = 0, clipW = width, clipH = height;
            
            switch (direction) {
                case 'left':
                    clipW = width * progress;
                    break;
                case 'right':
                    clipX = width * (1 - progress);
                    clipW = width * progress;
                    break;
                case 'up':
                    clipH = height * progress;
                    break;
                case 'down':
                    clipY = height * (1 - progress);
                    clipH = height * progress;
                    break;
            }
            
            ctx.beginPath();
            ctx.rect(clipX, clipY, clipW, clipH);
            ctx.clip();
            
            ctx.drawImage(canvasB, 0, 0, width, height);
            ctx.restore();
        }
    }

    /**
     * Render slide transition
     */
    _renderSlide(clipA, clipB, progress, ctx, width, height, direction) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        let offsetA = 0, offsetB = 0;
        
        switch (direction) {
            case 'left':
                offsetA = -width * progress;
                offsetB = width * (1 - progress);
                break;
            case 'right':
                offsetA = width * progress;
                offsetB = -width * (1 - progress);
                break;
        }
        
        if (canvasA) {
            ctx.drawImage(canvasA, offsetA, 0, width, height);
        }
        
        if (canvasB) {
            ctx.drawImage(canvasB, offsetB, 0, width, height);
        }
    }

    /**
     * Render zoom transition
     */
    _renderZoom(clipA, clipB, progress, ctx, width, height, type) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        ctx.save();
        ctx.translate(width / 2, height / 2);
        
        if (type === 'in') {
            // Clip A zooms out, Clip B zooms in
            if (canvasA && progress < 1) {
                const scale = 1 + progress * 2;
                ctx.globalAlpha = 1 - progress;
                ctx.scale(scale, scale);
                ctx.drawImage(canvasA, -width / 2, -height / 2, width, height);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(width / 2, height / 2);
            }
            if (canvasB && progress > 0) {
                const scale = progress * 2;
                ctx.globalAlpha = progress;
                ctx.scale(scale, scale);
                ctx.drawImage(canvasB, -width / 2, -height / 2, width, height);
            }
        } else {
            // Clip A zooms in, Clip B zooms out
            if (canvasA && progress < 1) {
                const scale = 1 - progress * 0.5;
                ctx.globalAlpha = 1 - progress;
                ctx.scale(scale, scale);
                ctx.drawImage(canvasA, -width / 2, -height / 2, width, height);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(width / 2, height / 2);
            }
            if (canvasB) {
                const scale = 0.5 + progress * 0.5;
                ctx.globalAlpha = progress;
                ctx.scale(scale, scale);
                ctx.drawImage(canvasB, -width / 2, -height / 2, width, height);
            }
        }
        
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    /**
     * Render spin transition
     */
    _renderSpin(clipA, clipB, progress, ctx, width, height) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        ctx.save();
        ctx.translate(width / 2, height / 2);
        
        if (canvasA && progress < 0.5) {
            const scale = 1 - progress * 2;
            const rotation = progress * Math.PI;
            ctx.globalAlpha = 1 - progress * 2;
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            ctx.drawImage(canvasA, -width / 2, -height / 2, width, height);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(width / 2, height / 2);
        }
        
        if (canvasB && progress > 0.5) {
            const scale = (progress - 0.5) * 2;
            const rotation = (progress - 0.5) * Math.PI;
            ctx.globalAlpha = (progress - 0.5) * 2;
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            ctx.drawImage(canvasB, -width / 2, -height / 2, width, height);
        }
        
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    /**
     * Render blur transition
     */
    _renderBlurTransition(clipA, clipB, progress, ctx, width, height) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        // Progress goes from 0 to 0.5 (blur A), then 0.5 to 1 (unblur B)
        if (progress < 0.5) {
            if (canvasA) {
                const blurAmount = progress * 40;
                ctx.filter = `blur(${blurAmount}px)`;
                ctx.globalAlpha = 1 - progress;
                ctx.drawImage(canvasA, 0, 0, width, height);
            }
        } else {
            if (canvasB) {
                const blurAmount = (1 - progress) * 40;
                ctx.filter = `blur(${blurAmount}px)`;
                ctx.globalAlpha = progress;
                ctx.drawImage(canvasB, 0, 0, width, height);
            }
        }
        
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
    }

    /**
     * Render pixelate transition
     */
    _renderPixelateTransition(clipA, clipB, progress, ctx, width, height) {
        const canvasA = clipA?._canvas;
        const canvasB = clipB?._canvas;
        
        if (progress < 0.5) {
            if (canvasA) {
                const pixelSize = Math.max(1, Math.floor(progress * 50));
                this._pixelate(canvasA, ctx, width, height, pixelSize);
            }
        } else {
            if (canvasB) {
                const pixelSize = Math.max(1, Math.floor((1 - progress) * 50));
                this._pixelate(canvasB, ctx, width, height, pixelSize);
            }
        }
    }

    /**
     * Pixelate helper
     */
    _pixelate(source, ctx, width, height, pixelSize) {
        const w = Math.ceil(width / pixelSize);
        const h = Math.ceil(height / pixelSize);
        
        ctx.imageSmoothingEnabled = false;
        
        // Draw small
        ctx.drawImage(source, 0, 0, w, h);
        
        // Draw large
        ctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, width, height);
        
        ctx.imageSmoothingEnabled = true;
    }
}

/**
 * Video Editor Class
 * Main controller for video editing functionality
 */
export class VideoEditor {
    constructor(options = {}) {
        this.clips = [];
        this.currentTime = 0;
        this.duration = 0;
        this.playing = false;
        this.volume = 1;
        this.muted = false;
        this.playbackRate = 1;
        this.loop = false;
        this.loopStart = null;
        this.loopEnd = null;
        
        // Canvas for rendering
        this.canvas = options.canvas || document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = options.width || 1920;
        this.canvas.height = options.height || 1080;
        
        // Background color
        this.backgroundColor = options.backgroundColor || '#000000';
        
        // Transition renderer
        this.transitionRenderer = new VideoTransitionRenderer();
        
        // Active clips at current time
        this._activeClips = [];
        
        // Animation frame ID
        this._animationFrame = null;
        
        // Callbacks
        this.onTimeUpdate = null;
        this.onClipChange = null;
        this.onPlayStateChange = null;
        this.onRender = null;
    }

    /**
     * Add clip to timeline
     */
    addClip(clip) {
        if (!(clip instanceof VideoClip)) {
            clip = new VideoClip(clip);
        }
        
        this.clips.push(clip);
        this._sortClips();
        this._updateDuration();
        
        if (this.onClipChange) {
            this.onClipChange({ type: 'add', clip });
        }
        
        return clip;
    }

    /**
     * Remove clip from timeline
     */
    removeClip(clipId) {
        const index = this.clips.findIndex(c => c.id === clipId);
        if (index !== -1) {
            const clip = this.clips.splice(index, 1)[0];
            clip.dispose();
            this._updateDuration();
            
            if (this.onClipChange) {
                this.onClipChange({ type: 'remove', clip });
            }
            
            return true;
        }
        return false;
    }

    /**
     * Get clip by ID
     */
    getClip(clipId) {
        return this.clips.find(c => c.id === clipId) || null;
    }

    /**
     * Get clips at time
     */
    getClipsAtTime(time) {
        return this.clips.filter(c => c.containsTime(time));
    }

    /**
     * Sort clips by start time
     */
    _sortClips() {
        this.clips.sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * Update total duration
     */
    _updateDuration() {
        if (this.clips.length === 0) {
            this.duration = 0;
            return;
        }
        
        this.duration = Math.max(...this.clips.map(c => c.getEndTime()));
    }

    /**
     * Load video files
     */
    async loadVideoFiles(files) {
        const loadedClips = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('video/')) continue;
            
            const url = URL.createObjectURL(file);
            const clip = new VideoClip({
                name: file.name,
                sourceUrl: url,
                startTime: this.duration // Add at end
            });
            
            try {
                await clip.load();
                this.addClip(clip);
                loadedClips.push(clip);
            } catch (error) {
                console.error(`Failed to load video: ${file.name}`, error);
            }
        }
        
        return loadedClips;
    }

    /**
     * Play
     */
    play() {
        if (this.playing) return;
        
        this.playing = true;
        
        // Activate clips
        this._activeClips = this.getClipsAtTime(this.currentTime);
        for (const clip of this._activeClips) {
            if (clip._videoElement) {
                clip._videoElement.play();
            }
        }
        
        this._startRenderLoop();
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange(true);
        }
    }

    /**
     * Pause
     */
    pause() {
        if (!this.playing) return;
        
        this.playing = false;
        
        // Pause all active clips
        for (const clip of this._activeClips) {
            if (clip._videoElement) {
                clip._videoElement.pause();
            }
        }
        
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange(false);
        }
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.playing) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Stop
     */
    stop() {
        this.pause();
        this.seekTo(0);
    }

    /**
     * Seek to time
     */
    async seekTo(time) {
        const newTime = Math.max(0, Math.min(this.duration, time));
        const wasPlaying = this.playing;
        
        if (wasPlaying) {
            this.pause();
        }
        
        // Update active clips
        const newActiveClips = this.getClipsAtTime(newTime);
        
        // Deactivate old clips
        for (const clip of this._activeClips) {
            if (!newActiveClips.includes(clip)) {
                if (clip._videoElement) {
                    clip._videoElement.pause();
                }
            }
        }
        
        // Activate new clips
        for (const clip of newActiveClips) {
            if (clip._videoElement) {
                await clip.seekToTime(newTime);
            }
        }
        
        this._activeClips = newActiveClips;
        this.currentTime = newTime;
        
        // Render frame
        this.render();
        
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
        
        if (wasPlaying) {
            this.play();
        }
    }

    /**
     * Start render loop
     */
    _startRenderLoop() {
        let lastTime = performance.now();
        
        const loop = (now) => {
            if (!this.playing) return;
            
            const delta = (now - lastTime) / 1000 * this.playbackRate;
            lastTime = now;
            
            // Update time
            this.currentTime += delta;
            
            // Handle loop
            if (this.loop && this.loopStart !== null && this.loopEnd !== null) {
                if (this.currentTime >= this.loopEnd) {
                    this.currentTime = this.loopStart;
                }
            } else if (this.currentTime >= this.duration) {
                this.currentTime = 0;
                if (!this.loop) {
                    this.pause();
                    return;
                }
            }
            
            // Update active clips
            const newActiveClips = this.getClipsAtTime(this.currentTime);
            
            for (const clip of this._activeClips) {
                if (!newActiveClips.includes(clip)) {
                    if (clip._videoElement) {
                        clip._videoElement.pause();
                    }
                }
            }
            
            this._activeClips = newActiveClips;
            
            // Render
            this.render();
            
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.currentTime);
            }
            
            this._animationFrame = requestAnimationFrame(loop);
        };
        
        this._animationFrame = requestAnimationFrame(loop);
    }

    /**
     * Render current frame
     */
    render() {
        // Clear canvas
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Get clips at current time, sorted by layer (future: implement layers)
        const clipsAtTime = this._activeClips.length > 0 
            ? this._activeClips 
            : this.getClipsAtTime(this.currentTime);
        
        // Render each clip
        for (const clip of clipsAtTime) {
            this._renderClip(clip);
        }
        
        if (this.onRender) {
            this.onRender(this.canvas);
        }
    }

    /**
     * Render single clip
     */
    _renderClip(clip) {
        const clipCanvas = clip.renderFrame(this.currentTime);
        if (!clipCanvas) return;
        
        // Calculate transition
        let opacity = clip.opacity;
        const clipStart = clip.startTime;
        const clipEnd = clip.getEndTime();
        const transIn = clip.transitionIn;
        const transOut = clip.transitionOut;
        
        // Transition in
        if (transIn.type !== VideoTransitionType.NONE && transIn.duration > 0) {
            const transEnd = clipStart + transIn.duration;
            if (this.currentTime < transEnd) {
                const progress = (this.currentTime - clipStart) / transIn.duration;
                opacity *= progress;
            }
        }
        
        // Transition out
        if (transOut.type !== VideoTransitionType.NONE && transOut.duration > 0) {
            const transStart = clipEnd - transOut.duration;
            if (this.currentTime > transStart) {
                const progress = (clipEnd - this.currentTime) / transOut.duration;
                opacity *= progress;
            }
        }
        
        // Apply opacity and draw
        this.ctx.globalAlpha = opacity;
        this.ctx.drawImage(clipCanvas, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1;
    }

    /**
     * Split clip at current time
     */
    splitClipAtCurrentTime(clipId) {
        const clip = this.getClip(clipId);
        if (!clip) return null;
        
        const newClip = clip.splitAt(this.currentTime);
        if (newClip) {
            this.addClip(newClip);
            return { original: clip, new: newClip };
        }
        return null;
    }

    /**
     * Trim clip
     */
    trimClip(clipId, trimStart, trimEnd) {
        const clip = this.getClip(clipId);
        if (!clip) return false;
        
        if (trimStart !== undefined) {
            clip.trimClipStart(trimStart);
        }
        if (trimEnd !== undefined) {
            clip.trimClipEnd(trimEnd);
        }
        
        this._updateDuration();
        
        if (this.onClipChange) {
            this.onClipChange({ type: 'trim', clip });
        }
        
        return true;
    }

    /**
     * Move clip
     */
    moveClip(clipId, newStartTime) {
        const clip = this.getClip(clipId);
        if (!clip) return false;
        
        clip.startTime = Math.max(0, newStartTime);
        this._sortClips();
        this._updateDuration();
        
        if (this.onClipChange) {
            this.onClipChange({ type: 'move', clip });
        }
        
        return true;
    }

    /**
     * Duplicate clip
     */
    duplicateClip(clipId) {
        const clip = this.getClip(clipId);
        if (!clip) return null;
        
        const newClip = clip.duplicate();
        this.addClip(newClip);
        
        return newClip;
    }

    /**
     * Set clip volume
     */
    setClipVolume(clipId, volume) {
        const clip = this.getClip(clipId);
        if (clip) {
            clip.volume = Math.max(0, Math.min(1, volume));
            return true;
        }
        return false;
    }

    /**
     * Set clip muted
     */
    setClipMuted(clipId, muted) {
        const clip = this.getClip(clipId);
        if (clip) {
            clip.muted = muted;
            return true;
        }
        return false;
    }

    /**
     * Add effect to clip
     */
    addClipEffect(clipId, effectType, value = null, params = {}) {
        const clip = this.getClip(clipId);
        if (clip) {
            const effect = clip.addEffect(effectType, value, params);
            if (this.onClipChange) {
                this.onClipChange({ type: 'effect', clip, effect });
            }
            return effect;
        }
        return null;
    }

    /**
     * Remove effect from clip
     */
    removeClipEffect(clipId, effectId) {
        const clip = this.getClip(clipId);
        if (clip && clip.removeEffect(effectId)) {
            if (this.onClipChange) {
                this.onClipChange({ type: 'effect', clip });
            }
            return true;
        }
        return false;
    }

    /**
     * Set clip transition
     */
    setClipTransition(clipId, type, duration, isIn = true) {
        const clip = this.getClip(clipId);
        if (clip) {
            if (isIn) {
                clip.transitionIn = { type, duration };
            } else {
                clip.transitionOut = { type, duration };
            }
            return true;
        }
        return false;
    }

    /**
     * Add keyframe to clip
     */
    addClipKeyframe(clipId, time, property, value, easing = 'linear') {
        const clip = this.getClip(clipId);
        if (clip) {
            return clip.addKeyframe(time, property, value, easing);
        }
        return null;
    }

    /**
     * Set loop region
     */
    setLoopRegion(start, end) {
        this.loopStart = start;
        this.loopEnd = end;
        this.loop = true;
    }

    /**
     * Clear loop region
     */
    clearLoopRegion() {
        this.loopStart = null;
        this.loopEnd = null;
        this.loop = false;
    }

    /**
     * Export to video file
     */
    async exportVideo(options = {}) {
        const {
            format = 'webm',
            quality = 0.8,
            frameRate = 30,
            startTime = 0,
            endTime = this.duration,
            width = this.canvas.width,
            height = this.canvas.height
        } = options;
        
        // Create MediaRecorder
        const stream = this.canvas.captureStream(frameRate);
        
        // Add audio tracks from video clips
        for (const clip of this.clips) {
            if (clip._videoElement && !clip.muted) {
                try {
                    const audioStream = clip._videoElement.captureStream();
                    const audioTracks = audioStream.getAudioTracks();
                    for (const track of audioTracks) {
                        stream.addTrack(track);
                    }
                } catch (e) {
                    console.warn('Could not capture audio from clip:', clip.name);
                }
            }
        }
        
        const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
        const recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: quality * 10000000
        });
        
        const chunks = [];
        
        return new Promise((resolve, reject) => {
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                resolve({
                    blob,
                    url: URL.createObjectURL(blob),
                    duration: endTime - startTime
                });
            };
            
            recorder.onerror = (e) => {
                reject(new Error(`Recording failed: ${e.message}`));
            };
            
            // Start recording
            recorder.start();
            
            // Play through timeline
            (async () => {
                await this.seekTo(startTime);
                this.play();
                
                // Wait for recording to complete
                const checkEnd = setInterval(() => {
                    if (this.currentTime >= endTime || !this.playing) {
                        clearInterval(checkEnd);
                        this.pause();
                        recorder.stop();
                    }
                }, 100);
            })();
        });
    }

    /**
     * Export single frame as image
     */
    exportFrame(time, format = 'image/png') {
        this.seekTo(time);
        return this.canvas.toDataURL(format);
    }

    /**
     * Get timeline data
     */
    getTimelineData() {
        return {
            duration: this.duration,
            currentTime: this.currentTime,
            clips: this.clips.map(c => c.toJSON()),
            loop: this.loop,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd
        };
    }

    /**
     * Load timeline data
     */
    async loadTimelineData(data) {
        // Clear existing clips
        for (const clip of this.clips) {
            clip.dispose();
        }
        this.clips = [];
        
        // Load new clips
        for (const clipData of data.clips) {
            const clip = VideoClip.fromJSON(clipData);
            try {
                await clip.load();
                this.clips.push(clip);
            } catch (e) {
                console.warn('Failed to load clip:', clipData.name, e);
            }
        }
        
        this.duration = data.duration || 0;
        this.loop = data.loop || false;
        this.loopStart = data.loopStart || null;
        this.loopEnd = data.loopEnd || null;
        
        if (this.onClipChange) {
            this.onClipChange({ type: 'load' });
        }
    }

    /**
     * Undo/Redo support
     */
    createSnapshot() {
        return {
            clips: this.clips.map(c => c.toJSON()),
            currentTime: this.currentTime,
            duration: this.duration
        };
    }

    /**
     * Restore from snapshot
     */
    async restoreSnapshot(snapshot) {
        await this.loadTimelineData({
            clips: snapshot.clips,
            duration: snapshot.duration
        });
        await this.seekTo(snapshot.currentTime);
    }

    /**
     * Dispose
     */
    dispose() {
        this.pause();
        
        for (const clip of this.clips) {
            clip.dispose();
        }
        
        this.clips = [];
        this._activeClips = [];
        
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
        }
    }
}

/**
 * Video Editor UI Helper
 */
export class VideoEditorUI {
    constructor(editor, container) {
        this.editor = editor;
        this.container = container;
        this.selectedClip = null;
        
        this._createUI();
        this._bindEvents();
    }

    /**
     * Create UI elements
     */
    _createUI() {
        this.container.innerHTML = `
            <div class="video-editor">
                <div class="video-toolbar">
                    <button class="btn-play" title="Play">▶</button>
                    <button class="btn-pause" title="Pause">⏸</button>
                    <button class="btn-stop" title="Stop">⏹</button>
                    <span class="time-display">00:00:00</span>
                    <button class="btn-split" title="Split">✂</button>
                    <button class="btn-delete" title="Delete">🗑</button>
                    <input type="range" class="volume-slider" min="0" max="100" value="100" title="Volume">
                </div>
                
                <div class="video-preview">
                    <canvas class="preview-canvas"></canvas>
                </div>
                
                <div class="video-timeline">
                    <div class="timeline-ruler"></div>
                    <div class="timeline-tracks"></div>
                    <div class="timeline-playhead"></div>
                </div>
                
                <div class="video-effects-panel">
                    <h3>Effects</h3>
                    <div class="effects-list"></div>
                    <button class="btn-add-effect">Add Effect</button>
                </div>
                
                <div class="video-transitions-panel">
                    <h3>Transitions</h3>
                    <select class="transition-in-select">
                        ${Object.values(VideoTransitionType).map(t => 
                            `<option value="${t}">${t.replace(/_/g, ' ')}</option>`
                        ).join('')}
                    </select>
                    <select class="transition-out-select">
                        ${Object.values(VideoTransitionType).map(t => 
                            `<option value="${t}">${t.replace(/_/g, ' ')}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
        
        this.playBtn = this.container.querySelector('.btn-play');
        this.pauseBtn = this.container.querySelector('.btn-pause');
        this.stopBtn = this.container.querySelector('.btn-stop');
        this.splitBtn = this.container.querySelector('.btn-split');
        this.deleteBtn = this.container.querySelector('.btn-delete');
        this.volumeSlider = this.container.querySelector('.volume-slider');
        this.timeDisplay = this.container.querySelector('.time-display');
        this.previewCanvas = this.container.querySelector('.preview-canvas');
        this.timelineTracks = this.container.querySelector('.timeline-tracks');
        this.playhead = this.container.querySelector('.timeline-playhead');
        this.effectsList = this.container.querySelector('.effects-list');
        this.addEffectBtn = this.container.querySelector('.btn-add-effect');
        this.transitionInSelect = this.container.querySelector('.transition-in-select');
        this.transitionOutSelect = this.container.querySelector('.transition-out-select');
        
        // Setup preview canvas
        this.previewCanvas.width = 640;
        this.previewCanvas.height = 360;
    }

    /**
     * Bind events
     */
    _bindEvents() {
        this.playBtn.addEventListener('click', () => this.editor.play());
        this.pauseBtn.addEventListener('click', () => this.editor.pause());
        this.stopBtn.addEventListener('click', () => this.editor.stop());
        
        this.splitBtn.addEventListener('click', () => {
            if (this.selectedClip) {
                const result = this.editor.splitClipAtCurrentTime(this.selectedClip.id);
                if (result) {
                    this._updateTimeline();
                }
            }
        });
        
        this.deleteBtn.addEventListener('click', () => {
            if (this.selectedClip) {
                this.editor.removeClip(this.selectedClip.id);
                this.selectedClip = null;
                this._updateTimeline();
            }
        });
        
        this.volumeSlider.addEventListener('input', (e) => {
            this.editor.volume = e.target.value / 100;
        });
        
        this.editor.onTimeUpdate = (time) => {
            this._updateTimeDisplay(time);
            this._updatePlayhead(time);
        };
        
        this.editor.onClipChange = () => {
            this._updateTimeline();
        };
        
        this.editor.onRender = (canvas) => {
            const ctx = this.previewCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, 0, this.previewCanvas.width, this.previewCanvas.height);
        };
        
        this.transitionInSelect.addEventListener('change', (e) => {
            if (this.selectedClip) {
                this.selectedClip.transitionIn.type = e.target.value;
            }
        });
        
        this.transitionOutSelect.addEventListener('change', (e) => {
            if (this.selectedClip) {
                this.selectedClip.transitionOut.type = e.target.value;
            }
        });
        
        this.addEffectBtn.addEventListener('click', () => {
            if (this.selectedClip) {
                // Add default brightness effect
                this.editor.addClipEffect(this.selectedClip.id, VideoEffectType.BRIGHTNESS, 1);
                this._updateEffectsList();
            }
        });
    }

    /**
     * Update time display
     */
    _updateTimeDisplay(time) {
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        
        this.timeDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Update playhead position
     */
    _updatePlayhead(time) {
        const duration = this.editor.duration || 1;
        const percent = (time / duration) * 100;
        this.playhead.style.left = `${percent}%`;
    }

    /**
     * Update timeline UI
     */
    _updateTimeline() {
        this.timelineTracks.innerHTML = '';
        
        for (const clip of this.editor.clips) {
            const clipEl = document.createElement('div');
            clipEl.className = 'timeline-clip';
            clipEl.style.left = `${(clip.startTime / this.editor.duration) * 100}%`;
            clipEl.style.width = `${(clip.getTrimmedDuration() / this.editor.duration) * 100}%`;
            clipEl.style.backgroundColor = clip.color;
            clipEl.textContent = clip.name;
            
            clipEl.addEventListener('click', () => {
                this.selectedClip = clip;
                this._updateEffectsList();
            });
            
            this.timelineTracks.appendChild(clipEl);
        }
    }

    /**
     * Update effects list
     */
    _updateEffectsList() {
        this.effectsList.innerHTML = '';
        
        if (!this.selectedClip) return;
        
        for (const effect of this.selectedClip.effects) {
            const effectEl = document.createElement('div');
            effectEl.className = 'effect-item';
            effectEl.innerHTML = `
                <span>${effect.type}</span>
                <input type="range" min="0" max="100" value="${(effect.value || 0) * 100}">
                <button class="btn-remove-effect">×</button>
            `;
            
            const slider = effectEl.querySelector('input');
            slider.addEventListener('input', (e) => {
                effect.value = e.target.value / 100;
            });
            
            const removeBtn = effectEl.querySelector('.btn-remove-effect');
            removeBtn.addEventListener('click', () => {
                this.selectedClip.removeEffect(effect.id);
                this._updateEffectsList();
            });
            
            this.effectsList.appendChild(effectEl);
        }
    }

    /**
     * Load video files
     */
    async loadVideos(files) {
        const clips = await this.editor.loadVideoFiles(files);
        this._updateTimeline();
        return clips;
    }
}

export default VideoEditor;