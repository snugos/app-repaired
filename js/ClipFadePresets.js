/**
 * ClipFadePresets Integration
 * Adds fade preset options to clip context menus
 */

import { AudioFadePreset } from './AudioFadePreset.js';

let localAppServices = null;

export function initializeClipFadePresets(services) {
    localAppServices = services;
    console.log('[ClipFadePresets] Initialized');
}

/**
 * Get fade preset menu items for clip context menu
 */
export function getClipFadeMenuItems(clipData, trackId) {
    const presets = AudioFadePreset.getPresets();
    
    return {
        label: 'Apply Fade Preset',
        submenu: presets.map(preset => ({
            label: preset.name,
            action: () => applyFadePresetToClip(clipData, trackId, preset)
        }))
    };
}

/**
 * Apply a fade preset to a clip
 */
function applyFadePresetToClip(clipData, trackId, preset) {
    if (!clipData || !clipData.buffer) {
        console.warn('[ClipFadePresets] No buffer on clip to apply fade');
        return;
    }
    
    try {
        const fadePreset = new AudioFadePreset();
        fadePreset.fadeInDuration = preset.fadeIn || 0;
        fadePreset.fadeOutDuration = preset.fadeOut || 0;
        fadePreset.fadeInCurve = preset.fadeInCurve || 'linear';
        fadePreset.fadeOutCurve = preset.fadeOutCurve || 'linear';
        
        // Apply fade to the buffer
        fadePreset.applyFade(clipData.buffer);
        
        console.log(`[ClipFadePresets] Applied "${preset.name}" to clip`);
        
        // Update clip display if needed
        if (localAppServices && localAppServices.refreshClip) {
            localAppServices.refreshClip(trackId, clipData.id);
        }
    } catch (err) {
        console.error('[ClipFadePresets] Error applying fade:', err);
    }
}

/**
 * Get standard fade menu items (non-submenu version for simpler integration)
 */
export function getClipFadeMenuItemsSimple() {
    const presets = AudioFadePreset.getPresets();
    return presets.map(preset => ({
        label: `Fade: ${preset.name}`,
        action: (clipData, trackId) => applyFadePresetToClip(clipData, trackId, preset)
    }));
}