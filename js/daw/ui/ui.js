// js/daw/ui/ui.js - Main UI Orchestrator

// Import initializers from all UI sub-modules
import { initializeInspectorUI, openTrackInspectorWindow, renderSamplePads, updateSliceEditorUI, renderDrumSamplerPads, updateDrumPadControlsUI } from '/app/js/daw/ui/inspectorUI.js'; // Corrected path
import { initializeMixerUI, openMixerWindow, updateMixerWindow } from '/app/js/daw/ui/mixerUI.js'; // Corrected path
import { initializeEffectsRackUI, openTrackEffectsRackWindow, openMasterEffectsRackWindow, renderEffectsList, renderEffectControls } from '/app/js/daw/ui/effectsRackUI.js'; // Corrected path
import { initializeSoundBrowserUI, openSoundBrowserWindow, renderSoundBrowser, renderDirectoryView } from '/app/js/daw/ui/soundBrowserUI.js'; // Corrected path
import { initializePianoRollUI, openPianoRollWindow, updatePianoRollPlayhead } from '/app/js/daw/ui/pianoRollUI.js'; // Corrected path
import { initializeYouTubeImporterUI, openYouTubeImporterWindow } from '/app/js/daw/ui/youtubeImporterUI.js'; // Corrected path
import { initializeFileViewerUI, openFileViewerWindow } from '/app/js/daw/ui/fileViewerUI.js'; // Corrected path

import { createKnob } from '/app/js/daw/ui/knobUI.js'; // Corrected path
// Corrected: Import getThemeColors from utils.js, not profileUtils.js
import { getThemeColors } from '/app/js/daw/utils.js'; // Corrected path


/**
 * Initializes all UI sub-modules by passing them the appServices object.
 * This function also wires up services that are defined in one UI module but needed by others.
 * @param {object} appServices 
 */
export function initializeUIModule(appServices) {
    // Make createKnob available as a service for other modules to use
    appServices.createKnob = (opts, captureCallback) => createKnob(opts, captureCallback); // Pass captureCallback

    // Make getThemeColors available as a service
    appServices.getThemeColors = getThemeColors;
    
    // Initialize all modules
    initializeInspectorUI(appServices);
    initializeMixerUI(appServices);
    initializeEffectsRackUI(appServices);
    initializeSoundBrowserUI(appServices);
    initializePianoRollUI(appServices);
    initializeYouTubeImporterUI(appServices);
    initializeFileViewerUI(appServices);
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
    openSoundBrowserWindow,
    renderSoundBrowser,
    renderDirectoryView,
    openPianoRollWindow,
    updatePianoRollPlayhead,
    openYouTubeImporterWindow,
    openFileViewerWindow,
    renderSamplePads,
    updateSliceEditorUI,
    renderDrumSamplerPads,
    updateDrumPadControlsUI,
};