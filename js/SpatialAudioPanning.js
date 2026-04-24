/**
 * SpatialAudioPanning.js
 * 3D audio positioning with distance attenuation
 * Provides immersive spatial audio with listener position tracking
 */

export class SpatialAudioPanner {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.enabled = options.enabled ?? true;
        
        // Source position in 3D space (x, y, z)
        this.position = {
            x: options.x ?? 0,
            y: options.y ?? 0,
            z: options.z ?? 0
        };
        
        // Listener position (defaults to center)
        this.listenerPosition = {
            x: options.listenerX ?? 0,
            y: options.listenerY ?? 0,
            z: options.listenerZ ?? 0
        };
        
        // Spatial parameters
        this.settings = {
            // Distance attenuation
            refDistance: options.refDistance ?? 1.0,    // Reference distance for attenuation
            maxDistance: options.maxDistance ?? 10000, // Maximum distance (no sound beyond)
            rolloffFactor: options.rolloffFactor ?? 1.0, // Attenuation curve
            
            // Cone settings (directional sound)
            coneInnerAngle: options.coneInnerAngle ?? 360,  // Full omni by default
            coneOuterAngle: options.coneOuterAngle ?? 360,
            coneOuterGain: options.coneOuterGain ?? 0,
            
            // Panning model
            panningModel: options.panningModel ?? 'HRTF', // 'HRTF' or 'equalpower'
            distanceModel: options.distanceModel ?? 'inverse', // 'linear', 'inverse', 'exponential'
            
            // Doppler effect
            dopplerEnabled: options.dopplerEnabled ?? true,
            speedOfSound: options.speedOfSound ?? 343.3, // m/s
            
            // Room simulation
            roomSize: options.roomSize ?? 0.5,
            roomDamping: options.roomDamping ?? 0.5
        };
        
        // Velocity for Doppler
        this.velocity = { x: 0, y: 0, z: 0 };
        this.listenerVelocity = { x: 0, y: 0, z: 0 };
        
        // Audio nodes
        this.pannerNode = null;
        this.gainNode = null;
        this.convolverNode = null; // For room reverb
        this.dryGain = null;
        this.wetGain = null;
        
        this.inputNode = null;
        this.outputNode = null;
        
        this._initialized = false;
        this._previousPosition = { ...this.position };
        this._lastUpdateTime = 0;
    }
    
    async init() {
        if (this._initialized) return;
        
        // Create panner node
        this.pannerNode = this.audioContext.createPanner();
        this.pannerNode.panningModel = this.settings.panningModel;
        this.pannerNode.distanceModel = this.settings.distanceModel;
        this.pannerNode.refDistance = this.settings.refDistance;
        this.pannerNode.maxDistance = this.settings.maxDistance;
        this.pannerNode.rolloffFactor = this.settings.rolloffFactor;
        this.pannerNode.coneInnerAngle = this.settings.coneInnerAngle;
        this.pannerNode.coneOuterAngle = this.settings.coneOuterAngle;
        this.pannerNode.coneOuterGain = this.settings.coneOuterGain;
        
        // Set initial position
        this.pannerNode.positionX.value = this.position.x;
        this.pannerNode.positionY.value = this.position.y;
        this.pannerNode.positionZ.value = this.position.z;
        
        // Create gain node for overall level control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.enabled ? 1.0 : 0;
        
        // Create room simulation (convolver)
        this.convolverNode = this.audioContext.createConvolver();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Generate simple room impulse response
        await this._createRoomIR();
        
        // Connect nodes
        // Dry path: input -> panner -> dryGain -> output
        // Wet path: input -> convolver -> wetGain -> output
        
        // For now, simple routing through panner
        this.inputNode = this.gainNode;
        this.gainNode.connect(this.pannerNode);
        this.pannerNode.connect(this.dryGain);
        this.dryGain.gain.value = 1 - this.settings.roomSize;
        
        this.convolverNode.connect(this.wetGain);
        this.wetGain.gain.value = this.settings.roomSize;
        
        this.outputNode = this.audioContext.createGain();
        this.dryGain.connect(this.outputNode);
        this.wetGain.connect(this.outputNode);
        
        // Set up listener
        this._updateListener();
        
        this._initialized = true;
    }
    
    async _createRoomIR() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.5 + this.settings.roomSize * 1.5; // 0.5 to 2 seconds
        const length = Math.floor(sampleRate * duration);
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponential decay
                const t = i / sampleRate;
                const decay = Math.exp(-t * (2 + this.settings.roomDamping * 8));
                
                // Add some randomness
                const noise = (Math.random() * 2 - 1) * decay;
                
                // Add early reflections
                if (i < sampleRate * 0.1) {
                    const reflection = Math.sin(i * 0.1) * decay * 0.5;
                    channelData[i] = noise + reflection;
                } else {
                    channelData[i] = noise;
                }
            }
        }
        
        this.convolverNode.buffer = impulse;
    }
    
    _updateListener() {
        const listener = this.audioContext.listener;
        
        // Set listener position
        if (listener.positionX) {
            listener.positionX.value = this.listenerPosition.x;
            listener.positionY.value = this.listenerPosition.y;
            listener.positionZ.value = this.listenerPosition.z;
        } else {
            // Fallback for older implementations
            listener.setPosition(
                this.listenerPosition.x,
                this.listenerPosition.y,
                this.listenerPosition.z
            );
        }
        
        // Set listener orientation (facing forward)
        if (listener.forwardX) {
            listener.forwardX.value = 0;
            listener.forwardY.value = 0;
            listener.forwardZ.value = -1;
            listener.upX.value = 0;
            listener.upY.value = 1;
            listener.upZ.value = 0;
        } else {
            listener.setOrientation(0, 0, -1, 0, 1, 0);
        }
    }
    
    /**
     * Set source position in 3D space
     */
    setPosition(x, y, z) {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
        
        if (this.pannerNode) {
            this.pannerNode.positionX.setValueAtTime(x, this.audioContext.currentTime);
            this.pannerNode.positionY.setValueAtTime(y, this.audioContext.currentTime);
            this.pannerNode.positionZ.setValueAtTime(z, this.audioContext.currentTime);
        }
    }
    
    /**
     * Set source velocity for Doppler effect
     */
    setVelocity(vx, vy, vz) {
        this.velocity.x = vx;
        this.velocity.y = vy;
        this.velocity.z = vz;
        
        if (this.pannerNode && this.settings.dopplerEnabled) {
            // Note: Doppler effect support varies by browser
            if (this.pannerNode.velocityX) {
                this.pannerNode.velocityX.value = vx;
                this.pannerNode.velocityY.value = vy;
                this.pannerNode.velocityZ.value = vz;
            }
        }
    }
    
    /**
     * Set listener position
     */
    setListenerPosition(x, y, z) {
        this.listenerPosition.x = x;
        this.listenerPosition.y = y;
        this.listenerPosition.z = z;
        this._updateListener();
    }
    
    /**
     * Set listener velocity for Doppler effect
     */
    setListenerVelocity(vx, vy, vz) {
        this.listenerVelocity.x = vx;
        this.listenerVelocity.y = vy;
        this.listenerVelocity.z = vz;
        
        const listener = this.audioContext.listener;
        if (listener.velocityX && this.settings.dopplerEnabled) {
            listener.velocityX.value = vx;
            listener.velocityY.value = vy;
            listener.velocityZ.value = vz;
        }
    }
    
    /**
     * Move source in a direction
     */
    move(dx, dy, dz) {
        this.setPosition(
            this.position.x + dx,
            this.position.y + dy,
            this.position.z + dz
        );
    }
    
    /**
     * Set source to orbit around a point
     */
    orbitAround(centerX, centerY, centerZ, radius, angle) {
        const x = centerX + radius * Math.cos(angle);
        const y = centerY;
        const z = centerZ + radius * Math.sin(angle);
        this.setPosition(x, y, z);
    }
    
    /**
     * Update distance model settings
     */
    setDistanceSettings(settings) {
        Object.assign(this.settings, settings);
        
        if (this.pannerNode) {
            if (settings.refDistance !== undefined) {
                this.pannerNode.refDistance = settings.refDistance;
            }
            if (settings.maxDistance !== undefined) {
                this.pannerNode.maxDistance = settings.maxDistance;
            }
            if (settings.rolloffFactor !== undefined) {
                this.pannerNode.rolloffFactor = settings.rolloffFactor;
            }
            if (settings.distanceModel !== undefined) {
                this.pannerNode.distanceModel = settings.distanceModel;
            }
        }
    }
    
    /**
     * Set directional cone settings
     */
    setConeSettings(innerAngle, outerAngle, outerGain) {
        this.settings.coneInnerAngle = innerAngle;
        this.settings.coneOuterAngle = outerAngle;
        this.settings.coneOuterGain = outerGain;
        
        if (this.pannerNode) {
            this.pannerNode.coneInnerAngle = innerAngle;
            this.pannerNode.coneOuterAngle = outerAngle;
            this.pannerNode.coneOuterGain = outerGain;
        }
    }
    
    /**
     * Set room simulation parameters
     */
    setRoomSettings(roomSize, roomDamping) {
        this.settings.roomSize = roomSize;
        this.settings.roomDamping = roomDamping;
        
        if (this.dryGain && this.wetGain) {
            this.dryGain.gain.value = 1 - roomSize;
            this.wetGain.gain.value = roomSize;
        }
    }
    
    /**
     * Enable/disable spatial audio
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.gainNode) {
            this.gainNode.gain.value = enabled ? 1.0 : 0;
        }
    }
    
    /**
     * Calculate current distance from listener
     */
    getDistanceFromListener() {
        const dx = this.position.x - this.listenerPosition.x;
        const dy = this.position.y - this.listenerPosition.y;
        const dz = this.position.z - this.listenerPosition.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    /**
     * Get angle from listener (in radians)
     */
    getAngleFromListener() {
        const dx = this.position.x - this.listenerPosition.x;
        const dz = this.position.z - this.listenerPosition.z;
        return Math.atan2(dx, -dz); // -Z is forward
    }
    
    /**
     * Get elevation from listener (in radians)
     */
    getElevationFromListener() {
        const dy = this.position.y - this.listenerPosition.y;
        const distance = this.getDistanceFromListener();
        if (distance === 0) return 0;
        return Math.asin(dy / distance);
    }
    
    /**
     * Calculate gain at current distance
     */
    calculateDistanceGain() {
        const distance = this.getDistanceFromListener();
        const { refDistance, maxDistance, rolloffFactor, distanceModel } = this.settings;
        
        if (distance <= refDistance) return 1.0;
        if (distance >= maxDistance) return 0;
        
        switch (distanceModel) {
            case 'linear':
                return 1 - rolloffFactor * (distance - refDistance) / (maxDistance - refDistance);
            case 'inverse':
                return refDistance / (refDistance + rolloffFactor * (distance - refDistance));
            case 'exponential':
                return Math.pow(distance / refDistance, -rolloffFactor);
            default:
                return 1.0;
        }
    }
    
    /**
     * Create a 2D stereo spread from a list of sources
     * Useful for placing multiple tracks in stereo field
     */
    static createStereoSpread(audioContext, numSources, spreadWidth = 10) {
        const panners = [];
        for (let i = 0; i < numSources; i++) {
            const angle = (i / (numSources - 1 || 1)) * Math.PI - Math.PI / 2;
            const x = Math.sin(angle) * spreadWidth;
            const z = -Math.cos(angle) * spreadWidth;
            
            const panner = new SpatialAudioPanner(audioContext, { x, y: 0, z });
            panners.push(panner);
        }
        return panners;
    }
    
    /**
     * Create a circular arrangement around the listener
     */
    static createCircularArrangement(audioContext, numSources, radius = 5) {
        const panners = [];
        for (let i = 0; i < numSources; i++) {
            const angle = (i / numSources) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const panner = new SpatialAudioPanner(audioContext, { x, y: 0, z });
            panners.push(panner);
        }
        return panners;
    }
    
    /**
     * Connect audio source to this spatial panner
     */
    connect(source) {
        if (!this._initialized) {
            console.warn('SpatialAudioPanner not initialized. Call init() first.');
            return;
        }
        source.connect(this.inputNode);
    }
    
    /**
     * Connect this panner to destination
     */
    connectTo(destination) {
        if (!this._initialized) {
            console.warn('SpatialAudioPanner not initialized. Call init() first.');
            return;
        }
        this.outputNode.connect(destination);
    }
    
    /**
     * Disconnect from destination
     */
    disconnect() {
        if (this.outputNode) {
            this.outputNode.disconnect();
        }
    }
    
    /**
     * Serialize settings for save/load
     */
    serialize() {
        return {
            enabled: this.enabled,
            position: { ...this.position },
            listenerPosition: { ...this.listenerPosition },
            settings: { ...this.settings },
            velocity: { ...this.velocity },
            listenerVelocity: { ...this.listenerVelocity }
        };
    }
    
    /**
     * Restore from serialized settings
     */
    async restore(data) {
        this.enabled = data.enabled ?? true;
        this.position = { ...data.position } || { x: 0, y: 0, z: 0 };
        this.listenerPosition = { ...data.listenerPosition } || { x: 0, y: 0, z: 0 };
        this.settings = { ...this.settings, ...data.settings };
        this.velocity = { ...data.velocity } || { x: 0, y: 0, z: 0 };
        this.listenerVelocity = { ...data.listenerVelocity } || { x: 0, y: 0, z: 0 };
        
        if (this._initialized) {
            this.setPosition(this.position.x, this.position.y, this.position.z);
            this.setListenerPosition(this.listenerPosition.x, this.listenerPosition.y, this.listenerPosition.z);
            this._updateListener();
        }
    }
    
    destroy() {
        this.disconnect();
        if (this.pannerNode) {
            this.pannerNode.disconnect();
            this.pannerNode = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.convolverNode) {
            this.convolverNode.disconnect();
            this.convolverNode = null;
        }
        if (this.dryGain) {
            this.dryGain.disconnect();
            this.dryGain = null;
        }
        if (this.wetGain) {
            this.wetGain.disconnect();
            this.wetGain = null;
        }
        if (this.outputNode) {
            this.outputNode.disconnect();
            this.outputNode = null;
        }
        this._initialized = false;
    }
}

/**
 * SpatialAudioManager - Manages multiple spatial audio sources
 */
export class SpatialAudioManager {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sources = new Map(); // id -> SpatialAudioPanner
        this.masterGain = audioContext.createGain();
        this.masterGain.connect(audioContext.destination);
        
        this.listenerPosition = { x: 0, y: 0, z: 0 };
        this.globalSettings = {
            refDistance: 1.0,
            maxDistance: 10000,
            rolloffFactor: 1.0,
            distanceModel: 'inverse',
            panningModel: 'HRTF'
        };
    }
    
    /**
     * Add a spatial audio source
     */
    async addSource(id, options = {}) {
        const panner = new SpatialAudioPanner(this.audioContext, {
            ...this.globalSettings,
            ...options,
            listenerX: this.listenerPosition.x,
            listenerY: this.listenerPosition.y,
            listenerZ: this.listenerPosition.z
        });
        
        await panner.init();
        panner.connectTo(this.masterGain);
        
        this.sources.set(id, panner);
        return panner;
    }
    
    /**
     * Remove a spatial audio source
     */
    removeSource(id) {
        const source = this.sources.get(id);
        if (source) {
            source.destroy();
            this.sources.delete(id);
        }
    }
    
    /**
     * Get a source by ID
     */
    getSource(id) {
        return this.sources.get(id);
    }
    
    /**
     * Update global listener position
     */
    setListenerPosition(x, y, z) {
        this.listenerPosition = { x, y, z };
        this.sources.forEach(source => {
            source.setListenerPosition(x, y, z);
        });
    }
    
    /**
     * Update all sources with new global settings
     */
    updateGlobalSettings(settings) {
        Object.assign(this.globalSettings, settings);
        this.sources.forEach(source => {
            source.setDistanceSettings(settings);
        });
    }
    
    /**
     * Set master volume for all spatial sources
     */
    setMasterVolume(volume) {
        this.masterGain.gain.value = volume;
    }
    
    /**
     * Get all source IDs
     */
    getSourceIds() {
        return Array.from(this.sources.keys());
    }
    
    /**
     * Serialize entire manager state
     */
    serialize() {
        const sourcesData = {};
        this.sources.forEach((source, id) => {
            sourcesData[id] = source.serialize();
        });
        
        return {
            listenerPosition: { ...this.listenerPosition },
            globalSettings: { ...this.globalSettings },
            sources: sourcesData
        };
    }
    
    /**
     * Restore manager state
     */
    async restore(data) {
        this.setListenerPosition(
            data.listenerPosition.x,
            data.listenerPosition.y,
            data.listenerPosition.z
        );
        
        this.updateGlobalSettings(data.globalSettings);
        
        // Restore individual sources
        for (const [id, sourceData] of Object.entries(data.sources || {})) {
            if (this.sources.has(id)) {
                const source = this.sources.get(id);
                await source.restore(sourceData);
            }
        }
    }
    
    destroy() {
        this.sources.forEach(source => source.destroy());
        this.sources.clear();
        this.masterGain.disconnect();
    }
}

export default SpatialAudioPanner;