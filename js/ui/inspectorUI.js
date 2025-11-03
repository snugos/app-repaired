// js/ui/inspectorUI.js

import { createDropZoneHTML, setupGenericDropZoneListeners } from '../utils.js';
import * as Constants from '../constants.js';
import { handleTrackMute, handleTrackSolo, handleTrackArm, handleRemoveTrack, handleOpenEffectsRack, handleOpenPianoRoll as handleOpenSequencer } from '../eventHandlers.js';

let localAppServices = {};

export function initializeInspectorUI(appServices) {
    localAppServices = appServices;
}

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

function buildSynthEngineControls(track, container, engineType) {
    const definitions = localAppServices.effectsRegistryAccess?.synthEngineControlDefinitions?.[engineType] || [];
    if (!container || definitions.length === 0) return;

    definitions.forEach(def => {
        const placeholder = container.querySelector(`#${def.idPrefix}-${track.id}-placeholder`);
        if (!placeholder) return;

        let control;
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
                onValueChange: (val) => track.setSynthParam(def.path, val)
            }, localAppServices);
            placeholder.appendChild(control.element);
        } else if (def.type === 'select') {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex flex-col items-center';
            const label = document.createElement('div');
            label.textContent = def.label;
            label.className = 'knob-label';
            
            const select = document.createElement('select');
            select.className = 'w-full p-1 text-xs border rounded bg-white dark:bg-black border-black dark:border-white text-black dark:text-white';
            def.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                select.appendChild(option);
            });
            select.value = initialValue;
            select.addEventListener('change', (e) => track.setSynthParam(def.path, e.target.value));
            
            wrapper.appendChild(label);
            wrapper.appendChild(select);
            placeholder.appendChild(wrapper);
            control = select;
        }
        
        if (control) {
            track.inspectorControls[def.idPrefix] = control;
        }
    });
}


function buildSynthSpecificInspectorDOM(track) {
    const engineType = track.synthEngineType || 'MonoSynth';
    const definitions = localAppServices.effectsRegistryAccess?.synthEngineControlDefinitions?.[engineType] || [];
    let controlsHTML = `<div id="synthEngineControls-${track.id}" class="grid grid-cols-2 md:grid-cols-3 gap-2 p-1">`;
    definitions.forEach(def => {
        controlsHTML += `<div id="${def.idPrefix}-${track.id}-placeholder"></div>`;
    });
    controlsHTML += `</div>`;
    return controlsHTML;
}

function buildSamplerSpecificInspectorDOM(track) {
    const dropZoneHTML = createDropZoneHTML(track.id, `sampler-file-input-${track.id}`, 'sampler', null, track.samplerAudioData);
    return `<div class="sampler-controls p-1 space-y-2">
        <div id="dropZoneContainer-${track.id}-sampler" class="mb-2">${dropZoneHTML}</div>
        <div class="waveform-section border rounded p-1 bg-white dark:bg-black border-black dark:border-white">
            <canvas id="waveformCanvas-${track.id}" class="w-full h-24 bg-white dark:bg-black rounded shadow-inner"></canvas>
        </div>
        <div class="slice-editor-controls mt-2 p-1 border rounded bg-white dark:bg-black border-black dark:border-white space-y-1" id="slice-editor-container-${track.id}">
            </div>
        <div id="samplePadsContainer-${track.id}" class="grid grid-cols-4 gap-1 mt-2"></div>
    </div>`;
}

function buildDrumSamplerSpecificInspectorDOM(track) {
    return `<div class="drum-sampler-controls p-1 space-y-2">
        <div class="selected-pad-controls p-1 border rounded bg-white dark:bg-black border-black dark:border-white space-y-1" id="drum-pad-editor-container-${track.id}">
            </div>
        <div id="drumPadsGridContainer-${track.id}" class="grid grid-cols-4 gap-1 mt-2"></div>
    </div>`;
}

function buildInstrumentSamplerSpecificInspectorDOM(track) {
     const dropZoneHTML = createDropZoneHTML(track.id, `inst-sampler-file-input-${track.id}`, 'instrumentsampler', null, track.instrumentSamplerSettings);
     return `<div class="instrument-sampler-controls p-1 space-y-2">
        <div id="dropZoneContainer-${track.id}-instrumentsampler" class="mb-2">${dropZoneHTML}</div>
        <div class="waveform-section border rounded p-1 bg-white dark:bg-black border-black dark:border-white">
           <canvas id="instrumentWaveformCanvas-${track.id}" class="w-full h-24 bg-white dark:bg-black rounded shadow-inner"></canvas>
        </div>
        <div class="instrument-params-controls mt-2 p-1 border rounded bg-white dark:bg-black border-black dark:border-white space-y-1 text-xs" id="inst-sampler-controls-container-${track.id}">
            </div>
    </div>`;
}

function buildTrackInspectorContentDOM(track) {
    if (!track) return '<div>Error: Track data not found.</div>';
    let specificControlsHTML = '';
    if (track.type === 'Synth') specificControlsHTML = buildSynthSpecificInspectorDOM(track);
    else if (track.type === 'Sampler') specificControlsHTML = buildSamplerSpecificInspectorDOM(track);
    else if (track.type === 'DrumSampler') specificControlsHTML = buildDrumSamplerSpecificInspectorDOM(track);
    else if (track.type === 'InstrumentSampler') specificControlsHTML = buildInstrumentSamplerSpecificInspectorDOM(track);

    const armedTrackId = localAppServices.getArmedTrackId();
    let sequencerButtonHTML = '';
    if (track.type !== 'Audio') {
        sequencerButtonHTML = `<button id="openSequencerBtn-${track.id}" class="px-1 py-0.5 border rounded">Sequencer</button>`;
    }

    return `
        <div class="track-inspector-content p-1 space-y-1 text-xs">
            <div class="common-controls grid grid-cols-3 gap-1 mb-1">
                <button id="muteBtn-${track.id}" class="${track.isMuted ? 'muted' : ''}">${track.isMuted ? 'Unmute' : 'Mute'}</button>
                <button id="soloBtn-${track.id}" class="${track.isSoloed ? 'soloed' : ''}">${track.isSoloed ? 'Unsolo' : 'Solo'}</button>
                <button id="armInputBtn-${track.id}" class="${armedTrackId === track.id ? 'armed' : ''}">Arm</button>
            </div>
            <div id="volumeKnob-${track.id}-placeholder" class="mb-1"></div>
            <div class="type-specific-controls mt-1 border-t pt-1 border-black dark:border-white">${specificControlsHTML}</div>
            <div class="inspector-nav grid grid-cols-3 gap-1 mt-2">
                <button id="openEffectsBtn-${track.id}">Effects</button>
                ${sequencerButtonHTML}
                <button id="removeTrackBtn-${track.id}">Remove</button>
            </div>
        </div>`;
}

function initializeCommonInspectorControls(track, winEl) {
    winEl.querySelector(`#muteBtn-${track.id}`)?.addEventListener('click', () => handleTrackMute(track.id));
    winEl.querySelector(`#soloBtn-${track.id}`)?.addEventListener('click', () => handleTrackSolo(track.id));
    winEl.querySelector(`#armInputBtn-${track.id}`)?.addEventListener('click', () => handleTrackArm(track.id));
    winEl.querySelector(`#removeTrackBtn-${track.id}`)?.addEventListener('click', () => handleRemoveTrack(track.id));
    winEl.querySelector(`#openEffectsBtn-${track.id}`)?.addEventListener('click', () => handleOpenEffectsRack(track.id));
    winEl.querySelector(`#openSequencerBtn-${track.id}`)?.addEventListener('click', () => handleOpenSequencer(track.id));

    const volumeKnobPlaceholder = winEl.querySelector(`#volumeKnob-${track.id}-placeholder`);
    if (volumeKnobPlaceholder) {
        const knob = localAppServices.createKnob({
            label: 'Volume', min: 0, max: 1.2, step: 0.01,
            initialValue: track.previousVolumeBeforeMute,
            onValueChange: (val, o, fromInteraction) => track.setVolume(val, fromInteraction)
        }, localAppServices);
        volumeKnobPlaceholder.appendChild(knob.element);
        track.inspectorControls.volume = knob;
    }
}

function initializeTypeSpecificInspectorControls(track, winEl) {
    if (track.type === 'Synth') initializeSynthSpecificControls(track, winEl);
    else if (track.type === 'Sampler') initializeSamplerSpecificControls(track, winEl);
    else if (track.type === 'DrumSampler') initializeDrumSamplerSpecificControls(track, winEl);
    else if (track.type === 'InstrumentSampler') initializeInstrumentSamplerSpecificControls(track, winEl);
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
        const dzEl = dzContainerEl.querySelector('.drop-zone');
        if (dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'Sampler', null, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadSampleFile);
        const fileInputEl = dzContainerEl.querySelector(`#sampler-file-input-${track.id}`);
        if (fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadSampleFile(e, track.id, 'Sampler'); };
    }
    renderSamplePads(track);
    const canvas = winEl.querySelector(`#waveformCanvas-${track.id}`);
    if (canvas) {
        track.waveformCanvasCtx = canvas.getContext('2d');
        if(track.audioBuffer?.loaded) drawWaveform(track);
    }
    updateSliceEditorUI(track);
}

function initializeDrumSamplerSpecificControls(track, winEl) {
    renderDrumSamplerPads(track);
    updateDrumPadControlsUI(track);
}

function initializeInstrumentSamplerSpecificControls(track, winEl) {
    const dzContainerEl = winEl.querySelector(`#dropZoneContainer-${track.id}-instrumentsampler`);
    if (dzContainerEl) {
        const dzEl = dzContainerEl.querySelector('.drop-zone');
        if (dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'InstrumentSampler', null, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadSampleFile);
        const fileInputEl = dzContainerEl.querySelector(`#inst-sampler-file-input-${track.id}`);
        if (fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadSampleFile(e, track.id, 'InstrumentSampler'); };
    }
    const canvas = winEl.querySelector(`#instrumentWaveformCanvas-${track.id}`);
    if (canvas) {
        track.instrumentWaveformCanvasCtx = canvas.getContext('2d');
        if(track.instrumentSamplerSettings?.audioBuffer?.loaded) drawInstrumentWaveform(track);
    }
    updateInstrumentSamplerControlsUI(track);
}

export function updateInstrumentSamplerControlsUI(track) {
    const container = document.getElementById(`inst-sampler-controls-container-${track.id}`);
    if (!container) return;

    container.innerHTML = '';
    const settings = track.instrumentSamplerSettings || {};

    const grid = document.createElement('div');
    // --- FIX: Changed grid to 3 columns to better accommodate the new Pitch knob ---
    grid.className = 'grid grid-cols-3 gap-x-2 gap-y-4';

    const envelope = settings.envelope || { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 };
    
    // --- NEW: Add the Pitch Knob ---
    const pitchKnob = localAppServices.createKnob({
        label: "Pitch",
        min: -24,
        max: 24,
        step: 1,
        decimals: 0,
        displaySuffix: " st",
        initialValue: settings.pitchShift || 0,
        onValueChange: (val) => {
            if (track.setInstrumentSamplerPitch) {
                track.setInstrumentSamplerPitch(val);
            }
        }
    }, localAppServices);
    grid.appendChild(pitchKnob.element);

    const attackKnob = localAppServices.createKnob({
        label: "Attack", min: 0.001, max: 2, step: 0.001, decimals: 3,
        initialValue: envelope.attack,
        onValueChange: (val) => { track.instrument.set({ attack: val }); }
    }, localAppServices);
    grid.appendChild(attackKnob.element);
    
    const decayKnob = localAppServices.createKnob({
        label: "Decay", min: 0.001, max: 2, step: 0.001, decimals: 3,
        initialValue: envelope.decay,
        onValueChange: (val) => { track.instrument.set({ decay: val }); }
    }, localAppServices);
    grid.appendChild(decayKnob.element);

    const sustainKnob = localAppServices.createKnob({
        label: "Sustain", min: 0, max: 1, step: 0.01, decimals: 2,
        initialValue: envelope.sustain,
        onValueChange: (val) => { track.instrument.set({ sustain: val }); }
    }, localAppServices);
    grid.appendChild(sustainKnob.element);

    const releaseKnob = localAppServices.createKnob({
        label: "Release", min: 0.001, max: 5, step: 0.001, decimals: 3,
        initialValue: envelope.release,
        onValueChange: (val) => { track.instrument.set({ release: val }); }
    }, localAppServices);
    grid.appendChild(releaseKnob.element);
    
    container.appendChild(grid);
}

export function drawWaveform(track) {
    if (!track || !track.audioBuffer || !track.waveformCanvasCtx) return;
    const ctx = track.waveformCanvasCtx;
    const canvas = ctx.canvas;
    const channelData = track.audioBuffer.getChannelData(0);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    ctx.beginPath();

    const sliceLength = Math.floor(channelData.length / canvas.width);
    for (let i = 0; i < canvas.width; i++) {
        const x = i;
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < sliceLength; j++) {
            const datum = channelData[(i * sliceLength) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        const y_max = (1 - max) * canvas.height / 2;
        const y_min = (1 - min) * canvas.height / 2;
        ctx.moveTo(x, y_max);
        ctx.lineTo(x, y_min);
    }
    ctx.stroke();
}

export function drawInstrumentWaveform(track) {
    if (!track || !track.instrumentSamplerSettings?.audioBuffer || !track.instrumentWaveformCanvasCtx) return;
    const ctx = track.instrumentWaveformCanvasCtx;
    const canvas = ctx.canvas;
    const channelData = track.instrumentSamplerSettings.audioBuffer.getChannelData(0);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    ctx.beginPath();
    
    const sliceLength = Math.floor(channelData.length / canvas.width);
    for (let i = 0; i < canvas.width; i++) {
        const x = i;
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < sliceLength; j++) {
            const datum = channelData[(i * sliceLength) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        const y_max = (1 - max) * canvas.height / 2;
        const y_min = (1 - min) * canvas.height / 2;
        ctx.moveTo(x, y_max);
        ctx.lineTo(x, y_min);
    }
    ctx.stroke();
}

export function renderSamplePads(track) {
    const container = document.getElementById(`samplePadsContainer-${track.id}`);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < (track.slices?.length || 0); i++) {
        const slice = track.slices[i];
        if (!slice) continue;
        const padButton = document.createElement('button');
        padButton.className = 'pad-button text-xs';
        if (i === track.selectedSliceForEdit) {
            padButton.classList.add('selected-for-edit');
        }
        padButton.innerHTML = `<span class="pad-label">Slice ${i + 1}</span>`;
        padButton.addEventListener('click', () => {
            track.selectedSliceForEdit = i;
            localAppServices.playSlicePreview?.(track.id, i);
            renderSamplePads(track);
            updateSliceEditorUI(track);
        });
        container.appendChild(padButton);
    }
}

export function updateSliceEditorUI(track) {
    const container = document.getElementById(`slice-editor-container-${track.id}`);
    if (!container) return;

    const slice = track.slices?.[track.selectedSliceForEdit];
    if (!slice) {
        container.innerHTML = '<p class="text-xs text-center text-black dark:text-white">Select a slice to edit.</p>';
        return;
    }

    container.innerHTML = `<h4 class="font-bold text-center text-xs text-black dark:text-white">Slice ${track.selectedSliceForEdit + 1} Controls</h4>`;
    const controlsGrid = document.createElement('div');
    controlsGrid.className = 'grid grid-cols-2 gap-2 p-1';
    
    const volContainer = document.createElement('div');
    const volKnob = localAppServices.createKnob({
        label: "Volume", min: 0, max: 1, step: 0.01, decimals: 2,
        initialValue: slice.volume,
        onValueChange: (val) => track.setSliceVolume?.(track.selectedSliceForEdit, val)
    }, localAppServices);
    volContainer.appendChild(volKnob.element);
    controlsGrid.appendChild(volContainer);
    
    const pitchContainer = document.createElement('div');
    const pitchKnob = localAppServices.createKnob({
        label: "Pitch", min: -24, max: 24, step: 1, decimals: 0,
        initialValue: slice.pitchShift,
        onValueChange: (val) => track.setSlicePitchShift?.(track.selectedSliceForEdit, val)
    }, localAppServices);
    pitchContainer.appendChild(pitchKnob.element);
    controlsGrid.appendChild(pitchContainer);

    container.appendChild(controlsGrid);
}

export function renderDrumSamplerPads(track) {
    const container = document.getElementById(`drumPadsGridContainer-${track.id}`);
    if (!container) return;
    container.innerHTML = ''; 
    for (let i = 0; i < Constants.numDrumSamplerPads; i++) {
        const padData = track.drumSamplerPads?.[i];
        if (!padData) continue;
        const padButton = document.createElement('button');
        padButton.className = 'pad-button';
        padButton.setAttribute('data-pad-index', i);

        if (i === track.selectedDrumPadForEdit) {
            padButton.classList.add('selected-for-edit');
        }
        padButton.innerHTML = `<span class="pad-label">${padData.originalFileName || `Pad ${i + 1}`}</span>`;
        
        padButton.addEventListener('click', () => {
            track.selectedDrumPadForEdit = i;
            if (padData.dbKey) {
                localAppServices.playDrumSamplerPadPreview?.(track.id, i);
            }
            renderDrumSamplerPads(track);
            updateDrumPadControlsUI(track);
        });

        padButton.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            padButton.classList.add('bg-blue-300', 'dark:bg-blue-800', 'border-blue-500');
        });

        padButton.addEventListener('dragleave', (e) => {
            e.preventDefault();
            padButton.classList.remove('bg-blue-300', 'dark:bg-blue-800', 'border-blue-500');
        });

        padButton.addEventListener('drop', (e) => {
            e.preventDefault();
            padButton.classList.remove('bg-blue-300', 'dark:bg-blue-800', 'border-blue-500');
            
            const soundDataString = e.dataTransfer.getData("application/json");
            if (!soundDataString) return;

            try {
                const soundData = JSON.parse(soundDataString);
                const padIndex = parseInt(padButton.getAttribute('data-pad-index'), 10);
                
                if (soundData.type === 'sound-browser-item' && !isNaN(padIndex)) {
                    localAppServices.loadSoundFromBrowserToTarget?.(soundData, track.id, 'DrumSampler', padIndex);
                }
            } catch (err) {
                console.error("Error parsing dropped sound data:", err);
            }
        });

        container.appendChild(padButton);
    }
}

export function updateDrumPadControlsUI(track) {
    const container = document.getElementById(`drum-pad-editor-container-${track.id}`);
    if (!container) return;
    
    const padIndex = track.selectedDrumPadForEdit;
    const padData = track.drumSamplerPads?.[padIndex];
    if (!padData) return;

    container.innerHTML = `<h4 class="font-bold text-center text-xs text-black dark:text-white">Pad ${padIndex + 1} Controls</h4>`;
    
    const dropZoneHTML = createDropZoneHTML(track.id, `drum-pad-file-input-${padIndex}`, 'drumpad', padIndex, padData);
    container.innerHTML += `<div id="dropZoneContainer-${track.id}-drumpad-${padIndex}">${dropZoneHTML}</div>`;

    const controlsGrid = document.createElement('div');
    controlsGrid.className = 'grid grid-cols-2 gap-2 p-1';

    const volContainer = document.createElement('div');
    const volKnob = localAppServices.createKnob({
        label: "Volume", min: 0, max: 1, step: 0.01, decimals: 2,
        initialValue: padData.volume,
        onValueChange: (val) => track.setDrumSamplerPadVolume?.(padIndex, val)
    }, localAppServices);
    volContainer.appendChild(volKnob.element);
    controlsGrid.appendChild(volContainer);

    const pitchContainer = document.createElement('div');
    const pitchKnob = localAppServices.createKnob({
        label: "Pitch", min: -24, max: 24, step: 1, decimals: 0,
        initialValue: padData.pitchShift,
        onValueChange: (val) => track.setDrumSamplerPadPitch?.(padIndex, val)
    }, localAppServices);
    pitchContainer.appendChild(pitchKnob.element);
    controlsGrid.appendChild(pitchContainer);

    container.appendChild(controlsGrid);
    
    const dzContainerEl = container.querySelector(`#dropZoneContainer-${track.id}-drumpad-${padIndex}`);
    if(dzContainerEl) {
        const dzEl = dzContainerEl.querySelector('.drop-zone');
        if(dzEl) setupGenericDropZoneListeners(dzEl, track.id, 'DrumSampler', padIndex, localAppServices.loadSoundFromBrowserToTarget, localAppServices.loadDrumSamplerPadFile);
        const fileInputEl = dzContainerEl.querySelector(`#drum-pad-file-input-${padIndex}`);
        if(fileInputEl) fileInputEl.onchange = (e) => { localAppServices.loadDrumSamplerPadFile(e, track.id, padIndex); };
    }
}

export function openTrackInspectorWindow(trackId, savedState = null) {
    const track = localAppServices.getTrackById(trackId);
    if (!track) return null;
    const windowId = `trackInspector-${trackId}`;
    if (localAppServices.getOpenWindows().has(windowId) && !savedState) {
        localAppServices.getOpenWindows().get(windowId).restore(); return;
    }
    const contentDOM = buildTrackInspectorContentDOM(track);
    const inspectorWindow = localAppServices.createWindow(windowId, `Inspector: ${track.name}`, contentDOM, { width: 320, height: 450 });
    if (inspectorWindow?.element) {
        initializeCommonInspectorControls(track, inspectorWindow.element);
        initializeTypeSpecificInspectorControls(track, inspectorWindow.element);
    }
}
