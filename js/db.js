// js/db.js - IndexedDB Helper Module

const DB_NAME = 'SnugOSAudioDB';
const STORE_NAME = 'audioFiles';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Gets the IndexedDB database instance.
 * Initializes the database and object store if they don't exist.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function getDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.error('[DB] IndexedDB not supported by this browser.');
                return reject(new Error('IndexedDB not supported. Audio samples cannot be saved locally.'));
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('[DB] Database open error:', event.target.error);
                reject(new Error('Error opening database: ' + (event.target.error?.message || 'Unknown DB open error')));
            };

            request.onsuccess = (event) => {
                // console.log('[DB] Database opened successfully.');
                resolve(event.target.result);
            };

            request.onupgradeneeded = (event) => {
                console.log('[DB] Database upgrade needed.');
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                    console.log(`[DB] Object store "${STORE_NAME}" created.`);
                }
            };
        });
    }
    return dbPromise;
}

/**
 * Stores an audio blob in IndexedDB with a given key.
 * @param {string} key - The unique key to store the audio blob under.
 * @param {Blob} audioBlob - The audio blob (File object) to store.
 * @returns {Promise<IDBValidKey>} A promise that resolves with the key under which the blob was stored.
 */
export async function storeAudio(key, audioBlob) {
    let db;
    try {
        db = await getDB();
    } catch (dbError) {
        console.error(`[DB storeAudio] Failed to get DB instance for key "${key}":`, dbError);
        throw dbError; // Re-throw the error to be caught by the caller
    }

    return new Promise((resolve, reject) => {
        if (!db) { // Should not happen if getDB() succeeded, but as a safeguard
            console.error(`[DB storeAudio] DB instance is null for key "${key}" after getDB() call.`);
            return reject(new Error('Database instance not available for storing audio.'));
        }
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(audioBlob, key);

            request.onsuccess = () => {
                // console.log(`[DB] Audio stored successfully with key: ${key}`);
                resolve(request.result);
            };
            request.onerror = (event) => {
                console.error(`[DB storeAudio] Error storing audio with key "${key}":`, event.target.error);
                reject(new Error('Error storing audio: ' + (event.target.error?.message || 'Unknown DB put error')));
            };
            transaction.onabort = (event) => { // More specific error for transaction abort
                console.error(`[DB storeAudio] Transaction aborted for key "${key}":`, event.target.error);
                reject(new Error('Transaction aborted while storing audio: ' + (event.target.error?.message || 'Unknown DB transaction abort')));
            };
            transaction.onerror = (event) => { // Catch other transaction-level errors
                console.error(`[DB storeAudio] Transaction error storing audio with key "${key}":`, event.target.error);
                reject(new Error('Transaction error storing audio: ' + (event.target.error?.message || 'Unknown DB transaction error')));
            };
        } catch (e) {
            console.error(`[DB storeAudio] Synchronous error during transaction creation for key "${key}":`, e);
            reject(new Error('Failed to initiate audio storage transaction: ' + e.message));
        }
    });
}

/**
 * Retrieves an audio blob from IndexedDB by its key.
 * @param {string} key - The key of the audio blob to retrieve.
 * @returns {Promise<Blob|null>} A promise that resolves with the audio blob, or null if not found.
 */
export async function getAudio(key) {
    let db;
    try {
        db = await getDB();
    } catch (dbError) {
        console.error(`[DB getAudio] Failed to get DB instance for key "${key}":`, dbError);
        throw dbError;
    }

    return new Promise((resolve, reject) => {
        if (!db) {
            console.error(`[DB getAudio] DB instance is null for key "${key}" after getDB() call.`);
            return reject(new Error('Database instance not available for retrieving audio.'));
        }
        try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                if (request.result) {
                    // console.log(`[DB] Audio retrieved successfully for key: ${key}`);
                    resolve(request.result);
                } else {
                    // console.warn(`[DB] No audio found for key: ${key}`);
                    resolve(null); // Resolve with null if not found, not an error
                }
            };
            request.onerror = (event) => {
                console.error(`[DB getAudio] Error retrieving audio for key "${key}":`, event.target.error);
                reject(new Error('Error retrieving audio: ' + (event.target.error?.message || 'Unknown DB get error')));
            };
            transaction.onabort = (event) => {
                console.error(`[DB getAudio] Transaction aborted for key "${key}":`, event.target.error);
                reject(new Error('Transaction aborted while retrieving audio: ' + (event.target.error?.message || 'Unknown DB transaction abort')));
            };
            transaction.onerror = (event) => {
                console.error(`[DB getAudio] Transaction error retrieving audio for key "${key}":`, event.target.error);
                reject(new Error('Transaction error retrieving audio: ' + (event.target.error?.message || 'Unknown DB transaction error')));
            };
        } catch (e) {
            console.error(`[DB getAudio] Synchronous error during transaction creation for key "${key}":`, e);
            reject(new Error('Failed to initiate audio retrieval transaction: ' + e.message));
        }
    });
}

/**
 * Deletes an audio blob from IndexedDB by its key.
 * @param {string} key - The key of the audio blob to delete.
 * @returns {Promise<void>} A promise that resolves when the audio is deleted.
 */
export async function deleteAudio(key) {
    let db;
    try {
        db = await getDB();
    } catch (dbError) {
        console.error(`[DB deleteAudio] Failed to get DB instance for key "${key}":`, dbError);
        throw dbError;
    }
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error(`[DB deleteAudio] DB instance is null for key "${key}" after getDB() call.`);
            return reject(new Error('Database instance not available for deleting audio.'));
        }
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => {
                // console.log(`[DB] Audio deleted successfully for key: ${key}`);
                resolve();
            };
            request.onerror = (event) => {
                console.error(`[DB deleteAudio] Error deleting audio for key "${key}":`, event.target.error);
                reject(new Error('Error deleting audio: ' + (event.target.error?.message || 'Unknown DB delete error')));
            };
            transaction.onabort = (event) => {
                console.error(`[DB deleteAudio] Transaction aborted for key "${key}":`, event.target.error);
                reject(new Error('Transaction aborted while deleting audio: ' + (event.target.error?.message || 'Unknown DB transaction abort')));
            };
            transaction.onerror = (event) => {
                console.error(`[DB deleteAudio] Transaction error deleting audio for key "${key}":`, event.target.error);
                reject(new Error('Transaction error deleting audio: ' + (event.target.error?.message || 'Unknown DB transaction error')));
            };
        } catch (e) {
            console.error(`[DB deleteAudio] Synchronous error during transaction creation for key "${key}":`, e);
            reject(new Error('Failed to initiate audio deletion transaction: ' + e.message));
        }
    });
}

/**
 * Clears all audio blobs from the IndexedDB store.
 * @returns {Promise<void>} A promise that resolves when the store is cleared.
 */
export async function clearAllAudio() {
    let db;
    try {
        db = await getDB();
    } catch (dbError) {
        console.error("[DB clearAllAudio] Failed to get DB instance for clearing audio:", dbError);
        throw dbError;
    }
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error("[DB clearAllAudio] DB instance is null after getDB() call.");
            return reject(new Error('Database instance not available for clearing audio store.'));
        }
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[DB] All audio cleared from database.');
                resolve();
            };
            request.onerror = (event) => {
                console.error('[DB clearAllAudio] Error clearing audio database:', event.target.error);
                reject(new Error('Error clearing audio database: ' + (event.target.error?.message || 'Unknown DB clear error')));
            };
            transaction.onabort = (event) => {
                console.error('[DB clearAllAudio] Transaction aborted for clearing database:', event.target.error);
                reject(new Error('Transaction aborted while clearing audio database: ' + (event.target.error?.message || 'Unknown DB transaction abort')));
            };
            transaction.onerror = (event) => {
                console.error(`[DB clearAllAudio] Transaction error clearing audio database:`, event.target.error);
                reject(new Error('Transaction error clearing audio database: ' + (event.target.error?.message || 'Unknown DB transaction error')));
            };
        } catch (e) {
            console.error('[DB clearAllAudio] Synchronous error during transaction creation:', e);
            reject(new Error('Failed to initiate clear audio store transaction: ' + e.message));
        }
    });
}
