// js/FeatureAdditions.js - Additional feature implementations for SnugOS DAW

// Import new feature modules
export { VisualizationModes, VISUALIZATION_MODES, COLOR_SCHEMES, openVisualizationModesPanel } from './VisualizationModes.js';
export { PerformanceMode, Scene, SCENE_TYPES, TRIGGER_MODES, initPerformanceMode, openPerformanceModePanel } from './PerformanceMode.js';
export { SmartQuantize, QUANTIZE_MODES, GROOVE_TEMPLATES, quantizeNotes, analyzeNotes, openSmartQuantizePanel } from './SmartQuantize.js';
export { AudioSpectrumComparison, createAudioSpectrumComparison, createAudioSpectrumComparisonPanel } from './AudioSpectrumComparison.js';
export { RealtimeMIDIMonitor, createRealtimeMIDIMonitor, createMIDIMonitorPanel } from './RealtimeMIDIMonitor.js';
export { initializeTrackGroups, getTrackGroups, getTrackGroupById, getTrackGroupForTrack, createTrackGroup, removeTrackGroup, renameTrackGroup, addTrackToGroup, removeTrackFromGroup, setGroupVolume, setGroupMute, setGroupSolo, setGroupPan, toggleGroupCollapse, duplicateGroup, moveGroup, selectGroupTracks, ungroup, handleTrackDeletedFromGroups, clearAllTrackGroups, getTrackGroupsForSave, restoreTrackGroups, createTrackGroupsPanel } from './TrackGrouping.js';

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

// ===========================================
// TRACK NOTES
// Add text notes to tracks for documentation
// ===========================================

let trackNotes = {}; // { trackId: { text, createdAt, updatedAt } }

export function getTrackNotes() { return JSON.parse(JSON.stringify(trackNotes)); }

export function getTrackNote(trackId) {
    return trackNotes[trackId] ? JSON.parse(JSON.stringify(trackNotes[trackId])) : null;
}

export function setTrackNote(trackId, text) {
    if (!trackId) return false;
    
    const now = new Date().toISOString();
    
    if (trackNotes[trackId]) {
        trackNotes[trackId].text = text;
        trackNotes[trackId].updatedAt = now;
    } else {
        trackNotes[trackId] = {
            text,
            createdAt: now,
            updatedAt: now
        };
    }
    
    console.log(`[TrackNotes] Set note for track ${trackId}`);
    return true;
}

export function deleteTrackNote(trackId) {
    if (trackNotes[trackId]) {
        delete trackNotes[trackId];
        console.log(`[TrackNotes] Deleted note for track ${trackId}`);
        return true;
    }
    return false;
}

export function clearAllTrackNotes() {
    trackNotes = {};
    console.log('[TrackNotes] Cleared all track notes');
}

// ===========================================
// PROJECT STATISTICS PANEL
// Show detailed project stats (tracks, clips, notes, duration)
// ===========================================

export function calculateProjectStatistics(tracks, playbackPosition = 0) {
    const stats = {
        trackCount: 0,
        clipCount: 0,
        noteCount: 0,
        audioClipCount: 0,
        midiClipCount: 0,
        totalDuration: 0,
        totalSize: 0,
        effectsCount: 0,
        armedTracks: 0,
        soloedTracks: 0,
        mutedTracks: 0,
        averageNotesPerTrack: 0,
        longestClip: null,
        shortestClip: null,
        tracksByType: {
            Audio: 0,
            Synth: 0,
            DrumSampler: 0,
            InstrumentSampler: 0,
            Lyrics: 0,
            Other: 0
        },
        estimatedMemoryUsage: 0,
        lastCalculated: new Date().toISOString()
    };
    
    if (!tracks || !Array.isArray(tracks)) return stats;
    
    stats.trackCount = tracks.length;
    
    let totalNotes = 0;
    let clipDurations = [];
    
    tracks.forEach(track => {
        // Track type counts
        if (stats.tracksByType[track.type] !== undefined) {
            stats.tracksByType[track.type]++;
        } else {
            stats.tracksByType.Other++;
        }
        
        // Track states
        if (track.isMuted) stats.mutedTracks++;
        if (track.isSoloed) stats.soloedTracks++;
        if (track.armed) stats.armedTracks++;
        
        // Effects count
        if (track.effects && Array.isArray(track.effects)) {
            stats.effectsCount += track.effects.length;
        }
        
        // Clips from sequences
        if (track.sequences && Array.isArray(track.sequences)) {
            track.sequences.forEach(seq => {
                stats.clipCount++;
                if (seq.startTime !== undefined && seq.duration !== undefined) {
                    const endTime = seq.startTime + seq.duration;
                    if (endTime > stats.totalDuration) {
                        stats.totalDuration = endTime;
                    }
                    clipDurations.push({ duration: seq.duration, trackName: track.name, seq });
                }
                
                // Notes in sequences
                if (seq.notes && Array.isArray(seq.notes)) {
                    totalNotes += seq.notes.length;
                    stats.noteCount += seq.notes.length;
                }
            });
        }
        
        // Audio clips
        if (track.audioClips && Array.isArray(track.audioClips)) {
            track.audioClips.forEach(clip => {
                stats.clipCount++;
                stats.audioClipCount++;
                if (clip.startTime !== undefined && clip.duration !== undefined) {
                    const endTime = clip.startTime + clip.duration;
                    if (endTime > stats.totalDuration) {
                        stats.totalDuration = endTime;
                    }
                    clipDurations.push({ duration: clip.duration, trackName: track.name, clip });
                }
            });
        }
        
        // Timeline clips
        if (track.clips && Array.isArray(track.clips)) {
            track.clips.forEach(clip => {
                stats.clipCount++;
                if (clip.startTime !== undefined && clip.duration !== undefined) {
                    const endTime = clip.startTime + clip.duration;
                    if (endTime > stats.totalDuration) {
                        stats.totalDuration = endTime;
                    }
                    clipDurations.push({ duration: clip.duration, trackName: track.name, clip });
                }
            });
        }
        
        // Memory estimation (rough)
        if (track.audioBuffer) {
            const sampleCount = track.audioBuffer.length;
            const channels = track.audioBuffer.numberOfChannels;
            stats.estimatedMemoryUsage += sampleCount * channels * 4; // 4 bytes per float32
        }
    });
    
    // Calculate averages and extremes
    if (tracks.length > 0) {
        stats.averageNotesPerTrack = Math.round(totalNotes / tracks.length);
    }
    
    if (clipDurations.length > 0) {
        clipDurations.sort((a, b) => a.duration - b.duration);
        stats.shortestClip = clipDurations[0];
        stats.longestClip = clipDurations[clipDurations.length - 1];
    }
    
    // Convert memory to MB
    stats.estimatedMemoryUsageMB = Math.round(stats.estimatedMemoryUsage / (1024 * 1024) * 100) / 100;
    
    return stats;
}

export function formatProjectStatistics(stats) {
    return {
        'Project Overview': {
            'Total Tracks': stats.trackCount,
            'Total Clips': stats.clipCount,
            'Audio Clips': stats.audioClipCount,
            'MIDI Clips': stats.midiClipCount,
            'Total Notes': stats.noteCount,
            'Project Duration': `${Math.round(stats.totalDuration * 10) / 10}s`
        },
        'Track Types': stats.tracksByType,
        'Track States': {
            'Armed': stats.armedTracks,
            'Soloed': stats.soloedTracks,
            'Muted': stats.mutedTracks
        },
        'Effects': {
            'Total Effects': stats.effectsCount,
            'Avg per Track': stats.trackCount > 0 ? Math.round(stats.effectsCount / stats.trackCount * 10) / 10 : 0
        },
        'Memory': {
            'Estimated Usage': `${stats.estimatedMemoryUsageMB} MB`
        }
    };
}

// ===========================================
// QUICK ACTIONS MENU
// Context menu for common actions
// ===========================================

const QUICK_ACTIONS = [
    { id: 'new-track', label: 'New Track', icon: '➕', shortcut: 'T', action: 'createTrack' },
    { id: 'delete-track', label: 'Delete Track', icon: '🗑️', shortcut: 'Del', action: 'deleteTrack' },
    { id: 'duplicate-track', label: 'Duplicate Track', icon: '📋', shortcut: 'Ctrl+D', action: 'duplicateTrack' },
    { id: 'divider-1', label: '---', icon: '', shortcut: '', action: null },
    { id: 'play-pause', label: 'Play/Pause', icon: '▶️', shortcut: 'Space', action: 'togglePlayback' },
    { id: 'stop', label: 'Stop', icon: '⏹️', shortcut: 'Enter', action: 'stopPlayback' },
    { id: 'divider-2', label: '---', icon: '', shortcut: '', action: null },
    { id: 'undo', label: 'Undo', icon: '↩️', shortcut: 'Ctrl+Z', action: 'undo' },
    { id: 'redo', label: 'Redo', icon: '↪️', shortcut: 'Ctrl+Y', action: 'redo' },
    { id: 'divider-3', label: '---', icon: '', shortcut: '', action: null },
    { id: 'save', label: 'Save Project', icon: '💾', shortcut: 'Ctrl+S', action: 'saveProject' },
    { id: 'export', label: 'Export Audio', icon: '📤', shortcut: 'Ctrl+E', action: 'exportAudio' },
    { id: 'divider-4', label: '---', icon: '', shortcut: '', action: null },
    { id: 'metronome', label: 'Toggle Metronome', icon: '🔔', shortcut: 'M', action: 'toggleMetronome' },
    { id: 'loop', label: 'Toggle Loop', icon: '🔄', shortcut: 'L', action: 'toggleLoop' },
    { id: 'divider-5', label: '---', icon: '', shortcut: '', action: null },
    { id: 'quantize', label: 'Quantize Selection', icon: '📏', shortcut: 'Q', action: 'quantize' },
    { id: 'transpose-up', label: 'Transpose +1', icon: '⬆️', shortcut: 'Shift+Up', action: 'transposeUp' },
    { id: 'transpose-down', label: 'Transpose -1', icon: '⬇️', shortcut: 'Shift+Down', action: 'transposeDown' }
];

export function getQuickActions() { return [...QUICK_ACTIONS]; }

export function getQuickActionById(id) {
    return QUICK_ACTIONS.find(a => a.id === id) || null;
}

export function executeQuickAction(actionId, callbacks) {
    const action = getQuickActionById(actionId);
    if (!action || !action.action) return false;
    
    const callback = callbacks[action.action];
    if (typeof callback === 'function') {
        callback();
        console.log(`[QuickActions] Executed: ${action.label}`);
        return true;
    }
    
    console.warn(`[QuickActions] No callback for action: ${action.action}`);
    return false;
}

// ===========================================
// VISUALIZATION MODES
// Different visualization modes for waveforms
// ===========================================

const VISUALIZATION_MODES = [
    { id: 'waveform', name: 'Classic Waveform', description: 'Standard amplitude display' },
    { id: 'spectrogram', name: 'Spectrogram', description: 'Frequency over time display' },
    { id: 'frequency-bars', name: 'Frequency Bars', description: 'Real-time frequency analysis' },
    { id: 'oscilloscope', name: 'Oscilloscope', description: 'Real-time waveform display' },
    { id: 'vu-meter', name: 'VU Meter', description: 'Volume unit meter display' },
    { id: 'phase-scope', name: 'Phase Scope', description: 'Stereo phase correlation' },
    { id: 'spectrum', name: 'Spectrum Analyzer', description: 'Full frequency spectrum' },
    { id: 'waterfall', name: 'Waterfall', description: '3D frequency waterfall' }
];

let currentVisualizationMode = 'waveform';
let visualizationSettings = {
    fftSize: 2048,
    smoothing: 0.8,
    colorScheme: 'default', // 'default', 'rainbow', 'monochrome', 'heat'
    showGrid: true,
    showPeaks: true,
    holdPeaks: false,
    peakDecay: 0.95
};

export function getVisualizationModes() { return [...VISUALIZATION_MODES]; }
export function getCurrentVisualizationMode() { return currentVisualizationMode; }
export function setCurrentVisualizationMode(modeId) {
    if (VISUALIZATION_MODES.find(m => m.id === modeId)) {
        currentVisualizationMode = modeId;
        console.log(`[Visualization] Mode set to: ${modeId}`);
        return true;
    }
    return false;
}

export function getVisualizationSettings() { return JSON.parse(JSON.stringify(visualizationSettings)); }
export function setVisualizationSettings(settings) {
    visualizationSettings = { ...visualizationSettings, ...settings };
}

export function drawVisualization(ctx, width, height, analyserNode, mode = null) {
    if (!analyserNode) return;
    
    const activeMode = mode || currentVisualizationMode;
    
    switch (activeMode) {
        case 'waveform':
            drawWaveformVisualization(ctx, width, height, analyserNode);
            break;
        case 'spectrogram':
            drawSpectrogramVisualization(ctx, width, height, analyserNode);
            break;
        case 'frequency-bars':
            drawFrequencyBarsVisualization(ctx, width, height, analyserNode);
            break;
        case 'oscilloscope':
            drawOscilloscopeVisualization(ctx, width, height, analyserNode);
            break;
        case 'vu-meter':
            drawVUMeterVisualization(ctx, width, height, analyserNode);
            break;
        case 'spectrum':
            drawSpectrumVisualization(ctx, width, height, analyserNode);
            break;
        default:
            drawWaveformVisualization(ctx, width, height, analyserNode);
    }
}

function drawWaveformVisualization(ctx, width, height, analyser) {
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = visualizationSettings.colorScheme === 'rainbow' 
        ? `hsl(${Date.now() % 360}, 70%, 50%)` 
        : '#00ff88';
    ctx.beginPath();
    
    const sliceWidth = width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    
    ctx.lineTo(width, height / 2);
    ctx.stroke();
}

function drawSpectrogramVisualization(ctx, width, height, analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    const barWidth = width / bufferLength;
    
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        const hue = (i / bufferLength) * 360;
        
        ctx.fillStyle = visualizationSettings.colorScheme === 'heat'
            ? `rgb(${dataArray[i]}, ${dataArray[i] * 0.5}, ${dataArray[i] * 0.2})`
            : `hsl(${hue}, 70%, 50%)`;
        
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
}

function drawFrequencyBarsVisualization(ctx, width, height, analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    const numBars = 32;
    const barWidth = width / numBars - 2;
    const step = Math.floor(bufferLength / numBars);
    
    for (let i = 0; i < numBars; i++) {
        const value = dataArray[i * step];
        const barHeight = (value / 255) * height * 0.9;
        
        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#00ff88');
        gradient.addColorStop(0.5, '#00cc66');
        gradient.addColorStop(1, '#008844');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(i * (barWidth + 2) + 1, height - barHeight, barWidth, barHeight);
    }
}

function drawOscilloscopeVisualization(ctx, width, height, analyser) {
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);
    
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    if (visualizationSettings.showGrid) {
        ctx.strokeStyle = '#1a1a3a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(i * width / 10, 0);
            ctx.lineTo(i * width / 10, height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * height / 10);
            ctx.lineTo(width, i * height / 10);
            ctx.stroke();
        }
    }
    
    // Center line
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Waveform
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const sliceWidth = width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        const y = (dataArray[i] + 1) * height / 2;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    
    ctx.stroke();
}

function drawVUMeterVisualization(ctx, width, height, analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const level = rms / 255;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw VU meter
    const meterWidth = width * 0.8;
    const meterHeight = 30;
    const meterX = width * 0.1;
    const meterY = height / 2 - meterHeight / 2;
    
    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
    
    // Level
    const levelWidth = level * meterWidth;
    const gradient = ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(0.7, '#ffff00');
    gradient.addColorStop(0.85, '#ff8800');
    gradient.addColorStop(1, '#ff0000');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(meterX, meterY, levelWidth, meterHeight);
    
    // Scale marks
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        const x = meterX + (i / 10) * meterWidth;
        ctx.beginPath();
        ctx.moveTo(x, meterY + meterHeight);
        ctx.lineTo(x, meterY + meterHeight + 5);
        ctx.stroke();
    }
    
    // dB label
    const db = 20 * Math.log10(level || 0.0001);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${db.toFixed(1)} dB`, width / 2, meterY - 10);
}

function drawSpectrumVisualization(ctx, width, height, analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, width, height);
    
    // Logarithmic frequency scale
    const logMin = Math.log10(20);
    const logMax = Math.log10(20000);
    const logRange = logMax - logMin;
    
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    for (let i = 0; i < bufferLength; i++) {
        const freq = (i / bufferLength) * 22050; // Nyquist
        if (freq < 20) continue;
        
        const logFreq = Math.log10(freq);
        const x = ((logFreq - logMin) / logRange) * width;
        const y = height - (dataArray[i] / 255) * height;
        
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(width, height);
    ctx.closePath();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.25, '#ff8800');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(0.75, '#00ff00');
    gradient.addColorStop(1, '#0088ff');
    
    ctx.fillStyle = gradient;
    ctx.fill();
}

// ===========================================
// COLLABORATION INVITE
// Generate invite links for collaboration
// ===========================================

let collaborationInvites = {}; // { inviteId: { projectId, createdBy, createdAt, expiresAt, permissions } }
let inviteIdCounter = 0;

export function createCollaborationInvite(projectId, options = {}) {
    const inviteId = `invite_${Date.now()}_${++inviteIdCounter}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (options.expiresInHours || 24) * 60 * 60 * 1000);
    
    collaborationInvites[inviteId] = {
        id: inviteId,
        projectId,
        createdBy: options.createdBy || 'unknown',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        permissions: options.permissions || ['read', 'write'],
        maxUses: options.maxUses || 5,
        currentUses: 0,
        active: true
    };
    
    console.log(`[CollaborationInvite] Created invite: ${inviteId}`);
    return inviteId;
}

export function getCollaborationInvite(inviteId) {
    const invite = collaborationInvites[inviteId];
    if (!invite) return null;
    
    // Check expiration
    if (new Date(invite.expiresAt) < new Date()) {
        invite.active = false;
    }
    
    return JSON.parse(JSON.stringify(invite));
}

export function useCollaborationInvite(inviteId) {
    const invite = collaborationInvites[inviteId];
    if (!invite) {
        console.warn(`[CollaborationInvite] Invite not found: ${inviteId}`);
        return { success: false, reason: 'not_found' };
    }
    
    if (!invite.active) {
        return { success: false, reason: 'inactive' };
    }
    
    if (new Date(invite.expiresAt) < new Date()) {
        invite.active = false;
        return { success: false, reason: 'expired' };
    }
    
    if (invite.currentUses >= invite.maxUses) {
        invite.active = false;
        return { success: false, reason: 'max_uses_reached' };
    }
    
    invite.currentUses++;
    console.log(`[CollaborationInvite] Used invite ${inviteId} (${invite.currentUses}/${invite.maxUses})`);
    
    return { success: true, projectId: invite.projectId, permissions: invite.permissions };
}

export function revokeCollaborationInvite(inviteId) {
    if (collaborationInvites[inviteId]) {
        collaborationInvites[inviteId].active = false;
        console.log(`[CollaborationInvite] Revoked invite: ${inviteId}`);
        return true;
    }
    return false;
}

export function getActiveInvitesForProject(projectId) {
    return Object.values(collaborationInvites)
        .filter(inv => inv.projectId === projectId && inv.active && new Date(inv.expiresAt) > new Date())
        .map(inv => JSON.parse(JSON.stringify(inv)));
}

export function generateInviteURL(inviteId, baseUrl = 'https://snugos.github.io/snaw/') {
    const invite = getCollaborationInvite(inviteId);
    if (!invite) return null;
    return `${baseUrl}?invite=${inviteId}`;
}

// ===========================================
// PERFORMANCE MODE
// Live performance interface with scene triggering
// ===========================================

let performanceModeEnabled = false;
let performanceSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 0,
    showCountdown: true,
    countdownDuration: 4,
    quantizeToBar: true,
    fadeBetweenScenes: false,
    fadeDuration: 500
};

let performanceState = {
    currentSceneIndex: -1,
    nextSceneIndex: -1,
    isPlaying: false,
    countdownActive: false,
    countdownRemaining: 0
};

export function getPerformanceModeEnabled() { return performanceModeEnabled; }
export function setPerformanceModeEnabled(enabled) { 
    performanceModeEnabled = enabled;
    console.log(`[PerformanceMode] ${enabled ? 'Enabled' : 'Disabled'}`);
}

export function getPerformanceSettings() { return JSON.parse(JSON.stringify(performanceSettings)); }
export function setPerformanceSettings(settings) {
    performanceSettings = { ...performanceSettings, ...settings };
}

export function getPerformanceState() { return JSON.parse(JSON.stringify(performanceState)); }

export function triggerScene(sceneIndex, callbacks) {
    if (!performanceModeEnabled) return false;
    
    performanceState.currentSceneIndex = sceneIndex;
    console.log(`[PerformanceMode] Triggered scene ${sceneIndex}`);
    
    if (callbacks && callbacks.onSceneTrigger) {
        callbacks.onSceneTrigger(sceneIndex);
    }
    
    return true;
}

export function advanceToNextScene(callbacks) {
    performanceState.nextSceneIndex = performanceState.currentSceneIndex + 1;
    
    if (performanceSettings.showCountdown) {
        startCountdown(callbacks);
    } else {
        performanceState.currentSceneIndex = performanceState.nextSceneIndex;
        if (callbacks && callbacks.onSceneTrigger) {
            callbacks.onSceneTrigger(performanceState.currentSceneIndex);
        }
    }
}

function startCountdown(callbacks) {
    performanceState.countdownActive = true;
    performanceState.countdownRemaining = performanceSettings.countdownDuration;
    
    if (callbacks && callbacks.onCountdownStart) {
        callbacks.onCountdownStart(performanceState.countdownRemaining);
    }
    
    const countdownInterval = setInterval(() => {
        performanceState.countdownRemaining--;
        
        if (callbacks && callbacks.onCountdownTick) {
            callbacks.onCountdownTick(performanceState.countdownRemaining);
        }
        
        if (performanceState.countdownRemaining <= 0) {
            clearInterval(countdownInterval);
            performanceState.countdownActive = false;
            performanceState.currentSceneIndex = performanceState.nextSceneIndex;
            
            if (callbacks && callbacks.onSceneTrigger) {
                callbacks.onSceneTrigger(performanceState.currentSceneIndex);
            }
        }
    }, 1000);
}

export function stopPerformance() {
    performanceState.isPlaying = false;
    performanceState.countdownActive = false;
    console.log('[PerformanceMode] Performance stopped');
}

export function getPerformanceKeyboardMappings() {
    return [
        { key: '1', action: 'trigger_scene_0' },
        { key: '2', action: 'trigger_scene_1' },
        { key: '3', action: 'trigger_scene_2' },
        { key: '4', action: 'trigger_scene_3' },
        { key: '5', action: 'trigger_scene_4' },
        { key: '6', action: 'trigger_scene_5' },
        { key: '7', action: 'trigger_scene_6' },
        { key: '8', action: 'trigger_scene_7' },
        { key: 'Space', action: 'toggle_playback' },
        { key: 'Enter', action: 'advance_scene' },
        { key: 'Escape', action: 'stop_performance' }
    ];
}

// ===========================================
// CLIP COLOR CODING
// Assign colors to clips for visual organization
// ===========================================

const CLIP_COLOR_PALETTE = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#6366f1', // indigo
    '#84cc16', // lime
    '#06b6d4', // cyan
    '#a855f7', // purple
    '#f43f5e', // rose
    '#10b981', // emerald
    '#64748b', // slate
    '#78716c'  // stone
];

let clipColors = {}; // { clipId: color }

export function getClipColorPalette() { return [...CLIP_COLOR_PALETTE]; }

export function getClipColor(clipId) {
    return clipColors[clipId] || null;
}

export function setClipColor(clipId, color) {
    // Validate color
    if (!CLIP_COLOR_PALETTE.includes(color) && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        console.warn(`[ClipColors] Invalid color: ${color}`);
        return false;
    }
    
    clipColors[clipId] = color;
    console.log(`[ClipColors] Set color for clip ${clipId} to ${color}`);
    return true;
}

export function removeClipColor(clipId) {
    if (clipColors[clipId]) {
        delete clipColors[clipId];
        console.log(`[ClipColors] Removed color for clip ${clipId}`);
        return true;
    }
    return false;
}

export function clearAllClipColors() {
    clipColors = {};
    console.log('[ClipColors] Cleared all clip colors');
}

export function getRandomClipColor() {
    return CLIP_COLOR_PALETTE[Math.floor(Math.random() * CLIP_COLOR_PALETTE.length)];
}

export function getAllClipColors() {
    return JSON.parse(JSON.stringify(clipColors));
}

export function applyClipColorToElement(clipId, element) {
    const color = getClipColor(clipId);
    if (color && element) {
        element.style.backgroundColor = color;
        element.style.opacity = '0.8';
        return true;
    }
    return false;
}

console.log('[FeatureAdditions] All additional features loaded (Track Notes, Project Statistics, Quick Actions, Visualization Modes, Collaboration Invite, Performance Mode, Clip Color Coding)');