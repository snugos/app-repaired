// js/PrintSupport.js - Print Support System for SnugOS DAW
// This module provides printing functionality for notation and scores

/**
 * PrintLayout - Layout configuration for printing
 */
export class PrintLayout {
    constructor(config = {}) {
        this.paperSize = config.paperSize || 'A4';
        this.orientation = config.orientation || 'portrait'; // 'portrait' | 'landscape'
        this.margins = config.margins || {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
        };
        this.staffSize = config.staffSize || 'medium'; // 'small' | 'medium' | 'large'
        this.systemsPerPage = config.systemsPerPage || 4;
        this.measuresPerSystem = config.measuresPerSystem || 4;
        this.showPageNumbers = config.showPageNumbers !== false;
        this.showTitle = config.showTitle !== false;
        this.showComposer = config.showComposer !== false;
        this.showCopyright = config.showCopyright !== false;
        this.fontFamily = config.fontFamily || 'Times New Roman';
        this.fontSize = config.fontSize || 12;
        this.lineWeight = config.lineWeight || 1;
        this.colorMode = config.colorMode || 'black'; // 'black' | 'color'
        this.headerText = config.headerText || '';
        this.footerText = config.footerText || '';
    }

    toJSON() {
        return { ...this };
    }

    static fromJSON(data) {
        return new PrintLayout(data);
    }

    /**
     * Get paper dimensions in mm
     */
    getPaperDimensions() {
        const sizes = {
            'A4': { width: 210, height: 297 },
            'A3': { width: 297, height: 420 },
            'Letter': { width: 215.9, height: 279.4 },
            'Legal': { width: 215.9, height: 355.6 },
            'Tabloid': { width: 279.4, height: 431.8 }
        };
        const size = sizes[this.paperSize] || sizes['A4'];
        if (this.orientation === 'landscape') {
            return { width: size.height, height: size.width };
        }
        return size;
    }

    /**
     * Get staff height based on size setting
     */
    getStaffHeight() {
        const heights = {
            'small': 8,
            'medium': 10,
            'large': 12
        };
        return heights[this.staffSize] || 10;
    }
}

/**
 * PrintPreview - Generate print preview
 */
export class PrintPreview {
    constructor(config = {}) {
        this.layout = config.layout || new PrintLayout();
        this.scale = config.scale || 1;
        this.currentPage = 1;
        this.totalPages = 1;
    }

    /**
     * Generate preview HTML for a page
     * @param {Object} scoreData - Score data to preview
     * @param {number} pageNumber - Page number to generate
     * @returns {string} HTML string
     */
    generatePreviewHTML(scoreData, pageNumber = 1) {
        const layout = this.layout;
        const dims = layout.getPaperDimensions();
        
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Print Preview - ${scoreData.title || 'Score'}</title>
    <style>
        @page {
            size: ${dims.width}mm ${dims.height}mm;
            margin: ${layout.margins.top}mm ${layout.margins.right}mm ${layout.margins.bottom}mm ${layout.margins.left}mm;
        }
        @media print {
            body { margin: 0; }
            .page-break { page-break-before: always; }
            .no-print { display: none; }
        }
        body {
            font-family: '${layout.fontFamily}', serif;
            font-size: ${layout.fontSize}px;
            line-height: 1.4;
            color: ${layout.colorMode === 'color' ? 'inherit' : '#000'};
            background: #fff;
        }
        .page {
            width: ${dims.width}mm;
            height: ${dims.height}mm;
            padding: ${layout.margins.top}mm ${layout.margins.right}mm ${layout.margins.bottom}mm ${layout.margins.left}mm;
            box-sizing: border-box;
            position: relative;
        }
        .header {
            position: absolute;
            top: ${layout.margins.top / 2}mm;
            left: ${layout.margins.left}mm;
            right: ${layout.margins.right}mm;
            text-align: center;
            font-size: ${layout.fontSize * 0.9}px;
            color: #666;
        }
        .footer {
            position: absolute;
            bottom: ${layout.margins.bottom / 2}mm;
            left: ${layout.margins.left}mm;
            right: ${layout.margins.right}mm;
            text-align: center;
            font-size: ${layout.fontSize * 0.8}px;
            color: #666;
        }
        .title-block {
            text-align: center;
            margin-bottom: 20px;
        }
        .title {
            font-size: ${layout.fontSize * 2}px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .composer {
            font-size: ${layout.fontSize * 1.2}px;
            margin-bottom: 10px;
        }
        .copyright {
            font-size: ${layout.fontSize * 0.8}px;
            color: #666;
        }
        .staff-system {
            margin-bottom: ${layout.getStaffHeight() * 2}mm;
            border-bottom: ${layout.lineWeight}px solid #000;
        }
        .staff-line {
            height: ${layout.getStaffHeight() / 5}mm;
            border-bottom: ${layout.lineWeight}px solid ${layout.colorMode === 'color' ? '#333' : '#000'};
            margin: 0;
            padding: 0;
        }
        .measure {
            display: inline-block;
            border-left: ${layout.lineWeight}px solid ${layout.colorMode === 'color' ? '#333' : '#000'};
            padding-left: 5px;
            min-width: ${(dims.width - layout.margins.left - layout.margins.right) / layout.measuresPerSystem}mm;
        }
        .note {
            position: relative;
            display: inline-block;
            width: 8px;
            height: 8px;
            background: ${layout.colorMode === 'color' ? '#000' : '#000'};
            border-radius: 50%;
            margin-right: 2px;
        }
        .note.stem-up::before {
            content: '';
            position: absolute;
            right: -1px;
            top: -20px;
            width: 1px;
            height: 20px;
            background: inherit;
        }
        .rest {
            position: relative;
            display: inline-block;
            width: 10px;
            height: 10px;
            margin-right: 2px;
        }
        .rest.whole::before {
            content: '𝄻';
            font-size: 20px;
        }
        .rest.half::before {
            content: '𝄼';
            font-size: 16px;
        }
        .rest.quarter::before {
            content: '𝄽';
            font-size: 14px;
        }
        .page-number {
            position: absolute;
            bottom: ${layout.margins.bottom / 2}mm;
            right: ${layout.margins.right}mm;
            font-size: ${layout.fontSize * 0.8}px;
        }
        .clef {
            font-size: ${layout.getStaffHeight() * 2}px;
            margin-right: 5px;
        }
        .time-signature {
            font-size: ${layout.getStaffHeight() * 1.5}px;
            margin-right: 5px;
            font-weight: bold;
        }
        .key-signature {
            font-size: ${layout.getStaffHeight() * 1.2}px;
            margin-right: 5px;
        }
        .ledger-line {
            width: 15px;
            height: 1px;
            background: ${layout.colorMode === 'color' ? '#333' : '#000'};
            position: absolute;
        }
        .dynamics {
            font-style: italic;
            font-size: ${layout.fontSize}px;
            margin: 5px 0;
        }
        .lyrics {
            font-size: ${layout.fontSize * 0.8}px;
            margin-top: 5px;
            text-align: center;
        }
        .tempo-marking {
            font-style: italic;
            font-size: ${layout.fontSize}px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="page" id="page-${pageNumber}">
        ${layout.showTitle ? this._generateTitleBlock(scoreData) : ''}
        ${this._generateContent(scoreData, pageNumber)}
        ${layout.headerText ? `<div class="header">${layout.headerText}</div>` : ''}
        ${layout.footerText ? `<div class="footer">${layout.footerText}</div>` : ''}
        ${layout.showPageNumbers ? `<div class="page-number">Page ${pageNumber}</div>` : ''}
    </div>
</body>
</html>`;
        return html;
    }

    /**
     * Generate title block
     * @private
     */
    _generateTitleBlock(scoreData) {
        return `
            <div class="title-block">
                <div class="title">${scoreData.title || 'Untitled'}</div>
                ${this.layout.showComposer && scoreData.composer ? 
                    `<div class="composer">${scoreData.composer}</div>` : ''}
                ${this.layout.showCopyright && scoreData.copyright ? 
                    `<div class="copyright">© ${new Date().getFullYear()} ${scoreData.copyright}</div>` : ''}
            </div>`;
    }

    /**
     * Generate content for the page
     * @private
     */
    _generateContent(scoreData, pageNumber) {
        // Generate staff systems
        let content = '';
        content += `<div class="tempo-marking">♩ = ${scoreData.tempo || 120}</div>`;
        
        const tracks = scoreData.tracks || [];
        for (const track of tracks) {
            content += this._generateStaffSystem(track, scoreData);
        }
        
        return content;
    }

    /**
     * Generate a staff system
     * @private
     */
    _generateStaffSystem(track, scoreData) {
        const measures = track.measures || [];
        let system = `<div class="staff-system">`;
        system += `<div style="font-weight: bold; margin-bottom: 5px;">${track.name || 'Track'}</div>`;
        
        // Generate 5 staff lines
        for (let line = 0; line < 5; line++) {
            system += `<div class="staff-line"></div>`;
        }
        
        // Add clef, key signature, time signature
        system = `<div class="clef">𝄞</div>
            <div class="key-signature">${scoreData.keySignature || 'C'}</div>
            <div class="time-signature">${scoreData.timeSignature?.join('/') || '4/4'}</div>
            ` + system;
        
        // Add measures
        for (let m = 0; m < this.layout.measuresPerSystem; m++) {
            const measure = measures[m] || [];
            system += `<div class="measure">`;
            for (const note of measure) {
                system += this._generateNoteElement(note);
            }
            system += `</div>`;
        }
        
        system += `</div>`;
        return system;
    }

    /**
     * Generate note element
     * @private
     */
    _generateNoteElement(note) {
        if (note.isRest) {
            const restType = note.duration >= 1 ? 'whole' : 
                            note.duration >= 0.5 ? 'half' : 'quarter';
            return `<span class="rest ${restType}"></span>`;
        }
        
        const noteClass = note.stemUp ? 'note stem-up' : 'note';
        return `<span class="${noteClass}" title="${note.name || ''}"></span>`;
    }
}

/**
 * PrintManager - Main class for print management
 */
export class PrintManager {
    constructor(config = {}) {
        this.layout = config.layout || new PrintLayout();
        this.previewWindow = null;
        this.isPrinting = false;
    }

    /**
     * Set print layout
     * @param {PrintLayout} layout - New layout
     */
    setLayout(layout) {
        this.layout = layout;
    }

    /**
     * Get current layout
     * @returns {PrintLayout} Current layout
     */
    getLayout() {
        return this.layout;
    }

    /**
     * Generate print preview
     * @param {Object} scoreData - Score data to preview
     * @param {Object} options - Preview options
     * @returns {string} Preview HTML
     */
    generatePreview(scoreData, options = {}) {
        const preview = new PrintPreview({
            layout: this.layout,
            scale: options.scale || 1
        });
        return preview.generatePreviewHTML(scoreData, options.pageNumber || 1);
    }

    /**
     * Open print preview in new window
     * @param {Object} scoreData - Score data to preview
     * @param {Object} options - Preview options
     * @returns {Window} Preview window
     */
    openPreviewWindow(scoreData, options = {}) {
        const html = this.generatePreview(scoreData, options);
        
        // Open new window
        const width = 800;
        const height = 1000;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        this.previewWindow = window.open(
            '',
            'PrintPreview',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
        if (this.previewWindow) {
            this.previewWindow.document.write(html);
            this.previewWindow.document.close();
        }
        
        return this.previewWindow;
    }

    /**
     * Print directly without preview
     * @param {Object} scoreData - Score data to print
     * @param {Object} options - Print options
     */
    print(scoreData, options = {}) {
        if (this.isPrinting) return;
        this.isPrinting = true;

        const html = this.generatePreview(scoreData, options);
        
        // Create hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.left = '-9999px';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.write(html);
        iframeDoc.close();

        // Wait for content to load
        iframe.onload = () => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                console.error('[PrintManager] Print error:', e);
            }
            
            // Clean up after print dialog closes
            setTimeout(() => {
                document.body.removeChild(iframe);
                this.isPrinting = false;
            }, 1000);
        };

        // Handle immediate print for browsers that don't trigger onload
        if (iframeDoc.readyState === 'complete') {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                console.error('[PrintManager] Print error:', e);
            }
            setTimeout(() => {
                document.body.removeChild(iframe);
                this.isPrinting = false;
            }, 1000);
        }
    }

    /**
     * Print from existing preview window
     */
    printFromPreview() {
        if (this.previewWindow && !this.previewWindow.closed) {
            this.previewWindow.focus();
            this.previewWindow.print();
        }
    }

    /**
     * Close preview window
     */
    closePreview() {
        if (this.previewWindow && !this.previewWindow.closed) {
            this.previewWindow.close();
        }
        this.previewWindow = null;
    }

    /**
     * Export to PDF (using browser's print to PDF)
     * @param {Object} scoreData - Score data to export
     * @param {string} filename - Output filename
     * @param {Object} options - Export options
     */
    exportToPDF(scoreData, filename = 'score.pdf', options = {}) {
        // This will open print dialog where user can select "Save as PDF"
        this.print(scoreData, {
            ...options,
            filename
        });
    }

    /**
     * Calculate total pages needed
     * @param {Object} scoreData - Score data
     * @returns {number} Total pages
     */
    calculatePageCount(scoreData) {
        const tracks = scoreData.tracks || [];
        const totalMeasures = Math.max(...tracks.map(t => t.measures?.length || 0));
        const measuresPerPage = this.layout.systemsPerPage * this.layout.measuresPerSystem;
        return Math.ceil(totalMeasures / measuresPerPage);
    }

    /**
     * Generate print styles
     * @returns {string} CSS styles for printing
     */
    generatePrintStyles() {
        const layout = this.layout;
        const dims = layout.getPaperDimensions();
        
        return `
@media print {
    @page {
        size: ${dims.width}mm ${dims.height}mm;
        margin: ${layout.margins.top}mm ${layout.margins.right}mm ${layout.margins.bottom}mm ${layout.margins.left}mm;
    }
    
    body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .page-break {
        page-break-before: always;
    }
    
    .no-print {
        display: none !important;
    }
    
    .print-only {
        display: block !important;
    }
}

@media screen {
    .print-only {
        display: none !important;
    }
}`;
    }

    /**
     * Get available paper sizes
     * @returns {Array} List of paper sizes
     */
    static getAvailablePaperSizes() {
        return [
            { id: 'A4', name: 'A4 (210 x 297 mm)' },
            { id: 'A3', name: 'A3 (297 x 420 mm)' },
            { id: 'Letter', name: 'US Letter (8.5 x 11 in)' },
            { id: 'Legal', name: 'US Legal (8.5 x 14 in)' },
            { id: 'Tabloid', name: 'Tabloid (11 x 17 in)' }
        ];
    }

    /**
     * Get available staff sizes
     * @returns {Array} List of staff sizes
     */
    static getAvailableStaffSizes() {
        return [
            { id: 'small', name: 'Small' },
            { id: 'medium', name: 'Medium' },
            { id: 'large', name: 'Large' }
        ];
    }

    /**
     * Create print UI panel
     * @param {Object} scoreData - Score data
     * @param {HTMLElement} container - Container element
     * @param {Function} onPrint - Callback when print is clicked
     * @returns {HTMLElement} Panel element
     */
    createPrintPanel(scoreData, container, onPrint) {
        const panel = document.createElement('div');
        panel.className = 'print-panel';
        panel.innerHTML = `
            <div class="print-panel-header">
                <h3>Print Settings</h3>
            </div>
            <div class="print-panel-body">
                <div class="print-option">
                    <label>Paper Size:</label>
                    <select id="paperSize">
                        ${PrintManager.getAvailablePaperSizes().map(s => 
                            `<option value="${s.id}" ${this.layout.paperSize === s.id ? 'selected' : ''}>${s.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="print-option">
                    <label>Orientation:</label>
                    <select id="orientation">
                        <option value="portrait" ${this.layout.orientation === 'portrait' ? 'selected' : ''}>Portrait</option>
                        <option value="landscape" ${this.layout.orientation === 'landscape' ? 'selected' : ''}>Landscape</option>
                    </select>
                </div>
                
                <div class="print-option">
                    <label>Staff Size:</label>
                    <select id="staffSize">
                        ${PrintManager.getAvailableStaffSizes().map(s => 
                            `<option value="${s.id}" ${this.layout.staffSize === s.id ? 'selected' : ''}>${s.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="print-option">
                    <label>Systems per Page:</label>
                    <input type="number" id="systemsPerPage" value="${this.layout.systemsPerPage}" min="1" max="10">
                </div>
                
                <div class="print-option">
                    <label>Measures per System:</label>
                    <input type="number" id="measuresPerSystem" value="${this.layout.measuresPerSystem}" min="1" max="8">
                </div>
                
                <div class="print-option checkbox">
                    <input type="checkbox" id="showTitle" ${this.layout.showTitle ? 'checked' : ''}>
                    <label for="showTitle">Show Title</label>
                </div>
                
                <div class="print-option checkbox">
                    <input type="checkbox" id="showPageNumbers" ${this.layout.showPageNumbers ? 'checked' : ''}>
                    <label for="showPageNumbers">Show Page Numbers</label>
                </div>
                
                <div class="print-option">
                    <label>Color Mode:</label>
                    <select id="colorMode">
                        <option value="black" ${this.layout.colorMode === 'black' ? 'selected' : ''}>Black & White</option>
                        <option value="color" ${this.layout.colorMode === 'color' ? 'selected' : ''}>Color</option>
                    </select>
                </div>
            </div>
            <div class="print-panel-footer">
                <button class="btn-preview" id="previewBtn">Preview</button>
                <button class="btn-print" id="printBtn">Print</button>
            </div>
        `;

        // Add event listeners
        const updateLayout = () => {
            this.layout.paperSize = document.getElementById('paperSize').value;
            this.layout.orientation = document.getElementById('orientation').value;
            this.layout.staffSize = document.getElementById('staffSize').value;
            this.layout.systemsPerPage = parseInt(document.getElementById('systemsPerPage').value, 10);
            this.layout.measuresPerSystem = parseInt(document.getElementById('measuresPerSystem').value, 10);
            this.layout.showTitle = document.getElementById('showTitle').checked;
            this.layout.showPageNumbers = document.getElementById('showPageNumbers').checked;
            this.layout.colorMode = document.getElementById('colorMode').value;
        };

        panel.querySelector('#previewBtn').addEventListener('click', () => {
            updateLayout();
            this.openPreviewWindow(scoreData);
        });

        panel.querySelector('#printBtn').addEventListener('click', () => {
            updateLayout();
            if (onPrint) onPrint();
            this.print(scoreData);
        });

        if (container) {
            container.appendChild(panel);
        }

        return panel;
    }
}

// Create singleton instance
export const printManager = new PrintManager();

// Default export
export default {
    PrintLayout,
    PrintPreview,
    PrintManager,
    printManager
};