// Quick Save - Rapid project snapshot with single keystroke
// Saves to localStorage with timestamp-based versioning
class QuickSave {
    constructor() {
        this.maxSnapshots = 10;
        this.autoKey = 'snaw_quicksave';
    }

    getSnapshots() {
        const data = localStorage.getItem(this.autoKey);
        return data ? JSON.parse(data) : [];
    }

    save(label = 'Quick Save') {
        const snapshots = this.getSnapshots();
        const state = window.stateManager?.state || {};
        if (!state.project) return false;

        const snapshot = {
            id: Date.now(),
            label,
            timestamp: new Date().toISOString(),
            state: JSON.parse(JSON.stringify(state))
        };

        snapshots.unshift(snapshot);
        if (snapshots.length > this.maxSnapshots) snapshots.pop();

        localStorage.setItem(this.autoKey, JSON.stringify(snapshots));
        console.log(`[QuickSave] Saved: ${label}`);
        return true;
    }

    load(id) {
        const snapshots = this.getSnapshots();
        const snapshot = snapshots.find(s => s.id === id);
        if (!snapshot) return false;

        if (window.stateManager && snapshot.state) {
            window.stateManager.state = snapshot.state;
            window.stateManager.emit('stateLoaded', snapshot.state);
        }
        console.log(`[QuickSave] Loaded: ${snapshot.label}`);
        return true;
    }

    clear() {
        localStorage.removeItem(this.autoKey);
    }

    list() {
        return this.getSnapshots().map(s => ({
            id: s.id,
            label: s.label,
            timestamp: s.timestamp
        }));
    }
}

window.quickSave = new QuickSave();

// Quick save shortcut: F5
document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const label = `Snapshot ${new Date().toLocaleTimeString()}`;
        window.quickSave.save(label);
        showNotification?.('💾 Quick Save created');
    }
});
