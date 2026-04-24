/**
 * Track Automation Curves - Bezier curve automation
 * Allows drawing and editing automation curves with Bezier interpolation
 */

class TrackAutomationCurves {
    constructor(audioContext, options = {}) {
        this.name = 'TrackAutomationCurves';
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            minPoints: 2,
            maxPoints: 100,
            curveResolution: 100, // Points per segment
            defaultDuration: 4, // seconds
            snapToGrid: options.snapToGrid ?? true,
            gridSize: options.gridSize ?? 0.25, // 1/16 notes at 120bpm
            ...options
        };
        
        // Automation tracks
        this.automationTracks = new Map();
        
        // Active editing state
        this.activeTrack = null;
        this.selectedPoint = null;
        this.isDragging = false;
        this.dragType = null; // 'point', 'handleIn', 'handleOut'
        
        // UI state
        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.zoom = 1;
        this.offset = { x: 0, y: 0 };
        
        // Playback state
        this.isPlaying = false;
        this.playbackPosition = 0;
        this.playbackStartTime = 0;
        
        // Callbacks
        this.onAutomationChange = null;
        this.onPointSelect = null;
    }
    
    // Track management
    createAutomationTrack(trackId, parameter, options = {}) {
        const track = {
            id: trackId,
            parameter,
            unit: options.unit || '',
            min: options.min ?? 0,
            max: options.max ?? 1,
            defaultValue: options.defaultValue ?? (options.min ?? 0 + (options.max ?? 1)) / 2,
            duration: options.duration || this.config.defaultDuration,
            points: [
                { time: 0, value: options.defaultValue ?? 0.5, handleIn: null, handleOut: null },
                { time: options.duration || this.config.defaultDuration, value: options.defaultValue ?? 0.5, handleIn: null, handleOut: null }
            ],
            curveType: options.curveType || 'bezier', // 'linear', 'bezier', 'step'
            color: options.color || '#10b981',
            enabled: true
        };
        
        this.automationTracks.set(trackId, track);
        return track;
    }
    
    removeAutomationTrack(trackId) {
        this.automationTracks.delete(trackId);
        if (this.activeTrack === trackId) {
            this.activeTrack = null;
        }
    }
    
    // Point management
    addPoint(trackId, time, value, options = {}) {
        const track = this.automationTracks.get(trackId);
        if (!track) return null;
        
        // Clamp time within duration
        time = Math.max(0, Math.min(track.duration, time));
        
        // Clamp value within range
        value = Math.max(track.min, Math.min(track.max, value));
        
        // Snap to grid if enabled
        if (this.config.snapToGrid) {
            time = Math.round(time / this.config.gridSize) * this.config.gridSize;
        }
        
        // Check if point already exists at this time
        const existingIndex = track.points.findIndex(p => Math.abs(p.time - time) < 0.001);
        if (existingIndex !== -1) {
            // Update existing point
            track.points[existingIndex].value = value;
            return track.points[existingIndex];
        }
        
        // Create new point
        const point = {
            time,
            value,
            handleIn: options.handleIn || null,
            handleOut: options.handleOut || null,
            curveType: options.curveType || track.curveType
        };
        
        // Insert in time order
        const insertIndex = track.points.findIndex(p => p.time > time);
        if (insertIndex === -1) {
            track.points.push(point);
        } else {
            track.points.splice(insertIndex, 0, point);
        }
        
        if (this.onAutomationChange) {
            this.onAutomationChange({ type: 'point_added', trackId, point });
        }
        
        return point;
    }
    
    removePoint(trackId, pointIndex) {
        const track = this.automationTracks.get(trackId);
        if (!track) return false;
        
        // Don't remove first or last point
        if (pointIndex <= 0 || pointIndex >= track.points.length - 1) {
            return false;
        }
        
        const removedPoint = track.points.splice(pointIndex, 1)[0];
        
        if (this.onAutomationChange) {
            this.onAutomationChange({ type: 'point_removed', trackId, point: removedPoint });
        }
        
        return true;
    }
    
    updatePoint(trackId, pointIndex, updates) {
        const track = this.automationTracks.get(trackId);
        if (!track || !track.points[pointIndex]) return false;
        
        const point = track.points[pointIndex];
        
        // Update time
        if (updates.time !== undefined) {
            let newTime = updates.time;
            
            // Snap to grid
            if (this.config.snapToGrid) {
                newTime = Math.round(newTime / this.config.gridSize) * this.config.gridSize;
            }
            
            // Clamp
            newTime = Math.max(0, Math.min(track.duration, newTime));
            
            // Re-sort if time changed
            if (Math.abs(newTime - point.time) > 0.001) {
                track.points.splice(pointIndex, 1);
                point.time = newTime;
                const insertIndex = track.points.findIndex(p => p.time > newTime);
                if (insertIndex === -1) {
                    track.points.push(point);
                } else {
                    track.points.splice(insertIndex, 0, point);
                }
            }
        }
        
        // Update value
        if (updates.value !== undefined) {
            point.value = Math.max(track.min, Math.min(track.max, updates.value));
        }
        
        // Update handles
        if (updates.handleIn !== undefined) {
            point.handleIn = updates.handleIn;
        }
        if (updates.handleOut !== undefined) {
            point.handleOut = updates.handleOut;
        }
        
        if (this.onAutomationChange) {
            this.onAutomationChange({ type: 'point_updated', trackId, point, index: pointIndex });
        }
        
        return true;
    }
    
    // Curve evaluation
    getValueAt(trackId, time) {
        const track = this.automationTracks.get(trackId);
        if (!track || track.points.length === 0) {
            return 0;
        }
        
        // Find surrounding points
        let prevPoint = track.points[0];
        let nextPoint = track.points[track.points.length - 1];
        
        for (let i = 0; i < track.points.length - 1; i++) {
            if (track.points[i].time <= time && track.points[i + 1].time > time) {
                prevPoint = track.points[i];
                nextPoint = track.points[i + 1];
                break;
            }
        }
        
        // Before first point
        if (time <= prevPoint.time) {
            return prevPoint.value;
        }
        
        // After last point
        if (time >= nextPoint.time) {
            return nextPoint.value;
        }
        
        // Interpolate
        const t = (time - prevPoint.time) / (nextPoint.time - prevPoint.time);
        
        switch (prevPoint.curveType || track.curveType) {
            case 'linear':
                return this.linearInterpolate(prevPoint.value, nextPoint.value, t);
            
            case 'step':
                return prevPoint.value;
            
            case 'bezier':
            default:
                return this.bezierInterpolate(prevPoint, nextPoint, t);
        }
    }
    
    linearInterpolate(a, b, t) {
        return a + (b - a) * t;
    }
    
    bezierInterpolate(p0, p1, t) {
        // Cubic Bezier with handles
        // If no handles, use linear interpolation
        if (!p0.handleOut && !p1.handleIn) {
            return this.linearInterpolate(p0.value, p1.value, t);
        }
        
        // Calculate handle values
        const dt = p1.time - p0.time;
        const handleOutTime = p0.handleOut 
            ? Math.min(p1.time, p0.time + p0.handleOut.time * dt)
            : p0.time + dt / 3;
        const handleOutValue = p0.handleOut
            ? p0.value + p0.handleOut.value * (p1.value - p0.value)
            : p0.value + (p1.value - p0.value) / 3;
        
        const handleInTime = p1.handleIn
            ? Math.max(p0.time, p1.time - p1.handleIn.time * dt)
            : p1.time - dt / 3;
        const handleInValue = p1.handleIn
            ? p1.value - p1.handleIn.value * (p1.value - p0.value)
            : p1.value - (p1.value - p0.value) / 3;
        
        // Cubic Bezier
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        
        // Simplified 1D Bezier
        const y0 = p0.value;
        const y1 = handleOutValue;
        const y2 = handleInValue;
        const y3 = p1.value;
        
        return mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
    }
    
    // Generate curve points for display
    generateCurvePoints(trackId, resolution = this.config.curveResolution) {
        const track = this.automationTracks.get(trackId);
        if (!track) return [];
        
        const points = [];
        for (let i = 0; i <= resolution; i++) {
            const t = (i / resolution) * track.duration;
            points.push({
                time: t,
                value: this.getValueAt(trackId, t)
            });
        }
        
        return points;
    }
    
    // Apply automation to parameter
    applyToParameter(trackId, parameter, startTime = 0, duration = null) {
        const track = this.automationTracks.get(trackId);
        if (!track || !track.enabled) return;
        
        const endTime = startTime + (duration || track.duration);
        const now = this.audioContext.currentTime;
        
        // Cancel any scheduled values
        parameter.cancelScheduledValues(now);
        
        // Schedule automation
        for (const point of track.points) {
            const time = now + startTime + point.time;
            
            if (time < now) continue;
            
            // Use linear ramp for now (Web Audio limitation)
            // For more complex curves, we'd need to use setValueCurveAtTime
            parameter.linearRampToValueAtTime(point.value, time);
        }
    }
    
    // Playback
    startPlayback() {
        this.isPlaying = true;
        this.playbackStartTime = this.audioContext.currentTime - this.playbackPosition;
    }
    
    stopPlayback() {
        this.isPlaying = false;
        this.playbackPosition = this.audioContext.currentTime - this.playbackStartTime;
    }
    
    setPlaybackPosition(position) {
        this.playbackPosition = position;
        if (this.isPlaying) {
            this.playbackStartTime = this.audioContext.currentTime - position;
        }
    }
    
    getCurrentPlaybackPosition() {
        if (this.isPlaying) {
            return this.audioContext.currentTime - this.playbackStartTime;
        }
        return this.playbackPosition;
    }
    
    // UI
    createUI(container) {
        this.container = container;
        
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <h3 style="margin: 0; font-size: 14px;">Track Automation Curves</h3>
                        <select id="automation-track-select" style="
                            padding: 6px 12px;
                            background: #2a2a4e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        "></select>
                    </div>
                    <div>
                        <button id="add-point-btn" style="padding: 6px 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Add Point</button>
                        <button id="reset-curve-btn" style="padding: 6px 12px; background: #f59e0b; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Reset</button>
                        <button id="clear-curve-btn" style="padding: 6px 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">Clear</button>
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <canvas id="automation-canvas" width="800" height="200" style="flex: 1; background: #2a2a4e; border-radius: 4px; cursor: crosshair;"></canvas>
                    
                    <div style="width: 200px; background: #2a2a4e; border-radius: 4px; padding: 12px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #888;">POINT PROPERTIES</h4>
                        <div id="point-properties" style="font-size: 12px;">
                            <p style="color: #666;">Select a point to edit</p>
                        </div>
                        
                        <h4 style="margin: 20px 0 12px 0; font-size: 12px; color: #888;">CURVE TYPE</h4>
                        <select id="curve-type-select" style="
                            width: 100%;
                            padding: 6px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                            <option value="bezier">Bezier</option>
                            <option value="linear">Linear</option>
                            <option value="step">Step</option>
                        </select>
                        
                        <h4 style="margin: 20px 0 12px 0; font-size: 12px; color: #888;">ZOOM</h4>
                        <input type="range" id="zoom-slider" min="0.5" max="4" step="0.1" value="1" style="width: 100%;">
                    </div>
                </div>
                
                <div style="margin-top: 12px; display: flex; gap: 12px; font-size: 12px; color: #888;">
                    <label>
                        <input type="checkbox" id="snap-grid-checkbox" ${this.config.snapToGrid ? 'checked' : ''}>
                        Snap to Grid
                    </label>
                    <label>
                        Grid Size:
                        <input type="number" id="grid-size-input" value="${this.config.gridSize}" min="0.01" max="1" step="0.01" style="width: 60px; padding: 4px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
                    </label>
                </div>
            </div>
        `;
        
        this.canvas = container.querySelector('#automation-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.setupEventHandlers();
        this.updateTrackSelect();
        this.draw();
    }
    
    setupEventHandlers() {
        // Track select
        const trackSelect = this.container.querySelector('#automation-track-select');
        trackSelect.onchange = () => {
            this.activeTrack = trackSelect.value;
            this.selectedPoint = null;
            this.draw();
        };
        
        // Add point
        this.container.querySelector('#add-point-btn').onclick = () => {
            if (this.activeTrack) {
                const track = this.automationTracks.get(this.activeTrack);
                if (track) {
                    const midTime = track.duration / 2;
                    const midValue = this.getValueAt(this.activeTrack, midTime);
                    this.addPoint(this.activeTrack, midTime, midValue);
                    this.draw();
                }
            }
        };
        
        // Reset curve
        this.container.querySelector('#reset-curve-btn').onclick = () => {
            if (this.activeTrack) {
                const track = this.automationTracks.get(this.activeTrack);
                if (track) {
                    track.points = [
                        { time: 0, value: track.defaultValue, handleIn: null, handleOut: null },
                        { time: track.duration, value: track.defaultValue, handleIn: null, handleOut: null }
                    ];
                    this.selectedPoint = null;
                    this.draw();
                }
            }
        };
        
        // Clear curve
        this.container.querySelector('#clear-curve-btn').onclick = () => {
            if (this.activeTrack) {
                this.removeAutomationTrack(this.activeTrack);
                this.activeTrack = null;
                this.selectedPoint = null;
                this.updateTrackSelect();
                this.draw();
            }
        };
        
        // Curve type
        const curveTypeSelect = this.container.querySelector('#curve-type-select');
        curveTypeSelect.onchange = () => {
            if (this.activeTrack) {
                const track = this.automationTracks.get(this.activeTrack);
                if (track) {
                    track.curveType = curveTypeSelect.value;
                    this.draw();
                }
            }
        };
        
        // Zoom
        const zoomSlider = this.container.querySelector('#zoom-slider');
        zoomSlider.oninput = () => {
            this.zoom = parseFloat(zoomSlider.value);
            this.draw();
        };
        
        // Snap to grid
        const snapCheckbox = this.container.querySelector('#snap-grid-checkbox');
        snapCheckbox.onchange = () => {
            this.config.snapToGrid = snapCheckbox.checked;
        };
        
        // Grid size
        const gridSizeInput = this.container.querySelector('#grid-size-input');
        gridSizeInput.onchange = () => {
            this.config.gridSize = parseFloat(gridSizeInput.value) || 0.25;
        };
        
        // Canvas mouse events
        this.canvas.onmousedown = (e) => this.handleMouseDown(e);
        this.canvas.onmousemove = (e) => this.handleMouseMove(e);
        this.canvas.onmouseup = (e) => this.handleMouseUp(e);
        this.canvas.ondblclick = (e) => this.handleDoubleClick(e);
        
        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    handleMouseDown(e) {
        if (!this.activeTrack) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const point = this.findPointAt(x, y);
        
        if (point) {
            this.selectedPoint = point.index;
            this.isDragging = true;
            this.dragType = point.type;
            this.updatePointProperties();
        } else {
            this.selectedPoint = null;
            this.updatePointProperties();
        }
        
        this.draw();
    }
    
    handleMouseMove(e) {
        if (!this.isDragging || !this.activeTrack) return;
        
        const track = this.automationTracks.get(this.activeTrack);
        if (!track || this.selectedPoint === null) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const time = this.xToTime(x);
        const value = this.yToValue(y);
        
        if (this.dragType === 'point') {
            this.updatePoint(this.activeTrack, this.selectedPoint, { time, value });
        } else if (this.dragType === 'handleIn') {
            // Update handle in
            const point = track.points[this.selectedPoint];
            const dx = time - point.time;
            const dy = value - point.value;
            point.handleIn = { time: -dx / track.duration, value: dy / (track.max - track.min) };
        } else if (this.dragType === 'handleOut') {
            const point = track.points[this.selectedPoint];
            const dx = time - point.time;
            const dy = value - point.value;
            point.handleOut = { time: dx / track.duration, value: dy / (track.max - track.min) };
        }
        
        this.draw();
        this.updatePointProperties();
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        this.dragType = null;
    }
    
    handleDoubleClick(e) {
        if (!this.activeTrack) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const time = this.xToTime(x);
        const value = this.yToValue(y);
        
        this.addPoint(this.activeTrack, time, value);
        this.draw();
    }
    
    handleKeyDown(e) {
        if (!this.activeTrack || this.selectedPoint === null) return;
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.removePoint(this.activeTrack, this.selectedPoint);
            this.selectedPoint = null;
            this.updatePointProperties();
            this.draw();
        }
    }
    
    findPointAt(x, y) {
        if (!this.activeTrack) return null;
        
        const track = this.automationTracks.get(this.activeTrack);
        if (!track) return null;
        
        const threshold = 10;
        
        for (let i = 0; i < track.points.length; i++) {
            const point = track.points[i];
            const px = this.timeToX(point.time);
            const py = this.valueToY(point.value);
            
            // Check main point
            if (Math.abs(x - px) < threshold && Math.abs(y - py) < threshold) {
                return { index: i, type: 'point' };
            }
            
            // Check handles
            if (point.handleOut) {
                const hx = this.timeToX(point.time + point.handleOut.time * track.duration);
                const hy = this.valueToY(point.value + point.handleOut.value * (track.max - track.min));
                if (Math.abs(x - hx) < threshold && Math.abs(y - hy) < threshold) {
                    return { index: i, type: 'handleOut' };
                }
            }
            
            if (point.handleIn) {
                const hx = this.timeToX(point.time - point.handleIn.time * track.duration);
                const hy = this.valueToY(point.value - point.handleIn.value * (track.max - track.min));
                if (Math.abs(x - hx) < threshold && Math.abs(y - hy) < threshold) {
                    return { index: i, type: 'handleIn' };
                }
            }
        }
        
        return null;
    }
    
    // Coordinate transformations
    timeToX(time) {
        const padding = 40;
        const width = this.canvas.width - padding * 2;
        const track = this.automationTracks.get(this.activeTrack);
        const duration = track ? track.duration : this.config.defaultDuration;
        return padding + (time / duration) * width / this.zoom;
    }
    
    xToTime(x) {
        const padding = 40;
        const width = this.canvas.width - padding * 2;
        const track = this.automationTracks.get(this.activeTrack);
        const duration = track ? track.duration : this.config.defaultDuration;
        return ((x - padding) * this.zoom / width) * duration;
    }
    
    valueToY(value) {
        const padding = 20;
        const height = this.canvas.height - padding * 2;
        const track = this.automationTracks.get(this.activeTrack);
        const min = track ? track.min : 0;
        const max = track ? track.max : 1;
        return padding + height - ((value - min) / (max - min)) * height;
    }
    
    yToValue(y) {
        const padding = 20;
        const height = this.canvas.height - padding * 2;
        const track = this.automationTracks.get(this.activeTrack);
        const min = track ? track.min : 0;
        const max = track ? track.max : 1;
        return min + (1 - (y - padding) / height) * (max - min);
    }
    
    // Drawing
    draw() {
        if (!this.ctx) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw curve
        if (this.activeTrack) {
            this.drawCurve();
            this.drawPoints();
        }
        
        // Draw playback position
        this.drawPlaybackPosition();
    }
    
    drawGrid() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = 40;
        
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        
        // Vertical lines (time)
        const track = this.automationTracks.get(this.activeTrack);
        const duration = track ? track.duration : this.config.defaultDuration;
        const timeStep = this.config.gridSize;
        
        for (let t = 0; t <= duration; t += timeStep) {
            const x = this.timeToX(t);
            if (x < padding || x > width - padding) continue;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, 20);
            this.ctx.lineTo(x, height - 20);
            this.ctx.stroke();
            
            // Time label
            this.ctx.fillStyle = '#666';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(t.toFixed(2) + 's', x, height - 5);
        }
        
        // Horizontal lines (value)
        const min = track ? track.min : 0;
        const max = track ? track.max : 1;
        const valueStep = (max - min) / 10;
        
        for (let v = min; v <= max; v += valueStep) {
            const y = this.valueToY(v);
            
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
            
            // Value label
            this.ctx.fillStyle = '#666';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(v.toFixed(2), padding - 5, y + 4);
        }
    }
    
    drawCurve() {
        const track = this.automationTracks.get(this.activeTrack);
        if (!track) return;
        
        const curvePoints = this.generateCurvePoints(this.activeTrack);
        
        this.ctx.strokeStyle = track.color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        for (let i = 0; i < curvePoints.length; i++) {
            const point = curvePoints[i];
            const x = this.timeToX(point.time);
            const y = this.valueToY(point.value);
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        
        // Fill area under curve
        this.ctx.fillStyle = track.color + '33';
        this.ctx.beginPath();
        this.ctx.moveTo(this.timeToX(0), this.valueToY(track.min));
        
        for (const point of curvePoints) {
            this.ctx.lineTo(this.timeToX(point.time), this.valueToY(point.value));
        }
        
        this.ctx.lineTo(this.timeToX(track.duration), this.valueToY(track.min));
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawPoints() {
        const track = this.automationTracks.get(this.activeTrack);
        if (!track) return;
        
        for (let i = 0; i < track.points.length; i++) {
            const point = track.points[i];
            const x = this.timeToX(point.time);
            const y = this.valueToY(point.value);
            
            // Draw handles
            if (point.handleIn) {
                const hx = this.timeToX(point.time - point.handleIn.time * track.duration);
                const hy = this.valueToY(point.value - point.handleIn.value * (track.max - track.min));
                
                this.ctx.strokeStyle = '#f59e0b';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(hx, hy);
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#f59e0b';
                this.ctx.beginPath();
                this.ctx.arc(hx, hy, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            if (point.handleOut) {
                const hx = this.timeToX(point.time + point.handleOut.time * track.duration);
                const hy = this.valueToY(point.value + point.handleOut.value * (track.max - track.min));
                
                this.ctx.strokeStyle = '#f59e0b';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(hx, hy);
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#f59e0b';
                this.ctx.beginPath();
                this.ctx.arc(hx, hy, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // Draw point
            const isSelected = this.selectedPoint === i;
            this.ctx.fillStyle = isSelected ? '#fff' : track.color;
            this.ctx.strokeStyle = isSelected ? '#fff' : '#888';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }
    
    drawPlaybackPosition() {
        const position = this.getCurrentPlaybackPosition();
        const x = this.timeToX(position);
        
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 20);
        this.ctx.lineTo(x, this.canvas.height - 20);
        this.ctx.stroke();
    }
    
    updatePointProperties() {
        const container = this.container.querySelector('#point-properties');
        
        if (this.selectedPoint === null || !this.activeTrack) {
            container.innerHTML = '<p style="color: #666;">Select a point to edit</p>';
            return;
        }
        
        const track = this.automationTracks.get(this.activeTrack);
        const point = track.points[this.selectedPoint];
        
        container.innerHTML = `
            <div style="margin-bottom: 8px;">
                <label style="color: #888;">Time:</label>
                <input type="number" id="point-time" value="${point.time.toFixed(3)}" step="0.001" style="
                    width: 100%;
                    padding: 4px;
                    background: #1a1a2e;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: white;
                ">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="color: #888;">Value:</label>
                <input type="number" id="point-value" value="${point.value.toFixed(3)}" step="0.001" style="
                    width: 100%;
                    padding: 4px;
                    background: #1a1a2e;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: white;
                ">
            </div>
            <button id="delete-point-btn" style="
                width: 100%;
                padding: 6px;
                background: #ef4444;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                margin-top: 8px;
            ">Delete Point</button>
        `;
        
        container.querySelector('#point-time').onchange = (e) => {
            this.updatePoint(this.activeTrack, this.selectedPoint, { time: parseFloat(e.target.value) });
            this.draw();
        };
        
        container.querySelector('#point-value').onchange = (e) => {
            this.updatePoint(this.activeTrack, this.selectedPoint, { value: parseFloat(e.target.value) });
            this.draw();
        };
        
        container.querySelector('#delete-point-btn').onclick = () => {
            this.removePoint(this.activeTrack, this.selectedPoint);
            this.selectedPoint = null;
            this.updatePointProperties();
            this.draw();
        };
    }
    
    updateTrackSelect() {
        const select = this.container.querySelector('#automation-track-select');
        select.innerHTML = '';
        
        for (const [id, track] of this.automationTracks) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${track.parameter} (${id})`;
            if (id === this.activeTrack) {
                option.selected = true;
            }
            select.appendChild(option);
        }
        
        if (this.automationTracks.size === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No automation tracks';
            option.disabled = true;
            select.appendChild(option);
        }
    }
    
    openPanel() {
        const existing = document.getElementById('automation-curves-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'automation-curves-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 900px;
            max-height: 80vh;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
            overflow: hidden;
        `;
        
        document.body.appendChild(panel);
        this.createUI(panel);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);
        
        // Add create track button
        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Track';
        createBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 80px;
            padding: 6px 12px;
            background: #10b981;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        createBtn.onclick = () => {
            const id = `track_${Date.now()}`;
            this.createAutomationTrack(id, 'Volume', { min: 0, max: 1, defaultValue: 0.5 });
            this.activeTrack = id;
            this.updateTrackSelect();
            this.draw();
        };
        panel.appendChild(createBtn);
    }
    
    // Serialization
    exportAutomation(trackId) {
        const track = this.automationTracks.get(trackId);
        if (!track) return null;
        
        return JSON.parse(JSON.stringify(track));
    }
    
    importAutomation(data) {
        this.automationTracks.set(data.id, data);
        return data.id;
    }
    
    exportAllAutomation() {
        const result = {};
        for (const [id, track] of this.automationTracks) {
            result[id] = this.exportAutomation(id);
        }
        return result;
    }
    
    importAllAutomation(data) {
        for (const [id, track] of Object.entries(data)) {
            this.automationTracks.set(id, track);
        }
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TrackAutomationCurves };
} else if (typeof window !== 'undefined') {
    window.TrackAutomationCurves = TrackAutomationCurves;
}