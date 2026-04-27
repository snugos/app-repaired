// SnugOS DAW - Performance Overlay Widget
// Real-time metrics display for monitoring DAW performance

class PerformanceOverlay {
    constructor() {
        this.enabled = false;
        this.minimized = false;
        this.updateInterval = null;
        this.metrics = {
            activeVoices: 0,
            trackCount: 0,
            audioContextState: 'running',
            cpuEstimate: 0,
            memoryMB: 0,
            scheduledEvents: 0
        };
        this.container = null;
        this.lastUpdate = performance.now();
    }

    init() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.id = 'performance-overlay';
        this.container.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(20, 20, 30, 0.92);
            border: 1px solid #3a3a4a;
            border-radius: 8px;
            padding: 10px 14px;
            font-family: 'SF Mono', 'Consolas', monospace;
            font-size: 11px;
            color: #aaa;
            z-index: 10000;
            min-width: 180px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
            transition: all 0.2s ease;
        `;
        
        this.updateDisplay();
        document.body.appendChild(this.container);
        this.startUpdating();
    }

    startUpdating() {
        if (this.updateInterval) return;
        this.updateInterval = setInterval(() => this.collectMetrics(), 1000);
    }

    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    collectMetrics() {
        // Collect active voices from Tone.js
        try {
            if (window.Tone && Tone.getContext) {
                const ctx = Tone.getContext();
                this.metrics.audioContextState = ctx.state || 'unknown';
                
                // Estimate voice count from active notes
                let voices = 0;
                if (window.tracks) {
                    window.tracks.forEach(track => {
                        if (track && track.instrument) {
                            if (track.instrument.get('activeVoices')) {
                                voices += track.instrument.get('activeVoices') || 0;
                            }
                        }
                    });
                }
                this.metrics.activeVoices = voices;
            }
        } catch (e) {
            // Tone.js not ready
        }

        // Track count
        try {
            if (window.tracks) {
                this.metrics.trackCount = window.tracks.length;
            }
        } catch (e) {}

        // Memory estimate (if available)
        if (performance.memory) {
            this.metrics.memoryMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
        }

        // Update display
        this.updateDisplay();
    }

    updateDisplay() {
        if (!this.container) return;
        
        const stateColor = this.metrics.audioContextState === 'running' ? '#4ade80' : 
                          this.metrics.audioContextState === 'suspended' ? '#fbbf24' : '#f87171';
        
        const html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #333; padding-bottom:6px;">
                <span style="color:#888; font-size:10px; text-transform:uppercase; letter-spacing:1px;">Performance</span>
                <div style="display:flex; gap:6px;">
                    <button onclick="window.perfOverlay?.toggleMinimize()" style="background:none; border:none; color:#666; cursor:pointer; padding:0 2px; font-size:10px;">−</button>
                    <button onclick="window.perfOverlay?.hide()" style="background:none; border:none; color:#666; cursor:pointer; padding:0 2px; font-size:10px;">×</button>
                </div>
            </div>
            <div style="display:${this.minimized ? 'none' : 'block'}">
                <div style="display:flex; justify-content:space-between; margin:3px 0;">
                    <span style="color:#666;">Voices</span>
                    <span style="color:${this.metrics.activeVoices > 50 ? '#f87171' : '#e0e0e0'}">${this.metrics.activeVoices}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin:3px 0;">
                    <span style="color:#666;">Tracks</span>
                    <span style="color:#e0e0e0">${this.metrics.trackCount}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin:3px 0;">
                    <span style="color:#666;">Audio</span>
                    <span style="color:${stateColor};">${this.metrics.audioContextState}</span>
                </div>
                ${this.metrics.memoryMB > 0 ? `
                <div style="display:flex; justify-content:space-between; margin:3px 0;">
                    <span style="color:#666;">Memory</span>
                    <span style="color:${this.metrics.memoryMB > 500 ? '#fbbf24' : '#e0e0e0'}">${this.metrics.memoryMB}MB</span>
                </div>
                ` : ''}
            </div>
        `;
        
        this.container.innerHTML = html;
    }

    show() {
        if (!this.container) this.init();
        this.container.style.display = 'block';
        this.enabled = true;
    }

    hide() {
        if (this.container) this.container.style.display = 'none';
        this.enabled = false;
    }

    toggleMinimize() {
        this.minimized = !this.minimized;
        this.updateDisplay();
    }

    toggle() {
        if (this.enabled) this.hide();
        else this.show();
    }

    dispose() {
        this.stopUpdating();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}

// Global instance
window.perfOverlay = new PerformanceOverlay();

// Toggle function for keyboard shortcut
function togglePerformanceOverlay() {
    window.perfOverlay?.toggle();
}

// Auto-init after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Don't auto-show, but make available
    console.log('[PerformanceOverlay] Ready - call togglePerformanceOverlay() or window.perfOverlay.show()');
});
