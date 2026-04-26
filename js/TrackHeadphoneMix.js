// js/TrackHeadphoneMix.js - Per-Track Headphone Volume Control
// Provides separate headphone mix control per track, independent from main mix

let headphoneMixState = {
    enabled: false,
    masterHeadphoneGain: 1.0,
    trackHeadphoneGains: {}, // trackId -> gain multiplier (0-2, 1=unity)
    soloedForHeadphone: new Set(), // tracks soloed for headphone mix only
    preFaderPostFader: 'post' // 'pre' or 'post' fader
};

let appServicesRef = null;
let headphoneMeterContext = null;
let headphoneMeterAnimationId = null;

export function initTrackHeadphoneMix(services) {
    appServicesRef = services;
    console.log('[HeadphoneMix] Initialized');
    
    // Create headphone mix UI panel
    createHeadphoneMixPanel();
    
    // Start meter animation if enabled
    if (headphoneMixState.enabled) {
        startHeadphoneMeterAnimation();
    }
}

export function isHeadphoneMixEnabled() {
    return headphoneMixState.enabled;
}

export function setHeadphoneMixEnabled(enabled) {
    headphoneMixState.enabled = !!enabled;
    updateHeadphoneMixUI();
    
    if (enabled && !headphoneMeterAnimationId) {
        startHeadphoneMeterAnimation();
    } else if (!enabled && headphoneMeterAnimationId) {
        cancelAnimationFrame(headphoneMeterAnimationId);
        headphoneMeterAnimationId = null;
    }
    
    if (appServicesRef?.showSafeNotification) {
        appServicesRef.showSafeNotification(
            enabled ? "Headphone Mix enabled" : "Headphone Mix disabled",
            1500
        );
    }
}

export function getTrackHeadphoneGain(trackId) {
    return headphoneMixState.trackHeadphoneGains[trackId] ?? 1.0;
}

export function setTrackHeadphoneGain(trackId, gain) {
    const clampedGain = Math.max(0, Math.min(2, gain));
    headphoneMixState.trackHeadphoneGains[trackId] = clampedGain;
    
    // Update the actual gain node if track exists
    updateTrackHeadphoneGainNode(trackId, clampedGain);
    
    // Update meter display
    updateTrackHeadphoneMeter(trackId);
}

export function getMasterHeadphoneGain() {
    return headphoneMixState.masterHeadphoneGain;
}

export function setMasterHeadphoneGain(gain) {
    headphoneMixState.masterHeadphoneGain = Math.max(0, Math.min(2, gain));
    updateAllTrackHeadphoneGains();
    updateMasterHeadphoneMeter();
}

function getOrCreateHeadphoneGainNode(track) {
    if (!track.audioContext) return null;
    
    if (!track._headphoneGainNode) {
        const ctx = track.audioContext;
        track._headphoneGainNode = ctx.createGain();
        track._headphoneGainNode.gain.value = 1.0;
        
        // Connect: track output -> headphone gain -> destination
        if (track.outputNode) {
            track.outputNode.disconnect();
            track.outputNode.connect(track._headphoneGainNode);
            track._headphoneGainNode.connect(ctx.destination);
        }
        
        // Store reference to original destination for switching
        track._originalDestination = ctx.destination;
    }
    
    return track._headphoneGainNode;
}

function updateTrackHeadphoneGainNode(trackId, gain) {
    if (!appServicesRef?.getTrackById) return;
    
    const track = appServicesRef.getTrackById(trackId);
    if (!track || !track._headphoneGainNode) return;
    
    const finalGain = gain * headphoneMixState.masterHeadphoneGain;
    track._headphoneGainNode.gain.setTargetAtTime(finalGain, track.audioContext.currentTime, 0.02);
}

function updateAllTrackHeadphoneGains() {
    if (!appServicesRef?.getTracksState) return;
    
    const tracks = appServicesRef.getTracksState();
    tracks.forEach(track => {
        if (track._headphoneGainNode) {
            const trackGain = headphoneMixState.trackHeadphoneGains[track.id] ?? 1.0;
            const finalGain = trackGain * headphoneMixState.masterHeadphoneGain;
            track._headphoneGainNode.gain.setTargetAtTime(finalGain, track.audioContext.currentTime, 0.02);
        }
    });
}

function createHeadphoneMixPanel() {
    // Check if panel already exists
    if (document.getElementById('headphoneMixPanel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'headphoneMixPanel';
    panel.className = 'hidden fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-4 w-96';
    panel.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-white font-bold text-lg">Headphone Mix</h3>
            <button id="closeHeadphoneMixBtn" class="text-zinc-400 hover:text-white">&times;</button>
        </div>
        
        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <label class="text-zinc-300 text-sm">Master Headphone Gain</label>
                <span id="masterHeadphoneGainValue" class="text-zinc-400 text-sm">100%</span>
            </div>
            <input type="range" id="masterHeadphoneGainSlider" 
                   class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                   min="0" max="200" value="100">
        </div>
        
        <div id="headphoneTrackList" class="max-h-64 overflow-y-auto space-y-2">
            <!-- Track headphone controls will be added here dynamically -->
        </div>
        
        <div class="mt-4 pt-4 border-t border-zinc-700">
            <div class="flex items-center justify-between">
                <label class="text-zinc-300 text-sm">Enable Headphone Mix</label>
                <button id="toggleHeadphoneMixBtn" 
                        class="px-3 py-1 rounded text-sm font-bold transition-colors
                               bg-zinc-700 text-zinc-300 hover:bg-zinc-600">
                    OFF
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('closeHeadphoneMixBtn').addEventListener('click', () => {
        panel.classList.add('hidden');
    });
    
    document.getElementById('masterHeadphoneGainSlider').addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        setMasterHeadphoneGain(value / 100);
        document.getElementById('masterHeadphoneGainValue').textContent = `${value}%`;
    });
    
    document.getElementById('toggleHeadphoneMixBtn').addEventListener('click', () => {
        setHeadphoneMixEnabled(!headphoneMixState.enabled);
    });
}

export function openHeadphoneMixPanel() {
    const panel = document.getElementById('headphoneMixPanel');
    if (panel) {
        refreshHeadphoneTrackList();
        updateHeadphoneMixUI();
        panel.classList.remove('hidden');
    }
}

function refreshHeadphoneTrackList() {
    if (!appServicesRef?.getTracksState) return;
    
    const list = document.getElementById('headphoneTrackList');
    if (!list) return;
    
    const tracks = appServicesRef.getTracksState();
    list.innerHTML = '';
    
    tracks.forEach(track => {
        const trackGain = getTrackHeadphoneGain(track.id);
        const trackItem = document.createElement('div');
        trackItem.className = 'flex items-center gap-3 p-2 bg-zinc-800 rounded';
        trackItem.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="text-zinc-300 text-sm truncate">${track.name || track.id}</div>
                <div class="text-zinc-500 text-xs">${track.type}</div>
            </div>
            <div class="flex items-center gap-2">
                <button class="headphoneSoloBtn text-zinc-500 hover:text-yellow-400 text-xs font-bold px-2 py-1 rounded bg-zinc-700"
                        data-track-id="${track.id}">S</button>
                <input type="range" 
                       class="trackHeadphoneSlider w-20 h-1.5 bg-zinc-600 rounded-lg appearance-none cursor-pointer"
                       min="0" max="200" value="${trackGain * 100}"
                       data-track-id="${track.id}">
                <span class="trackHeadphoneValue text-zinc-400 text-xs w-10 text-right">${Math.round(trackGain * 100)}%</span>
            </div>
        `;
        list.appendChild(trackItem);
    });
    
    // Add event listeners for track sliders
    list.querySelectorAll('.trackHeadphoneSlider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = e.target.dataset.trackId;
            const value = parseInt(e.target.value);
            setTrackHeadphoneGain(trackId, value / 100);
            e.target.parentElement.querySelector('.trackHeadphoneValue').textContent = `${value}%`;
        });
    });
    
    // Add event listeners for solo buttons
    list.querySelectorAll('.headphoneSoloBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = e.target.dataset.trackId;
            toggleHeadphoneSolo(trackId);
        });
    });
}

function updateHeadphoneMixUI() {
    const toggleBtn = document.getElementById('toggleHeadphoneMixBtn');
    if (toggleBtn) {
        if (headphoneMixState.enabled) {
            toggleBtn.className = 'px-3 py-1 rounded text-sm font-bold transition-colors bg-green-600 text-white';
            toggleBtn.textContent = 'ON';
        } else {
            toggleBtn.className = 'px-3 py-1 rounded text-sm font-bold transition-colors bg-zinc-700 text-zinc-300';
            toggleBtn.textContent = 'OFF';
        }
    }
    
    const masterSlider = document.getElementById('masterHeadphoneGainSlider');
    const masterValue = document.getElementById('masterHeadphoneGainValue');
    if (masterSlider && masterValue) {
        masterSlider.value = headphoneMixState.masterHeadphoneGain * 100;
        masterValue.textContent = `${Math.round(headphoneMixState.masterHeadphoneGain * 100)}%`;
    }
}

function toggleHeadphoneSolo(trackId) {
    if (headphoneMixState.soloedForHeadphone.has(trackId)) {
        headphoneMixState.soloedForHeadphone.delete(trackId);
    } else {
        headphoneMixState.soloedForHeadphone.add(trackId);
    }
    applyHeadphoneSoloState();
    
    // Update solo button visual
    const btn = document.querySelector(`.headphoneSoloBtn[data-track-id="${trackId}"]`);
    if (btn) {
        if (headphoneMixState.soloedForHeadphone.has(trackId)) {
            btn.className = 'headphoneSoloBtn text-yellow-400 text-xs font-bold px-2 py-1 rounded bg-zinc-600';
        } else {
            btn.className = 'headphoneSoloBtn text-zinc-500 hover:text-yellow-400 text-xs font-bold px-2 py-1 rounded bg-zinc-700';
        }
    }
}

function applyHeadphoneSoloState() {
    if (!headphoneMixState.enabled) return;
    if (!appServicesRef?.getTracksState) return;
    
    const tracks = appServicesRef.getTracksState();
    const hasSoloedTracks = headphoneMixState.soloedForHeadphone.size > 0;
    
    tracks.forEach(track => {
        const shouldMute = hasSoloedTracks && !headphoneMixState.soloedForHeadphone.has(track.id);
        if (track._headphoneGainNode) {
            track._headphoneGainNode.gain.setTargetAtTime(
                shouldMute ? 0 : 1,
                track.audioContext.currentTime,
                0.02
            );
        }
    });
}

function startHeadphoneMeterAnimation() {
    if (headphoneMeterAnimationId) return;
    
    function updateMeters() {
        if (!headphoneMixState.enabled || !appServicesRef?.getTracksState) {
            headphoneMeterAnimationId = requestAnimationFrame(updateMeters);
            return;
        }
        
        const tracks = appServicesRef.getTracksState();
        tracks.forEach(track => {
            updateTrackHeadphoneMeter(track.id);
        });
        
        updateMasterHeadphoneMeter();
        headphoneMeterAnimationId = requestAnimationFrame(updateMeters);
    }
    
    headphoneMeterAnimationId = requestAnimationFrame(updateMeters);
}

function updateTrackHeadphoneMeter(trackId) {
    if (!headphoneMixState.enabled) return;
    
    const slider = document.querySelector(`.trackHeadphoneSlider[data-track-id="${trackId}"]`);
    if (!slider) return;
    
    // Simple meter based on gain value
    const gain = getTrackHeadphoneGain(trackId);
    // Clamp visual feedback
    const meterPercent = Math.min(100, gain * 80);
    slider.style.background = `linear-gradient(to right, #22c55e ${meterPercent}%, #3f3f46 ${meterPercent}%)`;
}

function updateMasterHeadphoneMeter() {
    const slider = document.getElementById('masterHeadphoneGainSlider');
    if (!slider) return;
    
    const gain = headphoneMixState.masterHeadphoneGain;
    const meterPercent = Math.min(100, gain * 80);
    slider.style.background = `linear-gradient(to right, #22c55e ${meterPercent}%, #3f3f46 ${meterPercent}%)`;
}

// Auto-connect headphone mix when track is created
export function onTrackCreatedHeadphoneSupport(track) {
    if (!headphoneMixState.enabled) return;
    
    // Create headphone gain node
    getOrCreateHeadphoneGainNode(track);
    
    // Apply current gain
    const trackGain = getTrackHeadphoneGain(track.id);
    updateTrackHeadphoneGainNode(track.id, trackGain);
}

// Export state for persistence
export function getHeadphoneMixState() {
    return JSON.parse(JSON.stringify(headphoneMixState));
}

export function loadHeadphoneMixState(state) {
    if (!state) return;
    
    headphoneMixState.enabled = state.enabled ?? false;
    headphoneMixState.masterHeadphoneGain = state.masterHeadphoneGain ?? 1.0;
    headphoneMixState.trackHeadphoneGains = state.trackHeadphoneGains ?? {};
    headphoneMixState.soloedForHeadphone = new Set(state.soloedForHeadphone ?? []);
    
    if (headphoneMixState.enabled) {
        startHeadphoneMeterAnimation();
    }
}

// Window function for opening the panel
window.openHeadphoneMixPanel = openHeadphoneMixPanel;
window.isHeadphoneMixEnabled = isHeadphoneMixEnabled;
window.setHeadphoneMixEnabled = setHeadphoneMixEnabled;
window.getTrackHeadphoneGain = getTrackHeadphoneGain;
window.setTrackHeadphoneGain = setTrackHeadphoneGain;
window.getMasterHeadphoneGain = getMasterHeadphoneGain;
window.setMasterHeadphoneGain = setMasterHeadphoneGain;