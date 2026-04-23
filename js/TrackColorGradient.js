// js/TrackColorGradient.js - Track Color Gradient for SnugOS DAW
// Apply gradient colors to track backgrounds for visual grouping

import { Track } from './Track.js';

const GRADIENT_PRESETS = [
    { id: 'none', name: 'Solid Color', type: 'solid' },
    { id: 'linear_top_bottom', name: 'Linear (Top→Bottom)', type: 'linear', direction: 'to bottom' },
    { id: 'linear_bottom_top', name: 'Linear (Bottom→Top)', type: 'linear', direction: 'to top' },
    { id: 'linear_left_right', name: 'Linear (Left→Right)', type: 'linear', direction: 'to right' },
    { id: 'linear_right_left', name: 'Linear (Right→Left)', type: 'linear', direction: 'to left' },
    { id: 'linear_tl_br', name: 'Linear (TL→BR)', type: 'linear', direction: 'to bottom right' },
    { id: 'linear_tr_bl', name: 'Linear (TR→BL)', type: 'linear', direction: 'to bottom left' },
    { id: 'radial_center', name: 'Radial (Center)', type: 'radial' },
    { id: 'diagonal', name: 'Diagonal', type: 'linear', direction: '135deg' },
];

let trackGradientSettings = {};

export function getTrackGradientSettings() {
    return JSON.parse(JSON.stringify(trackGradientSettings));
}

export function setTrackGradientSettings(settings) {
    trackGradientSettings = JSON.parse(JSON.stringify(settings));
}

export function getGradientPresets() {
    return [...GRADIENT_PRESETS];
}

export function getTrackGradientPreset(trackId) {
    return trackGradientSettings[trackId] || GRADIENT_PRESETS[0];
}

export function setTrackGradientPreset(trackId, preset) {
    trackGradientSettings[trackId] = {
        ...preset,
        modifiedAt: new Date().toISOString()
    };
    console.log(`[TrackColorGradient] Track ${trackId} gradient set to: ${preset.name}`);
}

export function clearTrackGradient(trackId) {
    if (trackGradientSettings[trackId]) {
        delete trackGradientSettings[trackId];
        console.log(`[TrackColorGradient] Track ${trackId} gradient cleared`);
    }
}

export function applyGradientToTrackElement(trackId, trackColor, element) {
    if (!element) return;
    
    const gradientSetting = trackGradientSettings[trackId];
    const baseColor = trackColor || '#3b82f6';
    
    if (!gradientSetting || gradientSetting.type === 'solid') {
        element.style.background = baseColor;
        return;
    }
    
    if (gradientSetting.type === 'linear') {
        const direction = gradientSetting.direction || 'to bottom';
        element.style.background = `linear-gradient(${direction}, ${baseColor}, ${adjustColorBrightness(baseColor, -20)})`;
    } else if (gradientSetting.type === 'radial') {
        element.style.background = `radial-gradient(circle, ${baseColor}, ${adjustColorBrightness(baseColor, -30)})`;
    }
}

function adjustColorBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1).padStart(6, '0')}`;
}

export function exportGradientData() {
    return JSON.parse(JSON.stringify(trackGradientSettings));
}

export function importGradientData(data) {
    if (data && typeof data === 'object') {
        trackGradientSettings = JSON.parse(JSON.stringify(data));
        console.log(`[TrackColorGradient] Imported gradient settings for ${Object.keys(trackGradientSettings).length} tracks`);
    }
}