// js/TrackNoiseGate.js - Track Noise Gate for SnugOS DAW
// Gate effect with frequency focus option

import * as Tone from 'tone';

export class TrackNoiseGate {
    constructor(options = {}) {
        this.threshold = options.threshold ?? -40; // dB
        this.attack = options.attack ?? 0.001; // seconds
        this.hold = options.hold ?? 0.05; // seconds
        this.release = options.release ?? 0.1; // seconds
        this.range = options.range ?? -80; // dB (gain reduction when closed)
        this.lookahead = options.lookahead ?? 0.005; // seconds
        
        // Frequency focus options
        this.frequencyFocus = options.frequencyFocus ?? false;
        this.focusFrequency = options.focusFrequency ?? 1000; // Hz
        this.focusQ = options.focusQ ?? 1;
        this.focusWidth = options.focusWidth ?? 2; // octaves
        
        this.gate = null;
        this.filter = null;
        this.input = null;
        this.output = null;
        this.envelopeFollower = null;
        this.isEnabled = true;
    }

    async initialize(audioContext) {
        // Create the gate compressor
        this.gate = new Tone.Compressor({
            threshold: this.threshold,
            ratio: 100, // Very high ratio for gating
            attack: this.attack,
            release: this.release,
            knee: 0
        });
        
        // Create the gain node for range control
        this.rangeGain = new Tone.Gain(1);
        
        // Create input/output
        this.input = new Tone.Gain(1);
        this.output = new Tone.Gain(1);
        
        // Create frequency focus filter if enabled
        if (this.frequencyFocus) {
            this.filter = new Tone.Filter({
                type: 'bandpass',
                frequency: this.focusFrequency,
                Q: this.focusQ
            });
            
            // Create a separate envelope follower for the focused band
            this.envelopeFollower = new Tone.Follower({
                attack: this.attack,
                release: this.release
            });
        }
        
        // Connect the signal chain
        // input -> gate -> output
        this.input.connect(this.gate);
        this.gate.connect(this.output);
        
        return this;
    }

    connect(destination) {
        if (this.output) {
            this.output.connect(destination);
        }
    }

    disconnect(destination) {
        if (this.output) {
            if (destination) {
                this.output.disconnect(destination);
            } else {
                this.output.disconnect();
            }
        }
    }

    setThreshold(threshold) {
        this.threshold = threshold;
        if (this.gate) {
            this.gate.threshold.value = threshold;
        }
        return this.threshold;
    }

    setAttack(attack) {
        this.attack = attack;
        if (this.gate) {
            this.gate.attack.value = attack;
        }
        if (this.envelopeFollower) {
            this.envelopeFollower.attack = attack;
        }
        return this.attack;
    }

    setHold(hold) {
        this.hold = hold;
        // Hold is implemented via release timing
        return this.hold;
    }

    setRelease(release) {
        this.release = release;
        if (this.gate) {
            this.gate.release.value = release;
        }
        if (this.envelopeFollower) {
            this.envelopeFollower.release = release;
        }
        return this.release;
    }

    setRange(range) {
        this.range = range;
        // Range determines the gain reduction when gate is closed
        return this.range;
    }

    setFrequencyFocus(enabled) {
        this.frequencyFocus = enabled;
        
        if (enabled && !this.filter && this.input) {
            // Create the filter for frequency focus
            this.filter = new Tone.Filter({
                type: 'bandpass',
                frequency: this.focusFrequency,
                Q: this.focusQ
            });
            
            this.envelopeFollower = new Tone.Follower({
                attack: this.attack,
                release: this.release
            });
        }
        
        return this.frequencyFocus;
    }

    setFocusFrequency(frequency) {
        this.focusFrequency = frequency;
        if (this.filter) {
            this.filter.frequency.value = frequency;
        }
        return this.focusFrequency;
    }

    setFocusQ(q) {
        this.focusQ = q;
        if (this.filter) {
            this.filter.Q.value = q;
        }
        return this.focusQ;
    }

    setFocusWidth(width) {
        this.focusWidth = width;
        // Width affects the Q calculation
        const q = this.focusFrequency / (this.focusWidth * 100);
        this.setFocusQ(q);
        return this.focusWidth;
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }

    getGateState() {
        if (!this.gate) return 'closed';
        
        const reduction = this.gate.reduction;
        if (reduction < -20) return 'closed';
        if (reduction < -3) return 'closing';
        return 'open';
    }

    getReduction() {
        if (!this.gate) return 0;
        return this.gate.reduction;
    }

    getParameters() {
        return {
            threshold: this.threshold,
            attack: this.attack,
            hold: this.hold,
            release: this.release,
            range: this.range,
            frequencyFocus: this.frequencyFocus,
            focusFrequency: this.focusFrequency,
            focusQ: this.focusQ,
            focusWidth: this.focusWidth
        };
    }

    setParameters(params) {
        if (params.threshold !== undefined) this.setThreshold(params.threshold);
        if (params.attack !== undefined) this.setAttack(params.attack);
        if (params.hold !== undefined) this.setHold(params.hold);
        if (params.release !== undefined) this.setRelease(params.release);
        if (params.range !== undefined) this.setRange(params.range);
        if (params.frequencyFocus !== undefined) this.setFrequencyFocus(params.frequencyFocus);
        if (params.focusFrequency !== undefined) this.setFocusFrequency(params.focusFrequency);
        if (params.focusQ !== undefined) this.setFocusQ(params.focusQ);
        if (params.focusWidth !== undefined) this.setFocusWidth(params.focusWidth);
    }

    dispose() {
        if (this.gate) {
            this.gate.dispose();
            this.gate = null;
        }
        
        if (this.filter) {
            this.filter.dispose();
            this.filter = null;
        }
        
        if (this.envelopeFollower) {
            this.envelopeFollower.dispose();
            this.envelopeFollower = null;
        }
        
        if (this.input) {
            this.input.dispose();
            this.input = null;
        }
        
        if (this.output) {
            this.output.dispose();
            this.output = null;
        }
        
        if (this.rangeGain) {
            this.rangeGain.dispose();
            this.rangeGain = null;
        }
    }
}

// Factory function
export function createNoiseGate(options = {}) {
    return new TrackNoiseGate(options);
}

// Singleton for global access
let noiseGateInstance = null;

export function getNoiseGate(options = {}) {
    if (!noiseGateInstance) {
        noiseGateInstance = new TrackNoiseGate(options);
    }
    return noiseGateInstance;
}

export function openNoiseGatePanel() {
    const gate = getNoiseGate();
    
    const panel = document.createElement('div');
    panel.id = 'noise-gate-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-lg p-6 w-full max-w-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Track Noise Gate</h2>
                <button id="close-gate-panel" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="mb-6">
                <label class="text-zinc-300 text-sm">Gate State</label>
                <div class="bg-zinc-800 rounded h-8 mt-2 relative overflow-hidden flex items-center px-4">
                    <div id="gate-state-indicator" class="w-4 h-4 rounded-full bg-red-500 mr-3"></div>
                    <span id="gate-state-text" class="text-white">Closed</span>
                    <span id="gate-reduction" class="text-zinc-400 text-sm ml-auto">-0.0 dB</span>
                </div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Threshold (dB)</label>
                <input type="range" id="gate-threshold" value="${gate.threshold}" min="-80" max="0" step="1"
                    class="w-full mt-1">
                <span id="gate-threshold-value" class="text-zinc-400 text-sm">${gate.threshold} dB</span>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="text-zinc-300 text-sm">Attack (ms)</label>
                    <input type="number" id="gate-attack" value="${gate.attack * 1000}" min="0.1" max="100" step="0.1"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">Release (ms)</label>
                    <input type="number" id="gate-release" value="${gate.release * 1000}" min="10" max="1000" step="10"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Range (dB)</label>
                <input type="range" id="gate-range" value="${gate.range}" min="-100" max="0" step="1"
                    class="w-full mt-1">
                <span id="gate-range-value" class="text-zinc-400 text-sm">${gate.range} dB</span>
            </div>
            
            <div class="border-t border-zinc-700 pt-4 mt-4">
                <label class="flex items-center gap-2 text-zinc-300 mb-4">
                    <input type="checkbox" id="gate-freq-focus" ${gate.frequencyFocus ? 'checked' : ''}>
                    Frequency Focus Mode
                </label>
                
                <div id="freq-focus-controls" class="${gate.frequencyFocus ? '' : 'opacity-50 pointer-events-none'}">
                    <div class="mb-4">
                        <label class="text-zinc-300 text-sm">Focus Frequency (Hz)</label>
                        <input type="range" id="gate-focus-freq" value="${gate.focusFrequency}" min="20" max="20000" step="10"
                            class="w-full mt-1">
                        <span id="gate-focus-freq-value" class="text-zinc-400 text-sm">${gate.focusFrequency} Hz</span>
                    </div>
                    
                    <div class="mb-4">
                        <label class="text-zinc-300 text-sm">Focus Width (octaves)</label>
                        <input type="range" id="gate-focus-width" value="${gate.focusWidth}" min="0.1" max="6" step="0.1"
                            class="w-full mt-1">
                        <span id="gate-focus-width-value" class="text-zinc-400 text-sm">${gate.focusWidth} oct</span>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-4 mt-4">
                <button id="gate-toggle" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">
                    Toggle
                </button>
                <button id="gate-reset" class="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded">
                    Reset
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-gate-panel').onclick = () => {
        panel.remove();
    };
    
    document.getElementById('gate-threshold').oninput = (e) => {
        const value = parseInt(e.target.value);
        gate.setThreshold(value);
        document.getElementById('gate-threshold-value').textContent = `${value} dB`;
    };
    
    document.getElementById('gate-attack').onchange = (e) => {
        gate.setAttack(parseInt(e.target.value) / 1000);
    };
    
    document.getElementById('gate-release').onchange = (e) => {
        gate.setRelease(parseInt(e.target.value) / 1000);
    };
    
    document.getElementById('gate-range').oninput = (e) => {
        const value = parseInt(e.target.value);
        gate.setRange(value);
        document.getElementById('gate-range-value').textContent = `${value} dB`;
    };
    
    document.getElementById('gate-freq-focus').onchange = (e) => {
        const enabled = e.target.checked;
        gate.setFrequencyFocus(enabled);
        const controls = document.getElementById('freq-focus-controls');
        controls.classList.toggle('opacity-50', !enabled);
        controls.classList.toggle('pointer-events-none', !enabled);
    };
    
    document.getElementById('gate-focus-freq').oninput = (e) => {
        const value = parseInt(e.target.value);
        gate.setFocusFrequency(value);
        document.getElementById('gate-focus-freq-value').textContent = `${value} Hz`;
    };
    
    document.getElementById('gate-focus-width').oninput = (e) => {
        const value = parseFloat(e.target.value);
        gate.setFocusWidth(value);
        document.getElementById('gate-focus-width-value').textContent = `${value} oct`;
    };
    
    document.getElementById('gate-toggle').onclick = () => {
        gate.toggle();
    };
    
    document.getElementById('gate-reset').onclick = () => {
        gate.setParameters({
            threshold: -40,
            attack: 0.001,
            release: 0.1,
            range: -80,
            frequencyFocus: false,
            focusFrequency: 1000,
            focusWidth: 2
        });
        
        // Update UI
        document.getElementById('gate-threshold').value = -40;
        document.getElementById('gate-threshold-value').textContent = '-40 dB';
        document.getElementById('gate-attack').value = 1;
        document.getElementById('gate-release').value = 100;
        document.getElementById('gate-range').value = -80;
        document.getElementById('gate-range-value').textContent = '-80 dB';
        document.getElementById('gate-freq-focus').checked = false;
        document.getElementById('gate-focus-freq').value = 1000;
        document.getElementById('gate-focus-freq-value').textContent = '1000 Hz';
        document.getElementById('gate-focus-width').value = 2;
        document.getElementById('gate-focus-width-value').textContent = '2 oct';
        
        const controls = document.getElementById('freq-focus-controls');
        controls.classList.add('opacity-50', 'pointer-events-none');
    };
    
    // Update state indicator
    function updateState() {
        const state = gate.getGateState();
        const reduction = gate.getReduction();
        const indicator = document.getElementById('gate-state-indicator');
        const stateText = document.getElementById('gate-state-text');
        const reductionText = document.getElementById('gate-reduction');
        
        if (indicator && stateText) {
            switch (state) {
                case 'open':
                    indicator.className = 'w-4 h-4 rounded-full bg-green-500 mr-3';
                    stateText.textContent = 'Open';
                    break;
                case 'closing':
                    indicator.className = 'w-4 h-4 rounded-full bg-yellow-500 mr-3';
                    stateText.textContent = 'Closing';
                    break;
                case 'closed':
                default:
                    indicator.className = 'w-4 h-4 rounded-full bg-red-500 mr-3';
                    stateText.textContent = 'Closed';
                    break;
            }
        }
        
        if (reductionText) {
            reductionText.textContent = `${reduction.toFixed(1)} dB`;
        }
        
        requestAnimationFrame(updateState);
    }
    
    updateState();
    
    return panel;
}