// js/EnvelopeFollower.js - Envelope Follower for SnugOS DAW
// Audio-driven envelope for effect modulation

import * as Tone from 'tone';

export class EnvelopeFollower {
    constructor(options = {}) {
        this.attack = options.attack ?? 0.01; // Attack time in seconds
        this.release = options.release ?? 0.1; // Release time in seconds
        this.smoothing = options.smoothing ?? 0.8; // Smoothing factor (0-1)
        this.threshold = options.threshold ?? 0; // Threshold below which output is 0
        this.multiplier = options.multiplier ?? 1; // Output multiplier
        this.offset = options.offset ?? 0; // Output offset
        
        this.analyser = null;
        this.follower = null;
        this.inputNode = null;
        this.outputNode = null;
        this.isProcessing = false;
        this.currentValue = 0;
        this.targetConnections = [];
        this.animationFrame = null;
        
        this.onLevelChange = null;
    }

    initialize(audioContext) {
        if (this.follower) return this;
        
        // Create follower using Tone.js Follower
        this.follower = new Tone.Follower({
            attack: this.attack,
            release: this.release
        });
        
        // Create analyser for visualization
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = this.smoothing;
        
        // Create input and output nodes
        this.inputNode = new Tone.Gain(1);
        this.outputNode = new Tone.Signal(0);
        
        // Connect: input -> follower -> output
        // The follower outputs a signal representing the envelope
        this.inputNode.connect(this.follower);
        this.follower.connect(this.outputNode);
        
        return this;
    }

    connect(target, outputIndex = 0) {
        if (!this.outputNode) {
            console.warn('[EnvelopeFollower] Not initialized');
            return;
        }
        
        this.outputNode.connect(target, outputIndex);
        this.targetConnections.push({ target, outputIndex });
    }

    disconnect(target) {
        if (!this.outputNode) return;
        
        if (target) {
            this.outputNode.disconnect(target);
            this.targetConnections = this.targetConnections.filter(c => c.target !== target);
        } else {
            this.outputNode.disconnect();
            this.targetConnections = [];
        }
    }

    start() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.updateLoop();
    }

    stop() {
        this.isProcessing = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    updateLoop() {
        if (!this.isProcessing) return;
        
        // Get current value from follower
        this.currentValue = this.outputNode.value;
        
        // Apply threshold and multiplier
        let outputValue = this.currentValue;
        if (outputValue < this.threshold) {
            outputValue = 0;
        } else {
            outputValue = (outputValue - this.threshold) * this.multiplier + this.offset;
        }
        
        // Clamp to valid range
        outputValue = Math.max(0, Math.min(1, outputValue));
        
        // Callback for visualization
        if (this.onLevelChange) {
            this.onLevelChange(outputValue, this.currentValue);
        }
        
        this.animationFrame = requestAnimationFrame(() => this.updateLoop());
    }

    setAttack(attack) {
        this.attack = Math.max(0.001, attack);
        if (this.follower) {
            this.follower.attack = this.attack;
        }
        return this.attack;
    }

    setRelease(release) {
        this.release = Math.max(0.01, release);
        if (this.follower) {
            this.follower.release = this.release;
        }
        return this.release;
    }

    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, smoothing));
        if (this.analyser) {
            this.analyser.smoothingTimeConstant = this.smoothing;
        }
        return this.smoothing;
    }

    setThreshold(threshold) {
        this.threshold = Math.max(0, Math.min(1, threshold));
        return this.threshold;
    }

    setMultiplier(multiplier) {
        this.multiplier = multiplier;
        return this.multiplier;
    }

    setOffset(offset) {
        this.offset = offset;
        return this.offset;
    }

    getCurrentValue() {
        return this.currentValue;
    }

    getNormalizedValue() {
        let value = this.currentValue;
        if (value < this.threshold) return 0;
        return Math.max(0, Math.min(1, (value - this.threshold) * this.multiplier + this.offset));
    }

    setInput(input) {
        if (this.inputNode) {
            input.connect(this.inputNode);
        }
    }

    setOnLevelChange(callback) {
        this.onLevelChange = callback;
    }

    // Apply envelope to a parameter
    applyToParameter(parameter, minValue = 0, maxValue = 1) {
        this.connect((value) => {
            // Map the normalized value to the parameter range
            const mappedValue = minValue + value * (maxValue - minValue);
            parameter.setValueAtTime(mappedValue, Tone.now());
        });
    }

    dispose() {
        this.stop();
        
        if (this.follower) {
            this.follower.dispose();
            this.follower = null;
        }
        
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        
        if (this.inputNode) {
            this.inputNode.dispose();
            this.inputNode = null;
        }
        
        if (this.outputNode) {
            this.outputNode.dispose();
            this.outputNode = null;
        }
        
        this.targetConnections = [];
        this.onLevelChange = null;
    }
}

// Envelope Follower Effect Module
export class EnvelopeFollowerEffect {
    constructor(options = {}) {
        this.envelopeFollower = new EnvelopeFollower(options);
        this.targets = []; // Array of { parameter, min, max }
        this.enabled = true;
        this.input = null;
        this.output = null;
    }

    initialize(audioContext) {
        this.envelopeFollower.initialize(audioContext);
        this.input = this.envelopeFollower.inputNode;
        this.output = this.envelopeFollower.inputNode; // Pass-through
        
        // Start the follower
        this.envelopeFollower.start();
        
        return this;
    }

    addTarget(parameter, minValue = 0, maxValue = 1) {
        this.targets.push({ parameter, min: minValue, max: maxValue });
        
        // Set up the connection
        this.envelopeFollower.setOnLevelChange((normalizedValue) => {
            if (!this.enabled) return;
            
            const mappedValue = minValue + normalizedValue * (maxValue - minValue);
            parameter.setValueAtTime(mappedValue, Tone.now());
        });
        
        return this;
    }

    removeTarget(parameter) {
        this.targets = this.targets.filter(t => t.parameter !== parameter);
        return this;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    dispose() {
        this.envelopeFollower.dispose();
        this.targets = [];
    }
}

// Singleton instance for global access
let envelopeFollowerInstance = null;

export function getEnvelopeFollower(options = {}) {
    if (!envelopeFollowerInstance) {
        envelopeFollowerInstance = new EnvelopeFollower(options);
    }
    return envelopeFollowerInstance;
}

export function openEnvelopeFollowerPanel() {
    const follower = getEnvelopeFollower();
    
    const panel = document.createElement('div');
    panel.id = 'envelope-follower-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-lg p-6 w-full max-w-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Envelope Follower</h2>
                <button id="close-envelope-panel" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="mb-6">
                <label class="text-zinc-300 text-sm">Current Level</label>
                <div class="bg-zinc-800 rounded h-8 mt-2 relative overflow-hidden">
                    <div id="envelope-level-bar" class="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 to-green-400 transition-all duration-75" style="width: 0%"></div>
                    <span id="envelope-level-text" class="absolute inset-0 flex items-center justify-center text-white text-sm">0.00</span>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="text-zinc-300 text-sm">Attack (s)</label>
                    <input type="number" id="env-attack" value="${follower.attack}" min="0.001" max="1" step="0.001"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">Release (s)</label>
                    <input type="number" id="env-release" value="${follower.release}" min="0.01" max="2" step="0.01"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="text-zinc-300 text-sm">Threshold</label>
                    <input type="range" id="env-threshold" value="${follower.threshold}" min="0" max="1" step="0.01"
                        class="w-full mt-1">
                    <span id="env-threshold-value" class="text-zinc-400 text-sm">${follower.threshold.toFixed(2)}</span>
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">Multiplier</label>
                    <input type="number" id="env-multiplier" value="${follower.multiplier}" min="0" max="10" step="0.1"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Offset</label>
                <input type="number" id="env-offset" value="${follower.offset}" min="-1" max="1" step="0.1"
                    class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
            </div>
            
            <div class="flex gap-4">
                <button id="env-start" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded">
                    Start
                </button>
                <button id="env-stop" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded">
                    Stop
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-envelope-panel').onclick = () => {
        follower.stop();
        panel.remove();
    };
    
    document.getElementById('env-attack').onchange = (e) => {
        follower.setAttack(parseFloat(e.target.value));
    };
    
    document.getElementById('env-release').onchange = (e) => {
        follower.setRelease(parseFloat(e.target.value));
    };
    
    document.getElementById('env-threshold').oninput = (e) => {
        const value = parseFloat(e.target.value);
        follower.setThreshold(value);
        document.getElementById('env-threshold-value').textContent = value.toFixed(2);
    };
    
    document.getElementById('env-multiplier').onchange = (e) => {
        follower.setMultiplier(parseFloat(e.target.value));
    };
    
    document.getElementById('env-offset').onchange = (e) => {
        follower.setOffset(parseFloat(e.target.value));
    };
    
    document.getElementById('env-start').onclick = () => {
        follower.start();
    };
    
    document.getElementById('env-stop').onclick = () => {
        follower.stop();
    };
    
    // Set up level monitoring
    follower.setOnLevelChange((normalizedValue, rawValue) => {
        const bar = document.getElementById('envelope-level-bar');
        const text = document.getElementById('envelope-level-text');
        
        if (bar && text) {
            bar.style.width = `${normalizedValue * 100}%`;
            text.textContent = normalizedValue.toFixed(2);
        }
    });
    
    return panel;
}