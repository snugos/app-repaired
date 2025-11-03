// js/ui/youtubeImporterUI.js - UI and logic for importing audio from YouTube
import { showNotification } from '../utils.js';

let localAppServices = {};

export function initializeYouTubeImporterUI(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
}

// openYouTubeImporterWindow is assumed to be the same as you provided
export function openYouTubeImporterWindow(savedState = null) {
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

    const importerWindow = localAppServices.createWindow(windowId, 'Import from YouTube', contentHTML, {
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
        setStatus('Requesting stream from server...');

        try {
            // Step 1: Call our Netlify function
            const response = await fetch('/.netlify/functions/youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: youtubeUrl })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                console.error('Server function returned an error:', result);
                throw new Error(result.message || 'An unknown server error occurred.');
            }

            setStatus('Audio stream found. Downloading...');
            
            // Step 2: Fetch the audio file using a CORS proxy
            // Note: A public proxy can be unreliable. For production, consider a self-hosted one.
            const proxyUrl = 'https://corsproxy.io/?';
            const audioResponse = await fetch(proxyUrl + encodeURIComponent(result.url));
            
            if (!audioResponse.ok) {
                throw new Error(`Failed to download audio file: ${audioResponse.status} ${audioResponse.statusText}`);
            }
            
            setStatus('Audio downloaded. Processing...');
            const audioBlob = await audioResponse.blob();
            
            // Clean up the title to create a valid filename
            const fileName = (result.title || 'imported-youtube-audio').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp3';

            // *** FIX: Add the file to the sound library instead of a new track ***
            if (localAppServices.addFileToSoundLibrary) {
                await localAppServices.addFileToSoundLibrary(fileName, audioBlob);
                setStatus(`Success! "${fileName}" added to your Sound Library under 'Imports'.`, false);
                
                // Refresh the sound browser if it's open
                const soundBrowser = localAppServices.getWindowById?.('soundBrowser');
                if (soundBrowser && !soundBrowser.isMinimized) {
                    localAppServices.renderSoundBrowser();
                }

                // Close the importer window after a delay
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
