/**
 * ClipFadeHandles.js - Drag-to-adjust fade handles on audio clips
 * Provides visual drag handles at clip start/end for quick fade in/out creation
 */

const ClipFadeHandles = {
    activeHandle: null,
    dragStartX: 0,
    originalFade: 0,
    handleSize: 10,

    init() {
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        console.log('[ClipFadeHandles] Initialized - drag handles at clip edges for fades');
    },

    onMouseDown(e) {
        const handle = e.target.closest('.clip-fade-handle');
        if (!handle) return;

        e.preventDefault();
        e.stopPropagation();

        const clipId = handle.dataset.clipId;
        const fadeType = handle.dataset.fadeType;
        const fade = state.project.clips[clipId]?.fadeIn ?? 0;

        this.activeHandle = { clipId, fadeType };
        this.dragStartX = e.clientX;
        this.originalFade = fadeType === 'in' ? fade : (state.project.clips[clipId]?.fadeOut ?? 0);
        this.initialClipRect = handle.closest('.clip')?.getBoundingClientRect();
    },

    onMouseMove(e) {
        if (!this.activeHandle) return;

        const dx = e.clientX - this.dragStartX;
        const fadeMs = Math.max(0, this.originalFade + dx * 2);
        const clip = state.project.clips[this.activeHandle.clipId];

        if (this.activeHandle.fadeType === 'in') {
            clip.fadeIn = fadeMs;
            if (state.project.tracks[clip.trackId]) {
                state.project.tracks[clip.trackId].needsWaveformUpdate = true;
            }
        } else {
            clip.fadeOut = fadeMs;
            if (state.project.tracks[clip.trackId]) {
                state.project.tracks[clip.trackId].needsWaveformUpdate = true;
            }
        }

        if (typeof updateClipVisual === 'function') {
            updateClipVisual(clip);
        }

        this.updateStatusBar(fadeMs);
    },

    onMouseUp() {
        if (this.activeHandle) {
            saveState();
            this.activeHandle = null;
        }
    },

    updateStatusBar(fadeMs) {
        const el = document.getElementById('performance-status');
        if (el) {
            el.textContent = `Fade: ${fadeMs.toFixed(0)}ms`;
        }
    },

    renderHandlesForClip(clipEl, clipId) {
        const clip = state.project.clips[clipId];
        if (!clip) return;

        const fadeIn = clip.fadeIn ?? 0;
        const fadeOut = clip.fadeOut ?? 0;
        const dur = clip.duration ?? 1000;
        const inWidth = Math.min((fadeIn / dur) * 100, 50);
        const outWidth = Math.min((fadeOut / dur) * 100, 50);

        if (fadeIn > 0 && !clipEl.querySelector('.clip-fade-handle-in')) {
            const inHandle = document.createElement('div');
            inHandle.className = 'clip-fade-handle clip-fade-handle-in';
            inHandle.dataset.clipId = clipId;
            inHandle.dataset.fadeType = 'in';
            inHandle.style.cssText = 'position:absolute;top:0;left:0;width:10px;height:100%;cursor:ew-resize;z-index:5;';
            clipEl.appendChild(inHandle);

            const inOverlay = document.createElement('div');
            inOverlay.className = 'clip-fade-overlay-in';
            inOverlay.style.cssText = `position:absolute;top:0;left:0;width:${inWidth}%;height:100%;background:linear-gradient(90deg,rgba(0,0,0,0.5),transparent);pointer-events:none;`;
            clipEl.appendChild(inOverlay);
        }

        if (fadeOut > 0 && !clipEl.querySelector('.clip-fade-handle-out')) {
            const outHandle = document.createElement('div');
            outHandle.className = 'clip-fade-handle clip-fade-handle-out';
            outHandle.dataset.clipId = clipId;
            outHandle.dataset.fadeType = 'out';
            outHandle.style.cssText = 'position:absolute;top:0;right:0;width:10px;height:100%;cursor:ew-resize;z-index:5;';
            clipEl.appendChild(outHandle);

            const outOverlay = document.createElement('div');
            outOverlay.className = 'clip-fade-overlay-out';
            outOverlay.style.cssText = `position:absolute;top:0;right:0;width:${outWidth}%;height:100%;background:linear-gradient(270deg,rgba(0,0,0,0.5),transparent);pointer-events:none;`;
            clipEl.appendChild(outOverlay);
        }
    },

    clearHandlesForClip(clipEl) {
        clipEl.querySelectorAll('.clip-fade-handle, .clip-fade-overlay-in, .clip-fade-overlay-out').forEach(el => el.remove());
    }
};

window.ClipFadeHandles = ClipFadeHandles;