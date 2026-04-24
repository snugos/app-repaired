/**
 * Quantize Strength Control - Adjust how strongly notes snap to grid (0-100%)
 * Provides a slider to control the blend between original and quantized positions
 */

let quantizeStrengthPanel = null;
let currentStrength = 100; // Default to 100%

export function openQuantizeStrengthPanel() {
    if (quantizeStrengthPanel) {
        quantizeStrengthPanel.remove();
        quantizeStrengthPanel = null;
    }
    
    const panel = document.createElement('div');
    panel.id = 'quantizeStrengthPanel';
    panel.className = 'panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 400px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
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
        <span style="color: #eee; font-size: 16px; font-weight: 600;">Quantize Strength</span>
        <button id="qsp-close" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: white; cursor: pointer;">×</button>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        padding: 20px;
    `;
    
    content.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #aaa;">Strength</span>
                <span id="qsp-value" style="color: #4a90d9; font-weight: 600;">${currentStrength}%</span>
            </div>
            <input id="qsp-slider" type="range" min="0" max="100" value="${currentStrength}" 
                style="width: 100%; height: 8px; border-radius: 4px; background: #2a2a4a; -webkit-appearance: none; cursor: pointer;">
        </div>
        
        <div style="display: flex; justify-content: space-between; color: #666; font-size: 11px; margin-top: 8px;">
            <span>0%: No snap</span>
            <span>50%: Half snap</span>
            <span>100%: Full snap</span>
        </div>
        
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #333;">
            <div style="color: #888; font-size: 12px; line-height: 1.5;">
                <strong>Preview:</strong> A note at beat 2.35 on a 1/16 grid:<br>
                0% → stays at 2.35<br>
                50% → moves to 2.40<br>
                100% → moves to 2.40
            </div>
        </div>
        
        <button id="qsp-apply" style="
            width: 100%;
            margin-top: 16px;
            padding: 10px;
            background: #4a90d9;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 14px;
        ">Apply to Selected Notes</button>
    `;
    
    panel.appendChild(header);
    panel.appendChild(content);
    
    document.body.appendChild(panel);
    quantizeStrengthPanel = panel;
    
    // Event listeners
    document.getElementById('qsp-close').onclick = closeQuantizeStrengthPanel;
    
    const slider = document.getElementById('qsp-slider');
    const valueDisplay = document.getElementById('qsp-value');
    
    slider.oninput = (e) => {
        currentStrength = parseInt(e.target.value, 10);
        valueDisplay.textContent = `${currentStrength}%`;
        updatePreview(currentStrength);
    };
    
    document.getElementById('qsp-apply').onclick = () => {
        applyQuantizeStrength(currentStrength);
    };
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!panel.contains(e.target)) {
                closeQuantizeStrengthPanel();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

function updatePreview(strength) {
    // Simple visual feedback - we could calculate an example note position
}

function applyQuantizeStrength(strength) {
    // Get selected notes and apply quantize with strength
    const selectedNotes = appServices.getSelectedNotes?.();
    if (!selectedNotes || selectedNotes.length === 0) {
        alert('No notes selected. Please select notes in the piano roll or sequencer.');
        return;
    }
    
    const gridSize = appServices.getQuantizeGrid?.() || '1/16';
    const strengthMultiplier = strength / 100;
    
    selectedNotes.forEach(note => {
        if (note.originalStart !== undefined && note.quantizedStart !== undefined) {
            // Blend between original and quantized based on strength
            const originalPos = note.originalStart;
            const quantizedPos = note.quantizedStart;
            note.startTime = originalPos + (quantizedPos - originalPos) * strengthMultiplier;
        }
    });
    
    if (appServices.updateNotes?.()) {
        appServices.updateNotes();
    }
    
    appServices.showNotification?.(`Applied ${strength}% quantize strength to ${selectedNotes.length} note(s)`, 'info');
    closeQuantizeStrengthPanel();
}

export function closeQuantizeStrengthPanel() {
    if (quantizeStrengthPanel) {
        quantizeStrengthPanel.remove();
        quantizeStrengthPanel = null;
    }
}

export function getQuantizeStrength() {
    return currentStrength;
}

export function setQuantizeStrength(value) {
    currentStrength = Math.max(0, Math.min(100, value));
}