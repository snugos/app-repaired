/**
 * Clip Reverse Range - Reverse only selected section of clip
 * Allows reversing a portion of an audio clip
 */

class ClipReverseRange {
    constructor() {
        this.fadeEnabled = true;
        this.fadeDuration = 5; // ms
        this.crossfadeDuration = 10; // ms
        this.preserveSelection = true;
        this.previewEnabled = false;
    }

    /**
     * Reverse a section of audio data
     * @param {Float32Array} data - Audio data
     * @param {number} start - Start sample
     * @param {number} end - End sample
     * @returns {Float32Array} - Reversed section
     */
    reverseSection(data, start, end) {
        const section = data.slice(start, end);
        const reversed = new Float32Array(section.length);

        for (let i = 0; i < section.length; i++) {
            reversed[i] = section[section.length - 1 - i];
        }

        return reversed;
    }

    /**
     * Apply fade in/out to avoid clicks
     * @param {Float32Array} data - Audio data
     * @param {number} fadeSamples - Number of samples for fade
     * @param {boolean} fadeIn - True for fade in, false for fade out
     */
    applyFade(data, fadeSamples, fadeIn) {
        if (fadeSamples <= 0 || fadeSamples >= data.length) return;

        for (let i = 0; i < fadeSamples; i++) {
            const factor = fadeIn 
                ? i / fadeSamples 
                : 1 - (i / fadeSamples);
            data[i] *= factor;
        }
    }

    /**
     * Reverse a range within an audio buffer
     * @param {AudioBuffer} buffer - Source audio buffer
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @param {Object} options - Options
     * @returns {AudioBuffer} - New buffer with reversed section
     */
    reverseRange(buffer, startTime, endTime, options = {}) {
        const {
            fadeEnabled = this.fadeEnabled,
            fadeDuration = this.fadeDuration,
            crossfadeDuration = this.crossfadeDuration
        } = options;

        const sampleRate = buffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const fadeSamples = Math.floor(fadeDuration / 1000 * sampleRate);
        const crossfadeSamples = Math.floor(crossfadeDuration / 1000 * sampleRate);

        // Create new buffer
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const outputBuffer = audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const input = buffer.getChannelData(channel);
            const output = outputBuffer.getChannelData(channel);

            // Copy original data
            for (let i = 0; i < input.length; i++) {
                output[i] = input[i];
            }

            // Reverse the section
            const reversed = this.reverseSection(input, startSample, endSample);

            // Apply fades if enabled
            if (fadeEnabled) {
                this.applyFade(reversed, Math.min(fadeSamples, reversed.length / 2), false);
                this.applyFade(reversed.subarray(reversed.length - fadeSamples), fadeSamples, true);
            }

            // Insert reversed section
            for (let i = 0; i < reversed.length; i++) {
                output[startSample + i] = reversed[i];
            }

            // Apply crossfade at boundaries if enabled
            if (crossfadeDuration > 0) {
                // Fade out at start boundary
                for (let i = 0; i < crossfadeSamples; i++) {
                    const pos = startSample - crossfadeSamples + i;
                    if (pos >= 0) {
                        const factor = i / crossfadeSamples;
                        output[pos] = output[pos] * (1 - factor) + input[pos] * factor;
                    }
                }

                // Fade in at end boundary
                for (let i = 0; i < crossfadeSamples; i++) {
                    const pos = endSample + i;
                    if (pos < output.length) {
                        const factor = 1 - (i / crossfadeSamples);
                        output[pos] = output[pos] * factor + input[pos] * (1 - factor);
                    }
                }
            }
        }

        return outputBuffer;
    }

    /**
     * Reverse multiple regions in a clip
     * @param {AudioBuffer} buffer - Source buffer
     * @param {Array} regions - Array of {start, end} objects
     * @returns {AudioBuffer} - Buffer with all regions reversed
     */
    reverseMultipleRanges(buffer, regions) {
        if (!regions || regions.length === 0) return buffer;

        // Sort regions by start time
        const sorted = [...regions].sort((a, b) => a.start - b.start);

        let currentBuffer = buffer;

        // Reverse each region (in reverse order to preserve positions)
        for (let i = sorted.length - 1; i >= 0; i--) {
            const region = sorted[i];
            currentBuffer = this.reverseRange(currentBuffer, region.start, region.end);
        }

        return currentBuffer;
    }

    /**
     * Reverse entire clip
     * @param {AudioBuffer} buffer - Source buffer
     * @returns {AudioBuffer} - Completely reversed buffer
     */
    reverseEntire(buffer) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const outputBuffer = audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const input = buffer.getChannelData(channel);
            const output = outputBuffer.getChannelData(channel);

            for (let i = 0; i < input.length; i++) {
                output[i] = input[input.length - 1 - i];
            }
        }

        return outputBuffer;
    }

    /**
     * Reverse with time-stretch to fit original duration
     * @param {AudioBuffer} buffer - Source buffer
     * @param {number} startTime - Start time
     * @param {number} endTime - End time
     * @returns {AudioBuffer} - Buffer with reversed section
     */
    reverseWithStretch(buffer, startTime, endTime) {
        // This would integrate with time-stretch algorithms
        // For now, just do basic reversal
        return this.reverseRange(buffer, startTime, endTime);
    }

    /**
     * Create mirror effect (forward then backward)
     * @param {AudioBuffer} buffer - Source buffer
     * @param {number} startTime - Start time
     * @param {number} endTime - End time
     * @returns {AudioBuffer} - Buffer with mirrored section
     */
    createMirror(buffer, startTime, endTime) {
        const sampleRate = buffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const sectionLength = endSample - startSample;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const outputBuffer = audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length + sectionLength,
            sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const input = buffer.getChannelData(channel);
            const output = outputBuffer.getChannelData(channel);

            // Copy before section
            for (let i = 0; i < startSample; i++) {
                output[i] = input[i];
            }

            // Forward section
            for (let i = 0; i < sectionLength; i++) {
                output[startSample + i] = input[startSample + i];
            }

            // Reversed section
            for (let i = 0; i < sectionLength; i++) {
                output[startSample + sectionLength + i] = input[endSample - 1 - i];
            }

            // Copy after section (shifted)
            for (let i = endSample; i < input.length; i++) {
                output[i + sectionLength] = input[i];
            }
        }

        return outputBuffer;
    }

    /**
     * Open reverse range panel
     */
    openReversePanel(clips, onApply) {
        const existing = document.getElementById('reverse-range-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'reverse-range-panel';

        const clipOptions = (clips || [])
            .map(c => `<option value="${c.id}">${c.name}</option>`)
            .join('');

        panel.innerHTML = `
            <div class="reverse-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 500px;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🔄 Clip Reverse Range</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Select Clip</label>
                    <select id="reverse-clip-select" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        <option value="">Select a clip...</option>
                        ${clipOptions}
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Start Time (seconds)</label>
                        <input type="number" id="reverse-start" value="0" min="0" step="0.1"
                            style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">End Time (seconds)</label>
                        <input type="number" id="reverse-end" value="1" min="0" step="0.1"
                            style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Mode</label>
                    <select id="reverse-mode" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        <option value="range">Reverse Range</option>
                        <option value="entire">Reverse Entire Clip</option>
                        <option value="mirror">Mirror (Forward + Backward)</option>
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px;">
                        <input type="checkbox" id="reverse-fade" ${this.fadeEnabled ? 'checked' : ''} style="accent-color: #10b981;">
                        Apply fade to avoid clicks
                    </label>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Fade Duration: <span id="fade-value">${this.fadeDuration}</span> ms</label>
                    <input type="range" id="reverse-fade-duration" min="0" max="50" value="${this.fadeDuration}"
                        style="width: 100%; margin-top: 8px; accent-color: #8b5cf6;">
                </div>

                <div id="reverse-preview" style="display: none; background: #2a2a4e; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                    <div style="color: #a0a0a0; font-size: 12px;">
                        Duration: <span id="preview-duration">0</span>s
                    </div>
                    <div style="color: #a0a0a0; font-size: 12px;">
                        Reversed section: <span id="preview-section">0</span>s
                    </div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="reverse-preview-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Preview
                    </button>
                    <button id="reverse-apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>
                        Apply Reverse
                    </button>
                    <button id="reverse-close-btn" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #reverse-range-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // State
        let selectedClip = null;
        let previewBuffer = null;

        // Event handlers
        const clipSelect = document.getElementById('reverse-clip-select');
        const startInput = document.getElementById('reverse-start');
        const endInput = document.getElementById('reverse-end');
        const modeSelect = document.getElementById('reverse-mode');
        const fadeCheck = document.getElementById('reverse-fade');
        const fadeSlider = document.getElementById('reverse-fade-duration');
        const previewBtn = document.getElementById('reverse-preview-btn');
        const applyBtn = document.getElementById('reverse-apply-btn');
        const closeBtn = document.getElementById('reverse-close-btn');
        const previewDiv = document.getElementById('reverse-preview');

        // Clip selection
        clipSelect.addEventListener('change', (e) => {
            const clipId = e.target.value;
            selectedClip = clips.find(c => c.id === clipId);

            if (selectedClip && selectedClip.audioBuffer) {
                const duration = selectedClip.audioBuffer.duration;
                endInput.max = duration;
                endInput.value = duration.toFixed(2);
                applyBtn.disabled = false;
            }
        });

        // Mode change
        modeSelect.addEventListener('change', (e) => {
            const isRange = e.target.value === 'range';
            startInput.disabled = !isRange;
            endInput.disabled = !isRange;
        });

        // Fade toggle
        fadeCheck.addEventListener('change', (e) => {
            this.fadeEnabled = e.target.checked;
        });

        // Fade duration
        fadeSlider.addEventListener('input', (e) => {
            this.fadeDuration = parseInt(e.target.value);
            document.getElementById('fade-value').textContent = e.target.value;
        });

        // Preview
        previewBtn.addEventListener('click', async () => {
            if (!selectedClip || !selectedClip.audioBuffer) return;

            const startTime = parseFloat(startInput.value);
            const endTime = parseFloat(endInput.value);
            const mode = modeSelect.value;

            previewBtn.textContent = 'Processing...';
            previewBtn.disabled = true;

            switch (mode) {
                case 'entire':
                    previewBuffer = this.reverseEntire(selectedClip.audioBuffer);
                    break;
                case 'mirror':
                    previewBuffer = this.createMirror(selectedClip.audioBuffer, startTime, endTime);
                    break;
                default:
                    previewBuffer = this.reverseRange(selectedClip.audioBuffer, startTime, endTime);
            }

            previewDiv.style.display = 'block';
            document.getElementById('preview-duration').textContent = previewBuffer.duration.toFixed(2);
            document.getElementById('preview-section').textContent = (endTime - startTime).toFixed(2);

            // Play preview
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const source = ctx.createBufferSource();
            source.buffer = previewBuffer;
            source.connect(ctx.destination);
            source.start();

            previewBtn.textContent = 'Preview';
            previewBtn.disabled = false;
        });

        // Apply
        applyBtn.addEventListener('click', () => {
            if (!selectedClip || !previewBuffer) return;

            if (onApply) {
                onApply({
                    clipId: selectedClip.id,
                    buffer: previewBuffer,
                    mode: modeSelect.value
                });
            }

            panel.remove();
            style.remove();
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });
    }
}

// Export singleton
const clipReverseRange = new ClipReverseRange();

export { ClipReverseRange, clipReverseRange };