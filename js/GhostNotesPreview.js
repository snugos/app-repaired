/**
 * Ghost Notes Preview - Preview drum track velocity layer changes before committing
 * Allows adjusting velocities with a live preview before applying changes
 */

const GhostNotesPreview = (function() {
    let instance = null;
    let previewTrackId = null;
    let previewOriginalVelocities = [];
    let previewModifiedVelocities = [];
    
    function getTracks() {
        if (typeof window.tracks !== 'undefined') return window.tracks;
        return [];
    }
    
    function getAppServices() {
        return window.appServices || {};
    }
    
    function init(appServices) {
        if (instance) return instance;
        instance = {
            isOpen: false,
            panel: null,
            selectedPadIndex: -1,
            previewPlayers: []
        };
        console.log('[GhostNotesPreview] Initialized');
        return instance;
    }
    
    function openPanel(trackId) {
        const tracks = getTracks();
        const track = tracks.find(t => t.id === trackId);
        
        if (!track) {
            console.warn('[GhostNotesPreview] Track not found:', trackId);
            return;
        }
        
        if (track.type !== 'DrumSampler') {
            getAppServices().showNotification?.('Ghost Notes Preview requires a Sampler (Pads) track', 3000);
            return;
        }
        
        // Store original velocities
        previewTrackId = trackId;
        previewOriginalVelocities = track.drumSamplerPads.map(pad => pad?.volume ?? 0.7);
        previewModifiedVelocities = [...previewOriginalVelocities];
        
        // Close existing panel
        if (instance.panel) {
            instance.panel.remove();
        }
        
        // Create panel
        instance.panel = createPanel(track);
        document.body.appendChild(instance.panel);
        instance.isOpen = true;
        
        console.log('[GhostNotesPreview] Panel opened for track:', track.name);
    }
    
    function createPanel(track) {
        const panel = document.createElement('div');
        panel.id = 'ghost-notes-preview-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a2e;
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 20px;
            z-index: 10000;
            min-width: 500px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 18px; color: #10b981;">Ghost Notes Preview - ${escapeHtml(track.name)}</h2>
                <button id="gnp-close-btn" style="background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer; padding: 6px 12px;">×</button>
            </div>
            
            <div id="gnp-pad-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
                ${buildPadGridHTML(track)}
            </div>
            
            <div id="gnp-slider-container" style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span id="gnp-selected-pad-label" style="color: #888;">Select a pad to adjust velocity</span>
                    <span id="gnp-velocity-display" style="color: #10b981; font-weight: bold;"></span>
                </div>
                <input type="range" id="gnp-velocity-slider" min="0" max="100" value="70" 
                    style="width: 100%; height: 8px; -webkit-appearance: none; background: #333; border-radius: 4px; cursor: pointer;"
                    disabled>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 12px;">
                <button id="gnp-preview-btn" style="padding: 10px 20px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">
                    Preview Sound
                </button>
                <button id="gnp-reset-btn" style="padding: 10px 20px; background: #374151; border: none; border-radius: 6px; color: white; cursor: pointer;">
                    Reset
                </button>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="gnp-apply-btn" style="padding: 10px 24px; background: #10b981; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">
                    Apply Changes
                </button>
                <button id="gnp-cancel-btn" style="padding: 10px 24px; background: #dc2626; border: none; border-radius: 6px; color: white; cursor: pointer;">
                    Cancel
                </button>
            </div>
            
            <div style="font-size: 11px; color: #666; text-align: center; margin-top: 12px;">
                Click a pad to select it | Drag slider to adjust velocity | Preview plays at current velocity setting
            </div>
        `;
        
        setupEvents(panel, track);
        return panel;
    }
    
    function buildPadGridHTML(track) {
        let html = '';
        for (let i = 0; i < 8; i++) {
            const pad = track.drumSamplerPads?.[i];
            const velocity = pad?.volume ?? 0.7;
            const hasSample = pad?.status === 'loaded' || pad?.audioBuffer;
            const color = getVelocityColor(velocity);
            
            html += `
                <div class="gnp-pad" data-pad="${i}" style="
                    background: ${hasSample ? color : '#1f1f2e'};
                    border: 2px solid ${hasSample ? color : '#333'};
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                    cursor: pointer;
                    opacity: ${hasSample ? '1' : '0.3'};
                    transition: all 0.15s;
                ">
                    <div style="font-size: 18px; font-weight: bold; color: ${hasSample ? '#fff' : '#555'};">Pad ${i + 1}</div>
                    <div style="font-size: 11px; color: #888; margin-top: 4px;">
                        ${hasSample ? `${Math.round(velocity * 100)}%` : 'Empty'}
                    </div>
                </div>
            `;
        }
        return html;
    }
    
    function getVelocityColor(velocity) {
        if (velocity < 0.3) return '#22c55e';
        if (velocity < 0.6) return '#eab308';
        if (velocity < 0.8) return '#f97316';
        return '#ef4444';
    }
    
    function setupEvents(panel, track) {
        // Close button
        panel.querySelector('#gnp-close-btn').addEventListener('click', closePanel);
        
        // Pad selection
        panel.querySelectorAll('.gnp-pad').forEach(padEl => {
            padEl.addEventListener('click', () => {
                const padIndex = parseInt(padEl.dataset.pad);
                selectPad(padIndex, track);
            });
        });
        
        // Velocity slider
        const slider = panel.querySelector('#gnp-velocity-slider');
        slider.addEventListener('input', (e) => {
            const velocity = parseInt(e.target.value) / 100;
            if (instance.selectedPadIndex >= 0) {
                previewModifiedVelocities[instance.selectedPadIndex] = velocity;
                updatePadDisplay(instance.selectedPadIndex, velocity);
            }
        });
        
        // Preview button
        panel.querySelector('#gnp-preview-btn').addEventListener('click', () => previewAllPads(track));
        
        // Reset button
        panel.querySelector('#gnp-reset-btn').addEventListener('click', () => {
            previewModifiedVelocities = [...previewOriginalVelocities];
            updateAllPadsDisplay();
            updateSlider(0.7);
            getAppServices().showNotification?.('Velocities reset to original', 1500);
        });
        
        // Apply button
        panel.querySelector('#gnp-apply-btn').addEventListener('click', () => applyChanges(track));
        
        // Cancel button
        panel.querySelector('#gnp-cancel-btn').addEventListener('click', closePanel);
    }
    
    function selectPad(padIndex, track) {
        instance.selectedPadIndex = padIndex;
        
        const panel = instance.panel;
        if (!panel) return;
        
        // Highlight selected pad
        panel.querySelectorAll('.gnp-pad').forEach((el, idx) => {
            el.style.borderColor = idx === padIndex ? '#fff' : '';
            el.style.boxShadow = idx === padIndex ? '0 0 10px rgba(255,255,255,0.3)' : '';
        });
        
        // Update slider
        const velocity = previewModifiedVelocities[padIndex];
        updateSlider(velocity);
        
        // Update label
        panel.querySelector('#gnp-selected-pad-label').textContent = `Pad ${padIndex + 1}`;
    }
    
    function updateSlider(velocity) {
        if (!instance.panel) return;
        const slider = instance.panel.querySelector('#gnp-velocity-slider');
        slider.disabled = false;
        slider.value = Math.round(velocity * 100);
        instance.panel.querySelector('#gnp-velocity-display').textContent = `${Math.round(velocity * 100)}%`;
    }
    
    function updatePadDisplay(padIndex, velocity) {
        if (!instance.panel) return;
        const padEl = instance.panel.querySelector(`.gnp-pad[data-pad="${padIndex}"]`);
        if (padEl) {
            const color = getVelocityColor(velocity);
            padEl.style.background = color;
            padEl.style.borderColor = color;
            padEl.querySelector('div:last-child').textContent = `${Math.round(velocity * 100)}%`;
        }
    }
    
    function updateAllPadsDisplay() {
        if (!instance.panel) return;
        for (let i = 0; i < 8; i++) {
            updatePadDisplay(i, previewModifiedVelocities[i]);
        }
    }
    
    function previewAllPads(track) {
        // Clean up previous preview players
        instance.previewPlayers.forEach(p => {
            try { p.stop(); p.dispose(); } catch(e) {}
        });
        instance.previewPlayers = [];
        
        // Check if Tone is available
        if (typeof Tone === 'undefined') {
            getAppServices().showNotification?.('Audio engine not ready', 2000);
            return;
        }
        
        // Play each pad at its preview velocity
        for (let i = 0; i < 8; i++) {
            const pad = track.drumSamplerPads?.[i];
            const player = track.drumPadPlayers?.[i];
            
            if (pad?.audioBuffer && player && player.loaded) {
                const tempPlayer = new Tone.Player(pad.audioBuffer);
                tempPlayer.volume.value = Tone.gainToDb(previewModifiedVelocities[i] * 0.7);
                tempPlayer.playbackRate = Math.pow(2, (pad.pitchShift || 0) / 12);
                tempPlayer.start();
                instance.previewPlayers.push(tempPlayer);
            }
        }
        
        if (instance.previewPlayers.length === 0) {
            getAppServices().showNotification?.('No samples loaded to preview', 2000);
        } else {
            getAppServices().showNotification?.(`Playing ${instance.previewPlayers.length} pad(s) at preview velocities`, 1500);
        }
    }
    
    function applyChanges(track) {
        for (let i = 0; i < 8; i++) {
            if (previewModifiedVelocities[i] !== previewOriginalVelocities[i]) {
                if (typeof track.setDrumSamplerPadVolume === 'function') {
                    track.setDrumSamplerPadVolume(i, previewModifiedVelocities[i]);
                } else if (track.drumSamplerPads?.[i]) {
                    track.drumSamplerPads[i].volume = previewModifiedVelocities[i];
                }
            }
        }
        
        getAppServices().showNotification?.('Velocity changes applied', 2000);
        if (getAppServices().updateTrackUI) {
            getAppServices().updateTrackUI(previewTrackId, 'drumPadVolumeChanged');
        }
        closePanel();
    }
    
    function closePanel() {
        // Clean up preview players
        instance.previewPlayers.forEach(p => {
            try { p.stop(); p.dispose(); } catch(e) {}
        });
        instance.previewPlayers = [];
        
        // Remove panel
        if (instance.panel) {
            instance.panel.remove();
            instance.panel = null;
        }
        
        instance.isOpen = false;
        instance.selectedPadIndex = -1;
        previewTrackId = null;
        
        console.log('[GhostNotesPreview] Panel closed');
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function isOpen() {
        return instance?.isOpen || false;
    }
    
    // Expose on window
    if (typeof window !== 'undefined') {
        window.ghostNotesPreview = {
            init,
            openPanel,
            isOpen,
            closePanel
        };
    }
    
    return { init, openPanel, isOpen, closePanel };
})();

// Export for main.js
export function initGhostNotesPreview(appServices) {
    return GhostNotesPreview.init(appServices);
}

export function openGhostNotesPreviewPanel(trackId) {
    GhostNotesPreview.openPanel(trackId);
}

export function isGhostNotesPreviewOpen() {
    return GhostNotesPreview.isOpen();
}

export function closeGhostNotesPreview() {
    GhostNotesPreview.closePanel();
}