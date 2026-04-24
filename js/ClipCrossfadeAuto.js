/**
 * ClipCrossfadeAuto.js
 * Automatic crossfade between overlapping clips
 * Smoothly transitions between overlapping audio regions
 */

export class ClipCrossfadeAuto {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.enabled = options.enabled ?? true;
        
        // Crossfade settings
        this.settings = {
            fadeDuration: options.fadeDuration ?? 0.02,      // Default 20ms
            curveType: options.curveType ?? 'equal_power',   // 'linear', 'equal_power', 'exponential', 'smooth'
            autoDetect: options.autoDetect ?? true,          // Auto-detect overlapping clips
            minOverlap: options.minOverlap ?? 0.001,         // Minimum overlap to trigger crossfade
            maxFadeDuration: options.maxFadeDuration ?? 0.5,  // Maximum fade duration
            respectClipBoundaries: options.respectClipBoundaries ?? true
        };
        
        // Crossfade curves
        this.curves = {
            linear: (t) => t,
            equal_power: (t) => Math.sqrt(t),
            exponential: (t) => t * t,
            smooth: (t) => t * t * (3 - 2 * t), // Smoothstep
            s_curve: (t) => 1 / (1 + Math.exp(-10 * (t - 0.5)))
        };
        
        // Active crossfades
        this.activeCrossfades = new Map(); // crossfadeId -> crossfadeData
        
        // Callbacks
        this.onCrossfadeStart = options.onCrossfadeStart ?? null;
        this.onCrossfadeEnd = options.onCrossfadeEnd ?? null;
    }
    
    /**
     * Detect overlapping clips and create crossfades
     * @param {Array} clips - Array of clip objects with startTime, duration, trackId
     * @returns {Array} Array of detected overlaps
     */
    detectOverlaps(clips) {
        const overlaps = [];
        
        // Sort clips by start time
        const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
        
        for (let i = 0; i < sortedClips.length; i++) {
            const clipA = sortedClips[i];
            const clipAEnd = clipA.startTime + clipA.duration;
            
            for (let j = i + 1; j < sortedClips.length; j++) {
                const clipB = sortedClips[j];
                
                // Skip if same track (only crossfade between tracks or on same track edges)
                if (this.settings.respectClipBoundaries && clipA.trackId === clipB.trackId) {
                    // Check for exact edge overlap (back-to-back clips)
                    if (Math.abs(clipAEnd - clipB.startTime) < this.settings.minOverlap) {
                        // Edge overlap - perfect crossfade candidate
                        overlaps.push({
                            clipA: clipA,
                            clipB: clipB,
                            overlapStart: clipAEnd,
                            overlapEnd: clipAEnd,
                            overlapDuration: 0,
                            type: 'edge'
                        });
                    }
                    continue;
                }
                
                const clipBEnd = clipB.startTime + clipB.duration;
                
                // Check for overlap
                if (clipB.startTime < clipAEnd) {
                    const overlapStart = clipB.startTime;
                    const overlapEnd = Math.min(clipAEnd, clipBEnd);
                    const overlapDuration = overlapEnd - overlapStart;
                    
                    if (overlapDuration >= this.settings.minOverlap) {
                        overlaps.push({
                            clipA: clipA,
                            clipB: clipB,
                            overlapStart: overlapStart,
                            overlapEnd: overlapEnd,
                            overlapDuration: overlapDuration,
                            type: 'overlap'
                        });
                    }
                }
            }
        }
        
        return overlaps;
    }
    
    /**
     * Create crossfade between two clips
     * @param {Object} clipA - First clip (outgoing)
     * @param {Object} clipB - Second clip (incoming)
     * @param {Object} overlap - Overlap information
     * @returns {Object} Crossfade configuration
     */
    createCrossfade(clipA, clipB, overlap) {
        const crossfadeId = `xf_${clipA.id}_${clipB.id}_${Date.now()}`;
        
        // Determine fade duration
        let fadeDuration = this.settings.fadeDuration;
        
        if (overlap.type === 'overlap' && overlap.overlapDuration > 0) {
            // Use overlap duration for crossfade
            fadeDuration = Math.min(
                overlap.overlapDuration / 2,
                this.settings.maxFadeDuration
            );
        }
        
        // Create crossfade configuration
        const crossfade = {
            id: crossfadeId,
            clipA: {
                id: clipA.id,
                fadeOutStart: overlap.overlapStart,
                fadeOutDuration: fadeDuration,
                fadeOutEnd: overlap.overlapStart + fadeDuration,
                gainCurve: []
            },
            clipB: {
                id: clipB.id,
                fadeInStart: overlap.overlapStart,
                fadeInDuration: fadeDuration,
                fadeInEnd: overlap.overlapStart + fadeDuration,
                gainCurve: []
            },
            overlap: overlap,
            fadeDuration: fadeDuration,
            curveType: this.settings.curveType,
            active: false
        };
        
        // Generate gain curves
        this._generateGainCurves(crossfade);
        
        return crossfade;
    }
    
    /**
     * Generate gain curves for crossfade
     */
    _generateGainCurves(crossfade) {
        const curve = this.curves[crossfade.curveType] || this.curves.equal_power;
        const steps = 100;
        
        // Fade out curve for clip A (1 -> 0)
        crossfade.clipA.gainCurve = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const gain = curve(1 - t);
            crossfade.clipA.gainCurve.push(gain);
        }
        
        // Fade in curve for clip B (0 -> 1)
        crossfade.clipB.gainCurve = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const gain = curve(t);
            crossfade.clipB.gainCurve.push(gain);
        }
    }
    
    /**
     * Apply crossfade to audio buffers
     * @param {AudioBuffer} bufferA - First clip buffer
     * @param {AudioBuffer} bufferB - Second clip buffer
     * @param {Object} crossfade - Crossfade configuration
     * @returns {AudioBuffer} Mixed buffer with crossfade applied
     */
    applyCrossfadeToBuffers(bufferA, bufferB, crossfade) {
        const sampleRate = bufferA.sampleRate;
        const fadeSamples = Math.floor(crossfade.fadeDuration * sampleRate);
        
        // Determine output buffer length
        const outputLength = Math.max(bufferA.length, bufferB.length);
        
        // Create output buffer
        const outputBuffer = this.audioContext.createBuffer(
            Math.max(bufferA.numberOfChannels, bufferB.numberOfChannels),
            outputLength,
            sampleRate
        );
        
        // Calculate fade start positions
        const fadeAStartSample = Math.floor(crossfade.clipA.fadeOutStart * sampleRate);
        const fadeBStartSample = Math.floor(crossfade.clipB.fadeInStart * sampleRate);
        
        // Apply crossfade
        for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
            const outputData = outputBuffer.getChannelData(channel);
            const dataA = channel < bufferA.numberOfChannels ? bufferA.getChannelData(channel) : null;
            const dataB = channel < bufferB.numberOfChannels ? bufferB.getChannelData(channel) : null;
            
            for (let i = 0; i < outputLength; i++) {
                let sample = 0;
                
                // Get sample from buffer A
                if (dataA && i < dataA.length) {
                    let gain = 1;
                    
                    // Apply fade out if in fade region
                    if (i >= fadeAStartSample && i < fadeAStartSample + fadeSamples) {
                        const fadeIndex = Math.floor((i - fadeAStartSample) / fadeSamples * 100);
                        gain = crossfade.clipA.gainCurve[Math.min(fadeIndex, 99)];
                    } else if (i >= fadeAStartSample + fadeSamples) {
                        gain = 0; // After fade out
                    }
                    
                    sample += dataA[i] * gain;
                }
                
                // Get sample from buffer B
                if (dataB && i >= fadeBStartSample && i < dataB.length) {
                    let gain = 1;
                    
                    // Apply fade in if in fade region
                    if (i >= fadeBStartSample && i < fadeBStartSample + fadeSamples) {
                        const fadeIndex = Math.floor((i - fadeBStartSample) / fadeSamples * 100);
                        gain = crossfade.clipB.gainCurve[Math.min(fadeIndex, 99)];
                    }
                    
                    sample += dataB[i - fadeBStartSample] * gain;
                }
                
                outputData[i] = sample;
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Apply real-time crossfade using gain nodes
     * @param {AudioNode} nodeA - First clip audio node
     * @param {AudioNode} nodeB - Second clip audio node
     * @param {Object} crossfade - Crossfade configuration
     * @param {number} startTime - Context time to start crossfade
     */
    applyRealTimeCrossfade(nodeA, nodeB, crossfade, startTime) {
        // Create gain nodes for each clip
        const gainA = this.audioContext.createGain();
        const gainB = this.audioContext.createGain();
        
        // Connect through gain nodes
        nodeA.connect(gainA);
        nodeB.connect(gainB);
        
        // Create ramp arrays
        const curveA = new Float32Array(crossfade.clipA.gainCurve);
        const curveB = new Float32Array(crossfade.clipB.gainCurve);
        
        // Schedule gain curves
        gainA.gain.setValueCurveAtTime(curveA, startTime, crossfade.fadeDuration);
        gainB.gain.setValueCurveAtTime(curveB, startTime, crossfade.fadeDuration);
        
        // Store active crossfade
        crossfade.gainA = gainA;
        crossfade.gainB = gainB;
        crossfade.startTime = startTime;
        crossfade.active = true;
        
        this.activeCrossfades.set(crossfade.id, crossfade);
        
        if (this.onCrossfadeStart) {
            this.onCrossfadeStart(crossfade);
        }
        
        // Schedule cleanup
        const endTime = startTime + crossfade.fadeDuration;
        setTimeout(() => {
            crossfade.active = false;
            if (this.onCrossfadeEnd) {
                this.onCrossfadeEnd(crossfade);
            }
        }, crossfade.fadeDuration * 1000);
        
        return { gainA, gainB };
    }
    
    /**
     * Auto-process all clips for overlaps
     * @param {Array} clips - Array of clips to process
     * @returns {Array} Array of created crossfades
     */
    autoProcessClips(clips) {
        if (!this.settings.autoDetect) {
            return [];
        }
        
        const overlaps = this.detectOverlaps(clips);
        const crossfades = [];
        
        for (const overlap of overlaps) {
            const crossfade = this.createCrossfade(overlap.clipA, overlap.clipB, overlap);
            crossfades.push(crossfade);
        }
        
        return crossfades;
    }
    
    /**
     * Cancel an active crossfade
     */
    cancelCrossfade(crossfadeId) {
        const crossfade = this.activeCrossfades.get(crossfadeId);
        if (crossfade) {
            if (crossfade.gainA) {
                crossfade.gainA.disconnect();
            }
            if (crossfade.gainB) {
                crossfade.gainB.disconnect();
            }
            crossfade.active = false;
            this.activeCrossfades.delete(crossfadeId);
        }
    }
    
    /**
     * Cancel all active crossfades
     */
    cancelAllCrossfades() {
        this.activeCrossfades.forEach((_, id) => {
            this.cancelCrossfade(id);
        });
    }
    
    /**
     * Get all active crossfades
     */
    getActiveCrossfades() {
        return Array.from(this.activeCrossfades.values()).filter(cf => cf.active);
    }
    
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
    }
    
    /**
     * Set crossfade curve type
     */
    setCurveType(curveType) {
        if (this.curves[curveType]) {
            this.settings.curveType = curveType;
        }
    }
    
    /**
     * Preview crossfade curve
     */
    getCurvePreview(curveType, steps = 100) {
        const curve = this.curves[curveType] || this.curves.equal_power;
        const fadeOut = [];
        const fadeIn = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            fadeOut.push(curve(1 - t));
            fadeIn.push(curve(t));
        }
        
        return { fadeOut, fadeIn };
    }
    
    /**
     * Create crossfade visualization
     */
    createVisualization(container, crossfade) {
        const { fadeOut, fadeIn } = this.getCurvePreview(crossfade.curveType);
        
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 100;
        canvas.style.cssText = `
            background: #1a1a2e;
            border-radius: 4px;
            width: 100%;
        `;
        
        const ctx = canvas.getContext('2d');
        
        // Draw fade curves
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        fadeOut.forEach((value, i) => {
            const x = (i / (fadeOut.length - 1)) * canvas.width;
            const y = canvas.height - value * canvas.height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Draw fade in curve
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        
        fadeIn.forEach((value, i) => {
            const x = (i / (fadeIn.length - 1)) * canvas.width;
            const y = canvas.height - value * canvas.height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Add labels
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText('Out', 4, 15);
        ctx.fillText('In', 4, 95);
        
        container.appendChild(canvas);
        
        return canvas;
    }
    
    /**
     * Create settings UI panel
     */
    static createSettingsPanel(onChange) {
        const container = document.createElement('div');
        container.className = 'crossfade-settings-panel';
        container.style.cssText = `
            padding: 16px;
            background: #1a1a2e;
            border-radius: 8px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Auto Crossfade Settings';
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 14px;';
        container.appendChild(title);
        
        // Fade duration
        const durationGroup = document.createElement('div');
        durationGroup.style.cssText = 'margin-bottom: 12px;';
        durationGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Fade Duration (ms):</label>
            <input type="range" id="fade-duration" min="1" max="500" value="20" 
                style="width: 100%; accent-color: #3b82f6;">
            <span id="fade-duration-value" style="font-size: 11px; color: #888;">20ms</span>
        `;
        container.appendChild(durationGroup);
        
        // Curve type
        const curveGroup = document.createElement('div');
        curveGroup.style.cssText = 'margin-bottom: 12px;';
        
        const curveLabel = document.createElement('label');
        curveLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px;';
        curveLabel.textContent = 'Curve Type:';
        curveGroup.appendChild(curveLabel);
        
        const curveSelect = document.createElement('select');
        curveSelect.id = 'curve-type';
        curveSelect.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #2a2a4e;
            border: 1px solid #444;
            border-radius: 4px;
            color: white;
        `;
        
        ['linear', 'equal_power', 'exponential', 'smooth', 's_curve'].forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.replace('_', ' ').toUpperCase();
            curveSelect.appendChild(option);
        });
        
        curveGroup.appendChild(curveSelect);
        container.appendChild(curveGroup);
        
        // Auto-detect toggle
        const autoGroup = document.createElement('label');
        autoGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        autoGroup.innerHTML = `
            <input type="checkbox" id="auto-detect" checked>
            <span>Auto-detect overlapping clips</span>
        `;
        container.appendChild(autoGroup);
        
        // Preview canvas
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = 'margin-top: 12px;';
        container.appendChild(previewContainer);
        
        // Initial preview
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 200;
        previewCanvas.height = 80;
        previewCanvas.style.cssText = 'background: #0a0a14; border-radius: 4px; width: 100%;';
        previewContainer.appendChild(previewCanvas);
        
        const drawPreview = (curveType) => {
            const ctx = previewCanvas.getContext('2d');
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            
            const curves = {
                linear: (t) => t,
                equal_power: (t) => Math.sqrt(t),
                exponential: (t) => t * t,
                smooth: (t) => t * t * (3 - 2 * t),
                s_curve: (t) => 1 / (1 + Math.exp(-10 * (t - 0.5)))
            };
            
            const curve = curves[curveType];
            
            // Fade out
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const x = (i / 100) * previewCanvas.width;
                const y = previewCanvas.height - curve(1 - i / 100) * previewCanvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Fade in
            ctx.strokeStyle = '#10b981';
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const x = (i / 100) * previewCanvas.width;
                const y = previewCanvas.height - curve(i / 100) * previewCanvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        };
        
        drawPreview('equal_power');
        
        // Event handlers
        const durationInput = container.querySelector('#fade-duration');
        const durationValue = container.querySelector('#fade-duration-value');
        
        durationInput.oninput = () => {
            const value = parseInt(durationInput.value);
            durationValue.textContent = `${value}ms`;
            if (onChange) onChange({ fadeDuration: value / 1000 });
        };
        
        curveSelect.onchange = () => {
            drawPreview(curveSelect.value);
            if (onChange) onChange({ curveType: curveSelect.value });
        };
        
        container.querySelector('#auto-detect').onchange = (e) => {
            if (onChange) onChange({ autoDetect: e.target.checked });
        };
        
        return container;
    }
    
    /**
     * Serialize settings
     */
    serialize() {
        return {
            enabled: this.enabled,
            settings: { ...this.settings }
        };
    }
    
    /**
     * Restore settings
     */
    restore(data) {
        this.enabled = data.enabled ?? true;
        Object.assign(this.settings, data.settings || {});
    }
    
    destroy() {
        this.cancelAllCrossfades();
    }
}

export default ClipCrossfadeAuto;