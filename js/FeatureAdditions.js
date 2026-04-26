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
export { initDrumReplace, openDrumReplacePanel } from './DrumReplace.js';
export { initSpectralSubtractiveEQ, openSpectralSubtractiveEQPanel, spectralEQEngine } from './SpectralSubtractiveEQ.js';
export { initTremoloauto, openTremoloautoPanel, tremoloautoEngine } from './Tremoloauto.js';
export { calculateProjectStatistics, formatProjectStatistics, ProjectStatisticsPanel } from './ProjectStatisticsPanel.js';
// New features from 2026-04-24 queue
export { openProjectTemplateBrowserPanel, closeProjectTemplateBrowserPanel } from './ProjectTemplateBrowser.js';
export { openMIDILearnVisualizationPanel, closeMIDILearnVisualizationPanel } from './MIDILearnVisualization.js';
export { openQuantizeStrengthPanel, closeQuantizeStrengthPanel, getQuantizeStrength, setQuantizeStrength } from './QuantizeStrengthControl.js';
export { openRandomNoteGeneratorPanel, closeRandomNoteGeneratorPanel } from './RandomNoteGenerator.js';
// Mixer Snapshot feature
export { openMixerSnapshotPanel, saveMixerSnapshot, loadMixerSnapshot, deleteMixerSnapshot, getMixerSnapshots, getMixerSnapshotNames } from './MixerSnapshot.js';
// Piano Roll Sequencer - Feature #1
export { initPianoRollSequencer, openTrackSequencerWindow, refreshSequencerUI } from './PianoRollSequencer.js';
// Clip Reverse - Reverse audio/MIDI clips
export { initClipReverse, reverseAudioClip, reverseMIDISequence, openClipReversePanel } from './ClipReverse.js';
// Headphone Mix - Route tracks to a dedicated headphone mix with separate volume
export { initHeadphoneMix, openHeadphoneMixPanel, addTrackToHeadphoneMix, removeTrackFromHeadphoneMix, setHeadphoneMixVolume, getHeadphoneMixVolume, setTrackHeadphoneSendLevel, getTracksInHeadphoneMix } from './HeadphoneMix.js';
// Auto-Beat Sync - Automatically sync tempo to detected BPM from audio input
export { initAutoBeatSync, openAutoBeatSyncPanel, getAutoBeatSyncState, isAutoBeatSyncEnabled, getDetectedBpm } from './AutoBeatSync.js';
// Audio Tap Tempo - Tap-based and audio input beat detection for setting tempo
export { initAudioTapTempo, openAudioTapTempoPanel, recordTap, setTempoFromTap, getTapStatus, resetTapHistory, startAudioBeatDetection, stopAudioBeatDetection, getAudioBeatStatus } from './AudioTapTempo.js';
// Auto-Ducking - Automatic track volume reduction based on sidechain input
export { initAutoDucking, getDuckingConfigs, getDuckingConfigForTrack, setDuckingConfig, removeDuckingConfig, toggleDucking, processDucking, openAutoDuckingPanel } from './AutoDucking.js';
// Lyrics Display - Karaoke-style lyrics synced to playback
export { initLyricsDisplay, openLyricsPanel } from './LyricsDisplay.js';
// Track Stacks - Collapse/expand groups of tracks
export { initTrackStack, openTrackStackPanel, createTrackStack, deleteTrackStack, addTrackToStack, removeTrackFromStack, toggleStackCollapse, updateTrackVisibility, getTrackStacks, setTrackStacksState, getTrackStackId, getTrackStack } from './TrackStack.js';
// Timeline Markers - Markers on timeline for navigation
export { initTimelineMarkers, getTimelineMarkers, addTimelineMarker, removeTimelineMarker, updateTimelineMarker, openTimelineMarkersPanel } from './TimelineMarkers.js';
// Clip Context Menu - Right-click context menu for timeline clips with Reverse option
export { initClipContextMenu, showClipContextMenu, closeClipContextMenu } from './ClipContextMenu.js';
// Transport Timecode Display - Shows current position in BBT format with transport controls
export { openTransportTimecodePanel, renderTransportTimecodeContent, updateTransportTimecodeDisplay } from './TransportTimecodeUI.js';
export { createTransportTimecodeDisplay, secondsToBarsBeatsTicks, startTransportTimecodeLoop, updateTransportTimecodeFromTransport } from './TransportTimecodeCore.js';
// Transport Loop Count - Set number of loop repetitions before stopping
export { initTransportLoopCount, getLoopCount, setLoopCount, getCurrentLoopIteration, setCurrentLoopIteration, isLoopCountFeatureEnabled, setLoopCountFeatureEnabled, incrementLoopIteration, resetLoopIteration, openTransportLoopCountPanel, updateLoopCountDisplay } from './TransportLoopCount.js';
// Clip Gain Envelope Editor - Visual envelope editor for clip-level volume automation with drawable curves
export { initClipGainEnvelopeEditor, openClipGainEnvelopeEditorPanel } from './ClipGainEnvelopeEditor.js';
