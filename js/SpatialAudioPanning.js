/**
 * Spatial Audio Panning - 3D audio positioning
 * Provides 3D audio positioning using Web Audio API PannerNode
 */

class SpatialAudioPanning {
    constructor() {
        this.settings = {
            enabled: false,
            model: 'HRTF', // HRTF, equalpower
            distanceModel: 'inverse', // linear, inverse, exponential
            maxDistance: 10000, // meters
            refDistance: 1, // meters
            rolloffFactor: 1,
            coneInnerAngle: 360, // degrees
            coneOuterAngle: 360,
            coneOuterGain: 0,
            coordinateSystem: 'right-handed' // right-handed, left-handed
        };
        
        this.listener = {
            position: { x: 0, y: 0, z: 0 },
            forward: { x: 0, y: 0, z: -1 },
            up: { x: 0, y: 1, z: 0 },
            velocity: { x: 0, y: 0, z: 0 }
        };
        
        this.sources = new Map(); // Map of source ID to panner configuration
        
        this.presets = [
            { name: 'Concert Hall', settings: { distanceModel: 'inverse', maxDistance: 5000, rolloffFactor: 0.5, refDistance: 5 } },
            { name: 'Small Room', settings: { distanceModel: 'inverse', maxDistance: 100, rolloffFactor: 2, refDistance: 1 } },
            { name: 'Outdoor', settings: { distanceModel: 'linear', maxDistance: 10000, rolloffFactor: 1, refDistance: 10 } },
            { name: 'Headphones', settings: { model: 'HRTF', distanceModel: 'inverse', maxDistance: 100, rolloffFactor: 1.5, refDistance: 1 } },
            { name: 'Speakers', settings: { model: 'equalpower', distanceModel: 'linear', maxDistance: 50, rolloffFactor: 1, refDistance: 1 } }
        ];
        
        this.audioContext = null;
        this.listenerNode = null;
        this.masterPanner = null;
        
        this.init();
    }
    
    init() {
        console.log('[SpatialAudioPanning] Initialized');
    }
    
    // Set audio context
    setAudioContext(ctx) {
        this.audioContext = ctx;
        this.listenerNode = ctx.listener;
        console.log('[SpatialAudioPanning] Audio context set');
    }
    
    // Enable spatial audio
    enable() {
        this.settings.enabled = true;
        
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        this.applyListenerSettings();
        console.log('[SpatialAudioPanning] Enabled');
    }
    
    // Disable spatial audio
    disable() {
        this.settings.enabled = false;
        
        // Reset listener position
        this.setListenerPosition(0, 0, 0);
        
        // Disconnect all panners
        this.sources.forEach(source => {
            if (source.panner) {
                source.panner.disconnect();
            }
        });
        
        console.log('[SpatialAudioPanning] Disabled');
    }
    
    // Apply preset
    applyPreset(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (preset) {
            Object.assign(this.settings, preset.settings);
            this.applyListenerSettings();
            console.log('[SpatialAudioPanning] Applied preset:', presetName);
            return true;
        }
        return false;
    }
    
    // Apply listener settings to audio context
    applyListenerSettings() {
        if (!this.audioContext || !this.listenerNode) return;
        
        // Set listener position
        if (this.listenerNode.positionX) {
            this.listenerNode.positionX.value = this.listener.position.x;
            this.listenerNode.positionY.value = this.listener.position.y;
            this.listenerNode.positionZ.value = this.listener.position.z;
        }
        
        // Set listener orientation
        if (this.listenerNode.forwardX) {
            this.listenerNode.forwardX.value = this.listener.forward.x;
            this.listenerNode.forwardY.value = this.listener.forward.y;
            this.listenerNode.forwardZ.value = this.listener.forward.z;
            this.listenerNode.upX.value = this.listener.up.x;
            this.listenerNode.upY.value = this.listener.up.y;
            this.listenerNode.upZ.value = this.listener.up.z;
        }
    }
    
    // Set listener position
    setListenerPosition(x, y, z) {
        this.listener.position = { x, y, z };
        
        if (this.listenerNode && this.listenerNode.positionX) {
            this.listenerNode.positionX.value = x;
            this.listenerNode.positionY.value = y;
            this.listenerNode.positionZ.value = z;
        }
    }
    
    // Set listener orientation
    setListenerOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ) {
        this.listener.forward = { x: forwardX, y: forwardY, z: forwardZ };
        this.listener.up = { x: upX, y: upY, z: upZ };
        
        if (this.listenerNode && this.listenerNode.forwardX) {
            this.listenerNode.forwardX.value = forwardX;
            this.listenerNode.forwardY.value = forwardY;
            this.listenerNode.forwardZ.value = forwardZ;
            this.listenerNode.upX.value = upX;
            this.listenerNode.upY.value = upY;
            this.listenerNode.upZ.value = upZ;
        }
    }
    
    // Create panner for source
    createPanner(sourceId, sourceNode, position = { x: 0, y: 0, z: 0 }) {
        if (!this.audioContext) {
            console.warn('[SpatialAudioPanning] No audio context');
            return null;
        }
        
        const panner = this.audioContext.createPanner();
        
        // Configure panner
        panner.panningModel = this.settings.model;
        panner.distanceModel = this.settings.distanceModel;
        panner.maxDistance = this.settings.maxDistance;
        panner.refDistance = this.settings.refDistance;
        panner.rolloffFactor = this.settings.rolloffFactor;
        panner.coneInnerAngle = this.settings.coneInnerAngle;
        panner.coneOuterAngle = this.settings.coneOuterAngle;
        panner.coneOuterGain = this.settings.coneOuterGain;
        
        // Set position
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;
        
        // Connect source to panner
        if (sourceNode) {
            sourceNode.connect(panner);
        }
        
        // Store source
        this.sources.set(sourceId, {
            panner,
            position,
            sourceNode
        });
        
        console.log('[SpatialAudioPanning] Created panner for source:', sourceId);
        return panner;
    }
    
    // Set source position
    setSourcePosition(sourceId, x, y, z) {
        const source = this.sources.get(sourceId);
        if (!source || !source.panner) {
            console.warn('[SpatialAudioPanning] Source not found:', sourceId);
            return false;
        }
        
        source.position = { x, y, z };
        source.panner.positionX.value = x;
        source.panner.positionY.value = y;
        source.panner.positionZ.value = z;
        
        return true;
    }
    
    // Set source orientation (for directional sources)
    setSourceOrientation(sourceId, x, y, z) {
        const source = this.sources.get(sourceId);
        if (!source || !source.panner) return false;
        
        source.panner.orientationX.value = x;
        source.panner.orientationY.value = y;
        source.panner.orientationZ.value = z;
        
        return true;
    }
    
    // Move source relative to current position
    moveSource(sourceId, dx, dy, dz) {
        const source = this.sources.get(sourceId);
        if (!source) return false;
        
        const newPos = {
            x: source.position.x + dx,
            y: source.position.y + dy,
            z: source.position.z + dz
        };
        
        return this.setSourcePosition(sourceId, newPos.x, newPos.y, newPos.z);
    }
    
    // Remove source
    removeSource(sourceId) {
        const source = this.sources.get(sourceId);
        if (source && source.panner) {
            source.panner.disconnect();
        }
        this.sources.delete(sourceId);
        console.log('[SpatialAudioPanning] Removed source:', sourceId);
    }
    
    // Connect panner to destination
    connectToDestination(sourceId, destination) {
        const source = this.sources.get(sourceId);
        if (!source || !source.panner) return false;
        
        source.panner.connect(destination || this.audioContext.destination);
        return true;
    }
    
    // Get source position
    getSourcePosition(sourceId) {
        const source = this.sources.get(sourceId);
        return source ? { ...source.position } : null;
    }
    
    // Get all sources
    getSources() {
        const result = [];
        this.sources.forEach((source, id) => {
            result.push({
                id,
                position: { ...source.position }
            });
        });
        return result;
    }
    
    // Convert polar coordinates to Cartesian
    polarToCartesian(azimuth, elevation, distance) {
        // Azimuth: horizontal angle (0 = front, positive = right)
        // Elevation: vertical angle (0 = level, positive = up)
        // Distance: distance from listener
        
        const azRad = azimuth * Math.PI / 180;
        const elRad = elevation * Math.PI / 180;
        
        const x = distance * Math.sin(azRad) * Math.cos(elRad);
        const y = distance * Math.sin(elRad);
        const z = -distance * Math.cos(azRad) * Math.cos(elRad);
        
        return { x, y, z };
    }
    
    // Convert Cartesian coordinates to polar
    cartesianToPolar(x, y, z) {
        const distance = Math.sqrt(x * x + y * y + z * z);
        const azimuth = Math.atan2(x, -z) * 180 / Math.PI;
        const elevation = Math.asin(y / distance) * 180 / Math.PI;
        
        return { azimuth, elevation, distance };
    }
    
    // Set source position in polar coordinates
    setSourcePolar(sourceId, azimuth, elevation, distance) {
        const cartesian = this.polarToCartesian(azimuth, elevation, distance);
        return this.setSourcePosition(sourceId, cartesian.x, cartesian.y, cartesian.z);
    }
    
    // Create automation for moving source
    createSourceAutomation(sourceId, path, duration) {
        const source = this.sources.get(sourceId);
        if (!source || !source.panner) return false;
        
        const ctx = this.audioContext;
        const startTime = ctx.currentTime;
        
        // Create automation for each axis
        const xValues = path.map(p => p.x);
        const yValues = path.map(p => p.y);
        const zValues = path.map(p => p.z);
        const times = path.map((_, i) => startTime + (i / (path.length - 1)) * duration);
        
        // Cancel any existing automation
        source.panner.positionX.cancelScheduledValues(startTime);
        source.panner.positionY.cancelScheduledValues(startTime);
        source.panner.positionZ.cancelScheduledValues(startTime);
        
        // Schedule new values
        for (let i = 0; i < path.length; i++) {
            source.panner.positionX.setValueAtTime(xValues[i], times[i]);
            source.panner.positionY.setValueAtTime(yValues[i], times[i]);
            source.panner.positionZ.setValueAtTime(zValues[i], times[i]);
        }
        
        return true;
    }
    
    // Set source in a circle around listener
    setSourceCircle(sourceId, radius, angle) {
        const x = radius * Math.cos(angle * Math.PI / 180);
        const z = radius * Math.sin(angle * Math.PI / 180);
        return this.setSourcePosition(sourceId, x, 0, z);
    }
    
    // Get listener position
    getListenerPosition() {
        return { ...this.listener.position };
    }
    
    // Get listener orientation
    getListenerOrientation() {
        return {
            forward: { ...this.listener.forward },
            up: { ...this.listener.up }
        };
    }
    
    // Update settings
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        this.applyListenerSettings();
        
        // Update all existing panners
        this.sources.forEach(source => {
            if (source.panner) {
                source.panner.panningModel = this.settings.model;
                source.panner.distanceModel = this.settings.distanceModel;
                source.panner.maxDistance = this.settings.maxDistance;
                source.panner.refDistance = this.settings.refDistance;
                source.panner.rolloffFactor = this.settings.rolloffFactor;
            }
        });
        
        console.log('[SpatialAudioPanning] Settings updated');
    }
    
    // Get settings
    getSettings() {
        return { ...this.settings };
    }
    
    // Get presets
    getPresets() {
        return [...this.presets];
    }
    
    // Calculate distance between listener and source
    getDistanceToSource(sourceId) {
        const sourcePos = this.getSourcePosition(sourceId);
        if (!sourcePos) return null;
        
        const dx = sourcePos.x - this.listener.position.x;
        const dy = sourcePos.y - this.listener.position.y;
        const dz = sourcePos.z - this.listener.position.z;
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    // Get direction to source (azimuth and elevation)
    getDirectionToSource(sourceId) {
        const sourcePos = this.getSourcePosition(sourceId);
        if (!sourcePos) return null;
        
        const dx = sourcePos.x - this.listener.position.x;
        const dy = sourcePos.y - this.listener.position.y;
        const dz = sourcePos.z - this.listener.position.z;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const azimuth = Math.atan2(dx, -dz) * 180 / Math.PI;
        const elevation = Math.asin(dy / distance) * 180 / Math.PI;
        
        return { azimuth, elevation, distance };
    }
}

// UI Panel function
function openSpatialAudioPanel() {
    const existing = document.getElementById('spatial-audio-panel');
    if (existing) {
        existing.remove();
    }
    
    const spatial = window.spatialAudioPanning || new SpatialAudioPanning();
    window.spatialAudioPanning = spatial;
    
    const panel = document.createElement('div');
    panel.id = 'spatial-audio-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const settings = spatial.getSettings();
    const presets = spatial.getPresets();
    const sources = spatial.getSources();
    const listenerPos = spatial.getListenerPosition();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 20px;">🔊 Spatial Audio Panning</h2>
            <button id="close-spatial-audio" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input type="checkbox" id="spatial-enabled" ${settings.enabled ? 'checked' : ''} style="width: 24px; height: 24px;">
                <span style="color: #fff; font-size: 16px;">Enable 3D Spatial Audio</span>
            </label>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Preset Environment</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${presets.map(p => `
                    <button class="preset-btn" data-preset="${p.name}" style="
                        padding: 8px 16px;
                        background: #2a2a4e;
                        border: 1px solid #444;
                        color: #fff;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">${p.name}</button>
                `).join('')}
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Panning Model</label>
                <select id="panning-model" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="HRTF" ${settings.model === 'HRTF' ? 'selected' : ''}>HRTF (Headphones)</option>
                    <option value="equalpower" ${settings.model === 'equalpower' ? 'selected' : ''}>Equal Power (Speakers)</option>
                </select>
            </div>
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Distance Model</label>
                <select id="distance-model" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="inverse" ${settings.distanceModel === 'inverse' ? 'selected' : ''}>Inverse</option>
                    <option value="linear" ${settings.distanceModel === 'linear' ? 'selected' : ''}>Linear</option>
                    <option value="exponential" ${settings.distanceModel === 'exponential' ? 'selected' : ''}>Exponential</option>
                </select>
            </div>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 16px; color: #fff; font-size: 14px;">Listener Position</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                <div>
                    <label style="display: block; color: #a0a0a0; margin-bottom: 4px; font-size: 12px;">X</label>
                    <input type="number" id="listener-x" value="${listenerPos.x}" step="0.1" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                </div>
                <div>
                    <label style="display: block; color: #a0a0a0; margin-bottom: 4px; font-size: 12px;">Y</label>
                    <input type="number" id="listener-y" value="${listenerPos.y}" step="0.1" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                </div>
                <div>
                    <label style="display: block; color: #a0a0a0; margin-bottom: 4px; font-size: 12px;">Z</label>
                    <input type="number" id="listener-z" value="${listenerPos.z}" step="0.1" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                </div>
            </div>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 16px; color: #fff; font-size: 14px;">Source Positions</h3>
            <div id="sources-list" style="max-height: 150px; overflow-y: auto;">
                ${sources.length === 0 ? '<div style="color: #888; text-align: center;">No sources configured</div>' : 
                    sources.map(s => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #1a1a2e; border-radius: 4px; margin-bottom: 4px;">
                            <span style="color: #fff;">${s.id}</span>
                            <span style="color: #10b981;">(${s.position.x.toFixed(1)}, ${s.position.y.toFixed(1)}, ${s.position.z.toFixed(1)})</span>
                        </div>
                    `).join('')
                }
            </div>
            <div style="margin-top: 12px;">
                <button id="add-source-btn" style="width: 100%; padding: 8px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                    Add Source
                </button>
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Max Distance</label>
            <input type="range" id="max-distance" min="10" max="10000" value="${settings.maxDistance}" style="width: 100%;">
            <span style="color: #10b981;">${settings.maxDistance}m</span>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Rolloff Factor</label>
            <input type="range" id="rolloff-factor" min="0.1" max="10" step="0.1" value="${settings.rolloffFactor}" style="width: 100%;">
            <span style="color: #10b981;">${settings.rolloffFactor}</span>
        </div>
        
        <div style="display: flex; gap: 12px;">
            <button id="test-spatial-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Test Spatial Audio
            </button>
            <button id="reset-spatial-btn" style="flex: 1; padding: 12px; background: #6b7280; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Reset
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-spatial-audio').onclick = () => panel.remove();
    
    document.getElementById('spatial-enabled').onchange = (e) => {
        if (e.target.checked) {
            spatial.enable();
        } else {
            spatial.disable();
        }
    };
    
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            spatial.applyPreset(btn.dataset.preset);
            panel.remove();
            openSpatialAudioPanel();
        };
    });
    
    // Model selects
    document.getElementById('panning-model').onchange = (e) => {
        spatial.updateSettings({ model: e.target.value });
    };
    
    document.getElementById('distance-model').onchange = (e) => {
        spatial.updateSettings({ distanceModel: e.target.value });
    };
    
    // Listener position
    ['listener-x', 'listener-y', 'listener-z'].forEach(id => {
        document.getElementById(id).onchange = () => {
            const x = parseFloat(document.getElementById('listener-x').value);
            const y = parseFloat(document.getElementById('listener-y').value);
            const z = parseFloat(document.getElementById('listener-z').value);
            spatial.setListenerPosition(x, y, z);
        };
    });
    
    // Range inputs
    document.getElementById('max-distance').oninput = (e) => {
        spatial.updateSettings({ maxDistance: parseFloat(e.target.value) });
        e.target.nextElementSibling.textContent = `${e.target.value}m`;
    };
    
    document.getElementById('rolloff-factor').oninput = (e) => {
        spatial.updateSettings({ rolloffFactor: parseFloat(e.target.value) });
        e.target.nextElementSibling.textContent = e.target.value;
    };
    
    // Add source button
    document.getElementById('add-source-btn').onclick = () => {
        const sourceId = `source-${Date.now()}`;
        spatial.createPanner(sourceId, null, { x: 0, y: 0, z: -5 });
        panel.remove();
        openSpatialAudioPanel();
    };
    
    // Test button
    document.getElementById('test-spatial-btn').onclick = () => {
        alert('Spatial audio test would play sound moving around the listener');
    };
    
    // Reset button
    document.getElementById('reset-spatial-btn').onclick = () => {
        spatial.setListenerPosition(0, 0, 0);
        spatial.updateSettings({
            model: 'HRTF',
            distanceModel: 'inverse',
            maxDistance: 10000,
            rolloffFactor: 1
        });
        panel.remove();
        openSpatialAudioPanel();
    };
    
    return spatial;
}

// Initialize
function initSpatialAudioPanning() {
    if (!window.spatialAudioPanning) {
        window.spatialAudioPanning = new SpatialAudioPanning();
    }
    return window.spatialAudioPanning;
}

// Export
window.SpatialAudioPanning = SpatialAudioPanning;
window.spatialAudioPanning = new SpatialAudioPanning();
window.openSpatialAudioPanel = openSpatialAudioPanel;
window.initSpatialAudioPanning = initSpatialAudioPanning;