// js/daw/ui/youtubeImporterUI.js - UI and logic for importing audio from YouTube
// Corrected imports for utils and state

import { SERVER_URL } from '/app/js/daw/constants.js'; // Corrected path
import { base64ToBlob, showNotification, showCustomModal } from '/app/js/daw/utils.js'; // Corrected path

let localAppServices = {}; //

export function initializeYouTubeImporterUI(appServicesFromMain) { //
    localAppServices = appServicesFromMain; //
}

export function openYouTubeImporterWindow(savedState = null) { //
    const windowId = 'youtubeImporter';
    if (localAppServices.getOpenWindows?.().has(windowId)) {
        localAppServices.getWindowById(windowId).restore();
        return;
    }

    const contentHTML = `
        <div class="p-4 space-y-3 text-sm text-black dark:text-white">
            <p>Paste a YouTube URL to import the audio into your sound library.</p>
            <div class="flex">
                <input type="text" id="youtubeUrlInput" class="w-full p-1.5 border rounded-l bg-white dark:bg-black border-black dark:border-white" placeholder="https://www.youtube.com/watch?v=...">
                <button id="youtubeImportBtn" class="px-4 py-1.5 border rounded-r bg-black text-white border-black hover:bg-white hover:text-black dark:bg-white dark:text-black dark:border-white dark:hover:bg-black dark:hover:text-white">Import</button>
            </div>
            <div id="youtubeImportStatus" class="mt-4 text-sm h-12"></div>
        </div>
    `;

    const importerWindow = localAppServices.createWindow(windowId, 'Import from URL', contentHTML, {
        width: 450,
        height: 200,
    });
    
    attachImporterEventListeners(importerWindow.element);
}


function attachImporterEventListeners(windowElement) {
    const urlInput = windowElement.querySelector('#youtubeUrlInput');
    const importBtn = windowElement.querySelector('#youtubeImportBtn');
    const statusDiv = windowElement.querySelector('#youtubeImportStatus');

    const setStatus = (message, isError = false) => {
        statusDiv.textContent = message;
        statusDiv.className = `mt-4 text-sm h-12 ${isError ? 'text-red-500 font-bold' : 'text-black dark:text-white'}`;
    };

    const handleImport = async () => {
        const youtubeUrl = urlInput.value.trim();
        if (!youtubeUrl) {
            setStatus('Please enter a valid URL.', true);
            return;
        }

        importBtn.disabled = true;
        urlInput.disabled = true;
        importBtn.textContent = 'Working...';
        setStatus('Requesting audio from server... (this can take a moment)');

        try {
            // Use SERVER_URL constant from constants.js
            const response = await fetch(`${SERVER_URL}/function/youtube`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: youtubeUrl })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'An unknown server error occurred.');
            }

            setStatus('Audio received. Processing...');
            
            const audioBlob = base64ToBlob(result.base64); // Consolidated utils import
            
            const fileName = (result.title || 'imported-youtube-audio').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp3';

            if (localAppServices.addFileToSoundLibrary) {
                await localAppServices.addFileToSoundLibrary(fileName, audioBlob);
                setStatus(`Success! "${fileName}" added to your 'Imports' library.`, false);
                
                const soundBrowser = localAppServices.getWindowById?.('soundBrowser');
                if (soundBrowser && !soundBrowser.isMinimized) {
                    localAppServices.renderSoundBrowser();
                }

                setTimeout(() => {
                    const win = localAppServices.getWindowById('youtubeImporter');
                    if (win) win.close();
                }, 2500);

            } else {
                throw new Error("Sound Library service is not available.");
            }

        } catch (error) {
            console.error('[YouTubeImporter] Import failed:', error);
            setStatus(`Error: ${error.message}`, true);
        } finally {
            importBtn.disabled = false;
            urlInput.disabled = false;
            importBtn.textContent = 'Import';
        }
    };

    importBtn.addEventListener('click', handleImport);
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleImport();
        }
    });
}