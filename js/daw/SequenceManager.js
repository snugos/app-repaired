// js/daw/SequenceManager.js

import * as Constants from '/app/js/daw/constants.js'; // Corrected path

export class SequenceManager { //
    constructor(track, appServices) { //
        this.track = track; //
        this.appServices = appServices; //
        this.sequences = []; //
        this.activeSequenceId = null; //
        this._sequenceEventId = null; //
        this.toneSequence = null; // Store the Tone.Sequence object
    }

    initialize(sequences = [], activeSequenceId = null) { //
        this.sequences = sequences; //
        this.activeSequenceId = activeSequenceId || (this.sequences.length > 0 ? this.sequences[0].id : null); //
        // Recreate Tone.Sequence immediately after initialization if there's an active sequence
        if (this.activeSequenceId) {
            this.recreateToneSequence();
        }
    }

    getActiveSequence() { //
        if (!this.activeSequenceId && this.sequences.length > 0) this.activeSequenceId = this.sequences[0].id; //
        return this.sequences.find(s => s.id === this.activeSequenceId); //
    }

    createNewSequence(name, length, skipUndo) { //
        if (this.track.type === 'Audio') return null; //
        const newSeqId = `seq_${this.track.id}_${Date.now()}`; //
        const newSequence = { //
            id: newSeqId, //
            name, //
            data: Array(Constants.SYNTH_PITCHES.length).fill(null).map(() => Array(length).fill(null)), //
            length //
        };
        this.sequences.push(newSequence); //
        this.activeSequenceId = newSeqId; //
        if (!skipUndo) this.appServices.captureStateForUndo?.(`Create Sequence "${name}" on ${this.track.name}`); //
        this.recreateToneSequence(); // Recreate Tone.Sequence after adding new one
        return newSequence; //
    }

    addNoteToSequence(sequenceId, pitchIndex, timeStep, noteData = { velocity: 0.75, duration: 1 }) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (sequence && sequence.data[pitchIndex] !== undefined && timeStep < sequence.length) { //
            sequence.data[pitchIndex][timeStep] = noteData; //
            this.appServices.captureStateForUndo?.(`Add note to ${this.track.name}`); //
            this.recreateToneSequence(); //
        }
    }

    removeNoteFromSequence(sequenceId, pitchIndex, timeStep) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (sequence?.data[pitchIndex]?.[timeStep]) { //
            sequence.data[pitchIndex][timeStep] = null; //
            this.appServices.captureStateForUndo?.(`Remove note from ${this.track.name}`); //
            this.recreateToneSequence(); //
        }
    }

    removeNotesFromSequence(sequenceId, notesToRemove) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (!sequence || !notesToRemove?.size) return; //
        notesToRemove.forEach(noteId => { //
            const [pitchIndex, timeStep] = noteId.split('-').map(Number); //
            if (sequence.data[pitchIndex]?.[timeStep]) { //
                sequence.data[pitchIndex][timeStep] = null; //
            }
        });
        this.appServices.captureStateForUndo?.(`Delete ${notesToRemove.size} notes from ${this.track.name}`); //
        this.recreateToneSequence(); //
    }

    setSequenceLength(sequenceId, newLength) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (!sequence) return; //
        const validatedLength = Math.max(1, Math.floor(newLength)); //
        const oldLength = sequence.length; //
        sequence.length = validatedLength; //
        sequence.data.forEach(pitchRow => { //
            pitchRow.length = validatedLength; //
            if (validatedLength > oldLength) { //
                pitchRow.fill(null, oldLength); //
            }
        });
        this.recreateToneSequence(); //
    }
    
    // Additional methods that were in Track.js
    moveSelectedNotes(sequenceId, selectedNotes, pitchOffset = 0, timeOffset = 0) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (!sequence || !selectedNotes?.size) return null; //
        const notesToMove = []; //
        const newPositions = []; //
        const newSelectedNoteIds = new Set(); //
        
        // Collect notes to move and their new positions, validating bounds first
        for (const noteId of selectedNotes) { //
            const [pitchIndex, timeStep] = noteId.split('-').map(Number); //
            const noteData = sequence.data[pitchIndex]?.[timeStep]; //
            if (noteData) { //
                const newPitchIndex = pitchIndex + pitchOffset; //
                const newTimeStep = timeStep + timeOffset; //

                if (newPitchIndex < 0 || newPitchIndex >= sequence.data.length || newTimeStep < 0 || newTimeStep >= sequence.length) { //
                    this.appServices.showNotification?.('Cannot move notes outside the sequence bounds.', 2000); //
                    return null; //
                }
                notesToMove.push({ oldPitch: pitchIndex, oldTime: timeStep, data: noteData }); //
                newPositions.push({ newPitch: newPitchIndex, newTime: newTimeStep, data: noteData }); //
            }
        }

        // Clear old positions
        notesToMove.forEach(note => { //
            sequence.data[note.oldPitch][note.oldTime] = null; //
        });
        // Set new positions
        newPositions.forEach(note => { //
            sequence.data[note.newPitch][note.newTime] = note.data; //
            newSelectedNoteIds.add(`${note.newPitch}-${note.newTime}`); //
        });

        this.appServices.captureStateForUndo?.('Move notes'); //
        this.recreateToneSequence(); //
        return newSelectedNoteIds; //
    }

    setNoteDuration(sequenceId, pitchIndex, timeStep, newDuration) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        const note = sequence?.data?.[pitchIndex]?.[timeStep]; //
        if (note) { //
            note.duration = Math.max(1, Math.floor(newDuration)); //
            this.recreateToneSequence(); // Recreate sequence after duration change
        }
    }

    updateNoteVelocity(sequenceId, pitchIndex, timeStep, newVelocity) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (sequence?.data[pitchIndex]?.[timeStep]) { //
            sequence.data[pitchIndex][timeStep].velocity = Math.max(0.01, Math.min(1, newVelocity)); //
            // Velocity changes don't strictly require recreating the whole Tone.Sequence
            // but might require updating individual note events if already scheduled.
            // For simplicity, recreating is fine for now, but could be optimized.
        }
    }

    clearSequence(sequenceId) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (!sequence) return; //
        sequence.data = Array(Constants.SYNTH_PITCHES.length).fill(null).map(() => Array(sequence.length).fill(null)); //
        this.recreateToneSequence(); //
        this.appServices.captureStateForUndo?.(`Clear sequence on ${this.track.name}`); //
    }

    duplicateSequence(sequenceId) { //
        const originalSequence = this.sequences.find(s => s.id === sequenceId); //
        if (!originalSequence) return; //
        const newName = `${originalSequence.name} (copy)`; //
        const newSequence = this.createNewSequence(newName, originalSequence.length, true); // // pass true to skip undo for initial creation
        newSequence.data = JSON.parse(JSON.stringify(originalSequence.data)); //
        this.recreateToneSequence(); //
        this.appServices.captureStateForUndo?.(`Duplicate sequence on ${this.track.name}`); //
        return newSequence; //
    }
    
    copyNotesToClipboard(sequenceId, notesToCopy) { //
        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (!sequence || !notesToCopy?.size) return; //

        let minPitchIndex = Infinity, minTimeStep = Infinity; //
        const noteDataObjects = []; //

        notesToCopy.forEach(noteId => { //
            const [pitchIndex, timeStep] = noteId.split('-').map(Number); //
            minPitchIndex = Math.min(minPitchIndex, pitchIndex); //
            minTimeStep = Math.min(minTimeStep, timeStep); //
            noteDataObjects.push({ pitchIndex, timeStep, data: sequence.data[pitchIndex][timeStep] }); //
        });

        const relativeNotes = noteDataObjects.map(n => ({ //
            pitchOffset: n.pitchIndex - minPitchIndex, //
            timeOffset: n.timeStep - minTimeStep, //
            noteData: n.data //
        }));

        this.appServices.setClipboardData?.({ type: 'piano-roll-notes', notes: relativeNotes }); //
        this.appServices.showNotification?.(`${relativeNotes.length} note(s) copied.`); //
    }

    pasteNotesFromClipboard(sequenceId, pastePitchIndex, pasteTimeStep) { //
        const clipboard = this.appServices.getClipboardData?.(); //
        if (clipboard?.type !== 'piano-roll-notes' || !clipboard.notes?.length) return null; //

        const sequence = this.sequences.find(s => s.id === sequenceId); //
        if (!sequence) return null; //

        const newSelectedNoteIds = new Set(); // To return the newly pasted notes for selection

        clipboard.notes.forEach(noteToPaste => { //
            const newPitchIndex = pastePitchIndex + noteToPaste.pitchOffset; //
            const newTimeStep = pasteTimeStep + noteToPaste.timeOffset; //

            if (newPitchIndex >= 0 && newPitchIndex < sequence.data.length && newTimeStep >= 0 && newTimeStep < sequence.length) { //
                sequence.data[newPitchIndex][newTimeStep] = JSON.parse(JSON.stringify(noteToPaste.noteData)); //
                newSelectedNoteIds.add(`${newPitchIndex}-${newTimeStep}`); // Add to new selection set
            } else {
                console.warn(`[SequenceManager] Note out of bounds during paste: P:${newPitchIndex}, T:${newTimeStep}`); //
            }
        });

        this.recreateToneSequence(); //
        this.appServices.captureStateForUndo?.(`Paste ${clipboard.notes.length} notes`); //
        return newSelectedNoteIds; // Return the set of new note IDs for selection
    }

    recreateToneSequence() { //
        this.stopSequence(); // Ensure previous sequence is stopped and cleared
        const activeSequence = this.getActiveSequence(); //
        if (!activeSequence) return; //

        // Collect all note events from the active sequence data
        const events = [];
        const ticksPerStep = this.appServices.Tone.Transport.PPQ / 4; // Assuming 16th note steps

        for (let pitchIndex = 0; pitchIndex < activeSequence.data.length; pitchIndex++) { //
            for (let timeStep = 0; timeStep < activeSequence.length; timeStep++) { //
                const note = activeSequence.data[pitchIndex][timeStep]; //
                if (note) { //
                    const notePitch = Constants.SYNTH_PITCHES[pitchIndex]; //
                    const noteDuration = `${note.duration || 1}*16n`; // Convert note duration to Tone.js time format
                    const noteVelocity = note.velocity || 0.75; //

                    events.push({
                        time: new this.appServices.Tone.Ticks(timeStep * ticksPerStep).toBarsBeatsSixteenths(), // Schedule by ticks
                        note: notePitch,
                        duration: noteDuration,
                        velocity: noteVelocity
                    });
                }
            }
        }

        if (this.track.instrument) { // Check if instrument is available
            this.toneSequence = new this.appServices.Tone.Part((time, value) => { //
                if (this.track.instrument) { // Double check instrument exists when callback fires
                    this.track.instrument.triggerAttackRelease(value.note, value.duration, time, value.velocity); //
                }
            }, events);
            
            this.toneSequence.loop = true; // Ensure looping
            this.toneSequence.loopEnd = new this.appServices.Tone.Ticks(activeSequence.length * ticksPerStep).toBarsBeatsSixteenths(); // Set loop end based on sequence length
            
            // Start the sequence at the beginning of the transport
            this.toneSequence.start(0);
        }
    }

    startSequence() { //
        if (this.toneSequence) {
            this.toneSequence.start(0); // Start from the beginning
        } else {
            this.recreateToneSequence(); // If not existing, create and start
        }
    }

    stopSequence() { //
        if (this.toneSequence) { //
            this.toneSequence.stop(0); // Stop immediately
            this.toneSequence.dispose(); // Dispose the Tone.Part to free resources
            this.toneSequence = null; // Clear the reference
        }
    }

    dispose() { //
        this.stopSequence(); //
        // No need to dispose sequences array itself, just the Tone.Sequence
        this.sequences = [];
        this.activeSequenceId = null;
    }

    serialize() { //
        return { //
            sequences: this.sequences, //
            activeSequenceId: this.activeSequenceId //
        };
    }
}