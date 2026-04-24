/**
 * Tempo Nudge - Fine-grained tempo adjustment with on-screen buttons
 * Adds +/- buttons to nudge tempo by configurable increments
 */
class TempoNudge {
    constructor(app) {
        this.app = app;
        this.nudgeAmount = 0.1;
        this.enabled = false;
    }

    initialize() {
        this.createNudgeUI();
        this.bindKeyboardShortcuts();
        console.log('[TempoNudge] Initialized');
    }

    createNudgeUI() {
        const existing = document.getElementById('tempo-nudge-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.id = 'tempo-nudge-container';
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2px;
            margin-left: 8px;
        `;

        const createButton = (label, action) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `
                background: #333;
                color: #fff;
                border: 1px solid #555;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                font-weight: bold;
            `;
            btn.onclick = action;
            return btn;
        };

        container.appendChild(createButton('-', () => this.nudgeTempo(-this.nudgeAmount)));
        container.appendChild(createButton('+', () => this.nudgeTempo(this.nudgeAmount)));

        const tempoDisplay = document.querySelector('.tempo-display, #tempo-value, [class*="tempo"]');
        if (tempoDisplay) {
            tempoDisplay.parentNode.insertBefore(container, tempoDisplay.nextSibling);
        } else {
            const transport = document.querySelector('.transport-controls, #transport');
            if (transport) {
                transport.appendChild(container);
            }
        }

        this.container = container;
    }

    nudgeTempo(delta) {
        const currentTempo = this.app.project?.tempo || 120;
        const newTempo = Math.max(20, Math.min(300, currentTempo + delta));
        if (this.app.setTempo) {
            this.app.setTempo(newTempo);
        } else if (this.app.state?.set) {
            this.app.state.set('tempo', newTempo);
        }
        console.log(`[TempoNudge] Tempo: ${currentTempo.toFixed(1)} → ${newTempo.toFixed(1)}`);
    }

    bindKeyboardShortcuts() {
        const handleKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.ctrlKey || e.metaKey) return;

            if (e.key === '[') this.nudgeTempo(-this.nudgeAmount);
            if (e.key === ']') this.nudgeTempo(this.nudgeAmount);
        };

        document.removeEventListener('keydown', this.boundKeyHandler);
        this.boundKeyHandler = handleKey.bind(this);
        document.addEventListener('keydown', this.boundKeyHandler);
    }

    setNudgeAmount(amount) {
        this.nudgeAmount = Math.max(0.01, Math.min(10, amount));
    }

    dispose() {
        document.removeEventListener('keydown', this.boundKeyHandler);
        if (this.container) this.container.remove();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TempoNudge;
}