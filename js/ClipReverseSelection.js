// js/ClipReverseSelection.js - Reverse selected portion of an audio clip

export class ClipReverseSelection {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.activeReversals = new Map(); // clipId -> { originalBuffer, reversedBuffer }
    }

    /**
     * Reverse an entire audio clip
     * @param {AudioBuffer} audioBuffer - The audio buffer to reverse
     * @returns {AudioBuffer} The reversed audio buffer
     */
    reverseEntireBuffer(audioBuffer) {
        if (!audioBuffer || !this.audioContext) {
            console.error('[ClipReverseSelection] Invalid audio buffer or audio context');
            return null;
        }

        const reversedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const reversedData = reversedBuffer.getChannelData(channel);
            
            // Reverse the samples
            for (let i = 0; i < channelData.length; i++) {
                reversedData[i] = channelData[channelData.length - 1 - i];
            }
        }

        return reversedBuffer;
    }

    /**
     * Reverse a portion of an audio clip
     * @param {AudioBuffer} audioBuffer - The original audio buffer
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {AudioBuffer} The buffer with the selection reversed
     */
    reverseSelection(audioBuffer, startTime, endTime) {
        if (!audioBuffer || !this.audioContext) {
            console.error('[ClipReverseSelection] Invalid audio buffer or audio context');
            return null;
        }

        // Clamp times
        startTime = Math.max(0, startTime);
        endTime = Math.min(audioBuffer.duration, endTime);
        
        if (startTime >= endTime) {
            console.error('[ClipReverseSelection] Invalid selection range');
            return audioBuffer;
        }

        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const selectionLength = endSample - startSample;

        // Create new buffer with same properties
        const newBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            sampleRate
        );

        // Copy and reverse the selection for each channel
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const originalData = audioBuffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            
            // Copy pre-selection
            for (let i = 0; i < startSample; i++) {
                newData[i] = originalData[i];
            }
            
            // Reverse selection
            for (let i = 0; i < selectionLength; i++) {
                newData[startSample + i] = originalData[endSample - 1 - i];
            }
            
            // Copy post-selection
            for (let i = endSample; i < originalData.length; i++) {
                newData[i] = originalData[i];
            }
        }

        console.log(`[ClipReverseSelection] Reversed selection: ${startTime.toFixed(3)}s - ${endTime.toFixed(3)}s`);
        return newBuffer;
    }

    /**
     * Reverse a clip and store the original for undo
     * @param {string} clipId - The clip ID
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @returns {AudioBuffer} The reversed buffer
     */
    reverseClipWithUndo(clipId, audioBuffer) {
        // Store original
        this.activeReversals.set(clipId, {
            originalBuffer: audioBuffer,
            reversedBuffer: null
        });

        const reversedBuffer = this.reverseEntireBuffer(audioBuffer);
        
        // Update stored reversed buffer
        const reversal = this.activeReversals.get(clipId);
        if (reversal) {
            reversal.reversedBuffer = reversedBuffer;
        }

        return reversedBuffer;
    }

    /**
     * Reverse a selection and store the original for undo
     * @param {string} clipId - The clip ID
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {AudioBuffer} The buffer with reversed selection
     */
    reverseSelectionWithUndo(clipId, audioBuffer, startTime, endTime) {
        // Store original
        this.activeReversals.set(clipId, {
            originalBuffer: audioBuffer,
            startTime,
            endTime
        });

        return this.reverseSelection(audioBuffer, startTime, endTime);
    }

    /**
     * Undo a reversal for a clip
     * @param {string} clipId - The clip ID
     * @returns {AudioBuffer|null} The original buffer or null
     */
    undoReversal(clipId) {
        const reversal = this.activeReversals.get(clipId);
        if (reversal) {
            this.activeReversals.delete(clipId);
            console.log(`[ClipReverseSelection] Undo reversal for clip ${clipId}`);
            return reversal.originalBuffer;
        }
        return null;
    }

    /**
     * Check if a clip has a stored reversal
     * @param {string} clipId - The clip ID
     * @returns {boolean} Whether there's a stored reversal
     */
    hasStoredReversal(clipId) {
        return this.activeReversals.has(clipId);
    }

    /**
     * Create a preview of the reversed selection (plays without modifying)
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {AudioBufferSourceNode|null} The source node for preview
     */
    previewReversedSelection(audioBuffer, startTime, endTime) {
        const reversedBuffer = this.reverseSelection(audioBuffer, startTime, endTime);
        if (!reversedBuffer) return null;

        const source = this.audioContext.createBufferSource();
        source.buffer = reversedBuffer;
        source.start(0, startTime, endTime - startTime);
        
        return source;
    }

    /**
     * Apply a crossfade at the selection boundaries to avoid clicks
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @param {number} fadeTime - Crossfade duration in seconds (default 10ms)
     * @returns {AudioBuffer} Buffer with crossfaded reversal
     */
    reverseSelectionWithCrossfade(audioBuffer, startTime, endTime, fadeTime = 0.01) {
        // First do the basic reversal
        let buffer = this.reverseSelection(audioBuffer, startTime, endTime);
        if (!buffer) return null;

        const sampleRate = buffer.sampleRate;
        const fadeSamples = Math.floor(fadeTime * sampleRate);
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);

        // Apply fade in at start of reversed section
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            
            // Fade in at the start of reversed section
            for (let i = 0; i < fadeSamples && startSample + i < data.length; i++) {
                const fadeIn = i / fadeSamples;
                data[startSample + i] *= fadeIn;
            }
            
            // Fade out at the end of reversed section
            for (let i = 0; i < fadeSamples && endSample - i >= 0; i++) {
                const fadeOut = i / fadeSamples;
                data[endSample - 1 - i] *= fadeOut;
            }
        }

        return buffer;
    }

    /**
     * Get multiple reversal presets for creative effects
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @param {string} preset - Preset name
     * @returns {AudioBuffer} The processed buffer
     */
    applyReversePreset(audioBuffer, preset) {
        switch (preset) {
            case 'full':
                return this.reverseEntireBuffer(audioBuffer);
            
            case 'chop':
                // Reverse multiple small sections
                const sections = 8;
                const sectionDuration = audioBuffer.duration / sections;
                let buffer = audioBuffer;
                for (let i = 0; i < sections; i++) {
                    const start = i * sectionDuration;
                    const end = start + sectionDuration;
                    // Reverse every other section
                    if (i % 2 === 1) {
                        buffer = this.reverseSelection(buffer, start, end);
                    }
                }
                return buffer;
            
            case 'mirror':
                // Create mirrored audio (play forward then backward)
                const mirrorBuffer = this.audioContext.createBuffer(
                    audioBuffer.numberOfChannels,
                    audioBuffer.length * 2,
                    audioBuffer.sampleRate
                );
                const reversed = this.reverseEntireBuffer(audioBuffer);
                
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                    const originalData = audioBuffer.getChannelData(channel);
                    const reversedData = reversed.getChannelData(channel);
                    const mirrorData = mirrorBuffer.getChannelData(channel);
                    
                    // Copy original
                    for (let i = 0; i < originalData.length; i++) {
                        mirrorData[i] = originalData[i];
                    }
                    // Copy reversed
                    for (let i = 0; i < reversedData.length; i++) {
                        mirrorData[originalData.length + i] = reversedData[i];
                    }
                }
                return mirrorBuffer;
            
            case 'invert':
                // Reverse the phase (invert samples)
                const invertBuffer = this.audioContext.createBuffer(
                    audioBuffer.numberOfChannels,
                    audioBuffer.length,
                    audioBuffer.sampleRate
                );
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                    const originalData = audioBuffer.getChannelData(channel);
                    const invertData = invertBuffer.getChannelData(channel);
                    for (let i = 0; i < originalData.length; i++) {
                        invertData[i] = -originalData[i];
                    }
                }
                return invertBuffer;
            
            default:
                return audioBuffer;
        }
    }

    /**
     * Dispose of stored reversals
     */
    dispose() {
        this.activeReversals.clear();
        console.log('[ClipReverseSelection] Disposed');
    }
}

/**
 * Open the clip reverse selection panel
 * @param {Object} appServices - App services object
 * @param {Object} clip - The clip to reverse
 */
export function openClipReversePanel(appServices, clip) {
    const { showNotification, getAudioContext } = appServices;
    const audioContext = getAudioContext ? getAudioContext() : null;
    
    if (!audioContext || !clip || !clip.audioBuffer) {
        showNotification?.('No audio clip selected', 2000);
        return;
    }

    // Remove existing panel
    const existingPanel = document.getElementById('clip-reverse-panel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'clip-reverse-panel';
    panel.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 w-96';

    const duration = clip.audioBuffer.duration;
    const clipStart = clip.startTime || 0;
    const clipEnd = clip.endTime || duration;

    panel.innerHTML = `
        <div class="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex justify-between items-center">
            <h2 class="text-lg font-bold text-white">Reverse Clip Selection</h2>
            <button id="close-reverse-panel" class="text-zinc-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
            <div class="text-sm text-zinc-400">
                <strong>Clip:</strong> ${clip.name || 'Untitled'} (${duration.toFixed(2)}s)
            </div>
            
            <div class="space-y-2">
                <label class="block text-sm text-zinc-300">Selection Range</label>
                <div class="flex gap-2">
                    <div class="flex-1">
                        <label class="text-xs text-zinc-500">Start (s)</label>
                        <input type="number" id="reverse-start" value="0" min="0" max="${duration}" step="0.001"
                               class="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded">
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-zinc-500">End (s)</label>
                        <input type="number" id="reverse-end" value="${duration.toFixed(3)}" min="0" max="${duration}" step="0.001"
                               class="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded">
                    </div>
                </div>
            </div>
            
            <div class="flex items-center gap-2">
                <input type="checkbox" id="crossfade-toggle" checked class="w-4 h-4 rounded">
                <label for="crossfade-toggle" class="text-sm text-zinc-300">Apply crossfade (anti-click)</label>
            </div>
            
            <div class="space-y-2">
                <label class="block text-sm text-zinc-300">Presets</label>
                <select id="reverse-preset" class="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded">
                    <option value="selection">Reverse Selection</option>
                    <option value="full">Full Reverse</option>
                    <option value="chop">Chop (alternating sections)</option>
                    <option value="mirror">Mirror (forward + reverse)</option>
                    <option value="invert">Phase Invert</option>
                </select>
            </div>
            
            <div class="flex gap-2 pt-2">
                <button id="preview-reverse" class="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors">
                    👁️ Preview
                </button>
                <button id="apply-reverse" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors">
                    ✓ Apply
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    const reverser = new ClipReverseSelection(audioContext);

    // Event handlers
    panel.querySelector('#close-reverse-panel').addEventListener('click', () => {
        reverser.dispose();
        panel.remove();
    });

    panel.querySelector('#preview-reverse').addEventListener('click', () => {
        const preset = panel.querySelector('#reverse-preset').value;
        const startTime = parseFloat(panel.querySelector('#reverse-start').value);
        const endTime = parseFloat(panel.querySelector('#reverse-end').value);
        const useCrossfade = panel.querySelector('#crossfade-toggle').checked;

        if (preset === 'selection') {
            const previewBuffer = useCrossfade 
                ? reverser.reverseSelectionWithCrossfade(clip.audioBuffer, startTime, endTime)
                : reverser.reverseSelection(clip.audioBuffer, startTime, endTime);
            
            if (previewBuffer) {
                const source = audioContext.createBufferSource();
                source.buffer = previewBuffer;
                source.connect(audioContext.destination);
                source.start();
                showNotification?.('Previewing reversed selection...', 1500);
            }
        } else {
            const previewBuffer = reverser.applyReversePreset(clip.audioBuffer, preset);
            if (previewBuffer) {
                const source = audioContext.createBufferSource();
                source.buffer = previewBuffer;
                source.connect(audioContext.destination);
                source.start();
                showNotification?.(`Previewing ${preset} preset...`, 1500);
            }
        }
    });

    panel.querySelector('#apply-reverse').addEventListener('click', () => {
        const preset = panel.querySelector('#reverse-preset').value;
        const startTime = parseFloat(panel.querySelector('#reverse-start').value);
        const endTime = parseFloat(panel.querySelector('#reverse-end').value);
        const useCrossfade = panel.querySelector('#crossfade-toggle').checked;

        let newBuffer;
        
        if (preset === 'selection') {
            newBuffer = useCrossfade 
                ? reverser.reverseSelectionWithCrossfade(clip.audioBuffer, startTime, endTime)
                : reverser.reverseSelection(clip.audioBuffer, startTime, endTime);
        } else {
            newBuffer = reverser.applyReversePreset(clip.audioBuffer, preset);
        }

        if (newBuffer && clip.setAudioBuffer) {
            clip.setAudioBuffer(newBuffer);
            showNotification?.('Clip reversed successfully!', 1500);
        } else if (newBuffer && clip.audioBuffer) {
            clip.audioBuffer = newBuffer;
            showNotification?.('Clip reversed successfully!', 1500);
        }

        reverser.dispose();
        panel.remove();
    });

    // Close on escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            reverser.dispose();
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

export default ClipReverseSelection;