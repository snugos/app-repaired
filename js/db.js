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
                console.error('[DB] Database error:', event.target.error);
                reject(new Error('Error opening database: ' + (event.target.error?.message || 'Unknown error')));
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
        console.error("[DB] Failed to get DB for storing audio:", dbError);
        throw dbError; // Re-throw the error to be caught by the caller
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(audioBlob, key);

        request.onsuccess = () => {
            // console.log(`[DB] Audio stored successfully with key: ${key}`);
            resolve(request.result);
        };
        request.onerror = (event) => {
            console.error(`[DB] Error storing audio with key ${key}:`, event.target.error);
            reject(new Error('Error storing audio: ' + (event.target.error?.message || 'Unknown DB error')));
        };
        transaction.onerror = (event) => { // Catch transaction-level errors too
            console.error(`[DB] Transaction error storing audio with key ${key}:`, event.target.error);
            reject(new Error('Transaction error storing audio: ' + (event.target.error?.message || 'Unknown DB transaction error')));
        };
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
        console.error("[DB] Failed to get DB for retrieving audio:", dbError);
        throw dbError;
    }

    return new Promise((resolve, reject) => {
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
            console.error(`[DB] Error retrieving audio for key ${key}:`, event.target.error);
            reject(new Error('Error retrieving audio: ' + (event.target.error?.message || 'Unknown DB error')));
        };
        transaction.onerror = (event) => {
            console.error(`[DB] Transaction error retrieving audio for key ${key}:`, event.target.error);
            reject(new Error('Transaction error retrieving audio: ' + (event.target.error?.message || 'Unknown DB transaction error')));
        };
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
        console.error("[DB] Failed to get DB for deleting audio:", dbError);
        throw dbError;
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
            // console.log(`[DB] Audio deleted successfully for key: ${key}`);
            resolve();
        };
        request.onerror = (event) => {
            console.error(`[DB] Error deleting audio for key ${key}:`, event.target.error);
            reject(new Error('Error deleting audio: ' + (event.target.error?.message || 'Unknown DB error')));
        };
        transaction.onerror = (event) => {
            console.error(`[DB] Transaction error deleting audio for key ${key}:`, event.target.error);
            reject(new Error('Transaction error deleting audio: ' + (event.target.error?.message || 'Unknown DB transaction error')));
        };
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
        console.error("[DB] Failed to get DB for clearing audio:", dbError);
        throw dbError;
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('[DB] All audio cleared from database.');
            resolve();
        };
        request.onerror = (event) => {
            console.error('[DB] Error clearing audio database:', event.target.error);
            reject(new Error('Error clearing audio database: ' + (event.target.error?.message || 'Unknown DB error')));
        };
        transaction.onerror = (event) => {
            console.error(`[DB] Transaction error clearing audio database:`, event.target.error);
            reject(new Error('Transaction error clearing audio database: ' + (event.target.error?.message || 'Unknown DB transaction error')));
        };
    });
}
