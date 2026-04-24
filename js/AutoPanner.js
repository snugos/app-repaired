// js/AutoPanner.js - Auto-panning effect with various patterns
class AutoPanner {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.pannerNode = audioContext.createStereoPanner();
        this.lfoNode = audioContext.createOscillator();
        this.lfoGain = audioContext.createGain();
        
        this.lfoNode.type = 'sine';
        this.lfoNode.frequency.value = 0.5;
        this.lfoGain.gain.value = 0.8;
        
        this.lfoNode.connect(this.lfoGain);
        this.lfoGain.connect(this.pannerNode.pan);
        
        this.pattern = 'sine';
        this.depth = 0.8;
        this.rate = 0.5;
        this.enabled = true;
        
        this.lfoNode.start();
    }
    
    getInputNode() { return this.pannerNode; }
    getOutputNode() { return this.pannerNode; }
    
    setDepth(value) {
        this.depth = Math.max(0, Math.min(1, value));
        this.lfoGain.gain.value = this.depth;
    }
    
    setRate(value) {
        this.rate = Math.max(0.1, Math.min(10, value));
        this.lfoNode.frequency.value = this.rate;
    }
    
    setPattern(pattern) {
        this.pattern = pattern;
        this.lfoNode.type = pattern;
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        this.lfoGain.gain.value = enabled ? this.depth : 0;
    }
    
    dispose() {
        this.lfoNode.stop();
        this.lfoNode.disconnect();
        this.lfoGain.disconnect();
        this.pannerNode.disconnect();
    }
}

function createAutoPanner(audioContext) {
    return new AutoPanner(audioContext);
}

function getAutoPannerParams() {
    return [
        { name: 'depth', type: 'range', min: 0, max: 1, default: 0.8, label: 'Depth' },
        { name: 'rate', type: 'range', min: 0.1, max: 10, default: 0.5, label: 'Rate (Hz)' },
        { name: 'pattern', type: 'select', options: ['sine', 'triangle', 'sawtooth', 'square'], default: 'sine', label: 'LFO Shape' }
    ];
}

export { AutoPanner, createAutoPanner, getAutoPannerParams };
