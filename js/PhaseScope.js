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

// --- SnugOS Integrated Phase Scope Panel ---
let phaseScopeWindow = null;

export function openPhaseScopePanel() {
    const windowId = 'phaseScope';
    const openWindows = localAppServices?.getOpenWindows?.() || new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win?.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'phaseScopeContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';
    
    contentContainer.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
                <select id="phaseScopeSource" class="p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                    <option value="master">Master Output</option>
                </select>
                <button id="phaseScopeToggle" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    Start
                </button>
            </div>
            <div id="phaseCorrelationDisplay" class="text-sm font-mono text-green-400">
                φ --.-- 
            </div>
        </div>
        <div id="phaseScopeCanvasContainer" class="flex-1 bg-black rounded border border-gray-700 relative overflow-hidden">
            <canvas id="phaseScopeCanvas" class="w-full h-full"></canvas>
        </div>
        <div class="flex items-center justify-between mt-2 text-xs">
            <div class="flex items-center gap-2">
                <span class="text-cyan-400">■ Left</span>
                <span class="text-pink-400">■ Right</span>
            </div>
            <div id="phaseStatusDisplay" class="font-mono">STEREO</div>
        </div>
        <div class="mt-2 text-xs text-gray-500">
            Phase correlation: 1.0 = perfectly in phase, 0 = uncorrelated, -1 = anti-phase
        </div>
    `;
    
    const options = { 
        width: 550, height: 350, minWidth: 400, minHeight: 280, 
        initialContentKey: windowId, closable: true, minimizable: true, resizable: true 
    };
    
    const win = localAppServices?.createWindow?.(windowId, 'Phase Scope', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => setupPhaseScopeVisualization(), 50);
    }
    
    return win;
}

function setupPhaseScopeVisualization() {
    const canvas = document.getElementById('phaseScopeCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('phaseScopeCanvasContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    let isRunning = false;
    let animationId = null;
    let sourceNode = null;
    let analyserL = null;
    let analyserR = null;
    let splitter = null;
    let dataArrayL = null;
    let dataArrayR = null;
    
    function initAudio() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Get master output node
            if (typeof Tone !== 'undefined' && Tone.getDestination) {
                sourceNode = Tone.getDestination();
            }
            
            // Create analysers
            analyserL = audioCtx.createAnalyser();
            analyserR = audioCtx.createAnalyser();
            analyserL.fftSize = 2048;
            analyserR.fftSize = 2048;
            
            splitter = audioCtx.createChannelSplitter(2);
            
            dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
            dataArrayR = new Uint8Array(analyserR.frequencyBinCount);
            
            return true;
        } catch (e) {
            console.error('[PhaseScope] Audio init error:', e);
            return false;
        }
    }
    
    function draw() {
        if (!isRunning) return;
        
        analyserL?.getByteTimeDomainData(dataArrayL);
        analyserR?.getByteTimeDomainData(dataArrayR);
        
        // Clear
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const w = canvas.width;
        const h = canvas.height;
        const centerY = h / 2;
        
        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(w, centerY);
        ctx.stroke();
        
        // Calculate phase correlation
        let correlation = 0;
        if (dataArrayL && dataArrayR) {
            let sum = 0;
            for (let i = 0; i < dataArrayL.length; i++) {
                const l = (dataArrayL[i] - 128) / 128;
                const r = (dataArrayR[i] - 128) / 128;
                sum += l * r;
            }
            correlation = sum / dataArrayL.length;
        }
        
        // Draw waveforms
        ctx.lineWidth = 1.5;
        
        // Left channel - cyan
        if (dataArrayL) {
            ctx.strokeStyle = '#00d4ff';
            ctx.beginPath();
            const sliceWidth = w / dataArrayL.length;
            let x = 0;
            for (let i = 0; i < dataArrayL.length; i++) {
                const v = (dataArrayL[i] - 128) / 128;
                const y = centerY + v * (h * 0.4);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
        }
        
        // Right channel - magenta
        if (dataArrayR) {
            ctx.strokeStyle = '#ff00aa';
            ctx.beginPath();
            const sliceWidth = w / dataArrayR.length;
            let x = 0;
            for (let i = 0; i < dataArrayR.length; i++) {
                const v = (dataArrayR[i] - 128) / 128;
                const y = centerY + v * (h * 0.4);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
        }
        
        // Update correlation display
        const corrDisplay = document.getElementById('phaseCorrelationDisplay');
        const statusDisplay = document.getElementById('phaseStatusDisplay');
        if (corrDisplay) {
            corrDisplay.textContent = `φ ${correlation.toFixed(3)}`;
            corrDisplay.style.color = correlation > 0.9 ? '#00ff88' : correlation > 0.5 ? '#ffaa00' : '#ff4444';
        }
        if (statusDisplay) {
            const statusText = correlation > 0.95 ? 'MONO' : correlation < 0.3 ? 'ANTI-PHASE' : 'STEREO';
            statusDisplay.textContent = statusText;
            statusDisplay.style.color = correlation > 0.95 ? '#ffaa00' : correlation < 0.3 ? '#ff4444' : '#00ff88';
        }
        
        animationId = requestAnimationFrame(draw);
    }
    
    // Toggle button handler
    const toggleBtn = document.getElementById('phaseScopeToggle');
    toggleBtn?.addEventListener('click', () => {
        if (!isRunning) {
            if (initAudio()) {
                isRunning = true;
                toggleBtn.textContent = 'Stop';
                toggleBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                toggleBtn.classList.add('bg-red-500', 'hover:bg-red-600');
                draw();
            }
        } else {
            isRunning = false;
            if (animationId) cancelAnimationFrame(animationId);
            toggleBtn.textContent = 'Start';
            toggleBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            toggleBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        }
    });
}