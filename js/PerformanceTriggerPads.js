/**
 * Performance Trigger Pads - Real-time drum pad interface for triggering samples and clips
 * Provides a 4x4 grid of velocity-sensitive trigger pads
 */

class TriggerPad {
    constructor(padIndex, options = {}) {
        this.index = padIndex;
        this.name = options.name || `Pad ${padIndex + 1}`;
        this.color = options.color || '#3b82f6';
        this.sample = options.sample || null;
        this.clip = options.clip || null;
        this.volume = options.volume ?? 1.0;
        this.pitch = options.pitch || 0; // semitones
        this.isLoaded = !!(this.sample || this.clip);
    }
}

class PerformanceTriggerPads {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.pads = [];
        this.isOpen = false;
        this.container = null;
        this.padElements = [];
        this.activePads = new Set();
        this.colors = [
            '#ef4444', '#f97316', '#eab308', '#22c55e',
            '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
            '#14b8a6', '#84cc16', '#a855f7', '#f43f5e',
            '#6366f1', '#d946ef', '#0ea5e9', '#f59e0b'
        ];
        
        this._initPads();
    }
    
    _initPads() {
        for (let i = 0; i < 16; i++) {
            this.pads.push(new TriggerPad(i, { color: this.colors[i] }));
        }
    }
    
    setPadSample(padIndex, sample, name) {
        if (padIndex < 0 || padIndex >= 16) return false;
        this.pads[padIndex].sample = sample;
        this.pads[padIndex].name = name || `Pad ${padIndex + 1}`;
        this.pads[padIndex].isLoaded = true;
        this._updatePadUI(padIndex);
        return true;
    }
    
    setPadClip(padIndex, clip, name) {
        if (padIndex < 0 || padIndex >= 16) return false;
        this.pads[padIndex].clip = clip;
        this.pads[padIndex].name = name || `Clip ${padIndex + 1}`;
        this.pads[padIndex].isLoaded = true;
        this._updatePadUI(padIndex);
        return true;
    }
    
    triggerPad(padIndex, velocity = 1.0) {
        if (padIndex < 0 || padIndex >= 16) return;
        
        const pad = this.pads[padIndex];
        if (!pad.isLoaded) return;
        
        const now = this.audioContext?.currentTime || 0;
        
        if (pad.sample) {
            this._playSample(pad, velocity, now);
        } else if (pad.clip) {
            this._playClip(pad, velocity, now);
        }
        
        this._flashPad(padIndex, velocity);
    }
    
    _playSample(pad, velocity, time) {
        if (!pad.sample || !this.audioContext) return;
        
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = pad.sample;
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = velocity * pad.volume;
            
            const pitchNode = this.audioContext.createPlaybackRate();
            pitchNode.playbackRate.value = Math.pow(2, pad.pitch / 12);
            
            source.connect(pitchNode);
            pitchNode.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            source.start(time);
        } catch (e) {
            console.warn('[PerformanceTriggerPads] Error playing sample:', e);
        }
    }
    
    _playClip(pad, velocity, time) {
        console.log('[PerformanceTriggerPads] Playing clip on pad', pad.index);
    }
    
    _flashPad(padIndex, velocity) {
        const el = this.padElements[padIndex];
        if (!el) return;
        
        el.classList.add('triggered');
        setTimeout(() => el.classList.remove('triggered'), 100);
    }
    
    _updatePadUI(padIndex) {
        const el = this.padElements[padIndex];
        if (!el) return;
        
        const pad = this.pads[padIndex];
        const label = el.querySelector('.pad-label');
        const nameEl = el.querySelector('.pad-name');
        
        if (label) {
            label.textContent = pad.isLoaded ? '' : 'Empty';
        }
        if (nameEl) {
            nameEl.textContent = pad.name;
        }
        
        el.style.opacity = pad.isLoaded ? '1' : '0.4';
    }
    
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'performance-trigger-pads';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a2e;
            border: 1px solid #3a3a5e;
            border-radius: 12px;
            padding: 24px;
            z-index: 10000;
            min-width: 420px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        panel.innerHTML = this._buildPanelHTML();
        this._setupPanelEvents(panel);
        
        return panel;
    }
    
    _buildPanelHTML() {
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 18px; color: #10b981;">Performance Trigger Pads</h2>
                <div style="display: flex; gap: 8px;">
                    <button id="ptp-load-btn" style="padding: 8px 16px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">Load Sample</button>
                    <button id="ptp-close-btn" style="padding: 8px 16px; background: #374151; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">Close</button>
                </div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div id="ptp-pad-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                    ${this._buildPadGrid()}
                </div>
            </div>
            
            <div style="font-size: 11px; color: #666; text-align: center;">
                Click pads to trigger • Drag samples onto pads • Supports 16 velocity-sensitive pads
            </div>
        `;
    }
    
    _buildPadGrid() {
        let html = '';
        for (let i = 0; i < 16; i++) {
            const pad = this.pads[i];
            const row = Math.floor(i / 4);
            const col = i % 4;
            html += `
                <div class="trigger-pad" data-pad="${i}" style="
                    width: 80px;
                    height: 80px;
                    background: ${pad.color}22;
                    border: 2px solid ${pad.color};
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.1s;
                    opacity: ${pad.isLoaded ? '1' : '0.4'};
                ">
                    <div class="pad-number" style="font-size: 20px; font-weight: bold; color: ${pad.color};">${i + 1}</div>
                    <div class="pad-name" style="font-size: 9px; color: #888; margin-top: 4px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pad.name}</div>
                </div>
            `;
        }
        return html;
    }
    
    _setupPanelEvents(panel) {
        this.container = panel;
        
        // Close button
        panel.querySelector('#ptp-close-btn').addEventListener('click', () => {
            panel.remove();
            this.isOpen = false;
        });
        
        // Load sample button
        panel.querySelector('#ptp-load-btn').addEventListener('click', () => {
            this._loadSampleToPad();
        });
        
        // Pad click events
        panel.querySelectorAll('.trigger-pad').forEach((el, idx) => {
            this.padElements[idx] = el;
            
            el.addEventListener('mousedown', (e) => {
                const velocity = e.pressure || 0.8;
                this.triggerPad(idx, velocity);
            });
            
            el.addEventListener('mouseenter', (e) => {
                if (e.buttons === 1) {
                    const velocity = e.pressure || 0.8;
                    this.triggerPad(idx, velocity);
                }
            });
            
            // Right-click to clear pad
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.pads[idx].sample = null;
                this.pads[idx].clip = null;
                this.pads[idx].isLoaded = false;
                this.pads[idx].name = `Pad ${idx + 1}`;
                this._updatePadUI(idx);
            });
        });
        
        // Add CSS for triggered state
        const style = document.createElement('style');
        style.textContent = `
            .trigger-pad.triggered {
                transform: scale(0.95);
                background: rgba(255,255,255,0.2) !important;
            }
            .trigger-pad:hover {
                filter: brightness(1.2);
            }
        `;
        panel.appendChild(style);
    }
    
    async _loadSampleToPad() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                // Find first empty pad or use pad 0
                let targetPad = this.pads.findIndex(p => !p.isLoaded);
                if (targetPad === -1) targetPad = 0;
                
                this.setPadSample(targetPad, audioBuffer, file.name.replace(/\.[^/.]+$/, ''));
                
                console.log('[PerformanceTriggerPads] Loaded sample to pad', targetPad, ':', file.name);
            } catch (err) {
                console.error('[PerformanceTriggerPads] Error loading sample:', err);
            }
        };
        
        input.click();
    }
}

// Export for use in main.js
let triggerPadsInstance = null;

export function getPerformanceTriggerPads(audioContext) {
    if (!triggerPadsInstance) {
        triggerPadsInstance = new PerformanceTriggerPads({ audioContext });
    } else if (audioContext) {
        triggerPadsInstance.audioContext = audioContext;
    }
    return triggerPadsInstance;
}

export function openPerformanceTriggerPadsPanel(audioContext) {
    const pads = getPerformanceTriggerPads(audioContext);
    const panel = pads.createPanel();
    document.body.appendChild(panel);
    pads.isOpen = true;
    return panel;
}