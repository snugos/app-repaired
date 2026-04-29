// js/WaveformVisualization.js - Waveform Drawing for Audio Clips
// Draws waveform visualization on audio clip elements

let localAppServices = {};
let waveformCache = new Map(); // clipId -> Float32Array peaks
const CACHE_PREFIX = 'wf_';

export function initWaveformVisualization(services) {
    localAppServices = services;
    console.log('[WaveformVisualization] Initialized');
}

/**
 * Compute waveform peaks from an AudioBuffer
 * @param {AudioBuffer} buffer - The audio buffer
 * @param {number} samplesPerPeak - Number of samples per peak point
 * @returns {Float32Array} Array of peak values (-1 to 1)
 */
export function computeWaveformPeaks(buffer, samplesPerPeak = 256) {
    if (!buffer || buffer.length === 0) return new Float32Array(0);
    
    const channelData = buffer.getChannelData(0); // Use first channel
    const numPeaks = Math.ceil(channelData.length / samplesPerPeak);
    const peaks = new Float32Array(numPeaks);
    
    for (let i = 0; i < numPeaks; i++) {
        const start = i * samplesPerPeak;
        const end = Math.min(start + samplesPerPeak, channelData.length);
        let max = 0;
        
        for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
        }
        peaks[i] = max;
    }
    
    return peaks;
}

/**
 * Get or compute waveform peaks for a clip
 * @param {object} clip - Audio clip object with audioBuffer
 * @param {number} targetPeaks - Target number of peak points
 * @returns {Float32Array|null} Waveform peaks or null
 */
export function getWaveformPeaks(clip, targetPeaks = 200) {
    if (!clip || !clip.audioBuffer) return null;
    
    const buffer = clip.audioBuffer;
    const cacheKey = CACHE_PREFIX + clip.id;
    
    // Check cache
    if (waveformCache.has(cacheKey)) {
        const cached = waveformCache.get(cacheKey);
        if (cached.peaks && cached.peaks.length === targetPeaks) {
            return cached.peaks;
        }
    }
    
    // Compute new peaks
    const samplesPerPeak = Math.max(1, Math.floor(buffer.length / targetPeaks));
    const peaks = computeWaveformPeaks(buffer, samplesPerPeak);
    
    // Store in cache
    waveformCache.set(cacheKey, { peaks, bufferLength: buffer.length });
    
    return peaks;
}

/**
 * Draw waveform on a canvas element
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {Float32Array} peaks - Waveform peak data
 * @param {object} options - Drawing options
 */
export function drawWaveform(canvas, peaks, options = {}) {
    if (!canvas || !peaks || peaks.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    
    // Set canvas size for high DPI
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    const {
        color = '#4ade80',
        bgColor = 'transparent',
        mirror = true,
        barWidth = 2,
        barGap = 1,
        centerLine = true,
        centerLineColor = 'rgba(255,255,255,0.1)'
    } = options;
    
    // Clear canvas
    if (bgColor === 'transparent') {
        ctx.clearRect(0, 0, width, height);
    } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
    }
    
    const numBars = peaks.length;
    const totalBarWidth = barWidth + barGap;
    const barsToDraw = Math.floor(width / totalBarWidth);
    const samplesPerBar = Math.max(1, Math.floor(numBars / barsToDraw));
    const centerY = height / 2;
    const maxHeight = height * 0.9;
    
    // Draw center line
    if (centerLine) {
        ctx.strokeStyle = centerLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    }
    
    // Draw waveform bars
    ctx.fillStyle = color;
    
    for (let i = 0; i < barsToDraw && i < numBars; i++) {
        const peakIndex = Math.min(Math.floor(i * (numBars / barsToDraw)), numBars - 1);
        const peak = peaks[peakIndex];
        const barHeight = Math.max(2, peak * maxHeight);
        
        const x = i * totalBarWidth;
        
        if (mirror) {
            // Draw mirrored bars (top and bottom)
            ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        } else {
            // Draw from bottom
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        }
    }
}

/**
 * Create a canvas overlay element for a clip
 * @param {HTMLElement} clipEl - The clip element
 * @param {object} clip - The clip data
 * @param {number} targetPeaks - Target number of peaks
 * @returns {HTMLCanvasElement} Canvas element with waveform
 */
export function createWaveformCanvas(clipEl, clip, targetPeaks = 200) {
    if (!clipEl || !clip || clip.type === 'MIDI') return null;
    
    // Remove existing canvas if any
    const existing = clipEl.querySelector('.waveform-canvas');
    if (existing) existing.remove();
    
    const peaks = getWaveformPeaks(clip, targetPeaks);
    if (!peaks) return null;
    
    const canvas = document.createElement('canvas');
    canvas.className = 'waveform-canvas';
    canvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        opacity: 0.7;
    `;
    
    // Insert at beginning of clip
    clipEl.insertBefore(canvas, clipEl.firstChild);
    
    return canvas;
}

/**
 * Update waveform display for a clip element
 * @param {HTMLElement} clipEl - Clip DOM element
 * @param {object} clip - Clip data
 * @param {object} options - Drawing options
 */
export function updateWaveformDisplay(clipEl, clip, options = {}) {
    if (!clipEl || !clip) return;
    
    const canvas = clipEl.querySelector('.waveform-canvas') || createWaveformCanvas(clipEl, clip);
    if (!canvas) return;
    
    const peaks = getWaveformPeaks(clip, 200);
    if (!peaks) return;
    
    drawWaveform(canvas, peaks, {
        color: options.color || '#4ade80',
        bgColor: 'transparent',
        mirror: true,
        barWidth: options.barWidth || 2,
        barGap: options.barGap || 1,
        centerLine: true,
        centerLineColor: 'rgba(255,255,255,0.1)'
    });
}

/**
 * Clear waveform cache for a clip
 * @param {string} clipId - Clip ID
 */
export function clearWaveformCache(clipId) {
    waveformCache.delete(CACHE_PREFIX + clipId);
}

/**
 * Clear all waveform cache
 */
export function clearAllWaveformCache() {
    waveformCache.clear();
}

/**
 * Render waveforms for all visible audio clips in a track lane
 * @param {number} trackId - Track ID
 */
export function renderTrackWaveforms(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track || !track.timelineClips) return;
    
    track.timelineClips.forEach(clip => {
        if (clip.type !== 'Audio') return;
        
        const clipEl = document.querySelector(`[data-clip-id="${clip.id}"]`);
        if (clipEl) {
            updateWaveformDisplay(clipEl, clip);
        }
    });
}

/**
 * Open waveform settings panel
 */
export function openWaveformSettingsPanel() {
    const windowId = 'waveformSettings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'waveformSettingsContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 text-white';
    
    const win = localAppServices.createWindow(windowId, 'Waveform Settings', contentContainer, {
        width: 320,
        height: 380,
        minWidth: 280,
        minHeight: 320,
        closable: true,
        minimizable: true,
        resizable: true
    });
    
    if (win?.element) {
        renderWaveformSettingsContent();
    }
    
    return win;
}

function renderWaveformSettingsContent() {
    const container = document.getElementById('waveformSettingsContent');
    if (!container) return;
    
    // Get current settings from localStorage or defaults
    const settings = {
        enabled: true,
        color: '#4ade80',
        barWidth: 2,
        barGap: 1,
        opacity: 0.7,
        mirror: true,
        ...(JSON.parse(localStorage.getItem('snaw_waveform_settings') || '{}'))
    };
    
    container.innerHTML = `
        <div class="mb-4">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="wfEnabled" ${settings.enabled ? 'checked' : ''} class="w-4 h-4 accent-green-500">
                <span class="text-sm font-medium text-gray-200">Enable Waveforms</span>
            </label>
        </div>
        
        <div class="mb-4">
            <label class="block text-xs text-gray-400 mb-2">Waveform Color</label>
            <div class="flex items-center gap-2">
                <input type="color" id="wfColor" value="${settings.color}" class="w-10 h-8 rounded cursor-pointer">
                <input type="text" id="wfColorText" value="${settings.color}" class="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white">
            </div>
        </div>
        
        <div class="mb-4">
            <label class="block text-xs text-gray-400 mb-2">Bar Width: <span id="barWidthVal">${settings.barWidth}px</span></label>
            <input type="range" id="wfBarWidth" min="1" max="6" value="${settings.barWidth}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
        </div>
        
        <div class="mb-4">
            <label class="block text-xs text-gray-400 mb-2">Bar Gap: <span id="barGapVal">${settings.barGap}px</span></label>
            <input type="range" id="wfBarGap" min="0" max="4" value="${settings.barGap}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
        </div>
        
        <div class="mb-4">
            <label class="block text-xs text-gray-400 mb-2">Opacity: <span id="opacityVal">${Math.round(settings.opacity * 100)}%</span></label>
            <input type="range" id="wfOpacity" min="20" max="100" value="${Math.round(settings.opacity * 100)}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="wfMirror" ${settings.mirror ? 'checked' : ''} class="w-4 h-4 accent-green-500">
                <span class="text-sm text-gray-300">Mirror Waveform (top/bottom)</span>
            </label>
        </div>
        
        <div class="flex gap-2 mt-4">
            <button id="wfApplyAll" class="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                Apply to All Clips
            </button>
            <button id="wfClearCache" class="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-500">
                Clear Cache
            </button>
        </div>
        
        <div class="mt-4 p-2 bg-gray-800 rounded text-xs text-gray-400">
            Waveforms are computed from audio buffer data. Caching is used to improve performance.
        </div>
    `;
    
    // Event listeners
    const barWidthSlider = container.querySelector('#wfBarWidth');
    const barGapSlider = container.querySelector('#wfBarGap');
    const opacitySlider = container.querySelector('#wfOpacity');
    const colorInput = container.querySelector('#wfColor');
    const colorText = container.querySelector('#wfColorText');
    
    barWidthSlider?.addEventListener('input', (e) => {
        container.querySelector('#barWidthVal').textContent = e.target.value + 'px';
        saveSettings({ barWidth: parseInt(e.target.value) });
    });
    
    barGapSlider?.addEventListener('input', (e) => {
        container.querySelector('#barGapVal').textContent = e.target.value + 'px';
        saveSettings({ barGap: parseInt(e.target.value) });
    });
    
    opacitySlider?.addEventListener('input', (e) => {
        container.querySelector('#opacityVal').textContent = e.target.value + '%';
        saveSettings({ opacity: parseInt(e.target.value) / 100 });
    });
    
    colorInput?.addEventListener('input', (e) => {
        colorText.value = e.target.value;
        saveSettings({ color: e.target.value });
    });
    
    colorText?.addEventListener('change', (e) => {
        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
            colorInput.value = e.target.value;
            saveSettings({ color: e.target.value });
        }
    });
    
    container.querySelector('#wfMirror')?.addEventListener('change', (e) => {
        saveSettings({ mirror: e.target.checked });
    });
    
    container.querySelector('#wfEnabled')?.addEventListener('change', (e) => {
        saveSettings({ enabled: e.target.checked });
        document.querySelectorAll('.waveform-canvas').forEach(c => {
            c.style.display = e.target.checked ? 'block' : 'none';
        });
    });
    
    container.querySelector('#wfApplyAll')?.addEventListener('click', () => {
        applyWaveformsToAllClips();
    });
    
    container.querySelector('#wfClearCache')?.addEventListener('click', () => {
        clearAllWaveformCache();
        localAppServices.showNotification?.('Waveform cache cleared', 1500);
    });
}

function saveSettings(partial) {
    const current = JSON.parse(localStorage.getItem('snaw_waveform_settings') || '{}');
    const updated = { ...current, ...partial };
    localStorage.setItem('snaw_waveform_settings', JSON.stringify(updated));
    
    // Apply immediately to visible clips
    if (partial.color || partial.barWidth || partial.barGap || partial.opacity || partial.mirror !== undefined) {
        applyWaveformsToAllClips();
    }
}

function applyWaveformsToAllClips() {
    const settings = JSON.parse(localStorage.getItem('snaw_waveform_settings') || '{}');
    const tracks = localAppServices.getTracks?.() || [];
    
    tracks.forEach(track => {
        if (!track.timelineClips) return;
        
        track.timelineClips.forEach(clip => {
            if (clip.type === 'Audio') {
                const clipEl = document.querySelector(`[data-clip-id="${clip.id}"]`);
                if (clipEl) {
                    if (settings.enabled !== false) {
                        updateWaveformDisplay(clipEl, clip, {
                            color: settings.color || '#4ade80',
                            barWidth: settings.barWidth || 2,
                            barGap: settings.barGap || 1
                        });
                        const canvas = clipEl.querySelector('.waveform-canvas');
                        if (canvas) {
                            canvas.style.opacity = settings.opacity || 0.7;
                        }
                    } else {
                        const canvas = clipEl.querySelector('.waveform-canvas');
                        if (canvas) canvas.style.display = 'none';
                    }
                }
            }
        });
    });
    
    localAppServices.showNotification?.('Waveforms updated', 1500);
}

console.log('[WaveformVisualization] Module loaded');