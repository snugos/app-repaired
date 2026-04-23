// js/EQPresetLibrary.js - EQ Preset Library for common instruments

// Presets for common instruments
export const EQ_PRESETS = {
    // Drums
    kick: {
        name: 'Kick Drum',
        category: 'Drums',
        low: 3,
        mid: -4,
        high: -2,
        lowFrequency: 80,
        highFrequency: 4000
    },
    kick_thump: {
        name: 'Kick (Thump)',
        category: 'Drums',
        low: 6,
        mid: -6,
        high: -8,
        lowFrequency: 60,
        highFrequency: 2000
    },
    kick_punch: {
        name: 'Kick (Punch)',
        category: 'Drums',
        low: 4,
        mid: 2,
        high: -4,
        lowFrequency: 100,
        highFrequency: 3000
    },
    snare: {
        name: 'Snare Drum',
        category: 'Drums',
        low: -2,
        mid: 2,
        high: 4,
        lowFrequency: 200,
        highFrequency: 5000
    },
    snare_crisp: {
        name: 'Snare (Crisp)',
        category: 'Drums',
        low: -4,
        mid: -2,
        high: 6,
        lowFrequency: 200,
        highFrequency: 8000
    },
    snare_boom: {
        name: 'Snare (Boom)',
        category: 'Drums',
        low: 4,
        mid: -2,
        high: 2,
        lowFrequency: 150,
        highFrequency: 4000
    },
    hihat: {
        name: 'Hi-Hat',
        category: 'Drums',
        low: -8,
        mid: -4,
        high: 4,
        lowFrequency: 5000,
        highFrequency: 12000
    },
    hihat_closed: {
        name: 'Hi-Hat (Closed)',
        category: 'Drums',
        low: -12,
        mid: -6,
        high: 6,
        lowFrequency: 8000,
        highFrequency: 15000
    },
    hihat_open: {
        name: 'Hi-Hat (Open)',
        category: 'Drums',
        low: -6,
        mid: 0,
        high: 4,
        lowFrequency: 5000,
        highFrequency: 12000
    },
    toms: {
        name: 'Toms',
        category: 'Drums',
        low: 4,
        mid: -2,
        high: 0,
        lowFrequency: 100,
        highFrequency: 3000
    },
    cymbals: {
        name: 'Cymbals',
        category: 'Drums',
        low: -8,
        mid: -4,
        high: 4,
        lowFrequency: 4000,
        highFrequency: 10000
    },
    overheads: {
        name: 'Overheads',
        category: 'Drums',
        low: -4,
        mid: 0,
        high: 2,
        lowFrequency: 3000,
        highFrequency: 8000
    },
    room_mic: {
        name: 'Room Mic',
        category: 'Drums',
        low: 2,
        mid: -2,
        high: 0,
        lowFrequency: 200,
        highFrequency: 6000
    },

    // Bass
    bass_di: {
        name: 'Bass (DI)',
        category: 'Bass',
        low: 4,
        mid: -2,
        high: 0,
        lowFrequency: 80,
        highFrequency: 4000
    },
    bass_amp: {
        name: 'Bass (Amp Sim)',
        category: 'Bass',
        low: 6,
        mid: -4,
        high: -2,
        lowFrequency: 60,
        highFrequency: 3000
    },
    bass_synth: {
        name: 'Synth Bass',
        category: 'Bass',
        low: 2,
        mid: 2,
        high: 0,
        lowFrequency: 100,
        highFrequency: 5000
    },
    bass_sub: {
        name: 'Sub Bass',
        category: 'Bass',
        low: 6,
        mid: -8,
        high: -12,
        lowFrequency: 40,
        highFrequency: 200
    },
    bass_funk: {
        name: 'Funk Bass',
        category: 'Bass',
        low: 3,
        mid: 2,
        high: 2,
        lowFrequency: 100,
        highFrequency: 5000
    },
    bass_jazz: {
        name: 'Jazz Bass',
        category: 'Bass',
        low: 2,
        mid: 0,
        high: 2,
        lowFrequency: 80,
        highFrequency: 6000
    },

    // Guitar
    guitar_clean: {
        name: 'Guitar (Clean)',
        category: 'Guitar',
        low: -2,
        mid: 2,
        high: 4,
        lowFrequency: 200,
        highFrequency: 6000
    },
    guitar_crunch: {
        name: 'Guitar (Crunch)',
        category: 'Guitar',
        low: 2,
        mid: 0,
        high: 2,
        lowFrequency: 150,
        highFrequency: 5000
    },
    guitar_distortion: {
        name: 'Guitar (Distortion)',
        category: 'Guitar',
        low: 4,
        mid: -2,
        high: 0,
        lowFrequency: 150,
        highFrequency: 4000
    },
    guitar_acoustic: {
        name: 'Acoustic Guitar',
        category: 'Guitar',
        low: 0,
        mid: 2,
        high: 4,
        lowFrequency: 200,
        highFrequency: 8000
    },
    guitar_amped: {
        name: 'Guitar (Amped)',
        category: 'Guitar',
        low: 4,
        mid: 2,
        high: 4,
        lowFrequency: 100,
        highFrequency: 6000
    },
    guitar_funk: {
        name: 'Guitar (Funk)',
        category: 'Guitar',
        low: -4,
        mid: 4,
        high: 4,
        lowFrequency: 400,
        highFrequency: 6000
    },

    // Keys & Pad
    piano: {
        name: 'Piano',
        category: 'Keys',
        low: 2,
        mid: 0,
        high: 2,
        lowFrequency: 200,
        highFrequency: 8000
    },
    electric_piano: {
        name: 'Electric Piano',
        category: 'Keys',
        low: 0,
        mid: 4,
        high: 2,
        lowFrequency: 200,
        highFrequency: 6000
    },
    organ: {
        name: 'Organ',
        category: 'Keys',
        low: 4,
        mid: 0,
        high: 2,
        lowFrequency: 200,
        highFrequency: 5000
    },
    synth_pad: {
        name: 'Synth Pad',
        category: 'Keys',
        low: 2,
        mid: 0,
        high: 4,
        lowFrequency: 300,
        highFrequency: 8000
    },
    strings: {
        name: 'Strings',
        category: 'Keys',
        low: 4,
        mid: 0,
        high: 2,
        lowFrequency: 300,
        highFrequency: 6000
    },
    pads_warm: {
        name: 'Warm Pad',
        category: 'Keys',
        low: 4,
        mid: 0,
        high: -2,
        lowFrequency: 200,
        highFrequency: 4000
    },

    // Vocals
    vocal_lead: {
        name: 'Vocal (Lead)',
        category: 'Vocals',
        low: 0,
        mid: 4,
        high: 4,
        lowFrequency: 200,
        highFrequency: 8000
    },
    vocal_harmony: {
        name: 'Vocal (Harmony)',
        category: 'Vocals',
        low: -2,
        mid: 2,
        high: 2,
        lowFrequency: 200,
        highFrequency: 6000
    },
    vocal_chorus: {
        name: 'Vocal (Chorus)',
        category: 'Vocals',
        low: 0,
        mid: 2,
        high: 4,
        lowFrequency: 300,
        highFrequency: 8000
    },
    vocal_rap: {
        name: 'Rap/Vocal',
        category: 'Vocals',
        low: 2,
        mid: 2,
        high: 4,
        lowFrequency: 150,
        highFrequency: 6000
    },
    vocal_telephone: {
        name: 'Telephone Effect',
        category: 'Vocals',
        low: -8,
        mid: 4,
        high: -8,
        lowFrequency: 500,
        highFrequency: 2500
    },
    vocal_radio: {
        name: 'Radio Effect',
        category: 'Vocals',
        low: -4,
        mid: 4,
        high: -4,
        lowFrequency: 300,
        highFrequency: 3000
    },

    // Other
    saxophone: {
        name: 'Saxophone',
        category: 'Wind',
        low: 4,
        mid: 0,
        high: 4,
        lowFrequency: 200,
        highFrequency: 6000
    },
    trumpet: {
        name: 'Trumpet',
        category: 'Wind',
        low: 2,
        mid: -2,
        high: 4,
        lowFrequency: 300,
        highFrequency: 8000
    },
    flute: {
        name: 'Flute',
        category: 'Wind',
        low: 0,
        mid: 2,
        high: 4,
        lowFrequency: 400,
        highFrequency: 8000
    },

    // Mix helpers
    presence_boost: {
        name: 'Presence Boost',
        category: 'Mix',
        low: -4,
        mid: 0,
        high: 6,
        lowFrequency: 2500,
        highFrequency: 8000
    },
    air_boost: {
        name: 'Air Boost',
        category: 'Mix',
        low: -6,
        mid: -2,
        high: 6,
        lowFrequency: 6000,
        highFrequency: 12000
    },
    warmth: {
        name: 'Warmth',
        category: 'Mix',
        low: 4,
        mid: 0,
        high: -4,
        lowFrequency: 150,
        highFrequency: 4000
    },
    clarity: {
        name: 'Clarity',
        category: 'Mix',
        low: -2,
        mid: 0,
        high: 4,
        lowFrequency: 3000,
        highFrequency: 8000
    },
    de_boom: {
        name: 'De-Boom',
        category: 'Mix',
        low: -6,
        mid: 0,
        high: 0,
        lowFrequency: 80,
        highFrequency: 2000
    },
    de_muddy: {
        name: 'De-Muddy',
        category: 'Mix',
        low: -4,
        mid: -4,
        high: 2,
        lowFrequency: 200,
        highFrequency: 4000
    },
    de_harsh: {
        name: 'De-Harsh',
        category: 'Mix',
        low: 0,
        mid: -4,
        high: -2,
        lowFrequency: 1000,
        highFrequency: 4000
    }
};

// Get presets by category
export function getEQPresetsByCategory() {
    const categories = {};
    Object.values(EQ_PRESETS).forEach(preset => {
        if (!categories[preset.category]) {
            categories[preset.category] = [];
        }
        categories[preset.category].push(preset);
    });
    return categories;
}

// Get all preset names by category
export function getEQPresetCategories() {
    const categories = new Set();
    Object.values(EQ_PRESETS).forEach(preset => {
        categories.add(preset.category);
    });
    return Array.from(categories).sort();
}

// Apply preset to an EQ3 instance
export function applyEQPreset(eq3Instance, presetId) {
    const preset = EQ_PRESETS[presetId];
    if (!preset || !eq3Instance) return false;

    if (typeof eq3Instance.low.value !== 'undefined') {
        eq3Instance.low.value = preset.low;
    }
    if (typeof eq3Instance.mid.value !== 'undefined') {
        eq3Instance.mid.value = preset.mid;
    }
    if (typeof eq3Instance.high.value !== 'undefined') {
        eq3Instance.high.value = preset.high;
    }
    if (typeof eq3Instance.lowFrequency.value !== 'undefined') {
        eq3Instance.lowFrequency.value = preset.lowFrequency;
    }
    if (typeof eq3Instance.highFrequency.value !== 'undefined') {
        eq3Instance.highFrequency.value = preset.highFrequency;
    }

    return true;
}

// Get preset data for UI
export function getEQPresetData(presetId) {
    return EQ_PRESETS[presetId] || null;
}