// js/AdaptiveGrid.js - Adaptive Grid Density Based on Zoom Level
// Grid lines automatically adjust density for optimal visibility at different zoom levels

let localAppServices = {};
let gridDensity = 1; // 1=full density, 0.5=half, etc.
let currentZoom = 1;
let gridContainer = null;

// Grid density presets
const GRID_DENSITY_PRESETS = {
    ZOOM_ULTRA_WIDE: { threshold: 0.25, density: 0.125, label: '1 bar lines only' },
    ZOOM_WIDE: { threshold: 0.5, density: 0.25, label: 'beat lines only' },
    ZOOM_NORMAL: { threshold: 1.0, density: 0.5, label: '1/2 beat lines' },
    ZOOM_DETAILED: { threshold: 2.0, density: 1.0, label: '1/4 beat lines' },
    ZOOM_FINE: { threshold: 4.0, density: 2.0, label: '1/8 beat lines' },
    ZOOM_ULTRA_FINE: { threshold: Infinity, density: 4.0, label: '1/16 beat lines' }
};

export function initAdaptiveGrid(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[AdaptiveGrid] Module initialized');
}

export function setZoomLevel(zoom) {
    currentZoom = Math.max(0.1, Math.min(10, zoom));
    const newDensity = calculateGridDensity(currentZoom);
    
    if (newDensity !== gridDensity) {
        gridDensity = newDensity;
        if (gridContainer) {
            updateGridDisplay();
        }
    }
    
    return { zoom: currentZoom, density: gridDensity, label: getDensityLabel() };
}

export function calculateGridDensity(zoom) {
    if (zoom < GRID_DENSITY_PRESETS.ZOOM_ULTRA_WIDE.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_ULTRA_WIDE.density;
    } else if (zoom < GRID_DENSITY_PRESETS.ZOOM_WIDE.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_WIDE.density;
    } else if (zoom < GRID_DENSITY_PRESETS.ZOOM_NORMAL.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_NORMAL.density;
    } else if (zoom < GRID_DENSITY_PRESETS.ZOOM_DETAILED.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_DETAILED.density;
    } else if (zoom < GRID_DENSITY_PRESETS.ZOOM_FINE.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_FINE.density;
    } else {
        return GRID_DENSITY_PRESETS.ZOOM_ULTRA_FINE.density;
    }
}

export function getDensityLabel() {
    if (currentZoom < GRID_DENSITY_PRESETS.ZOOM_ULTRA_WIDE.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_ULTRA_WIDE.label;
    } else if (currentZoom < GRID_DENSITY_PRESETS.ZOOM_WIDE.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_WIDE.label;
    } else if (currentZoom < GRID_DENSITY_PRESETS.ZOOM_NORMAL.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_NORMAL.label;
    } else if (currentZoom < GRID_DENSITY_PRESETS.ZOOM_DETAILED.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_DETAILED.label;
    } else if (currentZoom < GRID_DENSITY_PRESETS.ZOOM_FINE.threshold) {
        return GRID_DENSITY_PRESETS.ZOOM_FINE.label;
    } else {
        return GRID_DENSITY_PRESETS.ZOOM_ULTRA_FINE.label;
    }
}

export function getCurrentDensity() {
    return gridDensity;
}

export function getCurrentZoom() {
    return currentZoom;
}

export function attachToContainer(containerElement) {
    gridContainer = containerElement;
    updateGridDisplay();
}

export function updateGridDisplay() {
    if (!gridContainer) return;
    
    const densityInfo = getDensityLabel();
    let gridHtml = '';
    
    // Calculate visible steps based on density
    const baseSteps = 16;
    const visibleSteps = Math.max(4, Math.round(baseSteps * gridDensity));
    const stepWidth = 100 / visibleSteps;
    
    // Draw step number headers with adaptive density
    for (let s = 0; s < visibleSteps; s++) {
        const isDownbeat = s % 4 === 0;
        const isBarLine = s % 8 === 0;
        const isSubBeat = s % 2 === 0;
        
        let textColor = 'text-gray-500';
        let fontWeight = 'font-normal';
        
        if (isBarLine) {
            textColor = 'text-blue-600';
            fontWeight = 'font-bold';
        } else if (isDownbeat) {
            textColor = 'text-blue-400';
            fontWeight = 'font-semibold';
        } else if (isSubBeat) {
            textColor = 'text-gray-400';
        }
        
        gridHtml += `
            <div class="adaptive-grid-step flex-shrink-0 text-center text-xs ${textColor} ${fontWeight}" 
                 style="width: ${stepWidth}%;" 
                 data-step="${s}"
                 data-density="${gridDensity}">
                ${isDownbeat || isBarLine ? s + 1 : ''}
            </div>
        `;
    }
    
    // Update grid class for styling
    gridContainer.className = `adaptive-grid-container grid-d-${gridDensity.toFixed(2)}`;
    
    return gridHtml;
}

export function renderAdaptiveGrid(containerId, numSteps = 16, zoom = 1) {
    const container = document.getElementById(containerId);
    if (!container) return '';
    
    setZoomLevel(zoom);
    
    const density = getCurrentDensity();
    const visibleSteps = Math.max(4, Math.round(numSteps * density));
    const stepWidth = 100 / visibleSteps;
    
    let html = '<div class="adaptive-grid">';
    
    // Step numbers row
    html += '<div class="flex mb-1">';
    for (let s = 0; s < visibleSteps; s++) {
        const isDownbeat = s % 4 === 0;
        const isBarLine = s % 8 === 0;
        
        let textClass = 'text-gray-500';
        if (isBarLine) textClass = 'text-blue-600 font-bold';
        else if (isDownbeat) textClass = 'text-blue-400 font-semibold';
        
        html += `<div class="flex-shrink-0 text-center text-xs ${textClass}" style="width: ${stepWidth}%;">${isDownbeat || isBarLine ? s + 1 : ''}</div>`;
    }
    html += '</div>';
    
    // Grid lines - horizontal
    html += '<div class="border-b border-gray-300 mb-1"></div>';
    
    // Row grid
    html += '<div class="flex flex-wrap">';
    for (let s = 0; s < visibleSteps; s++) {
        const isDownbeat = s % 4 === 0;
        const isBarLine = s % 8 === 0;
        
        let borderClass = 'border-l border-gray-200';
        if (isBarLine) borderClass = 'border-l-2 border-blue-400';
        else if (isDownbeat) borderClass = 'border-l border-blue-300';
        
        html += `<div class="flex-shrink-0 border-r border-gray-200 ${borderClass}" style="width: ${stepWidth}%;"></div>`;
    }
    html += '</div>';
    
    // Density indicator
    html += `
        <div class="mt-2 text-xs text-gray-400 flex items-center gap-2">
            <span>Grid: ${getDensityLabel()}</span>
            <span>Zoom: ${zoom.toFixed(2)}x</span>
            <span>Density: ${density.toFixed(2)}</span>
        </div>
    `;
    
    html += '</div>';
    
    container.innerHTML = html;
    return html;
}

export function getGridState() {
    return {
        zoom: currentZoom,
        density: gridDensity,
        label: getDensityLabel(),
        presets: GRID_DENSITY_PRESETS
    };
}

// Zoom in/out functions
export function zoomIn() {
    return setZoomLevel(currentZoom * 1.5);
}

export function zoomOut() {
    return setZoomLevel(currentZoom / 1.5);
}

export function resetZoom() {
    return setZoomLevel(1);
}