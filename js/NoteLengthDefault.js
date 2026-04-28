// js/NoteLengthDefault.js - Default Sequencer Step Note Length
// Set default note length for sequencer steps (8th, 16th, 32nd, etc.)

let localAppServices = {};
let currentNoteLength = 0.25; // Default: 16th note

// Available note length options
const NOTE_LENGTH_OPTIONS = [
    { value: 0.0625, label: '1/32', description: 'Thirty-second note' },
    { value: 0.125, label: '1/16 T', description: 'Sixteenth triplet' },
    { value: 0.25, label: '1/16', description: 'Sixteenth note' },
    { value: 0.333, label: '1/8 T', description: 'Eighth triplet' },
    { value: 0.5, label: '1/8', description: 'Eighth note' },
    { value: 0.75, label: '1/8 .', description: 'Dotted eighth' },
    { value: 1, label: '1/4', description: 'Quarter note' },
    { value: 1.5, label: '1/4 .', description: 'Dotted quarter' },
    { value: 2, label: '1/2', description: 'Half note' }
];

/**
 * Initialize Note Length Default module
 * @param {Object} services - App services from main.js
 */
export function initNoteLengthDefault(services) {
    localAppServices = services || {};
    
    // Load saved note length from localStorage
    loadNoteLengthDefault();
    
    // Update button label
    updateButtonLabel();
    
    console.log(`[NoteLengthDefault] Initialized with default note length: ${currentNoteLength}`);
}

/**
 * Load note length default from localStorage
 */
function loadNoteLengthDefault() {
    try {
        const stored = localStorage.getItem('snaw_default_note_length');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.value !== undefined && NOTE_LENGTH_OPTIONS.some(opt => opt.value === parsed.value)) {
                currentNoteLength = parsed.value;
            }
        }
    } catch (e) {
        console.warn('[NoteLengthDefault] Failed to load note length:', e);
    }
}

/**
 * Save note length default to localStorage
 */
function saveNoteLengthDefault() {
    try {
        localStorage.setItem('snaw_default_note_length', JSON.stringify({
            value: currentNoteLength
        }));
    } catch (e) {
        console.warn('[NoteLengthDefault] Failed to save note length:', e);
    }
}

/**
 * Update button label to reflect current note length
 */
function updateButtonLabel() {
    const btn = document.getElementById('noteLengthBtn');
    if (btn) {
        const option = getNoteLengthOption(currentNoteLength);
        btn.textContent = `Note: ${option.label}`;
    }
}

/**
 * Get current default note length
 * @returns {number} Default note length in beats
 */
export function getDefaultNoteLength() {
    return currentNoteLength;
}

/**
 * Get note length option by value
 * @param {number} value - Note length value
 * @returns {Object} Note length option
 */
export function getNoteLengthOption(value) {
    return NOTE_LENGTH_OPTIONS.find(opt => opt.value === value) || NOTE_LENGTH_OPTIONS[2];
}

/**
 * Get all note length options
 * @returns {Array} Note length options
 */
export function getNoteLengthOptions() {
    return [...NOTE_LENGTH_OPTIONS];
}

/**
 * Set default note length
 * @param {number} value - Note length in beats
 */
export function setDefaultNoteLength(value) {
    const option = NOTE_LENGTH_OPTIONS.find(opt => opt.value === value);
    if (option) {
        currentNoteLength = value;
        saveNoteLengthDefault();
        updateButtonLabel();
        
        // Notify user
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Default Note: ${option.label}`, 1000);
        }
        
        console.log(`[NoteLengthDefault] Default note length set to: ${option.label} (${value} beats)`);
    } else {
        console.warn(`[NoteLengthDefault] Invalid note length value: ${value}`);
    }
}

/**
 * Get note length label
 * @returns {string} Label for current note length
 */
export function getDefaultNoteLengthLabel() {
    const option = getNoteLengthOption(currentNoteLength);
    return option.label;
}

/**
 * Toggle note length panel visibility
 */
export function toggleNoteLengthPanel() {
    const panel = document.getElementById('noteLengthPanel');
    if (panel) {
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }
}

/**
 * Open note length dropdown panel
 */
export function openNoteLengthPanel() {
    let panel = document.getElementById('noteLengthPanel');
    
    if (panel) {
        panel.classList.remove('hidden');
        return;
    }
    
    // Create panel
    panel = document.createElement('div');
    panel.id = 'noteLengthPanel';
    panel.className = 'absolute z-50 bg-gray-900 border border-gray-600 rounded shadow-lg p-2';
    panel.style.top = '40px';
    panel.style.right = '0';
    
    panel.innerHTML = `
        <div class="text-xs text-gray-400 mb-2 font-semibold">Default Note Length</div>
        <div class="flex flex-col gap-1">
            ${NOTE_LENGTH_OPTIONS.map(opt => `
                <button id="noteLenBtn_${opt.value}" 
                    class="px-3 py-1 text-xs rounded text-left ${opt.value === currentNoteLength ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}">
                    <span class="font-bold">${opt.label}</span>
                    <span class="text-gray-400 ml-1">${opt.description}</span>
                </button>
            `).join('')}
        </div>
    `;
    
    // Position relative to the container
    const container = document.getElementById('noteLengthContainer');
    if (container) {
        container.style.position = 'relative';
        container.appendChild(panel);
    }
    
    // Add click handlers
    NOTE_LENGTH_OPTIONS.forEach(opt => {
        const btn = document.getElementById(`noteLenBtn_${opt.value}`);
        if (btn) {
            btn.addEventListener('click', () => {
                setDefaultNoteLength(opt.value);
                toggleNoteLengthPanel();
            });
        }
    });
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function closePanel(e) {
            const panelEl = document.getElementById('noteLengthPanel');
            const containerEl = document.getElementById('noteLengthContainer');
            if (panelEl && containerEl && !containerEl.contains(e.target)) {
                panelEl.classList.add('hidden');
                document.removeEventListener('click', closePanel);
            }
        });
    }, 10);
}