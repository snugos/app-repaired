// js/FeatureAdditions.js - Additional feature implementations for SnugOS DAW

// Import new feature modules
export { VisualizationModes, VISUALIZATION_MODES, COLOR_SCHEMES, openVisualizationModesPanel } from './VisualizationModes.js';
export { PerformanceMode, Scene, SCENE_TYPES, TRIGGER_MODES, initPerformanceMode, openPerformanceModePanel } from './PerformanceMode.js';
export { SmartQuantize, QUANTIZE_MODES, GROOVE_TEMPLATES, quantizeNotes, analyzeNotes, openSmartQuantizePanel } from './SmartQuantize.js';
export { AudioSpectrumComparison, createAudioSpectrumComparison, createAudioSpectrumComparisonPanel } from './AudioSpectrumComparison.js';
export { RealtimeMIDIMonitor, createRealtimeMIDIMonitor, createMIDIMonitorPanel } from './RealtimeMIDIMonitor.js';
export { initializeTrackGroups, getTrackGroups, getTrackGroupById, getTrackGroupForTrack, createTrackGroup, removeTrackGroup, renameTrackGroup, addTrackToGroup, removeTrackFromGroup, setGroupVolume, setGroupMute, setGroupSolo, setGroupPan, toggleGroupCollapse, duplicateGroup, moveGroup, selectGroupTracks, ungroup, handleTrackDeletedFromGroups, clearAllTrackGroups, getTrackGroupsForSave, restoreTrackGroups, createTrackGroupsPanel } from './TrackGrouping.js';
export { DrumPatternGenerator, DRUM_STYLES, COMPLEXITY_LEVELS, generateDrumPattern } from './DrumPatternGenerator.js';
export { MelodyGenerator, MELODY_STYLES, MELODY_MOODS, COMPLEXITY, generateMelodyQuick } from './MelodyGenerator.js';