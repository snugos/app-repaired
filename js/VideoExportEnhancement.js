/**
 * Video Export Enhancement - Export video with audio
 * Provides comprehensive video export with embedded audio tracks
 */

class VideoExportEnhancement {
    constructor() {
        this.exportSettings = {
            format: 'webm', // webm, mp4
            quality: 'high', // low, medium, high, ultra
            resolution: '1080p', // 720p, 1080p, 4k
            frameRate: 30, // 24, 30, 60
            includeAudio: true,
            audioBitrate: 192, // kbps
            videoBitrate: 8000, // kbps
            startTime: 0,
            endTime: 0, // 0 = full project
            fadeIn: 0, // seconds
            fadeOut: 0, // seconds
            watermark: null,
            watermarkPosition: 'bottom-right',
            watermarkOpacity: 0.5
        };
        
        this.presets = [
            { name: 'YouTube 1080p', format: 'webm', resolution: '1080p', frameRate: 30, videoBitrate: 8000, audioBitrate: 192 },
            { name: 'YouTube 4K', format: 'webm', resolution: '4k', frameRate: 30, videoBitrate: 35000, audioBitrate: 192 },
            { name: 'Instagram Reels', format: 'webm', resolution: '1080p', frameRate: 30, videoBitrate: 6000, audioBitrate: 128 },
            { name: 'TikTok', format: 'webm', resolution: '1080p', frameRate: 30, videoBitrate: 5000, audioBitrate: 128 },
            { name: 'Twitter/X', format: 'webm', resolution: '720p', frameRate: 30, videoBitrate: 4000, audioBitrate: 128 },
            { name: 'High Quality', format: 'webm', resolution: '1080p', frameRate: 60, videoBitrate: 12000, audioBitrate: 320 },
            { name: 'Preview Low', format: 'webm', resolution: '720p', frameRate: 24, videoBitrate: 2000, audioBitrate: 96 }
        ];
        
        this.isExporting = false;
        this.exportProgress = 0;
        this.cancelled = false;
        this.canvas = null;
        this.videoTrack = null;
        this.exportBlob = null;
        
        this.init();
    }
    
    init() {
        console.log('[VideoExportEnhancement] Initialized');
    }
    
    // Set video track for export
    setVideoTrack(videoTrack) {
        this.videoTrack = videoTrack;
        console.log('[VideoExportEnhancement] Video track set:', videoTrack?.id || videoTrack);
    }
    
    // Get resolution dimensions
    getResolutionDimensions(resolution) {
        const resolutions = {
            '720p': { width: 1280, height: 720 },
            '1080p': { width: 1920, height: 1080 },
            '4k': { width: 3840, height: 2160 }
        };
        return resolutions[resolution] || resolutions['1080p'];
    }
    
    // Apply preset
    applyPreset(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (preset) {
            Object.assign(this.exportSettings, preset);
            console.log('[VideoExportEnhancement] Applied preset:', presetName);
            return true;
        }
        return false;
    }
    
    // Render video frame at time
    async renderVideoFrame(time, canvas, ctx) {
        if (!this.videoTrack) {
            // Render placeholder or waveform visualization
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw waveform visualization
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const audio = window.snugAudio || window.audio;
            if (audio && audio.analyser) {
                const bufferLength = audio.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                audio.analyser.getByteTimeDomainData(dataArray);
                
                const sliceWidth = canvas.width / bufferLength;
                let x = 0;
                
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * canvas.height) / 2;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }
            }
            ctx.stroke();
            
            // Draw timestamp
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px monospace';
            ctx.textAlign = 'left';
            const minutes = Math.floor(time / 60);
            const seconds = Math.floor(time % 60);
            const ms = Math.floor((time % 1) * 100);
            ctx.fillText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, 20, 40);
            
            return;
        }
        
        // Render actual video frame
        if (this.videoTrack.type === 'Video' && this.videoTrack.videoElement) {
            ctx.drawImage(this.videoTrack.videoElement, 0, 0, canvas.width, canvas.height);
        }
    }
    
    // Export video with audio
    async exportVideo(progressCallback = null) {
        if (this.isExporting) {
            console.warn('[VideoExportEnhancement] Export already in progress');
            return null;
        }
        
        this.isExporting = true;
        this.cancelled = false;
        this.exportProgress = 0;
        
        const settings = { ...this.exportSettings };
        const resolution = this.getResolutionDimensions(settings.resolution);
        
        console.log('[VideoExportEnhancement] Starting export:', settings);
        
        try {
            // Create canvas for video rendering
            this.canvas = document.createElement('canvas');
            this.canvas.width = resolution.width;
            this.canvas.height = resolution.height;
            const ctx = this.canvas.getContext('2d');
            
            // Get audio context and duration
            const audio = window.snugAudio || window.audio;
            const audioContext = audio?.audioContext || window.audioContext;
            const duration = settings.endTime > 0 ? (settings.endTime - settings.startTime) : this.getProjectDuration();
            
            if (!audioContext) {
                throw new Error('No audio context available');
            }
            
            // Create MediaRecorder with canvas stream
            const canvasStream = this.canvas.captureStream(settings.frameRate);
            
            // Get audio stream from destination
            let audioStream = null;
            if (settings.includeAudio && audio && audio.masterDestination) {
                const destinationNode = audioContext.createMediaStreamDestination();
                audio.masterDestination.connect(destinationNode);
                audioStream = destinationNode.stream;
            }
            
            // Combine video and audio streams
            const tracks = [...canvasStream.getVideoTracks()];
            if (audioStream) {
                tracks.push(...audioStream.getAudioTracks());
            }
            
            const combinedStream = new MediaStream(tracks);
            
            // Configure MediaRecorder
            const mimeType = settings.format === 'mp4' ? 'video/mp4' : 'video/webm';
            const videoBitsPerSecond = settings.videoBitrate * 1000;
            const audioBitsPerSecond = settings.audioBitrate * 1000;
            
            const recorderOptions = {
                mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
                videoBitsPerSecond,
                audioBitsPerSecond
            };
            
            const recorder = new MediaRecorder(combinedStream, recorderOptions);
            const chunks = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            // Start recording
            recorder.start();
            
            // Start playback
            if (audio) {
                audio.seekTo(settings.startTime);
                await audio.play();
            }
            
            // Render frames
            const frameInterval = 1 / settings.frameRate;
            let currentTime = settings.startTime;
            const endTime = settings.startTime + duration;
            
            while (currentTime < endTime && !this.cancelled) {
                // Render frame
                await this.renderVideoFrame(currentTime, this.canvas, ctx);
                
                // Apply watermark
                if (settings.watermark) {
                    await this.applyWatermark(ctx, settings);
                }
                
                // Update progress
                this.exportProgress = (currentTime - settings.startTime) / duration;
                if (progressCallback) {
                    progressCallback(this.exportProgress, currentTime);
                }
                
                // Wait for next frame
                await new Promise(resolve => setTimeout(resolve, frameInterval * 1000));
                currentTime += frameInterval;
            }
            
            // Stop recording
            recorder.stop();
            
            // Stop playback
            if (audio) {
                audio.pause();
            }
            
            // Wait for recorder to finish
            await new Promise((resolve) => {
                recorder.onstop = resolve;
            });
            
            // Create blob
            const blobType = settings.format === 'mp4' ? 'video/mp4' : 'video/webm';
            this.exportBlob = new Blob(chunks, { type: blobType });
            
            this.isExporting = false;
            console.log('[VideoExportEnhancement] Export complete:', this.exportBlob.size, 'bytes');
            
            return this.exportBlob;
            
        } catch (error) {
            console.error('[VideoExportEnhancement] Export failed:', error);
            this.isExporting = false;
            throw error;
        }
    }
    
    // Apply watermark to frame
    async applyWatermark(ctx, settings) {
        if (!settings.watermark) return;
        
        const { width, height } = ctx.canvas;
        const watermarkWidth = 100;
        const watermarkHeight = 50;
        
        let x, y;
        switch (settings.watermarkPosition) {
            case 'top-left':
                x = 20;
                y = 20;
                break;
            case 'top-right':
                x = width - watermarkWidth - 20;
                y = 20;
                break;
            case 'bottom-left':
                x = 20;
                y = height - watermarkHeight - 20;
                break;
            case 'bottom-right':
            default:
                x = width - watermarkWidth - 20;
                y = height - watermarkHeight - 20;
                break;
            case 'center':
                x = (width - watermarkWidth) / 2;
                y = (height - watermarkHeight) / 2;
                break;
        }
        
        ctx.globalAlpha = settings.watermarkOpacity;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(settings.watermark, x, y + watermarkHeight / 2);
        ctx.globalAlpha = 1;
    }
    
    // Get project duration
    getProjectDuration() {
        const audio = window.snugAudio || window.audio;
        const state = window.snugState || window.state;
        
        if (state && typeof state.getProjectDuration === 'function') {
            return state.getProjectDuration();
        }
        
        // Default duration
        return 60; // 60 seconds
    }
    
    // Cancel export
    cancelExport() {
        this.cancelled = true;
        console.log('[VideoExportEnhancement] Export cancelled');
    }
    
    // Download exported video
    downloadExport(filename = 'video-export') {
        if (!this.exportBlob) {
            console.warn('[VideoExportEnhancement] No export to download');
            return false;
        }
        
        const url = URL.createObjectURL(this.exportBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${this.exportSettings.format}`;
        a.click();
        URL.revokeObjectURL(url);
        
        return true;
    }
    
    // Get export progress
    getProgress() {
        return {
            isExporting: this.isExporting,
            progress: this.exportProgress,
            cancelled: this.cancelled
        };
    }
    
    // Update settings
    updateSettings(newSettings) {
        Object.assign(this.exportSettings, newSettings);
        console.log('[VideoExportEnhancement] Settings updated:', this.exportSettings);
    }
    
    // Get settings
    getSettings() {
        return { ...this.exportSettings };
    }
    
    // Get presets
    getPresets() {
        return [...this.presets];
    }
}

// UI Panel function
function openVideoExportPanel() {
    const existing = document.getElementById('video-export-panel');
    if (existing) {
        existing.remove();
    }
    
    const exporter = window.videoExportEnhancement || new VideoExportEnhancement();
    window.videoExportEnhancement = exporter;
    
    const panel = document.createElement('div');
    panel.id = 'video-export-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const presets = exporter.getPresets();
    const settings = exporter.getSettings();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 20px;">Video Export</h2>
            <button id="close-video-export" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Preset</label>
            <select id="video-preset" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="">Custom</option>
                ${presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Format</label>
                <select id="video-format" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="webm">WebM</option>
                    <option value="mp4">MP4</option>
                </select>
            </div>
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Resolution</label>
                <select id="video-resolution" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="720p">720p</option>
                    <option value="1080p" selected>1080p</option>
                    <option value="4k">4K</option>
                </select>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Frame Rate</label>
                <select id="video-framerate" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="24">24 fps</option>
                    <option value="30" selected>30 fps</option>
                    <option value="60">60 fps</option>
                </select>
            </div>
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Quality</label>
                <select id="video-quality" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high" selected>High</option>
                    <option value="ultra">Ultra</option>
                </select>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; cursor: pointer;">
                <input type="checkbox" id="include-audio" checked style="width: 18px; height: 18px;">
                Include Audio
            </label>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Video Bitrate (kbps)</label>
                <input type="number" id="video-bitrate" value="${settings.videoBitrate}" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
            </div>
            <div>
                <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Audio Bitrate (kbps)</label>
                <input type="number" id="audio-bitrate" value="${settings.audioBitrate}" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Watermark Text (optional)</label>
            <input type="text" id="watermark-text" placeholder="e.g., My Studio" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
        </div>
        
        <div id="export-progress" style="display: none; margin-bottom: 16px;">
            <div style="background: #2a2a4e; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                <div id="progress-bar" style="background: #10b981; height: 24px; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="progress-text" style="color: #a0a0a0; text-align: center; font-size: 14px;">Exporting...</div>
        </div>
        
        <div style="display: flex; gap: 12px;">
            <button id="export-video-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Export Video
            </button>
            <button id="cancel-export-btn" style="flex: 1; padding: 12px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; display: none;">
                Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-video-export').onclick = () => panel.remove();
    
    document.getElementById('video-preset').onchange = (e) => {
        if (e.target.value) {
            exporter.applyPreset(e.target.value);
            // Update UI
            document.getElementById('video-format').value = exporter.exportSettings.format;
            document.getElementById('video-resolution').value = exporter.exportSettings.resolution;
            document.getElementById('video-framerate').value = exporter.exportSettings.frameRate;
            document.getElementById('video-bitrate').value = exporter.exportSettings.videoBitrate;
            document.getElementById('audio-bitrate').value = exporter.exportSettings.audioBitrate;
        }
    };
    
    document.getElementById('export-video-btn').onclick = async () => {
        // Get settings from UI
        exporter.updateSettings({
            format: document.getElementById('video-format').value,
            resolution: document.getElementById('video-resolution').value,
            frameRate: parseInt(document.getElementById('video-framerate').value),
            quality: document.getElementById('video-quality').value,
            includeAudio: document.getElementById('include-audio').checked,
            videoBitrate: parseInt(document.getElementById('video-bitrate').value),
            audioBitrate: parseInt(document.getElementById('audio-bitrate').value),
            watermark: document.getElementById('watermark-text').value || null
        });
        
        // Show progress
        document.getElementById('export-progress').style.display = 'block';
        document.getElementById('export-video-btn').style.display = 'none';
        document.getElementById('cancel-export-btn').style.display = 'block';
        
        try {
            const blob = await exporter.exportVideo((progress, time) => {
                document.getElementById('progress-bar').style.width = `${progress * 100}%`;
                const mins = Math.floor(time / 60);
                const secs = Math.floor(time % 60);
                document.getElementById('progress-text').textContent = `Exporting... ${mins}:${secs.toString().padStart(2, '0')} (${Math.round(progress * 100)}%)`;
            });
            
            if (blob) {
                exporter.downloadExport();
                document.getElementById('progress-text').textContent = 'Export complete!';
                document.getElementById('progress-bar').style.width = '100%';
            }
        } catch (error) {
            document.getElementById('progress-text').textContent = `Error: ${error.message}`;
            document.getElementById('progress-bar').style.background = '#ef4444';
        }
        
        document.getElementById('cancel-export-btn').style.display = 'none';
        document.getElementById('export-video-btn').style.display = 'block';
    };
    
    document.getElementById('cancel-export-btn').onclick = () => {
        exporter.cancelExport();
        document.getElementById('progress-text').textContent = 'Export cancelled';
    };
    
    return exporter;
}

// Initialize
function initVideoExportEnhancement() {
    if (!window.videoExportEnhancement) {
        window.videoExportEnhancement = new VideoExportEnhancement();
    }
    return window.videoExportEnhancement;
}

// Export
window.VideoExportEnhancement = VideoExportEnhancement;
window.videoExportEnhancement = new VideoExportEnhancement();
window.openVideoExportPanel = openVideoExportPanel;
window.initVideoExportEnhancement = initVideoExportEnhancement;