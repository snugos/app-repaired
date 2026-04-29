// js/NoteLengthScaler.js - Scale note lengths by percentage in Piano Roll
// Select notes in piano roll and scale their length by a percentage

let localAppServices = {};

/**
 * Initialize the NoteLengthScaler module
 * @param {Object} appServices - App services from main.js
 */
export function initNoteLengthScaler(appServices) {
    localAppServices = appServices || {};
    console.log('[NoteLengthScaler] Module initialized');
}

/**
 * Scale the duration of selected notes by a percentage factor
 * @param {number} scaleFactor - Multiplier for note duration (e.g., 1.5 for 150%, 0.5 for 50%)
 * @returns {boolean} Success status
 */
export function scaleSelectedNotesLength(scaleFactor) {
    const tracks = localAppServices.getTracks?.();
    if (!tracks || tracks.length === 0) {
        console.warn('[NoteLengthScaler] No tracks available');
        return false;
    }

    // Find the active piano roll track or use first track
    let activeTrack = null;
    if (typeof window.currentPianoRollTrackId !== 'undefined' && window.currentPianoRollTrackId) {
        activeTrack = tracks.find(t => t.id === window.currentPianoRollTrackId);
    }
    if (!activeTrack && tracks.length > 0) {
        activeTrack = tracks[0];
    }
    if (!activeTrack) {
        console.warn('[NoteLengthScaler] No active track found');
        return false;
    }

    const track = activeTrack;
    const activeSeq = track.sequence;

    if (!activeSeq?.data) {
        console.warn('[NoteLengthScaler] No sequence data found');
        return false;
    }

    // Get selected notes from PianoRollEditor if available
    let selectedNoteData = [];
    if (window.selectedNotes && window.selectedNotes.size > 0) {
        // Map the selected note IDs back to actual note objects
        window.selectedNotes.forEach(noteId => {
            // noteId format: "pr-note-{row}-{step}"
            const parts = noteId.split('-');
            if (parts.length >= 4) {
                const row = parseInt(parts[2]);
                const step = parseInt(parts[3]);
                const note = activeSeq.data?.[row]?.[step];
                if (note) {
                    selectedNoteData.push({ row, step, note, noteId });
                }
            }
        });
    }

    if (selectedNoteData.length === 0) {
        localAppServices.showNotification?.('No notes selected. Select notes in piano roll first.', 2000);
        return false;
    }

    // Capture state for undo
    if (track.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo(`Scale note length by ${Math.round(scaleFactor * 100)}%`);
    }

    // Scale the duration of each selected note
    let scaledCount = 0;
    selectedNoteData.forEach(({ row, step, note }) => {
        if (note && typeof note.duration === 'number') {
            const newDuration = note.duration * scaleFactor;
            // Clamp to reasonable bounds (min 0.0625 = 1/64, max 16 beats)
            note.duration = Math.max(0.0625, Math.min(16, newDuration));
            scaledCount++;
        }
    });

    if (scaledCount > 0) {
        // Rebuild the tone sequence to apply changes
        if (track.recreateToneSequence) {
            track.recreateToneSequence(true);
        }
        if (track.appServices?.updateTrackUI) {
            track.appServices.updateTrackUI(track.id, 'sequenceChanged');
        }
        // Refresh piano roll if open
        if (typeof window.updatePianoRollPanel === 'function') {
            window.updatePianoRollPanel();
        }
        localAppServices.showNotification?.(`Scaled ${scaledCount} note(s) to ${Math.round(scaleFactor * 100)}%`, 2000);
        console.log(`[NoteLengthScaler] Scaled ${scaledCount} notes by ${Math.round(scaleFactor * 100)}%`);
        return true;
    }

    return false;
}

/**
 * Show a prompt to scale selected notes by a percentage
 */
export function openNoteLengthScaler() {
    const scalePercent = prompt('Scale selected notes length by percentage:\n\nEnter a percentage (e.g., 150 for 150%, 50 for 50%, 200 for 200%)', '150');
    
    if (scalePercent === null) return; // User cancelled
    
    const scaleFactor = parseFloat(scalePercent) / 100;
    
    if (isNaN(scaleFactor) || scaleFactor <= 0) {
        localAppServices.showNotification?.('Invalid scale percentage. Enter a positive number.', 2000);
        return;
    }
    
    scaleSelectedNotesLength(scaleFactor);
}