// js/ClipGraffiti.js - Clip Graffiti Feature for SnugOS DAW
// Freehand drawing and memo overlay on audio clips

/**
 * ClipGraffitiManager - Manages graffiti drawing on audio clips
 */
export class ClipGraffitiManager {
    constructor() {
        this.isDrawing = false;
        this.currentTool = 'brush'; // 'brush', 'eraser'
        this.currentColor = '#ff0000';
        this.currentBrushSize = 3;
        this.graffitiData = new Map(); // clipId -> { paths: [], color: '#ff0000', brushSize: 3 }
        this.activeClipId = null;
        this.currentPath = [];
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Initialize graffiti mode for a clip
     * @param {string} clipId - The clip ID
     * @param {HTMLCanvasElement} canvas - Canvas element for drawing
     * @returns {Object} Graffiti data for the clip
     */
    initGraffitiForClip(clipId, canvas) {
        this.activeClipId = clipId;
        this.canvas = canvas;
        
        if (canvas) {
            this.ctx = canvas.getContext('2d');
        }
        
        if (!this.graffitiData.has(clipId)) {
            this.graffitiData.set(clipId, {
                paths: [],
                color: this.currentColor,
                brushSize: this.currentBrushSize
            });
        }
        
        return this.graffitiData.get(clipId);
    }

    /**
     * Start drawing a path
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    startPath(x, y) {
        if (!this.activeClipId) return;
        
        this.isDrawing = true;
        this.currentPath = [{ x, y }];
    }

    /**
     * Continue drawing a path
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    continuePath(x, y) {
        if (!this.isDrawing || !this.activeClipId) return;
        
        this.currentPath.push({ x, y });
        this.renderPath();
    }

    /**
     * End the current drawing path
     */
    endPath() {
        if (!this.isDrawing || !this.activeClipId) return;
        
        if (this.currentPath.length > 1) {
            const clipGraffiti = this.graffitiData.get(this.activeClipId);
            if (clipGraffiti) {
                clipGraffiti.paths.push({
                    points: [...this.currentPath],
                    color: this.currentTool === 'eraser' ? 'eraser' : this.currentColor,
                    brushSize: this.currentTool === 'eraser' ? this.currentBrushSize * 2 : this.currentBrushSize,
                    tool: this.currentTool
                });
            }
        }
        
        this.isDrawing = false;
        this.currentPath = [];
    }

    /**
     * Render the current path being drawn
     */
    renderPath() {
        if (!this.ctx || this.currentPath.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.currentTool === 'eraser' ? '#000000' : this.currentColor;
        this.ctx.lineWidth = this.currentTool === 'eraser' ? this.currentBrushSize * 2 : this.currentBrushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
        
        for (let i = 1; i < this.currentPath.length; i++) {
            this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
        }
        
        this.ctx.stroke();
    }

    /**
     * Render all paths for the active clip
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    renderAllPaths(ctx, width, height) {
        if (!this.activeClipId) return;
        
        const clipGraffiti = this.graffitiData.get(this.activeClipId);
        if (!clipGraffiti) return;
        
        for (const path of clipGraffiti.paths) {
            if (path.points.length < 2) continue;
            
            ctx.beginPath();
            ctx.strokeStyle = path.tool === 'eraser' ? '#333333' : path.color;
            ctx.lineWidth = path.brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.moveTo(path.points[0].x, path.points[0].y);
            
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            
            ctx.stroke();
        }
    }

    /**
     * Get graffiti data for a clip
     * @param {string} clipId - Clip ID
     * @returns {Object|null} Graffiti data
     */
    getGraffitiData(clipId) {
        return this.graffitiData.get(clipId) || null;
    }

    /**
     * Set graffiti data for a clip (for loading/syncing)
     * @param {string} clipId - Clip ID
     * @param {Object} data - Graffiti data
     */
    setGraffitiData(clipId, data) {
        if (data && data.paths) {
            this.graffitiData.set(clipId, data);
        }
    }

    /**
     * Clear all graffiti for a clip
     * @param {string} clipId - Clip ID
     */
    clearGraffiti(clipId) {
        if (this.graffitiData.has(clipId)) {
            const clipGraffiti = this.graffitiData.get(clipId);
            clipGraffiti.paths = [];
        }
    }

    /**
     * Undo the last path for a clip
     * @param {string} clipId - Clip ID
     * @returns {boolean} True if a path was removed
     */
    undoLastPath(clipId) {
        const clipGraffiti = this.graffitiData.get(clipId);
        if (clipGraffiti && clipGraffiti.paths.length > 0) {
            clipGraffiti.paths.pop();
            return true;
        }
        return false;
    }

    /**
     * Set the current drawing tool
     * @param {string} tool - 'brush' or 'eraser'
     */
    setTool(tool) {
        this.currentTool = tool;
    }

    /**
     * Set the current drawing color
     * @param {string} color - Hex color code
     */
    setColor(color) {
        this.currentColor = color;
    }

    /**
     * Set the current brush size
     * @param {number} size - Brush size in pixels
     */
    setBrushSize(size) {
        this.currentBrushSize = Math.max(1, Math.min(50, size));
    }

    /**
     * Get graffiti data for serialization
     * @returns {Object} Serialized graffiti data
     */
    serialize() {
        const serialized = {};
        for (const [clipId, data] of this.graffitiData) {
            if (data.paths.length > 0) {
                serialized[clipId] = data;
            }
        }
        return serialized;
    }

    /**
     * Load graffiti data from serialized object
     * @param {Object} data - Serialized graffiti data
     */
    deserialize(data) {
        if (!data) return;
        for (const [clipId, graffiti] of Object.entries(data)) {
            this.graffitiData.set(clipId, graffiti);
        }
    }
}

// Export singleton instance
export const clipGraffitiManager = new ClipGraffitiManager();

// Export functions for integration with Track.js
export function getClipGraffiti(clipId) {
    return clipGraffitiManager.getGraffitiData(clipId);
}

export function setClipGraffiti(clipId, data) {
    clipGraffitiManager.setGraffitiData(clipId, data);
}

export function clearClipGraffiti(clipId) {
    clipGraffitiManager.clearGraffiti(clipId);
}

export function undoClipGraffiti(clipId) {
    return clipGraffitiManager.undoLastPath(clipId);
}
