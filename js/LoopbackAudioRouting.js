// js/LoopbackAudioRouting.js - Route audio output back to input for sampling external sources
// Enables capturing the DAW's output back into an audio track for sampling

let localAppServices = {};
let isLoopbackActive = false;
let mediaStreamDest = null;
let mediaStreamSource = null;
let loopbackGain = null;
let originalTracksState = [];

export function initLoopbackAudioRouting(appServices) {
    localAppServices = appServices || {};
    console.log('[LoopbackAudioRouting] Initialized');
}

/**
 * Check if browser supports loopback routing
 */
export function isLoopbackSupported() {
    return typeof Tone !== 'undefined' && 
           Tone.getContext && 
           Tone.getContext().rawContext &&
           typeof MediaStreamAudioDestinationNode !== 'undefined';
}

/**
 * Check if loopback is currently active
 */
export function isLoopbackActive() {
    return isLoopbackActive;
}

/**
 * Start loopback audio routing - route DAW output to input for sampling
 */
export async function startLoopbackRouting() {
    if (isLoopbackActive) {
        console.log('[LoopbackAudioRouting] Already active');
        return true;
    }

    try {
        const ctx = Tone.getContext().rawContext;
        if (!ctx) {
            console.error('[LoopbackAudioRouting] Cannot access raw audio context');
            return false;
        }

        // Create a MediaStreamDestination to capture audio
        mediaStreamDest = ctx.createMediaStreamDestination();
        
        // Create gain node for loopback volume control
        loopbackGain = ctx.createGain();
        loopbackGain.gain.value = 1.0;
        
        // Connect Tone.js destination to our loopback chain
        // Tone.master is the final output before speakers
        const toneMaster = Tone.getDestination();
        toneMaster.connect(loopbackGain);
        loopbackGain.connect(mediaStreamDest);
        
        isLoopbackActive = true;
        console.log('[LoopbackAudioRouting] Loopback routing started');
        
        if (localAppServices.showSafeNotification) {
            localAppServices.showSafeNotification('Loopback routing started - capture audio from DAW output', 2000);
        }
        
        return true;
    } catch (e) {
        console.error('[LoopbackAudioRouting] Failed to start loopback:', e);
        return false;
    }
}

/**
 * Stop loopback audio routing
 */
export function stopLoopbackRouting() {
    if (!isLoopbackActive) return;
    
    try {
        // Disconnect the loopback chain
        if (loopbackGain) {
            const toneMaster = Tone.getDestination();
            try {
                toneMaster.disconnect(loopbackGain);
            } catch (e) {
                console.warn('[LoopbackAudioRouting] Could not disconnect from master:', e);
            }
            loopbackGain.disconnect();
            loopbackGain = null;
        }
        
        if (mediaStreamDest) {
            mediaStreamDest = null;
        }
        
        isLoopbackActive = false;
        console.log('[LoopbackAudioRouting] Loopback routing stopped');
        
        if (localAppServices.showSafeNotification) {
            localAppServices.showSafeNotification('Loopback routing stopped', 2000);
        }
    } catch (e) {
        console.error('[LoopbackAudioRouting] Error stopping loopback:', e);
    }
}

/**
 * Set loopback gain/volume
 */
export function setLoopbackGain(value) {
    if (loopbackGain) {
        loopbackGain.gain.value = Math.max(0, Math.min(2, value));
    }
}

/**
 * Get the current media stream for connecting to an audio track
 */
export function getLoopbackStream() {
    if (!isLoopbackActive || !mediaStreamDest) return null;
    return mediaStreamDest.stream;
}

/**
 * Opens the Loopback Audio Routing control panel
 */
export function openLoopbackRoutingPanel(savedState = null) {
    const windowId = 'loopbackRouting';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderLoopbackRoutingContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'loopbackRoutingContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900 overflow-y-auto';
    
    const options = { 
        width: 400, 
        height: 280, 
        minWidth: 350, 
        minHeight: 220, 
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

    const win = localAppServices.createWindow(windowId, 'Loopback Audio Routing', contentContainer, options);
    if (win?.element) {
        renderLoopbackRoutingContent();
    }
    return win;
}

function renderLoopbackRoutingContent() {
    const container = document.getElementById('loopbackRoutingContent');
    if (!container) return;
    
    const statusClass = isLoopbackActive ? 'text-green-400' : 'text-gray-500';
    const statusText = isLoopbackActive ? 'Active' : 'Inactive';
    const buttonText = isLoopbackActive ? 'Stop Loopback' : 'Start Loopback';
    const buttonClass = isLoopbackActive 
        ? 'bg-red-600 hover:bg-red-700' 
        : 'bg-blue-600 hover:bg-blue-700';
    
    container.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="text-sm text-gray-400">
                Route DAW audio output back to input for sampling external sources.
                Active when you see the DAW output appearing in an audio input.
            </div>
            
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div class="flex items-center gap-3">
                    <div id="loopbackStatus" class="w-3 h-3 rounded-full ${statusClass}"></div>
                    <span class="text-sm font-medium text-white">Status: ${statusText}</span>
                </div>
                <button id="loopbackToggleBtn" class="px-4 py-2 ${buttonClass} text-white text-sm rounded font-medium transition">
                    ${buttonText}
                </button>
            </div>
            
            <div id="loopbackVolumeControl" class="flex flex-col gap-2 ${isLoopbackActive ? '' : 'opacity-50 pointer-events-none'}">
                <label class="text-sm text-gray-400">Loopback Volume</label>
                <div class="flex items-center gap-3">
                    <input type="range" id="loopbackVolume" min="0" max="200" value="100" 
                           class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                    <span id="loopbackVolumeValue" class="text-sm text-white w-12 text-right">100%</span>
                </div>
            </div>
            
            <div class="text-xs text-gray-500 mt-2">
                <strong>Tip:</strong> Create an Audio track and enable input monitoring to hear 
                the loopback audio through your DAW.
            </div>
        </div>
    `;
    
    // Attach event listeners
    const toggleBtn = container.querySelector('#loopbackToggleBtn');
    const volumeSlider = container.querySelector('#loopbackVolume');
    const volumeValue = container.querySelector('#loopbackVolumeValue');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            if (isLoopbackActive) {
                stopLoopbackRouting();
            } else {
                await startLoopbackRouting();
            }
            renderLoopbackRoutingContent();
        });
    }
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10) / 100;
            setLoopbackGain(value);
            if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
        });
    }
}