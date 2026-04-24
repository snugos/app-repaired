/**
 * Clip Gain Automation - Draw gain automation directly on clips
 * Allows drawing volume changes directly on audio clips
 */

export class ClipGainAutomation {
    constructor(audioContext, audioBuffer, options = {}) {
        this.audioContext = audioContext;
        this.audioBuffer = audioBuffer;
        
        // Automation points (array of { time, gain, curve })
        // gain is linear (0 to 2, 1 = unity)
        this.points = options.points ?? [
            { time: 0, gain: 1, curve: 'linear' },
            { time: audioBuffer.duration, gain: 1, curve: 'linear' }
        ];
        
        // Settings
        this.gainRange = options.gainRange ?? { min: 0, max: 2 }; // Linear
        this.clipToZero = options.clipToZero ?? true; // Prevent negative gain
        
        // Playback
        this.gainNode = null;
        this.isPlaying = false;
        this.playbackStartTime = 0;
        this.clipOffset = 0;
        
        // Callbacks
        this.onPointAdd = null;
        this.onPointMove = null;
        this.onPointRemove = null;
        this.onGainChange = null;
    }
    
    addPoint(time, gain, curve = 'linear') {
        if (time < 0 || time > this.audioBuffer.duration) {
            throw new Error('Point time out of range');
        }
        
        gain = Math.max(this.gainRange.min, Math.min(this.gainRange.max, gain));
        
        const point = { time, gain, curve };
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
    
    movePoint(index, newTime, newGain) {
        if (index <= 0 || index >= this.points.length - 1) {
            throw new Error('Cannot move first or last point');
        }
        
        if (newTime < 0 || newTime > this.audioBuffer.duration) {
            throw new Error('Point time out of range');
        }
        
        newGain = Math.max(this.gainRange.min, Math.min(this.gainRange.max, newGain));
        
        this.points[index].time = newTime;
        this.points[index].gain = newGain;
        this.sortPoints();
        
        if (this.onPointMove) {
            this.onPointMove(this.points[index], index);
        }
    }
    
    sortPoints() {
        this.points.sort((a, b) => a.time - b.time);
    }
    
    getGainAtTime(time) {
        // Find surrounding points
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
        if (range === 0) return prevPoint.gain;
        
        const t = (time - prevPoint.time) / range;
        
        let gain;
        switch (prevPoint.curve) {
            case 'linear':
                gain = prevPoint.gain + t * (nextPoint.gain - prevPoint.gain);
                break;
            case 'exponential':
                // Smooth exponential curve
                const expT = 1 - Math.pow(1 - t, 2);
                gain = prevPoint.gain + expT * (nextPoint.gain - prevPoint.gain);
                break;
            case 'sine':
                const sinT = (Math.sin(t * Math.PI - Math.PI / 2) + 1) / 2;
                gain = prevPoint.gain + sinT * (nextPoint.gain - prevPoint.gain);
                break;
            case 'step':
                gain = t < 0.5 ? prevPoint.gain : nextPoint.gain;
                break;
            case 'smooth':
                // Ease in-out
                const smoothT = t < 0.5 
                    ? 4 * t * t * t 
                    : 1 - Math.pow(-2 * t + 2, 3) / 2;
                gain = prevPoint.gain + smoothT * (nextPoint.gain - prevPoint.gain);
                break;
            default:
                gain = prevPoint.gain + t * (nextPoint.gain - prevPoint.gain);
        }
        
        if (this.clipToZero) {
            gain = Math.max(0, gain);
        }
        
        return gain;
    }
    
    applyToBuffer() {
        // Apply gain automation to the audio buffer
        const numChannels = this.audioBuffer.numberOfChannels;
        const length = this.audioBuffer.length;
        const sampleRate = this.audioBuffer.sampleRate;
        
        const outputBuffer = this.audioContext.createBuffer(
            numChannels,
            length,
            sampleRate
        );
        
        for (let ch = 0; ch < numChannels; ch++) {
            const input = this.audioBuffer.getChannelData(ch);
            const output = outputBuffer.getChannelData(ch);
            
            for (let i = 0; i < length; i++) {
                const time = i / sampleRate;
                const gain = this.getGainAtTime(time);
                output[i] = input[i] * gain;
            }
        }
        
        return outputBuffer;
    }
    
    createGainNode() {
        if (!this.gainNode) {
            this.gainNode = this.audioContext.createGain();
        }
        return this.gainNode;
    }
    
    scheduleAutomation(startTime, offset = 0, duration = null) {
        const gainNode = this.createGainNode();
        
        // Cancel any existing scheduled values
        gainNode.gain.cancelScheduledValues(startTime);
        gainNode.gain.setValueAtTime(this.getGainAtTime(offset), startTime);
        
        // Schedule automation points
        const clipDuration = duration ?? this.audioBuffer.duration;
        
        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            
            // Skip points before offset
            if (point.time < offset) continue;
            
            // Stop at end of playback region
            if (point.time > offset + clipDuration) break;
            
            const scheduleTime = startTime + (point.time - offset);
            const gain = point.gain;
            
            // Apply curve
            if (point.curve === 'exponential') {
                gainNode.gain.exponentialRampToValueAtTime(
                    Math.max(0.0001, gain), // Prevent zero for exponential
                    scheduleTime
                );
            } else if (point.curve === 'linear') {
                gainNode.gain.linearRampToValueAtTime(gain, scheduleTime);
            } else {
                // Set value directly for other curves
                gainNode.gain.setValueAtTime(gain, scheduleTime);
            }
        }
        
        return gainNode;
    }
    
    startRealtimeUpdate(startTime, offset = 0) {
        this.playbackStartTime = startTime;
        this.clipOffset = offset;
        this.isPlaying = true;
        
        const updateGain = () => {
            if (!this.isPlaying) return;
            
            const currentTime = this.audioContext.currentTime;
            const clipTime = (currentTime - this.playbackStartTime) + this.clipOffset;
            
            if (clipTime >= 0 && clipTime <= this.audioBuffer.duration) {
                const gain = this.getGainAtTime(clipTime);
                
                if (this.gainNode) {
                    this.gainNode.gain.setValueAtTime(gain, currentTime);
                }
                
                if (this.onGainChange) {
                    this.onGainChange(gain, clipTime);
                }
            }
            
            if (this.isPlaying) {
                requestAnimationFrame(updateGain);
            }
        };
        
        updateGain();
    }
    
    stopRealtimeUpdate() {
        this.isPlaying = false;
    }
    
    setPointCurve(index, curve) {
        if (index >= 0 && index < this.points.length) {
            this.points[index].curve = curve;
        }
    }
    
    setGainRange(min, max) {
        this.gainRange = { min, max };
    }
    
    getPoints() {
        return [...this.points];
    }
    
    clearPoints() {
        this.points = [
            { time: 0, gain: 1, curve: 'linear' },
            { time: this.audioBuffer.duration, gain: 1, curve: 'linear' }
        ];
    }
    
    // Fade in/out shortcuts
    createFadeIn(duration, curve = 'exponential') {
        this.clearPoints();
        this.addPoint(0, 0, curve);
        this.addPoint(duration, 1, 'linear');
        this.addPoint(this.audioBuffer.duration - 0.01, 1, 'linear');
        this.addPoint(this.audioBuffer.duration, 1, 'linear');
    }
    
    createFadeOut(startTime, curve = 'exponential') {
        this.clearPoints();
        this.addPoint(0, 1, 'linear');
        this.addPoint(startTime, 1, curve);
        this.addPoint(this.audioBuffer.duration, 0, 'linear');
    }
    
    createFadeInOut(fadeInDuration, fadeOutStartTime, curve = 'exponential') {
        this.clearPoints();
        this.addPoint(0, 0, curve);
        this.addPoint(fadeInDuration, 1, 'linear');
        this.addPoint(fadeOutStartTime, 1, curve);
        this.addPoint(this.audioBuffer.duration, 0, 'linear');
    }
    
    getParameters() {
        return {
            points: this.getPoints(),
            gainRange: { ...this.gainRange },
            clipToZero: this.clipToZero
        };
    }
    
    setParameters(params) {
        if (params.points) {
            this.points = params.points;
            this.sortPoints();
        }
        if (params.gainRange) {
            this.gainRange = params.gainRange;
        }
        if (params.clipToZero !== undefined) {
            this.clipToZero = params.clipToZero;
        }
    }
    
    destroy() {
        this.stopRealtimeUpdate();
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        this.audioBuffer = null;
    }
}

// Factory function
export function createClipGainAutomation(audioContext, audioBuffer, options = {}) {
    return new ClipGainAutomation(audioContext, audioBuffer, options);
}

// Presets
export const GAIN_AUTOMATION_PRESETS = {
    fadeIn1s: {
        points: [
            { time: 0, gain: 0, curve: 'exponential' },
            { time: 1, gain: 1, curve: 'linear' }
        ]
    },
    fadeOut1s: {
        points: [
            { time: 0, gain: 1, curve: 'linear' },
            { time: 1, gain: 0, curve: 'exponential' }
        ]
    },
    swell: {
        points: [
            { time: 0, gain: 0, curve: 'exponential' },
            { time: 0.5, gain: 1, curve: 'linear' },
            { time: 1, gain: 0, curve: 'exponential' }
        ]
    },
    duck: {
        points: [
            { time: 0, gain: 1, curve: 'linear' },
            { time: 0.1, gain: 0.3, curve: 'linear' },
            { time: 0.5, gain: 0.3, curve: 'linear' },
            { time: 0.6, gain: 1, curve: 'linear' }
        ]
    },
    rampUp: {
        points: [
            { time: 0, gain: 0.5, curve: 'linear' },
            { time: 2, gain: 1.5, curve: 'linear' }
        ]
    },
    tremolo: {
        points: [
            { time: 0, gain: 1, curve: 'sine' },
            { time: 0.1, gain: 0.5, curve: 'sine' },
            { time: 0.2, gain: 1, curve: 'sine' },
            { time: 0.3, gain: 0.5, curve: 'sine' },
            { time: 0.4, gain: 1, curve: 'sine' }
        ]
    }
};

// UI Panel
export function createGainAutomationPanel(gainAutomation, appServices) {
    const container = document.createElement('div');
    container.className = 'gain-automation-panel';
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
    title.textContent = 'Clip Gain Automation';
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
    
    // Draw automation
    drawAutomation(canvas, gainAutomation);
    
    // Click to add point
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * gainAutomation.audioBuffer.duration;
        const y = (e.clientY - rect.top) / rect.height;
        const gain = gainAutomation.gainRange.max - y * (gainAutomation.gainRange.max - gainAutomation.gainRange.min);
        
        gainAutomation.addPoint(x, gain);
        drawAutomation(canvas, gainAutomation);
        updatePointsList();
    });
    
    // Points list
    const pointsContainer = document.createElement('div');
    pointsContainer.id = 'pointsList';
    pointsContainer.style.cssText = 'margin-bottom: 16px; max-height: 150px; overflow-y: auto;';
    container.appendChild(pointsContainer);
    
    function updatePointsList() {
        const points = gainAutomation.getPoints();
        
        pointsContainer.innerHTML = points.map((p, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: #1e1e2e; margin-bottom: 4px; border-radius: 4px; font-size: 12px;">
                <span>Time: ${p.time.toFixed(2)}s | Gain: ${p.gain.toFixed(2)}</span>
                <div style="display: flex; gap: 4px;">
                    <select class="curve-select" data-index="${i}" style="padding: 4px; background: #374151; border: none; border-radius: 4px; color: white;">
                        <option value="linear" ${p.curve === 'linear' ? 'selected' : ''}>Linear</option>
                        <option value="exponential" ${p.curve === 'exponential' ? 'selected' : ''}>Exp</option>
                        <option value="sine" ${p.curve === 'sine' ? 'selected' : ''}>Sine</option>
                        <option value="smooth" ${p.curve === 'smooth' ? 'selected' : ''}>Smooth</option>
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
                gainAutomation.setPointCurve(index, e.target.value);
                drawAutomation(canvas, gainAutomation);
            });
        });
        
        pointsContainer.querySelectorAll('.remove-point').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                gainAutomation.removePoint(index);
                drawAutomation(canvas, gainAutomation);
                updatePointsList();
            });
        });
    }
    
    updatePointsList();
    
    // Quick actions
    const quickActions = document.createElement('div');
    quickActions.style.cssText = 'margin-bottom: 16px;';
    quickActions.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Quick Actions</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="quick-action" data-action="fadeIn" style="padding: 8px 16px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Fade In
            </button>
            <button class="quick-action" data-action="fadeOut" style="padding: 8px 16px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Fade Out
            </button>
            <button class="quick-action" data-action="swell" style="padding: 8px 16px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Swell
            </button>
            <button class="quick-action" data-action="duck" style="padding: 8px 16px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Duck
            </button>
        </div>
    `;
    container.appendChild(quickActions);
    
    // Quick action handlers
    quickActions.querySelectorAll('.quick-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const duration = gainAutomation.audioBuffer.duration;
            
            switch (action) {
                case 'fadeIn':
                    gainAutomation.createFadeIn(Math.min(1, duration * 0.2));
                    break;
                case 'fadeOut':
                    gainAutomation.createFadeOut(Math.max(0, duration - 1));
                    break;
                case 'swell':
                    gainAutomation.createFadeInOut(
                        Math.min(0.5, duration * 0.1),
                        Math.max(0.5, duration - 0.5)
                    );
                    break;
                case 'duck':
                    gainAutomation.setParameters({ points: GAIN_AUTOMATION_PRESETS.duck.points });
                    break;
            }
            
            drawAutomation(canvas, gainAutomation);
            updatePointsList();
        });
    });
    
    // Presets
    const presetsContainer = document.createElement('div');
    presetsContainer.style.cssText = 'margin-bottom: 16px;';
    presetsContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Presets</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Object.keys(GAIN_AUTOMATION_PRESETS).map(name => `
                <button class="preset-btn" data-preset="${name}" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    ${name.charAt(0).toUpperCase() + name.slice(1)}
                </button>
            `).join('')}
        </div>
    `;
    container.appendChild(presetsContainer);
    
    presetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = GAIN_AUTOMATION_PRESETS[btn.dataset.preset];
            gainAutomation.setParameters({ points: preset.points });
            drawAutomation(canvas, gainAutomation);
            updatePointsList();
        });
    });
    
    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'display: flex; gap: 8px;';
    actionsContainer.innerHTML = `
        <button id="clearAutomation" style="flex: 1; padding: 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Clear
        </button>
        <button id="applyAutomation" style="flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Apply to Clip
        </button>
    `;
    container.appendChild(actionsContainer);
    
    document.getElementById('clearAutomation').addEventListener('click', () => {
        gainAutomation.clearPoints();
        drawAutomation(canvas, gainAutomation);
        updatePointsList();
    });
    
    document.getElementById('applyAutomation').addEventListener('click', async () => {
        if (appServices && appServices.showNotification) {
            appServices.showNotification('Gain automation applied to clip', 2000);
        }
        // gainAutomation.applyToBuffer();
    });
    
    // Cleanup
    container.destroy = () => {
        gainAutomation.stopRealtimeUpdate();
    };
    
    return container;
}

function drawAutomation(canvas, gainAutomation) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const duration = gainAutomation.audioBuffer.duration;
    const { min, max } = gainAutomation.gainRange;
    
    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Horizontal lines (gain)
    for (let g = min; g <= max; g += (max - min) / 4) {
        const y = (1 - (g - min) / (max - min)) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.fillText(`${g.toFixed(1)}`, 5, y - 2);
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
    
    // Draw automation curve
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Draw curve between points
    for (let t = 0; t <= duration; t += duration / 200) {
        const gain = gainAutomation.getGainAtTime(t);
        const x = (t / duration) * width;
        const y = (1 - (gain - min) / (max - min)) * height;
        
        if (t === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
    
    // Draw points
    const points = gainAutomation.getPoints();
    
    ctx.fillStyle = '#3b82f6';
    for (const point of points) {
        const x = (point.time / duration) * width;
        const y = (1 - (point.gain - min) / (max - min)) * height;
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Point border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Unity gain line (1.0)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const unityY = (1 - (1 - min) / (max - min)) * height;
    ctx.beginPath();
    ctx.moveTo(0, unityY);
    ctx.lineTo(width, unityY);
    ctx.stroke();
    ctx.setLineDash([]);
}

export default ClipGainAutomation;