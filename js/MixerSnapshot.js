// js/MixerSnapshot.js - Mixer Snapshot Save/Recall System

let mixerSnapshots = {}; // { snapshotName: snapshotData }

export function getMixerSnapshots() {
    return JSON.parse(JSON.stringify(mixerSnapshots));
}

export function getMixerSnapshotNames() {
    return Object.keys(mixerSnapshots).sort();
}

export function saveMixerSnapshot(name, tracks) {
    if (!name || !name.trim()) return false;
    const snapshotName = name.trim();
    
    const tracksData = tracks.map(track => ({
        id: track.id,
        type: track.type,
        name: track.name,
        volume: track.previousVolumeBeforeMute ?? 0.7,
        isMuted: track.isMuted || false,
        isSoloed: track.isSoloed || false,
        pan: track.pan ?? 0,
        color: track.color || '#3b82f6',
        activeEffects: track.activeEffects ? track.activeEffects.map(e => ({
            id: e.id,
            type: e.type,
            params: e.params ? JSON.parse(JSON.stringify(e.params)) : {}
        })) : [],
        sendLevels: track.sendLevels ? JSON.parse(JSON.stringify(track.sendLevels)) : { reverb: 0, delay: 0 }
    }));

    mixerSnapshots[snapshotName] = {
        name: snapshotName,
        tracks: tracksData,
        createdAt: new Date().toISOString()
    };
    
    console.log(`[MixerSnapshot] Saved snapshot "${snapshotName}" with ${tracksData.length} tracks`);
    return true;
}

export function loadMixerSnapshot(name, tracks, appServices) {
    const snapshot = mixerSnapshots[name];
    if (!snapshot) {
        console.warn(`[MixerSnapshot] Snapshot "${name}" not found`);
        return false;
    }

    // Restore track states
    snapshot.tracks.forEach(snapshotTrack => {
        const track = tracks.find(t => t.id === snapshotTrack.id);
        if (!track) {
            console.warn(`[MixerSnapshot] Track ${snapshotTrack.id} not found for snapshot restore`);
            return;
        }

        // Restore volume
        if (track.setVolume && typeof track.setVolume === 'function') {
            track.setVolume(snapshotTrack.volume, true);
        }

        // Restore pan
        if (track.setPan && typeof track.setPan === 'function') {
            track.setPan(snapshotTrack.pan, true);
        }

        // Restore mute
        if (snapshotTrack.isMuted && track.setMute && typeof track.setMute === 'function') {
            track.setMute(true);
        }

        // Restore solo
        if (snapshotTrack.isSoloed && track.setSolo && typeof track.setSolo === 'function') {
            track.setSolo(true);
        }

        // Restore color
        if (track.setColor && typeof track.setColor === 'function') {
            track.setColor(snapshotTrack.color, true);
        }

        // Restore send levels
        if (snapshotTrack.sendLevels) {
            track.sendLevels = JSON.parse(JSON.stringify(snapshotTrack.sendLevels));
        }

        console.log(`[MixerSnapshot] Restored track ${track.id} (${track.name})`);
    });

    console.log(`[MixerSnapshot] Loaded snapshot "${name}"`);
    return true;
}

export function deleteMixerSnapshot(name) {
    if (mixerSnapshots[name]) {
        delete mixerSnapshots[name];
        console.log(`[MixerSnapshot] Deleted snapshot "${name}"`);
        return true;
    }
    return false;
}

export function openMixerSnapshotPanel(appServices) {
    const existingPanel = document.getElementById('mixerSnapshotPanel');
    if (existingPanel) {
        existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'mixerSnapshotPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-height: 80vh;
        background: #1e1e2e;
        border: 1px solid #3a3a4a;
        border-radius: 12px;
        padding: 20px;
        z-index: 10000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        color: #e0e0e0;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const snapshotNames = getMixerSnapshotNames();

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Mixer Snapshots</h3>
            <button id="closeMixerSnapshotPanel" style="background: none; border: none; color: #888; font-size: 20px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <input type="text" id="mixerSnapshotName" placeholder="Snapshot name" style="
                flex: 1;
                padding: 8px 12px;
                background: #2a2a3a;
                border: 1px solid #3a3a4a;
                border-radius: 6px;
                color: #e0e0e0;
                font-size: 14px;
            ">
            <button id="saveMixerSnapshotBtn" style="
                padding: 8px 16px;
                background: #3b82f6;
                border: none;
                border-radius: 6px;
                color: white;
                font-size: 14px;
                cursor: pointer;
            ">Save</button>
        </div>
        
        <div id="mixerSnapshotList" style="max-height: 300px; overflow-y: auto;">
            ${snapshotNames.length === 0 ? 
                '<p style="color: #666; text-align: center; font-size: 13px;">No snapshots saved yet</p>' :
                snapshotNames.map(name => {
                    const snap = mixerSnapshots[name];
                    const date = new Date(snap.createdAt).toLocaleDateString();
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #2a2a3a; border-radius: 6px; margin-bottom: 8px;">
                            <div>
                                <div style="font-size: 14px; font-weight: 500;">${name}</div>
                                <div style="font-size: 11px; color: #888;">${snap.tracks.length} tracks • ${date}</div>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button class="loadSnapshotBtn" data-name="${name}" style="padding: 4px 10px; background: #22c55e; border: none; border-radius: 4px; color: white; font-size: 12px; cursor: pointer;">Load</button>
                                <button class="deleteSnapshotBtn" data-name="${name}" style="padding: 4px 10px; background: #ef4444; border: none; border-radius: 4px; color: white; font-size: 12px; cursor: pointer;">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('')
            }
        </div>
    `;

    document.body.appendChild(panel);

    // Close button
    panel.querySelector('#closeMixerSnapshotPanel').addEventListener('click', () => {
        panel.remove();
    });

    // Save button
    panel.querySelector('#saveMixerSnapshotBtn').addEventListener('click', () => {
        const nameInput = panel.querySelector('#mixerSnapshotName');
        const snapshotName = nameInput.value.trim();
        if (!snapshotName) {
            appServices.showNotification?.('Please enter a snapshot name', 2000);
            return;
        }

        const tracks = appServices.getTracks();
        if (saveMixerSnapshot(snapshotName, tracks)) {
            appServices.showNotification?.(`Snapshot "${snapshotName}" saved`, 2000);
            panel.remove();
            openMixerSnapshotPanel(appServices);
        }
    });

    // Load buttons
    panel.querySelectorAll('.loadSnapshotBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            const tracks = appServices.getTracks();
            if (loadMixerSnapshot(name, tracks, appServices)) {
                appServices.showNotification?.(`Snapshot "${name}" loaded`, 2000);
                panel.remove();
            }
        });
    });

    // Delete buttons
    panel.querySelectorAll('.deleteSnapshotBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            if (deleteMixerSnapshot(name)) {
                appServices.showNotification?.(`Snapshot "${name}" deleted`, 2000);
                panel.remove();
                openMixerSnapshotPanel(appServices);
            }
        });
    });

    // Click outside to close
    setTimeout(() => {
        document.addEventListener('click', function closePanel(e) {
            if (panel && !panel.contains(e.target)) {
                panel.remove();
                document.removeEventListener('click', closePanel);
            }
        });
    }, 100);
}