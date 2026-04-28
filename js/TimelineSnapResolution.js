// js/TimelineSnapResolution.js - Timeline Snap Resolution Toggle
// Quick buttons to switch snap between 1/4, 1/8, 1/16, 1/32

let localAppServices = {};
let currentResolution = 0.25; // Default 16th notes (quarter note = 1, 8th = 0.5, 16th = 0.25, 32nd = 0.125)

const RESOLUTIONS = [
    { value: 1, label: '1/4', description: 'Quarter notes' },
    { value: 0.5, label: '1/8', description: 'Eighth notes' },
    { value: 0.25, label: '1/16', description: 'Sixteenth notes' },
    { value: 0.125, label: '1/32', description: 'Thirty-second notes' }
];

/**
 * Initialize Timeline Snap Resolution module
 * @param {Object} services - App services from main.js
 */
export function initTimelineSnapResolution(services) {
    localAppServices = services || {};
    
    // Load saved resolution if available
    if (localAppServices.getGridDivision) {
        currentResolution = localAppServices.getGridDivision();
    }
    
    console.log(`[TimelineSnapResolution] Initialized with resolution: ${currentResolution}`);
}

/**
 * Get current snap resolution
 * @returns {number} Grid division in beats
 */
export function getSnapResolution() {
    return currentResolution;
}

/**
 * Set snap resolution
 * @param {number} resolution - Division in beats
 */
export function setSnapResolution(resolution) {
    currentResolution = Math.max(0.0625, Math.min(1, parseFloat(resolution) || 0.25));
    
    if (localAppServices.setGridDivisionState) {
        localAppServices.setGridDivisionState(currentResolution);
    }
    
    // Update all button states
    updateAllButtons();
    
    // Show notification
    const res = RESOLUTIONS.find(r => r.value === currentResolution) || { label: currentResolution.toString() };
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Snap: ${res.label}`, 1000);
    }
    
    console.log(`[TimelineSnapResolution] Resolution set to: ${currentResolution}`);
}

/**
 * Update all snap resolution buttons to reflect current state
 */
function updateAllButtons() {
    RESOLUTIONS.forEach(res => {
        const btn = document.getElementById(`snapResBtn_${res.value}`);
        if (btn) {
            if (res.value === currentResolution) {
                btn.classList.add('bg-blue-600');
                btn.classList.remove('bg-gray-700');
            } else {
                btn.classList.remove('bg-blue-600');
                btn.classList.add('bg-gray-700');
            }
        }
    });
}

/**
 * Toggle snap resolution panel
 */
export function toggleSnapResolutionPanel() {
    const panel = document.getElementById('snapResolutionPanel');
    if (panel) {
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }
}

/**
 * Open snap resolution dropdown panel
 */
export function openSnapResolutionPanel() {
    let panel = document.getElementById('snapResolutionPanel');
    
    if (panel) {
        panel.classList.remove('hidden');
        return;
    }
    
    // Create panel
    panel = document.createElement('div');
    panel.id = 'snapResolutionPanel';
    panel.className = 'absolute z-50 bg-gray-900 border border-gray-600 rounded shadow-lg p-2';
    panel.style.top = '40px';
    panel.style.right = '0';
    
    panel.innerHTML = `
        <div class="text-xs text-gray-400 mb-2 font-semibold">Snap Resolution</div>
        <div class="flex flex-col gap-1">
            ${RESOLUTIONS.map(res => `
                <button id="snapResBtn_${res.value}" 
                    class="px-3 py-1 text-xs rounded text-left ${res.value === currentResolution ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}">
                    <span class="font-bold">${res.label}</span>
                    <span class="text-gray-400 ml-1">${res.description}</span>
                </button>
            `).join('')}
        </div>
    `;
    
    // Position relative to the snap button container
    const container = document.getElementById('snapResolutionContainer');
    if (container) {
        container.style.position = 'relative';
        container.appendChild(panel);
    }
    
    // Add click handlers
    RESOLUTIONS.forEach(res => {
        const btn = document.getElementById(`snapResBtn_${res.value}`);
        if (btn) {
            btn.addEventListener('click', () => {
                setSnapResolution(res.value);
                toggleSnapResolutionPanel();
            });
        }
    });
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function closePanel(e) {
            const panelEl = document.getElementById('snapResolutionPanel');
            const containerEl = document.getElementById('snapResolutionContainer');
            if (panelEl && containerEl && !containerEl.contains(e.target)) {
                panelEl.classList.add('hidden');
                document.removeEventListener('click', closePanel);
            }
        });
    }, 10);
}