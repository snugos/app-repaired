// Performance Monitor - CPU/Memory load indicator
// Lightweight performance tracking for SnugOS DAW

let cpuHistory = [];
let memoryHistory = [];
const HISTORY_SIZE = 30;

function getCPULoad() {
    if (performance && performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        const total = performance.memory.totalJSHeapSize;
        if (total > 0) {
            return Math.round((used / total) * 100);
        }
    }
    return null;
}

function getMemoryUsageMB() {
    if (performance && performance.memory) {
        return Math.round(performance.memory.usedJSHeapSize / 1048576);
    }
    return null;
}

function updatePerformanceMetrics() {
    const cpu = getCPULoad();
    if (cpu !== null) {
        cpuHistory.push(cpu);
        if (cpuHistory.length > HISTORY_SIZE) cpuHistory.shift();
    }
    const mem = getMemoryUsageMB();
    if (mem !== null) {
        memoryHistory.push(mem);
        if (memoryHistory.length > HISTORY_SIZE) memoryHistory.shift();
    }
}

function getAverageCPU() {
    if (cpuHistory.length === 0) return 0;
    return Math.round(cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length);
}

function getAverageMemory() {
    if (memoryHistory.length === 0) return 0;
    return Math.round(memoryHistory.reduce((a, b) => a + b, 0) / memoryHistory.length);
}

function createPerformanceIndicatorHTML() {
    const cpu = getCPULoad();
    const mem = getMemoryUsageMB();
    const avgCpu = getAverageCPU();
    const avgMem = getAverageMemory();
    const timestamp = Date.now();
    
    return `
        <div class="perf-indicator" id="perf-indicator" title="CPU: ${avgCpu}% avg | Mem: ${avgMem}MB avg">
            <div class="perf-cpu" id="perf-cpu">
                <span class="perf-label">CPU</span>
                <span class="perf-value" id="perf-cpu-val">${cpu !== null ? cpu + '%' : 'N/A'}</span>
            </div>
            <div class="perf-mem" id="perf-mem">
                <span class="perf-label">MEM</span>
                <span class="perf-value" id="perf-mem-val">${mem !== null ? mem + 'MB' : 'N/A'}</span>
            </div>
        </div>
    `;
}

function initPerformanceMonitor() {
    updatePerformanceMetrics();
    setInterval(updatePerformanceMetrics, 2000);
    console.log('[PerformanceMonitor] Initialized - CPU/Memory tracking active');
}

function getPerformanceSnapshot() {
    return {
        cpuLoad: getCPULoad(),
        cpuAvg: getAverageCPU(),
        memoryMB: getMemoryUsageMB(),
        memoryAvg: getAverageMemory(),
        cpuHistory: [...cpuHistory],
        memoryHistory: [...memoryHistory],
        timestamp: Date.now()
    };
}

function openPerformancePanel() {
    const snapshot = getPerformanceSnapshot();
    const panelHTML = `
        <div class="snug-window perf-panel" id="perf-panel-window" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;z-index:10000;">
            <div class="snug-window-header" style="background:#1a1a2e;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
                <span>Performance Monitor</span>
                <button onclick="closePerformancePanel()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">&times;</button>
            </div>
            <div class="snug-window-content" style="background:#16213e;color:#eee;padding:16px;">
                <div style="margin-bottom:12px;">
                    <strong>Current CPU:</strong> ${snapshot.cpuLoad !== null ? snapshot.cpuLoad + '%' : 'N/A'}
                </div>
                <div style="margin-bottom:12px;">
                    <strong>Average CPU:</strong> ${snapshot.cpuAvg}%
                </div>
                <div style="margin-bottom:12px;">
                    <strong>Current Memory:</strong> ${snapshot.memoryMB !== null ? snapshot.memoryMB + ' MB' : 'N/A'}
                </div>
                <div style="margin-bottom:12px;">
                    <strong>Average Memory:</strong> ${snapshot.memoryAvg} MB
                </div>
                <div style="margin-top:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span>CPU History (last ${snapshot.cpuHistory.length})</span>
                    </div>
                    <div id="perf-chart-cpu" style="height:60px;background:#0f3460;border-radius:4px;padding:4px;display:flex;align-items:flex-end;gap:2px;"></div>
                </div>
                <div style="margin-top:12px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span>Memory History (last ${snapshot.memoryHistory.length})</span>
                    </div>
                    <div id="perf-chart-mem" style="height:60px;background:#0f3460;border-radius:4px;padding:4px;display:flex;align-items:flex-end;gap:2px;"></div>
                </div>
            </div>
        </div>
    `;
    
    const existing = document.getElementById('perf-panel-window');
    if (existing) existing.remove();
    
    const container = document.createElement('div');
    container.innerHTML = panelHTML;
    document.body.appendChild(container);
    
    renderPerformanceCharts(snapshot);
}

function renderPerformanceCharts(snapshot) {
    const maxCPU = Math.max(...snapshot.cpuHistory, 100);
    const maxMem = Math.max(...snapshot.memoryHistory, 100);
    
    const cpuContainer = document.getElementById('perf-chart-cpu');
    const memContainer = document.getElementById('perf-chart-mem');
    
    if (cpuContainer) {
        cpuContainer.innerHTML = snapshot.cpuHistory.map(v => {
            const h = Math.max(2, Math.round((v / maxCPU) * 52));
            const color = v > 80 ? '#e74c3c' : v > 60 ? '#f39c12' : '#2ecc71';
            return `<div style="flex:1;height:${h}px;background:${color};border-radius:2px 2px 0 0;" title="${v}%"></div>`;
        }).join('');
    }
    
    if (memContainer) {
        memContainer.innerHTML = snapshot.memoryHistory.map(v => {
            const h = Math.max(2, Math.round((v / maxMem) * 52));
            return `<div style="flex:1;height:${h}px;background:#3498db;border-radius:2px 2px 0 0;" title="${v}MB"></div>`;
        }).join('');
    }
}

function closePerformancePanel() {
    const panel = document.getElementById('perf-panel-window');
    if (panel) panel.remove();
}

function addPerformanceIndicatorToStatusBar() {
    const controlsBar = document.getElementById('globalControlsBar');
    if (!controlsBar) return;
    
    const indicatorHTML = `
        <div id="perf-indicator" class="perf-indicator" title="CPU/Memory Monitor">
            <span class="perf-value" id="perf-cpu-val">--%</span>
            <span class="perf-divider">|</span>
            <span class="perf-value" id="perf-mem-val">--MB</span>
        </div>
    `;
    const existing = document.getElementById('perf-indicator');
    if (existing) existing.remove();
    
    controlsBar.insertAdjacentHTML('beforeend', indicatorHTML);
    
    const updateInterval = setInterval(() => {
        const cpuEl = document.getElementById('perf-cpu-val');
        const memEl = document.getElementById('perf-mem-val');
        if (cpuEl) {
            const cpu = getCPULoad();
            cpuEl.textContent = cpu !== null ? cpu + '%' : 'N/A';
            cpuEl.style.color = cpu !== null && cpu > 80 ? '#e74c3c' : cpu !== null && cpu > 60 ? '#f39c12' : '#2ecc71';
        }
        if (memEl) {
            const mem = getMemoryUsageMB();
            memEl.textContent = mem !== null ? mem + 'MB' : 'N/A';
        }
    }, 2000);
    
    console.log('[PerformanceMonitor] CPU display added to transport bar');
}

function initPerformanceIndicator() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(addPerformanceIndicatorToStatusBar, 1000);
        });
    } else {
        setTimeout(addPerformanceIndicatorToStatusBar, 1000);
    }
}

window.initPerformanceMonitor = initPerformanceMonitor;
window.openPerformancePanel = openPerformancePanel;
window.closePerformancePanel = closePerformancePanel;
window.initPerformanceIndicator = initPerformanceIndicator;
window.getPerformanceSnapshot = getPerformanceSnapshot;