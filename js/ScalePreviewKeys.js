// js/ScalePreviewKeys.js - Play scale notes on virtual piano when hovering
import { getScaleHighlightNotes, isNoteInScale } from './state.js';

let scalePreviewEnabled = false;
let previewOscillator = null;
let previewGain = null;

// --- Enable/Disable Scale Preview ---
export function isScalePreviewEnabled() { return scalePreviewEnabled; }

export function setScalePreviewEnabled(enabled) {
    scalePreviewEnabled = !!enabled;
    console.log(`[ScalePreviewKeys] Scale preview ${scalePreviewEnabled ? 'enabled' : 'disabled'}`);
}

// --- Play a single preview note ---
function playPreviewNote(pitch) {
    if (typeof Tone === 'undefined') return;
    
    stopPreviewNote();
    
    previewOscillator = new Tone.Oscillator().toDestination();
    previewGain = new Tone.Gain(0.3).connect(previewOscillator);
    
    const freq = Tone.Frequency(pitch, 'midi').toFrequency();
    previewOscillator.frequency.value = freq;
    previewOscillator.start();
}

// --- Stop preview note ---
function stopPreviewNote() {
    if (previewOscillator) {
        previewOscillator.stop();
        previewOscillator.dispose();
        previewOscillator = null;
    }
    previewGain = null;
}

// --- Setup mouseover handlers on a piano key container ---
export function setupScalePreview(container) {
    if (!container) return;
    
    container.addEventListener('mouseover', (e) => {
        if (!scalePreviewEnabled) return;
        const key = e.target.closest('.piano-key');
        if (!key) return;
        
        const pitch = parseInt(key.dataset.pitch || key.dataset.displayPitch);
        if (!isNaN(pitch)) {
            playPreviewNote(pitch);
        }
    });
    
    container.addEventListener('mouseout', (e) => {
        const key = e.target.closest('.piano-key');
        if (key) {
            stopPreviewNote();
        }
    });
}