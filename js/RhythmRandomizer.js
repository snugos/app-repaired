/**
 * js/RhythmRandomizer.js - Probability-based randomization for drum patterns
 * Apply randomized probability to each step in a pattern for humanization
 */

let localAppServices = {};

export function initRhythmRandomizer(appServices) {
    localAppServices = appServices || {};
    console.log('[RhythmRandomizer] Module initialized');
}

/**
 * Open the Rhythm Randomizer panel
 */
export function openRhythmRandomizerPanel() {
    const existingPanel = document.getElementById('rhythmRandomizerPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'rhythmRandomizerPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(180deg, #1e1e2e 0%, #16162a 100%);
        border: 1px solid #444;
        border-radius: 12px;
        padding: 20px;
        min-width: 500px;
        max-height: 85vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        color: #eee;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">🎲</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Rhythm Randomizer</h3>
            </div>
            <button id="closeRandomizerPanel" style="background:#333;border:none;color:#fff;padding:5px 12px;cursor:pointer;border-radius:4px;font-size:14px;">×</button>
        </div>
        
        <p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.5;">
            Apply probability-based randomization to drum patterns. Each step can be randomly 
            enabled/disabled based on its probability setting.
        </p>
        
        <div id="trackSelectionSection" style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;color:#888;margin-bottom:6px;">Select Track</label>
            <select id="randomizerTrackSelect" style="
                width: 100%;
                padding: 10px 12px;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="">-- Select a track --</option>
            </select>
        </div>
        
        <div id="sequenceSelection" style="margin-bottom:16px;display:none;">
            <label style="display:block;font-size:12px;color:#888;margin-bottom:6px;">Select Sequence</label>
            <select id="randomizerSequenceSelect" style="
                width: 100%;
                padding: 10px 12px;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="">-- Select a sequence --</option>
            </select>
        </div>
        
        <div id="probabilityControls" style="margin-bottom:16px;display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <label style="font-size:14px;font-weight:500;">Default Probability</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="range" id="defaultProbability" min="0" max="100" value="75" 
                        style="width:150px;cursor:pointer;">
                    <span id="defaultProbValue" style="min-width:40px;text-align:right;color:#4a9eff;">75%</span>
                </div>
            </div>
            
            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <button id="applyToAllBtn" style="
                    flex:1;
                    padding: 10px;
                    background: #3a3a5e;
                    border: 1px solid #555;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 13px;
                    cursor: pointer;
                ">Apply to All Steps</button>
                <button id="applyToActiveBtn" style="
                    flex:1;
                    padding: 10px;
                    background: #3a4a6e;
                    border: 1px solid #555;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 13px;
                    cursor: pointer;
                ">Apply to Active Only</button>
            </div>
            
            <div style="display:flex;gap:8px;">
                <button id="randomizeProbBtn" style="
                    flex:1;
                    padding: 12px;
                    background: linear-gradient(180deg, #f97316 0%, #c2410c 100%);
                    border: none;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">🎲 Randomize Probabilities</button>
            </div>
        </div>
        
        <div id="stepPreview" style="display:none;margin-top:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <label style="font-size:12px;color:#888;">Preview (Original → Random)</label>
                <button id="previewAgainBtn" style="
                    background:#333;
                    border:1px solid #444;
                    color:#888;
                    padding:4px 10px;
                    border-radius:4px;
                    font-size:11px;
                    cursor:pointer;
                ">Preview Again</button>
            </div>
            <div id="previewGrid" style="
                background:#0a0a1e;
                border:1px solid #333;
                border-radius:6px;
                padding:8px;
                overflow-x:auto;
            "></div>
        </div>
        
        <div style="display:flex;gap:8px;margin-top:16px;">
            <button id="applyRandomizeBtn" style="
                flex:1;
                padding: 12px;
                background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
                border: none;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            ">Apply to Pattern</button>
            <button id="cancelRandomizeBtn" style="
                flex:1;
                padding: 12px;
                background: #444;
                border: none;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                cursor: pointer;
            ">Cancel</button>
        </div>
    `;

    document.body.appendChild(panel);

    const trackSelect = panel.querySelector('#randomizerTrackSelect');
    const seqSelect = panel.querySelector('#randomizerSequenceSelect');
    const probControls = panel.querySelector('#probabilityControls');
    const defaultProbSlider = panel.querySelector('#defaultProbability');
    const defaultProbValue = panel.querySelector('#defaultProbValue');
    const previewGrid = panel.querySelector('#previewGrid');
    const stepPreview = panel.querySelector('#stepPreview');

    // Track selection
    let selectedTrack = null;
    let selectedSequence = null;
    let originalData = null;
    let randomizedData = null;

    const loadTracks = () => {
        const tracks = localAppServices.getTracks?.() || [];
        trackSelect.innerHTML = '<option value="">-- Select a track --</option>';
        
        tracks.forEach(track => {
            if (track.type === 'DrumSampler' || track.type === 'Synth' || 
                (track.sequences && track.sequences.length > 0)) {
                const option = document.createElement('option');
                option.value = track.id;
                option.textContent = `${track.name || 'Track ' + track.id} (${track.type})`;
                trackSelect.appendChild(option);
            }
        });
    };

    const loadSequences = (trackId) => {
        const tracks = localAppServices.getTracks?.() || [];
        const track = tracks.find(t => t.id === trackId);
        
        if (track && track.sequences && track.sequences.length > 0) {
            seqSelect.style.display = 'block';
            seqSelect.innerHTML = '<option value="">-- Select a sequence --</option>';
            
            track.sequences.forEach(seq => {
                const option = document.createElement('option');
                option.value = seq.id;
                option.textContent = seq.name || `Sequence ${seq.id.slice(-4)}`;
                seqSelect.appendChild(option);
            });
            
            if (track.sequences.length === 1) {
                seqSelect.value = track.sequences[0].id;
                selectedSequence = track.sequences[0];
                updateProbabilityControls(track);
            }
        } else {
            seqSelect.style.display = 'none';
            selectedSequence = null;
        }
    };

    const updateProbabilityControls = (track) => {
        if (!selectedSequence) {
            probControls.style.display = 'none';
            return;
        }
        probControls.style.display = 'block';
        originalData = JSON.parse(JSON.stringify(selectedSequence.data || []));
    };

    const applyProbabilityToStep = (value, probability) => {
        if (value === null || value === undefined) return null;
        return Math.random() * 100 < probability ? value : null;
    };

    const randomizeProbabilities = () => {
        if (!originalData) return;
        
        const defaultProb = parseInt(defaultProbSlider.value, 10);
        randomizedData = originalData.map(row => 
            row.map(step => applyProbabilityToStep(step, defaultProb))
        );
        
        renderPreview();
    };

    const renderPreview = () => {
        if (!originalData || !randomizedData) return;
        
        stepPreview.style.display = 'block';
        previewGrid.innerHTML = '';
        
        const stepWidth = 20;
        const rowHeight = 24;
        const numSteps = originalData[0]?.length || 16;
        
        // Create two rows side by side
        const container = document.createElement('div');
        container.style.cssText = 'display:flex;gap:8px;';
        
        // Original
        const originalDiv = document.createElement('div');
        originalDiv.innerHTML = '<div style="font-size:10px;color:#666;margin-bottom:4px;">ORIGINAL</div>';
        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = numSteps * stepWidth + 40;
        originalCanvas.height = originalData.length * rowHeight + 4;
        const origCtx = originalCanvas.getContext('2d');
        origCtx.fillStyle = '#0a0a1e';
        origCtx.fillRect(0, 0, originalCanvas.width, originalCanvas.height);
        
        originalData.forEach((row, rowIdx) => {
            row.forEach((step, stepIdx) => {
                if (step !== null) {
                    origCtx.fillStyle = '#4a9eff';
                    origCtx.fillRect(40 + stepIdx * stepWidth, rowIdx * rowHeight + 2, stepWidth - 2, rowHeight - 4);
                }
            });
        });
        
        // Step numbers
        origCtx.fillStyle = '#444';
        origCtx.font = '9px monospace';
        for (let i = 0; i < numSteps; i++) {
            if (i % 4 === 0) {
                origCtx.fillText(i.toString(), 40 + i * stepWidth, originalCanvas.height - 2);
            }
        }
        
        originalDiv.appendChild(originalCanvas);
        
        // Randomized
        const randomDiv = document.createElement('div');
        randomDiv.innerHTML = '<div style="font-size:10px;color:#f97316;margin-bottom:4px;">RANDOMIZED</div>';
        const randomCanvas = document.createElement('canvas');
        randomCanvas.width = numSteps * stepWidth + 40;
        randomCanvas.height = randomizedData.length * rowHeight + 4;
        const randCtx = randomCanvas.getContext('2d');
        randCtx.fillStyle = '#0a0a1e';
        randCtx.fillRect(0, 0, randomCanvas.width, randomCanvas.height);
        
        randomizedData.forEach((row, rowIdx) => {
            row.forEach((step, stepIdx) => {
                if (step !== null) {
                    randCtx.fillStyle = '#22c55e';
                    randCtx.fillRect(40 + stepIdx * stepWidth, rowIdx * rowHeight + 2, stepWidth - 2, rowHeight - 4);
                }
            });
        });
        
        // Step numbers
        randCtx.fillStyle = '#444';
        randCtx.font = '9px monospace';
        for (let i = 0; i < numSteps; i++) {
            if (i % 4 === 0) {
                randCtx.fillText(i.toString(), 40 + i * stepWidth, randomCanvas.height - 2);
            }
        }
        
        randomDiv.appendChild(randomCanvas);
        
        container.appendChild(originalDiv);
        container.appendChild(randomDiv);
        previewGrid.appendChild(container);
    };

    const applyToPattern = () => {
        if (!randomizedData || !selectedSequence) return;
        
        const tracks = localAppServices.getTracks?.() || [];
        const track = tracks.find(t => t.id === parseInt(trackSelect.value, 10));
        
        if (track && localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo(`Rhythm Randomize on ${track.name}`);
        }
        
        // Update the sequence data
        selectedSequence.data = randomizedData;
        
        // Recreate the Tone sequence for playback
        if (track && track.recreateToneSequence) {
            track.recreateToneSequence(true);
        }
        
        // Update UI
        if (localAppServices.updateTrackUI) {
            localAppServices.updateTrackUI(parseInt(trackSelect.value, 10), 'sequenceChanged');
        }
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Rhythm randomization applied!', 2000);
        }
        
        panel.remove();
    };

    // Event listeners
    trackSelect.addEventListener('change', (e) => {
        const trackId = parseInt(e.target.value, 10);
        selectedTrack = localAppServices.getTracks?.().find(t => t.id === trackId);
        seqSelect.innerHTML = '<option value="">-- Select a sequence --</option>';
        probControls.style.display = 'none';
        stepPreview.style.display = 'none';
        randomizedData = null;
        
        if (trackId) {
            loadSequences(trackId);
        }
    });

    seqSelect.addEventListener('change', (e) => {
        const seqId = e.target.value;
        selectedSequence = selectedTrack?.sequences?.find(s => s.id === seqId);
        updateProbabilityControls(selectedTrack);
        stepPreview.style.display = 'none';
        randomizedData = null;
    });

    defaultProbSlider.addEventListener('input', (e) => {
        defaultProbValue.textContent = e.target.value + '%';
    });

    panel.querySelector('#applyToAllBtn').addEventListener('click', () => {
        if (!originalData) return;
        const defaultProb = parseInt(defaultProbSlider.value, 10);
        randomizedData = originalData.map(row => 
            row.map(step => applyProbabilityToStep(step, defaultProb))
        );
        renderPreview();
    });

    panel.querySelector('#applyToActiveBtn').addEventListener('click', () => {
        if (!originalData) return;
        const defaultProb = parseInt(defaultProbSlider.value, 10);
        
        // Only apply to steps that have values
        randomizedData = originalData.map(row => 
            row.map(step => step !== null ? applyProbabilityToStep(step, defaultProb) : null)
        );
        renderPreview();
    });

    panel.querySelector('#randomizeProbBtn').addEventListener('click', randomizeProbabilities);

    panel.querySelector('#previewAgainBtn').addEventListener('click', randomizeProbabilities);

    panel.querySelector('#applyRandomizeBtn').addEventListener('click', applyToPattern);

    panel.querySelector('#cancelRandomizeBtn').addEventListener('click', () => panel.remove());
    panel.querySelector('#closeRandomizerPanel').addEventListener('click', () => panel.remove());

    // Initial load
    loadTracks();
}

// Export for use in other modules
export default {
    initRhythmRandomizer,
    openRhythmRandomizerPanel
};
