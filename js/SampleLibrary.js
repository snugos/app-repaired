// js/SampleLibrary.js - Built-in Sample Library Browser
import { showNotification } from './utils.js';

// Built-in sample library organized by category
// These are free/open-source samples available via URLs
export const SAMPLE_LIBRARY = {
    drums: {
        name: 'Drums',
        icon: '🥁',
        samples: [
            { name: 'Kick Tight', url: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3', type: 'one-shot' },
            { name: 'Kick Boom', url: 'https://tonejs.github.io/audio/drum-samples/Bongos/kick.mp3', type: 'one-shot' },
            { name: 'Snare Tight', url: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3', type: 'one-shot' },
            { name: 'Snare Noise', url: 'https://tonejs.github.io/audio/drum-samples/Brute/snare.mp3', type: 'one-shot' },
            { name: 'Hi-Hat Closed', url: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3', type: 'one-shot' },
            { name: 'Hi-Hat Open', url: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3', type: 'one-shot' },
            { name: 'Tom Mid', url: 'https://tonejs.github.io/audio/drum-samples/Brute/tom1.mp3', type: 'one-shot' },
            { name: 'Tom Low', url: 'https://tonejs.github.io/audio/drum-samples/Brute/tom2.mp3', type: 'one-shot' },
            { name: 'Cymbal Crash', url: 'https://tonejs.github.io/audio/drum-samples/Brute/cymbal.mp3', type: 'one-shot' },
            { name: 'Clap', url: 'https://tonejs.github.io/audio/drum-samples/CR78/clap.mp3', type: 'one-shot' },
        ]
    },
    percussion: {
        name: 'Percussion',
        icon: '🎵',
        samples: [
            { name: 'Shaker', url: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3', type: 'one-shot' },
            { name: 'Rimshot', url: 'https://tonejs.github.io/audio/drum-samples/Brute/snare.mp3', type: 'one-shot' },
            { name: 'Cowbell', url: 'https://tonejs.github.io/audio/drum-samples/Brute/tom2.mp3', type: 'one-shot' },
            { name: 'Tambourine', url: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3', type: 'one-shot' },
        ]
    },
    bass: {
        name: 'Bass',
        icon: '🎸',
        samples: [
            { name: 'Electric Bass C2', url: 'https://tonejs.github.io/audio/berklee/electric_basics/21_ampBass_22.mp3', type: 'loop' },
            { name: 'Electric Bass G2', url: 'https://tonejs.github.io/audio/berklee/electric_basics/21_ampBass_38.mp3', type: 'loop' },
            { name: 'Fretless Bass', url: 'https://tonejs.github.io/audio/berklee/electric_basics/21_ampBass_15.mp3', type: 'loop' },
            { name: 'Synth Bass C2', url: 'https://tonejs.github.io/audio/berklee/synth bass_22.mp3', type: 'loop' },
        ]
    },
    guitar: {
        name: 'Guitar',
        icon: '🎸',
        samples: [
            { name: 'Acoustic Guitar C4', url: 'https://tonejs.github.io/audio/berklee/acoustic_guitar_22.mp3', type: 'loop' },
            { name: 'Acoustic Guitar G4', url: 'https://tonejs.github.io/audio/berklee/acoustic_guitar_38.mp3', type: 'loop' },
            { name: 'Electric Guitar Clean', url: 'https://tonejs.github.io/audio/berklee/electric_guitar_15.mp3', type: 'loop' },
            { name: 'Electric Guitar Muted', url: 'https://tonejs.github.io/audio/berklee/electric_guitar_22.mp3', type: 'loop' },
        ]
    },
    keys: {
        name: 'Keys',
        icon: '🎹',
        samples: [
            { name: 'Piano C4', url: 'https://tonejs.github.io/audio/piano/C4.mp3', type: 'loop' },
            { name: 'Piano E4', url: 'https://tonejs.github.io/audio/piano/E4.mp3', type: 'loop' },
            { name: 'Piano G4', url: 'https://tonejs.github.io/audio/piano/G4.mp3', type: 'loop' },
            { name: 'Organ', url: 'https://tonejs.github.io/audio/berklee/organ_22.mp3', type: 'loop' },
            { name: 'Rhodes Piano', url: 'https://tonejs.github.io/audio/berklee/rhodes_22.mp3', type: 'loop' },
        ]
    },
    strings: {
        name: 'Strings',
        icon: '🎻',
        samples: [
            { name: 'Cello', url: 'https://tonejs.github.io/audio/berklee/cello_22.mp3', type: 'loop' },
            { name: 'Violin', url: 'https://tonejs.github.io/audio/berklee/violin_22.mp3', type: 'loop' },
            { name: 'Double Bass', url: 'https://tonejs.github.io/audio/berklee/contrabass_22.mp3', type: 'loop' },
        ]
    },
    vocals: {
        name: 'Vocals',
        icon: '🎤',
        samples: [
            { name: 'Choir Ahh', url: 'https://tonejs.github.io/audio/berklee/choir_22.mp3', type: 'loop' },
            { name: 'Vocal Ooh', url: 'https://tonejs.github.io/audio/berklee/choir_38.mp3', type: 'loop' },
        ]
    },
    fx: {
        name: 'FX',
        icon: '🔊',
        samples: [
            { name: 'Riser', url: 'https://tonejs.github.io/audio/drum-samples/Brute/cymbal.mp3', type: 'one-shot' },
            { name: 'Impact', url: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3', type: 'one-shot' },
            { name: 'Sweep Down', url: 'https://tonejs.github.io/audio/drum-samples/Brute/tom2.mp3', type: 'one-shot' },
            { name: 'Sweep Up', url: 'https://tonejs.github.io/audio/drum-samples/Brute/tom1.mp3', type: 'one-shot' },
        ]
    }
};

// Preview audio player
let previewPlayer = null;
let currentPreviewUrl = null;
let isPreviewPlaying = false;

export function getSampleCategories() {
    return Object.keys(SAMPLE_LIBRARY).map(key => ({
        id: key,
        name: SAMPLE_LIBRARY[key].name,
        icon: SAMPLE_LIBRARY[key].icon,
        count: SAMPLE_LIBRARY[key].samples.length
    }));
}

export function getSamplesByCategory(categoryId) {
    const category = SAMPLE_LIBRARY[categoryId];
    if (!category) return [];
    return category.samples.map(s => ({ ...s, category: categoryId }));
}

export function getSampleByName(name) {
    for (const catKey of Object.keys(SAMPLE_LIBRARY)) {
        const sample = SAMPLE_LIBRARY[catKey].samples.find(s => s.name === name);
        if (sample) return { ...sample, category: catKey };
    }
    return null;
}

export async function previewSample(url) {
    if (typeof Tone === 'undefined') {
        console.warn('[SampleLibrary] Tone.js not loaded');
        return false;
    }

    try {
        // Stop current preview
        if (previewPlayer) {
            previewPlayer.stop();
            previewPlayer.dispose();
            previewPlayer = null;
        }

        currentPreviewUrl = url;
        isPreviewPlaying = true;

        // Create player for preview
        previewPlayer = new Tone.Player(url);
        previewPlayer.connect(Tone.Destination);
        
        await previewPlayer.load(url);
        previewPlayer.start();
        
        // Auto-stop after sample ends (estimate 3 seconds max for one-shots)
        setTimeout(() => {
            stopPreview();
        }, 3000);

        return true;
    } catch (e) {
        console.error('[SampleLibrary] Error previewing sample:', e);
        isPreviewPlaying = false;
        return false;
    }
}

export function stopPreview() {
    if (previewPlayer) {
        try {
            previewPlayer.stop();
            previewPlayer.dispose();
        } catch (e) {}
        previewPlayer = null;
    }
    currentPreviewUrl = null;
    isPreviewPlaying = false;
}

export function isPreviewCurrentlyPlaying() {
    return isPreviewPlaying;
}

export function getCurrentPreviewUrl() {
    return currentPreviewUrl;
}

// Get total sample count
export function getTotalSampleCount() {
    let count = 0;
    for (const catKey of Object.keys(SAMPLE_LIBRARY)) {
        count += SAMPLE_LIBRARY[catKey].samples.length;
    }
    return count;
}