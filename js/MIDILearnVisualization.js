/**
 * MIDI Learn Visualization - Show MIDI CC mappings visually on knobs and sliders
 * Displays which parameters are mapped to MIDI controllers with real-time feedback
 */

let midiLearnVizPanel = null;
let activeMappings = {};
let animationFrame = null;

export function openMIDILearnVisualizationPanel() {
    if (midiLearnVizPanel) {
        midiLearnVizPanel.remove();
        midiLearnVizPanel = null;
    }
    
    // Get current MIDI mappings
    activeMappings = appServices.getMidiMappings?.() || {};
    
    const panel = document.createElement('div');
    panel.id = 'midiLearnVizPanel';
    panel.className = 'panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 500px;
        max-height: 70vh;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 16px 20px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #16213e;
        border-radius: 8px 8px 0 0;
    `;
    header.innerHTML = `
        <span style="color: #eee; font-size: 16px; font-weight: 600;">MIDI Learn Mappings</span>
        <div>
            <button id="mlv-refresh" style="margin-right: 8px; padding: 6px 12px; background: #4a90d9; border: none; border-radius: 4px; color: white; cursor: pointer;">Refresh</button>
            <button id="mlv-close" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: white; cursor: pointer;">×</button>
        </div>
    `;
    
    const content = document.createElement('div');
    content.id = 'mlv-content';
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
    `;
    
    if (Object.keys(activeMappings).length === 0) {
        content.innerHTML = `
            <div style="color: #888; text-align: center; padding: 40px 20px; font-style: italic;">
                No MIDI mappings configured.<br>
                Click "MIDI Learn" on any knob or slider to create one.
            </div>
        `;
    } else {
        content.innerHTML = renderMappingsList();
    }
    
    const footer = document.createElement('div');
    footer.style.cssText = `
        padding: 12px 20px;
        border-top: 1px solid #333;
        background: #16213e;
        border-radius: 0 0 8px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    footer.innerHTML = `
        <div style="color: #888; font-size: 12px;">
            ${Object.keys(activeMappings).length} active mapping(s)
        </div>
        <button id="mlv-clear-all" style="padding: 6px 12px; background: #dc3545; border: none; border-radius: 4px; color: white; cursor: pointer;">Clear All</button>
    `;
    
    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(footer);
    
    document.body.appendChild(panel);
    midiLearnVizPanel = panel;
    
    // Event listeners
    document.getElementById('mlv-close').onclick = closeMIDILearnVisualizationPanel;
    document.getElementById('mlv-refresh').onclick = () => {
        activeMappings = appServices.getMidiMappings?.() || {};
        document.getElementById('mlv-content').innerHTML = renderMappingsList();
        setupMappingInteractions();
    };
    document.getElementById('mlv-clear-all').onclick = () => {
        if (confirm('Clear all MIDI mappings?')) {
            appServices.clearAllMidiMappings?.();
            closeMIDILearnVisualizationPanel();
        }
    };
    
    setupMappingInteractions();
    startCCAnimation();
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!panel.contains(e.target)) {
                closeMIDILearnVisualizationPanel();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

function renderMappingsList() {
    const entries = Object.entries(activeMappings);
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    
    for (const [key, mapping] of entries) {
        const [cc, channel] = key.split('_channel');
        const ccValue = appServices.getCcVisualizerValues?.()[key] || 0;
        const barWidth = (ccValue / 127) * 100;
        
        html += `
            <div class="mlv-mapping" data-key="${key}" style="
                padding: 12px 16px;
                background: #0f0f1a;
                border: 1px solid #333;
                border-radius: 6px;
                transition: all 0.2s;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="
                            background: linear-gradient(90deg, #4a90d9 ${barWidth}%, #2a2a4a ${barWidth}%);
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-family: monospace;
                            color: #eee;
                            min-width: 80px;
                        ">
                            CC ${cc}
                        </div>
                        <span style="color: #888; font-size: 12px;">Ch ${channel || 'All'}</span>
                    </div>
                    <button class="mlv-remove" data-key="${key}" style="
                        padding: 4px 8px;
                        background: #dc3545;
                        border: none;
                        border-radius: 4px;
                        color: white;
                        cursor: pointer;
                        font-size: 11px;
                    ">Remove</button>
                </div>
                <div style="color: #aaa; font-size: 13px;">
                    <strong>Target:</strong> ${formatTarget(mapping)}
                </div>
                <div style="margin-top: 8px;">
                    <div style="
                        height: 6px;
                        background: #2a2a4a;
                        border-radius: 3px;
                        overflow: hidden;
                    ">
                        <div class="mlv-cc-bar" data-key="${key}" style="
                            height: 100%;
                            width: ${barWidth}%;
                            background: linear-gradient(90deg, #4a90d9, #7bc4ff);
                            transition: width 0.05s;
                        "></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function formatTarget(mapping) {
    if (!mapping) return 'Unknown';
    switch (mapping.type) {
        case 'track':
            return `Track ${mapping.targetId} - ${mapping.paramPath || 'parameter'}`;
        case 'master':
            return `Master - ${mapping.paramPath || 'parameter'}`;
        case 'effect':
            return `Effect ${mapping.targetId} - ${mapping.paramPath || 'parameter'}`;
        default:
            return mapping.paramPath || 'Unknown';
    }
}

function setupMappingInteractions() {
    document.querySelectorAll('.mlv-remove').forEach(btn => {
        btn.onclick = (e) => {
            const key = e.target.dataset.key;
            if (confirm('Remove this MIDI mapping?')) {
                appServices.removeMidiMapping?.(key);
                activeMappings = appServices.getMidiMappings?.() || {};
                document.getElementById('mlv-content').innerHTML = renderMappingsList();
                setupMappingInteractions();
            }
        };
    });
}

function startCCAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    
    const update = () => {
        const ccValues = appServices.getCcVisualizerValues?.() || {};
        
        document.querySelectorAll('.mlv-mapping').forEach(el => {
            const key = el.dataset.key;
            const bar = el.querySelector('.mlv-cc-bar');
            const ccDisplay = el.querySelector('div[style*="CC"]');
            
            if (bar && ccValues[key] !== undefined) {
                const width = (ccValues[key] / 127) * 100;
                bar.style.width = `${width}%`;
            }
            
            if (ccDisplay) {
                const cc = key.split('_channel')[0];
                const val = ccValues[key] || 0;
                ccDisplay.textContent = `CC ${cc}: ${val}`;
            }
        });
        
        animationFrame = requestAnimationFrame(update);
    };
    
    animationFrame = requestAnimationFrame(update);
}

export function closeMIDILearnVisualizationPanel() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    if (midiLearnVizPanel) {
        midiLearnVizPanel.remove();
        midiLearnVizPanel = null;
    }
}