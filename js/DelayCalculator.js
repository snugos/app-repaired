/**
 * DelayCalculator - Calculate delay times from BPM
 * Provides note-length delay times for creating delay-locked effects
 */
window.DelayCalculator = (function() {
    const NOTE_DIVISIONS = {
        '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125,
        '1/4T': 1/1.5, '1/8T': 0.5/1.5, '1/16T': 0.25/1.5, '1/32T': 0.125/1.5,
        '1/4.': 1*1.5, '1/8.': 0.5*1.5, '1/16.': 0.25*1.5, '1/32.': 0.125*1.5,
        '1/1D': 4*1.5, '1/2D': 2*1.5, '1/4D': 1*1.5, '1/8D': 0.5*1.5, '1/16D': 0.25*1.5
    };

    let currentBpm = 120;

    function msToSamples(ms, sampleRate = 44100) {
        return Math.round(ms * sampleRate / 1000);
    }

    function calculateMs(divisions, bpm) {
        const quarterNoteMs = 60000 / bpm;
        return quarterNoteMs * divisions;
    }

    function calculateNoteDelay(division, bpm = currentBpm) {
        const mult = NOTE_DIVISIONS[division] || 1;
        return calculateMs(mult, bpm);
    }

    function calculateAllDelays(bpm = currentBpm) {
        const result = {};
        for (const note in NOTE_DIVISIONS) {
            result[note] = {
                ms: Math.round(calculateNoteDelay(note, bpm) * 100) / 100,
                samples: msToSamples(calculateNoteDelay(note, bpm))
            };
        }
        return result;
    }

    function setBpm(bpm) {
        currentBpm = Math.max(20, Math.min(999, bpm));
        return currentBpm;
    }

    function getBpm() { return currentBpm; }

    function syncToTransport() {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            currentBpm = Tone.Transport.bpm.value;
        }
        return currentBpm;
    }

    function formatDelay(ms) {
        return `${ms.toFixed(2)} ms`;
    }

    function openDelayCalculatorPanel() {
        syncToTransport();
        const existing = document.getElementById('delayCalculatorPanel');
        if (existing) { existing.remove(); }

        const delays = calculateAllDelays();
        const rows = Object.entries(delays).map(([note, data]) =>
            `<tr><td class="delay-note">${note}</td><td>${formatDelay(data.ms)}</td><td class="delay-samples">${data.samples}</td></tr>`
        ).join('');

        const panel = document.createElement('div');
        panel.id = 'delayCalculatorPanel';
        panel.innerHTML = `
            <div class="snug-window" style="position:fixed;top:80px;right:20px;width:320px;z-index:10000;background:#1a1a2e;border:1px solid #333;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
                <div class="snug-titlebar" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#16213e;border-bottom:1px solid #333;border-radius:8px 8px 0 0">
                    <span style="color:#e94560;font-weight:bold">Delay Calculator</span>
                    <button onclick="document.getElementById('delayCalculatorPanel').remove()" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px">×</button>
                </div>
                <div style="padding:12px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                        <label style="color:#ccc;font-size:12px">BPM:</label>
                        <input type="number" id="delayBpmInput" value="${currentBpm}" min="20" max="999" style="width:70px;background:#0f0f23;color:#fff;border:1px solid #333;border-radius:4px;padding:4px 8px">
                        <button onclick="DelayCalculator.addBpm(-1)" style="background:#333;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer">-</button>
                        <button onclick="DelayCalculator.addBpm(1)" style="background:#333;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer">+</button>
                        <button onclick="DelayCalculator.syncToTransport()" style="background:#e94560;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:10px">SYNC</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:11px">
                        <tr style="color:#888;border-bottom:1px solid #333"><th style="text-align:left;padding:4px">Note</th><th style="text-align:right;padding:4px">Time</th><th style="text-align:right;padding:4px">Samples</th></tr>
                        ${rows}
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        document.getElementById('delayBpmInput').addEventListener('change', (e) => {
            setBpm(parseInt(e.target.value) || 120);
            openDelayCalculatorPanel();
        });
    }

    return { calculateNoteDelay, calculateAllDelays, setBpm, getBpm, syncToTransport, addBpm: (n) => { setBpm(currentBpm + n); openDelayCalculatorPanel(); }, openDelayCalculatorPanel };
})();
