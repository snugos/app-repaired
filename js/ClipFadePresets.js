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

// --- UI Panel Opener ---
export function openClipFadePresetsPanel(appServices) {
    const existing = document.getElementById('clipFadePresetsPanel');
    if (existing) { existing.remove(); return; }
    
    const presets = getFadePresets();
    const panel = document.createElement('div');
    panel.id = 'clipFadePresetsPanel';
    panel.style.cssText = 'position:fixed;top:80px;right:20px;width:260px;max-height:70vh;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;z-index:1000;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:14px;color:#e0e0e0;">Clip Fade Presets</h3>
            <button id="closeClipFadePresetsPanel" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;line-height:1;">&times;</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;" id="fadePresetButtons">
            ${presets.map(p => `
                <button data-preset-id="${p.id}" style="background:#252525;border:1px solid #383838;border-radius:4px;padding:8px 12px;color:#ccc;cursor:pointer;text-align:left;font-size:12px;transition:background 0.15s;">
                    ${p.name}
                </button>
            `).join('')}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #333;">
            <label style="color:#888;font-size:11px;">Fade Time (ms)</label>
            <input type="range" id="clipFadeTimeSlider" min="50" max="5000" value="1000" step="50" style="width:100%;margin-top:4px;">
            <div id="clipFadeTimeValue" style="color:#aaa;font-size:11px;text-align:center;margin-top:2px;">1000 ms</div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    document.getElementById('closeClipFadePresetsPanel').onclick = () => panel.remove();
    
    const timeSlider = document.getElementById('clipFadeTimeSlider');
    const timeValue = document.getElementById('clipFadeTimeValue');
    timeSlider.oninput = () => { timeValue.textContent = `${timeSlider.value} ms`; };
    
    panel.querySelectorAll('[data-preset-id]').forEach(btn => {
        btn.onclick = () => {
            const presetId = btn.dataset.presetId;
            const fadeTime = parseInt(timeSlider.value);
            const tracks = appServices?.getTracks?.() || [];
            let applied = 0;
            tracks.forEach(track => {
                if (track.sequences) {
                    Object.values(track.sequences).forEach(seq => {
                        if (seq.clips) {
                            seq.clips.forEach(clip => {
                                if (applyFadePresetToClip(clip, presetId, fadeTime)) applied++;
                            });
                        }
                    });
                }
            });
            if (applied > 0) {
                appServices?.showNotification?.(`Applied ${presets.find(p=>p.id===presetId)?.name} to ${applied} clip(s)`, 2000);
            } else {
                appServices?.showNotification?.('No clips to apply fade to. Select a clip first.', 2000);
            }
        };
    });
}