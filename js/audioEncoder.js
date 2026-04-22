// js/audioEncoder.js - Audio encoding utilities for WAV, MP3, and FLAC
// Implements audio export with format selection dialog

/**
 * Encodes AudioBuffer to WAV format
 * @param {AudioBuffer} audioBuffer - The audio to encode
 * @param {number} bitDepth - Bit depth (16, 24, or 32)
 * @returns {Promise<Blob>} WAV blob
 */
export async function encodeWavFromAudioBuffer(audioBuffer, bitDepth = 16) {
    return new Promise((resolve, reject) => {
        try {
            const numChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const length = audioBuffer.length;
            
            // Calculate bytes per sample based on bit depth
            const bytesPerSample = bitDepth / 8;
            const blockAlign = numChannels * bytesPerSample;
            const byteRate = sampleRate * blockAlign;
            const dataSize = length * blockAlign;
            
            // WAV header is 44 bytes
            const buffer = new ArrayBuffer(44 + dataSize);
            const view = new DataView(buffer);
            
            // RIFF header
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(view, 8, 'WAVE');
            
            // fmt chunk
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true); // chunk size
            view.setUint16(20, 1, true); // audio format (PCM)
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, byteRate, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, bitDepth, true);
            
            // data chunk
            writeString(view, 36, 'data');
            view.setUint32(40, dataSize, true);
            
            // Interleave audio data
            const channelData = [];
            for (let ch = 0; ch < numChannels; ch++) {
                channelData.push(audioBuffer.getChannelData(ch));
            }
            
            let offset = 44;
            for (let i = 0; i < length; i++) {
                for (let ch = 0; ch < numChannels; ch++) {
                    const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
                    
                    if (bitDepth === 16) {
                        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                        view.setInt16(offset, intSample, true);
                        offset += 2;
                    } else if (bitDepth === 24) {
                        const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
                        const val = Math.round(intSample);
                        view.setUint8(offset, val & 0xFF);
                        view.setUint8(offset + 1, (val >> 8) & 0xFF);
                        view.setUint8(offset + 2, (val >> 16) & 0xFF);
                        offset += 3;
                    } else if (bitDepth === 32) {
                        view.setFloat32(offset, sample, true);
                        offset += 4;
                    }
                }
            }
            
            resolve(new Blob([buffer], { type: 'audio/wav' }));
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Encodes AudioBuffer to MP3 format using lamejs
 * @param {AudioBuffer} audioBuffer - The audio to encode
 * @param {number} bitrate - Bitrate in kbps
 * @param {function} onProgress - Progress callback
 * @returns {Promise<Blob>} MP3 blob
 */
export async function encodeMp3FromAudioBuffer(audioBuffer, bitrate = 192, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            // Check if lamejs is available
            if (typeof lamejs === 'undefined') {
                reject(new Error('lamejs library not loaded'));
                return;
            }

            const numChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const leftChannel = audioBuffer.getChannelData(0);
            const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

            const mp3codec = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
            const mp3Data = [];

            // Process in chunks for better performance
            const sampleBlockSize = 1152;
            
            if (onProgress) onProgress(0);
            
            for (let i = 0; i < leftChannel.length; i += sampleBlockSize) {
                const leftChunk = new Int16Array(sampleBlockSize);
                const rightChunk = new Int16Array(sampleBlockSize);
                
                const blockSize = Math.min(sampleBlockSize, leftChannel.length - i);
                
                for (let j = 0; j < blockSize; j++) {
                    // Convert float to 16-bit PCM
                    const leftSample = leftChannel[i + j];
                    const rightSample = rightChannel[i + j];
                    
                    leftChunk[j] = leftSample < 0 
                        ? leftSample * 0x8000 
                        : leftSample * 0x7FFF;
                    rightChunk[j] = rightSample < 0 
                        ? rightSample * 0x8000 
                        : rightSample * 0x7FFF;
                }
                
                const mp3buf = mp3codec.encodeBuffer(leftChunk, rightChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Uint8Array(mp3buf));
                }
                
                if (onProgress) {
                    const progress = (i / leftChannel.length) * 100;
                    onProgress(progress);
                }
            }
            
            // Flush remaining data
            const mp3buf = mp3codec.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(new Uint8Array(mp3buf));
            }
            
            if (onProgress) onProgress(100);
            
            const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
            resolve(blob);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Encodes AudioBuffer to FLAC format
 * Note: Browser-native FLAC encoding is limited. This provides a basic implementation.
 * For full FLAC support, consider using a WebAssembly-based encoder.
 * @param {AudioBuffer} audioBuffer - The audio to encode
 * @param {number} compressionLevel - Compression level (0-8)
 * @param {function} onProgress - Progress callback
 * @returns {Promise<Blob>} FLAC blob
 */
export async function encodeFlacFromAudioBuffer(audioBuffer, compressionLevel = 5, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            const numChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const bitsPerSample = 16;
            const length = audioBuffer.length;
            
            // Get channel data
            const channelData = [];
            for (let ch = 0; ch < numChannels; ch++) {
                channelData.push(audioBuffer.getChannelData(ch));
            }
            
            // FLAC basic implementation
            // FLAC has a complex encoding scheme, this is a simplified version
            // For production, use flac.js or similar WebAssembly encoder
            
            if (onProgress) onProgress(10);
            
            // Convert float samples to 16-bit integer
            const blockSize = 4096;
            const totalBlocks = Math.ceil(length / blockSize);
            const flacData = [];
            
            // FLAC frame header and data
            for (let block = 0; block < totalBlocks; block++) {
                const start = block * blockSize;
                const end = Math.min(start + blockSize, length);
                const blockLength = end - start;
                
                // Create block data (interleaved for stereo)
                const samples = new Int16Array(blockLength * numChannels);
                let idx = 0;
                
                for (let i = start; i < end; i++) {
                    for (let ch = 0; ch < numChannels; ch++) {
                        const sample = channelData[ch][i];
                        samples[idx++] = sample < 0 
                            ? sample * 0x8000 
                            : sample * 0x7FFF;
                    }
                }
                
                // Create a simple uncompressed FLAC frame
                const frameData = createFlacFrame(samples, blockLength, numChannels, sampleRate, bitsPerSample);
                flacData.push(frameData);
                
                if (onProgress) {
                    const progress = 10 + (block / totalBlocks) * 80;
                    onProgress(progress);
                }
            }
            
            // Build complete FLAC file
            const flacBlob = createFlacFile(flacData, {
                numChannels,
                sampleRate,
                bitsPerSample,
                totalSamples: length
            }, compressionLevel);
            
            if (onProgress) onProgress(100);
            
            resolve(flacBlob);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Creates a FLAC frame (simplified implementation)
 */
function createFlacFrame(samples, blockSize, numChannels, sampleRate, bitsPerSample) {
    // This is a very simplified FLAC frame creator
    // Real FLAC uses complex encoding (LPC, Rice coding)
    // For now, we create an uncompressed frame for compatibility
    
    const frameSize = 4 + 4 + 4 + 1 + 4 + (blockSize * numChannels * 2);
    const buffer = new ArrayBuffer(frameSize);
    const view = new DataView(buffer);
    let offset = 0;
    
    // Frame sync code
    view.setUint16(offset, 0xFFF0, false);
    offset += 2;
    
    // Block type (0 = fixed, 0x6000 = not escape coded)
    view.setUint8(offset, 0x80 | (blockSize >= 4096 ? 0xE : blockSize >= 256 ? 0xA : 0x6));
    offset += 1;
    
    // Sample rate (4 bits)
    const sampleRateCode = getFlacSampleRateCode(sampleRate);
    view.setUint8(offset, (sampleRateCode << 4) | ((bitsPerSample - 1) << 1) | (numChannels === 2 ? 1 : 0), false);
    offset += 1;
    
    // Frame number (simplified - use block number)
    view.setUint32(offset, 0, false);
    offset += 4;
    
    // Copy sample data
    const int16View = new Int16Array(buffer);
    for (let i = 0; i < samples.length; i++) {
        int16View[i + offset / 2] = samples[i];
    }
    
    return new Uint8Array(buffer);
}

/**
 * Creates a complete FLAC file with proper headers
 */
function createFlacFile(frames, metadata, compressionLevel) {
    // Calculate total size
    let totalSize = 4 + 4 + 4 + 4; // fLaC marker, metadata block headers, streaminfo
    
    // Estimate frame sizes
    const frameData = [];
    for (const frame of frames) {
        // Add CRC-8 and CRC-16 to each frame
        const crc8 = calculateCrc8(frame);
        const crc16 = calculateCrc16(frame);
        const paddedFrame = new Uint8Array(frame.length + 2 + 2);
        paddedFrame.set(frame);
        paddedFrame[frame.length] = crc8;
        paddedFrame[frame.length + 1] = crc16 >> 8;
        paddedFrame[frame.length + 2] = crc16 & 0xFF;
        frameData.push(paddedFrame);
        totalSize += paddedFrame.length;
    }
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    let offset = 0;
    
    // fLaC marker
    view.setUint32(offset, 0x664C6143, false); // 'fLaC'
    offset += 4;
    
    // STREAMINFO metadata block
    view.setUint8(offset, 0x80); // Last metadata block, type 0
    offset += 1;
    
    // StreamInfo block size (34 bytes)
    view.setUint24(offset, 34, false);
    offset += 3;
    
    // StreamInfo data
    view.setUint16(offset, metadata.numChannels - 1, false); // channel assignment
    offset += 2;
    view.setUint16(offset, metadata.bitsPerSample - 1, false); // bits per sample
    offset += 2;
    view.setUint64(offset, metadata.totalSamples, false); // total samples
    offset += 8;
    view.setUint32(offset, metadata.sampleRate << 4, false); // sample rate code
    offset += 4;
    // 128-bit MD5 signature (zeros for now)
    for (let i = 0; i < 16; i++) {
        view.setUint8(offset, 0);
        offset += 1;
    }
    
    // Copy frame data
    for (const frame of frameData) {
        uint8View.set(frame, offset);
        offset += frame.length;
    }
    
    return new Blob([buffer], { type: 'audio/flac' });
}

/**
 * Get FLAC sample rate code
 */
function getFlacSampleRateCode(sampleRate) {
    const rates = [
        { rate: 88200, code: 0x0 },
        { rate: 176400, code: 0x1 },
        { rate: 192000, code: 0x2 },
        { rate: 80000, code: 0x3 },
        { rate: 96000, code: 0x4 },
        { rate: 11250, code: 0x5 },
        { rate: 22500, code: 0x6 },
        { rate: 45000, code: 0x7 },
        { rate: 16000, code: 0x8 },
        { rate: 8000, code: 0x9 },
        { rate: 22050, code: 0xA },
        { rate: 24000, code: 0xB },
        { rate: 32000, code: 0xC },
        { rate: 48000, code: 0xD },
        { rate: 9600, code: 0xE },
        { rate: 4800, code: 0xF }
    ];
    
    for (const r of rates) {
        if (r.rate === sampleRate) return r.code;
    }
    return 0xD; // Default to 48000
}

/**
 * Calculate CRC-8 for FLAC frame
 */
function calculateCrc8(data) {
    let crc = 0;
    for (const byte of data) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            crc = (crc << 1) ^ (crc & 0x80 ? 0x07 : 0);
        }
    }
    return crc & 0xFF;
}

/**
 * Calculate CRC-16 for FLAC frame
 */
function calculateCrc16(data) {
    let crc = 0;
    const polynomial = 0x8005;
    for (const byte of data) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ polynomial;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc & 0xFFFF;
}

/**
 * Helper function to write string to DataView
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Utility to download a blob as a file
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders audio to AudioBuffer using Web Audio API offline context
 * @param {function} renderCallback - Callback that sets up audio graph
 * @param {number} duration - Duration in seconds
 * @param {number} sampleRate - Sample rate (default 44100)
 * @returns {Promise<AudioBuffer>} Rendered audio buffer
 */
export async function renderAudioOffline(renderCallback, duration, sampleRate = 44100) {
    const offlineCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);
    
    // Call the render callback to set up audio nodes
    await renderCallback(offlineCtx);
    
    // Render the audio
    const audioBuffer = await offlineCtx.startRendering();
    return audioBuffer;
}