// AutoSave Manager - Automatic periodic project saving
// Periodically saves project state to prevent data loss

const AutoSaveManager = {
    intervalId: null,
    intervalMs: 60000, // Default: 1 minute
    isEnabled: true,
    lastSaveTime: null,
    saveCount: 0,

    init(customIntervalMs) {
        if (customIntervalMs && customIntervalMs >= 10000) {
            this.intervalMs = customIntervalMs;
        }
        this.start();
        console.log(`[AutoSave] Initialized with ${this.intervalMs / 1000}s interval`);
    },

    start() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.save(), this.intervalMs);
        console.log(`[AutoSave] Started - saving every ${this.intervalMs / 1000}s`);
    },

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[AutoSave] Stopped');
        }
    },

    async save() {
        if (!this.isEnabled) return;
        if (typeof getCurrentProjectState !== 'function') return;

        try {
            const state = getCurrentProjectState();
            if (!state) return;

            const key = `autosave_${getCurrentProjectId()}`;
            const saveData = {
                timestamp: Date.now(),
                state: state,
                saveNumber: this.saveCount + 1
            };

            localStorage.setItem(key, JSON.stringify(saveData));
            this.lastSaveTime = new Date();
            this.saveCount++;
            console.log(`[AutoSave] Saved #${this.saveCount} at ${this.lastSaveTime.toLocaleTimeString()}`);
        } catch (e) {
            console.warn('[AutoSave] Save failed:', e);
        }
    },

    getLastSaveInfo() {
        if (!this.lastSaveTime) return null;
        return {
            time: this.lastSaveTime,
            count: this.saveCount,
            msAgo: Date.now() - this.lastSaveTime.getTime()
        };
    },

    setInterval(ms) {
        if (ms >= 10000) {
            this.intervalMs = ms;
            if (this.intervalId) {
                this.stop();
                this.start();
            }
        }
    },

    enable() { this.isEnabled = true; },
    disable() { this.isEnabled = false; }
};

// Export for window access
window.AutoSaveManager = AutoSaveManager;
