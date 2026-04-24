/**
 * Phase Invert Button
 * Quick phase flip for track alignment
 */

class PhaseInvertButton {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            inverted: options.inverted ?? false,
            channel: options.channel ?? 'both', // 'left', 'right', 'both'
        };
        
        // Create nodes
        this.gainNode = audioContext.createGain();
        this.splitter = audioContext.createChannelSplitter(2);
        this.merger = audioContext.createChannelMerger(2);
        this.leftGain = audioContext.createGain();
        this.rightGain = audioContext.createGain();
        
        // Initial setup
        this._setupRouting();
        this._updatePhase();
    }
    
    _setupRouting() {
        // Input -> Splitter
        this.gainNode.connect(this.splitter);
        
        // Splitter -> Individual gains -> Merger
        this.splitter.connect(this.leftGain, 0);
        this.splitter.connect(this.rightGain, 1);
        this.leftGain.connect(this.merger, 0, 0);
        this.rightGain.connect(this.merger, 0, 1);
    }
    
    _updatePhase() {
        const leftInverted = this.config.inverted && (this.config.channel === 'both' || this.config.channel === 'left');
        const rightInverted = this.config.inverted && (this.config.channel === 'both' || this.config.channel === 'right');
        
        this.leftGain.gain.value = leftInverted ? -1 : 1;
        this.rightGain.gain.value = rightInverted ? -1 : 1;
    }
    
    // Connect input source
    connect(source) {
        source.connect(this.gainNode);
        return this.merger;
    }
    
    // Connect to destination
    connectTo(destination) {
        this.merger.connect(destination);
        return this;
    }
    
    // Disconnect
    disconnect() {
        this.gainNode.disconnect();
        this.splitter.disconnect();
        this.leftGain.disconnect();
        this.rightGain.disconnect();
        this.merger.disconnect();
    }
    
    // Toggle phase inversion
    toggle() {
        this.config.inverted = !this.config.inverted;
        this._updatePhase();
        return this.config.inverted;
    }
    
    // Set inversion state
    setInverted(inverted) {
        this.config.inverted = inverted;
        this._updatePhase();
    }
    
    // Get inversion state
    isInverted() {
        return this.config.inverted;
    }
    
    // Set which channels to invert
    setChannel(channel) {
        if (['left', 'right', 'both'].includes(channel)) {
            this.config.channel = channel;
            this._updatePhase();
        }
    }
    
    // Create UI button
    createButton(container) {
        const button = document.createElement('button');
        button.className = 'phase-invert-button';
        button.innerHTML = `
            <style>
                .phase-invert-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: #0a0a14;
                    border: 1px solid #333;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
                .phase-invert-button:hover {
                    background: #1a1a2e;
                    border-color: #444;
                }
                .phase-invert-button.active {
                    background: #ef4444;
                    border-color: #ef4444;
                }
                .phase-invert-button.active:hover {
                    background: #dc2626;
                }
                .pib-icon {
                    width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }
            </style>
            <span class="pib-icon">Ø</span>
            <span>Phase</span>
        `;
        
        button.addEventListener('click', () => {
            const inverted = this.toggle();
            button.classList.toggle('active', inverted);
            
            // Dispatch custom event
            button.dispatchEvent(new CustomEvent('phasechange', {
                detail: { inverted: this.config.inverted }
            }));
        });
        
        // Set initial state
        if (this.config.inverted) {
            button.classList.add('active');
        }
        
        if (container) {
            container.appendChild(button);
        }
        
        return button;
    }
    
    // Create full panel with options
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'phase-invert-panel';
        panel.innerHTML = `
            <style>
                .phase-invert-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .pip-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                }
                .pip-section {
                    margin-bottom: 16px;
                }
                .pip-label {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .pip-buttons {
                    display: flex;
                    gap: 8px;
                }
                .pip-btn {
                    flex: 1;
                    padding: 10px;
                    background: #0a0a14;
                    border: 1px solid #333;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                }
                .pip-btn:hover {
                    background: #1a1a2e;
                }
                .pip-btn.active {
                    background: #10b981;
                    border-color: #10b981;
                }
                .pip-main-btn {
                    padding: 16px;
                    font-size: 16px;
                    font-weight: bold;
                }
                .pip-status {
                    text-align: center;
                    padding: 12px;
                    background: #0a0a14;
                    border-radius: 4px;
                    margin-top: 12px;
                }
                .pip-status-text {
                    font-size: 14px;
                }
                .pip-status-normal { color: #10b981; }
                .pip-status-inverted { color: #ef4444; }
            </style>
            
            <div class="pip-header">Phase Invert</div>
            
            <div class="pip-section">
                <div class="pip-label">Channel Selection</div>
                <div class="pip-buttons">
                    <button class="pip-btn ${this.config.channel === 'left' ? 'active' : ''}" data-channel="left">Left</button>
                    <button class="pip-btn ${this.config.channel === 'right' ? 'active' : ''}" data-channel="right">Right</button>
                    <button class="pip-btn ${this.config.channel === 'both' ? 'active' : ''}" data-channel="both">Both</button>
                </div>
            </div>
            
            <div class="pip-section">
                <button class="pip-btn pip-main-btn" id="pip-toggle">
                    <span style="font-size: 24px;">Ø</span> Toggle Phase
                </button>
            </div>
            
            <div class="pip-status" id="pip-status">
                <span class="pip-status-text pip-status-normal">Normal Phase</span>
            </div>
        `;
        
        container.appendChild(panel);
        
        // Event handlers
        const channelBtns = panel.querySelectorAll('.pip-btn[data-channel]');
        channelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                channelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setChannel(btn.dataset.channel);
            });
        });
        
        const toggleBtn = panel.querySelector('#pip-toggle');
        const statusEl = panel.querySelector('#pip-status');
        
        toggleBtn.addEventListener('click', () => {
            const inverted = this.toggle();
            toggleBtn.classList.toggle('active', inverted);
            
            statusEl.innerHTML = inverted
                ? '<span class="pip-status-text pip-status-inverted">Phase Inverted</span>'
                : '<span class="pip-status-text pip-status-normal">Normal Phase</span>';
        });
        
        return panel;
    }
    
    // Get input node for connection
    get input() {
        return this.gainNode;
    }
    
    // Get output node
    get output() {
        return this.merger;
    }
}

// Export for use in main DAW
export function createPhaseInvertButton(audioContext, options = {}) {
    return new PhaseInvertButton(audioContext, options);
}

export function openPhaseInvertButtonPanel(services = {}) {
    const { audioContext, container } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for Phase Invert Button panel');
        return null;
    }
    
    const phaseInvert = new PhaseInvertButton(audioContext);
    return phaseInvert.createPanel(container);
}