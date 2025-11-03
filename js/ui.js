// js/ui.js - Main UI Orchestrator

// Import initializers from all UI sub-modules
import { initializeInspectorUI } from './ui/inspectorUI.js';
import { initializeMixerUI } from './ui/mixerUI.js';
import { initializeEffectsRackUI } from './ui/effectsRackUI.js';
import { initializeTimelineUI } from './ui/timelineUI.js';
import { initializeSoundBrowserUI } from './ui/soundBrowserUI.js';
import { initializePianoRollUI } from './ui/pianoRollUI.js';
import { initializeYouTubeImporterUI } from './ui/youtubeImporterUI.js';

// Import all exported functions from the sub-modules that main.js needs
import { createKnob } from './ui/knobUI.js';
import { openTrackInspectorWindow, drawWaveform, renderSamplePads, updateSliceEditorUI, renderDrumSamplerPads, updateDrumPadControlsUI, drawInstrumentWaveform } from './ui/inspectorUI.js';
import { openMixerWindow, updateMixerWindow } from './ui/mixerUI.js';
import { openTrackEffectsRackWindow, openMasterEffectsRackWindow, renderEffectsList, renderEffectControls } from './ui/effectsRackUI.js';
import { openTimelineWindow, renderTimeline, updatePlayheadPosition } from './ui/timelineUI.js';
import { openSoundBrowserWindow, renderSoundBrowser, renderDirectoryView } from './ui/soundBrowserUI.js';
import { openPianoRollWindow, updatePianoRollPlayhead } from './ui/pianoRollUI.js';
import { openYouTubeImporterWindow } from './ui/youtubeImporterUI.js';

/**
 * Initializes all UI sub-modules by passing them the appServices object.
 * This function also wires up services that are defined in one UI module but needed by others.
 * @param {object} appServices 
 */
export function initializeUIModule(appServices) {
    // Make createKnob available as a service for other modules to use
    appServices.createKnob = (opts) => createKnob(opts, appServices);
    
    // Initialize all modules
    initializeInspectorUI(appServices);
    initializeMixerUI(appServices);
    initializeEffectsRackUI(appServices);
    initializeTimelineUI(appServices);
    initializeSoundBrowserUI(appServices);
    initializePianoRollUI(appServices);
    initializeYouTubeImporterUI(appServices);
}

// Export all the functions that main.js needs to build the appServices object.
// This file acts as a single entry point for all UI functionality.
export {
    createKnob,
    openTrackInspectorWindow,
    openMixerWindow,
    updateMixerWindow,
    openTrackEffectsRackWindow,
    openMasterEffectsRackWindow,
    renderEffectsList,
    renderEffectControls,
    openTimelineWindow,
    renderTimeline,
    updatePlayheadPosition,
    openSoundBrowserWindow,
    renderSoundBrowser,
    renderDirectoryView,
    openPianoRollWindow,
    updatePianoRollPlayhead,
    openYouTubeImporterWindow,
    drawWaveform,
    drawInstrumentWaveform,
    renderSamplePads,
    updateSliceEditorUI,
    renderDrumSamplerPads,
    updateDrumPadControlsUI,
};
