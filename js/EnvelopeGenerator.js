/**
 * EnvelopeGenerator - ADSR envelope generator for modulation
 * Provides Attack, Decay, Sustain, Release envelope with multiple trigger modes
 */

class EnvelopeGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isActive = false;
        
        this.outputNode = audioContext.createGain();
        this.outputNode.gain.value = 0;
        
        // ADSR parameters (in seconds for A, D, R; 0-1 for S)
        this.params = {
            attack: 0.01,     // Attack time (seconds)
            decay: 0.1,       // Decay time (seconds)
            sustain: 0.7,     // Sustain level (0-1)
            release: 0.3,     // Release time (seconds)
            attackCurve: 'linear',  // 'linear', 'exponential', 's-curve'
            decayCurve: 'exponential',
            releaseCurve: 'exponential',
            triggerMode: 'gate',    // 'gate', 'trigger', 'loop', 'one-shot'
            loopTime: 1,      // Loop time in seconds (for loop mode)
            peakLevel: 1,     // Peak level before sustain
            velocitySensitivity: 1  // How much velocity affects level
        };
        
        this.isGated = false;
        this.isRunning = false;
        this.loopTimeout = null;
        this.currentVelocity = 1;
        
        this.targets = []; // Modulation targets
    }
    
    setParam(name, value) {
        if (this.params.hasOwnProperty(name)) {
            this.params[name] = value;
        }
    }
    
    addTarget(target, property) {
        this.targets.push({ target, property });
    }
    
    removeTarget(target, property) {
        this.targets = this.targets.filter(t => 
            !(t.target === target && t.property === property)
        );
    }
    
    gate(velocity = 1) {
        this.isGated = true;
        this.isRunning = true;
        this.currentVelocity = velocity;
        
        const now = this.audioContext.currentTime;
        const { attack, decay, sustain, attackCurve, decayCurve, peakLevel } = this.params;
        const level = peakLevel * velocity * this.params.velocitySensitivity;
        
        // Cancel any scheduled values
        this.outputNode.gain.cancelScheduledValues(now);
        this.outputNode.gain.setValueAtTime(0, now);
        
        // Attack phase
        if (attackCurve === 'exponential') {
            this.outputNode.gain.exponentialRampToValueAtTime(level, now + attack);
        } else if (attackCurve === 's-curve') {
            // S-curve approximation using linear segments
            this.outputNode.gain.linearRampToValueAtTime(level * 0.5, now + attack * 0.5);
            this.outputNode.gain.linearRampToValueAtTime(level, now + attack);
        } else {
            this.outputNode.gain.linearRampToValueAtTime(level, now + attack);
        }
        
        // Decay phase
        const sustainLevel = sustain * level;
        if (decayCurve === 'exponential') {
            this.outputNode.gain.exponentialRampToValueAtTime(
                Math.max(0.001, sustainLevel), 
                now + attack + decay
            );
        } else {
            this.outputNode.gain.linearRampToValueAtTime(sustainLevel, now + attack + decay);
        }
        
        // Update modulation targets
        this.updateTargets(now, attack + decay);
    }
    
    ungate() {
        if (!this.isGated) return;
        
        this.isGated = false;
        const now = this.audioContext.currentTime;
        const { release, releaseCurve, sustain } = this.params;
        
        // Cancel scheduled values and set current value
        this.outputNode.gain.cancelScheduledValues(now);
        const currentValue = this.outputNode.gain.value;
        this.outputNode.gain.setValueAtTime(currentValue, now);
        
        // Release phase
        if (releaseCurve === 'exponential') {
            this.outputNode.gain.exponentialRampToValueAtTime(0.001, now + release);
        } else if (releaseCurve === 's-curve') {
            this.outputNode.gain.linearRampToValueAtTime(currentValue * 0.5, now + release * 0.5);
            this.outputNode.gain.linearRampToValueAtTime(0.001, now + release);
        } else {
            this.outputNode.gain.linearRampToValueAtTime(0, now + release);
        }
        
        // Set to 0 after release
        this.outputNode.gain.setValueAtTime(0, now + release + 0.001);
        
        this.isRunning = false;
        this.updateTargets(now, release);
    }
    
    trigger(velocity = 1) {
        this.currentVelocity = velocity;
        this.gate(velocity);
        
        // Auto-ungate after attack + decay
        const { attack, decay } = this.params;
        setTimeout(() => {
            if (this.isGated && this.params.triggerMode === 'trigger') {
                this.ungate();
            }
        }, (attack + decay) * 1000);
    }
    
    startLoop() {
        if (this.params.triggerMode !== 'loop') return;
        
        const runLoop = () => {
            if (!this.isRunning) return;
            
            this.gate(1);
            
            const { attack, decay, sustain, release, loopTime } = this.params;
            const cycleTime = Math.max(attack + decay + 0.1, loopTime);
            
            setTimeout(() => {
                if (this.isRunning) {
                    this.ungate();
                    setTimeout(() => {
                        if (this.isRunning) {
                            runLoop();
                        }
                    }, release * 1000);
                }
            }, cycleTime * 1000);
        };
        
        this.isRunning = true;
        runLoop();
    }
    
    stopLoop() {
        this.isRunning = false;
        this.ungate();
    }
    
    updateTargets(startTime, duration) {
        this.targets.forEach(({ target, property }) => {
            if (target && property) {
                const currentValue = this.outputNode.gain.value;
                // Apply envelope to target property
                // This is a simplified version - real implementation would
                // interpolate over the duration
            }
        });
    }
    
    start() {
        if (this.isActive) return;
        this.isActive = true;
    }
    
    stop() {
        this.isActive = false;
        this.ungate();
        this.isRunning = false;
    }
    
    connect(destination) {
        this.outputNode.connect(destination);
    }
    
    disconnect() {
        this.outputNode.disconnect();
    }
    
    getOutput() {
        return this.outputNode;
    }
    
    getCurrentLevel() {
        return this.outputNode.gain.value;
    }
    
    isEnvelopeActive() {
        return this.isRunning || this.isGated;
    }
}

// Global envelope generator instance
let envelopeGeneratorInstance = null;

function openEnvelopeGeneratorPanel() {
    const existingPanel = document.getElementById('envelope-generator-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'envelope-generator-panel';
    panel.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #4a4a6a; border-radius: 8px; padding: 20px;
        width: 500px; z-index: 10000; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #e0e0e0; margin: 0; font-size: 18px;">Envelope Generator</h2>
            <button id="closeEnvelope" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <!-- ADSR Visualizer -->
        <canvas id="adsrCanvas" style="width: 100%; height: 120px; background: #0a0a14; border-radius: 4px; margin-bottom: 16px;"></canvas>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
                <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Attack (s)</label>
                <input type="range" id="envAttack" min="0" max="2000" value="10" style="width: 100%;">
                <span id="envAttackVal" style="color: #e0e0e0; font-size: 12px;">0.01 s</span>
            </div>
            
            <div>
                <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Decay (s)</label>
                <input type="range" id="envDecay" min="0" max="5000" value="100" style="width: 100%;">
                <span id="envDecayVal" style="color: #e0e0e0; font-size: 12px;">0.1 s</span>
            </div>
            
            <div>
                <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Sustain</label>
                <input type="range" id="envSustain" min="0" max="100" value="70" style="width: 100%;">
                <span id="envSustainVal" style="color: #e0e0e0; font-size: 12px;">70%</span>
            </div>
            
            <div>
                <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Release (s)</label>
                <input type="range" id="envRelease" min="0" max="10000" value="300" style="width: 100%;">
                <span id="envReleaseVal" style="color: #e0e0e0; font-size: 12px;">0.3 s</span>
            </div>
        </div>
        
        <div style="margin-top: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 8px;">Trigger Mode</label>
            <div style="display: flex; gap: 8px;">
                <button class="trigger-mode-btn" data-mode="gate" style="padding: 8px 16px; background: #4CAF50; border: none; border-radius: 4px; color: white; cursor: pointer;">Gate</button>
                <button class="trigger-mode-btn" data-mode="trigger" style="padding: 8px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">Trigger</button>
                <button class="trigger-mode-btn" data-mode="loop" style="padding: 8px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">Loop</button>
            </div>
        </div>
        
        <div style="margin-top: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 8px;">Curves</label>
            <div style="display: flex; gap: 16px;">
                <div>
                    <label style="color: #888; font-size: 11px;">Attack</label>
                    <select id="attackCurve" style="padding: 4px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 4px; color: #e0e0e0; font-size: 11px;">
                        <option value="linear">Linear</option>
                        <option value="exponential">Exponential</option>
                        <option value="s-curve">S-Curve</option>
                    </select>
                </div>
                <div>
                    <label style="color: #888; font-size: 11px;">Decay</label>
                    <select id="decayCurve" style="padding: 4px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 4px; color: #e0e0e0; font-size: 11px;">
                        <option value="linear">Linear</option>
                        <option value="exponential" selected>Exponential</option>
                    </select>
                </div>
                <div>
                    <label style="color: #888; font-size: 11px;">Release</label>
                    <select id="releaseCurve" style="padding: 4px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 4px; color: #e0e0e0; font-size: 11px;">
                        <option value="linear">Linear</option>
                        <option value="exponential" selected>Exponential</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Loop Time (s)</label>
            <input type="range" id="loopTime" min="100" max="5000" value="1000" style="width: 100%;">
            <span id="loopTimeVal" style="color: #e0e0e0; font-size: 12px;">1 s</span>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="triggerEnvelope" style="flex: 1; padding: 12px; background: #4CAF50; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">Trigger</button>
            <button id="gateEnvelope" style="flex: 1; padding: 12px; background: #2196F3; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">Gate</button>
            <button id="stopEnvelope" style="flex: 1; padding: 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">Stop</button>
        </div>
        
        <div id="envelopePresets" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
            <label style="color: #a0a0a0; font-size: 12px;">Presets</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                <button class="envelope-preset" data-preset="piano" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Piano</button>
                <button class="envelope-preset" data-preset="pad" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Pad</button>
                <button class="envelope-preset" data-preset="pluck" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Pluck</button>
                <button class="envelope-preset" data-preset="brass" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Brass</button>
                <button class="envelope-preset" data-preset="strings" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Strings</button>
                <button class="envelope-preset" data-preset="organ" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Organ</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    document.getElementById('closeEnvelope').onclick = () => panel.remove();
    
    // Initialize processor
    if (!envelopeGeneratorInstance && window.audioContext) {
        envelopeGeneratorInstance = new EnvelopeGenerator(window.audioContext);
    }
    
    const canvas = document.getElementById('adsrCanvas');
    const ctx = canvas.getContext('2d');
    
    // Draw ADSR visualization
    function drawADSR() {
        if (!document.getElementById('envelope-generator-panel')) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);
        
        const { attack, decay, sustain, release } = envelopeGeneratorInstance?.params || {
            attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3
        };
        
        // Scale times for visualization
        const totalTime = attack + decay + 0.5 + release; // 0.5s sustain for display
        const scale = (width - 40) / totalTime;
        
        const startX = 20;
        const maxY = height - 20;
        
        ctx.beginPath();
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        
        // Start at 0
        ctx.moveTo(startX, maxY);
        
        // Attack
        const attackX = startX + attack * scale;
        ctx.lineTo(attackX, 20);
        
        // Decay
        const decayX = attackX + decay * scale;
        const sustainY = maxY - (sustain * (maxY - 20));
        ctx.lineTo(decayX, sustainY);
        
        // Sustain (0.5s for display)
        const sustainX = decayX + 0.5 * scale;
        ctx.lineTo(sustainX, sustainY);
        
        // Release
        const releaseX = sustainX + release * scale;
        ctx.lineTo(releaseX, maxY);
        
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText('A', attackX - 5, height - 5);
        ctx.fillText('D', decayX - 5, height - 5);
        ctx.fillText('S', sustainX - 5, height - 5);
        ctx.fillText('R', releaseX - 5, height - 5);
        
        // Draw current level indicator
        const currentLevel = envelopeGeneratorInstance?.getCurrentLevel() || 0;
        const levelY = maxY - (currentLevel * (maxY - 20));
        
        ctx.beginPath();
        ctx.fillStyle = '#FF9800';
        ctx.arc(sustainX, levelY, 5, 0, Math.PI * 2);
        ctx.fill();
        
        requestAnimationFrame(drawADSR);
    }
    
    drawADSR();
    
    // Parameter sliders
    const sliders = [
        { id: 'envAttack', param: 'attack', display: 'envAttackVal', suffix: ' s', scale: 0.001 },
        { id: 'envDecay', param: 'decay', display: 'envDecayVal', suffix: ' s', scale: 0.001 },
        { id: 'envSustain', param: 'sustain', display: 'envSustainVal', suffix: '%', scale: 0.01 },
        { id: 'envRelease', param: 'release', display: 'envReleaseVal', suffix: ' s', scale: 0.001 },
        { id: 'loopTime', param: 'loopTime', display: 'loopTimeVal', suffix: ' s', scale: 0.001 }
    ];
    
    sliders.forEach(({ id, param, display, suffix, scale }) => {
        const slider = document.getElementById(id);
        slider.oninput = () => {
            const value = slider.value * scale;
            document.getElementById(display).textContent = slider.value + suffix;
            if (envelopeGeneratorInstance) {
                envelopeGeneratorInstance.setParam(param, value);
            }
        };
    });
    
    // Curve selectors
    document.getElementById('attackCurve').onchange = (e) => {
        if (envelopeGeneratorInstance) {
            envelopeGeneratorInstance.setParam('attackCurve', e.target.value);
        }
    };
    
    document.getElementById('decayCurve').onchange = (e) => {
        if (envelopeGeneratorInstance) {
            envelopeGeneratorInstance.setParam('decayCurve', e.target.value);
        }
    };
    
    document.getElementById('releaseCurve').onchange = (e) => {
        if (envelopeGeneratorInstance) {
            envelopeGeneratorInstance.setParam('releaseCurve', e.target.value);
        }
    };
    
    // Trigger mode buttons
    document.querySelectorAll('.trigger-mode-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.trigger-mode-btn').forEach(b => {
                b.style.background = '#333';
                b.style.color = '#e0e0e0';
            });
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            
            if (envelopeGeneratorInstance) {
                envelopeGeneratorInstance.setParam('triggerMode', btn.dataset.mode);
            }
        };
    });
    
    // Control buttons
    document.getElementById('triggerEnvelope').onclick = () => {
        if (envelopeGeneratorInstance) {
            envelopeGeneratorInstance.trigger(1);
        }
    };
    
    document.getElementById('gateEnvelope').onclick = () => {
        if (envelopeGeneratorInstance) {
            if (envelopeGeneratorInstance.isGated) {
                envelopeGeneratorInstance.ungate();
                document.getElementById('gateEnvelope').textContent = 'Gate';
            } else {
                envelopeGeneratorInstance.gate(1);
                document.getElementById('gateEnvelope').textContent = 'Ungate';
            }
        }
    };
    
    document.getElementById('stopEnvelope').onclick = () => {
        if (envelopeGeneratorInstance) {
            envelopeGeneratorInstance.stop();
            document.getElementById('gateEnvelope').textContent = 'Gate';
        }
    };
    
    // Presets
    const presets = {
        piano: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.5, attackCurve: 'linear', decayCurve: 'exponential', releaseCurve: 'exponential' },
        pad: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.0, attackCurve: 'exponential', decayCurve: 'exponential', releaseCurve: 'exponential' },
        pluck: { attack: 0.001, decay: 0.4, sustain: 0.1, release: 0.3, attackCurve: 'linear', decayCurve: 'exponential', releaseCurve: 'exponential' },
        brass: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.2, attackCurve: 'exponential', decayCurve: 'exponential', releaseCurve: 'exponential' },
        strings: { attack: 0.3, decay: 0.1, sustain: 0.9, release: 0.5, attackCurve: 'exponential', decayCurve: 'exponential', releaseCurve: 'exponential' },
        organ: { attack: 0.001, decay: 0.1, sustain: 1.0, release: 0.1, attackCurve: 'linear', decayCurve: 'linear', releaseCurve: 'linear' }
    };
    
    document.querySelectorAll('.envelope-preset').forEach(btn => {
        btn.onclick = () => {
            const preset = presets[btn.dataset.preset];
            if (!preset || !envelopeGeneratorInstance) return;
            
            Object.entries(preset).forEach(([param, value]) => {
                envelopeGeneratorInstance.setParam(param, value);
            });
            
            // Update UI
            document.getElementById('envAttack').value = preset.attack * 1000;
            document.getElementById('envAttackVal').textContent = preset.attack + ' s';
            document.getElementById('envDecay').value = preset.decay * 1000;
            document.getElementById('envDecayVal').textContent = preset.decay + ' s';
            document.getElementById('envSustain').value = preset.sustain * 100;
            document.getElementById('envSustainVal').textContent = Math.round(preset.sustain * 100) + '%';
            document.getElementById('envRelease').value = preset.release * 1000;
            document.getElementById('envReleaseVal').textContent = preset.release + ' s';
            document.getElementById('attackCurve').value = preset.attackCurve;
            document.getElementById('decayCurve').value = preset.decayCurve;
            document.getElementById('releaseCurve').value = preset.releaseCurve;
        };
    });
}

window.EnvelopeGenerator = EnvelopeGenerator;
window.openEnvelopeGeneratorPanel = openEnvelopeGeneratorPanel;