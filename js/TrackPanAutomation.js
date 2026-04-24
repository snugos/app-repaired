/**
 * Track Pan Automation
 * Draw pan automation on timeline for each track
 */

export class TrackPanAutomation {
    constructor() {
        this.trackId = null;
        this.points = []; // { time, pan } where pan is -1 (left) to 1 (right)
        this.isEnabled = true;
        this.smoothCurves = true;
    }

    /**
     * Set the track for automation
     */
    setTrack(trackId) {
        this.trackId = trackId;
    }

    /**
     * Add an automation point
     */
    addPoint(time, pan) {
        const point = {
            time: Math.max(0, time),
            pan: Math.max(-1, Math.min(1, pan))
        };
        
        this.points.push(point);
        this.points.sort((a, b) => a.time - b.time);
        
        return point;
    }

    /**
     * Remove a point by index
     */
    removePoint(index) {
        if (index >= 0 && index < this.points.length) {
            this.points.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Clear all points
     */
    clearPoints() {
        this.points = [];
    }

    /**
     * Get pan value at a specific time
     */
    getPanAtTime(time) {
        if (this.points.length === 0) return 0;
        if (this.points.length === 1) return this.points[0].pan;
        
        // Find surrounding points
        let before = null;
        let after = null;
        
        for (let i = 0; i < this.points.length; i++) {
            if (this.points[i].time <= time) {
                before = this.points[i];
            }
            if (this.points[i].time > time && !after) {
                after = this.points[i];
            }
        }
        
        // No points after time
        if (!after) return before ? before.pan : 0;
        // No points before time
        if (!before) return after.pan;
        
        // Interpolate
        const t = (time - before.time) / (after.time - before.time);
        
        if (this.smoothCurves) {
            // Smooth interpolation using cosine
            const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
            return before.pan + smoothT * (after.pan - before.pan);
        } else {
            // Linear interpolation
            return before.pan + t * (after.pan - before.pan);
        }
    }

    /**
     * Get all automation points
     */
    getPoints() {
        return [...this.points];
    }

    /**
     * Set points from array
     */
    setPoints(points) {
        this.points = points.map(p => ({
            time: Math.max(0, p.time),
            pan: Math.max(-1, Math.min(1, p.pan))
        })).sort((a, b) => a.time - b.time);
    }

    /**
     * Generate automation curve for display
     */
    getCurveData(startTime = 0, endTime = 10, resolution = 100) {
        const data = [];
        const step = (endTime - startTime) / resolution;
        
        for (let i = 0; i <= resolution; i++) {
            const time = startTime + i * step;
            data.push({
                time,
                pan: this.getPanAtTime(time)
            });
        }
        
        return data;
    }

    /**
     * Get built-in presets
     */
    static getPresets() {
        return [
            { name: 'Center', points: [{ time: 0, pan: 0 }] },
            { name: 'Left', points: [{ time: 0, pan: -1 }] },
            { name: 'Right', points: [{ time: 0, pan: 1 }] },
            { name: 'Slow Sweep L-R', points: [
                { time: 0, pan: -1 },
                { time: 4, pan: 1 }
            ]},
            { name: 'Slow Sweep R-L', points: [
                { time: 0, pan: 1 },
                { time: 4, pan: -1 }
            ]},
            { name: 'Fast Tremolo', points: [
                { time: 0, pan: -1 },
                { time: 0.25, pan: 1 },
                { time: 0.5, pan: -1 },
                { time: 0.75, pan: 1 },
                { time: 1, pan: -1 }
            ]},
            { name: 'Medium Tremolo', points: [
                { time: 0, pan: -1 },
                { time: 0.5, pan: 1 },
                { time: 1, pan: -1 },
                { time: 1.5, pan: 1 },
                { time: 2, pan: -1 }
            ]},
            { name: 'Triangle Wave', points: [
                { time: 0, pan: -1 },
                { time: 2, pan: 1 },
                { time: 4, pan: -1 },
                { time: 6, pan: 1 },
                { time: 8, pan: -1 }
            ]},
            { name: 'Fade Left', points: [
                { time: 0, pan: 0 },
                { time: 4, pan: -1 }
            ]},
            { name: 'Fade Right', points: [
                { time: 0, pan: 0 },
                { time: 4, pan: 1 }
            ]},
            { name: 'Return to Center', points: [
                { time: 0, pan: -0.7 },
                { time: 2, pan: 0 }
            ]},
            { name: 'Auto-Pan', points: [
                { time: 0, pan: -1 },
                { time: 1, pan: 1 },
                { time: 2, pan: -1 },
                { time: 3, pan: 1 },
                { time: 4, pan: -1 },
                { time: 5, pan: 1 },
                { time: 6, pan: -1 },
                { time: 7, pan: 1 },
                { time: 8, pan: -1 }
            ]},
            { name: 'Subtle Movement', points: [
                { time: 0, pan: -0.3 },
                { time: 2, pan: 0.3 },
                { time: 4, pan: -0.3 },
                { time: 6, pan: 0.3 },
                { time: 8, pan: -0.3 }
            ]}
        ];
    }

    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const presets = TrackPanAutomation.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            this.setPoints(preset.points);
            return true;
        }
        
        return false;
    }

    /**
     * Create automation from audio analysis (stereo width detection)
     */
    createFromAudio(buffer) {
        this.points = [];
        
        if (!buffer || buffer.numberOfChannels < 2) {
            this.addPoint(0, 0);
            return;
        }
        
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.getChannelData(1);
        const sampleRate = buffer.sampleRate;
        const duration = buffer.duration;
        
        // Analyze in chunks
        const chunkDuration = 0.5; // 500ms chunks
        const chunkSamples = Math.round(chunkDuration * sampleRate);
        
        for (let chunk = 0; chunk < duration / chunkDuration; chunk++) {
            const startSample = chunk * chunkSamples;
            const endSample = Math.min(startSample + chunkSamples, leftChannel.length);
            
            let leftEnergy = 0;
            let rightEnergy = 0;
            
            for (let i = startSample; i < endSample; i++) {
                leftEnergy += leftChannel[i] * leftChannel[i];
                rightEnergy += rightChannel[i] * rightChannel[i];
            }
            
            // Normalize
            const totalEnergy = leftEnergy + rightEnergy;
            if (totalEnergy > 0) {
                const pan = (rightEnergy - leftEnergy) / totalEnergy;
                this.addPoint(chunk * chunkDuration, pan);
            }
        }
    }

    /**
     * Export automation
     */
    exportAutomation() {
        return {
            trackId: this.trackId,
            points: [...this.points],
            isEnabled: this.isEnabled,
            smoothCurves: this.smoothCurves
        };
    }

    /**
     * Import automation
     */
    importAutomation(data) {
        if (data.trackId) this.trackId = data.trackId;
        if (data.points) this.setPoints(data.points);
        if (data.isEnabled !== undefined) this.isEnabled = data.isEnabled;
        if (data.smoothCurves !== undefined) this.smoothCurves = data.smoothCurves;
    }
}

// UI Panel for track pan automation
let panAutomationPanel = null;

export function openTrackPanAutomationPanel(services = {}) {
    if (panAutomationPanel) {
        panAutomationPanel.remove();
    }
    
    const automation = new TrackPanAutomation();
    let isDragging = false;
    let dragPointIndex = -1;
    let duration = 8; // Default duration in beats
    
    const panel = document.createElement('div');
    panel.className = 'snug-window pan-automation-panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div class="panel-header" style="
            padding: 12px 16px;
            background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <h3 style="margin: 0; color: #fff; font-size: 16px;">Track Pan Automation</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        
        <div class="panel-content" style="padding: 16px;">
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Track</label>
                    <select id="trackSelect" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="">-- Select Track --</option>
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preset</label>
                    <select id="panPreset" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="">-- Select Preset --</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 12px;">
                    <input type="checkbox" id="smoothCurves" checked style="accent-color: #4a9eff;">
                    Smooth Interpolation
                </label>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 8px;">
                    Automation Editor <span style="color: #666;">(Click to add points, drag to move, right-click to remove)</span>
                </label>
                <canvas id="automationCanvas" width="550" height="100" style="
                    width: 100%;
                    background: #0a0a1e;
                    border: 1px solid #333;
                    border-radius: 4px;
                    cursor: crosshair;
                "></canvas>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span style="color: #666; font-size: 10px;">L -1.0</span>
                    <span style="color: #666; font-size: 10px;">Center 0</span>
                    <span style="color: #666; font-size: 10px;">R +1.0</span>
                </div>
            </div>
            
            <div style="
                background: #0a0a1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: #aaa; font-size: 12px;">Points: </span>
                        <span id="pointCount" style="color: #fff;">0</span>
                    </div>
                    <div>
                        <span style="color: #aaa; font-size: 12px;">Current Pan: </span>
                        <span id="currentPan" style="color: #4a9eff;">0.00</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="clearBtn" style="
                    background: #6e3a3a;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Clear</button>
                <button id="previewBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Preview</button>
                <button id="applyBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Apply to Track</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    panAutomationPanel = panel;
    
    // Populate selects
    const trackSelect = panel.querySelector('#trackSelect');
    const presetSelect = panel.querySelector('#panPreset');
    
    if (services.getTracks) {
        services.getTracks().forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name || t.id;
            trackSelect.appendChild(option);
        });
    } else {
        // Demo tracks
        ['Track 1', 'Track 2', 'Track 3'].forEach((name, i) => {
            const option = document.createElement('option');
            option.value = `track-${i + 1}`;
            option.textContent = name;
            trackSelect.appendChild(option);
        });
    }
    
    TrackPanAutomation.getPresets().forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    // Get elements
    const smoothCheck = panel.querySelector('#smoothCurves');
    const canvas = panel.querySelector('#automationCanvas');
    const ctx = canvas.getContext('2d');
    const pointCount = panel.querySelector('#pointCount');
    const currentPan = panel.querySelector('#currentPan');
    
    // Draw automation
    const drawAutomation = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw center line
        ctx.strokeStyle = '#333';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw automation curve
        if (automation.points.length > 0) {
            const curveData = automation.getCurveData(0, duration, 200);
            
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            curveData.forEach((point, i) => {
                const x = (point.time / duration) * canvas.width;
                const y = canvas.height / 2 - point.pan * canvas.height / 2;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            
            ctx.stroke();
            
            // Draw points
            automation.points.forEach((point, index) => {
                const x = (point.time / duration) * canvas.width;
                const y = canvas.height / 2 - point.pan * canvas.height / 2;
                
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        // Labels
        ctx.fillStyle = '#444';
        ctx.font = '10px sans-serif';
        ctx.fillText('L', 5, 12);
        ctx.fillText('R', 5, canvas.height - 5);
        
        pointCount.textContent = automation.points.length;
    };
    
    // Canvas interaction
    const getPointFromPosition = (x, y) => {
        const time = (x / canvas.width) * duration;
        const pan = -((y / canvas.height) * 2 - 1);
        return { time, pan };
    };
    
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if near existing point
        for (let i = 0; i < automation.points.length; i++) {
            const px = (automation.points[i].time / duration) * canvas.width;
            const py = canvas.height / 2 - automation.points[i].pan * canvas.height / 2;
            
            if (Math.hypot(x - px, y - py) < 10) {
                isDragging = true;
                dragPointIndex = i;
                return;
            }
        }
        
        // Add new point
        const point = getPointFromPosition(x, y);
        automation.addPoint(point.time, point.pan);
        drawAutomation();
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (isDragging && dragPointIndex >= 0) {
            const point = getPointFromPosition(x, y);
            automation.points[dragPointIndex] = {
                time: Math.max(0, point.time),
                pan: Math.max(-1, Math.min(1, point.pan))
            };
            automation.points.sort((a, b) => a.time - b.time);
            drawAutomation();
        }
        
        // Update current pan display
        const time = (x / canvas.width) * duration;
        const pan = automation.getPanAtTime(time);
        currentPan.textContent = pan.toFixed(2);
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        dragPointIndex = -1;
    });
    
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Find and remove nearest point
        for (let i = 0; i < automation.points.length; i++) {
            const px = (automation.points[i].time / duration) * canvas.width;
            const py = canvas.height / 2 - automation.points[i].pan * canvas.height / 2;
            
            if (Math.hypot(x - px, y - py) < 10) {
                automation.removePoint(i);
                drawAutomation();
                return;
            }
        }
    });
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        panAutomationPanel = null;
    });
    
    trackSelect.addEventListener('change', () => {
        automation.setTrack(trackSelect.value);
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            automation.applyPreset(presetSelect.value);
            drawAutomation();
        }
    });
    
    smoothCheck.addEventListener('change', () => {
        automation.smoothCurves = smoothCheck.checked;
        drawAutomation();
    });
    
    // Buttons
    const clearBtn = panel.querySelector('#clearBtn');
    clearBtn.addEventListener('click', () => {
        automation.clearPoints();
        drawAutomation();
    });
    
    const previewBtn = panel.querySelector('#previewBtn');
    previewBtn.addEventListener('click', () => {
        if (services.previewPanAutomation) {
            services.previewPanAutomation(automation.trackId, automation);
        }
    });
    
    const applyBtn = panel.querySelector('#applyBtn');
    applyBtn.addEventListener('click', () => {
        if (services.applyPanAutomation) {
            services.applyPanAutomation(automation.trackId, automation);
        }
    });
    
    // Initial draw
    drawAutomation();
    
    return panel;
}

export default TrackPanAutomation;