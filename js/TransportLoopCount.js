// js/TransportLoopCount.js - Transport Loop Count feature
// Set the number of loop repetitions before stopping playback

let localAppServices = {};
let loopCount = 1;
let currentLoopIteration = 0;
let isLoopCountEnabled = false;

// State function references for checkTransportLoopCount
let getLoopRegionEnabledState = null;
let getLoopRegionStartState = null;
let getLoopRegionEndState = null;
let lastLoopCheckTime = 0;

export function initTransportLoopCount(services) {
    localAppServices = services;
    console.log('[TransportLoopCount] Initialized');
}

export function getLoopCount() {
    return loopCount;
}

export function setLoopCount(count) {
    loopCount = Math.max(1, Math.min(99, parseInt(count) || 1));
    console.log(`[TransportLoopCount] Loop count set to: ${loopCount}`);
}

export function getCurrentLoopIteration() {
    return currentLoopIteration;
}

export function setCurrentLoopIteration(iter) {
    currentLoopIteration = Math.max(0, parseInt(iter) || 0);
}

export function isLoopCountFeatureEnabled() {
    return isLoopCountEnabled;
}

export function setLoopCountFeatureEnabled(enabled) {
    isLoopCountEnabled = !!enabled;
    if (!enabled) {
        currentLoopIteration = 0;
    }
    console.log(`[TransportLoopCount] Loop count feature ${isLoopCountEnabled ? 'enabled' : 'disabled'}`);
}

export function incrementLoopIteration() {
    currentLoopIteration++;
    console.log(`[TransportLoopCount] Loop iteration: ${currentLoopIteration}/${loopCount}`);
    
    if (localAppServices.updateLoopCountDisplay) {
        localAppServices.updateLoopCountDisplay(currentLoopIteration, loopCount);
    }
    
    if (currentLoopIteration >= loopCount) {
        console.log(`[TransportLoopCount] Loop count reached, stopping playback`);
        if (localAppServices.panicStopAllAudio) {
            localAppServices.panicStopAllAudio();
        }
        currentLoopIteration = 0;
        return true; // Indicates playback should stop
    }
    return false;
}

export function resetLoopIteration() {
    currentLoopIteration = 0;
    lastLoopCheckTime = 0;
    if (localAppServices.updateLoopCountDisplay) {
        localAppServices.updateLoopCountDisplay(currentLoopIteration, loopCount);
    }
}

export function openTransportLoopCountPanel() {
    const windowId = 'transportLoopCount';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'transportLoopCountContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';
    
    const options = {
        width: 350,
        height: 280,
        minWidth: 300,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: false
    };
    
    const win = localAppServices.createWindow(windowId, 'Transport Loop Count', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderTransportLoopCountContent(), 50);
    }
    
    return win;
}

function renderTransportLoopCountContent() {
    const container = document.getElementById('transportLoopCountContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="mb-4 text-sm text-gray-400">
            Set how many times the loop region repeats before stopping playback.
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-3 cursor-pointer mb-4">
                <input type="checkbox" id="loopCountEnabled" ${isLoopCountEnabled ? 'checked' : ''} class="w-5 h-5 accent-blue-500">
                <span class="text-white font-medium">Enable Loop Count</span>
            </label>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm text-gray-400 mb-2">Number of Loops</label>
            <div class="flex items-center gap-3">
                <input type="number" id="loopCountInput" value="${loopCount}" min="1" max="99" 
                    class="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-center text-lg">
                <span class="text-gray-500 text-sm">loops (1-99)</span>
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Current Loop:</span>
                <span id="loopIterationDisplay" class="text-xl font-bold text-blue-400">${currentLoopIteration} / ${loopCount}</span>
            </div>
            <div class="w-full h-2 bg-gray-700 rounded overflow-hidden">
                <div id="loopProgressBar" class="h-full bg-blue-500 transition-all duration-200" style="width: ${(currentLoopIteration / loopCount) * 100}%"></div>
            </div>
        </div>
        
        <div class="flex items-center justify-between">
            <button id="resetLoopBtn" class="px-4 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600">
                Reset Counter
            </button>
            <button id="applyLoopBtn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                Apply
            </button>
        </div>
    `;
    
    // Event listeners
    const enabledCheckbox = container.querySelector('#loopCountEnabled');
    enabledCheckbox?.addEventListener('change', (e) => {
        setLoopCountFeatureEnabled(e.target.checked);
    });
    
    const applyBtn = container.querySelector('#applyLoopBtn');
    applyBtn?.addEventListener('click', () => {
        const input = container.querySelector('#loopCountInput');
        if (input) {
            setLoopCount(parseInt(input.value) || 1);
            localAppServices.showNotification?.(`Loop count set to ${loopCount}`, 1500);
        }
    });
    
    const resetBtn = container.querySelector('#resetLoopBtn');
    resetBtn?.addEventListener('click', () => {
        resetLoopIteration();
        container.querySelector('#loopIterationDisplay').textContent = `0 / ${loopCount}`;
        container.querySelector('#loopProgressBar').style.width = '0%';
        localAppServices.showNotification?.('Loop counter reset', 1500);
    });
}

export function updateLoopCountDisplay(iter, total) {
    const container = document.getElementById('transportLoopCountContent');
    if (!container) return;
    
    const display = container.querySelector('#loopIterationDisplay');
    const progress = container.querySelector('#loopProgressBar');
    
    if (display) display.textContent = `${iter} / ${total}`;
    if (progress) progress.style.width = `${(iter / total) * 100}%`;
}

/**
 * Check and handle transport loop count. Called from the UI update loop.
 * Detects when the transport position wraps around at the loop start and increments
 * the loop iteration counter. When loop count is reached, stops playback.
 */
export function checkTransportLoopCount() {
    // Only process if feature is enabled
    if (!isLoopCountEnabled) return false;
    
    // Check if transport is running
    if (typeof Tone === 'undefined' || !Tone.Transport) return false;
    if (Tone.Transport.state !== 'started') return false;
    
    // Check if loop region is enabled
    const loopRegionEnabled = typeof getLoopRegionEnabledState === 'function' ? getLoopRegionEnabledState() : false;
    if (!loopRegionEnabled) return false;
    
    const loopStart = typeof getLoopRegionStartState === 'function' ? getLoopRegionStartState() : 0;
    const currentPosition = Tone.Transport.seconds;
    
    // Initialize on first call
    if (lastLoopCheckTime === 0) {
        lastLoopCheckTime = currentPosition;
        return false;
    }
    
    // Detect wraparound: current position is near loop start while last position was past it
    // This indicates a loop restart
    const loopLength = typeof getLoopRegionEndState === 'function' ? getLoopRegionEndState() : 16;
    const positionAfterLoopStart = currentPosition >= loopStart;
    const wasBeforeLoopStart = lastLoopCheckTime < loopStart;
    const wrappedAround = positionAfterLoopStart && wasBeforeLoopStart && (currentPosition - loopStart) < 0.5;
    
    // Also detect if we reached the end of the loop region
    const nearLoopEnd = currentPosition >= loopLength - 0.01;
    const wasNearStart = lastLoopCheckTime < loopLength - 0.1;
    const reachedLoopEnd = nearLoopEnd && wasNearStart;
    
    lastLoopCheckTime = currentPosition;
    
    if (wrappedAround || reachedLoopEnd) {
        const shouldStop = incrementLoopIteration();
        if (shouldStop && localAppServices.panicStopAllAudio) {
            localAppServices.panicStopAllAudio();
        }
        return shouldStop;
    }
    
    return false;
}

export function initLoopCountStateReferences(getEnabledFn, getStartFn, getEndFn) {
    getLoopRegionEnabledState = getEnabledFn;
    getLoopRegionStartState = getStartFn;
    getLoopRegionEndState = getEndFn;
    console.log('[TransportLoopCount] State function references initialized');
}

export function createLoopCountButton() {
    const btn = document.createElement('button');
    btn.id = 'transportLoopCountBtn';
    btn.className = 'px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors';
    btn.textContent = 'Loop Count';
    btn.title = 'Transport Loop Count - Set how many times the loop repeats';
    btn.addEventListener('click', () => {
        openTransportLoopCountPanel();
    });
    return btn;
}

console.log('[TransportLoopCount] Module loaded');