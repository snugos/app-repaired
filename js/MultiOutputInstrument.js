// js/MultiOutputInstrument.js - Instruments with multiple outputs (multi-timbral support)

export class MultiOutputInstrument {
    constructor(audioContext, config = {}) {
        this.audioContext = audioContext;
        this.id = config.id || `multiout-${Date.now()}`;
        this.name = config.name || 'Multi-Output Instrument';
        
        // Output configuration
        this.outputCount = config.outputCount || 4; // Default 4 outputs
        this.outputs = new Map(); // outputIndex -> { gainNode, effects, destination }
        
        // MIDI channel mapping (each output can respond to different MIDI channels)
        this.channelMapping = config.channelMapping || {}; // outputIndex -> midiChannel
        
        // Key/slice mapping for samplers
        this.keyMapping = config.keyMapping || {}; // outputIndex -> { keyRange: {low, high} }
        
        // Create outputs
        this._createOutputs(config);
        
        console.log(`[MultiOutputInstrument] Created "${this.name}" with ${this.outputCount} outputs`);
    }

    /**
     * Create output channels
     * @param {Object} config - Configuration object
     */
    _createOutputs(config) {
        for (let i = 0; i < this.outputCount; i++) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = config.defaultGain || 0.7;
            
            this.outputs.set(i, {
                gainNode,
                effects: [],
                destination: null,
                muted: false,
                solo: false,
                volume: config.defaultGain || 0.7,
                pan: 0, // -1 (left) to 1 (right)
                panNode: this._createPanNode()
            });
            
            // Connect pan to gain
            gainNode.connect(this.outputs.get(i).panNode);
        }
    }

    /**
     * Create a stereo panner node
     * @returns {StereoPannerNode} The panner node
     */
    _createPanNode() {
        const panNode = this.audioContext.createStereoPanner();
        panNode.pan.value = 0;
        return panNode;
    }

    /**
     * Get an output by index
     * @param {number} outputIndex - The output index (0-based)
     * @returns {Object|null} The output object or null
     */
    getOutput(outputIndex) {
        return this.outputs.get(outputIndex);
    }

    /**
     * Get the audio node to connect for an output
     * @param {number} outputIndex - The output index
     * @returns {AudioNode|null} The panner node (last in chain) to connect
     */
    getOutputNode(outputIndex) {
        const output = this.outputs.get(outputIndex);
        return output ? output.panNode : null;
    }

    /**
     * Set output volume
     * @param {number} outputIndex - The output index
     * @param {number} volume - Volume level (0-1)
     */
    setOutputVolume(outputIndex, volume) {
        const output = this.outputs.get(outputIndex);
        if (!output) return;
        
        output.volume = Math.max(0, Math.min(1, volume));
        
        if (!output.muted) {
            output.gainNode.gain.setTargetAtTime(output.volume, this.audioContext.currentTime, 0.01);
        }
        
        console.log(`[MultiOutputInstrument] Output ${outputIndex} volume: ${volume}`);
    }

    /**
     * Set output pan
     * @param {number} outputIndex - The output index
     * @param {number} pan - Pan value (-1 to 1)
     */
    setOutputPan(outputIndex, pan) {
        const output = this.outputs.get(outputIndex);
        if (!output) return;
        
        output.pan = Math.max(-1, Math.min(1, pan));
        output.panNode.pan.setTargetAtTime(output.pan, this.audioContext.currentTime, 0.01);
        
        console.log(`[MultiOutputInstrument] Output ${outputIndex} pan: ${pan}`);
    }

    /**
     * Mute/unmute an output
     * @param {number} outputIndex - The output index
     * @param {boolean} muted - Whether to mute
     */
    setOutputMuted(outputIndex, muted) {
        const output = this.outputs.get(outputIndex);
        if (!output) return;
        
        output.muted = muted;
        const targetGain = muted ? 0 : output.volume;
        output.gainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
        
        console.log(`[MultiOutputInstrument] Output ${outputIndex} ${muted ? 'muted' : 'unmuted'}`);
    }

    /**
     * Solo an output (mutes all others)
     * @param {number} outputIndex - The output index (or -1 to clear solo)
     */
    setOutputSolo(outputIndex) {
        // Clear all solos first
        for (const [idx, output] of this.outputs) {
            output.solo = false;
            const shouldMute = outputIndex !== -1 && idx !== outputIndex;
            output.gainNode.gain.setTargetAtTime(
                shouldMute ? 0 : (output.muted ? 0 : output.volume),
                this.audioContext.currentTime,
                0.01
            );
        }
        
        // Set solo on specified output
        if (outputIndex >= 0 && outputIndex < this.outputCount) {
            const output = this.outputs.get(outputIndex);
            output.solo = true;
            output.gainNode.gain.setTargetAtTime(output.volume, this.audioContext.currentTime, 0.01);
        }
        
        console.log(`[MultiOutputInstrument] Solo output: ${outputIndex}`);
    }

    /**
     * Connect an output to a destination
     * @param {number} outputIndex - The output index
     * @param {AudioNode} destination - The destination node
     */
    connectOutput(outputIndex, destination) {
        const output = this.outputs.get(outputIndex);
        if (!output) return;
        
        // Disconnect from previous destination
        if (output.destination) {
            output.panNode.disconnect(output.destination);
        }
        
        output.destination = destination;
        output.panNode.connect(destination);
        
        console.log(`[MultiOutputInstrument] Output ${outputIndex} connected to destination`);
    }

    /**
     * Disconnect an output
     * @param {number} outputIndex - The output index
     */
    disconnectOutput(outputIndex) {
        const output = this.outputs.get(outputIndex);
        if (!output) return;
        
        if (output.destination) {
            output.panNode.disconnect(output.destination);
            output.destination = null;
        }
        
        console.log(`[MultiOutputInstrument] Output ${outputIndex} disconnected`);
    }

    /**
     * Add an effect to an output's chain
     * @param {number} outputIndex - The output index
     * @param {AudioNode} effect - The effect node to add
     */
    addOutputEffect(outputIndex, effect) {
        const output = this.outputs.get(outputIndex);
        if (!output) return;
        
        // Disconnect current chain
        output.gainNode.disconnect();
        
        // Add effect
        output.effects.push(effect);
        
        // Rebuild chain: gain -> effects[0] -> ... -> effects[n] -> pan
        let currentNode = output.gainNode;
        for (const fx of output.effects) {
            currentNode.connect(fx);
            currentNode = fx;
        }
        currentNode.connect(output.panNode);
        
        if (output.destination) {
            output.panNode.connect(output.destination);
        }
        
        console.log(`[MultiOutputInstrument] Added effect to output ${outputIndex}`);
    }

    /**
     * Remove an effect from an output's chain
     * @param {number} outputIndex - The output index
     * @param {number} effectIndex - The effect index to remove
     */
    removeOutputEffect(outputIndex, effectIndex) {
        const output = this.outputs.get(outputIndex);
        if (!output || effectIndex >= output.effects.length) return;
        
        // Disconnect and remove
        output.gainNode.disconnect();
        output.effects[effectIndex].disconnect();
        output.effects.splice(effectIndex, 1);
        
        // Rebuild chain
        let currentNode = output.gainNode;
        for (const fx of output.effects) {
            currentNode.connect(fx);
            currentNode = fx;
        }
        currentNode.connect(output.panNode);
        
        if (output.destination) {
            output.panNode.connect(output.destination);
        }
        
        console.log(`[MultiOutputInstrument] Removed effect ${effectIndex} from output ${outputIndex}`);
    }

    /**
     * Map a MIDI channel to an output
     * @param {number} outputIndex - The output index
     * @param {number} midiChannel - MIDI channel (1-16, 0 = omni)
     */
    mapMidiChannel(outputIndex, midiChannel) {
        this.channelMapping[outputIndex] = midiChannel;
        console.log(`[MultiOutputInstrument] Mapped output ${outputIndex} to MIDI channel ${midiChannel}`);
    }

    /**
     * Get output for a MIDI channel
     * @param {number} midiChannel - MIDI channel (1-16)
     * @returns {number} Output index (-1 if not mapped)
     */
    getOutputForChannel(midiChannel) {
        for (const [outputIndex, channel] of Object.entries(this.channelMapping)) {
            if (channel === midiChannel) {
                return parseInt(outputIndex);
            }
        }
        return 0; // Default to first output
    }

    /**
     * Map a key range to an output (for samplers)
     * @param {number} outputIndex - The output index
     * @param {number} lowKey - Low key (MIDI note number)
     * @param {number} highKey - High key (MIDI note number)
     */
    mapKeyRange(outputIndex, lowKey, highKey) {
        this.keyMapping[outputIndex] = { low: lowKey, high: highKey };
        console.log(`[MultiOutputInstrument] Mapped output ${outputIndex} to keys ${lowKey}-${highKey}`);
    }

    /**
     * Get output for a key (for samplers)
     * @param {number} midiNote - MIDI note number
     * @returns {number} Output index
     */
    getOutputForKey(midiNote) {
        for (const [outputIndex, range] of Object.entries(this.keyMapping)) {
            if (midiNote >= range.low && midiNote <= range.high) {
                return parseInt(outputIndex);
            }
        }
        return 0; // Default to first output
    }

    /**
     * Route a note to the appropriate output based on MIDI channel or key
     * @param {Object} noteEvent - Note event with midiNote, channel, velocity
     * @returns {number} The output index to route to
     */
    routeNote(noteEvent) {
        // First check channel mapping
        if (noteEvent.channel && this.channelMapping) {
            const channelOutput = this.getOutputForChannel(noteEvent.channel);
            if (channelOutput >= 0) return channelOutput;
        }
        
        // Then check key mapping
        if (noteEvent.midiNote && this.keyMapping) {
            const keyOutput = this.getOutputForKey(noteEvent.midiNote);
            return keyOutput;
        }
        
        return 0; // Default
    }

    /**
     * Get state for serialization
     * @returns {Object} State object
     */
    getState() {
        const outputStates = {};
        for (const [index, output] of this.outputs) {
            outputStates[index] = {
                volume: output.volume,
                pan: output.pan,
                muted: output.muted,
                solo: output.solo
            };
        }
        
        return {
            id: this.id,
            name: this.name,
            outputCount: this.outputCount,
            outputs: outputStates,
            channelMapping: this.channelMapping,
            keyMapping: this.keyMapping
        };
    }

    /**
     * Restore from state
     * @param {Object} state - State object
     */
    restoreState(state) {
        if (state.outputCount) {
            // Recreate outputs if count changed
            while (this.outputs.size < state.outputCount) {
                const i = this.outputs.size;
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 0.7;
                this.outputs.set(i, {
                    gainNode,
                    effects: [],
                    destination: null,
                    muted: false,
                    solo: false,
                    volume: 0.7,
                    pan: 0,
                    panNode: this._createPanNode()
                });
                gainNode.connect(this.outputs.get(i).panNode);
            }
        }
        
        if (state.outputs) {
            for (const [index, outputState] of Object.entries(state.outputs)) {
                this.setOutputVolume(parseInt(index), outputState.volume);
                this.setOutputPan(parseInt(index), outputState.pan);
                this.setOutputMuted(parseInt(index), outputState.muted);
            }
        }
        
        if (state.channelMapping) {
            this.channelMapping = state.channelMapping;
        }
        
        if (state.keyMapping) {
            this.keyMapping = state.keyMapping;
        }
        
        console.log(`[MultiOutputInstrument] Restored state`);
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        for (const [index, output] of this.outputs) {
            output.gainNode.disconnect();
            output.panNode.disconnect();
            for (const fx of output.effects) {
                fx.disconnect();
            }
        }
        this.outputs.clear();
        console.log(`[MultiOutputInstrument] Disposed`);
    }
}

/**
 * Open the multi-output instrument panel
 * @param {Object} appServices - App services object
 * @param {string} trackId - The track ID
 */
export function openMultiOutputPanel(appServices, trackId) {
    const { getTracks, showNotification } = appServices;
    const tracks = getTracks ? getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track || !track.multiOutputInstrument) {
        showNotification?.('Track does not have a multi-output instrument', 2000);
        return;
    }

    const multiOut = track.multiOutputInstrument;
    
    // Remove existing panel
    const existingPanel = document.getElementById('multi-output-panel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'multi-output-panel';
    panel.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 w-[500px] max-h-[80vh] overflow-y-auto';

    let outputRows = '';
    for (let i = 0; i < multiOut.outputCount; i++) {
        const output = multiOut.getOutput(i);
        if (!output) continue;
        
        const channel = multiOut.channelMapping[i] || 0;
        
        outputRows += `
            <div class="flex items-center gap-3 py-3 px-4 hover:bg-zinc-800/50 border-b border-zinc-800">
                <div class="w-8 text-center font-bold text-sm text-zinc-300">OUT ${i + 1}</div>
                
                <div class="flex items-center gap-2 flex-1">
                    <div class="flex flex-col gap-1">
                        <label class="text-xs text-zinc-500">Volume</label>
                        <input type="range" min="0" max="1" step="0.01" value="${output.volume}" 
                               class="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer output-volume"
                               data-output="${i}">
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="text-xs text-zinc-500">Pan</label>
                        <input type="range" min="-1" max="1" step="0.1" value="${output.pan}" 
                               class="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer output-pan"
                               data-output="${i}">
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="text-xs text-zinc-500">Ch</label>
                        <select class="w-16 px-1 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded output-channel" data-output="${i}">
                            <option value="0" ${channel === 0 ? 'selected' : ''}>Omni</option>
                            ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(ch => 
                                `<option value="${ch}" ${channel === ch ? 'selected' : ''}>${ch}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="flex items-center gap-1">
                    <button class="px-2 py-1 text-xs rounded ${output.muted ? 'bg-red-600' : 'bg-zinc-700 hover:bg-zinc-600'} output-mute" data-output="${i}">
                        M
                    </button>
                    <button class="px-2 py-1 text-xs rounded ${output.solo ? 'bg-yellow-600' : 'bg-zinc-700 hover:bg-zinc-600'} output-solo" data-output="${i}">
                        S
                    </button>
                </div>
            </div>
        `;
    }

    panel.innerHTML = `
        <div class="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex justify-between items-center">
            <h2 class="text-lg font-bold text-white">${track.name} - Multi-Output</h2>
            <button id="close-multiout-panel" class="text-zinc-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        
        <div class="p-4">
            <div class="flex justify-between items-center mb-4">
                <span class="text-sm text-zinc-400">Outputs: ${multiOut.outputCount}</span>
                <button id="add-output" class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
                    + Add Output
                </button>
            </div>
            
            <div class="bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
                <div class="flex items-center gap-3 py-2 px-4 bg-zinc-800 border-b border-zinc-700 text-xs text-zinc-400 font-medium">
                    <div class="w-8"></div>
                    <div class="flex-1">Routing</div>
                    <div>M/S</div>
                </div>
                ${outputRows}
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Event handlers
    panel.querySelector('#close-multiout-panel').addEventListener('click', () => panel.remove());
    
    panel.querySelector('#add-output').addEventListener('click', () => {
        multiOut.outputCount++;
        const gainNode = multiOut.audioContext.createGain();
        gainNode.gain.value = 0.7;
        multiOut.outputs.set(multiOut.outputCount - 1, {
            gainNode,
            effects: [],
            destination: null,
            muted: false,
            solo: false,
            volume: 0.7,
            pan: 0,
            panNode: multiOut._createPanNode()
        });
        gainNode.connect(multiOut.outputs.get(multiOut.outputCount - 1).panNode);
        showNotification?.(`Added output ${multiOut.outputCount}`, 1500);
        panel.remove();
        openMultiOutputPanel(appServices, trackId);
    });

    panel.querySelectorAll('.output-volume').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const outputIndex = parseInt(e.target.dataset.output);
            const volume = parseFloat(e.target.value);
            multiOut.setOutputVolume(outputIndex, volume);
        });
    });

    panel.querySelectorAll('.output-pan').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const outputIndex = parseInt(e.target.dataset.output);
            const pan = parseFloat(e.target.value);
            multiOut.setOutputPan(outputIndex, pan);
        });
    });

    panel.querySelectorAll('.output-channel').forEach(select => {
        select.addEventListener('change', (e) => {
            const outputIndex = parseInt(e.target.dataset.output);
            const channel = parseInt(e.target.value);
            multiOut.mapMidiChannel(outputIndex, channel);
        });
    });

    panel.querySelectorAll('.output-mute').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const outputIndex = parseInt(e.target.dataset.output);
            const output = multiOut.getOutput(outputIndex);
            multiOut.setOutputMuted(outputIndex, !output.muted);
            e.target.className = `px-2 py-1 text-xs rounded ${!output.muted ? 'bg-red-600' : 'bg-zinc-700 hover:bg-zinc-600'} output-mute`;
        });
    });

    panel.querySelectorAll('.output-solo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const outputIndex = parseInt(e.target.dataset.output);
            const output = multiOut.getOutput(outputIndex);
            multiOut.setOutputSolo(output.solo ? -1 : outputIndex);
            // Update all solo buttons
            panel.querySelectorAll('.output-solo').forEach(b => {
                const idx = parseInt(b.dataset.output);
                const out = multiOut.getOutput(idx);
                b.className = `px-2 py-1 text-xs rounded ${out?.solo ? 'bg-yellow-600' : 'bg-zinc-700 hover:bg-zinc-600'} output-solo`;
            });
        });
    });

    // Close on escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

export default MultiOutputInstrument;