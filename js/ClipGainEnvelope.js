// js/ClipGainEnvelope.js - Draw volume automation on audio clips

export class ClipGainEnvelope {
    constructor(clip) {
        this.clip = clip;
        // Gain envelope points: { time: 0-1 normalized, value: 0-1 }
        this.points = clip.gainEnvelope ? JSON.parse(JSON.stringify(clip.gainEnvelope)) : [];
        this.selectedPointIndex = -1;
        this.isDragging = false;
        this.dragPointIndex = -1;
        this.dragOffsetY = 0;
        this.hoverPointIndex = -1;
    }

    // Get point at normalized time, or -1 if not found
    getPointAtTime(normalizedTime, tolerance = 0.02) {
        for (let i = 0; i < this.points.length; i++) {
            if (Math.abs(this.points[i].time - normalizedTime) < tolerance) {
                return i;
            }
        }
        return -1;
    }

    // Add a new point
    addPoint(time, value) {
        // Clamp values
        time = Math.max(0, Math.min(1, time));
        value = Math.max(0, Math.min(1, value));
        
        // Insert sorted by time
        const newPoint = { time, value };
        if (this.points.length === 0) {
            this.points.push(newPoint);
        } else {
            let inserted = false;
            for (let i = 0; i < this.points.length; i++) {
                if (time < this.points[i].time) {
                    this.points.splice(i, 0, newPoint);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                this.points.push(newPoint);
            }
        }
        this.saveToClip();
        return this.points;
    }

    // Update point value
    updatePoint(index, time, value) {
        if (index < 0 || index >= this.points.length) return;
        
        if (time !== undefined) this.points[index].time = Math.max(0, Math.min(1, time));
        if (value !== undefined) this.points[index].value = Math.max(0, Math.min(1, value));
        
        this.saveToClip();
    }

    // Remove a point (keep at least 2 points)
    removePoint(index) {
        if (this.points.length <= 2) return; // Keep minimum 2 points
        if (index < 0 || index >= this.points.length) return;
        
        this.points.splice(index, 1);
        this.saveToClip();
    }

    // Get interpolated value at normalized time using bezier curve
    getValueAtTime(normalizedTime) {
        if (this.points.length === 0) return 1.0;
        if (this.points.length === 1) return this.points[0].value;
        
        // Find surrounding points
        let leftIndex = 0;
        for (let i = 0; i < this.points.length - 1; i++) {
            if (normalizedTime >= this.points[i].time && normalizedTime <= this.points[i + 1].time) {
                leftIndex = i;
                break;
            }
        }
        
        const left = this.points[leftIndex];
        const right = this.points[leftIndex + 1] || left;
        
        if (left === right) return left.value;
        
        // Linear interpolation (could be upgraded to bezier)
        const t = (normalizedTime - left.time) / (right.time - left.time);
        return left.value + (right.value - left.value) * t;
    }

    // Save envelope back to clip object
    saveToClip() {
        this.clip.gainEnvelope = JSON.parse(JSON.stringify(this.points));
    }

    // Export serialized data
    serialize() {
        return JSON.parse(JSON.stringify(this.points));
    }

    // Load from serialized data
    loadFromData(data) {
        this.points = data ? JSON.parse(JSON.stringify(data)) : [];
        this.saveToClip();
    }

    // Clear all points except defaults
    reset() {
        this.points = [
            { time: 0, value: 1.0 },
            { time: 1, value: 1.0 }
        ];
        this.saveToClip();
    }

    // Get bounds for rendering
    getBounds(canvasWidth, canvasHeight) {
        return {
            padding: 4,
            handleRadius: 5
        };
    }
}

// Draw the envelope overlay on a canvas
export function drawClipGainEnvelope(ctx, envelope, canvasWidth, canvasHeight, isSelected, isHovered) {
    if (!envelope || !envelope.points || envelope.points.length < 2) return;

    const { padding, handleRadius } = {
        padding: 4,
        handleRadius: 5
    };

    const drawHeight = canvasHeight - padding * 2;
    const drawY = padding;

    // Draw fill area
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight);
    
    for (let i = 0; i < envelope.points.length; i++) {
        const x = envelope.points[i].time * canvasWidth;
        const y = drawY + (1 - envelope.points[i].value) * drawHeight;
        if (i === 0) {
            ctx.lineTo(x, canvasHeight);
            ctx.lineTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.lineTo(canvasWidth, canvasHeight);
    ctx.closePath();
    
    // Fill with gradient
    const gradient = ctx.createLinearGradient(0, drawY, 0, drawY + drawHeight);
    if (isSelected) {
        gradient.addColorStop(0, 'rgba(255, 200, 50, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 200, 50, 0.05)');
    } else if (isHovered) {
        gradient.addColorStop(0, 'rgba(255, 200, 50, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 200, 50, 0.02)');
    } else {
        gradient.addColorStop(0, 'rgba(255, 200, 50, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 200, 50, 0.01)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    for (let i = 0; i < envelope.points.length; i++) {
        const x = envelope.points[i].time * canvasWidth;
        const y = drawY + (1 - envelope.points[i].value) * drawHeight;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.strokeStyle = isSelected ? 'rgba(255, 200, 50, 0.9)' : 'rgba(255, 200, 50, 0.5)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Draw handles for selected clips
    if (isSelected) {
        for (let i = 0; i < envelope.points.length; i++) {
            const x = envelope.points[i].time * canvasWidth;
            const y = drawY + (1 - envelope.points[i].value) * drawHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, handleRadius, 0, Math.PI * 2);
            
            if (envelope.selectedPointIndex === i) {
                ctx.fillStyle = '#ffcc00';
                ctx.strokeStyle = '#ffffff';
            } else if (envelope.hoverPointIndex === i) {
                ctx.fillStyle = '#ffdd44';
                ctx.strokeStyle = '#ffffff';
            } else {
                ctx.fillStyle = '#ffaa00';
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            }
            
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
        }
    }
}

// Get envelope from clip, create if needed
export function getOrCreateClipGainEnvelope(clip) {
    if (!clip) return null;
    
    if (!clip._gainEnvelope || clip._gainEnvelope.clip !== clip) {
        clip._gainEnvelope = new ClipGainEnvelope(clip);
        
        // Initialize with default points if empty
        if (!clip.gainEnvelope || clip.gainEnvelope.length === 0) {
            clip.gainEnvelope = [
                { time: 0, value: 1.0 },
                { time: 1, value: 1.0 }
            ];
        }
    }
    
    return clip._gainEnvelope;
}

// Apply envelope to a Tone.js player or source during playback
export function applyClipGainEnvelope(player, envelope, startTime, duration) {
    if (!player || !envelope || !envelope.points || envelope.points.length < 2) return;
    
    const clipStart = startTime;
    const clipEnd = startTime + duration;
    
    // Clear any existing automation
    player.gain.cancelScheduledValues(clipStart);
    player.gain.setValueAtTime(player.gain.value, clipStart);
    
    // Schedule envelope points
    for (let i = 0; i < envelope.points.length; i++) {
        const point = envelope.points[i];
        const time = clipStart + point.time * duration;
        const value = point.value;
        
        if (i === 0) {
            player.gain.setValueAtTime(value, time);
        } else {
            // Use linear ramp for simplicity
            player.gain.linearRampToValueAtTime(value, time);
        }
    }
    
    // Ensure it stays at final value
    player.gain.setValueAtTime(envelope.points[envelope.points.length - 1].value, clipEnd);
}

// Double-click to add point at position
export function handleEnvelopeDoubleClick(envelope, normalizedX, normalizedY) {
    if (!envelope) return;
    envelope.addPoint(normalizedX, normalizedY);
}

// Check if click is on a handle
export function getEnvelopeHandleAtPoint(envelope, x, y, canvasWidth, canvasHeight) {
    if (!envelope || !envelope.points) return -1;
    
    const { padding, handleRadius } = { padding: 4, handleRadius: 5 };
    const tolerance = handleRadius * 2;
    
    for (let i = 0; i < envelope.points.length; i++) {
        const px = envelope.points[i].time * canvasWidth;
        const py = padding + (1 - envelope.points[i].value) * (canvasHeight - padding * 2);
        
        if (Math.abs(x - px) < tolerance && Math.abs(y - py) < tolerance) {
            return i;
        }
    }
    
    return -1;
}

// Serialize envelope for saving
export function serializeClipGainEnvelope(clip) {
    if (!clip || !clip.gainEnvelope) return null;
    return JSON.parse(JSON.stringify(clip.gainEnvelope));
}

// Deserialize and apply
export function deserializeClipGainEnvelope(clip, data) {
    if (!clip || !data) return;
    clip.gainEnvelope = JSON.parse(JSON.stringify(data));
    clip._gainEnvelope = null; // Reset cache
}

// Module-level storage for envelope editing state
window._clipGainEnvelopes = window._clipGainEnvelopes || new Map();

export function getClipEnvelope(clipId) {
    return window._clipGainEnvelopes.get(clipId);
}

export function setClipEnvelope(clipId, envelope) {
    if (envelope) {
        window._clipGainEnvelopes.set(clipId, envelope);
    } else {
        window._clipGainEnvelopes.delete(clipId);
    }
}

export function clearAllClipEnvelopes() {
    window._clipGainEnvelopes.clear();
}