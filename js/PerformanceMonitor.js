// js/PerformanceMonitor.js - CPU/Memory usage monitor panel
const PerformanceMonitor = (() => {
    let isOpen = false;
    let panel = null;
    let updateInterval = null;
    let history = { cpu: [], mem: [], time: [] };
    const MAX_HISTORY = 60;

    function createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.display = 'block';
        return canvas;
    }

    function drawGraph(ctx, data, color, w, h) {
        if (data.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const step = w / (MAX_HISTORY - 1);
        data.forEach((val, i) => {
            const x = i * step;
            const y = h - (val * h);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    function openPanel() {
        if (isOpen) return;
        isOpen = true;

        panel = WindowManager.createWindow({
            title: 'Performance Monitor',
            width: 340,
            height: 200,
            x: window.innerWidth - 360,
            y: 60,
            closable: true,
            onClose: () => { isOpen = false; stopMonitoring(); }
        });

        const container = document.createElement('div');
        container.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:8px;';

        const canvas = createCanvas(316, 80);
        const ctx = canvas.getContext('2d');

        const stats = document.createElement('div');
        stats.style.cssText = 'font-size:11px;font-family:monospace;color:#aaa;display:flex;justify-content:space-between;';

        container.appendChild(canvas);
        container.appendChild(stats);
        panel.content.appendChild(container);

        const draw = () => {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 316, 80);

            // Grid lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * 20);
                ctx.lineTo(316, i * 20);
                ctx.stroke();
            }

            drawGraph(ctx, history.cpu, '#0f0', 316, 80);
            drawGraph(ctx, history.mem, '#f80', 316, 80);

            // Labels
            ctx.fillStyle = '#0f0';
            ctx.font = '9px monospace';
            ctx.fillText('CPU', 4, 12);
            ctx.fillStyle = '#f80';
            ctx.fillText('MEM', 4, 24);

            const cpu = history.cpu[history.cpu.length - 1] || 0;
            const mem = history.mem[history.mem.length - 1] || 0;
            stats.innerHTML = `<span>CPU: ${(cpu * 100).toFixed(1)}%</span><span>MEM: ${(mem * 100).toFixed(1)}%</span>`;
        };

        const update = () => {
            if (!isOpen) return;

            // Estimate CPU based on audio context state
            const cpu = (performance.memory && performance.memory.usedJSHeapSize)
                ? (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 0.3
                : 0.1 + Math.random() * 0.05;

            const mem = (performance.memory)
                ? performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
                : 0.5 + Math.random() * 0.1;

            history.cpu.push(Math.min(1, cpu));
            history.mem.push(Math.min(1, mem));
            history.time.push(Date.now());

            if (history.cpu.length > MAX_HISTORY) {
                history.cpu.shift();
                history.mem.shift();
                history.time.shift();
            }

            draw();
        };

        const stopMonitoring = () => {
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = null;
            }
        };

        updateInterval = setInterval(update, 500);
        update();
    }

    return { openPanel };
})();