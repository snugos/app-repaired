// js/MidSideEncoderDecoder.js - Convert between stereo and mid-side representation
// M/S encoding is used for stereo width manipulation, mixing, and mastering

class MidSideEncoderDecoder {
    constructor(initialParams = {}) {
        this._params = {
            mode: initialParams.mode || 'bypass', // 'bypass', 'encode', 'decode'
            midGain: initialParams.midGain !== undefined ? initialParams.midGain : 1.0, // 0-2
            sideGain: initialParams.sideGain !== undefined ? initialParams.sideGain : 1.0, // 0-2
            midWidth: initialParams.midWidth !== undefined ? initialParams.midWidth : 1.0, // 0-2
            sideWidth: initialParams.sideWidth !== undefined ? initialParams.sideWidth : 1.0, // 0-2
            stereoWidth: initialParams.stereoWidth !== undefined ? initialParams.stereoWidth : 1.0 // 0-2
        };
        
        this._initialized = false;
        this._nodes = [];
        
        // Input/Output nodes (set up in initialize)
        this._inputL = null;
        this._inputR = null;
        this._outputL = null;
        this._outputR = null;
        
        // Encoder nodes
        this._midGain = null;
        this._sideGain = null;
        this._midWidth = null;
        this._sideWidth = null;
    }
    
    async initialize() {
        if (this._initialized) return;
        
        try {
            const ctx = Tone.context;
            
            // Create stereo input/output
            this._inputL = ctx.createGain();
            this._inputR = ctx.createGain();
            this._outputL = ctx.createGain();
            this._outputR = ctx.createGain();
            
            // Create mid/side gains
            this._midGain = ctx.createGain();
            this._midGain.gain.value = this._params.midGain;
            
            this._sideGain = ctx.createGain();
            this._sideGain.gain.value = this._params.sideGain;
            
            this._midWidth = ctx.createGain();
            this._midWidth.gain.value = this._params.midWidth;
            
            this._sideWidth = ctx.createGain();
            this._sideWidth.gain.value = this._params.sideWidth;
            
            // Matrix coefficients for M/S encoding/decoding
            // Encode: Mid = (L + R) / 2, Side = (L - R) / 2
            // Decode: L = Mid + Side, R = Mid - Side
            
            // For simplicity, we'll use Tone.js MidSideSplit and MidSideMerge if available
            if (typeof Tone !== 'undefined' && Tone.MidSideSplit) {
                this._msSplit = new Tone.MidSideSplit();
                this._msMerge = new Tone.MidSideMerge();
                
                // Connect
                this._inputL.connect(this._msSplit);
                this._inputR.connect(this._msSplit);
                
                this._msSplit.mid.connect(this._midGain);
                this._msSplit.side.connect(this._sideGain);
                
                this._midGain.connect(this._midWidth);
                this._sideGain.connect(this._sideWidth);
                
                this._midWidth.connect(this._msMerge, 0, 0);
                this._sideWidth.connect(this._msMerge, 0, 1);
                
                this._msMerge.connect(this._outputL);
                this._msMerge.connect(this._outputR);
            }
            
            this._initialized = true;
        } catch (e) {
            console.warn('MidSideEncoderDecoder initialization failed:', e);
        }
    }
    
    getInputL() { return this._inputL; }
    getInputR() { return this._inputR; }
    getOutputL() { return this._outputL; }
    getOutputR() { return this._outputR; }
    
    async start() {
        if (!this._initialized) await this.initialize();
    }
    
    setMode(mode) {
        this._params.mode = mode;
    }
    
    setMidGain(value) {
        this._params.midGain = value;
        if (this._midGain) this._midGain.gain.value = value;
    }
    
    setSideGain(value) {
        this._params.sideGain = value;
        if (this._sideGain) this._sideGain.gain.value = value;
    }
    
    setMidWidth(value) {
        this._params.midWidth = value;
        if (this._midWidth) this._midWidth.gain.value = value;
    }
    
    setSideWidth(value) {
        this._params.sideWidth = value;
        if (this._sideWidth) this._sideWidth.gain.value = value;
    }
    
    setStereoWidth(value) {
        this._params.stereoWidth = value;
        // Width affects both mid and side
        const w = value;
        if (this._midWidth) this._midWidth.gain.value = 1 + (1 - w) * 0.5;
        if (this._sideWidth) this._sideWidth.gain.value = w;
    }
    
    getParams() {
        return { ...this._params };
    }
    
    dispose() {
        this._inputL = null;
        this._inputR = null;
        this._outputL = null;
        this._outputR = null;
        this._midGain = null;
        this._sideGain = null;
        this._midWidth = null;
        this._sideWidth = null;
        if (this._msSplit) {
            this._msSplit.dispose();
            this._msSplit = null;
        }
        if (this._msMerge) {
            this._msMerge.dispose();
            this._msMerge = null;
        }
    }
}

// Backward compatible
class MidSideCodec extends MidSideEncoderDecoder {}

export { MidSideEncoderDecoder, MidSideCodec };