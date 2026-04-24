// js/ScriptingEngine.js - Custom JavaScript-based Effects and Generators
// Provides a sandboxed scripting environment for custom audio processing

/**
 * ScriptEffect - A custom effect created from user script
 */
class ScriptEffect {
    constructor(config) {
        this.id = config.id || `script-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = config.name || 'Custom Script';
        this.scriptCode = config.scriptCode || '';
        this.params = config.params || {};
        this.paramDefs = config.paramDefs || [];
        
        this.audioContext = null;
        this.inputNode = null;
        this.outputNode = null;
        this.workletNode = null;
        this.processNode = null;
        
        this.isValid = false;
        this.error = null;
        
        // Compiled functions
        this.initFunc = null;
        this.processFunc = null;
        this.paramFunc = null;
        this.disposeFunc = null;
    }

    /**
     * Parse parameter definitions from script
     */
    parseScript() {
        try {
            // Extract parameter definitions
            const paramMatch = this.scriptCode.match(/@params\s*\{([^}]+)\}/s);
            if (paramMatch) {
                this.paramDefs = this.parseParamDefs(paramMatch[1]);
            }
            
            // Extract init function
            const initMatch = this.scriptCode.match(/function\s+init\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
            if (initMatch) {
                this.initFunc = new Function('context', 'params', initMatch[2]);
            }
            
            // Extract process function (must exist)
            const processMatch = this.scriptCode.match(/function\s+process\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
            if (processMatch) {
                this.processFunc = new Function('input', 'output', 'params', 'context', processMatch[2]);
            } else {
                throw new Error('Script must have a process function');
            }
            
            // Extract param update function
            const paramUpdateMatch = this.scriptCode.match(/function\s+updateParam\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
            if (paramUpdateMatch) {
                this.paramFunc = new Function('param', 'value', 'context', paramUpdateMatch[2]);
            }
            
            // Extract dispose function
            const disposeMatch = this.scriptCode.match(/function\s+dispose\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
            if (disposeMatch) {
                this.disposeFunc = new Function('context', disposeMatch[2]);
            }
            
            this.isValid = true;
            this.error = null;
            return true;
        } catch (e) {
            this.isValid = false;
            this.error = e.message;
            console.error('ScriptEffect parse error:', e);
            return false;
        }
    }

    /**
     * Parse parameter definitions
     */
    parseParamDefs(str) {
        const params = [];
        const lines = str.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Format: name: type { min, max, default }
            const match = trimmed.match(/(\w+):\s*(\w+)\s*\{\s*([^}]+)\s*\}/);
            if (match) {
                const [, name, type, config] = match;
                const [min, max, def] = config.split(',').map(s => parseFloat(s.trim()));
                
                params.push({
                    name,
                    type,
                    min: min || 0,
                    max: max || 1,
                    default: def || (type === 'float' ? 0.5 : 0)
                });
                
                // Set default value
                if (this.params[name] === undefined) {
                    this.params[name] = params[params.length - 1].default;
                }
            }
        }
        
        return params;
    }

    /**
     * Initialize the effect with audio context
     */
    init(audioContext) {
        if (!this.isValid) return false;
        
        this.audioContext = audioContext;
        
        // Create input/output nodes
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        
        // Create ScriptProcessorNode (fallback for browsers without AudioWorklet)
        this.processNode = audioContext.createScriptProcessor(4096, 2, 2);
        
        // Script processing context
        const scriptContext = {
            sampleRate: audioContext.sampleRate,
            bufferSize: 4096,
            time: 0,
            phase: new Float32Array(2),
            memory: new Float32Array(1024), // Delay line memory
            memoryIndex: 0
        };
        
        // Call init function if exists
        if (this.initFunc) {
            try {
                this.initFunc(scriptContext, this.params);
            } catch (e) {
                this.error = `Init error: ${e.message}`;
                return false;
            }
        }
        
        // Setup audio processing
        this.processNode.onaudioprocess = (event) => {
            const input = event.inputBuffer;
            const output = event.outputBuffer;
            
            const inputDataL = input.getChannelData(0);
            const inputDataR = input.getChannelData(1);
            const outputDataL = output.getChannelData(0);
            const outputDataR = output.getChannelData(1);
            
            try {
                // Process each sample
                for (let i = 0; i < input.length; i++) {
                    const inSample = [inputDataL[i], inputDataR[i]];
                    let outSample = [inSample[0], inSample[1]];
                    
                    if (this.processFunc) {
                        const result = this.processFunc(inSample, outSample, this.params, scriptContext);
                        if (result) {
                            outSample = result;
                        }
                    }
                    
                    outputDataL[i] = outSample[0];
                    outputDataR[i] = outSample[1];
                    
                    scriptContext.time += 1 / audioContext.sampleRate;
                }
            } catch (e) {
                console.error('ScriptEffect process error:', e);
                // Pass through on error
                output.getChannelData(0).set(input.getChannelData(0));
                output.getChannelData(1).set(input.getChannelData(1));
            }
        };
        
        // Connect nodes
        this.inputNode.connect(this.processNode);
        this.processNode.connect(this.outputNode);
        
        return true;
    }

    /**
     * Set parameter value
     */
    setParam(name, value) {
        const def = this.paramDefs.find(p => p.name === name);
        if (def) {
            value = Math.max(def.min, Math.min(def.max, value));
        }
        
        this.params[name] = value;
        
        if (this.paramFunc) {
            try {
                this.paramFunc(name, value, {
                    sampleRate: this.audioContext.sampleRate
                });
            } catch (e) {
                console.error('ScriptEffect param update error:', e);
            }
        }
    }

    /**
     * Connect to destination
     */
    connect(destination) {
        if (this.outputNode) {
            this.outputNode.connect(destination);
        }
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.outputNode) {
            this.outputNode.disconnect();
        }
    }

    /**
     * Get input node for connection
     */
    getInput() {
        return this.inputNode;
    }

    /**
     * Get output node
     */
    getOutput() {
        return this.outputNode;
    }

    /**
     * Dispose of resources
     */
    dispose() {
        if (this.disposeFunc) {
            try {
                this.disposeFunc({
                    sampleRate: this.audioContext.sampleRate
                });
            } catch (e) {
                console.error('ScriptEffect dispose error:', e);
            }
        }
        
        if (this.inputNode) {
            this.inputNode.disconnect();
            this.inputNode = null;
        }
        if (this.processNode) {
            this.processNode.disconnect();
            this.processNode = null;
        }
        if (this.outputNode) {
            this.outputNode.disconnect();
            this.outputNode = null;
        }
    }
}

/**
 * ScriptGenerator - A custom generator created from user script
 */
class ScriptGenerator {
    constructor(config) {
        this.id = config.id || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = config.name || 'Custom Generator';
        this.scriptCode = config.scriptCode || '';
        this.params = config.params || {};
        this.paramDefs = config.paramDefs || [];
        
        this.audioContext = null;
        this.outputNode = null;
        this.processNode = null;
        
        this.isValid = false;
        this.error = null;
        this.isPlaying = false;
        
        this.generateFunc = null;
        this.initFunc = null;
    }

    /**
     * Parse and compile script
     */
    parseScript() {
        try {
            // Extract generate function (must exist)
            const generateMatch = this.scriptCode.match(/function\s+generate\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
            if (generateMatch) {
                this.generateFunc = new Function('time', 'params', 'context', generateMatch[2]);
            } else {
                throw new Error('Script must have a generate function');
            }
            
            // Extract parameter definitions
            const paramMatch = this.scriptCode.match(/@params\s*\{([^}]+)\}/s);
            if (paramMatch) {
                this.paramDefs = this.parseParamDefs(paramMatch[1]);
            }
            
            // Extract init function
            const initMatch = this.scriptCode.match(/function\s+init\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
            if (initMatch) {
                this.initFunc = new Function('context', 'params', initMatch[2]);
            }
            
            this.isValid = true;
            this.error = null;
            return true;
        } catch (e) {
            this.isValid = false;
            this.error = e.message;
            console.error('ScriptGenerator parse error:', e);
            return false;
        }
    }

    /**
     * Parse parameter definitions
     */
    parseParamDefs(str) {
        const params = [];
        const lines = str.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            const match = trimmed.match(/(\w+):\s*(\w+)\s*\{\s*([^}]+)\s*\}/);
            if (match) {
                const [, name, type, config] = match;
                const [min, max, def] = config.split(',').map(s => parseFloat(s.trim()));
                
                params.push({
                    name,
                    type,
                    min: min || 0,
                    max: max || 1,
                    default: def || (type === 'float' ? 0.5 : 0)
                });
                
                if (this.params[name] === undefined) {
                    this.params[name] = params[params.length - 1].default;
                }
            }
        }
        
        return params;
    }

    /**
     * Initialize the generator
     */
    init(audioContext) {
        if (!this.isValid) return false;
        
        this.audioContext = audioContext;
        
        this.outputNode = audioContext.createGain();
        this.processNode = audioContext.createScriptProcessor(4096, 0, 2);
        
        const genContext = {
            sampleRate: audioContext.sampleRate,
            time: 0,
            phase: 0,
            lastSample: [0, 0]
        };
        
        if (this.initFunc) {
            try {
                this.initFunc(genContext, this.params);
            } catch (e) {
                this.error = `Init error: ${e.message}`;
                return false;
            }
        }
        
        this.processNode.onaudioprocess = (event) => {
            const outputL = event.outputBuffer.getChannelData(0);
            const outputR = event.outputBuffer.getChannelData(1);
            
            try {
                for (let i = 0; i < outputL.length; i++) {
                    const sample = this.generateFunc(genContext.time, this.params, genContext);
                    
                    if (Array.isArray(sample)) {
                        outputL[i] = sample[0] || 0;
                        outputR[i] = sample[1] || 0;
                        genContext.lastSample = [outputL[i], outputR[i]];
                    } else {
                        outputL[i] = sample;
                        outputR[i] = sample;
                        genContext.lastSample = [sample, sample];
                    }
                    
                    genContext.time += 1 / audioContext.sampleRate;
                }
            } catch (e) {
                console.error('ScriptGenerator generate error:', e);
                // Output silence on error
                outputL.fill(0);
                outputR.fill(0);
            }
        };
        
        this.processNode.connect(this.outputNode);
        
        return true;
    }

    /**
     * Start generating audio
     */
    start() {
        this.isPlaying = true;
    }

    /**
     * Stop generating audio
     */
    stop() {
        this.isPlaying = false;
    }

    /**
     * Set parameter
     */
    setParam(name, value) {
        const def = this.paramDefs.find(p => p.name === name);
        if (def) {
            value = Math.max(def.min, Math.min(def.max, value));
        }
        this.params[name] = value;
    }

    /**
     * Connect output
     */
    connect(destination) {
        if (this.outputNode) {
            this.outputNode.connect(destination);
        }
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.outputNode) {
            this.outputNode.disconnect();
        }
    }

    /**
     * Dispose
     */
    dispose() {
        this.stop();
        if (this.processNode) {
            this.processNode.disconnect();
            this.processNode = null;
        }
        if (this.outputNode) {
            this.outputNode.disconnect();
            this.outputNode = null;
        }
    }
}

/**
 * ScriptingEngine - Main engine for managing scripted effects and generators
 */
export class ScriptingEngine {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.effects = new Map();
        this.generators = new Map();
        this.scriptLibrary = new Map();
        
        // Built-in script templates
        this.loadBuiltInTemplates();
    }

    /**
     * Load built-in script templates
     */
    loadBuiltInTemplates() {
        // Simple Gain
        this.addTemplate('gain', {
            name: 'Simple Gain',
            type: 'effect',
            code: `
@params {
    gain: float { 0, 2, 1 }
}

function process(input, output, params, context) {
    output[0] = input[0] * params.gain;
    output[1] = input[1] * params.gain;
    return output;
}
`
        });
        
        // Stereo Width
        this.addTemplate('stereo-width', {
            name: 'Stereo Width',
            type: 'effect',
            code: `
@params {
    width: float { 0, 2, 1 }
}

function process(input, output, params, context) {
    const mid = (input[0] + input[1]) / 2;
    const side = (input[0] - input[1]) / 2 * params.width;
    output[0] = mid + side;
    output[1] = mid - side;
    return output;
}
`
        });
        
        // Simple Delay
        this.addTemplate('delay', {
            name: 'Simple Delay',
            type: 'effect',
            code: `
@params {
    time: float { 0.01, 1, 0.3 }
    feedback: float { 0, 0.99, 0.4 }
    mix: float { 0, 1, 0.5 }
}

function init(context, params) {
    context.delayTime = params.time * context.sampleRate;
    context.feedback = params.feedback;
}

function process(input, output, params, context) {
    const delaySamples = Math.floor(params.time * context.sampleRate);
    
    // Read from delay line
    const readIndex = (context.memoryIndex - delaySamples + 1024) % 1024;
    const delayed = context.memory[readIndex] || 0;
    
    // Write to delay line with feedback
    context.memory[context.memoryIndex] = input[0] + delayed * params.feedback;
    context.memoryIndex = (context.memoryIndex + 1) % 1024;
    
    // Mix
    output[0] = input[0] * (1 - params.mix) + delayed * params.mix;
    output[1] = input[1] * (1 - params.mix) + delayed * params.mix;
    
    return output;
}
`
        });
        
        // Bitcrusher
        this.addTemplate('bitcrusher', {
            name: 'Bitcrusher',
            type: 'effect',
            code: `
@params {
    bits: int { 1, 16, 8 }
    downsample: int { 1, 32, 4 }
}

function init(context, params) {
    context.counter = 0;
    context.heldSample = [0, 0];
}

function process(input, output, params, context) {
    context.counter++;
    
    if (context.counter >= params.downsample) {
        context.counter = 0;
        const step = Math.pow(2, params.bits);
        context.heldSample[0] = Math.round(input[0] * step) / step;
        context.heldSample[1] = Math.round(input[1] * step) / step;
    }
    
    output[0] = context.heldSample[0];
    output[1] = context.heldSample[1];
    return output;
}
`
        });
        
        // Sine Wave Generator
        this.addTemplate('sine-gen', {
            name: 'Sine Wave',
            type: 'generator',
            code: `
@params {
    frequency: float { 20, 2000, 440 }
    amplitude: float { 0, 1, 0.5 }
}

function init(context, params) {
    context.phase = 0;
}

function generate(time, params, context) {
    const sample = Math.sin(context.phase) * params.amplitude;
    context.phase += 2 * Math.PI * params.frequency / context.sampleRate;
    if (context.phase > 2 * Math.PI) context.phase -= 2 * Math.PI;
    return sample;
}
`
        });
        
        // Noise Generator
        this.addTemplate('noise-gen', {
            name: 'White Noise',
            type: 'generator',
            code: `
@params {
    amplitude: float { 0, 1, 0.3 }
}

function generate(time, params, context) {
    return (Math.random() * 2 - 1) * params.amplitude;
}
`
        });
        
        // FM Synthesis Generator
        this.addTemplate('fm-gen', {
            name: 'FM Synthesis',
            type: 'generator',
            code: `
@params {
    carrierFreq: float { 20, 2000, 440 }
    modulatorFreq: float { 0.1, 2000, 220 }
    modIndex: float { 0, 20, 5 }
    amplitude: float { 0, 1, 0.5 }
}

function init(context, params) {
    context.carrierPhase = 0;
    context.modulatorPhase = 0;
}

function generate(time, params, context) {
    const modulator = Math.sin(context.modulatorPhase);
    const sample = Math.sin(context.carrierPhase + modulator * params.modIndex) * params.amplitude;
    
    context.carrierPhase += 2 * Math.PI * params.carrierFreq / context.sampleRate;
    context.modulatorPhase += 2 * Math.PI * params.modulatorFreq / context.sampleRate;
    
    if (context.carrierPhase > 2 * Math.PI) context.carrierPhase -= 2 * Math.PI;
    if (context.modulatorPhase > 2 * Math.PI) context.modulatorPhase -= 2 * Math.PI;
    
    return sample;
}
`
        });
    }

    /**
     * Add a script template
     */
    addTemplate(id, template) {
        this.scriptLibrary.set(id, template);
    }

    /**
     * Get all templates
     */
    getTemplates() {
        return Array.from(this.scriptLibrary.entries()).map(([id, template]) => ({
            id,
            name: template.name,
            type: template.type
        }));
    }

    /**
     * Create an effect from template
     */
    createEffectFromTemplate(templateId, config = {}) {
        const template = this.scriptLibrary.get(templateId);
        if (!template || template.type !== 'effect') {
            return null;
        }
        
        const effect = new ScriptEffect({
            name: config.name || template.name,
            scriptCode: template.code,
            ...config
        });
        
        if (effect.parseScript() && effect.init(this.audioContext)) {
            this.effects.set(effect.id, effect);
            return effect;
        }
        
        return null;
    }

    /**
     * Create a generator from template
     */
    createGeneratorFromTemplate(templateId, config = {}) {
        const template = this.scriptLibrary.get(templateId);
        if (!template || template.type !== 'generator') {
            return null;
        }
        
        const gen = new ScriptGenerator({
            name: config.name || template.name,
            scriptCode: template.code,
            ...config
        });
        
        if (gen.parseScript() && gen.init(this.audioContext)) {
            this.generators.set(gen.id, gen);
            return gen;
        }
        
        return null;
    }

    /**
     * Create custom effect from code
     */
    createCustomEffect(code, config = {}) {
        const effect = new ScriptEffect({
            name: config.name || 'Custom Effect',
            scriptCode: code,
            params: config.params || {}
        });
        
        if (effect.parseScript() && effect.init(this.audioContext)) {
            this.effects.set(effect.id, effect);
            return effect;
        }
        
        return { effect: null, error: effect.error };
    }

    /**
     * Create custom generator from code
     */
    createCustomGenerator(code, config = {}) {
        const gen = new ScriptGenerator({
            name: config.name || 'Custom Generator',
            scriptCode: code,
            params: config.params || {}
        });
        
        if (gen.parseScript() && gen.init(this.audioContext)) {
            this.generators.set(gen.id, gen);
            return gen;
        }
        
        return { generator: null, error: gen.error };
    }

    /**
     * Get effect by ID
     */
    getEffect(id) {
        return this.effects.get(id);
    }

    /**
     * Get generator by ID
     */
    getGenerator(id) {
        return this.generators.get(id);
    }

    /**
     * Remove effect
     */
    removeEffect(id) {
        const effect = this.effects.get(id);
        if (effect) {
            effect.dispose();
            this.effects.delete(id);
        }
    }

    /**
     * Remove generator
     */
    removeGenerator(id) {
        const gen = this.generators.get(id);
        if (gen) {
            gen.dispose();
            this.generators.delete(id);
        }
    }

    /**
     * Dispose all
     */
    dispose() {
        for (const effect of this.effects.values()) {
            effect.dispose();
        }
        for (const gen of this.generators.values()) {
            gen.dispose();
        }
        this.effects.clear();
        this.generators.clear();
    }
}

/**
 * Open scripting engine panel
 */
export function openScriptingEnginePanel(services = {}) {
    const { audioContext, getDestination, showNotification } = services;
    
    if (!audioContext) {
        console.error('ScriptingEngine: audioContext required');
        return null;
    }
    
    // Remove existing panel
    const existing = document.getElementById('scripting-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'scripting-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #4a4a6a;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 900px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const engine = new ScriptingEngine(audioContext);
    const destination = getDestination ? getDestination() : audioContext.destination;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #fff; margin: 0;">📝 Scripting Engine</h2>
            <button id="close-scripting" style="background: #ef4444; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 200px 1fr; gap: 20px;">
            <!-- Template Library -->
            <div style="background: #0f0f1f; padding: 16px; border-radius: 6px;">
                <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Templates</h3>
                <div id="template-list" style="max-height: 300px; overflow-y: auto;">
                    ${engine.getTemplates().map(t => `
                        <button class="template-btn" data-id="${t.id}" data-type="${t.type}" style="width: 100%; padding: 8px; margin-bottom: 6px; background: ${t.type === 'effect' ? '#3b82f6' : '#10b981'}; border: none; color: white; border-radius: 4px; cursor: pointer; text-align: left; font-size: 12px;">
                            ${t.name} <span style="opacity: 0.7; font-size: 10px;">(${t.type})</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <!-- Code Editor -->
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <input type="text" id="script-name" placeholder="Script Name" style="padding: 8px; background: #1a1a2e; color: #fff; border: 1px solid #4a4a6a; border-radius: 4px; width: 200px;">
                    <div style="display: flex; gap: 10px;">
                        <select id="script-type" style="padding: 8px; background: #1a1a2e; color: #fff; border: 1px solid #4a4a6a; border-radius: 4px;">
                            <option value="effect">Effect</option>
                            <option value="generator">Generator</option>
                        </select>
                        <button id="parse-script" style="padding: 8px 16px; background: #8b5cf6; border: none; color: white; border-radius: 4px; cursor: pointer;">Parse & Create</button>
                    </div>
                </div>
                <textarea id="script-editor" style="width: 100%; height: 250px; padding: 12px; background: #0a0a14; color: #10b981; border: 1px solid #4a4a6a; border-radius: 4px; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; resize: vertical;">@params {
    gain: float { 0, 2, 1 }
}

function process(input, output, params, context) {
    output[0] = input[0] * params.gain;
    output[1] = input[1] * params.gain;
    return output;
}</textarea>
                <div id="script-error" style="margin-top: 8px; color: #ef4444; font-size: 12px;"></div>
            </div>
        </div>
        
        <!-- Active Effects -->
        <div style="margin-top: 20px;">
            <h3 style="color: #888; margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase;">Active Scripts</h3>
            <div id="active-scripts" style="background: #0f0f1f; padding: 12px; border-radius: 6px; min-height: 100px;">
                <div style="color: #666; text-align: center; padding: 20px;">No active scripts. Create one from a template or custom code.</div>
            </div>
        </div>
        
        <!-- Parameter Controls -->
        <div id="param-controls" style="margin-top: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px; display: none;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Parameters</h3>
            <div id="param-sliders"></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    let currentScript = null;
    let currentType = 'effect';
    
    // Helper to update active scripts list
    function updateActiveScripts() {
        const container = panel.querySelector('#active-scripts');
        const effects = Array.from(engine.effects.values());
        const generators = Array.from(engine.generators.values());
        
        if (effects.length === 0 && generators.length === 0) {
            container.innerHTML = `<div style="color: #666; text-align: center; padding: 20px;">No active scripts.</div>`;
            return;
        }
        
        let html = '';
        
        effects.forEach(e => {
            html += `
                <div class="active-script" data-id="${e.id}" data-type="effect" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #1a1a2e; border-radius: 4px; margin-bottom: 8px;">
                    <div>
                        <span style="color: #3b82f6;">🛠️</span>
                        <span style="color: #fff;">${e.name}</span>
                        <span style="color: #666; font-size: 11px; margin-left: 8px;">Effect</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="edit-script" data-id="${e.id}" style="padding: 4px 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Edit</button>
                        <button class="delete-script" data-id="${e.id}" style="padding: 4px 12px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Delete</button>
                    </div>
                </div>
            `;
        });
        
        generators.forEach(g => {
            html += `
                <div class="active-script" data-id="${g.id}" data-type="generator" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #1a1a2e; border-radius: 4px; margin-bottom: 8px;">
                    <div>
                        <span style="color: #10b981;">🎵</span>
                        <span style="color: #fff;">${g.name}</span>
                        <span style="color: #666; font-size: 11px; margin-left: 8px;">Generator</span>
                        <span style="color: ${g.isPlaying ? '#10b981' : '#666'}; font-size: 11px; margin-left: 8px;">${g.isPlaying ? '▶ Playing' : '◼ Stopped'}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="toggle-gen" data-id="${g.id}" style="padding: 4px 12px; background: ${g.isPlaying ? '#f59e0b' : '#10b981'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">${g.isPlaying ? 'Stop' : 'Play'}</button>
                        <button class="edit-script" data-id="${g.id}" style="padding: 4px 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Edit</button>
                        <button class="delete-script" data-id="${g.id}" style="padding: 4px 12px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Delete</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Attach event handlers
        container.querySelectorAll('.delete-script').forEach(btn => {
            btn.onclick = () => {
                const type = btn.closest('.active-script').dataset.type;
                if (type === 'effect') {
                    engine.removeEffect(btn.dataset.id);
                } else {
                    engine.removeGenerator(btn.dataset.id);
                }
                updateActiveScripts();
                if (showNotification) showNotification('Script removed', 1500);
            };
        });
        
        container.querySelectorAll('.toggle-gen').forEach(btn => {
            btn.onclick = () => {
                const gen = engine.getGenerator(btn.dataset.id);
                if (gen) {
                    if (gen.isPlaying) {
                        gen.stop();
                        gen.disconnect();
                    } else {
                        gen.start();
                        gen.connect(destination);
                    }
                    updateActiveScripts();
                }
            };
        });
        
        container.querySelectorAll('.edit-script').forEach(btn => {
            btn.onclick = () => {
                const type = btn.closest('.active-script').dataset.type;
                let script;
                if (type === 'effect') {
                    script = engine.getEffect(btn.dataset.id);
                } else {
                    script = engine.getGenerator(btn.dataset.id);
                }
                
                if (script) {
                    currentScript = script;
                    currentType = type;
                    panel.querySelector('#script-name').value = script.name;
                    panel.querySelector('#script-type').value = type;
                    panel.querySelector('#script-editor').value = script.scriptCode;
                    updateParamControls(script);
                }
            };
        });
    }
    
    // Update parameter controls
    function updateParamControls(script) {
        const container = panel.querySelector('#param-controls');
        const sliders = panel.querySelector('#param-sliders');
        
        if (!script || script.paramDefs.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        sliders.innerHTML = script.paramDefs.map(p => `
            <label style="display: block; color: #888; margin-bottom: 10px;">
                ${p.name}: <input type="range" class="script-param" data-param="${p.name}" min="${p.min}" max="${p.max}" step="${p.type === 'int' ? 1 : 0.01}" value="${script.params[p.name] || p.default}" style="width: 200px;">
                <span class="param-val" style="color: #fff;">${script.params[p.name] || p.default}</span>
            </label>
        `).join('');
        
        sliders.querySelectorAll('.script-param').forEach(slider => {
            slider.oninput = () => {
                const param = slider.dataset.param;
                const value = slider.type === 'int' ? parseInt(slider.value) : parseFloat(slider.value);
                script.setParam(param, value);
                slider.parentElement.querySelector('.param-val').textContent = value;
            };
        });
    }
    
    // Close panel
    panel.querySelector('#close-scripting').onclick = () => {
        engine.dispose();
        panel.remove();
    };
    
    // Template buttons
    panel.querySelectorAll('.template-btn').forEach(btn => {
        btn.onclick = () => {
            const templateId = btn.dataset.id;
            const template = engine.scriptLibrary.get(templateId);
            if (template) {
                panel.querySelector('#script-name').value = template.name;
                panel.querySelector('#script-type').value = template.type;
                panel.querySelector('#script-editor').value = template.code;
                currentType = template.type;
            }
        };
    });
    
    // Parse and create script
    panel.querySelector('#parse-script').onclick = () => {
        const name = panel.querySelector('#script-name').value || 'Custom Script';
        const type = panel.querySelector('#script-type').value;
        const code = panel.querySelector('#script-editor').value;
        const errorDiv = panel.querySelector('#script-error');
        
        errorDiv.textContent = '';
        
        if (type === 'effect') {
            const result = engine.createCustomEffect(code, { name });
            if (result.effect) {
                result.effect.connect(destination);
                currentScript = result.effect;
                updateActiveScripts();
                updateParamControls(result.effect);
                if (showNotification) showNotification('Effect created successfully', 1500);
            } else {
                errorDiv.textContent = result.error || 'Failed to create effect';
            }
        } else {
            const result = engine.createCustomGenerator(code, { name });
            if (result.generator) {
                result.generator.start();
                result.generator.connect(destination);
                currentScript = result.generator;
                updateActiveScripts();
                updateParamControls(result.generator);
                if (showNotification) showNotification('Generator created and playing', 1500);
            } else {
                errorDiv.textContent = result.error || 'Failed to create generator';
            }
        }
    };
    
    return engine;
}

export default ScriptingEngine;