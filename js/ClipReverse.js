// js/ClipReverse.js - Reverse Audio/MIDI Clips
// Feature: Reverse audio or MIDI clips with one click

let localAppServices = {};

/**
 * Initialize the Clip Reverse module
 * @param {object} services - App services 
 */
export function initClipReverse(services) {
    localAppServices = services;
    console.log('[ClipReverse] Initialized');
}

/**
 * Reverse an audio clip
 * @param {number} trackId - Track ID
 * @param {string} clipId - Clip ID to reverse
 * @returns {boolean} Success
 */
export function reverseAudioClip(trackId, clipId) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.error('[ClipReverse] Track not found:', trackId);
        return false;
    }

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        console.error('[ClipReverse] Clip not found:', clipId);
        return false;
    }

    // Check if audio buffer exists
    if (!clip.audioBuffer && !clip.buffer) {
        console.error('[ClipReverse] No audio buffer in clip');
        return false;
    }

    const buffer = clip.audioBuffer || clip.buffer;
    
    // Create reversed buffer
    const reversedBuffer = createReversedBuffer(buffer);
    
    // Replace the clip's buffer with reversed version
    clip.audioBuffer = reversedBuffer;
    clip.reversed = !clip.reversed;
    
    console.log(`[ClipReverse] Audio clip reversed: ${clipId}, now reversed=${clip.reversed}`);
    
    // Update UI
    localAppServices.updateTrackUI?.(trackId, 'clipReversed');
    
    return true;
}

/**
 * Create a reversed version of an AudioBuffer
 * @param {AudioBuffer} buffer - Original audio buffer
 * @returns {AudioBuffer} Reversed audio buffer
 */
function createReversedBuffer(buffer) {
    const ctx = localAppServices.getAudioContext?.();
    if (!ctx) {
        console.error('[ClipReverse] No audio context available');
        return buffer;
    }

    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;

    // Create new buffer
    const reversedBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);

    // Copy channels in reverse
    for (let channel = 0; channel < numberOfChannels; channel++) {
        const originalData = buffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        
        // Reverse the samples
        for (let i = 0; i < length; i++) {
            reversedData[i] = originalData[length - 1 - i];
        }
    }

    return reversedBuffer;
}

/**
 * Reverse a MIDI sequence
 * @param {number} trackId - Track ID
 * @param {string} sequenceId - Sequence ID to reverse
 * @returns {boolean} Success
 */
export function reverseMIDISequence(trackId, sequenceId) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.error('[ClipReverse] Track not found:', trackId);
        return false;
    }

    const sequence = track.sequences?.find(s => s.id === sequenceId);
    if (!sequence || !sequence.data) {
        console.error('[ClipReverse] Sequence not found:', sequenceId);
        return false;
    }

    // Get sequence length
    const seqLength = sequence.length || sequence.data[0]?.length || 0;
    
    // Reverse each row's data
    for (let row = 0; row < sequence.data.length; row++) {
        if (!sequence.data[row]) continue;
        
        // Get active steps
        const activeSteps = [];
        for (let step = 0; step < seqLength; step++) {
            if (sequence.data[row][step]?.active) {
                const stepData = sequence.data[row][step];
                activeSteps.push({
                    originalStep: step,
                    stepData: { ...stepData }
                });
            }
        }
        
        // Clear all steps
        for (let step = 0; step < seqLength; step++) {
            if (sequence.data[row][step]?.active) {
                sequence.data[row][step] = null;
            }
        }
        
        // Place active steps in reversed positions
        for (const active of activeSteps) {
            const newStep = seqLength - 1 - active.originalStep;
            sequence.data[row][newStep] = active.stepData;
        }
    }
    
    sequence.reversed = !sequence.reversed;
    
    console.log(`[ClipReverse] MIDI sequence reversed: ${sequenceId}, now reversed=${sequence.reversed}`);
    
    // Update UI
    localAppServices.updateTrackUI?.(trackId, 'sequenceReversed');
    
    return true;
}

/**
 * Check if a clip is reversed
 * @param {number} trackId - Track ID
 * @param {string} clipId - Clip ID
 * @returns {boolean} Is reversed
 */
export function isClipReversed(trackId, clipId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return false;
    
    const clip = track.timelineClips?.find(c => c.id === clipId);
    return clip?.reversed || false;
}

/**
 * Check if a sequence is reversed
 * @param {number} trackId - Track ID  
 * @param {string} sequenceId - Sequence ID
 * @returns {boolean} Is reversed
 */
export function isSequenceReversed(trackId, sequenceId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return false;
    
    const sequence = track.sequences?.find(s => s.id === sequenceId);
    return sequence?.reversed || false;
}

/**
 * Open the clip reverse panel for a track
 * @param {number} trackId - Track ID
 */
export function openClipReversePanel(trackId) {
    const windowId = `clipReverse-${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        localAppServices.showNotification?.('Track not found', 2000);
        return;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = `clipReverseContent-${trackId}`;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';

    const options = {
        width: 450,
        height: 400,
        minWidth: 350,
        minHeight: 300,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, `Clip Reverse - ${track.name}`, contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderClipReverseContent(trackId), 50);
    }
    
    return win;
}

/**
 * Render the clip reverse panel content
 * @param {number} trackId - Track ID
 */
function renderClipReverseContent(trackId) {
    const container = document.getElementById(`clipReverseContent-${trackId}`);
    if (!container) return;

    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;

    let html = `
        <div class="mb-4 text-sm text-gray-400">
            Reverse audio clips or MIDI sequences to play backwards.
        </div>
    `;

    // Audio clips section
    if (track.timelineClips && track.timelineClips.length > 0) {
        html += `
            <div class="mb-4">
                <h3 class="text-sm font-semibold text-gray-300 mb-2">Audio Clips</h3>
                <div class="space-y-2">
        `;

        for (const clip of track.timelineClips) {
            const isReversed = clip.reversed ? 'Yes' : 'No';
            html += `
                <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-white">${clip.name || clip.id}</span>
                        <span class="text-xs text-gray-500">${isReversed}</span>
                    </div>
                    <button class="reverse-clip-btn px-3 py-1 text-xs ${clip.reversed ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded" data-clip-id="${clip.id}">
                        ${clip.reversed ? 'Unreverse' : 'Reverse'}
                    </button>
                </div>
            `;
        }

        html += `</div></div>`;
    }

    // MIDI sequences section (for non-audio tracks)
    if (track.type !== 'Audio' && track.sequences && track.sequences.length > 0) {
        html += `
            <div>
                <h3 class="text-sm font-semibold text-gray-300 mb-2">MIDI Sequences</h3>
                <div class="space-y-2">
        `;

        for (const seq of track.sequences) {
            const isReversed = seq.reversed ? 'Yes' : 'No';
            html += `
                <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-white">${seq.name}</span>
                        <span class="text-xs text-gray-500">${isReversed}</span>
                    </div>
                    <button class="reverse-seq-btn px-3 py-1 text-xs ${seq.reversed ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded" data-seq-id="${seq.id}">
                        ${seq.reversed ? 'Unreverse' : 'Reverse'}
                    </button>
                </div>
            `;
        }

        html += `</div></div>`;
    }

    if ((!track.timelineClips || track.timelineClips.length === 0) && (!track.sequences || track.sequences.length === 0)) {
        html += `
            <div class="text-center py-8 text-gray-500">
                <p>No clips or sequences in this track.</p>
                <p class="text-xs mt-2">Record or import audio, or create a sequence first.</p>
            </div>
        `;
    }

    container.innerHTML = html;

    // Setup event handlers
    container.querySelectorAll('.reverse-clip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const clipId = btn.dataset.clipId;
            const result = reverseAudioClip(trackId, clipId);
            if (result) {
                localAppServices.showNotification?.('Clip reversed', 1500);
                renderClipReverseContent(trackId);
            }
        });
    });

    container.querySelectorAll('.reverse-seq-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const seqId = btn.dataset.seqId;
            const result = reverseMIDISequence(trackId, seqId);
            if (result) {
                localAppServices.showNotification?.('Sequence reversed', 1500);
                renderClipReverseContent(trackId);
            }
        });
    });
}

console.log('[ClipReverse] Module loaded');