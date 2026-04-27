// js/SendEffectRack.js - UI for managing send/return effect buses (reverb, delay)

let localAppServices = {};
let sendEffectRackWindow = null;

/**
 * Initialize the Send Effect Rack
 * @param {object} services - App services
 */
export function initSendEffectRack(services) {
    localAppServices = services;
    console.log('[SendEffectRack] Initialized');
}

/**
 * Open the Send Effect Rack panel
 */
export function openSendEffectRackPanel() {
    const windowId = 'sendEffectRack';
    
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(windowId)) {
            const win = openWindows.get(windowId);
            win.restore();
            updateSendEffectRackUI();
            return win;
        }
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'sendEffectRackContent';
    contentContainer.className = 'p-4 bg-gray-900 text-white h-full flex flex-col';
    
    const options = {
        width: 600,
        height: 500,
        minWidth: 400,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow?.(windowId, 'Send Effect Rack', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderSendEffectRackContent(), 50);
    }
    
    return win;
}

/**
 * Render the send effect rack content
 */
function renderSendEffectRackContent() {
    const container = document.getElementById('sendEffectRackContent');
    if (!container) return;
    
    const html = `
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-600">
            <p class="text-sm text-gray-300">
                <span class="text-yellow-400 font-semibold">Tip:</span> 
                Sends route audio to reverb and delay effects. 
                Adjust send levels on tracks to control how much signal goes to each effect.
            </p>
        </div>
        
        <div id="sendsList" class="flex-1 space-y-4 overflow-y-auto">
            <!-- Send buses will be listed here -->
        </div>
        
        <div class="mt-4 pt-4 border-t border-gray-700">
            <div class="flex gap-2">
                <button id="addReverbSendBtn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium">
                    + Add Reverb Bus
                </button>
                <button id="addDelaySendBtn" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-white font-medium">
                    + Add Delay Bus
                </button>
                <button id="refreshSendsBtn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white">
                    Refresh
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Event listeners
    container.querySelector('#addReverbSendBtn')?.addEventListener('click', () => addSendBus('reverb'));
    container.querySelector('#addDelaySendBtn')?.addEventListener('click', () => addSendBus('delay'));
    container.querySelector('#refreshSendsBtn')?.addEventListener('click', updateSendEffectRackUI);
    
    updateSendEffectRackUI();
}

/**
 * Update the send effect rack UI with current buses
 */
function updateSendEffectRackUI() {
    const sendsList = document.getElementById('sendsList');
    if (!sendsList) return;
    
    // Get send buses from app services
    const sendBuses = localAppServices.getSendBuses?.() || getDefaultSendBuses();
    
    if (sendBuses.length === 0) {
        sendsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>No send buses configured.</p>
                <p class="text-sm mt-2">Click "Add Reverb Bus" or "Add Delay Bus" to create one.</p>
            </div>
        `;
        return;
    }
    
    sendsList.innerHTML = sendBuses.map(bus => renderSendBusCard(bus)).join('');
    
    // Add event listeners to all bus controls
    sendBuses.forEach(bus => {
        const deleteBtn = document.getElementById(`deleteSend_${bus.id}`);
        deleteBtn?.addEventListener('click', () => deleteSendBus(bus.id));
        
        const bypassBtn = document.getElementById(`bypassSend_${bus.id}`);
        bypassBtn?.addEventListener('click', () => toggleSendBusBypass(bus.id));
        
        // Parameter controls
        Object.keys(bus.params || {}).forEach(param => {
            const input = document.getElementById(`sendParam_${bus.id}_${param}`);
            input?.addEventListener('input', (e) => {
                updateSendBusParam(bus.id, param, parseFloat(e.target.value));
            });
        });
    });
}

/**
 * Render a single send bus card
 */
function renderSendBusCard(bus) {
    const isReverb = bus.type === 'reverb';
    const colorClass = isReverb ? 'border-purple-500' : 'border-cyan-500';
    const bgClass = isReverb ? 'bg-purple-900/30' : 'bg-cyan-900/30';
    const headerClass = isReverb ? 'bg-purple-800' : 'bg-cyan-800';
    
    let paramsHtml = '';
    if (bus.params) {
        paramsHtml = Object.entries(bus.params).map(([key, val]) => `
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-400 w-20 capitalize">${key}:</label>
                <input type="range" id="sendParam_${bus.id}_${key}" 
                    min="0" max="1" step="0.01" value="${val}"
                    class="flex-1 h-1 accent-${isReverb ? 'purple' : 'cyan'}-400 cursor-pointer">
                <span class="text-xs text-gray-400 w-8">${(val * 100).toFixed(0)}%</span>
            </div>
        `).join('');
    }
    
    return `
        <div class="border ${colorClass} rounded-lg overflow-hidden ${bgClass}">
            <div class="${headerClass} px-3 py-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="font-semibold">${bus.name || bus.type}</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-black/30">${bus.type}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button id="bypassSend_${bus.id}" 
                        class="px-2 py-1 text-xs rounded ${bus.bypass ? 'bg-gray-600' : 'bg-green-600'} hover:opacity-80">
                        ${bus.bypass ? 'Bypassed' : 'Active'}
                    </button>
                    <button id="deleteSend_${bus.id}" 
                        class="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700">
                        Delete
                    </button>
                </div>
            </div>
            <div class="p-3 space-y-2">
                ${paramsHtml}
            </div>
        </div>
    `;
}

/**
 * Get default send buses (built-in reverb and delay)
 */
function getDefaultSendBuses() {
    return [
        {
            id: 'reverb1',
            name: 'Hall Reverb',
            type: 'reverb',
            bypass: false,
            params: {
                mix: 0.3,
                decay: 2.5,
                preDelay: 0.02
            }
        },
        {
            id: 'delay1',
            name: 'Echo Delay',
            type: 'delay',
            bypass: false,
            params: {
                mix: 0.25,
                time: 0.375,
                feedback: 0.4
            }
        }
    ];
}

/**
 * Add a new send bus
 */
function addSendBus(type) {
    const buses = localAppServices.getSendBuses?.() || getDefaultSendBuses();
    
    const newBus = {
        id: `${type}${Date.now()}`,
        name: type === 'reverb' ? 'New Reverb' : 'New Delay',
        type: type,
        bypass: false,
        params: type === 'reverb' 
            ? { mix: 0.3, decay: 2.0, preDelay: 0.01 }
            : { mix: 0.25, time: 0.25, feedback: 0.3 }
    };
    
    buses.push(newBus);
    
    if (localAppServices.setSendBuses) {
        localAppServices.setSendBuses(buses);
    }
    
    updateSendEffectRackUI();
    
    // Notify user
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Added ${type} send bus`, 2000);
    }
}

/**
 * Delete a send bus
 */
function deleteSendBus(busId) {
    let buses = localAppServices.getSendBuses?.() || getDefaultSendBuses();
    buses = buses.filter(b => b.id !== busId);
    
    if (localAppServices.setSendBuses) {
        localAppServices.setSendBuses(buses);
    }
    
    updateSendEffectRackUI();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Deleted send bus`, 2000);
    }
}

/**
 * Toggle bypass for a send bus
 */
function toggleSendBusBypass(busId) {
    let buses = localAppServices.getSendBuses?.() || getDefaultSendBuses();
    const bus = buses.find(b => b.id === busId);
    if (bus) {
        bus.bypass = !bus.bypass;
        
        if (localAppServices.setSendBuses) {
            localAppServices.setSendBuses(buses);
        }
        
        updateSendEffectRackUI();
    }
}

/**
 * Update a parameter on a send bus
 */
function updateSendBusParam(busId, param, value) {
    let buses = localAppServices.getSendBuses?.() || getDefaultSendBuses();
    const bus = buses.find(b => b.id === busId);
    if (bus && bus.params) {
        bus.params[param] = value;
        
        if (localAppServices.setSendBuses) {
            localAppServices.setSendBuses(buses);
        }
        
        if (localAppServices.updateSendBus) {
            localAppServices.updateSendBus(busId, param, value);
        }
    }
}

// Module-level storage for send buses
let _sendBuses = getDefaultSendBuses();

export function getSendBuses() {
    return _sendBuses;
}

export function setSendBuses(buses) {
    _sendBuses = buses;
}

export function getSendBus(busId) {
    return _sendBuses.find(b => b.id === busId);
}

export function addSend(send) {
    _sendBuses.push(send);
    return send;
}

export function removeSend(busId) {
    _sendBuses = _sendBuses.filter(b => b.id !== busId);
}

// Expose to window for app services integration
window.getSendBuses = getSendBuses;
window.setSendBuses = setSendBuses;
window.getSendBus = getSendBus;
window.addSend = addSend;
window.removeSend = removeSend;
