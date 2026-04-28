// js/TrackFreeze.js - Track Freeze Feature
// Renders a track (instrument + effects) to a static audio buffer,
// converting it to an audio clip to save CPU

let localAppServices = {};

export function initTrackFreeze(appServices) {
    localAppServices = appServices || {};
    console.log('[TrackFreeze] Initialized');
    wireUpContextMenu();
}

function wireUpContextMenu() {
    // Wait for ClipContextMenu to be ready, then add freeze option
    const checkInterval = setInterval(() => {
        if (window.ClipContextMenu && window.ClipContextMenu.addMenuItem) {
            window.ClipContextMenu.addMenuItem({
                id: 'freezeTrack',
                label: 'Freeze Track',
                icon: '❄️',
                action: 'freezeTrackFromMenu',
                category: 'track'
            });
            clearInterval(checkInterval);
        }
    }, 1000);
}

// --- Freeze Logic ---

/**
 * Freeze a track: render its audio output offline and replace with audio clip
 * @param {number} trackId
 * @param {number} durationBars - How many bars to freeze (default: 4)
 * @returns {Promise<boolean>}
 */
export async function freezeTrack(trackId, durationBars = 4) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.warn('[TrackFreeze] Track not found:', trackId);
        if (localAppServices.showNotification) localAppServices.showNotification('Track not found', 2000);
        return false;
    }

    if (track.type === 'Audio') {
        if (localAppServices.showNotification) localAppServices.showNotification('Audio tracks cannot be frozen', 2000);
        return false;
    }

    console.log(`[TrackFreeze] Freezing track ${trackId} (${track.name}) for ${durationBars} bars...`);
    if (localAppServices.showNotification) localAppServices.showNotification(`Freezing ${track.name}...`, 2000);

    try {
        const bpm = localAppServices.getBPM ? localAppServices.getBPM() : 120;
        const beatsPerBar = localAppServices.getBeatsPerBar ? localAppServices.getBeatsPerBar() : 4;
        const durationSeconds = (60 / bpm) * beatsPerBar * durationBars;

        // Gather all sequences to play
        const sequences = track.sequences || [];
        const activeSeqId = track.activeSequenceId;
        const activeSeq = sequences.find(s => s.id === activeSeqId) || sequences[0];

        if (!activeSeq) {
            console.warn('[TrackFreeze] No sequences to freeze');
            if (localAppServices.showNotification) localAppServices.showNotification('No sequences to freeze', 2000);
            return false;
        }

        // Use Tone.Offline to render
        const renderedBuffer = await Tone.Offline(async ({ transport }) => {
            // Recreate track instrument in offline context
            let offlineInstrument = null;

            if (track.type === 'Synth') {
                const synthType = track.synthEngineType || 'MonoSynth';
                if (synthType === 'MonoSynth') {
                    offlineInstrument = new Tone.MonoSynth().toDestination();
                } else if (synthType === 'PolySynth') {
                    offlineInstrument = new Tone.PolySynth(Tone.Synth).toDestination();
                } else if (synthType === 'FMSynth') {
                    offlineInstrument = new Tone.FMSynth().toDestination();
                } else if (synthType === 'AMSynth') {
                    offlineInstrument = new Tone.AMSynth().toDestination();
                } else {
                    offlineInstrument = new Tone.Synth().toDestination();
                }
                
                // Apply synth params
                if (track.synthParams && offlineInstrument.set) {
                    try {
                        offlineInstrument.set(track.synthParams);
                    } catch (e) {
                        console.warn('[TrackFreeze] Could not set synth params:', e);
                    }
                }
            } else if (track.type === 'Sampler' || track.type === 'Slicer') {
                // For samplers, we can't easily load samples in Offline context
                // Skip frozen audio for samplers
                console.warn('[TrackFreeze] Sampler tracks cannot be reliably frozen offline');
            }

            if (!offlineInstrument) {
                throw new Error('Unsupported track type for freezing');
            }

            // Apply effects chain
            let lastNode = offlineInstrument;
            if (track.activeEffects && track.activeEffects.length > 0) {
                for (const effectWrapper of track.activeEffects) {
                    if (effectWrapper && effectWrapper.toneNode && !effectWrapper.toneNode.disposed) {
                        const toneNode = createEffectInstance(effectWrapper.type, effectWrapper.params);
                        if (toneNode) {
                            lastNode.connect(toneNode);
                            toneNode.toDestination();
                            lastNode = toneNode;
                        }
                    }
                }
            }

            // Schedule all notes from sequence
            const stepSize = 60 / bpm / (track.stepsPerBeat || 4);
            
            if (activeSeq.data && Array.isArray(activeSeq.data)) {
                for (let row = 0; row < activeSeq.data.length; row++) {
                    const rowData = activeSeq.data[row];
                    if (!rowData) continue;
                    
                    for (let col = 0; col < rowData.length; col++) {
                        const step = rowData[col];
                        if (step && step.active) {
                            const time = col * stepSize;
                            const note = row; // Row represents pitch
                            const velocity = step.velocity || 0.8;
                            const duration = (step.duration || 1) * stepSize;
                            
                            if (offlineInstrument.triggerAttackRelease) {
                                offlineInstrument.triggerAttackRelease(
                                    Tone.Frequency(note, 'midi').toFrequency(),
                                    duration,
                                    time,
                                    velocity
                                );
                            }
                        }
                    }
                }
            }

            // Loop the sequence to fill durationBars
            const sequenceDuration = activeSeq.data?.[0]?.length * stepSize || 0;
            if (sequenceDuration > 0) {
                const loopsNeeded = Math.ceil(durationSeconds / sequenceDuration);
                for (let loop = 1; loop < loopsNeeded; loop++) {
                    for (let row = 0; row < (activeSeq.data?.length || 0); row++) {
                        const rowData = activeSeq.data[row];
                        if (!rowData) continue;
                        
                        for (let col = 0; col < rowData.length; col++) {
                            const step = rowData[col];
                            if (step && step.active) {
                                const time = loop * sequenceDuration + col * stepSize;
                                const note = row;
                                const velocity = step.velocity || 0.8;
                                const duration = (step.duration || 1) * stepSize;
                                
                                if (offlineInstrument.triggerAttackRelease) {
                                    offlineInstrument.triggerAttackRelease(
                                        Tone.Frequency(note, 'midi').toFrequency(),
                                        duration,
                                        time,
                                        velocity
                                    );
                                }
                            }
                        }
                    }
                }
            }

            transport.start(0);
        }, durationSeconds);

        console.log('[TrackFreeze] Rendered buffer duration:', renderedBuffer.duration);

        // Convert AudioBuffer to WAV blob
        const wavBlob = await audioBufferToWav(renderedBuffer);

        // Add as audio clip to the track
        if (typeof track.addAudioClip === 'function') {
            await track.addAudioClip(wavBlob, 0, { normalize: true, targetDb: -1 });
            console.log(`[TrackFreeze] Frozen audio added to track ${trackId}`);
            if (localAppServices.showNotification) localAppServices.showNotification(`Track frozen successfully`, 2000);
            
            // Disable instrument to save CPU (track now plays frozen audio)
            track.isFrozen = true;
            track.frozenBuffer = renderedBuffer;
            
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'freezeComplete');
            return true;
        } else {
            throw new Error('Track does not support addAudioClip');
        }

    } catch (error) {
        console.error('[TrackFreeze] Error freezing track:', error);
        if (localAppServices.showNotification) localAppServices.showNotification(`Freeze failed: ${error.message}`, 3000);
        return false;
    }
}

/**
 * Unfreeze a track: restore its instrument/effects
 * @param {number} trackId
 */
export function unfreezeTrack(trackId) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return false;

    if (track.isFrozen) {
        track.isFrozen = false;
        track.frozenBuffer = null;
        console.log(`[TrackFreeze] Unfroze track ${trackId}`);
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'unfreezeComplete');
        if (localAppServices.showNotification) localAppServices.showNotification(`Track unfrozen`, 1500);
        return true;
    }
    return false;
}

// --- AudioBuffer to WAV conversion ---

async function audioBufferToWav(buffer) {
    return new Promise((resolve, reject) => {
        try {
            const numChannels = buffer.numberOfChannels;
            const sampleRate = buffer.sampleRate;
            const length = buffer.length;
            
            // Interleave channels
            const interleaved = new Float32Array(length * numChannels);
            for (let ch = 0; ch < numChannels; ch++) {
                const channelData = buffer.getChannelData(ch);
                for (let i = 0; i < length; i++) {
                    interleaved[i * numChannels + ch] = channelData[i];
                }
            }

            // Convert to 16-bit PCM
            const pcmData = new Int16Array(interleaved.length);
            for (let i = 0; i < interleaved.length; i++) {
                const s = Math.max(-1, Math.min(1, interleaved[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Build WAV header
            const wavBuffer = new ArrayBuffer(44 + pcmData.byteLength);
            const view = new DataView(wavBuffer);

            // RIFF header
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + pcmData.byteLength, true);
            writeString(view, 8, 'WAVE');
            
            // fmt chunk
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true); // chunk size
            view.setUint16(20, 1, true); // PCM format
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
            view.setUint16(32, numChannels * 2, true); // block align
            view.setUint16(34, 16, true); // bits per sample
            
            // data chunk
            writeString(view, 36, 'data');
            view.setUint32(40, pcmData.byteLength, true);
            
            // Write PCM data
            const dataView = new Int16Array(wavBuffer, 44);
            dataView.set(pcmData);

            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            resolve(blob);
        } catch (e) {
            reject(e);
        }
    });
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// --- Import createEffectInstance ---
import { createEffectInstance } from './effectsRegistry.js';

// --- UI Panel ---

/**
 * Open the Track Freeze panel
 */
export function openTrackFreezePanel() {
    const windowId = 'trackFreezePanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        renderFreezeContent();
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackFreezeContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const win = localAppServices.createWindow(windowId, 'Track Freeze', contentContainer, {
        width: 400,
        height: 350,
        minWidth: 300,
        minHeight: 280,
        closable: true,
        minimizable: true,
        resizable: true
    });

    if (win?.element) {
        renderFreezeContent();
    }
    return win;
}

/**
 * Render freeze panel content
 */
function renderFreezeContent() {
    const container = document.getElementById('trackFreezeContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const freezableTracks = tracks.filter(t => t.type !== 'Audio');

    container.innerHTML = `
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <p class="text-sm text-gray-300 mb-2">
                <strong>Track Freeze</strong> renders a track's instrument and effects to audio, 
                saving CPU. The frozen audio clip replaces the live instrument.
            </p>
            <div class="flex items-center gap-2 mb-2">
                <label class="text-xs text-gray-400">Bars to freeze:</label>
                <input type="number" id="freezeBars" value="4" min="1" max="32" 
                    class="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
            </div>
        </div>
        
        <div class="flex-1 overflow-y-auto" id="freezeTrackList">
            <div class="text-xs text-gray-500 mb-2">Select a track to freeze:</div>
            <div id="freezeTrackContainer" class="space-y-1">
                ${freezableTracks.length === 0 ? '<div class="text-gray-500 text-sm">No freezable tracks (synth/sampler tracks)</div>' : ''}
            </div>
        </div>
    `;

    const trackContainer = container.querySelector('#freezeTrackContainer');
    if (trackContainer && freezableTracks.length > 0) {
        trackContainer.innerHTML = freezableTracks.map(track => `
            <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700 hover:border-blue-500">
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded" style="background-color: ${track.color || '#666'}"></div>
                    <div>
                        <div class="text-sm text-white">${escapeHtml(track.name)}</div>
                        <div class="text-xs text-gray-500">${track.type}${track.isFrozen ? ' (FROZEN)' : ''}</div>
                    </div>
                </div>
                <button class="freeze-btn px-3 py-1 text-xs ${track.isFrozen ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded" 
                    data-track-id="${track.id}" ${track.isFrozen ? 'data-unfreeze="true"' : ''}>
                    ${track.isFrozen ? 'Unfreeze' : 'Freeze'}
                </button>
            </div>
        `).join('');

        // Add click handlers
        trackContainer.querySelectorAll('.freeze-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const trackId = parseInt(e.target.dataset.trackId, 10);
                const bars = parseInt(container.querySelector('#freezeBars')?.value || '4', 10);
                
                if (e.target.dataset.unfreeze === 'true') {
                    unfreezeTrack(trackId);
                } else {
                    await freezeTrack(trackId, bars);
                }
                renderFreezeContent();
            });
        });
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}