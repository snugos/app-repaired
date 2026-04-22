// js/ShareLinkGenerator.js - Share Link Generator for SnugOS DAW
// This module provides functionality to generate shareable links for exported audio

/**
 * ShareLinkGenerator - Generate shareable links to exported audio files.
 * This feature creates temporary URLs for sharing exported audio files.
 * 
 * Features:
 * - Generate shareable links from audio blobs
 * - Track share link history
 * - Automatic expiration management
 * - Copy to clipboard functionality
 */

let shareLinksEnabled = true;
let shareLinkHistory = []; // Array of {id, url, createdAt, expiresAt, projectName}
const MAX_SHARE_LINKS = 50;
const SHARE_LINK_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Share link status constants
 */
export const ShareLinkStatus = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
};

/**
 * Check if share links are enabled.
 * @returns {boolean} True if enabled
 */
export function getShareLinksEnabled() {
    return shareLinksEnabled;
}

/**
 * Enable or disable share links.
 * @param {boolean} enabled - Whether to enable share links
 */
export function setShareLinksEnabled(enabled) {
    shareLinksEnabled = !!enabled;
    console.log(`[ShareLinkGenerator] Share links ${shareLinksEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Generate a shareable link for an audio blob.
 * @param {Blob} audioBlob - The audio blob to share
 * @param {string} projectName - The project name
 * @param {Object} options - Optional settings
 * @param {number} options.expiryMs - Custom expiry time in milliseconds
 * @param {string} options.format - Audio format (wav, mp3)
 * @param {number} options.sampleRate - Sample rate
 * @param {number} options.bitDepth - Bit depth
 * @returns {Promise<Object>} Share link object with url, id, expiresAt
 */
export async function generateShareLink(audioBlob, projectName = 'snugos-project', options = {}) {
    if (!shareLinksEnabled) {
        throw new Error('Share links are disabled');
    }

    if (!audioBlob || !(audioBlob instanceof Blob)) {
        throw new Error('Invalid audio blob');
    }

    const linkId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const expiresAt = now + (options.expiryMs || SHARE_LINK_EXPIRY_MS);

    // Create a download URL from the blob
    const blobUrl = URL.createObjectURL(audioBlob);

    // Create share link entry
    const shareLink = {
        id: linkId,
        url: blobUrl,
        shortUrl: `https://share.snugos.daw/${linkId}`,
        projectName: projectName,
        createdAt: now,
        expiresAt: expiresAt,
        size: audioBlob.size,
        type: audioBlob.type || 'audio/wav',
        downloadCount: 0,
        status: ShareLinkStatus.ACTIVE,
        metadata: {
            format: options.format || 'wav',
            sampleRate: options.sampleRate || 44100,
            bitDepth: options.bitDepth || 24
        }
    };

    // Add to history
    shareLinkHistory.unshift(shareLink);
    
    // Limit history size
    if (shareLinkHistory.length > MAX_SHARE_LINKS) {
        const removed = shareLinkHistory.pop();
        URL.revokeObjectURL(removed.url);
        console.log(`[ShareLinkGenerator] Removed old share link: ${removed.id}`);
    }

    // Save to localStorage for persistence
    saveShareLinkHistory();

    console.log(`[ShareLinkGenerator] Generated share link: ${shareLink.shortUrl}`);
    return shareLink;
}

/**
 * Get all share links.
 * @returns {Array} Array of share link objects
 */
export function getShareLinks() {
    // Filter out expired links
    const now = Date.now();
    shareLinkHistory = shareLinkHistory.filter(link => {
        if (link.expiresAt < now) {
            if (link.url) URL.revokeObjectURL(link.url);
            link.status = ShareLinkStatus.EXPIRED;
            return false;
        }
        return true;
    });
    return [...shareLinkHistory];
}

/**
 * Get only active share links.
 * @returns {Array} Array of active share link objects
 */
export function getActiveShareLinks() {
    const now = Date.now();
    return shareLinkHistory.filter(link => link.expiresAt >= now);
}

/**
 * Get a specific share link by ID.
 * @param {string} linkId - The link ID
 * @returns {Object|null} Share link object or null
 */
export function getShareLinkById(linkId) {
    const link = shareLinkHistory.find(l => l.id === linkId);
    if (!link) return null;
    
    // Check if expired
    if (link.expiresAt < Date.now()) {
        if (link.url) URL.revokeObjectURL(link.url);
        link.status = ShareLinkStatus.EXPIRED;
        shareLinkHistory = shareLinkHistory.filter(l => l.id !== linkId);
        saveShareLinkHistory();
        return null;
    }
    
    return link;
}

/**
 * Check if a share link is still valid.
 * @param {string} linkId - The link ID
 * @returns {boolean} True if valid
 */
export function isShareLinkValid(linkId) {
    const link = getShareLinkById(linkId);
    return link !== null && link.status === ShareLinkStatus.ACTIVE;
}

/**
 * Increment download count for a share link.
 * @param {string} linkId - The link ID
 */
export function incrementShareLinkDownloadCount(linkId) {
    const link = shareLinkHistory.find(l => l.id === linkId);
    if (link) {
        link.downloadCount++;
        saveShareLinkHistory();
        console.log(`[ShareLinkGenerator] Download count for ${linkId}: ${link.downloadCount}`);
    }
}

/**
 * Delete a share link.
 * @param {string} linkId - The link ID to delete
 * @returns {boolean} True if deleted
 */
export function deleteShareLink(linkId) {
    const index = shareLinkHistory.findIndex(l => l.id === linkId);
    if (index === -1) return false;
    
    const removed = shareLinkHistory.splice(index, 1)[0];
    if (removed.url) URL.revokeObjectURL(removed.url);
    saveShareLinkHistory();
    
    console.log(`[ShareLinkGenerator] Deleted share link: ${linkId}`);
    return true;
}

/**
 * Revoke a share link (mark as revoked but keep in history).
 * @param {string} linkId - The link ID to revoke
 * @returns {boolean} True if revoked
 */
export function revokeShareLink(linkId) {
    const link = shareLinkHistory.find(l => l.id === linkId);
    if (!link) return false;
    
    link.status = ShareLinkStatus.REVOKED;
    if (link.url) {
        URL.revokeObjectURL(link.url);
        link.url = null;
    }
    saveShareLinkHistory();
    
    console.log(`[ShareLinkGenerator] Revoked share link: ${linkId}`);
    return true;
}

/**
 * Clear all share links.
 */
export function clearAllShareLinks() {
    for (const link of shareLinkHistory) {
        if (link.url) URL.revokeObjectURL(link.url);
    }
    shareLinkHistory = [];
    saveShareLinkHistory();
    console.log('[ShareLinkGenerator] Cleared all share links');
}

/**
 * Clear expired share links.
 * @returns {number} Number of expired links cleared
 */
export function clearExpiredShareLinks() {
    const now = Date.now();
    const expired = shareLinkHistory.filter(l => l.expiresAt < now);
    
    for (const link of expired) {
        if (link.url) URL.revokeObjectURL(link.url);
    }
    
    shareLinkHistory = shareLinkHistory.filter(l => l.expiresAt >= now);
    saveShareLinkHistory();
    
    console.log(`[ShareLinkGenerator] Cleared ${expired.length} expired share links`);
    return expired.length;
}

/**
 * Copy share link to clipboard.
 * @param {string} linkId - The link ID
 * @returns {Promise<boolean>} True if copied successfully
 */
export async function copyShareLinkToClipboard(linkId) {
    const link = getShareLinkById(linkId);
    if (!link) return false;

    try {
        await navigator.clipboard.writeText(link.shortUrl);
        console.log(`[ShareLinkGenerator] Copied share link to clipboard: ${link.shortUrl}`);
        return true;
    } catch (e) {
        console.error('[ShareLinkGenerator] Failed to copy share link:', e);
        return false;
    }
}

/**
 * Copy share link download URL to clipboard.
 * @param {string} linkId - The link ID
 * @returns {Promise<boolean>} True if copied successfully
 */
export async function copyShareLinkUrlToClipboard(linkId) {
    const link = getShareLinkById(linkId);
    if (!link || !link.url) return false;

    try {
        await navigator.clipboard.writeText(link.url);
        console.log(`[ShareLinkGenerator] Copied share link URL to clipboard`);
        return true;
    } catch (e) {
        console.error('[ShareLinkGenerator] Failed to copy share link URL:', e);
        return false;
    }
}

/**
 * Generate an embeddable HTML snippet for a share link.
 * @param {string} linkId - The link ID
 * @param {Object} options - Embed options
 * @returns {string} HTML snippet
 */
export function generateEmbedSnippet(linkId, options = {}) {
    const link = getShareLinkById(linkId);
    if (!link) return '';

    const width = options.width || 300;
    const height = options.height || 80;
    const showDownload = options.showDownload !== false;

    const downloadBtn = showDownload ? 
        `<a href="${link.url}" download style="display:inline-block;padding:8px 16px;background:#3b82f6;color:white;text-decoration:none;border-radius:4px;margin-top:8px;">Download</a>` : 
        '';

    return `<div style="background:#1a1a1a;padding:16px;border-radius:8px;width:${width}px;font-family:sans-serif;">
    <div style="color:white;font-weight:bold;margin-bottom:8px;">${escapeHtml(link.projectName)}</div>
    <div style="color:#888;font-size:12px;">Size: ${formatBytes(link.size)} | ${link.metadata.format?.toUpperCase() || 'WAV'}</div>
    ${downloadBtn}
</div>`;
}

/**
 * Create a QR code data URL for a share link.
 * Note: This is a simple QR code placeholder. For full QR support, use a library.
 * @param {string} linkId - The link ID
 * @returns {string} QR code data or empty string
 */
export function generateQRCodeData(linkId) {
    const link = getShareLinkById(linkId);
    if (!link) return '';
    
    // Return the URL for use with a QR code library
    // In production, you'd integrate a QR code library here
    return link.shortUrl;
}

/**
 * Get share link history stats.
 * @returns {Object} Stats object
 */
export function getShareLinkStats() {
    const now = Date.now();
    const active = shareLinkHistory.filter(l => l.expiresAt >= now && l.status === ShareLinkStatus.ACTIVE);
    const expired = shareLinkHistory.filter(l => l.expiresAt < now || l.status === ShareLinkStatus.EXPIRED);
    const revoked = shareLinkHistory.filter(l => l.status === ShareLinkStatus.REVOKED);
    
    return {
        total: shareLinkHistory.length,
        active: active.length,
        expired: expired.length,
        revoked: revoked.length,
        totalDownloads: shareLinkHistory.reduce((sum, l) => sum + (l.downloadCount || 0), 0),
        totalSize: shareLinkHistory.reduce((sum, l) => sum + (l.size || 0), 0)
    };
}

/**
 * Save share link history to localStorage.
 */
function saveShareLinkHistory() {
    try {
        // Only save metadata, not the actual blob URLs (they don't persist)
        const metadata = shareLinkHistory.map(link => ({
            id: link.id,
            projectName: link.projectName,
            createdAt: link.createdAt,
            expiresAt: link.expiresAt,
            size: link.size,
            downloadCount: link.downloadCount,
            status: link.status,
            metadata: link.metadata
        }));
        localStorage.setItem('snugos_share_links', JSON.stringify(metadata));
    } catch (e) {
        console.warn('[ShareLinkGenerator] Failed to save share link history:', e);
    }
}

/**
 * Load share link history from localStorage.
 */
export function loadShareLinkHistory() {
    try {
        const stored = localStorage.getItem('snugos_share_links');
        if (stored) {
            const metadata = JSON.parse(stored);
            // Note: URLs are not restored, only metadata
            shareLinkHistory = metadata.map(m => ({
                ...m,
                url: null, // Blob URLs don't persist
                shortUrl: `https://share.snugos.daw/${m.id}`
            }));
            console.log(`[ShareLinkGenerator] Loaded ${shareLinkHistory.length} share link records`);
        }
    } catch (e) {
        console.warn('[ShareLinkGenerator] Failed to load share link history:', e);
    }
}

/**
 * Export share link history to JSON.
 * @returns {string} JSON string
 */
export function exportShareLinkHistory() {
    return JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        links: shareLinkHistory.map(l => ({
            id: l.id,
            projectName: l.projectName,
            createdAt: l.createdAt,
            expiresAt: l.expiresAt,
            downloadCount: l.downloadCount,
            status: l.status,
            metadata: l.metadata
        }))
    }, null, 2);
}

/**
 * Import share link history from JSON.
 * @param {string} jsonString - JSON string to import
 * @returns {boolean} True if imported successfully
 */
export function importShareLinkHistory(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.version !== 1) {
            console.warn('[ShareLinkGenerator] Unsupported export version');
            return false;
        }

        // Merge with existing history
        const existingIds = new Set(shareLinkHistory.map(l => l.id));
        
        for (const link of data.links) {
            if (!existingIds.has(link.id)) {
                shareLinkHistory.push({
                    ...link,
                    url: null,
                    shortUrl: `https://share.snugos.daw/${link.id}`
                });
            }
        }

        // Sort by creation date (newest first)
        shareLinkHistory.sort((a, b) => b.createdAt - a.createdAt);
        
        // Limit size
        while (shareLinkHistory.length > MAX_SHARE_LINKS) {
            shareLinkHistory.pop();
        }

        saveShareLinkHistory();
        console.log(`[ShareLinkGenerator] Imported ${data.links.length} share link records`);
        return true;
    } catch (e) {
        console.error('[ShareLinkGenerator] Failed to import share link history:', e);
        return false;
    }
}

/**
 * Initialize the share link generator.
 * Call this during app startup.
 */
export function initializeShareLinkGenerator() {
    loadShareLinkHistory();
    clearExpiredShareLinks();
    console.log('[ShareLinkGenerator] Initialized');
}

// Helper functions

/**
 * Escape HTML special characters.
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format bytes to human readable string.
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Default export
export default {
    ShareLinkStatus,
    getShareLinksEnabled,
    setShareLinksEnabled,
    generateShareLink,
    getShareLinks,
    getActiveShareLinks,
    getShareLinkById,
    isShareLinkValid,
    incrementShareLinkDownloadCount,
    deleteShareLink,
    revokeShareLink,
    clearAllShareLinks,
    clearExpiredShareLinks,
    copyShareLinkToClipboard,
    copyShareLinkUrlToClipboard,
    generateEmbedSnippet,
    generateQRCodeData,
    getShareLinkStats,
    loadShareLinkHistory,
    exportShareLinkHistory,
    importShareLinkHistory,
    initializeShareLinkGenerator
};