/**
 * BatchClipEffects - Apply effects to multiple selected clips at once
 */
import { getTrackByIdState, captureStateForUndo } from './state.js';

let panelInstance = null;
let selectedClipIds = []; // { clipId, trackId }

export function openBatchClipEffectsPanel() {
    if (panelInstance) {
        panelInstance.remove();
        panelInstance = null;
        return;
    }

    // Collect currently selected clips from DOM
    selectedClipIds = [];
    document.querySelectorAll('.timeline-clip.selected').forEach(el => {
        if (el.dataset.clipId && el.dataset.trackId) {
            selectedClipIds.push({
                clipId: el.dataset.clipId,
                trackId: parseInt(el.dataset.trackId)
            });
        }
    });

    if (selectedClipIds.length === 0) {
        if (typeof showSafeNotification === 'function') {
            showSafeNotification('No clips selected. Shift+click to select multiple clips.', 2000);
        }
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'batchClipEffectsPanel';
    panel.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #1a1a2e;
        border: 1px solid #4a4a8a;
        border-radius: 12px;
        padding: 20px;
        z-index: 9999;
        min-width: 340px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.6);
        font-family: system-ui, -apple-system, sans-serif;
        color: #e0e0e0;
    `;

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div style="font-weight:600; font-size:15px; color:#fff;">Batch Clip Effects</div>
            <div style="font-size:12px; color:#888;">${selectedClipIds.length} clip(s) selected</div>
        </div>

        <!-- Fade In -->
        <div style="margin-bottom:14px;">
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:13px;">
                <span style="color:#aaa;">Fade In:</span>
                <input type="range" id="batchFadeIn" min="0" max="2" step="0.1" value="0"
                    style="flex:1; accent-color:#8b5cf6;">
                <span id="batchFadeInVal" style="width:40px; font-size:12px; color:#888;">0s</span>
            </label>
        </div>

        <!-- Fade Out -->
        <div style="margin-bottom:14px;">
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:13px;">
                <span style="color:#aaa;">Fade Out:</span>
                <input type="range" id="batchFadeOut" min="0" max="2" step="0.1" value="0"
                    style="flex:1; accent-color:#8b5cf6;">
                <span id="batchFadeOutVal" style="width:40px; font-size:12px; color:#888;">0s</span>
            </label>
        </div>

        <!-- Pitch Shift (semitones) -->
        <div style="margin-bottom:14px;">
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:13px;">
                <span style="color:#aaa;">Pitch:</span>
                <button id="batchPitchDown" style="background:#2a2a4a; border:1px solid #3a3a6a; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer;">−</button>
                <span id="batchPitchVal" style="width:50px; text-align:center; font-size:13px;">0 st</span>
                <button id="batchPitchUp" style="background:#2a2a4a; border:1px solid #3a3a6a; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer;">+</button>
            </label>
        </div>

        <!-- Volume -->
        <div style="margin-bottom:14px;">
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:13px;">
                <span style="color:#aaa;">Volume:</span>
                <input type="range" id="batchVolume" min="0" max="2" step="0.05" value="1"
                    style="flex:1; accent-color:#8b5cf6;">
                <span id="batchVolumeVal" style="width:40px; font-size:12px; color:#888;">100%</span>
            </label>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; gap:10px; margin-top:16px;">
            <button id="batchApplyEffects" style="flex:1; background:#4a4a8a; border:1px solid #6a6aaa; color:#fff; padding:10px; border-radius:6px; cursor:pointer; font-weight:500;">
                Apply Effects
            </button>
            <button id="batchReverseClips" style="flex:1; background:#2a2a4a; border:1px solid #3a3a6a; color:#fff; padding:10px; border-radius:6px; cursor:pointer;">
                🔄 Reverse
            </button>
        </div>
    `;

    document.body.appendChild(panel);
    panelInstance = panel;

    // Wire up controls
    const fadeInInput = panel.querySelector('#batchFadeIn');
    const fadeOutInput = panel.querySelector('#batchFadeOut');
    const fadeInVal = panel.querySelector('#batchFadeInVal');
    const fadeOutVal = panel.querySelector('#batchFadeOutVal');
    const pitchVal = panel.querySelector('#batchPitchVal');
    const volumeInput = panel.querySelector('#batchVolume');
    const volumeVal = panel.querySelector('#batchVolumeVal');

    let pitchShift = 0;

    fadeInInput.addEventListener('input', () => {
        fadeInVal.textContent = parseFloat(fadeInInput.value).toFixed(1) + 's';
    });
    fadeOutInput.addEventListener('input', () => {
        fadeOutVal.textContent = parseFloat(fadeOutInput.value).toFixed(1) + 's';
    });
    volumeInput.addEventListener('input', () => {
        volumeVal.textContent = Math.round(parseFloat(volumeInput.value) * 100) + '%';
    });

    panel.querySelector('#batchPitchDown').addEventListener('click', () => {
        pitchShift = Math.max(-12, pitchShift - 1);
        pitchVal.textContent = pitchShift + ' st';
    });
    panel.querySelector('#batchPitchUp').addEventListener('click', () => {
        pitchShift = Math.min(12, pitchShift + 1);
        pitchVal.textContent = pitchShift + ' st';
    });

    // Apply button
    panel.querySelector('#batchApplyEffects').addEventListener('click', () => {
        applyBatchEffects({
            fadeIn: parseFloat(fadeInInput.value),
            fadeOut: parseFloat(fadeOutInput.value),
            pitchShift,
            volume: parseFloat(volumeInput.value)
        });
        if (typeof showSafeNotification === 'function') {
            showSafeNotification(`Applied effects to ${selectedClipIds.length} clip(s)`, 1500);
        }
        closePanel();
    });

    // Reverse button
    panel.querySelector('#batchReverseClips').addEventListener('click', () => {
        applyBatchReverse();
        if (typeof showSafeNotification === 'function') {
            showSafeNotification(`Reversed ${selectedClipIds.length} clip(s)`, 1500);
        }
        closePanel();
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 12px;
        background: none;
        border: none;
        color: #666;
        font-size: 16px;
        cursor: pointer;
    `;
    closeBtn.addEventListener('click', closePanel);
    panel.appendChild(closeBtn);
}

function closePanel() {
    if (panelInstance) {
        panelInstance.remove();
        panelInstance = null;
    }
}

function applyBatchEffects(options) {
    if (typeof captureStateForUndo === 'function') {
        captureStateForUndo('Batch clip effects');
    }

    selectedClipIds.forEach(({ clipId, trackId }) => {
        const track = getTrackByIdState(trackId);
        if (!track || !track.timelineClips) return;

        const clip = track.timelineClips.find(c => c.id === clipId);
        if (!clip) return;

        if (options.fadeIn !== undefined) {
            clip.fadeIn = options.fadeIn;
        }
        if (options.fadeOut !== undefined) {
            clip.fadeOut = options.fadeOut;
        }
        if (options.volume !== undefined) {
            clip.volume = options.volume;
        }
        if (options.pitchShift !== undefined && options.pitchShift !== 0) {
            clip.pitchShift = options.pitchShift;
            // Pitch shift on audio clips would need audio processing
            // For now just store the value
        }
    });

    // Refresh timeline if available
    if (typeof renderTimeline === 'function') {
        renderTimeline();
    }
}

function applyBatchReverse() {
    if (typeof captureStateForUndo === 'function') {
        captureStateForUndo('Batch reverse clips');
    }

    selectedClipIds.forEach(({ clipId, trackId }) => {
        const track = getTrackByIdState(trackId);
        if (!track || !track.timelineClips) return;

        const clip = track.timelineClips.find(c => c.id === clipId);
        if (!clip) return;

        clip.reversed = !clip.reversed;
    });

    if (typeof renderTimeline === 'function') {
        renderTimeline();
    }
}

// Export for keyboard shortcut
export function closeBatchClipEffectsPanel() {
    closePanel();
}