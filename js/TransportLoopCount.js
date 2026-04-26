// js/TransportLoopCount.js - Transport Loop Count feature
// Set the number of loop repetitions before stopping playback

let localAppServices = {};
let loopCount = 1;
let currentLoopIteration = 0;
let isLoopCountEnabled = false;

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
        if (localAppServices.stopTransport) {
            localAppServices.stopTransport();
        }
        currentLoopIteration = 0;
        return true; // Indicates playback should stop
    }
    return false;
}

export function resetLoopIteration() {
    currentLoopIteration = 0;
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

console.log('[TransportLoopCount] Module loaded');