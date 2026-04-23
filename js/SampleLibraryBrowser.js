// js/SampleLibraryBrowser.js - Sample Library Browser for browsing and previewing samples

// Built-in sample library categories (virtual - can be populated by loading sample packs)
export const SAMPLE_LIBRARY_CATEGORIES = [
    { id: 'drums', name: 'Drums', icon: '🥁', description: 'Kicks, snares, hi-hats, toms, cymbals' },
    { id: 'bass', name: 'Bass', icon: '🎸', description: 'Bass synths, 808s, bass guitars' },
    { id: 'synth', name: 'Synth', icon: '🎹', description: 'Synth stabs, pads, leads, plucks' },
    { id: 'vocals', name: 'Vocals', icon: '🎤', description: 'Vocal chops, one-shots, vocal fx' },
    { id: 'fx', name: 'FX', icon: '🔊', description: 'Risers, impacts, sweeps, transitions' },
    { id: 'keys', name: 'Keys', icon: '🎹', description: 'Piano, organ, electric piano' },
    { id: 'guitar', name: 'Guitar', icon: '🎸', description: 'Electric and acoustic guitars' },
    { id: 'strings', name: 'Strings', icon: '🎻', description: 'Violin, cello, orchestral strings' },
    { id: 'world', name: 'World', icon: '🌍', description: 'World instruments and percussion' },
    { id: 'ambient', name: 'Ambient', icon: '🌫️', description: 'Pads, textures, atmospheres' }
];

// Built-in sample library with demo samples (these are placeholders - real samples would need to be added)
export const SAMPLE_LIBRARY = {
    drums: [
        { id: 'kick_01', name: 'Kick 01', category: 'drums', file: 'kick_01.wav', duration: 0.5 },
        { id: 'kick_02', name: 'Kick 02', category: 'drums', file: 'kick_02.wav', duration: 0.5 },
        { id: 'snare_01', name: 'Snare 01', category: 'drums', file: 'snare_01.wav', duration: 0.3 },
        { id: 'snare_02', name: 'Snare 02', category: 'drums', file: 'snare_02.wav', duration: 0.3 },
        { id: 'hihat_closed', name: 'Hi-Hat Closed', category: 'drums', file: 'hihat_closed.wav', duration: 0.1 },
        { id: 'hihat_open', name: 'Hi-Hat Open', category: 'drums', file: 'hihat_open.wav', duration: 0.4 },
        { id: 'clap_01', name: 'Clap 01', category: 'drums', file: 'clap_01.wav', duration: 0.2 },
        { id: 'tom_01', name: 'Tom 01', category: 'drums', file: 'tom_01.wav', duration: 0.4 }
    ],
    bass: [
        { id: 'bass_808_01', name: '808 Bass 01', category: 'bass', file: 'bass_808_01.wav', duration: 1.0 },
        { id: 'bass_808_02', name: '808 Bass 02', category: 'bass', file: 'bass_808_02.wav', duration: 1.0 },
        { id: 'bass_sub_01', name: 'Sub Bass 01', category: 'bass', file: 'bass_sub_01.wav', duration: 1.0 }
    ],
    synth: [
        { id: 'synth_stab_01', name: 'Synth Stab 01', category: 'synth', file: 'synth_stab_01.wav', duration: 0.5 },
        { id: 'synth_pad_01', name: 'Synth Pad 01', category: 'synth', file: 'synth_pad_01.wav', duration: 2.0 },
        { id: 'synth_lead_01', name: 'Synth Lead 01', category: 'synth', file: 'synth_lead_01.wav', duration: 1.0 }
    ],
    vocals: [
        { id: 'vocal_chop_01', name: 'Vocal Chop 01', category: 'vocals', file: 'vocal_chop_01.wav', duration: 0.5 },
        { id: 'vocal_one_shot_01', name: 'Vocal One-Shot 01', category: 'vocals', file: 'vocal_one_shot_01.wav', duration: 0.8 }
    ],
    fx: [
        { id: 'riser_01', name: 'Riser 01', category: 'fx', file: 'riser_01.wav', duration: 4.0 },
        { id: 'impact_01', name: 'Impact 01', category: 'fx', file: 'impact_01.wav', duration: 1.5 },
        { id: 'sweep_01', name: 'Sweep 01', category: 'fx', file: 'sweep_01.wav', duration: 2.0 }
    ],
    keys: [
        { id: 'piano_chord_01', name: 'Piano Chord 01', category: 'keys', file: 'piano_chord_01.wav', duration: 2.0 },
        { id: 'piano_loop_01', name: 'Piano Loop 01', category: 'keys', file: 'piano_loop_01.wav', duration: 4.0 }
    ],
    guitar: [
        { id: 'guitar_chord_01', name: 'Guitar Chord 01', category: 'guitar', file: 'guitar_chord_01.wav', duration: 2.0 }
    ],
    strings: [
        { id: 'strings_minor_01', name: 'Strings Minor 01', category: 'strings', file: 'strings_minor_01.wav', duration: 4.0 },
        { id: 'strings_major_01', name: 'Strings Major 01', category: 'strings', file: 'strings_major_01.wav', duration: 4.0 }
    ],
    world: [
        { id: 'conga_01', name: 'Conga 01', category: 'world', file: 'conga_01.wav', duration: 0.5 },
        { id: 'tabla_01', name: 'Tabla 01', category: 'world', file: 'tabla_01.wav', duration: 0.5 }
    ],
    ambient: [
        { id: 'ambient_pad_01', name: 'Ambient Pad 01', category: 'ambient', file: 'ambient_pad_01.wav', duration: 8.0 },
        { id: 'texture_01', name: 'Texture 01', category: 'ambient', file: 'texture_01.wav', duration: 6.0 }
    ]
};

// Current loaded sample packs
let loadedSamplePacks = {}; // { packName: { metadata, samples: [...] } }

// Preview player (Tone.Player instance)
let previewPlayer = null;
let currentlyPlayingSampleId = null;

// Get all sample categories
export function getSampleCategories() {
    return [...SAMPLE_LIBRARY_CATEGORIES];
}

// Get samples in a category
export function getSamplesByCategory(categoryId) {
    return SAMPLE_LIBRARY[categoryId] || [];
}

// Get all samples
export function getAllSamples() {
    const allSamples = [];
    Object.values(SAMPLE_LIBRARY).forEach(samples => {
        allSamples.push(...samples);
    });
    return allSamples;
}

// Search samples by name
export function searchSamples(query) {
    if (!query || query.trim() === '') return getAllSamples();
    const lowerQuery = query.toLowerCase();
    return getAllSamples().filter(sample => 
        sample.name.toLowerCase().includes(lowerQuery) ||
        sample.category.toLowerCase().includes(lowerQuery)
    );
}

// Get sample for drag/drop
export function getSampleForDrag(sampleId) {
    const sample = findSampleById(sampleId);
    if (!sample) return null;
    
    return {
        type: 'sample-library-item',
        id: sample.id,
        name: sample.name,
        category: sample.category,
        file: sample.file,
        duration: sample.duration,
        source: 'sample-library-browser'
    };
}

// Favorite samples management
let favoriteSamples = new Set(JSON.parse(localStorage.getItem('snugosFavoriteSamples') || '[]'));

export function getFavoriteSamples() {
    const allSamples = getAllSamples();
    return allSamples.filter(s => favoriteSamples.has(s.id));
}

export function toggleSampleFavorite(sampleId) {
    if (favoriteSamples.has(sampleId)) {
        favoriteSamples.delete(sampleId);
    } else {
        favoriteSamples.add(sampleId);
    }
    localStorage.setItem('snugosFavoriteSamples', JSON.stringify([...favoriteSamples]));
    return favoriteSamples.has(sampleId);
}

export function isSampleFavorite(sampleId) {
    return favoriteSamples.has(sampleId);
}

// Load sample to track (creates a track and adds sample)
export async function loadSampleToTrack(trackId, sampleId) {
    const sample = findSampleById(sampleId);
    if (!sample) {
        console.warn('[SampleLibraryBrowser] Sample not found:', sampleId);
        return null;
    }
    
    // If no trackId provided, create a new audio track
    let targetTrackId = trackId;
    
    // For now, return sample info that can be used to add to a track
    return {
        success: true,
        sample: sample,
        message: `Sample "${sample.name}" ready to load. Create an Audio track and drag this sample to it.`
    };
}

// Play preview using Tone.js (better audio synthesis)
let previewSynth = null;
let previewTimeout = null;

export function previewSampleWithTone(sampleId) {
    // Stop any existing preview
    stopPreviewWithTone();
    
    const sample = findSampleById(sampleId);
    if (!sample) {
        console.warn('[SampleLibraryBrowser] Sample not found:', sampleId);
        return;
    }
    
    currentlyPlayingSampleId = sampleId;
    
    try {
        if (typeof Tone !== 'undefined') {
            // Create appropriate synth based on category
            const category = sample.category;
            
            if (category === 'drums') {
                // Kick-like sound with pitch envelope
                const synth = new Tone.MembraneSynth().toDestination();
                synth.volume.value = -6;
                synth.triggerAttackRelease(60, '8n');
                previewSynth = synth;
            } else if (category === 'bass') {
                // Sub bass sound
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
                    filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2, baseFrequency: 200, octaves: 2 }
                }).toDestination();
                synth.triggerAttackRelease('C2', '8n');
                previewSynth = synth;
            } else if (category === 'synth' || category === 'keys') {
                // Bright synth stab
                const synth = new Tone.PolySynth(Tone.Synth).toDestination();
                synth.volume.value = -8;
                synth.triggerAttackRelease(['C4', 'E4', 'G4'], '16n');
                previewSynth = synth;
            } else if (category === 'vocals') {
                // Formant-ish pad
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.4 }
                }).toDestination();
                synth.volume.value = -10;
                synth.triggerAttackRelease('A3', '8n');
                previewSynth = synth;
            } else if (category === 'fx') {
                // Filter sweep sound
                const synth = new Tone.FMSynth().toDestination();
                synth.volume.value = -8;
                synth.triggerAttackRelease('C5', '4n');
                previewSynth = synth;
            } else {
                // Default synth tone
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease('C4', '8n');
                previewSynth = synth;
            }
            
            // Auto-stop after a reasonable time
            const duration = Math.min(sample.duration || 1, 3);
            previewTimeout = setTimeout(() => {
                stopPreviewWithTone();
            }, duration * 1000 + 200);
            
            console.log(`[SampleLibraryBrowser] Previewing sample: ${sample.name} (${category})`);
        } else {
            // Fallback to basic Web Audio preview
            previewSample(sampleId);
        }
    } catch (e) {
        console.error('[SampleLibraryBrowser] Tone.js preview error:', e);
        // Fallback to basic preview
        previewSample(sampleId);
    }
}

export function stopPreviewWithTone() {
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    if (previewSynth) {
        try {
            previewSynth.dispose();
        } catch (e) {}
        previewSynth = null;
    }
    currentlyPlayingSampleId = null;
}

// Enhanced preview that uses both Tone.js and basic synthesis
export function previewSample(sampleId) {
    // Try Tone.js first for better quality
    if (typeof Tone !== 'undefined') {
        previewSampleWithTone(sampleId);
    } else {
        // Fallback to basic Web Audio
        previewSampleBasic(sampleId);
    }
}

// Basic Web Audio preview (fallback)
function previewSampleBasic(sampleId) {
    stopPreview();
    
    const sample = findSampleById(sampleId);
    if (!sample) return;
    
    currentlyPlayingSampleId = sampleId;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch (sample.category) {
            case 'drums':
                oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'bass':
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'synth':
            case 'keys':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            default:
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
        }
        
        console.log(`[SampleLibraryBrowser] Previewing sample: ${sample.name}`);
    } catch (e) {
        console.error('[SampleLibraryBrowser] Preview error:', e);
    }
}

// Stop preview
export function stopPreview() {
    stopPreviewWithTone();
    if (currentlyPlayingSampleId) {
        currentlyPlayingSampleId = null;
    }
}

// Alias for stopPreview (used by UI)
export const stopSamplePreview = stopPreview;

// Find sample by ID
function findSampleById(sampleId) {
    for (const samples of Object.values(SAMPLE_LIBRARY)) {
        const found = samples.find(s => s.id === sampleId);
        if (found) return found;
    }
    return null;
}

// Load sample pack from ZIP (future: integrate with sound browser ZIP loading)
export async function loadSamplePack(packName, zipBlob) {
    console.log(`[SampleLibraryBrowser] Loading sample pack: ${packName}`);
    // Future: Parse ZIP and extract sample metadata
    // For now, just store the pack reference
    loadedSamplePacks[packName] = {
        name: packName,
        loadedAt: new Date().toISOString(),
        sampleCount: 0
    };
    return true;
}

// Get loaded sample packs
export function getLoadedSamplePacks() {
    return Object.keys(loadedSamplePacks);
}