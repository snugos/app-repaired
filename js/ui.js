// js/ui.js - UI Module (v2025.02)
// Last updated: Fixed timeline clip context menu
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

// --- Sequencer Selection State ---
let sequencerSelectedCells = new Map(); // Map<trackId, Set<{row, col}>>

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
    const definitions = localAppServices.effectsRegistryAccess?.synthEngineControlDefinitions?.[engineType] || [];
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

// --- Specific Inspector Control Initializers ---
function buildSynthEngineControls(track, container, engineType) {
    const definitions = localAppServices.effectsRegistryAccess?.synthEngineControlDefinitions?.[engineType] || [];
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
        if (def.path.endsWith('.value') && track.instrument?.get) { // For Tone.Signal parameters
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
    const dzContainerEl = winEl.querySelector(`#dropZoneContainer-${track.id}-sampler`);
    if (dzContainerEl) {
        const existingAudioData = { originalFileName: track.samplerAudioData.fileName, status: track.samplerAudioData.status || (track.samplerAudioData.fileName ? 'missing' : 'empty') };
        dzContainerEl.innerHTML = createDropZoneHTML(track.id, `fileInput-${track.id}`, 'Sampler', null, existingAudioData);
        const dzEl = dzContainerEl.querySelector('.drop-zone');
        const fileInputEl = dzContainerEl.querySelector(`#fileInput-${track.id}`);
        if (dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'Sampler', null, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadSampleFile);
        if (fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadSampleFile(e, track.id, 'Sampler'); };
    }
    renderSamplePads(track);
    const canvas = winEl.querySelector(`#waveformCanvas-${track.id}`);
    if (canvas) {
        track.waveformCanvasCtx = canvas.getContext('2d');
        if(track.audioBuffer?.loaded) drawWaveform(track);
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

function initializeDrumSamplerSpecificControls(track, winEl) {
    renderDrumSamplerPads(track);
    updateDrumPadControlsUI(track);
    
    const createAndPlaceKnob = (placeholderId, options) => {
        const placeholder = winEl.querySelector(`#${placeholderId}`);
        if (placeholder) {
            const knob = createKnob(options);
            placeholder.innerHTML = ''; placeholder.appendChild(knob.element); return knob;
        }
        return null;
    };
    
    const pad = track.drumSamplerPads?.[track.selectedDrumPadForEdit] || {
        volume: 0.7, pitchShift: 0,
        envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
    };
    
    // Initialize knob controls
    track.inspectorControls.drumPadVolume = createAndPlaceKnob(`drumPadVolumeKnob-${track.id}-placeholder`, { 
        label: 'Vol', min: 0, max: 1, step: 0.01, initialValue: pad.volume, decimals: 2, 
        trackRef: track, onValueChange: (val) => track.setDrumSamplerPadVolume(track.selectedDrumPadForEdit, val) 
    });
    track.inspectorControls.drumPadPitch = createAndPlaceKnob(`drumPadPitchKnob-${track.id}-placeholder`, { 
        label: 'Pitch', min: -24, max: 24, step: 1, initialValue: pad.pitchShift, decimals: 0, displaySuffix: 'st', 
        trackRef: track, onValueChange: (val) => track.setDrumSamplerPadPitch(track.selectedDrumPadForEdit, val) 
    });
    track.inspectorControls.drumPadEnvAttack = createAndPlaceKnob(`drumPadEnvAttack-${track.id}-placeholder`, { 
        label: 'Attack', min: 0.001, max: 1, step: 0.001, initialValue: pad.envelope?.attack ?? 0.005, decimals: 3, 
        trackRef: track, onValueChange: (val) => track.setDrumSamplerPadEnv(track.selectedDrumPadForEdit, 'attack', val) 
    });
    track.inspectorControls.drumPadEnvDecay = createAndPlaceKnob(`drumPadEnvDecay-${track.id}-placeholder`, { 
        label: 'Decay', min: 0.01, max: 1, step: 0.01, initialValue: pad.envelope?.decay ?? 0.2, decimals: 2, 
        trackRef: track, onValueChange: (val) => track.setDrumSamplerPadEnv(track.selectedDrumPadForEdit, 'decay', val) 
    });
    track.inspectorControls.drumPadEnvSustain = createAndPlaceKnob(`drumPadEnvSustain-${track.id}-placeholder`, { 
        label: 'Sustain', min: 0, max: 1, step: 0.01, initialValue: pad.envelope?.sustain ?? 0, decimals: 2, 
        trackRef: track, onValueChange: (val) => track.setDrumSamplerPadEnv(track.selectedDrumPadForEdit, 'sustain', val) 
    });
    track.inspectorControls.drumPadEnvRelease = createAndPlaceKnob(`drumPadEnvRelease-${track.id}-placeholder`, { 
        label: 'Release', min: 0.01, max: 2, step: 0.01, initialValue: pad.envelope?.release ?? 0.1, decimals: 2, 
        trackRef: track, onValueChange: (val) => track.setDrumSamplerPadEnv(track.selectedDrumPadForEdit, 'release', val) 
    });
}

function initializeInstrumentSamplerSpecificControls(track, winEl) {
    const dzContainerEl = winEl.querySelector(`#dropZoneContainer-${track.id}-instrumentsampler`);
    if (dzContainerEl) {
        const existingAudioData = { originalFileName: track.instrumentSamplerSettings.originalFileName, status: track.instrumentSamplerSettings.status || (track.instrumentSamplerSettings.originalFileName ? 'missing' : 'empty') };
        dzContainerEl.innerHTML = createDropZoneHTML(track.id, `instrumentFileInput-${track.id}`, 'InstrumentSampler', null, existingAudioData);
        const dzEl = dzContainerEl.querySelector('.drop-zone');
        const fileInputEl = dzContainerEl.querySelector(`#instrumentFileInput-${track.id}`);
        if (dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'InstrumentSampler', null, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadSampleFile);
        if (fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadSampleFile(e, track.id, 'InstrumentSampler'); };
    }

    const canvas = winEl.querySelector(`#instrumentWaveformCanvas-${track.id}`);
    if (canvas) {
        track.instrumentWaveformCanvasCtx = canvas.getContext('2d');
        if(track.instrumentSamplerSettings.audioBuffer?.loaded) drawInstrumentWaveform(track);
    }

    const rootNoteSelect = winEl.querySelector(`#instrumentRootNote-${track.id}`);
    if (rootNoteSelect) {
        Constants.synthPitches.slice().reverse().forEach(pitch => {
            const option = document.createElement('option'); option.value = pitch; option.textContent = pitch; rootNoteSelect.appendChild(option);
        });
        rootNoteSelect.value = track.instrumentSamplerSettings.rootNote || 'C4';
        rootNoteSelect.addEventListener('change', (e) => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set Root Note for ${track.name} to ${e.target.value}`);
            track.setInstrumentSamplerRootNote(e.target.value);
        });
    }

    const loopToggleBtn = winEl.querySelector(`#instrumentLoopToggle-${track.id}`);
    if (loopToggleBtn) {
        loopToggleBtn.textContent = track.instrumentSamplerSettings.loop ? 'Loop: ON' : 'Loop: OFF';
        loopToggleBtn.classList.toggle('active', track.instrumentSamplerSettings.loop);
        loopToggleBtn.addEventListener('click', (e) => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle Loop for ${track.name}`);
            track.setInstrumentSamplerLoop(!track.instrumentSamplerSettings.loop);
            e.target.textContent = track.instrumentSamplerSettings.loop ? 'Loop: ON' : 'Loop: OFF';
            e.target.classList.toggle('active', track.instrumentSamplerSettings.loop);
        });
    }
    const loopStartInput = winEl.querySelector(`#instrumentLoopStart-${track.id}`);
    if (loopStartInput) {
        loopStartInput.value = track.instrumentSamplerSettings.loopStart?.toFixed(3) || '0.000';
        loopStartInput.addEventListener('change', (e) => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set Loop Start for ${track.name}`);
            track.setInstrumentSamplerLoopStart(parseFloat(e.target.value));
        });
    }
    const loopEndInput = winEl.querySelector(`#instrumentLoopEnd-${track.id}`);
    if (loopEndInput) {
        loopEndInput.value = track.instrumentSamplerSettings.loopEnd?.toFixed(3) || (track.instrumentSamplerSettings.audioBuffer?.duration.toFixed(3) || '0.000');
        loopEndInput.addEventListener('change', (e) => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set Loop End for ${track.name}`);
            track.setInstrumentSamplerLoopEnd(parseFloat(e.target.value));
        });
    }

    const createAndPlaceKnob = (placeholderId, options) => {
        const placeholder = winEl.querySelector(`#${placeholderId}`);
        if (placeholder) {
            const knob = createKnob(options);
            placeholder.innerHTML = ''; placeholder.appendChild(knob.element); return knob;
        }
        return null;
    };
    const env = track.instrumentSamplerSettings.envelope || { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 };
    track.inspectorControls.instrEnvAttack = createAndPlaceKnob(`instrumentEnvAttack-${track.id}-placeholder`, { label: 'Attack', min:0.001, max:2, step:0.001, initialValue: env.attack, decimals:3, trackRef: track, onValueChange: (val) => track.setInstrumentSamplerEnv('attack', val)});
    track.inspectorControls.instrEnvDecay = createAndPlaceKnob(`instrumentEnvDecay-${track.id}-placeholder`, { label: 'Decay', min:0.01, max:2, step:0.01, initialValue: env.decay, decimals:2, trackRef: track, onValueChange: (val) => track.setInstrumentSamplerEnv('decay', val)});
    track.inspectorControls.instrEnvSustain = createAndPlaceKnob(`instrumentEnvSustain-${track.id}-placeholder`, { label: 'Sustain', min:0, max:1, step:0.01, initialValue: env.sustain, decimals:2, trackRef: track, onValueChange: (val) => track.setInstrumentSamplerEnv('sustain', val)});
    track.inspectorControls.instrEnvRelease = createAndPlaceKnob(`instrumentEnvRelease-${track.id}-placeholder`, { label: 'Release', min:0.01, max:5, step:0.01, initialValue: env.release, decimals:2, trackRef: track, onValueChange: (val) => track.setInstrumentSamplerEnv('release', val)});

    const polyToggleBtnInst = winEl.querySelector(`#instrumentPolyphonyToggle-${track.id}`);
    if (polyToggleBtnInst) {
        polyToggleBtnInst.textContent = `Mode: ${track.instrumentSamplerIsPolyphonic ? 'Poly' : 'Mono'}`;
        polyToggleBtnInst.classList.toggle('active', track.instrumentSamplerIsPolyphonic);
        polyToggleBtnInst.addEventListener('click', () => {
            if(localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle Instrument Sampler Polyphony for ${track.name}`);
            track.instrumentSamplerIsPolyphonic = !track.instrumentSamplerIsPolyphonic;
            polyToggleBtnInst.textContent = `Mode: ${track.instrumentSamplerIsPolyphonic ? 'Poly' : 'Mono'}`;
            polyToggleBtnInst.classList.toggle('active', track.instrumentSamplerIsPolyphonic);
            showNotification(`${track.name} instrument sampler mode: ${track.instrumentSamplerIsPolyphonic ? 'Poly' : 'Mono'}`, 2000);
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

    const midiChannelValue = track.getMidiChannel ? track.getMidiChannel() : 0;
    const midiChannelDisplay = midiChannelValue === 0 ? 'Omni (All)' : `Ch ${midiChannelValue}`;

    return `
        <div class="track-inspector-content p-1 space-y-1 text-xs text-gray-700 dark:text-slate-300 overflow-y-auto h-full">
            <div class="common-controls grid ${track.type === 'Audio' ? 'grid-cols-4' : 'grid-cols-3'} gap-1 mb-1">
                <button id="muteBtn-${track.id}" title="Mute Track" class="px-1 py-0.5 border rounded dark:border-slate-500 dark:hover:bg-slate-600 ${track.isMuted ? 'muted' : ''}">${track.isMuted ? 'Unmute' : 'Mute'}</button>
                <button id="soloBtn-${track.id}" title="Solo Track" class="px-1 py-0.5 border rounded dark:border-slate-500 dark:hover:bg-slate-600 ${track.isSoloed ? 'soloed' : ''}">${track.isSoloed ? 'Unsolo' : 'Solo'}</button>
                ${monitorButtonHTML}
                <button id="armInputBtn-${track.id}" title="Arm for MIDI/Keyboard Input or Audio Recording" class="px-1 py-0.5 border rounded dark:border-slate-500 dark:hover:bg-slate-600 ${armedTrackId === track.id ? 'armed' : ''}">Arm</button>
            </div>
            <div id="midiChannelRow-${track.id}" class="flex items-center gap-1 mb-1">
                <label for="midiChannelSelect-${track.id}" class="text-xs dark:text-slate-400 whitespace-nowrap">MIDI Ch:</label>
                <select id="midiChannelSelect-${track.id}" class="flex-1 p-0.5 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 cursor-pointer">
                    <option value="0" ${midiChannelValue === 0 ? 'selected' : ''}>Omni (All)</option>
                    <option value="1" ${midiChannelValue === 1 ? 'selected' : ''}>Ch 1</option>
                    <option value="2" ${midiChannelValue === 2 ? 'selected' : ''}>Ch 2</option>
                    <option value="3" ${midiChannelValue === 3 ? 'selected' : ''}>Ch 3</option>
                    <option value="4" ${midiChannelValue === 4 ? 'selected' : ''}>Ch 4</option>
                    <option value="5" ${midiChannelValue === 5 ? 'selected' : ''}>Ch 5</option>
                    <option value="6" ${midiChannelValue === 6 ? 'selected' : ''}>Ch 6</option>
                    <option value="7" ${midiChannelValue === 7 ? 'selected' : ''}>Ch 7</option>
                    <option value="8" ${midiChannelValue === 8 ? 'selected' : ''}>Ch 8</option>
                    <option value="9" ${midiChannelValue === 9 ? 'selected' : ''}>Ch 9</option>
                    <option value="10" ${midiChannelValue === 10 ? 'selected' : ''}>Ch 10</option>
                    <option value="11" ${midiChannelValue === 11 ? 'selected' : ''}>Ch 11</option>
                    <option value="12" ${midiChannelValue === 12 ? 'selected' : ''}>Ch 12</option>
                    <option value="13" ${midiChannelValue === 13 ? 'selected' : ''}>Ch 13</option>
                    <option value="14" ${midiChannelValue === 14 ? 'selected' : ''}>Ch 14</option>
                    <option value="15" ${midiChannelValue === 15 ? 'selected' : ''}>Ch 15</option>
                    <option value="16" ${midiChannelValue === 16 ? 'selected' : ''}>Ch 16</option>
                </select>
            </div>
            <div id="volumeKnob-${track.id}-placeholder" class="mb-1"></div>
            <div id="trackMeterContainer-${track.id}" class="h-3 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden my-1">
                <div id="trackMeterBar-${track.id}" class="h-full bg-pink-400 transition-all duration-50 ease-linear" style="width: 0%;"></div>
            </div>
            <div class="type-specific-controls mt-1 border-t dark:border-slate-600 pt-1">${specificControlsHTML}</div>
            <div class="inspector-nav grid ${track.type === 'Audio' ? 'grid-cols-2' : 'grid-cols-3'} gap-1 mt-2">
                <button id="openAutomationBtn-${track.id}" class="px-1 py-0.5 border rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 dark:border-slate-500">Automation</button>
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
    if (savedState) {
        Object.assign(inspectorOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const inspectorWindow = localAppServices.createWindow(windowId, `Inspector: ${track.name}`, contentDOM, inspectorOptions);

    if (inspectorWindow?.element) {
        initializeCommonInspectorControls(track, inspectorWindow.element);
        initializeTypeSpecificInspectorControls(track, inspectorWindow.element);
    }
    return inspectorWindow;
}

function initializeCommonInspectorControls(track, winEl) {
    winEl.querySelector(`#muteBtn-${track.id}`)?.addEventListener('click', () => handleTrackMute(track.id));
    winEl.querySelector(`#soloBtn-${track.id}`)?.addEventListener('click', () => handleTrackSolo(track.id));
    winEl.querySelector(`#armInputBtn-${track.id}`)?.addEventListener('click', () => handleTrackArm(track.id));

    // MIDI Channel selector
    const midiChannelSelect = winEl.querySelector(`#midiChannelSelect-${track.id}`);
    if (midiChannelSelect && track.setMidiChannel) {
        midiChannelSelect.addEventListener('change', (e) => {
            const channel = parseInt(e.target.value, 10);
            track.setMidiChannel(channel, true);
            const display = channel === 0 ? 'Omni (All)' : `Ch ${channel}`;
            showNotification(`${track.name} MIDI channel: ${display}`, 1500);
        });
    }

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
    winEl.querySelector(`#openAutomationBtn-${track.id}`)?.addEventListener('click', () => {
        if (localAppServices.openTrackAutomationPanel) {
            localAppServices.openTrackAutomationPanel(track.id);
        }
    });
    winEl.querySelector(`#openSequencerBtn-${track.id}`)?.addEventListener('click', () => handleOpenSequencer(track.id));
    const volumeKnobPlaceholder = winEl.querySelector(`#volumeKnob-${track.id}-placeholder`);
    if (volumeKnobPlaceholder) {
        const volumeKnob = createKnob({ label: 'Volume', min: 0, max: 1.2, step: 0.01, initialValue: track.previousVolumeBeforeMute, decimals: 2, trackRef: track, onValueChange: (val, o, fromInteraction) => track.setVolume(val, fromInteraction) });
        volumeKnobPlaceholder.innerHTML = ''; volumeKnobPlaceholder.appendChild(volumeKnob.element); track.inspectorControls.volume = volumeKnob;
    }
}

function initializeTypeSpecificInspectorControls(track, winEl) {
    if (track.type === 'Synth') initializeSynthSpecificControls(track, winEl);
    else if (track.type === 'Sampler') initializeSamplerSpecificControls(track, winEl);
    else if (track.type === 'DrumSampler') initializeDrumSamplerSpecificControls(track, winEl);
    else if (track.type === 'InstrumentSampler') initializeInstrumentSamplerSpecificControls(track, winEl);
}

// --- Modular Effects Rack UI ---
function buildModularEffectsRackDOM(owner, ownerType = 'track') {
    const ownerId = (ownerType === 'track' && owner) ? owner.id : 'master';
    const ownerName = (ownerType === 'track' && owner) ? owner.name : 'Master Bus';
    let presetSectionHTML = '';
    const showPresets = (ownerType === 'track' && owner) || (ownerType === 'master');
    if (showPresets) {
        const presetId = ownerType === 'track' ? owner.id : 'master';
        presetSectionHTML = `
        <div class="mt-2 pt-2 border-t dark:border-slate-600">
            <h4 class="text-xs font-semibold dark:text-slate-200 mb-1">Effect Presets</h4>
            <div class="flex gap-1 mb-1">
                <button id="saveEffectPresetBtn-${presetId}" class="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700">Save Preset</button>
                <button id="loadEffectPresetBtn-${presetId}" class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700">Load Preset</button>
            </div>
            <div id="presetList-${presetId}" class="text-xs max-h-24 overflow-y-auto border rounded p-1 bg-gray-50 dark:bg-slate-700 dark:border-slate-600">
                <p class="text-gray-500 dark:text-slate-400 italic">No presets saved</p>
            </div>
        </div>`;
    }
    return `<div id="effectsRackContent-${ownerId}" class="p-2 space-y-2 overflow-y-auto h-full">
        <h3 class="text-sm font-semibold dark:text-slate-200">Effects Rack: ${ownerName}</h3>
        <div id="effectsList-${ownerId}" class="space-y-1 min-h-[50px] border rounded p-1 bg-gray-100 dark:bg-slate-700 dark:border-slate-600"></div>
        <button id="addEffectBtn-${ownerId}" class="text-xs px-2 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 dark:bg-purple-500 dark:hover:bg-purple-600">Add Effect</button>
        <div id="effectControlsContainer-${ownerId}" class="mt-2 space-y-2"></div>
        ${presetSectionHTML}
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

    const AVAILABLE_EFFECTS_LOCAL = localAppServices.effectsRegistryAccess?.AVAILABLE_EFFECTS || {};

    effectsArray.forEach((effect, index) => {
        const effectDef = AVAILABLE_EFFECTS_LOCAL[effect.type];
        const displayName = effectDef ? effectDef.displayName : effect.type;
        const item = document.createElement('div');
        item.className = 'effect-item flex justify-between items-center p-1 border-b bg-white dark:bg-slate-800 dark:border-slate-700 rounded-sm shadow-xs text-xs';
        item.innerHTML = `<span class="effect-name flex-grow cursor-pointer hover:text-purple-500 dark:text-slate-300 dark:hover:text-purple-300" title="Edit ${displayName}">${displayName}</span>
            <div class="effect-actions">
                <button class="up-btn text-xs px-0.5 ${index === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:text-pink-500 dark:hover:text-pink-300'} dark:text-slate-400" ${index === 0 ? 'disabled' : ''} title="Move Up">▲</button>
                <button class="down-btn text-xs px-0.5 ${index === effectsArray.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:text-pink-500 dark:hover:text-pink-300'} dark:text-slate-400" ${index === effectsArray.length - 1 ? 'disabled' : ''} title="Move Down">▼</button>
                <button class="bypass-btn text-xs px-0.5 ${(effect.params?.wet ?? 1) === 0 ? 'text-yellow-500 dark:text-yellow-400' : 'text-green-500 dark:text-green-400'}" title="${(effect.params?.wet ?? 1) === 0 ? 'Effect Bypassed (click to enable)' : 'Effect Active (click to bypass)'}">⏸</button>
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
        item.querySelector('.bypass-btn').addEventListener('click', () => {
            if (ownerType === 'track') {
                if (owner.toggleEffectBypass) owner.toggleEffectBypass(effect.id);
            } else if (localAppServices.toggleMasterEffectBypass) {
                localAppServices.toggleMasterEffectBypass(effect.id);
            }
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

    const AVAILABLE_EFFECTS_LOCAL = localAppServices.effectsRegistryAccess?.AVAILABLE_EFFECTS || {};
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
            let currentValObj = effectWrapper.params;
            for (const key of pathKeys) {
                if (currentValObj && typeof currentValObj === 'object' && key in currentValObj) {
                    currentValObj = currentValObj[key];
                } else { currentValObj = undefined; break; }
            }
            initialValue = (currentValObj !== undefined) ? currentValObj : paramDef.defaultValue;

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
    const AVAILABLE_EFFECTS_LOCAL = localAppServices.effectsRegistryAccess?.AVAILABLE_EFFECTS || {};
    
    // DEBUG: Log what we're getting
    console.log('[showAddEffectModal] effectsRegistryAccess:', localAppServices.effectsRegistryAccess);
    console.log('[showAddEffectModal] AVAILABLE_EFFECTS_LOCAL keys:', Object.keys(AVAILABLE_EFFECTS_LOCAL));
    console.log('[showAddEffectModal] AVAILABLE_EFFECTS_LOCAL length:', Object.keys(AVAILABLE_EFFECTS_LOCAL).length);
    
    for (const effectKey in AVAILABLE_EFFECTS_LOCAL) { modalContentHTML += `<li class="p-1.5 hover:bg-purple-200 dark:hover:bg-purple-600 cursor-pointer border-b dark:border-slate-600 text-sm dark:text-slate-200" data-effect-type="${effectKey}">${AVAILABLE_EFFECTS_LOCAL[effectKey].displayName}</li>`; }
    modalContentHTML += `</ul></div>`;
    const modal = showCustomModal(`Add Effect to ${ownerName}`, modalContentHTML, [], 'add-effect-modal');
    if (modal?.contentDiv) {
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
    const rackOptions = { width: 350, height: 450, minWidth: 300, minHeight: 300, initialContentKey: windowId };
    if (savedState) Object.assign(rackOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const rackWindow = localAppServices.createWindow(windowId, `Effects: ${track.name}`, contentDOM, rackOptions);
    if (rackWindow?.element) {
        renderEffectsList(track, 'track', rackWindow.element.querySelector(`#effectsList-${track.id}`), rackWindow.element.querySelector(`#effectControlsContainer-${track.id}`));
        rackWindow.element.querySelector(`#addEffectBtn-${track.id}`)?.addEventListener('click', () => showAddEffectModal(track, 'track'));
        
        // Effects preset buttons
        const savePresetBtn = rackWindow.element.querySelector(`#saveEffectPresetBtn-${track.id}`);
        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', () => {
                const presetName = prompt('Enter a name for this effect preset:');
                if (presetName && presetName.trim()) {
                    if (typeof track.saveEffectPreset === 'function') {
                        track.saveEffectPreset(presetName.trim());
                        updateEffectsPresetList(track, rackWindow.element);
                    }
                }
            });
        }
        
        const loadPresetBtn = rackWindow.element.querySelector(`#loadEffectPresetBtn-${track.id}`);
        if (loadPresetBtn) {
            loadPresetBtn.addEventListener('click', () => {
                const presets = typeof track.getAvailableEffectPresets === 'function' ? track.getAvailableEffectPresets() : [];
                if (presets.length === 0) {
                    showNotification('No presets saved for this track.', 2000);
                    return;
                }
                const presetOptions = presets.map(p => p.name).join('\n');
                const selectedPreset = prompt(`Available presets:\n${presetOptions}\n\nEnter preset name to load:`);
                if (selectedPreset && selectedPreset.trim()) {
                    if (typeof track.loadEffectPreset === 'function') {
                        const success = track.loadEffectPreset(selectedPreset.trim());
                        if (success) {
                            updateEffectsPresetList(track, winEl);
                            renderEffectsList(track, 'track', rackWindow.element.querySelector(`#effectsList-${track.id}`), rackWindow.element.querySelector(`#effectControlsContainer-${track.id}`));
                        }
                    }
                }
            });
        }
        
        // Initialize preset list
        updateEffectsPresetList(track, rackWindow.element);
    }
    return rackWindow;
}

function updateEffectsPresetList(track, winEl) {
    const presetListEl = winEl.querySelector(`#presetList-${track.id}`);
    if (!presetListEl) return;
    
    const presets = typeof track.getAvailableEffectPresets === 'function' ? track.getAvailableEffectPresets() : [];
    
    if (presets.length === 0) {
        presetListEl.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">No presets saved</p>';
        return;
    }
    
    let html = '<div class="space-y-1">';
    presets.forEach(preset => {
        const date = new Date(preset.createdAt);
        const dateStr = date.toLocaleDateString();
        html += `<div class="flex justify-between items-center p-1 bg-gray-50 dark:bg-slate-600 rounded text-xs">
            <span class="flex-grow">${preset.name} (${preset.effectsCount} fx)</span>
            <span class="text-gray-400 dark:text-slate-400 mr-1">${dateStr}</span>
            <button class="delete-preset-btn text-red-500 hover:text-red-700 dark:text-red-400" data-preset-name="${preset.name}" title="Delete preset">×</button>
        </div>`;
    });
    html += '</div>';
    
    presetListEl.innerHTML = html;
    
    presetListEl.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const presetName = btn.dataset.presetName;
            if (presetName && confirm(`Delete preset "${presetName}"?`)) {
                if (typeof track.deleteEffectPreset === 'function') {
                    track.deleteEffectPreset(presetName);
                    updateEffectsPresetList(track, winEl);
                }
            }
        });
    });
}

export function openMasterEffectsRackWindow(savedState = null) {
    const windowId = 'masterEffectsRack';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) { openWindows.get(windowId).restore(); return openWindows.get(windowId); }

    const contentDOM = buildModularEffectsRackDOM(null, 'master');
    const rackOptions = { width: 350, height: 400, minWidth: 300, minHeight: 250, initialContentKey: windowId };
    if (savedState) Object.assign(rackOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const rackWindow = localAppServices.createWindow(windowId, 'Master Effects Rack', contentDOM, rackOptions);
    if (rackWindow?.element) {
        renderEffectsList(null, 'master', rackWindow.element.querySelector('#effectsList-master'), rackWindow.element.querySelector('#effectControlsContainer-master'));
        rackWindow.element.querySelector('#addEffectBtn-master')?.addEventListener('click', () => showAddEffectModal(null, 'master'));

        // Master effects preset buttons
        const savePresetBtn = rackWindow.element.querySelector('#saveEffectPresetBtn-master');
        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', () => {
                const presetName = prompt('Enter a name for this master effect preset:');
                if (presetName && presetName.trim()) {
                    if (localAppServices.saveMasterEffectPreset) {
                        localAppServices.saveMasterEffectPreset(presetName.trim());
                        showNotification(`Preset "${presetName.trim()}" saved.`, 2000);
                    }
                }
            });
        }

        const loadPresetBtn = rackWindow.element.querySelector('#loadEffectPresetBtn-master');
        if (loadPresetBtn) {
            loadPresetBtn.addEventListener('click', () => {
                if (localAppServices.getAvailableMasterEffectPresets) {
                    const presets = localAppServices.getAvailableMasterEffectPresets();
                    if (presets.length === 0) {
                        showNotification('No master presets saved.', 2000);
                        return;
                    }
                    const presetOptions = presets.map(p => p.name).join('\n');
                    const selectedPreset = prompt(`Available master presets:\n${presetOptions}\n\nEnter preset name to load:`);
                    if (selectedPreset && selectedPreset.trim()) {
                        if (localAppServices.loadMasterEffectPreset) {
                            const success = localAppServices.loadMasterEffectPreset(selectedPreset.trim());
                            if (success) {
                                showNotification(`Preset "${selectedPreset.trim()}" loaded.`, 2000);
                                renderEffectsList(null, 'master', rackWindow.element.querySelector('#effectsList-master'), rackWindow.element.querySelector('#effectControlsContainer-master'));
                            }
                        }
                    }
                }
            });
        }
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
        <div> <label for="tempoGlobalInput" class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">Tempo (BPM):</label> <input type="number" id="tempoGlobalInput" value="120" min="30" max="300" step="0.1" class="w-full p-1.5 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-purple-600 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> <button id="tapBtnGlobal" title="Tap Tempo" class="mt-1 w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-1 px-2 rounded shadow transition-colors duration-150 dark:bg-teal-600 dark:hover:bg-teal-700 text-xs">Tap Tempo</button> </div>
        <div> <label for="midiInputSelectGlobal" class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">MIDI Input:</label> <select id="midiInputSelectGlobal" class="w-full p-1.5 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-purple-600 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> <option value="">No MIDI Input</option> </select> </div>
        <div class="pt-1"> <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">Master Level:</label> <div id="masterMeterContainerGlobal" class="h-5 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden shadow-sm"> <div id="masterMeterBarGlobal" class="h-full bg-purple-400 transition-all duration-50 ease-linear" style="width: 0%;"></div> </div> </div>
        <div class="flex justify-between items-center text-xs mt-1.5"> <span id="midiIndicatorGlobal" title="MIDI Activity" class="px-2 py-1 rounded-full bg-gray-300 text-gray-600 font-medium transition-colors duration-150 dark:bg-slate-600 dark:text-slate-300">MIDI</span> <span id="keyboardIndicatorGlobal" title="Computer Keyboard Activity" class="px-2 py-1 rounded-full bg-gray-300 text-gray-600 font-medium transition-colors duration-150 dark:bg-slate-600 dark:text-slate-300">KBD</span> </div>
        <div id="ccVisualizerContainer" class="mt-2 flex flex-wrap gap-1 items-center" title="MIDI CC Values"></div>
        <div class="mt-2 flex gap-2"> <button id="playbackModeToggleBtnGlobal" title="Toggle Playback Mode (Sequencer/Timeline)" class="flex-1 bg-violet-400 hover:bg-violet-500 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-violet-500 dark:hover:bg-violet-600">Mode: Sequencer</button> <button id="metronomeBtnGlobal" title="Toggle Metronome" class="bg-slate-400 hover:bg-slate-500 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-slate-500 dark:hover:bg-slate-600">🔲 Metronome</button> </div>
        <div class="mt-2 flex gap-2 items-center"> <label class="text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">Scale:</label> <select id="scaleSelectGlobal" class="flex-1 p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> <option value="major">Major</option> <option value="minor">Natural Minor</option> <option value="harmonic_minor">Harmonic Minor</option> <option value="melodic_minor">Melodic Minor</option> <option value="dorian">Dorian</option> <option value="phrygian">Phrygian</option> <option value="lydian">Lydian</option> <option value="mixolydian">Mixolydian</option> <option value="locrian">Locrian</option> <option value="pentatonic_major">Major Pentatonic</option> <option value="pentatonic_minor">Minor Pentatonic</option> <option value="blues">Blues</option> <option value="chromatic">Chromatic</option> <option value="whole_tone">Whole Tone</option> <option value="dorian_b9">Dorian b9</option> <option value="lydian_dom">Lydian Dominant</option> </select> <label class="text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">Key:</label> <select id="keySelectGlobal" class="p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 w-16"> <option value="C">C</option> <option value="C#">C#</option> <option value="D">D</option> <option value="D#">D#</option> <option value="E">E</option> <option value="F">F</option> <option value="F#">F#</option> <option value="G">G</option> <option value="G#">G#</option> <option value="A">A</option> <option value="A#">A#</option> <option value="B">B</option> </select> </div>
        <div id="scaleNotesDisplay" class="mt-1 text-xs text-center text-gray-500 dark:text-slate-400 font-mono"></div>
    </div>`;
    const options = { width: 280, height: 420, minWidth: 250, minHeight: 380, closable: true, minimizable: true, resizable: true, initialContentKey: windowId }; // Adjusted height slightly
    if (savedState) Object.assign(options, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const newWindow = localAppServices.createWindow(windowId, 'Global Controls', contentHTML, options);
    if (newWindow?.element && typeof onReadyCallback === 'function') {
        onReadyCallback({
            playBtnGlobal: newWindow.element.querySelector('#playBtnGlobal'),
            recordBtnGlobal: newWindow.element.querySelector('#recordBtnGlobal'),
            stopBtnGlobal: newWindow.element.querySelector('#stopBtnGlobal'), // MODIFICATION: Include stop button
            tempoGlobalInput: newWindow.element.querySelector('#tempoGlobalInput'),
            tapBtnGlobal: newWindow.element.querySelector('#tapBtnGlobal'), // Tap Tempo button
            midiInputSelectGlobal: newWindow.element.querySelector('#midiInputSelectGlobal'),
            masterMeterContainerGlobal: newWindow.element.querySelector('#masterMeterContainerGlobal'),
            masterMeterBarGlobal: newWindow.element.querySelector('#masterMeterBarGlobal'),
            midiIndicatorGlobal: newWindow.element.querySelector('#midiIndicatorGlobal'),
            keyboardIndicatorGlobal: newWindow.element.querySelector('#keyboardIndicatorGlobal'),
            playbackModeToggleBtnGlobal: newWindow.element.querySelector('#playbackModeToggleBtnGlobal'),
            scaleSelectGlobal: newWindow.element.querySelector('#scaleSelectGlobal'),
            keySelectGlobal: newWindow.element.querySelector('#keySelectGlobal'),
            scaleNotesDisplay: newWindow.element.querySelector('#scaleNotesDisplay')
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

    const contentHTML = `<div id="soundBrowserContent" class="p-2 space-y-2 text-xs overflow-y-auto h-full dark:text-slate-300">
        <div class="flex space-x-1 mb-1">
            <select id="librarySelect" class="flex-grow p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                <option value="">Select Library...</option>
            </select>
            <button id="upDirectoryBtn" class="px-2 py-1 border rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 dark:border-slate-500" title="Up Directory">↑</button>
        </div>
        <div class="flex items-center mb-1">
            <input type="text" id="soundBrowserSearch" placeholder="Search sounds..." class="flex-1 p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
        </div>
        <div id="currentPathDisplay" class="text-xs text-gray-600 dark:text-slate-400 truncate mb-1">/</div>
        <div id="soundBrowserList" class="min-h-[100px] border rounded p-1 bg-gray-100 dark:bg-slate-700 dark:border-slate-600 overflow-y-auto" style="max-height: 200px;">
            <p class="text-gray-500 dark:text-slate-400 italic">Select a library to browse sounds.</p>
        </div>
        
        <!-- Waveform Preview Section -->
        <div id="waveformPreviewSection" class="mt-2 border rounded dark:border-slate-600 bg-slate-900 p-1">
            <div class="flex justify-between items-center mb-1">
                <span class="text-gray-400 text-[10px]">WAVEFORM PREVIEW</span>
                <span id="previewFileName" class="text-gray-500 text-[10px] truncate max-w-[150px]"></span>
            </div>
            <canvas id="waveformCanvas" class="w-full rounded" width="340" height="60" style="background: #1e293b;"></canvas>
        </div>
        
        <!-- Preview Controls with Volume -->
        <div id="soundPreviewControls" class="mt-1 flex items-center justify-between">
            <button id="previewSoundBtn" class="px-3 py-1 text-xs border rounded bg-purple-400 text-white hover:bg-purple-500 disabled:opacity-50 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-slate-500" disabled>▶ Preview</button>
            <div class="flex items-center space-x-1">
                <span class="text-[10px] text-gray-500">Vol:</span>
                <input type="range" id="previewVolumeSlider" min="0" max="100" value="80" class="w-16 h-1 accent-purple-500">
                <span id="previewVolumeValue" class="text-[10px] text-gray-400 w-6">80%</span>
            </div>
        </div>
    </div>`;
    const browserOptions = { width: 400, height: 520, minWidth: 350, minHeight: 400, initialContentKey: windowId };
    if (savedState) Object.assign(browserOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });

    const browserWindow = localAppServices.createWindow(windowId, 'Sound Browser', contentHTML, browserOptions);

    if (browserWindow?.element) {
        const libSelect = browserWindow.element.querySelector('#librarySelect');
        if (Constants.soundLibraries) {
            Object.keys(Constants.soundLibraries).forEach(libName => {
                const opt = document.createElement('option');
                opt.value = libName;
                opt.textContent = libName;
                libSelect.appendChild(opt);
            });
        }

        libSelect.addEventListener('change', (e) => {
            const lib = e.target.value;
            console.log(`[UI SoundBrowser] Library selected via dropdown: ${lib}`);
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

        // Sound browser search filter
        const searchInput = browserWindow.element.querySelector('#soundBrowserSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const listDiv = browserWindow.element.querySelector('#soundBrowserList');
                if (!listDiv) return;
                const items = listDiv.querySelectorAll('[data-file-name]');
                items.forEach(item => {
                    const name = (item.dataset.fileName || item.textContent || '').toLowerCase();
                    item.style.display = name.includes(query) ? '' : 'none';
                });
            });
        }

        browserWindow.element.querySelector('#previewSoundBtn').addEventListener('click', () => {
            const selectedSound = localAppServices.getSelectedSoundForPreview ? localAppServices.getSelectedSoundForPreview() : null;
            console.log('[UI PreviewButton] Clicked. Selected Sound:', JSON.stringify(selectedSound));

            if (selectedSound && typeof Tone !== 'undefined') {
                let previewPlayer = localAppServices.getPreviewPlayer ? localAppServices.getPreviewPlayer() : null;
                if (previewPlayer && !previewPlayer.disposed) {
                    console.log('[UI PreviewButton] Stopping existing preview player.');
                    previewPlayer.stop();
                    if (localAppServices.stopWaveformPlayheadAnimation) localAppServices.stopWaveformPlayheadAnimation();
                }
                const { fullPath, libraryName } = selectedSound;
                console.log(`[UI PreviewButton] Attempting to preview: ${fullPath} from ${libraryName}`);

                const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
                if (loadedZips?.[libraryName] && loadedZips[libraryName] !== "loading") {
                    const zipEntry = loadedZips[libraryName].file(fullPath);
                    if (zipEntry) {
                        console.log(`[UI PreviewButton] Found zipEntry for ${fullPath}. Converting to blob.`);
                        zipEntry.async("blob").then(async (blob) => {
                            console.log(`[UI PreviewButton] Blob created for ${fullPath}, size: ${blob.size}. Creating Object URL.`);
                            
                            // Get volume from slider
                            const volumeSlider = browserWindow.element.querySelector('#previewVolumeSlider');
                            const volumeValue = volumeSlider ? parseInt(volumeSlider.value) / 100 : 0.8;
                            
                            const url = URL.createObjectURL(blob);
                            console.log(`[UI PreviewButton] Object URL: ${url}. Creating Tone.Player.`);
                            
                            previewPlayer = new Tone.Player(url, () => {
                                console.log(`[UI PreviewButton] Tone.Player loaded for ${url}. Starting playback.`);
                                previewPlayer.volume.value = Tone.gainToDb(volumeValue);
                                previewPlayer.start();
                                
                                // Start playhead animation if we have waveform data
                                if (localAppServices.startWaveformPlayheadAnimation && localAppServices.getWaveformPreviewBuffer) {
                                    const buffer = localAppServices.getWaveformPreviewBuffer();
                                    if (buffer) {
                                        localAppServices.startWaveformPlayheadAnimation(previewPlayer, buffer.duration);
                                    }
                                }
                                
                                URL.revokeObjectURL(url);
                                console.log(`[UI PreviewButton] Object URL revoked for ${url}.`);
                            }).toDestination();
                            
                            previewPlayer.onerror = (err) => {
                                console.error(`[UI PreviewButton] Tone.Player error for ${url}:`, err);
                                showNotification("Error playing preview: " + err.message, 3000);
                                URL.revokeObjectURL(url);
                                if (localAppServices.stopWaveformPlayheadAnimation) localAppServices.stopWaveformPlayheadAnimation();
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
        
        // Volume slider event listener
        const volumeSlider = browserWindow.element.querySelector('#previewVolumeSlider');
        const volumeValueDisplay = browserWindow.element.querySelector('#previewVolumeValue');
        if (volumeSlider && volumeValueDisplay) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseInt(e.target.value);
                volumeValueDisplay.textContent = `${volume}%`;
                
                // Update preview player volume if playing
                const previewPlayer = localAppServices.getPreviewPlayer ? localAppServices.getPreviewPlayer() : null;
                if (previewPlayer && !previewPlayer.disposed && previewPlayer.state === 'started') {
                    previewPlayer.volume.value = Tone.gainToDb(volume / 100);
                }
            });
        }

        if (!savedState) {
            const currentLibNameFromState = localAppServices.getCurrentLibraryName ? localAppServices.getCurrentLibraryName() : null;
            const soundTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};

            console.log(`[UI SoundBrowser Open DEBUG] Initial Global State Check. currentLibNameFromState: ${currentLibNameFromState}. soundTrees keys: ${soundTrees ? Object.keys(soundTrees) : 'undefined'}. soundTrees[Drums] exists: ${soundTrees ? !!soundTrees["Drums"] : 'false'}`);
            console.log(`[UI SoundBrowser Open] Initial check. Current lib in state: ${currentLibNameFromState}, Dropdown value: ${libSelect?.value}`);

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
    const isWindowVisible = !browserWindowEl.closest('.window.minimized');
    const currentDropdownSelection = libSelect ? libSelect.value : null;

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
        console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] About to check trees. Library: ${libraryName}`);
        const currentTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};
        console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] Current trees from getSoundLibraryFileTrees. Keys:`, currentTrees ? Object.keys(currentTrees) : 'undefined');

        if (currentTrees && currentTrees[libraryName]) {
            const treeForLib = currentTrees[libraryName];
            console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] Found tree for "${libraryName}". Keys:`, treeForLib ? Object.keys(treeForLib) : 'Tree is null/undefined');
            if (treeForLib && Object.keys(treeForLib).length > 0) {
                 console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] Tree for "${libraryName}" is NOT empty.`);
                 if (localAppServices.setCurrentSoundFileTree) localAppServices.setCurrentSoundFileTree(treeForLib);
                 if (localAppServices.renderSoundBrowserDirectory) localAppServices.renderSoundBrowserDirectory([], localAppServices.getCurrentSoundFileTree());
                 console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering directory for library '${libraryName}'.`);
            } else {
                console.warn(`[UI updateSoundBrowserDisplayForLibrary WARN] Tree for "${libraryName}" was found but considered empty or invalid. Tree:`, treeForLib);
                listDiv.innerHTML = `<p class="text-red-500">Error: Library "${libraryName}" data is empty or corrupt.</p>`;
            }
        } else {
            listDiv.innerHTML = `<p class="text-red-500">Error: Library "${libraryName}" data not found after attempting load.</p>`;
            console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering "Error: Library '${libraryName}' data not found." view. (Checked currentTrees['${libraryName}'])`);
        }
    } else if ((isLoading || hasError) && libraryName !== currentDropdownSelection) {
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Decision: NO CHANGE to visible UI. Loading/Error for non-selected library '${libraryName}'. Current view: '${currentDropdownSelection}'.`);
        return;
    }


    if (performFullUIUpdate) {
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Proceeding with UI update for '${libraryName}'.`);
        if (localAppServices.setCurrentLibraryName) localAppServices.setCurrentLibraryName(libraryName);
        if (localAppServices.setCurrentSoundBrowserPath) localAppServices.setCurrentSoundBrowserPath([]);
        if (libSelect && libSelect.value !== (libraryName || "")) {
            console.log(`[UI updateSoundBrowserDisplayForLibrary] Setting libSelect.value to: '${libraryName || ""}' (was '${currentDropdownSelection}')`);
            libSelect.value = libraryName || "";
        }
    } else {
        if (!libraryName) {
             performFullUIUpdate = true;
             console.log(`[UI updateSoundBrowserDisplayForLibrary] Condition: Explicitly setting to "Select a library" view.`);
             if (localAppServices.setCurrentLibraryName) localAppServices.setCurrentLibraryName(null);
             if (libSelect) libSelect.value = "";
        } else {
            console.error(`[UI updateSoundBrowserDisplayForLibrary] LOGIC ERROR: Reached unexpected state for '${libraryName}'. No UI update performed when one might have been expected.`);
            return;
        }
    }

    if (!libraryName) {
        listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">Select a library.</p>';
        pathDisplay.textContent = '/';
        if (localAppServices.setCurrentSoundFileTree) localAppServices.setCurrentSoundFileTree(null);
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering "Select a library" view.`);
        return;
    }

    if (isLoading || (localAppServices.getLoadedZipFiles && localAppServices.getLoadedZipFiles()[libraryName] === "loading")) {
        listDiv.innerHTML = `<p class="text-gray-500 dark:text-slate-400 italic">Loading ${libraryName}...</p>`;
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering "Loading ${libraryName}..." view.`);
    } else if (hasError) {
        listDiv.innerHTML = `<p class="text-red-500">Error: Library "${libraryName}" failed.</p>`;
        console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering "Error: Library '${libraryName}' failed." view.`);
    } else {
        console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] About to check trees. Library: ${libraryName}`);
        const currentTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};
        console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] Current trees from getSoundLibraryFileTrees. Keys:`, currentTrees ? Object.keys(currentTrees) : 'undefined');

        if (currentTrees && currentTrees[libraryName]) {
            const treeForLib = currentTrees[libraryName];
            console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] Found tree for "${libraryName}". Keys:`, treeForLib ? Object.keys(treeForLib) : 'Tree is null/undefined');
            if (treeForLib && Object.keys(treeForLib).length > 0) {
                 console.log(`[UI updateSoundBrowserDisplayForLibrary DEBUG] Tree for "${libraryName}" is NOT empty.`);
                 if (localAppServices.setCurrentSoundFileTree) localAppServices.setCurrentSoundFileTree(treeForLib);
                 if (localAppServices.renderSoundBrowserDirectory) localAppServices.renderSoundBrowserDirectory([], localAppServices.getCurrentSoundFileTree());
                 console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering directory for library '${libraryName}'.`);
            } else {
                console.warn(`[UI updateSoundBrowserDisplayForLibrary WARN] Tree for "${libraryName}" was found but considered empty or invalid. Tree:`, treeForLib);
                listDiv.innerHTML = `<p class="text-red-500">Error: Library "${libraryName}" data is empty or corrupt.</p>`;
            }
        } else {
            listDiv.innerHTML = `<p class="text-red-500">Error: Library "${libraryName}" data not found after attempting load.</p>`;
            console.log(`[UI updateSoundBrowserDisplayForLibrary] Rendering "Error: Library '${libraryName}' data not found." view. (Checked currentTrees['${libraryName}'])`);
        }
    }
    pathDisplay.textContent = `/${libraryName || ''}/`;
}


export function renderSoundBrowserDirectory(pathArray, treeNode) {
    const browserWindowEl = localAppServices.getWindowById ? localAppServices.getWindowById('soundBrowser')?.element : null;
    if (!browserWindowEl || !treeNode) return;
    const listDiv = browserWindowEl.querySelector('#soundBrowserList');
    const pathDisplay = browserWindowEl.querySelector('#currentPathDisplay');
    const previewBtn = browserWindowEl.querySelector('#previewSoundBtn');
    listDiv.innerHTML = '';
    const currentLibName = localAppServices.getCurrentLibraryName ? localAppServices.getCurrentLibraryName() : '';
    pathDisplay.textContent = `/${currentLibName}${pathArray.length > 0 ? '/' : ''}${pathArray.join('/')}`;

    if (localAppServices.setSelectedSoundForPreview) {
        localAppServices.setSelectedSoundForPreview(null);
    }
    if(previewBtn) previewBtn.disabled = true;

    const items = [];
    for (const name in treeNode) { if (treeNode[name]?.type) items.push({ name, type: treeNode[name].type, nodeData: treeNode[name] }); }
    items.sort((a, b) => { if (a.type === 'folder' && b.type !== 'folder') return -1; if (a.type !== 'folder' && b.type === 'folder') return 1; return a.name.localeCompare(b.name); });
    if (items.length === 0) { listDiv.innerHTML = '<p class="text-gray-500 dark:text-slate-400 italic">Empty folder.</p>'; return; }

    items.forEach(itemObj => {
        const {name, nodeData} = itemObj; const listItem = document.createElement('div');
        listItem.className = 'p-1 hover:bg-purple-200 dark:hover:bg-purple-600 cursor-pointer border-b dark:border-slate-600 text-xs flex items-center';
        listItem.draggable = nodeData.type === 'file';
        listItem.dataset.fileName = name; // For search filter
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
            listItem.addEventListener('click', async () => {
                listDiv.querySelectorAll('.bg-blue-200,.dark\\:bg-purple-500').forEach(el => el.classList.remove('bg-blue-200', 'dark:bg-purple-500'));
                listItem.classList.add('bg-blue-200', 'dark:bg-purple-500');
                const soundToSelect = { fileName: name, fullPath: nodeData.fullPath, libraryName: currentLibName };
                console.log('[UI SoundFile Click] Sound selected:', JSON.stringify(soundToSelect));
                if (localAppServices.setSelectedSoundForPreview) {
                    localAppServices.setSelectedSoundForPreview(soundToSelect);
                    const checkSelected = localAppServices.getSelectedSoundForPreview ? localAppServices.getSelectedSoundForPreview() : { error: 'getSelectedSoundForPreview service not found' };
                    console.log('[UI SoundFile Click] State after setSelectedSoundForPreview (via getter):', JSON.stringify(checkSelected));
                } else {
                    console.warn('[UI SoundFile Click] setSelectedSoundForPreview service not available.');
                }
                if(previewBtn) previewBtn.disabled = false;
                
                // Update filename display
                const fileNameDisplay = browserWindowEl.querySelector('#previewFileName');
                if (fileNameDisplay) fileNameDisplay.textContent = name;
                
                // Load and display waveform
                const waveformCanvas = browserWindowEl.querySelector('#waveformCanvas');
                if (waveformCanvas && localAppServices.decodeAudioBlob && localAppServices.setWaveformPreviewCanvas && localAppServices.setWaveformPreviewBuffer) {
                    const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
                    if (loadedZips?.[currentLibName] && loadedZips[currentLibName] !== "loading") {
                        const zipEntry = loadedZips[currentLibName].file(nodeData.fullPath);
                        if (zipEntry) {
                            try {
                                const blob = await zipEntry.async("blob");
                                const audioBuffer = await localAppServices.decodeAudioBlob(blob);
                                if (audioBuffer) {
                                    localAppServices.setWaveformPreviewCanvas(waveformCanvas);
                                    localAppServices.setWaveformPreviewBuffer(audioBuffer);
                                } else {
                                    // Clear waveform on error
                                    localAppServices.setWaveformPreviewCanvas(waveformCanvas);
                                    localAppServices.setWaveformPreviewBuffer(null);
                                }
                            } catch (err) {
                                console.error('[UI SoundFile Click] Error loading waveform:', err);
                            }
                        }
                    }
                }
            });
            listItem.addEventListener('dragstart', (e) => { e.dataTransfer.setData("application/json", JSON.stringify({ fileName: name, fullPath: nodeData.fullPath, libraryName: currentLibName, type: 'sound-browser-item' })); e.dataTransfer.effectAllowed = "copy"; });
        }
        listDiv.appendChild(listItem);
    });
}

// --- Mixer Window ---
export function openMixerWindow(savedState = null) {
    const windowId = 'mixer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) { openWindows.get(windowId).restore(); return openWindows.get(windowId); }

    const contentContainer = document.createElement('div'); contentContainer.id = 'mixerContentContainer';
    contentContainer.className = 'p-2 overflow-x-auto whitespace-nowrap h-full bg-gray-100 dark:bg-slate-800';
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const mixerOptions = { width: Math.min(800, (desktopEl?.offsetWidth || 800) - 40), height: 300, minWidth: 300, minHeight: 200, initialContentKey: windowId };
    if (savedState) Object.assign(mixerOptions, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    const mixerWindow = localAppServices.createWindow(windowId, 'Mixer', contentContainer, mixerOptions);
    if (mixerWindow?.element) updateMixerWindow();
    return mixerWindow;
}

export function updateMixerWindow() {
    const mixerWindow = localAppServices.getWindowById ? localAppServices.getWindowById('mixer') : null;
    if (!mixerWindow?.element || mixerWindow.isMinimized) return;
    const container = mixerWindow.element.querySelector('#mixerContentContainer');
    if (container) renderMixer(container);
}

export function renderMixer(container) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    container.innerHTML = '';
    
    // Get send buses info
    const sendBuses = localAppServices.getSendBusesInfo ? localAppServices.getSendBusesInfo() : [
        { id: 'reverb', name: 'Reverb', hasEffect: true },
        { id: 'delay', name: 'Delay', hasEffect: true }
    ];
    
    // Master track strip
    const masterTrackDiv = document.createElement('div');
    masterTrackDiv.className = 'mixer-track master-track inline-block align-top p-1.5 border rounded bg-gray-200 dark:bg-slate-700 dark:border-slate-600 shadow w-24 mr-2 text-xs';
    masterTrackDiv.innerHTML = `<div class="track-name font-semibold truncate mb-1 dark:text-slate-200" title="Master">Master</div> <div id="masterVolumeKnob-mixer-placeholder" class="h-16 mx-auto mb-1"></div> <div id="mixerMasterMeterContainer" class="h-3 w-full bg-gray-300 dark:bg-slate-600 rounded border border-gray-400 dark:border-slate-500 overflow-hidden mt-1"> <div id="mixerMasterMeterBar" class="h-full bg-purple-400 transition-all duration-50 ease-linear" style="width: 0%;"></div> </div>`;
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

    // Track strips with drag-and-drop reordering
    let draggedTrackId = null;
    tracks.forEach((track, trackIndex) => {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'mixer-track inline-block align-top p-1.5 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 shadow w-28 mr-2 text-xs cursor-move';
        trackDiv.draggable = true;
        trackDiv.dataset.trackId = track.id;
        trackDiv.dataset.trackIndex = trackIndex;
        
        // Add drag event handlers for track reordering
        trackDiv.addEventListener('dragstart', (e) => {
            draggedTrackId = track.id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'mixer-track-reorder', trackId: track.id, trackIndex: trackIndex }));
            trackDiv.style.opacity = '0.5';
            console.log(`[Mixer] Drag started for track ${track.id} (index ${trackIndex})`);
        });
        
        trackDiv.addEventListener('dragend', (e) => {
            trackDiv.style.opacity = '1';
            trackDiv.classList.remove('drag-over-left', 'drag-over-right');
            draggedTrackId = null;
            console.log('[Mixer] Drag ended');
        });
        
        trackDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        trackDiv.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (draggedTrackId !== null && draggedTrackId !== track.id) {
                const rect = trackDiv.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                if (e.clientX < midpoint) {
                    trackDiv.classList.add('drag-over-left');
                    trackDiv.classList.remove('drag-over-right');
                } else {
                    trackDiv.classList.add('drag-over-right');
                    trackDiv.classList.remove('drag-over-left');
                }
            }
        });
        
        trackDiv.addEventListener('dragleave', (e) => {
            // Only remove if actually leaving the track div
            if (!trackDiv.contains(e.relatedTarget)) {
                trackDiv.classList.remove('drag-over-left', 'drag-over-right');
            }
        });
        
        trackDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            trackDiv.classList.remove('drag-over-left', 'drag-over-right');
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.type === 'mixer-track-reorder' && data.trackId !== track.id) {
                    const sourceIndex = data.trackIndex;
                    const targetIndex = trackIndex;
                    
                    // Determine insertion point based on drop position
                    const rect = trackDiv.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;
                    let newIndex = targetIndex;
                    if (e.clientX < midpoint) {
                        newIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
                    } else {
                        newIndex = sourceIndex < targetIndex ? targetIndex : targetIndex + 1;
                    }
                    
                    console.log(`[Mixer] Drop: Moving track ${data.trackId} from index ${sourceIndex} to ${newIndex}`);
                    
                    if (localAppServices.reorderTrack) {
                        localAppServices.reorderTrack(data.trackId, newIndex);
                    }
                }
            } catch (err) {
                console.warn('[Mixer] Error processing drop:', err);
            }
        });
        
        // Get sidechain info
        const sidechainInfo = track.getSidechainInfo ? track.getSidechainInfo() : { isSource: false, isDestination: false, sources: [], destinations: [] };
        const sidechainIndicator = sidechainInfo.isSource || sidechainInfo.isDestination ? 
            `<div class="sidechain-indicator text-[10px] px-1 rounded ${sidechainInfo.isSource ? 'bg-orange-200 text-orange-700 dark:bg-orange-800 dark:text-orange-200' : 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'}" title="Sidechain: ${sidechainInfo.isSource ? 'Source' : 'Destination'}">SC</div>` : '';
        
        trackDiv.innerHTML = `
            <div class="track-name font-semibold truncate mb-0.5 dark:text-slate-200" title="${track.name}">${track.name}</div>
            ${sidechainIndicator}
            <div id="volumeKnob-mixer-${track.id}-placeholder" class="h-14 mx-auto mb-0.5"></div>
            <div id="panKnob-mixer-${track.id}-placeholder" class="h-10 mx-auto mb-0.5"></div>
            <div class="sends-section border-t dark:border-slate-600 pt-0.5 mt-0.5">
                <div class="text-[9px] text-gray-500 dark:text-slate-400 mb-0.5">Sends</div>
                <div id="sendReverbKnob-mixer-${track.id}-placeholder" class="h-8 mx-auto"></div>
                <div id="sendDelayKnob-mixer-${track.id}-placeholder" class="h-8 mx-auto"></div>
            </div>
            <div class="grid grid-cols-2 gap-0.5 my-1"> 
                <button id="mixerMuteBtn-${track.id}" title="Mute" class="px-1 py-0.5 text-xs border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600 ${track.isMuted ? 'muted bg-red-100 dark:bg-red-900' : ''}">${track.isMuted ? 'U' : 'M'}</button> 
                <button id="mixerSoloBtn-${track.id}" title="Solo" class="px-1 py-0.5 text-xs border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600 ${track.isSoloed ? 'soloed bg-yellow-100 dark:bg-yellow-900' : ''}">${track.isSoloed ? 'U' : 'S'}</button>
            </div>
            <button id="mixerSidechainBtn-${track.id}" title="Sidechain" class="w-full px-1 py-0.5 text-[10px] border rounded dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600 ${sidechainInfo.isSource || sidechainInfo.isDestination ? 'bg-orange-100 dark:bg-orange-900' : ''}">SC: ${sidechainInfo.isSource ? '→' : sidechainInfo.isDestination ? '←' : 'Off'}</button>
            <div id="delayCompKnob-mixer-${track.id}-placeholder" class="h-8 mx-auto mt-0.5"></div>
            <div id="mixerTrackMeterContainer-${track.id}" class="h-3 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden mt-0.5"> <div id="mixerTrackMeterBar-${track.id}" class="h-full bg-pink-400 transition-all duration-50 ease-linear" style="width: 0%;"></div> </div>`;
        trackDiv.addEventListener('contextmenu', (e) => { e.preventDefault(); createContextMenu(e, [ {label: "Open Inspector", action: () => localAppServices.handleOpenTrackInspector(track.id)}, {label: "Open Effects Rack", action: () => localAppServices.handleOpenEffectsRack(track.id)}, {label: "Open Sequencer", action: () => localAppServices.handleOpenSequencer(track.id)}, {separator: true}, {label: track.isMuted ? "Unmute" : "Mute", action: () => localAppServices.handleTrackMute(track.id)}, {label: track.isSoloed ? "Unsolo" : "Solo", action: () => localAppServices.handleTrackSolo(track.id)}, {label: (localAppServices.getArmedTrackId && localAppServices.getArmedTrackId() === track.id) ? "Disarm Input" : "Arm for Input", action: () => localAppServices.handleTrackArm(track.id)}, {separator: true}, {label: track.frozen ? "❄️ Unfreeze Track" : "❄️ Freeze Track", action: () => localAppServices.handleTrackFreeze(track.id)}, {label: "Bounce to Audio", action: () => localAppServices.handleBounceTrack(track.id)}, {label: track.isArchived ? "📦 Unarchive Track" : "📦 Archive Track", action: () => localAppServices.handleTrackArchive(track.id)}, {separator: true}, {label: "Copy Automation", action: () => { if (track.automation?.volume?.length > 0) { if (localAppServices.setAutomationClipboardState) localAppServices.setAutomationClipboardState({ param: 'volume', points: JSON.parse(JSON.stringify(track.automation.volume)), sourceTrackId: track.id }); showNotification(`Volume automation copied (${track.automation.volume.length} points).`, 2000); } else { showNotification("No volume automation to copy.", 2000); } } }, {label: "Paste Automation", action: () => { const autoClip = localAppServices.getAutomationClipboard ? localAppServices.getAutomationClipboard() : null; if (!autoClip || !autoClip.points || autoClip.points.length === 0) { showNotification("No automation in clipboard.", 2000); return; } if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Paste automation into ${track.name}`); autoClip.points.forEach(p => { if (track.addAutomationPoint) track.addAutomationPoint(autoClip.param || 'volume', p.time, p.value, p.curveType || 'exponential'); }); showNotification(`Pasted ${autoClip.points.length} automation points to ${track.name}.`, 2000); if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'automationChanged'); } }, {separator: true}, {label: "Duplicate Track", action: () => localAppServices.handleDuplicateTrack(track.id)},
            {label: "Humanize Velocities", action: () => { if(track.humanizeVelocity) { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Humanize velocities'); const count = track.humanizeVelocity(0.15); showNotification(`Humanized ${count} note velocities.`, 2000); } else { showNotification("Humanize not available for this track.", 2000); } } },
            {separator: true},
            {label: "Remove Track", action: () => localAppServices.handleRemoveTrack(track.id)} ], localAppServices); });
        container.appendChild(trackDiv);
        
        // Volume knob
        const volKnobPlaceholder = trackDiv.querySelector(`#volumeKnob-mixer-${track.id}-placeholder`);
        if (volKnobPlaceholder) { const volKnob = createKnob({ label: `Vol`, min: 0, max: 1.2, step: 0.01, initialValue: track.previousVolumeBeforeMute, decimals: 2, trackRef: track, onValueChange: (val, o, fromInteraction) => track.setVolume(val, fromInteraction) }); volKnobPlaceholder.innerHTML = ''; volKnobPlaceholder.appendChild(volKnob.element); }
        
        // Pan knob
        const panKnobPlaceholder = trackDiv.querySelector(`#panKnob-mixer-${track.id}-placeholder`);
        if (panKnobPlaceholder) { 
            const panKnob = createKnob({ 
                label: `Pan`, 
                min: -1, 
                max: 1, 
                step: 0.1, 
                initialValue: track.pan, 
                decimals: 1, 
                trackRef: track, 
                onValueChange: (val, o, fromInteraction) => track.setPan(val, fromInteraction),
                displaySuffix: ''
            }); 
            panKnobPlaceholder.innerHTML = ''; 
            panKnobPlaceholder.appendChild(panKnob.element); 
        }
        
        // Send knobs
        const reverbSendPlaceholder = trackDiv.querySelector(`#sendReverbKnob-mixer-${track.id}-placeholder`);
        if (reverbSendPlaceholder) {
            const reverbSend = track.getSendLevel ? track.getSendLevel('reverb') : 0;
            const reverbKnob = createKnob({
                label: `Reverb`,
                min: 0,
                max: 1,
                step: 0.01,
                initialValue: reverbSend,
                decimals: 2,
                trackRef: track,
                onValueChange: (val, o, fromInteraction) => track.setSendLevel('reverb', val, fromInteraction)
            });
            reverbSendPlaceholder.innerHTML = '';
            reverbSendPlaceholder.appendChild(reverbKnob.element);
        }
        
        const delaySendPlaceholder = trackDiv.querySelector(`#sendDelayKnob-mixer-${track.id}-placeholder`);
        if (delaySendPlaceholder) {
            const delaySend = track.getSendLevel ? track.getSendLevel('delay') : 0;
            const delayKnob = createKnob({
                label: `Delay`,
                min: 0,
                max: 1,
                step: 0.01,
                initialValue: delaySend,
                decimals: 2,
                trackRef: track,
                onValueChange: (val, o, fromInteraction) => track.setSendLevel('delay', val, fromInteraction)
            });
            delaySendPlaceholder.innerHTML = '';
            delaySendPlaceholder.appendChild(delayKnob.element);
        }
        
        // Delay compensation knob
        const delayCompPlaceholder = trackDiv.querySelector(`#delayCompKnob-mixer-${track.id}-placeholder`);
        if (delayCompPlaceholder) {
            const delayCompInfo = track.getDelayCompensationInfo ? track.getDelayCompensationInfo() : { total: 0, auto: true };
            const delayCompKnob = createKnob({
                label: `Dly`,
                min: 0,
                max: 100,
                step: 0.1,
                initialValue: delayCompInfo.total,
                decimals: 1,
                displaySuffix: 'ms',
                trackRef: track,
                onValueChange: (val, o, fromInteraction) => {
                    if (track.setAutoDelayCompensation) track.setAutoDelayCompensation(false);
                    if (track.setDelayCompensation) track.setDelayCompensation(val);
                }
            });
            delayCompPlaceholder.innerHTML = '';
            delayCompPlaceholder.appendChild(delayCompKnob.element);
        }
        
        // Sidechain button
        const sidechainBtn = trackDiv.querySelector(`#mixerSidechainBtn-${track.id}`);
        if (sidechainBtn) {
            sidechainBtn.addEventListener('click', () => showSidechainConfigModal(track));
        }
        
        trackDiv.querySelector(`#mixerMuteBtn-${track.id}`).addEventListener('click', () => localAppServices.handleTrackMute(track.id));
        trackDiv.querySelector(`#mixerSoloBtn-${track.id}`).addEventListener('click', (e) => {
            if (e.shiftKey) {
                localAppServices.handleTrackSoloExclusive?.(track.id);
            } else {
                localAppServices.handleTrackSolo?.(track.id);
            }
        });
    });
    
    // Return channel strips
    sendBuses.forEach(bus => {
        const returnDiv = document.createElement('div');
        returnDiv.className = 'mixer-track return-track inline-block align-top p-1.5 border rounded bg-purple-100 dark:bg-purple-900 dark:border-purple-700 shadow w-24 mr-2 text-xs';
        
        const returnLevel = localAppServices.getSendBusReturnLevel ? localAppServices.getSendBusReturnLevel(bus.id) : 0.5;
        
        returnDiv.innerHTML = `
            <div class="track-name font-semibold truncate mb-1 dark:text-purple-200" title="${bus.name} Return">${bus.name}</div>
            <div id="returnKnob-${bus.id}-placeholder" class="h-14 mx-auto mb-1"></div>
            <div id="wetKnob-${bus.id}-placeholder" class="h-10 mx-auto mb-0.5"></div>
            <div class="text-[9px] text-gray-500 dark:text-purple-300">Return</div>`;
        container.appendChild(returnDiv);
        
        // Return level knob
        const returnKnobPlaceholder = returnDiv.querySelector(`#returnKnob-${bus.id}-placeholder`);
        if (returnKnobPlaceholder) {
            const returnKnob = createKnob({
                label: `Return`,
                min: 0,
                max: 1,
                step: 0.01,
                initialValue: returnLevel,
                decimals: 2,
                onValueChange: (val, o, fromInteraction) => {
                    if (localAppServices.setSendBusReturnLevel) localAppServices.setSendBusReturnLevel(bus.id, val);
                }
            });
            returnKnobPlaceholder.innerHTML = '';
            returnKnobPlaceholder.appendChild(returnKnob.element);
        }
        
        // Wet level knob
        const wetKnobPlaceholder = returnDiv.querySelector(`#wetKnob-${bus.id}-placeholder`);
        if (wetKnobPlaceholder) {
            const wetKnob = createKnob({
                label: `Wet`,
                min: 0,
                max: 1,
                step: 0.01,
                initialValue: 0.5,
                decimals: 2,
                onValueChange: (val, o, fromInteraction) => {
                    if (localAppServices.setSendBusWet) localAppServices.setSendBusWet(bus.id, val);
                }
            });
            wetKnobPlaceholder.innerHTML = '';
            wetKnobPlaceholder.appendChild(wetKnob.element);
        }
    });
}

/**
 * Shows a modal for configuring sidechain routing.
 * @param {Track} track - The track to configure
 */
function showSidechainConfigModal(track) {
    const allTracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const sidechainInfo = track.getSidechainInfo ? track.getSidechainInfo() : { isSource: false, isDestination: false, sources: [], destinations: [] };
    
    // Build track options
    const trackOptions = allTracks
        .filter(t => t.id !== track.id)
        .map(t => `<option value="${t.id}" ${sidechainInfo.destinations.includes(t.id) || sidechainInfo.sources.includes(t.id) ? 'selected' : ''}>${t.name}</option>`)
        .join('');
    
    const contentHTML = `
        <div class="p-2 text-xs space-y-2">
            <h4 class="font-semibold dark:text-slate-200">Sidechain Routing for ${track.name}</h4>
            <div class="space-y-1">
                <label class="block dark:text-slate-300">This track ducks when:</label>
                <select id="sidechainSource-${track.id}" class="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                    <option value="">None</option>
                    ${trackOptions}
                </select>
            </div>
            <div class="space-y-1">
                <label class="block dark:text-slate-300">This track triggers ducking on:</label>
                <select id="sidechainDest-${track.id}" class="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                    <option value="">None</option>
                    ${trackOptions}
                </select>
            </div>
            <div class="pt-1 border-t dark:border-slate-600">
                <button id="clearSidechain-${track.id}" class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Clear Sidechain</button>
            </div>
        </div>
    `;
    
    const modal = showCustomModal(`Sidechain: ${track.name}`, contentHTML, [], 'sidechain-config-modal');
    
    if (modal?.contentDiv) {
        const sourceSelect = modal.contentDiv.querySelector(`#sidechainSource-${track.id}`);
        const destSelect = modal.contentDiv.querySelector(`#sidechainDest-${track.id}`);
        const clearBtn = modal.contentDiv.querySelector(`#clearSidechain-${track.id}`);
        
        if (sourceSelect) {
            sourceSelect.value = sidechainInfo.sources[0] || '';
            sourceSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    track.setSidechainSource(parseInt(e.target.value), true);
                } else if (sidechainInfo.sources[0]) {
                    track.clearSidechainRouting();
                }
            });
        }
        
        if (destSelect) {
            destSelect.value = sidechainInfo.destinations[0] || '';
            destSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    track.setSidechainDestination(parseInt(e.target.value), true);
                } else if (sidechainInfo.destinations[0]) {
                    track.clearSidechainRouting();
                }
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                track.clearSidechainRouting();
                if (sourceSelect) sourceSelect.value = '';
                if (destSelect) destSelect.value = '';
                if (localAppServices.showNotification) {
                    localAppServices.showNotification(`Cleared sidechain routing for ${track.name}`, 2000);
                }
            });
        }
    }
}

// --- Sequencer Window ---
function buildSequencerContentDOM(track, rows, rowLabels, numBars) {
    const stepsPerBar = Constants.STEPS_PER_BAR;
    const totalSteps = Number.isFinite(numBars) && numBars > 0 ? numBars * stepsPerBar : Constants.defaultStepsPerBar;
    const rowHeight = 18;
    const colWidth = 24;
    const labelWidth = 50;

    let html = `<div class="sequencer-container p-1 text-xs overflow-auto h-full dark:bg-slate-900 dark:text-slate-300" style="display: flex; flex-direction: column;">`;
    html += `<div class="controls mb-1 flex justify-between items-center sticky top-0 left-0 bg-gray-200 dark:bg-slate-800 p-1 z-30 border-b dark:border-slate-700"> 
        <span class="font-semibold">${track.name} - ${numBars} Bar${numBars > 1 ? 's' : ''} (${totalSteps} steps)</span> 
        <div class="flex items-center gap-2"> 
            <select id="quantizeResolution-${track.id}" class="text-xs p-0.5 border rounded dark:bg-slate-700 dark:border-slate-600">
                <option value="1/4">1/4</option>
                <option value="1/8" selected>1/8</option>
                <option value="1/16">1/16</option>
                <option value="1/32">1/32</option>
            </select>
            <button id="quantizeBtn-${track.id}" class="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700">Quantize</button>
            <button id="quantizeSelectionBtn-${track.id}" class="text-xs px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700" disabled>Quantize Selected</button>
            <label for="seqLengthInput-${track.id}">Bars: </label> 
            <input type="number" id="seqLengthInput-${track.id}" value="${numBars}" min="1" max="${Constants.MAX_BARS || 16}" class="w-12 p-0.5 border rounded text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> 
        </div> 
    </div>`;
    
    // Piano roll wrapper with row labels + grid side by side
    html += `<div class="piano-roll-wrapper" style="display: flex; flex: 1; overflow: auto;">`;
    
    // Row labels column (piano keys)
    html += `<div class="piano-keys" style="width: ${labelWidth}px; flex-shrink: 0; position: sticky; left: 0; z-index: 15; background: inherit;">`;
    html += `<div style="height: 24px; background: #ddd; border-bottom: 1px solid #555; display: flex; align-items: center; justify-content: center; gap: 4px;">`;
    html += `<button id="scaleHintToggle-${track.id}" class="text-xs px-1.5 py-0.5 rounded ${localAppServices.getScaleHintEnabled?.() ? 'bg-green-500 text-white' : 'bg-gray-400 text-gray-800'}" title="Toggle Scale Hint Overlay">Scale</button>`;
    html += `</div>`;
    for (let r = 0; r < rows; r++) {
        const pitchName = rowLabels[r] || `Row ${r + 1}`;
        const isBlack = pitchName.includes('#');
        const keyColor = isBlack ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-800';
        html += `<div class="piano-key-label ${keyColor}" data-row="${r}" style="height: ${rowHeight}px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 500; border-bottom: 1px solid #444; user-select: none; cursor: pointer;">${pitchName}</div>`;
    }
    html += `</div>`;
    
    // Grid area with step header
    html += `<div class="sequencer-grid-area" style="flex: 1; overflow-x: auto;">`;
    
    // Step numbers header
    html += `<div class="step-headers" style="display: flex; height: 24px; background: #ddd; border-bottom: 1px solid #555; position: sticky; top: 0; z-index: 10;">`;
    for (let c = 0; c < totalSteps; c++) {
        const isBarLine = (c % stepsPerBar) === 0;
        const isBeatLine = (c % 4) === 0 && !isBarLine;
        const borderStyle = isBarLine ? 'border-left: 2px solid #0066aa;' : (isBeatLine ? 'border-left: 1px solid #555;' : 'border-left: 1px solid #ccc;');
        html += `<div class="step-header" style="width: ${colWidth}px; height: 100%; flex-shrink: 0; ${borderStyle} display: flex; align-items: center; justify-content: center; font-size: 8px; color: #666;">${isBarLine ? Math.floor(c / stepsPerBar) + 1 : ''}</div>`;
    }
    html += `</div>`;
    
    // Sequencer grid rows
    const activeSequence = track.getActiveSequence();
    html += `<div id="sequencer-grid-${track.id}" class="sequencer-grid" style="display: flex; flex-direction: column;">`;
    for (let r = 0; r < rows; r++) {
        const pitchName = rowLabels[r] || '';
        const isBlack = pitchName.includes('#');
        html += `<div class="sequencer-row" data-row="${r}" style="display: flex; height: ${rowHeight}px; ${isBlack ? 'background: #1a1a1a;' : 'background: #2a2a2a;'}">`;
        for (let c = 0; c < totalSteps; c++) {
            const stepData = activeSequence && activeSequence.data && activeSequence.data[r] ? activeSequence.data[r][c] : null;
            const isActive = stepData && stepData.active;
            const velocity = stepData?.velocity || Constants.defaultVelocity;
            const isBarLine = (c % stepsPerBar) === 0;
            const isBeatLine = (c % 4) === 0 && !isBarLine;
            const borderStyle = isBarLine ? 'border-left: 2px solid #0066aa;' : (isBeatLine ? 'border-left: 1px solid #555;' : 'border-left: 1px solid #333;');
            const noteColor = isActive ? (isBlack ? 'bg-violet-600' : 'bg-violet-500') : (isBlack ? 'bg-gray-800' : 'bg-gray-600');
            const velOpacity = isActive ? 0.5 + (velocity * 0.5) : 1;
            // Apply scale hint overlay if enabled
            let scaleOverlay = '';
            const scaleHintEnabled = localAppServices.getScaleHintEnabled?.();
            if (scaleHintEnabled && !isActive) {
                // Check if this row's pitch is in the current scale
                const scaleRoot = localAppServices.getScaleHintRoot?.() || 'C';
                const scaleType = localAppServices.getScaleHintType?.() || 'major';
                const pitchName = rowLabels[r] || '';
                const isInScale = localAppServices.isNoteNameInScale?.(pitchName, scaleRoot, scaleType);
                if (isInScale) {
                    scaleOverlay = 'box-shadow: inset 0 0 0 2px rgba(34, 197, 94, 0.6);';
                }
            }
            html += `<div class="sequencer-step-cell ${noteColor}" data-row="${r}" data-col="${c}" data-velocity="${velocity}" style="width: ${colWidth}px; height: 100%; flex-shrink: 0; ${borderStyle} cursor: pointer; transition: background-color 0.1s; opacity: ${isActive ? velOpacity : 1}; ${scaleOverlay}" title="Row ${r + 1}, Step ${c + 1}${isActive ? `, Vel: ${Math.round(velocity * 100)}%` : ''}"></div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`; // End grid area
    html += `</div>`; // End container
    
    // Velocity Lane Section
    html += `<div class="velocity-lane-section mt-1" id="velocityLaneSection-${track.id}">`;
    html += `<div class="velocity-lane-header flex items-center justify-between bg-gray-300 dark:bg-slate-700 p-1 border-t border-b dark:border-slate-600">`;
    html += `<span class="text-xs font-semibold">Velocity Lane</span>`;
    html += `<div class="flex items-center gap-2">`;
    html += `<button id="toggleVelocityLane-${track.id}" class="text-xs px-2 py-0.5 bg-slate-500 text-white rounded hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500">Hide</button>`;
    html += `<button id="clearAllVelocities-${track.id}" class="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700">Clear All</button>`;
    html += `</div>`;
    html += `</div>`;
    html += `<div class="velocity-lane-content overflow-auto" id="velocityLaneContent-${track.id}" style="max-height: 80px;">`;
    html += `<div class="flex">`;
    // Row labels spacer
    html += `<div style="width: ${labelWidth}px; flex-shrink: 0;"></div>`;
    // Velocity bars grid
    html += `<div class="velocity-grid" style="display: flex; flex-direction: column;">`;
    for (let r = 0; r < rows; r++) {
        const pitchName = rowLabels[r] || '';
        html += `<div class="velocity-row" data-row="${r}" style="display: flex; height: 16px; background: #252525; border-bottom: 1px solid #333;">`;
        for (let c = 0; c < totalSteps; c++) {
            const stepData = activeSequence && activeSequence.data && activeSequence.data[r] ? activeSequence.data[r][c] : null;
            const isActive = stepData && stepData.active;
            const velocity = stepData?.velocity || Constants.defaultVelocity;
            const isBarLine = (c % stepsPerBar) === 0;
            const isBeatLine = (c % 4) === 0 && !isBarLine;
            const borderStyle = isBarLine ? 'border-left: 2px solid #0066aa;' : (isBeatLine ? 'border-left: 1px solid #555;' : 'border-left: 1px solid #333;');
            const velHeight = isActive ? Math.round(velocity * 16) : 0;
            html += `<div class="velocity-cell" data-row="${r}" data-col="${c}" style="width: ${colWidth}px; height: 100%; flex-shrink: 0; ${borderStyle} cursor: pointer; position: relative;">`;
            if (isActive) {
                html += `<div class="velocity-bar" style="position: absolute; bottom: 0; left: 0; right: 0; height: ${velHeight}px; background: linear-gradient(to top, rgba(239, 68, 68, 0.8), rgba(249, 115, 22, 0.9)); transition: height 0.1s;" title="Vel: ${Math.round(velocity * 100)}%"></div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;
    html += `</div>`; // End velocity lane section
    
    // Note Length Lane Section
    html += `<div class="note-length-lane-section mt-1" id="noteLengthLaneSection-${track.id}">`;
    html += `<div class="note-length-lane-header flex items-center justify-between bg-gray-300 dark:bg-slate-700 p-1 border-t border-b dark:border-slate-600">`;
    html += `<span class="text-xs font-semibold">Note Length Lane</span>`;
    html += `<div class="flex items-center gap-2">`;
    html += `<button id="toggleNoteLengthLane-${track.id}" class="text-xs px-2 py-0.5 bg-slate-500 text-white rounded hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500">Hide</button>`;
    html += `<button id="clearAllNoteLengths-${track.id}" class="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700">Reset All</button>`;
    html += `</div>`;
    html += `</div>`;
    html += `<div class="note-length-lane-content overflow-auto" id="noteLengthLaneContent-${track.id}" style="max-height: 60px;">`;
    html += `<div class="flex">`;
    // Row labels spacer
    html += `<div style="width: ${labelWidth}px; flex-shrink: 0;"></div>`;
    // Note length bars grid
    html += `<div class="note-length-grid" style="display: flex; flex-direction: column;">`;
    for (let r = 0; r < rows; r++) {
        const pitchName = rowLabels[r] || '';
        html += `<div class="note-length-row" data-row="${r}" style="display: flex; height: 12px; background: #252525; border-bottom: 1px solid #333;">`;
        for (let c = 0; c < totalSteps; c++) {
            const stepData = activeSequence && activeSequence.data && activeSequence.data[r] ? activeSequence.data[r][c] : null;
            const isActive = stepData && stepData.active;
            const noteLength = stepData?.noteLength || 0.25; // Default 16th note
            const isBarLine = (c % stepsPerBar) === 0;
            const isBeatLine = (c % 4) === 0 && !isBarLine;
            const borderStyle = isBarLine ? 'border-left: 2px solid #0066aa;' : (isBeatLine ? 'border-left: 1px solid #555;' : 'border-left: 1px solid #333;');
            const lenWidth = isActive ? Math.round(noteLength * colWidth * 4) : 0; // Length in pixels relative to grid
            html += `<div class="note-length-cell" data-row="${r}" data-col="${c}" style="width: ${colWidth}px; height: 100%; flex-shrink: 0; ${borderStyle} cursor: pointer; position: relative; overflow: visible;">`;
            if (isActive) {
                html += `<div class="note-length-bar" style="position: absolute; top: 2px; left: 0; width: ${Math.min(lenWidth, colWidth * 2)}px; height: 8px; background: linear-gradient(to right, rgba(59, 130, 246, 0.8), rgba(99, 102, 241, 0.9)); border-radius: 2px; transition: width 0.1s; z-index: 1;" title="Len: ${noteLength.toFixed(2)} beats"></div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;
    html += `</div>`; // End note length lane section
    
    // Probability Lane Section
    html += `<div class="probability-lane-section mt-1" id="probabilityLaneSection-${track.id}">`;
    html += `<div class="probability-lane-header flex items-center justify-between bg-gray-300 dark:bg-slate-700 p-1 border-t border-b dark:border-slate-600">`;
    html += `<span class="text-xs font-semibold">Probability Lane</span>`;
    html += `<div class="flex items-center gap-2">`;
    html += `<button id="toggleProbabilityLane-${track.id}" class="text-xs px-2 py-0.5 bg-slate-500 text-white rounded hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500">Hide</button>`;
    html += `<button id="clearAllProbabilities-${track.id}" class="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700">Reset All</button>`;
    html += `</div>`;
    html += `</div>`;
    html += `<div class="probability-lane-content overflow-auto" id="probabilityLaneContent-${track.id}" style="max-height: 60px;">`;
    html += `<div class="flex">`;
    // Row labels spacer
    html += `<div style="width: ${labelWidth}px; flex-shrink: 0;"></div>`;
    // Probability bars grid
    html += `<div class="probability-grid" style="display: flex; flex-direction: column;">`;
    for (let r = 0; r < rows; r++) {
        const pitchName = rowLabels[r] || '';
        html += `<div class="probability-row" data-row="${r}" style="display: flex; height: 12px; background: #252525; border-bottom: 1px solid #333;">`;
        for (let c = 0; c < totalSteps; c++) {
            const stepData = activeSequence && activeSequence.data && activeSequence.data[r] ? activeSequence.data[r][c] : null;
            const isActive = stepData && stepData.active;
            const probability = stepData?.probability ?? 1.0; // Default 100%
            const isBarLine = (c % stepsPerBar) === 0;
            const isBeatLine = (c % 4) === 0 && !isBarLine;
            const borderStyle = isBarLine ? 'border-left: 2px solid #0066aa;' : (isBeatLine ? 'border-left: 1px solid #555;' : 'border-left: 1px solid #333;');
            // Color based on probability: orange/red for low, green for high
            const probColor = probability < 0.5 ? `rgba(239, 68, 68, ${0.5 + probability * 0.5})` : (probability < 1.0 ? `rgba(234, 179, 8, ${0.5 + probability * 0.5})` : `rgba(34, 197, 94, ${0.7 + probability * 0.3})`);
            const probHeight = isActive ? Math.round(probability * 12) : 0;
            html += `<div class="probability-cell" data-row="${r}" data-col="${c}" style="width: ${colWidth}px; height: 100%; flex-shrink: 0; ${borderStyle} cursor: pointer; position: relative; overflow: visible;">`;
            if (isActive) {
                html += `<div class="probability-bar" style="position: absolute; top: 2px; left: 0; right: 0; height: ${probHeight}px; background: ${probColor}; border-radius: 2px; transition: height 0.1s, background 0.1s;" title="Prob: ${Math.round(probability * 100)}%${probability < 1.0 ? ' (may not play)' : ''}"></div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;
    html += `</div>`; // End probability lane section
    
    return html;
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
            console.log(`[UI openTrackSequencerWindow] Force redraw: Window ${windowId} found in map but no close method or not an instance, or map is missing.`);
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

    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const safeDesktopWidth = (desktopEl && typeof desktopEl.offsetWidth === 'number' && desktopEl.offsetWidth > 0)
                           ? desktopEl.offsetWidth
                           : 1024; // More robust fallback
    console.log(`[UI openTrackSequencerWindow] For track ${trackId}: Desktop element: ${desktopEl ? 'found' : 'NOT found'}, offsetWidth: ${desktopEl?.offsetWidth}, safeDesktopWidth: ${safeDesktopWidth}, NumBars: ${numBars}`);


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

    if (sequencerWindow?.element) {
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


        const sequencerContextMenuHandler = (event) => {
            event.preventDefault(); event.stopPropagation();
            const currentTrackForMenu = localAppServices.getTrackById ? localAppServices.getTrackById(track.id) : null; if (!currentTrackForMenu) return;
            const currentActiveSeq = currentTrackForMenu.getActiveSequence(); if(!currentActiveSeq) return;
            const clipboard = localAppServices.getClipboardData ? localAppServices.getClipboardData() : {};
            const menuItems = [
                { label: `Copy "${currentActiveSeq.name}"`, action: () => { if (localAppServices.setClipboardData) { localAppServices.setClipboardData({ type: 'sequence', sourceTrackType: currentTrackForMenu.type, data: JSON.parse(JSON.stringify(currentActiveSeq.data || [])), sequenceLength: currentActiveSeq.length }); showNotification(`Sequence "${currentActiveSeq.name}" copied.`, 2000); } } },
                { label: `Paste into "${currentActiveSeq.name}"`, action: () => { if (!clipboard || clipboard.type !== 'sequence' || !clipboard.data) { showNotification("Clipboard empty or no sequence data.", 2000); return; } if (clipboard.sourceTrackType !== currentTrackForMenu.type) { showNotification(`Track types mismatch. Can't paste ${clipboard.sourceTrackType} sequence into ${currentTrackForMenu.type} track.`, 3000); return; } if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Paste Sequence into ${currentActiveSeq.name} on ${currentTrackForMenu.name}`); currentActiveSeq.data = JSON.parse(JSON.stringify(clipboard.data)); currentActiveSeq.length = clipboard.sequenceLength; currentTrackForMenu.recreateToneSequence(true); showNotification(`Sequence pasted into "${currentActiveSeq.name}".`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); }); } },
                { separator: true },
                { label: `Erase "${currentActiveSeq.name}"`, action: () => { showConfirmationDialog(`Erase Sequence "${currentActiveSeq.name}" for ${currentTrackForMenu.name}?`, "This will clear all notes. This can be undone.", () => { if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Erase Sequence ${currentActiveSeq.name} for ${currentTrackForMenu.name}`); let numRowsErase = currentActiveSeq.data.length; currentActiveSeq.data = Array(numRowsErase).fill(null).map(() => Array(currentActiveSeq.length).fill(null)); currentTrackForMenu.recreateToneSequence(true); showNotification(`Sequence "${currentActiveSeq.name}" erased.`, 2000); if(localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sequencerContentChanged'); }); } },
                { label: `Double Length of "${currentActiveSeq.name}"`, action: () => { const currentNumBars = currentActiveSeq.length / Constants.STEPS_PER_BAR; if (currentNumBars * 2 > (Constants.MAX_BARS || 16)) { showNotification(`Exceeds max of ${Constants.MAX_BARS || 16} bars.`, 3000); return; } currentTrackForMenu.doubleSequence(); showNotification(`Sequence length doubled for "${currentActiveSeq.name}".`, 2000); } },
                { separator: true },
                { label: `Export to MIDI`, action: () => { import('./eventHandlers.js').then(m => { if (m.exportTrackToMIDI) { m.exportTrackToMIDI(currentTrackForMenu.id); } else { showNotification('MIDI export not available.', 2000); } }); } }
            ];
            createContextMenu(event, menuItems, localAppServices);
        };
        if (grid) grid.addEventListener('contextmenu', sequencerContextMenuHandler);
        if (controlsDiv) controlsDiv.addEventListener('contextmenu', sequencerContextMenuHandler);

        // Handle bars input change
        const barsInput = sequencerWindow.element.querySelector(`#seqLengthInput-${track.id}`);
        if (barsInput) {
            barsInput.addEventListener('change', (e) => {
                const newNumBars = parseInt(e.target.value, 10);
                if (!Number.isFinite(newNumBars) || newNumBars < 1 || newNumBars > (Constants.MAX_BARS || 16)) {
                    showNotification(`Invalid number of bars. Must be 1-${Constants.MAX_BARS || 16}.`, 2000);
                    e.target.value = Math.max(1, activeSequence.length / Constants.STEPS_PER_BAR);
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
                showNotification(`Sequence length changed to ${newNumBars} bars.`, 1500);
            });
        }

        // Handle Quantize button click - quantize all active notes
        const quantizeBtn = sequencerWindow.element.querySelector(`#quantizeBtn-${track.id}`);
        const quantizeSelectionBtn = sequencerWindow.element.querySelector(`#quantizeSelectionBtn-${track.id}`);
        const resolutionSelect = sequencerWindow.element.querySelector(`#seqResolutionSelect-${track.id}`);
        
        if (quantizeBtn) {
            quantizeBtn.addEventListener('click', () => {
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data) return;
                
                const resolution = resolutionSelect?.value || '1/16';
                
                // Collect all active note positions
                const activePositions = [];
                currentActiveSeq.data.forEach((row, rowIdx) => {
                    if (row) {
                        row.forEach((cell, colIdx) => {
                            if (cell?.active) {
                                activePositions.push({ row: rowIdx, col: colIdx });
                            }
                        });
                    }
                });
                
                if (activePositions.length === 0) {
                    if (localAppServices.showNotification) localAppServices.showNotification('No notes to quantize.', 1500);
                    return;
                }
                
                const quantizedCount = track.quantizeSelectedNotes(activePositions, resolution);
                
                if (quantizedCount > 0 && localAppServices.showNotification) {
                    localAppServices.showNotification(`Quantized ${quantizedCount} notes to ${resolution}.`, 1500);
                }
                
                // Re-render sequencer
                openTrackSequencerWindow(trackId, true);
            });
        }
        
        // Handle Quantize Selection button click
        if (quantizeSelectionBtn) {
            quantizeSelectionBtn.addEventListener('click', () => {
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data) return;
                
                // Get selected cells for this track
                const trackSelections = sequencerSelectedCells.get(trackId);
                if (!trackSelections || trackSelections.size === 0) {
                    if (localAppServices.showNotification) localAppServices.showNotification('No cells selected. Shift+click to select.', 1500);
                    return;
                }
                
                const resolution = resolutionSelect?.value || '1/16';
                const selectedPositions = Array.from(trackSelections);
                
                const quantizedCount = track.quantizeSelectedNotes(selectedPositions, resolution);
                
                if (quantizedCount > 0 && localAppServices.showNotification) {
                    localAppServices.showNotification(`Quantized ${quantizedCount} selected notes.`, 1500);
                }
                
                // Clear selection after quantize
                sequencerSelectedCells.delete(trackId);
                updateQuantizeSelectionButtonState(sequencerWindow.element, trackId);
                
                // Re-render sequencer
                openTrackSequencerWindow(trackId, true);
            });
        }

        // Handle cell click for toggle and shift+click for velocity/selection
        if (grid) grid.addEventListener('click', (e) => {
            const targetCell = e.target.closest('.sequencer-step-cell');
            if (targetCell) {
                const row = parseInt(targetCell.dataset.row, 10); 
                const col = parseInt(targetCell.dataset.col, 10);
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data) return;

                if (!currentActiveSeq.data[row]) currentActiveSeq.data[row] = Array(currentActiveSeq.length).fill(null);
                const currentStepData = currentActiveSeq.data[row][col];

                // Alt+Shift+click: Add to selection
                if (e.altKey && e.shiftKey) {
                    e.preventDefault();
                    if (!sequencerSelectedCells.has(trackId)) {
                        sequencerSelectedCells.set(trackId, new Set());
                    }
                    const trackSelections = sequencerSelectedCells.get(trackId);
                    const cellKey = `${row}-${col}`;
                    const cellKeyObj = { row, col };
                    
                    // Toggle selection
                    let isSelected = false;
                    for (const sel of trackSelections) {
                        if (sel.row === row && sel.col === col) {
                            isSelected = true;
                            trackSelections.delete(sel);
                            break;
                        }
                    }
                    if (!isSelected) {
                        trackSelections.add(cellKeyObj);
                    }
                    
                    updateSequencerCellUI(sequencerWindow.element, track.type, row, col, currentStepData?.active || false);
                    updateQuantizeSelectionButtonState(sequencerWindow.element, trackId);
                    return;
                }

                if (e.shiftKey && currentStepData?.active) {
                    // Shift+click: change velocity
                    const newVel = currentStepData.velocity - 0.1;
                    const finalVel = newVel < 0.05 ? 1.0 : newVel;
                    currentActiveSeq.data[row][col] = { ...currentStepData, velocity: finalVel };
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Change velocity for step (${row + 1},${col + 1}) on ${track.name}`);
                    updateSequencerCellUI(sequencerWindow.element, track.type, row, col, true);
                } else if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmd+click: cycle velocity preset
                    const velocities = [0.3, 0.5, 0.7, 0.9, 1.0];
                    const currentVel = currentStepData?.velocity || Constants.defaultVelocity;
                    const idx = velocities.findIndex(v => Math.abs(v - currentVel) < 0.05);
                    const nextVel = idx >= 0 ? velocities[(idx + 1) % velocities.length] : 0.7;
                    const newActive = currentStepData?.active !== undefined ? currentStepData : { active: true };
                    currentActiveSeq.data[row][col] = { ...newActive, velocity: nextVel };
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set velocity to ${Math.round(nextVel * 100)}% for step (${row + 1},${col + 1}) on ${track.name}`);
                    updateSequencerCellUI(sequencerWindow.element, track.type, row, col, currentActiveSeq.data[row][col].active);
                } else {
                    // Normal click: toggle step
                    const isActive = !(currentStepData?.active);
                    if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Toggle Step (${row + 1},${col + 1}) on ${track.name} (${currentActiveSeq.name})`);
                    currentActiveSeq.data[row][col] = isActive ? { active: true, velocity: Constants.defaultVelocity } : null;
                    updateSequencerCellUI(sequencerWindow.element, track.type, row, col, isActive);
                }
            }
        });

        // Handle right-click for velocity slider popup
        if (grid) grid.addEventListener('contextmenu', (e) => {
            const targetCell = e.target.closest('.sequencer-step-cell');
            if (!targetCell) return;
            const row = parseInt(targetCell.dataset.row, 10);
            const col = parseInt(targetCell.dataset.col, 10);
            const currentActiveSeq = track.getActiveSequence();
            if (!currentActiveSeq || !currentActiveSeq.data || !currentActiveSeq.data[row]) return;

            const stepData = currentActiveSeq.data[row][col];
            if (!stepData?.active) return; // Not an active step, don't intercept

            // Only prevent default when showing popup
            e.preventDefault();

            const velocity = stepData.velocity || Constants.defaultVelocity;
            const popup = document.createElement('div');
            popup.className = 'velocity-popup fixed bg-gray-100 dark:bg-slate-800 border border-slate-400 dark:border-slate-600 rounded shadow-lg p-2 z-[9999]';
            popup.style.left = `${e.clientX}px`;
            popup.style.top = `${e.clientY}px`;
            popup.innerHTML = `
                <div class="text-xs font-semibold mb-1 dark:text-slate-200">Velocity</div>
                <input type="range" min="0.05" max="1" step="0.05" value="${velocity}" class="w-32" id="velSlider">
                <div class="text-xs text-center mt-1 dark:text-slate-300" id="velLabel">${Math.round(velocity * 100)}%</div>
                <div class="text-xs text-center mt-1 text-gray-500">Right-click to close</div>
            `;
            document.body.appendChild(popup);

            const slider = popup.querySelector('#velSlider');
            const label = popup.querySelector('#velLabel');
            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                label.textContent = `${Math.round(v * 100)}%`;
                currentActiveSeq.data[row][col] = { ...stepData, velocity: v };
                updateSequencerCellUI(sequencerWindow.element, track.type, row, col, true);
            });

            slider.addEventListener('change', () => {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set velocity for step (${row + 1},${col + 1}) on ${track.name}`);
                popup.remove();
            });

            const closePopup = (ev) => {
                if (!popup.contains(ev.target)) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            };
            setTimeout(() => document.addEventListener('click', closePopup), 10);
        });

        // Handle velocity lane toggle and clear buttons
        const toggleVelLaneBtn = sequencerWindow.element.querySelector(`#toggleVelocityLane-${track.id}`);
        const clearAllVelBtn = sequencerWindow.element.querySelector(`#clearAllVelocities-${track.id}`);
        const velLaneContent = sequencerWindow.element.querySelector(`#velocityLaneContent-${track.id}`);
        
        if (toggleVelLaneBtn && velLaneContent) {
            toggleVelLaneBtn.addEventListener('click', () => {
                if (velLaneContent.style.display === 'none') {
                    velLaneContent.style.display = 'block';
                    toggleVelLaneBtn.textContent = 'Hide';
                } else {
                    velLaneContent.style.display = 'none';
                    toggleVelLaneBtn.textContent = 'Show';
                }
            });
        }
        
        // Handle scale hint toggle button
        const scaleHintToggleBtn = sequencerWindow.element.querySelector(`#scaleHintToggle-${track.id}`);
        if (scaleHintToggleBtn) {
            scaleHintToggleBtn.addEventListener('click', () => {
                const currentEnabled = localAppServices.getScaleHintEnabled?.() || false;
                localAppServices.setScaleHintEnabled?.(!currentEnabled);
                // Update button appearance
                scaleHintToggleBtn.className = `text-xs px-1.5 py-0.5 rounded ${!currentEnabled ? 'bg-green-500 text-white' : 'bg-gray-400 text-gray-800'}`;
                // Re-render sequencer to show/hide scale hints
                openTrackSequencerWindow(trackId, true);
                showNotification(`Scale hints ${!currentEnabled ? 'enabled' : 'disabled'}`, 1000);
            });
        }
        
        if (clearAllVelBtn) {
            clearAllVelBtn.addEventListener('click', () => {
                if (localAppServices.showConfirmationDialog) {
                    localAppServices.showConfirmationDialog('Clear All Velocities', 'Reset all note velocities to default?', () => {
                        const currentActiveSeq = track.getActiveSequence();
                        if (!currentActiveSeq || !currentActiveSeq.data) return;
                        currentActiveSeq.data.forEach((row, rowIdx) => {
                            if (row) {
                                row.forEach((cell, colIdx) => {
                                    if (cell?.active) {
                                        currentActiveSeq.data[rowIdx][colIdx] = { ...cell, velocity: Constants.defaultVelocity };
                                    }
                                });
                            }
                        });
                        openTrackSequencerWindow(trackId, true);
                        if (localAppServices.showNotification) localAppServices.showNotification('All velocities reset to default.', 1500);
                    });
                }
            });
        }
        
        // Handle velocity lane cell clicks for direct velocity editing
        const velGrid = sequencerWindow.element.querySelector(`#velocityLaneContent-${track.id} .velocity-grid`);
        if (velGrid) {
            velGrid.addEventListener('click', (e) => {
                const velCell = e.target.closest('.velocity-cell');
                if (!velCell) return;
                
                const row = parseInt(velCell.dataset.row, 10);
                const col = parseInt(velCell.dataset.col, 10);
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data || !currentActiveSeq.data[row]) return;
                
                const stepData = currentActiveSeq.data[row][col];
                if (!stepData?.active) return;
                
                // Cycle velocity on click
                const velocities = [0.3, 0.5, 0.7, 0.9, 1.0];
                const currentVel = stepData.velocity || Constants.defaultVelocity;
                const idx = velocities.findIndex(v => Math.abs(v - currentVel) < 0.05);
                const nextVel = idx >= 0 ? velocities[(idx + 1) % velocities.length] : 0.7;
                currentActiveSeq.data[row][col] = { ...stepData, velocity: nextVel };
                
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo(`Set velocity to ${Math.round(nextVel * 100)}% for step (${row + 1},${col + 1}) on ${track.name}`);
                }
                
                // Update both the velocity lane and main grid cell
                updateSequencerCellUI(sequencerWindow.element, track.type, row, col, true);
                
                // Update velocity bar in velocity lane
                const velRow = velGrid.querySelector(`.velocity-row[data-row="${row}"]`);
                if (velRow) {
                    const cell = velRow.querySelector(`.velocity-cell[data-col="${col}"]`);
                    if (cell) {
                        const velHeight = Math.round(nextVel * 16);
                        const velBar = cell.querySelector('.velocity-bar');
                        if (velBar) {
                            velBar.style.height = `${velHeight}px`;
                            velBar.title = `Vel: ${Math.round(nextVel * 100)}%`;
                        }
                    }
                }
            });
        }
        
        // Handle note length lane toggle and reset buttons
        const toggleNoteLenLaneBtn = sequencerWindow.element.querySelector(`#toggleNoteLengthLane-${track.id}`);
        const clearAllNoteLenBtn = sequencerWindow.element.querySelector(`#clearAllNoteLengths-${track.id}`);
        const noteLenLaneContent = sequencerWindow.element.querySelector(`#noteLengthLaneContent-${track.id}`);
        
        if (toggleNoteLenLaneBtn && noteLenLaneContent) {
            toggleNoteLenLaneBtn.addEventListener('click', () => {
                if (noteLenLaneContent.style.display === 'none') {
                    noteLenLaneContent.style.display = 'block';
                    toggleNoteLenLaneBtn.textContent = 'Hide';
                } else {
                    noteLenLaneContent.style.display = 'none';
                    toggleNoteLenLaneBtn.textContent = 'Show';
                }
            });
        }
        
        if (clearAllNoteLenBtn) {
            clearAllNoteLenBtn.addEventListener('click', () => {
                if (localAppServices.showConfirmationDialog) {
                    localAppServices.showConfirmationDialog('Reset All Note Lengths', 'Reset all note lengths to default (0.25 beats)?', () => {
                        const currentActiveSeq = track.getActiveSequence();
                        if (!currentActiveSeq || !currentActiveSeq.data) return;
                        currentActiveSeq.data.forEach((row, rowIdx) => {
                            if (row) {
                                row.forEach((cell, colIdx) => {
                                    if (cell?.active) {
                                        currentActiveSeq.data[rowIdx][colIdx] = { ...cell, noteLength: 0.25 };
                                    }
                                });
                            }
                        });
                        openTrackSequencerWindow(trackId, true);
                        if (localAppServices.showNotification) localAppServices.showNotification('All note lengths reset to default.', 1500);
                    });
                }
            });
        }
        
        // Handle note length lane cell clicks for direct note length editing
        const noteLenGrid = sequencerWindow.element.querySelector(`#noteLengthLaneContent-${track.id} .note-length-grid`);
        if (noteLenGrid) {
            noteLenGrid.addEventListener('click', (e) => {
                const noteLenCell = e.target.closest('.note-length-cell');
                if (!noteLenCell) return;
                
                const row = parseInt(noteLenCell.dataset.row, 10);
                const col = parseInt(noteLenCell.dataset.col, 10);
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data || !currentActiveSeq.data[row]) return;
                
                const stepData = currentActiveSeq.data[row][col];
                if (!stepData?.active) return;
                
                // Cycle note length on click: 0.125 (32nd), 0.25 (16th), 0.375 (dotted 16th), 0.5 (8th), 0.75 (dotted 8th), 1.0 (quarter), 1.5 (dotted quarter), 2.0 (half)
                const noteLengths = [0.125, 0.25, 0.375, 0.5, 0.75, 1.0, 1.5, 2.0];
                const currentLen = stepData.noteLength || 0.25;
                const idx = noteLengths.findIndex(l => Math.abs(l - currentLen) < 0.01);
                const nextLen = idx >= 0 ? noteLengths[(idx + 1) % noteLengths.length] : 0.25;
                currentActiveSeq.data[row][col] = { ...stepData, noteLength: nextLen };
                
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo(`Set note length to ${nextLen} beats for step (${row + 1},${col + 1}) on ${track.name}`);
                }
                
                // Update note length bar in lane
                const noteLenRow = noteLenGrid.querySelector(`.note-length-row[data-row="${row}"]`);
                if (noteLenRow) {
                    const cell = noteLenRow.querySelector(`.note-length-cell[data-col="${col}"]`);
                    if (cell) {
                        const lenWidth = Math.round(nextLen * colWidth * 4);
                        const lenBar = cell.querySelector('.note-length-bar');
                        if (lenBar) {
                            lenBar.style.width = `${Math.min(lenWidth, colWidth * 2)}px`;
                            lenBar.title = `Len: ${nextLen.toFixed(2)} beats`;
                        }
                    }
                }
                
                // Update the main grid cell title to reflect new length
                const gridCell = sequencerWindow.element.querySelector(`.sequencer-step-cell[data-row="${row}"][data-col="${col}"]`);
                if (gridCell) {
                    gridCell.title = `Row ${row + 1}, Step ${col + 1}, Vel: ${Math.round((stepData.velocity || 0.7) * 100)}%, Len: ${nextLen.toFixed(2)} beats`;
                }
            });
        }
        
        // Handle probability lane toggle and reset buttons
        const toggleProbLaneBtn = sequencerWindow.element.querySelector(`#toggleProbabilityLane-${track.id}`);
        const clearAllProbBtn = sequencerWindow.element.querySelector(`#clearAllProbabilities-${track.id}`);
        const probLaneContent = sequencerWindow.element.querySelector(`#probabilityLaneContent-${track.id}`);
        
        if (toggleProbLaneBtn && probLaneContent) {
            toggleProbLaneBtn.addEventListener('click', () => {
                if (probLaneContent.style.display === 'none') {
                    probLaneContent.style.display = 'block';
                    toggleProbLaneBtn.textContent = 'Hide';
                } else {
                    probLaneContent.style.display = 'none';
                    toggleProbLaneBtn.textContent = 'Show';
                }
            });
        }
        
        if (clearAllProbBtn) {
            clearAllProbBtn.addEventListener('click', () => {
                if (localAppServices.showConfirmationDialog) {
                    localAppServices.showConfirmationDialog('Reset All Probabilities', 'Reset all step probabilities to 100%?', () => {
                        const currentActiveSeq = track.getActiveSequence();
                        if (!currentActiveSeq || !currentActiveSeq.data) return;
                        currentActiveSeq.data.forEach((row, rowIdx) => {
                            if (row) {
                                row.forEach((cell, colIdx) => {
                                    if (cell?.active) {
                                        currentActiveSeq.data[rowIdx][colIdx] = { ...cell, probability: 1.0 };
                                    }
                                });
                            }
                        });
                        openTrackSequencerWindow(trackId, true);
                        if (localAppServices.showNotification) localAppServices.showNotification('All probabilities reset to 100%.', 1500);
                    });
                }
            });
        }
        
        // Handle probability lane cell clicks for direct probability editing
        const probGrid = sequencerWindow.element.querySelector(`#probabilityLaneContent-${track.id} .probability-grid`);
        if (probGrid) {
            probGrid.addEventListener('click', (e) => {
                const probCell = e.target.closest('.probability-cell');
                if (!probCell) return;
                
                const row = parseInt(probCell.dataset.row, 10);
                const col = parseInt(probCell.dataset.col, 10);
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data || !currentActiveSeq.data[row]) return;
                
                const stepData = currentActiveSeq.data[row][col];
                if (!stepData?.active) return;
                
                // Cycle probability on click: 25%, 50%, 75%, 100%
                const probabilities = [0.25, 0.5, 0.75, 1.0];
                const currentProb = stepData.probability ?? 1.0;
                const idx = probabilities.findIndex(p => Math.abs(p - currentProb) < 0.05);
                const nextProb = idx >= 0 ? probabilities[(idx + 1) % probabilities.length] : 1.0;
                currentActiveSeq.data[row][col] = { ...stepData, probability: nextProb };
                
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo(`Set probability to ${Math.round(nextProb * 100)}% for step (${row + 1},${col + 1}) on ${track.name}`);
                }
                
                // Update probability bar in lane
                const probRow = probGrid.querySelector(`.probability-row[data-row="${row}"]`);
                if (probRow) {
                    const cell = probRow.querySelector(`.probability-cell[data-col="${col}"]`);
                    if (cell) {
                        const probHeight = Math.round(nextProb * 12);
                        const probBar = cell.querySelector('.probability-bar');
                        if (probBar) {
                            probBar.style.height = `${probHeight}px`;
                            // Color based on probability
                            const probColor = nextProb < 0.5 ? `rgba(239, 68, 68, ${0.5 + nextProb * 0.5})` : (nextProb < 1.0 ? `rgba(234, 179, 8, ${0.5 + nextProb * 0.5})` : `rgba(34, 197, 94, ${0.7 + nextProb * 0.3})`);
                            probBar.style.background = probColor;
                            probBar.title = `Prob: ${Math.round(nextProb * 100)}%${nextProb < 1.0 ? ' (may not play)' : ''}`;
                        }
                    }
                }
                
                // Update the main grid cell title to reflect new probability
                const gridCell = sequencerWindow.element.querySelector(`.sequencer-step-cell[data-row="${row}"][data-col="${col}"]`);
                if (gridCell) {
                    const probText = nextProb < 1.0 ? `, Prob: ${Math.round(nextProb * 100)}%` : '';
                    gridCell.title = `Row ${row + 1}, Step ${col + 1}, Vel: ${Math.round((stepData.velocity || 0.7) * 100)}%${probText}`;
                }
            });
            
            // Right-click on probability cell for fine-grained slider popup
            probGrid.addEventListener('contextmenu', (e) => {
                const probCell = e.target.closest('.probability-cell');
                if (!probCell) return;
                
                const row = parseInt(probCell.dataset.row, 10);
                const col = parseInt(probCell.dataset.col, 10);
                const currentActiveSeq = track.getActiveSequence();
                if (!currentActiveSeq || !currentActiveSeq.data || !currentActiveSeq.data[row]) return;
                
                const stepData = currentActiveSeq.data[row][col];
                if (!stepData?.active) return;
                
                e.preventDefault();
                
                const probability = stepData.probability ?? 1.0;
                const popup = document.createElement('div');
                popup.className = 'probability-popup fixed bg-gray-100 dark:bg-slate-800 border border-slate-400 dark:border-slate-600 rounded shadow-lg p-2 z-[9999]';
                popup.style.left = `${e.clientX}px`;
                popup.style.top = `${e.clientY}px`;
                popup.innerHTML = `
                    <div class="text-xs font-semibold mb-1 dark:text-slate-200">Probability</div>
                    <input type="range" min="0.05" max="1" step="0.05" value="${probability}" class="w-32" id="probSlider">
                    <div class="text-xs text-center mt-1 dark:text-slate-300" id="probLabel">${Math.round(probability * 100)}%</div>
                    <div class="text-xs text-center mt-1 text-gray-500">Right-click to close</div>
                `;
                document.body.appendChild(popup);
                
                const slider = popup.querySelector('#probSlider');
                const label = popup.querySelector('#probLabel');
                slider.addEventListener('input', () => {
                    const p = parseFloat(slider.value);
                    label.textContent = `${Math.round(p * 100)}%`;
                    currentActiveSeq.data[row][col] = { ...stepData, probability: p };
                    
                    // Update bar in lane
                    const probRow = probGrid.querySelector(`.probability-row[data-row="${row}"]`);
                    if (probRow) {
                        const cell = probRow.querySelector(`.probability-cell[data-col="${col}"]`);
                        if (cell) {
                            const probHeight = Math.round(p * 12);
                            const probBar = cell.querySelector('.probability-bar');
                            if (probBar) {
                                probBar.style.height = `${probHeight}px`;
                                const probColor = p < 0.5 ? `rgba(239, 68, 68, ${0.5 + p * 0.5})` : (p < 1.0 ? `rgba(234, 179, 8, ${0.5 + p * 0.5})` : `rgba(34, 197, 94, ${0.7 + p * 0.3})`);
                                probBar.style.background = probColor;
                                probBar.title = `Prob: ${Math.round(p * 100)}%${p < 1.0 ? ' (may not play)' : ''}`;
                            }
                        }
                    }
                });
                
                slider.addEventListener('change', () => {
                    if (localAppServices.captureStateForUndo) {
                        localAppServices.captureStateForUndo(`Set probability for step (${row + 1},${col + 1}) on ${track.name}`);
                    }
                    popup.remove();
                });
                
                const closePopup = (ev) => {
                    if (!popup.contains(ev.target)) {
                        popup.remove();
                        document.removeEventListener('click', closePopup);
                    }
                };
                setTimeout(() => document.addEventListener('click', closePopup), 10);
            });
        }

    }
    return sequencerWindow;
}

/**
 * Updates the Quantize Selection button state based on selection.
 */
function updateQuantizeSelectionButtonState(winEl, trackId) {
    const btn = winEl.querySelector(`#quantizeSelectionBtn-${trackId}`);
    if (!btn) return;
    
    const trackSelections = sequencerSelectedCells.get(trackId);
    const hasSelection = trackSelections && trackSelections.size > 0;
    
    btn.disabled = !hasSelection;
    if (hasSelection) {
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

/**
 * Export function to clear sequencer cell selection for a track.
 */
export function clearSequencerSelection(trackId) {
    sequencerSelectedCells.delete(trackId);
}

/**
 * Updates the visual state of a single sequencer cell.
 * @param {HTMLElement} windowElement - The sequencer window element
 * @param {string} trackType - The type of track (Synth, Sampler, DrumSampler, etc.)
 * @param {number} row - The row index (0-based)
 * @param {number} col - The column index (0-based)
 * @param {boolean} isActive - Whether the cell is active
 */
export function updateSequencerCellUI(windowElement, trackType, row, col, isActive) {
    if (!windowElement) return;
    
    const cell = windowElement.querySelector(`.sequencer-step-cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    
    if (isActive) {
        cell.classList.add('active');
        cell.style.backgroundColor = ''; // Let CSS handle the color
    } else {
        cell.classList.remove('active');
    }
}

// --- UI Update & Drawing Functions ---
export function drawWaveform(track) {
    if (!track?.waveformCanvasCtx || !track.audioBuffer?.loaded) {
        if (track?.waveformCanvasCtx) {
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
        ctx.strokeStyle = index === track.selectedSliceForEdit ? 'rgba(255,0,0,0.7)' : (ctx.canvas.classList.contains('dark') ? 'rgba(96, 165, 250, 0.5)' : 'rgba(0,0,255,0.4)');
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(startX, canvas.height); ctx.moveTo(endX, 0); ctx.lineTo(endX, canvas.height); ctx.stroke();
        ctx.fillStyle = index === track.selectedSliceForEdit ? '#FEC8D8' : (ctx.canvas.classList.contains('dark') ? '#E0BBE4' : '#0000cc');
        ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`S${index + 1}`, startX + 2, 10);
    });
}

export function drawInstrumentWaveform(track) {
    if (!track?.instrumentWaveformCanvasCtx || !track.instrumentSamplerSettings.audioBuffer?.loaded) {
        if (track?.instrumentWaveformCanvasCtx) { /* Draw 'No audio' message, similar to drawWaveform */ } return;
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
        ctx.strokeStyle = canvas.classList.contains('dark') ? 'rgba(96, 165, 250, 0.6)' : 'rgba(0,200,0,0.6)';
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(loopStartX, 0); ctx.lineTo(loopStartX, canvas.height); ctx.moveTo(loopEndX, 0); ctx.lineTo(loopEndX, canvas.height); ctx.stroke();
    }
}



export function highlightPlayingStep(trackId, stepIndex, isPlaying) {
    // Highlight the current playing step in the sequencer grid
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return;
    
    // Find the sequencer window for this track
    const sequencerWin = localAppServices.getWindowById ? localAppServices.getWindowById('sequencerWin-' + trackId) : null;
    if (!sequencerWin || !sequencerWin.element) return;
    
    // Remove playing class from all cells
    sequencerWin.element.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => {
        cell.classList.remove('playing');
    });
    
    if (isPlaying && stepIndex >= 0) {
        // Add playing class to current step cell
        const cell = sequencerWin.element.querySelector('[data-step="' + stepIndex + '"]');
        if (cell) {
            cell.classList.add('playing');
        }
    }
}



// --- Additional UI Stubs ---
export function renderSamplePads(track) {
    if (!track || track.type !== 'Sampler') return;
    
    const inspectorWin = localAppServices.getWindowById ? localAppServices.getWindowById(`inspector-${track.id}`) : null;
    if (!inspectorWin || !inspectorWin.element) return;
    
    const container = inspectorWin.element.querySelector(`#samplePadsContainer-${track.id}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    const pads = track.slices || [];
    const numPads = Math.min(pads.length, Constants.numSlices);
    
    for (let i = 0; i < numPads; i++) {
        const pad = pads[i];
        const isSelected = i === track.selectedSliceForEdit;
        const hasContent = pad && (pad.duration > 0 || pad.userDefined);
        const status = pad?.status || 'empty';
        
        const padEl = document.createElement('button');
        padEl.className = `sample-pad p-2 text-xs rounded border transition-colors ${
            isSelected ? 'ring-2 ring-pink-500 bg-pink-100 dark:bg-pink-900' : 
            hasContent ? 'bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700' : 
            'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600'
        } border-gray-300 dark:border-slate-500`;
        padEl.dataset.sliceIndex = i;
        padEl.innerHTML = `<div class="font-bold">${i + 1}</div><div class="text-[10px] opacity-75">${
            hasContent ? `${(pad.duration * 1000).toFixed(0)}ms` : status === 'missing' ? '⚠️' : '—'
        }</div>`;
        padEl.title = `Slice ${i + 1}${hasContent ? ` (${(pad.duration * 1000).toFixed(1)}ms)` : ''} - Click to edit`;
        
        padEl.addEventListener('click', () => {
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Select Slice ${i + 1} on ${track.name}`);
            }
            track.selectedSliceForEdit = i;
            renderSamplePads(track);
            updateSliceEditorUI(track);
        });
        
        container.appendChild(padEl);
    }
}

export function updateSliceEditorUI(track) {
    if (!track || track.type !== 'Sampler') return;
    
    const inspectorWin = localAppServices.getWindowById ? localAppServices.getWindowById(`inspector-${track.id}`) : null;
    if (!inspectorWin || !inspectorWin.element) return;
    
    const selectedSliceInfo = inspectorWin.element.querySelector(`#selectedSliceInfo-${track.id}`);
    if (selectedSliceInfo) {
        selectedSliceInfo.textContent = (track.selectedSliceForEdit + 1).toString();
    }
    
    const slice = track.slices?.[track.selectedSliceForEdit] || {
        volume: 0.7, pitchShift: 0, envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 }
    };
    
    // Update knob values
    if (track.inspectorControls) {
        if (track.inspectorControls.sliceVolume) {
            track.inspectorControls.sliceVolume.setValue(slice.volume, false);
        }
        if (track.inspectorControls.slicePitch) {
            track.inspectorControls.slicePitch.setValue(slice.pitchShift, false);
        }
        if (track.inspectorControls.sliceEnvAttack) {
            track.inspectorControls.sliceEnvAttack.setValue(slice.envelope?.attack ?? 0.005, false);
        }
        if (track.inspectorControls.sliceEnvDecay) {
            track.inspectorControls.sliceEnvDecay.setValue(slice.envelope?.decay ?? 0.1, false);
        }
        if (track.inspectorControls.sliceEnvSustain) {
            track.inspectorControls.sliceEnvSustain.setValue(slice.envelope?.sustain ?? 0.9, false);
        }
        if (track.inspectorControls.sliceEnvRelease) {
            track.inspectorControls.sliceEnvRelease.setValue(slice.envelope?.release ?? 0.2, false);
        }
    }
    
    // Update toggle buttons
    const loopToggleBtn = inspectorWin.element.querySelector(`#sliceLoopToggle-${track.id}`);
    if (loopToggleBtn) {
        loopToggleBtn.textContent = slice.loop ? 'Loop: ON' : 'Loop: OFF';
        loopToggleBtn.classList.toggle('active', slice.loop);
    }
    const reverseToggleBtn = inspectorWin.element.querySelector(`#sliceReverseToggle-${track.id}`);
    if (reverseToggleBtn) {
        reverseToggleBtn.textContent = slice.reverse ? 'Rev: ON' : 'Rev: OFF';
        reverseToggleBtn.classList.toggle('active', slice.reverse);
    }
}

export function updateDrumPadControlsUI(track) {
    if (!track || track.type !== 'DrumSampler') return;
    
    const inspectorWin = localAppServices.getWindowById ? localAppServices.getWindowById(`inspector-${track.id}`) : null;
    if (!inspectorWin || !inspectorWin.element) return;
    
    const selectedPadInfo = inspectorWin.element.querySelector(`#selectedDrumPadInfo-${track.id}`);
    if (selectedPadInfo) {
        selectedPadInfo.textContent = (track.selectedDrumPadForEdit + 1).toString();
    }
    
    const pad = track.drumSamplerPads?.[track.selectedDrumPadForEdit] || {
        volume: 0.7, pitchShift: 0,
        envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
    };
    
    // Update drop zone for selected pad
    const dzContainer = inspectorWin.element.querySelector(`#drumPadDropZoneContainer-${track.id}-${track.selectedDrumPadForEdit}`);
    if (dzContainer) {
        const existingAudioData = {
            originalFileName: pad.originalFileName,
            status: pad.status || (pad.dbKey || pad.audioBufferDataURL ? 'missing' : 'empty')
        };
        dzContainer.innerHTML = createDropZoneHTML(track.id, `drumPadFileInput-${track.id}-${track.selectedDrumPadForEdit}`, 'DrumSampler', track.selectedDrumPadForEdit, existingAudioData);
        
        const dzEl = dzContainer.querySelector('.drop-zone');
        const fileInputEl = dzContainer.querySelector(`#drumPadFileInput-${track.id}-${track.selectedDrumPadForEdit}`);
        if (dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'DrumSampler', track.selectedDrumPadForEdit, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadSampleFile);
        if (fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadSampleFile(e, track.id, 'DrumSampler', track.selectedDrumPadForEdit); };
    }
    
    // Update knob values
    if (track.inspectorControls) {
        if (track.inspectorControls.drumPadVolume) {
            track.inspectorControls.drumPadVolume.setValue(pad.volume, false);
        }
        if (track.inspectorControls.drumPadPitch) {
            track.inspectorControls.drumPadPitch.setValue(pad.pitchShift, false);
        }
        if (track.inspectorControls.drumPadEnvAttack) {
            track.inspectorControls.drumPadEnvAttack.setValue(pad.envelope?.attack ?? 0.005, false);
        }
        if (track.inspectorControls.drumPadEnvDecay) {
            track.inspectorControls.drumPadEnvDecay.setValue(pad.envelope?.decay ?? 0.2, false);
        }
        if (track.inspectorControls.drumPadEnvSustain) {
            track.inspectorControls.drumPadEnvSustain.setValue(pad.envelope?.sustain ?? 0, false);
        }
        if (track.inspectorControls.drumPadEnvRelease) {
            track.inspectorControls.drumPadEnvRelease.setValue(pad.envelope?.release ?? 0.1, false);
        }
    }
}

export function renderDrumSamplerPads(track) {
    if (!track || track.type !== 'DrumSampler') return;
    
    const inspectorWin = localAppServices.getWindowById ? localAppServices.getWindowById(`inspector-${track.id}`) : null;
    if (!inspectorWin || !inspectorWin.element) return;
    
    const container = inspectorWin.element.querySelector(`#drumPadsGridContainer-${track.id}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    const pads = track.drumSamplerPads || [];
    const numPads = Math.min(pads.length, Constants.numDrumSamplerPads);
    
    for (let i = 0; i < numPads; i++) {
        const pad = pads[i];
        const isSelected = i === track.selectedDrumPadForEdit;
        const hasContent = pad && (pad.audioBuffer || pad.audioBufferDataURL || pad.dbKey);
        const status = pad?.status || 'empty';
        
        const padEl = document.createElement('button');
        padEl.className = `drum-pad p-3 text-sm rounded border transition-colors ${
            isSelected ? 'ring-2 ring-amber-500 bg-amber-100 dark:bg-amber-900' : 
            hasContent ? 'bg-orange-300 dark:bg-orange-700 hover:bg-orange-400 dark:hover:bg-orange-600' : 
            'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600'
        } border-gray-300 dark:border-slate-500`;
        padEl.dataset.padIndex = i;
        padEl.innerHTML = `<div class="font-bold text-center">${i + 1}</div><div class="text-[10px] text-center opacity-75">${
            hasContent ? (pad.originalFileName?.substring(0, 8) || '●') : status === 'missing' ? '⚠️' : '—'
        }</div>`;
        padEl.title = `Pad ${i + 1}${hasContent ? ` (${pad.originalFileName || 'sample'})` : ''} - Click to edit`;
        
        padEl.addEventListener('click', () => {
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Select Drum Pad ${i + 1} on ${track.name}`);
            }
            track.selectedDrumPadForEdit = i;
            renderDrumSamplerPads(track);
            updateDrumPadControlsUI(track);
        });
        
        // Double-click to preview/play the pad
        padEl.addEventListener('dblclick', () => {
            if (track.playDrumPad && hasContent) {
                track.playDrumPad(i);
            }
        });
        
        container.appendChild(padEl);
    }
}

// --- Timeline State ---
let timelineState = {
    pixelsPerSecond: 50,
    scrollX: 0,
    scrollY: 0,
    playheadPosition: 0,
    selectedClipId: null,
    isDraggingClip: false,
    dragStartX: 0,
    dragClipStartX: 0,
    selectedTempoRampId: null
};

// --- Timeline Functions (Stubs) ---

// --- Tap Tempo ---
const TAP_TIMEOUT_MS = 2000;
let tapTimes = [];

export function handleTapTempo() {
    const now = performance.now();
    
    // Reset if too much time has passed since last tap
    if (tapTimes.length > 0 && (now - tapTimes[tapTimes.length - 1]) > TAP_TIMEOUT_MS) {
        tapTimes = [];
    }
    
    tapTimes.push(now);
    
    // Keep only the last 8 taps
    if (tapTimes.length > 8) {
        tapTimes.shift();
    }
    
    // Need at least 2 taps to calculate tempo
    if (tapTimes.length < 2) {
        return null;
    }
    
    // Calculate average interval between taps
    let totalInterval = 0;
    for (let i = 1; i < tapTimes.length; i++) {
        totalInterval += tapTimes[i] - tapTimes[i - 1];
    }
    const avgInterval = totalInterval / (tapTimes.length - 1);
    
    // Convert interval (ms) to BPM
    const bpm = 60000 / avgInterval;
    
    // Clamp to reasonable tempo range
    const clampedBpm = Math.min(Constants.MAX_TEMPO, Math.max(Constants.MIN_TEMPO, bpm));
    
    return clampedBpm;
}

export function resetTapTempo() {
    tapTimes = [];
}

export function renderTimeline() {
    const timelineWindow = localAppServices.getWindowById ? localAppServices.getWindowById('timeline') : null;
    if (!timelineWindow || !timelineWindow.element || timelineWindow.isMinimized) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    if (!tracks || tracks.length === 0) {
        const content = timelineWindow.element.querySelector('#timeline-content');
        if (content) content.innerHTML = '<p class="text-center p-4 text-gray-500">No tracks. Add tracks to see timeline.</p>';
        return;
    }

    const content = timelineWindow.element.querySelector('#timeline-content');
    if (!content) return;

    // Calculate total duration
    let maxDuration = 0;
    tracks.forEach(track => {
        if (track.timelineClips) {
            track.timelineClips.forEach(clip => {
                if (clip.startTime !== undefined && clip.duration !== undefined) {
                    maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                }
            });
        }
    });
    maxDuration = Math.max(maxDuration, 10); // At least 10 seconds visible

    const timelineWidth = Math.max(content.offsetWidth - 200, maxDuration * timelineState.pixelsPerSecond);
    const trackLaneHeight = 60;
    const headerWidth = 150;

    // Build timeline HTML
    let html = `
        <div class="timeline-container flex flex-col h-full overflow-hidden">
            <!-- Timeline header with time ruler -->
            <div class="timeline-header flex border-b dark:border-slate-600">
                <div class="track-header-column w-[${headerWidth}px] min-w-[${headerWidth}px] bg-gray-100 dark:bg-slate-700 text-xs font-semibold p-1">
                    Tracks
                </div>
                <div class="timeline-ruler flex-grow relative bg-gray-50 dark:bg-slate-800 h-6" style="min-width: ${timelineWidth}px;">
                    ${renderTimeRuler(maxDuration, timelineState.pixelsPerSecond)}
                </div>
            </div>
            
            <!-- Track lanes -->
            <div class="timeline-tracks flex-grow overflow-auto relative" id="timelineTracksContainer">
                <div class="playhead-line" id="timelinePlayhead" style="position: absolute; left: ${headerWidth + timelineState.playheadPosition * timelineState.pixelsPerSecond}px; top: 0; bottom: 0; width: 2px; background: #ff4444; z-index: 100; pointer-events: none;"></div>
                <div class="tracks-scroll-container" style="min-width: ${timelineWidth + headerWidth}px;">
    `;

    tracks.forEach((track, index) => {
        const laneColor = index % 2 === 0 ? 'bg-gray-100 dark:bg-slate-700' : 'bg-gray-50 dark:bg-slate-800';
        html += `
            <div class="track-lane flex border-b dark:border-slate-600 ${laneColor}" data-track-id="${track.id}" style="height: ${trackLaneHeight}px;">
                <div class="track-header w-[${headerWidth}px] min-w-[${headerWidth}px] flex items-center px-1 border-r dark:border-slate-600 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600" data-track-id="${track.id}">
                    <span class="text-xs truncate flex-grow">${track.name}</span>
                    <span class="text-xs px-1 rounded ${track.isMuted ? 'bg-red-500 text-white' : ''}">${track.isMuted ? 'M' : ''}</span>
                    <span class="text-xs px-1 rounded ${track.isSoloed ? 'bg-yellow-500 text-black' : ''}">${track.isSoloed ? 'S' : ''}</span>
                </div>
                <div class="track-clips-lane relative flex-grow" data-track-id="${track.id}" style="height: ${trackLaneHeight}px; min-width: ${timelineWidth}px;">
                    ${renderTrackClips(track, timelineState.pixelsPerSecond, trackLaneHeight)}
                </div>
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    content.innerHTML = html;
    
    // Setup timeline event listeners
    setupTimelineEventListeners(content, tracks);
    
    // Render waveforms for audio clips (async)
    renderTimelineClipWaveforms(content);
}

function renderTimeRuler(duration, pixelsPerSecond) {
    let html = '';
    const interval = duration > 60 ? 10 : duration > 30 ? 5 : 1; // Adaptive interval
    for (let t = 0; t <= duration; t += interval) {
        const x = t * pixelsPerSecond;
        html += `<div class="absolute text-xs text-gray-500 dark:text-slate-400" style="left: ${x}px; top: 0;">${formatTime(t)}</div>`;
        html += `<div class="absolute w-px h-full bg-gray-300 dark:bg-slate-600" style="left: ${x}px;"></div>`;
    }
    // Add timeline markers
    html += renderTimelineMarkers(pixelsPerSecond, duration);
    return html;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function renderTrackClips(track, pixelsPerSecond, laneHeight) {
    if (!track.timelineClips || track.timelineClips.length === 0) {
        return '';
    }

    let html = '';
    const clipHeight = laneHeight - 8;
    const clipY = 4;

    track.timelineClips.forEach(clip => {
        const x = clip.startTime * pixelsPerSecond;
        const width = Math.max(clip.duration * pixelsPerSecond, 20);
        
        let bgColor = 'bg-blue-500';
        if (clip.type === 'audio') bgColor = 'bg-green-500';
        else if (clip.type === 'sequence') bgColor = 'bg-purple-500';
        
        const isSelected = timelineState.selectedClipId === clip.id;
        const selectedClass = isSelected ? 'ring-2 ring-white ring-offset-1' : '';

        // For audio clips, include a canvas for waveform visualization
        let waveformHtml = '';
        if (clip.type === 'audio' && clip.dbKey) {
            waveformHtml = `<canvas class="clip-waveform absolute inset-0 w-full h-full pointer-events-none" data-clip-id="${clip.id}" data-db-key="${clip.dbKey}"></canvas>`;
        }

        // Add fade handles for audio clips
        let fadeHandlesHtml = '';
        if (clip.type === 'audio') {
            const fadeInWidth = Math.min((clip.fadeIn || 0) * timelineState.pixelsPerSecond, 40);
            const fadeOutWidth = Math.min((clip.fadeOut || 0) * timelineState.pixelsPerSecond, 40);
            fadeHandlesHtml = `
                <div class="fade-handle fade-handle-in absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-yellow-400/30 z-20" data-clip-id="${clip.id}" data-fade-type="in" style="width: ${fadeInWidth}px; background: linear-gradient(to right, rgba(255,255,255,0.3), transparent);"></div>
                <div class="fade-handle fade-handle-out absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-yellow-400/30 z-20" data-clip-id="${clip.id}" data-fade-type="out" style="width: ${fadeOutWidth}px; background: linear-gradient(to left, rgba(255,255,255,0.3), transparent);"></div>
            `;
        }

        html += `
            <div class="timeline-clip absolute rounded cursor-move ${bgColor} ${selectedClass} hover:opacity-90 transition-opacity overflow-hidden"
                 data-clip-id="${clip.id}"
                 data-track-id="${track.id}"
                 style="left: ${x}px; top: ${clipY}px; width: ${width}px; height: ${clipHeight}px;"
                 draggable="true">
                ${waveformHtml}
                ${fadeHandlesHtml}
                <div class="clip-content h-full flex items-center px-1 overflow-hidden relative z-10">
                    <span class="text-xs text-white truncate">${clip.name || clip.type}</span>
                </div>
            </div>
        `;
    });

    return html;
}

/**
 * Renders waveforms for all audio clips in the timeline.
 * Called after renderTimeline() completes.
 */
async function renderTimelineClipWaveforms(content) {
    const canvases = content.querySelectorAll('.clip-waveform');
    
    for (const canvas of canvases) {
        const clipId = canvas.dataset.clipId;
        const dbKey = canvas.dataset.dbKey;
        
        if (!dbKey) continue;
        
        // Get canvas dimensions
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(rect.width, 20);
        const height = Math.max(rect.height, 10);
        
        // Set canvas size
        canvas.width = width;
        canvas.height = height;
        
        // Get audio buffer
        const audioBuffer = await localAppServices.getTimelineClipAudioBuffer?.(clipId, dbKey);
        
        if (audioBuffer) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            
            // Draw waveform using the audio module
            if (localAppServices.drawWaveformOnContext) {
                localAppServices.drawWaveformOnContext(ctx, audioBuffer, width, height, 'rgba(255,255,255,0.8)');
            }
        } else {
            // Draw placeholder pattern
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(0, 0, width, height);
        }
    }
}

function setupTimelineEventListeners(content, tracks) {
    // Track header click to select/open inspector
    content.querySelectorAll('.track-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const trackId = parseInt(header.dataset.trackId);
            if (localAppServices.handleOpenTrackInspector) {
                localAppServices.handleOpenTrackInspector(trackId);
            }
        });
    });

    // Clip click to select
    content.querySelectorAll('.timeline-clip').forEach(clip => {
        clip.addEventListener('click', (e) => {
            e.stopPropagation();
            timelineState.selectedClipId = clip.dataset.clipId;
            renderTimeline(); // Re-render to show selection
        });

        // Clip double-click to open editor
        clip.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const trackId = parseInt(clip.dataset.trackId);
            const track = tracks.find(t => t.id === trackId);
            if (track && track.type !== 'Audio' && localAppServices.handleOpenSequencer) {
                localAppServices.handleOpenSequencer(trackId);
            }
        });

        // Clip drag to move
        clip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'timeline-clip-drag',
                clipId: clip.dataset.clipId,
                trackId: clip.dataset.trackId
            }));
        });


        // Fade handle drag interaction for audio clips
        content.querySelectorAll('.fade-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const clipId = handle.dataset.clipId;
                const fadeType = handle.dataset.fadeType; // 'in' or 'out'
                
                // Find track and clip
                let track = null, clipData = null;
                for (const t of tracks) {
                    if (t.type === 'Audio' && t.timelineClips) {
                        const found = t.timelineClips.find(c => c.id === clipId);
                        if (found) { track = t; clipData = found; break; }
                    }
                }
                if (!track || !clipData) return;

                const startX = e.clientX;
                const pixelsPerSecond = timelineState.pixelsPerSecond;
                const startFadeIn = clipData.fadeIn || 0;
                const startFadeOut = clipData.fadeOut || 0;

                function onMouseMove(moveEvent) {
                    const deltaX = moveEvent.clientX - startX;
                    const deltaTime = deltaX / pixelsPerSecond;
                    let newFadeIn = startFadeIn;
                    let newFadeOut = startFadeOut;
                    if (fadeType === 'in') {
                        newFadeIn = Math.max(0, startFadeIn + deltaTime);
                    } else {
                        newFadeOut = Math.max(0, startFadeOut - deltaTime);
                    }
                    // Live preview - update handle visual
                    const clipEl = content.querySelector(`.timeline-clip[data-clip-id="${clipId}"]`);
                    if (clipEl) {
                        const clipWidth = clipEl.offsetWidth;
                        if (fadeType === 'in') {
                            const w = Math.min(newFadeIn * pixelsPerSecond, clipWidth * 0.5);
                            const overlay = clipEl.querySelector('.fade-handle-in');
                            if (overlay) {
                                overlay.style.width = `${w}px`;
                                overlay.nextSibling?.remove();
                                const ind = document.createElement('div');
                                ind.className = 'absolute top-0 left-0 pointer-events-none z-10';
                                ind.style = `width: ${w}px; height: ${clipEl.offsetHeight}px; background: linear-gradient(to right, rgba(0,0,0,0.4), transparent);`;
                                clipEl.insertBefore(ind, clipEl.firstChild);
                            }
                        } else {
                            const w = Math.min(newFadeOut * pixelsPerSecond, clipWidth * 0.5);
                            const overlay = clipEl.querySelector('.fade-handle-out');
                            if (overlay) {
                                overlay.style.width = `${w}px`;
                            }
                        }
                    }
                }
                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    const deltaX = e.clientX - startX;
                    const deltaTime = deltaX / pixelsPerSecond;
                    let newFadeIn = startFadeIn;
                    let newFadeOut = startFadeOut;
                    if (fadeType === 'in') {
                        newFadeIn = Math.max(0, startFadeIn + deltaTime);
                    } else {
                        newFadeOut = Math.max(0, startFadeOut - deltaTime);
                    }
                    if (track.setClipFade) {
                        track.setClipFade(clipId, newFadeIn, newFadeOut);
                        if (localAppServices.captureStateForUndo) {
                            localAppServices.captureStateForUndo(`Set fade ${fadeType === 'in' ? 'in' : 'out'} for clip`);
                        }
                    }
                    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                }
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
        // Clip context menu for fade editing (audio clips only)
        clip.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const clipId = clip.dataset.clipId;
            const trackId = parseInt(clip.dataset.trackId);
            const track = tracks.find(t => t.id === trackId);
            if (!track || track.type !== 'Audio') return;

            const clipData = track.timelineClips?.find(c => c.id === clipId);
            if (!clipData) return;

            const currentFadeIn = clipData.fadeIn || 0;
            const currentFadeOut = clipData.fadeOut || 0;

            const menuItems = [
                { label: `Fade In: ${currentFadeIn.toFixed(2)}s`, action: () => {} },
                { label: `Fade Out: ${currentFadeOut.toFixed(2)}s`, action: () => {} },
                { separator: true },
                { label: 'Set Fade In (0.1s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, 0.1, currentFadeOut);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade in set to 0.1s`, 1500);
                    }
                }},
                { label: 'Set Fade In (0.25s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, 0.25, currentFadeOut);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade in set to 0.25s`, 1500);
                    }
                }},
                { label: 'Set Fade In (0.5s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, 0.5, currentFadeOut);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade in set to 0.5s`, 1500);
                    }
                }},
                { label: 'Set Fade In (1.0s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, 1.0, currentFadeOut);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade in set to 1.0s`, 1500);
                    }
                }},
                { label: 'Clear Fade In', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, 0, currentFadeOut);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade in cleared`, 1500);
                    }
                }},
                { separator: true },
                { label: 'Set Fade Out (0.1s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, currentFadeIn, 0.1);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade out set to 0.1s`, 1500);
                    }
                }},
                { label: 'Set Fade Out (0.25s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, currentFadeIn, 0.25);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade out set to 0.25s`, 1500);
                    }
                }},
                { label: 'Set Fade Out (0.5s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, currentFadeIn, 0.5);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade out set to 0.5s`, 1500);
                    }
                }},
                { label: 'Set Fade Out (1.0s)', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, currentFadeIn, 1.0);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade out set to 1.0s`, 1500);
                    }
                }},
                { label: 'Clear Fade Out', action: () => {
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(clipId, currentFadeIn, 0);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Fade out cleared`, 1500);
                    }
                }},
                { separator: true },
                { label: 'Gain Envelope', action: () => {} },
                { label: '  Linear Fade (In)', action: () => {
                    if (typeof track.setClipGainEnvelope === 'function') {
                        const fadePoints = [];
                        const clipDuration = clipData.duration || 4;
                        fadePoints.push({ time: 0, value: 0 });
                        fadePoints.push({ time: Math.min(0.5, clipDuration * 0.1), value: 1 });
                        track.setClipGainEnvelope(clipId, fadePoints);
                        showNotification(`Linear fade in applied`, 1500);
                    }
                }},
                { label: '  Linear Fade (Out)', action: () => {
                    if (typeof track.setClipGainEnvelope === 'function') {
                        const fadePoints = [];
                        const clipDuration = clipData.duration || 4;
                        fadePoints.push({ time: Math.max(0, clipDuration - 0.5), value: 1 });
                        fadePoints.push({ time: clipDuration, value: 0 });
                        track.setClipGainEnvelope(clipId, fadePoints);
                        showNotification(`Linear fade out applied`, 1500);
                    }
                }},
                { label: '  Linear Fade (In/Out)', action: () => {
                    if (typeof track.setClipGainEnvelope === 'function') {
                        const fadePoints = [];
                        const clipDuration = clipData.duration || 4;
                        fadePoints.push({ time: 0, value: 0 });
                        fadePoints.push({ time: Math.min(0.5, clipDuration * 0.1), value: 1 });
                        fadePoints.push({ time: Math.max(0, clipDuration - 0.5), value: 1 });
                        fadePoints.push({ time: clipDuration, value: 0 });
                        track.setClipGainEnvelope(clipId, fadePoints);
                        showNotification(`Fade in/out applied`, 1500);
                    }
                }},
                { label: '  Open Envelope Editor...', action: () => {
                    if (typeof track.setClipGainEnvelope === 'function') {
                        openGainEnvelopeEditor(track, clipId, clipData);
                    }
                }},
                { label: '  Clear Envelope', action: () => {
                    if (typeof track.clearClipGainEnvelope === 'function') {
                        track.clearClipGainEnvelope(clipId);
                        showNotification(`Gain envelope cleared`, 1500);
                    }
                }},
                { separator: true },
                { label: 'Transpose', action: () => {} },
                { label: '  +12 (Octave Up)', action: () => {
                    if (typeof track.setClipPitchShift === 'function') {
                        const currentShift = clipData.pitchShift || 0;
                        track.setClipPitchShift(clipId, currentShift + 12);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Transposed +12 semitones`, 1500);
                    }
                }},
                { label: '  +5 (Perfect Fifth)', action: () => {
                    if (typeof track.setClipPitchShift === 'function') {
                        const currentShift = clipData.pitchShift || 0;
                        track.setClipPitchShift(clipId, currentShift + 5);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Transposed +5 semitones`, 1500);
                    }
                }},
                { label: '  +2 (Whole Step)', action: () => {
                    if (typeof track.setClipPitchShift === 'function') {
                        const currentShift = clipData.pitchShift || 0;
                        track.setClipPitchShift(clipId, currentShift + 2);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Transposed +2 semitones`, 1500);
                    }
                }},
                { label: '  -2 (Whole Step Down)', action: () => {
                    if (typeof track.setClipPitchShift === 'function') {
                        const currentShift = clipData.pitchShift || 0;
                        track.setClipPitchShift(clipId, currentShift - 2);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Transposed -2 semitones`, 1500);
                    }
                }},
                { label: '  -5 (Perfect Fourth)', action: () => {
                    if (typeof track.setClipPitchShift === 'function') {
                        const currentShift = clipData.pitchShift || 0;
                        track.setClipPitchShift(clipId, currentShift - 5);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Transposed -5 semitones`, 1500);
                    }
                }},
                { label: '  -12 (Octave Down)', action: () => {
                    if (typeof track.setClipPitchShift === 'function') {
                        const currentShift = clipData.pitchShift || 0;
                        track.setClipPitchShift(clipId, currentShift - 12);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Transposed -12 semitones`, 1500);
                    }
                }},
                { label: '  Reset to 0', action: () => {
                    if (typeof track.setClipPitchShift === 'function') {
                        track.setClipPitchShift(clipId, 0);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Pitch reset to 0 semitones`, 1500);
                    }
                }},
                { separator: true },
                { label: 'Split at Playhead', action: () => {
                    if (typeof track.splitClipAtPlayhead === 'function') {
                        const playheadPos = Tone.Transport.seconds;
                        track.splitClipAtPlayhead(clipId, playheadPos);
                        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                        showNotification(`Clip split at playhead`, 1500);
                    }
                }},
                { separator: true },
                { label: 'Playback Speed', action: () => {} },
                { label: '  0.5x (Half)', action: () => {
                    if (typeof track.setPlaybackRate === 'function') {
                        track.setPlaybackRate(0.5, true);
                        showNotification(`Playback speed: 0.5x`, 1500);
                    }
                }},
                { label: '  0.75x (Three-Quarter)', action: () => {
                    if (typeof track.setPlaybackRate === 'function') {
                        track.setPlaybackRate(0.75, true);
                        showNotification(`Playback speed: 0.75x`, 1500);
                    }
                }},
                { label: '  1.0x (Normal)', action: () => {
                    if (typeof track.setPlaybackRate === 'function') {
                        track.setPlaybackRate(1.0, true);
                        showNotification(`Playback speed: 1.0x`, 1500);
                    }
                }},
                { label: '  1.5x (One-and-Half)', action: () => {
                    if (typeof track.setPlaybackRate === 'function') {
                        track.setPlaybackRate(1.5, true);
                        showNotification(`Playback speed: 1.5x`, 1500);
                    }
                }},
                { label: '  2.0x (Double)', action: () => {
                    if (typeof track.setPlaybackRate === 'function') {
                        track.setPlaybackRate(2.0, true);
                        showNotification(`Playback speed: 2.0x`, 1500);
                    }
                }},
                { label: '🔄 Reverse Audio', action: () => {
                    if (typeof track.reverseAudioClip === 'function') {
                        track.reverseAudioClip(clipId);
                        showNotification(`Audio reversed`, 1500);
                    } else {
                        showNotification(`Reverse not available`, 1500);
                    }
                }},
                { label: '🎵 Transpose Clip', action: () => {} },
                { label: '  -12 st (Octave Down)', action: () => {
                    if (typeof track.transposeAudioClip === 'function') {
                        track.transposeAudioClip(clipId, -12);
                    } else {
                        showNotification(`Transpose not available`, 1500);
                    }
                }},
                { label: '  -5 st', action: () => {
                    if (typeof track.transposeAudioClip === 'function') {
                        track.transposeAudioClip(clipId, -5);
                    } else {
                        showNotification(`Transpose not available`, 1500);
                    }
                }},
                { label: '  -2 st', action: () => {
                    if (typeof track.transposeAudioClip === 'function') {
                        track.transposeAudioClip(clipId, -2);
                    } else {
                        showNotification(`Transpose not available`, 1500);
                    }
                }},
                { label: '  +2 st', action: () => {
                    if (typeof track.transposeAudioClip === 'function') {
                        track.transposeAudioClip(clipId, 2);
                    } else {
                        showNotification(`Transpose not available`, 1500);
                    }
                }},
                { label: '  +5 st', action: () => {
                    if (typeof track.transposeAudioClip === 'function') {
                        track.transposeAudioClip(clipId, 5);
                    } else {
                        showNotification(`Transpose not available`, 1500);
                    }
                }},
                { label: '  +12 st (Octave Up)', action: () => {
                    if (typeof track.transposeAudioClip === 'function') {
                        track.transposeAudioClip(clipId, 12);
                    } else {
                        showNotification(`Transpose not available`, 1500);
                    }
                }},
                { separator: true },
                { label: '📏 Quantize Clip', action: () => {} },
                { label: '  Snap to 1/4 (Quarter)', action: () => {
                    if (typeof track.quantizeAudioClip === 'function') {
                        track.quantizeAudioClip(clipId, '1/4');
                    } else {
                        showNotification(`Quantize not available`, 1500);
                    }
                }},
                { label: '  Snap to 1/8 (Eighth)', action: () => {
                    if (typeof track.quantizeAudioClip === 'function') {
                        track.quantizeAudioClip(clipId, '1/8');
                    } else {
                        showNotification(`Quantize not available`, 1500);
                    }
                }},
                { label: '  Snap to 1/16 (Sixteenth)', action: () => {
                    if (typeof track.quantizeAudioClip === 'function') {
                        track.quantizeAudioClip(clipId, '1/16');
                    } else {
                        showNotification(`Quantize not available`, 1500);
                    }
                }},
                { label: '  Snap to 1/32 (Thirty-second)', action: () => {
                    if (typeof track.quantizeAudioClip === 'function') {
                        track.quantizeAudioClip(clipId, '1/32');
                    } else {
                        showNotification(`Quantize not available`, 1500);
                    }
                }},
                { label: '  Snap Start Only (1/16)', action: () => {
                    if (typeof track.snapAudioClipStart === 'function') {
                        track.snapAudioClipStart(clipId, '1/16');
                    } else {
                        showNotification(`Snap not available`, 1500);
                    }
                }},
                { separator: true },
                { label: '🔁 Loop Mode', action: () => {} },
                { label: '  Enable Loop', action: () => {
                    if (typeof track.setClipLoopMode === 'function') {
                        track.setClipLoopMode(clipId, true, 0, clipData.duration);
                        showNotification(`Loop enabled for clip`, 1500);
                    }
                }},
                { label: '  Disable Loop', action: () => {
                    if (typeof track.setClipLoopMode === 'function') {
                        track.setClipLoopMode(clipId, false);
                        showNotification(`Loop disabled for clip`, 1500);
                    }
                }},
                { label: '  Set Loop Region...', action: () => {
                    const loopStart = prompt('Loop start (seconds from clip start):', '0');
                    const loopEnd = prompt('Loop end (seconds from clip start):', String(clipData.duration));
                    if (loopStart !== null && loopEnd !== null) {
                        if (typeof track.setClipLoopMode === 'function') {
                            track.setClipLoopMode(clipId, true, parseFloat(loopStart), parseFloat(loopEnd));
                            showNotification(`Loop region set: ${loopStart}s - ${loopEnd}s`, 1500);
                        }
                    }
                }},
                { separator: true },
                { label: '🔀 Crossfade', action: () => {} },
                { label: '  Crossfade with Next Clip', action: () => {
                    const sortedClips = [...track.timelineClips].sort((a, b) => a.startTime - b.startTime);
                    const currentSortedIndex = sortedClips.findIndex(c => c.id === clipId);
                    const nextClip = sortedClips[currentSortedIndex + 1];
                    if (nextClip && typeof track.crossfadeClips === 'function') {
                        track.crossfadeClips(clipId, nextClip.id, 0.5);
                    } else {
                        showNotification(`No adjacent clip found for crossfade`, 2000);
                    }
                }},
                { label: '  Crossfade (0.25s)', action: () => {
                    const sortedClips = [...track.timelineClips].sort((a, b) => a.startTime - b.startTime);
                    const currentSortedIndex = sortedClips.findIndex(c => c.id === clipId);
                    const nextClip = sortedClips[currentSortedIndex + 1];
                    if (nextClip && typeof track.crossfadeClips === 'function') {
                        track.crossfadeClips(clipId, nextClip.id, 0.25);
                    } else {
                        showNotification(`No adjacent clip found for crossfade`, 2000);
                    }
                }},
                { label: '  Crossfade (1.0s)', action: () => {
                    const sortedClips = [...track.timelineClips].sort((a, b) => a.startTime - b.startTime);
                    const currentSortedIndex = sortedClips.findIndex(c => c.id === clipId);
                    const nextClip = sortedClips[currentSortedIndex + 1];
                    if (nextClip && typeof track.crossfadeClips === 'function') {
                        track.crossfadeClips(clipId, nextClip.id, 1.0);
                    } else {
                        showNotification(`No adjacent clip found for crossfade`, 2000);
                    }
                }},
                { separator: true },
                { label: '🎵 Convert to MIDI', action: () => {} },
                { label: '  Detect Melody (Normal)', action: () => {
                    if (typeof track.convertAudioToMidi === 'function') {
                        const result = track.convertAudioToMidi(clipId, { sensitivity: 0.5, minNoteDuration: 0.1 });
                        if (result && result.newTrackId) {
                            showNotification(`Converted to MIDI: ${result.noteCount} notes detected. New track created.`, 3000);
                        }
                    } else {
                        showNotification(`Audio to MIDI conversion not available`, 2000);
                    }
                }},
                { label: '  Detect Melody (High Sensitivity)', action: () => {
                    if (typeof track.convertAudioToMidi === 'function') {
                        const result = track.convertAudioToMidi(clipId, { sensitivity: 0.8, minNoteDuration: 0.05 });
                        if (result && result.newTrackId) {
                            showNotification(`Converted to MIDI: ${result.noteCount} notes detected. New track created.`, 3000);
                        }
                    } else {
                        showNotification(`Audio to MIDI conversion not available`, 2000);
                    }
                }},
                { label: '  Detect Melody (Low Sensitivity)', action: () => {
                    if (typeof track.convertAudioToMidi === 'function') {
                        const result = track.convertAudioToMidi(clipId, { sensitivity: 0.3, minNoteDuration: 0.2 });
                        if (result && result.newTrackId) {
                            showNotification(`Converted to MIDI: ${result.noteCount} notes detected. New track created.`, 3000);
                        }
                    } else {
                        showNotification(`Audio to MIDI conversion not available`, 2000);
                    }
                }},
                { label: 'Multiply Clip', action: () => {
                    const countStr = prompt('Number of copies (1-16):', '2');
                    if (countStr !== null) {
                        const count = parseInt(countStr) || 2;
                        if (typeof track.multiplyClip === 'function') {
                            track.multiplyClip(clipId, count, true);
                        } else {
                            showNotification(`Multiply not available`, 1500);
                        }
                    }
                }},
                { label: 'Delete Clip', action: () => {
                    showConfirmationDialog(`Delete clip "${clipData.name || clipId}"?`, 'This cannot be undone.', () => {
                        const idx = track.timelineClips.findIndex(c => c.id === clipId);
                        if (idx !== -1) {
                            if (localAppServices.captureStateForUndo) {
                                localAppServices.captureStateForUndo(`Delete clip on ${track.name}`);
                            }
                            track.timelineClips.splice(idx, 1);
                            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                            showNotification(`Clip deleted`, 1500);
                        }
                    });
                }}
            ];
            createContextMenu(e, menuItems, localAppServices);
        });
    });

    // Timeline track lane drop for audio files
    content.querySelectorAll('.track-clips-lane').forEach(lane => {
        lane.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        lane.addEventListener('drop', async (e) => {
            e.preventDefault();
            const trackId = parseInt(lane.dataset.trackId);
            const rect = lane.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const startTime = x / timelineState.pixelsPerSecond;
            
            // Handle timeline clip drag (move)
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData) {
                try {
                    const data = JSON.parse(jsonData);
                    if (data.type === 'timeline-clip-drag') {
                        const track = tracks.find(t => t.id === parseInt(data.trackId));
                        if (track) {
                            const clip = track.timelineClips?.find(c => c.id === data.clipId);
                            if (clip && typeof track.updateAudioClipPosition === 'function') {
                                await track.updateAudioClipPosition(clip.id, startTime);
                            }
                        }
                        return;
                    }
                } catch (err) {}
            }

            // Handle external file drop
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('audio/')) {
                    const track = tracks.find(t => t.id === trackId);
                    if (track && track.type === 'Audio' && typeof track.addExternalAudioFileAsClip === 'function') {
                        await track.addExternalAudioFileAsClip(file, startTime, file.name);
                        if (localAppServices.captureStateForUndo) {
                            localAppServices.captureStateForUndo(`Add audio clip to ${track.name}`);
                        }
                        renderTimeline();
                    }
                }
            }
        });
    });

    // Click on empty lane area to deselect
    content.querySelectorAll('.track-clips-lane').forEach(lane => {
        lane.addEventListener('click', (e) => {
            if (e.target === lane) {
                timelineState.selectedClipId = null;
                renderTimeline();
            }
        });
    });

    // Timeline ruler click to move playhead
    content.querySelectorAll('.timeline-ruler').forEach(ruler => {
        ruler.addEventListener('click', (e) => {
            const rect = ruler.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const newPosition = x / timelineState.pixelsPerSecond;
            timelineState.playheadPosition = newPosition;
            if (localAppServices.seekToPosition) {
                localAppServices.seekToPosition(newPosition);
            }
            renderTimeline();
        });
        
        // Right-click on timeline ruler to add marker
        ruler.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = ruler.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const position = x / timelineState.pixelsPerSecond;
            showAddMarkerDialog(position);
        });
    });

    // Marker click to jump
    content.querySelectorAll('.timeline-marker').forEach(markerEl => {
        markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const markerId = markerEl.dataset.markerId;
            jumpToMarker(markerId);
        });
        
        // Marker right-click for context menu
        markerEl.addEventListener('contextmenu', (e) => {
            showMarkerContextMenu(e, markerEl.dataset.markerId);
        });
    });
}

export function updatePlayheadPosition() {
    if (!localAppServices.getPlaybackMode) return;
    const playbackMode = localAppServices.getPlaybackMode();
    if (playbackMode !== 'timeline') return;

    const currentTime = Tone.Transport.seconds;
    timelineState.playheadPosition = currentTime;

    const playheadEl = document.getElementById('timelinePlayhead');
    if (!playheadEl) return;

    const headerWidth = 150;
    playheadEl.style.left = `${headerWidth + currentTime * timelineState.pixelsPerSecond}px`;
}

export function openTimelineWindow(savedState = null) {
    const windowId = 'timeline';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentHTML = '<div id="timeline-content" class="w-full h-full overflow-hidden bg-gray-200 dark:bg-slate-900"></div>';
    const options = { 
        width: 1000, 
        height: 400, 
        minWidth: 600, 
        minHeight: 200, 
        closable: true, 
        minimizable: true, 
        resizable: true,
        onCloseCallback: () => {
            timelineState.selectedClipId = null;
        }
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

    const win = localAppServices.createWindow(windowId, 'Timeline', contentHTML, options);
    
    // Render timeline after window is created
    setTimeout(() => renderTimeline(), 50);
    
    return win;
}

// --- Scale Hint Overlay Panel ---
export function openScaleHintPanel(savedState = null) {
    const windowId = 'scaleHint';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderScaleHintPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'scaleHintContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 360, 
        height: 320, 
        minWidth: 300, 
        minHeight: 250,
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

    const win = localAppServices.createWindow(windowId, 'Scale Hint Overlay', contentContainer, options);
    
    if (win?.element) {
        renderScaleHintPanelContent();
    }
    
    return win;
}

function renderScaleHintPanelContent() {
    const container = document.getElementById('scaleHintContent');
    if (!container) return;

    const enabled = localAppServices.getScaleHintEnabled?.() ?? false;
    const root = localAppServices.getScaleHintRoot?.() ?? 'C';
    const type = localAppServices.getScaleHintType?.() ?? 'major';
    const scaleTypes = localAppServices.getScaleTypes?.() ?? ['major', 'minor'];
    const scaleNotes = localAppServices.getScaleNotes?.(root, type) ?? [];
    
    const noteColors = {
        'C': 'bg-white dark:bg-gray-100',
        'C#': 'bg-gray-300 dark:bg-gray-600',
        'D': 'bg-white dark:bg-gray-100',
        'D#': 'bg-gray-300 dark:bg-gray-600',
        'E': 'bg-white dark:bg-gray-100',
        'F': 'bg-white dark:bg-gray-100',
        'F#': 'bg-gray-300 dark:bg-gray-600',
        'G': 'bg-white dark:bg-gray-100',
        'G#': 'bg-gray-300 dark:bg-gray-600',
        'A': 'bg-white dark:bg-gray-100',
        'A#': 'bg-gray-300 dark:bg-gray-600',
        'B': 'bg-white dark:bg-gray-100'
    };

    let html = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Scale Hint Overlay</span>
                <button id="scaleHintToggleBtn" class="px-3 py-1 text-xs rounded font-medium ${enabled ? 'bg-green-500 text-white' : 'bg-gray-400 text-gray-800'}">
                    ${enabled ? 'ON' : 'OFF'}
                </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">
                When enabled, notes that are in the selected scale will be highlighted on the piano roll and sequencer.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Root Note</label>
            <div class="grid grid-cols-6 gap-1">
                ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(n => `
                    <button class="root-note-btn px-2 py-1.5 text-xs rounded border ${root === n ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300'}" data-root="${n}">
                        ${n}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div class="mb-4">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scale Type</label>
            <select id="scaleTypeSelect" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-gray-700 dark:text-gray-200">
                ${scaleTypes.map(t => `<option value="${t}" ${type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>`).join('')}
            </select>
        </div>
        
        <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Notes in Scale</div>
            <div class="flex flex-wrap gap-1">
                ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(n => `
                    <div class="w-8 h-8 flex items-center justify-center text-xs font-bold rounded ${scaleNotes.includes(n) ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-slate-800 text-gray-400'} ${noteColors[n]}">
                        ${n}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Toggle button
    container.querySelector('#scaleHintToggleBtn')?.addEventListener('click', () => {
        const newEnabled = !enabled;
        localAppServices.setScaleHintEnabled?.(newEnabled);
        renderScaleHintPanelContent();
    });
    
    // Root note buttons
    container.querySelectorAll('.root-note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            localAppServices.setScaleHintRoot?.(btn.dataset.root);
            renderScaleHintPanelContent();
        });
    });
    
    // Scale type select
    container.querySelector('#scaleTypeSelect')?.addEventListener('change', (e) => {
        localAppServices.setScaleHintType?.(e.target.value);
        renderScaleHintPanelContent();
    });
}

// --- Scale Lock Panel ---
// Scale Lock forces all notes to stay within a musical scale
export function openScaleLockPanel(savedState = null) {
    const windowId = 'scaleLock';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderScaleLockPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'scaleLockContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 320, 
        height: 300, 
        minWidth: 280, 
        minHeight: 250,
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

    const win = localAppServices.createWindow(windowId, 'Scale Lock', contentContainer, options);
    
    if (win?.element) {
        renderScaleLockPanelContent();
    }
    
    return win;
}

function renderScaleLockPanelContent() {
    const container = document.getElementById('scaleLockContent');
    if (!container) return;
    
    const enabled = localAppServices.getScaleLockEnabled?.() ?? false;
    const root = localAppServices.getScaleLockRoot?.() ?? 'C';
    const type = localAppServices.getScaleLockType?.() ?? 'major';
    const mode = localAppServices.getScaleLockMode?.() ?? 'snap';
    const scaleNotes = localAppServices.getScaleNotes?.(root, type) ?? [];
    const scaleTypes = localAppServices.getScaleTypes?.() ?? ['major', 'minor'];
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const html = `
        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium dark:text-slate-200">Scale Lock</span>
                <button id="scaleLockToggleBtn" class="px-3 py-1 text-xs rounded font-medium ${enabled ? 'bg-blue-500 text-white' : 'bg-gray-400 text-gray-800'}">
                    ${enabled ? 'ON' : 'OFF'}
                </button>
            </div>
            
            <p class="text-xs text-gray-600 dark:text-slate-400">
                Forces all notes to stay within the selected scale. Out-of-scale notes are snapped or blocked.
            </p>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Mode</label>
                <div class="flex gap-2 mt-1">
                    <button id="modeSnapBtn" class="flex-1 px-2 py-1 text-xs rounded ${mode === 'snap' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-slate-600 dark:text-slate-200'}">
                        Snap
                    </button>
                    <button id="modeBlockBtn" class="flex-1 px-2 py-1 text-xs rounded ${mode === 'block' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-slate-600 dark:text-slate-200'}">
                        Block
                    </button>
                </div>
                <p class="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    ${mode === 'snap' ? 'Snap: Out-of-scale notes move to nearest in-scale note' : 'Block: Out-of-scale notes are prevented'}
                </p>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Root Note</label>
                <div class="grid grid-cols-6 gap-1 mt-1">
                    ${noteNames.map(n => `
                        <button class="root-note-btn px-1 py-0.5 text-xs rounded ${root === n ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-600 dark:text-slate-200'}" data-root="${n}">
                            ${n}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Scale Type</label>
                <select id="scaleLockTypeSelect" class="w-full mt-1 p-1 border rounded text-xs bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                    ${scaleTypes.map(t => `
                        <option value="${t}" ${type === t ? 'selected' : ''}>${t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    `).join('')}
                </select>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <label class="text-xs font-medium dark:text-slate-300">Scale Notes: ${root} ${type.replace(/_/g, ' ')}</label>
                <div class="flex flex-wrap gap-1 mt-1">
                    ${scaleNotes.map(n => `
                        <span class="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 dark:text-green-200 rounded">${n}</span>
                    `).join('')}
                </div>
            </div>
            
            <div class="border-t dark:border-slate-600 pt-2">
                <button id="syncFromHintBtn" class="w-full px-2 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600">
                    Sync from Scale Hint Settings
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Toggle button
    container.querySelector('#scaleLockToggleBtn')?.addEventListener('click', () => {
        const newEnabled = !enabled;
        localAppServices.setScaleLockEnabled?.(newEnabled);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Scale Lock ${newEnabled ? 'enabled' : 'disabled'}`, 1500);
        }
        renderScaleLockPanelContent();
    });
    
    // Mode buttons
    container.querySelector('#modeSnapBtn')?.addEventListener('click', () => {
        localAppServices.setScaleLockMode?.('snap');
        renderScaleLockPanelContent();
    });
    
    container.querySelector('#modeBlockBtn')?.addEventListener('click', () => {
        localAppServices.setScaleLockMode?.('block');
        renderScaleLockPanelContent();
    });
    
    // Root note buttons
    container.querySelectorAll('.root-note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            localAppServices.setScaleLockRoot?.(btn.dataset.root);
            renderScaleLockPanelContent();
        });
    });
    
    // Scale type select
    container.querySelector('#scaleLockTypeSelect')?.addEventListener('change', (e) => {
        localAppServices.setScaleLockType?.(e.target.value);
        renderScaleLockPanelContent();
    });
    
    // Sync from hint button
    container.querySelector('#syncFromHintBtn')?.addEventListener('click', () => {
        const hintRoot = localAppServices.getScaleHintRoot?.() ?? 'C';
        const hintType = localAppServices.getScaleHintType?.() ?? 'major';
        localAppServices.setScaleLockRoot?.(hintRoot);
        localAppServices.setScaleLockType?.(hintType);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Synced to ${hintRoot} ${hintType}`, 1500);
        }
        renderScaleLockPanelContent();
    });
}

// --- Undo/Redo History Panel ---
export function openUndoHistoryPanel(savedState = null) {
    const windowId = 'undoHistory';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateUndoHistoryPanel();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'undoHistoryContent';
    contentContainer.className = 'p-2 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 300, 
        height: 400, 
        minWidth: 250, 
        minHeight: 200,
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

    const win = localAppServices.createWindow(windowId, 'History', contentContainer, options);
    
    if (win?.element) {
        renderUndoHistoryContent();
    }
    
    return win;
}

export function updateUndoHistoryPanel() {
    const win = localAppServices.getWindowById ? localAppServices.getWindowById('undoHistory') : null;
    if (!win?.element || win.isMinimized) return;
    renderUndoHistoryContent();
}

// --- Keyboard Shortcuts Panel ---
export function openKeyboardShortcutsPanel(savedState = null) {
    const windowId = 'keyboardShortcuts';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderKeyboardShortcutsContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'keyboardShortcutsContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 420, 
        height: 500, 
        minWidth: 350, 
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

    const win = localAppServices.createWindow(windowId, 'Keyboard Shortcuts', contentContainer, options);
    
    if (win?.element) {
        renderKeyboardShortcutsContent();
    }
    
    return win;
}

function renderKeyboardShortcutsContent() {
    const container = document.getElementById('keyboardShortcutsContent');
    if (!container) return;

    const shortcuts = [
        { category: 'Transport', items: [
            { key: 'Space', desc: 'Play / Pause' },
            { key: 'Enter', desc: 'Toggle Record Arm' },
            { key: 'Escape', desc: 'Stop All / Close Windows' },
            { key: 'L', desc: 'Toggle Loop Region' },
            { key: 'M', desc: 'Toggle Metronome' },
        ]},
        { category: 'Tempo', items: [
            { key: '←', desc: 'Decrease Tempo by 0.1 BPM' },
            { key: '→', desc: 'Increase Tempo by 0.1 BPM' },
            { key: 'Shift+←', desc: 'Decrease Tempo by 1 BPM' },
            { key: 'Shift+→', desc: 'Increase Tempo by 1 BPM' },
        ]},
        { category: 'Octave (Piano Keyboard)', items: [
            { key: 'Z', desc: 'Octave Down' },
            { key: 'X', desc: 'Octave Up' },
        ]},
        { category: 'Track Controls', items: [
            { key: 'S', desc: 'Solo Selected Track' },
            { key: 'R', desc: 'Arm Selected Track for Recording' },
        ]},
        { category: 'Undo/Redo', items: [
            { key: 'Ctrl+Z', desc: 'Undo' },
            { key: 'Ctrl+Y', desc: 'Redo' },
        ]},
        { category: 'General', items: [
            { key: '?', desc: 'Show this Shortcuts Panel' },
            { key: 'Ctrl+S', desc: 'Save Project' },
            { key: 'Ctrl+O', desc: 'Load Project' },
            { key: 'F', desc: 'Toggle Fullscreen' },
        ]},
    ];

    let html = `<div class="space-y-4">`;
    shortcuts.forEach(section => {
        html += `
            <div class="bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 overflow-hidden">
                <div class="bg-gray-50 dark:bg-slate-600 px-3 py-2 border-b border-gray-200 dark:border-slate-500">
                    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">${section.category}</h3>
                </div>
                <div class="p-2 space-y-1">`;
        section.items.forEach(item => {
            html += `
                    <div class="flex items-center justify-between py-1 px-2 hover:bg-gray-50 dark:hover:bg-slate-600 rounded">
                        <span class="text-xs text-gray-600 dark:text-gray-300">${item.desc}</span>
                        <kbd class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-500 rounded shadow-sm">${item.key}</kbd>
                    </div>`;
        });
        html += `</div></div>`;
    });
    html += `</div>`;

    container.innerHTML = html;
}

/**
 * Opens the MIDI Mappings panel showing all current CC mappings.
 */
export function openMidiMappingsPanel(savedState) {
    const windowId = 'midiMappings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateMidiMappingsPanel();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'midiMappingsContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 400, 
        height: 350, 
        minWidth: 300, 
        minHeight: 200,
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

    const win = localAppServices.createWindow(windowId, 'MIDI Mappings', contentContainer, options);
    
    if (win?.element) {
        renderMidiMappingsContent();
    }
    
    return win;
}

/**
 * Renders the MIDI mappings content.
 */
function renderMidiMappingsContent() {
    const container = document.getElementById('midiMappingsContent');
    if (!container) return;

    const mappings = localAppServices.getMidiMappings ? localAppServices.getMidiMappings() : {};
    const mappingKeys = Object.keys(mappings);
    
    let html = `
        <div class="mb-3 flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">
                ${mappingKeys.length} mapping${mappingKeys.length !== 1 ? 's' : ''}
            </span>
            <button id="clearAllMidiMappingsBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 ${mappingKeys.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${mappingKeys.length === 0 ? 'disabled' : ''}>
                Clear All
            </button>
        </div>
    `;
    
    if (mappingKeys.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No MIDI mappings configured.</p>
                <p class="text-xs mt-2">Click the "Learn" button in the global controls, then move a CC knob while a parameter is selected.</p>
            </div>
        `;
    } else {
        html += `<div class="space-y-2">`;
        
        mappingKeys.forEach(key => {
            const mapping = mappings[key];
            const ccMatch = key.match(/cc(\d+)_ch(\d+)/);
            const ccNumber = ccMatch ? ccMatch[1] : '?';
            const channel = ccMatch ? ccMatch[2] : '?';
            
            // Get display name for target
            let targetName = mapping.paramPath;
            if (mapping.type === 'master') {
                targetName = `Master: ${mapping.paramPath}`;
            } else if (mapping.type === 'track' && mapping.targetId !== null) {
                const track = localAppServices.getTrackById ? localAppServices.getTrackById(mapping.targetId) : null;
                const trackName = track ? track.name : `Track ${mapping.targetId}`;
                targetName = `${trackName}: ${mapping.paramPath}`;
            }
            
            html += `
                <div class="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                    <div>
                        <span class="font-mono text-xs text-purple-600 dark:text-purple-400">CC${ccNumber}</span>
                        <span class="text-xs text-gray-400 dark:text-gray-500">ch${channel}</span>
                        <span class="mx-2 text-gray-300 dark:text-gray-600">→</span>
                        <span class="text-sm text-gray-700 dark:text-gray-200">${targetName}</span>
                    </div>
                    <button class="remove-midi-mapping-btn px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400" data-mapping-key="${key}">
                        ✕
                    </button>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    
    // Add event listeners
    const clearBtn = container.querySelector('#clearAllMidiMappingsBtn');
    if (clearBtn && !clearBtn.disabled) {
        clearBtn.addEventListener('click', async () => {
            if (localAppServices.showConfirmationDialog) {
                const confirmed = await localAppServices.showConfirmationDialog('Clear All MIDI Mappings', 'Are you sure you want to remove all MIDI mappings?');
                if (confirmed) {
                    if (localAppServices.clearAllMidiMappings) {
                        localAppServices.clearAllMidiMappings();
                    }
                    renderMidiMappingsContent();
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification('All MIDI mappings cleared.', 2000);
                    }
                }
            } else {
                if (localAppServices.clearAllMidiMappings) {
                    localAppServices.clearAllMidiMappings();
                }
                renderMidiMappingsContent();
            }
        });
    }
    
    container.querySelectorAll('.remove-midi-mapping-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.mappingKey;
            const ccMatch = key.match(/cc(\d+)_ch(\d+)/);
            if (ccMatch && localAppServices.removeMidiMapping) {
                localAppServices.removeMidiMapping(parseInt(ccMatch[1], 10), parseInt(ccMatch[2], 10));
                renderMidiMappingsContent();
            }
        });
    });
}

/**
 * Updates the MIDI Mappings panel if it's open.
 */
export function updateMidiMappingsPanel() {
    const win = localAppServices.getWindowById ? localAppServices.getWindowById('midiMappings') : null;
    if (!win?.element || win.isMinimized) return;
    renderMidiMappingsContent();
}

/**
 * Opens a gain envelope editor for a timeline audio clip.
 * Allows drawing/ editing automation points for clip volume.
 * @param {Object} track - The track object
 * @param {string} clipId - The clip ID
 * @param {Object} clipData - The clip data object
 */
export function openGainEnvelopeEditor(track, clipId, clipData) {
    const existingPanel = document.getElementById('gainEnvelopeEditorPanel');
    if (existingPanel) existingPanel.remove();

    const clipDuration = clipData.duration || 4;
    const envelope = track.getClipGainEnvelope ? track.getClipGainEnvelope(clipId) || [] : [];
    const panel = document.createElement('div');
    panel.id = 'gainEnvelopeEditorPanel';
    panel.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    
    panel.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
            <div class="flex items-center justify-between p-3 border-b dark:border-slate-600 bg-purple-100 dark:bg-purple-900">
                <h3 class="font-semibold text-purple-700 dark:text-purple-300">Gain Envelope: ${escapeHtml(clipData.name || clipId.slice(-6))}</h3>
                <button id="closeEnvelopeEditorBtn" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
            </div>
            <div class="p-4">
                <div class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Click on the envelope line to add points. Drag points to adjust. Right-click to remove.
                    <br>Envelope values range from 0 (silent) to 1 (full volume).
                </div>
                <div id="envelopeCanvasContainer" class="relative bg-gray-100 dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600" style="height: 200px;">
                    <canvas id="envelopeCanvas" class="w-full h-full"></canvas>
                </div>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                        Points: <span id="envelopePointCount">${envelope.length}</span>
                    </span>
                    <div class="flex gap-2">
                        <button id="clearEnvelopeBtn" class="px-3 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded">Clear All</button>
                        <button id="closeEnvelopeBtn" class="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 rounded">Done</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    const canvas = panel.querySelector('#envelopeCanvas');
    const ctx = canvas.getContext('2d');
    const container = panel.querySelector('#envelopeCanvasContainer');
    
    // Set canvas size
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    let points = envelope.length > 0 ? JSON.parse(JSON.stringify(envelope)) : [
        { time: 0, value: 1 },
        { time: clipDuration, value: 1 }
    ];

    // Ensure points are within bounds
    points = points.filter(p => typeof p.time === 'number' && typeof p.value === 'number')
                  .map(p => ({ time: Math.max(0, Math.min(clipDuration, p.time)), value: Math.max(0, Math.min(1, p.value)) }));
    if (points.length === 0) {
        points = [{ time: 0, value: 1 }, { time: clipDuration, value: 1 }];
    }
    points.sort((a, b) => a.time - b.time);

    function drawEnvelope() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background grid
        ctx.strokeStyle = 'rgba(128,128,128,0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (canvas.height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        for (let i = 0; i <= 8; i++) {
            const x = (canvas.width / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Draw envelope line
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        points.forEach((p, i) => {
            const x = (p.time / clipDuration) * canvas.width;
            const y = canvas.height - (p.value * canvas.height);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Fill area under envelope
        ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
        ctx.beginPath();
        points.forEach((p, i) => {
            const x = (p.time / clipDuration) * canvas.width;
            const y = canvas.height - (p.value * canvas.height);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.lineTo((points[points.length - 1].time / clipDuration) * canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();
        
        // Draw points
        points.forEach((p, i) => {
            const x = (p.time / clipDuration) * canvas.width;
            const y = canvas.height - (p.value * canvas.height);
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 || i === points.length - 1 ? '#6366f1' : '#8b5cf6';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    function updatePointCount() {
        const countEl = panel.querySelector('#envelopePointCount');
        if (countEl) countEl.textContent = points.length;
    }

    function findNearestPoint(mouseX, mouseY) {
        const time = (mouseX / canvas.width) * clipDuration;
        const value = 1 - (mouseY / canvas.height);
        let nearest = null;
        let minDist = Infinity;
        points.forEach((p, i) => {
            const dx = p.time - time;
            const dy = p.value - value;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist && dist < 0.05) {
                minDist = dist;
                nearest = i;
            }
        });
        return nearest;
    }

    let draggingPoint = null;

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const idx = findNearestPoint(mouseX, mouseY);
        if (idx !== null) {
            draggingPoint = idx;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (draggingPoint === null) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const time = Math.max(0, Math.min(clipDuration, (mouseX / canvas.width) * clipDuration));
        const value = Math.max(0, Math.min(1, 1 - (mouseY / canvas.height)));
        points[draggingPoint] = { time, value };
        drawEnvelope();
    });

    canvas.addEventListener('mouseup', () => {
        if (draggingPoint !== null) {
            draggingPoint = null;
            updatePointCount();
        }
    });

    canvas.addEventListener('click', (e) => {
        if (draggingPoint !== null) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const time = Math.max(0, Math.min(clipDuration, (mouseX / canvas.width) * clipDuration));
        const value = Math.max(0, Math.min(1, 1 - (mouseY / canvas.height)));
        
        // Check if clicking near existing point
        const idx = findNearestPoint(mouseX, mouseY);
        if (idx === null) {
            // Add new point
            points.push({ time, value });
            points.sort((a, b) => a.time - b.time);
            updatePointCount();
            drawEnvelope();
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const idx = findNearestPoint(mouseX, mouseY);
        if (idx !== null && points.length > 2) {
            points.splice(idx, 1);
            updatePointCount();
            drawEnvelope();
        }
    });

    // Button handlers
    panel.querySelector('#closeEnvelopeEditorBtn').addEventListener('click', () => panel.remove());
    panel.querySelector('#closeEnvelopeBtn').addEventListener('click', () => panel.remove());
    panel.querySelector('#clearEnvelopeBtn').addEventListener('click', () => {
        points = [{ time: 0, value: 1 }, { time: clipDuration, value: 1 }];
        updatePointCount();
        drawEnvelope();
    });

    // Save on close
    panel.addEventListener('click', (e) => {
        if (e.target === panel) {
            // Save envelope
            if (track.setClipGainEnvelope) {
                track.setClipGainEnvelope(clipId, points);
                showNotification('Gain envelope saved', 1500);
            }
            panel.remove();
        }
    });

    drawEnvelope();
    updatePointCount();
}

export function renderUndoHistoryContent() {
    const container = document.getElementById('undoHistoryContent');
    if (!container) return;
    
    const undoStack = localAppServices.getUndoStack ? localAppServices.getUndoStack() : [];
    const redoStack = localAppServices.getRedoStack ? localAppServices.getRedoStack() : [];
    
    let html = '<div class="text-xs text-slate-500 dark:text-slate-400 mb-2">Click an item to undo/redo to that state</div>';
    
    // Current state indicator
    html += '<div class="border rounded p-2 mb-2 bg-purple-100 dark:bg-purple-900 dark:border-purple-700">';
    html += '<div class="font-semibold text-purple-700 dark:text-purple-300 text-sm">● Current State</div>';
    html += '<div class="text-xs text-purple-600 dark:text-purple-400">This is your current project state</div>';
    html += '</div>';
    
    // Undo stack (most recent first, so reverse the display order)
    if (undoStack.length > 0) {
        html += '<div class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 mt-2">Undo History (' + undoStack.length + ')</div>';
        // Display from newest to oldest (which is the natural order of the stack)
        for (let i = undoStack.length - 1; i >= 0; i--) {
            const action = undoStack[i];
            html += `<div class="undo-history-item border rounded p-1.5 mb-1 bg-white dark:bg-slate-700 dark:border-slate-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-600 text-xs" data-action="undo-to" data-index="${i}">`;
            html += `<div class="flex items-center gap-1">`;
            html += `<span class="text-slate-400">↶</span>`;
            html += `<span class="truncate">${escapeHtml(action.description || 'Unknown action')}</span>`;
            html += `</div></div>`;
        }
    }
    
    // Redo stack (most recent first)
    if (redoStack.length > 0) {
        html += '<div class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 mt-2">Redo History (' + redoStack.length + ')</div>';
        for (let i = redoStack.length - 1; i >= 0; i--) {
            const action = redoStack[i];
            html += `<div class="redo-history-item border rounded p-1.5 mb-1 bg-gray-200 dark:bg-slate-600 dark:border-slate-500 cursor-pointer hover:bg-green-50 dark:hover:bg-slate-500 text-xs" data-action="redo-to" data-index="${i}">`;
            html += `<div class="flex items-center gap-1">`;
            html += `<span class="text-slate-400">↷</span>`;
            html += `<span class="truncate">${escapeHtml(action.description || 'Unknown action')}</span>`;
            html += `</div></div>`;
        }
    }
    
    if (undoStack.length === 0 && redoStack.length === 0) {
        html += '<div class="text-center text-slate-400 dark:text-slate-500 text-xs mt-4">No history yet.<br>Make changes to build history.</div>';
    }
    
    // Clear history button
    html += '<div class="mt-3 pt-2 border-t dark:border-slate-600">';
    html += '<button id="clearHistoryBtn" class="w-full px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800">Clear All History</button>';
    html += '</div>';
    
    container.innerHTML = html;
    
    // Add click handlers
    container.querySelectorAll('.undo-history-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetIndex = parseInt(item.dataset.index, 10);
            undoToIndex(targetIndex);
        });
    });
    
    container.querySelectorAll('.redo-history-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetIndex = parseInt(item.dataset.index, 10);
            redoToIndex(targetIndex);
        });
    });
    
    const clearBtn = container.querySelector('#clearHistoryBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (localAppServices.showConfirmationDialog) {
                localAppServices.showConfirmationDialog('Clear History', 'Are you sure you want to clear all undo/redo history?', () => {
                    clearAllHistory();
                });
            } else {
                clearAllHistory();
            }
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function undoToIndex(targetIndex) {
    const undoStack = localAppServices.getUndoStack ? localAppServices.getUndoStack() : [];
    const stepsToUndo = undoStack.length - 1 - targetIndex;
    
    if (stepsToUndo <= 0) return;
    
    for (let i = 0; i <= stepsToUndo; i++) {
        if (localAppServices.undoLastAction) {
            await localAppServices.undoLastAction();
        }
    }
    updateUndoHistoryPanel();
}

async function redoToIndex(targetIndex) {
    const redoStack = localAppServices.getRedoStack ? localAppServices.getRedoStack() : [];
    const stepsToRedo = redoStack.length - 1 - targetIndex;
    
    if (stepsToRedo <= 0) return;
    
    for (let i = 0; i <= stepsToRedo; i++) {
        if (localAppServices.redoLastAction) {
            await localAppServices.redoLastAction();
        }
    }
    updateUndoHistoryPanel();
}

function clearAllHistory() {
    const undoStack = localAppServices.getUndoStack ? localAppServices.getUndoStack() : [];
    const redoStack = localAppServices.getRedoStack ? localAppServices.getRedoStack() : [];
    
    undoStack.length = 0;
    redoStack.length = 0;
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification('History cleared.', 1500);
    }
    
    updateUndoHistoryPanel();
}

// ============================================
// PROJECT EXPORT PRESETS
// ============================================

/**
 * Opens the Export Presets panel where users can save, load, and manage export configurations.
 */
export function openExportPresetsPanel() {
    const panelId = 'exportPresetsPanel';
    let win = localAppServices.getWindowByIdState ? localAppServices.getWindowByIdState(panelId) : null;
    
    if (win) {
        win.bringToFront();
        return;
    }
    
    win = new SnugWindow({
        id: panelId,
        title: 'Export Presets',
        width: 450,
        height: 500,
        x: 200,
        y: 100,
        minWidth: 350,
        minHeight: 300,
        onCloseCallback: () => {
            if (localAppServices.removeWindowFromStoreState) {
                localAppServices.removeWindowFromStoreState(panelId);
            }
        }
    });
    
    if (localAppServices.addWindowToStoreState) {
        localAppServices.addWindowToStoreState(panelId, win);
    }
    
    renderExportPresetsContent(win.contentArea);

// ============================================
// TRACK TEMPLATES
// ============================================

/**
 * Opens the Track Templates panel where users can save, load, and manage track templates.
 */
export function openTrackTemplatesPanel() {
    const panelId = 'trackTemplatesPanel';
    let win = localAppServices.getWindowByIdState ? localAppServices.getWindowByIdState(panelId) : null;
    
    if (win) {
        win.bringToFront();
        return;
    }
    
    win = new SnugWindow({
        id: panelId,
        title: 'Track Templates',
        width: 500,
        height: 550,
        x: 200,
        y: 100,
        minWidth: 350,
        minHeight: 300,
        onCloseCallback: () => {
            if (localAppServices.removeWindowFromStoreState) {
                localAppServices.removeWindowFromStoreState(panelId);
            }
        }
    });
    
    if (localAppServices.addWindowToStoreState) {
        localAppServices.addWindowToStoreState(panelId, win);
    }
    
    renderTrackTemplatesContent(win.contentArea);
}

/**
 * Renders the content of the Track Templates panel.
 */
function renderTrackTemplatesContent(container) {
    const templateNames = localAppServices.getTrackTemplateNames ? localAppServices.getTrackTemplateNames() : [];
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    container.innerHTML = `
        <div class="p-4 h-full flex flex-col">
            <div class="mb-4">
                <h3 class="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Save Track as Template</h3>
                <div class="mb-2">
                    <label class="text-xs text-slate-600 dark:text-slate-400 block mb-1">Select Track:</label>
                    <select id="trackTemplateTrackSelect" class="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs">
                        <option value="">-- Select a track --</option>
                        ${tracks.map(t => `<option value="${t.id}">${t.name} (${t.type})</option>`).join('')}
                    </select>
                </div>
                <div class="flex gap-2">
                    <input type="text" id="newTrackTemplateName" placeholder="Template name..." class="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs">
                    <button id="saveTrackTemplateBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Save</button>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto">
                <h3 class="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Saved Templates</h3>
                <div id="trackTemplateList" class="space-y-1">
                    ${templateNames.length === 0 ? '<p class="text-xs text-slate-500 italic">No track templates saved yet.</p>' : 
                        templateNames.map(name => {
                            const template = localAppServices.getTrackTemplate ? localAppServices.getTrackTemplate(name) : null;
                            return `
                            <div class="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded px-2 py-2">
                                <div class="flex-1">
                                    <span class="text-xs font-medium">${escapeHtml(name)}</span>
                                    ${template ? `<div class="text-xs text-slate-500 dark:text-slate-400">${template.type}${template.synthEngineType ? ` (${template.synthEngineType})` : ''} • ${template.activeEffects?.length || 0} effects</div>` : ''}
                                </div>
                                <div class="flex gap-1">
                                    <button class="apply-track-template-btn px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" data-template="${escapeHtml(name)}">Apply</button>
                                    <button class="delete-track-template-btn px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-template="${escapeHtml(name)}">Delete</button>
                                </div>
                            </div>
                        `}).join('')
                    }
                </div>
            </div>
            
            <div class="mt-4 pt-2 border-t border-slate-200 dark:border-slate-600">
                <p class="text-xs text-slate-500 dark:text-slate-400 italic">Tip: Track templates save the current settings of a track including effects, synth params, and more.</p>
            </div>
        </div>
    `;
    
    const saveBtn = document.getElementById('saveTrackTemplateBtn');
    const trackSelect = document.getElementById('trackTemplateTrackSelect');
    const nameInput = document.getElementById('newTrackTemplateName');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const trackId = parseInt(trackSelect.value, 10);
            const templateName = nameInput.value.trim();
            
            if (!trackId) {
                showNotification('Please select a track first.', 2000);
                return;
            }
            if (!templateName) {
                showNotification('Please enter a template name.', 2000);
                return;
            }
            
            const track = tracks.find(t => t.id === trackId);
            if (!track) {
                showNotification('Track not found.', 2000);
                return;
            }
            
            const trackData = {
                type: track.type,
                name: track.name,
                volume: track.volume,
                pan: track.pan,
                color: track.color,
                synthEngineType: track.synthEngineType,
                synthParams: track.synthParams,
                activeEffects: track.activeEffects,
                drumSamplerPads: track.drumSamplerPads,
                instrumentSamplerSettings: track.instrumentSamplerSettings,
                slices: track.slices
            };
            
            if (localAppServices.saveTrackTemplate) {
                localAppServices.saveTrackTemplate(templateName, trackData);
                showNotification(`Template "${templateName}" saved!`, 2000);
                renderTrackTemplatesContent(container);
            }
        });
    }
    
    container.querySelectorAll('.delete-track-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const templateName = e.target.dataset.template;
            if (confirm(`Delete template "${templateName}"?`)) {
                if (localAppServices.deleteTrackTemplate) {
                    localAppServices.deleteTrackTemplate(templateName);
                    showNotification(`Template "${templateName}" deleted.`, 2000);
                    renderTrackTemplatesContent(container);
                }
            }
        });
    });
    
    container.querySelectorAll('.apply-track-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const templateName = e.target.dataset.template;
            const tracksForApply = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
            if (tracksForApply.length === 0) {
                showNotification('No tracks available. Create a track first.', 2000);
                return;
            }
            
            const trackOptions = tracksForApply.map(t => `<option value="${t.id}">${t.name} (${t.type})</option>`).join('');
            const dialogHtml = `
                <div class="p-4">
                    <h3 class="text-sm font-semibold mb-2">Apply Template "${escapeHtml(templateName)}"</h3>
                    <p class="text-xs text-slate-600 dark:text-slate-400 mb-2">Select a track to apply this template to:</p>
                    <select id="applyTemplateTrackSelect" class="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs mb-3">
                        ${trackOptions}
                    </select>
                    <div class="flex gap-2 justify-end">
                        <button id="cancelApplyTemplate" class="px-3 py-1 text-xs bg-gray-300 dark:bg-slate-600 rounded hover:bg-gray-400 dark:hover:bg-slate-500">Cancel</button>
                        <button id="confirmApplyTemplate" class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Apply</button>
                    </div>
                </div>
            `;
            
            showCustomModal(dialogHtml, 300);
            
            document.getElementById('cancelApplyTemplate')?.addEventListener('click', () => {
                document.getElementById('customModal')?.remove();
            });
            
            document.getElementById('confirmApplyTemplate')?.addEventListener('click', () => {
                const targetTrackId = parseInt(document.getElementById('applyTemplateTrackSelect').value, 10);
                const targetTrack = tracksForApply.find(t => t.id === targetTrackId);
                
                if (targetTrack && localAppServices.applyTrackTemplate) {
                    localAppServices.applyTrackTemplate(templateName, targetTrack);
                    showNotification(`Template applied to "${targetTrack.name}"!`, 2000);
                    
                    if (localAppServices.updateTrackUI) {
                        localAppServices.updateTrackUI(targetTrackId);
                    }
                }
                
                document.getElementById('customModal')?.remove();
            });
        });
    });
}

export function updateTrackTemplatesPanel() {
    const container = document.getElementById('trackTemplatesContent');
    if (container) {
        renderTrackTemplatesContent(container);
    }
}

// --- End Track Templates ---


}

/**
 * Opens the Project Templates panel where users can save, load, and manage project templates.
 */
export function openProjectTemplatesPanel() {
    const panelId = 'projectTemplatesPanel';
    let win = localAppServices.getWindowByIdState ? localAppServices.getWindowByIdState(panelId) : null;
    
    if (win) {
        win.bringToFront();
        return;
    }
    
    win = new SnugWindow({
        id: panelId,
        title: 'Project Templates',
        width: 500,
        height: 550,
        x: 200,
        y: 100,
        minWidth: 350,
        minHeight: 300,
        onCloseCallback: () => {
            if (localAppServices.removeWindowFromStoreState) {
                localAppServices.removeWindowFromStoreState(panelId);
            }
        }
    });
    
    if (localAppServices.addWindowToStoreState) {
        localAppServices.addWindowToStoreState(panelId, win);
    }
    
    renderProjectTemplatesContent(win.contentArea);
}

/**
 * Renders the content of the Project Templates panel.
 */
function renderProjectTemplatesContent(container) {
    const templateNames = localAppServices.getProjectTemplateNames ? localAppServices.getProjectTemplateNames() : [];
    
    container.innerHTML = `
        <div class="p-4 h-full flex flex-col">
            <div class="mb-4">
                <h3 class="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Save Current as Template</h3>
                <div class="flex gap-2">
                    <input type="text" id="newTemplateName" placeholder="Template name..." class="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs">
                    <button id="saveTemplateBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Save</button>
                </div>
                <div class="flex gap-4 mt-2 text-xs text-slate-600 dark:text-slate-400">
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="includeTracks" checked class="rounded">
                        <span>Include Tracks</span>
                    </label>
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="includeMasterEffects" checked class="rounded">
                        <span>Include Master Effects</span>
                    </label>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto">
                <h3 class="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Saved Templates</h3>
                <div id="templateList" class="space-y-1">
                    ${templateNames.length === 0 ? '<p class="text-xs text-slate-500 italic">No templates saved yet.</p>' : 
                        templateNames.map(name => `
                            <div class="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded px-2 py-2">
                                <div class="flex-1">
                                    <span class="text-xs font-medium">${escapeHtml(name)}</span>
                                    ${getTemplatePreviewInfo(name)}
                                </div>
                                <div class="flex gap-1">
                                    <button class="load-template-btn px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" data-template="${escapeHtml(name)}">Load</button>
                                    <button class="delete-template-btn px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-template="${escapeHtml(name)}">Delete</button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
            
            <div class="mt-4 pt-2 border-t border-slate-200 dark:border-slate-600">
                <p class="text-xs text-slate-500 dark:text-slate-400 italic">Tip: Templates save track settings, effects, and global settings (tempo, volume).</p>
            </div>
        </div>
    `;
    
    // Attach event listeners
    const saveBtn = container.querySelector('#saveTemplateBtn');
    const nameInput = container.querySelector('#newTemplateName');
    const includeTracks = container.querySelector('#includeTracks');
    const includeMasterEffects = container.querySelector('#includeMasterEffects');
    
    saveBtn?.addEventListener('click', () => {
        const templateName = nameInput?.value.trim();
        if (!templateName) {
            localAppServices.showNotification?.('Please enter a template name.', 2000);
            return;
        }
        
        const includeTracksVal = includeTracks?.checked ?? true;
        const includeMasterEffectsVal = includeMasterEffects?.checked ?? true;
        
        const success = localAppServices.saveProjectTemplate?.(templateName, includeTracksVal, includeMasterEffectsVal);
        if (success) {
            localAppServices.showNotification?.(`Template "${templateName}" saved!`, 2000);
            nameInput.value = '';
            renderProjectTemplatesContent(container);
        } else {
            localAppServices.showNotification?.('Failed to save template.', 2000);
        }
    });
    
    nameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveBtn?.click();
    });
    
    // Load buttons
    container.querySelectorAll('.load-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateName = btn.dataset.template;
            if (confirm(`Load template "${templateName}"? This will ${localAppServices.getTracksState?.().length > 0 ? 'clear existing tracks and ' : ''}load the template.`)) {
                const success = localAppServices.loadProjectTemplate?.(templateName);
                if (success) {
                    localAppServices.showNotification?.(`Template "${templateName}" loaded!`, 2000);
                    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                    if (localAppServices.updateMixerWindow) localAppServices.updateMixerWindow();
                } else {
                    localAppServices.showNotification?.('Failed to load template.', 2000);
                }
            }
        });
    });
    
    // Delete buttons
    container.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateName = btn.dataset.template;
            if (confirm(`Delete template "${templateName}"?`)) {
                localAppServices.deleteProjectTemplate?.(templateName);
                localAppServices.showNotification?.(`Template "${templateName}" deleted.`, 1500);
                renderProjectTemplatesContent(container);
            }
        });
    });
}

/**
 * Gets a brief preview info string for a template.
 */
function getTemplatePreviewInfo(templateName) {
    try {
        const template = localAppServices.getProjectTemplate?.(templateName);
        if (!template) return '';
        const parts = [];
        if (template.tracks?.length) parts.push(`${template.tracks.length} track${template.tracks.length !== 1 ? 's' : ''}`);
        if (template.masterEffects?.length) parts.push(`${template.masterEffects.length} master FX`);
        if (template.globalSettings?.tempo) parts.push(`${template.globalSettings.tempo} BPM`);
        return parts.length ? `<div class="text-xs text-slate-500 dark:text-slate-400">${parts.join(' • ')}</div>` : '';
    } catch {
        return '';
    }
}

/**
 * Renders the content of the Export Presets panel.
 */
function renderExportPresetsContent(container) {
    const presetNames = localAppServices.getExportPresetNames ? localAppServices.getExportPresetNames() : [];
    
    container.innerHTML = `
        <div class="p-4 h-full flex flex-col">
            <div class="mb-4">
                <h3 class="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Current Export Settings</h3>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <label class="flex items-center gap-1">
                        <span class="w-20">Format:</span>
                        <select id="exportFormat" class="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1">
                            <option value="wav">WAV</option>
                            <option value="mp3">MP3 (coming soon)</option>
                        </select>
                    </label>
                    <label class="flex items-center gap-1">
                        <span class="w-20">Sample Rate:</span>
                        <select id="exportSampleRate" class="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1">
                            <option value="44100">44.1 kHz</option>
                            <option value="48000">48 kHz</option>
                            <option value="96000">96 kHz</option>
                        </select>
                    </label>
                    <label class="flex items-center gap-1">
                        <span class="w-20">Bit Depth:</span>
                        <select id="exportBitDepth" class="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1">
                            <option value="16">16-bit</option>
                            <option value="24" selected>24-bit</option>
                            <option value="32">32-bit float</option>
                        </select>
                    </label>
                    <label class="flex items-center gap-1">
                        <span class="w-20">Normalize:</span>
                        <input type="checkbox" id="exportNormalize" class="rounded">
                    </label>
                    <label class="flex items-center gap-1">
                        <span class="w-20">Dither:</span>
                        <input type="checkbox" id="exportDither" class="rounded">
                    </label>
                    <label class="flex items-center gap-1">
                        <span class="w-20">Tail (sec):</span>
                        <input type="number" id="exportTail" value="2" min="0" max="10" step="0.5" class="w-16 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1">
                    </label>
                </div>
            </div>
            
            <div class="mb-4">
                <h3 class="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Save New Preset</h3>
                <div class="flex gap-2">
                    <input type="text" id="newPresetName" placeholder="Preset name..." class="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs">
                    <button id="savePresetBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Save</button>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto">
                <h3 class="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Saved Presets</h3>
                <div id="presetList" class="space-y-1">
                    ${presetNames.length === 0 ? '<p class="text-xs text-slate-500 italic">No presets saved yet.</p>' : 
                        presetNames.map(name => `
                            <div class="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded px-2 py-1">
                                <span class="text-xs">${escapeHtml(name)}</span>
                                <div class="flex gap-1">
                                    <button class="load-preset-btn px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" data-preset="${escapeHtml(name)}">Load</button>
                                    <button class="export-preset-btn px-2 py-0.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600" data-preset="${escapeHtml(name)}">Export</button>
                                    <button class="delete-preset-btn px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-preset="${escapeHtml(name)}">Delete</button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
            
            <div class="mt-4 pt-2 border-t border-slate-200 dark:border-slate-600 flex gap-2">
                <button id="exportNowBtn" class="flex-1 px-3 py-2 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 font-semibold">Export Now</button>
                <button id="exportStemsBtn" class="flex-1 px-3 py-2 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Export Stems</button>
            </div>
        </div>
    `;
    
    // Attach event listeners
    const saveBtn = container.querySelector('#savePresetBtn');
    const exportNowBtn = container.querySelector('#exportNowBtn');
    const exportStemsBtn = container.querySelector('#exportStemsBtn');
    
    saveBtn?.addEventListener('click', () => {
        const nameInput = container.querySelector('#newPresetName');
        const presetName = nameInput?.value.trim();
        if (!presetName) {
            localAppServices.showNotification?.('Please enter a preset name.', 2000);
            return;
        }
        
        const presetData = collectExportSettings(container);
        localAppServices.saveExportPreset?.(presetName, presetData);
        nameInput.value = '';
        renderExportPresetsContent(container);
    });
    
    exportNowBtn?.addEventListener('click', () => {
        const settings = collectExportSettings(container);
        localAppServices.exportWithSettings?.(settings);
    });
    
    exportStemsBtn?.addEventListener('click', () => {
        localAppServices.showStemExportDialog?.();
    });
    
    // Preset buttons
    container.querySelectorAll('.load-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetName = btn.dataset.preset;
            const preset = localAppServices.getExportPreset?.(presetName);
            if (preset) {
                applyExportSettings(container, preset);
                localAppServices.showNotification?.(`Loaded preset "${presetName}"`, 1500);
            }
        });
    });
    
    container.querySelectorAll('.export-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetName = btn.dataset.preset;
            const preset = localAppServices.getExportPreset?.(presetName);
            if (preset) {
                localAppServices.exportWithSettings?.(preset);
            }
        });
    });
    
    container.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetName = btn.dataset.preset;
            if (confirm(`Delete preset "${presetName}"?`)) {
                localAppServices.deleteExportPreset?.(presetName);
                renderExportPresetsContent(container);
            }
        });
    });
}

/**
 * Collects the current export settings from the UI.
 */
function collectExportSettings(container) {
    return {
        format: container.querySelector('#exportFormat')?.value || 'wav',
        sampleRate: parseInt(container.querySelector('#exportSampleRate')?.value || '44100'),
        bitDepth: parseInt(container.querySelector('#exportBitDepth')?.value || '24'),
        normalize: container.querySelector('#exportNormalize')?.checked || false,
        dither: container.querySelector('#exportDither')?.checked || false,
        tailSeconds: parseFloat(container.querySelector('#exportTail')?.value || '2'),
        timestamp: Date.now()
    };
}

/**
 * Applies export settings to the UI.
 */
function applyExportSettings(container, preset) {
    if (preset.format) {
        const formatSelect = container.querySelector('#exportFormat');
        if (formatSelect) formatSelect.value = preset.format;
    }
    if (preset.sampleRate) {
        const sampleRateSelect = container.querySelector('#exportSampleRate');
        if (sampleRateSelect) sampleRateSelect.value = preset.sampleRate.toString();
    }
    if (preset.bitDepth) {
        const bitDepthSelect = container.querySelector('#exportBitDepth');
        if (bitDepthSelect) bitDepthSelect.value = preset.bitDepth.toString();
    }
    if (preset.normalize !== undefined) {
        const normalizeCheck = container.querySelector('#exportNormalize');
        if (normalizeCheck) normalizeCheck.checked = preset.normalize;
    }
    if (preset.dither !== undefined) {
        const ditherCheck = container.querySelector('#exportDither');
        if (ditherCheck) ditherCheck.checked = preset.dither;
    }
    if (preset.tailSeconds !== undefined) {
        const tailInput = container.querySelector('#exportTail');
        if (tailInput) tailInput.value = preset.tailSeconds.toString();
    }
}

// ==========================================
// MARKER SYSTEM FUNCTIONS
// ==========================================

/**
 * Renders timeline markers on the ruler.
 * Call this after renderTimeRuler to overlay markers.
 */
function renderTimelineMarkers(pixelsPerSecond, duration) {
    const markers = localAppServices.getTimelineMarkers ? localAppServices.getTimelineMarkers() : [];
    if (!markers || markers.length === 0) return '';
    
    let html = '';
    markers.forEach(marker => {
        const x = marker.position * pixelsPerSecond;
        const displayPosition = formatTime(marker.position);
        
        html += `
            <div class="timeline-marker absolute cursor-pointer group"
                 data-marker-id="${marker.id}"
                 style="left: ${x}px; top: 0; height: 100%; width: 2px; background: ${marker.color}; z-index: 50;"
                 title="${marker.name} (${displayPosition})">
                <div class="marker-flag absolute -top-5 left-1/2 transform -translate-x-1/2 px-1 py-0.5 text-xs text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                     style="background: ${marker.color};">
                    ${marker.name}
                </div>
                <div class="marker-triangle absolute -bottom-1 left-1/2 transform -translate-x-1/2"
                     style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${marker.color};"></div>
            </div>
        `;
    });
    
    return html;
}

/**
 * Shows a dialog to add a new timeline marker.
 * @param {number} position - Position in seconds for the marker
 */
export function showAddMarkerDialog(position) {
    const existingMarkers = localAppServices.getTimelineMarkers ? localAppServices.getTimelineMarkers() : [];
    
    const dialog = document.createElement('div');
    dialog.id = 'add-marker-dialog';
    dialog.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50';
    
    dialog.innerHTML = `
        <div class="bg-slate-800 rounded-xl p-6 w-96 shadow-2xl border border-slate-700">
            <h3 class="text-xl font-bold text-white mb-4">📍 Add Timeline Marker</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Marker Name</label>
                    <input type="text" id="markerName" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                           placeholder="Verse, Chorus, etc." value="Marker ${existingMarkers.length + 1}">
                </div>
                
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Position (seconds)</label>
                    <input type="number" id="markerPosition" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                           step="0.1" min="0" value="${position.toFixed(2)}">
                </div>
                
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Color</label>
                    <div class="flex gap-2 flex-wrap">
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #f59e0b;" data-color="#f59e0b"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #ef4444;" data-color="#ef4444"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #22c55e;" data-color="#22c55e"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #3b82f6;" data-color="#3b82f6"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #a855f7;" data-color="#a855f7"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #ec4899;" data-color="#ec4899"></button>
                    </div>
                    <input type="hidden" id="markerColor" value="#f59e0b">
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button id="cancelMarker" class="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors">Cancel</button>
                <button id="saveMarker" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">Add Marker</button>
            </div>
        </div>
    `;
    
    // Color selection
    let selectedColor = '#f59e0b';
    dialog.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            dialog.querySelectorAll('.color-btn').forEach(b => b.classList.remove('border-white'));
            btn.classList.add('border-white');
            selectedColor = btn.dataset.color;
            dialog.querySelector('#markerColor').value = selectedColor;
        });
    });
    // Select first color by default
    dialog.querySelector('.color-btn').classList.add('border-white');
    
    // Cancel button
    dialog.querySelector('#cancelMarker').addEventListener('click', () => dialog.remove());
    
    // Save button
    dialog.querySelector('#saveMarker').addEventListener('click', () => {
        const name = dialog.querySelector('#markerName').value.trim() || 'Marker';
        const pos = parseFloat(dialog.querySelector('#markerPosition').value) || 0;
        const color = dialog.querySelector('#markerColor').value;
        
        if (localAppServices.addTimelineMarker) {
            localAppServices.addTimelineMarker(name, pos, color);
            showNotification(`Added marker "${name}" at ${formatTime(pos)}`, 2000);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        }
        dialog.remove();
    });
    
    // Close on background click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
    });
    
    document.body.appendChild(dialog);
    dialog.querySelector('#markerName').select();
}

/**
 * Shows a dialog to edit an existing marker.
 * @param {string} markerId - The marker ID to edit
 */
export function showEditMarkerDialog(markerId) {
    const marker = localAppServices.getTimelineMarkerById ? localAppServices.getTimelineMarkerById(markerId) : null;
    if (!marker) return;
    
    const dialog = document.createElement('div');
    dialog.id = 'edit-marker-dialog';
    dialog.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50';
    
    dialog.innerHTML = `
        <div class="bg-slate-800 rounded-xl p-6 w-96 shadow-2xl border border-slate-700">
            <h3 class="text-xl font-bold text-white mb-4">✏️ Edit Marker</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Marker Name</label>
                    <input type="text" id="markerName" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                           value="${marker.name}">
                </div>
                
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Position (seconds)</label>
                    <input type="number" id="markerPosition" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                           step="0.1" min="0" value="${marker.position.toFixed(2)}">
                </div>
                
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Color</label>
                    <div class="flex gap-2 flex-wrap">
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #f59e0b;" data-color="#f59e0b"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #ef4444;" data-color="#ef4444"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #22c55e;" data-color="#22c55e"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #3b82f6;" data-color="#3b82f6"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #a855f7;" data-color="#a855f7"></button>
                        <button class="color-btn w-8 h-8 rounded border-2 border-transparent hover:border-white" style="background: #ec4899;" data-color="#ec4899"></button>
                    </div>
                    <input type="hidden" id="markerColor" value="${marker.color}">
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button id="deleteMarker" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors">Delete</button>
                <button id="cancelEdit" class="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors">Cancel</button>
                <button id="saveEdit" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">Save</button>
            </div>
        </div>
    `;
    
    // Color selection - highlight current color
    dialog.querySelectorAll('.color-btn').forEach(btn => {
        if (btn.dataset.color === marker.color) {
            btn.classList.add('border-white');
        }
        btn.addEventListener('click', () => {
            dialog.querySelectorAll('.color-btn').forEach(b => b.classList.remove('border-white'));
            btn.classList.add('border-white');
            dialog.querySelector('#markerColor').value = btn.dataset.color;
        });
    });
    
    // Cancel button
    dialog.querySelector('#cancelEdit').addEventListener('click', () => dialog.remove());
    
    // Delete button
    dialog.querySelector('#deleteMarker').addEventListener('click', () => {
        if (localAppServices.removeTimelineMarker) {
            localAppServices.removeTimelineMarker(markerId);
            showNotification('Marker deleted', 1500);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        }
        dialog.remove();
    });
    
    // Save button
    dialog.querySelector('#saveEdit').addEventListener('click', () => {
        const name = dialog.querySelector('#markerName').value.trim() || 'Marker';
        const pos = parseFloat(dialog.querySelector('#markerPosition').value) || 0;
        const color = dialog.querySelector('#markerColor').value;
        
        if (localAppServices.updateTimelineMarker) {
            localAppServices.updateTimelineMarker(markerId, { name, position: pos, color });
            showNotification(`Marker updated`, 1500);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        }
        dialog.remove();
    });
    
    // Close on background click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
    });
    
    document.body.appendChild(dialog);
    dialog.querySelector('#markerName').select();
}

/**
 * Shows a context menu for a timeline marker.
 * @param {Event} e - The contextmenu event
 * @param {string} markerId - The marker ID
 */
export function showMarkerContextMenu(e, markerId) {
    e.preventDefault();
    e.stopPropagation();
    
    const marker = localAppServices.getTimelineMarkerById ? localAppServices.getTimelineMarkerById(markerId) : null;
    if (!marker) return;
    
    const menuItems = [
        { label: `📍 ${marker.name}`, action: () => {} },
        { label: `Position: ${formatTime(marker.position)}`, action: () => {} },
        { separator: true },
        { label: 'Jump to Marker', action: () => jumpToMarker(markerId) },
        { label: 'Edit Marker...', action: () => showEditMarkerDialog(markerId) },
        { separator: true },
        { label: 'Delete Marker', action: () => {
            if (localAppServices.removeTimelineMarker) {
                localAppServices.removeTimelineMarker(markerId);
                showNotification('Marker deleted', 1500);
                if (localAppServices.renderTimeline) localAppServices.renderTimeline();
            }
        }}
    ];
    
    createContextMenu(e, menuItems, localAppServices);
}

/**
 * Jumps playback to a marker's position.
 * @param {string} markerId - The marker ID to jump to
 */
export function jumpToMarker(markerId) {
    const marker = localAppServices.getTimelineMarkerById ? localAppServices.getTimelineMarkerById(markerId) : null;
    if (!marker) return;
    
    // Set playhead position
    timelineState.playheadPosition = marker.position;
    
    // Update UI
    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    
    // If there's a seek function, use it
    if (localAppServices.seekToPosition) {
        localAppServices.seekToPosition(marker.position);
    }
    
    showNotification(`Jumped to "${marker.name}" (${formatTime(marker.position)})`, 1500);
}

/**
 * Opens the markers panel to view/manage all markers.
 */
export function openMarkersPanel() {
    const markers = localAppServices.getTimelineMarkers ? localAppServices.getTimelineMarkers() : [];
    
    const existingPanel = document.getElementById('markers-panel-window');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'markers-panel-window';
    panel.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 z-50';
    panel.style.width = '400px';
    panel.style.maxHeight = '70vh';
    
    let markersHTML = '';
    if (markers.length === 0) {
        markersHTML = '<p class="text-slate-500 text-center py-8">No markers yet. Right-click on the timeline ruler to add one.</p>';
    } else {
        markersHTML = `
            <div class="divide-y divide-slate-700">
                ${markers.map(m => `
                    <div class="marker-item flex items-center justify-between px-4 py-3 hover:bg-slate-800 cursor-pointer" data-marker-id="${m.id}">
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full" style="background: ${m.color};"></div>
                            <span class="text-white font-medium">${m.name}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400 text-sm">${formatTime(m.position)}</span>
                            <button class="edit-marker-btn text-slate-500 hover:text-white" title="Edit">✏️</button>
                            <button class="delete-marker-btn text-slate-500 hover:text-red-400" title="Delete">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    panel.innerHTML = `
        <div class="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 class="text-lg font-bold text-white">📍 Timeline Markers</h3>
            <button class="close-panel-btn text-slate-500 hover:text-white text-xl">&times;</button>
        </div>
        <div class="markers-content overflow-y-auto" style="max-height: 50vh;">
            ${markersHTML}
        </div>
        <div class="p-4 border-t border-slate-700 flex gap-2">
            <button id="addMarkerBtn" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">+ Add Marker at Playhead</button>
            <button id="clearAllMarkersBtn" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors ${markers.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}">Clear All</button>
        </div>
    `;
    
    // Close button
    panel.querySelector('.close-panel-btn').addEventListener('click', () => panel.remove());
    
    // Add marker button
    panel.querySelector('#addMarkerBtn').addEventListener('click', () => {
        showAddMarkerDialog(timelineState.playheadPosition || 0);
    });
    
    // Clear all button
    panel.querySelector('#clearAllMarkersBtn').addEventListener('click', () => {
        if (markers.length === 0) return;
        if (confirm('Delete all markers?')) {
            if (localAppServices.clearAllTimelineMarkers) {
                localAppServices.clearAllTimelineMarkers();
                showNotification('All markers cleared', 1500);
                panel.remove();
                if (localAppServices.renderTimeline) localAppServices.renderTimeline();
            }
        }
    });
    
    // Marker item interactions
    panel.querySelectorAll('.marker-item').forEach(item => {
        const markerId = item.dataset.markerId;
        
        // Click to jump
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('edit-marker-btn') && !e.target.classList.contains('delete-marker-btn')) {
                jumpToMarker(markerId);
                panel.remove();
            }
        });
        
        // Edit button
        item.querySelector('.edit-marker-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showEditMarkerDialog(markerId);
            panel.remove();
        });
        
        // Delete button
        item.querySelector('.delete-marker-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (localAppServices.removeTimelineMarker) {
                localAppServices.removeTimelineMarker(markerId);
                showNotification('Marker deleted', 1500);
                panel.remove();
                if (localAppServices.renderTimeline) localAppServices.renderTimeline();
            }
        });
    });
    
    // Close on escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    document.body.appendChild(panel);
}

/**
 * Opens the Tempo Automation panel for managing tempo changes over time.
 */
export function openTempoAutomationPanel(savedState = null) {
    const windowId = 'tempoAutomation';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateTempoAutomationPanel();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tempoAutomationContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const options = { 
        width: 450, 
        height: 400, 
        minWidth: 350, 
        minHeight: 250,
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

    const win = localAppServices.createWindow(windowId, 'Tempo Automation', contentContainer, options);
    
    if (win?.element) {
        renderTempoAutomationContent();
    }
    
    return win;
}

/**
 * Renders the tempo automation content.
 */
function renderTempoAutomationContent() {
    const container = document.getElementById('tempoAutomationContent');
    if (!container) return;

    const tempoRamps = localAppServices.getTempoRamps ? localAppServices.getTempoRamps() : [];
    
    let html = `
        <div class="mb-3 flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">
                ${tempoRamps.length} tempo point${tempoRamps.length !== 1 ? 's' : ''}
            </span>
            <div class="flex gap-2">
                <button id="addTempoPointBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                    + Add Point
                </button>
                <button id="clearAllTempoPointsBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 ${tempoRamps.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${tempoRamps.length === 0 ? 'disabled' : ''}>
                    Clear All
                </button>
            </div>
        </div>
        
        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Current tempo: <span class="font-mono text-purple-600 dark:text-purple-400">${(Tone.Transport.bpm.value || 120).toFixed(1)}</span> BPM
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500">
                Tempo points trigger at their bar position during playback. The tempo changes to the specified BPM when reaching that bar.
            </div>
        </div>
    `;
    
    if (tempoRamps.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No tempo automation points.</p>
                <p class="text-xs mt-2">Add points to create tempo changes during playback.</p>
            </div>
        `;
    } else {
        html += `<div class="space-y-2">`;
        
        // Sort by bar position
        const sortedRamps = [...tempoRamps].sort((a, b) => a.barPosition - b.barPosition);
        
        sortedRamps.forEach(ramp => {
            html += `
                <div class="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 tempo-point-item" data-id="${ramp.id}">
                    <div class="flex items-center gap-3">
                        <div class="flex flex-col">
                            <label class="text-xs text-gray-400 dark:text-gray-500">Bar</label>
                            <input type="number" class="tempo-bar-input w-16 p-1 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200 text-center" 
                                value="${ramp.barPosition}" step="0.5" min="0" data-id="${ramp.id}">
                        </div>
                        <div class="flex flex-col">
                            <label class="text-xs text-gray-400 dark:text-gray-500">BPM</label>
                            <input type="number" class="tempo-bpm-input w-20 p-1 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200 text-center font-mono" 
                                value="${ramp.bpm}" step="0.1" min="20" max="999" data-id="${ramp.id}">
                        </div>
                        <div class="flex flex-col">
                            <label class="text-xs text-gray-400 dark:text-gray-500">Curve</label>
                            <select class="tempo-curve-select p-1 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200" data-id="${ramp.id}">
                                <option value="linear" ${ramp.curve === 'linear' ? 'selected' : ''}>Linear</option>
                                <option value="exponential" ${ramp.curve === 'exponential' ? 'selected' : ''}>Exponential</option>
                            </select>
                        </div>
                    </div>
                    <button class="delete-tempo-point-btn px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" data-id="${ramp.id}">
                        ✕
                    </button>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    
    // Add tempo point button
    const addBtn = document.getElementById('addTempoPointBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            // Default: add at next bar position with current tempo
            const currentBar = localAppServices.getCurrentBar ? localAppServices.getCurrentBar() : 0;
            const currentTempo = Tone.Transport.bpm.value || 120;
            const newBar = Math.max(currentBar, tempoRamps.length > 0 ? Math.max(...tempoRamps.map(r => r.barPosition)) + 4 : 1);
            
            if (localAppServices.addTempoRampPoint) {
                localAppServices.addTempoRampPoint(newBar, currentTempo, 'linear');
                renderTempoAutomationContent();
                showNotification(`Added tempo point at bar ${newBar}`, 1500);
            }
        });
    }
    
    // Clear all button
    const clearBtn = document.getElementById('clearAllTempoPointsBtn');
    if (clearBtn && !clearBtn.disabled) {
        clearBtn.addEventListener('click', () => {
            if (localAppServices.clearTempoRamps) {
                localAppServices.clearTempoRamps();
                renderTempoAutomationContent();
                showNotification('All tempo points cleared', 1500);
            }
        });
    }
    
    // Tempo point inputs
    container.querySelectorAll('.tempo-bar-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const barPosition = parseFloat(e.target.value) || 0;
            const parent = e.target.closest('.tempo-point-item');
            const bpmInput = parent?.querySelector('.tempo-bpm-input');
            const curveSelect = parent?.querySelector('.tempo-curve-select');
            const bpm = parseFloat(bpmInput?.value) || 120;
            const curve = curveSelect?.value || 'linear';
            
            if (localAppServices.updateTempoRampPoint) {
                localAppServices.updateTempoRampPoint(id, barPosition, bpm, curve);
                renderTempoAutomationContent();
            }
        });
    });
    
    container.querySelectorAll('.tempo-bpm-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const bpm = parseFloat(e.target.value) || 120;
            const parent = e.target.closest('.tempo-point-item');
            const barInput = parent?.querySelector('.tempo-bar-input');
            const curveSelect = parent?.querySelector('.tempo-curve-select');
            const barPosition = parseFloat(barInput?.value) || 0;
            const curve = curveSelect?.value || 'linear';
            
            if (localAppServices.updateTempoRampPoint) {
                localAppServices.updateTempoRampPoint(id, barPosition, bpm, curve);
            }
        });
    });
    
    container.querySelectorAll('.tempo-curve-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const curve = e.target.value;
            const parent = e.target.closest('.tempo-point-item');
            const barInput = parent?.querySelector('.tempo-bar-input');
            const bpmInput = parent?.querySelector('.tempo-bpm-input');
            const barPosition = parseFloat(barInput?.value) || 0;
            const bpm = parseFloat(bpmInput?.value) || 120;
            
            if (localAppServices.updateTempoRampPoint) {
                localAppServices.updateTempoRampPoint(id, barPosition, bpm, curve);
            }
        });
    });
    
    // Delete buttons
    container.querySelectorAll('.delete-tempo-point-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (localAppServices.removeTempoRampPoint) {
                localAppServices.removeTempoRampPoint(id);
                renderTempoAutomationContent();
                showNotification('Tempo point removed', 1500);
            }
        });
    });
}

/**
 * Updates the tempo automation panel with current data.
 */
export function updateTempoAutomationPanel() {
    const container = document.getElementById('tempoAutomationContent');
    if (container) {
        renderTempoAutomationContent();
    }
}

// --- Chord Memory Panel ---

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
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
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
function renderPatternChainsContent() {
    const container = document.getElementById('patternChainsContent');
    if (!container) return;

    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const sequencerTracks = tracks.filter(t => t.type !== 'Audio');
    
    let html = `
        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Pattern Chains</strong> let you chain multiple sequences together for longer arrangements. 
                Each pattern can repeat multiple times before moving to the next.
            </div>
        </div>
    `;
    
    if (sequencerTracks.length === 0) {
        html += `
            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                No sequencer tracks available. Create a Synth or DrumSampler track first.
            </div>
        `;
        container.innerHTML = html;
        return;
    }

    // Track selector
    html += `
        <div class="mb-3">
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Select Track</label>
            <select id="patternChainTrackSelect" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded">
                ${sequencerTracks.map(t => `<option value="${t.id}">${t.name} (${t.type})</option>`).join('')}
            </select>
        </div>
        
        <div id="patternChainTrackContent" class="space-y-3">
        </div>
    `;
    
    container.innerHTML = html;
    
    // Add event listener for track selection
    const trackSelect = document.getElementById('patternChainTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', () => {
            renderPatternChainTrackContent();
        });
        // Trigger initial render
        renderPatternChainTrackContent();
    }
}

/**
 * Renders the pattern chain content for a specific track.
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
                                value="${pattern.repeatCount}" min="1" max="16" data-chain-id="${chain.id}" data-pattern-index="${patternIndex}">
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
        { id: 'volume', name: 'Volume', min: 0, max: 1 },
        { id: 'pan', name: 'Pan', min: -1, max: 1 },
        { id: 'filterFreq', name: 'Filter Freq', min: 0, max: 1 },
        { id: 'filterRes', name: 'Filter Res', min: 0, max: 1 }
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