// js/EnvelopeIntegration.js - Connect ClipEnvelopeShaper to the main DAW system
// This integrates envelope shaping with clips, tracks, and UI

import { showClipEnvelopeShaper, applyClipEnvelope } from './ClipEnvelopeShaper.js';

// Register the clip envelope application handler when window loads
window.addEventListener('clipEnvelopeApplied', (e) => {
    const { clipId, points } = e.detail;
    console.log(`[EnvelopeIntegration] Clip ${clipId} envelope updated with ${points.length} points`);
    
    // Find the clip and update its envelope property
    const tracks = window.getTracks ? window.getTracks() : [];
    for (const track of tracks) {
        if (track.sequences && track.sequences.length > 0) {
            for (const seq of track.sequences) {
                if (seq.clips) {
                    const clip = seq.clips.find(c => c.id === clipId);
                    if (clip) {
                        clip.envelope = { points: points };
                        console.log(`[EnvelopeIntegration] Applied envelope to clip "${clip.name}"`);
                        // Notify UI to update
                        if (track.updateClipVisual) {
                            track.updateClipVisual(clipId);
                        }
                        return;
                    }
                }
            }
        }
    }
});

// Export for use in other modules
export function openClipEnvelopeShaper(clip, clipData) {
    showClipEnvelopeShaper(clip, clipData);
}