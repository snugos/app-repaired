// SnugOS DAW - Playback Rate Shifter
// Adjust playback speed without changing pitch

window.PlaybackRateShifter = {
    rate: 1.0,
    minRate: 0.25,
    maxRate: 2.0,
    
    setRate(newRate) {
        this.rate = Math.max(this.minRate, Math.min(this.maxRate, newRate));
        this.applyRate();
        return this.rate;
    },
    
    applyRate() {
        if (window.Tone && Tone.getTransport) {
            Tone.getTransport().playbackRate = this.rate;
        }
    },
    
    getRate() {
        return this.rate;
    },
    
    reset() {
        this.setRate(1.0);
    },
    
    openPanel() {
        let panel = document.getElementById('playbackRatePanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            return;
        }
        
        panel = document.createElement('div');
        panel.id = 'playbackRatePanel';
        panel.style.cssText = 'position:fixed;bottom:80px;right:20px;background:#1a1a2e;border:1px solid #0f0f23;border-radius:8px;padding:16px;z-index:10000;color:#e0e0e0;font-family:system-ui;font-size:13px;min-width:200px;';
        
        panel.innerHTML = `
            <div style="font-weight:600;margin-bottom:12px;color:#a0a0c0;">Playback Rate</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                <button id="pbrMinus" style="width:28px;height:28px;border:none;border-radius:4px;background:#2a2a4a;color:#e0e0e0;cursor:pointer;font-size:16px;">−</button>
                <span id="pbrValue" style="min-width:50px;text-align:center;font-size:18px;font-weight:600;color:#4fc3f7;">1.00x</span>
                <button id="pbrPlus" style="width:28px;height:28px;border:none;border-radius:4px;background:#2a2a4a;color:#e0e0e0;cursor:pointer;font-size:16px;">+</button>
            </div>
            <input type="range" id="pbrSlider" min="25" max="200" value="100" style="width:100%;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;">
                <button id="pbrHalf" style="padding:4px 8px;border:none;border-radius:4px;background:#2a2a4a;color:#e0e0e0;cursor:pointer;font-size:11px;">0.5x</button>
                <button id="pbrNormal" style="padding:4px 8px;border:none;border-radius:4px;background:#1e5a8a;color:#e0e0e0;cursor:pointer;font-size:11px;">1x</button>
                <button id="pbrDouble" style="padding:4px 8px;border:none;border-radius:4px;background:#2a2a4a;color:#e0e0e0;cursor:pointer;font-size:11px;">2x</button>
            </div>
            <button id="pbrClose" style="margin-top:10px;width:100%;padding:6px;border:none;border-radius:4px;background:#3a3a5a;color:#a0a0c0;cursor:pointer;font-size:11px;">Close</button>
        `;
        
        document.body.appendChild(panel);
        
        panel.querySelector('#pbrMinus').onclick = () => this.setRate(this.rate - 0.05);
        panel.querySelector('#pbrPlus').onclick = () => this.setRate(this.rate + 0.05);
        panel.querySelector('#pbrSlider').oninput = (e) => this.setRate(e.target.value / 100);
        panel.querySelector('#pbrHalf').onclick = () => this.setRate(0.5);
        panel.querySelector('#pbrNormal').onclick = () => this.setRate(1.0);
        panel.querySelector('#pbrDouble').onclick = () => this.setRate(2.0);
        panel.querySelector('#pbrClose').onclick = () => panel.style.display = 'none';
        
        this.updateDisplay();
    },
    
    updateDisplay() {
        const valueEl = document.getElementById('pbrValue');
        const sliderEl = document.getElementById('pbrSlider');
        if (valueEl) valueEl.textContent = this.rate.toFixed(2) + 'x';
        if (sliderEl) sliderEl.value = this.rate * 100;
    }
};

if (typeof window !== 'undefined') {
    window.PlaybackRateShifter = window.PlaybackRateShifter;
}