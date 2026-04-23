// js/PhaseScope.js - Real-time phase correlation display
// Shows phase relationship between left and right channels

export class PhaseScope {
    constructor(canvasElement, audioContext, sourceNode) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.audioContext = audioContext;
        this.sourceNode = sourceNode;
        this.analyserL = audioContext.createAnalyser();
        this.analyserR = audioContext.createAnalyser();
        this.splitter = audioContext.createChannelSplitter(2);
        this.isActive = false;
        this.dataArrayL = null;
        this.dataArrayR = null;
        
        this.analyserL.fftSize = 2048;
        this.analyserR.fftSize = 2048;
        
        this.connect();
    }
    
    connect() {
        if (this.sourceNode) {
            this.sourceNode.connect(this.splitter);
            this.splitter.connect(this.analyserL, 0);
            this.splitter.connect(this.analyserR, 1);
            this.dataArrayL = new Uint8Array(this.analyserL.frequencyBinCount);
            this.dataArrayR = new Uint8Array(this.analyserR.frequencyBinCount);
        }
    }
    
    disconnect() {
        if (this.sourceNode) {
            try {
                this.sourceNode.disconnect(this.splitter);
                this.splitter.disconnect(this.analyserL);
                this.splitter.disconnect(this.analyserR);
            } catch(e) {}
        }
    }
    
    toggle() {
        this.isActive = !this.isActive;
        return this.isActive;
    }
    
    draw() {
        if (!this.isActive) {
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#666';
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Phase Scope - Click to activate', this.canvas.width/2, this.canvas.height/2);
            return;
        }
        
        this.analyserL.getByteTimeDomainData(this.dataArrayL);
        this.analyserR.getByteTimeDomainData(this.dataArrayR);
        
        // Clear
        this.ctx.fillStyle = '#0a0a12';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const w = this.canvas.width;
        const h = this.canvas.height;
        const centerY = h / 2;
        
        // Draw grid
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(w, centerY);
        this.ctx.stroke();
        
        // Calculate phase correlation
        let correlation = 0;
        let sum = 0;
        for (let i = 0; i < this.dataArrayL.length; i++) {
            const l = (this.dataArrayL[i] - 128) / 128;
            const r = (this.dataArrayR[i] - 128) / 128;
            sum += l * r;
            correlation = sum / (i + 1);
        }
        
        // Draw waveforms
        this.ctx.lineWidth = 1.5;
        
        // Left channel - cyan
        this.ctx.strokeStyle = '#00d4ff';
        this.ctx.beginPath();
        const sliceWidth = w / this.dataArrayL.length;
        let x = 0;
        for (let i = 0; i < this.dataArrayL.length; i++) {
            const v = (this.dataArrayL[i] - 128) / 128;
            const y = centerY + v * (h * 0.4);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
            x += sliceWidth;
        }
        this.ctx.stroke();
        
        // Right channel - magenta
        this.ctx.strokeStyle = '#ff00aa';
        this.ctx.beginPath();
        x = 0;
        for (let i = 0; i < this.dataArrayR.length; i++) {
            const v = (this.dataArrayR[i] - 128) / 128;
            const y = centerY + v * (h * 0.4);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
            x += sliceWidth;
        }
        this.ctx.stroke();
        
        // Display correlation value
        const corrText = correlation.toFixed(3);
        const corrColor = correlation > 0.9 ? '#00ff88' : correlation > 0.5 ? '#ffaa00' : '#ff4444';
        
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(w - 90, 8, 82, 24);
        this.ctx.fillStyle = corrColor;
        this.ctx.font = 'bold 14px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`ϕ ${corrText}`, w - 12, 26);
        
        // Correlation label
        this.ctx.fillStyle = '#888';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Phase Correlation', 10, 16);
        
        // Mono/Stereo indicator
        const statusText = correlation > 0.95 ? 'MONO' : correlation < 0.3 ? 'ANTI-PHASE' : 'STEREO';
        const statusColor = correlation > 0.95 ? '#ffaa00' : correlation < 0.3 ? '#ff4444' : '#00ff88';
        this.ctx.fillStyle = statusColor;
        this.ctx.font = 'bold 11px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(statusText, w - 12, h - 10);
    }
}

export function openPhaseScopePanel() {
    if (window相位ScopePanel) {
        window相位ScopePanel.focus();
        return;
    }
    
    const panel = window相位ScopePanel = window.open('', 'PhaseScope', 'width=600,height=300,resizable=yes');
    panel.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Phase Scope</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #0a0a12; color: #eee; font-family: monospace; padding: 10px; }
            h2 { font-size: 14px; margin-bottom: 8px; color: #888; }
            canvas { width: 100%; height: 200px; background: #0a0a12; border: 1px solid #333; }
            .info { font-size: 11px; color: #666; margin-top: 8px; }
            .legend { display: flex; gap: 20px; margin-top: 8px; }
            .legend span { font-size: 11px; }
            .cyan { color: #00d4ff; }
            .magenta { color: #ff00aa; }
        </style>
    </head>
    <body>
        <h2>ⓟ Phase Scope</h2>
        <canvas id="scope" width="560" height="200"></canvas>
        <div class="legend">
            <span class="cyan">■ Left</span>
            <span class="magenta">■ Right</span>
        </div>
        <div class="info">Phase correlation: 1.0 = perfectly in phase, 0 = uncorrelated, -1 = anti-phase</div>
    </body>
    </html>
    `);
    panel.document.close();
}