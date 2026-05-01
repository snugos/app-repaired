// js/ArrangementSnapGrid.js - Customizable snap grid with visual subdivisions
// Feature: Customizable snap grid for arrangement timeline with visual beat/bar markers

let localAppServices = {};
let snapGridPanel = null;
let currentSnapValue = '1/4'; // Default to quarter note
let isSnapEnabled = true;
let snapLinesVisible = true;
let gridSubdivisions = 4; // Subdivisions per beat

const SNAP_VALUES = [
    { id: '1/1', name: '1 Bar', beats: 4 },
    { id: '1/2', name: '1/2', beats: 2 },
    { id: '1/4', name: '1/4', beats: 1 },
    { id: '1/8', name: '1/8', beats: 0.5 },
    { id: '1/16', name: '1/16', beats: 0.25 },
    { id: '1/32', name: '1/32', beats: 0.125 },
    { id: 'off', name: 'Off', beats: 0 }
];

const SUBDIVISION_OPTIONS = [
    { id: 1, name: '1 (Beat)' },
    { id: 2, name: '2' },
    { id: 4, name: '4' },
    { id: 8, name: '8' }
];

/**
 * Initialize the Arrangement Snap Grid module
 * @param {object} services - App services
 */
export function initArrangementSnapGrid(services) {
    localAppServices = services || {};
    console.log('[ArrangementSnapGrid] Initialized');
}

/**
 * Get current snap value
 * @returns {string} Current snap value ID
 */
export function getSnapValue() {
    return currentSnapValue;
}

/**
 * Set snap value
 * @param {string} snapId - Snap value ID
 */
export function setSnapValue(snapId) {
    const validSnaps = SNAP_VALUES.map(s => s.id);
    if (validSnaps.includes(snapId)) {
        currentSnapValue = snapId;
        updateSnapVisualization();
        localAppServices.showNotification?.(`Snap: ${getSnapName(snapId)}`, 1500);
    }
}

/**
 * Get snap name from ID
 * @param {string} snapId 
 * @returns {string}
 */
function getSnapName(snapId) {
    const snap = SNAP_VALUES.find(s => s.id === snapId);
    return snap ? snap.name : snapId;
}

/**
 * Check if snap is enabled
 * @returns {boolean}
 */
export function isSnapEnabledGlobal() {
    return isSnapEnabled;
}

/**
 * Toggle snap enabled state
 */
export function toggleSnapEnabled() {
    isSnapEnabled = !isSnapEnabled;
    updateSnapVisualization();
    localAppServices.showNotification?.(isSnapEnabled ? 'Snap: On' : 'Snap: Off', 1500);
}

/**
 * Get grid subdivisions per beat
 * @returns {number}
 */
export function getGridSubdivisions() {
    return gridSubdivisions;
}

/**
 * Set grid subdivisions
 * @param {number} subdivisions 
 */
export function setGridSubdivisions(subdivisions) {
    const valid = SUBDIVISION_OPTIONS.map(s => s.id);
    if (valid.includes(subdivisions)) {
        gridSubdivisions = subdivisions;
        updateSnapVisualization();
    }
}

/**
 * Snap a time value to the grid
 * @param {number} time - Time in seconds
 * @returns {number} Snapped time
 */
export function snapTimeToGrid(time) {
    if (!isSnapEnabled || currentSnapValue === 'off') {
        return time;
    }
    
    const snapObj = SNAP_VALUES.find(s => s.id === currentSnapValue);
    if (!snapObj || snapObj.beats === 0) {
        return time;
    }
    
    const bpm = localAppServices.getBPM?.() || 120;
    const secondsPerBeat = 60.0 / bpm;
    const snapIntervalSeconds = secondsPerBeat * snapObj.beats;
    
    const gridPosition = Math.round(time / snapIntervalSeconds);
    return gridPosition * snapIntervalSeconds;
}

/**
 * Update snap visualization on timeline
 */
function updateSnapVisualization() {
    const gridLines = document.querySelectorAll('.snap-grid-line');
    gridLines.forEach(line => {
        line.style.display = snapLinesVisible && isSnapEnabled ? 'block' : 'none';
    });
    
    // Update snap indicator in UI if exists
    const snapIndicator = document.getElementById('snapValueIndicator');
    if (snapIndicator) {
        snapIndicator.textContent = isSnapEnabled ? currentSnapValue : 'Off';
    }
}

/**
 * Toggle grid lines visibility
 */
export function toggleGridLines() {
    snapLinesVisible = !snapLinesVisible;
    updateSnapVisualization();
}

/**
 * Open the Snap Grid settings panel
 */
export function openSnapGridPanel() {
    const existingPanel = document.getElementById('snapGridPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'snapGridPanel';
    panel.className = 'fixed bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg shadow-2xl z-[9999]';
    panel.style.cssText = 'width:320px;left:50%;top:50%;transform:translate(-50%,-50%);';

    const snapButtonsHtml = SNAP_VALUES.map(snap => `
        <button class="snap-value-btn flex-1 px-3 py-2 text-xs rounded border transition-colors ${snap.id === currentSnapValue ? 'bg-[#ff7700] text-white border-[#ff7700]' : 'bg-[#282828] text-[#888] border-[#3a3a3a] hover:border-[#555]'}" data-snap="${snap.id}">
            ${snap.name}
        </button>
    `).join('');

    const subdivisionButtonsHtml = SUBDIVISION_OPTIONS.map(sub => `
        <button class="subdivision-btn px-3 py-1 text-xs rounded border transition-colors ${sub.id === gridSubdivisions ? 'bg-[#4a9eff] text-white border-[#4a9eff]' : 'bg-[#282828] text-[#888] border-[#3a3a3a] hover:border-[#555]'}" data-sub="${sub.id}">
            ${sub.name}
        </button>
    `).join('');

    panel.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] rounded-t-lg border-b border-[#3a3a3a] cursor-move" data-drag-handle>
            <span class="text-sm font-semibold text-[#e0e0e0]">📐 Arrangement Snap Grid</span>
            <button id="snapGridClose" class="w-5 h-5 flex items-center justify-center text-[#888] hover:text-[#fff] text-lg">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
            <!-- Snap Enable Toggle -->
            <div class="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                <span class="text-sm text-[#ccc]">Enable Snap</span>
                <button id="snapToggleBtn" class="w-12 h-6 rounded-full transition-colors ${isSnapEnabled ? 'bg-[#ff7700]' : 'bg-[#444]'} relative">
                    <span class="absolute top-1 ${isSnapEnabled ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all"></span>
                </button>
            </div>
            
            <!-- Snap Value Selection -->
            <div>
                <div class="text-xs text-[#888] mb-2">Snap Resolution</div>
                <div class="flex gap-2 flex-wrap">
                    ${snapButtonsHtml}
                </div>
            </div>
            
            <!-- Subdivision Selection -->
            <div>
                <div class="text-xs text-[#888] mb-2">Grid Subdivisions (per beat)</div>
                <div class="flex gap-2">
                    ${subdivisionButtonsHtml}
                </div>
            </div>
            
            <!-- Grid Lines Toggle -->
            <div class="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                <span class="text-sm text-[#ccc]">Show Grid Lines</span>
                <button id="gridLinesToggle" class="w-12 h-6 rounded-full transition-colors ${snapLinesVisible ? 'bg-[#4a9eff]' : 'bg-[#444]'} relative">
                    <span class="absolute top-1 ${snapLinesVisible ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all"></span>
                </button>
            </div>
            
            <!-- Current Snap Display -->
            <div class="text-center p-3 bg-[#1a1a1a] rounded">
                <div class="text-xs text-[#888]">Current Snap</div>
                <div id="currentSnapDisplay" class="text-xl font-bold text-[#ff7700]">${currentSnapValue}</div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    snapGridPanel = panel;

    // Close button
    document.getElementById('snapGridClose').addEventListener('click', () => {
        panel.remove();
    });

    // Snap toggle
    document.getElementById('snapToggleBtn').addEventListener('click', () => {
        toggleSnapEnabled();
        updatePanelUI();
    });

    // Grid lines toggle
    document.getElementById('gridLinesToggle').addEventListener('click', () => {
        toggleGridLines();
        updatePanelUI();
    });

    // Snap value buttons
    document.querySelectorAll('.snap-value-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setSnapValue(btn.dataset.snap);
            updatePanelUI();
        });
    });

    // Subdivision buttons
    document.querySelectorAll('.subdivision-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setGridSubdivisions(parseInt(btn.dataset.sub));
            updatePanelUI();
        });
    });

    // Make panel draggable
    makeDraggable(panel);
}

/**
 * Update panel UI to reflect current state
 */
function updatePanelUI() {
    // Update snap toggle
    const snapToggleBtn = document.getElementById('snapToggleBtn');
    if (snapToggleBtn) {
        snapToggleBtn.className = `w-12 h-6 rounded-full transition-colors ${isSnapEnabled ? 'bg-[#ff7700]' : 'bg-[#444]'} relative`;
        snapToggleBtn.querySelector('span').className = `absolute top-1 ${isSnapEnabled ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all`;
    }

    // Update grid lines toggle
    const gridLinesToggle = document.getElementById('gridLinesToggle');
    if (gridLinesToggle) {
        gridLinesToggle.className = `w-12 h-6 rounded-full transition-colors ${snapLinesVisible ? 'bg-[#4a9eff]' : 'bg-[#444]'} relative`;
        gridLinesToggle.querySelector('span').className = `absolute top-1 ${snapLinesVisible ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all`;
    }

    // Update snap value buttons
    document.querySelectorAll('.snap-value-btn').forEach(btn => {
        if (btn.dataset.snap === currentSnapValue) {
            btn.className = 'snap-value-btn flex-1 px-3 py-2 text-xs rounded border transition-colors bg-[#ff7700] text-white border-[#ff7700]';
        } else {
            btn.className = 'snap-value-btn flex-1 px-3 py-2 text-xs rounded border transition-colors bg-[#282828] text-[#888] border-[#3a3a3a] hover:border-[#555]';
        }
    });

    // Update subdivision buttons
    document.querySelectorAll('.subdivision-btn').forEach(btn => {
        if (parseInt(btn.dataset.sub) === gridSubdivisions) {
            btn.className = 'subdivision-btn px-3 py-1 text-xs rounded border transition-colors bg-[#4a9eff] text-white border-[#4a9eff]';
        } else {
            btn.className = 'subdivision-btn px-3 py-1 text-xs rounded border transition-colors bg-[#282828] text-[#888] border-[#3a3a3a] hover:border-[#555]';
        }
    });

    // Update current snap display
    const currentSnapDisplay = document.getElementById('currentSnapDisplay');
    if (currentSnapDisplay) {
        currentSnapDisplay.textContent = isSnapEnabled ? currentSnapValue : 'Off';
    }
}

/**
 * Make element draggable
 * @param {HTMLElement} element 
 */
function makeDraggable(element) {
    const dragHandle = element.querySelector('[data-drag-handle]');
    if (!dragHandle) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = `${startLeft + dx}px`;
        element.style.top = `${startTop + dy}px`;
        element.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

/**
 * Get snap info for external use
 * @returns {object}
 */
export function getSnapInfo() {
    return {
        snapValue: currentSnapValue,
        snapEnabled: isSnapEnabled,
        gridLinesVisible: snapLinesVisible,
        subdivisions: gridSubdivisions
    };
}