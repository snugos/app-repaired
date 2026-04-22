// js/ScoreAnnotation.js - Score Annotation System for SnugOS DAW
// Features: Draw annotations, highlights, text notes, shapes on scores

/**
 * Annotation Types
 */
export const AnnotationType = {
    TEXT: 'text',
    HIGHLIGHT: 'highlight',
    CIRCLE: 'circle',
    RECTANGLE: 'rectangle',
    ARROW: 'arrow',
    LINE: 'line',
    FREEHAND: 'freehand',
    STAMP: 'stamp', // Predefined symbols
    STAMP_TEXT: 'stamp_text'
};

/**
 * Predefined Stamp Symbols
 */
export const StampSymbol = {
    CRESCENDO: 'crescendo',
    DECRESCENDO: 'decrescendo',
    FORTE: 'forte',
    PIANO: 'piano',
    MEZZO_FORTE: 'mezzoForte',
    MEZZO_PIANO: 'mezzoPiano',
    FERMATA: 'fermata',
    ACCENT: 'accent',
    STACCATO: 'staccato',
    TENUTO: 'tenuto',
    SLUR_START: 'slurStart',
    SLUR_END: 'slurEnd',
    REPEAT_START: 'repeatStart',
    REPEAT_END: 'repeatEnd',
    DAL_SEGNO: 'dalSegno',
    CODA: 'coda',
    SEGNO: 'segno',
    FINGERING_1: 'finger1',
    FINGERING_2: 'finger2',
    FINGERING_3: 'finger3',
    FINGERING_4: 'finger4',
    FINGERING_5: 'finger5'
};

/**
 * Single Annotation
 */
export class Annotation {
    constructor(options = {}) {
        this.id = options.id || `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = options.type || AnnotationType.TEXT;
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 100;
        this.height = options.height || 50;
        this.pageNumber = options.pageNumber || 1;
        this.measureNumber = options.measureNumber || null;
        this.text = options.text || '';
        this.color = options.color || '#FF6B6B';
        this.opacity = options.opacity !== undefined ? options.opacity : 0.7;
        this.lineWidth = options.lineWidth || 2;
        this.points = options.points || []; // For freehand drawing
        this.stampSymbol = options.stampSymbol || null;
        this.fontSize = options.fontSize || 14;
        this.fontFamily = options.fontFamily || 'Arial';
        this.rotation = options.rotation || 0;
        this.locked = options.locked || false;
        this.createdBy = options.createdBy || 'user';
        this.createdAt = options.createdAt || Date.now();
        this.modifiedAt = options.modifiedAt || Date.now();
    }

    /**
     * Convert to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            pageNumber: this.pageNumber,
            measureNumber: this.measureNumber,
            text: this.text,
            color: this.color,
            opacity: this.opacity,
            lineWidth: this.lineWidth,
            points: this.points,
            stampSymbol: this.stampSymbol,
            fontSize: this.fontSize,
            fontFamily: this.fontFamily,
            rotation: this.rotation,
            locked: this.locked,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            modifiedAt: this.modifiedAt
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON data
     * @returns {Annotation} Annotation instance
     */
    static fromJSON(json) {
        return new Annotation(json);
    }

    /**
     * Check if point is inside annotation bounds
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @returns {boolean} True if point is inside
     */
    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }

    /**
     * Move annotation
     * @param {number} dx - Delta X
     * @param {number} dy - Delta Y
     */
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        this.modifiedAt = Date.now();
    }

    /**
     * Resize annotation
     * @param {number} newWidth - New width
     * @param {number} newHeight - New height
     */
    resize(newWidth, newHeight) {
        this.width = Math.max(10, newWidth);
        this.height = Math.max(10, newHeight);
        this.modifiedAt = Date.now();
    }
}

/**
 * Annotation Layer (group of annotations per page)
 */
export class AnnotationLayer {
    constructor(pageNumber = 1) {
        this.pageNumber = pageNumber;
        this.annotations = [];
        this.visible = true;
        this.locked = false;
        this.name = `Page ${pageNumber}`;
    }

    /**
     * Add annotation
     * @param {Annotation} annotation - Annotation to add
     */
    addAnnotation(annotation) {
        annotation.pageNumber = this.pageNumber;
        this.annotations.push(annotation);
    }

    /**
     * Remove annotation
     * @param {string} annotationId - Annotation ID to remove
     */
    removeAnnotation(annotationId) {
        this.annotations = this.annotations.filter(a => a.id !== annotationId);
    }

    /**
     * Get annotation by ID
     * @param {string} annotationId - Annotation ID
     * @returns {Annotation|null} Annotation or null
     */
    getAnnotation(annotationId) {
        return this.annotations.find(a => a.id === annotationId) || null;
    }

    /**
     * Find annotation at point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Annotation|null} Annotation at point
     */
    findAnnotationAt(x, y) {
        // Check in reverse order (top-most first)
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            if (this.annotations[i].containsPoint(x, y)) {
                return this.annotations[i];
            }
        }
        return null;
    }

    /**
     * Clear all annotations
     */
    clear() {
        this.annotations = [];
    }

    /**
     * Get all annotations as JSON
     * @returns {Array} Array of JSON objects
     */
    toJSON() {
        return this.annotations.map(a => a.toJSON());
    }

    /**
     * Load annotations from JSON
     * @param {Array} json - Array of annotation JSON objects
     */
    fromJSON(json) {
        this.annotations = json.map(a => Annotation.fromJSON(a));
    }
}

/**
 * Annotation Manager
 * Manages all annotations across pages
 */
export class AnnotationManager {
    constructor() {
        this.layers = new Map(); // pageNumber -> AnnotationLayer
        this.currentTool = AnnotationType.TEXT;
        this.currentColor = '#FF6B6B';
        this.currentOpacity = 0.7;
        this.currentLineWidth = 2;
        this.currentFontSize = 14;
        this.selectedAnnotation = null;
        this.history = [];
        this.historyIndex = -1;
        this.listeners = new Map();
    }

    /**
     * Get or create layer for page
     * @param {number} pageNumber - Page number
     * @returns {AnnotationLayer} Layer for page
     */
    getLayer(pageNumber) {
        if (!this.layers.has(pageNumber)) {
            this.layers.set(pageNumber, new AnnotationLayer(pageNumber));
        }
        return this.layers.get(pageNumber);
    }

    /**
     * Create new annotation
     * @param {number} pageNumber - Page number
     * @param {Object} options - Annotation options
     * @returns {Annotation} Created annotation
     */
    createAnnotation(pageNumber, options = {}) {
        const layer = this.getLayer(pageNumber);
        const annotation = new Annotation({
            ...options,
            type: options.type || this.currentTool,
            color: options.color || this.currentColor,
            opacity: options.opacity !== undefined ? options.opacity : this.currentOpacity,
            lineWidth: options.lineWidth || this.currentLineWidth,
            fontSize: options.fontSize || this.currentFontSize,
            pageNumber
        });
        
        layer.addAnnotation(annotation);
        this._saveToHistory();
        this._emit('annotationAdded', annotation);
        
        return annotation;
    }

    /**
     * Delete annotation
     * @param {number} pageNumber - Page number
     * @param {string} annotationId - Annotation ID
     */
    deleteAnnotation(pageNumber, annotationId) {
        const layer = this.getLayer(pageNumber);
        const annotation = layer.getAnnotation(annotationId);
        
        if (annotation) {
            layer.removeAnnotation(annotationId);
            this._saveToHistory();
            this._emit('annotationDeleted', { pageNumber, annotationId });
        }
    }

    /**
     * Select annotation
     * @param {Annotation|null} annotation - Annotation to select
     */
    selectAnnotation(annotation) {
        this.selectedAnnotation = annotation;
        this._emit('annotationSelected', annotation);
    }

    /**
     * Update annotation
     * @param {string} annotationId - Annotation ID
     * @param {Object} updates - Properties to update
     */
    updateAnnotation(annotationId, updates) {
        for (const [pageNumber, layer] of this.layers) {
            const annotation = layer.getAnnotation(annotationId);
            if (annotation) {
                Object.assign(annotation, updates);
                annotation.modifiedAt = Date.now();
                this._saveToHistory();
                this._emit('annotationUpdated', annotation);
                return annotation;
            }
        }
        return null;
    }

    /**
     * Set current tool
     * @param {string} tool - Tool type
     */
    setTool(tool) {
        if (Object.values(AnnotationType).includes(tool)) {
            this.currentTool = tool;
            this._emit('toolChanged', tool);
        }
    }

    /**
     * Set current color
     * @param {string} color - Color hex string
     */
    setColor(color) {
        this.currentColor = color;
        this._emit('colorChanged', color);
    }

    /**
     * Set current opacity
     * @param {number} opacity - Opacity (0-1)
     */
    setOpacity(opacity) {
        this.currentOpacity = Math.max(0, Math.min(1, opacity));
        this._emit('opacityChanged', this.currentOpacity);
    }

    /**
     * Set line width
     * @param {number} width - Line width in pixels
     */
    setLineWidth(width) {
        this.currentLineWidth = Math.max(1, Math.min(20, width));
        this._emit('lineWidthChanged', this.currentLineWidth);
    }

    /**
     * Set font size
     * @param {number} size - Font size in pixels
     */
    setFontSize(size) {
        this.currentFontSize = Math.max(8, Math.min(72, size));
        this._emit('fontSizeChanged', this.currentFontSize);
    }

    /**
     * Get all annotations for a page
     * @param {number} pageNumber - Page number
     * @returns {Array} Annotations array
     */
    getPageAnnotations(pageNumber) {
        const layer = this.getLayer(pageNumber);
        return layer.annotations;
    }

    /**
     * Get all annotations across all pages
     * @returns {Array} All annotations
     */
    getAllAnnotations() {
        const all = [];
        for (const layer of this.layers.values()) {
            all.push(...layer.annotations);
        }
        return all;
    }

    /**
     * Find annotation at point
     * @param {number} pageNumber - Page number
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Annotation|null} Annotation at point
     */
    findAnnotationAt(pageNumber, x, y) {
        const layer = this.getLayer(pageNumber);
        return layer.findAnnotationAt(x, y);
    }

    /**
     * Clear all annotations from a page
     * @param {number} pageNumber - Page number
     */
    clearPage(pageNumber) {
        const layer = this.getLayer(pageNumber);
        layer.clear();
        this._saveToHistory();
        this._emit('pageCleared', pageNumber);
    }

    /**
     * Clear all annotations
     */
    clearAll() {
        for (const layer of this.layers.values()) {
            layer.clear();
        }
        this.layers.clear();
        this._saveToHistory();
        this._emit('allCleared');
    }

    /**
     * Undo last action
     * @returns {boolean} True if undone
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this._restoreFromHistory();
            this._emit('undo');
            return true;
        }
        return false;
    }

    /**
     * Redo last undone action
     * @returns {boolean} True if redone
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this._restoreFromHistory();
            this._emit('redo');
            return true;
        }
        return false;
    }

    /**
     * Save current state to history
     * @private
     */
    _saveToHistory() {
        // Remove any redo history
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Save current state
        const state = this.toJSON();
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Restore state from history
     * @private
     */
    _restoreFromHistory() {
        const state = this.history[this.historyIndex];
        if (state) {
            this.fromJSON(state);
        }
    }

    /**
     * Export annotations as JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        const data = {};
        for (const [pageNumber, layer] of this.layers) {
            data[pageNumber] = layer.toJSON();
        }
        return data;
    }

    /**
     * Import annotations from JSON
     * @param {Object} json - JSON data
     */
    fromJSON(json) {
        this.layers.clear();
        for (const [pageNumber, annotations] of Object.entries(json)) {
            const layer = this.getLayer(parseInt(pageNumber, 10));
            layer.fromJSON(annotations);
        }
        this._emit('loaded');
    }

    /**
     * Export annotations as PDF annotations (for compatibility)
     * @returns {Array} PDF annotation format
     */
    toPDFAnnotations() {
        const pdfAnnotations = [];
        
        for (const annotation of this.getAllAnnotations()) {
            const pdfAnn = {
                Type: 'Annot',
                Subtype: this._mapToPDFSubtype(annotation.type),
                Rect: [annotation.x, annotation.y, annotation.x + annotation.width, annotation.y + annotation.height],
                Contents: annotation.text || '',
                C: this._hexToPDFColor(annotation.color),
                CA: annotation.opacity,
                P: annotation.pageNumber
            };
            pdfAnnotations.push(pdfAnn);
        }
        
        return pdfAnnotations;
    }

    /**
     * Map annotation type to PDF subtype
     * @private
     */
    _mapToPDFSubtype(type) {
        const map = {
            [AnnotationType.TEXT]: 'Text',
            [AnnotationType.HIGHLIGHT]: 'Highlight',
            [AnnotationType.CIRCLE]: 'Circle',
            [AnnotationType.RECTANGLE]: 'Square',
            [AnnotationType.LINE]: 'Line',
            [AnnotationType.FREEHAND]: 'Ink'
        };
        return map[type] || 'Text';
    }

    /**
     * Convert hex color to PDF color array
     * @private
     */
    _hexToPDFColor(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return [
                parseInt(result[1], 16) / 255,
                parseInt(result[2], 16) / 255,
                parseInt(result[3], 16) / 255
            ];
        }
        return [1, 0, 0]; // Default to red
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @private
     */
    _emit(event, data) {
        if (this.listeners.has(event)) {
            for (const callback of this.listeners.get(event)) {
                callback(data);
            }
        }
    }
}

/**
 * Annotation Renderer
 * Renders annotations to canvas
 */
export class AnnotationRenderer {
    constructor(canvas, context) {
        this.canvas = canvas;
        this.ctx = context || canvas.getContext('2d');
    }

    /**
     * Render all annotations for a page
     * @param {Array} annotations - Annotations to render
     */
    render(annotations) {
        for (const annotation of annotations) {
            this._renderAnnotation(annotation);
        }
    }

    /**
     * Render single annotation
     * @private
     */
    _renderAnnotation(annotation) {
        this.ctx.save();
        
        this.ctx.globalAlpha = annotation.opacity;
        this.ctx.strokeStyle = annotation.color;
        this.ctx.fillStyle = annotation.color;
        this.ctx.lineWidth = annotation.lineWidth;
        this.ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}`;

        switch (annotation.type) {
            case AnnotationType.TEXT:
                this._renderText(annotation);
                break;
            case AnnotationType.HIGHLIGHT:
                this._renderHighlight(annotation);
                break;
            case AnnotationType.CIRCLE:
                this._renderCircle(annotation);
                break;
            case AnnotationType.RECTANGLE:
                this._renderRectangle(annotation);
                break;
            case AnnotationType.ARROW:
                this._renderArrow(annotation);
                break;
            case AnnotationType.LINE:
                this._renderLine(annotation);
                break;
            case AnnotationType.FREEHAND:
                this._renderFreehand(annotation);
                break;
            case AnnotationType.STAMP:
                this._renderStamp(annotation);
                break;
        }

        this.ctx.restore();
    }

    _renderText(annotation) {
        this.ctx.fillText(annotation.text, annotation.x, annotation.y);
    }

    _renderHighlight(annotation) {
        this.ctx.fillStyle = annotation.color;
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
    }

    _renderCircle(annotation) {
        this.ctx.beginPath();
        this.ctx.ellipse(
            annotation.x + annotation.width / 2,
            annotation.y + annotation.height / 2,
            annotation.width / 2,
            annotation.height / 2,
            0, 0, Math.PI * 2
        );
        this.ctx.stroke();
    }

    _renderRectangle(annotation) {
        this.ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
    }

    _renderArrow(annotation) {
        const points = annotation.points;
        if (points && points.length >= 2) {
            const start = points[0];
            const end = points[points.length - 1];
            
            // Draw line
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();
            
            // Draw arrowhead
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLength = 15;
            
            this.ctx.beginPath();
            this.ctx.moveTo(end.x, end.y);
            this.ctx.lineTo(
                end.x - headLength * Math.cos(angle - Math.PI / 6),
                end.y - headLength * Math.sin(angle - Math.PI / 6)
            );
            this.ctx.lineTo(
                end.x - headLength * Math.cos(angle + Math.PI / 6),
                end.y - headLength * Math.sin(angle + Math.PI / 6)
            );
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    _renderLine(annotation) {
        const points = annotation.points;
        if (points && points.length >= 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.ctx.lineTo(points[i].x, points[i].y);
            }
            this.ctx.stroke();
        }
    }

    _renderFreehand(annotation) {
        const points = annotation.points;
        if (points && points.length >= 2) {
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.ctx.lineTo(points[i].x, points[i].y);
            }
            this.ctx.stroke();
        }
    }

    _renderStamp(annotation) {
        const symbol = annotation.stampSymbol;
        const x = annotation.x;
        const y = annotation.y;
        const size = annotation.fontSize;

        this.ctx.font = `${size}px Music`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Unicode music symbols
        const symbolMap = {
            [StampSymbol.FORTE: '𝆑',
            [StampSymbol.PIANO]: '𝆏',
            [StampSymbol.MEZZO_FORTE]: '𝆐',
            [StampSymbol.MEZZO_PIANO]: '𝆑',
            [StampSymbol.FERMATA]: '𝄐',
            [StampSymbol.ACCENT]: '𝄁',
            [StampSymbol.STACCATO]: '𝄁',
            [StampSymbol.TENUTO]: '𝄁',
            [StampSymbol.CRESCENDO]: '𝆒',
            [StampSymbol.DECRESCENDO]: '𝆓',
            [StampSymbol.CODA]: '𝄌',
            [StampSymbol.SEGNO]: '𝄋',
            [StampSymbol.DAL_SEGNO]: '𝄉',
            [StampSymbol.REPEAT_START]: '𝄆',
            [StampSymbol.REPEAT_END]: '𝄇'
        };

        const char = symbolMap[symbol];
        if (char) {
            this.ctx.fillText(char, x, y);
        } else if (symbol?.startsWith('finger')) {
            const num = symbol.replace('finger', '');
            this.ctx.font = `${size * 0.8}px Arial`;
            this.ctx.fillText(num, x, y);
        }
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Create singleton instance
export const annotationManager = new AnnotationManager();

// Default export
export default {
    AnnotationType,
    StampSymbol,
    Annotation,
    AnnotationLayer,
    AnnotationManager,
    AnnotationRenderer,
    annotationManager
};