// --- Spectrum Analyzer Panel ---

/**
 * Opens the Spectrum Analyzer panel for real-time FFT visualization.
 */
export function openSpectrumAnalyzerPanel(savedState = null) {
    const windowId = 'spectrumAnalyzer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'spectrumAnalyzerContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const options = { width: 600, height: 350, minWidth: 400, minHeight: 250, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Spectrum Analyzer', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderSpectrumAnalyzerContent(), 50);
    }
    return win;
}

/**
 * Renders the spectrum analyzer content.
 */
function renderSpectrumAnalyzerContent() {
    const container = document.getElementById('spectrumAnalyzerContent');
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
                <select id="spectrumSource" class="p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                    <option value="master">Master Output</option>
                </select>
                <label class="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" id="spectrumShowPeaks" checked class="w-4 h-4">
                    Show Peaks
                </label>
            </div>
            <div class="text-xs text-gray-500" id="spectrumPeakDisplay">Peak: -- dB</div>
        </div>
        <div id="spectrumCanvasContainer" class="flex-1 bg-black rounded border border-gray-700 relative overflow-hidden">
            <canvas id="spectrumCanvas" class="w-full h-full"></canvas>
        </div>
        <div class="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>20Hz</span>
            <span>200Hz</span>
            <span>2kHz</span>
            <span>20kHz</span>
        </div>
    `;

    setupSpectrumAnalyzer();
}

/**
 * Sets up the spectrum analyzer visualization.
 */
function setupSpectrumAnalyzer() {
    const canvas = document.getElementById('spectrumCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = document.getElementById('spectrumCanvasContainer');
    if (!container) return;

    // Set canvas size
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    let animationId = null;
    let showPeaks = true;
    let peakValue = -60;
    let peakDecay = 0;

    function draw() {
        // Get frequency data from audio.js
        let frequencyData = null;
        if (localAppServices.getMasterFrequencyData) {
            frequencyData = localAppServices.getMasterFrequencyData();
        }

        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!frequencyData || frequencyData.length === 0) {
            // Draw placeholder bars
            ctx.fillStyle = '#333';
            for (let i = 0; i < 64; i++) {
                const barHeight = 10 + Math.random() * 50;
                ctx.fillRect(i * (canvas.width / 64), canvas.height - barHeight, canvas.width / 64 - 2, barHeight);
            }
            animationId = requestAnimationFrame(draw);
            return;
        }

        // Draw frequency bars
        const barCount = Math.min(64, frequencyData.length);
        const barWidth = canvas.width / barCount;
        const gap = 2;

        for (let i = 0; i < barCount; i++) {
            // Use logarithmic scale for frequency bins
            const value = frequencyData[i] || 0;
            const dbValue = value > 0 ? (20 * Math.log10(value)) : -60;
            const normalizedValue = Math.max(0, (dbValue + 60) / 60); // 0-1 range
            const barHeight = normalizedValue * canvas.height;

            // Gradient color based on intensity
            const hue = 120 - (normalizedValue * 120); // Green to red
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;

            ctx.fillRect(
                i * barWidth + gap / 2,
                canvas.height - barHeight,
                barWidth - gap,
                barHeight
            );

            // Draw peak indicator
            if (showPeaks && dbValue > peakValue - 3) {
                peakValue = Math.max(peakValue, dbValue);
                peakDecay = 0;
            }
        }

        // Update peak display
        peakDecay += 0.02;
        if (peakDecay > 1) {
            peakValue = Math.max(-60, peakValue - 0.5);
        }

        const peakDisplay = document.getElementById('spectrumPeakDisplay');
        if (peakDisplay) {
            peakDisplay.textContent = `Peak: ${peakValue.toFixed(1)} dB`;
        }

        animationId = requestAnimationFrame(draw);
    }

    // Handle checkbox
    const peaksCheckbox = document.getElementById('spectrumShowPeaks');
    if (peaksCheckbox) {
        peaksCheckbox.addEventListener('change', (e) => {
            showPeaks = e.target.checked;
        });
    }

    // Start animation
    draw();

    // Cleanup on window close would be handled by the window system
}

// --- Time Signature Changes Panel ---

export function openTimeSignaturePanel(savedState = null) {
    const windowId = 'timeSignature';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateTimeSignaturePanel();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'timeSignatureContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { width: 450, height: 400, minWidth: 350, minHeight: 250, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Time Signature', contentContainer, options);
    if (win?.element) renderTimeSignatureContent();
    return win;
}

// --- Keyboard Shortcuts Panel ---

const KEYBOARD_SHORTCUTS = [
    { category: 'Transport', shortcuts: [
        { keys: 'Space', description: 'Play / Pause' },
        { keys: 'Enter', description: 'Start recording' },
        { keys: 'Escape', description: 'Stop / Close all windows' },
        { keys: 'Ctrl+Z', description: 'Undo' },
        { keys: 'Ctrl+Y', description: 'Redo' },
    ]},
    { category: 'Navigation', shortcuts: [
        { keys: '←', description: 'Decrease tempo by 0.1 BPM' },
        { keys: '→', description: 'Increase tempo by 0.1 BPM' },
        { keys: 'Z', description: 'Shift octave down' },
        { keys: 'X', description: 'Shift octave up' },
    ]},
    { category: 'Track Controls', shortcuts: [
        { keys: 'M', description: 'Toggle mute' },
        { keys: 'S', description: 'Toggle solo' },
        { keys: 'R', description: 'Toggle record arm' },
        { keys: 'Delete', description: 'Delete selected clips/notes' },
        { keys: 'Ctrl+D', description: 'Duplicate selected' },
    ]},
    { category: 'MIDI & Computer Keyboard', shortcuts: [
        { keys: 'A-Z, 0-9', description: 'Play MIDI notes (computer keyboard)' },
        { keys: '?', description: 'Show this shortcuts panel' },
    ]},
    { category: 'Editing', shortcuts: [
        { keys: 'Shift+Click', description: 'Multi-select notes' },
        { keys: 'Ctrl+Click', description: 'Add to selection' },
    ]},
];

export function openKeyboardShortcutsPanel(savedState = null) {
    const windowId = 'keyboardShortcuts';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'keyboardShortcutsContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    let html = '<div class="text-sm font-medium mb-4 text-gray-600 dark:text-gray-400">Press <kbd class="px-2 py-0.5 bg-gray-200 dark:bg-slate-700 rounded text-xs">?</kbd> to toggle this panel</div>';
    
    KEYBOARD_SHORTCUTS.forEach(section => {
        html += `<div class="mb-4">
            <div class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">${section.category}</div>
            <div class="space-y-1">`;
        section.shortcuts.forEach(shortcut => {
            html += `<div class="flex items-center justify-between py-1 px-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <span class="text-sm text-gray-700 dark:text-gray-300">${shortcut.description}</span>
                <kbd class="px-2 py-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-500 rounded text-xs font-mono">${shortcut.keys}</kbd>
            </div>`;
        });
        html += '</div></div>';
    });

    contentContainer.innerHTML = html;

    const options = { width: 380, height: 500, minWidth: 300, minHeight: 350, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    return localAppServices.createWindow(windowId, 'Keyboard Shortcuts', contentContainer, options);
}

function renderTimeSignatureContent() {
    const container = document.getElementById('timeSignatureContent');
    if (!container) return;

    const tsChanges = localAppServices.getTimeSignatureChanges ? localAppServices.getTimeSignatureChanges() : [];
    const currentTs = localAppServices.getCurrentTimeSignature ? localAppServices.getCurrentTimeSignature() : { numerator: 4, denominator: 4 };
    
    let html = `<div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
        <div class="flex items-center gap-3 mb-2">
            <label class="text-xs text-gray-600 dark:text-gray-400">Current:</label>
            <select id="currentTsNumerator" class="p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600">
                ${[1,2,3,4,5,6,7,8,9,12,16].map(n => `<option value="${n}" ${n === currentTs.numerator ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <span class="text-gray-500">/</span>
            <select id="currentTsDenominator" class="p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600">
                ${[1,2,4,8,16,32].map(n => `<option value="${n}" ${n === currentTs.denominator ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <button id="applyCurrentTsBtn" class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Apply</button>
        </div>
    </div>
    
    <div class="mb-3 flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">${tsChanges.length} change${tsChanges.length !== 1 ? 's' : ''}</span>
        <div class="flex gap-2">
            <button id="addTsPointBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">+ Add</button>
            <button id="clearAllTsPointsBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 ${tsChanges.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${tsChanges.length === 0 ? 'disabled' : ''}>Clear</button>
        </div>
    </div>`;
    
    if (tsChanges.length === 0) {
        html += `<div class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No time signature changes yet.</div>`;
    } else {
        html += `<div class="space-y-2">`;
        tsChanges.forEach((ts, idx) => {
            html += `<div class="bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 p-2">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-purple-600 dark:text-purple-400">#${idx + 1}</span>
                    <button class="delete-ts-point-btn text-xs text-red-500 hover:text-red-700" data-id="${ts.id}">✕</button>
                </div>
                <div class="grid grid-cols-3 gap-2 items-center">
                    <div><label class="text-xs text-gray-500">Bar</label>
                        <input type="number" min="1" value="${ts.barPosition}" class="ts-bar-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ts.id}"></div>
                    <div><label class="text-xs text-gray-500">Beats</label>
                        <select class="ts-numerator-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ts.id}">
                            ${[1,2,3,4,5,6,7,8,9,12,16].map(n => `<option value="${n}" ${n === ts.numerator ? 'selected' : ''}>${n}</option>`).join('')}
                        </select></div>
                    <div><label class="text-xs text-gray-500">Note</label>
                        <select class="ts-denominator-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ts.id}">
                            ${[1,2,4,8,16,32].map(n => `<option value="${n}" ${n === ts.denominator ? 'selected' : ''}>${n}</option>`).join('')}
                        </select></div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    
    container.innerHTML = html;

    container.querySelector('#applyCurrentTsBtn')?.addEventListener('click', () => {
        const num = parseInt(container.querySelector('#currentTsNumerator')?.value || 4, 10);
        const den = parseInt(container.querySelector('#currentTsDenominator')?.value || 4, 10);
        if (localAppServices.setCurrentTimeSignature) {
            localAppServices.setCurrentTimeSignature(num, den);
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set time signature to ${num}/${den}`);
            showNotification(`Time signature set to ${num}/${den}`, 1500);
            renderTimeSignatureContent();
        }
    });

    container.querySelector('#addTsPointBtn')?.addEventListener('click', () => {
        if (localAppServices.addTimeSignatureChange) {
            const tsList = localAppServices.getTimeSignatureChanges ? localAppServices.getTimeSignatureChanges() : [];
            const lastBar = tsList.length > 0 ? Math.max(...tsList.map(t => t.barPosition)) : 0;
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Add time signature change');
            localAppServices.addTimeSignatureChange(lastBar + 4, 4, 4);
            renderTimeSignatureContent();
        }
    });

    container.querySelector('#clearAllTsPointsBtn')?.addEventListener('click', () => {
        if (localAppServices.clearTimeSignatureChanges) {
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Clear all time signature changes');
            localAppServices.clearTimeSignatureChanges();
            renderTimeSignatureContent();
        }
    });

    container.querySelectorAll('.ts-bar-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const newBar = parseFloat(e.target.value) || 1;
            if (localAppServices.updateTimeSignatureChange && localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Move time signature to bar ${newBar}`);
                localAppServices.updateTimeSignatureChange(id, newBar, undefined, undefined);
                renderTimeSignatureContent();
            }
        });
    });

    container.querySelectorAll('.ts-numerator-input').forEach(select => {
        select.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const num = parseInt(e.target.value || 4, 10);
            if (localAppServices.updateTimeSignatureChange && localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Change time signature to ${num}/4`);
                localAppServices.updateTimeSignatureChange(id, undefined, num, undefined);
                renderTimeSignatureContent();
            }
        });
    });

    container.querySelectorAll('.ts-denominator-input').forEach(select => {
        select.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const den = parseInt(e.target.value || 4, 10);
            if (localAppServices.updateTimeSignatureChange && localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Change denominator to ${den}`);
                localAppServices.updateTimeSignatureChange(id, undefined, undefined, den);
                renderTimeSignatureContent();
            }
        });
    });

    container.querySelectorAll('.delete-ts-point-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (localAppServices.removeTimeSignatureChange) {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Remove time signature change');
                localAppServices.removeTimeSignatureChange(id);
                renderTimeSignatureContent();
                showNotification('Time signature change removed', 1500);
            }
        });
    });
}

export function updateTimeSignaturePanel() {
    const container = document.getElementById('timeSignatureContent');
    if (container) renderTimeSignatureContent();
}// --- Chord Memory Panel ---

/**
 * Opens the Chord Memory panel.
 */
export function openChordMemoryPanel() {
    const win = localAppServices.createWindow?.(
        'chordMemory',
        'Chord Memory',
        '<div id="chordMemoryContent" style="padding: 12px; color: #e5e5e5;"></div>',
        { width: 450, height: 500, x: 300, y: 150 }
    );
    
    if (win) {
        setTimeout(renderChordMemoryContent, 50);
    }
}

/**
 * Renders the chord memory panel content.
 */
function renderChordMemoryContent() {
    const container = document.getElementById('chordMemoryContent');
    if (!container) return;
    
    const chords = localAppServices.getChordMemorySlots?.() || [];
    const tracks = localAppServices.getTracks?.() || [];
    const armedTrackId = localAppServices.getArmedTrackId?.();
    
    // Build track selector options
    const trackOptions = tracks
        .filter(t => t.type !== 'Audio')
        .map(t => `<option value="${t.id}" ${t.id === armedTrackId ? 'selected' : ''}>${t.name}</option>`)
        .join('');
    
    container.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <input type="text" id="chordNameInput" placeholder="Chord name (e.g., C Major)" 
                    style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;">
                <button id="storeChordBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                    Store Current Notes
                </button>
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">
                Hold multiple notes on your MIDI keyboard, then click "Store Current Notes" to save the chord.
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <h3 style="font-size: 14px; margin-bottom: 8px; color: #aaa;">Trigger Chord</h3>
            <div style="display: flex; gap: 8px; align-items: center;">
                <select id="chordTrackSelect" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;">
                    ${trackOptions || '<option value="">No instrument tracks</option>'}
                </select>
                <input type="number" id="chordDurationInput" placeholder="Duration (s)" value="0" min="0" step="0.1"
                    style="width: 100px; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;">
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <h3 style="font-size: 14px; margin-bottom: 8px; color: #aaa;">Stored Chords (${chords.length})</h3>
            <div id="chordsList" style="max-height: 250px; overflow-y: auto; border: 1px solid #333; border-radius: 4px; background: #1a1a1a;">
                ${chords.length === 0 ? '<div style="padding: 20px; text-align: center; color: #666;">No chords stored yet</div>' : ''}
            </div>
        </div>
        
        <div style="display: flex; gap: 8px;">
            <button id="clearAllChordsBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" 
                ${chords.length === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                Clear All Chords
            </button>
        </div>
    `;
    
    // Render chords list
    const chordsList = container.querySelector('#chordsList');
    if (chords.length > 0 && chordsList) {
        chordsList.innerHTML = chords.map(chord => `
            <div class="chord-item" data-id="${chord.id}" style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #333; gap: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #fff;">${chord.name}</div>
                    <div style="font-size: 10px; color: #888;">
                        ${chord.notes.length} notes: ${chord.notes.map(n => {
                            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                            const octave = Math.floor(n.pitch / 12) - 1;
                            const noteName = noteNames[n.pitch % 12];
                            return `${noteName}${octave}`;
                        }).join(', ')}
                    </div>
                </div>
                <button class="trigger-chord-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" data-id="${chord.id}">
                    ▶ Play
                </button>
                <button class="delete-chord-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-id="${chord.id}">
                    ✕
                </button>
            </div>
        `).join('');
    }
    
    // Attach event listeners
    attachChordMemoryEventListeners(container);
}

/**
 * Attaches event listeners for the chord memory panel.
 */
function attachChordMemoryEventListeners(container) {
    // Store chord button
    const storeBtn = container.querySelector('#storeChordBtn');
    storeBtn?.addEventListener('click', () => {
        const nameInput = container.querySelector('#chordNameInput');
        const name = nameInput?.value || '';
        
        // Get currently held MIDI notes from the MIDI input state
        // This would need to be tracked in state.js or eventHandlers.js
        // For now, we'll prompt the user to play notes
        showNotification('Play notes on your MIDI keyboard, then click Store again', 2000);
        
        // Alternative: Use the track's active notes if available
        const trackId = localAppServices.getArmedTrackId?.() || localAppServices.getActiveSequencerTrackId?.();
        const track = localAppServices.getTrackById?.(trackId);
        
        if (track && track.activeNotes && track.activeNotes.size > 0) {
            const notes = Array.from(track.activeNotes).map(pitch => ({
                pitch,
                velocity: 0.8
            }));
            
            if (notes.length > 0) {
                localAppServices.storeChord?.(name, notes);
                showNotification(`Stored "${name || 'Chord'}" with ${notes.length} notes`, 2000);
                nameInput.value = '';
                renderChordMemoryContent();
            }
        } else {
            showNotification('No active notes detected. Hold notes and try again.', 2000);
        }
    });
    
    // Trigger chord buttons
    container.querySelectorAll('.trigger-chord-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const chordId = e.target.dataset.id;
            const trackSelect = container.querySelector('#chordTrackSelect');
            const durationInput = container.querySelector('#chordDurationInput');
            
            const trackId = parseInt(trackSelect?.value) || null;
            const duration = parseFloat(durationInput?.value) || 0;
            
            if (chordId && localAppServices.triggerChord) {
                const success = localAppServices.triggerChord(chordId, trackId, duration);
                if (success) {
                    showNotification('Chord triggered', 1000);
                }
            }
        });
    });
    
    // Delete chord buttons
    container.querySelectorAll('.delete-chord-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const chordId = e.target.dataset.id;
            if (chordId && localAppServices.deleteChord) {
                localAppServices.deleteChord(chordId);
                showNotification('Chord deleted', 1500);
                renderChordMemoryContent();
            }
        });
    });
    
    // Clear all chords button
    const clearBtn = container.querySelector('#clearAllChordsBtn');
    clearBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all stored chords?')) {
            localAppServices.clearAllChords?.();
            showNotification('All chords cleared', 1500);
            renderChordMemoryContent();
        }
    });
}

/**
 * Updates the chord memory panel with current data.
 */
export function updateChordMemoryPanel() {
    const container = document.getElementById('chordMemoryContent');
    if (container) {
        renderChordMemoryContent();
    }
}

// ==========================================
// SCATTER/CHAOS EFFECT PANEL
// ==========================================

/**
 * Opens the Scatter/Chaos Effect panel for experimental pattern randomization.
 */
export function openScatterPanel(trackId) {
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track || track.type === 'Audio') {
        localAppServices.showNotification?.('Select an instrument track for scatter effect', 2000);
        return;
    }
    
    const win = localAppServices.createWindow?.(
        `scatter_${trackId}`,
        `Scatter - ${track.name}`,
        '<div id="scatterContent" style="padding: 12px; color: #e5e5e5;"></div>',
        { width: 420, height: 520, x: 400, y: 150 }
    );
    
    if (win) {
        setTimeout(() => renderScatterContent(trackId), 50);
    }
}

/**
 * Renders the scatter panel content.
 */
function renderScatterContent(trackId) {
    const container = document.getElementById('scatterContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    const settings = track.getScatterSettings?.() || {
        enabled: false,
        mode: 'chaos',
        timingAmount: 50,
        timingCurve: 'gaussian',
        velocityAmount: 0.3,
        velocityMin: 0.1,
        noteProbability: 1.0,
        shuffleNotes: false,
        octaveSpread: 0,
        pitchRandomSemitones: 0,
        durationAmount: 0
    };
    
    const modeOptions = ['chaos', 'jungle', 'glitch', 'humanize'].map(m => 
        `<option value="${m}" ${settings.mode === m ? 'selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`
    ).join('');
    
    const curveOptions = ['gaussian', 'uniform', 'swing'].map(c => 
        `<option value="${c}" ${settings.timingCurve === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
    ).join('');
    
    container.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="scatterEnabled" ${settings.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
                    <span style="font-weight: bold;">Enable Scatter</span>
                </label>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Mode</label>
            <select id="scatterMode" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;">
                ${modeOptions}
            </select>
            <div style="margin-top: 6px; font-size: 11px; color: #666;">
                chaos=full random | jungle=swing feel | glitch=extreme drops | humanize=subtle variation
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Timing Curve</label>
            <select id="scatterCurve" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;">
                ${curveOptions}
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Timing Amount: <span id="timingVal">${settings.timingAmount}</span>ms</label>
            <input type="range" id="scatterTiming" min="0" max="300" value="${settings.timingAmount}" style="width: 100%;">
            <div style="font-size: 10px; color: #555; margin-top: 2px;">±timing randomization in milliseconds</div>
        </div>
        
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
            <div style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Velocity: <span id="velVal">${Math.round(settings.velocityAmount * 100)}%</span></label>
                <input type="range" id="scatterVelocity" min="0" max="100" value="${settings.velocityAmount * 100}" style="width: 100%;">
            </div>
            <div style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Min Vel: <span id="velMinVal">${Math.round(settings.velocityMin * 100)}%</span></label>
                <input type="range" id="scatterVelMin" min="0" max="50" value="${settings.velocityMin * 100}" style="width: 100%;">
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Note Probability: <span id="probVal">${Math.round(settings.noteProbability * 100)}%</span></label>
            <input type="range" id="scatterProb" min="0" max="100" value="${settings.noteProbability * 100}" style="width: 100%;">
            <div style="font-size: 10px; color: #555; margin-top: 2px;">Chance each note will play (0=all drop, 100=all play)</div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="scatterShuffle" ${settings.shuffleNotes ? 'checked' : ''} style="width: 16px; height: 16px;">
                <span style="font-size: 13px;">Shuffle Note Order</span>
            </label>
        </div>
        
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
            <div style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Octave Spread: <span id="octVal">${settings.octaveSpread}</span></label>
                <input type="range" id="scatterOctave" min="0" max="3" value="${settings.octaveSpread}" style="width: 100%;">
            </div>
            <div style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Pitch Random: <span id="pitchVal">±${settings.pitchRandomSemitones}st</span></label>
                <input type="range" id="scatterPitch" min="0" max="12" value="${settings.pitchRandomSemitones}" style="width: 100%;">
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Duration Variation: <span id="durVal">${Math.round(settings.durationAmount * 100)}%</span></label>
            <input type="range" id="scatterDuration" min="0" max="100" value="${settings.durationAmount * 100}" style="width: 100%;">
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap;">
            <button id="applyScatterSettings" class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Apply</button>
            <button id="presetSubtle" class="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Subtle</button>
            <button id="presetMedium" class="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Medium</button>
            <button id="presetExtreme" class="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Extreme</button>
            <button id="presetGlitch" class="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Glitch</button>
            <button id="presetJungle" class="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Jungle</button>
        </div>
    `;
    
    // Live update value displays
    container.querySelector('#scatterTiming')?.addEventListener('input', (e) => {
        container.querySelector('#timingVal').textContent = e.target.value;
    });
    container.querySelector('#scatterVelocity')?.addEventListener('input', (e) => {
        container.querySelector('#velVal').textContent = `${e.target.value}%`;
    });
    container.querySelector('#scatterVelMin')?.addEventListener('input', (e) => {
        container.querySelector('#velMinVal').textContent = `${e.target.value}%`;
    });
    container.querySelector('#scatterProb')?.addEventListener('input', (e) => {
        container.querySelector('#probVal').textContent = `${e.target.value}%`;
    });
    container.querySelector('#scatterOctave')?.addEventListener('input', (e) => {
        container.querySelector('#octVal').textContent = e.target.value;
    });
    container.querySelector('#scatterPitch')?.addEventListener('input', (e) => {
        container.querySelector('#pitchVal').textContent = `±${e.target.value}st`;
    });
    container.querySelector('#scatterDuration')?.addEventListener('input', (e) => {
        container.querySelector('#durVal').textContent = `${e.target.value}%`;
    });
    
    const applyBtn = container.querySelector('#applyScatterSettings');
    applyBtn?.addEventListener('click', () => {
        const newSettings = {
            enabled: container.querySelector('#scatterEnabled').checked,
            mode: container.querySelector('#scatterMode').value,
            timingCurve: container.querySelector('#scatterCurve').value,
            timingAmount: parseInt(container.querySelector('#scatterTiming').value),
            velocityAmount: parseInt(container.querySelector('#scatterVelocity').value) / 100,
            velocityMin: parseInt(container.querySelector('#scatterVelMin').value) / 100,
            noteProbability: parseInt(container.querySelector('#scatterProb').value) / 100,
            shuffleNotes: container.querySelector('#scatterShuffle').checked,
            octaveSpread: parseInt(container.querySelector('#scatterOctave').value),
            pitchRandomSemitones: parseInt(container.querySelector('#scatterPitch').value),
            durationAmount: parseInt(container.querySelector('#scatterDuration').value) / 100
        };
        if (typeof track.setScatterSettings === 'function') {
            track.setScatterSettings(newSettings);
            localAppServices.showNotification?.('Scatter settings applied', 1500);
        }
    });
    
    // Preset buttons
    const presets = {
        subtle: { timingAmount: 10, velocityAmount: 0.1, noteProbability: 1.0, shuffleNotes: false, pitchRandomSemitones: 0 },
        medium: { timingAmount: 40, velocityAmount: 0.3, noteProbability: 0.95, shuffleNotes: false, pitchRandomSemitones: 0 },
        extreme: { timingAmount: 150, velocityAmount: 0.6, noteProbability: 0.7, shuffleNotes: false, pitchRandomSemitones: 0 },
        glitch: { timingAmount: 200, velocityAmount: 0.8, noteProbability: 0.5, shuffleNotes: true, pitchRandomSemitones: 5 },
        jungle: { timingAmount: 80, velocityAmount: 0.4, noteProbability: 0.9, shuffleNotes: false, pitchRandomSemitones: 0 }
    };
    
    ['subtle', 'medium', 'extreme', 'glitch', 'jungle'].forEach(presetName => {
        container.querySelector(`#preset${presetName.charAt(0).toUpperCase() + presetName.slice(1)}`)?.addEventListener('click', () => {
            const preset = presets[presetName];
            if (preset) {
                const newSettings = { ...track.getScatterSettings?.() || {}, ...preset };
                if (typeof track.setScatterSettings === 'function') {
                    track.setScatterSettings(newSettings);
                    localAppServices.showNotification?.(`Applied ${presetName} preset`, 1500);
                    renderScatterContent(trackId); // Refresh UI
                }
            }
        });
    });
}

export function updateScatterPanel(trackId) {
    const container = document.getElementById('scatterContent');
    if (container) renderScatterContent(trackId);
}

// ==========================================
// ARPEGGIATOR PANEL
// ==========================================

/**
 * Opens the Arpeggiator panel for the selected track.
 */
export function openArpeggiatorPanel(trackId) {
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track || track.type === 'Audio') {
        localAppServices.showNotification?.('Select an instrument track for arpeggiator', 2000);
        return;
    }
    
    const win = localAppServices.createWindow?.(
        `arpeggiator_${trackId}`,
        `Arpeggiator - ${track.name}`,
        '<div id="arpeggiatorContent" style="padding: 12px; color: #e5e5e5;"></div>',
        { width: 400, height: 450, x: 350, y: 200 }
    );
    
    if (win) {
        setTimeout(() => renderArpeggiatorContent(trackId), 50);
    }
}

/**
 * Renders the arpeggiator panel content.
 */
function renderArpeggiatorContent(trackId) {
    const container = document.getElementById('arpeggiatorContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    const settings = track.getArpeggiatorSettings?.() || { enabled: false, mode: 'up', octaves: 1, rate: '16n', gate: 0.8 };
    
    const modeOptions = ['up', 'down', 'updown', 'random', 'chord'].map(m => 
        `<option value="${m}" ${settings.mode === m ? 'selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`
    ).join('');
    
    const rateOptions = ['4n', '8n', '16n', '32n'].map(r => 
        `<option value="${r}" ${settings.rate === r ? 'selected' : ''}>${r}</option>`
    ).join('');
    
    container.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="arpEnabled" ${settings.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
                    <span style="font-weight: bold;">Enable Arpeggiator</span>
                </label>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Mode</label>
            <select id="arpMode" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;">
                ${modeOptions}
            </select>
        </div>
        
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
            <div style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Octaves</label>
                <input type="range" id="arpOctaves" min="1" max="4" value="${settings.octaves}" style="width: 100%;" 
                    oninput="document.getElementById('arpOctavesVal').textContent = this.value">
                <span id="arpOctavesVal" style="font-size: 12px; color: #888;">${settings.octaves}</span>
            </div>
            <div style="flex: 1;">
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Gate</label>
                <input type="range" id="arpGate" min="0.1" max="1" step="0.05" value="${settings.gate}" style="width: 100%;" 
                    oninput="document.getElementById('arpGateVal').textContent = this.value">
                <span id="arpGateVal" style="font-size: 12px; color: #888;">${settings.gate}</span>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 12px; color: #aaa;">Rate</label>
            <select id="arpRate" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;">
                ${rateOptions}
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="arpHold" ${settings.hold ? 'checked' : ''} style="width: 16px; height: 16px;">
                <span style="font-size: 13px;">Hold (Latch mode)</span>
            </label>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 20px;">
            <button id="applyArpSettings" class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Apply Settings</button>
            <button id="testArpBtn" class="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600">Test (Play C Major)</button>
        </div>
    `;
    
    const applyBtn = container.querySelector('#applyArpSettings');
    applyBtn?.addEventListener('click', () => {
        const newSettings = {
            enabled: container.querySelector('#arpEnabled').checked,
            mode: container.querySelector('#arpMode').value,
            octaves: parseInt(container.querySelector('#arpOctaves').value),
            rate: container.querySelector('#arpRate').value,
            gate: parseFloat(container.querySelector('#arpGate').value),
            hold: container.querySelector('#arpHold').checked
        };
        if (typeof track.setArpeggiatorSettings === 'function') {
            track.setArpeggiatorSettings(newSettings);
            localAppServices.showNotification?.('Arpeggiator settings applied', 1500);
        }
    });
    
    const testBtn = container.querySelector('#testArpBtn');
    testBtn?.addEventListener('click', () => {
        const testNotes = [60, 64, 67];
        if (settings.enabled || container.querySelector('#arpEnabled').checked) {
            if (!settings.enabled) track.setArpeggiatorSettings?.({ enabled: true });
            testNotes.forEach(pitch => track.arpeggiatorNoteOn?.(pitch, 0.8));
            setTimeout(() => {
                testNotes.forEach(pitch => track.arpeggiatorNoteOff?.(pitch));
                localAppServices.showNotification?.('Arpeggiator test complete', 1500);
            }, 2000);
        } else {
            localAppServices.showNotification?.('Enable arpeggiator first', 1500);
        }
    });
}

export function updateArpeggiatorPanel(trackId) {
    const container = document.getElementById('arpeggiatorContent');
    if (container) renderArpeggiatorContent(trackId);
}


// ==========================================
// TRACK GROUPS PANEL
// ==========================================

/**
 * Opens the Track Groups panel for managing track groupings.
 */
export function openTrackGroupsPanel(savedState = null) {
    const windowId = 'trackGroups';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateTrackGroupsPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackGroupsContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 500, 
        height: 450, 
        minWidth: 400, 
        minHeight: 300,
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

    const win = localAppServices.createWindow(windowId, 'Track Groups', contentContainer, options);
    
    if (win?.element) {
        renderTrackGroupsContent();
    }
    
    return win;
}

/**
 * Renders the track groups content.
 */
function renderTrackGroupsContent() {
    const container = document.getElementById('trackGroupsContent');
    if (!container) return;

    const groups = localAppServices.getTrackGroups ? localAppServices.getTrackGroups() : [];
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    let html = `
        <div class="mb-3 flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">
                ${groups.length} group${groups.length !== 1 ? 's' : ''}
            </span>
            <button id="addTrackGroupBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                + Create Group
            </button>
        </div>
        
        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                Track groups let you control multiple tracks together. Adjust volume, mute, or solo entire groups at once.
            </div>
        </div>
    `;
    
    if (groups.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No track groups created.</p>
                <p class="text-xs mt-2">Click "Create Group" to organize your tracks.</p>
            </div>
        `;
    } else {
        html += `<div class="space-y-3">`;
        
        groups.forEach(group => {
            const groupTracks = group.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean);
            
            html += `
                <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 track-group-item" data-id="${group.id}" style="border-left: 4px solid ${group.color}">
                    <div class="flex items-center justify-between mb-2">
                        <input type="text" class="group-name-input p-1 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200 font-medium w-40"
                            value="${group.name}" data-id="${group.id}" placeholder="Group name">
                        <div class="flex items-center gap-2">
                            <input type="color" class="group-color-input w-6 h-6 rounded cursor-pointer" 
                                value="${group.color}" data-id="${group.id}" title="Group color">
                            <button class="delete-group-btn px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" data-id="${group.id}">
                                Delete
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3 mb-2">
                        <div class="flex items-center gap-1">
                            <label class="text-xs text-gray-400 dark:text-gray-500">Vol</label>
                            <input type="range" class="group-volume-slider w-24" min="0" max="1" step="0.01" 
                                value="${group.volume}" data-id="${group.id}">
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono w-10">${Math.round(group.volume * 100)}%</span>
                        </div>
                        <button class="group-mute-btn px-2 py-1 text-xs rounded ${group.muted ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300'}" data-id="${group.id}">
                            ${group.muted ? 'Muted' : 'Mute'}
                        </button>
                        <button class="group-solo-btn px-2 py-1 text-xs rounded ${group.solo ? 'bg-yellow-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300'}" data-id="${group.id}">
                            ${group.solo ? 'Solo' : 'Solo'}
                        </button>
                    </div>
                    
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        ${groupTracks.length} track${groupTracks.length !== 1 ? 's' : ''}: ${groupTracks.length > 0 ? groupTracks.map(t => t.name).join(', ') : 'None'}
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <select class="add-track-to-group-select p-1 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200 flex-1" data-id="${group.id}">
                            <option value="">+ Add track to group...</option>
                            ${tracks.filter(t => !group.trackIds.includes(t.id)).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    
    // Add event listeners
    const addGroupBtn = container.querySelector('#addTrackGroupBtn');
    addGroupBtn?.addEventListener('click', () => {
        const name = prompt('Enter group name:', 'New Group');
        if (name) {
            localAppServices.addTrackGroup?.(name, [], '#6366f1');
            showNotification('Track group created', 1500);
            renderTrackGroupsContent();
        }
    });
    
    // Group name change
    container.querySelectorAll('.group-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const groupId = parseInt(e.target.dataset.id, 10);
            localAppServices.updateTrackGroup?.(groupId, { name: e.target.value });
        });
    });
    
    // Group color change
    container.querySelectorAll('.group-color-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const groupId = parseInt(e.target.dataset.id, 10);
            localAppServices.updateTrackGroup?.(groupId, { color: e.target.value });
            renderTrackGroupsContent();
        });
    });
    
    // Volume slider
    container.querySelectorAll('.group-volume-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const groupId = parseInt(e.target.dataset.id, 10);
            const volume = parseFloat(e.target.value);
            localAppServices.setTrackGroupVolume?.(groupId, volume);
            const span = e.target.nextElementSibling;
            if (span) span.textContent = Math.round(volume * 100) + '%';
        });
    });
    
    // Mute button
    container.querySelectorAll('.group-mute-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupId = parseInt(e.target.dataset.id, 10);
            localAppServices.toggleTrackGroupMute?.(groupId);
            renderTrackGroupsContent();
        });
    });
    
    // Solo button
    container.querySelectorAll('.group-solo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupId = parseInt(e.target.dataset.id, 10);
            localAppServices.toggleTrackGroupSolo?.(groupId);
            renderTrackGroupsContent();
        });
    });
    
    // Delete group
    container.querySelectorAll('.delete-group-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupId = parseInt(e.target.dataset.id, 10);
            if (confirm('Delete this track group?')) {
                localAppServices.removeTrackGroup?.(groupId);
                showNotification('Group deleted', 1500);
                renderTrackGroupsContent();
            }
        });
    });
    
    // Add track to group
    container.querySelectorAll('.add-track-to-group-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const groupId = parseInt(e.target.dataset.id, 10);
            const trackId = parseInt(e.target.value, 10);
            if (trackId) {
                localAppServices.addTrackToGroup?.(groupId, trackId);
                showNotification('Track added to group', 1500);
                renderTrackGroupsContent();
            }
            e.target.value = '';
        });
    });
}

/**
 * Updates the track groups panel with current data.
 */
export function updateTrackGroupsPanel() {
    const container = document.getElementById('trackGroupsContent');
    if (container) {
        renderTrackGroupsContent();
    }
}

// ==========================================
// GROOVE TEMPLATES PANEL
// ==========================================

/**
 * Opens the Groove Templates panel for applying swing/groove to tracks.
 */
export function openGrooveTemplatesPanel(savedState = null) {
    const windowId = 'grooveTemplates';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateGrooveTemplatesPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'grooveTemplatesContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 450, 
        height: 500, 
        minWidth: 350, 
        minHeight: 400,
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

    const win = localAppServices.createWindow(windowId, 'Groove Templates', contentContainer, options);
    
    if (win?.element) {
        renderGrooveTemplatesContent();
    }
    
    return win;
}

/**
 * Renders the groove templates content.
 */
function renderGrooveTemplatesContent() {
    const container = document.getElementById('grooveTemplatesContent');
    if (!container) return;

    const presets = localAppServices.getGroovePresets ? localAppServices.getGroovePresets() : [];
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    let html = `
        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Groove Templates</strong> apply swing/shuffle timing to sequencer notes. 
                Even-numbered 16th notes are delayed for a swung feel.
            </div>
        </div>
        
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Available Presets</h3>
            <div class="grid grid-cols-1 gap-1">
    `;
    
    presets.forEach(preset => {
        const swingPercent = Math.round(preset.swingAmount * 100);
        html += `
            <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex justify-between items-center">
                <div>
                    <span class="font-medium text-sm text-gray-800 dark:text-gray-200">${preset.name}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">(${swingPercent}% swing)</span>
                </div>
                <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">${preset.id}</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Apply to Track</h3>
            <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
                Select a track and groove preset below:
            </div>
        </div>
    `;
    
    if (tracks.length === 0) {
        html += `
            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                No tracks available. Create a track first.
            </div>
        `;
    } else {
        html += `<div class="space-y-2">`;
        
        tracks.forEach(track => {
            if (track.type === 'Audio') return; // Skip audio tracks
            
            const currentGroove = track.groovePreset || 'none';
            const currentPreset = presets.find(p => p.id === currentGroove);
            const currentName = currentPreset ? currentPreset.name : 'None';
            
            html += `
                <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-medium text-sm text-gray-800 dark:text-gray-200">${track.name}</span>
                        <span class="text-xs px-2 py-0.5 rounded ${currentGroove === 'none' ? 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-400' : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'}">
                            ${currentName}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <select class="groove-select flex-1 p-1 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200" 
                            data-track-id="${track.id}">
                            ${presets.map(p => `<option value="${p.id}" ${p.id === currentGroove ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                        <button class="apply-groove-btn px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600" data-track-id="${track.id}">
                            Apply
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    
    // Add event listeners for apply buttons
    container.querySelectorAll('.apply-groove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const select = container.querySelector(`.groove-select[data-track-id="${trackId}"]`);
            if (select) {
                const grooveId = select.value;
                const track = tracks.find(t => t.id === trackId);
                if (track && typeof track.setGroovePreset === 'function') {
                    track.setGroovePreset(grooveId);
                    showNotification(`Groove "${grooveId}" applied to ${track.name}`, 1500);
                    renderGrooveTemplatesContent();
                } else {
                    showNotification('Could not apply groove', 1500);
                }
            }
        });
    });
    
    // Add event listeners for select changes (auto-apply on change)
    container.querySelectorAll('.groove-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const grooveId = e.target.value;
            const track = tracks.find(t => t.id === trackId);
            if (track && typeof track.setGroovePreset === 'function') {
                track.setGroovePreset(grooveId);
                showNotification(`Groove "${grooveId}" applied to ${track.name}`, 1500);
                renderGrooveTemplatesContent();
            }
        });
    });
}

/**
 * Updates the groove templates panel with current data.
 */
export function updateGrooveTemplatesPanel() {
    const container = document.getElementById('grooveTemplatesContent');
    if (container) {
        renderGrooveTemplatesContent();
    }
}

// ==========================================
// PATTERN CHAINS PANEL
// ==========================================

/**
 * Opens the Pattern Chains panel for managing sequence chains on tracks.
 */
export function openPatternChainsPanel(savedState = null) {
    const windowId = 'patternChains';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPatternChainsContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'patternChainsContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 500, 
        height: 600, 
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

    const win = localAppServices.createWindow(windowId, 'Pattern Chains', contentContainer, options);
    
    if (win?.element) {
        renderPatternChainsContent();
    }
    
    return win;
}

/**
 * Renders the pattern chains content.
 */
function renderPatternChainTrackContent() {
    const container = document.getElementById('patternChainTrackContent');
    const trackSelect = document.getElementById('patternChainTrackSelect');
    if (!container || !trackSelect) return;

    const trackId = parseInt(trackSelect.value, 10);
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500 dark:text-gray-400">Track not found</div>';
        return;
    }

    const chains = track.patternChains || [];
    const sequences = track.sequences || [];
    
    let html = `
        <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Pattern Chains</h3>
            <button id="createChainBtn" class="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                + New Chain
            </button>
        </div>
    `;
    
    if (chains.length === 0) {
        html += `
            <div class="text-center py-4 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded">
                No pattern chains yet. Click "New Chain" to create one.
            </div>
        `;
    } else {
        html += `<div class="space-y-2">`;
        
        chains.forEach((chain, chainIndex) => {
            const isActive = track.activePatternChainId === chain.id;
            
            html += `
                <div class="p-2 bg-white dark:bg-slate-700 rounded border ${isActive ? 'border-purple-400 dark:border-purple-600' : 'border-gray-200 dark:border-slate-600'}" data-chain-id="${chain.id}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <input type="text" class="chain-name-input px-2 py-1 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded w-32" 
                                value="${chain.name}" data-chain-id="${chain.id}">
                            ${isActive ? '<span class="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">Active</span>' : ''}
                        </div>
                        <div class="flex items-center gap-1">
                            <button class="activate-chain-btn px-2 py-1 text-xs ${isActive ? 'bg-gray-400' : 'bg-purple-500'} text-white rounded hover:bg-purple-600" 
                                data-chain-id="${chain.id}" ${isActive ? 'disabled' : ''}>
                                ${isActive ? 'Active' : 'Activate'}
                            </button>
                            <button class="delete-chain-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-chain-id="${chain.id}">
                                ✕
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-2">
                        <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <input type="checkbox" class="chain-loop-checkbox" data-chain-id="${chain.id}" ${chain.loopEnabled ? 'checked' : ''}>
                            Loop chain
                        </label>
                    </div>
                    
                    <div class="chain-patterns mb-2" data-chain-id="${chain.id}">
            `;
            
            if (chain.patterns && chain.patterns.length > 0) {
                chain.patterns.forEach((pattern, patternIndex) => {
                    html += `
                        <div class="flex items-center gap-1 mb-1 p-1 bg-gray-50 dark:bg-slate-600 rounded text-xs" data-pattern-index="${patternIndex}">
                            <span class="text-gray-400">${patternIndex + 1}.</span>
                            <select class="pattern-sequence-select flex-1 p-1 bg-white dark:bg-slate-500 border border-gray-200 dark:border-slate-400 rounded text-xs"
                                data-chain-id="${chain.id}" data-pattern-index="${patternIndex}">
                                ${sequences.map(s => `<option value="${s.id}" ${s.id === pattern.sequenceId ? 'selected' : ''}>${s.name}</option>`).join('')}
                            </select>
                            <span class="text-gray-400">×</span>
                            <input type="number" class="pattern-repeat-input w-12 p-1 bg-white dark:bg-slate-500 border border-gray-200 dark:border-slate-400 rounded text-xs text-center"
                                value="${pattern.repeatCount}" min="1" max="16" step="1" data-chain-id="${chain.id}" data-pattern-index="${patternIndex}">
                            <button class="remove-pattern-btn text-red-500 hover:text-red-700" data-chain-id="${chain.id}" data-pattern-index="${patternIndex}">
                                ✕
                            </button>
                        </div>
                    `;
                });
            } else {
                html += `
                    <div class="text-center py-2 text-gray-400 text-xs">
                        No patterns in chain. Add patterns below.
                    </div>
                `;
            }
            
            html += `
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <select class="add-pattern-sequence-select flex-1 p-1 text-xs bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded" 
                            data-chain-id="${chain.id}">
                            ${sequences.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                        <button class="add-pattern-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" data-chain-id="${chain.id}">
                            Add Pattern
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    
    // Add event listeners
    attachPatternChainEventListeners(track, container);
}

/**
 * Attaches event listeners for pattern chain UI elements.
 */
function attachPatternChainEventListeners(track, container) {
    // Create new chain button
    const createBtn = document.getElementById('createChainBtn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            if (typeof track.createPatternChain === 'function') {
                const newChain = track.createPatternChain(`Chain ${(track.patternChains?.length || 0) + 1}`);
                if (newChain) {
                    showNotification(`Created "${newChain.name}"`, 1500);
                    renderPatternChainTrackContent();
                }
            }
        });
    }
    
    // Chain name inputs
    container.querySelectorAll('.chain-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const chainId = e.target.dataset.chainId;
            const newName = e.target.value;
            if (typeof track.renamePatternChain === 'function') {
                track.renamePatternChain(chainId, newName);
            }
        });
    });
    
    // Activate chain buttons
    container.querySelectorAll('.activate-chain-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const chainId = e.target.dataset.chainId;
            if (typeof track.setActivePatternChain === 'function') {
                track.setActivePatternChain(chainId);
                showNotification(`Chain activated`, 1500);
                renderPatternChainTrackContent();
            }
        });
    });
    
    // Delete chain buttons
    container.querySelectorAll('.delete-chain-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const chainId = e.target.dataset.chainId;
            if (typeof track.deletePatternChain === 'function') {
                if (confirm('Delete this pattern chain?')) {
                    track.deletePatternChain(chainId);
                    showNotification(`Chain deleted`, 1500);
                    renderPatternChainTrackContent();
                }
            }
        });
    });
    
    // Loop checkboxes
    container.querySelectorAll('.chain-loop-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const chainId = e.target.dataset.chainId;
            const loopEnabled = e.target.checked;
            if (typeof track.setChainLoopEnabled === 'function') {
                track.setChainLoopEnabled(chainId, loopEnabled);
            }
        });
    });
    
    // Pattern sequence selects
    container.querySelectorAll('.pattern-sequence-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const chainId = e.target.dataset.chainId;
            const patternIndex = parseInt(e.target.dataset.patternIndex, 10);
            const sequenceId = e.target.value;
            // Remove current and add new at position
            if (typeof track.removeSequenceFromChain === 'function' && typeof track.addSequenceToChain === 'function') {
                track.removeSequenceFromChain(chainId, patternIndex);
                track.addSequenceToChain(chainId, sequenceId, 1, patternIndex);
            }
        });
    });
    
    // Pattern repeat inputs
    container.querySelectorAll('.pattern-repeat-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const chainId = e.target.dataset.chainId;
            const patternIndex = parseInt(e.target.dataset.patternIndex, 10);
            const repeatCount = parseInt(e.target.value, 10) || 1;
            if (typeof track.setPatternRepeatCount === 'function') {
                track.setPatternRepeatCount(chainId, patternIndex, repeatCount);
            }
        });
    });
    
    // Remove pattern buttons
    container.querySelectorAll('.remove-pattern-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const chainId = e.target.dataset.chainId;
            const patternIndex = parseInt(e.target.dataset.patternIndex, 10);
            if (typeof track.removeSequenceFromChain === 'function') {
                track.removeSequenceFromChain(chainId, patternIndex);
                showNotification(`Pattern removed`, 1500);
                renderPatternChainTrackContent();
            }
        });
    });
    
    // Add pattern buttons
    container.querySelectorAll('.add-pattern-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const chainId = e.target.dataset.chainId;
            const select = container.querySelector(`.add-pattern-sequence-select[data-chain-id="${chainId}"]`);
            if (select && typeof track.addSequenceToChain === 'function') {
                const sequenceId = select.value;
                track.addSequenceToChain(chainId, sequenceId, 1);
                showNotification(`Pattern added`, 1500);
                renderPatternChainTrackContent();
            }
        });
    });
}

/**
 * Updates the pattern chains panel with current data.
 */
export function updatePatternChainsPanel() {
    const container = document.getElementById('patternChainsContent');
    if (container) {
        renderPatternChainsContent();
    }
}
/**
 * Opens the Track Templates panel.
 * Track templates allow saving/loading track configurations as presets.
 */
export function openTrackTemplatesPanel(savedState = null) {
    const windowId = 'trackTemplates';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTrackTemplatesContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackTemplatesContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 500, 
        height: 600, 
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

    const win = localAppServices.createWindow(windowId, 'Track Templates', contentContainer, options);
    
    if (win?.element) {
        renderTrackTemplatesContent();
    }
    
    return win;
}

/**
 * Renders the track templates content.
 */
function renderTrackTemplatesContent() {
    const container = document.getElementById('trackTemplatesContent');
    if (!container) return;

    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const templateNames = localAppServices.getTrackTemplateNames ? localAppServices.getTrackTemplateNames() : [];
    
    let html = `
        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Track Templates</strong> let you save and load track configurations (instrument type, effects, settings) as presets.
                Create a template from an existing track, then apply it to new tracks.
            </div>
        </div>
    `;
    
    // Section: Create template from track
    html += `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Save Track as Template</h3>
    `;
    
    if (tracks.length === 0) {
        html += `
            <div class="text-center py-2 text-gray-500 dark:text-gray-400 text-xs">
                No tracks available. Create a track first.
            </div>
        `;
    } else {
        html += `
            <div class="flex gap-2 mb-2">
                <select id="trackTemplateSourceTrack" class="flex-1 p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                    ${tracks.map(t => `<option value="${t.id}">${t.name} (${t.type})</option>`).join('')}
                </select>
            </div>
            <div class="flex gap-2">
                <input type="text" id="trackTemplateNameInput" placeholder="Template name..." 
                    class="flex-1 p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                <button id="saveTrackTemplateBtn" class="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600">
                    Save
                </button>
            </div>
        `;
    }
    
    html += `</div>`;
    
    // Section: Saved templates
    html += `
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Saved Templates</h3>
    `;
    
    if (templateNames.length === 0) {
        html += `
            <div class="text-center py-4 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded">
                No saved templates yet. Save a track configuration above.
            </div>
        `;
    } else {
        html += `<div class="space-y-2">`;
        
        templateNames.forEach(name => {
            const template = localAppServices.getTrackTemplate ? localAppServices.getTrackTemplate(name) : null;
            if (template) {
                html += `
                    <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">${name}</span>
                                <span class="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">${template.type}</span>
                                ${template.color ? `<span class="w-3 h-3 rounded-full" style="background-color: ${template.color}"></span>` : ''}
                            </div>
                            <div class="flex items-center gap-1">
                                <button class="apply-track-template-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" 
                                    data-template-name="${name}">
                                    Apply to New Track
                                </button>
                                <button class="rename-track-template-btn px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600" 
                                    data-template-name="${name}">
                                    ✎
                                </button>
                                <button class="delete-track-template-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" 
                                    data-template-name="${name}">
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            ${template.activeEffects?.length || 0} effects • Pan: ${template.pan?.toFixed(1) || 0}
                        </div>
                    </div>
                `;
            }
        });
        
        html += `</div>`;
    }
    
    html += `</div>`;
    
    container.innerHTML = html;
    
    // Wire up event handlers
    wireTrackTemplatesEvents();
}

/**
 * Wires up event handlers for the track templates panel.
 */
function wireTrackTemplatesEvents() {
    const container = document.getElementById('trackTemplatesContent');
    if (!container) return;
    
    const showNotification = localAppServices.showNotification || ((msg, duration) => console.log(msg));
    
    // Save template button
    const saveBtn = document.getElementById('saveTrackTemplateBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const trackSelect = document.getElementById('trackTemplateSourceTrack');
            const nameInput = document.getElementById('trackTemplateNameInput');
            
            if (!trackSelect || !nameInput) return;
            
            const trackId = parseInt(trackSelect.value, 10);
            const templateName = nameInput.value.trim();
            
            if (!templateName) {
                showNotification('Please enter a template name', 2000);
                return;
            }
            
            const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
            const track = tracks.find(t => t.id === trackId);
            
            if (!track) {
                showNotification('Track not found', 2000);
                return;
            }
            
            // Get track data
            const trackData = {
                type: track.type,
                name: track.name,
                color: track.color,
                pan: track.pan,
                sendLevels: track.sendLevels,
                groovePreset: track.groovePreset,
                delayCompensationMs: track.delayCompensationMs,
                autoDelayCompensation: track.autoDelayCompensation,
                synthEngineType: track.synthEngineType,
                synthParams: track.synthParams,
                activeEffects: track.activeEffects
            };
            
            if (localAppServices.saveTrackTemplate) {
                const success = localAppServices.saveTrackTemplate(templateName, trackData);
                if (success) {
                    showNotification(`Template "${templateName}" saved`, 2000);
                    nameInput.value = '';
                    renderTrackTemplatesContent();
                } else {
                    showNotification('Failed to save template', 2000);
                }
            }
        });
    }
    
    // Apply template buttons
    container.querySelectorAll('.apply-track-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const templateName = e.target.dataset.templateName;
            
            if (localAppServices.getTrackTemplate) {
                const template = localAppServices.getTrackTemplate(templateName);
                if (template) {
                    // Create new track from template
                    if (localAppServices.addTrack) {
                        const newTrackId = localAppServices.addTrack(template.type, template);
                        showNotification(`Created new ${template.type} track from template "${templateName}"`, 2000);
                    }
                }
            }
        });
    });
    
    // Rename template buttons
    container.querySelectorAll('.rename-track-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const oldName = e.target.dataset.templateName;
            const newName = prompt('Enter new template name:', oldName);
            
            if (newName && newName.trim() !== '' && newName !== oldName) {
                if (localAppServices.renameTrackTemplate) {
                    const success = localAppServices.renameTrackTemplate(oldName, newName.trim());
                    if (success) {
                        showNotification(`Template renamed to "${newName}"`, 2000);
                        renderTrackTemplatesContent();
                    } else {
                        showNotification('Failed to rename template (name may already exist)', 2000);
                    }
                }
            }
        });
    });
    
    // Delete template buttons
    container.querySelectorAll('.delete-track-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const templateName = e.target.dataset.templateName;
            
            if (confirm(`Delete template "${templateName}"?`)) {
                if (localAppServices.deleteTrackTemplate) {
                    const success = localAppServices.deleteTrackTemplate(templateName);
                    if (success) {
                        showNotification(`Template "${templateName}" deleted`, 2000);
                        renderTrackTemplatesContent();
                    }
                }
            }
        });
    });
}

/**
 * Updates the track templates panel with current data.
 */
export function updateTrackTemplatesPanel() {
    const container = document.getElementById('trackTemplatesContent');
    if (container) {
        renderTrackTemplatesContent();
    }
}

// --- Automation Lanes Panel ---
export function openAutomationLanesPanel(savedState = null) {
    const windowId = 'automationLanes';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderAutomationLanesContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'automationLanesContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 600, 
        height: 500, 
        minWidth: 400, 
        minHeight: 300,
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

    const win = localAppServices.createWindow(windowId, 'Automation Lanes', contentContainer, options);
    
    if (win?.element) {
        renderAutomationLanesContent();
    }
    
    return win;
}

function renderAutomationLanesContent() {
    const container = document.getElementById('automationLanesContent');
    if (!container) return;

    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const activeTrackId = localAppServices.getActiveSequencerTrackIdState ? localAppServices.getActiveSequencerTrackIdState() : null;
    const track = tracks.find(t => t.id === activeTrackId);
    
    const automationParams = [
        { id: 'volume', name: 'Volume', min: 0, max: 1, unit: '%', defaultVal: 1 },
        { id: 'pan', name: 'Pan', min: -1, max: 1, unit: '', defaultVal: 0 },
        { id: 'filterFreq', name: 'Filter Frequency', min: 20, max: 20000, unit: 'Hz', defaultVal: 20000, logScale: true },
        { id: 'filterRes', name: 'Filter Resonance', min: 0, max: 20, unit: 'dB', defaultVal: 0 },
        { id: 'reverbMix', name: 'Reverb Mix', min: 0, max: 1, unit: '%', defaultVal: 0 },
        { id: 'reverbDecay', name: 'Reverb Decay', min: 0.1, max: 10, unit: 's', defaultVal: 1.5 },
        { id: 'delayMix', name: 'Delay Mix', min: 0, max: 1, unit: '%', defaultVal: 0 },
        { id: 'delayTime', name: 'Delay Time', min: 0.01, max: 2, unit: 's', defaultVal: 0.25 },
        { id: 'delayFeedback', name: 'Delay Feedback', min: 0, max: 0.9, unit: '', defaultVal: 0.3 },
        { id: 'chorusMix', name: 'Chorus Mix', min: 0, max: 1, unit: '%', defaultVal: 0 },
        { id: 'chorusRate', name: 'Chorus Rate', min: 0.1, max: 10, unit: 'Hz', defaultVal: 1.5 },
        { id: 'chorusDepth', name: 'Chorus Depth', min: 0, max: 1, unit: '', defaultVal: 0.5 },
        { id: 'distortion', name: 'Distortion', min: 0, max: 1, unit: '%', defaultVal: 0 },
        { id: 'bitcrush', name: 'Bitcrusher', min: 1, max: 16, unit: 'bits', defaultVal: 16 },
        { id: 'pitchShift', name: 'Pitch Shift', min: -12, max: 12, unit: 'st', defaultVal: 0 },
        { id: 'drive', name: 'Drive', min: 0, max: 1, unit: '%', defaultVal: 0 },
        { id: 'width', name: 'Stereo Width', min: 0, max: 1, unit: '%', defaultVal: 1 }
    ];

    let html = `
        <div class="mb-3 flex justify-between items-center">
            <div>
                <select id="automationTrackSelect" class="p-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600">
                    <option value="">Select Track...</option>
                    ${tracks.map(t => `<option value="${t.id}" ${t.id === activeTrackId ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
            </div>
            <div class="flex gap-2">
                <select id="automationParamSelect" class="p-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600">
                    ${automationParams.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
                <button id="clearAutomationBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">
                    Clear All
                </button>
            </div>
        </div>
        <div id="automationCanvasContainer" class="bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 relative" style="height: 300px;">
            <canvas id="automationCanvas" class="w-full h-full"></canvas>
        </div>
        <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Click to add points. Right-click to remove. Drag points to edit.
        </div>
    `;

    container.innerHTML = html;

    // Track selection handler
    const trackSelect = document.getElementById('automationTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            if (localAppServices.setActiveSequencerTrackIdState) {
                localAppServices.setActiveSequencerTrackIdState(parseInt(e.target.value) || null);
            }
            renderAutomationLanesContent();
        });
    }

    // Clear automation button
    const clearBtn = document.getElementById('clearAutomationBtn');
    if (clearBtn && track) {
        clearBtn.addEventListener('click', () => {
            const param = document.getElementById('automationParamSelect')?.value || 'volume';
            if (track.clearAutomation) {
                track.clearAutomation(param);
                drawAutomationLane(track, param);
            }
        });
    }

    // Canvas click handling
    const canvas = document.getElementById('automationCanvas');
    if (canvas && track) {
        const param = document.getElementById('automationParamSelect')?.value || 'volume';
        setupAutomationCanvas(canvas, track, param);
    }
}

function setupAutomationCanvas(canvas, track, param) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    let isDragging = false;
    let selectedPointIndex = -1;

    function draw() {
        const automation = track?.automation?.[param] || [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * canvas.height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw automation line
        if (automation.length > 0) {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            automation.forEach((point, idx) => {
                const x = (point.time / 60) * canvas.width;
                const y = canvas.height - (point.value * canvas.height);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Draw points
            automation.forEach((point, idx) => {
                const x = (point.time / 60) * canvas.width;
                const y = canvas.height - (point.value * canvas.height);
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = idx === selectedPointIndex ? '#ec4899' : '#8b5cf6';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    }

    draw();

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const automation = track?.automation?.[param] || [];

        // Check if clicking on existing point
        selectedPointIndex = -1;
        automation.forEach((point, idx) => {
            const x = (point.time / 60) * canvas.width;
            const y = canvas.height - (point.value * canvas.height);
            const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
            if (dist < 10) selectedPointIndex = idx;
        });

        if (e.button === 2 && selectedPointIndex >= 0) {
            // Right-click: remove point
            const point = automation[selectedPointIndex];
            if (track.removeAutomationPoint) {
                track.removeAutomationPoint(param, point.time);
            }
            selectedPointIndex = -1;
            draw();
        } else if (selectedPointIndex < 0) {
            // Left-click on empty area: add point
            const time = (mouseX / canvas.width) * 60;
            const value = 1 - (mouseY / canvas.height);
            if (track.addAutomationPoint) {
                track.addAutomationPoint(param, time, Math.max(0, Math.min(1, value)), 'linear');
            }
            draw();
        } else {
            isDragging = true;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || selectedPointIndex < 0) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const automation = track?.automation?.[param] || [];
        const point = automation[selectedPointIndex];
        if (point) {
            const time = Math.max(0, Math.min(60, (mouseX / canvas.width) * 60));
            const value = Math.max(0, Math.min(1, 1 - (mouseY / canvas.height)));
            point.time = time;
            point.value = value;
            draw();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Param select change handler
    const paramSelect = document.getElementById('automationParamSelect');
    if (paramSelect) {
        paramSelect.addEventListener('change', (e) => {
            setupAutomationCanvas(canvas, track, e.target.value);
        });
    }
}

export function updateAutomationLanesPanel() {
    const container = document.getElementById('automationLanesContent');
    if (container) {
        renderAutomationLanesContent();
    }
}

// --- Micro Tuning Panel ---
export function openMicroTuningPanel(savedState = null) {
    const windowId = 'microTuning';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderMicroTuningPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'microTuningContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 400, 
        height: 500, 
        minWidth: 350, 
        minHeight: 400,
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

    const win = localAppServices.createWindow(windowId, 'Micro Tuning', contentContainer, options);
    
    if (win?.element) {
        renderMicroTuningPanelContent();
    }
    
    return win;
}

function renderMicroTuningPanelContent() {
    const container = document.getElementById('microTuningContent');
    if (!container) return;
    
    const enabled = localAppServices.getMicroTuningEnabled?.() ?? false;
    const currentPreset = localAppServices.getMicroTuningPreset?.() ?? 'equal';
    const currentCents = localAppServices.getMicroTuningCents?.() ?? Array(12).fill(0);
    const presets = localAppServices.getMicroTuningPresets?.() ?? [];
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const html = `
        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium dark:text-slate-200">Micro Tuning</span>
                <button id="microTuningToggleBtn" class="px-3 py-1 text-xs rounded font-medium ${enabled ? 'bg-blue-500 text-white' : 'bg-gray-400 text-gray-800'}">
                    ${enabled ? 'ON' : 'OFF'}
                </button>
            </div>
            
            <p class="text-xs text-gray-600 dark:text-slate-400">
                Custom tuning tables for non-standard scales (microtonal, just intonation, etc.).
                Each semitone can be adjusted in cents (1/100 of a semitone).
            </p>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Tuning Preset</label>
                <select id="microTuningPresetSelect" class="w-full mt-1 p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                    ${presets.map(p => `
                        <option value="${p.id}" ${currentPreset === p.id ? 'selected' : ''}>${p.name}</option>
                    `).join('')}
                </select>
                <p class="text-xs text-gray-500 dark:text-slate-500 mt-1" id="presetDescription">
                    ${presets.find(p => p.id === currentPreset)?.description || ''}
                </p>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Custom Tuning (Cents Deviation from Equal Temperament)</label>
                <p class="text-xs text-gray-500 dark:text-slate-500 mb-1">
                    Adjust each semitone's pitch in cents. 0 = equal temperament. Positive = higher, Negative = lower.
                </p>
                <div class="grid grid-cols-12 gap-0.5" id="centsEditor">
                    ${noteNames.map((note, i) => `
                        <div class="flex flex-col items-center">
                            <span class="text-xs font-medium dark:text-slate-400 mb-0.5">${note}</span>
                            <input type="number" class="cents-input w-full p-0.5 text-center text-xs border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" 
                                   data-index="${i}" value="${currentCents[i].toFixed(0)}" 
                                   min="-100" max="100" step="1">
                        </div>
                    `).join('')}
                </div>
                <div class="flex gap-2 mt-2">
                    <button id="resetCentsBtn" class="flex-1 px-2 py-1 text-xs rounded bg-gray-300 dark:bg-slate-600 dark:text-slate-200 hover:bg-gray-400 dark:hover:bg-slate-500">
                        Reset to 0
                    </button>
                    <button id="randomizeCentsBtn" class="flex-1 px-2 py-1 text-xs rounded bg-gray-300 dark:bg-slate-600 dark:text-slate-200 hover:bg-gray-400 dark:hover:bg-slate-500">
                        Randomize ±25
                    </button>
                </div>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Current Tuning Table</label>
                <div class="mt-1 p-2 bg-gray-200 dark:bg-slate-700 rounded text-xs font-mono dark:text-slate-200 overflow-x-auto">
                    <div class="flex gap-1">
                        ${noteNames.map((note, i) => `
                            <span class="flex-shrink-0 px-1 ${currentCents[i] !== 0 ? 'bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100' : ''}">
                                ${note}:${currentCents[i] >= 0 ? '+' : ''}${currentCents[i].toFixed(0)}
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Tuning Preview</label>
                <p class="text-xs text-gray-500 dark:text-slate-500 mb-1">
                    Hear how C4 (MIDI 60) sounds with the current tuning applied.
                </p>
                <div class="flex gap-2">
                    <button id="previewNoteBtn" class="flex-1 px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600">
                        ▶ Preview C4
                    </button>
                    <button id="previewScaleBtn" class="flex-1 px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">
                        ▶ Play Scale
                    </button>
                </div>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <div class="text-xs text-gray-500 dark:text-slate-500">
                    <p><strong>Note:</strong> Micro tuning affects all synths and samplers.</p>
                    <p>External MIDI output uses the tuned frequencies.</p>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Toggle button
    container.querySelector('#microTuningToggleBtn')?.addEventListener('click', () => {
        const newEnabled = !enabled;
        localAppServices.setMicroTuningEnabled?.(newEnabled);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Micro Tuning ${newEnabled ? 'enabled' : 'disabled'}`, 1500);
        }
        renderMicroTuningPanelContent();
    });
    
    // Preset select
    container.querySelector('#microTuningPresetSelect')?.addEventListener('change', (e) => {
        localAppServices.setMicroTuningPreset?.(e.target.value);
        renderMicroTuningPanelContent();
    });
    
    // Cents inputs
    container.querySelectorAll('.cents-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const value = parseFloat(e.target.value) || 0;
            const newCents = [...currentCents];
            newCents[index] = Math.max(-100, Math.min(100, value));
            localAppServices.setMicroTuningCents?.(newCents);
            renderMicroTuningPanelContent();
        });
    });
    
    // Reset button
    container.querySelector('#resetCentsBtn')?.addEventListener('click', () => {
        localAppServices.setMicroTuningCents?.(Array(12).fill(0));
        renderMicroTuningPanelContent();
    });
    
    // Randomize button
    container.querySelector('#randomizeCentsBtn')?.addEventListener('click', () => {
        const randomCents = Array(12).fill(0).map(() => Math.round((Math.random() * 50 - 25) * 2) / 2);
        localAppServices.setMicroTuningCents?.(randomCents);
        renderMicroTuningPanelContent();
    });
    
    // Preview note button
    container.querySelector('#previewNoteBtn')?.addEventListener('click', () => {
        // Use Tone.js to play a preview note
        if (typeof Tone !== 'undefined' && Tone.context.state === 'running') {
            const freq = localAppServices.midiNoteToFrequencyWithMicroTuning?.(60) ?? 261.63;
            const synth = new Tone.Synth().toDestination();
            synth.triggerAttackRelease(freq, '8n');
        } else if (localAppServices.showNotification) {
            localAppServices.showNotification('Click anywhere to enable audio first', 2000);
        }
    });
    
    // Preview scale button
    container.querySelector('#previewScaleBtn')?.addEventListener('click', () => {
        if (typeof Tone !== 'undefined' && Tone.context.state === 'running') {
            // Play a one-octave chromatic scale with micro tuning
            const now = Tone.now();
            for (let i = 0; i < 12; i++) {
                const freq = localAppServices.midiNoteToFrequencyWithMicroTuning?.(60 + i) ?? 261.63 * Math.pow(2, i/12);
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease(freq, '16n', now + i * 0.15);
            }
        } else if (localAppServices.showNotification) {
            localAppServices.showNotification('Click anywhere to enable audio first', 2000);
        }
    });
}

export function updateMicroTuningPanel() {
    const container = document.getElementById('microTuningContent');
    if (container) {
        renderMicroTuningPanelContent();
    }
}
/**
 * Opens the comprehensive Audio Export Dialog.
 * Allows users to export stems (individual tracks) or master mix with format/bitrate options.
 */
export function openAudioExportDialog(savedState = null) {
    const windowId = 'audioExportDialog';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderAudioExportDialogContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'audioExportDialogContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 520, 
        height: 580, 
        minWidth: 450, 
        minHeight: 500,
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

    const win = localAppServices.createWindow(windowId, 'Audio Export Dialog', contentContainer, options);
    
    if (win?.element) {
        renderAudioExportDialogContent();
    }
    
    return win;
}

/**
 * Renders the audio export dialog content.
 */
function renderAudioExportDialogContent() {
    const container = document.getElementById('audioExportDialogContent');
    if (!container) return;

    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    let html = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Audio Export Dialog</strong> lets you export individual tracks as stems or the master mix as a single audio file.
            </div>
        </div>
        
        <!-- Export Type Selection -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Export Type</h3>
            <div class="flex gap-4 mb-3">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportType" value="stems" id="exportTypeStems" checked 
                        class="w-4 h-4 accent-blue-500">
                    <span class="text-sm text-gray-700 dark:text-gray-300">Export Stems (Individual Tracks)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportType" value="master" id="exportTypeMaster" 
                        class="w-4 h-4 accent-blue-500">
                    <span class="text-sm text-gray-700 dark:text-gray-300">Export Master Mix</span>
                </label>
            </div>
            
            <!-- Track Selection for Stems -->
            <div id="stemsTrackSelection" class="mt-3">
                <h4 class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Select Tracks to Export:</h4>
                <div class="space-y-1 max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded p-2 bg-gray-50 dark:bg-slate-800">
                    ${tracks.length === 0 ? 
                        '<div class="text-xs text-gray-500 dark:text-gray-400 py-2">No tracks available</div>' :
                        tracks.map(t => `
                            <label class="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                                <input type="checkbox" class="stem-track-checkbox w-4 h-4 accent-green-500" value="${t.id}" checked
                                    data-track-name="${t.name}">
                                <span class="text-sm text-gray-700 dark:text-gray-300">${t.name}</span>
                                <span class="text-xs text-gray-500 dark:text-gray-400">(${t.type})</span>
                            </label>
                        `).join('')
                    }
                </div>
                <button id="selectAllStemsBtn" class="mt-2 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Select All</button>
                <button id="deselectAllStemsBtn" class="mt-2 ml-2 text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600">Deselect All</button>
            </div>
        </div>
        
        <!-- Format Settings -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Format Settings</h3>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label for="exportFormat" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Format:</label>
                    <select id="exportFormat" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                        <option value="wav" selected>WAV (Lossless)</option>
                        <option value="mp3">MP3 (Compressed)</option>
                        <option value="ogg">OGG (Compressed)</option>
                    </select>
                </div>
                <div>
                    <label for="exportBitrate" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bitrate:</label>
                    <select id="exportBitrate" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                        <option value="128">128 kbps</option>
                        <option value="192">192 kbps</option>
                        <option value="256" selected>256 kbps</option>
                        <option value="320">320 kbps</option>
                    </select>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mt-3">
                <div>
                    <label for="exportSampleRate" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sample Rate:</label>
                    <select id="exportSampleRate" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                        <option value="44100">44100 Hz (CD)</option>
                        <option value="48000" selected>48000 Hz (Standard)</option>
                        <option value="96000">96000 Hz (High-Res)</option>
                    </select>
                </div>
                <div>
                    <label for="exportBitDepth" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bit Depth:</label>
                    <select id="exportBitDepth" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                        <option value="16">16-bit</option>
                        <option value="24" selected>24-bit</option>
                        <option value="32">32-bit float</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Duration Settings -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Duration</h3>
            <div class="flex gap-4 items-center">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportDuration" value="project" id="durationProject" checked 
                        class="w-4 h-4 accent-blue-500">
                    <span class="text-sm text-gray-700 dark:text-gray-300">Full Project Length</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportDuration" value="loop" id="durationLoop" 
                        class="w-4 h-4 accent-blue-500">
                    <span class="text-sm text-gray-700 dark:text-gray-300">Loop Region</span>
                </label>
            </div>
            <div class="mt-2 flex gap-2 items-center">
                <label class="text-xs text-gray-600 dark:text-gray-400">Custom End (bars):</label>
                <input type="number" id="exportEndBar" value="16" min="1" max="999" 
                    class="w-20 p-1 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
            </div>
        </div>
        
        <!-- Export Button -->
        <div class="flex gap-3">
            <button id="exportAudioBtn" class="flex-1 px-4 py-3 bg-green-500 text-white font-semibold rounded hover:bg-green-600 transition-colors">
                Export Audio
            </button>
            <button id="cancelExportBtn" class="px-4 py-3 bg-gray-400 text-white font-semibold rounded hover:bg-gray-500 transition-colors">
                Cancel
            </button>
        </div>
        
        <!-- Progress Display -->
        <div id="exportProgressContainer" class="mt-4 hidden">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exporting...</div>
            <div class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded overflow-hidden">
                <div id="exportProgressBar" class="h-full bg-blue-500 transition-all duration-300" style="width: 0%"></div>
            </div>
            <div id="exportStatusText" class="mt-1 text-xs text-gray-500 dark:text-gray-400"></div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Attach event listeners
    const selectAllBtn = container.querySelector('#selectAllStemsBtn');
    const deselectAllBtn = container.querySelector('#deselectAllStemsBtn');
    const exportBtn = container.querySelector('#exportAudioBtn');
    const cancelBtn = container.querySelector('#cancelExportBtn');
    const stemsSection = container.querySelector('#stemsTrackSelection');
    
    // Export type toggle
    const exportTypeRadios = container.querySelectorAll('input[name="exportType"]');
    exportTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const isStems = document.querySelector('input[name="exportType"]:checked').value === 'stems';
            stemsSection.style.display = isStems ? 'block' : 'none';
        });
    });
    
    // Select all / deselect all
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            container.querySelectorAll('.stem-track-checkbox').forEach(cb => cb.checked = true);
        });
    }
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            container.querySelectorAll('.stem-track-checkbox').forEach(cb => cb.checked = false);
        });
    }
    
    // Export button handler
    if (exportBtn) {
        exportBtn.addEventListener('click', handleAudioExport);
    }
    
    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const win = localAppServices.getWindowByIdState ? localAppServices.getWindowByIdState('audioExportDialog') : null;
            if (win && win.close) win.close();
        });
    }
}

/**
 * Handles the audio export process.
 */
async function handleAudioExport() {
    const container = document.getElementById('audioExportDialogContent');
    if (!container) return;
    
    const exportType = container.querySelector('input[name="exportType"]:checked')?.value;
    const format = container.querySelector('#exportFormat')?.value || 'wav';
    const bitrate = parseInt(container.querySelector('#exportBitrate')?.value || '256');
    const sampleRate = parseInt(container.querySelector('#exportSampleRate')?.value || '48000');
    const bitDepth = parseInt(container.querySelector('#exportBitDepth')?.value || '24');
    const durationType = container.querySelector('input[name="exportDuration"]:checked')?.value;
    const endBar = parseInt(container.querySelector('#exportEndBar')?.value || '16');
    
    const progressContainer = container.querySelector('#exportProgressContainer');
    const progressBar = container.querySelector('#exportProgressBar');
    const statusText = container.querySelector('#exportStatusText');
    
    // Show progress
    progressContainer?.classList.remove('hidden');
    
    try {
        if (exportType === 'stems') {
            // Get selected tracks
            const selectedCheckboxes = container.querySelectorAll('.stem-track-checkbox:checked');
            const selectedTrackIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
            
            if (selectedTrackIds.length === 0) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('Please select at least one track to export.', 3000);
                }
                progressContainer?.classList.add('hidden');
                return;
            }
            
            const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
            const selectedTracks = tracks.filter(t => selectedTrackIds.includes(t.id));
            
            // Calculate duration
            const beatsPerBar = 4;
            const bpm = Tone?.Transport?.bpm?.value || 120;
            const durationSeconds = (endBar * beatsPerBar * 60) / bpm;
            
            // Export each track as a stem
            for (let i = 0; i < selectedTracks.length; i++) {
                const track = selectedTracks[i];
                statusText.textContent = `Exporting stem ${i + 1}/${selectedTracks.length}: ${track.name}...`;
                progressBar.style.width = `${((i + 1) / selectedTracks.length) * 100}%`;
                
                // Use the audio.js bounceTrackToWav function
                const wavBlob = await localAppServices.bounceTrackToWav?.(track, durationSeconds);
                
                if (wavBlob) {
                    // Download the file
                    const url = URL.createObjectURL(wavBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${track.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_stem.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
                
                // Small delay between exports to prevent UI freeze
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Exported ${selectedTracks.length} stems successfully!`, 3000);
            }
            
            statusText.textContent = 'Preparing master mix export...';
            progressBar.style.width = '20%';
            
            try {
                // Get all tracks
                const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
                
                if (tracks.length === 0) {
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification('No tracks to export.', 3000);
                    }
                    progressContainer?.classList.add('hidden');
                    return;
                }
                
                // Calculate duration
                const beatsPerBar = 4;
                const bpm = Tone?.Transport?.bpm?.value || 120;
                const durationSeconds = (endBar * beatsPerBar * 60) / bpm;
                
                statusText.textContent = `Rendering ${durationSeconds.toFixed(1)}s master mix...`;
                progressBar.style.width = '40%';
                
                // Use the audio.js bounceMasterToWav function
                const wavBlob = await localAppServices.bounceMasterToWav?.(tracks, durationSeconds, {
                    includeMasterEffects: true,
                    sampleRate: sampleRate
                });
                
                progressBar.style.width = '80%';
                
                if (wavBlob) {
                    // Download the file
                    const projectName = localAppServices.getProjectName?.() || 'snugos_project';
                    const url = URL.createObjectURL(wavBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${projectName.replace(/[^a-zA-Z0-9-_]/g, '_')}_master.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    statusText.textContent = 'Export complete!';
                    progressBar.style.width = '100%';
                    
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification('Master mix exported successfully!', 3000);
                    }
                } else {
                    throw new Error('Failed to create master mix file');
                }
            } catch (exportError) {
                console.error('[UI handleAudioExport] Master mix export error:', exportError);
                if (localAppServices.showNotification) {
                    localAppServices.showNotification(`Master mix export failed: ${exportError.message}`, 4000);
                }
            }
        
        progressContainer?.classList.add('hidden');
        
    } catch (error) {
        console.error('[UI handleAudioExport] Error:', error);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Export error: ${error.message}`, 4000);
        }
        progressContainer?.classList.add('hidden');
    }
}

// --- Random Pattern Generator UI ---
export function openRandomPatternGeneratorPanel() {
    const winId = 'randomPatternGeneratorWindow';
    const existingWin = localAppServices.getWindowByIdState?.(winId);
    if (existingWin) {
        localAppServices.focusWindow?.(winId);
        return;
    }
    
    const presets = localAppServices.getRandomPatternPresets?.() || {};
    const scaleTypes = localAppServices.getScaleTypes?.() || ['major', 'minor'];
    const currentSettings = localAppServices.getRandomPatternGeneratorSettings?.() || {};
    
    const html = `
        <div class="p-4 space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Random Pattern Generator</h3>
                <button id="closeRandomPatternBtn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            
            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Preset:</label>
                    <select id="randomPatternPreset" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                        ${Object.entries(presets).map(([id, preset]) => 
                            `<option value="${id}" ${currentSettings.preset === id ? 'selected' : ''}>${preset.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scale:</label>
                        <select id="randomPatternScale" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                            ${scaleTypes.map(type => 
                                `<option value="${type}" ${currentSettings.scale === type ? 'selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Root Note:</label>
                        <select id="randomPatternRoot" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded">
                            ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(note => 
                                `<option value="${note}" ${currentSettings.rootNote === note ? 'selected' : ''}>${note}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Density: <span id="densityValue">${(currentSettings.density || 0.5) * 100}%</span></label>
                    <input type="range" id="randomPatternDensity" min="0" max="1" step="0.05" value="${currentSettings.density || 0.5}" 
                        class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Variation: <span id="variationValue">${(currentSettings.variation || 0.3) * 100}%</span></label>
                    <input type="range" id="randomPatternVariation" min="0" max="1" step="0.05" value="${currentSettings.variation || 0.3}" 
                        class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="randomPatternUseScaleLock" ${currentSettings.useScaleLock ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                    <label for="randomPatternUseScaleLock" class="text-xs text-gray-600 dark:text-gray-400">Use Scale Lock</label>
                </div>
                
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="randomPatternUseSwing" ${currentSettings.useSwing ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                    <label for="randomPatternUseSwing" class="text-xs text-gray-600 dark:text-gray-400">Apply Swing</label>
                </div>
            </div>
            
            <div class="flex gap-2">
                <button id="generateRandomPatternBtn" class="flex-1 px-3 py-2 bg-purple-500 text-white text-sm font-semibold rounded hover:bg-purple-600 transition-colors">
                    Generate Pattern
                </button>
                <button id="applyToTrackBtn" class="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors">
                    Apply to Track
                </button>
            </div>
            
            <div id="generatedPatternPreview" class="hidden mt-4 p-3 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Generated Pattern Preview</h4>
                <div id="patternPreviewGrid" class="grid grid-cols-16 gap-0.5 max-h-32 overflow-y-auto"></div>
            </div>
        </div>
    `;
    
    localAppServices.createWindow?.(winId, 'Random Pattern Generator', container, {
        width: 320,
        height: 400,
        x: 150,
        y: 100,
        resizable: true
    });
    
    setTimeout(() => {
        const win = localAppServices.getWindowById?.(winId);
        if (!win || !win.element) return;
        
        if (editType === 'notes') {
            // Velocity controls
            const velocitySlider = container.querySelector('#groupVelocity');
            const velocityNum = container.querySelector('#groupVelocityNum');
            velocitySlider?.addEventListener('input', (e) => {
                velocityNum.value = Math.round(parseFloat(e.target.value) * 127);
            });
            velocityNum?.addEventListener('input', (e) => {
                velocitySlider.value = parseFloat(e.target.value) / 127;
            });
            
            container.querySelector('#applyVelocityBtn')?.addEventListener('click', () => {
                const velocity = parseFloat(velocitySlider.value);
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Set velocity for selected notes');
                const result = localAppServices.setSelectedNotesVelocity?.(velocity);
                if (result?.success) {
                    localAppServices.showNotification?.(`Set velocity for ${result.affectedCount} notes`, 1500);
                }
            });
            
            // Gate controls
            const gateSlider = container.querySelector('#groupGate');
            const gateVal = container.querySelector('#groupGateVal');
            gateSlider?.addEventListener('input', (e) => {
                gateVal.textContent = e.target.value;
            });
            
            container.querySelector('#applyGateBtn')?.addEventListener('click', () => {
                const gate = parseFloat(gateSlider.value);
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Set gate for selected notes');
                const result = localAppServices.setSelectedNotesGate?.(gate);
                if (result?.success) {
                    localAppServices.showNotification?.(`Set gate for ${result.affectedCount} notes`, 1500);
                }
            });
            
            // Humanize
            const humanizeSlider = container.querySelector('#humanizeAmount');
            const humanizeVal = container.querySelector('#humanizeAmountVal');
            humanizeSlider?.addEventListener('input', (e) => {
                humanizeVal.textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
            });
            
            container.querySelector('#humanizeBtn')?.addEventListener('click', () => {
                const amount = parseFloat(humanizeSlider.value);
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Humanize selected notes');
                const result = localAppServices.humanizeSelectedNotes?.(amount);
                if (result?.success) {
                    localAppServices.showNotification?.(`Humanized ${result.affectedCount} notes`, 1500);
                }
            });
            
            // Transpose
            container.querySelector('#transposeDown12')?.addEventListener('click', () => {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Transpose down 12 semitones');
                localAppServices.moveSelectedNotes?.(-12);
                localAppServices.showNotification?.('Transposed down 1 octave', 1500);
            });
            container.querySelector('#transposeDown1')?.addEventListener('click', () => {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Transpose down 1 semitone');
                localAppServices.moveSelectedNotes?.(-1);
                localAppServices.showNotification?.('Transposed down 1 semitone', 1500);
            });
            container.querySelector('#transposeUp1')?.addEventListener('click', () => {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Transpose up 1 semitone');
                localAppServices.moveSelectedNotes?.(1);
                localAppServices.showNotification?.('Transposed up 1 semitone', 1500);
            });
            container.querySelector('#transposeUp12')?.addEventListener('click', () => {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Transpose up 12 semitones');
                localAppServices.moveSelectedNotes?.(12);
                localAppServices.showNotification?.('Transposed up 1 octave', 1500);
            });
            
            // Copy/Cut/Paste/Delete
            container.querySelector('#copyNotesBtn')?.addEventListener('click', () => {
                const result = localAppServices.copySelectedNotes?.();
                if (result?.success) {
                    localAppServices.showNotification?.(`Copied ${result.copiedCount} notes`, 1500);
                }
            });
            container.querySelector('#cutNotesBtn')?.addEventListener('click', () => {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Cut selected notes');
                const result = localAppServices.cutSelectedNotes?.();
                if (result?.success) {
                    localAppServices.showNotification?.(`Cut ${result.cutCount} notes`, 1500);
                }
            });
            container.querySelector('#pasteNotesBtn')?.addEventListener('click', () => {
                const seqId = localAppServices.getActiveSequenceIdForSelection?.();
                if (seqId) {
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Paste notes');
                    const result = localAppServices.pasteNotes?.(seqId);
                    if (result?.success) {
                        localAppServices.showNotification?.(`Pasted ${result.pastedCount} notes`, 1500);
                    }
                }
            });
            container.querySelector('#deleteNotesBtn')?.addEventListener('click', () => {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Delete selected notes');
                const result = localAppServices.deleteSelectedNotes?.();
                if (result?.success) {
                    localAppServices.showNotification?.(`Deleted ${result.deletedCount} notes`, 1500);
                }
            });
            
            // Update selection info
            const updateSelectionInfo = () => {
                const count = localAppServices.getSelectedNotesCount?.() || 0;
                container.querySelector('#selectionInfo').textContent = count > 0 ? `${count} note(s) selected` : 'No notes selected';
            };
            updateSelectionInfo();
        } else {
            // Clip editing
            container.querySelector('#moveClipsBtn')?.addEventListener('click', () => {
                const delta = parseFloat(container.querySelector('#moveTimeDelta').value) || 0;
                const clipIds = Array.from(localAppServices.getSelectedClipIds?.() || []);
                if (clipIds.length > 0 && delta !== 0) {
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Move selected clips');
                    const result = localAppServices.moveSelectedClips?.(clipIds, delta);
                    if (result?.success) {
                        localAppServices.showNotification?.(`Moved ${result.movedCount} clips`, 1500);
                    }
                }
            });
            
            container.querySelector('#applyGainBtn')?.addEventListener('click', () => {
                const gain = parseFloat(container.querySelector('#groupGain').value) || 0;
                const clipIds = Array.from(localAppServices.getSelectedClipIds?.() || []);
                if (clipIds.length > 0) {
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Set gain for selected clips');
                    const result = localAppServices.groupEditClips?.(clipIds, 'gain', gain);
                    if (result?.success) {
                        localAppServices.showNotification?.(`Set gain for ${result.affectedCount} clips`, 1500);
                    }
                }
            });
            
            // Copy/Cut/Paste/Delete for clips
            container.querySelector('#copyClipsBtn')?.addEventListener('click', () => {
                const clipIds = Array.from(localAppServices.getSelectedClipIds?.() || []);
                const result = localAppServices.copySelectedClips?.(clipIds);
                if (result?.success) {
                    localAppServices.showNotification?.(`Copied ${result.copiedCount} clips`, 1500);
                }
            });
            container.querySelector('#cutClipsBtn')?.addEventListener('click', () => {
                const clipIds = Array.from(localAppServices.getSelectedClipIds?.() || []);
                if (clipIds.length > 0) {
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Cut selected clips');
                    const result = localAppServices.cutSelectedClips?.(clipIds);
                    if (result?.success) {
                        localAppServices.showNotification?.(`Cut ${result.cutCount} clips`, 1500);
                    }
                }
            });
            container.querySelector('#pasteClipsBtn')?.addEventListener('click', () => {
                // Paste to first selected track or first audio track
                const tracks = localAppServices.getTracks?.() || [];
                const audioTrack = tracks.find(t => t.type === 'Audio');
                if (audioTrack) {
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Paste clips');
                    const result = localAppServices.pasteClips?.(audioTrack.id, 0);
                    if (result?.success) {
                        localAppServices.showNotification?.(`Pasted ${result.pastedCount} clips`, 1500);
                    }
                }
            });
            container.querySelector('#deleteClipsBtn')?.addEventListener('click', () => {
                const clipIds = Array.from(localAppServices.getSelectedClipIds?.() || []);
                if (clipIds.length > 0) {
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Delete selected clips');
                    const result = localAppServices.deleteTimelineClips?.(clipIds);
                    if (result?.success) {
                        localAppServices.showNotification?.(`Deleted ${result.deletedCount} clips`, 1500);
                        localAppServices.clearClipSelections?.();
                    }
                }
            });
            
            // Update clip selection info
            const updateClipSelectionInfo = () => {
                const count = (localAppServices.getSelectedClipIds?.() || []).size;
                container.querySelector('#clipSelectionInfo').textContent = count > 0 ? `${count} clip(s) selected` : 'No clips selected';
            };
            updateClipSelectionInfo();
        }
    }, 100);
}

// --- Track Routing Matrix Panel ---

export function openTrackRoutingMatrixPanel(savedState = null) {
    const windowId = 'trackRoutingMatrix';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTrackRoutingMatrixContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackRoutingMatrixContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 600, 
        height: 500, 
        minWidth: 500, 
        minHeight: 400,
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

    const win = localAppServices.createWindow(windowId, 'Track Routing Matrix', contentContainer, options);
    
    if (win?.element) {
        renderTrackRoutingMatrixContent();
    }
    
    return win;
}

function renderTrackRoutingMatrixContent() {
    const container = document.getElementById('trackRoutingMatrixContent');
    if (!container) return;

    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const availableBuses = localAppServices.getAvailableSendBuses ? localAppServices.getAvailableSendBuses() : ['reverb', 'delay'];
    
    // Build header columns
    const columns = [
        { id: 'track', label: 'Track', width: '120px' },
        { id: 'main', label: 'Main Out', width: '100px' },
        ...availableBuses.map(bus => ({ 
            id: bus, 
            label: bus.charAt(0).toUpperCase() + bus.slice(1), 
            width: '100px' 
        })),
        { id: 'sidechain', label: 'Sidechain', width: '100px' }
    ];

    let html = `
        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-600 dark:text-gray-400">
                Route tracks to different outputs. Use Main Out for direct signal, or send to Reverb/Delay buses for effects.
            </div>
        </div>
        
        <div class="overflow-x-auto">
            <table class="w-full text-xs">
                <thead>
                    <tr class="bg-gray-200 dark:bg-slate-600">
                        ${columns.map(col => `<th class="p-2 text-left font-medium text-gray-700 dark:text-gray-300" style="width: ${col.width}">${col.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (tracks.length === 0) {
        html += `
            <tr>
                <td colspan="${columns.length}" class="p-4 text-center text-gray-500 dark:text-gray-400">
                    No tracks available. Create a track first.
                </td>
            </tr>
        `;
    } else {
        tracks.forEach(track => {
            const trackColor = track.color || '#3b82f6';
            html += `
                <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700" data-track-id="${track.id}">
                    <td class="p-2">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full" style="background-color: ${trackColor}"></span>
                            <span class="font-medium text-gray-800 dark:text-gray-200 truncate">${track.name}</span>
                        </div>
                    </td>
                    <td class="p-2">
                        <label class="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" class="main-out-toggle w-4 h-4 accent-blue-500" 
                                data-track-id="${track.id}" 
                                ${!track.outputRouting || track.outputRouting === 'main' ? 'checked' : ''}>
                        </label>
                    </td>
                    ${availableBuses.map(bus => {
                        const sendLevel = track.sendLevels?.[bus] || 0;
                        return `
                            <td class="p-2">
                                <div class="flex items-center gap-1">
                                    <input type="range" class="send-level-slider w-16 h-1" 
                                        min="0" max="1" step="0.01" 
                                        value="${sendLevel}"
                                        data-track-id="${track.id}" 
                                        data-bus="${bus}">
                                    <span class="send-level-val text-gray-500 dark:text-gray-400 w-8 font-mono">${Math.round(sendLevel * 100)}%</span>
                                </div>
                            </td>
                        `;
                    }).join('')}
                    <td class="p-2">
                        <select class="sidechain-target-select p-1 text-xs bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200" data-track-id="${track.id}">
                            <option value="">None</option>
                            ${tracks.filter(t => t.id !== track.id).map(t => 
                                `<option value="${t.id}" ${track.sidechainSource === t.id ? 'selected' : ''}>${t.name}</option>`
                            ).join('')}
                        </select>
                    </td>
                </tr>
            `;
        });
    }
    
    html += `
                </tbody>
            </table>
        </div>
        
        <div class="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span class="flex items-center gap-1">
                <span class="w-4 h-1 bg-blue-400 rounded"></span>
                Main Out
            </span>
            <span class="flex items-center gap-1">
                <span class="w-4 h-1 bg-green-400 rounded"></span>
                Send Level
            </span>
            <span class="flex items-center gap-1">
                <span class="w-4 h-1 bg-purple-400 rounded"></span>
                Sidechain
            </span>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Wire up event listeners
    wireTrackRoutingMatrixEvents(container);
}

function wireTrackRoutingMatrixEvents(container) {
    // Main out toggles
    container.querySelectorAll('.main-out-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const enabled = e.target.checked;
            
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Toggle main out for track`);
            }
            
            const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
            if (track && typeof track.setOutputRouting === 'function') {
                track.setOutputRouting(enabled ? 'main' : 'none');
                localAppServices.showNotification?.(`Main out ${enabled ? 'enabled' : 'disabled'} for ${track.name}`, 1500);
            }
        });
    });
    
    // Send level sliders
    container.querySelectorAll('.send-level-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const bus = e.target.dataset.bus;
            const level = parseFloat(e.target.value);
            
            // Update value display
            const valDisplay = e.target.nextElementSibling;
            if (valDisplay) valDisplay.textContent = `${Math.round(level * 100)}%`;
            
            const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
            if (track && typeof track.setSendLevel === 'function') {
                track.setSendLevel(bus, level);
            }
        });
        
        slider.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
            const bus = e.target.dataset.bus;
            const level = parseFloat(e.target.value);
            
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Set ${bus} send level`);
            }
            
            if (track && typeof track.setSendLevel === 'function') {
                track.setSendLevel(bus, level);
                localAppServices.showNotification?.(`${bus.charAt(0).toUpperCase() + bus.slice(1)} send set to ${Math.round(level * 100)}% for ${track.name}`, 1500);
            }
        });
    });
    
    // Sidechain target selects
    container.querySelectorAll('.sidechain-target-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const targetTrackId = e.target.value ? parseInt(e.target.value, 10) : null;
            
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Set sidechain routing`);
            }
            
            const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
            if (track && typeof track.setSidechainSource === 'function') {
                track.setSidechainSource(targetTrackId);
                const targetName = targetTrackId ? (localAppServices.getTrackById?.(targetTrackId)?.name || `Track ${targetTrackId}`) : 'None';
                localAppServices.showNotification?.(`Sidechain ${targetTrackId ? `routed to ${targetName}` : 'removed'} for ${track.name}`, 1500);
            }
        });
    });
}

export function updateTrackRoutingMatrixPanel() {
    const container = document.getElementById('trackRoutingMatrixContent');
    if (container) {
        renderTrackRoutingMatrixContent();
    }
}

// --- Random Pattern Generator UI ---