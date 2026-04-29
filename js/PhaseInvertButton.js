// js/PhaseInvertButton.js - Phase Invert Button
// Quick phase flip for track alignment

class PhaseInvertButton {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            inverted: options.inverted ?? false,
            channel: options.channel ?? 'both',
        };
        
        // Create nodes
        this.gainNode = audioContext.createGain();
        this.splitter = audioContext.createChannelSplitter(2);
        this.merger = audioContext.createChannelMerger(2);
        this.leftGain = audioContext.createGain();
        this.rightGain = audioContext.createGain();
        
        // Initial setup
        this._setupRouting();
        this._updatePhase();
    }
    
    _setupRouting() {
        this.gainNode.connect(this.splitter);
        this.splitter.connect(this.leftGain, 0);
        this.splitter.connect(this.rightGain, 1);
        this.leftGain.connect(this.merger, 0, 0);
        this.rightGain.connect(this.merger, 0, 1);
    }
    
    _updatePhase() {
        const leftInverted = this.config.inverted && (this.config.channel === 'both' || this.config.channel === 'left');
        const rightInverted = this.config.inverted && (this.config.channel === 'both' || this.config.channel === 'right');
        this.leftGain.gain.value = leftInverted ? -1 : 1;
        this.rightGain.gain.value = rightInverted ? -1 : 1;
    }
    
    connect(source) { source.connect(this.gainNode); return this.merger; }
    connectTo(destination) { this.merger.connect(destination); return this; }
    disconnect() { this.gainNode.disconnect(); this.splitter.disconnect(); this.leftGain.disconnect(); this.rightGain.disconnect(); this.merger.disconnect(); }
    toggle() { this.config.inverted = !this.config.inverted; this._updatePhase(); return this.config.inverted; }
    setInverted(inverted) { this.config.inverted = inverted; this._updatePhase(); }
    isInverted() { return this.config.inverted; }
    setChannel(channel) { if (['left', 'right', 'both'].includes(channel)) { this.config.channel = channel; this._updatePhase(); } }
    get input() { return this.gainNode; }
    get output() { return this.merger; }
    
    createButton(container) {
        const button = document.createElement('button');
        button.className = 'phase-invert-button';
        button.innerHTML = `<span>Ø</span><span>Phase</span>`;
        button.addEventListener('click', () => {
            this.toggle();
            button.classList.toggle('active', this.config.inverted);
            button.dispatchEvent(new CustomEvent('phasechange', { detail: { inverted: this.config.inverted } }));
        });
        if (this.config.inverted) button.classList.add('active');
        if (container) container.appendChild(button);
        return button;
    }
    
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'phase-invert-panel';
        panel.style.cssText = 'background:#1a1a2e;border-radius:8px;padding:20px;color:#fff;font-family:system-ui;width:340px;';
        panel.innerHTML = `
            <div style="font-size:18px;font-weight:bold;margin-bottom:16px;border-bottom:1px solid #333;padding-bottom:8px;">Phase Invert</div>
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;color:#888;margin-bottom:8px;">Channel</div>
                <div style="display:flex;gap:8px;">
                    <button class="ch-btn ${this.config.channel==='left'?'active':''}" data-ch="left" style="flex:1;padding:10px;background:#0a0a14;border:1px solid #333;border-radius:4px;color:#fff;cursor:pointer;">Left</button>
                    <button class="ch-btn ${this.config.channel==='right'?'active':''}" data-ch="right" style="flex:1;padding:10px;background:#0a0a14;border:1px solid #333;border-radius:4px;color:#fff;cursor:pointer;">Right</button>
                    <button class="ch-btn ${this.config.channel==='both'?'active':''}" data-ch="both" style="flex:1;padding:10px;background:#0a0a14;border:1px solid #333;border-radius:4px;color:#fff;cursor:pointer;">Both</button>
                </div>
            </div>
            <button id="pip-toggle" style="width:100%;padding:16px;background:#0a0a14;border:1px solid #333;border-radius:4px;color:#fff;cursor:pointer;font-size:16px;font-weight:bold;">
                <span style="font-size:24px;">Ø</span> Toggle Phase
            </button>
            <div id="pip-status" style="text-align:center;padding:12px;background:#0a0a14;border-radius:4px;margin-top:12px;">
                <span style="font-size:14px;color:#10b981;">Normal Phase</span>
            </div>
        `;
        
        const updateStatus = (inverted) => {
            const statusEl = panel.querySelector('#pip-status');
            statusEl.innerHTML = inverted 
                ? '<span style="color:#ef4444;">Phase Inverted</span>' 
                : '<span style="color:#10b981;">Normal Phase</span>';
        };
        
        panel.querySelectorAll('.ch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                panel.querySelectorAll('.ch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setChannel(btn.dataset.ch);
            });
        });
        
        panel.querySelector('#pip-toggle').addEventListener('click', () => {
            const inverted = this.toggle();
            updateStatus(inverted);
        });
        
        if (container) container.appendChild(panel);
        this._panel = panel;
        return panel;
    }
}

export function createPhaseInvertButton(audioContext, options = {}) {
    return new PhaseInvertButton(audioContext, options);
}

let phaseInvertPanel = null;
export function openPhaseInvertButtonPanel() {
    if (phaseInvertPanel) { phaseInvertPanel.remove(); phaseInvertPanel = null; return; }
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;';
    document.body.appendChild(panel);
    const button = new PhaseInvertButton(window.Tone?.context || new AudioContext());
    phaseInvertPanel = button.createPanel(panel);
}

window.openPhaseInvertButtonPanel = openPhaseInvertButtonPanel;