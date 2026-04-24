/**
 * Clip Automation Curves - Curved automation on clips
 * Allows drawing curved automation envelopes on audio/MIDI clips
 */

// Clip Automation Curve State
const clipAutomationState = {
    // Active automation
    activeClipId: null,
    activeAutomationType: 'volume', // volume, pan, pitch, filter, custom
    
    // Curve settings
    curveType: 'linear', // linear, exponential, logarithmic, sine, bezier, step
    tension: 0.5, // For bezier curves
    smoothness: 0.3, // Curve smoothing
    
    // Grid settings
    snapToGrid: true,
    gridSize: 1/16, // Musical grid (1/16 note)
    
    // Editing state
    selectedPoints: [],
    dragStartPoint: null,
    isDragging: false,
    
    // Automation data per clip
    automations: new Map(), // clipId -> automation data
    
    // Available automation types
    automationTypes: {
        volume: {
            name: 'Volume',
            unit: 'dB',
            min: -60,
            max: 12,
            default: 0,
            color: '#00ff00'
        },
        pan: {
            name: 'Pan',
            unit: '',
            min: -1,
            max: 1,
            default: 0,
            color: '#ff8800'
        },
        pitch: {
            name: 'Pitch',
            unit: 'semitones',
            min: -24,
            max: 24,
            default: 0,
            color: '#00ffff'
        },
        filter: {
            name: 'Filter Cutoff',
            unit: 'Hz',
            min: 20,
            max: 20000,
            default: 20000,
            color: '#ff00ff'
        },
        resonance: {
            name: 'Filter Resonance',
            unit: '',
            min: 0,
            max: 20,
            default: 1,
            color: '#ff0088'
        },
        attack: {
            name: 'Attack',
            unit: 'ms',
            min: 0,
            max: 2000,
            default: 10,
            color: '#88ff00'
        },
        release: {
            name: 'Release',
            unit: 'ms',
            min: 0,
            max: 5000,
            default: 100,
            color: '#0088ff'
        },
        custom: {
            name: 'Custom',
            unit: '',
            min: 0,
            max: 1,
            default: 0.5,
            color: '#888888'
        }
    },
    
    // Curve presets
    curvePresets: {
        linear: {
            name: 'Linear',
            description: 'Straight lines between points'
        },
        exponential: {
            name: 'Exponential',
            description: 'Exponential curve growth/decay'
        },
        logarithmic: {
            name: 'Logarithmic',
            description: 'Logarithmic curve'
        },
        sine: {
            name: 'Sine',
            description: 'Smooth sine wave curve'
        },
        bezier: {
            name: 'Bezier',
            description: 'Smooth bezier curve with tension control'
        },
        step: {
            name: 'Step',
            description: 'Hard step transitions'
        },
        easeIn: {
            name: 'Ease In',
            description: 'Slow start, fast end'
        },
        easeOut: {
            name: 'Ease Out',
            description: 'Fast start, slow end'
        },
        easeInOut: {
            name: 'Ease In/Out',
            description: 'Slow start and end'
        }
    },
    
    // Undo/Redo
    undoStack: [],
    redoStack: [],
    
    // Callbacks
    onAutomationChange: null,
    onPointAdd: null,
    onPointRemove: null,
    onPointMove: null
};

/**
 * Create automation for a clip
 */
function createClipAutomation(clipId, automationType = 'volume') {
    if (!clipAutomationState.automations.has(clipId)) {
        clipAutomationState.automations.set(clipId, {});
    }
    
    const clipAutomations = clipAutomationState.automations.get(clipId);
    const typeConfig = clipAutomationState.automationTypes[automationType];
    
    if (!clipAutomations[automationType]) {
        clipAutomations[automationType] = {
            type: automationType,
            points: [
                { position: 0, value: typeConfig.default, curve: 'linear' },
                { position: 1, value: typeConfig.default, curve: 'linear' }
            ],
            enabled: true,
            createdAt: Date.now()
        };
    }
    
    clipAutomationState.activeClipId = clipId;
    clipAutomationState.activeAutomationType = automationType;
    
    return {
        success: true,
        automation: clipAutomations[automationType]
    };
}

/**
 * Add automation point
 */
function addAutomationPoint(clipId, automationType, position, value, curveType = null) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return { success: false, error: 'Automation not found' };
    }
    
    const automation = clipAutomations[automationType];
    const typeConfig = clipAutomationState.automationTypes[automationType];
    
    // Clamp position to 0-1
    position = Math.max(0, Math.min(1, position));
    
    // Clamp value to valid range
    value = Math.max(typeConfig.min, Math.min(typeConfig.max, value));
    
    // Check for existing point at same position
    const existingIndex = automation.points.findIndex(p => 
        Math.abs(p.position - position) < 0.001
    );
    
    if (existingIndex >= 0) {
        // Update existing point
        automation.points[existingIndex].value = value;
        automation.points[existingIndex].curve = curveType || clipAutomationState.curveType;
    } else {
        // Add new point
        const point = {
            id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            position,
            value,
            curve: curveType || clipAutomationState.curveType,
            tension: clipAutomationState.tension
        };
        
        automation.points.push(point);
        
        // Sort points by position
        automation.points.sort((a, b) => a.position - b.position);
    }
    
    automation.updatedAt = Date.now();
    
    // Push to undo stack
    clipAutomationState.undoStack.push({
        action: 'addPoint',
        clipId,
        automationType,
        position,
        value
    });
    clipAutomationState.redoStack = [];
    
    if (clipAutomationState.onPointAdd) {
        clipAutomationState.onPointAdd({ clipId, automationType, position, value });
    }
    
    return { success: true, automation };
}

/**
 * Remove automation point
 */
function removeAutomationPoint(clipId, automationType, pointIndex) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return { success: false, error: 'Automation not found' };
    }
    
    const automation = clipAutomations[automationType];
    
    if (pointIndex < 0 || pointIndex >= automation.points.length) {
        return { success: false, error: 'Invalid point index' };
    }
    
    // Don't allow removing first or last point
    if (automation.points.length <= 2) {
        return { success: false, error: 'Cannot remove endpoint' };
    }
    
    const removedPoint = automation.points[pointIndex];
    automation.points.splice(pointIndex, 1);
    automation.updatedAt = Date.now();
    
    // Push to undo stack
    clipAutomationState.undoStack.push({
        action: 'removePoint',
        clipId,
        automationType,
        pointIndex,
        point: removedPoint
    });
    clipAutomationState.redoStack = [];
    
    if (clipAutomationState.onPointRemove) {
        clipAutomationState.onPointRemove({ clipId, automationType, pointIndex });
    }
    
    return { success: true, automation };
}

/**
 * Move automation point
 */
function moveAutomationPoint(clipId, automationType, pointIndex, newPosition, newValue) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return { success: false, error: 'Automation not found' };
    }
    
    const automation = clipAutomations[automationType];
    const typeConfig = clipAutomationState.automationTypes[automationType];
    
    if (pointIndex < 0 || pointIndex >= automation.points.length) {
        return { success: false, error: 'Invalid point index' };
    }
    
    const oldPosition = automation.points[pointIndex].position;
    const oldValue = automation.points[pointIndex].value;
    
    // Clamp values
    newPosition = Math.max(0, Math.min(1, newPosition));
    newValue = Math.max(typeConfig.min, Math.min(typeConfig.max, newValue));
    
    // Update point
    automation.points[pointIndex].position = newPosition;
    automation.points[pointIndex].value = newValue;
    
    // Re-sort if position changed
    if (oldPosition !== newPosition) {
        automation.points.sort((a, b) => a.position - b.position);
    }
    
    automation.updatedAt = Date.now();
    
    // Push to undo stack
    clipAutomationState.undoStack.push({
        action: 'movePoint',
        clipId,
        automationType,
        pointIndex,
        oldPosition,
        oldValue,
        newPosition,
        newValue
    });
    clipAutomationState.redoStack = [];
    
    if (clipAutomationState.onPointMove) {
        clipAutomationState.onPointMove({ 
            clipId, automationType, pointIndex, newPosition, newValue 
        });
    }
    
    return { success: true, automation };
}

/**
 * Get automation value at position
 */
function getAutomationValue(clipId, automationType, position) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        const typeConfig = clipAutomationState.automationTypes[automationType];
        return typeConfig ? typeConfig.default : 0;
    }
    
    const automation = clipAutomations[automationType];
    const points = automation.points;
    
    if (points.length === 0) {
        const typeConfig = clipAutomationState.automationTypes[automationType];
        return typeConfig ? typeConfig.default : 0;
    }
    
    // Find surrounding points
    let prevPoint = points[0];
    let nextPoint = points[points.length - 1];
    
    for (let i = 0; i < points.length - 1; i++) {
        if (points[i].position <= position && points[i + 1].position >= position) {
            prevPoint = points[i];
            nextPoint = points[i + 1];
            break;
        }
    }
    
    // Calculate interpolated value
    return interpolateCurve(prevPoint, nextPoint, position);
}

/**
 * Interpolate between two points based on curve type
 */
function interpolateCurve(pointA, pointB, position) {
    const range = pointB.position - pointA.position;
    
    if (range === 0) {
        return pointA.value;
    }
    
    const t = (position - pointA.position) / range;
    const valueRange = pointB.value - pointA.value;
    
    switch (pointA.curve) {
        case 'linear':
            return pointA.value + valueRange * t;
            
        case 'exponential':
            if (pointA.value === 0) pointA.value = 0.001;
            if (pointB.value === 0) pointB.value = 0.001;
            const expA = Math.log(Math.abs(pointA.value));
            const expB = Math.log(Math.abs(pointB.value));
            return Math.sign(pointA.value) * Math.exp(expA + (expB - expA) * t);
            
        case 'logarithmic':
            const logA = Math.log(1 + Math.abs(pointA.value));
            const logB = Math.log(1 + Math.abs(pointB.value));
            return Math.sign(pointA.value) * (Math.exp(logA + (logB - logA) * t) - 1);
            
        case 'sine':
            const sineT = Math.sin(t * Math.PI / 2);
            return pointA.value + valueRange * sineT;
            
        case 'bezier':
            const tension = pointA.tension || clipAutomationState.tension;
            const bezierT = cubicBezier(t, 0, tension, 1 - tension, 1);
            return pointA.value + valueRange * bezierT;
            
        case 'step':
            // Return previous point value until next point
            return t < 1 ? pointA.value : pointB.value;
            
        case 'easeIn':
            return pointA.value + valueRange * (t * t);
            
        case 'easeOut':
            return pointA.value + valueRange * (1 - (1 - t) * (1 - t));
            
        case 'easeInOut':
            const easeT = t < 0.5 
                ? 2 * t * t 
                : 1 - Math.pow(-2 * t + 2, 2) / 2;
            return pointA.value + valueRange * easeT;
            
        default:
            return pointA.value + valueRange * t;
    }
}

/**
 * Cubic bezier function
 */
function cubicBezier(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 
           3 * mt * mt * t * p1 + 
           3 * mt * t * t * p2 + 
           t * t * t * p3;
}

/**
 * Apply curve preset to point range
 */
function applyCurvePreset(clipId, automationType, startIndex, endIndex, presetName) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return { success: false, error: 'Automation not found' };
    }
    
    const automation = clipAutomations[automationType];
    
    for (let i = startIndex; i < endIndex && i < automation.points.length; i++) {
        automation.points[i].curve = presetName;
    }
    
    automation.updatedAt = Date.now();
    
    return { success: true, automation };
}

/**
 * Generate automation from curve
 */
function generateCurveAutomation(clipId, automationType, curveType, startValue, endValue, numPoints = 10) {
    const typeConfig = clipAutomationState.automationTypes[automationType];
    
    // Create automation if needed
    createClipAutomation(clipId, automationType);
    
    const clipAutomations = clipAutomationState.automations.get(clipId);
    const automation = clipAutomations[automationType];
    
    // Generate points
    const newPoints = [];
    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const position = t;
        
        // Calculate value based on curve type
        let value;
        const range = endValue - startValue;
        
        switch (curveType) {
            case 'exponential':
                value = startValue + range * Math.pow(t, 2);
                break;
            case 'logarithmic':
                value = startValue + range * (1 - Math.pow(1 - t, 2));
                break;
            case 'sine':
                value = startValue + range * Math.sin(t * Math.PI / 2);
                break;
            default:
                value = startValue + range * t;
        }
        
        newPoints.push({
            position,
            value: Math.max(typeConfig.min, Math.min(typeConfig.max, value)),
            curve: curveType
        });
    }
    
    automation.points = newPoints;
    automation.updatedAt = Date.now();
    
    return { success: true, automation };
}

/**
 * Copy automation to another clip
 */
function copyAutomation(sourceClipId, targetClipId, automationType) {
    const sourceAutomations = clipAutomationState.automations.get(sourceClipId);
    if (!sourceAutomations || !sourceAutomations[automationType]) {
        return { success: false, error: 'Source automation not found' };
    }
    
    const sourceAutomation = sourceAutomations[automationType];
    
    // Create target automation
    createClipAutomation(targetClipId, automationType);
    
    const targetAutomations = clipAutomationState.automations.get(targetClipId);
    targetAutomations[automationType] = JSON.parse(JSON.stringify(sourceAutomation));
    
    return { success: true };
}

/**
 * Clear automation
 */
function clearAutomation(clipId, automationType) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return { success: false, error: 'Automation not found' };
    }
    
    const typeConfig = clipAutomationState.automationTypes[automationType];
    
    // Reset to default
    clipAutomations[automationType] = {
        type: automationType,
        points: [
            { position: 0, value: typeConfig.default, curve: 'linear' },
            { position: 1, value: typeConfig.default, curve: 'linear' }
        ],
        enabled: true,
        clearedAt: Date.now()
    };
    
    return { success: true };
}

/**
 * Enable/disable automation
 */
function toggleAutomation(clipId, automationType, enabled = null) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return { success: false, error: 'Automation not found' };
    }
    
    const automation = clipAutomations[automationType];
    automation.enabled = enabled !== null ? enabled : !automation.enabled;
    
    return { success: true, enabled: automation.enabled };
}

/**
 * Get automation curve for rendering
 */
function getAutomationCurve(clipId, automationType, resolution = 100) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return null;
    }
    
    const automation = clipAutomations[automationType];
    const curve = [];
    
    for (let i = 0; i < resolution; i++) {
        const position = i / (resolution - 1);
        const value = getAutomationValue(clipId, automationType, position);
        curve.push({ position, value });
    }
    
    return curve;
}

/**
 * Export automation as JSON
 */
function exportAutomation(clipId, automationType) {
    const clipAutomations = clipAutomationState.automations.get(clipId);
    if (!clipAutomations || !clipAutomations[automationType]) {
        return null;
    }
    
    return JSON.stringify(clipAutomations[automationType], null, 2);
}

/**
 * Import automation from JSON
 */
function importAutomation(clipId, automationType, jsonString) {
    try {
        const automation = JSON.parse(jsonString);
        
        if (!automation.points || !Array.isArray(automation.points)) {
            return { success: false, error: 'Invalid automation format' };
        }
        
        if (!clipAutomationState.automations.has(clipId)) {
            clipAutomationState.automations.set(clipId, {});
        }
        
        const clipAutomations = clipAutomationState.automations.get(clipId);
        clipAutomations[automationType] = automation;
        
        return { success: true, automation };
    } catch (error) {
        return { success: false, error: 'Failed to parse automation' };
    }
}

/**
 * Undo last action
 */
function undoAutomationAction() {
    if (clipAutomationState.undoStack.length === 0) {
        return { success: false, error: 'Nothing to undo' };
    }
    
    const action = clipAutomationState.undoStack.pop();
    clipAutomationState.redoStack.push(action);
    
    // Reverse the action
    const clipAutomations = clipAutomationState.automations.get(action.clipId);
    if (!clipAutomations) return { success: false, error: 'Clip not found' };
    
    const automation = clipAutomations[action.automationType];
    
    switch (action.action) {
        case 'addPoint':
            // Remove the added point
            automation.points = automation.points.filter(p => 
                Math.abs(p.position - action.position) > 0.001
            );
            break;
            
        case 'removePoint':
            // Re-add the removed point
            automation.points.splice(action.pointIndex, 0, action.point);
            break;
            
        case 'movePoint':
            // Move back to original position
            const point = automation.points.find(p => 
                Math.abs(p.position - action.newPosition) < 0.001
            );
            if (point) {
                point.position = action.oldPosition;
                point.value = action.oldValue;
                automation.points.sort((a, b) => a.position - b.position);
            }
            break;
    }
    
    return { success: true, action };
}

/**
 * Redo last undone action
 */
function redoAutomationAction() {
    if (clipAutomationState.redoStack.length === 0) {
        return { success: false, error: 'Nothing to redo' };
    }
    
    const action = clipAutomationState.redoStack.pop();
    clipAutomationState.undoStack.push(action);
    
    // Re-apply the action
    switch (action.action) {
        case 'addPoint':
            addAutomationPoint(
                action.clipId, 
                action.automationType, 
                action.position, 
                action.value
            );
            break;
            
        case 'removePoint':
            removeAutomationPoint(
                action.clipId, 
                action.automationType, 
                action.pointIndex
            );
            break;
            
        case 'movePoint':
            moveAutomationPoint(
                action.clipId, 
                action.automationType, 
                action.pointIndex, 
                action.newPosition, 
                action.newValue
            );
            break;
    }
    
    return { success: true, action };
}

/**
 * Get available automation types
 */
function getAutomationTypes() {
    return Object.entries(clipAutomationState.automationTypes).map(([key, config]) => ({
        id: key,
        ...config
    }));
}

/**
 * Get curve presets
 */
function getCurvePresets() {
    return Object.entries(clipAutomationState.curvePresets).map(([key, preset]) => ({
        id: key,
        ...preset
    }));
}

// Export functions
window.createClipAutomation = createClipAutomation;
window.addAutomationPoint = addAutomationPoint;
window.removeAutomationPoint = removeAutomationPoint;
window.moveAutomationPoint = moveAutomationPoint;
window.getAutomationValue = getAutomationValue;
window.applyCurvePreset = applyCurvePreset;
window.generateCurveAutomation = generateCurveAutomation;
window.copyAutomation = copyAutomation;
window.clearAutomation = clearAutomation;
window.toggleAutomation = toggleAutomation;
window.getAutomationCurve = getAutomationCurve;
window.exportAutomation = exportAutomation;
window.importAutomation = importAutomation;
window.undoAutomationAction = undoAutomationAction;
window.redoAutomationAction = redoAutomationAction;
window.getAutomationTypes = getAutomationTypes;
window.getCurvePresets = getCurvePresets;
window.clipAutomationState = clipAutomationState;

console.log('[ClipAutomationCurves] Module loaded');