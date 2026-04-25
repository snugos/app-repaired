// js/VelocityCurveEditor.js - Velocity Curve Editor for MIDI Note Dynamics
// Feature: Draw velocity curves for MIDI note dynamics

let localAppServices = {};
let velocityCurveWindow = null;
let currentCurve = []; // Array of {step: number, value: number} normalized 0-1

const CURVE_STEPS = 16; // Number of steps in the curve

export function initVelocityCurveEditor(services) {
    localAppServices = services;
    console.log('[VelocityCurveEditor] Initialized');
}

/**
 * Initialize default velocity curve (linear at 0.7)
 */
function initDefaultCurve() {
    currentCurve = [];
    for (let i = 0; i < CURVE_STEPS; i++) {
        currentCurve.push({ step: i, value: 0.7 });
    }
}

/**
 * Open the velocity curve editor window
 * @param {number} trackId - Track ID (optional, uses selected track if not provided)
 */
export function openVelocityCurveEditor(trackId = null) {
    const windowId = 'velocityCurveEditor';
    
    // Initialize default curve if empty
    if (currentCurve.length === 0) {
        initDefaultCurve();
    }
    
    // Create window content
    const contentContainer = document.createElement('div');
    contentContainer.id = 'velocityCurveContent';
    contentContainer.className = 'flex flex-col h-full bg-gray-900 text-white p-3';
    
    contentContainer.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-medium text-gray-300">Velocity Curve Editor</h3>
            <select id="curvePresetSelect" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs">
                <option value="linear">Linear</option>
                <option value="pyramid">Pyramid</option>
                <option value="bell">Bell Curve</option>
                <option value="stepped">Stepped</option>
                <option value="random">Random</option>
                <option value="custom">Custom</option>
            </select>
        </div>
        
        <div id="velocityCurveCanvas" class="flex-1 bg-gray-800 rounded border border-gray-700 relative cursor-crosshair">
            <canvas id="velocityCanvas" class="w-full h-full"></canvas>
        </div>
        
        <div class="flex items-center justify-between mt-3 text-xs text-gray-400">
            <span>Click and drag to draw curve</span>
            <span id="velocityValueDisplay">Step 0: 70%</span>
        </div>
        
        <div class="flex items-center gap-2 mt-2">
            <button id="applyVelocityCurve" class="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded">
                Apply to Selection
            </button>
            <button id="resetVelocityCurve" class="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded">
                Reset
            </button>
            <button id="invertVelocityCurve" class="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded">
                Invert
            </button>
        </div>
    `;
    
    const options = {
        width: 500,
        height: 300,
        minWidth: 400,
        minHeight: 200,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    velocityCurveWindow = localAppServices.createWindow?.(windowId, 'Velocity Curve Editor', contentContainer, options);
    
    if (velocityCurveWindow?.element) {
        setTimeout(() => {
            setupVelocityCurveCanvas();
            drawVelocityCurve();
        }, 50);
    }
    
    return velocityCurveWindow;
}

/**
 * Setup canvas event handlers for drawing
 */
function setupVelocityCurveCanvas() {
    const canvas = document.getElementById('velocityCanvas');
    const container = document.getElementById('velocityCurveCanvas');
    
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    
    // Resize canvas to match container
    function resizeCanvas() {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawVelocityCurve();
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Get step from x position
    function getStepFromX(x) {
        const stepWidth = canvas.width / CURVE_STEPS;
        return Math.max(0, Math.min(CURVE_STEPS - 1, Math.floor(x / stepWidth)));
    }
    
    // Get value from y position (inverted - top is 1, bottom is 0)
    function getValueFromY(y) {
        return Math.max(0, Math.min(1, 1 - (y / canvas.height)));
    }
    
    // Update display
    function updateDisplay(step, value) {
        const display = document.getElementById('velocityValueDisplay');
        if (display) {
            display.textContent = `Step ${step}: ${Math.round(value * 100)}%`;
        }
    }
    
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const step = getStepFromX(x);
        const value = getValueFromY(y);
        
        currentCurve[step].value = value;
        drawVelocityCurve();
        updateDisplay(step, value);
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const step = getStepFromX(x);
        
        updateDisplay(step, currentCurve[step].value);
        
        if (isDrawing) {
            const value = getValueFromY(y);
            currentCurve[step].value = value;
            drawVelocityCurve();
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });
    
    // Preset selector
    const presetSelect = document.getElementById('curvePresetSelect');
    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            applyPreset(e.target.value);
        });
    }
    
    // Apply button
    const applyBtn = document.getElementById('applyVelocityCurve');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyVelocityCurve);
    }
    
    // Reset button
    const resetBtn = document.getElementById('resetVelocityCurve');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            initDefaultCurve();
            drawVelocityCurve();
        });
    }
    
    // Invert button
    const invertBtn = document.getElementById('invertVelocityCurve');
    if (invertBtn) {
        invertBtn.addEventListener('click', () => {
            for (let i = 0; i < currentCurve.length; i++) {
                currentCurve[i].value = 1 - currentCurve[i].value;
            }
            drawVelocityCurve();
        });
    }
}

/**
 * Draw the velocity curve on canvas
 */
function drawVelocityCurve() {
    const canvas = document.getElementById('velocityCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    
    // Vertical grid lines (steps)
    const stepWidth = w / CURVE_STEPS;
    for (let i = 0; i <= CURVE_STEPS; i++) {
        const x = i * stepWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    
    // Draw curve line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < CURVE_STEPS; i++) {
        const x = (i + 0.5) * stepWidth;
        const y = h - (currentCurve[i].value * h);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Draw points
    for (let i = 0; i < CURVE_STEPS; i++) {
        const x = (i + 0.5) * stepWidth;
        const y = h - (currentCurve[i].value * h);
        
        // Gradient from red (low) to green (high)
        const value = currentCurve[i].value;
        const r = Math.round(255 * (1 - value));
        const g = Math.round(255 * value);
        
        ctx.fillStyle = `rgb(${r}, ${g}, 100)`;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Apply a preset curve
 * @param {string} preset - Preset name
 */
function applyPreset(preset) {
    initDefaultCurve();
    
    switch (preset) {
        case 'linear':
            // Already initialized as linear 0.7
            break;
        case 'pyramid':
            for (let i = 0; i < CURVE_STEPS; i++) {
                const mid = CURVE_STEPS / 2;
                currentCurve[i].value = 1 - Math.abs((i - mid + 0.5) / mid);
            }
            break;
        case 'bell':
            for (let i = 0; i < CURVE_STEPS; i++) {
                const mid = CURVE_STEPS / 2;
                const dist = Math.abs(i - mid + 0.5) / mid;
                currentCurve[i].value = Math.max(0.2, 1 - (dist * dist * 1.5));
            }
            break;
        case 'stepped':
            for (let i = 0; i < CURVE_STEPS; i++) {
                const group = Math.floor(i / 4);
                currentCurve[i].value = 0.4 + (group * 0.2);
            }
            break;
        case 'random':
            for (let i = 0; i < CURVE_STEPS; i++) {
                currentCurve[i].value = 0.3 + Math.random() * 0.5;
            }
            break;
    }
    
    drawVelocityCurve();
}

/**
 * Apply velocity curve to selected notes
 */
function applyVelocityCurve() {
    // Get selected track or use first MIDI track
    const tracks = localAppServices.getTracksState?.() || [];
    const track = tracks.find(t => t.type !== 'Audio');
    
    if (!track) {
        localAppServices.showNotification?.('No MIDI track found to apply velocity curve', 2000);
        return;
    }
    
    const sequence = track.getActiveSequence?.();
    if (!sequence?.data) {
        localAppServices.showNotification?.('No active sequence to modify', 2000);
        return;
    }
    
    // Apply velocity curve to all active notes
    let modifiedCount = 0;
    for (let row = 0; row < sequence.data.length; row++) {
        for (let step = 0; step < sequence.data[row].length; step++) {
            const noteData = sequence.data[row][step];
            if (noteData?.active) {
                const curveIndex = step % CURVE_STEPS;
                noteData.velocity = currentCurve[curveIndex].value;
                modifiedCount++;
            }
        }
    }
    
    if (modifiedCount > 0) {
        localAppServices.showNotification?.(`Applied velocity curve to ${modifiedCount} notes`, 2000);
        localAppServices.updateTrackUI?.(track.id, 'sequencerContentChanged');
    } else {
        localAppServices.showNotification?.('No notes to modify in sequence', 2000);
    }
}

/**
 * Get the current velocity curve
 * @returns {Array} Current curve data
 */
export function getVelocityCurve() {
    return [...currentCurve];
}

/**
 * Set a custom velocity curve
 * @param {Array} curve - Array of {step, value} objects
 */
export function setVelocityCurve(curve) {
    if (Array.isArray(curve) && curve.length === CURVE_STEPS) {
        currentCurve = [...curve];
    }
}

console.log('[VelocityCurveEditor] Module loaded');
