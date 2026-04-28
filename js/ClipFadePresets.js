// js/ClipFadePresets.js - Clip Fade Preset Management
export const FADE_PRESETS = [
    { id: 'linear_in', name: 'Linear In', curve: 'linear', direction: 'in' },
    { id: 'linear_out', name: 'Linear Out', curve: 'linear', direction: 'out' },
    { id: 'exponential_in', name: 'Exponential In', curve: 'exponential', direction: 'in' },
    { id: 'exponential_out', name: 'Exponential Out', curve: 'exponential', direction: 'out' },
    { id: 's_curve_in', name: 'S-Curve In', curve: 's-curve', direction: 'in' },
    { id: 's_curve_out', name: 'S-Curve Out', curve: 's-curve', direction: 'out' },
    { id: 'logarithmic_in', name: 'Logarithmic In', curve: 'logarithmic', direction: 'in' },
    { id: 'logarithmic_out', name: 'Logarithmic Out', curve: 'logarithmic', direction: 'out' }
];

export function getFadePresets() { return [...FADE_PRESETS]; }

export function getFadePresetById(id) {
    return FADE_PRESETS.find(p => p.id === id) || null;
}

export function applyFadePresetToClip(clip, presetId, fadeTimeMs = 1000) {
    const preset = getFadePresetById(presetId);
    if (!preset) return false;
    
    if (!clip.fadePoints) clip.fadePoints = { in: [], out: [] };
    
    const points = [];
    const steps = 20;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let value;
        
        switch (preset.curve) {
            case 'exponential':
                value = preset.direction === 'in' ? Math.pow(t, 2) : 1 - Math.pow(1 - t, 2);
                break;
            case 's-curve':
                value = preset.direction === 'in' ? t * t * (3 - 2 * t) : t * t * (3 - 2 * t);
                value = preset.direction === 'in' ? value : 1 - value;
                break;
            case 'logarithmic':
                value = preset.direction === 'in' ? Math.log(1 + t * (Math.E - 1)) : Math.log(1 + (1 - t) * (Math.E - 1));
                break;
            default:
                value = preset.direction === 'in' ? t : 1 - t;
        }
        
        points.push({ time: t, value: Math.max(0, Math.min(1, value)) });
    }
    
    if (preset.direction === 'in') {
        clip.fadePoints.in = points;
    } else {
        clip.fadePoints.out = points;
    }
    
    clip.fadeTimeMs = fadeTimeMs;
    console.log(`[ClipFadePresets] Applied "${preset.name}" to clip`);
    return true;
}

export function clearFadePoints(clip) {
    if (clip.fadePoints) {
        clip.fadePoints.in = [];
        clip.fadePoints.out = [];
    }
}

export function getCustomFadePresets() {
    const stored = localStorage.getItem('customFadePresets');
    return stored ? JSON.parse(stored) : [];
}

export function saveCustomFadePreset(name, curve, direction) {
    const presets = getCustomFadePresets();
    const id = `custom_${Date.now()}`;
    presets.push({ id, name, curve, direction });
    localStorage.setItem('customFadePresets', JSON.stringify(presets));
    return id;
}