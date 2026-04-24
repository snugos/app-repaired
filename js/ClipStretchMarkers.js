/**
 * Clip Stretch Markers - Add stretch markers to audio clips for time manipulation
 * Allows placing markers that can be moved to stretch/compress audio regions
 */

export class ClipStretchMarkers {
    constructor(audioContext, audioBuffer, options = {}) {
        this.audioContext = audioContext;
        this.audioBuffer = audioBuffer;
        
        // Markers array with positions in seconds
        this.markers = options.markers ?? [
            { id: 0, position: 0, locked: true },
            { id: 1, position: audioBuffer.duration, locked: true }
        ];
        
        this.markerId = 2;
        this.duration = audioBuffer.duration;
        this.sampleRate = audioBuffer.sampleRate;
        
        // Stretch settings
        this.stretchMode = options.stretchMode ?? 'mono'; // 'mono', 'poly', 'speech'
        this.pitchCorrection = options.pitchCorrection ?? true;
        this.formantPreservation = options.formantPreservation ?? false;
        
        // Callbacks
        this.onMarkerAdd = null;
        this.onMarkerMove = null;
        this.onMarkerRemove = null;
    }
    
    addMarker(position) {
        if (position < 0 || position > this.duration) {
            throw new Error('Marker position out of range');
        }
        
        const marker = {
            id: this.markerId++,
            position,
            locked: false
        };
        
        this.markers.push(marker);
        this.sortMarkers();
        
        if (this.onMarkerAdd) {
            this.onMarkerAdd(marker);
        }
        
        return marker;
    }
    
    removeMarker(markerId) {
        const index = this.markers.findIndex(m => m.id === markerId);
        
        if (index === -1) {
            return false;
        }
        
        const marker = this.markers[index];
        
        if (marker.locked) {
            throw new Error('Cannot remove locked marker');
        }
        
        this.markers.splice(index, 1);
        
        if (this.onMarkerRemove) {
            this.onMarkerRemove(marker);
        }
        
        return true;
    }
    
    moveMarker(markerId, newPosition) {
        const marker = this.markers.find(m => m.id === markerId);
        
        if (!marker) {
            return false;
        }
        
        if (marker.locked) {
            throw new Error('Cannot move locked marker');
        }
        
        if (newPosition < 0 || newPosition > this.duration) {
            throw new Error('Marker position out of range');
        }
        
        marker.position = newPosition;
        this.sortMarkers();
        
        if (this.onMarkerMove) {
            this.onMarkerMove(marker);
        }
        
        return true;
    }
    
    sortMarkers() {
        this.markers.sort((a, b) => a.position - b.position);
    }
    
    getMarkers() {
        return [...this.markers];
    }
    
    getMarkerAt(position, tolerance = 0.05) {
        return this.markers.find(m => Math.abs(m.position - position) < tolerance);
    }
    
    getRegionBetween(markerId1, markerId2) {
        const marker1 = this.markers.find(m => m.id === markerId1);
        const marker2 = this.markers.find(m => m.id === markerId2);
        
        if (!marker1 || !marker2) {
            return null;
        }
        
        return {
            start: Math.min(marker1.position, marker2.position),
            end: Math.max(marker1.position, marker2.position),
            duration: Math.abs(marker2.position - marker1.position)
        };
    }
    
    async applyStretch(newMarkerPositions) {
        // Create new audio buffer with stretched regions
        const numChannels = this.audioBuffer.numberOfChannels;
        const totalNewDuration = this.calculateNewDuration(newMarkerPositions);
        
        const newBuffer = this.audioContext.createBuffer(
            numChannels,
            Math.ceil(totalNewDuration * this.sampleRate),
            this.sampleRate
        );
        
        // Copy and stretch each region
        for (let i = 0; i < this.markers.length - 1; i++) {
            const startMarker = this.markers[i];
            const endMarker = this.markers[i + 1];
            
            const newStartPos = newMarkerPositions[startMarker.id] ?? startMarker.position;
            const newEndPos = newMarkerPositions[endMarker.id] ?? endMarker.position;
            
            await this.stretchRegion(
                startMarker.position,
                endMarker.position,
                newStartPos,
                newEndPos,
                newBuffer
            );
        }
        
        return newBuffer;
    }
    
    calculateNewDuration(newPositions) {
        const lastMarker = this.markers[this.markers.length - 1];
        return newPositions[lastMarker.id] ?? lastMarker.position;
    }
    
    async stretchRegion(originalStart, originalEnd, newStart, newEnd, targetBuffer) {
        const originalDuration = originalEnd - originalStart;
        const newDuration = newEnd - newStart;
        const stretchRatio = originalDuration / newDuration;
        
        // Get source samples
        const startSample = Math.floor(originalStart * this.sampleRate);
        const endSample = Math.floor(originalEnd * this.sampleRate);
        const targetStartSample = Math.floor(newStart * this.sampleRate);
        const targetEndSample = Math.floor(newEnd * this.sampleRate);
        const numOutputSamples = targetEndSample - targetStartSample;
        
        // Stretch using granular synthesis
        for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
            const sourceData = this.audioBuffer.getChannelData(channel);
            const targetData = targetBuffer.getChannelData(channel);
            
            this.granularStretch(
                sourceData,
                targetData,
                startSample,
                endSample,
                targetStartSample,
                numOutputSamples,
                stretchRatio
            );
        }
    }
    
    granularStretch(source, target, startSample, endSample, targetStart, numOutput, ratio) {
        const grainSize = Math.floor(512 * (ratio > 1 ? ratio : 1));
        const grainOverlap = 0.5;
        const grainStep = Math.floor(grainSize * (1 - grainOverlap));
        
        let sourcePos = startSample;
        let targetPos = targetStart;
        
        while (targetPos < targetStart + numOutput) {
            // Copy grain
            for (let i = 0; i < grainSize && targetPos + i < targetStart + numOutput; i++) {
                const sourceIndex = sourcePos + Math.floor(i * ratio);
                
                if (sourceIndex >= startSample && sourceIndex < endSample) {
                    // Apply grain envelope
                    const envelope = this.grainEnvelope(i, grainSize);
                    target[targetPos + i] += source[sourceIndex] * envelope;
                }
            }
            
            sourcePos += grainStep;
            targetPos += grainStep;
        }
    }
    
    grainEnvelope(index, grainSize) {
        // Hann window for smooth grains
        const x = (index / grainSize) * 2 * Math.PI;
        return 0.5 * (1 - Math.cos(x));
    }
    
    detectTransients() {
        // Auto-detect transients and add markers at those positions
        const channelData = this.audioBuffer.getChannelData(0);
        const transients = [];
        
        const threshold = 0.3;
        const windowSize = 512;
        
        for (let i = windowSize; i < channelData.length - windowSize; i += windowSize / 2) {
            const rmsBefore = this.calculateRMS(channelData, i - windowSize, windowSize);
            const rmsAfter = this.calculateRMS(channelData, i, windowSize);
            
            if (rmsAfter > rmsBefore * (1 + threshold)) {
                const position = i / this.sampleRate;
                
                // Don't add marker too close to existing one
                if (!this.getMarkerAt(position, 0.05)) {
                    transients.push(position);
                }
            }
        }
        
        // Add markers at transient positions
        for (const pos of transients) {
            this.addMarker(pos);
        }
        
        return transients;
    }
    
    calculateRMS(data, start, length) {
        let sum = 0;
        for (let i = start; i < start + length && i < data.length; i++) {
            sum += data[i] * data[i];
        }
        return Math.sqrt(sum / length);
    }
    
    setStretchMode(mode) {
        this.stretchMode = mode;
    }
    
    setPitchCorrection(enabled) {
        this.pitchCorrection = enabled;
    }
    
    setFormantPreservation(enabled) {
        this.formantPreservation = enabled;
    }
    
    lockMarker(markerId) {
        const marker = this.markers.find(m => m.id === markerId);
        if (marker) {
            marker.locked = true;
        }
    }
    
    unlockMarker(markerId) {
        const marker = this.markers.find(m => m.id === markerId);
        if (marker) {
            marker.locked = false;
        }
    }
    
    clearMarkers() {
        this.markers = [
            { id: 0, position: 0, locked: true },
            { id: 1, position: this.duration, locked: true }
        ];
    }
    
    getParameters() {
        return {
            markers: this.getMarkers(),
            stretchMode: this.stretchMode,
            pitchCorrection: this.pitchCorrection,
            formantPreservation: this.formantPreservation
        };
    }
    
    setParameters(params) {
        if (params.markers) {
            this.markers = params.markers;
        }
        if (params.stretchMode) {
            this.stretchMode = params.stretchMode;
        }
        if (params.pitchCorrection !== undefined) {
            this.pitchCorrection = params.pitchCorrection;
        }
        if (params.formantPreservation !== undefined) {
            this.formantPreservation = params.formantPreservation;
        }
    }
    
    destroy() {
        this.audioBuffer = null;
        this.markers = [];
    }
}

// Factory function
export function createClipStretchMarkers(audioContext, audioBuffer, options = {}) {
    return new ClipStretchMarkers(audioContext, audioBuffer, options);
}

// UI Panel
export function createStretchMarkersPanel(stretchMarkers, appServices) {
    const container = document.createElement('div');
    container.className = 'stretch-markers-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 400px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Stretch Markers';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Waveform display
    const waveformContainer = document.createElement('div');
    waveformContainer.id = 'waveformDisplay';
    waveformContainer.style.cssText = `
        height: 100px;
        background: #0a0a14;
        border-radius: 4px;
        margin-bottom: 16px;
        position: relative;
        overflow: hidden;
    `;
    container.appendChild(waveformContainer);
    
    // Draw waveform
    setTimeout(() => drawWaveform(waveformContainer, stretchMarkers), 100);
    
    // Markers list
    const markersContainer = document.createElement('div');
    markersContainer.id = 'markersList';
    markersContainer.style.cssText = 'margin-bottom: 16px; max-height: 200px; overflow-y: auto;';
    updateMarkersList(markersContainer, stretchMarkers);
    container.appendChild(markersContainer);
    
    // Add marker controls
    const addContainer = document.createElement('div');
    addContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    addContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Add Marker</div>
        <div style="display: flex; gap: 8px;">
            <input type="number" id="markerPosition" min="0" max="${stretchMarkers.duration}" step="0.01" placeholder="Position (s)" style="flex: 1; padding: 8px; background: #374151; border: none; border-radius: 4px; color: white;">
            <button id="addMarkerBtn" style="padding: 8px 16px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Add
            </button>
        </div>
    `;
    container.appendChild(addContainer);
    
    // Auto-detect button
    const autoContainer = document.createElement('div');
    autoContainer.style.cssText = 'margin-bottom: 16px;';
    autoContainer.innerHTML = `
        <button id="detectTransients" style="width: 100%; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Auto-Detect Transients
        </button>
    `;
    container.appendChild(autoContainer);
    
    // Stretch controls
    const stretchContainer = document.createElement('div');
    stretchContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    stretchContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Stretch Mode</div>
        <select id="stretchMode" style="width: 100%; padding: 8px; background: #374151; border: none; border-radius: 4px; color: white;">
            <option value="mono">Mono</option>
            <option value="poly">Polyphonic</option>
            <option value="speech">Speech</option>
        </select>
        <div style="margin-top: 12px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
                <input type="checkbox" id="pitchCorrection" checked>
                Pitch Correction
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="formantPreservation">
                Formant Preservation
            </label>
        </div>
    `;
    container.appendChild(stretchContainer);
    
    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'display: flex; gap: 8px;';
    actionsContainer.innerHTML = `
        <button id="clearMarkers" style="flex: 1; padding: 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Clear All
        </button>
        <button id="applyStretch" style="flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Apply Stretch
        </button>
    `;
    container.appendChild(actionsContainer);
    
    // Event handlers
    document.getElementById('addMarkerBtn').addEventListener('click', () => {
        const position = parseFloat(document.getElementById('markerPosition').value);
        if (!isNaN(position)) {
            stretchMarkers.addMarker(position);
            updateMarkersList(markersContainer, stretchMarkers);
            drawWaveform(waveformContainer, stretchMarkers);
        }
    });
    
    document.getElementById('detectTransients').addEventListener('click', () => {
        const count = stretchMarkers.detectTransients().length;
        updateMarkersList(markersContainer, stretchMarkers);
        drawWaveform(waveformContainer, stretchMarkers);
        
        if (appServices && appServices.showNotification) {
            appServices.showNotification(`Detected ${count} transients`, 2000);
        }
    });
    
    document.getElementById('stretchMode').addEventListener('change', (e) => {
        stretchMarkers.setStretchMode(e.target.value);
    });
    
    document.getElementById('pitchCorrection').addEventListener('change', (e) => {
        stretchMarkers.setPitchCorrection(e.target.checked);
    });
    
    document.getElementById('formantPreservation').addEventListener('change', (e) => {
        stretchMarkers.setFormantPreservation(e.target.checked);
    });
    
    document.getElementById('clearMarkers').addEventListener('click', () => {
        stretchMarkers.clearMarkers();
        updateMarkersList(markersContainer, stretchMarkers);
        drawWaveform(waveformContainer, stretchMarkers);
    });
    
    document.getElementById('applyStretch').addEventListener('click', async () => {
        if (appServices && appServices.showNotification) {
            appServices.showNotification('Applying stretch...', 2000);
        }
        // This would trigger the actual stretching operation
    });
    
    return container;
}

function updateMarkersList(container, stretchMarkers) {
    const markers = stretchMarkers.getMarkers();
    
    container.innerHTML = markers.map(marker => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #1e1e2e; margin-bottom: 4px; border-radius: 4px;">
            <span style="color: ${marker.locked ? '#6b7280' : '#ffffff'};">
                ${marker.locked ? '🔒' : '📍'} ${marker.position.toFixed(3)}s
            </span>
            ${!marker.locked ? `
                <button class="remove-marker" data-id="${marker.id}" style="padding: 4px 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Remove
                </button>
            ` : ''}
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.remove-marker').forEach(btn => {
        btn.addEventListener('click', () => {
            stretchMarkers.removeMarker(parseInt(btn.dataset.id));
            updateMarkersList(container, stretchMarkers);
            drawWaveform(container.previousElementSibling, stretchMarkers);
        });
    });
}

function drawWaveform(container, stretchMarkers) {
    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    container.innerHTML = '';
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const audioBuffer = stretchMarkers.audioBuffer;
    
    if (!audioBuffer) return;
    
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / canvas.width);
    
    ctx.fillStyle = '#3b82f6';
    
    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
            const idx = i * step + j;
            if (idx < channelData.length) {
                const val = channelData[idx];
                if (val < min) min = val;
                if (val > max) max = val;
            }
        }
        
        const yMin = (1 + min) / 2 * canvas.height;
        const yMax = (1 + max) / 2 * canvas.height;
        
        ctx.fillRect(i, yMin, 1, yMax - yMin);
    }
    
    // Draw markers
    const markers = stretchMarkers.getMarkers();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    
    for (const marker of markers) {
        const x = (marker.position / stretchMarkers.duration) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

export default ClipStretchMarkers;