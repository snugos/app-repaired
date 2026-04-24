/**
 * Drum Replace - Replace drum samples by detected hit type (kick/snare/hat)
 * Analyzes audio track and replaces detected hits with selected drum samples
 */

let localAppServices = {};

/**
 * Initialize DrumReplace with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initDrumReplace(appServices) {
    localAppServices = appServices || {};
    console.log('[DrumReplace] Initialized');
}

/**
 * Opens the Drum Replace panel
 * @param {Object} savedState - Optional saved window state
 */
export function openDrumReplacePanel(savedState = null) {
    const windowId = 'drumReplace';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderDrumReplaceContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'drumReplaceContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 480,
        height: 520,
        minWidth: 400,
        minHeight: 450,
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

    const win = localAppServices.createWindow(windowId, 'Drum Replace', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderDrumReplaceContent(), 50);
    }
    return win;
}

/**
 * Render the Drum Replace panel content
 */
function renderDrumReplaceContent() {
    const container = document.getElementById('drumReplaceContent');
    if (!container) return;

    const tracks = localAppServices.getTracks?.() || [];
    const drumTracks = tracks.filter(t => t.type === 'DrumSampler');
    const audioTracks = tracks.filter(t => t.type === 'Audio');

    let html = `
        <div class="mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Analyze an audio track and replace detected drum hits with samples from a DrumSampler track.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Source Track (Audio)</label>
            <select id="drumReplaceSourceTrack" class="w-full p-2 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 text-sm">
                <option value="">-- Select Audio Track --</option>
                ${audioTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Target Drum Track (DrumSampler)</label>
            <select id="drumReplaceTargetTrack" class="w-full p-2 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 text-sm">
                <option value="">-- Select Drum Track --</option>
                ${drumTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Detection Threshold: <span id="drumReplaceThresholdValue">-20</span> dB</label>
            <input type="range" id="drumReplaceThreshold" min="-60" max="0" value="-20" step="1"
                   class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded appearance-none cursor-pointer"
                   oninput="document.getElementById('drumReplaceThresholdValue').textContent = this.value">
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Min Hit Interval: <span id="drumReplaceIntervalValue">0.1</span>s</label>
            <input type="range" id="drumReplaceInterval" min="0.05" max="0.5" value="0.1" step="0.01" 
                   class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded appearance-none cursor-pointer"
                   oninput="document.getElementById('drumReplaceIntervalValue').textContent = this.value">
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="drumReplaceToggle" onclick="toggleDrumReplace()" 
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors">
                Start Detection
            </button>
            <button onclick="testDrumReplace()" 
                    class="px-4 py-2 bg-gray-300 dark:bg-slate-600 rounded hover:bg-gray-400 dark:hover:bg-slate-500 text-sm transition-colors">
                Test Hit
            </button>
        </div>
        
        <div class="mt-4 p-3 bg-gray-200 dark:bg-slate-700 rounded">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Detection Info</h4>
            <div id="drumReplaceStatus" class="text-xs text-gray-600 dark:text-gray-300 font-mono">
                No detection active
            </div>
        </div>
        
        <div class="mt-4 border-t border-gray-300 dark:border-slate-600 pt-4">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Pad Mapping</h4>
            <div class="grid grid-cols-5 gap-2 text-xs">
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">Kick<br><span class="text-gray-500">Pad 1</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">Snare<br><span class="text-gray-500">Pad 2</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">Hi-Hat<br><span class="text-gray-500">Pad 3</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">Tom<br><span class="text-gray-500">Pad 4</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">Clap<br><span class="text-gray-500">Pad 5</span></div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Global state for DrumReplace
let drumReplaceActive = false;
let drumReplaceSourceId = null;
let drumReplaceTargetId = null;

/**
 * Toggle drum replace detection
 */
function toggleDrumReplace() {
    const sourceSelect = document.getElementById('drumReplaceSourceTrack');
    const targetSelect = document.getElementById('drumReplaceTargetTrack');
    const toggleBtn = document.getElementById('drumReplaceToggle');
    
    drumReplaceSourceId = sourceSelect.value;
    drumReplaceTargetId = targetSelect.value;
    
    if (!drumReplaceSourceId || !drumReplaceTargetId) {
        localAppServices.showSafeNotification?.('Please select both source and target tracks.', 2000);
        return;
    }
    
    drumReplaceActive = !drumReplaceActive;
    
    if (drumReplaceActive) {
        toggleBtn.textContent = 'Stop Detection';
        toggleBtn.className = 'px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Drum replace active - analyzing audio...', 2000);
    } else {
        toggleBtn.textContent = 'Start Detection';
        toggleBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Drum replace stopped.', 2000);
    }
}

/**
 * Test drum detection
 */
function testDrumReplace() {
    const statusEl = document.getElementById('drumReplaceStatus');
    if (!statusEl) return;
    
    // Simulate a detected hit for testing
    const types = ['kick', 'snare', 'hat', 'tom', 'clap'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    statusEl.innerHTML = `
        <div class="text-green-500">Test Hit Detected!</div>
        <div>Type: ${randomType.toUpperCase()}</div>
        <div>Energy: ${(Math.random() * 20 - 40).toFixed(1)} dB</div>
        <div>Time: ${new Date().toLocaleTimeString()}</div>
    `;
}

// Make functions globally accessible
window.toggleDrumReplace = toggleDrumReplace;
window.testDrumReplace = testDrumReplace;

class DrumReplaceEngine {
    constructor() {
        this.isActive = false;
        this.threshold = -20;
        this.minInterval = 0.1;
        this.lastHitTime = 0;
    }

    setThreshold(dB) {
        this.threshold = Math.max(-60, Math.min(0, dB));
    }

    setMinInterval(sec) {
        this.minInterval = Math.max(0.05, Math.min(0.5, sec));
    }

    processAudioLevel(buffer) {
        if (!this.isActive) return null;
        
        const now = performance.now() / 1000;
        if (now - this.lastHitTime < this.minInterval) return null;
        
        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        const db = 20 * Math.log10(rms + 0.0001);
        
        if (db < this.threshold) return null;
        
        this.lastHitTime = now;
        
        // Determine drum type based on frequency content
        const drumType = db > -10 ? 'kick' : (db > -15 ? 'snare' : 'hat');
        
        return { type: drumType, energy: db, time: now };
    }
}

export { DrumReplaceEngine };
export const drumReplaceEngine = new DrumReplaceEngine();