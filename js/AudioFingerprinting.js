/**
 * Audio Fingerprinting - Identify audio content and match references
 * Creates audio fingerprints for identification and comparison
 */

class AudioFingerprinting {
    constructor() {
        this.fingerprintDatabase = new Map();
        this.matchHistory = [];
        this.maxHistory = 50;
        
        // Fingerprint parameters
        this.params = {
            sampleRate: 22050,
            frameSize: 2048,
            hopSize: 512,
            peakThreshold: 0.8,
            minPeakDistance: 10,
            targetZoneSize: 100,
            maxPairsPerPeak: 5
        };
    }
    
    /**
     * Generate fingerprint from audio buffer
     * @param {AudioBuffer} audioBuffer - Audio to fingerprint
     * @returns {Object} - Fingerprint object with hash pairs
     */
    generateFingerprint(audioBuffer) {
        const startTime = performance.now();
        
        // Resample if needed
        const resampled = this.resample(audioBuffer, this.params.sampleRate);
        
        // Get mono mix
        const mono = this.toMono(resampled);
        
        // Compute spectrogram
        const spectrogram = this.computeSpectrogram(mono);
        
        // Find peaks
        const peaks = this.findPeaks(spectrogram);
        
        // Generate hash pairs
        const hashes = this.generateHashPairs(peaks);
        
        const fingerprint = {
            hashes: hashes,
            duration: audioBuffer.duration,
            numPeaks: peaks.length,
            numHashes: hashes.length,
            generatedAt: Date.now(),
            processingTime: performance.now() - startTime
        };
        
        return fingerprint;
    }
    
    /**
     * Match audio against database
     * @param {AudioBuffer} audioBuffer - Audio to identify
     * @returns {Object} - Match results
     */
    identify(audioBuffer) {
        const queryFingerprint = this.generateFingerprint(audioBuffer);
        const matches = [];
        
        // Compare against all stored fingerprints
        for (const [id, stored] of this.fingerprintDatabase) {
            const matchResult = this.compareFingerprints(queryFingerprint, stored);
            
            if (matchResult.score > 0.1) {
                matches.push({
                    id,
                    score: matchResult.score,
                    offset: matchResult.offset,
                    matchingHashes: matchResult.matchingHashes,
                    metadata: stored.metadata
                });
            }
        }
        
        // Sort by score
        matches.sort((a, b) => b.score - a.score);
        
        // Add to history
        this.matchHistory.push({
            timestamp: Date.now(),
            queryDuration: audioBuffer.duration,
            topMatch: matches[0] || null,
            totalMatches: matches.length
        });
        
        if (this.matchHistory.length > this.maxHistory) {
            this.matchHistory.shift();
        }
        
        return {
            matches: matches.slice(0, 10),
            query: queryFingerprint
        };
    }
    
    /**
     * Compare audio similarity
     * @param {AudioBuffer} audioA - First audio
     * @param {AudioBuffer} audioB - Second audio
     * @returns {Object} - Similarity score and details
     */
    compareSimilarity(audioA, audioB) {
        const fpA = this.generateFingerprint(audioA);
        const fpB = this.generateFingerprint(audioB);
        
        const result = this.compareFingerprints(fpA, fpB);
        
        return {
            similarity: result.score,
            matchingHashes: result.matchingHashes,
            offset: result.offset,
            details: {
                fingerprintA: { hashes: fpA.numHashes, peaks: fpA.numPeaks },
                fingerprintB: { hashes: fpB.numHashes, peaks: fpB.numPeaks }
            }
        };
    }
    
    /**
     * Add fingerprint to database
     * @param {string} id - Unique identifier
     * @param {AudioBuffer} audioBuffer - Audio to store
     * @param {Object} metadata - Additional metadata
     */
    addToDatabase(id, audioBuffer, metadata = {}) {
        const fingerprint = this.generateFingerprint(audioBuffer);
        fingerprint.metadata = metadata;
        
        this.fingerprintDatabase.set(id, fingerprint);
        
        return {
            id,
            numHashes: fingerprint.numHashes,
            numPeaks: fingerprint.numPeaks
        };
    }
    
    /**
     * Remove from database
     */
    removeFromDatabase(id) {
        return this.fingerprintDatabase.delete(id);
    }
    
    /**
     * Clear database
     */
    clearDatabase() {
        this.fingerprintDatabase.clear();
    }
    
    /**
     * Get database size
     */
    getDatabaseSize() {
        return this.fingerprintDatabase.size;
    }
    
    /**
     * Resample audio buffer
     */
    resample(audioBuffer, targetSampleRate) {
        if (audioBuffer.sampleRate === targetSampleRate) {
            return audioBuffer;
        }
        
        const ratio = audioBuffer.sampleRate / targetSampleRate;
        const newLength = Math.floor(audioBuffer.length / ratio);
        
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            newLength,
            targetSampleRate
        );
        
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start();
        
        // Note: This is async in real implementation
        // For now, return the original
        return audioBuffer;
    }
    
    /**
     * Convert to mono
     */
    toMono(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
        const mono = new Float32Array(audioBuffer.length);
        const numChannels = audioBuffer.numberOfChannels;
        
        for (let i = 0; i < audioBuffer.length; i++) {
            let sum = 0;
            for (let ch = 0; ch < numChannels; ch++) {
                sum += audioBuffer.getChannelData(ch)[i];
            }
            mono[i] = sum / numChannels;
        }
        
        return mono;
    }
    
    /**
     * Compute spectrogram using FFT
     */
    computeSpectrogram(monoData) {
        const frameSize = this.params.frameSize;
        const hopSize = this.params.hopSize;
        const numFrames = Math.floor((monoData.length - frameSize) / hopSize) + 1;
        
        const spectrogram = [];
        const window = this.hannWindow(frameSize);
        
        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hopSize;
            const frameData = new Float32Array(frameSize);
            
            // Apply window and copy data
            for (let i = 0; i < frameSize; i++) {
                frameData[i] = (monoData[start + i] || 0) * window[i];
            }
            
            // Compute magnitude spectrum
            const spectrum = this.computeMagnitudeSpectrum(frameData);
            spectrogram.push(spectrum);
        }
        
        return spectrogram;
    }
    
    /**
     * Hann window function
     */
    hannWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
        }
        return window;
    }
    
    /**
     * Compute magnitude spectrum (simplified FFT)
     */
    computeMagnitudeSpectrum(frameData) {
        const n = frameData.length;
        const spectrum = new Float32Array(n / 2);
        
        // Simplified DFT (for demonstration - real implementation would use FFT)
        for (let k = 0; k < n / 2; k++) {
            let real = 0;
            let imag = 0;
            
            for (let t = 0; t < n; t++) {
                const angle = 2 * Math.PI * k * t / n;
                real += frameData[t] * Math.cos(angle);
                imag -= frameData[t] * Math.sin(angle);
            }
            
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }
        
        return spectrum;
    }
    
    /**
     * Find spectral peaks
     */
    findPeaks(spectrogram) {
        const peaks = [];
        const threshold = this.params.peakThreshold;
        const minDistance = this.params.minPeakDistance;
        
        // Find max magnitude for normalization
        let maxMag = 0;
        for (const frame of spectrogram) {
            for (const mag of frame) {
                if (mag > maxMag) maxMag = mag;
            }
        }
        
        for (let frame = 0; frame < spectrogram.length; frame++) {
            const spectrum = spectrogram[frame];
            
            for (let bin = 1; bin < spectrum.length - 1; bin++) {
                const mag = spectrum[bin];
                const normalizedMag = mag / maxMag;
                
                // Check if peak
                if (normalizedMag > threshold &&
                    mag > spectrum[bin - 1] &&
                    mag > spectrum[bin + 1]) {
                    
                    // Check minimum distance from other peaks
                    const time = frame;
                    const freq = bin;
                    
                    let isUnique = true;
                    for (const peak of peaks) {
                        const timeDiff = Math.abs(peak.time - time);
                        const freqDiff = Math.abs(peak.freq - freq);
                        
                        if (timeDiff < minDistance && freqDiff < minDistance) {
                            isUnique = false;
                            break;
                        }
                    }
                    
                    if (isUnique) {
                        peaks.push({
                            time: frame,
                            freq: bin,
                            magnitude: mag
                        });
                    }
                }
            }
        }
        
        // Sort by time
        peaks.sort((a, b) => a.time - b.time);
        
        return peaks;
    }
    
    /**
     * Generate hash pairs from peaks (anchor-target pairs)
     */
    generateHashPairs(peaks) {
        const hashes = [];
        const targetZoneSize = this.params.targetZoneSize;
        const maxPairs = this.params.maxPairsPerPeak;
        
        for (let i = 0; i < peaks.length; i++) {
            const anchor = peaks[i];
            let pairCount = 0;
            
            // Create pairs with peaks in target zone
            for (let j = i + 1; j < peaks.length && pairCount < maxPairs; j++) {
                const target = peaks[j];
                const timeDelta = target.time - anchor.time;
                
                if (timeDelta <= targetZoneSize) {
                    // Create hash from frequency pair and time delta
                    const hash = this.createHash(
                        anchor.freq,
                        target.freq,
                        timeDelta
                    );
                    
                    hashes.push({
                        hash,
                        time: anchor.time
                    });
                    
                    pairCount++;
                }
            }
        }
        
        return hashes;
    }
    
    /**
     * Create hash string
     */
    createHash(freq1, freq2, timeDelta) {
        // Combine into a single hash value
        const combined = (freq1 << 20) | (freq2 << 10) | timeDelta;
        return combined.toString(16);
    }
    
    /**
     * Compare two fingerprints
     */
    compareFingerprints(fpA, fpB) {
        // Build hash lookup for fpB
        const hashLookup = new Map();
        
        for (const entry of fpB.hashes) {
            const key = entry.hash;
            if (!hashLookup.has(key)) {
                hashLookup.set(key, []);
            }
            hashLookup.get(key).push(entry.time);
        }
        
        // Find matching hashes
        const offsetHistogram = new Map();
        let matchingHashes = 0;
        
        for (const entry of fpA.hashes) {
            if (hashLookup.has(entry.hash)) {
                matchingHashes++;
                
                // Calculate time offsets
                for (const targetTime of hashLookup.get(entry.hash)) {
                    const offset = targetTime - entry.time;
                    const roundedOffset = Math.round(offset);
                    
                    offsetHistogram.set(
                        roundedOffset,
                        (offsetHistogram.get(roundedOffset) || 0) + 1
                    );
                }
            }
        }
        
        // Find most common offset
        let bestOffset = 0;
        let bestCount = 0;
        
        for (const [offset, count] of offsetHistogram) {
            if (count > bestCount) {
                bestCount = count;
                bestOffset = offset;
            }
        }
        
        // Calculate score
        const maxPossible = Math.min(fpA.numHashes, fpB.numHashes);
        const score = maxPossible > 0 ? matchingHashes / maxPossible : 0;
        
        return {
            score,
            matchingHashes,
            offset: bestOffset,
            confidence: bestCount / Math.max(1, matchingHashes)
        };
    }
    
    /**
     * Generate fingerprint summary
     */
    generateSummary(fingerprint) {
        return {
            duration: fingerprint.duration.toFixed(2) + 's',
            peakCount: fingerprint.numPeaks,
            hashCount: fingerprint.numHashes,
            processingTime: fingerprint.processingTime.toFixed(2) + 'ms'
        };
    }
    
    /**
     * Export fingerprint
     */
    exportFingerprint(fingerprint) {
        return JSON.stringify({
            hashes: fingerprint.hashes,
            duration: fingerprint.duration,
            numPeaks: fingerprint.numPeaks,
            numHashes: fingerprint.numHashes,
            metadata: fingerprint.metadata,
            version: '1.0'
        });
    }
    
    /**
     * Import fingerprint
     */
    importFingerprint(jsonString, id, metadata = {}) {
        const data = JSON.parse(jsonString);
        const fingerprint = {
            hashes: data.hashes,
            duration: data.duration,
            numPeaks: data.numPeaks,
            numHashes: data.numHashes,
            metadata: { ...data.metadata, ...metadata },
            generatedAt: Date.now()
        };
        
        this.fingerprintDatabase.set(id, fingerprint);
        return fingerprint;
    }
    
    /**
     * Get match history
     */
    getHistory() {
        return [...this.matchHistory];
    }
    
    /**
     * Clear history
     */
    clearHistory() {
        this.matchHistory = [];
    }
}

// UI Panel
function openAudioFingerprintingPanel() {
    const existing = document.getElementById('audio-fingerprinting-panel');
    if (existing) {
        existing.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'audio-fingerprinting-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3b82f6;
        border-radius: 12px;
        padding: 24px;
        width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #3b82f6; font-size: 20px;">🔍 Audio Fingerprinting</h2>
            <button id="close-fingerprint-panel" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">×</button>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 16px;">
            Create audio fingerprints for identification and comparison. Uses spectral peak analysis to generate unique identifiers.
        </p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <button id="generate-fingerprint" style="padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                🎵 Generate Fingerprint
            </button>
            <button id="compare-audio" style="padding: 12px; background: #8b5cf6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                🔄 Compare Audio
            </button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <button id="add-to-database" style="padding: 12px; background: #10b981; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                💾 Add to Database
            </button>
            <button id="identify-audio" style="padding: 12px; background: #f59e0b; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                🎯 Identify Audio
            </button>
        </div>
        
        <div style="margin-bottom: 16px; padding: 12px; background: #0f172a; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #9ca3af; font-size: 12px;">Database Size: <span id="db-size">0</span> fingerprints</span>
                <button id="clear-database" style="padding: 4px 12px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    Clear
                </button>
            </div>
        </div>
        
        <div id="fingerprint-progress" style="display: none; background: #0a0a14; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span id="fingerprint-progress-text" style="color: #9ca3af; font-size: 12px;">Processing...</span>
            </div>
        </div>
        
        <div id="fingerprint-results" style="display: none;">
            <div id="result-summary" style="background: #0a0a14; border-radius: 6px; padding: 12px; margin-bottom: 12px;"></div>
            <div id="match-results" style="display: none; background: #0a0a14; border-radius: 6px; padding: 12px;"></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-fingerprint-panel').onclick = () => panel.remove();
    
    const fingerprinter = new AudioFingerprinting();
    
    const updateDbSize = () => {
        document.getElementById('db-size').textContent = fingerprinter.getDatabaseSize();
    };
    
    updateDbSize();
    
    document.getElementById('generate-fingerprint').onclick = async () => {
        const progressDiv = document.getElementById('fingerprint-progress');
        const progressText = document.getElementById('fingerprint-progress-text');
        const resultsDiv = document.getElementById('fingerprint-results');
        const summaryDiv = document.getElementById('result-summary');
        const matchDiv = document.getElementById('match-results');
        
        progressDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        progressText.textContent = 'Generating fingerprint...';
        
        const audioBuffer = window.getSelectedTrackAudio ? 
            await window.getSelectedTrackAudio() : null;
        
        if (!audioBuffer) {
            progressText.textContent = '❌ No audio selected';
            return;
        }
        
        setTimeout(() => {
            const fingerprint = fingerprinter.generateFingerprint(audioBuffer);
            const summary = fingerprinter.generateSummary(fingerprint);
            
            progressDiv.style.display = 'none';
            resultsDiv.style.display = 'block';
            matchDiv.style.display = 'none';
            
            summaryDiv.innerHTML = `
                <h3 style="margin: 0 0 8px; color: #10b981; font-size: 14px;">📊 Fingerprint Generated</h3>
                <div style="color: #d1d5db; font-size: 12px;">
                    <strong>Duration:</strong> ${summary.duration}<br>
                    <strong>Peaks Found:</strong> ${summary.peakCount}<br>
                    <strong>Hash Pairs:</strong> ${summary.hashCount}<br>
                    <strong>Processing Time:</strong> ${summary.processingTime}
                </div>
            `;
            
            // Store for later use
            window.currentFingerprint = fingerprint;
        }, 100);
    };
    
    document.getElementById('compare-audio').onclick = async () => {
        const progressDiv = document.getElementById('fingerprint-progress');
        const progressText = document.getElementById('fingerprint-progress-text');
        const resultsDiv = document.getElementById('fingerprint-results');
        const summaryDiv = document.getElementById('result-summary');
        const matchDiv = document.getElementById('match-results');
        
        progressDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        progressText.textContent = 'Comparing audio...';
        
        // For comparison, we'd need two audio buffers
        // Simplified: compare against database
        const audioBuffer = window.getSelectedTrackAudio ? 
            await window.getSelectedTrackAudio() : null;
        
        if (!audioBuffer) {
            progressText.textContent = '❌ No audio selected';
            return;
        }
        
        setTimeout(() => {
            if (fingerprinter.getDatabaseSize() === 0) {
                progressDiv.style.display = 'none';
                resultsDiv.style.display = 'block';
                matchDiv.style.display = 'none';
                summaryDiv.innerHTML = `
                    <span style="color: #fcd34d;">⚠️ Database is empty. Add fingerprints to compare.</span>
                `;
                return;
            }
            
            const result = fingerprinter.identify(audioBuffer);
            
            progressDiv.style.display = 'none';
            resultsDiv.style.display = 'block';
            matchDiv.style.display = 'block';
            
            summaryDiv.innerHTML = `
                <h3 style="margin: 0 0 8px; color: #8b5cf6; font-size: 14px;">🔄 Comparison Results</h3>
                <div style="color: #d1d5db; font-size: 12px;">
                    <strong>Total Matches:</strong> ${result.totalMatches}
                </div>
            `;
            
            if (result.matches.length > 0) {
                matchDiv.innerHTML = `
                    <h4 style="margin: 0 0 8px; color: #10b981; font-size: 12px;">Top Matches</h4>
                    ${result.matches.slice(0, 5).map((m, i) => `
                        <div style="padding: 8px; background: #1f2937; border-radius: 4px; margin-bottom: 4px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: #d1d5db; font-size: 11px;">${m.id}</span>
                                <span style="color: ${i === 0 ? '#10b981' : '#9ca3af'}; font-size: 11px;">${(m.score * 100).toFixed(1)}% match</span>
                            </div>
                        </div>
                    `).join('')}
                `;
            } else {
                matchDiv.innerHTML = `<span style="color: #fcd34d; font-size: 11px;">No matches found</span>`;
            }
        }, 100);
    };
    
    document.getElementById('add-to-database').onclick = async () => {
        const progressDiv = document.getElementById('fingerprint-progress');
        const progressText = document.getElementById('fingerprint-progress-text');
        
        const audioBuffer = window.getSelectedTrackAudio ? 
            await window.getSelectedTrackAudio() : null;
        
        if (!audioBuffer) {
            progressDiv.style.display = 'block';
            progressText.textContent = '❌ No audio selected';
            setTimeout(() => progressDiv.style.display = 'none', 2000);
            return;
        }
        
        const id = `audio_${Date.now()}`;
        const metadata = {
            addedAt: new Date().toISOString(),
            duration: audioBuffer.duration
        };
        
        progressDiv.style.display = 'block';
        progressText.textContent = 'Adding to database...';
        
        setTimeout(() => {
            fingerprinter.addToDatabase(id, audioBuffer, metadata);
            updateDbSize();
            progressText.textContent = '✅ Added to database!';
            setTimeout(() => progressDiv.style.display = 'none', 1500);
        }, 100);
    };
    
    document.getElementById('identify-audio').onclick = async () => {
        // Same as compare
        document.getElementById('compare-audio').click();
    };
    
    document.getElementById('clear-database').onclick = () => {
        if (confirm('Clear fingerprint database?')) {
            fingerprinter.clearDatabase();
            updateDbSize();
        }
    };
}

// Export
window.AudioFingerprinting = AudioFingerprinting;
window.openAudioFingerprintingPanel = openAudioFingerprintingPanel;

console.log('[AudioFingerprinting] Module loaded');
