// js/main.js - Main Application Logic Orchestrator

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
import { AICompositionAssistant, openAICompositionPanel } from './AICompositionAssistant.js';
import { openQuickStackPanel, saveCurrentLayout, getAllLayouts, restoreLayout, deleteLayout } from './QuickStackLayouts.js';
import { openAudioMorphingPanel } from './ui.js';
import { openPluginChainPresetsPanel } from './ui.js';
import { initPhaseMeter, reconnectPhaseMeter, getPhaseCorrelation, isPhaseMeterInitialized, disposePhaseMeter } from './AudioPhaseMeter.js';
import { openModularRoutingPanel, getRoutingSystem, NODE_TYPES, ROUTING_PRESETS } from './ModularRouting.js';