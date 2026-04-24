/**
 * Audio Montage View - Non-destructive arrangement view
 * Provides a non-destructive editing view for audio arrangements
 */

class AudioMontageView {
    constructor(audioContext, options = {}) {
        this.name = 'AudioMontageView';
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            pixelsPerSecond: options.pixelsPerSecond || 50,
            trackHeight: options.trackHeight || 80,
            snapToGrid: options.snapToGrid ?? true,
            gridSize: options.gridSize || 0.125, // 1/8 note
            minClipWidth: options.minClipWidth || 10,
            ...options
        };
        
        // Timeline state
        this.timeline = {
            duration: 120, // seconds
            zoom: 1,
            scrollX: 0,
            scrollY: 0,
            loopEnabled: false,
            loopStart: 0,
            loopEnd: 120
        };
        
        // Tracks
        this.tracks = [];
        
        // Clips
        this.clips = new Map();
        
        // Selection
        this.selection = {
            clips: [],
            tracks: [],
            range: null // { start, end }
        };
        
        // Playback
        this.playbackPosition = 0;
        this.isPlaying = false;
        
        // Edit history
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        // UI
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        
        // Drag state
        this.drag = {
            active: false,
            type: null, // 'clip', 'selection', 'timeline'
            startX: 0,
            startY: 0,
            originalPositions: []
        };
        
        // Callbacks
        this.onClipChange = null;
        this.onSelectionChange = null;
        this.onPlaybackChange = null;
    }
    
    // Track management
    addTrack(options = {}) {
        const track = {
            id: `track_${Date.now()}`,
            name: options.name || `Track ${this.tracks.length + 1}`,
            height: options.height || this.config.trackHeight,
            color: options.color || `hsl(${(this.tracks.length * 60) % 360}, 70%, 50%)`,
            muted: false,
            solo: false,
            armed: false,
            volume: 1,
            pan: 0,
            order: this.tracks.length,
            clips: []
        };
        
        this.tracks.push(track);
        return track;
    }
    
    removeTrack(trackId) {
        const index = this.tracks.findIndex(t => t.id === trackId);
        if (index !== -1) {
            this.tracks.splice(index, 1);
            // Remove clips from this track
            for (const [clipId, clip] of this.clips) {
                if (clip.trackId === trackId) {
                    this.clips.delete(clipId);
                }
            }
        }
    }
    
    // Clip management
    addClip(trackId, options = {}) {
        const clipId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return null;
        
        const clip = {
            id: clipId,
            trackId,
            name: options.name || 'Clip',
            
            // Timing
            start: options.start || 0, // Position on timeline
            duration: options.duration || 4, // Duration on timeline
            offset: options.offset || 0, // Offset within source
            sourceDuration: options.sourceDuration || options.duration || 4, // Source audio duration
            
            // Source
            sourceId: options.sourceId || null, // Reference to audio buffer
            sourceUrl: options.sourceUrl || null,
            
            // Properties
            volume: options.volume || 1,
            pan: options.pan || 0,
            muted: false,
            locked: false,
            color: track.color,
            
            // Non-destructive edits
            fadeIn: options.fadeIn || 0,
            fadeOut: options.fadeOut || 0,
            crossfadeIn: 0,
            crossfadeOut: 0,
            gainAutomation: [], // [{ time, value }]
            
            // Loop
            loop: false,
            loopStart: 0,
            loopEnd: options.duration || 4
        };
        
        this.clips.set(clipId, clip);
        track.clips.push(clipId);
        
        return clip;
    }
    
    removeClip(clipId) {
        const clip = this.clips.get(clipId);
        if (!clip) return false;
        
        const track = this.tracks.find(t => t.id === clip.trackId);
        if (track) {
            track.clips = track.clips.filter(id => id !== clipId);
        }
        
        this.clips.delete(clipId);
        return true;
    }
    
    moveClip(clipId, newStart, newTrackId = null) {
        const clip = this.clips.get(clipId);
        if (!clip || clip.locked) return false;
        
        this.saveState();
        
        // Snap to grid
        if (this.config.snapToGrid) {
            newStart = Math.round(newStart / this.config.gridSize) * this.config.gridSize;
        }
        
        // Update track if changing
        if (newTrackId && newTrackId !== clip.trackId) {
            const oldTrack = this.tracks.find(t => t.id === clip.trackId);
            const newTrack = this.tracks.find(t => t.id === newTrackId);
            
            if (oldTrack && newTrack) {
                oldTrack.clips = oldTrack.clips.filter(id => id !== clipId);
                newTrack.clips.push(clipId);
                clip.trackId = newTrackId;
                clip.color = newTrack.color;
            }
        }
        
        clip.start = Math.max(0, newStart);
        
        if (this.onClipChange) {
            this.onClipChange({ clipId, changes: { start: newStart } });
        }
        
        return true;
    }
    
    resizeClip(clipId, newStart, newDuration) {
        const clip = this.clips.get(clipId);
        if (!clip || clip.locked) return false;
        
        this.saveState();
        
        // Snap to grid
        if (this.config.snapToGrid) {
            newStart = Math.round(newStart / this.config.gridSize) * this.config.gridSize;
            newDuration = Math.round(newDuration / this.config.gridSize) * this.config.gridSize;
        }
        
        // Ensure minimum width
        newDuration = Math.max(this.config.minClipWidth / this.config.pixelsPerSecond, newDuration);
        
        clip.start = Math.max(0, newStart);
        clip.duration = newDuration;
        
        if (this.onClipChange) {
            this.onClipChange({ clipId, changes: { start: newStart, duration: newDuration } });
        }
        
        return true;
    }
    
    splitClip(clipId, splitTime) {
        const clip = this.clips.get(clipId);
        if (!clip || clip.locked) return null;
        
        // Check if split point is within clip
        if (splitTime <= clip.start || splitTime >= clip.start + clip.duration) {
            return null;
        }
        
        this.saveState();
        
        const relativeSplit = splitTime - clip.start;
        
        // Create new clip for second half
        const newClip = this.addClip(clip.trackId, {
            name: clip.name + ' (2)',
            start: splitTime,
            duration: clip.duration - relativeSplit,
            offset: clip.offset + relativeSplit,
            sourceDuration: clip.sourceDuration,
            sourceId: clip.sourceId,
            volume: clip.volume,
            pan: clip.pan,
            fadeIn: 0,
            fadeOut: clip.fadeOut
        });
        
        // Resize original clip
        clip.duration = relativeSplit;
        clip.fadeOut = 0;
        clip.name = clip.name + ' (1)';
        
        if (this.onClipChange) {
            this.onClipChange({ type: 'split', clipId, newClipId: newClip.id });
        }
        
        return newClip;
    }
    
    joinClips(clipIds) {
        if (clipIds.length < 2) return false;
        
        const clips = clipIds.map(id => this.clips.get(id)).filter(c => c);
        if (clips.length < 2) return false;
        
        // Check if all clips are adjacent on same track
        const trackId = clips[0].trackId;
        if (!clips.every(c => c.trackId === trackId)) return false;
        
        // Sort by start time
        clips.sort((a, b) => a.start - b.start);
        
        // Check adjacency
        for (let i = 1; i < clips.length; i++) {
            if (Math.abs(clips[i].start - (clips[i-1].start + clips[i-1].duration)) > 0.01) {
                return false;
            }
        }
        
        this.saveState();
        
        // Merge into first clip
        const firstClip = clips[0];
        firstClip.duration = clips.reduce((sum, c) => sum + c.duration, 0);
        firstClip.name = firstClip.name.replace(' (1)', '').replace(' (2)', '');
        firstClip.fadeOut = clips[clips.length - 1].fadeOut;
        
        // Remove other clips
        for (let i = 1; i < clips.length; i++) {
            this.removeClip(clips[i].id);
        }
        
        if (this.onClipChange) {
            this.onClipChange({ type: 'join', clipId: firstClip.id });
        }
        
        return true;
    }
    
    // Selection
    selectClip(clipId, addToSelection = false) {
        if (addToSelection) {
            if (this.selection.clips.includes(clipId)) {
                this.selection.clips = this.selection.clips.filter(id => id !== clipId);
            } else {
                this.selection.clips.push(clipId);
            }
        } else {
            this.selection.clips = [clipId];
        }
        
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selection);
        }
    }
    
    selectAll() {
        this.selection.clips = Array.from(this.clips.keys());
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selection);
        }
    }
    
    clearSelection() {
        this.selection.clips = [];
        this.selection.range = null;
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selection);
        }
    }
    
    // Editing
    deleteSelected() {
        this.saveState();
        for (const clipId of this.selection.clips) {
            this.removeClip(clipId);
        }
        this.selection.clips = [];
    }
    
    duplicateSelected() {
        this.saveState();
        const newClips = [];
        
        for (const clipId of this.selection.clips) {
            const original = this.clips.get(clipId);
            if (!original) continue;
            
            const newClip = this.addClip(original.trackId, {
                ...original,
                start: original.start + original.duration,
                name: original.name + ' (copy)'
            });
            newClips.push(newClip.id);
        }
        
        this.selection.clips = newClips;
        return newClips;
    }
    
    // Undo/Redo
    saveState() {
        const state = {
            tracks: JSON.parse(JSON.stringify(this.tracks)),
            clips: JSON.parse(JSON.stringify(Array.from(this.clips.entries())))
        };
        
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }
    
    undo() {
        if (this.undoStack.length === 0) return false;
        
        const currentState = {
            tracks: JSON.parse(JSON.stringify(this.tracks)),
            clips: JSON.parse(JSON.stringify(Array.from(this.clips.entries())))
        };
        this.redoStack.push(currentState);
        
        const state = this.undoStack.pop();
        this.restoreState(state);
        
        return true;
    }
    
    redo() {
        if (this.redoStack.length === 0) return false;
        
        const currentState = {
            tracks: JSON.parse(JSON.stringify(this.tracks)),
            clips: JSON.parse(JSON.stringify(Array.from(this.clips.entries())))
        };
        this.undoStack.push(currentState);
        
        const state = this.redoStack.pop();
        this.restoreState(state);
        
        return true;
    }
    
    restoreState(state) {
        this.tracks = state.tracks;
        this.clips = new Map(state.clips);
        this.draw();
    }
    
    // Playback
    setPlaybackPosition(position) {
        this.playbackPosition = Math.max(0, position);
        if (this.onPlaybackChange) {
            this.onPlaybackChange(this.playbackPosition);
        }
        this.draw();
    }
    
    // Rendering
    draw() {
        if (!this.ctx) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw timeline ruler
        this.drawTimelineRuler();
        
        // Draw tracks
        this.drawTracks();
        
        // Draw clips
        this.drawClips();
        
        // Draw selection
        this.drawSelection();
        
        // Draw playhead
        this.drawPlayhead();
        
        // Draw loop region
        this.drawLoopRegion();
    }
    
    drawTimelineRuler() {
        const rulerHeight = 30;
        const pps = this.config.pixelsPerSecond * this.timeline.zoom;
        const scrollX = this.timeline.scrollX;
        
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(0, 0, this.canvas.width, rulerHeight);
        
        // Time markers
        this.ctx.strokeStyle = '#444';
        this.ctx.fillStyle = '#888';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        
        const startTime = Math.floor(scrollX / pps);
        const endTime = Math.ceil((scrollX + this.canvas.width) / pps);
        
        for (let t = startTime; t <= endTime; t++) {
            const x = t * pps - scrollX;
            
            if (x >= 0 && x <= this.canvas.width) {
                // Major tick
                this.ctx.beginPath();
                this.ctx.moveTo(x, rulerHeight - 10);
                this.ctx.lineTo(x, rulerHeight);
                this.ctx.stroke();
                
                // Label
                const minutes = Math.floor(t / 60);
                const seconds = t % 60;
                this.ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, x, rulerHeight - 12);
            }
            
            // Minor ticks
            for (let sub = 1; sub < 4; sub++) {
                const subX = (t + sub * 0.25) * pps - scrollX;
                if (subX >= 0 && subX <= this.canvas.width) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(subX, rulerHeight - 5);
                    this.ctx.lineTo(subX, rulerHeight);
                    this.ctx.stroke();
                }
            }
        }
    }
    
    drawTracks() {
        const rulerHeight = 30;
        let y = rulerHeight - this.timeline.scrollY;
        
        for (const track of this.tracks) {
            if (y + track.height < rulerHeight) {
                y += track.height;
                continue;
            }
            
            if (y > this.canvas.height) break;
            
            // Track background
            const isSelected = this.selection.tracks.includes(track.id);
            this.ctx.fillStyle = isSelected ? '#3a3a5e' : '#2a2a4e';
            this.ctx.fillRect(0, y, this.canvas.width, track.height);
            
            // Track header (left side)
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(0, y, 150, track.height);
            
            // Track color indicator
            this.ctx.fillStyle = track.color;
            this.ctx.fillRect(0, y, 4, track.height);
            
            // Track name
            this.ctx.fillStyle = track.muted ? '#666' : '#fff';
            this.ctx.font = '12px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(track.name, 12, y + 20);
            
            // Track state indicators
            if (track.muted) {
                this.ctx.fillStyle = '#f59e0b';
                this.ctx.fillText('M', 120, y + 20);
            }
            if (track.solo) {
                this.ctx.fillStyle = '#10b981';
                this.ctx.fillText('S', 135, y + 20);
            }
            
            // Track separator
            this.ctx.strokeStyle = '#444';
            this.ctx.beginPath();
            this.ctx.moveTo(0, y + track.height);
            this.ctx.lineTo(this.canvas.width, y + track.height);
            this.ctx.stroke();
            
            y += track.height;
        }
    }
    
    drawClips() {
        const rulerHeight = 30;
        const pps = this.config.pixelsPerSecond * this.timeline.zoom;
        const scrollX = this.timeline.scrollX;
        let trackY = rulerHeight - this.timeline.scrollY;
        
        for (const track of this.tracks) {
            for (const clipId of track.clips) {
                const clip = this.clips.get(clipId);
                if (!clip) continue;
                
                const x = clip.start * pps - scrollX + 150; // +150 for track header
                const width = clip.duration * pps;
                const height = track.height - 10;
                const y = trackY + 5;
                
                // Skip if off screen
                if (x + width < 150 || x > this.canvas.width) continue;
                
                // Clip background
                const isSelected = this.selection.clips.includes(clip.id);
                this.ctx.fillStyle = isSelected ? '#4a4a6e' : clip.color + '88';
                this.ctx.fillRect(x, y, width, height);
                
                // Clip border
                this.ctx.strokeStyle = isSelected ? '#fff' : clip.color;
                this.ctx.lineWidth = isSelected ? 2 : 1;
                this.ctx.strokeRect(x, y, width, height);
                
                // Clip name
                if (width > 40) {
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '11px sans-serif';
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(clip.name, x + 5, y + 15);
                }
                
                // Fade indicators
                if (clip.fadeIn > 0) {
                    const fadeInWidth = clip.fadeIn * pps;
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y + height);
                    this.ctx.lineTo(x + fadeInWidth, y);
                    this.ctx.lineTo(x, y);
                    this.ctx.closePath();
                    this.ctx.fill();
                }
                
                if (clip.fadeOut > 0) {
                    const fadeOutWidth = clip.fadeOut * pps;
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.ctx.beginPath();
                    this.ctx.moveTo(x + width, y + height);
                    this.ctx.lineTo(x + width - fadeOutWidth, y);
                    this.ctx.lineTo(x + width, y);
                    this.ctx.closePath();
                    this.ctx.fill();
                }
                
                // Waveform preview (simplified)
                if (width > 60) {
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    
                    const centerY = y + height / 2;
                    for (let i = 0; i < width; i += 2) {
                        const time = (i / pps) + clip.start;
                        const amplitude = Math.sin(time * 10) * 0.3 + Math.sin(time * 3) * 0.2;
                        const sampleY = centerY + amplitude * height * 0.4;
                        
                        if (i === 0) {
                            this.ctx.moveTo(x + i, sampleY);
                        } else {
                            this.ctx.lineTo(x + i, sampleY);
                        }
                    }
                    this.ctx.stroke();
                }
            }
            
            trackY += track.height;
        }
    }
    
    drawSelection() {
        if (this.selection.range) {
            const pps = this.config.pixelsPerSecond * this.timeline.zoom;
            const scrollX = this.timeline.scrollX;
            
            const x = this.selection.range.start * pps - scrollX + 150;
            const width = (this.selection.range.end - this.selection.range.start) * pps;
            
            this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            this.ctx.fillRect(x, 30, width, this.canvas.height - 30);
            
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, 30, width, this.canvas.height - 30);
        }
    }
    
    drawPlayhead() {
        const pps = this.config.pixelsPerSecond * this.timeline.zoom;
        const scrollX = this.timeline.scrollX;
        const x = this.playbackPosition * pps - scrollX + 150;
        
        if (x >= 150 && x <= this.canvas.width) {
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 30);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
            
            // Playhead triangle
            this.ctx.fillStyle = '#ef4444';
            this.ctx.beginPath();
            this.ctx.moveTo(x - 6, 30);
            this.ctx.lineTo(x + 6, 30);
            this.ctx.lineTo(x, 38);
            this.ctx.closePath();
            this.ctx.fill();
        }
    }
    
    drawLoopRegion() {
        if (!this.timeline.loopEnabled) return;
        
        const pps = this.config.pixelsPerSecond * this.timeline.zoom;
        const scrollX = this.timeline.scrollX;
        
        const startX = this.timeline.loopStart * pps - scrollX + 150;
        const endX = this.timeline.loopEnd * pps - scrollX + 150;
        
        this.ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        this.ctx.fillRect(startX, 30, endX - startX, this.canvas.height - 30);
        
        this.ctx.strokeStyle = '#10b981';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(startX, 30, endX - startX, this.canvas.height - 30);
        this.ctx.setLineDash([]);
    }
    
    // UI
    createUI(container) {
        this.container = container;
        
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <!-- Toolbar -->
                <div style="padding: 12px; background: #2a2a4e; border-bottom: 1px solid #444; display: flex; gap: 8px; align-items: center;">
                    <button id="add-track-btn" style="padding: 6px 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer;">Add Track</button>
                    <button id="add-clip-btn" style="padding: 6px 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">Add Clip</button>
                    
                    <div style="width: 1px; height: 20px; background: #444;"></div>
                    
                    <button id="split-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Split</button>
                    <button id="delete-btn" style="padding: 6px 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">Delete</button>
                    
                    <div style="width: 1px; height: 20px; background: #444;"></div>
                    
                    <button id="undo-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Undo</button>
                    <button id="redo-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Redo</button>
                    
                    <div style="flex: 1;"></div>
                    
                    <button id="loop-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Loop</button>
                    
                    <span style="font-size: 12px; color: #888;">Zoom:</span>
                    <input type="range" id="zoom-slider" min="0.5" max="4" step="0.1" value="1" style="width: 100px;">
                </div>
                
                <!-- Canvas -->
                <canvas id="montage-canvas" width="1000" height="400" style="width: 100%; cursor: default;"></canvas>
                
                <!-- Info bar -->
                <div style="padding: 8px 12px; background: #2a2a4e; border-top: 1px solid #444; display: flex; justify-content: space-between; font-size: 11px; color: #888;">
                    <span id="position-info">Position: 0:00.000</span>
                    <span id="selection-info">No selection</span>
                    <span id="tracks-info">${this.tracks.length} tracks, ${this.clips.size} clips</span>
                </div>
            </div>
        `;
        
        this.canvas = container.querySelector('#montage-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.setupEventHandlers();
        this.draw();
    }
    
    setupEventHandlers() {
        // Toolbar buttons
        this.container.querySelector('#add-track-btn').onclick = () => {
            this.addTrack();
            this.draw();
        };
        
        this.container.querySelector('#add-clip-btn').onclick = () => {
            if (this.tracks.length > 0) {
                this.addClip(this.tracks[0].id, { start: this.playbackPosition, duration: 4 });
                this.draw();
            }
        };
        
        this.container.querySelector('#split-btn').onclick = () => {
            if (this.selection.clips.length === 1) {
                const clip = this.clips.get(this.selection.clips[0]);
                if (clip) {
                    this.splitClip(clip.id, this.playbackPosition);
                    this.draw();
                }
            }
        };
        
        this.container.querySelector('#delete-btn').onclick = () => {
            this.deleteSelected();
            this.draw();
        };
        
        this.container.querySelector('#undo-btn').onclick = () => {
            this.undo();
        };
        
        this.container.querySelector('#redo-btn').onclick = () => {
            this.redo();
        };
        
        this.container.querySelector('#loop-btn').onclick = () => {
            this.timeline.loopEnabled = !this.timeline.loopEnabled;
            this.draw();
        };
        
        const zoomSlider = this.container.querySelector('#zoom-slider');
        zoomSlider.oninput = () => {
            this.timeline.zoom = parseFloat(zoomSlider.value);
            this.draw();
        };
        
        // Canvas events
        this.canvas.onmousedown = (e) => this.handleMouseDown(e);
        this.canvas.onmousemove = (e) => this.handleMouseMove(e);
        this.canvas.onmouseup = (e) => this.handleMouseUp(e);
        this.canvas.ondblclick = (e) => this.handleDoubleClick(e);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelected();
                this.draw();
            } else if (e.key === ' ') {
                e.preventDefault();
                this.isPlaying = !this.isPlaying;
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            }
        });
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedClip = this.getClipAtPosition(x, y);
        
        if (clickedClip) {
            this.selectClip(clickedClip.id, e.shiftKey);
            this.drag.active = true;
            this.drag.type = 'clip';
            this.drag.startX = x;
            this.drag.startY = y;
            this.drag.originalPositions = this.selection.clips.map(id => {
                const clip = this.clips.get(id);
                return { id, start: clip.start, trackId: clip.trackId };
            });
        } else {
            this.clearSelection();
        }
        
        this.draw();
    }
    
    handleMouseMove(e) {
        if (!this.drag.active) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const pps = this.config.pixelsPerSecond * this.timeline.zoom;
        const deltaX = x - this.drag.startX;
        const deltaTime = deltaX / pps;
        
        if (this.drag.type === 'clip') {
            for (const original of this.drag.originalPositions) {
                this.moveClip(original.id, original.start + deltaTime);
            }
        }
        
        this.draw();
    }
    
    handleMouseUp(e) {
        this.drag.active = false;
        this.drag.type = null;
    }
    
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Double-click on timeline to set playhead
        if (y < 30) {
            const pps = this.config.pixelsPerSecond * this.timeline.zoom;
            const time = (x - 150 + this.timeline.scrollX) / pps;
            this.setPlaybackPosition(time);
        }
        
        // Double-click on track header to add clip
        const trackIndex = Math.floor((y - 30 + this.timeline.scrollY) / this.config.trackHeight);
        if (trackIndex >= 0 && trackIndex < this.tracks.length && x < 150) {
            this.addClip(this.tracks[trackIndex].id, { start: this.playbackPosition, duration: 4 });
            this.draw();
        }
    }
    
    getClipAtPosition(x, y) {
        const rulerHeight = 30;
        const pps = this.config.pixelsPerSecond * this.timeline.zoom;
        const scrollX = this.timeline.scrollX;
        let trackY = rulerHeight - this.timeline.scrollY;
        
        for (const track of this.tracks) {
            for (const clipId of track.clips) {
                const clip = this.clips.get(clipId);
                if (!clip) continue;
                
                const clipX = clip.start * pps - scrollX + 150;
                const clipWidth = clip.duration * pps;
                const clipY = trackY + 5;
                const clipHeight = track.height - 10;
                
                if (x >= clipX && x <= clipX + clipWidth &&
                    y >= clipY && y <= clipY + clipHeight) {
                    return clip;
                }
            }
            trackY += track.height;
        }
        
        return null;
    }
    
    openPanel() {
        const existing = document.getElementById('montage-view-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'montage-view-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 1000px;
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
        
        // Add some demo content
        this.addTrack({ name: 'Drums' });
        this.addTrack({ name: 'Bass' });
        this.addTrack({ name: 'Synth' });
        this.addClip(this.tracks[0].id, { start: 0, duration: 8, name: 'Drum Loop' });
        this.addClip(this.tracks[1].id, { start: 0, duration: 8, name: 'Bass Line' });
        this.addClip(this.tracks[2].id, { start: 4, duration: 4, name: 'Lead' });
        this.draw();
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            z-index: 10;
        `;
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);
    }
    
    // Export
    exportTimeline() {
        return {
            duration: this.timeline.duration,
            tracks: this.tracks.map(t => ({
                ...t,
                clips: t.clips.map(id => this.clips.get(id))
            }))
        };
    }
    
    importTimeline(data) {
        this.timeline.duration = data.duration;
        this.tracks = data.tracks.map(t => {
            const track = { ...t, clips: [] };
            this.tracks.push(track);
            
            for (const clipData of t.clips) {
                this.clips.set(clipData.id, { ...clipData, trackId: track.id });
                track.clips.push(clipData.id);
            }
            
            return track;
        });
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioMontageView };
} else if (typeof window !== 'undefined') {
    window.AudioMontageView = AudioMontageView;
}