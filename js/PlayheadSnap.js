// js/PlayheadSnap.js - Snap playhead to grid divisions
(function() {
    'use strict';

    const SNAP_RESOLUTIONS = [
        { label: '1/1', beats: 4 },
        { label: '1/2', beats: 2 },
        { label: '1/4', beats: 1 },
        { label: '1/8', beats: 0.5 },
        { label: '1/16', beats: 0.25 },
        { label: '1/32', beats: 0.125 }
    ];

    let currentResolution = null;
    let snapEnabled = true;
    let playheadSnapPanel = null;

    function snapPlayhead(position, bpm) {
        if (!snapEnabled || !currentResolution || position === undefined) return position;
        const beatsPerBar = 4;
        const bars = position / beatsPerBar;
        const snappedBars = Math.round(bars / currentResolution.beats) * currentResolution.beats;
        return snappedBars * beatsPerBar;
    }

    function toggleSnap(resolution) {
        if (currentResolution === resolution) {
            snapEnabled = !snapEnabled;
        } else {
            currentResolution = resolution;
            snapEnabled = true;
        }
        updateStatusIndicator();
        return { resolution: currentResolution, enabled: snapEnabled };
    }

    function updateStatusIndicator() {
        const indicator = document.getElementById('snapStatusIndicator');
        if (indicator) {
            indicator.textContent = snapEnabled && currentResolution
                ? `Snap: ${currentResolution.label}`
                : 'Snap: Off';
        }
    }

    function openSnapPanel() {
        if (playheadSnapPanel) {
            playheadSnapPanel.remove();
            playheadSnapPanel = null;
            return;
        }

        playheadSnapPanel = document.createElement('div');
        playheadSnapPanel.id = 'snapPanel';
        playheadSnapPanel.style.cssText = `
            position: fixed; bottom: 80px; right: 20px;
            background: #1a1a2e; border: 1px solid #333;
            border-radius: 8px; padding: 12px; z-index: 10000;
            font-family: system-ui; font-size: 12px; color: #ccc;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('div');
        title.textContent = 'Playhead Snap';
        title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #fff;';

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;';

        SNAP_RESOLUTIONS.forEach(res => {
            const btn = document.createElement('button');
            btn.textContent = res.label;
            btn.style.cssText = `
                padding: 6px 8px; background: #2a2a4a; border: 1px solid #444;
                border-radius: 4px; color: #ccc; cursor: pointer;
            `;
            btn.onclick = () => {
                toggleSnap(res);
                updateButtons();
            };
            grid.appendChild(btn);
        });

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'snapToggleBtn';
        toggleBtn.textContent = snapEnabled ? 'Disable Snap' : 'Enable Snap';
        toggleBtn.style.cssText = `
            margin-top: 8px; width: 100%; padding: 8px;
            background: ${snapEnabled ? '#2d5a2d' : '#5a2d2d'}; border: 1px solid #444;
            border-radius: 4px; color: #fff; cursor: pointer;
        `;
        toggleBtn.onclick = () => {
            snapEnabled = !snapEnabled;
            toggleBtn.textContent = snapEnabled ? 'Disable Snap' : 'Enable Snap';
            toggleBtn.style.background = snapEnabled ? '#2d5a2d' : '#5a2d2d';
            updateStatusIndicator();
            updateButtons();
        };

        function updateButtons() {
            grid.querySelectorAll('button').forEach(b => {
                b.style.background = b.textContent === (currentResolution && currentResolution.label)
                    ? '#3a3a6a' : '#2a2a4a';
                b.style.color = b.textContent === (currentResolution && currentResolution.label)
                    ? '#fff' : '#ccc';
            });
        }

        playheadSnapPanel.appendChild(title);
        playheadSnapPanel.appendChild(grid);
        playheadSnapPanel.appendChild(toggleBtn);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute; top: 4px; right: 8px;
            background: none; border: none; color: #888; cursor: pointer; font-size: 14px;
        `;
        closeBtn.onclick = () => {
            playheadSnapPanel.remove();
            playheadSnapPanel = null;
        };
        playheadSnapPanel.appendChild(closeBtn);

        document.body.appendChild(playheadSnapPanel);
    }

    // Auto-create status indicator in transport
    function createStatusIndicator() {
        if (document.getElementById('snapStatusIndicator')) return;
        const indicator = document.createElement('span');
        indicator.id = 'snapStatusIndicator';
        indicator.textContent = 'Snap: Off';
        indicator.style.cssText = `
            margin-left: 8px; padding: 2px 6px; background: #2a2a4a;
            border-radius: 4px; font-size: 11px; color: #888;
        `;
        const transport = document.querySelector('.transport-bar');
        if (transport) transport.appendChild(indicator);
    }

    // Hook into transport bar creation
    const origInit = window.initTransportBar;
    window.initTransportBar = function(...args) {
        if (origInit) origInit.apply(this, args);
        setTimeout(createStatusIndicator, 500);
    };

    window.playheadSnap = {
        snap: snapPlayhead,
        toggle: toggleSnap,
        openPanel: openSnapPanel,
        getResolutions: () => SNAP_RESOLUTIONS,
        isEnabled: () => snapEnabled,
        getCurrentResolution: () => currentResolution
    };

    console.log('[PlayheadSnap] Module loaded');
})();