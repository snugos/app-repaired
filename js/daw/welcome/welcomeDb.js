// js/daw/welcome/welcomeDb.js - Minimal IndexedDB Helper for Welcome Page

const DB_NAME = 'SnugOSAudioDB';
const STORES = {
    ASSETS: 'userAssets' // Only the ASSETS store is relevant for the welcome page
};
const DB_VERSION = 2; // Must match the version in db.js to access existing store

let dbPromise = null;

/**
 * Gets the IndexedDB database instance.
 * (Minimal version for welcome page - only opens, doesn't create/upgrade all stores)
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

            // onupgradeneeded is only called if DB_VERSION is higher than existing,
            // so this minimal version relies on db.js already creating the store.
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORES.ASSETS)) {
                    // Create if it doesn't exist (e.g., if welcome page loads before main DAW)
                    db.createObjectStore(STORES.ASSETS);
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
 * Store an asset (like a background image) in the welcome page's dedicated DB store.
 * @param {string} key - The key for the asset.
 * @param {Blob} assetBlob - The asset data as a Blob.
 * @returns {Promise<void>}
 */
export function storeAsset(key, assetBlob) {
    return storeValue(STORES.ASSETS, key, assetBlob);
}

/**
 * Retrieve an asset (like a background image) from the welcome page's dedicated DB store.
 * @param {string} key - The key for the asset.
 * @returns {Promise<Blob | undefined>}
 */
export function getAsset(key) {
    return getValue(STORES.ASSETS, key);
}