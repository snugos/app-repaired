/**
 * Audio Stretch Quality Panel - Quick buttons to switch between fast/balanced/high quality stretching
 */
import { getAudioStretchingQuality, setAudioStretchingQuality } from './state.js';

let panelInstance = null;

export function openAudioStretchQualityPanel() {
    if (panelInstance) {
        panelInstance.remove();
        panelInstance = null;
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'audioStretchQualityPanel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #1a1a2e;
        border: 1px solid #3a3a5e;
        border-radius: 8px;
        padding: 16px;
        z-index: 9999;
        min-width: 220px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: system-ui, -apple-system, sans-serif;
        color: #e0e0e0;
    `;
    
    const title = document.createElement('div');
    title.textContent = 'Audio Stretch Quality';
    title.style.cssText = 'font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #fff;';
    panel.appendChild(title);
    
    const qualities = [
        { id: 'fast', label: 'Fast', desc: 'Quick stretching, lower quality' },
        { id: 'balanced', label: 'Balanced', desc: 'Good quality, reasonable speed' },
        { id: 'high', label: 'High', desc: 'Best quality, slower processing' }
    ];
    
    const current = getAudioStretchingQuality();
    const qualityBtns = [];
    
    qualities.forEach(q => {
        const btn = document.createElement('button');
        btn.textContent = q.label;
        btn.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px 14px;
            margin-bottom: 8px;
            background: ${q.id === current ? '#4a4a8a' : '#2a2a4a'};
            border: 1px solid ${q.id === current ? '#6a6aaa' : '#3a3a6a'};
            border-radius: 6px;
            color: #fff;
            font-size: 13px;
            cursor: pointer;
            text-align: left;
            transition: background 0.15s;
        `;
        
        const desc = document.createElement('div');
        desc.textContent = q.desc;
        desc.style.cssText = 'font-size: 11px; color: #888; margin-top: 2px;';
        btn.appendChild(desc);
        
        btn.addEventListener('mouseenter', () => {
            if (q.id !== current) btn.style.background = '#3a3a5a';
        });
        btn.addEventListener('mouseleave', () => {
            if (q.id !== current) btn.style.background = '#2a2a4a';
        });
        
        btn.addEventListener('click', () => {
            setAudioStretchingQuality(q.id);
            if (typeof showSafeNotification === 'function') {
                showSafeNotification(`Stretch quality: ${q.label}`, 1500);
            }
            btn.style.background = '#4a4a8a';
            btn.style.borderColor = '#6a6aaa';
            qualityBtns.forEach(other => {
                if (other !== btn) {
                    other.style.background = '#2a2a4a';
                    other.style.borderColor = '#3a3a6a';
                }
            });
        });
        
        panel.appendChild(btn);
        qualityBtns.push(btn);
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 10px;
        background: none;
        border: none;
        color: #888;
        font-size: 16px;
        cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => {
        panel.remove();
        panelInstance = null;
    });
    panel.appendChild(closeBtn);
    
    panelInstance = panel;
    document.body.appendChild(panel);
}

export function closeAudioStretchQualityPanel() {
    if (panelInstance) {
        panelInstance.remove();
        panelInstance = null;
    }
}