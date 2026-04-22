// js/ExportDialog.js - Audio Export Dialog with Format Selection
import { encodeWavFromAudioBuffer, encodeMp3FromAudioBuffer, encodeFlacFromAudioBuffer } from './audioEncoder.js';

let exportDialog = null;
let currentExportOptions = {
    format: 'wav',
    mp3Bitrate: 192,
    wavBitDepth: 16,
    flacCompression: 5
};

export function getCurrentExportOptions() {
    return { ...currentExportOptions };
}

export function setExportOption(key, value) {
    currentExportOptions[key] = value;
}

export async function showExportDialog(options = {}) {
    if (exportDialog && exportDialog.dialog && exportDialog.dialog.parentElement) {
        exportDialog.dialog.remove();
    }

    const {
        duration = 60,
        sampleRate = 44100,
        onExportStart = () => {},
        onExportComplete = (blob, filename) => {},
        onExportError = (error) => {}
    } = options;

    currentExportOptions = { ...currentExportOptions, ...options };

    const dialog = document.createElement('div');
    dialog.id = 'exportDialog';
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
        min-width: 320px;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        font-family: 'Inter', sans-serif;
    `;

    dialog.innerHTML = `
        <div style="color: #e0e0e0; font-size: 18px; font-weight: 600; margin-bottom: 20px;">
            Export Audio
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                Format
            </label>
            <select id="exportFormatSelect" style="
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
        
        <div id="mp3Options" style="display: none; margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                MP3 Bitrate
            </label>
            <select id="mp3BitrateSelect" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="128">128 kbps</option>
                <option value="192" selected>192 kbps</option>
                <option value="256">256 kbps</option>
                <option value="320">320 kbps (Highest Quality)</option>
            </select>
        </div>
        
        <div id="wavOptions" style="margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                WAV Bit Depth
            </label>
            <select id="wavBitDepthSelect" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="16" selected>16-bit (CD Quality)</option>
                <option value="24">24-bit (High Quality)</option>
                <option value="32">32-bit Float (Maximum Quality)</option>
            </select>
        </div>
        
        <div id="flacOptions" style="display: none; margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                FLAC Compression Level
            </label>
            <select id="flacCompressionSelect" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="0">0 (Fastest, Largest)</option>
                <option value="2">2</option>
                <option value="5" selected>5 (Balanced)</option>
                <option value="8">8 (Best Compression, Slowest)</option>
            </select>
        </div>
        
        <div style="margin-bottom: 20px; padding: 12px; background: #252525; border-radius: 4px;">
            <div style="color: #888; font-size: 11px; margin-bottom: 4px;">Duration</div>
            <div style="color: #e0e0e0; font-size: 14px;">${formatDuration(duration)}</div>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="exportCancelBtn" style="
                padding: 8px 16px;
                background: #333;
                border: 1px solid #555;
                border-radius: 4px;
                color: #ccc;
                font-size: 13px;
                cursor: pointer;
            ">Cancel</button>
            <button id="exportConfirmBtn" style="
                padding: 8px 20px;
                background: #2563eb;
                border: 1px solid #1d4ed8;
                border-radius: 4px;
                color: #fff;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
            ">Export</button>
        </div>
        
        <div id="exportProgress" style="display: none; margin-top: 16px;">
            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">Exporting...</div>
            <div style="height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
                <div id="exportProgressBar" style="
                    height: 100%;
                    background: #2563eb;
                    width: 0%;
                    transition: width 0.3s;
                "></div>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const formatSelect = dialog.querySelector('#exportFormatSelect');
    const mp3Options = dialog.querySelector('#mp3Options');
    const wavOptions = dialog.querySelector('#wavOptions');
    const flacOptions = dialog.querySelector('#flacOptions');
    const mp3BitrateSelect = dialog.querySelector('#mp3BitrateSelect');
    const wavBitDepthSelect = dialog.querySelector('#wavBitDepthSelect');
    const flacCompressionSelect = dialog.querySelector('#flacCompressionSelect');
    const cancelBtn = dialog.querySelector('#exportCancelBtn');
    const confirmBtn = dialog.querySelector('#exportConfirmBtn');
    const progressDiv = dialog.querySelector('#exportProgress');
    const progressBar = dialog.querySelector('#exportProgressBar');

    function updateOptionsVisibility() {
        const format = formatSelect.value;
        mp3Options.style.display = format === 'mp3' ? 'block' : 'none';
        wavOptions.style.display = format === 'wav' ? 'block' : 'none';
        flacOptions.style.display = format === 'flac' ? 'block' : 'none';
    }

    formatSelect.addEventListener('change', () => {
        updateOptionsVisibility();
    });

    cancelBtn.addEventListener('click', () => {
        dialog.remove();
        exportDialog = null;
    });

    confirmBtn.addEventListener('click', async () => {
        const format = formatSelect.value;
        currentExportOptions.format = format;
        currentExportOptions.mp3Bitrate = parseInt(mp3BitrateSelect.value);
        currentExportOptions.wavBitDepth = parseInt(wavBitDepthSelect.value);
        currentExportOptions.flacCompression = parseInt(flacCompressionSelect.value);

        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        progressDiv.style.display = 'block';

        try {
            onExportStart();
            
            const result = await performExport(currentExportOptions, (progress) => {
                progressBar.style.width = `${progress}%`;
            });

            progressBar.style.width = '100%';
            
            setTimeout(() => {
                dialog.remove();
                exportDialog = null;
                onExportComplete(result.blob, result.filename);
            }, 500);

        } catch (error) {
            console.error('[ExportDialog] Export error:', error);
            progressDiv.style.display = 'none';
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            onExportError(error);
        }
    });

    exportDialog = { dialog, options: currentExportOptions };
    return dialog;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function performExport(options, onProgress) {
    onProgress(10);
    
    const format = options.format || 'wav';
    const audioBuffer = options.audioBuffer;
    
    if (!audioBuffer) {
        throw new Error('No audio buffer to export');
    }

    onProgress(30);

    let blob;
    let filename;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    try {
        if (format === 'wav') {
            const bitDepth = options.wavBitDepth || 16;
            blob = await encodeWavFromAudioBuffer(audioBuffer, bitDepth);
            filename = `snugos-export-${timestamp}.wav`;
        } else if (format === 'mp3') {
            const bitrate = options.mp3Bitrate || 192;
            blob = await encodeMp3FromAudioBuffer(audioBuffer, bitrate, (progress) => {
                onProgress(30 + progress * 0.5);
            });
            filename = `snugos-export-${timestamp}.mp3`;
        } else if (format === 'flac') {
            const compression = options.flacCompression || 5;
            blob = await encodeFlacFromAudioBuffer(audioBuffer, compression, (progress) => {
                onProgress(30 + progress * 0.5);
            });
            filename = `snugos-export-${timestamp}.flac`;
        }
    } catch (error) {
        console.error('[ExportDialog] Encoding error:', error);
        throw error;
    }

    onProgress(90);

    return { blob, filename };
}

export function hideExportDialog() {
    if (exportDialog && exportDialog.dialog) {
        exportDialog.dialog.remove();
        exportDialog = null;
    }
}