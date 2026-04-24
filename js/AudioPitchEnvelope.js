/**
 * Audio Pitch Envelope - Draw pitch changes over audio clips
 * Allows drawing pitch automation curves directly on audio clips
 */

export class AudioPitchEnvelope {
    constructor(audioContext, audioBuffer, options = {}) {
        this.audioContext = audioContext;
        this.audioBuffer = audioBuffer;
        
        // Envelope points (array of { time, pitch, curve })
        // pitch is in semitones (-12 to +12 by default)
        this.points = options.points ?? [
            { time: 0, pitch: 0, curve: 'linear' },
            { time: audioBuffer.duration, pitch: 0, curve: 'linear' }
        ];
        
        // Settings
        this.pitchRange = options.pitchRange ?? 12; // semitones
        this.pitchMode = options.pitchMode ?? 'semitones'; // 'semitones', 'cents', 'frequency'
        this.formantPreserve = options.formantPreserve ?? false;
        
        // Playback state
        this.source = null;
        this.isPlaying = false;
        this.currentPitch = 0;
        
        // Callbacks
        this.onPointAdd = null;
        this.onPointMove = null;
        this.onPointRemove = null;
        this.onPitchChange = null;
    }
    
    addPoint(time, pitch, curve = 'linear') {
        if (time < 0 || time > this.audioBuffer.duration) {
            throw new Error('Point time out of range');
        }
        
        const point = { time, pitch, curve };
        this.points.push(point);
        this.sortPoints();
        
        if (this.onPointAdd) {
            this.onPointAdd(point);
        }
        
        return point;
    }
    
    removePoint(index) {
        if (index <= 0 || index >= this.points.length - 1) {
            throw new Error('Cannot remove first or last point');
        }
        
        const point = this.points.splice(index, 1)[0];
        
        if (this.onPointRemove) {
            this.onPointRemove(point, index);
        }
        
        return point;
    }
    
    movePoint(index, newTime, newPitch) {
        if (index <= 0 || index >= this.points.length - 1) {
            throw new Error('Cannot move first or last point');
        }
        
        if (newTime < 0 || newTime > this.audioBuffer.duration) {
            throw new Error('Point time out of range');
        }
        
        this.points[index].time = newTime;
        this.points[index].pitch = Math.max(-this.pitchRange, Math.min(this.pitchRange, newPitch));
        this.sortPoints();
        
        if (this.onPointMove) {
            this.onPointMove(this.points[index], index);
        }
    }
    
    sortPoints() {
        this.points.sort((a, b) => a.time - b.time);
    }
    
    getPitchAtTime(time) {
        // Find the two points surrounding this time
        let prevPoint = this.points[0];
        let nextPoint = this.points[this.points.length - 1];
        
        for (let i = 0; i < this.points.length - 1; i++) {
            if (this.points[i].time <= time && this.points[i + 1].time >= time) {
                prevPoint = this.points[i];
                nextPoint = this.points[i + 1];
                break;
            }
        }
        
        // Interpolate
        const range = nextPoint.time - prevPoint.time;
        if (range === 0) return prevPoint.pitch;
        
        const t = (time - prevPoint.time) / range;
        
        let pitch;
        switch (prevPoint.curve) {
            case 'linear':
                pitch = prevPoint.pitch + t * (nextPoint.pitch - prevPoint.pitch);
                break;
            case 'exponential':
                const expT = Math.exp(t * 2 - 1);
                pitch = prevPoint.pitch + expT * (nextPoint.pitch - prevPoint.pitch);
                break;
            case 'sine':
                const sinT = (Math.sin(t * Math.PI - Math.PI / 2) + 1) / 2;
                pitch = prevPoint.pitch + sinT * (nextPoint.pitch - prevPoint.pitch);
                break;
            case 'step':
                pitch = t < 0.5 ? prevPoint.pitch : nextPoint.pitch;
                break;
            default:
                pitch = prevPoint.pitch + t * (nextPoint.pitch - prevPoint.pitch);
        }
        
        return pitch;
    }
    
    async applyEnvelope() {
        // Create a new buffer with pitch envelope applied
        const numChannels = this.audioBuffer.numberOfChannels;
        const duration = this.audioBuffer.duration;
        const sampleRate = this.audioBuffer.sampleRate;
        
        const outputBuffer = this.audioContext.createBuffer(
            numChannels,
            Math.ceil(duration * sampleRate),
            sampleRate
        );
        
        // Process each channel
        for (let ch = 0; ch < numChannels; ch++) {
            const input = this.audioBuffer.getChannelData(ch);
            const output = outputBuffer.getChannelData(ch);
            
            this.processChannel(input, output, sampleRate);
        }
        
        return outputBuffer;
    }
    
    processChannel(input, output, sampleRate) {
        const length = output.length;
        
        // Sample-by-sample pitch shifting
        let readPos = 0;
        let lastPitch = 0;
        
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            const targetPitch = this.getPitchAtTime(time);
            
            // Smooth pitch changes
            const pitchDiff = targetPitch - lastPitch;
            const maxPitchChange = 0.1; // semitones per sample
            const pitch = lastPitch + Math.sign(pitchDiff) * Math.min(Math.abs(pitchDiff), maxPitchChange);
            lastPitch = pitch;
            
            // Calculate read position with pitch shift
            const pitchRatio = Math.pow(2, pitch / 12);
            readPos += pitchRatio;
            
            // Interpolate sample
            if (readPos >= 0 && readPos < input.length - 1) {
                const index = Math.floor(readPos);
                const frac = readPos - index;
                output[i] = input[index] * (1 - frac) + input[index + 1] * frac;
            } else if (readPos >= input.length - 1) {
                output[i] = 0; // Past end of buffer
            } else {
                output[i] = input[Math.max(0, Math.floor(readPos))]; // Before start
            }
        }
    }
    
    play(startTime = 0, offset = 0) {
        this.stop();
        
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        
        // Apply pitch envelope in real-time using playbackRate
        const schedulePitchChanges = () => {
            if (!this.isPlaying) return;
            
            const currentTime = this.audioContext.currentTime - startTime;
            const pitch = this.getPitchAtTime(currentTime + offset);
            
            // Set playback rate based on pitch
            this.source.playbackRate.value = Math.pow(2, pitch / 12);
            
            this.currentPitch = pitch;
            
            if (this.onPitchChange) {
                this.onPitchChange(pitch);
            }
            
            if (this.isPlaying) {
                requestAnimationFrame(schedulePitchChanges);
            }
        };
        
        this.source.start(startTime, offset);
        this.isPlaying = true;
        schedulePitchChanges();
        
        this.source.onended = () => {
            this.isPlaying = false;
        };
        
        return this.source;
    }
    
    stop() {
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        this.isPlaying = false;
    }
    
    connect(destination) {
        if (this.source) {
            this.source.connect(destination);
        }
    }
    
    setPointCurve(index, curve) {
        if (index >= 0 && index < this.points.length) {
            this.points[index].curve = curve;
        }
    }
    
    setPitchRange(semitones) {
        this.pitchRange = semitones;
    }
    
    setPitchMode(mode) {
        this.pitchMode = mode;
    }
    
    setFormantPreserve(enabled) {
        this.formantPreserve = enabled;
    }
    
    getPoints() {
        return [...this.points];
    }
    
    clearPoints() {
        this.points = [
            { time: 0, pitch: 0, curve: 'linear' },
            { time: this.audioBuffer.duration, pitch: 0, curve: 'linear' }
        ];
    }
    
    getParameters() {
        return {
            points: this.getPoints(),
            pitchRange: this.pitchRange,
            pitchMode: this.pitchMode,
            formantPreserve: this.formantPreserve
        };
    }
    
    setParameters(params) {
        if (params.points) {
            this.points = params.points;
            this.sortPoints();
        }
        if (params.pitchRange !== undefined) {
            this.pitchRange = params.pitchRange;
        }
        if (params.pitchMode) {
            this.pitchMode = params.pitchMode;
        }
        if (params.formantPreserve !== undefined) {
            this.formantPreserve = params.formantPreserve;
        }
    }
    
    destroy() {
        this.stop();
        this.audioBuffer = null;
    }
}

// Factory function
export function createAudioPitchEnvelope(audioContext, audioBuffer, options = {}) {
    return new AudioPitchEnvelope(audioContext, audioBuffer, options);
}

// Presets
export const PITCH_ENVELOPE_PRESETS = {
    tapeStop: {
        points: [
            { time: 0, pitch: 0, curve: 'linear' },
            { time: 0.5, pitch: 0, curve: 'linear' },
            { time: 1, pitch: -12, curve: 'exponential' }
        ]
    },
    tapeStart: {
        points: [
            { time: 0, pitch: -12, curve: 'linear' },
            { time: 0.5, pitch: 0, curve: 'exponential' }
        ]
    },
    vibrato: {
        points: [
            { time: 0, pitch: 0, curve: 'sine' },
            { time: 0.1, pitch: 0.5, curve: 'sine' },
            { time: 0.2, pitch: 0, curve: 'sine' },
            { time: 0.3, pitch: -0.5, curve: 'sine' },
            { time: 0.4, pitch: 0, curve: 'sine' }
        ]
    },
    dive: {
        points: [
            { time: 0, pitch: 2, curve: 'exponential' },
            { time: 0.3, pitch: -5, curve: 'exponential' },
            { time: 0.5, pitch: 0, curve: 'linear' }
        ]
    },
    rise: {
        points: [
            { time: 0, pitch: 0, curve: 'linear' },
            { time: 0.5, pitch: 0, curve: 'linear' },
            { time: 1, pitch: 12, curve: 'exponential' }
        ]
    }
};

// UI Panel
export function createPitchEnvelopePanel(pitchEnvelope, appServices) {
    const container = document.createElement('div');
    container.className = 'pitch-envelope-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 500px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Pitch Envelope';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Envelope display
    const envelopeContainer = document.createElement('div');
    envelopeContainer.style.cssText = `
        height: 150px;
        background: #0a0a14;
        border-radius: 4px;
        margin-bottom: 16px;
        position: relative;
    `;
    
    const canvas = document.createElement('canvas');
    canvas.width = 470;
    canvas.height = 150;
    canvas.style.cssText = 'display: block; width: 100%;';
    envelopeContainer.appendChild(canvas);
    container.appendChild(envelopeContainer);
    
    // Draw envelope
    drawEnvelope(canvas, pitchEnvelope);
    
    // Click to add point
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * pitchEnvelope.audioBuffer.duration;
        const y = ((rect.height / 2 - (e.clientY - rect.top)) / (rect.height / 2)) * pitchEnvelope.pitchRange;
        
        pitchEnvelope.addPoint(x, y);
        drawEnvelope(canvas, pitchEnvelope);
        updatePointsList();
    });
    
    // Points list
    const pointsContainer = document.createElement('div');
    pointsContainer.id = 'pointsList';
    pointsContainer.style.cssText = 'margin-bottom: 16px; max-height: 150px; overflow-y: auto;';
    container.appendChild(pointsContainer);
    
    // Update points list
    function updatePointsList() {
        const points = pitchEnvelope.getPoints();
        
        pointsContainer.innerHTML = points.map((p, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: #1e1e2e; margin-bottom: 4px; border-radius: 4px; font-size: 12px;">
                <span>Time: ${p.time.toFixed(2)}s | Pitch: ${p.pitch.toFixed(1)} st</span>
                <div style="display: flex; gap: 4px;">
                    <select class="curve-select" data-index="${i}" style="padding: 4px; background: #374151; border: none; border-radius: 4px; color: white;">
                        <option value="linear" ${p.curve === 'linear' ? 'selected' : ''}>Linear</option>
                        <option value="exponential" ${p.curve === 'exponential' ? 'selected' : ''}>Exp</option>
                        <option value="sine" ${p.curve === 'sine' ? 'selected' : ''}>Sine</option>
                        <option value="step" ${p.curve === 'step' ? 'selected' : ''}>Step</option>
                    </select>
                    ${i > 0 && i < points.length - 1 ? `
                        <button class="remove-point" data-index="${i}" style="padding: 4px 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
                            ✕
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Add event handlers
        pointsContainer.querySelectorAll('.curve-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                pitchEnvelope.setPointCurve(index, e.target.value);
                drawEnvelope(canvas, pitchEnvelope);
            });
        });
        
        pointsContainer.querySelectorAll('.remove-point').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                pitchEnvelope.removePoint(index);
                drawEnvelope(canvas, pitchEnvelope);
                updatePointsList();
            });
        });
    }
    
    updatePointsList();
    
    // Range control
    const rangeContainer = document.createElement('div');
    rangeContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    rangeContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
            <span>Pitch Range (semitones)</span>
            <span id="rangeValue">${pitchEnvelope.pitchRange}</span>
        </div>
        <input type="range" id="pitchRange" min="1" max="24" value="${pitchEnvelope.pitchRange}" style="width: 100%;">
    `;
    container.appendChild(rangeContainer);
    
    document.getElementById('pitchRange').addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        pitchEnvelope.setPitchRange(value);
        document.getElementById('rangeValue').textContent = value;
        drawEnvelope(canvas, pitchEnvelope);
    });
    
    // Presets
    const presetsContainer = document.createElement('div');
    presetsContainer.style.cssText = 'margin-bottom: 16px;';
    presetsContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Presets</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Object.keys(PITCH_ENVELOPE_PRESETS).map(name => `
                <button class="preset-btn" data-preset="${name}" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    ${name.charAt(0).toUpperCase() + name.slice(1)}
                </button>
            `).join('')}
        </div>
    `;
    container.appendChild(presetsContainer);
    
    presetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = PITCH_ENVELOPE_PRESETS[btn.dataset.preset];
            pitchEnvelope.setParameters({ points: preset.points });
            drawEnvelope(canvas, pitchEnvelope);
            updatePointsList();
        });
    });
    
    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'display: flex; gap: 8px;';
    actionsContainer.innerHTML = `
        <button id="clearEnvelope" style="flex: 1; padding: 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Clear
        </button>
        <button id="previewEnvelope" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Preview
        </button>
        <button id="applyEnvelope" style="flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Apply
        </button>
    `;
    container.appendChild(actionsContainer);
    
    document.getElementById('clearEnvelope').addEventListener('click', () => {
        pitchEnvelope.clearPoints();
        drawEnvelope(canvas, pitchEnvelope);
        updatePointsList();
    });
    
    document.getElementById('previewEnvelope').addEventListener('click', () => {
        pitchEnvelope.play(pitchEnvelope.audioContext.currentTime);
    });
    
    document.getElementById('applyEnvelope').addEventListener('click', async () => {
        if (appServices && appServices.showNotification) {
            appServices.showNotification('Applying pitch envelope...', 2000);
        }
        // await pitchEnvelope.applyEnvelope();
    });
    
    // Cleanup
    container.destroy = () => {
        pitchEnvelope.stop();
    };
    
    return container;
}

function drawEnvelope(canvas, pitchEnvelope) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const duration = pitchEnvelope.audioBuffer.duration;
    const range = pitchEnvelope.pitchRange;
    
    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Horizontal lines (pitch)
    for (let p = -range; p <= range; p += range / 4) {
        const y = height / 2 - (p / range) * (height / 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.fillText(`${p > 0 ? '+' : ''}${p}`, 5, y - 2);
    }
    
    // Vertical lines (time)
    const timeStep = duration / 10;
    for (let t = 0; t <= duration; t += timeStep) {
        const x = (t / duration) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Draw envelope curve
    const points = pitchEnvelope.getPoints();
    
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Draw curve between points
    for (let t = 0; t <= duration; t += duration / 200) {
        const pitch = pitchEnvelope.getPitchAtTime(t);
        const x = (t / duration) * width;
        const y = height / 2 - (pitch / range) * (height / 2);
        
        if (t === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = '#3b82f6';
    for (const point of points) {
        const x = (point.time / duration) * width;
        const y = height / 2 - (point.pitch / range) * (height / 2);
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Point border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Center line
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
}

export default AudioPitchEnvelope;