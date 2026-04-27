// js/AudioTapTempo.js - Audio Tap Tempo Detection
// Allows user to tap a button rhythmically to detect and set project tempo

import * as Constants from './constants.js';

let localAppServices = {};

// Tap timing storage
let tapTimestamps = [];
const MAX_TAPS = 16; // Use last N taps for averaging
const TIMEOUT_MS = 3000; // Reset if no tap within this time

let tapTimeoutId = null;

/**
 * Initialize the Audio Tap Tempo module.
 * @param {Object} services - App services from main.js
 */
export function initAudioTapTempo(services) {
    localAppServices = services || {};
    console.log('[AudioTapTempo] Initialized.');
}

/**
 * Handle a tap event. Calculates tempo from tap intervals.
 * @returns {number|null} Detected BPM or null if not enough taps
 */
export function handleTap() {
    const now = performance.now();
    
    // Reset on timeout
    if (tapTimeoutId) {
        clearTimeout(tapTimeoutId);
    }
    tapTimeoutId = setTimeout(resetTaps, TIMEOUT_MS);
    
    // Record this tap
    tapTimestamps.push(now);
    
    // Keep only recent taps
    if (tapTimestamps.length > MAX_TAPS) {
        tapTimestamps.shift();
    }
    
    // Need at least 2 taps to calculate tempo
    if (tapTimestamps.length < 2) {
        return null;
    }
    
    // Calculate intervals between consecutive taps
    let totalInterval = 0;
    for (let i = 1; i < tapTimestamps.length; i++) {
        totalInterval += tapTimestamps[i] - tapTimestamps[i - 1];
    }
    
    const avgInterval = totalInterval / (tapTimestamps.length - 1);
    const bpm = Math.round(60000 / avgInterval);
    
    // Clamp to reasonable tempo range
    const clampedBpm = Math.max(Constants.MIN_BPM || 20, Math.min(Constants.MAX_BPM || 300, bpm));
    
    console.log(`[AudioTapTempo] Tap detected. Avg interval: ${avgInterval.toFixed(1)}ms, BPM: ${clampedBpm}`);
    
    return clampedBpm;
}

/**
 * Reset tap history.
 */
export function resetTaps() {
    tapTimestamps = [];
    if (tapTimeoutId) {
        clearTimeout(tapTimeoutId);
        tapTimeoutId = null;
    }
}

/**
 * Get current tap count.
 * @returns {number}
 */
export function getTapCount() {
    return tapTimestamps.length;
}

/**
 * Get the detected BPM without applying it.
 * @returns {number|null}
 */
export function getDetectedBpm() {
    if (tapTimestamps.length < 2) return null;
    
    let totalInterval = 0;
    for (let i = 1; i < tapTimestamps.length; i++) {
        totalInterval += tapTimestamps[i] - tapTimestamps[i - 1];
    }
    
    const avgInterval = totalInterval / (tapTimestamps.length - 1);
    return Math.round(60000 / avgInterval);
}

/**
 * Apply the detected BPM to the transport.
 * @returns {number} Applied BPM
 */
export function applyDetectedBpm() {
    const bpm = getDetectedBpm();
    if (bpm === null) {
        console.log('[AudioTapTempo] Not enough taps to apply BPM');
        return null;
    }
    
    const clampedBpm = Math.max(Constants.MIN_BPM || 20, Math.min(Constants.MAX_BPM || 300, bpm));
    
    // Apply to Tone.Transport
    if (typeof Tone !== 'undefined' && Tone.Transport) {
        Tone.Transport.bpm.value = clampedBpm;
        console.log(`[AudioTapTempo] Applied BPM: ${clampedBpm}`);
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Tempo set to ${clampedBpm} BPM`, 1500);
        }
    }
    
    return clampedBpm;
}

/**
 * Open the Audio Tap Tempo panel.
 */
export function openAudioTapTempoPanel() {
    const windowId = 'audioTapTempo';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTapTempoContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'tapTempoContent';
    contentContainer.style.cssText = 'padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 16px; background: #1a1a1a; height: 100%;';
    
    const options = { width: 280, height: 320, minWidth: 240, minHeight: 280, initialContentKey: windowId, closable: true, minimizable: true, resizable: false };
    
    const win = localAppServices.createWindow(windowId, 'Tap Tempo', contentContainer, options);
    if (win?.element) {
        renderTapTempoContent();
    }
    
    return win;
}

/**
 * Render the tap tempo panel content.
 */
function renderTapTempoContent() {
    const container = document.getElementById('tapTempoContent');
    if (!container) return;
    
    const currentBpm = (typeof Tone !== 'undefined' && Tone.Transport) ? Tone.Transport.bpm.value : 120;
    const detectedBpm = getDetectedBpm();
    
    container.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Current Tempo</div>
            <div id="tapTempoCurrent" style="font-size: 36px; font-weight: bold; color: #fff;">${currentBpm} <span style="font-size: 14px; color: #666;">BPM</span></div>
        </div>
        
        <div style="text-align: center;">
            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Detected Tempo</div>
            <div id="tapTempoDetected" style="font-size: 48px; font-weight: bold; color: ${detectedBpm ? '#7c3aed' : '#444'};">${detectedBpm || '--'} <span style="font-size: 18px; color: #666;">BPM</span></div>
        </div>
        
        <button id="tapTempoButton" style="
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 3px solid #7c3aed;
            background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
            color: #7c3aed;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.1s;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
        ">TAP</button>
        
        <div style="display: flex; gap: 8px;">
            <button id="tapTempoApply" style="
                flex: 1;
                padding: 10px;
                background: #7c3aed;
                border: none;
                border-radius: 6px;
                color: #fff;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                ${detectedBpm ? '' : 'opacity: 0.4; pointer-events: none;'}
            ">Apply Tempo</button>
            
            <button id="tapTempoReset" style="
                padding: 10px 16px;
                background: #333;
                border: none;
                border-radius: 6px;
                color: #888;
                font-size: 13px;
                cursor: pointer;
            ">Reset</button>
        </div>
        
        <div style="font-size: 11px; color: #555; text-align: center;">
            Tap the button rhythmically to detect tempo<br>
            ${getTapCount()} taps recorded
        </div>
    `;
    
    // Attach event listeners
    const tapBtn = container.querySelector('#tapTempoButton');
    const applyBtn = container.querySelector('#tapTempoApply');
    const resetBtn = container.querySelector('#tapTempoReset');
    
    // Visual feedback on tap
    let tapAnimFrame = null;
    const animateTap = () => {
        tapBtn.style.transform = 'scale(0.95)';
        tapBtn.style.background = 'linear-gradient(145deg, #3a2a4a, #2a1a3a)';
        setTimeout(() => {
            tapBtn.style.transform = 'scale(1)';
            tapBtn.style.background = 'linear-gradient(145deg, #2a2a2a, #1a1a1a)';
        }, 100);
    };
    
    tapBtn.addEventListener('click', () => {
        const bpm = handleTap();
        animateTap();
        updateDetectedDisplay();
    });
    
    // Keyboard support - spacebar
    const handleKeydown = (e) => {
        if (e.code === 'Space' && e.target === document.body) {
            e.preventDefault();
            const bpm = handleTap();
            animateTap();
            updateDetectedDisplay();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    
    applyBtn.addEventListener('click', () => {
        const applied = applyDetectedBpm();
        if (applied) {
            updateCurrentDisplay();
            resetTaps();
            updateDetectedDisplay();
        }
    });
    
    resetBtn.addEventListener('click', () => {
        resetTaps();
        updateDetectedDisplay();
        const tapCount = container.querySelector('div:last-child');
        if (tapCount) {
            tapCount.innerHTML = `
                Tap the button rhythmically to detect tempo<br>
                0 taps recorded
            `;
        }
    });
    
    function updateCurrentDisplay() {
        const currentEl = container.querySelector('#tapTempoCurrent');
        if (currentEl) {
            const newBpm = (typeof Tone !== 'undefined' && Tone.Transport) ? Tone.Transport.bpm.value : 120;
            currentEl.innerHTML = `${newBpm} <span style="font-size: 14px; color: #666;">BPM</span>`;
        }
    }
    
    function updateDetectedDisplay() {
        const detectedEl = container.querySelector('#tapTempoDetected');
        const applyEl = container.querySelector('#tapTempoApply');
        const tapCount = container.querySelector('div:last-child');
        
        const bpm = getDetectedBpm();
        if (detectedEl) {
            detectedEl.innerHTML = `${bpm || '--'} <span style="font-size: 18px; color: #666;">BPM</span>`;
            detectedEl.style.color = bpm ? '#7c3aed' : '#444';
        }
        if (applyEl) {
            applyEl.style.opacity = bpm ? '1' : '0.4';
            applyEl.style.pointerEvents = bpm ? 'auto' : 'none';
        }
        if (tapCount) {
            tapCount.innerHTML = `
                Tap the button rhythmically to detect tempo<br>
                ${getTapCount()} taps recorded
            `;
        }
    }
}

/**
 * Cleanup on dispose.
 */
export function disposeAudioTapTempo() {
    resetTaps();
    console.log('[AudioTapTempo] Disposed');
}