// js/FeatureAdditions.js - Additional feature implementations for SnugOS DAW

// ===========================================
// REVERB POOL
// Multiple named reverb spaces that can be saved and shared across tracks
// ===========================================

let reverbPool = {}; // { poolName: { name, decay, preDelay, wet, createdAt } }

// Default reverb spaces
const DEFAULT_REVERB_SPACES = [
    { name: 'Small Room', decay: 0.5, preDelay: 0.01, wet: 0.3 },
    { name: 'Medium Hall', decay: 1.2, preDelay: 0.02, wet: 0.4 },
    { name: 'Large Hall', decay: 2.5, preDelay: 0.03, wet: 0.5 },
    { name: 'Cathedral', decay: 5.0, preDelay: 0.05, wet: 0.6 },
    { name: 'Plate', decay: 1.0, preDelay: 0.005, wet: 0.35 },
    { name: 'Ambient', decay: 8.0, preDelay: 0.08, wet: 0.7 }
];

// Initialize reverb pool with defaults
function initReverbPool() {
    DEFAULT_REVERB_SPACES.forEach(space => {
        reverbPool[space.name] = {
            ...space,
            createdAt: new Date().toISOString()
        };
    });
}
initReverbPool();

export function getReverbPool() { return JSON.parse(JSON.stringify(reverbPool)); }
export function getReverbPoolNames() { return Object.keys(reverbPool); }
export function getReverbSpace(name) {
    if (reverbPool[name]) {
        return JSON.parse(JSON.stringify(reverbPool[name]));
    }
    return null;
}

export function saveReverbSpace(name, decay, preDelay, wet) {
    if (!name || !name.trim()) return false;
    const spaceName = name.trim();
    reverbPool[spaceName] = {
        name: spaceName,
        decay: decay !== undefined ? decay : 1.5,
        preDelay: preDelay !== undefined ? preDelay : 0.02,
        wet: wet !== undefined ? wet : 0.5,
        createdAt: new Date().toISOString()
    };
    console.log(`[ReverbPool] Saved reverb space "${spaceName}"`);
    return true;
}

export function deleteReverbSpace(name) {
    if (reverbPool[name] && !DEFAULT_REVERB_SPACES.find(s => s.name === name)) {
        delete reverbPool[name];
        console.log(`[ReverbPool] Deleted reverb space "${name}"`);
        return true;
    }
    console.warn(`[ReverbPool] Cannot delete default or non-existent reverb space "${name}"`);
    return false;
}

export function applyReverbSpaceToEffect(effect, spaceName) {
    const space = getReverbSpace(spaceName);
    if (!space || !effect) {
        console.warn(`[ReverbPool] Reverb space "${spaceName}" not found or invalid effect`);
        return false;
    }
    if (effect.params) {
        if (effect.params.decay !== undefined) effect.params.decay = space.decay;
        if (effect.params.preDelay !== undefined) effect.params.preDelay = space.preDelay;
        if (effect.params.wet !== undefined) effect.params.wet = space.wet;
        console.log(`[ReverbPool] Applied reverb space "${spaceName}" to effect`);
        return true;
    }
    return false;
}

// ===========================================
// TEMPO NUDGE
// Fine-grained tempo adjustment with arrow keys during playback
// ===========================================

let tempoNudgeEnabled = true;
let tempoNudgeStep = 1; // BPM step per nudge
let getBPMCallback = null;
let setBPMCallback = null;

export function initTempoNudge(getBPMFn, setBPMFn) {
    getBPMCallback = getBPMFn;
    setBPMCallback = setBPMFn;
}

export function getTempoNudgeEnabled() { return tempoNudgeEnabled; }
export function setTempoNudgeEnabled(enabled) { tempoNudgeEnabled = enabled; }
export function getTempoNudgeStep() { return tempoNudgeStep; }
export function setTempoNudgeStep(step) { tempoNudgeStep = Math.max(0.1, Math.min(10, step)); }

export function nudgeTempoUp() {
    if (!tempoNudgeEnabled || !getBPMCallback || !setBPMCallback) return false;
    const currentBpm = getBPMCallback();
    if (currentBpm < 300) {
        const newBpm = currentBpm + tempoNudgeStep;
        setBPMCallback(newBpm);
        console.log(`[TempoNudge] Tempo nudged up to ${newBpm} BPM`);
        return true;
    }
    return false;
}

export function nudgeTempoDown() {
    if (!tempoNudgeEnabled || !getBPMCallback || !setBPMCallback) return false;
    const currentBpm = getBPMCallback();
    if (currentBpm > 20) {
        const newBpm = currentBpm - tempoNudgeStep;
        setBPMCallback(newBpm);
        console.log(`[TempoNudge] Tempo nudged down to ${newBpm} BPM`);
        return true;
    }
    return false;
}

// ===========================================
// TRACK MIRROR
// Real-time duplicate of a track with offset for parallel processing
// ===========================================

let trackMirrors = {}; // { mirrorId: { sourceTrackId, offsetMs, gain, enabled, createdAt } }
let mirrorIdCounter = 0;

export function getTrackMirrors() { return JSON.parse(JSON.stringify(trackMirrors)); }

export function createTrackMirror(sourceTrackId, offsetMs = 0, gain = 1.0) {
    const mirrorId = `mirror_${++mirrorIdCounter}`;
    trackMirrors[mirrorId] = {
        id: mirrorId,
        sourceTrackId,
        offsetMs: Math.max(0, offsetMs),
        gain: Math.max(0, Math.min(2, gain)),
        enabled: true,
        createdAt: new Date().toISOString()
    };
    console.log(`[TrackMirror] Created mirror ${mirrorId} for track ${sourceTrackId} with ${offsetMs}ms offset`);
    return mirrorId;
}

export function updateTrackMirror(mirrorId, updates) {
    if (!trackMirrors[mirrorId]) {
        console.warn(`[TrackMirror] Mirror ${mirrorId} not found`);
        return false;
    }
    if (updates.offsetMs !== undefined) trackMirrors[mirrorId].offsetMs = Math.max(0, updates.offsetMs);
    if (updates.gain !== undefined) trackMirrors[mirrorId].gain = Math.max(0, Math.min(2, updates.gain));
    if (updates.enabled !== undefined) trackMirrors[mirrorId].enabled = updates.enabled;
    console.log(`[TrackMirror] Updated mirror ${mirrorId}`);
    return true;
}

export function deleteTrackMirror(mirrorId) {
    if (trackMirrors[mirrorId]) {
        delete trackMirrors[mirrorId];
        console.log(`[TrackMirror] Deleted mirror ${mirrorId}`);
        return true;
    }
    return false;
}

export function getMirrorsForTrack(sourceTrackId) {
    return Object.values(trackMirrors).filter(m => m.sourceTrackId === sourceTrackId);
}

// ===========================================
// AUDIO TAP TEMPO
// Tap to set project tempo from audio/claps (audio detection)
// ===========================================

let audioTapTempoEnabled = false;
let audioTapTempoThreshold = -30; // dB threshold for detection
let audioTapTempoTimeout = null;
let audioTapTempoTimes = [];
let audioTapTempoAnalyser = null;

export function getAudioTapTempoEnabled() { return audioTapTempoEnabled; }
export function setAudioTapTempoEnabled(enabled) { audioTapTempoEnabled = enabled; }
export function getAudioTapTempoThreshold() { return audioTapTempoThreshold; }
export function setAudioTapTempoThreshold(threshold) { audioTapTempoThreshold = threshold; }

export function initAudioTapTempo(analyserNode) {
    audioTapTempoAnalyser = analyserNode;
    console.log('[AudioTapTempo] Initialized with analyser node');
}

export function processAudioTapTempo(setBPMFn) {
    if (!audioTapTempoEnabled || !audioTapTempoAnalyser) return;
    
    const dataArray = new Float32Array(audioTapTempoAnalyser.fftSize);
    audioTapTempoAnalyser.getFloatTimeDomainData(dataArray);
    
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const db = 20 * Math.log10(rms);
    
    // Check if above threshold
    if (db > audioTapTempoThreshold) {
        const now = Date.now();
        audioTapTempoTimes.push(now);
        
        // Keep only last 8 taps
        if (audioTapTempoTimes.length > 8) {
            audioTapTempoTimes.shift();
        }
        
        // Calculate BPM if we have enough taps
        if (audioTapTempoTimes.length >= 4) {
            const intervals = [];
            for (let i = 1; i < audioTapTempoTimes.length; i++) {
                intervals.push(audioTapTempoTimes[i] - audioTapTempoTimes[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.round(60000 / avgInterval);
            
            if (bpm >= 20 && bpm <= 300 && setBPMFn) {
                setBPMFn(bpm);
                console.log(`[AudioTapTempo] Detected BPM: ${bpm}`);
            }
        }
        
        // Clear timeout
        clearTimeout(audioTapTempoTimeout);
        audioTapTempoTimeout = setTimeout(() => {
            audioTapTempoTimes = [];
        }, 2000);
    }
}

// ===========================================
// CLIP GOVERNOR
// Limit total number of clips visible on timeline to reduce visual clutter
// ===========================================

let clipGovernorEnabled = false;
let clipGovernorLimit = 100;
let clipGovernorMode = 'oldest'; // 'oldest', 'farthest', 'random'

export function getClipGovernorEnabled() { return clipGovernorEnabled; }
export function setClipGovernorEnabled(enabled) { clipGovernorEnabled = enabled; }
export function getClipGovernorLimit() { return clipGovernorLimit; }
export function setClipGovernorLimit(limit) { clipGovernorLimit = Math.max(1, Math.min(1000, limit)); }
export function getClipGovernorMode() { return clipGovernorMode; }
export function setClipGovernorMode(mode) { 
    if (['oldest', 'farthest', 'random'].includes(mode)) {
        clipGovernorMode = mode;
    }
}

export function applyClipGovernor(clips, currentTime, viewStart, viewEnd) {
    if (!clipGovernorEnabled) return clips;
    
    if (clips.length <= clipGovernorLimit) return clips;
    
    // Sort clips based on mode
    let sortedClips = [...clips];
    
    switch (clipGovernorMode) {
        case 'oldest':
            // Keep clips closest to current time
            sortedClips.sort((a, b) => {
                const distA = Math.abs(a.startTime - currentTime);
                const distB = Math.abs(b.startTime - currentTime);
                return distA - distB;
            });
            break;
        case 'farthest':
            // Keep clips farthest from current time (for overview)
            sortedClips.sort((a, b) => {
                const distA = Math.abs(a.startTime - currentTime);
                const distB = Math.abs(b.startTime - currentTime);
                return distB - distA;
            });
            break;
        case 'random':
            // Random selection
            for (let i = sortedClips.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sortedClips[i], sortedClips[j]] = [sortedClips[j], sortedClips[i]];
            }
            break;
    }
    
    return sortedClips.slice(0, clipGovernorLimit);
}

// ===========================================
// SIGNAL FLOW DIAGRAM
// Visual node-based view of track signal chain
// ===========================================

export function generateSignalFlowDiagram(track, trackEffects, masterEffects) {
    const nodes = [];
    const connections = [];
    let nodeId = 0;
    
    // Helper to add node
    const addNode = (type, label, x, y) => {
        const id = `node_${nodeId++}`;
        nodes.push({ id, type, label, x, y });
        return id;
    };
    
    // Helper to add connection
    const addConnection = (sourceId, targetId, label = '') => {
        connections.push({ source: sourceId, target: targetId, label });
    };
    
    // Input node
    const inputId = addNode('input', track?.name || 'Input', 0, 100);
    
    // Track effects
    let prevId = inputId;
    let x = 150;
    
    if (trackEffects && trackEffects.length > 0) {
        trackEffects.forEach((effect, index) => {
            const effectId = addNode('effect', effect.type || `Effect ${index + 1}`, x, 100);
            addConnection(prevId, effectId);
            prevId = effectId;
            x += 150;
        });
    }
    
    // Track output (volume/pan)
    const trackOutId = addNode('mixer', 'Track Out', x, 100);
    addConnection(prevId, trackOutId);
    prevId = trackOutId;
    x += 150;
    
    // Master effects
    if (masterEffects && masterEffects.length > 0) {
        masterEffects.forEach((effect, index) => {
            const masterEffectId = addNode('masterEffect', effect.type || `Master ${index + 1}`, x, 100);
            addConnection(prevId, masterEffectId);
            prevId = masterEffectId;
            x += 150;
        });
    }
    
    // Master output
    const masterOutId = addNode('output', 'Master Out', x, 100);
    addConnection(prevId, masterOutId);
    
    return { nodes, connections };
}

export function renderSignalFlowSVG(diagram, width = 800, height = 200) {
    const { nodes, connections } = diagram;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<style>
        .node-input { fill: #22c55e; }
        .node-effect { fill: #3b82f6; }
        .node-masterEffect { fill: #8b5cf6; }
        .node-mixer { fill: #f97316; }
        .node-output { fill: #ef4444; }
        .node-text { fill: white; font-size: 12px; text-anchor: middle; }
        .connection { stroke: #6b7280; stroke-width: 2; fill: none; }
    </style>`;
    
    // Draw connections first (behind nodes)
    connections.forEach(conn => {
        const source = nodes.find(n => n.id === conn.source);
        const target = nodes.find(n => n.id === conn.target);
        if (source && target) {
            svg += `<line class="connection" x1="${source.x + 40}" y1="${source.y}" x2="${target.x - 40}" y2="${target.y}"/>`;
        }
    });
    
    // Draw nodes
    nodes.forEach(node => {
        const nodeClass = `node-${node.type}`;
        svg += `<rect class="${nodeClass}" x="${node.x - 40}" y="${node.y - 20}" width="80" height="40" rx="5"/>`;
        svg += `<text class="node-text" x="${node.x}" y="${node.y + 4}">${node.label}</text>`;
    });
    
    svg += '</svg>';
    return svg;
}

// ===========================================
// MIDI INPUT FILTER
// Filter specific notes/channels from MIDI input
// ===========================================

let midiInputFilter = {
    enabled: false,
    noteFilter: [], // Array of MIDI note numbers to block (0-127)
    channelFilter: [], // Array of MIDI channels to block (1-16)
    velocityRange: { min: 0, max: 127 }, // Only accept velocities in this range
    transposeAmount: 0 // Transpose incoming notes by this many semitones
};

export function getMIDIInputFilter() { return JSON.parse(JSON.stringify(midiInputFilter)); }

export function setMIDIInputFilter(filter) {
    midiInputFilter = {
        enabled: filter.enabled || false,
        noteFilter: filter.noteFilter || [],
        channelFilter: filter.channelFilter || [],
        velocityRange: filter.velocityRange || { min: 0, max: 127 },
        transposeAmount: filter.transposeAmount || 0
    };
    console.log('[MIDIInputFilter] Filter updated');
}

export function setMIDIInputFilterEnabled(enabled) {
    midiInputFilter.enabled = enabled;
    console.log(`[MIDIInputFilter] ${enabled ? 'Enabled' : 'Disabled'}`);
}

export function addMIDINoteFilter(noteNumber) {
    if (!midiInputFilter.noteFilter.includes(noteNumber)) {
        midiInputFilter.noteFilter.push(noteNumber);
    }
}

export function removeMIDINoteFilter(noteNumber) {
    midiInputFilter.noteFilter = midiInputFilter.noteFilter.filter(n => n !== noteNumber);
}

export function addMIDIChannelFilter(channel) {
    if (!midiInputFilter.channelFilter.includes(channel)) {
        midiInputFilter.channelFilter.push(channel);
    }
}

export function removeMIDIChannelFilter(channel) {
    midiInputFilter.channelFilter = midiInputFilter.channelFilter.filter(c => c !== channel);
}

export function filterMIDIInput(noteNumber, velocity, channel) {
    if (!midiInputFilter.enabled) return { pass: true, noteNumber, velocity, channel };
    
    if (midiInputFilter.noteFilter.includes(noteNumber)) {
        return { pass: false, reason: 'note_filtered' };
    }
    
    if (midiInputFilter.channelFilter.includes(channel)) {
        return { pass: false, reason: 'channel_filtered' };
    }
    
    if (velocity < midiInputFilter.velocityRange.min || velocity > midiInputFilter.velocityRange.max) {
        return { pass: false, reason: 'velocity_out_of_range' };
    }
    
    let transposedNote = noteNumber + midiInputFilter.transposeAmount;
    transposedNote = Math.max(0, Math.min(127, transposedNote));
    
    return { pass: true, noteNumber: transposedNote, velocity, channel };
}

// ===========================================
// WAVEFORM OVERLAY
// Overlay multiple audio clip waveforms for comparison
// ===========================================

let waveformOverlayEnabled = false;
let waveformOverlayTracks = []; // Array of track IDs to overlay
let waveformOverlayOpacity = 0.5;

export function getWaveformOverlayEnabled() { return waveformOverlayEnabled; }
export function setWaveformOverlayEnabled(enabled) { waveformOverlayEnabled = enabled; }
export function getWaveformOverlayTracks() { return [...waveformOverlayTracks]; }
export function getWaveformOverlayOpacity() { return waveformOverlayOpacity; }
export function setWaveformOverlayOpacity(opacity) { waveformOverlayOpacity = Math.max(0.1, Math.min(1, opacity)); }

export function addWaveformOverlayTrack(trackId) {
    if (!waveformOverlayTracks.includes(trackId)) {
        waveformOverlayTracks.push(trackId);
        console.log(`[WaveformOverlay] Added track ${trackId}`);
    }
}

export function removeWaveformOverlayTrack(trackId) {
    waveformOverlayTracks = waveformOverlayTracks.filter(id => id !== trackId);
    console.log(`[WaveformOverlay] Removed track ${trackId}`);
}

export function clearWaveformOverlayTracks() {
    waveformOverlayTracks = [];
    console.log('[WaveformOverlay] Cleared all tracks');
}

export function drawWaveformOverlay(ctx, width, height, audioBuffers, colors) {
    if (!waveformOverlayEnabled || !audioBuffers || audioBuffers.length === 0) return;
    
    ctx.globalAlpha = waveformOverlayOpacity;
    ctx.lineWidth = 1;
    
    audioBuffers.forEach((buffer, index) => {
        if (!buffer) return;
        
        const color = colors[index % colors.length] || `hsl(${index * 60}, 70%, 50%)`;
        ctx.strokeStyle = color;
        ctx.beginPath();
        
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;
        
        for (let i = 0; i < width; i++) {
            const min = Math.min(...data.slice(i * step, (i + 1) * step));
            const max = Math.max(...data.slice(i * step, (i + 1) * step));
            
            ctx.moveTo(i, amp + min * amp);
            ctx.lineTo(i, amp + max * amp);
        }
        
        ctx.stroke();
    });
    
    ctx.globalAlpha = 1;
}

// ===========================================
// EQ PRESET LIBRARY
// Built-in EQ presets for common instruments
// ===========================================

const EQ_PRESETS = {
    'kick_thump': { name: 'Kick - Thump', low: 6, mid: -4, high: -2, lowFrequency: 80, highFrequency: 3000 },
    'kick_punch': { name: 'Kick - Punch', low: 4, mid: 2, high: -2, lowFrequency: 100, highFrequency: 4000 },
    'snare_crack': { name: 'Snare - Crack', low: -2, mid: 4, high: 6, lowFrequency: 200, highFrequency: 6000 },
    'snare_fat': { name: 'Snare - Fat', low: 4, mid: 0, high: 2, lowFrequency: 150, highFrequency: 5000 },
    'hihat_crisp': { name: 'Hi-Hat - Crisp', low: -6, mid: 0, high: 6, lowFrequency: 400, highFrequency: 10000 },
    'vocal_presence': { name: 'Vocal - Presence', low: -2, mid: 2, high: 4, lowFrequency: 200, highFrequency: 5000 },
    'vocal_warmth': { name: 'Vocal - Warmth', low: 4, mid: 0, high: -2, lowFrequency: 150, highFrequency: 4000 },
    'bass_sub': { name: 'Bass - Sub', low: 6, mid: -4, high: -6, lowFrequency: 60, highFrequency: 2000 },
    'bass_growl': { name: 'Bass - Growl', low: 2, mid: 4, high: -2, lowFrequency: 100, highFrequency: 3000 },
    'guitar_mids': { name: 'Guitar - Mids', low: -2, mid: 4, high: -2, lowFrequency: 200, highFrequency: 4000 },
    'guitar_brightness': { name: 'Guitar - Brightness', low: -4, mid: 0, high: 6, lowFrequency: 300, highFrequency: 6000 },
    'keys_warm': { name: 'Keys - Warm', low: 2, mid: 0, high: -4, lowFrequency: 200, highFrequency: 5000 },
    'synth_leads': { name: 'Synth - Leads', low: -2, mid: 4, high: 4, lowFrequency: 250, highFrequency: 5000 },
    'synth_pads': { name: 'Synth - Pads', low: 2, mid: -2, high: 2, lowFrequency: 150, highFrequency: 4000 },
    'master_smile': { name: 'Master - Smile Curve', low: 3, mid: -2, high: 3, lowFrequency: 100, highFrequency: 8000 },
    'master_flat': { name: 'Master - Flat', low: 0, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500 }
};

export function getEQPresets() { return JSON.parse(JSON.stringify(EQ_PRESETS)); }
export function getEQPresetNames() { return Object.keys(EQ_PRESETS); }
export function getEQPreset(name) { return EQ_PRESETS[name] ? JSON.parse(JSON.stringify(EQ_PRESETS[name])) : null; }

export function applyEQPresetToEffect(effect, presetName) {
    const preset = getEQPreset(presetName);
    if (!preset || !effect) {
        console.warn(`[EQPresets] Preset "${presetName}" not found or invalid effect`);
        return false;
    }
    
    if (effect.params) {
        if (effect.params.low !== undefined) effect.params.low = preset.low;
        if (effect.params.mid !== undefined) effect.params.mid = preset.mid;
        if (effect.params.high !== undefined) effect.params.high = preset.high;
        if (effect.params.lowFrequency !== undefined) effect.params.lowFrequency = preset.lowFrequency;
        if (effect.params.highFrequency !== undefined) effect.params.highFrequency = preset.highFrequency;
        console.log(`[EQPresets] Applied preset "${presetName}" to effect`);
        return true;
    }
    return false;
}

console.log('[FeatureAdditions] All features loaded');