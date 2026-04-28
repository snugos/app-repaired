// js/SidechainAttackShape.js - Visual editor for sidechain envelope attack/release curve
// Allows users to draw custom attack and release shapes for sidechain ducking effects

let localAppServices = {};
let attackShapeState = {
    attackCurve: 'exponential',   // 'linear', 'exponential', 'scurve', 'square'
    releaseCurve: 'exponential',  // 'linear', 'exponential', 'scurve', 'square'
    attackTime: 0.01,             // seconds
    releaseTime: 0.1,             // seconds
    lookahead: 0.005,             // seconds
    holdTime: 0.05               // seconds (gate-like hold)
};

const CURVE_TYPES = {
    linear: { name: 'Linear', description: 'Straight line curve' },
    exponential: { name: 'Exponential', description: 'Natural exponential curve' },
    scurve: { name: 'S-Curve', description: 'Smooth S-shaped curve' },
    square: { name: 'Square', description: 'Sharp attack/release' }
};

export function initSidechainAttackShape(appServices) {
    localAppServices = appServices || {};
    loadShapeState();
    console.log('[SidechainAttackShape] Initialized');
}

/**
 * Get current attack shape state
 */
export function getAttackShapeState() {
    return { ...attackShapeState };
}

/**
 * Set attack curve type
 * @param {string} curveType - 'linear', 'exponential', 'scurve', 'square'
 */
export function setAttackCurve(curveType) {
    if (CURVE_TYPES[curveType]) {
        attackShapeState.attackCurve = curveType;
        saveShapeState();
        return true;
    }
    return false;
}

/**
 * Set release curve type
 * @param {string} curveType - 'linear', 'exponential', 'scurve', 'square'
 */
export function setReleaseCurve(curveType) {
    if (CURVE_TYPES[curveType]) {
        attackShapeState.releaseCurve = curveType;
        saveShapeState();
        return true;
    }
    return false;
}

/**
 * Set attack time
 * @param {number} time - Time in seconds
 */
export function setAttackTime(time) {
    attackShapeState.attackTime = Math.max(0.001, Math.min(1, time));
    saveShapeState();
}

/**
 * Set release time
 * @param {number} time - Time in seconds
 */
export function setReleaseTime(time) {
    attackShapeState.releaseTime = Math.max(0.01, Math.min(5, time));
    saveShapeState();
}

/**
 * Calculate envelope value at a given time
 * @param {number} t - Time relative to event (negative = before, positive = after)
 * @param {boolean} isRelease - True for release phase, false for attack
 * @returns {number} Envelope value 0-1
 */
export function calculateEnvelopeValue(t, isRelease = false) {
    const curve = isRelease ? attackShapeState.releaseCurve : attackShapeState.attackCurve;
    const duration = isRelease ? attackShapeState.releaseTime : attackShapeState.attackTime;
    
    if (t <= 0) return isRelease ? 1 : 0;
    if (t >= duration) return isRelease ? 0 : 1;
    
    const normalized = t / duration;
    
    switch (curve) {
        case 'linear':
            return isRelease ? 1 - normalized : normalized;
        
        case 'exponential':
            return isRelease ? 1 - Math.pow(normalized, 2) : Math.pow(normalized, 2);
        
        case 'scurve':
            return isRelease 
                ? 1 - (normalized + Math.sin(normalized * Math.PI * 2) / (Math.PI * 2)) / 2
                : (normalized + Math.sin(normalized * Math.PI * 2) / (Math.PI * 2)) / 2;
        
        case 'square':
            return normalized < 0.5 ? (isRelease ? 1 : 0) : (isRelease ? 0 : 1);
        
        default:
            return isRelease ? 1 - normalized : normalized;
    }
}

/**
 * Generate envelope curve points for visualization
 * @param {number} samples - Number of samples to generate
 * @returns {Array} Array of {x, y} points
 */
export function generateEnvelopeCurvePoints(samples = 100) {
    const points = [];
    const totalDuration = attackShapeState.attackTime + attackShapeState.releaseTime + 0.05; // + hold
    
    for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * totalDuration;
        let value;
        
        if (t < attackShapeState.attackTime) {
            // Attack phase
            value = calculateEnvelopeValue(t, false);
        } else if (t < attackShapeState.attackTime + 0.05) {
            // Hold phase (brief plateau)
            value = 1;
        } else {
            // Release phase
            value = calculateEnvelopeValue(t - attackShapeState.attackTime - 0.05, true);
        }
        
        points.push({ x: i / samples, y: value });
    }
    
    return points;
}

/**
 * Save state to localStorage
 */
function saveShapeState() {
    try {
        localStorage.setItem('snaw_sidechain_shape', JSON.stringify(attackShapeState));
    } catch (e) {
        console.warn('[SidechainAttackShape] Could not save:', e);
    }
}

/**
 * Load state from localStorage
 */
function loadShapeState() {
    try {
        const data = localStorage.getItem('snaw_sidechain_shape');
        if (data) {
            const loaded = JSON.parse(data);
            attackShapeState = { ...attackShapeState, ...loaded };
        }
    } catch (e) {
        console.warn('[SidechainAttackShape] Could not load:', e);
    }
}

/**
 * Open the sidechain attack shape editor panel
 */
export function openSidechainAttackShapePanel(savedState = null) {
    const windowId = 'sidechainAttackShape';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderAttackShapeContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'sidechainAttackShapeContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';
    
    const options = {
        width: 480,
        height: 420,
        minWidth: 400,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    if (savedState) {
        Object.assign(options, {
            x: parseInt(savedState.left, 10),
            y: parseInt(savedState.top, 10),
            width: parseInt(savedState.width, 10),
            height: parseInt(savedState.height, 10),
            zIndex: savedState.zIndex,
            isMinimized: savedState.isMinimized
        });
    }

    const win = localAppServices.createWindow(windowId, 'Sidechain Attack Shape', contentContainer, options);
    if (win?.element) {
        renderAttackShapeContent();
    }
    return win;
}

/**
 * Render the sidechain attack shape editor content
 */
function renderAttackShapeContent() {
    const container = document.getElementById('sidechainAttackShapeContent');
    if (!container) return;

    container.innerHTML = `
        <div class="flex-1 flex flex-col gap-3">
            <!-- Curve Display -->
            <div class="relative bg-gray-800 rounded border border-gray-700" style="height: 160px;">
                <canvas id="envelopeCurveCanvas" class="w-full h-full rounded"></canvas>
                <div class="absolute top-2 left-2 text-xs text-gray-400">
                    Attack → Hold → Release
                </div>
                <div class="absolute bottom-2 right-2 text-xs text-gray-500">
                    Time →
                </div>
            </div>
            
            <!-- Attack Controls -->
            <div class="bg-gray-800 rounded p-3 border border-gray-700">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-white">Attack</span>
                    <span class="text-xs text-gray-400">${attackShapeState.attackTime.toFixed(3)}s</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs text-gray-400 w-16">Curve:</span>
                    <select id="attackCurveSelect" class="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1">
                        ${Object.entries(CURVE_TYPES).map(([key, val]) => 
                            `<option value="${key}" ${attackShapeState.attackCurve === key ? 'selected' : ''}>${val.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 w-16">Time:</span>
                    <input type="range" id="attackTimeSlider" min="1" max="200" 
                        value="${Math.round(attackShapeState.attackTime * 1000)}"
                        class="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
            
            <!-- Release Controls -->
            <div class="bg-gray-800 rounded p-3 border border-gray-700">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-white">Release</span>
                    <span class="text-xs text-gray-400">${attackShapeState.releaseTime.toFixed(2)}s</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs text-gray-400 w-16">Curve:</span>
                    <select id="releaseCurveSelect" class="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1">
                        ${Object.entries(CURVE_TYPES).map(([key, val]) => 
                            `<option value="${key}" ${attackShapeState.releaseCurve === key ? 'selected' : ''}>${val.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 w-16">Time:</span>
                    <input type="range" id="releaseTimeSlider" min="10" max="1000" 
                        value="${Math.round(attackShapeState.releaseTime * 100)}"
                        class="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
            
            <!-- Presets -->
            <div class="flex gap-2 flex-wrap">
                <button class="preset-btn px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded" data-preset="punchy">
                    Punchy
                </button>
                <button class="preset-btn px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded" data-preset="smooth">
                    Smooth
                </button>
                <button class="preset-btn px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded" data-preset="ghost">
                    Ghost
                </button>
                <button class="preset-btn px-3 py-1 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded" data-preset="hard">
                    Hard
                </button>
            </div>
            
            <!-- Apply Button -->
            <div class="mt-auto">
                <button id="applySidechainBtn" class="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium">
                    Apply to Selected Track
                </button>
            </div>
        </div>
    `;

    // Wire up controls
    const attackCurveSelect = container.querySelector('#attackCurveSelect');
    const releaseCurveSelect = container.querySelector('#releaseCurveSelect');
    const attackTimeSlider = container.querySelector('#attackTimeSlider');
    const releaseTimeSlider = container.querySelector('#releaseTimeSlider');
    const applyBtn = container.querySelector('#applySidechainBtn');

    attackCurveSelect?.addEventListener('change', (e) => {
        setAttackCurve(e.target.value);
        drawEnvelopeCurve();
    });

    releaseCurveSelect?.addEventListener('change', (e) => {
        setReleaseCurve(e.target.value);
        drawEnvelopeCurve();
    });

    attackTimeSlider?.addEventListener('input', (e) => {
        const time = parseInt(e.target.value, 10) / 1000;
        setAttackTime(time);
        attackTimeSlider.nextElementSibling.textContent = `${time.toFixed(3)}s`;
        drawEnvelopeCurve();
    });

    releaseTimeSlider?.addEventListener('input', (e) => {
        const time = parseInt(e.target.value, 10) / 100;
        setReleaseTime(time);
        releaseTimeSlider.nextElementSibling.textContent = `${time.toFixed(2)}s`;
        drawEnvelopeCurve();
    });

    // Preset buttons
    container.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            applyPreset(preset);
            renderAttackShapeContent();
            localAppServices.showNotification?.(`Preset "${preset}" applied`, 1500);
        });
    });

    applyBtn?.addEventListener('click', () => {
        applyToSelectedTrack();
    });

    // Draw initial curve
    setTimeout(drawEnvelopeCurve, 50);
}

/**
 * Apply a preset configuration
 * @param {string} presetName - Name of preset to apply
 */
function applyPreset(presetName) {
    switch (presetName) {
        case 'punchy':
            attackShapeState.attackCurve = 'square';
            attackShapeState.releaseCurve = 'exponential';
            attackShapeState.attackTime = 0.005;
            attackShapeState.releaseTime = 0.08;
            break;
        case 'smooth':
            attackShapeState.attackCurve = 'scurve';
            attackShapeState.releaseCurve = 'scurve';
            attackShapeState.attackTime = 0.05;
            attackShapeState.releaseTime = 0.3;
            break;
        case 'ghost':
            attackShapeState.attackCurve = 'linear';
            attackShapeState.releaseCurve = 'linear';
            attackShapeState.attackTime = 0.02;
            attackShapeState.releaseTime = 0.15;
            break;
        case 'hard':
            attackShapeState.attackCurve = 'square';
            attackShapeState.releaseCurve = 'square';
            attackShapeState.attackTime = 0.001;
            attackShapeState.releaseTime = 0.05;
            break;
    }
    saveShapeState();
}

/**
 * Draw the envelope curve on canvas
 */
function drawEnvelopeCurve() {
    const canvas = document.getElementById('envelopeCurveCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Clear
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (graphHeight * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    // Draw envelope curve
    const points = generateEnvelopeCurvePoints(100);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();

    points.forEach((point, i) => {
        const x = padding + point.x * graphWidth;
        const y = padding + graphHeight - point.y * graphHeight;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(padding + graphWidth, padding + graphHeight);
    ctx.lineTo(padding, padding + graphHeight);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.fill();

    // Draw markers
    const attackEnd = attackShapeState.attackTime / (attackShapeState.attackTime + attackShapeState.releaseTime + 0.05);
    const holdEnd = (attackShapeState.attackTime + 0.05) / (attackShapeState.attackTime + attackShapeState.releaseTime + 0.05);
    
    ctx.fillStyle = '#f59e0b';
    
    // Attack marker
    const attackX = padding + attackEnd * graphWidth;
    ctx.beginPath();
    ctx.arc(attackX, padding + graphHeight, 4, 0, Math.PI * 2);
    ctx.fill();

    // Hold/Release marker
    const holdX = padding + holdEnd * graphWidth;
    ctx.beginPath();
    ctx.arc(holdX, padding + graphHeight, 4, 0, Math.PI * 2);
    ctx.fill();

    // Labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px system-ui';
    ctx.fillText('Attack', padding + attackEnd * graphWidth - 20, height - 8);
    ctx.fillText('Release', width - padding - 40, height - 8);
}

/**
 * Apply current shape settings to the selected sidechain track
 */
function applyToSelectedTrack() {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const selectedTrackId = localAppServices.getSelectedTrackId ? localAppServices.getSelectedTrackId() : null;
    
    if (!selectedTrackId) {
        localAppServices.showNotification?.('No track selected', 2000);
        return;
    }
    
    const track = tracks.find(t => t.id === selectedTrackId);
    if (!track) {
        localAppServices.showNotification?.('Track not found', 2000);
        return;
    }

    // Apply shape settings to track
    if (track.sidechainParams) {
        track.sidechainParams.attackCurve = attackShapeState.attackCurve;
        track.sidechainParams.releaseCurve = attackShapeState.releaseCurve;
        track.sidechainParams.attackTime = attackShapeState.attackTime;
        track.sidechainParams.releaseTime = attackShapeState.releaseTime;
    } else {
        track.sidechainParams = { ...attackShapeState };
    }

    localAppServices.showNotification?.(`Sidechain shape applied to "${track.name}"`, 2000);
    console.log('[SidechainAttackShape] Applied to track', selectedTrackId, attackShapeState);
}