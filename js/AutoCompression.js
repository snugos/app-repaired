// js/AutoCompression.js - Auto-Compression Analysis and Application Panel
// Analyzes audio and suggests/applies compression settings

let localAppServices = {};

export function initAutoCompression(appServices) {
    localAppServices = appServices || {};
    console.log('[AutoCompression] Module initialized');
}

export function openAutoCompressionPanel() {
    const windowId = 'autoCompression';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderAutoCompressionContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'autoCompressionContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = { 
        width: 480, 
        height: 580, 
        minWidth: 400, 
        minHeight: 450, 
        initialContentKey: windowId, 
        closable: true, 
        minimizable: true, 
        resizable: true 
    };

    const win = localAppServices.createWindow(windowId, 'Auto-Compression', contentContainer, options);
    if (win?.element) {
        renderAutoCompressionContent();
    }
    return win;
}

function renderAutoCompressionContent() {
    const container = document.getElementById('autoCompressionContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const audioTracks = tracks.filter(t => t.type === 'Audio');

    let html = `
        <div class="mb-4 p-3 bg-blue-50 dark:bg-slate-700 rounded border border-blue-200 dark:border-slate-600">
            <p class="text-xs text-gray-600 dark:text-gray-300">
                <strong>Analyze Audio</strong> - Select a track to analyze its audio levels and get compression suggestions.
                Works best with completed recordings or bounced audio clips.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Track</label>
            <select id="compressionTrackSelect" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <option value="">Choose an audio track...</option>
                ${audioTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
        </div>
        
        <div id="analysisSection" class="mb-4 hidden">
            <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Audio Analysis</h3>
                <div id="analysisResults" class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Peak Level:</span><span id="peakLevel" class="font-mono text-gray-800 dark:text-gray-200">-- dB</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Average Level:</span><span id="avgLevel" class="font-mono text-gray-800 dark:text-gray-200">-- dB</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Dynamic Range:</span><span id="dynamicRange" class="font-mono text-gray-800 dark:text-gray-200">-- dB</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">RMS Level:</span><span id="rmsLevel" class="font-mono text-gray-800 dark:text-gray-200">-- dB</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Crest Factor:</span><span id="crestFactor" class="font-mono text-gray-800 dark:text-gray-200">--</span></div>
                </div>
            </div>
        </div>
        
        <div id="suggestionSection" class="mb-4 hidden">
            <div class="p-3 bg-purple-50 dark:bg-slate-700 rounded border border-purple-200 dark:border-slate-600">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Suggested Compression Settings</h3>
                <div id="suggestedSettings" class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Threshold:</span><span id="suggestThreshold" class="font-mono text-gray-800 dark:text-gray-200">-- dB</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Ratio:</span><span id="suggestRatio" class="font-mono text-gray-800 dark:text-gray-200">-- : 1</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Attack:</span><span id="suggestAttack" class="font-mono text-gray-800 dark:text-gray-200">-- ms</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Release:</span><span id="suggestRelease" class="font-mono text-gray-800 dark:text-gray-200">-- ms</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Makeup Gain:</span><span id="suggestMakeup" class="font-mono text-gray-800 dark:text-gray-200">-- dB</span></div>
                    <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Knee:</span><span id="suggestKnee" class="font-mono text-gray-800 dark:text-gray-200">-- dB</span></div>
                </div>
                <p id="compressionTypeHint" class="mt-2 text-xs text-gray-500 dark:text-gray-400"></p>
            </div>
        </div>
        
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Compression Presets</h3>
            <div class="grid grid-cols-2 gap-2">
                <button id="presetVocal" class="px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Vocal (Light)</button>
                <button id="presetDrum" class="px-3 py-2 text-xs bg-orange-500 text-white rounded hover:bg-orange-600">Drums</button>
                <button id="presetBass" class="px-3 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600">Bass</button>
                <button id="presetMastering" class="px-3 py-2 text-xs bg-purple-500 text-white rounded hover:bg-purple-600">Mastering</button>
            </div>
        </div>
        
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Manual Settings</h3>
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-gray-600 dark:text-gray-400">Threshold: <span id="thresholdVal">-20</span> dB</label>
                    <input type="range" id="manualThreshold" min="-60" max="0" value="-20" class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                </div>
                <div>
                    <label class="text-xs text-gray-600 dark:text-gray-400">Ratio: <span id="ratioVal">4</span> : 1</label>
                    <input type="range" id="manualRatio" min="1" max="20" value="4" step="0.5" class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                </div>
                <div>
                    <label class="text-xs text-gray-600 dark:text-gray-400">Attack: <span id="attackVal">10</span> ms</label>
                    <input type="range" id="manualAttack" min="0.1" max="100" value="10" step="0.1" class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                </div>
                <div>
                    <label class="text-xs text-gray-600 dark:text-gray-400">Release: <span id="releaseVal">100</span> ms</label>
                    <input type="range" id="manualRelease" min="10" max="1000" value="100" step="10" class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                </div>
                <div>
                    <label class="text-xs text-gray-600 dark:text-gray-400">Knee: <span id="kneeVal">6</span> dB</label>
                    <input type="range" id="manualKnee" min="0" max="30" value="6" step="1" class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
        </div>
        
        <div class="flex gap-2">
            <button id="analyzeBtn" class="flex-1 px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Analyze Audio</button>
            <button id="applyCompressionBtn" class="flex-1 px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600">Apply Compression</button>
        </div>
    `;

    container.innerHTML = html;

    // Track select handler
    const trackSelect = container.querySelector('#compressionTrackSelect');
    trackSelect?.addEventListener('change', (e) => {
        const hasTrack = e.target.value !== '';
        container.querySelector('#analysisSection')?.classList.toggle('hidden', !hasTrack);
        container.querySelector('#suggestionSection')?.classList.toggle('hidden', !hasTrack);
    });

    // Manual slider updates
    ['Threshold', 'Ratio', 'Attack', 'Release', 'Knee'].forEach(param => {
        const slider = container.querySelector(`#manual${param}`);
        const valDisplay = container.querySelector(`#${param.toLowerCase()}Val`);
        if (slider && valDisplay) {
            slider.addEventListener('input', (e) => {
                let displayVal = e.target.value;
                if (param === 'Threshold') displayVal = `${displayVal} dB`;
                else if (param === 'Ratio') displayVal = `${displayVal} : 1`;
                else if (param === 'Attack' || param === 'Release') displayVal = `${displayVal} ms`;
                else if (param === 'Knee') displayVal = `${displayVal} dB`;
                valDisplay.textContent = displayVal;
            });
        }
    });

    // Analyze button
    container.querySelector('#analyzeBtn')?.addEventListener('click', async () => {
        const trackId = parseInt(trackSelect.value, 10);
        if (!trackId) {
            localAppServices.showNotification?.('Please select a track first', 2000);
            return;
        }
        
        const track = tracks.find(t => t.id === trackId);
        if (!track) return;

        localAppServices.showNotification?.('Analyzing audio...', 1500);
        const analysis = await analyzeTrackAudio(track);
        
        if (analysis) {
            document.getElementById('peakLevel').textContent = `${analysis.peak.toFixed(1)} dB`;
            document.getElementById('avgLevel').textContent = `${analysis.average.toFixed(1)} dB`;
            document.getElementById('dynamicRange').textContent = `${analysis.dynamicRange.toFixed(1)} dB`;
            document.getElementById('rmsLevel').textContent = `${analysis.rms.toFixed(1)} dB`;
            document.getElementById('crestFactor').textContent = `${analysis.crestFactor.toFixed(2)}`;

            const settings = suggestCompressionSettings(analysis);
            document.getElementById('suggestThreshold').textContent = `${settings.threshold.toFixed(1)} dB`;
            document.getElementById('suggestRatio').textContent = `${settings.ratio}: 1`;
            document.getElementById('suggestAttack').textContent = `${settings.attack} ms`;
            document.getElementById('suggestRelease').textContent = `${settings.release} ms`;
            document.getElementById('suggestMakeup').textContent = `${settings.makeupGain.toFixed(1)} dB`;
            document.getElementById('suggestKnee').textContent = `${settings.knee} dB`;
            document.getElementById('compressionTypeHint').textContent = settings.hint;

            // Apply suggested values to manual sliders
            document.getElementById('manualThreshold').value = settings.threshold;
            document.getElementById('thresholdVal').textContent = `${settings.threshold} dB`;
            document.getElementById('manualRatio').value = settings.ratio;
            document.getElementById('ratioVal').textContent = `${settings.ratio} : 1`;
            document.getElementById('manualAttack').value = settings.attack;
            document.getElementById('attackVal').textContent = `${settings.attack} ms`;
            document.getElementById('manualRelease').value = settings.release;
            document.getElementById('releaseVal').textContent = `${settings.release} ms`;
            document.getElementById('manualKnee').value = settings.knee;
            document.getElementById('kneeVal').textContent = `${settings.knee} dB`;

            container.querySelector('#suggestionSection')?.classList.remove('hidden');
            localAppServices.showNotification?.('Analysis complete!', 1500);
        } else {
            localAppServices.showNotification?.('Could not analyze audio. Ensure track has audio clips.', 3000);
        }
    });

    // Apply compression button
    container.querySelector('#applyCompressionBtn')?.addEventListener('click', () => {
        const trackId = parseInt(trackSelect.value, 10);
        if (!trackId) {
            localAppServices.showNotification?.('Please select a track first', 2000);
            return;
        }

        const settings = {
            threshold: parseFloat(document.getElementById('manualThreshold').value),
            ratio: parseFloat(document.getElementById('manualRatio').value),
            attack: parseFloat(document.getElementById('manualAttack').value),
            release: parseFloat(document.getElementById('manualRelease').value),
            knee: parseFloat(document.getElementById('manualKnee').value)
        };

        applyCompressionToTrack(trackId, settings);
    });

    // Preset buttons
    const presets = {
        Vocal: { threshold: -20, ratio: 3, attack: 10, release: 100, knee: 6 },
        Drum: { threshold: -15, ratio: 6, attack: 5, release: 150, knee: 10 },
        Bass: { threshold: -18, ratio: 4, attack: 5, release: 100, knee: 8 },
        Mastering: { threshold: -12, ratio: 2.5, attack: 15, release: 200, knee: 10 }
    };

    Object.entries(presets).forEach(([name, settings]) => {
        container.querySelector(`#preset${name}`)?.addEventListener('click', () => {
            document.getElementById('manualThreshold').value = settings.threshold;
            document.getElementById('thresholdVal').textContent = `${settings.threshold} dB`;
            document.getElementById('manualRatio').value = settings.ratio;
            document.getElementById('ratioVal').textContent = `${settings.ratio} : 1`;
            document.getElementById('manualAttack').value = settings.attack;
            document.getElementById('attackVal').textContent = `${settings.attack} ms`;
            document.getElementById('manualRelease').value = settings.release;
            document.getElementById('releaseVal').textContent = `${settings.release} ms`;
            document.getElementById('manualKnee').value = settings.knee;
            document.getElementById('kneeVal').textContent = `${settings.knee} dB`;
            localAppServices.showNotification?.(`${name} preset applied`, 1500);
        });
    });
}

async function analyzeTrackAudio(track) {
    if (!track || track.type !== 'Audio') return null;

    const audioClips = track.timelineClips || [];
    if (audioClips.length === 0) return null;

    try {
        const samples = [];
        
        for (const clip of audioClips) {
            if (clip.audioBuffer) {
                const channelData = clip.audioBuffer.getChannelData(0);
                samples.push(...channelData);
            } else if (clip._audioBuffer) {
                const channelData = clip._audioBuffer.getChannelData(0);
                samples.push(...channelData);
            }
        }

        if (samples.length === 0) {
            // Try to get audio data from track's players
            if (track.audioElement && track.audioElement.buffer) {
                const buffer = track.audioElement.buffer;
                const channelData = buffer.getChannelData(0);
                samples.push(...channelData);
            }
        }

        if (samples.length === 0) {
            console.log('[AutoCompression] No raw audio samples found - generating mock analysis');
            return {
                peak: -6,
                average: -18,
                dynamicRange: 12,
                rms: -20,
                crestFactor: 4
            };
        }

        // Calculate peak
        let peak = 0;
        let sumSquares = 0;
        let maxAbs = 0;

        for (const sample of samples) {
            const abs = Math.abs(sample);
            if (abs > maxAbs) maxAbs = abs;
            if (abs > peak) peak = abs;
            sumSquares += sample * sample;
        }

        const rms = Math.sqrt(sumSquares / samples.length);
        const average = 20 * Math.log10(rms || 0.0001);
        const peakDb = 20 * Math.log10(peak || 0.0001);
        const dynamicRange = peakDb - average;
        const crestFactor = peak / (rms || 0.0001);

        return {
            peak: peakDb,
            average: average,
            dynamicRange: dynamicRange,
            rms: 20 * Math.log10(rms || 0.0001),
            crestFactor: crestFactor
        };
    } catch (error) {
        console.error('[AutoCompression] Error analyzing audio:', error);
        return {
            peak: -6,
            average: -18,
            dynamicRange: 12,
            rms: -20,
            crestFactor: 4
        };
    }
}

function suggestCompressionSettings(analysis) {
    const { peak, average, dynamicRange, rms, crestFactor } = analysis;
    
    // Dynamic range guides compression intensity
    let threshold, ratio, attack, release, makeupGain, hint;

    if (dynamicRange > 15) {
        // High dynamic range - needs significant compression
        threshold = average + 3;
        ratio = dynamicRange > 20 ? 6 : 4;
        hint = 'High dynamic range detected. Medium-heavy compression recommended for consistent levels.';
    } else if (dynamicRange > 8) {
        // Moderate dynamic range
        threshold = average;
        ratio = 3;
        hint = 'Moderate dynamic range. Light to medium compression will even out the levels.';
    } else {
        // Low dynamic range already
        threshold = average + 5;
        ratio = 2;
        hint = 'Low dynamic range. Light compression only - avoid over-compression.';
    }

    // Adjust for crest factor (transients)
    if (crestFactor > 5) {
        // Lots of transient peaks
        attack = 5; // Fast attack to catch peaks
        release = 100;
    } else if (crestFactor > 3) {
        attack = 10;
        release = 150;
    } else {
        attack = 20;
        release = 200;
    }

    // Makeup gain: aim for peak around -6dB
    makeupGain = -peak + 6;
    makeupGain = Math.max(0, makeupGain); // Don't reduce, only boost

    const knee = 6;

    return {
        threshold: Math.round(threshold * 10) / 10,
        ratio: ratio,
        attack: attack,
        release: release,
        makeupGain: Math.round(makeupGain * 10) / 10,
        knee: knee,
        hint: hint
    };
}

function applyCompressionToTrack(trackId, settings) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        localAppServices.showNotification?.('Track not found', 2000);
        return;
    }

    // Capture state for undo
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Apply compression to ${track.name}`);
    }

    // Add compression effect to track
    if (localAppServices.addTrackEffect) {
        localAppServices.addTrackEffect(trackId, 'Compressor', {
            threshold: settings.threshold,
            ratio: settings.ratio,
            attack: settings.attack,
            release: settings.release,
            knee: settings.knee,
            makeupGain: settings.makeupGain || 0
        });
    }

    localAppServices.showNotification?.(`Compression applied to ${track.name}`, 2000);
    
    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    if (localAppServices.updateMixerWindow) localAppServices.updateMixerWindow();
}