// js/ClipEnvelopeShaper.js - Draw custom amplitude envelopes on clips for precise dynamics control

let envelopeEditorWindow = null;
let currentEditClip = null;
let envelopePoints = []; // { time: 0-1, value: 0-1 }
let isDraggingPoint = false;
let dragPointIndex = -1;

export function showClipEnvelopeShaper(clip, clipData) {
    if (!clip) return;
    
    currentEditClip = clip;
    envelopePoints = [];
    
    // Parse existing envelope from clip data, or create default linear
    if (clipData && clipData.envelope && Array.isArray(clipData.envelope.points)) {
        envelopePoints = JSON.parse(JSON.stringify(clipData.envelope.points));
    } else {
        // Default: full amplitude (linear)
        envelopePoints = [
            { time: 0, value: 1 },
            { time: 1, value: 1 }
        ];
    }
    
    // Create or show envelope editor window
    if (!envelopeEditorWindow || envelopeEditorWindow.closed) {
        createEnvelopeEditorWindow();
    } else {
        envelopeEditorWindow.focus();
    }
    
    renderEnvelopeCanvas();
}

function createEnvelopeEditorWindow() {
    envelopeEditorWindow = window.open('', '_blank', 'width=600,height=400,resizable=yes');
    if (!envelopeEditorWindow) {
        console.warn('[ClipEnvelopeShaper] Could not open window');
        return;
    }
    
    envelopeEditorWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <title>Clip Envelope Shaper</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1a1a2e; color: #eee; font-family: system-ui, sans-serif; padding: 16px; height: 100vh; display: flex; flex-direction: column; }
        h2 { font-size: 16px; margin-bottom: 12px; color: #a0a0ff; }
        .canvas-container { flex: 1; position: relative; background: #0f0f1a; border: 1px solid #333; border-radius: 6px; overflow: hidden; min-height: 200px; }
        canvas { width: 100%; height: 100%; display: block; cursor: crosshair; }
        .controls { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
        button { padding: 8px 16px; background: #3a3a5c; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
        button:hover { background: #4a4a7c; }
        button.primary { background: #6366f1; }
        button.primary:hover { background: #7c7ff2; }
        button.danger { background: #dc2626; }
        button.danger:hover { background: #ef4444; }
        select { padding: 8px 12px; background: #2a2a4a; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 13px; }
        .info { font-size: 12px; color: #888; margin-top: 8px; }
        .presets { display: flex; gap: 6px; align-items: center; }
    </style>
</head>
<body>
    <h2>Clip Envelope Shaper</h2>
    <div class="canvas-container">
        <canvas id="envelopeCanvas"></canvas>
    </div>
    <div class="controls">
        <div class="presets">
            <label style="font-size:13px">Preset:</label>
            <select id="envelopePreset">
                <option value="linear">Linear</option>
                <option value="fadeIn">Fade In</option>
                <option value="fadeOut">Fade Out</option>
                <option value="fadeInOut">Fade In/Out</option>
                <option value="exponential">Exponential</option>
                <option value="sCurve">S-Curve</option>
                <option value="punch">Punch (Attack)</option>
            </select>
        </div>
        <button id="applyPresetBtn">Apply Preset</button>
        <button id="addPointBtn" class="primary">Add Point</button>
        <button id="removePointBtn" class="danger">Remove Point</button>
        <button id="resetBtn">Reset</button>
        <button id="applyBtn" class="primary">Apply to Clip</button>
        <button id="cancelBtn">Cancel</button>
    </div>
    <p class="info">Click on the envelope line to add control points. Drag points to adjust. Double-click a point to remove it.</p>
    <script>
        // Communication with parent window
        const canvas = document.getElementById('envelopeCanvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Point state
        let points = JSON.parse('${JSON.stringify(envelopePoints)}');
        let selectedPointIndex = -1;
        let isDragging = false;
        
        function renderEnvelope() {
            const w = canvas.width / window.devicePixelRatio;
            const h = canvas.height / window.devicePixelRatio;
            ctx.clearRect(0, 0, w, h);
            
            // Grid
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const y = (h / 4) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            
            // Envelope fill
            ctx.beginPath();
            ctx.moveTo(0, h);
            points.forEach((p, i) => {
                const x = p.time * w;
                const y = h - (p.value * h);
                if (i === 0) ctx.lineTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
            ctx.fill();
            
            // Envelope line
            ctx.beginPath();
            points.forEach((p, i) => {
                const x = p.time * w;
                const y = h - (p.value * h);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Points
            points.forEach((p, i) => {
                const x = p.time * w;
                const y = h - (p.value * h);
                ctx.beginPath();
                ctx.arc(x, y, i === selectedPointIndex ? 8 : 6, 0, Math.PI * 2);
                ctx.fillStyle = i === selectedPointIndex ? '#a0a0ff' : '#6366f1';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        }
        
        function getPointAt(x, y) {
            const w = canvas.width / window.devicePixelRatio;
            const h = canvas.height / window.devicePixelRatio;
            const threshold = 15;
            for (let i = points.length - 1; i >= 0; i--) {
                const px = points[i].time * w;
                const py = h - (points[i].value * h);
                const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
                if (dist < threshold) return i;
            }
            return -1;
        }
        
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const idx = getPointAt(x, y);
            if (idx >= 0) {
                selectedPointIndex = idx;
                isDragging = true;
            }
            renderEnvelope();
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging || selectedPointIndex < 0) return;
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
            points[selectedPointIndex] = { time: x, value: y };
            // Notify parent
            if (window.opener && window.opener.updateEnvelopePoints) {
                window.opener.updateEnvelopePoints(points);
            }
            renderEnvelope();
        });
        
        canvas.addEventListener('mouseup', () => { isDragging = false; });
        canvas.addEventListener('mouseleave', () => { isDragging = false; });
        
        canvas.addEventListener('dblclick', (e) => {
            if (points.length <= 2) return; // Keep at least 2 points
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const idx = getPointAt(x, y);
            if (idx >= 0) {
                points.splice(idx, 1);
                selectedPointIndex = -1;
                if (window.opener && window.opener.updateEnvelopePoints) {
                    window.opener.updateEnvelopePoints(points);
                }
                renderEnvelope();
            }
        });
        
        // Preset application
        function applyPreset(preset) {
            switch (preset) {
                case 'linear':
                    points = [{ time: 0, value: 1 }, { time: 1, value: 1 }];
                    break;
                case 'fadeIn':
                    points = [{ time: 0, value: 0 }, { time: 1, value: 1 }];
                    break;
                case 'fadeOut':
                    points = [{ time: 0, value: 1 }, { time: 1, value: 0 }];
                    break;
                case 'fadeInOut':
                    points = [{ time: 0, value: 0 }, { time: 0.5, value: 1 }, { time: 1, value: 0 }];
                    break;
                case 'exponential':
                    points = [
                        { time: 0, value: 0.1 },
                        { time: 0.3, value: 0.5 },
                        { time: 0.6, value: 0.85 },
                        { time: 1, value: 1 }
                    ];
                    break;
                case 'sCurve':
                    points = [
                        { time: 0, value: 0 },
                        { time: 0.25, value: 0.35 },
                        { time: 0.5, value: 0.5 },
                        { time: 0.75, value: 0.65 },
                        { time: 1, value: 1 }
                    ];
                    break;
                case 'punch':
                    points = [
                        { time: 0, value: 1 },
                        { time: 0.15, value: 0.6 },
                        { time: 0.4, value: 0.9 },
                        { time: 1, value: 1 }
                    ];
                    break;
            }
            selectedPointIndex = -1;
            if (window.opener && window.opener.updateEnvelopePoints) {
                window.opener.updateEnvelopePoints(points);
            }
            renderEnvelope();
        }
        
        document.getElementById('applyPresetBtn').addEventListener('click', () => {
            const preset = document.getElementById('envelopePreset').value;
            applyPreset(preset);
        });
        
        document.getElementById('addPointBtn').addEventListener('click', () => {
            // Add point in the middle
            const midTime = 0.5;
            const midValue = 0.5;
            points.push({ time: midTime, value: midValue });
            points.sort((a, b) => a.time - b.time);
            if (window.opener && window.opener.updateEnvelopePoints) {
                window.opener.updateEnvelopePoints(points);
            }
            renderEnvelope();
        });
        
        document.getElementById('removePointBtn').addEventListener('click', () => {
            if (selectedPointIndex >= 0 && points.length > 2) {
                points.splice(selectedPointIndex, 1);
                selectedPointIndex = -1;
                if (window.opener && window.opener.updateEnvelopePoints) {
                    window.opener.updateEnvelopePoints(points);
                }
                renderEnvelope();
            }
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            applyPreset('linear');
        });
        
        document.getElementById('applyBtn').addEventListener('click', () => {
            if (window.opener && window.opener.applyClipEnvelope) {
                window.opener.applyClipEnvelope(points);
            }
            window.close();
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            window.close();
        });
        
        // Initial render
        renderEnvelope();
    </script>
</body>
</html>
    `);
    envelopeEditorWindow.document.close();
}

export function updateEnvelopePoints(points) {
    envelopePoints = points;
}

export function applyClipEnvelope(clipId, points) {
    if (!clipId || !points) return;
    // Apply envelope to clip - this would integrate with the clip's audio processing
    console.log(`[ClipEnvelopeShaper] Applying envelope with ${points.length} points to clip ${clipId}`);
    
    // Dispatch event for clip system to handle
    window.dispatchEvent(new CustomEvent('clipEnvelopeApplied', {
        detail: { clipId, points }
    }));
}

export function hasClipEnvelopeShaper() {
    return true;
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (envelopeEditorWindow && !envelopeEditorWindow.closed) {
        envelopeEditorWindow.close();
    }
});
