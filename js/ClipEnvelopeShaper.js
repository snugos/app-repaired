/**
 * js/ClipEnvelopeShaper.js - Clip Envelope Shaper
 * 
 * Draw custom amplitude envelopes on audio/MIDI clips for precise dynamics control.
 * Users can draw ADSR-style or free-form envelopes to shape clip amplitude.
 */

let localAppServices = {};
let envelopePresets = {
    linear: { name: 'Linear', points: [{t:0,v:1},{t:1,v:1}] },
    fadeIn: { name: 'Fade In', points: [{t:0,v:0},{t:1,v:1}] },
    fadeOut: { name: 'Fade Out', points: [{t:0,v:1},{t:1,v:0}] },
    fadeInOut: { name: 'Fade In/Out', points: [{t:0,v:0},{t:0.3,v:1},{t:0.7,v:1},{t:1,v:0}] },
    exponential: { name: 'Exponential', points: [{t:0,v:0.1},{t:0.5,v:0.8},{t:1,v:0.1}] },
    sustain: { name: 'ADSR Style', points: [{t:0,v:0},{t:0.1,v:1},{t:0.3,v:0.8},{t:0.7,v:0.8},{t:0.9,v:0},{t:1,v:0}] }
};
let activeClipId = null;
let activeEnvelope = null;
let isDraggingPoint = false;
let dragPointIndex = -1;

const STORAGE_KEY = 'snugosClipEnvelopes';

/**
 * Initialize the module with app services
 */
export function initClipEnvelopeShaper(appServices) {
    localAppServices = appServices || {};
    loadEnvelopes();
    console.log('[ClipEnvelopeShaper] Module initialized');
}

/**
 * Load saved envelopes from localStorage
 */
function loadEnvelopes() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            if (data.presets) {
                Object.assign(envelopePresets, data.presets);
            }
        }
    } catch (e) {
        console.warn('[ClipEnvelopeShaper] Failed to load envelopes:', e);
    }
}

/**
 * Save envelopes to localStorage
 */
function saveEnvelopes() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets: envelopePresets }));
    } catch (e) {
        console.warn('[ClipEnvelopeShaper] Failed to save envelopes:', e);
    }
}

/**
 * Get all preset names
 */
export function getEnvelopePresetNames() {
    return Object.keys(envelopePresets);
}

/**
 * Get a preset by name
 */
export function getEnvelopePreset(name) {
    return envelopePresets[name] ? JSON.parse(JSON.stringify(envelopePresets[name])) : null;
}

/**
 * Apply an envelope preset to a clip
 * @param {string} clipId - The clip ID to apply envelope to
 * @param {string} presetName - Name of the preset
 * @param {number} mix - Blend amount (0-1)
 */
export function applyEnvelopePreset(clipId, presetName, mix = 1) {
    const preset = envelopePresets[presetName];
    if (!preset) {
        console.warn(`[ClipEnvelopeShaper] Preset "${presetName}" not found`);
        return false;
    }
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    for (const track of tracks) {
        if (track.timelineClips) {
            const clip = track.timelineClips.find(c => c.id === clipId);
            if (clip) {
                clip.envelope = JSON.parse(JSON.stringify(preset.points));
                clip.envelopeMix = mix;
                console.log(`[ClipEnvelopeShaper] Applied "${presetName}" to clip "${clipId}"`);
                return true;
            }
        }
    }
    return false;
}

/**
 * Save a custom envelope preset
 */
export function saveEnvelopePreset(name, points) {
    if (!name || !name.trim()) return false;
    envelopePresets[name.trim()] = {
        name: name.trim(),
        points: JSON.parse(JSON.stringify(points))
    };
    saveEnvelopes();
    console.log(`[ClipEnvelopeShaper] Saved envelope preset "${name}"`);
    return true;
}

/**
 * Delete a custom envelope preset
 */
export function deleteEnvelopePreset(name) {
    if (envelopePresets[name] && !['linear','fadeIn','fadeOut','fadeInOut','exponential','sustain'].includes(name)) {
        delete envelopePresets[name];
        saveEnvelopes();
        return true;
    }
    return false;
}

/**
 * Get envelope for a specific clip
 */
export function getClipEnvelope(clipId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    for (const track of tracks) {
        if (track.timelineClips) {
            const clip = track.timelineClips.find(c => c.id === clipId);
            if (clip && clip.envelope) {
                return JSON.parse(JSON.stringify(clip.envelope));
            }
        }
    }
    return null;
}

/**
 * Open the Clip Envelope Shaper panel
 */
export function openClipEnvelopeShaperPanel(clipId = null) {
    const windowId = 'clipEnvelopeShaper';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !clipId) {
        const win = openWindows.get(windowId);
        win.restore();
        renderEnvelopeShaperContent();
        return win;
    }
    
    activeClipId = clipId;
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'clipEnvelopeContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';
    
    const options = {
        width: 600,
        height: 400,
        minWidth: 500,
        minHeight: 300,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Clip Envelope Shaper', contentContainer, options);
    
    if (win?.element) {
        renderEnvelopeShaperContent();
    }
    
    return win;
}

/**
 * Render the envelope shaper content
 */
function renderEnvelopeShaperContent() {
    const container = document.getElementById('clipEnvelopeContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    let allClips = [];
    tracks.forEach(t => {
        if (t.timelineClips) {
            t.timelineClips.forEach(c => {
                allClips.push({ ...c, trackName: t.name, trackColor: t.color });
            });
        }
    });
    
    // Get current clip's envelope
    const currentClip = allClips.find(c => c.id === activeClipId);
    const currentEnvelope = currentClip?.envelope || [
        { t: 0, v: 1 },
        { t: 1, v: 1 }
    ];
    
    activeEnvelope = JSON.parse(JSON.stringify(currentEnvelope));
    
    let html = `
        <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <select id="envelopeClipSelect" class="text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded px-2 py-1">
                    <option value="">Select a clip...</option>
                    ${allClips.map(c => `<option value="${c.id}" ${c.id === activeClipId ? 'selected' : ''}>${c.trackName} - ${c.name || 'Clip'}</option>`).join('')}
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Mix:</span>
                <input type="range" id="envelopeMixSlider" min="0" max="100" value="${(currentClip?.envelopeMix ?? 1) * 100}" class="w-20 h-2">
                <span id="envelopeMixValue" class="text-xs text-gray-600 w-8">${Math.round((currentClip?.envelopeMix ?? 1) * 100)}%</span>
            </div>
        </div>
        
        <!-- Envelope Canvas -->
        <div class="flex-1 bg-white dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600 relative overflow-hidden mb-3">
            <canvas id="envelopeCanvas" width="560" height="200" class="w-full cursor-crosshair"></canvas>
        </div>
        
        <!-- Point info -->
        <div id="envelopePointInfo" class="mb-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Click to add point • Drag to move • Right-click to delete
        </div>
        
        <!-- Presets -->
        <div class="mb-3">
            <h3 class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Envelope Presets</h3>
            <div class="flex flex-wrap gap-1">
                ${Object.entries(envelopePresets).map(([key, preset]) => `
                    <button class="envelope-preset-btn px-2 py-1 text-xs rounded ${key === 'linear' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-500'}" 
                        data-preset="${key}">${preset.name}</button>
                `).join('')}
            </div>
        </div>
        
        <!-- Actions -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <button id="resetEnvelopeBtn" class="px-3 py-1 text-xs bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-slate-500">
                    Reset
                </button>
                <button id="saveEnvelopePresetBtn" class="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600">
                    Save as Preset
                </button>
            </div>
            <div class="flex items-center gap-2">
                <button id="applyEnvelopeBtn" class="px-4 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                    Apply Envelope
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Wire up event handlers
    container.querySelector('#envelopeClipSelect')?.addEventListener('change', (e) => {
        activeClipId = e.target.value || null;
        renderEnvelopeShaperContent();
    });
    
    container.querySelector('#envelopeMixSlider')?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        container.querySelector('#envelopeMixValue').textContent = `${val}%`;
    });
    
    container.querySelectorAll('.envelope-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = envelopePresets[btn.dataset.preset];
            if (preset) {
                activeEnvelope = JSON.parse(JSON.stringify(preset.points));
                drawEnvelopeCanvas();
            }
        });
    });
    
    container.querySelector('#resetEnvelopeBtn')?.addEventListener('click', () => {
        activeEnvelope = [{ t: 0, v: 1 }, { t: 1, v: 1 }];
        drawEnvelopeCanvas();
    });
    
    container.querySelector('#saveEnvelopePresetBtn')?.addEventListener('click', () => {
        const name = prompt('Enter preset name:');
        if (name && saveEnvelopePreset(name, activeEnvelope)) {
            localAppServices.showNotification?.('Envelope preset saved', 1500);
            renderEnvelopeShaperContent();
        }
    });
    
    container.querySelector('#applyEnvelopeBtn')?.addEventListener('click', () => {
        if (!activeClipId) {
            localAppServices.showNotification?.('Please select a clip first', 1500);
            return;
        }
        applyEnvelopeToClip(activeClipId);
    });
    
    // Canvas drawing
    const canvas = container.querySelector('#envelopeCanvas');
    if (canvas) {
        drawEnvelopeCanvas();
        
        canvas.addEventListener('mousedown', handleCanvasMouseDown);
        canvas.addEventListener('mousemove', handleCanvasMouseMove);
        canvas.addEventListener('mouseup', handleCanvasMouseUp);
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            deleteNearestPoint(e);
        });
    }
}

function drawEnvelopeCanvas() {
    const canvas = document.getElementById('envelopeCanvas');
    if (!canvas || !activeEnvelope) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (height - 2 * padding) * i / 4;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
        const x = padding + (width - 2 * padding) * i / 8;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
    }
    
    // Sort points by time
    const points = [...activeEnvelope].sort((a, b) => a.t - b.t);
    
    // Draw envelope line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((pt, i) => {
        const x = padding + (width - 2 * padding) * pt.t;
        const y = height - padding - (height - 2 * padding) * pt.v;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Fill under curve
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    points.forEach((pt, i) => {
        const x = padding + (width - 2 * padding) * pt.t;
        const y = height - padding - (height - 2 * padding) * pt.v;
        ctx.lineTo(x, y);
    });
    ctx.lineTo(padding + (width - 2 * padding) * points[points.length - 1].t, height - padding);
    ctx.closePath();
    ctx.fill();
    
    // Draw points
    points.forEach((pt, i) => {
        const x = padding + (width - 2 * padding) * pt.t;
        const y = height - padding - (height - 2 * padding) * pt.v;
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = dragPointIndex === i ? '#ef4444' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Value label
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(pt.v * 100)}%`, x, y - 12);
    });
}

function getCanvasPoint(e) {
    const canvas = document.getElementById('envelopeCanvas');
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    
    const t = Math.max(0, Math.min(1, (x - padding) / (width - 2 * padding)));
    const v = Math.max(0, Math.min(1, (height - padding - y) / (height - 2 * padding)));
    
    return { t, v };
}

function handleCanvasMouseDown(e) {
    const pt = getCanvasPoint(e);
    if (!pt) return;
    
    // Check if clicking near existing point
    const threshold = 15;
    dragPointIndex = activeEnvelope.findIndex(p => 
        Math.abs(p.t - pt.t) < threshold / 560 && 
        Math.abs(p.v - pt.v) < threshold / 160
    );
    
    if (dragPointIndex >= 0) {
        isDraggingPoint = true;
        drawEnvelopeCanvas();
    } else {
        // Add new point
        activeEnvelope.push({ t: Math.round(pt.t * 100) / 100, v: Math.round(pt.v * 100) / 100 });
        dragPointIndex = activeEnvelope.length - 1;
        isDraggingPoint = true;
        drawEnvelopeCanvas();
    }
}

function handleCanvasMouseMove(e) {
    if (!isDraggingPoint || dragPointIndex < 0) return;
    
    const pt = getCanvasPoint(e);
    if (!pt) return;
    
    activeEnvelope[dragPointIndex] = {
        t: Math.round(pt.t * 100) / 100,
        v: Math.round(pt.v * 100) / 100
    };
    drawEnvelopeCanvas();
}

function handleCanvasMouseUp() {
    isDraggingPoint = false;
    dragPointIndex = -1;
}

function deleteNearestPoint(e) {
    const pt = getCanvasPoint(e);
    if (!pt || activeEnvelope.length <= 2) return;
    
    const threshold = 20;
    const idx = activeEnvelope.findIndex(p => 
        Math.abs(p.t - pt.t) < threshold / 560 && 
        Math.abs(p.v - pt.v) < threshold / 160
    );
    
    if (idx >= 0) {
        activeEnvelope.splice(idx, 1);
        drawEnvelopeCanvas();
    }
}

function applyEnvelopeToClip(clipId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const mixSlider = document.getElementById('envelopeMixSlider');
    const mix = mixSlider ? parseInt(mixSlider.value, 10) / 100 : 1;
    
    for (const track of tracks) {
        if (track.timelineClips) {
            const clip = track.timelineClips.find(c => c.id === clipId);
            if (clip) {
                clip.envelope = JSON.parse(JSON.stringify(activeEnvelope));
                clip.envelopeMix = mix;
                
                // Apply to audio nodes if playing
                if (track.applyClipEnvelope) {
                    track.applyClipEnvelope(clipId, activeEnvelope, mix);
                }
                
                localAppServices.showNotification?.(`Envelope applied to ${clip.name || 'clip'}`, 1500);
                return true;
            }
        }
    }
    return false;
}