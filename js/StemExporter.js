// js/StemExporter.js - Export individual tracks (stems) as separate audio files
import { encodeWavFromAudioBuffer, encodeMp3FromAudioBuffer, encodeFlacFromAudioBuffer, downloadBlob } from './audioEncoder.js';

let stemExportDialog = null;

export function showStemExportDialog() {
    if (stemExportDialog && stemExportDialog.dialog && stemExportDialog.dialog.parentElement) {
        stemExportDialog.dialog.remove();
    }

    const appServices = window.appServices;
    if (!appServices) {
        console.error('[StemExporter] appServices not available');
        return;
    }

    const tracks = appServices.getTracks ? appServices.getTracks() : [];
    const audioTracks = tracks.filter(t => t.type === 'Synth' || t.type === 'Sampler' || t.type === 'DrumSampler' || t.type === 'Audio' || t.type === 'InstrumentSampler');

    if (audioTracks.length === 0) {
        appServices.showNotification?.('No tracks available to export', 2000);
        return;
    }

    const dialog = document.createElement('div');
    dialog.id = 'stemExportDialog';
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e1e1e;
        border: 2px solid #444;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 400px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        font-family: 'Inter', sans-serif;
    `;

    const tracksCheckboxes = audioTracks.map((track, idx) => `
        <label class="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer">
            <input type="checkbox" class="stem-track-check w-4 h-4" data-track-id="${track.id}" ${idx === 0 ? 'checked' : ''}>
            <span class="text-sm text-gray-200">${track.name || `Track ${track.id}`}</span>
            <span class="text-xs text-gray-500 ml-auto">${track.type}</span>
        </label>
    `).join('');

    dialog.innerHTML = `
        <div style="color: #e0e0e0; font-size: 18px; font-weight: 600; margin-bottom: 20px;">
            Export Stems
        </div>
        
        <div style="margin-bottom: 16px;">
            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">
                Select tracks to export:
            </div>
            <div style="background: #252525; border-radius: 4px; max-height: 300px; overflow-y: auto;">
                ${tracksCheckboxes}
            </div>
            <button id="selectAllStems" style="margin-top: 8px; font-size: 11px; color: #666; text-decoration: underline; background: none; border: none; cursor: pointer;">
                Select All
            </button>
            <button id="deselectAllStems" style="margin-top: 8px; margin-left: 12px; font-size: 11px; color: #666; text-decoration: underline; background: none; border: none; cursor: pointer;">
                Deselect All
            </button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                Format
            </label>
            <select id="stemFormatSelect" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="wav" selected>WAV (Uncompressed)</option>
                <option value="mp3">MP3 (Compressed)</option>
                <option value="flac">FLAC (Lossless)</option>
            </select>
        </div>
        
        <div id="stemMp3Options" style="display: none; margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                MP3 Bitrate
            </label>
            <select id="stemMp3Bitrate" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
            ">
                <option value="128">128 kbps</option>
                <option value="192" selected>192 kbps</option>
                <option value="256">256 kbps</option>
                <option value="320">320 kbps</option>
            </select>
        </div>
        
        <div id="stemWavOptions" style="margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                WAV Bit Depth
            </label>
            <select id="stemWavBitDepth" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
            ">
                <option value="16" selected>16-bit</option>
                <option value="24">24-bit</option>
                <option value="32">32-bit Float</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="stemMuteOtherTracks" checked style="accent-color: #2563eb; width: 16px; height: 16px;">
                <span style="color: #e0e0e0; font-size: 13px;">Mute other tracks during export</span>
            </label>
            <div style="color: #666; font-size: 11px; margin-top: 4px; margin-left: 24px;">
                When enabled, other tracks are silenced but effects remain active on exported track
            </div>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="stemCancelBtn" style="
                padding: 8px 16px;
                background: #333;
                border: 1px solid #555;
                border-radius: 4px;
                color: #ccc;
                font-size: 13px;
                cursor: pointer;
            ">Cancel</button>
            <button id="stemExportBtn" style="
                padding: 8px 20px;
                background: #2563eb;
                border: 1px solid #1d4ed8;
                border-radius: 4px;
                color: #fff;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
            ">Export Selected</button>
        </div>
        
        <div id="stemExportProgress" style="display: none; margin-top: 16px;">
            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">Exporting stems...</div>
            <div style="height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
                <div id="stemProgressBar" style="
                    height: 100%;
                    background: #2563eb;
                    width: 0%;
                    transition: width 0.3s;
                "></div>
            </div>
            <div id="stemStatusText" style="color: #666; font-size: 11px; margin-top: 4px;"></div>
        </div>
    `;

    document.body.appendChild(dialog);

    const formatSelect = dialog.querySelector('#stemFormatSelect');
    const mp3Options = dialog.querySelector('#stemMp3Options');
    const wavOptions = dialog.querySelector('#stemWavOptions');
    const mp3Bitrate = dialog.querySelector('#stemMp3Bitrate');
    const wavBitDepth = dialog.querySelector('#stemWavBitDepth');
    const cancelBtn = dialog.querySelector('#stemCancelBtn');
    const exportBtn = dialog.querySelector('#stemExportBtn');
    const progressDiv = dialog.querySelector('#stemExportProgress');
    const progressBar = dialog.querySelector('#stemProgressBar');
    const statusText = dialog.querySelector('#stemStatusText');
    const selectAllBtn = dialog.querySelector('#selectAllStems');
    const deselectAllBtn = dialog.querySelector('#deselectAllStems');
    const trackCheckboxes = dialog.querySelectorAll('.stem-track-check');

    function updateOptionsVisibility() {
        const format = formatSelect.value;
        mp3Options.style.display = format === 'mp3' ? 'block' : 'none';
        wavOptions.style.display = format === 'wav' ? 'block' : 'none';
    }

    formatSelect.addEventListener('change', updateOptionsVisibility);
    updateOptionsVisibility();

    selectAllBtn?.addEventListener('click', () => {
        trackCheckboxes.forEach(cb => cb.checked = true);
    });

    deselectAllBtn?.addEventListener('click', () => {
        trackCheckboxes.forEach(cb => cb.checked = false);
    });

    cancelBtn.addEventListener('click', () => {
        dialog.remove();
        stemExportDialog = null;
    });

    exportBtn.addEventListener('click', async () => {
        const selectedTrackIds = Array.from(trackCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.dataset.trackId, 10));

        if (selectedTrackIds.length === 0) {
            appServices.showNotification?.('Please select at least one track', 2000);
            return;
        }

        const format = formatSelect.value;
        const muteOtherTracks = dialog.querySelector('#stemMuteOtherTracks')?.checked ?? true;
        const options = {
            format,
            mp3Bitrate: parseInt(mp3Bitrate.value),
            wavBitDepth: parseInt(wavBitDepth.value),
            muteOtherTracks
        };

        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        progressDiv.style.display = 'block';
        statusText.textContent = 'Preparing...';

        try {
            await exportStems(selectedTrackIds, options, (progress, trackName) => {
                progressBar.style.width = `${progress}%`;
                statusText.textContent = trackName ? `Exporting: ${trackName}` : `Progress: ${Math.round(progress)}%`;
            });

            progressBar.style.width = '100%';
            statusText.textContent = 'Export complete!';

            setTimeout(() => {
                dialog.remove();
                stemExportDialog = null;
            }, 1000);

            appServices.showNotification?.('Stems exported successfully!', 2000);

        } catch (error) {
            console.error('[StemExporter] Export error:', error);
            appServices.showNotification?.(`Export failed: ${error.message}`, 3000);
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
        }
    });

    const confirmBtn = exportBtn;
    stemExportDialog = { dialog };
}

async function exportStems(trackIds, options, onProgress) {
    const appServices = window.appServices;
    if (!appServices) throw new Error('appServices not available');

    const tracks = appServices.getTracks ? appServices.getTracks() : [];
    const totalTracks = trackIds.length;

    for (let i = 0; i < trackIds.length; i++) {
        const trackId = trackIds[i];
        const track = tracks.find(t => t.id === trackId);

        if (!track) {
            console.warn(`[StemExporter] Track ${trackId} not found, skipping`);
            continue;
        }

        const progress = ((i) / totalTracks) * 100;
        onProgress(progress, track.name);

        try {
            const audioBuffer = await renderTrackToBuffer(track, options);
            if (audioBuffer) {
                const blob = await encodeTrackAudio(audioBuffer, options);
                const filename = `${sanitizeFilename(track.name || `Track-${track.id}`)}.${options.format}`;
                downloadBlob(blob, filename);
            }
        } catch (error) {
            console.error(`[StemExporter] Error exporting track ${track.name}:`, error);
        }

        onProgress(((i + 1) / totalTracks) * 100, track.name);
    }
}

async function renderTrackToBuffer(track, options = {}) {
    const muteOtherTracks = options.muteOtherTracks ?? true;
    
    // Get the track's output node
    const trackOutput = track.panNode || track.gainNode;
    if (!trackOutput) {
        console.warn(`[StemExporter] Track ${track.name} has no output node`);
        return null;
    }

    // Get sequence duration if exists
    let duration = 30; // default 30 seconds
    if (track.sequences && track.sequences.length > 0) {
        const seq = track.sequences.find(s => s.id === track.activeSequenceId) || track.sequences[0];
        if (seq && seq.duration) {
            duration = seq.duration;
        }
    }

    // Use Tone.Offline to render the track
    if (typeof Tone !== 'undefined' && Tone.Offline) {
        try {
            const offlineBuffer = await Tone.Offline(async ({ transport }) => {
                // Clone the track's audio chain for offline rendering
                if (track.synth && !track.synth.disposed) {
                    const synth = track.synth.get();
                    if (synth) {
                        const newSynth = new synth.constructor(synth.get());
                        newSynth.connect(trackOutput);
                    }
                }

                // Mute all other tracks if option enabled
                const appServices = window.appServices;
                if (muteOtherTracks && appServices?.getTracks) {
                    const allTracks = appServices.getTracks();
                    allTracks.forEach(t => {
                        if (t.id !== track.id && t.gainNode && !t.gainNode.disposed) {
                            t.gainNode.gain.setValueAtTime(0, Tone.now());
                        }
                    });
                }

                // Start the transport for the duration
                transport.start();
                
                // Wait for the duration
                await new Promise(resolve => setTimeout(resolve, duration * 1000));
                transport.stop();
            }, duration);

            return offlineBuffer;
        } catch (error) {
            console.warn(`[StemExporter] Tone.Offline failed for track ${track.name}:`, error);
            // Fallback: create an empty buffer
            const sampleRate = 44100;
            const ctx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);
            return ctx.createBuffer(2, duration * sampleRate, sampleRate);
        }
    }

    // Fallback: create an empty buffer
    const sampleRate = 44100;
    const ctx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);
    return ctx.createBuffer(2, duration * sampleRate, sampleRate);
}

async function encodeTrackAudio(audioBuffer, options) {
    const { format, mp3Bitrate, wavBitDepth } = options;

    if (format === 'wav') {
        return encodeWavFromAudioBuffer(audioBuffer, wavBitDepth || 16);
    } else if (format === 'mp3') {
        return encodeMp3FromAudioBuffer(audioBuffer, mp3Bitrate || 192);
    } else if (format === 'flac') {
        return encodeFlacFromAudioBuffer(audioBuffer, 5);
    }

    throw new Error(`Unsupported format: ${format}`);
}

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
}

// Expose to appServices
export function initStemExporter(appServicesRef) {
    if (appServicesRef) {
        appServicesRef.showStemExportDialog = showStemExportDialog;
    }
}