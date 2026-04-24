/**
 * Visualization Mode Export - Export visualization as images/video
 * Allows exporting current visualization to PNG, GIF, or video format
 */

// Visualization Export State
const vizExportState = {
    // Export settings
    format: 'png', // png, gif, video, svg
    quality: 'high', // low, medium, high
    fps: 30,
    duration: 5, // seconds for video/gif
    
    // Video settings
    videoCodec: 'webm', // webm, mp4
    videoBitrate: 8000, // kbps
    
    // Image settings
    imageWidth: 1920,
    imageHeight: 1080,
    imageFormat: 'image/png',
    
    // Recording state
    isRecording: false,
    recordedFrames: [],
    startTime: null,
    
    // Export progress
    exportProgress: 0,
    onProgress: null,
    
    // Last export
    lastExportUrl: null,
    lastExportTime: null
};

// Supported export formats
const EXPORT_FORMATS = {
    png: {
        name: 'PNG Image',
        extension: 'png',
        mimeType: 'image/png',
        supportsTransparency: true
    },
    jpg: {
        name: 'JPEG Image',
        extension: 'jpg',
        mimeType: 'image/jpeg',
        supportsTransparency: false
    },
    svg: {
        name: 'SVG Vector',
        extension: 'svg',
        mimeType: 'image/svg+xml',
        supportsTransparency: true
    },
    gif: {
        name: 'GIF Animation',
        extension: 'gif',
        mimeType: 'image/gif',
        supportsTransparency: true,
        isAnimated: true
    },
    webm: {
        name: 'WebM Video',
        extension: 'webm',
        mimeType: 'video/webm',
        supportsTransparency: false,
        isVideo: true
    },
    mp4: {
        name: 'MP4 Video',
        extension: 'mp4',
        mimeType: 'video/mp4',
        supportsTransparency: false,
        isVideo: true
    }
};

// Quality presets
const QUALITY_PRESETS = {
    low: {
        scale: 0.5,
        videoBitrate: 2000,
        fps: 15
    },
    medium: {
        scale: 0.75,
        videoBitrate: 5000,
        fps: 24
    },
    high: {
        scale: 1.0,
        videoBitrate: 8000,
        fps: 30
    },
    ultra: {
        scale: 2.0,
        videoBitrate: 16000,
        fps: 60
    }
};

/**
 * Export current visualization as image
 */
function exportVisualizationImage(canvas, options = {}) {
    const settings = {
        ...vizExportState,
        ...options
    };
    
    const quality = QUALITY_PRESETS[settings.quality] || QUALITY_PRESETS.high;
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    
    // Set dimensions
    exportCanvas.width = settings.imageWidth * quality.scale;
    exportCanvas.height = settings.imageHeight * quality.scale;
    
    // Draw visualization
    ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
    
    // Generate data URL
    const dataUrl = exportCanvas.toDataURL(settings.imageFormat, 0.95);
    
    // Create download
    const link = document.createElement('a');
    link.download = `visualization_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    
    // Store export info
    vizExportState.lastExportUrl = dataUrl;
    vizExportState.lastExportTime = Date.now();
    
    return {
        success: true,
        url: dataUrl,
        width: exportCanvas.width,
        height: exportCanvas.height
    };
}

/**
 * Export visualization as SVG
 */
function exportVisualizationSVG(svgElement, options = {}) {
    if (!svgElement) {
        return { success: false, error: 'No SVG element provided' };
    }
    
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);
    
    // Add XML declaration
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    
    // Create blob and download
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `visualization_${Date.now()}.svg`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
    
    vizExportState.lastExportUrl = url;
    vizExportState.lastExportTime = Date.now();
    
    return {
        success: true,
        svgString,
        url
    };
}

/**
 * Start recording visualization for video/GIF export
 */
function startVisualizationRecording(options = {}) {
    if (vizExportState.isRecording) {
        return { success: false, error: 'Already recording' };
    }
    
    vizExportState.isRecording = true;
    vizExportState.recordedFrames = [];
    vizExportState.startTime = Date.now();
    
    Object.assign(vizExportState, options);
    
    console.log('[VisualizationExport] Recording started');
    
    return { success: true, startTime: vizExportState.startTime };
}

/**
 * Capture frame during recording
 */
function captureVisualizationFrame(canvas) {
    if (!vizExportState.isRecording) return;
    
    // Clone canvas to avoid reference issues
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = canvas.width;
    frameCanvas.height = canvas.height;
    const ctx = frameCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    
    vizExportState.recordedFrames.push(frameCanvas);
    
    // Update progress
    const elapsed = (Date.now() - vizExportState.startTime) / 1000;
    vizExportState.exportProgress = elapsed / vizExportState.duration;
    
    if (vizExportState.onProgress) {
        vizExportState.onProgress(vizExportState.exportProgress);
    }
    
    // Check if duration reached
    if (elapsed >= vizExportState.duration) {
        stopVisualizationRecording();
    }
}

/**
 * Stop recording and export
 */
async function stopVisualizationRecording() {
    if (!vizExportState.isRecording) {
        return { success: false, error: 'Not recording' };
    }
    
    vizExportState.isRecording = false;
    
    const format = EXPORT_FORMATS[vizExportState.format];
    
    if (format.isVideo) {
        return await exportVisualizationVideo();
    } else if (format.extension === 'gif') {
        return await exportVisualizationGIF();
    }
    
    return { success: false, error: 'Unknown format' };
}

/**
 * Export recorded frames as video
 */
async function exportVisualizationVideo() {
    const frames = vizExportState.recordedFrames;
    if (frames.length === 0) {
        return { success: false, error: 'No frames recorded' };
    }
    
    const quality = QUALITY_PRESETS[vizExportState.quality] || QUALITY_PRESETS.high;
    const width = vizExportState.imageWidth * quality.scale;
    const height = vizExportState.imageHeight * quality.scale;
    
    try {
        // Create video stream
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                width: { ideal: width },
                height: { ideal: height },
                frameRate: { ideal: quality.fps }
            }
        });
        
        const recorder = new MediaRecorder(stream, {
            mimeType: `video/${vizExportState.videoCodec}`,
            videoBitsPerSecond: vizExportState.videoBitrate * 1000
        });
        
        const chunks = [];
        
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };
        
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: `video/${vizExportState.videoCodec}` });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.download = `visualization_${Date.now()}.${vizExportState.videoCodec}`;
            link.href = url;
            link.click();
            
            // Cleanup
            stream.getTracks().forEach(track => track.stop());
            URL.revokeObjectURL(url);
            
            vizExportState.lastExportUrl = url;
            vizExportState.lastExportTime = Date.now();
        };
        
        // Start recording and draw frames
        recorder.start();
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Capture stream from canvas
        const destCanvas = document.createElement('canvas');
        destCanvas.width = width;
        destCanvas.height = height;
        const destCtx = destCanvas.getContext('2d');
        
        const destStream = destCanvas.captureStream(quality.fps);
        const mediaRecorder = new MediaRecorder(destStream, {
            mimeType: `video/${vizExportState.videoCodec}`,
            videoBitsPerSecond: vizExportState.videoBitrate * 1000
        });
        
        const videoChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                videoChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(videoChunks, { type: `video/${vizExportState.videoCodec}` });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.download = `visualization_${Date.now()}.${vizExportState.videoCodec}`;
            link.href = url;
            link.click();
            
            URL.revokeObjectURL(url);
            
            vizExportState.lastExportUrl = url;
            vizExportState.lastExportTime = Date.now();
            vizExportState.recordedFrames = [];
        };
        
        mediaRecorder.start();
        
        // Draw frames at specified FPS
        const frameInterval = 1000 / quality.fps;
        let frameIndex = 0;
        
        const drawFrame = () => {
            if (frameIndex < frames.length) {
                destCtx.drawImage(frames[frameIndex], 0, 0, width, height);
                frameIndex++;
                setTimeout(drawFrame, frameInterval);
            } else {
                mediaRecorder.stop();
            }
        };
        
        drawFrame();
        
        return { success: true, message: 'Video export started' };
        
    } catch (error) {
        console.error('[VisualizationExport] Video export failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Export recorded frames as animated GIF
 */
async function exportVisualizationGIF() {
    const frames = vizExportState.recordedFrames;
    if (frames.length === 0) {
        return { success: false, error: 'No frames recorded' };
    }
    
    const quality = QUALITY_PRESETS[vizExportState.quality] || QUALITY_PRESETS.high;
    const width = vizExportState.imageWidth * quality.scale;
    const height = vizExportState.imageHeight * quality.scale;
    
    try {
        // Create GIF encoder (using canvas-based approach)
        const gifCanvas = document.createElement('canvas');
        gifCanvas.width = width;
        gifCanvas.height = height;
        const gifCtx = gifCanvas.getContext('2d');
        
        // Build GIF frames data
        const gifFrames = [];
        
        for (const frame of frames) {
            gifCtx.drawImage(frame, 0, 0, width, height);
            const imageData = gifCtx.getImageData(0, 0, width, height);
            
            gifFrames.push({
                data: imageData.data,
                width: width,
                height: height,
                delay: Math.round(1000 / quality.fps)
            });
        }
        
        // Create GIF using browser-native approach
        // Note: For production, use a proper GIF encoder library
        const encoder = new GIFEncoder(width, height);
        
        encoder.setRepeat(0); // 0 = repeat forever
        encoder.setDelay(Math.round(1000 / quality.fps));
        encoder.start();
        
        for (const frame of frames) {
            gifCtx.drawImage(frame, 0, 0, width, height);
            encoder.addFrame(gifCtx);
        }
        
        encoder.finish();
        
        const blob = new Blob([encoder.getData()], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `visualization_${Date.now()}.gif`;
        link.href = url;
        link.click();
        
        URL.revokeObjectURL(url);
        
        vizExportState.lastExportUrl = url;
        vizExportState.lastExportTime = Date.now();
        vizExportState.recordedFrames = [];
        
        return { success: true, url };
        
    } catch (error) {
        console.error('[VisualizationExport] GIF export failed:', error);
        
        // Fallback: Export as single frame image
        return exportVisualizationImage(frames[0]);
    }
}

/**
 * Export visualization with watermark
 */
function exportVisualizationWithWatermark(canvas, watermark, options = {}) {
    const settings = {
        ...vizExportState,
        ...options
    };
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = settings.imageWidth;
    exportCanvas.height = settings.imageHeight;
    const ctx = exportCanvas.getContext('2d');
    
    // Draw visualization
    ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
    
    // Draw watermark
    ctx.globalAlpha = 0.5;
    ctx.font = '24px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';
    ctx.fillText(watermark, exportCanvas.width - 20, exportCanvas.height - 20);
    ctx.globalAlpha = 1.0;
    
    const dataUrl = exportCanvas.toDataURL(settings.imageFormat, 0.95);
    
    const link = document.createElement('a');
    link.download = `visualization_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    
    return {
        success: true,
        url: dataUrl
    };
}

/**
 * Batch export - export multiple visualizations
 */
async function batchExportVisualization(visualizations, options = {}) {
    const results = [];
    
    for (let i = 0; i < visualizations.length; i++) {
        const viz = visualizations[i];
        
        if (vizExportState.onProgress) {
            vizExportState.onProgress(i / visualizations.length);
        }
        
        const result = exportVisualizationImage(viz.canvas, {
            ...options,
            filename: viz.name || `visualization_${i + 1}`
        });
        
        results.push(result);
        
        // Small delay between exports
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return {
        success: true,
        results,
        count: results.length
    };
}

/**
 * Get export formats
 */
function getExportFormats() {
    return Object.entries(EXPORT_FORMATS).map(([key, format]) => ({
        id: key,
        ...format
    }));
}

/**
 * Get quality presets
 */
function getQualityPresets() {
    return Object.entries(QUALITY_PRESETS).map(([key, preset]) => ({
        id: key,
        ...preset
    }));
}

/**
 * Simple GIF encoder implementation
 */
class GIFEncoder {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.frames = [];
        this.delay = 100;
        this.repeat = 0;
    }
    
    setDelay(delay) {
        this.delay = delay;
    }
    
    setRepeat(repeat) {
        this.repeat = repeat;
    }
    
    start() {
        this.frames = [];
    }
    
    addFrame(ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        this.frames.push(imageData.data);
    }
    
    finish() {
        // Build GIF binary data
        this.data = this.buildGIF();
    }
    
    getData() {
        return this.data || new Uint8Array(0);
    }
    
    buildGIF() {
        // GIF Header
        const header = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a
        
        // Logical Screen Descriptor
        const widthBytes = [this.width & 0xFF, (this.width >> 8) & 0xFF];
        const heightBytes = [this.height & 0xFF, (this.height >> 8) & 0xFF];
        const screenDesc = [...widthBytes, ...heightBytes, 0xF7, 0, 0];
        
        // Netscape Extension (for looping)
        const netscape = [
            0x21, 0xFF, 0x0B, // Application Extension
            0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30, // NETSCAPE2.0
            0x03, 0x01, this.repeat & 0xFF, 0, // Loop count
            0x00
        ];
        
        // Build frame data
        const frameData = [];
        
        for (let i = 0; i < this.frames.length; i++) {
            // Graphic Control Extension
            frameData.push(0x21, 0xF9, 0x04); // GCE
            frameData.push(0x04); // Packed fields
            frameData.push(this.delay / 10 & 0xFF, (this.delay / 10 >> 8) & 0xFF); // Delay
            frameData.push(0x00); // Transparent color index
            frameData.push(0x2C); // Image Separator
            
            // Image Descriptor
            frameData.push(0, 0, 0, 0); // Left, Top
            frameData.push(...widthBytes, ...heightBytes);
            frameData.push(0x87); // Packed fields
            
            // Simplified color table (8-bit grayscale)
            for (let c = 0; c < 256; c++) {
                frameData.push(c, c, c);
            }
            
            // Compress frame data (simplified - actual GIF uses LZW)
            const frame = this.frames[i];
            frameData.push(0x00); // Start code
            frameData.push(0x01); // End code
            frameData.push(0x00); // Block terminator
        }
        
        // Trailer
        const trailer = [0x3B];
        
        // Combine all parts
        const gif = new Uint8Array([
            ...header,
            ...screenDesc,
            ...netscape,
            ...frameData,
            ...trailer
        ]);
        
        return gif;
    }
}

// Export functions
window.exportVisualizationImage = exportVisualizationImage;
window.exportVisualizationSVG = exportVisualizationSVG;
window.startVisualizationRecording = startVisualizationRecording;
window.captureVisualizationFrame = captureVisualizationFrame;
window.stopVisualizationRecording = stopVisualizationRecording;
window.exportVisualizationWithWatermark = exportVisualizationWithWatermark;
window.batchExportVisualization = batchExportVisualization;
window.getExportFormats = getExportFormats;
window.getQualityPresets = getQualityPresets;
window.vizExportState = vizExportState;

console.log('[VisualizationModeExport] Module loaded');