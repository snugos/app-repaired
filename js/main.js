// js/main.js - Main Application Logic Orchestrator

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
import { AICompositionAssistant, openAICompositionPanel } from './AICompositionAssistant.js';
import { AmbienceMaker, openAmbienceMakerPanel } from './AmbienceMaker.js';
import { openRhythmCoachPanel, initRhythmCoach } from './RhythmCoach.js';
import { initTrackStack, openTrackStackPanel, getTrackStacks, setTrackStacksState } from './TrackStack.js';
import { openAutoSpillPanel, initAutoSpill } from './AutoSpill.js';
import { openSpliceDetectorPanel, initSpliceDetector } from './SpliceDetector.js';
import { PhaseScope, openPhaseScopePanel } from './PhaseScope.js';
import { frequencyMasking as freqMaskingInstance, openFrequencyMaskingPanel } from './FrequencyMasking.js';
import { getTrackGradientSettings, setTrackGradientSettings, getGradientPresets, getTrackGradientPreset, setTrackGradientPreset, clearTrackGradient, applyGradientToTrackElement, exportGradientData, importGradientData } from './TrackColorGradient.js';
import { openNoiseGatePanel } from './TrackNoiseGate.js';
import { SidechainEQ, openSidechainEQPanel } from './SidechainEQ.js';
import { AudioSpectrumFreeze, openSpectrumFreezePanel } from './AudioSpectrumFreeze.js';
import { BatchExport, openBatchExportPanel } from './BatchExport.js';
import { SampleRateConverter, openSampleRateConverterPanel } from './SampleRateConverter.js';
import { TrackDelayCompensation, openTrackDelayPanel } from './TrackDelayCompensation.js';
import { MultiOutputInstrument, openMultiOutputPanel } from './MultiOutputInstrument.js';
import { ClipReverseSelection, openClipReversePanel } from './ClipReverseSelection.js';
import { MIDITransposeTrack, openMIDITransposePanel } from './MIDITransposeTrack.js';
import { initMixdownGhost, openMixdownGhostPanel } from './MixdownGhost.js';
import { scaleSuggestion, openScaleSuggestionPanel, initScaleSuggestion } from './ScaleSuggestion.js';
import { AudioNormalizationBatch, openAudioNormalizationBatchPanel } from './AudioNormalizationBatch.js';
import { MIDIVelocityCurve, openMIDIVelocityCurvePanel } from './MIDIVelocityCurve.js';
import { ClipTransposeBatch, openClipTransposeBatchPanel } from './ClipTransposeBatch.js';
import { TrackExportSolo, openTrackExportSoloPanel } from './TrackExportSolo.js';
import { PatternRandomizer, openPatternRandomizerPanel } from './PatternRandomizer.js';
import { AudioFadePreset, openAudioFadePresetPanel } from './AudioFadePreset.js';
import { MIDIDelayEffect, openMIDIDelayEffectPanel } from './MIDIDelayEffect.js';
import { TrackPanAutomation, openTrackPanAutomationPanel } from './TrackPanAutomation.js';
import { ClipGainGroup, openClipGainGroupPanel } from './ClipGainGroup.js';
import { SmartBPMDetection, smartBPMDetection, openBPMDetectionPanel } from './SmartBPMDetection.js';
import { ClipAutoLevel, clipAutoLevel, openAutoLevelPanel } from './ClipAutoLevel.js';
import { PatternMorphing, patternMorphing, openMorphingPanel } from './PatternMorphing.js';
import { AudioStretchingPresets, audioStretchingPresets, openStretchingPresetsPanel } from './AudioStretchingPresets.js';
import { MIDINoteHumanize, midiNoteHumanize, openHumanizePanel } from './MIDINoteHumanize.js';
import { TrackSidechainRoutingUI, trackSidechainRoutingUI, openSidechainRoutingPanel } from './TrackSidechainRoutingUI.js';
import { ClipPitchDetection, clipPitchDetection, openPitchDetectionPanel } from './ClipPitchDetection.js';
import { MIDIHarmonizer, midiHarmonizer, openHarmonizerPanel } from './MIDIHarmonizer.js';
import { AudioPhaseMeter, audioPhaseMeter, openPhaseMeterPanel } from './AudioPhaseMeter.js';
import { ClipReverseRange, clipReverseRange, openReverseRangePanel } from './ClipReverseRange.js';

// ... existing code ...