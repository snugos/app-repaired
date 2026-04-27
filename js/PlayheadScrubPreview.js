// PlayheadScrubPreview - Audio preview when scrubbing the timeline
let scrubAudioContext = null;
let scrubOscillator = null;
let isScrubPreviewEnabled = false;

export function initPlayheadScrubPreview(appServices) {
    if (typeof appServices === 'undefined') return;
    
    // Find the timeline container for scrub events
    const timelineEl = document.getElementById('timeline');
    if (!timelineEl) return;
    
    // Enable scrub audio on mousedown over timeline playhead
    timelineEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.playhead') || e.target.closest('#playhead')) {
            startScrubAudio();
        }
    });
    
    // Stop scrub audio on mouseup anywhere
    document.addEventListener('mouseup', stopScrubAudio);
    
    // Stop scrub audio when playback starts
    if (appServices.registerAppStateCallback) {
        appServices.registerAppStateCallback((state) => {
            if (state.isPlaying) stopScrubAudio();
        });
    }
}

function startScrubAudio() {
    if (!isScrubPreviewEnabled) return;
    if (scrubAudioContext) return; // already running
    
    try {
        scrubAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        scrubOscillator = scrubAudioContext.createOscillator();
        const gainNode = scrubAudioContext.createGain();
        
        scrubOscillator.type = 'sine';
        scrubOscillator.frequency.value = 440;
        gainNode.gain.value = 0.03; // very subtle
        
        scrubOscillator.connect(gainNode);
        gainNode.connect(scrubAudioContext.destination);
        scrubOscillator.start();
    } catch (e) {
        console.warn('[PlayheadScrubPreview] Failed to start:', e);
    }
}

function stopScrubAudio() {
    if (scrubOscillator) {
        try { scrubOscillator.stop(); } catch (e) {}
        scrubOscillator = null;
    }
    if (scrubAudioContext) {
        try { scrubAudioContext.close(); } catch (e) {}
        scrubAudioContext = null;
    }
}

export function enableScrubPreview() {
    isScrubPreviewEnabled = true;
}

export function disableScrubPreview() {
    isScrubPreviewEnabled = false;
    stopScrubAudio();
}

export function isScrubPreviewActive() {
    return isScrubPreviewEnabled;
}

export function openScrubPreviewPanel() {
    const panel = document.getElementById('scrub-preview-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'block';
        return;
    }
    
    const newPanel = document.createElement('div');
    newPanel.id = 'scrub-preview-panel';
    newPanel.style.cssText = `
        position: fixed; bottom: 120px; right: 20px;
        background: rgba(20,20,30,0.95); border: 1px solid #555;
        border-radius: 8px; padding: 12px 16px; color: #eee;
        font-family: system-ui; font-size: 12px; z-index: 1000;
        min-width: 160px;
    `;
    newPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">Scrub Preview</div>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="scrub-preview-toggle" ${isScrubPreviewEnabled ? 'checked' : ''}>
            <span>Play sound while scrubbing</span>
        </label>
    `;
    document.body.appendChild(newPanel);
    
    document.getElementById('scrub-preview-toggle').addEventListener('change', (e) => {
        if (e.target.checked) enableScrubPreview();
        else disableScrubPreview();
    });
}

window.openScrubPreviewPanel = openScrubPreviewPanel;