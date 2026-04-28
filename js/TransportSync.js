/**
 * TransportSync - Keeps Timeline Playhead aligned with Audio Context time
 */
const TransportSync = {
    _syncInterval: null,
    _lastReportedBeat: -1,
    
    start() {
        if (this._syncInterval) return;
        this._syncInterval = setInterval(() => this._sync(), 50);
    },
    
    stop() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
        this._lastReportedBeat = -1;
    },
    
    _sync() {
        const pos = Math.floor(Tone.Transport.position);
        if (pos !== this._lastReportedBeat) {
            this._lastReportedBeat = pos;
            if (typeof updatePlayheadPosition === 'function') {
                updatePlayheadPosition(Tone.Transport.seconds);
            }
        }
    },
    
    isActive() { return !!this._syncInterval; },
    getLastBeat() { return this._lastReportedBeat; }
};
window.TransportSync = TransportSync;
