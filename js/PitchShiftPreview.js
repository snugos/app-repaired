// js/PitchShiftPreview.js - Preview pitch-shifted audio before applying
import { showNotification } from './utils.js';

export class PitchShiftPreview {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.previewNode = null;
        this.active = false;
    }

    createPreview(playerNode, semitones, playbackRate = 1.0) {
        if (!playerNode) return null;
        this.cleanup();

        const pitchShifter = this.audioContext.createAudioWorklet ?
            this.createWorkletPitchShifter(semitones, playbackRate) :
            this.createSimplePitchShifter(playerNode, semitones);

        this.previewNode = pitchShifter;
        this.active = true;
        return pitchShifter;
    }

    createSimplePitchShifter(playerNode, semitones) {
        // Simple approach using playback rate with preserving duration
        const rate = Math.pow(2, semitones / 12);
        if (playerNode.playbackRate !== undefined) {
            playerNode.playbackRate.value = rate;
        }
        return playerNode;
    }

    createWorkletPitchShifter(semitones, playbackRate) {
        // Placeholder for WebAudio worklet-based pitch shifting
        // Actual implementation would require a worklet processor
        console.log(`[PitchShiftPreview] Creating worklet pitch shift: ${semitones} semitones`);
        return null;
    }

    cleanup() {
        if (this.previewNode) {
            try {
                if (this.previewNode.disconnect) this.previewNode.disconnect();
            } catch (e) {}
            this.previewNode = null;
        }
        this.active = false;
    }
}

export function getPitchShiftPreview(audioContext) {
    return new PitchShiftPreview(audioContext);
}