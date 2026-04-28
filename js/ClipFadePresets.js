// js/ClipFadePresets.js - Save and apply common fade curves
(function() {
    'use strict';

    const FADE_PRESETS = {
        'Linear In': (t) => t,
        'Linear Out': (t) => 1 - t,
        'Linear In/Out': (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
        'Exponential In': (t) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
        'Exponential Out': (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
        'S-Curve': (t) => t < 0.5 ? 2 * t * t * (1.5 - t) : 1 - Math.pow(-2 * t + 2, 2) / 2,
        'Logarithmic In': (t) => t === 0 ? 0 : Math.log(1 + 10 * t) / Math.log(11),
        'Logarithmic Out': (t) => t === 1 ? 1 : 1 - Math.log(1 + 10 * (1 - t)) / Math.log(11),
        'Quarter Sine In': (t) => Math.sin((t - 1) * Math.PI / 2) + 1,
        'Quarter Sine Out': (t) => Math.sin(t * Math.PI / 2),
        'Half Sine In': (t) => 1 - Math.cos(t * Math.PI / 2),
        'Half Sine Out': (t) => Math.sin(t * Math.PI / 2),
    };

    const savedPresets = {};

    function applyFade(curve, duration, type = 'out') {
        const audioContext = window.audioContext || window.audioCtx;
        if (!audioContext) return;

        const isFadeIn = type === 'in';
        const curveFn = FADE_PRESETS[curve] || FADE_PRESETS['Linear Out'];
        const gainNode = audioContext.createGain();

        gainNode.gain.setValueAtTime(isFadeIn ? 0 : 1, audioContext.currentTime);
        gainNode.gain.setValueAtTime(isFadeIn ? 1 : 0, audioContext.currentTime + duration);

        if (curve !== 'Linear Out' && curve !== 'Linear In') {
            for (let i = 0; i <= 100; i++) {
                const t = i / 100;
                const value = isFadeIn ? curveFn(t) : curveFn(1 - t);
                gainNode.gain.setValueAtTime(value, audioContext.currentTime + duration * t);
            }
        }

        return gainNode;
    }

    function openFadePresetsPanel() {
        const existing = document.getElementById('fadePresetsPanel');
        if (existing) { existing.remove(); return; }

        const panel = document.createElement('div');
        panel.id = 'fadePresetsPanel';
        panel.style.cssText = `
            position: fixed; top: 80px; right: 220px; width: 280px;
            background: #1a1a2e; border: 1px solid #333; border-radius: 8px;
            padding: 16px; z-index: 10000; color: #fff; font-family: sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 12px;';
        title.textContent = 'Fade Presets';
        panel.appendChild(title);

        const presetList = document.createElement('div');
        presetList.style.cssText = 'max-height: 300px; overflow-y: auto;';
        presetList.id = 'fadePresetList';

        Object.keys(FADE_PRESETS).forEach(name => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                display: block; width: 100%; padding: 8px 12px; margin-bottom: 6px;
                background: #252540; border: none; border-radius: 4px; color: #fff;
                cursor: pointer; text-align: left; font-size: 12px;
            `;
            btn.textContent = name;
            btn.onclick = () => applyPresetToSelected(name);
            presetList.appendChild(btn);
        });
        panel.appendChild(presetList);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            width: 100%; padding: 8px; margin-top: 8px; background: #333;
            border: none; border-radius: 4px; color: #fff; cursor: pointer;
        `;
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);

        document.body.appendChild(panel);
    }

    function applyPresetToSelected(presetName) {
        console.log(`Applying fade preset: ${presetName}`);
        const event = new CustomEvent('snawFadePreset', { detail: { preset: presetName } });
        document.dispatchEvent(event);
    }

    function saveCustomPreset(name, curveFn) {
        savedPresets[name] = curveFn;
    }

    function deleteCustomPreset(name) {
        delete savedPresets[name];
    }

    function getPresetNames() {
        return Object.keys(FADE_PRESETS).concat(Object.keys(savedPresets));
    }

    window.openFadePresetsPanel = openFadePresetsPanel;
    window.applyFadePreset = applyPresetToSelected;
    window.saveCustomFadePreset = saveCustomPreset;
    window.deleteCustomFadePreset = deleteCustomPreset;
    window.getFadePresetNames = getPresetNames;

})();