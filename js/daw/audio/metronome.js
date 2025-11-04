// js/daw/audio/metronome.js

// Corrected import for Constants
import * as Constants from '/app/js/daw/constants.js'; // Corrected path

let localAppServices = {}; //
let metronomeSynth = null; //
let metronomeEventId = -1; //
let isMetronomeEnabled = false; //

/**
 * Creates a new Tone.js MembraneSynth instance for the metronome click sound.
 * @returns {Tone.MembraneSynth} The configured metronome synth.
 */
function createMetronomeSynth() { //
    return new localAppServices.Tone.MembraneSynth({ //
        pitchDecay: 0.01, //
        octaves: 6, //
        envelope: { //
            attack: 0.001, //
            decay: 0.2, //
            sustain: 0, //
        }
    }).toDestination(); //
}

/**
 * Initializes the metronome module with the main app services.
 * @param {object} appServices - The main app services object.
 */
export function initializeMetronome(appServices) { //
    localAppServices = appServices; //
}

/**
 * Starts the metronome playback.
 */
function startMetronome() { //
    if (metronomeEventId !== -1) { //
        // Metronome is already running, do nothing
        return; //
    }
    if (!metronomeSynth) { //
        metronomeSynth = createMetronomeSynth(); //
    }
    
    // Schedule a repeating event on the Tone.js Transport for every quarter note
    metronomeEventId = localAppServices.Tone.Transport.scheduleRepeat((time) => { //
        // Get the current position in bars, beats, and sixteenths
        const position = localAppServices.Tone.Transport.getBarsBeatsSixteenthsAtTime(time).split(':'); //
        const measure = parseInt(position[0], 10); //
        const beat = parseInt(position[1], 10); //

        // Play a higher pitch for the first beat of a measure, and a lower pitch for other beats
        if (beat === 0) { //
            metronomeSynth.triggerAttackRelease("C5", "16n", time); //
        } else {
            metronomeSynth.triggerAttackRelease("C4", "16n", time); //
        }
    }, "4n"); // Schedule to repeat every quarter note ("4n")

    isMetronomeEnabled = true; // Set flag to true
}

/**
 * Stops the metronome playback.
 */
function stopMetronome() { //
    if (metronomeEventId !== -1) { //
        localAppServices.Tone.Transport.clear(metronomeEventId); // Clear the scheduled event
        metronomeEventId = -1; // Reset event ID
    }
    isMetronomeEnabled = false; // Set flag to false
}

/**
 * Toggles the metronome on or off.
 * @returns {boolean} The new state of the metronome (true if enabled, false if disabled).
 */
export function toggleMetronome() { //
    isMetronomeEnabled ? stopMetronome() : startMetronome(); //
    return isMetronomeEnabled; //
}