// js/ClipStretchMarkers.js - Clip Stretch Markers Feature
// Allows users to add markers on audio clips to control stretch points

import { getTimelineClipAudioBuffer } from './audio.js';

let stretchMarkersPanel = null;
let activeTrackId = null;
let activeClipId = null;

export function initClipStretchMarkers() {
    console.log('[ClipStretchMarkers] Initialized');
}

export function getClipStretchMarkers(clip) {
    return {
        stretchStart: clip.stretchStart ?? 0,
        stretchEnd: clip.stretchEnd ?? (clip.duration ?? 1),
        stretchStartEnabled: clip.stretchStartEnabled ?? false,
        stretchEndEnabled: clip.stretchEndEnabled ?? false
    };
}

export function setClipStretchMarker(track, clipId, markerType, time) {
    if (!track || track.type !== 'Audio') return false;
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return false;
    
    const duration = clip.duration || 1;
    const clampedTime = Math.max(0, Math.min(time, duration));
    
    if (markerType === 'start') {
        clip.stretchStart = clampedTime;
        clip.stretchStartEnabled = true;
    } else if (markerType === 'end') {
        clip.stretchEnd = clampedTime;
        clip.stretchEndEnabled = true;
    }
    
    console.log(`[ClipStretchMarkers] Set ${markerType} marker at ${clampedTime.toFixed(3)}s for clip ${clipId}`);
    return true;
}

export function clearClipStretchMarkers(track, clipId) {
    if (!track || track.type !== 'Audio') return false;
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return false;
    
    clip.stretchStart = null;
    clip.stretchEnd = null;
    clip.stretchStartEnabled = false;
    clip.stretchEndEnabled = false;
    
    console.log(`[ClipStretchMarkers] Cleared markers for clip ${clipId}`);
    return true;
}

export function toggleClipStretchMarkers(track, clipId, show) {
    if (!track || track.type !== 'Audio') return;
    activeTrackId = track.id;
    activeClipId = clipId;
    
    if (show) {
        showStretchMarkersPanel(track, clipId);
    } else {
        hideStretchMarkersPanel();
    }
}

function showStretchMarkersPanel(track, clipId) {
    hideStretchMarkersPanel();
    
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return;
    
    const markers = getClipStretchMarkers(clip);
    
    stretchMarkersPanel = document.createElement('div');
    stretchMarkersPanel.id = 'stretchMarkersPanel';
    stretchMarkersPanel.style.cssText = `
        position: fixed;
        bottom: 60px;
        right: 20px;
        width: 280px;
        background: #1e1e1e;
        border: 1px solid #3a3a3a;
        border-radius: 8px;
        padding: 12px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        font-family: Inter, sans-serif;
    `;
    
    stretchMarkersPanel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="color:#e0e0e0;font-weight:600;font-size:13px;">Clip Stretch Markers</span>
            <button id="closeStretchMarkers" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;">×</button>
        </div>
        <div style="color:#aaa;font-size:11px;margin-bottom:8px;">${clip.name || 'Audio Clip'}</div>
        <div style="margin-bottom:10px;">
            <label style="color:#888;font-size:11px;">Stretch Start</label>
            <div style="display:flex;gap:8px;align-items:center;">
                <input type="checkbox" id="stretchStartEnabled" ${markers.stretchStartEnabled ? 'checked' : ''} style="width:14px;height:14px;">
                <input type="number" id="stretchStartTime" value="${markers.stretchStart.toFixed(3)}" step="0.001" min="0" max="${clip.duration}" 
                    style="flex:1;background:#2a2a2a;border:1px solid #444;border-radius:4px;color:#e0e0e0;padding:4px 6px;font-size:12px;width:70px;">
                <span style="color:#666;font-size:10px;">sec</span>
            </div>
        </div>
        <div style="margin-bottom:10px;">
            <label style="color:#888;font-size:11px;">Stretch End</label>
            <div style="display:flex;gap:8px;align-items:center;">
                <input type="checkbox" id="stretchEndEnabled" ${markers.stretchEndEnabled ? 'checked' : ''} style="width:14px;height:14px;">
                <input type="number" id="stretchEndTime" value="${markers.stretchEnd.toFixed(3)}" step="0.001" min="0" max="${clip.duration}" 
                    style="flex:1;background:#2a2a2a;border:1px solid #444;border-radius:4px;color:#e0e0e0;padding:4px 6px;font-size:12px;width:70px;">
                <span style="color:#666;font-size:10px;">sec</span>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button id="applyStretchMarkers" style="flex:1;background:#2d5d2d;border:none;border-radius:4px;color:#90EE90;padding:6px 10px;font-size:11px;cursor:pointer;font-weight:600;">Apply</button>
            <button id="clearStretchMarkers" style="flex:1;background:#5d2d2d;border:none;border-radius:4px;color:#ff9999;padding:6px 10px;font-size:11px;cursor:pointer;font-weight:600;">Clear</button>
        </div>
    `;
    
    document.body.appendChild(stretchMarkersPanel);
    
    document.getElementById('closeStretchMarkers').onclick = () => hideStretchMarkersPanel();
    document.getElementById('applyStretchMarkers').onclick = () => applyStretchMarkersFromPanel(track, clipId);
    document.getElementById('stretchStartTime').onchange = (e) => updateStretchStartFromInput(track, clipId, e.target.value);
    document.getElementById('stretchEndTime').onchange = (e) => updateStretchEndFromInput(track, clipId, e.target.value);
    document.getElementById('stretchStartEnabled').onchange = (e) => toggleStretchStartEnabled(track, clipId, e.target.checked);
    document.getElementById('stretchEndEnabled').onchange = (e) => toggleStretchEndEnabled(track, clipId, e.target.checked);
    document.getElementById('clearStretchMarkers').onclick = () => {
        clearClipStretchMarkers(track, clipId);
        hideStretchMarkersPanel();
        if (typeof refreshTrackView === 'function') refreshTrackView();
    };
}

function hideStretchMarkersPanel() {
    if (stretchMarkersPanel) {
        stretchMarkersPanel.remove();
        stretchMarkersPanel = null;
    }
    activeTrackId = null;
    activeClipId = null;
}

function applyStretchMarkersFromPanel(track, clipId) {
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return;
    
    clip.stretchStart = parseFloat(document.getElementById('stretchStartTime').value) || 0;
    clip.stretchEnd = parseFloat(document.getElementById('stretchEndTime').value) || clip.duration || 1;
    clip.stretchStartEnabled = document.getElementById('stretchStartEnabled').checked;
    clip.stretchEndEnabled = document.getElementById('stretchEndEnabled').checked;
    
    console.log(`[ClipStretchMarkers] Applied markers: start=${clip.stretchStart}, end=${clip.stretchEnd}`);
    hideStretchMarkersPanel();
    
    if (typeof refreshTrackView === 'function') refreshTrackView();
}

function updateStretchStartFromInput(track, clipId, value) {
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (clip) {
        clip.stretchStart = Math.max(0, Math.min(parseFloat(value) || 0, clip.duration || 1));
        clip.stretchStartEnabled = true;
    }
}

function updateStretchEndFromInput(track, clipId, value) {
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (clip) {
        clip.stretchEnd = Math.max(0, Math.min(parseFloat(value) || clip.duration || 1, clip.duration || 1));
        clip.stretchEndEnabled = true;
    }
}

function toggleStretchStartEnabled(track, clipId, enabled) {
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (clip) {
        clip.stretchStartEnabled = enabled;
    }
}

function toggleStretchEndEnabled(track, clipId, enabled) {
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (clip) {
        clip.stretchEndEnabled = enabled;
    }
}

export async function getClipWithStretchApplied(trackId, clipId) {
    const { getTrackByIdState } = await import('./state.js');
    const track = getTrackByIdState(trackId);
    if (!track || track.type !== 'Audio') return null;
    
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return null;
    
    const markers = getClipStretchMarkers(clip);
    
    if (!markers.stretchStartEnabled && !markers.stretchEndEnabled) {
        return null;
    }
    
    return {
        originalClip: clip,
        stretchStart: markers.stretchStart,
        stretchEnd: markers.stretchEnd,
        stretchStartEnabled: markers.stretchStartEnabled,
        stretchEndEnabled: markers.stretchEndEnabled
    };
}

export function hasStretchMarkers(clip) {
    return clip && ((clip.stretchStartEnabled && clip.stretchStart != null) || 
                   (clip.stretchEndEnabled && clip.stretchEnd != null));
}