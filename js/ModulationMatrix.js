/**
 * ModulationMatrix - Complex modulation routing between parameters
 * Allows multiple sources to modulate multiple targets with configurable amounts and curves
 */

export class ModulationMatrix {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Modulation sources
        this._sources = new Map();
        this._targets = new Map();
        this._connections = new Map();
        this._connectionIdCounter = 0;
        
        // Built-in LFO sources
        this._lfos = [];
        this._createDefaultLFOs();
        
        // Dry/wet for processed signal
        this._dryGain = audioContext.createGain();
        this._wetGain = audioContext.createGain();
        this._dryGain.gain.value = 1;
        this._wetGain.gain.value = 0;
        
        // Connect input to dry path (passthrough)
        this.input.connect(this._dryGain);
        this._dryGain.connect(this.output);
        
        // Track modulation value for display
        this._modulationValue = 0;
        this._depth = options.depth ?? 1.0;
    }
    
    // Create built-in LFO oscillators
    _createDefaultLFOs() {
        const lfoConfigs = [
            { id: 'lfo1', name: 'LFO 1', shape: 'sine', rate: 1, amount: 0 },
            { id: 'lfo2', name: 'LFO 2', shape: 'sine', rate: 2, amount: 0 },
            { id: 'lfo3', name: 'LFO 3', shape: 'sine', rate: 4, amount: 0 },
            { id: 'lfo4', name: 'LFO 4', shape: 'sine', rate: 0.5, amount: 0 }
        ];
        
        for (const config of lfoConfigs) {
            const lfo = {
                ...config,
                oscillator: this.audioContext.createOscillator(),
                gainNode: this.audioContext.createGain(),
                amountNode: this.audioContext.createGain()
            };
            
            lfo.oscillator.type = config.shape;
            lfo.oscillator.frequency.value = config.rate;
            lfo.gainNode.gain.value = config.amount;
            lfo.amountNode.gain.value = 1;
            
            lfo.oscillator.connect(lfo.gainNode);
            lfo.gainNode.connect(lfo.amountNode);
            lfo.oscillator.start();
            
            this._lfos.push(lfo);
            this._sources.set(config.id, {
                id: config.id,
                name: config.name,
                type: 'lfo',
                node: lfo.amountNode,
                value: 0,
                min: -1,
                max: 1
            });
        }
        
        // Add envelope follower as source
        this._envelopeFollower = this.audioContext.createAnalyser();
        this._envelopeFollower.fftSize = 256;
        this._envGain = this.audioContext.createGain();
        
        const envScriptProcessor = this.audioContext.createScriptProcessor(256, 1, 1);
        envScriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += Math.abs(inputData[i]);
            }
            const avg = sum / inputData.length;
            this._envGain.gain.setTargetAtTime(avg * 10, this.audioContext.currentTime, 0.05);
        };
        
        this.input.connect(envScriptProcessor);
        envScriptProcessor.connect(this._envelopeFollower);
        envScriptProcessor.connect(this._envGain);
        
        this._sources.set('envelope', {
            id: 'envelope',
            name: 'Envelope',
            type: 'envelope',
            node: this._envGain,
            value: 0,
            min: 0,
            max: 1
        });
    }
    
    // Add custom modulation source
    addSource(id, name, node, min = 0, max = 1) {
        this._sources.set(id, { id, name, type: 'custom', node, value: 0, min, max });
    }
    
    // Add target parameter
    addTarget(id, name, paramObject, paramName, min = 0, max = 1) {
        this._targets.set(id, { id, name, type: 'parameter', paramObject, paramName, min, max, currentValue: 0 });
    }
    
    // Connect source to target
    connect(sourceId, targetId, amount = 1, curve = 'linear', polarity = 'bipolar') {
        const source = this._sources.get(sourceId);
        const target = this._targets.get(targetId);
        
        if (!source || !target) {
            console.warn('[ModulationMatrix] Source or target not found:', sourceId, targetId);
            return null;
        }
        
        const connectionId = `conn_${this._connectionIdCounter++}`;
        
        // Create modulation gain node
        const modGain = this.audioContext.createGain();
        modGain.gain.value = amount;
        
        // Create curve processor if needed
        let curveNode = modGain;
        if (curve !== 'linear') {
            const curveProcessor = this._createCurveProcessor(curve);
            source.node.connect(modGain);
            modGain.connect(curveProcessor);
            curveNode = curveProcessor;
        } else {
            source.node.connect(modGain);
        }
        
        // Connect to target parameter
        if (target.paramObject && typeof target.paramObject[target.paramName] !== 'undefined') {
            // For AudioParams, use setTargetAtTime for smooth modulation
            if (target.paramObject[target.paramName] instanceof AudioParam) {
                modGain.connect(target.paramObject[target.paramName]);
            } else {
                // For regular objects, use a Gain node to scale the output
                const targetGain = this.audioContext.createGain();
                modGain.connect(targetGain);
                
                // Store reference to update in process loop
                target.modGainNode = targetGain;
                target.baseValue = target.paramObject[target.paramName];
            }
        }
        
        this._connections.set(connectionId, {
            id: connectionId,
            sourceId,
            targetId,
            amount,
            curve,
            polarity,
            modGain,
            active: true
        });
        
        return connectionId;
    }
    
    // Create curve processor for non-linear modulation
    _createCurveProcessor(curve) {
        const processor = this.audioContext.createWaveShaper();
        
        switch (curve) {
            case 'exponential':
                processor.curve = this._makeCurve(512, x => Math.pow(Math.max(x, 0.001), 2));
                break;
            case 'sqrt':
                processor.curve = this._makeCurve(512, x => Math.sqrt(Math.max(x, 0)));
                break;
            case 'square':
                processor.curve = this._makeCurve(512, x => Math.pow(x, 3));
                break;
            case 'scurve':
                processor.curve = this._makeCurve(512, x => (3 * x * x) - (2 * x * x * x));
                break;
            default:
                processor.curve = null;
        }
        
        return processor;
    }
    
    _makeCurve(samples, fn) {
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = fn(Math.abs(x)) * Math.sign(x);
        }
        return curve;
    }
    
    // Update connection amount
    setConnectionAmount(connectionId, amount) {
        const conn = this._connections.get(connectionId);
        if (conn) {
            conn.amount = amount;
            conn.modGain.gain.setValueAtTime(amount, this.audioContext.currentTime);
        }
    }
    
    // Remove connection
    disconnect(connectionId) {
        const conn = this._connections.get(connectionId);
        if (conn) {
            conn.active = false;
            conn.modGain.disconnect();
            this._connections.delete(connectionId);
        }
    }
    
    // Update all LFO parameters
    setLFO(lfoId, params) {
        const lfo = this._lfos.find(l => l.id === lfoId);
        if (lfo) {
            if (params.shape !== undefined) {
                lfo.oscillator.type = params.shape;
            }
            if (params.rate !== undefined) {
                lfo.oscillator.frequency.setValueAtTime(params.rate, this.audioContext.currentTime);
            }
            if (params.amount !== undefined) {
                lfo.gainNode.gain.setValueAtTime(params.amount, this.audioContext.currentTime);
            }
            Object.assign(lfo, params);
        }
    }
    
    // Get all connections for UI
    getConnections() {
        const connections = [];
        for (const [id, conn] of this._connections) {
            const source = this._sources.get(conn.sourceId);
            const target = this._targets.get(conn.targetId);
            connections.push({
                id: conn.id,
                sourceName: source?.name || conn.sourceId,
                targetName: target?.name || conn.targetId,
                amount: conn.amount,
                curve: conn.curve,
                polarity: conn.polarity,
                active: conn.active
            });
        }
        return connections;
    }
    
    // Get available sources and targets
    getSources() {
        const sources = [];
        for (const [id, src] of this._sources) {
            sources.push({ id: src.id, name: src.name, type: src.type });
        }
        return sources;
    }
    
    getTargets() {
        const targets = [];
        for (const [id, tgt] of this._targets) {
            targets.push({ id: tgt.id, name: tgt.name });
        }
        return targets;
    }
    
    // Set depth
    setDepth(depth) {
        this._depth = Math.max(0, Math.min(2, depth));
    }
    
    // Process: update target parameters
    process() {
        // This is called from the animation frame
        // Update all active connections
        for (const [id, conn] of this._connections) {
            if (!conn.active) continue;
            
            const target = this._targets.get(conn.targetId);
            if (!target || !target.modGainNode) continue;
            
            // Read modulation value
            const inputData = target.modGainNode;
            
            // Apply to target parameter
            if (target.baseValue !== undefined) {
                const modValue = conn.amount * this._depth;
                target.paramObject[target.paramName] = target.baseValue + modValue * (conn.polarity === 'unipolar' ? 0.5 : 1);
            }
        }
    }
    
    // Get current modulation value for visualization
    getModulationValue() {
        return this._modulationValue;
    }
    
    dispose() {
        // Stop LFOs
        for (const lfo of this._lfos) {
            lfo.oscillator.stop();
            lfo.oscillator.disconnect();
            lfo.gainNode.disconnect();
        }
        
        // Disconnect all connections
        for (const [id, conn] of this._connections) {
            conn.modGain.disconnect();
        }
        
        this._sources.clear();
        this._targets.clear();
        this._connections.clear();
        this.input.disconnect();
        this.output.disconnect();
    }
}

// Modulation Matrix UI and panel
export function openModulationMatrixPanel(savedState = null) {
    const windowId = 'modulationMatrix';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'modulationMatrixContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';
    
    const options = { width: 700, height: 500, minWidth: 500, minHeight: 350, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }
    
    const win = localAppServices.createWindow(windowId, 'Modulation Matrix', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderModulationMatrixContent(), 50);
    }
    return win;
}

function renderModulationMatrixContent() {
    const container = document.getElementById('modulationMatrixContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-300">Modulation Routing</h3>
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-400">Depth:</label>
                <input type="range" id="matrixDepth" min="0" max="2" step="0.01" value="1" class="w-20">
                <span id="matrixDepthValue" class="text-xs text-gray-300 w-8">1.00</span>
            </div>
        </div>
        
        <div class="flex gap-3 flex-1 overflow-hidden">
            <!-- Sources Panel -->
            <div class="w-1/3 bg-gray-800 rounded border border-gray-700 p-2 overflow-y-auto">
                <h4 class="text-xs font-semibold text-gray-400 mb-2">Sources</h4>
                <div id="matrixSources" class="space-y-1"></div>
            </div>
            
            <!-- Matrix Grid -->
            <div class="flex-1 bg-gray-800 rounded border border-gray-700 p-2 overflow-y-auto">
                <h4 class="text-xs font-semibold text-gray-400 mb-2">Connections</h4>
                <div id="matrixConnections" class="space-y-1"></div>
                
                <button id="addConnectionBtn" class="mt-2 w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                    + Add Connection
                </button>
            </div>
            
            <!-- Targets Panel -->
            <div class="w-1/3 bg-gray-800 rounded border border-gray-700 p-2 overflow-y-auto">
                <h4 class="text-xs font-semibold text-gray-400 mb-2">Targets</h4>
                <div id="matrixTargets" class="space-y-1"></div>
            </div>
        </div>
        
        <div class="mt-2 text-xs text-gray-500">
            Tip: Drag from sources to targets to create modulation routing. Double-click connections to edit amount.
        </div>
    `;
    
    setupModulationMatrixInteraction();
}

function setupModulationMatrixInteraction() {
    const depthSlider = document.getElementById('matrixDepth');
    const depthValue = document.getElementById('matrixDepthValue');
    
    if (depthSlider) {
        depthSlider.addEventListener('input', () => {
            depthValue.textContent = parseFloat(depthSlider.value).toFixed(2);
            // Would update matrix depth here
        });
    }
}

// Register on Tone namespace
if (typeof Tone !== 'undefined') {
    Tone.ModulationMatrix = ModulationMatrix;
}