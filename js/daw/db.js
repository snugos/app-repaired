// js/daw/db.js - IndexedDB Helper Module

const DB_NAME = 'SnugOSAudioDB';
const STORES = {
    AUDIO: 'audioFiles',
    ASSETS: 'userAssets'
};
const DB_VERSION = 2;

let dbPromise = null;

/**
 * Gets the IndexedDB database instance.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function getDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                return reject(new Error('IndexedDB not supported.'));
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => reject(new Error('Error opening database: ' + event.target.error?.message));

            request.onsuccess = (event) => resolve(event.target.result);

            request.onupgradeneeded = (event) => {
                console.log('[DB] Database upgrade needed.');
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORES.AUDIO)) {
                    db.createObjectStore(STORES.AUDIO);
                    console.log(`[DB] Object store "${STORES.AUDIO}" created.`);
                }
                if (!db.objectStoreNames.contains(STORES.ASSETS)) {
                    db.createObjectStore(STORES.ASSETS);
                    console.log(`[DB] Object store "${STORES.ASSETS}" created.`);
                }
            };
        });
    }
    return dbPromise;
}

/**
 * Generic function to store a value in a specific store.
 * @param {string} storeName - The name of the object store.
 * @param {string} key - The key for the data.
 * @param {any} value - The data to store (e.g., a Blob).
 * @returns {Promise<void>}
 */
async function storeValue(storeName, key, value) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(new Error('Error storing value: ' + event.target.error?.message));
        } catch (e) {
            reject(new Error('Failed to initiate store transaction: ' + e.message));
        }
    });
}

/**
 * Generic function to retrieve a value from a specific store.
 * @param {string} storeName - The name of the object store.
 * @param {string} key - The key for the data.
 * @returns {Promise<any>} A promise that resolves with the data or undefined.
 */
async function getValue(storeName, key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(new Error('Error getting value: ' + event.target.error?.message));
        } catch (e) {
            reject(new Error('Failed to initiate get transaction: ' + e.message));
        }
    });
}

/**
 * Generic function to delete a value from a specific store.
 * @param {string} storeName - The name of the object store.
 * @param {string} key - The key for the data.
 * @returns {Promise<void>}
 */
async function deleteValue(storeName, key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(new Error('Error deleting value: ' + event.target.error?.message));
        } catch (e) {
            reject(new Error('Failed to initiate delete transaction: ' + e.message));
        }
    });
}


// --- Specific Implementations ---
/**
 * Stores an audio Blob in the 'audioFiles' object store.
 * @param {string} key - The key for the audio Blob.
 * @param {Blob} audioBlob - The audio Blob to store.
 * @returns {Promise<void>}
 */
export function storeAudio(key, audioBlob) {
    return storeValue(STORES.AUDIO, key, audioBlob);
}

/**
 * Retrieves an audio Blob from the 'audioFiles' object store.
 * @param {string} key - The key of the audio Blob to retrieve.
 * @returns {Promise<Blob | undefined>} A promise that resolves with the audio Blob or undefined if not found.
 */
export function getAudio(key) {
    return getValue(STORES.AUDIO, key);
}

/**
 * Deletes an audio Blob from the 'audioFiles' object store.
 * @param {string} key - The key of the audio Blob to delete.
 * @returns {Promise<void>}
 */
export function deleteAudio(key) {
    return deleteValue(STORES.AUDIO, key);
}

/**
 * Stores an asset Blob in the 'userAssets' object store.
 * @param {string} key - The key for the asset Blob.
 * @param {Blob} assetBlob - The asset Blob to store.
 * @returns {Promise<void>}
 */
export function storeAsset(key, assetBlob) {
    return storeValue(STORES.ASSETS, key, assetBlob);
}

/**
 * Retrieves an asset Blob from the 'userAssets' object store.
 * @param {string} key - The key of the asset Blob to retrieve.
 * @returns {Promise<Blob | undefined>} A promise that resolves with the asset Blob or undefined if not found.
 */
export function getAsset(key) {
    return getValue(STORES.ASSETS, key);
}