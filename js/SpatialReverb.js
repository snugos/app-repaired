// js/SpatialReverb.js - 3D Position-Aware Reverb
// Provides spatial reverb with distance-based attenuation and room simulation

/**
 * SpatialReverb - 3D position-aware reverb processor
 */
export class SpatialReverb {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Room dimensions
        this.roomSize = options.roomSize || { width: 20, height: 5, depth: 15 }; // meters
        this.roomType = options.roomType || 'hall';
        
        // Reflection parameters
        this.earlyReflections = options.earlyReflections !== false;
        this.lateReverb = options.lateReverb !== false;
        this.damping = options.damping || 0.5;
        this.diffusion = options.diffusion || 0.7;
        
        // Spatial parameters
        this.maxDistance = options.maxDistance || 50;
        this.rolloffFactor = options.rolloffFactor || 1;
        this.distanceModel = options.distanceModel || 'inverse';
        
        // Source positions (track ID -> position)
        this.sourcePositions = new Map();
        this.listenerPosition = { x: 0, y: 0, z: 0 };
        this.listenerOrientation = { forwardX: 0, forwardY: 0, forwardZ: -1, upX: 0, upY: 1, upZ: 0 };
        
        // Create nodes
        this.convolver = audioContext.createConvolver();
        this.earlyReflectionsNode = this.createEarlyReflections();
        this.lateReverbNode = this.createLateReverb();
        
        // Master output
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain.gain.value = options.dryLevel || 0.7;
        this.wetGain.gain.value = options.wetLevel || 0.3;
        
        // Pre-delay
        this.preDelay = audioContext.createDelay(0.2);
        this.preDelay.delayTime.value = options.preDelay || 0.02;
        
        // High-frequency damping
        this.dampingFilter = audioContext.createBiquadFilter();
        this.dampingFilter.type = 'lowpass';
        this.dampingFilter.frequency.value = 5000 - this.damping * 4000;
        this.dampingFilter.Q.value = 1;
        
        // Create impulse response
        this.generateImpulseResponse();
    }

    /**
     * Create early reflections processor
     */
    createEarlyReflections() {
        const context = this.audioContext;
        
        // Early reflection delays (based on room geometry)
        const reflectionTimes = this.calculateReflectionTimes();
        
        const delays = reflectionTimes.map(time => {
            const delay = context.createDelay(0.5);
            delay.delayTime.value = time;
            return delay;
        });
        
        const gains = reflectionTimes.map((_, i) => {
            const gain = context.createGain();
            // Reflection amplitude decreases with time
            gain.gain.value = 0.8 * Math.pow(0.7, i);
            return gain;
        });
        
        const pannerNodes = reflectionTimes.map((_, i) => {
            const panner = context.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = 50;
            
            // Position based on reflection angle
            const angle = (i / reflectionTimes.length) * Math.PI * 2;
            panner.positionX.value = Math.cos(angle) * 5;
            panner.positionY.value = 0;
            panner.positionZ.value = Math.sin(angle) * 5;
            
            return panner;
        });
        
        return { delays, gains, pannerNodes };
    }

    /**
     * Create late reverb processor
     */
    createLateReverb() {
        const context = this.audioContext;
        
        // FDN (Feedback Delay Network) based late reverb
        const numDelays = 8;
        const delays = [];
        const feedbackGains = [];
        const filters = [];
        
        for (let i = 0; i < numDelays; i++) {
            const delay = context.createDelay(0.5);
            delay.delayTime.value = 0.02 + Math.random() * 0.08;
            delays.push(delay);
            
            const fbGain = context.createGain();
            fbGain.gain.value = 0.4 + Math.random() * 0.2;
            feedbackGains.push(fbGain);
            
            const filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 3000 + Math.random() * 2000;
            filters.push(filter);
        }
        
        return { delays, feedbackGains, filters };
    }

    /**
     * Calculate early reflection times based on room geometry
     */
    calculateReflectionTimes() {
        const { width, height, depth } = this.roomSize;
        const speedOfSound = 343; // m/s
        
        // Calculate paths for first-order reflections
        const reflections = [];
        
        // Floor reflection
        reflections.push(2 * height / speedOfSound);
        // Ceiling reflection
        reflections.push(2 * height / speedOfSound);
        // Left wall
        reflections.push(2 * width / speedOfSound);
        // Right wall
        reflections.push(2 * width / speedOfSound);
        // Back wall
        reflections.push(2 * depth / speedOfSound);
        // Front wall
        reflections.push(2 * depth / speedOfSound);
        
        // Corner reflections (second-order)
        reflections.push(2 * Math.sqrt(width * width + depth * depth) / speedOfSound);
        reflections.push(2 * Math.sqrt(width * width + height * height) / speedOfSound);
        reflections.push(2 * Math.sqrt(height * height + depth * depth) / speedOfSound);
        
        // Sort by time
        return reflections.sort((a, b) => a - b);
    }

    /**
     * Generate impulse response for convolution reverb
     */
    generateImpulseResponse() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = this.getReverbDuration();
        const length = Math.floor(sampleRate * duration);
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);
        
        // Generate early reflections
        const reflectionTimes = this.calculateReflectionTimes();
        reflectionTimes.forEach((time, i) => {
            const sample = Math.floor(time * sampleRate);
            if (sample < length) {
                const amplitude = 0.8 * Math.pow(0.7, i);
                // Randomize left/right for spatial spread
                left[sample] = amplitude * (1 + Math.random() * 0.5);
                right[sample] = amplitude * (1 + Math.random() * 0.5);
            }
        });
        
        // Generate late reverb tail
        let lastLeft = 0, lastRight = 0;
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            
            // Exponential decay envelope
            const envelope = Math.exp(-t * (3 - this.damping * 2));
            
            // Random noise modulated by envelope
            const noiseL = (Math.random() * 2 - 1) * envelope;
            const noiseR = (Math.random() * 2 - 1) * envelope;
            
            // Add some inter-aural correlation
            const mix = 0.3;
            left[i] += noiseL * (1 - mix) + noiseR * mix;
            right[i] += noiseR * (1 - mix) + noiseL * mix;
            
            // Simple diffusion
            const diffSample = Math.floor(this.diffusion * 10);
            if (i > diffSample) {
                left[i] += left[i - diffSample] * 0.3;
                right[i] += right[i - diffSample] * 0.3;
            }
        }
        
        this.convolver.buffer = impulse;
    }

    /**
     * Get reverb duration based on room type
     */
    getReverbDuration() {
        switch (this.roomType) {
            case 'room': return 1.0;
            case 'hall': return 2.5;
            case 'cathedral': return 5.0;
            case 'cave': return 4.0;
            case 'stadium': return 6.0;
            case 'plate': return 1.5;
            case 'spring': return 2.0;
            default: return 2.5;
        }
    }

    /**
     * Register a sound source position
     */
    setSourcePosition(sourceId, x, y, z) {
        this.sourcePositions.set(sourceId, { x, y, z });
    }

    /**
     * Set listener position
     */
    setListenerPosition(x, y, z) {
        this.listenerPosition = { x, y, z };
    }

    /**
     * Set listener orientation
     */
    setListenerOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ) {
        this.listenerOrientation = { forwardX, forwardY, forwardZ, upX, upY, upZ };
    }

    /**
     * Calculate distance attenuation for a source
     */
    calculateDistanceAttenuation(sourceId) {
        const pos = this.sourcePositions.get(sourceId);
        if (!pos) return 1;
        
        const dx = pos.x - this.listenerPosition.x;
        const dy = pos.y - this.listenerPosition.y;
        const dz = pos.z - this.listenerPosition.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        switch (this.distanceModel) {
            case 'linear':
                return Math.max(0, 1 - this.rolloffFactor * distance / this.maxDistance);
            case 'inverse':
                return 1 / (1 + this.rolloffFactor * (distance - 1));
            case 'exponential':
                return Math.pow(distance / this.maxDistance, -this.rolloffFactor);
            default:
                return 1;
        }
    }

    /**
     * Calculate reverb level based on distance
     */
    calculateReverbLevel(sourceId) {
        const pos = this.sourcePositions.get(sourceId);
        if (!pos) return 1;
        
        const distance = this.getDistance(sourceId);
        
        // Reverb increases with distance (inverse square-ish)
        return Math.min(1, distance / this.maxDistance);
    }

    /**
     * Get distance to source
     */
    getDistance(sourceId) {
        const pos = this.sourcePositions.get(sourceId);
        if (!pos) return 0;
        
        const dx = pos.x - this.listenerPosition.x;
        const dy = pos.y - this.listenerPosition.y;
        const dz = pos.z - this.listenerPosition.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Create input node for a source
     */
    createSourceInput(sourceId) {
        const context = this.audioContext;
        
        // Create panner for this source
        const panner = context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = this.distanceModel;
        panner.refDistance = 1;
        panner.maxDistance = this.maxDistance;
        panner.rolloffFactor = this.rolloffFactor;
        
        // Create gain for dry/wet mix
        const drySend = context.createGain();
        const wetSend = context.createGain();
        
        // Connect dry path
        drySend.connect(this.dryGain);
        
        // Connect wet path through pre-delay and convolver
        wetSend.connect(this.preDelay);
        this.preDelay.connect(this.dampingFilter);
        this.dampingFilter.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        
        return {
            panner,
            drySend,
            wetSend,
            updatePosition: (x, y, z) => {
                panner.positionX.value = x - this.listenerPosition.x;
                panner.positionY.value = y - this.listenerPosition.y;
                panner.positionZ.value = z - this.listenerPosition.z;
                
                this.setSourcePosition(sourceId, x, y, z);
                
                // Update dry/wet balance based on distance
                const reverbLevel = this.calculateReverbLevel(sourceId);
                drySend.gain.value = 1 - reverbLevel * 0.5;
                wetSend.gain.value = reverbLevel;
            }
        };
    }

    /**
     * Connect output to destination
     */
    connect(destination) {
        this.dryGain.connect(destination);
        this.wetGain.connect(destination);
    }

    /**
     * Disconnect
     */
    disconnect() {
        this.dryGain.disconnect();
        this.wetGain.disconnect();
    }

    /**
     * Set room parameters
     */
    setRoom(size, type) {
        if (size) {
            this.roomSize = size;
        }
        if (type) {
            this.roomType = type;
        }
        this.generateImpulseResponse();
    }

    /**
     * Set reverb parameters
     */
    setParams(params) {
        if (params.damping !== undefined) {
            this.damping = params.damping;
            this.dampingFilter.frequency.value = 5000 - this.damping * 4000;
        }
        if (params.diffusion !== undefined) {
            this.diffusion = params.diffusion;
        }
        if (params.dryLevel !== undefined) {
            this.dryGain.gain.value = params.dryLevel;
        }
        if (params.wetLevel !== undefined) {
            this.wetGain.gain.value = params.wetLevel;
        }
        if (params.preDelay !== undefined) {
            this.preDelay.delayTime.value = params.preDelay;
        }
        if (params.roomType !== undefined) {
            this.roomType = params.roomType;
            this.generateImpulseResponse();
        }
    }
}

/**
 * RoomPresets - Predefined room configurations
 */
export const RoomPresets = {
    smallRoom: {
        name: 'Small Room',
        size: { width: 5, height: 2.5, depth: 5 },
        type: 'room',
        damping: 0.7,
        diffusion: 0.4,
        preDelay: 0.005
    },
    studio: {
        name: 'Studio',
        size: { width: 10, height: 3, depth: 8 },
        type: 'room',
        damping: 0.6,
        diffusion: 0.5,
        preDelay: 0.01
    },
    largeHall: {
        name: 'Large Hall',
        size: { width: 30, height: 10, depth: 25 },
        type: 'hall',
        damping: 0.4,
        diffusion: 0.8,
        preDelay: 0.03
    },
    cathedral: {
        name: 'Cathedral',
        size: { width: 50, height: 20, depth: 60 },
        type: 'cathedral',
        damping: 0.2,
        diffusion: 0.9,
        preDelay: 0.05
    },
    cave: {
        name: 'Cave',
        size: { width: 20, height: 8, depth: 30 },
        type: 'cave',
        damping: 0.3,
        diffusion: 0.6,
        preDelay: 0.04
    },
    stadium: {
        name: 'Stadium',
        size: { width: 100, height: 30, depth: 80 },
        type: 'stadium',
        damping: 0.25,
        diffusion: 0.95,
        preDelay: 0.06
    },
    plate: {
        name: 'Plate',
        size: { width: 2, height: 0.5, depth: 2 },
        type: 'plate',
        damping: 0.5,
        diffusion: 0.7,
        preDelay: 0.001
    },
    spring: {
        name: 'Spring',
        size: { width: 0.5, height: 0.1, depth: 0.5 },
        type: 'spring',
        damping: 0.8,
        diffusion: 0.3,
        preDelay: 0.002
    }
};

/**
 * Open spatial reverb panel
 */
export function openSpatialReverbPanel(services = {}) {
    const { audioContext, getDestination, showNotification } = services;
    
    if (!audioContext) {
        console.error('SpatialReverb: audioContext required');
        return null;
    }
    
    // Remove existing panel
    const existing = document.getElementById('spatial-reverb-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'spatial-reverb-panel';
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
        min-width: 700px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const reverb = new SpatialReverb(audioContext);
    const destination = getDestination ? getDestination() : audioContext.destination;
    reverb.connect(destination);
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #fff; margin: 0;">🔊 Spatial Reverb</h2>
            <button id="close-spatial-reverb" style="background: #ef4444; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
        
        <!-- Room Presets -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Room Presets</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${Object.entries(RoomPresets).map(([id, preset]) => `
                    <button class="room-preset-btn" data-id="${id}" style="padding: 8px 16px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        ${preset.name}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <!-- 3D View -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">3D Room View</h3>
            <canvas id="room-canvas" width="650" height="300" style="width: 100%; background: #0a0a14; border-radius: 4px;"></canvas>
        </div>
        
        <!-- Listener Position -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Listener Position</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">X (Left/Right)</label>
                    <input type="range" id="listener-x" min="-20" max="20" step="0.5" value="0" style="width: 100%;">
                    <div id="listener-x-val" style="color: #fff; text-align: center; font-size: 12px;">0.0 m</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Y (Up/Down)</label>
                    <input type="range" id="listener-y" min="0" max="10" step="0.5" value="1.5" style="width: 100%;">
                    <div id="listener-y-val" style="color: #fff; text-align: center; font-size: 12px;">1.5 m</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Z (Front/Back)</label>
                    <input type="range" id="listener-z" min="-30" max="30" step="0.5" value="0" style="width: 100%;">
                    <div id="listener-z-val" style="color: #fff; text-align: center; font-size: 12px;">0.0 m</div>
                </div>
            </div>
        </div>
        
        <!-- Reverb Parameters -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Reverb Parameters</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Dry Level</label>
                    <input type="range" id="dry-level" min="0" max="1" step="0.01" value="0.7" style="width: 100%;">
                    <div id="dry-level-val" style="color: #fff; text-align: center; font-size: 12px;">70%</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Wet Level</label>
                    <input type="range" id="wet-level" min="0" max="1" step="0.01" value="0.3" style="width: 100%;">
                    <div id="wet-level-val" style="color: #fff; text-align: center; font-size: 12px;">30%</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Damping</label>
                    <input type="range" id="damping" min="0" max="1" step="0.01" value="0.5" style="width: 100%;">
                    <div id="damping-val" style="color: #fff; text-align: center; font-size: 12px;">50%</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Pre-Delay</label>
                    <input type="range" id="pre-delay" min="0" max="0.1" step="0.001" value="0.02" style="width: 100%;">
                    <div id="pre-delay-val" style="color: #fff; text-align: center; font-size: 12px;">20 ms</div>
                </div>
            </div>
        </div>
        
        <!-- Room Dimensions -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Room Dimensions</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Width</label>
                    <input type="range" id="room-width" min="2" max="100" step="1" value="20" style="width: 100%;">
                    <div id="room-width-val" style="color: #fff; text-align: center; font-size: 12px;">20 m</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Height</label>
                    <input type="range" id="room-height" min="2" max="30" step="1" value="5" style="width: 100%;">
                    <div id="room-height-val" style="color: #fff; text-align: center; font-size: 12px;">5 m</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Depth</label>
                    <input type="range" id="room-depth" min="2" max="100" step="1" value="15" style="width: 100%;">
                    <div id="room-depth-val" style="color: #fff; text-align: center; font-size: 12px;">15 m</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    const canvas = panel.querySelector('#room-canvas');
    const ctx = canvas.getContext('2d');
    
    // Draw 3D room
    function drawRoom() {
        const width = canvas.width;
        const height = canvas.height;
        const room = reverb.roomSize;
        const listener = reverb.listenerPosition;
        
        // Clear
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);
        
        // Draw room outline (3D perspective)
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = 8;
        
        // Floor
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - room.width * scale / 2, centerY);
        ctx.lineTo(centerX + room.width * scale / 2, centerY);
        ctx.lineTo(centerX + room.width * scale / 2.5, centerY + room.depth * scale / 3);
        ctx.lineTo(centerX - room.width * scale / 2.5, centerY + room.depth * scale / 3);
        ctx.closePath();
        ctx.stroke();
        
        // Back wall
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(centerX - room.width * scale / 2.5, centerY + room.depth * scale / 3);
        ctx.lineTo(centerX - room.width * scale / 2.5, centerY + room.depth * scale / 3 - room.height * scale);
        ctx.lineTo(centerX + room.width * scale / 2.5, centerY + room.depth * scale / 3 - room.height * scale);
        ctx.lineTo(centerX + room.width * scale / 2.5, centerY + room.depth * scale / 3);
        ctx.stroke();
        
        // Side walls
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(centerX - room.width * scale / 2, centerY);
        ctx.lineTo(centerX - room.width * scale / 2, centerY - room.height * scale);
        ctx.lineTo(centerX - room.width * scale / 2.5, centerY + room.depth * scale / 3 - room.height * scale);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX + room.width * scale / 2, centerY);
        ctx.lineTo(centerX + room.width * scale / 2, centerY - room.height * scale);
        ctx.lineTo(centerX + room.width * scale / 2.5, centerY + room.depth * scale / 3 - room.height * scale);
        ctx.stroke();
        
        // Ceiling
        ctx.strokeStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.moveTo(centerX - room.width * scale / 2, centerY - room.height * scale);
        ctx.lineTo(centerX + room.width * scale / 2, centerY - room.height * scale);
        ctx.lineTo(centerX + room.width * scale / 2.5, centerY + room.depth * scale / 3 - room.height * scale);
        ctx.lineTo(centerX - room.width * scale / 2.5, centerY + room.depth * scale / 3 - room.height * scale);
        ctx.closePath();
        ctx.stroke();
        
        // Draw listener position
        const lx = centerX + listener.x * scale / 2;
        const ly = centerY + listener.z * scale / 5;
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(lx, ly, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText('Listener', lx + 12, ly + 4);
        
        // Draw source positions
        let sourceIndex = 0;
        for (const [id, pos] of reverb.sourcePositions) {
            const sx = centerX + pos.x * scale / 2;
            const sy = centerY + pos.z * scale / 5;
            
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#888';
            ctx.fillText(`Source ${sourceIndex + 1}`, sx + 10, sy + 4);
            sourceIndex++;
        }
    }
    
    // Close
    panel.querySelector('#close-spatial-reverb').onclick = () => {
        reverb.disconnect();
        panel.remove();
    };
    
    // Room presets
    panel.querySelectorAll('.room-preset-btn').forEach(btn => {
        btn.onclick = () => {
            const preset = RoomPresets[btn.dataset.id];
            if (preset) {
                reverb.setRoom(preset.size, preset.type);
                reverb.setParams({
                    damping: preset.damping,
                    diffusion: preset.diffusion,
                    preDelay: preset.preDelay
                });
                
                // Update sliders
                panel.querySelector('#room-width').value = preset.size.width;
                panel.querySelector('#room-width-val').textContent = `${preset.size.width} m`;
                panel.querySelector('#room-height').value = preset.size.height;
                panel.querySelector('#room-height-val').textContent = `${preset.size.height} m`;
                panel.querySelector('#room-depth').value = preset.size.depth;
                panel.querySelector('#room-depth-val').textContent = `${preset.size.depth} m`;
                panel.querySelector('#damping').value = preset.damping;
                panel.querySelector('#damping-val').textContent = `${(preset.damping * 100).toFixed(0)}%`;
                panel.querySelector('#pre-delay').value = preset.preDelay;
                panel.querySelector('#pre-delay-val').textContent = `${(preset.preDelay * 1000).toFixed(0)} ms`;
                
                drawRoom();
                if (showNotification) showNotification(`Applied ${preset.name} preset`, 1500);
            }
        };
    });
    
    // Listener position sliders
    ['x', 'y', 'z'].forEach(axis => {
        const slider = panel.querySelector(`#listener-${axis}`);
        const val = panel.querySelector(`#listener-${axis}-val`);
        slider.oninput = () => {
            const value = parseFloat(slider.value);
            const listener = { ...reverb.listenerPosition, [axis]: value };
            reverb.setListenerPosition(listener.x, listener.y, listener.z);
            val.textContent = `${value.toFixed(1)} m`;
            drawRoom();
        };
    });
    
    // Reverb parameter sliders
    const paramSliders = ['dry-level', 'wet-level', 'damping', 'pre-delay'];
    const paramKeys = ['dryLevel', 'wetLevel', 'damping', 'preDelay'];
    paramSliders.forEach((id, i) => {
        const slider = panel.querySelector(`#${id}`);
        const val = panel.querySelector(`#${id}-val`);
        slider.oninput = () => {
            const value = parseFloat(slider.value);
            reverb.setParams({ [paramKeys[i]]: value });
            if (id === 'pre-delay') {
                val.textContent = `${(value * 1000).toFixed(0)} ms`;
            } else {
                val.textContent = `${(value * 100).toFixed(0)}%`;
            }
        };
    });
    
    // Room dimension sliders
    ['width', 'height', 'depth'].forEach(dim => {
        const slider = panel.querySelector(`#room-${dim}`);
        const val = panel.querySelector(`#room-${dim}-val`);
        slider.oninput = () => {
            const value = parseFloat(slider.value);
            const size = { ...reverb.roomSize, [dim]: value };
            reverb.setRoom(size);
            val.textContent = `${value} m`;
            drawRoom();
        };
    });
    
    // Initial draw
    drawRoom();
    
    return reverb;
}

export default SpatialReverb;