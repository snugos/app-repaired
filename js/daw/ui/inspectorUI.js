// js/daw/ui/inspectorUI.js

// Corrected imports for state modules and utils
import { getTrackById } from '/app/js/daw/state/trackState.js'; 
import { getOpenWindows, getWindowById } from '/app/js/daw/state/windowState.js'; 
import { getIsReconstructingDAW } from '/app/js/daw/state/projectState.js'; 
import { setupGenericDropZoneListeners, createDropZoneHTML, drawWaveform } from '/app/js/daw/utils.js'; 
import * as effectsRegistry from '/app/js/daw/effectsRegistry.js'; 
import * as Constants from '/app/js/daw/constants.js'; 

let localAppServices = {};

export function initializeInspectorUI(appServices) {
    localAppServices = appServices;
}

/**
 * Safely gets a nested property value from an object using a dot-separated path.
 * @param {object} obj - The object to traverse.
 * @param {string} path - The dot-separated path (e.g., 'envelope.attack').
 * @returns {any} The value of the nested property, or undefined if not found.
 */
function getNestedParam(obj, path) {
    if (!path || !obj) return undefined;
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === undefined || result === null) return undefined;
        result = result[key];
    }
    return result;
}

/**
 * Builds and attaches controls for a synthesizer engine to the given container.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach controls to.
 * @param {string} engineType - The type of the synth engine (e.g., 'MonoSynth').
 */
function buildSynthEngineControls(track, container, engineType) {
    const definitions = effectsRegistry.synthEngineControlDefinitions?.[engineType] || []; 
    if (!container || definitions.length === 0) return;

    definitions.forEach(def => {
        // Ensure placeholder exists for the control
        const placeholder = container.querySelector(`#${def.idPrefix}-${track.id}-placeholder`);
        if (!placeholder) return;

        let control;
        // Get initial value from track's synthParams
        const initialValue = getNestedParam(track.synthParams, def.path);

        if (def.type === 'knob') {
            control = localAppServices.createKnob({
                label: def.label,
                min: def.min,
                max: def.max,
                step: def.step,
                initialValue: initialValue,
                decimals: def.decimals,
                displaySuffix: def.displaySuffix || '',
                onValueChange: (val, oldVal, fromInteraction) => {
                    track.setSynthParam(def.path, val);
                }
            }, localAppServices.captureStateForUndo); 
            placeholder.appendChild(control.element);
        } else if (def.type === 'select') {
            const selectGroup = document.createElement('div');
            selectGroup.className = 'control-group';
            selectGroup.innerHTML = `<label class="block mb-1">${def.label}:</label>`;

            const selectEl = document.createElement('select');
            selectEl.className = "w-full p-1 border rounded bg-white dark:bg-black border-black dark:border-white text-black dark:text-white";
            def.options.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt;
                optionEl.textContent = opt;
                if (opt === initialValue) {
                    optionEl.selected = true;
                }
                selectEl.appendChild(optionEl);
            });
            selectEl.addEventListener('change', (e) => {
                track.setSynthParam(def.path, e.target.value);
                localAppServices.captureStateForUndo?.(`Change ${def.label} on ${track.name}`);
            });
            selectGroup.appendChild(selectEl);
            placeholder.appendChild(selectGroup); 
        }
    });
}

/**
 * Renders the sample pads UI for Sampler tracks.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach pads to.
 */
export function renderSamplePads(track, container) {
    if (!container) return;
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-4 gap-2';

    for (let i = 0; i < Constants.numSlices; i++) { 
        const pad = document.createElement('button');
        pad.className = 'pad-button';
        pad.textContent = `Slice ${i + 1}`;
        pad.dataset.sliceIndex = i;

        // Add 'selected-for-edit' class if this is the currently selected slice
        if (track.selectedSliceForEdit === i) {
            pad.classList.add('selected-for-edit');
        }

        pad.addEventListener('click', () => {
            localAppServices.playSlicePreview?.(track.id, i);
            track.selectedSliceForEdit = i;
            // Re-render pads to update selection visual
            renderSamplePads(track, container); 
            updateSliceEditorUI(track, container.closest('.window-content'));
        });
        grid.appendChild(pad);
    }
    container.appendChild(grid);
}

/**
 * Updates the slice editor controls for the currently selected slice on a Sampler track.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The main inspector window content container.
 */
export function updateSliceEditorUI(track, container) {
    if (!container) return;
    const slice = track.slices[track.selectedSliceForEdit];
    if (!slice) return;

    // Create or update the slice control container
    let sliceControlsContainer = container.querySelector('#slice-controls-container');
    if (!sliceControlsContainer) {
        sliceControlsContainer = document.createElement('div');
        sliceControlsContainer.id = 'slice-controls-container';
        sliceControlsContainer.className = 'mt-4 grid grid-cols-2 gap-2 p-2 border-t border-gray-400 dark:border-gray-600';
        container.appendChild(sliceControlsContainer);
    }
    sliceControlsContainer.innerHTML = `
        <div id="slice-pitch-knob-placeholder"></div>
        <div id="slice-volume-knob-placeholder"></div>
        <div id="slice-loop-checkbox-placeholder" class="col-span-2 flex items-center"></div>
        <div id="slice-reverse-checkbox-placeholder" class="col-span-2 flex items-center"></div>
    `;

    // Pitch knob
    const pitchKnobEl = sliceControlsContainer.querySelector('#slice-pitch-knob-placeholder');
    if (pitchKnobEl) {
        pitchKnobEl.innerHTML = ''; // Clear previous knob if exists
        const knob = localAppServices.createKnob({
            label: 'Pitch',
            min: -24,
            max: 24,
            step: 1,
            initialValue: slice.pitchShift || 0,
            onValueChange: (val) => { slice.pitchShift = val; }
        }, localAppServices.captureStateForUndo); 
        pitchKnobEl.appendChild(knob.element);
    }

    // Volume knob (for individual slice)
    const volumeKnobEl = sliceControlsContainer.querySelector('#slice-volume-knob-placeholder');
    if (volumeKnobEl) {
        volumeKnobEl.innerHTML = '';
        const knob = localAppServices.createKnob({
            label: 'Volume',
            min: 0,
            max: 1.2,
            step: 0.01,
            initialValue: slice.volume || 0.7,
            onValueChange: (val) => { slice.volume = val; }
        }, localAppServices.captureStateForUndo);
        volumeKnobEl.appendChild(knob.element);
    }

    // Loop checkbox
    const loopCheckboxPlaceholder = sliceControlsContainer.querySelector('#slice-loop-checkbox-placeholder');
    if (loopCheckboxPlaceholder) {
        loopCheckboxPlaceholder.innerHTML = `<label class="flex items-center space-x-2">
            <input type="checkbox" id="sliceLoopCheckbox" class="form-checkbox" ${slice.loop ? 'checked' : ''}> <span>Loop</span>
        </label>`;
        const checkbox = loopCheckboxPlaceholder.querySelector('#sliceLoopCheckbox');
        checkbox.addEventListener('change', (e) => {
            slice.loop = e.target.checked;
            localAppServices.captureStateForUndo?.(`Toggle slice loop for ${track.name}`);
        });
    }

    // Reverse checkbox
    const reverseCheckboxPlaceholder = sliceControlsContainer.querySelector('#slice-reverse-checkbox-placeholder');
    if (reverseCheckboxPlaceholder) {
        reverseCheckboxPlaceholder.innerHTML = `<label class="flex items-center space-x-2">
            <input type="checkbox" id="sliceReverseCheckbox" class="form-checkbox" ${slice.reverse ? 'checked' : ''}> <span>Reverse</span>
        </label>`;
        const checkbox = reverseCheckboxPlaceholder.querySelector('#sliceReverseCheckbox');
        checkbox.addEventListener('change', (e) => {
            slice.reverse = e.target.checked;
            localAppServices.captureStateForUndo?.(`Toggle slice reverse for ${track.name}`);
        });
    }
}

/**
 * Renders the drum sampler pads UI for DrumSampler tracks.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach pads to.
 */
export function renderDrumSamplerPads(track, container) {
    if (!container) return;
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-4 gap-2';

    for (let i = 0; i < Constants.numDrumSamplerPads; i++) { 
        const pad = document.createElement('button');
        pad.className = 'pad-button';
        pad.dataset.padIndex = i;

        const padLabel = document.createElement('span');
        padLabel.className = 'pad-label';
        const padData = track.drumSamplerPads[i];
        padLabel.textContent = padData?.originalFileName || `Pad ${i + 1}`;
        pad.appendChild(padLabel);

        if (track.selectedDrumPadForEdit === i) {
            pad.classList.add('selected-for-edit');
        }

        pad.addEventListener('click', () => {
            localAppServices.playDrumSamplerPadPreview?.(track.id, i);
            track.selectedDrumPadForEdit = i;
            updateDrumPadControlsUI(track, container.closest('.window-content'));
            renderDrumSamplerPads(track, container); // Re-render pads to update selection
        });

        // setupGenericDropZoneListeners imported from utils.js
        setupGenericDropZoneListeners(
            pad,
            track.id,
            'DrumSampler',
            i,
            localAppServices.loadSoundFromBrowserToTarget,
            localAppServices.loadDrumSamplerPadFile
        );

        grid.appendChild(pad);
    }
    container.appendChild(grid);
}

/**
 * Updates the controls UI for the currently selected drum pad.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The main inspector window content container.
 */
export function updateDrumPadControlsUI(track, container) {
    if (!container) return;
    const padIndex = track.selectedDrumPadForEdit;
    const padData = track.drumSamplerPads[padIndex];
    if (!padData) return;

    let controlsGrid = container.querySelector('#drum-pad-controls-grid');
    if (!controlsGrid) {
        controlsGrid = document.createElement('div');
        controlsGrid.id = 'drum-pad-controls-grid';
        controlsGrid.className = 'grid grid-cols-2 gap-2 mt-4 p-2 border-t border-gray-400 dark:border-gray-600';
        container.appendChild(controlsGrid);
    }
    controlsGrid.innerHTML = `
        <div id="dropZoneContainer-${track.id}-drumpad-${padIndex}">
            ${createDropZoneHTML(`pad-file-input-${padIndex}`, `Load for Pad ${padIndex + 1}`)}
        </div>
        <div id="volumeKnob-drumpad-${padIndex}-placeholder"></div>
        <div id="pitchKnob-drumpad-${padIndex}-placeholder"></div>
    `;

    // Volume knob for drum pad
    const volContainer = controlsGrid.querySelector(`#volumeKnob-drumpad-${padIndex}-placeholder`);
    if (volContainer) {
        const volKnob = localAppServices.createKnob({
            label: 'Volume',
            min: 0,
            max: 1.2,
            step: 0.01,
            initialValue: padData.volume || 0.7,
            onValueChange: (val) => { padData.volume = val; }
        }, localAppServices.captureStateForUndo); 
        volContainer.appendChild(volKnob.element);
    }
    
    // Pitch knob for drum pad
    const pitchContainer = controlsGrid.querySelector(`#pitchKnob-drumpad-${padIndex}-placeholder`);
    if (pitchContainer) {
        const pitchKnob = localAppServices.createKnob({
            label: 'Pitch',
            min: -24,
            max: 24,
            step: 1,
            initialValue: padData.pitchShift || 0,
            onValueChange: (val) => { padData.pitchShift = val; }
        }, localAppServices.captureStateForUndo); 
        pitchContainer.appendChild(pitchKnob.element); 
    }

    // Attach drop zone listeners and file input change handler
    const dzContainerEl = container.querySelector(`#dropZoneContainer-${track.id}-drumpad-${padIndex}`);
    if(dzContainerEl) {
        const dzEl = dzContainerEl.querySelector('.drop-zone');
        if(dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'DrumSampler', padIndex, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadDrumSamplerPadFile);
        const fileInputEl = dzContainerEl.querySelector(`input[type="file"]`); 
        if(fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadDrumSamplerPadFile(e, track.id, padIndex); };
    }
}

/**
 * Opens a new SnugWindow for a track's inspector, or restores an existing one.
 * @param {number} trackId - The ID of the track to inspect.
 * @param {object} [savedState=null] - Optional saved window state for restoration.
 * @returns {object|null} The SnugWindow instance, or null if the track is not found.
 */
export function openTrackInspectorWindow(trackId, savedState = null) {
    const track = localAppServices.getTrackById(trackId);
    if (!track) return null;
    const windowId = `trackInspector-${trackId}`;
    
    const existingWindow = localAppServices.getOpenWindows().get(windowId);

    if (existingWindow) {
        if (!savedState) {
            existingWindow.restore();
            return existingWindow;
        } else {
            // If savedState is provided for an existing window, close the old one and open a new one
            existingWindow.close(true); 
        }
    }

    const contentDOM = buildTrackInspectorContentDOM(track);
    const inspectorWindow = localAppServices.createWindow(windowId, `Inspector: ${track.name}`, contentDOM, { width: 320, height: 450, ...savedState });
    if (inspectorWindow?.element) {
        console.log(`[inspectorUI.js] Calling initializeCommonInspectorControls for track ${track.id}`);
        initializeCommonInspectorControls(track, inspectorWindow.element);
    }
    return inspectorWindow;
}

/**
 * Builds the main content DOM for a track inspector window.
 * @param {object} track - The track object.
 * @returns {HTMLElement} The created content DOM element.
 */
function buildTrackInspectorContentDOM(track) {
    const content = document.createElement('div');
    content.className = 'p-2 space-y-2 overflow-y-auto h-full text-black dark:text-white';
    
    let editorButtonsHTML = '';
    // Only show Piano Roll/Effects Rack buttons for non-audio tracks
    if (track.type !== 'Audio') {
        editorButtonsHTML = `
            <div class="flex space-x-2 mt-2">
                <button id="openPianoRollBtn-${track.id}" class="flex-1 p-1 border rounded">Piano Roll</button>
                <button id="openEffectsRackBtn-${track.id}" class="flex-1 p-1 border rounded">Effects Rack</button>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="panel">
            <h3 class="font-bold mb-2">Track Controls</h3>
            <div class="flex space-x-2">
                <button id="muteBtn-${track.id}" class="flex-1 p-1 border rounded">${track.isMuted ? 'Unmute' : 'Mute'}</button>
                <button id="soloBtn-${track.id}" class="flex-1 p-1 border rounded">${track.isSoloed ? 'Unsolo' : 'Solo'}</button>
                <button id="armInputBtn-${track.id}" class="flex-1 p-1 border rounded">Arm</button>
            </div>
            <div class="mt-2">
                <label for="trackNameInput-${track.id}" class="text-sm">Track Name:</label>
                <input type="text" id="trackNameInput-${track.id}" value="${track.name}" class="w-full p-1 border rounded bg-white dark:bg-black border-black dark:border-white">
            </div>
            ${editorButtonsHTML}
        </div>
        <div id="inspector-type-specific-controls-${track.id}"></div>
    `;

    const typeSpecificContainer = content.querySelector(`#inspector-type-specific-controls-${track.id}`);
    
    // Build type-specific controls based on track type
    switch(track.type) {
        case 'Synth':
            buildSynthControls(track, typeSpecificContainer);
            break;
        case 'Sampler':
            buildSlicerSamplerControls(track, typeSpecificContainer);
            break;
        case 'DrumSampler':
            buildDrumSamplerControls(track, typeSpecificContainer);
            break;
        case 'InstrumentSampler':
            buildInstrumentSamplerControls(track, typeSpecificContainer); // The element to modify is now definitely `typeSpecificContainer`
            break;
        case 'Audio':
            buildAudioTrackControls(track, typeSpecificContainer); 
            break;
    }

    return content;
}

/**
 * Initializes common event listeners for track controls (mute, solo, arm, name).
 * @param {object} track - The track object.
 * @param {HTMLElement} element - The root DOM element of the inspector window.
 */
function initializeCommonInspectorControls(track, element) {
    console.log(`[inspectorUI.js] Initializing common controls for track: ${track.id}`);

    const muteBtn = element.querySelector(`#muteBtn-${track.id}`);
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            localAppServices.handleTrackMute(track.id);
        });
    } else {
        console.warn(`[inspectorUI.js] Mute button with ID muteBtn-${track.id} not found.`);
    }

    const soloBtn = element.querySelector(`#soloBtn-${track.id}`);
    if (soloBtn) {
        soloBtn.addEventListener('click', () => {
            localAppServices.handleTrackSolo(track.id);
        });
    } else {
        console.warn(`[inspectorUI.js] Solo button with ID soloBtn-${track.id} not found.`);
    }

    const armBtn = element.querySelector(`#armInputBtn-${track.id}`);
    if (armBtn) {
        armBtn.addEventListener('click', () => {
            localAppServices.handleTrackArm(track.id);
        });
    } else {
        console.warn(`[inspectorUI.js] Arm button with ID armInputBtn-${track.id} not found.`);
    }

    const nameInput = element.querySelector(`#trackNameInput-${track.id}`);
    nameInput?.addEventListener('change', (e) => {
        localAppServices.captureStateForUndo?.(`Rename Track: ${track.name} to ${e.target.value}`);
        track.name = e.target.value;
        localAppServices.updateTrackUI(track.id, 'nameChanged');
    });

    const openPianoRollBtn = element.querySelector(`#openPianoRollBtn-${track.id}`);
    openPianoRollBtn?.addEventListener('click', () => {
        localAppServices.handleOpenPianoRoll?.(track.id);
    });

    const openEffectsRackBtn = element.querySelector(`#openEffectsRackBtn-${track.id}`);
    openEffectsRackBtn?.addEventListener('click', () => {
        localAppServices.handleOpenEffectsRack?.(track.id);
    });

    // Initial state updates for buttons
    const soloedTrackId = localAppServices.getSoloedTrackId();
    if (muteBtn) muteBtn.classList.toggle('muted', track.isMuted || (soloedTrackId !== null && soloedTrackId !== track.id));
    if (soloBtn) soloBtn.classList.toggle('soloed', track.isSoloed);
    if (armBtn) armBtn.classList.toggle('armed', localAppServices.getArmedTrackId() === track.id);
}

/**
 * Builds controls specific to Synth tracks.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach controls to.
 */
function buildSynthControls(track, container) {
    const controlsHtml = `
        <div class="panel">
            <h3 class="font-bold mb-2">Synthesizer</h3>
            <div id="oscillator-controls-${track.id}" class="control-group">
                <label>Oscillator</label>
                <div id="oscType-${track.id}-placeholder"></div>
            </div>
            <div id="envelope-controls-${track.id}" class="grid grid-cols-2 gap-x-2 gap-y-1">
                <div id="envAttack-${track.id}-placeholder"></div>
                <div id="envDecay-${track.id}-placeholder"></div>
                <div id="envSustain-${track.id}-placeholder"></div>
                <div id="envRelease-${track.id}-placeholder"></div>
            </div>
        </div>
    `;
    container.innerHTML = controlsHtml;
    // Build synth engine-specific controls using definitions from effectsRegistry
    buildSynthEngineControls(track, container, 'MonoSynth'); 
}

/**
 * Builds controls specific to Slicer Sampler tracks.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach controls to.
 */
function buildSlicerSamplerControls(track, container) {
    container.innerHTML = `
        <div class="panel">
            <h3 class="font-bold mb-2">Slicer Sampler</h3>
            <div id="dropZoneContainer-${track.id}">
                ${createDropZoneHTML(`slicer-file-input-${track.id}`)}
            </div>
            <canvas id="waveform-canvas-${track.id}" class="waveform-canvas mt-2"></canvas>
            <div class="mt-2 text-sm text-center text-secondary">${track.samplerAudioData.fileName || 'No sample loaded'}</div>
        </div>
        <div class="panel">
            <h3 class="font-bold mb-2">Slices</h3>
            <div id="sample-pads-container-${track.id}" class="mt-2"></div>
            <div id="slice-controls-container-${track.id}"></div>
        </div>
    `;
    const dzContainerEl = container.querySelector(`#dropZoneContainer-${track.id}`);
    const dzEl = dzContainerEl.querySelector('.drop-zone');
    // setupGenericDropZoneListeners is imported from utils.js
    setupGenericDropZoneListeners(
        dzEl,
        track.id,
        'Sampler',
        null, // No specific pad index for slicer
        localAppServices.loadSoundFromBrowserToTarget,
        localAppServices.loadSampleFile
    );
    
    const fileInputEl = dzContainerEl.querySelector(`input[type="file"]`); 
    if (fileInputEl) { 
        fileInputEl.onchange = (e) => localAppServices.loadSampleFile(e, track.id, 'Sampler');
    }
    
    const canvas = container.querySelector(`#waveform-canvas-${track.id}`);
    if (canvas && track.audioBuffer) { 
        drawWaveform(canvas, track.audioBuffer);
    }

    const padsContainer = container.querySelector(`#sample-pads-container-${track.id}`);
    renderSamplePads(track, padsContainer);
    // Initial update of slice editor UI for the default selected slice
    updateSliceEditorUI(track, container);
}

/**
 * Builds controls specific to Drum Sampler tracks.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach controls to.
 */
function buildDrumSamplerControls(track, container) {
    container.innerHTML = `
        <div class="panel">
            <h3 class="font-bold mb-2">Sampler Pads</h3>
            <div id="drum-pads-container-${track.id}" class="mt-2"></div>
            <div id="drum-pad-controls-container-${track.id}" class="mt-2"></div>
        </div>
    `;
    const padsContainer = container.querySelector(`#drum-pads-container-${track.id}`);
    const controlsContainer = container.querySelector(`#drum-pad-controls-container-${track.id}`);
    renderDrumSamplerPads(track, padsContainer);
    updateDrumPadControlsUI(track, controlsContainer);
}

/**
 * Builds controls specific to Instrument Sampler tracks.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach controls to.
 */
function buildInstrumentSamplerControls(track, container) {
    // Define the initial HTML content for the Instrument Sampler controls.
    // Ensure the main controls grid has a unique ID, like `instrument-sampler-controls-grid-${track.id}`
    // and that the placeholders are correctly nested within it.
    container.innerHTML = `
        <div class="panel">
            <h3 class="font-bold mb-2">Instrument Sampler</h3>
            <div id="dropZoneContainer-instrument-${track.id}">
                ${createDropZoneHTML(`instrument-file-input-${track.id}`)}
            </div>
            <canvas id="waveform-canvas-instrument-${track.id}" class="waveform-canvas mt-2"></canvas>
            <div class="mt-2 text-sm text-center text-secondary">${track.instrumentSamplerSettings.originalFileName || 'No sample loaded'}</div>
            
            <div id="instrument-sampler-controls-grid-${track.id}" class="mt-4 grid grid-cols-2 gap-2">
                <div id="instrumentSamplerVolume-${track.id}-placeholder"></div>
                <div id="instrumentSamplerPitchShift-${track.id}-placeholder"></div>
                <div id="instrumentSamplerLoop-${track.id}-placeholder" class="col-span-2 flex items-center"></div>
            </div>
            <div class="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                <h4 class="col-span-2 font-semibold mt-2">Envelope</h4>
                <div id="instrumentSamplerEnvAttack-${track.id}-placeholder"></div>
                <div id="instrumentSamplerEnvDecay-${track.id}-placeholder"></div>
                <div id="instrumentSamplerEnvSustain-${track.id}-placeholder"></div>
                <div id="instrumentSamplerEnvRelease-${track.id}-placeholder"></div>
            </div>
        </div>
    `;

    // Now, select the newly created grid container correctly
    const controlsGrid = container.querySelector(`#instrument-sampler-controls-grid-${track.id}`); // Corrected ID selection

    const dzContainerEl = container.querySelector(`#dropZoneContainer-instrument-${track.id}`);
    const dzEl = dzContainerEl.querySelector('.drop-zone');
    setupGenericDropZoneListeners(
        dzEl,
        track.id,
        'InstrumentSampler',
        null,
        localAppServices.loadSoundFromBrowserToTarget,
        localAppServices.loadSampleFile
    );

    const fileInputEl = dzContainerEl.querySelector(`input[type="file"]`); 
    if (fileInputEl) {
        fileInputEl.onchange = (e) => localAppServices.loadSampleFile(e, track.id, 'InstrumentSampler');
    }
    
    const canvas = container.querySelector(`#waveform-canvas-instrument-${track.id}`);
    if(canvas && track.instrumentSamplerSettings.audioBuffer) { 
        drawWaveform(canvas, track.instrumentSamplerSettings.audioBuffer);
    }

    // Volume knob for instrument sampler
    const volumeKnobPlaceholder = controlsGrid.querySelector(`#instrumentSamplerVolume-${track.id}-placeholder`); // Use controlsGrid
    if (volumeKnobPlaceholder) {
        const initialVolume = track.previousVolumeBeforeMute; 
        const volumeKnob = localAppServices.createKnob({
            label: 'Volume',
            min: 0,
            max: 1.2,
            step: 0.01,
            initialValue: initialVolume,
            onValueChange: (val, oldVal, fromInteraction) => {
                track.setVolume(val, fromInteraction); 
            }
        }, localAppServices.captureStateForUndo);
        volumeKnobPlaceholder.appendChild(volumeKnob.element);
    }

    // Pitch Shift knob for instrument sampler
    const pitchShiftKnobPlaceholder = controlsGrid.querySelector(`#instrumentSamplerPitchShift-${track.id}-placeholder`); // Use controlsGrid
    if (pitchShiftKnobPlaceholder) {
        const initialPitchShift = track.instrumentSamplerSettings.pitchShift || 0;
        const pitchKnob = localAppServices.createKnob({
            label: 'Pitch',
            min: -24,
            max: 24,
            step: 1,
            initialValue: initialPitchShift,
            onValueChange: (val) => {
                track.instrumentSamplerSettings.pitchShift = val;
                if (track.instrument) {
                    track.instrument.playbackRate = Math.pow(2, val / 12);
                }
            }
        }, localAppServices.captureStateForUndo); 
        pitchShiftKnobPlaceholder.appendChild(pitchKnob.element); 
    }

    // Loop checkbox for instrument sampler
    const loopCheckboxPlaceholder = controlsGrid.querySelector(`#instrumentSamplerLoop-${track.id}-placeholder`); // Use controlsGrid
    if (loopCheckboxPlaceholder) {
        loopCheckboxPlaceholder.innerHTML = `<label class="flex items-center space-x-2">
            <input type="checkbox" id="instrumentSamplerLoopCheckbox-${track.id}" class="form-checkbox" ${track.instrumentSamplerSettings.loop ? 'checked' : ''}> <span>Loop Sample</span>
        </label>`;
        const checkbox = loopCheckboxPlaceholder.querySelector(`#instrumentSamplerLoopCheckbox-${track.id}`);
        checkbox.addEventListener('change', (e) => {
            track.instrumentSamplerSettings.loop = e.target.checked;
            if (track.instrument) {
                track.instrument.loop = e.target.checked;
            }
            localAppServices.captureStateForUndo?.(`Toggle loop for ${track.name} sampler`);
        });
    }

    // Envelope controls
    const envelopeParams = [
        { id: 'EnvAttack', label: 'Attack', min: 0.001, max: 2, step: 0.001, decimals: 3, path: 'envelope.attack' },
        { id: 'EnvDecay', label: 'Decay', min: 0.01, max: 2, step: 0.01, decimals: 2, path: 'envelope.decay' },
        { id: 'EnvSustain', label: 'Sustain', min: 0, max: 1, step: 0.01, decimals: 2, path: 'envelope.sustain' },
        { id: 'EnvRelease', label: 'Release', min: 0.01, max: 5, step: 0.01, decimals: 2, path: 'envelope.release' },
    ];

    envelopeParams.forEach(paramDef => {
        const placeholder = container.querySelector(`#instrumentSampler${paramDef.id}-${track.id}-placeholder`); // These are still under the main `container`
        if (placeholder) {
            const initialValue = getNestedParam(track.instrumentSamplerSettings, paramDef.path) !== undefined
                                 ? getNestedParam(track.instrumentSamplerSettings, paramDef.path)
                                 : paramDef.defaultValue; 

            const knob = localAppServices.createKnob({
                label: paramDef.label,
                min: paramDef.min,
                max: paramDef.max,
                step: paramDef.step,
                initialValue: initialValue,
                decimals: paramDef.decimals,
                onValueChange: (val) => {
                    let current = track.instrumentSamplerSettings;
                    const keys = paramDef.path.split('.');
                    for (let i = 0; i < keys.length - 1; i++) {
                        current = current[keys[i]] = current[keys[i]] || {};
                    }
                    current[keys[keys.length - 1]] = val;

                    if (track.instrument && track.instrument.envelope && typeof track.instrument.envelope.set === 'function') {
                        track.instrument.envelope.set({ [keys.slice(1).join('.')]: val });
                    }
                }
            }, localAppServices.captureStateForUndo);
            placeholder.appendChild(knob.element);
        }
    });
}

/**
 * Builds controls specific to Audio tracks.
 * @param {object} track - The track object.
 * @param {HTMLElement} container - The DOM element to attach controls to.
 */
function buildAudioTrackControls(track, container) {
    container.innerHTML = `
        <div class="panel">
            <h3 class="font-bold mb-2">Audio Track</h3>
            <div id="audioMonitoring-${track.id}-placeholder" class="flex items-center space-x-2">
                <label for="monitorInputCheckbox-${track.id}" class="text-sm">Monitor Input:</label>
                <input type="checkbox" id="monitorInputCheckbox-${track.id}" class="form-checkbox" ${track.isMonitoringEnabled ? 'checked' : ''}>
            </div>
            <div id="audioDropZone-${track.id}" class="mt-4">
                ${createDropZoneHTML(`audio-track-file-input-${track.id}`, 'Drop Audio File to Create Clip')}
            </div>
        </div>
    `;

    const monitorCheckbox = container.querySelector(`#monitorInputCheckbox-${track.id}`);
    if (monitorCheckbox) {
        monitorCheckbox.addEventListener('change', (e) => {
            track.isMonitoringEnabled = e.target.checked;
            localAppServices.showNotification?.(`Monitoring for ${track.name} ${track.isMonitoringEnabled ? 'enabled' : 'disabled'}.`);
            if (localAppServices.isRecording() && localAppServices.getRecordingTrackId() === track.id) {
                localAppServices.showNotification?.("Monitoring change will apply on next recording start.", 3000);
            }
        });
    }

    const audioDropZone = container.querySelector(`#audioDropZone-${track.id} .drop-zone`);
    if (audioDropZone) {
        setupGenericDropZoneListeners(
            audioDropZone,
            track.id,
            'Audio',
            null,
            (soundData, targetTrackId, targetType) => {
                localAppServices.getAudioBlobFromSoundBrowserItem(soundData)
                    .then(blob => {
                        if (blob) {
                            localAppServices.showNotification(`Adding "${soundData.fileName}" to ${track.name}.`, 2000);
                            track.clips.addAudioClip(blob, 0, soundData.fileName);
                        }
                    })
                    .catch(e => {
                        localAppServices.showNotification(`Failed to load audio for clip: ${e.message}`, 3000);
                        console.error("Audio clip load error from Sound Browser:", e);
                    });
            },
            (e, targetTrackId, targetType) => {
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('audio/')) {
                    localAppServices.showNotification(`Adding "${file.name}" to ${track.name}.`, 2000);
                    track.clips.addAudioClip(file, 0, file.name); 
                }
            }
        );
    }
}