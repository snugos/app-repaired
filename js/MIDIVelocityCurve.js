/**
 * MIDI Velocity Curve
 * Apply custom velocity curves to MIDI input for expressive performance
 */

export class MIDIVelocityCurve {
    constructor() {
        this.curvePoints = [
            { input: 0, output: 0 },
            { input: 64, output: 64 },
            { input: 127, output: 127 }
        ];
        this.curveType = 'linear'; // linear, exponential, logarithmic, s-curve, custom
        this.inputScale = 1.0;
        this.outputScale = 1.0;
        this.minOutput = 1;
        this.maxOutput = 127;
        this.isEnabled = false;
        
        // Curve presets
        this.presets = MIDIVelocityCurve.getPresets();
    }

    /**
     * Get built-in curve presets
     */
    static getPresets() {
        return [
            {
                name: 'Linear',
                curveType: 'linear',
                curvePoints: [
                    { input: 0, output: 0 },
                    { input: 127, output: 127 }
                ]
            },
            {
                name: 'Soft (Light Touch)',
                curveType: 'logarithmic',
                curvePoints: [
                    { input: 0, output: 0 },
                    { input: 64, output: 90 },
                    { input: 127, output: 127 }
                ]
            },
            {
                name: 'Hard (Heavy Touch)',
                curveType: 'exponential',
                curvePoints: [
                    { input: 0, output: 0 },
                    { input: 64, output: 40 },
                    { input: 127, output: 127 }
                ]
            },
            {
                name: 'S-Curve (Dynamic)',
                curveType: 's-curve',
                curvePoints: [
                    { input: 0, output: 0 },
                    { input: 32, output: 20 },
                    { input: 64, output: 64 },
                    { input: 96, output: 107 },
                    { input: 127, output: 127 }
                ]
            },
            {
                name: 'Fixed Velocity',
                curveType: 'fixed',
                curvePoints: [
                    { input: 0, output: 80 },
                    { input: 127, output: 80 }
                ]
            },
            {
                name: 'Narrow Range',
                curveType: 'linear',
                curvePoints: [
                    { input: 0, output: 40 },
                    { input: 127, output: 100 }
                ]
            },
            {
                name: 'Piano (PP-FF)',
                curveType: 'exponential',
                curvePoints: [
                    { input: 0, output: 10 },
                    { input: 32, output: 25 },
                    { input: 64, output: 50 },
                    { input: 96, output: 85 },
                    { input: 127, output: 127 }
                ]
            },
            {
                name: 'Fortissimo Emphasis',
                curveType: 'logarithmic',
                curvePoints: [
                    { input: 0, output: 0 },
                    { input: 64, output: 70 },
                    { input: 96, output: 100 },
                    { input: 127, output: 127 }
                ]
            },
            {
                name: 'Compressed',
                curveType: 's-curve',
                curvePoints: [
                    { input: 0, output: 30 },
                    { input: 64, output: 64 },
                    { input: 127, output: 100 }
                ]
            },
            {
                name: 'Wide Dynamic',
                curveType: 'custom',
                curvePoints: [
                    { input: 0, output: 1 },
                    { input: 16, output: 5 },
                    { input: 32, output: 15 },
                    { input: 48, output: 30 },
                    { input: 64, output: 50 },
                    { input: 80, output: 75 },
                    { input: 96, output: 100 },
                    { input: 112, output: 120 },
                    { input: 127, output: 127 }
                ]
            }
        ];
    }

    /**
     * Apply the velocity curve to a MIDI velocity value
     */
    apply(velocity) {
        if (!this.isEnabled) {
            return Math.round(velocity);
        }
        
        // Clamp input
        const input = Math.max(0, Math.min(127, velocity));
        
        // Find the curve segment
        let output = input;
        
        switch (this.curveType) {
            case 'linear':
                output = this._applyLinear(input);
                break;
            case 'exponential':
                output = this._applyExponential(input);
                break;
            case 'logarithmic':
                output = this._applyLogarithmic(input);
                break;
            case 's-curve':
                output = this._applySCurve(input);
                break;
            case 'fixed':
                output = this.curvePoints[0]?.output ?? 80;
                break;
            case 'custom':
            default:
                output = this._applyCustomCurve(input);
                break;
        }
        
        // Apply scaling
        output = output * this.outputScale;
        
        // Clamp output
        return Math.round(Math.max(this.minOutput, Math.min(this.maxOutput, output)));
    }

    /**
     * Apply linear interpolation
     */
    _applyLinear(input) {
        return this._interpolate(input);
    }

    /**
     * Apply exponential curve (harder to reach high velocities)
     */
    _applyExponential(input) {
        const normalized = input / 127;
        const curved = Math.pow(normalized, 2); // Quadratic
        return curved * 127;
    }

    /**
     * Apply logarithmic curve (easier to reach high velocities)
     */
    _applyLogarithmic(input) {
        const normalized = input / 127;
        const curved = Math.log(1 + normalized * 9) / Math.log(10);
        return curved * 127;
    }

    /**
     * Apply S-curve (sigmoid-like)
     */
    _applySCurve(input) {
        const normalized = input / 127;
        const k = 5; // Steepness
        const curved = 1 / (1 + Math.exp(-k * (normalized - 0.5)));
        return curved * 127;
    }

    /**
     * Apply custom curve using interpolation between points
     */
    _applyCustomCurve(input) {
        return this._interpolate(input);
    }

    /**
     * Interpolate between curve points
     */
    _interpolate(input) {
        const points = this.curvePoints.sort((a, b) => a.input - b.input);
        
        // Find surrounding points
        let lower = points[0];
        let upper = points[points.length - 1];
        
        for (let i = 0; i < points.length - 1; i++) {
            if (input >= points[i].input && input <= points[i + 1].input) {
                lower = points[i];
                upper = points[i + 1];
                break;
            }
        }
        
        // Linear interpolation
        if (lower.input === upper.input) {
            return lower.output;
        }
        
        const t = (input - lower.input) / (upper.input - lower.input);
        return lower.output + t * (upper.output - lower.output);
    }

    /**
     * Set curve type
     */
    setCurveType(type) {
        if (['linear', 'exponential', 'logarithmic', 's-curve', 'fixed', 'custom'].includes(type)) {
            this.curveType = type;
        }
    }

    /**
     * Set custom curve points
     */
    setCurvePoints(points) {
        this.curvePoints = points.map(p => ({
            input: Math.max(0, Math.min(127, p.input)),
            output: Math.max(0, Math.min(127, p.output))
        }));
        this.curveType = 'custom';
    }

    /**
     * Add a curve point
     */
    addCurvePoint(input, output) {
        this.curvePoints.push({
            input: Math.max(0, Math.min(127, input)),
            output: Math.max(0, Math.min(127, output))
        });
        this.curvePoints.sort((a, b) => a.input - b.input);
        this.curveType = 'custom';
    }

    /**
     * Remove a curve point by index
     */
    removeCurvePoint(index) {
        if (index >= 0 && index < this.curvePoints.length) {
            this.curvePoints.splice(index, 1);
        }
    }

    /**
     * Apply a preset by name
     */
    applyPreset(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (preset) {
            this.curveType = preset.curveType;
            this.curvePoints = [...preset.curvePoints];
            return true;
        }
        return false;
    }

    /**
     * Enable/disable velocity curve
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /**
     * Set output range
     */
    setOutputRange(min, max) {
        this.minOutput = Math.max(1, Math.min(127, min));
        this.maxOutput = Math.max(this.minOutput, Math.min(127, max));
    }

    /**
     * Get curve visualization data
     */
    getVisualizationData(resolution = 128) {
        const data = [];
        for (let i = 0; i < resolution; i++) {
            const input = (i / (resolution - 1)) * 127;
            const output = this.apply(input);
            data.push({ input, output });
        }
        return data;
    }

    /**
     * Export curve settings
     */
    exportSettings() {
        return {
            curveType: this.curveType,
            curvePoints: [...this.curvePoints],
            inputScale: this.inputScale,
            outputScale: this.outputScale,
            minOutput: this.minOutput,
            maxOutput: this.maxOutput,
            isEnabled: this.isEnabled
        };
    }

    /**
     * Import curve settings
     */
    importSettings(settings) {
        if (settings.curveType) this.curveType = settings.curveType;
        if (settings.curvePoints) this.curvePoints = [...settings.curvePoints];
        if (settings.inputScale !== undefined) this.inputScale = settings.inputScale;
        if (settings.outputScale !== undefined) this.outputScale = settings.outputScale;
        if (settings.minOutput !== undefined) this.minOutput = settings.minOutput;
        if (settings.maxOutput !== undefined) this.maxOutput = settings.maxOutput;
        if (settings.isEnabled !== undefined) this.isEnabled = settings.isEnabled;
    }
}

// UI Panel for velocity curve editing
let velocityCurvePanel = null;

export function openMIDIVelocityCurvePanel(services = {}) {
    if (velocityCurvePanel) {
        velocityCurvePanel.remove();
    }
    
    const velocityCurve = new MIDIVelocityCurve();
    let isDragging = false;
    let dragPointIndex = -1;
    
    const panel = document.createElement('div');
    panel.className = 'snug-window velocity-curve-panel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        width: 550px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div class="panel-header" style="
            padding: 12px 16px;
            background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <h3 style="margin: 0; color: #fff; font-size: 16px;">MIDI Velocity Curve</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        
        <div class="panel-content" style="padding: 16px;">
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preset</label>
                    <select id="curvePreset" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="">-- Select Preset --</option>
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Curve Type</label>
                    <select id="curveType" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="linear">Linear</option>
                        <option value="exponential">Exponential</option>
                        <option value="logarithmic">Logarithmic</option>
                        <option value="s-curve">S-Curve</option>
                        <option value="fixed">Fixed</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 12px;">
                    <input type="checkbox" id="enableCurve" style="accent-color: #4a9eff;">
                    Enable Velocity Curve
                </label>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 8px;">Curve Editor</label>
                <canvas id="curveCanvas" width="500" height="200" style="
                    background: #0a0a1e;
                    border: 1px solid #333;
                    border-radius: 4px;
                    cursor: crosshair;
                "></canvas>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span style="color: #666; font-size: 10px;">Input: 0-127</span>
                    <span style="color: #666; font-size: 10px;">Output: 0-127</span>
                </div>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Min Output</label>
                    <input type="number" id="minOutput" min="1" max="127" value="1" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Max Output</label>
                    <input type="number" id="maxOutput" min="1" max="127" value="127" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                </div>
            </div>
            
            <div id="testSection" style="
                background: #0a0a1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa; font-size: 12px;">Test Velocity:</span>
                    <input type="range" id="testVelocity" min="1" max="127" value="64" style="width: 200px; accent-color: #4a9eff;">
                </div>
                <div style="display: flex; justify-content: space-between; color: #fff; font-size: 14px;">
                    <span>Input: <span id="testInput" style="color: #4a9eff;">64</span></span>
                    <span>Output: <span id="testOutput" style="color: #00ff88;">64</span></span>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="resetBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                ">Reset</button>
                <button id="exportBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                ">Export</button>
                <button id="importBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                ">Import</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    velocityCurvePanel = panel;
    
    // Get elements
    const canvas = panel.querySelector('#curveCanvas');
    const ctx = canvas.getContext('2d');
    const presetSelect = panel.querySelector('#curvePreset');
    const curveTypeSelect = panel.querySelector('#curveType');
    const enableCheckbox = panel.querySelector('#enableCurve');
    const minOutputInput = panel.querySelector('#minOutput');
    const maxOutputInput = panel.querySelector('#maxOutput');
    const testVelocityInput = panel.querySelector('#testVelocity');
    const testInputSpan = panel.querySelector('#testInput');
    const testOutputSpan = panel.querySelector('#testOutput');
    
    // Populate presets
    const presets = MIDIVelocityCurve.getPresets();
    presets.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    // Draw the curve
    const drawCurve = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 4; i++) {
            const x = (i / 4) * canvas.width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * canvas.height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw diagonal reference line (linear)
        ctx.strokeStyle = '#333';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        ctx.lineTo(canvas.width, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw curve
        const data = velocityCurve.getVisualizationData(100);
        
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((point, i) => {
            const x = (point.input / 127) * canvas.width;
            const y = canvas.height - (point.output / 127) * canvas.height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw curve points for custom editing
        if (velocityCurve.curveType === 'custom') {
            velocityCurve.curvePoints.forEach((point, index) => {
                const x = (point.input / 127) * canvas.width;
                const y = canvas.height - (point.output / 127) * canvas.height;
                
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        // Draw test point
        const testInput = parseInt(testVelocityInput.value);
        const testOutput = velocityCurve.apply(testInput);
        const testX = (testInput / 127) * canvas.width;
        const testY = canvas.height - (testOutput / 127) * canvas.height;
        
        ctx.fillStyle = '#ff4a4a';
        ctx.beginPath();
        ctx.arc(testX, testY, 5, 0, Math.PI * 2);
        ctx.fill();
    };
    
    // Update test display
    const updateTest = () => {
        const input = parseInt(testVelocityInput.value);
        const output = velocityCurve.apply(input);
        testInputSpan.textContent = input;
        testOutputSpan.textContent = output;
        drawCurve();
    };
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        velocityCurvePanel = null;
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            velocityCurve.applyPreset(presetSelect.value);
            curveTypeSelect.value = velocityCurve.curveType;
            drawCurve();
        }
    });
    
    curveTypeSelect.addEventListener('change', () => {
        velocityCurve.setCurveType(curveTypeSelect.value);
        drawCurve();
    });
    
    enableCheckbox.addEventListener('change', () => {
        velocityCurve.setEnabled(enableCheckbox.checked);
    });
    
    minOutputInput.addEventListener('change', () => {
        velocityCurve.setOutputRange(
            parseInt(minOutputInput.value),
            parseInt(maxOutputInput.value)
        );
    });
    
    maxOutputInput.addEventListener('change', () => {
        velocityCurve.setOutputRange(
            parseInt(minOutputInput.value),
            parseInt(maxOutputInput.value)
        );
    });
    
    testVelocityInput.addEventListener('input', updateTest);
    
    // Canvas interaction for custom curve editing
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const input = (x / canvas.width) * 127;
        const output = (1 - y / canvas.height) * 127;
        
        // Check if clicking near existing point
        const points = velocityCurve.curvePoints;
        for (let i = 0; i < points.length; i++) {
            const px = (points[i].input / 127) * canvas.width;
            const py = canvas.height - (points[i].output / 127) * canvas.height;
            
            if (Math.hypot(x - px, y - py) < 10) {
                isDragging = true;
                dragPointIndex = i;
                return;
            }
        }
        
        // Add new point
        velocityCurve.addCurvePoint(input, output);
        drawCurve();
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || dragPointIndex < 0) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const input = Math.max(0, Math.min(127, (x / canvas.width) * 127));
        const output = Math.max(0, Math.min(127, (1 - y / canvas.height) * 127));
        
        velocityCurve.curvePoints[dragPointIndex] = { input, output };
        drawCurve();
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        dragPointIndex = -1;
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        dragPointIndex = -1;
    });
    
    // Right-click to remove point
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const points = velocityCurve.curvePoints;
        for (let i = 0; i < points.length; i++) {
            const px = (points[i].input / 127) * canvas.width;
            const py = canvas.height - (points[i].output / 127) * canvas.height;
            
            if (Math.hypot(x - px, y - py) < 10) {
                velocityCurve.removeCurvePoint(i);
                drawCurve();
                return;
            }
        }
    });
    
    // Reset button
    const resetBtn = panel.querySelector('#resetBtn');
    resetBtn.addEventListener('click', () => {
        velocityCurve.applyPreset('Linear');
        velocityCurve.setEnabled(false);
        curveTypeSelect.value = 'linear';
        enableCheckbox.checked = false;
        minOutputInput.value = 1;
        maxOutputInput.value = 127;
        drawCurve();
    });
    
    // Export button
    const exportBtn = panel.querySelector('#exportBtn');
    exportBtn.addEventListener('click', () => {
        const settings = velocityCurve.exportSettings();
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `velocity-curve-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Import button
    const importBtn = panel.querySelector('#importBtn');
    importBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const settings = JSON.parse(e.target.result);
                        velocityCurve.importSettings(settings);
                        curveTypeSelect.value = velocityCurve.curveType;
                        enableCheckbox.checked = velocityCurve.isEnabled;
                        minOutputInput.value = velocityCurve.minOutput;
                        maxOutputInput.value = velocityCurve.maxOutput;
                        drawCurve();
                    } catch (err) {
                        console.error('Failed to import settings:', err);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    });
    
    // Initial draw
    drawCurve();
    
    return { panel, velocityCurve };
}

export default MIDIVelocityCurve;