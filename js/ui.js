// js/ui.js - UI Module (v2025.02)
// Last updated: Timeline ruler with zoom control via scroll wheel
import { SnugWindow } from './SnugWindow.js';
// Added showConfirmationDialog to the import statement
import { showNotification, createDropZoneHTML, setupGenericDropZoneListeners, showCustomModal, createContextMenu, showConfirmationDialog } from './utils.js';
import * as Constants from './constants.js';
// Event handlers are now mostly called via appServices from main.js,
// but direct calls might still exist or be transitioned.
import {
    handleTrackMute, handleTrackSolo, handleTrackArm, handleRemoveTrack,
    handleOpenTrackInspector, handleOpenEffectsRack, handleOpenSequencer
} from './eventHandlers.js';
import { getTracksState } from './state.js';


// Module-level state for appServices, to be set by main.js
let localAppServices = {};
let selectedSoundForPreviewData = null; // Holds data for the sound selected for preview
let soundBrowserSearchQuery = ''; // Search/filter query for the sound browser
let timelineZoomLevel = 1.0; // Timeline zoom: 1.0 = default, higher = zoomed in
let timelineScrollX = 0; // Horizontal scroll offset for timeline

// Sound Browser tab state: 'browse' | 'favorites' | 'recent'
    let soundBrowserActiveTab = 'browse';

export function initializeUIModule(appServicesFromMain) {
    localAppServices = { ...localAppServices, ...appServicesFromMain };

    if (!localAppServices.getSelectedSoundForPreview) {
        console.log('[UI Init] getSelectedSoundForPreview service not found in appServices, wiring locally.');
        localAppServices.getSelectedSoundForPreview = () => selectedSoundForPreviewData;
    }
    if (!localAppServices.setSelectedSoundForPreview) {
        console.log('[UI Init] setSelectedSoundForPreview service not found in appServices, wiring locally.');
        localAppServices.setSelectedSoundForPreview = (data) => {
            console.log('[UI setSelectedSoundForPreview] Setting selected sound data:', JSON.stringify(data));
            selectedSoundForPreviewData = data;
        };
    }

    if (!localAppServices.effectsRegistryAccess) {
        console.warn("[UI Module] effectsRegistryAccess not found in appServices. Effect-related UI might be limited.");
        localAppServices.effectsRegistryAccess = {
            AVAILABLE_EFFECTS: {},
            getEffectParamDefinitions: () => [],
            getEffectDefaultParams: () => ({}),
            synthEngineControlDefinitions: {}
        };
    }
    if (!localAppServices.effectsRegistryAccess.synthEngineControlDefinitions) {
        localAppServices.effectsRegistryAccess.synthEngineControlDefinitions = {};
    }
}

// --- Knob UI ---
export function createKnob(options) {
    const container = document.createElement('div');
    container.className = 'knob-container';

    const labelEl = document.createElement('div');
    labelEl.className = 'knob-label';
    labelEl.textContent = options.label || '';
    labelEl.title = options.label || '';
    container.appendChild(labelEl);

    const knobEl = document.createElement('div');
    knobEl.className = 'knob';
    const handleEl = document.createElement('div');
    handleEl.className = 'knob-handle';
    knobEl.appendChild(handleEl);
    container.appendChild(knobEl);

    const valueEl = document.createElement('div');
    valueEl.className = 'knob-value';
    container.appendChild(valueEl);

    let currentValue = options.initialValue === undefined ? (options.min !== undefined ? options.min : 0) : options.initialValue;
    const min = options.min === undefined ? 0 : options.min;
    const max = options.max === undefined ? 100 : options.max;
    const step = options.step === undefined ? 1 : options.step;
    const range = max - min;
    const maxDegrees = options.maxDegrees || 270;
    const BASE_PIXELS_PER_FULL_RANGE_MOUSE = 300;
    const BASE_PIXELS_PER_FULL_RANGE_TOUCH = 450;
    let initialValueBeforeInteraction = currentValue;

    function updateKnobVisual() {
        const percentage = range === 0 ? 0 : (currentValue - min) / range;
        const rotation = (percentage * maxDegrees) - (maxDegrees / 2);
        handleEl.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
        
        // Display as dB if requested (Ableton-style)
        if (options.displayAsDb) {
            if (currentValue <= 0.0001) {
                valueEl.textContent = '-∞';
            } else {
                const dbValue = 20 * Math.log10(currentValue);
                valueEl.textContent = dbValue.toFixed(1);
            }
        } else {
            valueEl.textContent = typeof currentValue === 'number' ? currentValue.toFixed(options.decimals !== undefined ? options.decimals : (step < 1 && step !== 0 ? 2 : 0)) : currentValue;
            if (options.displaySuffix) valueEl.textContent += options.displaySuffix;
        }
    }

    function setValue(newValue, triggerCallback = true, fromInteraction = false) {
        const numValue = parseFloat(newValue);
        if (isNaN(numValue)) return;
        let boundedValue = Math.min(max, Math.max(min, numValue));
        if (step !== 0) boundedValue = Math.round(boundedValue / step) * step;
        boundedValue = Math.min(max, Math.max(min, boundedValue));
        const oldValue = currentValue;
        currentValue = boundedValue;
        updateKnobVisual();
        if (triggerCallback && options.onValueChange && (oldValue !== currentValue || fromInteraction) ) {
            options.onValueChange(currentValue, oldValue, fromInteraction);
        }
    }

    function handleInteraction(e, isTouch = false) {
        e.preventDefault();
        initialValueBeforeInteraction = currentValue;
        const startY = isTouch ? e.touches[0].clientY : e.clientY;
        const startValue = currentValue;
        const pixelsForFullRange = isTouch ? BASE_PIXELS_PER_FULL_RANGE_TOUCH : BASE_PIXELS_PER_FULL_RANGE_MOUSE;
        const currentSensitivity = options.sensitivity === undefined ? 1 : options.sensitivity;

        function onMove(moveEvent) {
            if (isTouch && moveEvent.touches.length === 0) return;
            const currentY = isTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;
            const deltaY = startY - currentY;
            let valueChange = (deltaY / pixelsForFullRange) * range * currentSensitivity;
            let newValue = startValue + valueChange;
            setValue(newValue, true, true);
        }

        function onEnd() {
            document.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
            document.removeEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
            if (currentValue !== initialValueBeforeInteraction && localAppServices.captureStateForUndo) {
                let description = `Change ${options.label || 'knob'} to ${valueEl.textContent}`;
                if (options.trackRef && options.trackRef.name) {
                    description = `Change ${options.label || 'knob'} for ${options.trackRef.name} to ${valueEl.textContent}`;
                }
                localAppServices.captureStateForUndo(description);
            }
        }
        document.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, { passive: !isTouch });
        document.addEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
    }
    knobEl.addEventListener('mousedown', (e) => handleInteraction(e, false));
    knobEl.addEventListener('touchstart', (e) => handleInteraction(e, true), { passive: false });
    setValue(currentValue, false); // Initialize visual
    return { element: container, setValue, getValue: () => currentValue, type: 'knob', refreshVisuals: updateKnobVisual };
}

// --- Specific Inspector DOM Builders ---
function buildSynthSpecificInspectorDOM(track) {
    const engineType = track.synthEngineType || 'MonoSynth';
    const definitions = ((localAppServices.effectsRegistryAccess) && (localAppServices.effectsRegistryAccess).synthEngineControlDefinitions)?.[engineType] || [];
    let controlsHTML = `<div id="synthEngineControls-${track.id}" class="grid grid-cols-2 md:grid-cols-3 gap-2 p-1">`;
    definitions.forEach(def => { controlsHTML += `<div id="${def.idPrefix}-${track.id}-placeholder"></div>`; });
    controlsHTML += `</div>`;
    return controlsHTML;
}

function buildSamplerSpecificInspectorDOM(track) {
    return `<div class="sampler-controls p-1 space-y-2">
        <div id="dropZoneContainer-${track.id}-sampler" class="mb-2"></div>
        <div class="waveform-section border rounded p-1 bg-gray-100 dark:bg-slate-700 dark:border-slate-600">
            <canvas id="waveformCanvas-${track.id}" class="w-full h-24 bg-white dark:bg-slate-800 rounded shadow-inner"></canvas>
        </div>
        <div class="slice-editor-controls mt-2 p-1 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 space-y-1">
            <h4 class="text-xs font-semibold dark:text-slate-200">Slice Editor (Selected: <span id="selectedSliceInfo-${track.id}">1</span>)</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1 items-center text-xs">
                <div id="sliceVolumeSlider-${track.id}-placeholder"></div>
                <div id="slicePitchKnob-${track.id}-placeholder"></div>
                <button id="sliceLoopToggle-${track.id}" class="px-1.5 py-0.5 text-xs border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600">Loop: OFF</button>
                <button id="sliceReverseToggle-${track.id}" class="px-1.5 py-0.5 text-xs border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600">Rev: OFF</button>
            </div>
            <div class="text-xs font-medium mt-1 dark:text-slate-300">Envelope:</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1 items-center text-xs">
                <div id="sliceEnvAttackSlider-${track.id}-placeholder"></div>
                <div id="sliceEnvDecaySlider-${track.id}-placeholder"></div>
                <div id="sliceEnvSustainSlider-${track.id}-placeholder"></div>
                <div id="sliceEnvReleaseSlider-${track.id}-placeholder"></div>
            </div>
            </div>
        <div id="samplePadsContainer-${track.id}" class="grid grid-cols-4 gap-1 mt-2"></div>
        <div><button id="slicerPolyphonyToggle-${track.id}" class="text-xs px-2 py-1 border rounded mt-1 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600">Mode: Poly</button></div>
    </div>`;
}

function buildInstrumentSamplerSpecificInspectorDOM(track) {
    return `<div class="instrument-sampler-controls p-1 space-y-2">
        <div id="dropZoneContainer-${track.id}-instrumentsampler" class="mb-2"></div>
        <div class="waveform-section border rounded p-1 bg-gray-100 dark:bg-slate-700 dark:border-slate-600">
           <canvas id="instrumentWaveformCanvas-${track.id}" class="w-full h-24 bg-white dark:bg-slate-800 rounded shadow-inner"></canvas>
        </div>
        <div class="instrument-params-controls mt-2 p-1 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 space-y-1 text-xs">
            <div class="grid grid-cols-2 gap-2 items-center">
                <div>
                    <label for="instrumentRootNote-${track.id}" class="block text-xs font-medium dark:text-slate-300">Root Note:</label>
                    <select id="instrumentRootNote-${track.id}" class="w-full p-1 border rounded text-xs bg-gray-50 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-600"></select>
                </div>
                <div>
                    <label for="instrumentLoopToggle-${track.id}" class="block text-xs font-medium dark:text-slate-300">Loop:</label>
                    <button id="instrumentLoopToggle-${track.id}" class="px-2 py-1 text-xs border rounded w-full dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600">Loop: OFF</button>
                </div>
                <div>
                    <label for="instrumentLoopStart-${track.id}" class="block text-xs font-medium dark:text-slate-300">Loop Start (s):</label>
                    <input type="number" id="instrumentLoopStart-${track.id}" step="0.001" class="w-full p-1 border rounded text-xs dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500">
                </div>
                <div>
                    <label for="instrumentLoopEnd-${track.id}" class="block text-xs font-medium dark:text-slate-300">Loop End (s):</label>
                    <input type="number" id="instrumentLoopEnd-${track.id}" step="0.001" class="w-full p-1 border rounded text-xs dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500">
                </div>
            </div>
             <div class="text-xs font-medium mt-1 dark:text-slate-300">Envelope:</div>
             <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1 items-center text-xs">
                <div id="instrumentEnvAttack-${track.id}-placeholder"></div>
                <div id="instrumentEnvDecay-${track.id}-placeholder"></div>
                <div id="instrumentEnvSustain-${track.id}-placeholder"></div>
                <div id="instrumentEnvRelease-${track.id}-placeholder"></div>
            </div>
            <div><button id="instrumentPolyphonyToggle-${track.id}" class="text-xs px-2 py-1 border rounded mt-1 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600">Mode: Poly</button></div>
        </div>
    </div>`;
}

function buildDrumSamplerSpecificInspectorDOM(track) {
    return `<div class="drum-sampler-controls p-1 space-y-2">
        <div class="selected-pad-controls p-1 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 space-y-1">
            <h4 class="text-xs font-semibold dark:text-slate-200">Edit Pad: <span id="selectedDrumPadInfo-${track.id}">1</span></h4>
            <div id="drumPadDropZoneContainer-${track.id}-${track.selectedDrumPadForEdit}" class="mb-1 text-xs"></div>
            <div class="grid grid-cols-2 gap-x-2 gap-y-1 items-center text-xs">
                <div id="drumPadVolumeKnob-${track.id}-placeholder"></div>
                <div id="drumPadPitchKnob-${track.id}-placeholder"></div>
            </div>
            <div class="text-xs font-medium mt-1 dark:text-slate-300">Envelope:</div>
             <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1 items-center text-xs">
                <div id="drumPadEnvAttack-${track.id}-placeholder"></div>
                <div id="drumPadEnvDecay-${track.id}-placeholder"></div>
                <div id="drumPadEnvSustain-${track.id}-placeholder"></div>
                <div id="drumPadEnvRelease-${track.id}-placeholder"></div>
            </div>
         </div>
        <div id="drumPadsGridContainer-${track.id}" class="grid grid-cols-4 gap-1 mt-2"></div>
    </div>`;
}

// --- Specific Inspector Control Initializers ---
function buildSynthEngineControls(track, container, engineType) {
    const definitions = ((localAppServices.effectsRegistryAccess) && (localAppServices.effectsRegistryAccess).synthEngineControlDefinitions)?.[engineType] || [];
    definitions.forEach(def => {
        const placeholder = container.querySelector(`#${def.idPrefix}-${track.id}-placeholder`);
        if (!placeholder) return;
        let initialValue;
        const pathParts = def.path.split('.');
        let currentValObj = track.synthParams;
        for (const key of pathParts) {
            if (currentValObj && typeof currentValObj === 'object' && key in currentValObj) {
                currentValObj = currentValObj[key];
            } else { currentValObj = undefined; break; }
        }
        initialValue = (currentValObj !== undefined) ? currentValObj : def.defaultValue;
        if (def.path.endsWith('.value') && ((track.instrument) && (track.instrument).get)) { // For Tone.Signal parameters
            const signalPath = def.path.substring(0, def.path.lastIndexOf('.value'));
            const signalValue = track.instrument.get(signalPath)?.value;
            if (signalValue !== undefined) initialValue = signalValue;
        }

        if (def.type === 'knob') {
            const knob = createKnob({ label: def.label, min: def.min, max: def.max, step: def.step, initialValue, decimals: def.decimals, displaySuffix: def.displaySuffix, trackRef: track, onValueChange: (val) => track.setSynthParam(def.path, val) });
            placeholder.innerHTML = ''; placeholder.appendChild(knob.element); track.inspectorControls[def.idPrefix] = knob;
        } else if (def.type === 'select') {
            const selectEl = document.createElement('select');
            selectEl.id = `${def.idPrefix}-${track.id}`;
            selectEl.className = 'synth-param-select w-full p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600';
            def.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = typeof opt === 'object' ? opt.value : opt; option.textContent = typeof opt === 'object' ? opt.text : opt;
                selectEl.appendChild(option);
            });
            selectEl.value = initialValue;
            selectEl.addEventListener('change', (e) => {
                if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Change ${def.label} for ${track.name} to ${e.target.value}`);
                track.setSynthParam(def.path, e.target.value);
            });
            const labelEl = document.createElement('label');
            labelEl.htmlFor = selectEl.id; labelEl.textContent = def.label + ':';
            labelEl.className = 'text-xs block mb-0.5 dark:text-slate-300';
            const wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'flex flex-col items-start'; wrapperDiv.appendChild(labelEl); wrapperDiv.appendChild(selectEl);
            placeholder.innerHTML = ''; placeholder.appendChild(wrapperDiv); track.inspectorControls[def.idPrefix] = selectEl;
        }
    });
}

function initializeSynthSpecificControls(track, winEl) {
    const engineType = track.synthEngineType || 'MonoSynth';
    const container = winEl.querySelector(`#synthEngineControls-${track.id}`);
    if (container) {
        buildSynthEngineControls(track, container, engineType);
    }
}

function initializeSamplerSpecificControls(track, winEl) {
    console.log(`[UI] initializeSamplerSpecificControls called for track ${track.id}, type: ${track.type}`);
    
    const dzContainerEl = winEl.querySelector(`#dropZoneContainer-${track.id}-sampler`);
    if (dzContainerEl) {
        const existingAudioData = { originalFileName: track.samplerAudioData.fileName, status: track.samplerAudioData.status || (track.samplerAudioData.fileName ? 'missing' : 'empty') };
        dzContainerEl.innerHTML = createDropZoneHTML(track.id, `fileInput-${track.id}`, 'Sampler', null, existingAudioData);
        const dzEl = dzContainerEl.querySelector('.drop-zone');
        const fileInputEl = dzContainerEl.querySelector(`#fileInput-${track.id}`);
        if (dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'Sampler', null, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadSampleFile);
        if (fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadSampleFile(e, track.id, 'Sampler'); };
    }
    
    console.log(`[UI] About to call renderSamplePads for track ${track.id}`);
    renderSamplePads(track);
    
    const canvas = winEl.querySelector(`#waveformCanvas-${track.id}`);
    if (canvas) {
        track.waveformCanvasCtx = canvas.getContext('2d');
        if(((track.audioBuffer) && (track.audioBuffer).loaded)) drawWaveform(track);
    }
    updateSliceEditorUI(track);

    const createAndPlaceKnob = (placeholderId, options) => {
        const placeholder = winEl.querySelector(`#${placeholderId}`);
        if (placeholder) {
            const knob = createKnob(options);
            placeholder.innerHTML = ''; placeholder.appendChild(knob.element); return knob;
        }
        return null;
    };
    const selectedSlice = track.slices[track.selectedSliceForEdit] || track.slices[0] || { volume: 0.7, pitchShift: 0, envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.1 } };
    track.inspectorControls.sliceVolume = createAndPlaceKnob(`sliceVolumeSlider-${track.id}-placeholder`, { label: 'Vol', min:0, max:1, step:0.01, initialValue: selectedSlice.volume, decimals:2, trackRef: track, onValueChange: (val) => track.setSliceVolume(track.selectedSliceForEdit, val)});
    track.inspectorControls.slicePitch = createAndPlaceKnob(`slicePitchKnob-${track.id}-placeholder`, { label: 'Pitch', min:-24, max:24, step:1, initialValue: selectedSlice.pitchShift, decimals:0, displaySuffix:'st', trackRef: track, onValueChange: (val) => track.setSlicePitchShift(track.selectedSliceForEdit, val)});
    track.inspectorControls.sliceEnvAttack = createAndPlaceKnob(`sliceEnvAttackSlider-${track.id}-placeholder`, { label: 'Attack', min:0.001, max:1, step:0.001, initialValue: selectedSlice.envelope.attack, decimals:3, trackRef: track, onValueChange: (val) => track.setSliceEnvelopeParam(track.selectedSliceForEdit, 'attack', val)});
    track.inspectorControls.sliceEnvDecay = createAndPlaceKnob(`sliceEnvDecaySlider-${track.id}-placeholder`, { label: 'Decay', min:0.01, max:1, step:0.01, initialValue: selectedSlice.envelope.decay, decimals:2, trackRef: track, onValueChange: (val) => track.setSliceEnvelopeParam(track.selectedSliceForEdit, 'decay', val)});
    track.inspectorControls.sliceEnvSustain = createAndPlaceKnob(`sliceEnvSustainSlider-${track.id}-placeholder`, { label: 'Sustain', min:0, max:1, step:0.01, initialValue: selectedSlice.envelope.sustain, decimals:2, trackRef: track, onValueChange: (val) => track.setSliceEnvelopeParam(track.selectedSliceForEdit, 'sustain', val)});
    track.inspectorControls.sliceEnvRelease = createAndPlaceKnob(`sliceEnvReleaseSlider-${track.id}-placeholder`, { label: 'Release', min:0.01, max:2, step:0.01, initialValue: selectedSlice.envelope.release, decimals:2, trackRef: track, onValueChange: (val) => track.setSliceEnvelopeParam(track.selectedSliceForEdit, 'release', val)});

    const loopToggleBtn = winEl.querySelector(`#sliceLoopToggle-${track.id}`);
    if (loopToggleBtn) {
        loopToggleBtn.textContent = selectedSlice.loop ? 'Loop: ON' : 'Loop: OFF';
        loopToggleBtn.classList.toggle('active', selectedSlice.loop);
        loopToggleBtn.addEventListener('click', (e) => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle Loop for Slice ${track.selectedSliceForEdit + 1} on ${track.name}`);
            const currentSlice = track.slices[track.selectedSliceForEdit];
            track.setSliceLoop(track.selectedSliceForEdit, !currentSlice.loop);
            e.target.textContent = currentSlice.loop ? 'Loop: ON' : 'Loop: OFF';
            e.target.classList.toggle('active', currentSlice.loop);
        });
    }
    const reverseToggleBtn = winEl.querySelector(`#sliceReverseToggle-${track.id}`);
    if(reverseToggleBtn){
        reverseToggleBtn.textContent = selectedSlice.reverse ? 'Rev: ON' : 'Rev: OFF';
        reverseToggleBtn.classList.toggle('active', selectedSlice.reverse);
        reverseToggleBtn.addEventListener('click', (e) => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle Reverse for Slice ${track.selectedSliceForEdit + 1} on ${track.name}`);
            const currentSlice = track.slices[track.selectedSliceForEdit];
            track.setSliceReverse(track.selectedSliceForEdit, !currentSlice.reverse);
            e.target.textContent = currentSlice.reverse ? 'Rev: ON' : 'Rev: OFF';
            e.target.classList.toggle('active', currentSlice.reverse);
        });
    }
    const polyToggleBtn = winEl.querySelector(`#slicerPolyphonyToggle-${track.id}`);
    if (polyToggleBtn) {
        polyToggleBtn.textContent = `Mode: ${track.slicerIsPolyphonic ? 'Poly' : 'Mono'}`;
        polyToggleBtn.classList.toggle('active', track.slicerIsPolyphonic);
        polyToggleBtn.addEventListener('click', () => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle Slicer Polyphony for ${track.name}`);
            track.slicerIsPolyphonic = !track.slicerIsPolyphonic;
            polyToggleBtn.textContent = `Mode: ${track.slicerIsPolyphonic ? 'Poly' : 'Mono'}`;
        polyToggleBtn.classList.toggle('active', track.slicerIsPolyphonic);
            if (!track.slicerIsPolyphonic) track.setupSlicerMonoNodes(); else track.disposeSlicerMonoNodes();
            track.rebuildEffectChain();
            showNotification(`${track.name} slicer mode: ${track.slicerIsPolyphonic ? 'Poly' : 'Mono'}`, 2000);
        });
    }
}


// --- Track Inspector Window (Entry Point) ---
function buildTrackInspectorContentDOM(track) {
    if (!track) return '<div>Error: Track data not found.</div>';
    let specificControlsHTML = '';
    if (track.type === 'Synth') specificControlsHTML = buildSynthSpecificInspectorDOM(track);
    else if (track.type === 'Sampler') specificControlsHTML = buildSamplerSpecificInspectorDOM(track);
    else if (track.type === 'DrumSampler') specificControlsHTML = buildDrumSamplerSpecificInspectorDOM(track);
    else if (track.type === 'InstrumentSampler') specificControlsHTML = buildInstrumentSamplerSpecificInspectorDOM(track);

    const armedTrackId = localAppServices.getArmedTrackId ? localAppServices.getArmedTrackId() : null;
    let sequencerButtonHTML = '';
    if (track.type !== 'Audio') {
        sequencerButtonHTML = `<button id="openSequencerBtn-${track.id}" class="px-1 py-0.5 border rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 dark:border-slate-500">Sequencer</button>`;
    }

    let monitorButtonHTML = '';
    if (track.type === 'Audio') {
        monitorButtonHTML = `<button id="monitorBtn-${track.id}" title="Toggle Input Monitoring" class="px-1 py-0.5 border rounded dark:border-slate-500 dark:hover:bg-slate-600 ${track.isMonitoringEnabled ? 'active' : ''}">Monitor</button>`;
    }

    return `
        <div class="track-inspector-content p-1 space-y-1 text-xs text-gray-700 dark:text-slate-300 overflow-y-auto h-full">
            <div class="common-controls grid ${track.type === 'Audio' ? 'grid-cols-4' : 'grid-cols-3'} gap-1 mb-1">
                <button id="muteBtn-${track.id}" title="Mute Track" class="px-1 py-0.5 border rounded dark:border-slate-500 dark:hover:bg-slate-600 ${track.isMuted ? 'muted' : ''}">${track.isMuted ? 'Unmute' : 'Mute'}</button>
                <button id="soloBtn-${track.id}" title="Solo Track" class="px-1 py-0.5 border rounded dark:border-slate-500 dark:hover:bg-slate-600 ${track.isSoloed ? 'soloed' : ''}">${track.isSoloed ? 'Unsolo' : 'Solo'}</button>
                ${monitorButtonHTML}
                <button id="armInputBtn-${track.id}" title="Arm for MIDI/Keyboard Input or Audio Recording" class="px-1 py-0.5 border rounded dark:border-slate-500 dark:hover:bg-slate-600 ${armedTrackId === track.id ? 'armed' : ''}">Arm</button>
            </div>
            <div id="volumeKnob-${track.id}-placeholder" class="mb-1"></div>
            <div id="trackMeterContainer-${track.id}" class="h-3 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden my-1">
                <div id="trackMeterBar-${track.id}" class="h-full bg-pink-400 transition-all duration-50 ease-linear" style="width: 0%; background-color:${track.trackColor || '#6366f1'}"></div>
            </div>
            <div class="type-specific-controls mt-1 border-t dark:border-slate-600 pt-1">${specificControlsHTML}</div>
            <div class="inspector-nav grid ${track.type === 'Audio' ? 'grid-cols-2' : 'grid-cols-3'} gap-1 mt-2">
                <button id="openEffectsBtn-${track.id}" class="px-1 py-0.5 border rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 dark:border-slate-500">Effects</button>
                ${sequencerButtonHTML}
                <button id="removeTrackBtn-${track.id}" class="px-1 py-0.5 border rounded bg-red-400 hover:bg-red-500 text-white dark:bg-red-600 dark:hover:bg-red-700 dark:border-red-500">Remove</button>
            </div>
        </div>`;
}

export function openTrackInspectorWindow(trackId, savedState = null) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) { console.error(`[UI] Track ${trackId} not found for inspector.`); return null; }

    const windowId = `trackInspector-${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) {
        openWindows.get(windowId).restore(); return openWindows.get(windowId);
    }

    const contentDOM = buildTrackInspectorContentDOM(track);
    // Larger window for DrumSampler to show pads
    const baseHeight = track.type === 'DrumSampler' ? 580 : 450;
    const inspectorOptions = { width: 320, height: baseHeight, minWidth: 280, minHeight: 350, initialContentKey: windowId, onCloseCallback: () => { /* main.js can clear track.inspectorWindow if needed */ } };
    if (savedState) { Object.assign(inspectorOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized }); }

    const inspectorWindow = localAppServices.createWindow(windowId, `Inspector: ${track.name}`, contentDOM, inspectorOptions);

    if (((inspectorWindow) && (inspectorWindow).element)) {
        initializeCommonInspectorControls(track, inspectorWindow.element);
        initializeTypeSpecificInspectorControls(track, inspectorWindow.element);
    }
    return inspectorWindow;
}

function initializeCommonInspectorControls(track, winEl) {
    winEl.querySelector(`#muteBtn-${track.id}`)?.addEventListener('click', () => handleTrackMute(track.id));
    winEl.querySelector(`#soloBtn-${track.id}`)?.addEventListener('click', () => handleTrackSolo(track.id));
    winEl.querySelector(`#armInputBtn-${track.id}`)?.addEventListener('click', () => handleTrackArm(track.id));

    const monitorBtn = winEl.querySelector(`#monitorBtn-${track.id}`);
    if (monitorBtn) {
        monitorBtn.addEventListener('click', () => {
            if (track.type === 'Audio') { // Ensure it's an audio track
                track.isMonitoringEnabled = !track.isMonitoringEnabled;
                monitorBtn.classList.toggle('active', track.isMonitoringEnabled);
                showNotification(`Input Monitoring ${track.isMonitoringEnabled ? 'ON' : 'OFF'} for ${track.name}`, 2000);
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo(`Toggle Monitoring for ${track.name} to ${track.isMonitoringEnabled ? 'ON' : 'OFF'}`);
                }
            }
        });
    }

    winEl.querySelector(`#removeTrackBtn-${track.id}`)?.addEventListener('click', () => handleRemoveTrack(track.id));
    winEl.querySelector(`#openEffectsBtn-${track.id}`)?.addEventListener('click', () => handleOpenEffectsRack(track.id));

    const sequencerBtn = winEl.querySelector(`#openSequencerBtn-${track.id}`);
    if (sequencerBtn) {
        sequencerBtn.addEventListener('click', () => handleOpenSequencer(track.id));
    }


    const volumeKnobPlaceholder = winEl.querySelector(`#volumeKnob-${track.id}-placeholder`);
    if (volumeKnobPlaceholder) {
        const volumeKnob = createKnob({ label: 'Volume', min: 0, max: 1.2, step: 0.01, initialValue: track.previousVolumeBeforeMute, decimals: 2, trackRef: track, onValueChange: (val, o, fromInteraction) => track.setVolume(val, fromInteraction) });
        volumeKnobPlaceholder.innerHTML = ''; volumeKnobPlaceholder.appendChild(volumeKnob.element); track.inspectorControls.volume = volumeKnob;
    }
}

function initializeTypeSpecificInspectorControls(track, winEl) {
    if (track.type === 'Synth') initializeSynthSpecificControls(track, winEl);
    else if (track.type === 'Sampler') initializeSamplerSpecificControls(track, winEl);
    else if (track.type === 'DrumSampler') {
        // Set up drop zone for drum pad sample upload
        const dzContainerEl = winEl.querySelector(`#drumPadDropZoneContainer-${track.id}-${track.selectedDrumPadForEdit}`);
        if (dzContainerEl) {
            const existingAudioData = track.drumSamplerPads && track.drumSamplerPads[track.selectedDrumPadForEdit] ? 
                { fileName: track.drumSamplerPads[track.selectedDrumPadForEdit].fileName, status: 'loaded' } : 
                { fileName: null, status: 'empty' };
            dzContainerEl.innerHTML = createDropZoneHTML(track.id, `drumPadFileInput-${track.id}-${track.selectedDrumPadForEdit}`, 'DrumSampler', track.selectedDrumPadForEdit, existingAudioData);
            const dzEl = dzContainerEl.querySelector('.drop-zone');
            const fileInputEl = dzContainerEl.querySelector(`#drumPadFileInput-${track.id}-${track.selectedDrumPadForEdit}`);
            if (dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'DrumSampler', track.selectedDrumPadForEdit, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadDrumSamplerPadFile);
            if (fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadDrumSamplerPadFile(e, track.id, track.selectedDrumPadForEdit); };
        }
        renderDrumSamplerPads(track);
        updateDrumPadControlsUI(track);
    }
    else if (track.type === 'InstrumentSampler') initializeInstrumentSamplerSpecificControls(track, winEl);
}

// --- Modular Effects Rack UI ---
function showTrackColorPicker(track) {
    const colors = Constants.TRACK_COLORS || ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7'];
    let swatchesHTML = '';
    colors.forEach(color => {
        const isSelected = track.trackColor === color;
        swatchesHTML += `<div class="track-color-swatch ${isSelected ? 'selected' : ''}" 
            style="background-color:${color}" 
            data-color="${color}"
            title="${color}"></div>`;
    });

    const modal = showCustomModal(`Color for ${track.name}`, 
        `<div class="track-color-picker">${swatchesHTML}</div>`,
        [{ label: 'Done', action: () => modal.overlay.remove() }]
    );

    if (((modal) && (modal).contentDiv)) {
        modal.contentDiv.querySelectorAll('.track-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const newColor = swatch.dataset.color;
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo(`Change track color on ${track.name}`);
                }
                track.setTrackColor(newColor);
                modal.overlay.remove();
                // Re-render mixer to update color dots
                const mixerWindowEl = localAppServices.getWindowById ? localAppServices.getWindowById('mixer')?.element : null;
                if (mixerWindowEl) {
                    const container = mixerWindowEl.querySelector('#mixerContent');
                    if (container) renderMixer(container);
                }
            });
        });
    }
}

function buildModularEffectsRackDOM(owner, ownerType = 'track') {
    const ownerId = (ownerType === 'track' && owner) ? owner.id : 'master';
    const ownerName = (ownerType === 'track' && owner) ? owner.name : 'Master Bus';
    return `<div id="effectsRackContent-${ownerId}" class="p-2 space-y-2 overflow-y-auto h-full">
        <h3 class="text-sm font-semibold dark:text-slate-200">Effects Rack: ${ownerName}</h3>
        <div id="effectsList-${ownerId}" class="space-y-1 min-h-[50px] border rounded p-1 bg-gray-100 dark:bg-slate-700 dark:border-slate-600"></div>
        <button id="addEffectBtn-${ownerId}" class="text-xs px-2 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 dark:bg-purple-500 dark:hover:bg-purple-600">Add Effect</button>
        <div id="effectControlsContainer-${ownerId}" class="mt-2 space-y-2"></div>
    </div>`;
}

export function renderEffectsList(owner, ownerType, listDiv, controlsContainer) {
    if (!listDiv) return;
    listDiv.innerHTML = '';
    const effectsArray = (ownerType === 'track' && owner) ? owner.activeEffects : (localAppServices.getMasterEffects ? localAppServices.getMasterEffects() : []);

    if (!effectsArray || effectsArray.length === 0) {
        listDiv.innerHTML = '<p class="text-xs text-gray-500 dark:text-slate-400 italic">No effects added.</p>';
        if (controlsContainer) controlsContainer.innerHTML = ''; return;
    }

    const AVAILABLE_EFFECTS_LOCAL = ((localAppServices.effectsRegistryAccess) && (localAppServices.effectsRegistryAccess).AVAILABLE_EFFECTS) || {};

    effectsArray.forEach((effect, index) => {
        const effectDef = AVAILABLE_EFFECTS_LOCAL[effect.type];
        const displayName = effectDef ? effectDef.displayName : effect.type;
        const item = document.createElement('div');
        item.className = 'effect-item flex justify-between items-center p-1 border-b bg-white dark:bg-slate-800 dark:border-slate-700 rounded-sm shadow-xs text-xs';
        item.innerHTML = `<span class="effect-name flex-grow cursor-pointer hover:text-purple-500 dark:text-slate-300 dark:hover:text-purple-300" title="Edit ${displayName}">${displayName}</span>
            <div class="effect-actions">
                <button class="up-btn text-xs px-0.5 ${index === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:text-pink-500 dark:hover:text-pink-300'} dark:text-slate-400" ${index === 0 ? 'disabled' : ''} title="Move Up">▲</button>
                <button class="down-btn text-xs px-0.5 ${index === effectsArray.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:text-pink-500 dark:hover:text-pink-300'} dark:text-slate-400" ${index === effectsArray.length - 1 ? 'disabled' : ''} title="Move Down">▼</button>
                <button class="remove-btn text-xs px-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Remove Effect">✕</button>
            </div>`;
        item.querySelector('.effect-name').addEventListener('click', () => {
            renderEffectControls(owner, ownerType, effect.id, controlsContainer);
            listDiv.querySelectorAll('.bg-blue-100,.dark\\:bg-purple-600').forEach(el => el.classList.remove('bg-blue-100', 'dark:bg-purple-600', 'border-purple-400', 'dark:border-purple-600'));
            item.classList.add('bg-blue-100', 'dark:bg-purple-600', 'border-purple-400', 'dark:border-purple-600');
        });
        item.querySelector('.up-btn').addEventListener('click', () => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Reorder effect on ${ownerType === 'track' ? owner.name : 'Master'}`);
            if (ownerType === 'track') owner.reorderEffect(effect.id, index - 1);
            else if (localAppServices.reorderMasterEffect) localAppServices.reorderMasterEffect(effect.id, index - 1);
        });
        item.querySelector('.down-btn').addEventListener('click', () => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Reorder effect on ${ownerType === 'track' ? owner.name : 'Master'}`);
            if (ownerType === 'track') owner.reorderEffect(effect.id, index + 1);
            else if (localAppServices.reorderMasterEffect) localAppServices.reorderMasterEffect(effect.id, index + 1);
        });
        item.querySelector('.remove-btn').addEventListener('click', () => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Remove ${effect.type} from ${ownerType === 'track' ? owner.name : 'Master'}`);
            if (ownerType === 'track') owner.removeEffect(effect.id);
            else if (localAppServices.removeMasterEffect) localAppServices.removeMasterEffect(effect.id);
        });
        listDiv.appendChild(item);
    });
}

export function renderEffectControls(owner, ownerType, effectId, controlsContainer) {
    if (!controlsContainer) return;
    controlsContainer.innerHTML = '';
    const effectsArray = (ownerType === 'track' && owner) ? owner.activeEffects : (localAppServices.getMasterEffects ? localAppServices.getMasterEffects() : []);
    const effectWrapper = effectsArray.find(e => e.id === effectId);

    if (!effectWrapper) { controlsContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-slate-400 italic">Select an effect.</p>'; return; }

    const AVAILABLE_EFFECTS_LOCAL = ((localAppServices.effectsRegistryAccess) && (localAppServices.effectsRegistryAccess).AVAILABLE_EFFECTS) || {};
    const effectDef = AVAILABLE_EFFECTS_LOCAL[effectWrapper.type];

    if (!effectDef) { controlsContainer.innerHTML = `<p class="text-xs text-red-500">Error: Definition for "${effectWrapper.type}" not found.</p>`; return; }

    const titleEl = document.createElement('h4');
    titleEl.className = 'text-xs font-semibold mb-1 dark:text-slate-200'; titleEl.textContent = `Controls: ${effectDef.displayName}`;
    controlsContainer.appendChild(titleEl);
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 text-xs';

    if (!effectDef.params || effectDef.params.length === 0) {
        gridContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-slate-400 italic col-span-full">No adjustable parameters.</p>';
    } else {
        effectDef.params.forEach(paramDef => {
            const controlWrapper = document.createElement('div');
            let initialValue;
            const pathKeys = paramDef.key.split('.');
            let tempVal = effectWrapper.params;
            for (const key of pathKeys) {
                if (tempVal && typeof tempVal === 'object' && key in tempVal) {
                    tempVal = tempVal[key];
                } else {
                    tempVal = undefined;
                    break;
                }
            }
            initialValue = (tempVal !== undefined) ? tempVal : paramDef.defaultValue;

            if (paramDef.type === 'knob') {
                const knob = createKnob({ label: paramDef.label, min: paramDef.min, max: paramDef.max, step: paramDef.step, initialValue: initialValue, decimals: paramDef.decimals, displaySuffix: paramDef.displaySuffix, trackRef: (ownerType === 'track' ? owner : null), onValueChange: (val) => { if (ownerType === 'track' && owner) owner.updateEffectParam(effectId, paramDef.key, val); else if (localAppServices.updateMasterEffectParam) localAppServices.updateMasterEffectParam(effectId, paramDef.key, val); } });
                controlWrapper.appendChild(knob.element);
            } else if (paramDef.type === 'select') {
                const label = document.createElement('label');
                label.className = 'block text-xs font-medium mb-0.5 dark:text-slate-300';
                label.textContent = paramDef.label + ':';
                const select = document.createElement('select');
                select.className = 'w-full p-1 border rounded text-xs bg-gray-50 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-600';
                paramDef.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = typeof opt === 'object' ? opt.value : opt;
                    option.textContent = typeof opt === 'object' ? opt.text : opt;
                    select.appendChild(option);
                });
                select.value = initialValue;
                select.addEventListener('change', (e) => {
                    const newValue = e.target.value;
                    const finalValue = (typeof paramDef.defaultValue === 'number' && !isNaN(parseFloat(newValue))) ? parseFloat(newValue) : newValue;
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Change ${paramDef.label} for ${effectWrapper.type} on ${ownerType === 'track' ? owner.name : 'Master'}`);
                    if (ownerType === 'track' && owner) owner.updateEffectParam(effectId, paramDef.key, finalValue);
                    else if (localAppServices.updateMasterEffectParam) localAppServices.updateMasterEffectParam(effectId, paramDef.key, finalValue);
                });
                controlWrapper.appendChild(label);
                controlWrapper.appendChild(select);
            } else if (paramDef.type === 'toggle') {
                const button = document.createElement('button');
                button.className = `w-full p-1 border rounded text-xs dark:border-slate-500 dark:text-slate-300 ${initialValue ? 'bg-purple-400 text-white dark:bg-purple-500' : 'bg-gray-200 dark:bg-slate-600'}`;
                button.textContent = `${paramDef.label}: ${initialValue ? 'ON' : 'OFF'}`;
                button.addEventListener('click', () => {
                    const newValue = !initialValue;
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle ${paramDef.label} for ${effectWrapper.type} on ${ownerType === 'track' ? owner.name : 'Master'}`);
                    if (ownerType === 'track' && owner) owner.updateEffectParam(effectId, paramDef.key, newValue);
                    else if (localAppServices.updateMasterEffectParam) localAppServices.updateMasterEffectParam(effectId, paramDef.key, newValue);
                });
                controlWrapper.appendChild(button);
            }
            gridContainer.appendChild(controlWrapper);
        });
    }
    controlsContainer.appendChild(gridContainer);
}

function showAddEffectModal(owner, ownerType) {
    const ownerName = (ownerType === 'track' && owner) ? owner.name : 'Master Bus';
    let modalContentHTML = `<div class="max-h-60 overflow-y-auto"><ul class="list-none p-0 m-0">`;
    const AVAILABLE_EFFECTS_LOCAL = ((localAppServices.effectsRegistryAccess) && (localAppServices.effectsRegistryAccess).AVAILABLE_EFFECTS) || {};
    
    // DEBUG: Log what we're getting
    console.log('[showAddEffectModal] effectsRegistryAccess:', localAppServices.effectsRegistryAccess);
    console.log('[showAddEffectModal] AVAILABLE_EFFECTS_LOCAL keys:', Object.keys(AVAILABLE_EFFECTS_LOCAL));
    console.log('[showAddEffectModal] AVAILABLE_EFFECTS_LOCAL length:', Object.keys(AVAILABLE_EFFECTS_LOCAL).length);
    
    for (const effectKey in AVAILABLE_EFFECTS_LOCAL) { modalContentHTML += `<li class="p-1.5 hover:bg-purple-200 dark:hover:bg-purple-600 cursor-pointer border-b dark:border-slate-600 text-sm dark:text-slate-200" data-effect-type="${effectKey}">${AVAILABLE_EFFECTS_LOCAL[effectKey].displayName}</li>`; }
    modalContentHTML += `</ul></div>`;
    const modal = showCustomModal(`Add Effect to ${ownerName}`, modalContentHTML, [], 'add-effect-modal');
    if (((modal) && (modal).contentDiv)) {
        modal.contentDiv.querySelectorAll('li[data-effect-type]').forEach(item => {
            item.addEventListener('click', () => {
                const effectType = item.dataset.effectType;
                if (ownerType === 'track' && owner) {
                    owner.addEffect(effectType);
                } else if (ownerType === 'master' && localAppServices.addMasterEffect) {
                    localAppServices.addMasterEffect(effectType);
                }
                modal.overlay.remove();
            });
        });
    }
}

// --- Window Opening Functions ---
export function openTrackEffectsRackWindow(trackId, savedState = null) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return null;
    const windowId = `effectsRack-${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) { openWindows.get(windowId).restore(); return openWindows.get(windowId); }

    const contentDOM = buildModularEffectsRackDOM(track, 'track');
    const rackOptions = { width: 350, height: 400, minWidth: 300, minHeight: 250, initialContentKey: windowId };
    if (savedState) Object.assign(rackOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const rackWindow = localAppServices.createWindow(windowId, `Effects: ${track.name}`, contentDOM, rackOptions);
    if (((rackWindow) && (rackWindow).element)) {
        renderEffectsList(track, 'track', rackWindow.element.querySelector(`#effectsList-${track.id}`), rackWindow.element.querySelector(`#effectControlsContainer-${track.id}`));
        rackWindow.element.querySelector(`#addEffectBtn-${track.id}`)?.addEventListener('click', () => showAddEffectModal(track, 'track'));
    }
    return rackWindow;
}

export function openMasterEffectsRackWindow(savedState = null) {
    const windowId = 'masterEffectsRack';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) { openWindows.get(windowId).restore(); return openWindows.get(windowId); }

    const contentDOM = buildModularEffectsRackDOM(null, 'master');
    const rackOptions = { width: 350, height: 400, minWidth: 300, minHeight: 250, initialContentKey: windowId };
    if (savedState) Object.assign(rackOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const rackWindow = localAppServices.createWindow(windowId, 'Master Effects Rack', contentDOM, rackOptions);
    if (((rackWindow) && (rackWindow).element)) {
        renderEffectsList(null, 'master', rackWindow.element.querySelector(`#effectsList-master`), rackWindow.element.querySelector(`#effectControlsContainer-master`));
        rackWindow.element.querySelector(`#addEffectBtn-master`)?.addEventListener('click', () => showAddEffectModal(null, 'master'));
    }
    return rackWindow;
}

export function openGlobalControlsWindow(onReadyCallback, savedState = null) {
    const windowId = 'globalControls';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        if (typeof onReadyCallback === 'function' && win.element) {
            onReadyCallback({
                playBtnGlobal: win.element.querySelector('#playBtnGlobal'),
                recordBtnGlobal: win.element.querySelector('#recordBtnGlobal'),
                stopBtnGlobal: win.element.querySelector('#stopBtnGlobal'), // MODIFICATION: Include stop button
                tempoGlobalInput: win.element.querySelector('#tempoGlobalInput'),
                midiInputSelectGlobal: win.element.querySelector('#midiInputSelectGlobal'),
                masterMeterContainerGlobal: win.element.querySelector('#masterMeterContainerGlobal'),
                masterMeterBarGlobal: win.element.querySelector('#masterMeterBarGlobal'),
                midiIndicatorGlobal: win.element.querySelector('#midiIndicatorGlobal'),
                keyboardIndicatorGlobal: win.element.querySelector('#keyboardIndicatorGlobal'),
                playbackModeToggleBtnGlobal: win.element.querySelector('#playbackModeToggleBtnGlobal')
            });
        }
        return win;
    }

    // MODIFICATION: Added stopBtnGlobal to the HTML and adjusted grid layout
    const contentHTML = `<div id="global-controls-content" class="p-2.5 space-y-3 text-sm text-gray-700 dark:text-slate-300">
        <div class="grid grid-cols-3 gap-2 items-center">
            <button id="playBtnGlobal" title="Play/Pause (Spacebar)" class="bg-pink-400 hover:bg-pink-500 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-pink-500 dark:hover:bg-pink-600">Play</button>
            <button id="stopBtnGlobal" title="Stop All Audio (Panic)" class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-yellow-600 dark:hover:bg-yellow-700">Stop</button>
            <button id="recordBtnGlobal" title="Record Arm/Disarm" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-red-600 dark:hover:bg-red-700">Record</button>
        </div>
        <div> <label for="tempoGlobalInput" class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">Tempo (BPM):</label> <input type="number" id="tempoGlobalInput" value="120" min="30" max="300" step="0.1" class="w-full p-1.5 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-purple-600 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> </div>
        <div> <label for="midiInputSelectGlobal" class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">MIDI Input:</label> <select id="midiInputSelectGlobal" class="w-full p-1.5 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-purple-600 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> <option value="">No MIDI Input</option> </select> </div>
        <div class="pt-1"> <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">Master Level:</label> <div id="masterMeterContainerGlobal" class="h-5 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden shadow-sm"> <div id="masterMeterBarGlobal" class="h-full bg-purple-400 transition-all duration-50 ease-linear" style="width: 0%;"></div> </div> </div>
        <div class="flex justify-between items-center text-xs mt-1.5"> <span id="midiIndicatorGlobal" title="MIDI Activity" class="px-2 py-1 rounded-full bg-gray-300 text-gray-600 font-medium transition-colors duration-150 dark:bg-slate-600 dark:text-slate-300">MIDI</span> <span id="keyboardIndicatorGlobal" title="Computer Keyboard Activity" class="px-2 py-1 rounded-full bg-gray-300 text-gray-600 font-medium transition-colors duration-150 dark:bg-slate-600 dark:text-slate-300">KBD</span> </div>
        <div class="mt-2"> <button id="playbackModeToggleBtnGlobal" title="Toggle Playback Mode (Sequencer/Timeline)" class="w-full bg-violet-400 hover:bg-violet-500 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-violet-500 dark:hover:bg-violet-600">Mode: Sequencer</button> </div>
    </div>`;
    const options = { width: 280, height: 360, minWidth: 250, minHeight: 340, closable: true, minimizable: true, resizable: true, initialContentKey: windowId }; // Adjusted height slightly
    if (savedState) Object.assign(options, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const newWindow = localAppServices.createWindow(windowId, 'Global Controls', contentHTML, options);
    if (((newWindow) && (newWindow).element) && typeof onReadyCallback === 'function') {
        onReadyCallback({
            playBtnGlobal: newWindow.element.querySelector('#playBtnGlobal'),
            recordBtnGlobal: newWindow.element.querySelector('#recordBtnGlobal'),
            stopBtnGlobal: newWindow.element.querySelector('#stopBtnGlobal'), // MODIFICATION: Include stop button
            tempoGlobalInput: newWindow.element.querySelector('#tempoGlobalInput'),
            midiInputSelectGlobal: newWindow.element.querySelector('#midiInputSelectGlobal'),
            masterMeterContainerGlobal: newWindow.element.querySelector('#masterMeterContainerGlobal'),
            masterMeterBarGlobal: newWindow.element.querySelector('#masterMeterBarGlobal'),
            midiIndicatorGlobal: newWindow.element.querySelector('#midiIndicatorGlobal'),
            keyboardIndicatorGlobal: newWindow.element.querySelector('#keyboardIndicatorGlobal'),
            playbackModeToggleBtnGlobal: newWindow.element.querySelector('#playbackModeToggleBtnGlobal')
        });
    }
    return newWindow;
}

export function openSoundBrowserWindow(savedState = null) {
    const windowId = 'soundBrowser';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        const currentLibNameFromState = localAppServices.getCurrentLibraryName ? localAppServices.getCurrentLibraryName() : null;
        if (currentLibNameFromState && localAppServices.updateSoundBrowserDisplayForLibrary) {
            console.log(`[UI SoundBrowser Re-Open/Restore] Updating display for already selected library: ${currentLibNameFromState}`);
            localAppServices.updateSoundBrowserDisplayForLibrary(currentLibNameFromState);
        } else if (localAppServices.updateSoundBrowserDisplayForLibrary) {
             localAppServices.updateSoundBrowserDisplayForLibrary(null);
        }
        return win;
    }

    const contentHTML = `<div id="soundBrowserContent" class="p-2 space-y-2 text-xs overflow-y-auto h-full dark:text-slate-300"> <div id="soundBrowserTabs" class="flex border-b border-gray-300 dark:border-slate-600 mb-1"> <button id="tabBrowse" class="tab-btn flex-1 py-1 text-xs font-semibold border-b-2 border-purple-500 text-purple-600 dark:text-purple-400">Browse</button> <button id="tabFavorites" class="tab-btn flex-1 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400">⭐ Favorites</button> <button id="tabRecent" class="tab-btn flex-1 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400">🕐 Recent</button> </div> <div id="browseControls" class="space-y-1"> <div class="flex space-x-1"> <select id="librarySelect" class="flex-grow p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> <option value="">Select Library...</option> </select> <button id="upDirectoryBtn" class="px-2 py-1 border rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 dark:border-slate-500" title="Up Directory">↑</button> </div> <div id="currentPathDisplay" class="text-xs text-gray-600 dark:text-slate-400 truncate">/</div> <div id="soundBrowserSearchContainer"> <input type="text" id="soundBrowserSearchInput" placeholder="🔍 Search sounds..." class="w-full p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-400"> </div> </div> <div id="soundBrowserList" class="min-h-[100px] border rounded p-1 bg-gray-100 dark:bg-slate-700 dark:border-slate-600 overflow-y-auto"> <p class="text-gray-500 dark:text-slate-400 italic">Select a library to browse sounds.</p> </div> <div id="soundPreviewControls" class="mt-1 text-center"> <button id="previewSoundBtn" class="px-2 py-1 text-xs border rounded bg-purple-400 text-white hover:bg-purple-500 disabled:opacity-50 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-slate-500" disabled>Preview</button> </div> </div>`;
    const browserOptions = { width: 380, height: 450, minWidth: 300, minHeight: 300, initialContentKey: windowId };
    if (savedState) Object.assign(browserOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });

    const browserWindow = localAppServices.createWindow(windowId, 'Sound Browser', contentHTML, browserOptions);

    if (((browserWindow) && (browserWindow).element)) {
        const libSelect = browserWindow.element.querySelector('#librarySelect');
        if (Constants.soundLibraries) {
            Object.keys(Constants.soundLibraries).forEach(libName => {
                const opt = document.createElement('option');
                opt.value = libName;
                opt.textContent = libName;
                libSelect.appendChild(opt);
            });
        }

        // FIX Bug #5: Disable preview button during library loading
        const previewBtn = browserWindow.element.querySelector('#previewSoundBtn');
        function setPreviewButtonState(enabled) {
            if (previewBtn) {
                previewBtn.disabled = !enabled;
                previewBtn.title = enabled ? "Preview selected sound" : "Loading library...";
            }
        }
        
        // Initial state - disabled until library loads
        setPreviewButtonState(false);

        libSelect.addEventListener('change', (e) => {
            const lib = e.target.value;
            console.log(`[UI SoundBrowser] Library selected via dropdown: ${lib}`);
            
            // FIX Bug #5: Disable preview while loading
            if (lib) {
                setPreviewButtonState(false);
            }
            
            if (lib && localAppServices.fetchSoundLibrary) {
                localAppServices.fetchSoundLibrary(lib, Constants.soundLibraries[lib]);
            } else if (!lib && localAppServices.updateSoundBrowserDisplayForLibrary) {
                localAppServices.updateSoundBrowserDisplayForLibrary(null);
            }
        });

        browserWindow.element.querySelector('#upDirectoryBtn').addEventListener('click', () => {
            const currentPath = localAppServices.getCurrentSoundBrowserPath ? localAppServices.getCurrentSoundBrowserPath() : [];
            if (currentPath.length > 0) {
                const newPath = [...currentPath]; newPath.pop();
                if (localAppServices.setCurrentSoundBrowserPath) localAppServices.setCurrentSoundBrowserPath(newPath);
                if (localAppServices.renderSoundBrowserDirectory) localAppServices.renderSoundBrowserDirectory(newPath, localAppServices.getCurrentSoundFileTree ? localAppServices.getCurrentSoundFileTree() : null);
            }
        });

        // Tab click handlers
        const tabBrowse = browserWindow.element.querySelector('#tabBrowse');
        const tabFavorites = browserWindow.element.querySelector('#tabFavorites');
        const tabRecent = browserWindow.element.querySelector('#tabRecent');
        const browseControls = browserWindow.element.querySelector('#browseControls');
        const listDiv = browserWindow.element.querySelector('#soundBrowserList');
        const pathDisplay = browserWindow.element.querySelector('#currentPathDisplay');
        const previewBtn = browserWindow.element.querySelector('#previewSoundBtn');
        const searchInput = browserWindow.element.querySelector('#soundBrowserSearchInput');
        const searchContainer = browserWindow.element.querySelector('#soundBrowserSearchContainer');

        function updateTabStyles() {
            [tabBrowse, tabFavorites, tabRecent].forEach(btn => {
                if (btn) {
                    btn.classList.remove('border-b-2', 'border-purple-500', 'text-purple-600', 'dark:text-purple-400', 'font-semibold');
                    btn.classList.add('text-gray-500', 'dark:text-slate-400');
                }
            });
            const activeBtn = soundBrowserActiveTab === 'browse' ? tabBrowse : soundBrowserActiveTab === 'favorites' ? tabFavorites : tabRecent;
            if (activeBtn) {
                activeBtn.classList.add('border-b-2', 'border-purple-500', 'text-purple-600', 'dark:text-purple-400', 'font-semibold');
                activeBtn.classList.remove('text-gray-500', 'dark:text-slate-400');
            }
        }

        function showBrowseTab() {
            soundBrowserActiveTab = 'browse';
            browseControls.style.display = '';
            if (searchContainer) searchContainer.style.display = '';
            if (pathDisplay) pathDisplay.style.display = '';
            updateTabStyles();
            // Restore browse view
            const currentPath = localAppServices.getCurrentSoundBrowserPath ? localAppServices.getCurrentSoundBrowserPath() : [];
            const tree = localAppServices.getCurrentSoundFileTree ? localAppServices.getCurrentSoundFileTree() : null;
            if (tree) renderSoundBrowserDirectoryFiltered(currentPath, tree, soundBrowserSearchQuery);
            else listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">Select a library to browse sounds.</p>';
        }

        function showFavoritesTab() {
            soundBrowserActiveTab = 'favorites';
            browseControls.style.display = 'none';
            if (searchContainer) searchContainer.style.display = 'none';
            if (pathDisplay) pathDisplay.style.display = 'none';
            updateTabStyles();
            renderSoundBrowserFavorites(listDiv, previewBtn);
        }

        function showRecentTab() {
            soundBrowserActiveTab = 'recent';
            browseControls.style.display = 'none';
            if (searchContainer) searchContainer.style.display = 'none';
            if (pathDisplay) pathDisplay.style.display = 'none';
            updateTabStyles();
            renderSoundBrowserRecent(listDiv, previewBtn);
        }

        ((tabBrowse) && (tabBrowse).addEventListener)('click', showBrowseTab);
        ((tabFavorites) && (tabFavorites).addEventListener)('click', showFavoritesTab);
        ((tabRecent) && (tabRecent).addEventListener)('click', showRecentTab);
        updateTabStyles();

        // Search/filter input for sound browser
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                soundBrowserSearchQuery = e.target.value.toLowerCase().trim();
                console.log(`[UI SoundBrowser] Search query: "${soundBrowserSearchQuery}"`);
                // Re-render the current directory with filtering
                const currentPath = localAppServices.getCurrentSoundBrowserPath ? localAppServices.getCurrentSoundBrowserPath() : [];
                const tree = localAppServices.getCurrentSoundFileTree ? localAppServices.getCurrentSoundFileTree() : null;
                if (tree) {
                    renderSoundBrowserDirectoryFiltered(currentPath, tree, soundBrowserSearchQuery);
                }
            });
        }

        // FIX Bug #3: Better preview player disposal and #5: Check if library is ready before previewing
        browserWindow.element.querySelector('#previewSoundBtn').addEventListener('click', () => {
            const selectedSound = localAppServices.getSelectedSoundForPreview ? localAppServices.getSelectedSoundForPreview() : null;
            console.log('[UI PreviewButton] Clicked. Selected Sound:', JSON.stringify(selectedSound));

            if (selectedSound && typeof Tone !== 'undefined') {
                const { fullPath, libraryName } = selectedSound;
                
                // Add to recently played
                if (localAppServices.addToRecentlyPlayed) {
                    localAppServices.addToRecentlyPlayed(selectedSound);
                }
                
                // FIX Bug #5: Check if library is loaded before trying to play
                const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
                if (!loadedZips[libraryName] || loadedZips[libraryName] === "loading") {
                    console.warn(`[UI PreviewButton] Library ${libraryName} is not ready for preview.`);
                    showNotification("Please wait for the library to finish loading.", 2000);
                    setPreviewButtonState(false);
                    return;
                }
                
                // FIX Bug #3: More robust preview player disposal
                let previewPlayer = localAppServices.getPreviewPlayer ? localAppServices.getPreviewPlayer() : null;
                if (previewPlayer) {
                    console.log('[UI PreviewButton] Disposing existing preview player.');
                    try {
                        if (!previewPlayer.disposed) {
                            previewPlayer.stop();
                            previewPlayer.dispose();
                        }
                    } catch (e) {
                        console.warn('[UI PreviewButton] Error disposing old preview player:', e.message);
                    }
                    previewPlayer = null;
                    if (localAppServices.setPreviewPlayer) localAppServices.setPreviewPlayer(null);
                }

                console.log(`[UI PreviewButton] Attempting to preview: ${fullPath} from ${libraryName}`);

                if (((loadedZips) && (loadedZips)[libraryName] && loadedZips[libraryName] !== "loading") {
                    const zipEntry = loadedZips[libraryName].file(fullPath);
                    if (zipEntry) {
                        console.log(`[UI PreviewButton] Found zipEntry for ${fullPath}. Converting to blob.`);
                        zipEntry.async("blob").then(blob => {
                            console.log(`[UI PreviewButton] Blob created for ${fullPath}, size: ${blob.size}. Creating Object URL.`);
                            const url = URL.createObjectURL(blob);
                            console.log(`[UI PreviewButton] Object URL: ${url}. Creating Tone.Player.`);
                            previewPlayer = new Tone.Player(url, () => {
                                console.log(`[UI PreviewButton] Tone.Player loaded for ${url}. Starting playback.`);
                                previewPlayer.start();
                                URL.revokeObjectURL(url);
                                console.log(`[UI PreviewButton] Object URL revoked for ${url}.`);
                            }).toDestination();
                            previewPlayer.onerror = (err) => {
                                console.error(`[UI PreviewButton] Tone.Player error for ${url}:`, err);
                                showNotification("Error playing preview: " + err.message, 3000);
                                URL.revokeObjectURL(url);
                            };
                            if (localAppServices.setPreviewPlayer) localAppServices.setPreviewPlayer(previewPlayer);
                        }).catch(err => {
                            console.error(`[UI PreviewButton] Error converting zipEntry to blob for ${fullPath}:`, err);
                            showNotification("Error loading preview data: " + err.message, 2000);
                        });
                    } else {
                        console.warn(`[UI PreviewButton] ZipEntry not found for ${fullPath} in ${libraryName}.`);
                        showNotification("Preview error: Sound file not found in library.", 2000);
                    }
                } else {
                    console.warn(`[UI PreviewButton] Library ${libraryName} not loaded or is loading. Loaded zips:`, loadedZips);
                    showNotification("Preview error: Library not ready.", 2000);
                }
            } else if (!selectedSound) {
                console.warn('[UI PreviewButton] No sound selected for preview.');
            } else if (typeof Tone === 'undefined') {
                console.error('[UI PreviewButton] Tone is undefined!');
            }
        });

        if (!savedState) {
            const currentLibNameFromState = localAppServices.getCurrentLibraryName ? localAppServices.getCurrentLibraryName() : null;
            const soundTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};

            console.log(`[UI SoundBrowser Open DEBUG] Initial Global State Check. currentLibNameFromState: ${currentLibNameFromState}. soundTrees keys: ${soundTrees ? Object.keys(soundTrees) : 'undefined'}. soundTrees[Drums] exists: ${soundTrees ? !!soundTrees["Drums"] : 'false'}`);
            console.log(`[UI SoundBrowser Open] Initial check. Current lib in state: ${currentLibNameFromState}, Dropdown value: ${((libSelect) && (libSelect).value)}`);

            if (currentLibNameFromState && soundTrees && soundTrees[currentLibNameFromState] && libSelect) {
                console.log(`[UI SoundBrowser Open] State has current library '${currentLibNameFromState}' with loaded data. Setting dropdown and updating UI.`);
                libSelect.value = currentLibNameFromState;
                if (localAppServices.updateSoundBrowserDisplayForLibrary) {
                    localAppServices.updateSoundBrowserDisplayForLibrary(currentLibNameFromState);
                }
            } else {
                console.log(`[UI SoundBrowser Open] No specific library active and loaded in state (or soundTrees issue). Defaulting to "Select Library..." view.`);
                if (libSelect) libSelect.value = "";
                if (localAppServices.updateSoundBrowserDisplayForLibrary) {
                    localAppServices.updateSoundBrowserDisplayForLibrary(null);
                }
            }
        } else if (savedState && localAppServices.getCurrentLibraryName && localAppServices.updateSoundBrowserDisplayForLibrary) {
            const currentLibNameFromState = localAppServices.getCurrentLibraryName();
            console.log(`[UI SoundBrowser Open] Restoring from savedState. Current lib in state: ${currentLibNameFromState}`);
             if (currentLibNameFromState && libSelect) {
                libSelect.value = currentLibNameFromState;
                localAppServices.updateSoundBrowserDisplayForLibrary(currentLibNameFromState);
            } else if (libSelect) {
                libSelect.value = "";
                localAppServices.updateSoundBrowserDisplayForLibrary(null);
            }
        }
    }
    return browserWindow;
}

export function updateSoundBrowserDisplayForLibrary(libraryName, isLoading = false, hasError = false) {
    console.log(`[UI updateSoundBrowserDisplayForLibrary] START - Called for: '${libraryName}', isLoading: ${isLoading}, hasError: ${hasError}`);
    const browserWindowEl = localAppServices.getWindowById ? localAppServices.getWindowById('soundBrowser')?.element : null;

    if (!browserWindowEl) {
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Sound Browser window element NOT FOUND. Aborting DOM updates.`);
        if (libraryName && !isLoading && !hasError) {
            const currentGlobalLib = localAppServices.getCurrentLibraryName ? localAppServices.getCurrentLibraryName() : null;
            if (!currentGlobalLib && localAppServices.setCurrentLibraryName) {
                localAppServices.setCurrentLibraryName(libraryName);
                console.log(`[UI updateSoundBrowserDisplayForLibrary] Window NOT visible. Library '${libraryName}' loaded. Set as current in global state.`);
            }
        }
        return;
    }

    const listDiv = browserWindowEl.querySelector('#soundBrowserList');
    const libSelect = browserWindowEl.querySelector('#librarySelect');
    const pathDisplay = browserWindowEl.querySelector('#currentPathDisplay');
    const previewBtn = browserWindowEl.querySelector('#previewSoundBtn');
    const isWindowVisible = !browserWindowEl.closest('.window.minimized');
    const currentDropdownSelection = libSelect ? libSelect.value : null;
    
    // FIX Bug #5: Update preview button state based on loading status
    if (isLoading) {
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.title = "Loading library...";
        }
    } else if (hasError) {
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.title = "Library failed to load";
        }
    } else if (libraryName && libraryName === currentDropdownSelection) {
        // Library loaded successfully - enable preview button
        if (previewBtn) {
            previewBtn.disabled = false;
            previewBtn.title = "Preview selected sound";
        }
    }

    console.log(`[UI updateSoundBrowserDisplayForLibrary] Window visible: ${isWindowVisible}, Current dropdown: '${currentDropdownSelection}', Target library: '${libraryName}'`);

    let performFullUIUpdate = false;

    if (!isWindowVisible) {
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Window NOT visible. No DOM update.`);
        if (libraryName && !isLoading && !hasError) {
            const currentGlobalLib = localAppServices.getCurrentLibraryName ? localAppServices.getCurrentLibraryName() : null;
            if (!currentGlobalLib && localAppServices.setCurrentLibraryName) {
                localAppServices.setCurrentLibraryName(libraryName);
                console.log(`[UI updateSoundBrowserDisplayForLibrary] Window NOT visible. Library '${libraryName}' loaded. Set as current in global state (as no global lib was active).`);
            }
        }
        return;
    }

    if (libraryName === currentDropdownSelection) {
        performFullUIUpdate = true;
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Decision: Update current view for '${libraryName}'.`);
    } else if (currentDropdownSelection === "" && libraryName && !isLoading && !hasError) {
        performFullUIUpdate = true;
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Decision: Set initial view to '${libraryName}' from 'Select Library...'.`);
    } else if (libraryName && !isLoading && !hasError) {
        console.log(`[UI updateSoundBrowserDisplayForLibrary WARN] Tree for "${libraryName}" was found but considered empty or invalid. Tree:`, treeForLib);
                listDiv.innerHTML = `<p class="text-red-500">Error: Library "${libraryName}" data is empty or corrupt.</p>`;
            }
        } else {
            listDiv.innerHTML = `<p class="text-red-500">Error: Library "${libraryName}" data not found after attempting load.</p>`;
            console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering "Error: Library '${libraryName}' data not found." view. (Checked currentTrees['${libraryName}'])`);
        }
    }
    pathDisplay.textContent = `/${libraryName || ''}/`;
}

function filterTreeBySearch(treeNode, query) {
    if (!query) return treeNode;
    const result = {};
    for (const name in treeNode) {
        if (treeNode[name]?.type === 'folder') {
            const filteredChildren = filterTreeBySearch(treeNode[name].children, query);
            if (Object.keys(filteredChildren).length > 0) {
                result[name] = { ...treeNode[name], children: filteredChildren };
            }
        } else if (treeNode[name]?.type === 'file') {
            if (name.toLowerCase().includes(query)) {
                result[name] = treeNode[name];
            }
        }
    }
    return result;
}

export function renderSoundBrowserDirectoryFiltered(pathArray, treeNode, searchQuery = '') {
    const browserWindowEl = localAppServices.getWindowById ? localAppServices.getWindowById('soundBrowser')?.element : null;
    if (!browserWindowEl || !treeNode) return;
    const listDiv = browserWindowEl.querySelector('#soundBrowserList');
    const libSelect = browserWindowEl.querySelector('#librarySelect');
    const pathDisplay = browserWindowEl.querySelector('#currentPathDisplay');
    const previewBtn = browserWindowEl.querySelector('#previewSoundBtn');
    listDiv.innerHTML = '';
    const currentLibName = localAppServices.getCurrentLibraryName ? localAppServices.getCurrentLibraryName() : '';
    pathDisplay.textContent = `/${currentLibName}${pathArray.length > 0 ? '/' : ''}${pathArray.join('/')}`;

    if (localAppServices.setSelectedSoundForPreview) {
        localAppServices.setSelectedSoundForPreview(null);
    }
    if(previewBtn) previewBtn.disabled = true;

    // Apply search filter if query exists
    const filteredTree = searchQuery ? filterTreeBySearch(treeNode, searchQuery) : treeNode;

    const items = [];
    for (const name in filteredTree) { if (filteredTree[name]?.type) items.push({ name, type: filteredTree[name].type, nodeData: filteredTree[name] }); }
    items.sort((a, b) => { if (a.type === 'folder' && b.type !== 'folder') return -1; if (a.type !== 'folder' && b.type === 'folder') return 1; return a.name.localeCompare(b.name); });
    if (items.length === 0) { 
        if (searchQuery) {
            listDiv.innerHTML = `<p class="text-gray-500 dark:text-slate-400 italic">No sounds match "${searchQuery}"</p>`;
        } else {
            listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">Empty folder.</p>';
        }
        return; 
    }

    items.forEach(itemObj => {
        const {name, nodeData} = itemObj; const listItem = document.createElement('div');
        listItem.className = 'p-1 hover:bg-purple-200 dark:hover:bg-purple-600 cursor-pointer border-b dark:border-slate-600 text-xs flex items-center';
        listItem.draggable = nodeData.type === 'file';
        const icon = document.createElement('span'); icon.className = 'mr-1.5'; icon.textContent = nodeData.type === 'folder' ? '📁' : '🎵'; listItem.appendChild(icon);
        const text = document.createElement('span'); text.textContent = name; listItem.appendChild(text);
        if (nodeData.type === 'folder') {
            listItem.addEventListener('click', () => {
                const newPath = [...pathArray, name];
                if (localAppServices.setCurrentSoundBrowserPath) localAppServices.setCurrentSoundBrowserPath(newPath);
                renderSoundBrowserDirectory(newPath, nodeData.children);
            });
        }
        else { // File
            const soundToSelect = { fileName: name, fullPath: nodeData.fullPath, libraryName: currentLibName };
            const isFav = localAppServices.isFavorite ? localAppServices.isFavorite(soundToSelect) : false;
            const star = document.createElement('span');
            star.className = 'mr-0.5 cursor-pointer ' + (isFav ? 'text-yellow-400' : 'text-gray-300 dark:text-slate-600 hover:text-yellow-300');
            star.textContent = isFav ? '⭐' : '☆';
            star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                if (localAppServices.toggleFavorite) localAppServices.toggleFavorite(soundToSelect);
                renderSoundBrowserDirectoryFiltered(pathArray, treeNode, soundBrowserSearchQuery);
            });
            listItem.appendChild(star);
            listItem.innerHTML += `<span class="ml-1 text-[9px] text-gray-400 dark:text-slate-500">${nodeData.libraryName}</span>`;
            listItem.addEventListener('click', () => {
                listDiv.querySelectorAll('.bg-blue-200,.dark\\\\:bg-purple-500').forEach(el => el.classList.remove('bg-blue-200', 'dark:bg-purple-500'));
                listItem.classList.add('bg-blue-200', 'dark:bg-purple-500');
                console.log('[UI SoundFile Click] Sound selected:', JSON.stringify(soundToSelect));
                if (localAppServices.setSelectedSoundForPreview) {
                    localAppServices.setSelectedSoundForPreview(soundToSelect);
                    const checkSelected = localAppServices.getSelectedSoundForPreview ? localAppServices.getSelectedSoundForPreview() : { error: 'getSelectedSoundForPreview service not found' };
                    console.log('[UI SoundFile Click] State after setSelectedSoundForPreview (via getter):', JSON.stringify(checkSelected));
                } else {
                    console.warn('[UI SoundFile Click] setSelectedSoundForPreview service not available.');
                }
                if(previewBtn) previewBtn.disabled = false;
            });
            listItem.addEventListener('dragstart', (e) => { e.dataTransfer.setData("application/json", JSON.stringify({ fileName: name, fullPath: nodeData.fullPath, libraryName: currentLibName, type: 'sound-browser-item' })); e.dataTransfer.effectAllowed = "copy"; });
        }
        listDiv.appendChild(listItem);
    });
}

export function renderSoundBrowserDirectory(pathArray, treeNode) {
    renderSoundBrowserDirectoryFiltered(pathArray, treeNode, '');
}

export function renderSoundBrowserFavorites(listDiv, previewBtn) {
    listDiv.innerHTML = '';
    if (!localAppServices.getFavoriteSounds) {
        listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">Favorites not available.</p>';
        return;
    }
    const favorites = localAppServices.getFavoriteSounds();
    if (favorites.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">No favorites yet. Click ⭐ on any sound to add it.</p>';
        return;
    }
    favorites.forEach(sound => {
        const item = document.createElement('div');
        item.className = 'p-1 hover:bg-purple-200 dark:hover:bg-purple-600 cursor-pointer border-b dark:border-slate-600 text-xs flex items-center';
        item.draggable = true;
        const isFav = localAppServices.isFavorite ? localAppServices.isFavorite(sound) : false;
        const star = document.createElement('span');
        star.className = 'mr-1 cursor-pointer hover:text-yellow-300 ' + (isFav ? 'text-yellow-400' : 'text-gray-300 dark:text-slate-600');
        star.textContent = isFav ? '⭐' : '☆';
        star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
        star.addEventListener('click', (e) => {
            e.stopPropagation();
            if (localAppServices.toggleFavorite) localAppServices.toggleFavorite(sound);
            renderSoundBrowserFavorites(listDiv, previewBtn);
        });
        item.appendChild(star);
        const icon = document.createElement('span');
        icon.className = 'mr-1.5';
        icon.textContent = '🎵';
        item.appendChild(icon);
        const text = document.createElement('span');
        text.className = 'flex-grow truncate';
        text.textContent = sound.fileName;
        item.appendChild(text);
        const libTag = document.createElement('span');
        libTag.className = 'text-[9px] ml-1 text-gray-400 dark:text-slate-500';
        libTag.textContent = sound.libraryName;
        item.appendChild(libTag);
        item.addEventListener('click', () => {
            listDiv.querySelectorAll('.bg-blue-200,.dark\\:\\:bg-purple-500').forEach(el => el.classList.remove('bg-blue-200', 'dark:bg-purple-500'));
            item.classList.add('bg-blue-200', 'dark:bg-purple-500');
            if (localAppServices.setSelectedSoundForPreview) localAppServices.setSelectedSoundForPreview(sound);
            if (previewBtn) previewBtn.disabled = false;
        });
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ fileName: sound.fileName, fullPath: sound.fullPath, libraryName: sound.libraryName, type: 'sound-browser-item' }));
            e.dataTransfer.effectAllowed = 'copy';
        });
        listDiv.appendChild(item);
    });
}

export function renderSoundBrowserRecent(listDiv, previewBtn) {
    listDiv.innerHTML = '';
    if (!localAppServices.getRecentlyPlayedSounds) {
        listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">Recently played not available.</p>';
        return;
    }
    const recent = localAppServices.getRecentlyPlayedSounds();
    if (recent.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">No recently played sounds. Preview a sound to see it here.</p>';
        return;
    }
    recent.forEach(sound => {
        const item = document.createElement('div');
        item.className = 'p-1 hover:bg-purple-200 dark:hover:bg-purple-600 cursor-pointer border-b dark:border-slate-600 text-xs flex items-center';
        item.draggable = true;
        const isFav = localAppServices.isFavorite ? localAppServices.isFavorite(sound) : false;
        const star = document.createElement('span');
        star.className = 'mr-1 cursor-pointer hover:text-yellow-300 ' + (isFav ? 'text-yellow-400' : 'text-gray-300 dark:text-slate-600');
        star.textContent = isFav ? '⭐' : '☆';
        star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
        star.addEventListener('click', (e) => {
            e.stopPropagation();
            if (localAppServices.toggleFavorite) localAppServices.toggleFavorite(sound);
            renderSoundBrowserRecent(listDiv, previewBtn);
        });
        item.appendChild(star);
        const icon = document.createElement('span');
        icon.className = 'mr-1.5';
        icon.textContent = '🎵';
        item.appendChild(icon);
        const text = document.createElement('span');
        text.className = 'flex-grow truncate';
        text.textContent = sound.fileName;
        item.appendChild(text);
        const libTag = document.createElement('span');
        libTag.className = 'text-[9px] ml-1 text-gray-400 dark:text-slate-500';
        libTag.textContent = sound.libraryName;
        item.appendChild(libTag);
        item.addEventListener('click', () => {
            listDiv.querySelectorAll('.bg-blue-200,.dark\\:\\:bg-purple-500').forEach(el => el.classList.remove('bg-blue-200', 'dark:bg-purple-500'));
            item.classList.add('bg-blue-200', 'dark:bg-purple-500');
            if (localAppServices.setSelectedSoundForPreview) localAppServices.setSelectedSoundForPreview(sound);
            if (previewBtn) previewBtn.disabled = false;
        });
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ fileName: sound.fileName, fullPath: sound.fullPath, libraryName: sound.libraryName, type: 'sound-browser-item' }));
            e.dataTransfer.effectAllowed = 'copy';
        });
        listDiv.appendChild(item);
    });
}

// --- Mixer Window ---
export function openMixerWindow(savedState = null) {
    const windowId = 'mixer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) { openWindows.get(windowId).restore(); return openWindows.get(windowId); }

    const contentContainer = document.createElement('div'); contentContainer.id = 'mixerContentContainer';
    contentContainer.className = 'p-2 overflow-x-auto whitespace-nowrap h-full bg-gray-100 dark:bg-slate-800';
    const desktopEl = ((localAppServices.uiElementsCache) && (localAppServices.uiElementsCache).desktop) || document.getElementById('desktop');
    const mixerOptions = { width: Math.min(800, (((desktopEl) && (desktopEl).offsetWidth) || 800) - 40), height: 300, minWidth: 300, minHeight: 200, initialContentKey: windowId };
    if (savedState) Object.assign(mixerOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const mixerWindow = localAppServices.createWindow(windowId, 'Mixer', contentContainer, mixerOptions);
    if (((mixerWindow) && (mixerWindow).element)) updateMixerWindow();
    return mixerWindow;
}

export function updateMixerWindow() {
    const mixerWindow = localAppServices.getWindowById ? localAppServices.getWindowById('mixer') : null;
    if (!((mixerWindow) && (mixerWindow).element) || mixerWindow.isMinimized) return;
    const container = mixerWindow.element.querySelector('#mixerContentContainer');
    if (container) renderMixer(container);
}

export function renderMixer(container) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    container.innerHTML = '';
    const masterTrackDiv = document.createElement('div');
    masterTrackDiv.className = 'mixer-track master-track inline-block align-top p-1.5 border rounded bg-gray-200 dark:bg-slate-700 dark:border-slate-600 shadow w-24 mr-2 text-xs';
    masterTrackDiv.innerHTML = `<div class="track-name font-semibold truncate mb-1 dark:text-slate-200" title="Master">Master</div> <div id="masterVolumeKnob-mixer-placeholder" class="h-16 mx-auto mb-1"></div> <div id="mixerMasterMeterContainer" class="h-3 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden mt-1"> <div id="mixerMasterMeterBar" class="h-full bg-purple-400 transition-all duration-50 ease-linear" style="width: 0%;"></div> </div>`;
    container.appendChild(masterTrackDiv);
    const masterVolKnobPlaceholder = masterTrackDiv.querySelector('#masterVolumeKnob-mixer-placeholder');
    if (masterVolKnobPlaceholder) {
        const masterGainNode = localAppServices.getMasterGainValue ? localAppServices.getMasterGainValue() : Tone.dbToGain(0);
        const masterVolume = masterGainNode;
        const masterVolKnob = createKnob({ label: 'Master Vol', min: 0, max: 1.2, step: 0.01, initialValue: masterVolume, decimals: 2, onValueChange: (val, o, fromInteraction) => {
            if (localAppServices.setActualMasterVolume) localAppServices.setActualMasterVolume(val);
            if (localAppServices.setMasterGainValueState) localAppServices.setMasterGainValueState(val);
            if (fromInteraction && localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set Master Volume to ${val.toFixed(2)}`);
         } });
        masterVolKnobPlaceholder.innerHTML = ''; masterVolKnobPlaceholder.appendChild(masterVolKnob.element);
    }

    tracks.forEach(track => {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'mixer-track inline-block align-top p-1.5 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 shadow w-24 mr-2 text-xs';
        trackDiv.innerHTML = `<div class="track-name font-semibold truncate mb-1 dark:text-slate-200 flex items-center" title="${track.name}"><span class="track-color-dot" style="background-color:${track.trackColor || '#6366f1'}" title="Track color"></span>${track.name}</div> <div id="volumeKnob-mixer-${track.id}-placeholder" class="h-16 mx-auto mb-1"></div> <div class="grid grid-cols-2 gap-x-2 gap-y-1 items-center text-xs">
                <button id="mixerMuteBtn-${track.id}" title="Mute" class="px-1 py-0.5 text-xs border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600 ${track.isMuted ? 'muted' : ''}">${track.isMuted ? 'U' : 'M'}</button>
                <button id="mixerSoloBtn-${track.id}" title="Solo" class="px-1 py-0.5 text-xs border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600 ${track.isSoloed ? 'soloed' : ''}">${track.isSoloed ? 'U' : 'S'}</button>
            </div> <div id="mixerTrackMeterContainer-${track.id}" class="h-3 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden mt-0.5"> <div id="mixerTrackMeterBar-${track.id}" class="h-full bg-pink-400 transition-all duration-50 ease-linear" style="width: 0%; background-color:${track.trackColor || '#6366f1'}"></div> </div>`;
        trackDiv.addEventListener('contextmenu', (e) => { e.preventDefault(); createContextMenu(e, [
            {label: "Open Inspector", action: () => localAppServices.handleOpenTrackInspector(track.id)},
            {label: "Open Effects Rack", action: () => localAppServices.handleOpenEffectsRack(track.id)},
            {label: "Open Sequencer", action: () => localAppServices.handleOpenSequencer(track.id)},
            {separator: true},
            {label: "Change Color...", action: () => showTrackColorPicker(track)},
            {label: track.isMuted ? "Unmute" : "Mute", action: () => localAppServices.handleTrackMute(track.id)},
            {label: track.isSoloed ? "Unsolo" : "Solo", action: () => localAppServices.handleTrackSolo(track.id)},
            {label: (localAppServices.getArmedTrackId && localAppServices.getArmedTrackId() === track.id) ? "Disarm Input" : "Arm for Input", action: () => localAppServices.handleTrackArm(track.id)},
            {separator: true},
            {label: "Remove Track", action: () => localAppServices.handleRemoveTrack(track.id)}
        ], localAppServices); });
        container.appendChild(trackDiv);
        const volKnobPlaceholder = trackDiv.querySelector(`#volumeKnob-mixer-${track.id}-placeholder`);
        if (volKnobPlaceholder) { const volKnob = createKnob({ label: `Vol ${track.id}`, min: 0, max: 1.2, step: 0.01, initialValue: track.previousVolumeBeforeMute, decimals: 2, trackRef: track, onValueChange: (val, o, fromInteraction) => track.setVolume(val, fromInteraction) }); volKnobPlaceholder.innerHTML = ''; volKnobPlaceholder.appendChild(volKnob.element); }
        trackDiv.querySelector(`#mixerMuteBtn-${track.id}`).addEventListener('click', () => localAppServices.handleTrackMute(track.id));
        trackDiv.querySelector(`#mixerSoloBtn-${track.id}`).addEventListener('click', () => localAppServices.handleTrackSolo(track.id));
    });
}

// --- Sequencer Window ---
function buildSequencerContentDOM(track, rows, rowLabels, numBars) {
    const stepsPerBar = Constants.STEPS_PER_BAR;
    const totalSteps = Number.isFinite(numBars) && numBars > 0 ? numBars * stepsPerBar : Constants.defaultStepsPerBar;
    // Snap-to-grid settings: 0=off, 4=1/4, 8=1/8, 16=1/16
    const snapValue = window.SEQUENCER_SNAP_VALUE || 16;
    const snapLabel = snapValue === 0 ? 'Off' : (snapValue === 4 ? '1/4' : (snapValue === 8 ? '1/8' : '1/16'));
    let html = `<div class="sequencer-container p-1 text-xs overflow-auto h-full dark:bg-slate-900 dark:text-slate-300"> <div class="controls mb-1 flex justify-between items-center sticky top-0 left-0 bg-gray-200 dark:bg-slate-800 p-1 z-30 border-b dark:border-slate-700"> <span class="font-semibold">${track.name} - ${numBars} Bar${numBars > 1 ? 's' : ''} (${totalSteps} steps)</span> <div class="flex items-center gap-2"> <label for="seqLengthInput-${track.id}" class="text-xs">Bars:</label> <input type="number" id="seqLengthInput-${track.id}" value="${numBars}" min="1" max="${Constants.MAX_BARS || 16}" class="w-12 p-0.5 border rounded text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> <button id="seqSnapToggle-${track.id}" class="px-2 py-0.5 text-xs border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600" title="Toggle snap-to-grid (S key)">Snap: ${snapLabel}</button> </div> </div>`;
    html += `<div class="sequencer-grid-layout" style="display: grid; grid-template-columns: 50px repeat(${totalSteps}, 20px); grid-auto-rows: 20px; gap: 0px; width: fit-content; position: relative; top: 0; left: 0;"> <div class="sequencer-header-cell sticky top-0 left-0 z-20 bg-gray-200 dark:bg-slate-800 border-r border-b dark:border-slate-700"></div>`;
    for (let i = 0; i < totalSteps; i++) { const beatsPerBar = 4; const barNum = Math.floor(i / beatsPerBar) + 1; const beatInBar = (i % beatsPerBar) + 1; const label = beatInBar === 1 ? String(barNum) : `${barNum}.${beatInBar}`; const isSnapPoint = snapValue === 0 || i % snapValue === 0; const snapClass = isSnapPoint ? 'snap-point' : 'non-snap-point'; html += `<div class="sequencer-header-cell ${snapClass} sticky top-0 z-10 bg-gray-200 dark:bg-slate-800 border-r border-b dark:border-slate-700 flex items-center justify-center pr-1 text-[10px] text-gray-500 dark:text-slate-400">${label}</div>`; }

    const activeSequence = track.getActiveSequence();
    const sequenceData = activeSequence ? activeSequence.data : [];

    for (let i = 0; i < rows; i++) {
        let labelText = rowLabels[i] || `R${i + 1}`; if (labelText.length > 6) labelText = labelText.substring(0,5) + "..";
        html += `<div class="sequencer-label-cell sticky left-0 z-10 bg-gray-200 dark:bg-slate-800 border-r border-b dark:border-slate-700 flex items-center justify-end pr-1 text-[10px]" title="${rowLabels[i] || ''}">${labelText}</div>`;
        for (let j = 0; j < totalSteps; j++) {
            const stepData = sequenceData[i]?.[j];
            let activeClass = '';
            if (((stepData) && (stepData).active)) { if (track.type === 'Synth') activeClass = 'active-synth'; else if (track.type === 'Sampler') activeClass = 'active-sampler'; else if (track.type === 'DrumSampler') activeClass = 'active-drum-sampler'; else if (track.type === 'InstrumentSampler') activeClass = 'active-instrument-sampler'; }
            let beatBlockClass = (Math.floor((j % stepsPerBar) / 4) % 2 === 0) ? 'bg-gray-50 dark:bg-slate-700' : 'bg-white dark:bg-slate-750';
            if (j % stepsPerBar === 0 && j > 0) beatBlockClass += ' border-l-2 border-l-gray-400 dark:border-l-slate-600';
            else if (j % (stepsPerBar / 2) === 0) beatBlockClass += ' border-l-gray-300 dark:border-l-slate-650';
            else if (j % (stepsPerBar / 4) === 0) beatBlockClass += ' border-l-gray-200 dark:border-l-slate-675';
            // Apply velocity-based brightness class during initial render
            let velClass = '';
            if (((stepData) && (stepData).active)) {
                const vel = ((stepData) && (stepData).velocity) || 0.7;
                const velPercent = Math.round(vel * 100);
                if (velPercent >= 100) velClass = 'vel-100';
                else if (velPercent >= 90) velClass = 'vel-90';
                else if (velPercent >= 80) velClass = 'vel-80';
                else if (velPercent >= 70) velClass = 'vel-70';
                else if (velPercent >= 60) velClass = 'vel-60';
                else if (velPercent >= 50) velClass = 'vel-50';
                else if (velPercent >= 40) velClass = 'vel-40';
                else if (velPercent >= 30) velClass = 'vel-30';
                else if (velPercent >= 20) velClass = 'vel-20';
                else velClass = 'vel-10';
            }
            html += `<div class="sequencer-step-cell ${activeClass} ${velClass} ${beatBlockClass} border-r border-b border-gray-200 dark:border-slate-600" data-row="${i}" data-col="${j}" title="R${i+1},S${j+1}"></div>`;
        }
    }
    html += `</div></div>`; return html;
}

export function openTrackSequencerWindow(trackId, forceRedraw = false, savedState = null) {
    console.log(`[UI openTrackSequencerWindow] Called for track ${trackId}. Force redraw: ${forceRedraw}, SavedState:`, savedState);
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track || track.type === 'Audio') {
        console.warn(`[UI openTrackSequencerWindow] Track ${trackId} not found or is Audio type. Aborting.`);
        return null;
    }
    const windowId = `sequencerWin-${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (forceRedraw && openWindows.has(windowId)) {
        const existingWindow = openWindows.get(windowId);
        if (existingWindow && typeof existingWindow.close === 'function') {
            try {
                console.log(`[UI openTrackSequencerWindow] Force redraw: Closing existing window ${windowId}`);
                existingWindow.close(true);
            } catch (e) {console.warn(`[UI openTrackSequencerWindow] Error closing existing sequencer window for redraw for track ${trackId}:`, e)}
        } else {
            console.log(`[UI openTrackSequencerWindow] Force redraw: Window ${windowId} found in map but no close method or not instance, or map is missing.`);
        }
    }
    if (openWindows.has(windowId) && !forceRedraw && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        if (localAppServices.setActiveSequencerTrackId) localAppServices.setActiveSequencerTrackId(trackId);
        return win;
    }

    const activeSequence = track.getActiveSequence();
    if (!activeSequence) {
        console.error(`[UI openTrackSequencerWindow] Track ${trackId} has no active sequence. Cannot open sequencer.`);
        return null;
    }

    let rows, rowLabels;
    const numBars = activeSequence.length > 0 ? Math.max(1, activeSequence.length / Constants.STEPS_PER_BAR) : 1;

    if (track.type === 'Synth' || track.type === 'InstrumentSampler') { rows = Constants.synthPitches.length; rowLabels = Constants.synthPitches; }
    else if (track.type === 'Sampler') { rows = track.slices.length > 0 ? track.slices.length : Constants.numSlices; rowLabels = Array.from({ length: rows }, (_, i) => `Slice ${i + 1}`); }
    else if (track.type === 'DrumSampler') { rows = Constants.numDrumSamplerPads; rowLabels = Array.from({ length: rows }, (_, i) => `Pad ${i + 1}`); }
    else { rows = 0; rowLabels = []; }

    const contentDOM = buildSequencerContentDOM(track, rows, rowLabels, numBars);

    const desktopEl = ((localAppServices.uiElementsCache) && (localAppServices.uiElementsCache).desktop) || document.getElementById('desktop');
    const safeDesktopWidth = (desktopEl && typeof desktopEl.offsetWidth === 'number' && desktopEl.offsetWidth > 0)
                           ? desktopEl.offsetWidth
                           : 1024; // More robust fallback
    console.log(`[UI openTrackSequencerWindow] For track ${trackId}: Desktop element: ${desktopEl ? 'found' : 'NOT found'}, offsetWidth: ${((desktopEl) && (desktopEl).offsetWidth)}, safeDesktopWidth: ${safeDesktopWidth}, NumBars: ${numBars}`);


    let calculatedWidth = Math.max(400, Math.min(900, safeDesktopWidth - 40));
    let calculatedHeight = 400;

    if (!Number.isFinite(calculatedWidth) || calculatedWidth <= 0) {
        console.warn(`[UI openTrackSequencerWindow] Invalid calculatedWidth (${calculatedWidth}) for track ${trackId}, defaulting to 600.`);
        calculatedWidth = 600;
    }
    if (!Number.isFinite(calculatedHeight) || calculatedHeight <= 0) {
        console.warn(`[UI openTrackSequencerWindow] Invalid calculatedHeight (${calculatedHeight}) for track ${trackId}, defaulting to 400.`);
        calculatedHeight = 400;
    }

    const seqOptions = {
        width: calculatedWidth,
        height: calculatedHeight,
        minWidth: 400,
        minHeight: 250,
        initialContentKey: windowId,
        onCloseCallback: () => { if (localAppServices.getActiveSequencerTrackId && localAppServices.getActiveSequencerTrackId() === trackId && localAppServices.setActiveSequencerTrackId) localAppServices.setActiveSequencerTrackId(null); }
    };
    if (savedState) {
        if (Number.isFinite(parseInt(savedState.left,10))) seqOptions.x = parseInt(savedState.left,10);
        if (Number.isFinite(parseInt(savedState.top,10))) seqOptions.y = parseInt(savedState.top,10);
        if (Number.isFinite(parseInt(savedState.width,10)) && parseInt(savedState.width,10) >= seqOptions.minWidth) seqOptions.width = parseInt(savedState.width,10);
        if (Number.isFinite(parseInt(savedState.height,10)) && parseInt(savedState.height,10) >= seqOptions.minHeight) seqOptions.height = parseInt(savedState.height,10);
        if (Number.isFinite(parseInt(savedState.zIndex))) seqOptions.zIndex = parseInt(savedState.zIndex);
        seqOptions.isMinimized = savedState.isMinimized;
    }

    console.log(`[UI openTrackSequencerWindow] For track ${trackId}: Creating window with options:`, JSON.stringify(seqOptions));
    const sequencerWindow = localAppServices.createWindow(windowId, `Sequencer: ${track.name} - ${activeSequence.name}`, contentDOM, seqOptions);

    if (((sequencerWindow) && (sequencerWindow).element)) {
        const allCells = Array.from(sequencerWindow.element.querySelectorAll('.sequencer-step-cell'));
        sequencerWindow.stepCellsGrid = [];
        const currentSequenceLength = activeSequence ? activeSequence.length : Constants.defaultStepsPerBar;
        for (let i = 0; i < rows; i++) {
            sequencerWindow.stepCellsGrid[i] = allCells.slice(i * currentSequenceLength, (i + 1) * currentSequenceLength);
        }
        sequencerWindow.lastPlayedCol = -1;


        if (localAppServices.setActiveSequencerTrackId) localAppServices.setActiveSequencerTrackId(trackId);
        const grid = sequencerWindow.element.querySelector('.sequencer-grid-layout');
        const controlsDiv = sequencerWindow.element.querySelector('.sequencer-container .controls');

        if (controlsDiv) {
            controlsDiv.draggable = true;
            controlsDiv.addEventListener('dragstart', (e) => {
                const currentActiveSeq = track.getActiveSequence();
                if (currentActiveSeq) {
                    const dragData = {
                        type: 'sequence-timeline-drag',
                        sourceSequenceId: currentActiveSeq.id,
                        sourceTrackId: track.id,
                        clipName: currentActiveSeq.name
                    };
                    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = 'copy';
                    console.log(`[UI Sequencer DragStart] Dragging sequence: ${currentActiveSeq.name}`);
                } else {
                    e.preventDefault();
                    console.warn(`[UI Sequencer DragStart] No active sequence to drag for track ${track.name}`);
                }
            });
        }


        // Track selection state for copy/paste sections
        let selectionStartCell = null;
        let selectionEndCell = null;
        let isSelecting = false;

        function clearSelection() {
            if (sequencerWindow.element) {
                sequencerWindow.element.querySelectorAll('.sequencer-step-cell.selected-cell').forEach(cell => {
                    cell.classList.remove('selected-cell');
                });
            }
            selectionStartCell = null;
            selectionEndCell = null;
            isSelecting = false;
        }

        function updateSelectionUI() {
            if (!selectionStartCell || !selectionEndCell || !sequencerWindow.element) return;
            const r1 = Math.min(selectionStartCell.row, selectionEndCell.row);
            const r2 = Math.max(selectionStartCell.row, selectionEndCell.row);
            const c1 = Math.min(selectionStartCell.col, selectionEndCell.col);
            const c2 = Math.max(selectionStartCell.col, selectionEndCell.col);

            sequencerWindow.element.querySelectorAll('.sequencer-step-cell.selected-cell').forEach(cell => {
                cell.classList.remove('selected-cell');
            });
            for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                    const cell = sequencerWindow.element.querySelector(`.sequencer-step-cell[data-row="${r}"][data-col="${c}"]`);
                    if (cell) cell.classList.add('selected-cell');
                }
            }
        }

        const sequencerContextMenuHandler = (event) => {
            event.preventDefault(); event.stopPropagation();
            const currentTrackForMenu = localAppServices.getTrackById ? localAppServices.getTrackById(track.id) : null; if (!currentTrackForMenu) return;
            const currentActiveSeq = currentTrackForMenu.getActiveSequence(); if(!currentActiveSeq) return;
            const clipboard = localAppServices.getClipboardData ? localAppServices.getClipboardData() : {};
            const menuItems = [
                { label: `Copy \"${currentActiveSeq.name}\"`, action: () => { if (localAppServices.setClipboardData) { localAppServices.setClipboardData({ type: 'sequence', sourceTrackType: currentTrackForMenu.type, data: JSON.parse(JSON.stringify(currentActiveSeq.data || [])), sequenceLength: currentActiveSeq.length }); showNotification(`Sequence \"${currentActiveSeq.name}\" copied.`, 2000); } } },
                { label: `Paste into \"${currentActiveSeq.name}\"`, action: () => { if (!clipboard || clipboard.type !== 'sequence' || !clipboard.data) { showNotification("Clipboard empty or no sequence data.", 2000); return; } if (clipboard.sourceTrackType !== currentTrackForMenu.type) { showNotification(`Track types mismatch. Can't paste ${clipboard.sourceTrackType} sequence into ${currentTrackForMenu.type} track.`, 3000); return; } if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Paste Sequence into ${currentActiveSeq.name} on ${currentTrackForMenu.name}`); currentActiveSeq.data = JSON.parse(JSON.stringify(clipboard.data)); currentActiveSeq.length = clipboard.sequenceLength; currentTrackForMenu.recreateToneSequence(true); showNotification(`Sequence pasted into "${currentActiveSeq.name}".`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } },
                { separator: true },
                { label: `Shift Notes Up`, action: () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Shift Notes Up on ${currentTrackForMenu.name} (${currentActiveSeq.name})`); const result = currentTrackForMenu.shiftSequenceNotes(1); if (result > 0) { currentTrackForMenu.recreateToneSequence(true); showNotification(`Shifted ${result} note(s) up.`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } else { showNotification("No notes to shift up.", 2000); } } },
                { label: `Shift Notes Down`, action: () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Shift Notes Down on ${currentTrackForMenu.name} (${currentActiveSeq.name})`); const result = currentTrackForMenu.shiftSequenceNotes(-1); if (result > 0) { currentTrackForMenu.recreateToneSequence(true); showNotification(`Shifted ${result} note(s) down.`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } else { showNotification("No notes to shift down.", 2000); } } },
                { separator: true },
                { label: `Humanize Velocities (+/- 15%)`, action: () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Humanize Velocities on ${currentTrackForMenu.name} (${currentActiveSeq.name})`); const result = currentTrackForMenu.humanizeVelocity(0.15); if (result > 0) { currentTrackForMenu.recreateToneSequence(true); showNotification(`Humanized ${result} velocity value(s).`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } else { showNotification("No notes to humanize.", 2000); } } },
                { label: `Humanize Velocities (+/- 25%)`, action: () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Humanize Velocities on ${currentTrackForMenu.name} (${currentActiveSeq.name})`); const result = currentTrackForMenu.humanizeVelocity(0.25); if (result > 0) { currentTrackForMenu.recreateToneSequence(true); showNotification(`Humanized ${result} velocity value(s).`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } else { showNotification("No notes to humanize.", 2000); } } },
                { separator: true },
                { label: `Quantize to 1/16`, action: () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Quantize to 1/16 on ${currentTrackForMenu.name}`); const result = currentTrackForMenu.quantizeSequence(16); if (result > 0) { currentTrackForMenu.recreateToneSequence(true); showNotification(`Quantized ${result} note(s) to 1/16.`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } else { showNotification("No notes to quantize.", 2000); } } },
                { label: `Quantize to 1/8`, action: () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Quantize to 1/8 on ${currentTrackForMenu.name}`); const result = currentTrackForMenu.quantizeSequence(8); if (result > 0) { currentTrackForMenu.recreateToneSequence(true); showNotification(`Quantized ${result} note(s) to 1/8.`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } else { showNotification("No notes to quantize.", 2000); } } },
                { label: `Quantize to 1/4`, action: () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Quantize to 1/4 on ${currentTrackForMenu.name}`); const result = currentTrackForMenu.quantizeSequence(4); if (result > 0) { currentTrackForMenu.recreateToneSequence(true); showNotification(`Quantized ${result} note(s) to 1/4.`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); } else { showNotification("No notes to quantize.", 2000); } } },
                { separator: true },
                { label: `Erase \"${currentActiveSeq.name}\"`, action: () => { showConfirmationDialog(`Erase Sequence "${currentActiveSeq.name}" for ${currentTrackForMenu.name}?`, "This will clear all notes. This can be undone.", () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Erase Sequence ${currentActiveSeq.name} for ${currentTrackForMenu.name}`); let numRowsErase = currentActiveSeq.data.length; currentActiveSeq.data = Array(numRowsErase).fill(null).map(() => Array(currentActiveSeq.length).fill(null)); currentTrackForMenu.recreateToneSequence(true); showNotification(`Sequence "${currentActiveSeq.name}" erased.`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); }); } },
                { label: `Double Length of "${currentActiveSeq.name}"`, action: () => { const currentNumBars = currentActiveSeq.length / Constants.STEPS_PER_BAR; if (currentNumBars * 2 > (Constants.MAX_BARS || 16)) { showNotification(`Exceeds max of ${Constants.MAX_BARS || 16} bars.`, 3000); return; } currentTrackForMenu.doubleSequence(); showNotification(`Sequence length doubled for "${currentActiveSeq.name}".`, 2000); } }
            ];
            createContextMenu(event, menuItems, localAppServices);
        };
        if (grid) grid.addEventListener('contextmenu', sequencerContextMenuHandler);

        // Handle bars input change
        const barsInput = sequencerWindow.element.querySelector(`#seqLengthInput-${track.id}`);
        if (barsInput) {
            barsInput.addEventListener('change', (e) => {
                const newNumBars = parseInt(e.target.value, 10);
                if (!Number.isFinite(newNumBars) || newNumBars < 1 || newNumBars > (Constants.MAX_BARS || 16)) {
                    showNotification(`Invalid number of bars. Must be 1-${Constants.MAX_BARS || 16}.`, 3000);
                    return;
                }
                const newLength = newNumBars * Constants.STEPS_PER_BAR;
                if (newLength === activeSequence.length) return; // No change
                
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Change sequence length to ${newNumBars} bars`);
                
                // Resize the sequence data
                const numRows = activeSequence.data ? activeSequence.data.length : (rows || 1);
                const newData = [];
                for (let r = 0; r < numRows; r++) {
                    newData[r] = [];
                    for (let c = 0; c < newLength; c++) {
                        if (activeSequence.data && activeSequence.data[r] && activeSequence.data[r][c]) {
                            newData[r][c] = activeSequence.data[r][c];
                        } else {
                            newData[r][c] = null;
                        }
                    }
                }
                activeSequence.data = newData;
                activeSequence.length = newLength;
                
                // Recreate the Tone sequence
                track.recreateToneSequence(true);
                
                // Re-render the sequencer window
                openTrackSequencerWindow(trackId, true);
                showNotification(`Sequence length changed to ${newNumBars} bars.`, 2000);
            });
        }

        // Handle snap-to-grid toggle button
        const snapBtn = sequencerWindow.element.querySelector(`#seqSnapToggle-${track.id}`);
        if (snapBtn) {
            snapBtn.addEventListener('click', () => {
                const currentSnap = window.SEQUENCER_SNAP_VALUE || 16;
                // Cycle: 16 -> 8 -> 4 -> 0 -> 16
                let nextSnap = 16;
                if (currentSnap === 16) nextSnap = 8;
                else if (currentSnap === 8) nextSnap = 4;
                else if (currentSnap === 4) nextSnap = 0;
                else if (currentSnap === 0) nextSnap = 16;
                window.SEQUENCER_SNAP_VALUE = nextSnap;
                const snapLabel = nextSnap === 0 ? 'Off' : (nextSnap === 4 ? '1/4' : (nextSnap === 8 ? '1/8' : '1/16'));
                snapBtn.textContent = `Snap: ${snapLabel}`;
                showNotification(`Snap set to ${snapLabel}`, 1500);
            });
        }

        if (grid) grid.addEventListener('click', (e) => {
            const targetCell = e.target.closest('.sequencer-step-cell');
            if (targetCell) {
                let row = parseInt(targetCell.dataset.row, 10); let col = parseInt(targetCell.dataset.col, 10);
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data) return;

                // Apply snap quantization if enabled
                const snapValue = window.SEQUENCER_SNAP_VALUE || 16;
                if (snapValue > 0) {
                    // Snap the column to the nearest snap point
                    const nearestSnapCol = Math.round(col / snapValue) * snapValue;
                    if (nearestSnapCol !== col) {
                        // Find the actual cell at the snapped position
                        const snappedCell = sequencerWindow.element.querySelector(`.sequencer-step-cell[data-row="${row}"][data-col="${nearestSnapCol}"]`);
                        if (snappedCell) {
                            col = nearestSnapCol;
                        }
                    }
                }

                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    if (!currentActiveSeq.data[row]) currentActiveSeq.data[row] = Array(currentActiveSeq.length).fill(null);
                    const currentStepData = currentActiveSeq.data[row][col];
                    const isActive = !(((currentStepData) && (currentStepData).active));

                    if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
                        // Shift+Ctrl/Cmd: paste velocity from clipboard
                        if (clipboard && clipboard.type === 'velocity' && clipboard.velocity !== undefined) {
                            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Paste Velocity on ${track.name}`);
                            if (currentStepData && currentStepData.active) {
                                currentActiveSeq.data[row][col].velocity = clipboard.velocity;
                                updateSequencerCellUI(sequencerWindow.element, track.type, row, col, true, clipboard.velocity);
                                showNotification(`Velocity set to ${Math.round(clipboard.velocity * 100)}%`, 1000);
                            }
                        }
                    } else if (e.shiftKey) {
                        // Shift+Click: transpose notes up by 1 semitone
                        if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Transpose Notes Up on ${track.name}`);
                        const result = track.shiftSequenceNotes(-1); // negative row shift = higher pitch (up)
                        if (result > 0) {
                            track.recreateToneSequence(true);
                            if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged');
                            showNotification(`Shifted ${result} note(s) up`, 1500);
                        } else {
                            // No notes to shift - just toggle if inactive
                            currentActiveSeq.data[row][col] = { active: true, velocity: ((currentStepData) && (currentStepData).velocity) || Constants.defaultVelocity };
                            updateSequencerCellUI(sequencerWindow.element, track.type, row, col, true, ((currentStepData) && (currentStepData).velocity) || Constants.defaultVelocity);
                        }
                    } else if (e.ctrlKey || e.metaKey) {
                        // Ctrl/Cmd+Click: copy velocity to clipboard
                        if (currentStepData && currentStepData.active) {
                            if (localAppServices.setClipboardData) localAppServices.setClipboardData({ type: 'velocity', velocity: currentStepData.velocity || Constants.defaultVelocity });
                            showNotification(`Velocity ${Math.round((currentStepData.velocity || Constants.defaultVelocity) * 100)}% copied`, 1000);
                        }
                    } else {
                        // Normal click: toggle step
                        if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle Step (${row + 1},${col + 1}) on ${track.name} (${currentActiveSeq.name})`);
                        currentActiveSeq.data[row][col] = isActive ? { active: true, velocity: ((currentStepData) && (currentStepData).velocity) || Constants.defaultVelocity } : null;
                        updateSequencerCellUI(sequencerWindow.element, track.type, row, col, isActive, ((currentStepData) && (currentStepData).velocity) || Constants.defaultVelocity);
                    }
                }
            }
        });

        // Right-click on a cell: open velocity editor
        if (grid) grid.addEventListener('contextmenu', (e) => {
            const targetCell = e.target.closest('.sequencer-step-cell');
            if (!targetCell) return;
            e.preventDefault();
            e.stopPropagation();
            
            let row = parseInt(targetCell.dataset.row, 10);
            let col = parseInt(targetCell.dataset.col, 10);
            const currentActiveSeq = track.getActiveSequence();
            if (!currentActiveSeq || !currentActiveSeq.data || !currentActiveSeq.data[row]) return;
            
            const stepData = currentActiveSeq.data[row][col];
            if (!stepData || !stepData.active) {
                showNotification("No note at this step to edit.", 1500);
                return;
            }
            
            const currentVel = stepData.velocity || Constants.defaultVelocity;
            const velPct = Math.round(currentVel * 100);
            
            const menuItems = [
                { label: `Velocity: ${velPct}%`, action: () => {}, disabled: true },
                { separator: true },
                { label: `Set to 100%`, action: () => { setVelocity(row, col, 1.0); } },
                { label: `Set to 80%`, action: () => { setVelocity(row, col, 0.8); } },
                { label: `Set to 60%`, action: () => { setVelocity(row, col, 0.6); } },
                { label: `Set to 40%`, action: () => { setVelocity(row, col, 0.4); } },
                { label: `Set to 20%`, action: () => { setVelocity(row, col, 0.2); } },
                { separator: true },
                { label: `+ 10%`, action: () => { setVelocity(row, col, Math.min(1.0, currentVel + 0.1)); } },
                { label: `- 10%`, action: () => { setVelocity(row, col, Math.max(0.05, currentVel - 0.1)); } },
            ];
            
            function setVelocity(r, c, v) {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set Velocity on ${track.name}`);
                currentActiveSeq.data[r][c].velocity = Math.round(v * 100) / 100;
                updateSequencerCellUI(sequencerWindow.element, track.type, r, c, true, currentActiveSeq.data[r][c].velocity);
                showNotification(`Velocity: ${Math.round(currentActiveSeq.data[r][c].velocity * 100)}%`, 1000);
            }
            
            createContextMenu(e, menuItems, localAppServices);
        });
    }
    return sequencerWindow;
}

// --- UI Update & Drawing Functions ---
export function drawWaveform(track) {
    if (!((track) && (track).waveformCanvasCtx) || !((track.audioBuffer) && (track.audioBuffer).loaded)) {
        if (((track) && (track).waveformCanvasCtx)) {
            const canvas = track.waveformCanvasCtx.canvas;
            track.waveformCanvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            track.waveformCanvasCtx.fillStyle = canvas.classList.contains('dark') ? '#101010' : '#e0e0e0';
            track.waveformCanvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            track.waveformCanvasCtx.fillStyle = canvas.classList.contains('dark') ? '#E0BBE4' : '#a0a0a0';
            track.waveformCanvasCtx.textAlign = 'center';
            track.waveformCanvasCtx.fillText('No audio loaded or processed', canvas.width / 2, canvas.height / 2);
        }
        return;
    }
    const canvas = track.waveformCanvasCtx.canvas; const ctx = track.waveformCanvasCtx;
    const buffer = track.audioBuffer.get(); const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width); const amp = canvas.height / 2;
    ctx.fillStyle = ctx.canvas.classList.contains('dark') ? '#101010' : '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1; ctx.strokeStyle = ctx.canvas.classList.contains('dark') ? '#957DAD' : '#957DAD';
    ctx.beginPath(); ctx.moveTo(0, amp);
    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0; let max = -1.0;
        for (let j = 0; j < step; j++) { const datum = data[(i * step) + j]; if (datum < min) min = datum; if (datum > max) max = datum; }
        ctx.lineTo(i, (1 + min) * amp); ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.lineTo(canvas.width, amp); ctx.stroke();
    track.slices.forEach((slice, index) => {
        if (slice.duration <= 0) return;
        const startX = (slice.offset / buffer.duration) * canvas.width;
        const endX = ((slice.offset + slice.duration) / buffer.duration) * canvas.width;
        ctx.fillStyle = index === track.selectedSliceForEdit ? 'rgba(255, 0, 0, 0.3)' : (ctx.canvas.classList.contains('dark') ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 255, 0.15)');
        ctx.fillRect(startX, 0, endX - startX, canvas.height);
        ctx.strokeStyle = index === track.selectedSliceForEdit ? 'rgba(255,0,0,0.7)' : (ctx.canvas.classList.contains('dark') ? 'rgba(52, 211, 153, 0.5)' : 'rgba(0,0,255,0.4)');
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(startX, canvas.height); ctx.moveTo(endX, 0); ctx.lineTo(endX, canvas.height); ctx.stroke();
        ctx.fillStyle = index === track.selectedSliceForEdit ? '#FEC8D8' : (ctx.canvas.classList.contains('dark') ? '#E0BBE4' : '#0000cc');
        ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`S${index + 1}`, startX + 2, 10);
    });
}

export function drawInstrumentWaveform(track) {
    if (!((track) && (track).instrumentWaveformCanvasCtx) || !((track.instrumentSamplerSettings.audioBuffer) && (track.instrumentSamplerSettings.audioBuffer).loaded)) {
        if (((track) && (track).instrumentWaveformCanvasCtx)) { /* Draw 'No audio' message, similar to drawWaveform */ } return;
    }
    const canvas = track.instrumentWaveformCanvasCtx.canvas; const ctx = track.instrumentWaveformCanvasCtx;
    const buffer = track.instrumentSamplerSettings.audioBuffer.get(); const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width); const amp = canvas.height / 2;
    ctx.fillStyle = canvas.classList.contains('dark') ? '#101010' : '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1; ctx.strokeStyle = canvas.classList.contains('dark') ? '#D291BC' : '#D291BC';
    ctx.beginPath(); ctx.moveTo(0, amp);
    for (let i = 0; i < canvas.width; i++) { let min = 1.0; let max = -1.0; for (let j = 0; j < step; j++) { const datum = data[(i * step) + j]; if (datum < min) min = datum; if (datum > max) max = datum; } ctx.lineTo(i, (1 + min) * amp); ctx.lineTo(i, (1 + max) * amp); }
    ctx.lineTo(canvas.width, amp); ctx.stroke();
    if (track.instrumentSamplerSettings.loop) {
        const loopStartX = (track.instrumentSamplerSettings.loopStart / buffer.duration) * canvas.width;
        const loopEndX = (track.instrumentSamplerSettings.loopEnd / buffer.duration) * canvas.width;
        ctx.fillStyle = canvas.classList.contains('dark') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, canvas.height);
        ctx.strokeStyle = canvas.classList.contains('dark') ? 'rgba(52, 211, 153, 0.6)' : 'rgba(0,200,0,0.6)';
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(loopStartX, 0); ctx.lineTo(loopStartX, canvas.height); ctx.moveTo(loopEndX, 0); ctx.lineTo(loopEndX, canvas.height); ctx.stroke();
    }
}



export function highlightPlayingStep(trackId, stepIndex, isPlaying) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return;
    const sequencerWin = localAppServices.getWindowById ? localAppServices.getWindowById('sequencerWin-' + trackId) : null;
    if (!sequencerWin || !sequencerWin.element) return;
    sequencerWin.element.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));
    if (isPlaying && stepIndex >= 0) {
        const cell = sequencerWin.element.querySelector('[data-col="' + stepIndex + '"]');
        if (cell) cell.classList.add('playing');
    }
}

export function openTimelineWindow(savedState = null) {
    console.log('[UI openTimelineWindow] Creating timeline window...');
    
    // Check if timeline window already exists
    if (typeof getWindowByIdState === 'function') {
        const existingWin = getWindowByIdState('timeline');
        if (existingWin) {
            existingWin.restore();
            existingWin.bringToFront();
            return;
        }
    }

    // Create timeline content with zoom controls
    const timelineContent = `
        <div id="timeline-container">
            <div id="timeline-header">
                <div id="timeline-ruler-container" style="display: flex; align-items: center;">
                    <div id="timeline-zoom-controls" style="display: flex; align-items: center; gap: 4px; padding: 2px 6px; background: #2a2a2a; border-right: 1px solid #3a3a3a;">
                        <button id="timeline-zoom-out" class="transport-btn" style="padding: 2px 6px; font-size: 10px;" title="Zoom out (-)">−</button>
                        <span id="timeline-zoom-level" style="font-size: 10px; color: #aaa; min-width: 32px; text-align: center;">100%</span>
                        <button id="timeline-zoom-in" class="transport-btn" style="padding: 2px 6px; font-size: 10px;" title="Zoom in (+)">+</button>
                        <button id="timeline-zoom-reset" class="transport-btn" style="padding: 2px 6px; font-size: 9px;" title="Reset zoom">1:1</button>
                    </div>
                    <div id="timeline-ruler" style="flex: 1; overflow: hidden;"></div>
                </div>
            </div>
            <div id="timeline-tracks-container">
                <div id="timeline-tracks-area">
                    <!-- Tracks will be rendered here -->
                </div>
            </div>
            <div id="timeline-playhead"></div>
        </div>
    `;

    // Create the window
    if (typeof localAppServices.createWindow === 'function') {
        const timelineWindow = localAppServices.createWindow(
            'timeline',
            'Timeline',
            timelineContent,
            { width: 900, height: 400, x: 50, y: 50 },
        );
        
        // Setup zoom controls after window is created
        setupTimelineZoomControls(timelineWindow.element);
        
        // Render tracks in timeline
        renderTimeline();
    } else {
        console.error('createWindow service not available');
    }
}

function setupTimelineZoomControls(timelineElement) {
    // Zoom in button
    const zoomInBtn = timelineElement.querySelector('#timeline-zoom-in');
    const zoomOutBtn = timelineElement.querySelector('#timeline-zoom-out');
    const zoomResetBtn = timelineElement.querySelector('#timeline-zoom-reset');
    const zoomLevelDisplay = timelineElement.querySelector('#timeline-zoom-level');
    const ruler = timelineElement.querySelector('#timeline-ruler');
    const tracksArea = timelineElement.querySelector('#timeline-tracks-area');
    const tracksContainer = timelineElement.querySelector('#timeline-tracks-container');
    
    if (!zoomInBtn || !zoomOutBtn || !ruler || !tracksArea) {
        console.warn('[Timeline] Zoom control elements not found');
        return;
    }
    
    function applyZoom(newZoom) {
        timelineZoomLevel = Math.min(4, Math.max(0.25, newZoom));
        const zoomPercent = Math.round(timelineZoomLevel * 100);
        if (zoomLevelDisplay) zoomLevelDisplay.textContent = `${zoomPercent}%`;
        
        // Update ruler background size
        ruler.style.backgroundSize = `${120 * timelineZoomLevel}px 100%, ${30 * timelineZoomLevel}px 100%`;
        
        // Update tracks area width
        tracksArea.style.width = `${4000 * timelineZoomLevel}px`;
        
        // Sync horizontal scroll
        if (tracksContainer && ruler.parentElement) {
            tracksContainer.scrollLeft = ruler.parentElement.scrollLeft;
        }
        
        showNotification(`Zoom: ${zoomPercent}%`, 800);
    }
    
    zoomInBtn.addEventListener('click', () => applyZoom(timelineZoomLevel * 1.5));
    zoomOutBtn.addEventListener('click', () => applyZoom(timelineZoomLevel / 1.5));
    zoomResetBtn.addEventListener('click', () => applyZoom(1.0));
    
    // Scroll wheel zoom on the tracks container
    tracksContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.8 : 1.25;
            applyZoom(timelineZoomLevel * delta);
        }
    }, { passive: false });
    
    // Sync scroll between ruler and tracks
    tracksContainer.addEventListener('scroll', () => {
        ruler.parentElement.scrollLeft = tracksContainer.scrollLeft;
        timelineScrollX = tracksContainer.scrollLeft;
    });
    
    // Initial zoom display
    applyZoom(timelineZoomLevel);
}

export function renderTimeline() {
    console.log('[UI renderTimeline] Rendering timeline...');
    
    const tracksArea = document.getElementById('timeline-tracks-area');
    if (!tracksArea) {
        console.warn('Timeline tracks area not found');
        return;
    }

    // Get tracks from state
    const tracks = typeof localAppServices.getTracks === 'function' ? localAppServices.getTracks() : [];
    
    if (!tracks || tracks.length === 0) {
        tracksArea.innerHTML = '<div style="padding: 20px; color: #888;">No tracks. Add a track to see it in the timeline.</div>';
        return;
    }

    // Pixels per second - adjust this to scale clips on the timeline
    const PIXELS_PER_SECOND = 50 * timelineZoomLevel;
    const TRACK_NAME_WIDTH = 120; // matches CSS --timeline-track-name-width

    // Render each track as a lane
    let tracksHTML = '';
    tracks.forEach(track => {
        const trackColor = track.trackColor || '#6366f1';
        
        // Generate clip HTML for this track
        let clipsHTML = '';
        const clips = track.timelineClips || [];
        clips.forEach(clip => {
            const clipLeft = TRACK_NAME_WIDTH + (clip.startTime * PIXELS_PER_SECOND);
            const clipWidth = Math.max(clip.duration * PIXELS_PER_SECOND, 20); // minimum 20px width
            const isAudioClip = clip.type === 'audio';
            const isSequenceClip = clip.type === 'sequence';
            const clipClass = isAudioClip ? 'audio-clip' : (isSequenceClip ? 'sequence-clip' : 'audio-clip');
            
            clipsHTML += `
                <div class="${clipClass}" 
                     data-clip-id="${clip.id}" 
                     data-track-id="${track.id}"
                     style="left: ${clipLeft}px; width: ${clipWidth}px;"
                     title="${clip.name || 'Untitled'}">
                    <div class="clip-resize-handle clip-resize-handle-left"></div>
                    <span class="clip-label">${clip.name || 'Untitled'}</span>
                    <div class="clip-resize-handle clip-resize-handle-right"></div>
                </div>
            `;
        });

        tracksHTML += `
            <div class="timeline-track-lane" data-track-id="${track.id}">
                <div class="timeline-track-lane-name flex items-center gap-1">
                    <span class="track-color-dot" style="background-color:${trackColor}"></span>
                    <span class="truncate">${track.name}</span>
                </div>
                <div class="timeline-track-content" style="flex: 1; position: relative; height: 100%;">
                    ${clipsHTML}
                </div>
            </div>
        `;
    });
    
    tracksArea.innerHTML = tracksHTML;
    
    // Attach click handlers for clip selection
    attachClipEventHandlers();
    
    // Update playhead position
    updatePlayheadPosition();
    
    console.log(`[UI renderTimeline] Rendered ${tracks.length} tracks with clips`);
}

function attachClipEventHandlers() {
    // Clip click (select)
    document.querySelectorAll('.audio-clip, .sequence-clip').forEach(clipEl => {
        clipEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('clip-resize-handle')) return;
            const clipId = clipEl.dataset.clipId;
            const trackId = clipEl.dataset.trackId;
            selectClip(trackId, clipId);
        });
    });
    
    // Clip drag (move)
    document.querySelectorAll('.audio-clip, .sequence-clip').forEach(clipEl => {
        clipEl.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('clip-resize-handle')) return;
            e.preventDefault();
            startClipDrag(e, clipEl);
        });
    });
    
    // Resize handles
    document.querySelectorAll('.clip-resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const clipEl = handle.closest('.audio-clip, .sequence-clip');
            const isLeft = handle.classList.contains('clip-resize-handle-left');
            startClipResize(e, clipEl, isLeft);
        });
    });
}

let clipDragState = null;

function startClipDrag(e, clipEl) {
    const clipId = clipEl.dataset.clipId;
    const trackId = clipEl.dataset.trackId;
    const tracks = typeof localAppServices.getTracks === 'function' ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return;
    
    const PIXELS_PER_SECOND = 50 * timelineZoomLevel;
    const startX = e.clientX;
    const originalLeft = clip.startTime * PIXELS_PER_SECOND;
    
    clipDragState = {
        clipEl,
        clip,
        track,
        startX,
        originalLeft,
        PIXELS_PER_SECOND
    };
    
    document.addEventListener('mousemove', onClipDrag);
    document.addEventListener('mouseup', stopClipDrag);
}

function onClipDrag(e) {
    if (!clipDragState) return;
    const { clipEl, startX, originalLeft, PIXELS_PER_SECOND, clip } = clipDragState;
    
    const deltaX = e.clientX - startX;
    const newLeft = Math.max(0, originalLeft + deltaX);
    const newStartTime = newLeft / PIXELS_PER_SECOND;
    
    clipEl.style.left = `${newLeft}px`;
    clip.startTime = newStartTime;
}

function stopClipDrag(e) {
    if (!clipDragState) return;
    const { clip, track, clipEl } = clipDragState;
    
    // Finalize position
    if (typeof track.updateAudioClipPosition === 'function') {
        track.updateAudioClipPosition(clip.id, clip.startTime);
    }
    
    clipDragState = null;
    document.removeEventListener('mousemove', onClipDrag);
    document.removeEventListener('mouseup', stopClipDrag);
}

let clipResizeState = null;

function startClipResize(e, clipEl, isLeft) {
    const clipId = clipEl.dataset.clipId;
    const trackId = clipEl.dataset.trackId;
    const tracks = typeof localAppServices.getTracks === 'function' ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return;
    
    const PIXELS_PER_SECOND = 50 * timelineZoomLevel;
    const startX = e.clientX;
    const originalLeft = clip.startTime * PIXELS_PER_SECOND;
    const originalWidth = clip.duration * PIXELS_PER_SECOND;
    
    clipResizeState = {
        clipEl,
        clip,
        track,
        isLeft,
        startX,
        originalLeft,
        originalWidth,
        PIXELS_PER_SECOND
    };
    
    document.addEventListener('mousemove', onClipResize);
    document.addEventListener('mouseup', stopClipResize);
}

function onClipResize(e) {
    if (!clipResizeState) return;
    const { clipEl, clip, isLeft, startX, originalLeft, originalWidth, PIXELS_PER_SECOND } = clipResizeState;
    
    const deltaX = e.clientX - startX;
    
    if (isLeft) {
        // Resize from left (change start time and width)
        const newLeft = Math.max(0, originalLeft + deltaX);
        const newWidth = Math.max(20, originalWidth - deltaX);
        const newStartTime = newLeft / PIXELS_PER_SECOND;
        clip.startTime = newStartTime;
        clip.duration = newWidth / PIXELS_PER_SECOND;
        clipEl.style.left = `${newLeft}px`;
        clipEl.style.width = `${newWidth}px`;
    } else {
        // Resize from right (change width only)
        const newWidth = Math.max(20, originalWidth + deltaX);
        clip.duration = newWidth / PIXELS_PER_SECOND;
        clipEl.style.width = `${newWidth}px`;
    }
}

function stopClipResize(e) {
    if (!clipResizeState) return;
    const { clip, track } = clipResizeState;
    
    // Call the track's update function to persist and handle undo
    if (typeof track.updateAudioClipPosition === 'function') {
        track.updateAudioClipPosition(clip.id, clip.startTime);
    }
    
    clipResizeState = null;
    document.removeEventListener('mousemove', onClipResize);
    document.removeEventListener('mouseup', stopClipResize);
}

function selectClip(trackId, clipId) {
    // Highlight selected clip
    document.querySelectorAll('.audio-clip, .sequence-clip').forEach(el => {
        el.style.outline = '';
    });
    const clipEl = document.querySelector(`.audio-clip[data-clip-id="${clipId}"], .sequence-clip[data-clip-id="${clipId}"]`);
    if (clipEl) {
        clipEl.style.outline = '2px solid #fff';
    }
    
    // Could also open an inspector or show clip details
    console.log(`Selected clip ${clipId} on track ${trackId}`);
}

export function updatePlayheadPosition(progress = undefined) {
    // Update the timeline playhead position
    const playhead = document.getElementById('timeline-playhead');
    if (!playhead) return;
    
    const tracksArea = document.getElementById('timeline-tracks-area');
    if (!tracksArea) return;
    
    if (progress === undefined) {
        // Get real transport position
        try {
            const transportPosition = Tone.Transport.position;
            const [bars, beats, sixteenths] = transportPosition.split(':').map(Number);
            const secondsPerBeat = 60 / Tone.Transport.bpm.value;
            const secondsPerBar = secondsPerBeat * 4;
            const currentSeconds = (bars * secondsPerBar) + (beats * secondsPerBeat) + (sixteenths * secondsPerBeat / 4);
            progress = currentSeconds / (16 * secondsPerBar); // Normalize to 16 bars
        } catch (e) {
            progress = 0;
        }
    }
    
    const TRACK_NAME_WIDTH = 120;
    const PIXELS_PER_SECOND = 50 * timelineZoomLevel;
    const totalBars = 16;
    const totalSeconds = totalBars * (60 / Tone.Transport.bpm.value) * 4;
    const timelineWidth = TRACK_NAME_WIDTH + (totalSeconds * PIXELS_PER_SECOND);
    const position = TRACK_NAME_WIDTH + (progress * (timelineWidth - TRACK_NAME_WIDTH));
    
    playhead.style.left = `${position}px`;
    playhead.style.display = 'block';
}

export function renderDrumSamplerPads(track) {
    // Render the drum pad grid for DrumSampler tracks
    const container = document.getElementById(`drumPadsGridContainer-${track.id}`);
    if (!container) return;
    
    const numPads = 8; // 4x4 grid
    let html = '';
    for (let i = 0; i < numPads; i++) {
        const padData = track.drumSamplerPads && track.drumSamplerPads[i];
        const hasSample = padData && padData.audioBuffer;
        const isSelected = track.selectedDrumPadForEdit === i;
        html += `<div class="drum-pad pad-button ${hasSample ? 'has-sample' : ''} ${isSelected ? 'selected-for-edit' : ''}" 
            data-pad-index="${i}" data-track-id="${track.id}">
            <span class="pad-label">${i + 1}</span>
        </div>`;
    }
    container.innerHTML = html;
    
    // Add click handlers for pad selection
    container.querySelectorAll('.drum-pad').forEach(pad => {
        pad.addEventListener('click', (e) => {
            const padIndex = parseInt(e.currentTarget.dataset.padIndex, 10);
            const trackId = e.currentTarget.dataset.trackId;
            if (localAppServices.selectDrumPad) {
                localAppServices.selectDrumPad(trackId, padIndex);
            }
        });
    });
}

export function renderSamplePads(track) {
    // Render the sample pads grid for Sampler tracks
    const container = document.getElementById(`samplePadsContainer-${track.id}`);
    if (!container) {
        console.warn(`[UI] Sample pads container not found for track ${track.id}`);
        return;
    }
    
    // Get number of slices/pads from track (default to 16 if no slices yet)
    const numPads = (track.slices && track.slices.length > 0) ? Math.min(track.slices.length, 16) : 16;
    
    let html = '';
    for (let i = 0; i < numPads; i++) {
        const slice = track.slices && track.slices[i];
        const hasContent = slice && slice.duration > 0;
        html += `<div class="pad-button ${hasContent ? 'has-sample' : ''}" 
            data-pad-index="${i}" data-track-id="${track.id}">
            <span class="pad-label">S${i + 1}</span>
        </div>`;
    }
    container.innerHTML = html;
    
    // Add click handlers - select slice for editing and play preview
    container.querySelectorAll('.pad-button').forEach((pad, index) => {
        pad.addEventListener('click', async (e) => {
            e.stopPropagation();
            const padIndex = index;
            const trackId = track.id;
            
            // Select slice for editing
            if (track) {
                track.selectedSliceForEdit = padIndex;
                updateSliceEditorUI(track);
            }
            
            // Play slice preview if it has content
            const slice = track.slices && track.slices[padIndex];
            if (slice && slice.duration > 0 && localAppServices.playSlicePreview) {
                localAppServices.playSlicePreview(trackId, padIndex);
            }
        });
        
        // Add cursor style
        pad.style.cursor = 'pointer';
    });
}

export function updateSliceEditorUI(track) {
    // Update the slice editor UI with current slice info
    if (!track) return;
    
    // Get the current slice data
    const currentSliceIndex = track.selectedSliceForEdit || 0;
    const slice = track.slices && track.slices[currentSliceIndex];
    
    // Default slice data if not found
    const sliceData = slice || { volume: 0.7, pitchShift: 0, loop: false, reverse: false, envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.1 } };
    
    // Update selected slice info
    const sliceInfoEl = document.getElementById(`selectedSliceInfo-${track.id}`);
    if (sliceInfoEl) {
        sliceInfoEl.textContent = currentSliceIndex + 1;
    }
    
    // Update pad selection visual
    const container = document.getElementById(`samplePadsContainer-${track.id}`);
    if (container) {
        container.querySelectorAll('.pad-button').forEach((pad, index) => {
            pad.classList.toggle('selected-for-edit', index === currentSliceIndex);
        });
    }
    
    // Update knob values to reflect the selected slice's values
    if (track.inspectorControls) {
        if (track.inspectorControls.sliceVolume && sliceData) {
            track.inspectorControls.sliceVolume.setValue(sliceData.volume !== undefined ? sliceData.volume : 0.7, false);
        }
        if (track.inspectorControls.slicePitch && sliceData) {
            track.inspectorControls.slicePitch.setValue(sliceData.pitchShift !== undefined ? sliceData.pitchShift : 0, false);
        }
        if (track.inspectorControls.sliceEnvAttack && ((sliceData) && (sliceData).envelope)) {
            track.inspectorControls.sliceEnvAttack.setValue(sliceData.envelope.attack || 0.01, false);
        }
        if (track.inspectorControls.sliceEnvDecay && ((sliceData) && (sliceData).envelope)) {
            track.inspectorControls.sliceEnvDecay.setValue(sliceData.envelope.decay || 0.1, false);
        }
        if (track.inspectorControls.sliceEnvSustain && ((sliceData) && (sliceData).envelope)) {
            track.inspectorControls.sliceEnvSustain.setValue(sliceData.envelope.sustain !== undefined ? sliceData.envelope.sustain : 1.0, false);
        }
        if (track.inspectorControls.sliceEnvRelease && ((sliceData) && (sliceData).envelope)) {
            track.inspectorControls.sliceEnvRelease.setValue(sliceData.envelope.release || 0.1, false);
        }
        
        // Update loop/reverse toggle buttons
        const loopToggleBtn = document.getElementById(`sliceLoopToggle-${track.id}`);
        if (loopToggleBtn) {
            loopToggleBtn.textContent = sliceData.loop ? 'Loop: ON' : 'Loop: OFF';
            loopToggleBtn.classList.toggle('active', sliceData.loop);
        }
        const reverseToggleBtn = document.getElementById(`sliceReverseToggle-${track.id}`);
        if (reverseToggleBtn) {
            reverseToggleBtn.textContent = sliceData.reverse ? 'Rev: ON' : 'Rev: OFF';
            reverseToggleBtn.classList.toggle('active', sliceData.reverse);
        }
    }
}

export function updateDrumPadControlsUI(track) {
    // Update the selected drum pad info display
    if (!track) return;
    
    const padInfoEl = document.getElementById(`selectedDrumPadInfo-${track.id}`);
    if (padInfoEl) {
        padInfoEl.textContent = (track.selectedDrumPadForEdit || 0) + 1;
    }
    
    // Update pad grid selection
    const container = document.getElementById(`drumPadsGridContainer-${track.id}`);
    if (container) {
        container.querySelectorAll('.drum-pad').forEach((pad, index) => {
            pad.classList.toggle('selected-for-edit', index === track.selectedDrumPadForEdit);
        });
    }
}