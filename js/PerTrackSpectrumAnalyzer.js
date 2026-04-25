// js/PerTrackSpectrumAnalyzer.js - Per-track real-time FFT spectrum visualization
import { getAvailableSends } from './audio.js';

export class PerTrackSpectrumAnalyzer {
    constructor(track) {
        this.track = track;
        this.analyser = null;
        this.frequencyData = null;
        this.dataArray = null;
        this.enabled = false;
        this.fftSize = 256;
        this.smoothingTimeConstant = 0.8;
    }

    initialize(audioContext) {
        if (this.analyser) return;
        
        try {
            this.analyser = audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.dataArray = new Uint8Array(this.fftSize);
            console.log(`[PerTrackSpectrumAnalyzer] Track ${this.track.id} analyser initialized`);
        } catch (e) {
            console.error(`[PerTrackSpectrumAnalyzer] Failed to initialize for track ${this.track.id}:`, e);
        }
    }

    connectToTrack() {
        if (!this.analyser || !this.track) return;
        
        // Connect to track's output node or gain node
        const trackOutput = this.track.outputNode || this.track.gainNode;
        if (trackOutput && !trackOutput.disposed) {
            try {
                trackOutput.connect(this.analyser);
                this.enabled = true;
                console.log(`[PerTrackSpectrumAnalyzer] Connected to track ${this.track.id} output`);
            } catch (e) {
                console.error(`[PerTrackSpectrumAnalyzer] Error connecting to track ${this.track.id}:`, e);
            }
        }
    }

    disconnect() {
        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
            this.enabled = false;
        }
    }

    getFrequencyData() {
        if (!this.analyser || !this.enabled) return null;
        try {
            this.analyser.getByteFrequencyData(this.frequencyData);
            return this.frequencyData;
        } catch (e) {
            return null;
        }
    }

    getByteTimeDomainData() {
        if (!this.analyser || !this.enabled) return null;
        try {
            this.analyser.getByteTimeDomainData(this.dataArray);
            return this.dataArray;
        } catch (e) {
            return null;
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    setFFTSize(size) {
        if (this.analyser && size >= 32 && size <= 32768) {
            this.analyser.fftSize = size;
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.dataArray = new Uint8Array(size);
        }
    }

    setSmoothing(value) {
        if (this.analyser && value >= 0 && value <= 1) {
            this.analyser.smoothingTimeConstant = value;
        }
    }

    dispose() {
        this.disconnect();
        this.analyser = null;
        this.frequencyData = null;
        this.dataArray = null;
    }
}

// --- Manager for all track spectrum analyzers ---
let trackSpectrumAnalyzers = new Map();
let audioContextRef = null;
let animationFrameId = null;
let isRunning = false;

// Track canvas renderers: Map<trackId, { canvas, ctx, analyzer }>
let trackCanvasRenderers = new Map();

export function initPerTrackSpectrumAnalyzers(tracks, audioContext) {
    audioContextRef = audioContext;
    trackSpectrumAnalyzers.clear();
    
    if (!audioContext) {
        console.warn('[PerTrackSpectrumAnalyzer] No audio context provided');
        return;
    }

    tracks.forEach(track => {
        if (track && track.id !== undefined) {
            const analyzer = new PerTrackSpectrumAnalyzer(track);
            analyzer.initialize(audioContext);
            analyzer.connectToTrack();
            trackSpectrumAnalyzers.set(track.id, analyzer);
        }
    });
    
    console.log(`[PerTrackSpectrumAnalyzer] Initialized ${trackSpectrumAnalyzers.size} analyzers`);
}

export function getTrackSpectrumAnalyzer(trackId) {
    return trackSpectrumAnalyzers.get(trackId) || null;
}

export function getTrackFrequencyData(trackId) {
    const analyzer = trackSpectrumAnalyzers.get(trackId);
    if (!analyzer || !analyzer.enabled) return null;
    return analyzer.getFrequencyData();
}

export function updateTrackSpectrumAnalyzer(trackId, audioContext) {
    let analyzer = trackSpectrumAnalyzers.get(trackId);
    if (!analyzer) {
        const track = Array.from(trackSpectrumAnalyzers.keys()).length > 0 ? null : null;
        // Find track from tracks array if needed
        if (localAppServices && localAppServices.getTracks) {
            const tracks = localAppServices.getTracks();
            const track = tracks?.find(t => t.id === trackId);
            if (track) {
                analyzer = new PerTrackSpectrumAnalyzer(track);
                analyzer.initialize(audioContext);
                analyzer.connectToTrack();
                trackSpectrumAnalyzers.set(trackId, analyzer);
            }
        }
    }
    return analyzer;
}

export function addTrackSpectrumAnalyzer(track, audioContext) {
    if (!track || trackSpectrumAnalyzers.has(track.id)) return;
    
    const analyzer = new PerTrackSpectrumAnalyzer(track);
    if (audioContext) {
        analyzer.initialize(audioContext);
        analyzer.connectToTrack();
    }
    trackSpectrumAnalyzers.set(track.id, analyzer);
    console.log(`[PerTrackSpectrumAnalyzer] Added analyzer for track ${track.id}`);
}

export function removeTrackSpectrumAnalyzer(trackId) {
    const analyzer = trackSpectrumAnalyzers.get(trackId);
    if (analyzer) {
        analyzer.dispose();
        trackSpectrumAnalyzers.delete(trackId);
    }
    
    const renderer = trackCanvasRenderers.get(trackId);
    if (renderer) {
        if (renderer.animationId) {
            cancelAnimationFrame(renderer.animationId);
        }
        trackCanvasRenderers.delete(trackId);
    }
}

export function createTrackSpectrumCanvas(trackId, container) {
    const canvas = document.createElement('canvas');
    canvas.id = `trackSpectrumCanvas_${trackId}`;
    canvas.className = 'track-spectrum-canvas w-full h-full';
    canvas.style.display = 'block';
    
    if (container) {
        container.appendChild(canvas);
    }
    
    return canvas;
}

export function renderTrackSpectrum(trackId, canvas, options = {}) {
    const {
        barCount = 16,
        gap = 1,
        minHeight = 2,
        gradient = null // { stops: [[position, color], ...] }
    } = options;
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    if (!container) return;
    
    // Set canvas size
    const rect = container.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    
    const analyzer = trackSpectrumAnalyzers.get(trackId);
    const frequencyData = analyzer?.getFrequencyData();
    
    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!frequencyData || frequencyData.length === 0) {
        // Draw placeholder
        ctx.fillStyle = '#333';
        const barWidth = (canvas.width - (barCount - 1) * gap) / barCount;
        for (let i = 0; i < barCount; i++) {
            const x = i * (barWidth + gap);
            const h = minHeight + Math.random() * 10;
            ctx.fillRect(x, canvas.height - h, barWidth, h);
        }
        return;
    }
    
    // Draw bars
    const barWidth = (canvas.width - (barCount - 1) * gap) / barCount;
    
    for (let i = 0; i < barCount; i++) {
        // Sample from frequency data with logarithmic distribution
        const freqIndex = Math.floor(Math.pow(i / barCount, 1.5) * (frequencyData.length * 0.75));
        const value = frequencyData[freqIndex] || 0;
        const normalizedValue = value / 255;
        const barHeight = Math.max(minHeight, normalizedValue * canvas.height);
        
        const x = i * (barWidth + gap);
        const y = canvas.height - barHeight;
        
        // Color based on intensity
        const hue = 120 - (normalizedValue * 120);
        const lightness = 45 + (normalizedValue * 20);
        ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
        
        ctx.fillRect(x, y, barWidth, barHeight);
    }
}

export function startTrackSpectrumRendering(trackId, canvas, options = {}) {
    if (!canvas || trackCanvasRenderers.has(trackId)) return;
    
    const renderer = {
        canvas,
        animationId: null,
        options
    };
    
    trackCanvasRenderers.set(trackId, renderer);
    
    function draw() {
        const r = trackCanvasRenderers.get(trackId);
        if (!r) return;
        
        renderTrackSpectrum(trackId, r.canvas, r.options);
        r.animationId = requestAnimationFrame(draw);
    }
    
    draw();
}

export function stopTrackSpectrumRendering(trackId) {
    const renderer = trackCanvasRenderers.get(trackId);
    if (renderer) {
        if (renderer.animationId) {
            cancelAnimationFrame(renderer.animationId);
        }
        trackCanvasRenderers.delete(trackId);
    }
}

export function stopAllTrackSpectrumRendering() {
    trackCanvasRenderers.forEach((renderer, trackId) => {
        if (renderer.animationId) {
            cancelAnimationFrame(renderer.animationId);
        }
    });
    trackCanvasRenderers.clear();
}

// Get all track IDs with active analyzers
export function getActiveTrackSpectrumIds() {
    return Array.from(trackSpectrumAnalyzers.keys());
}

// Update all track analyzers (for use in animation loop)
export function updateAllTrackSpectrums() {
    trackSpectrumAnalyzers.forEach((analyzer, trackId) => {
        if (analyzer.enabled) {
            analyzer.getFrequencyData();
        }
    });
}