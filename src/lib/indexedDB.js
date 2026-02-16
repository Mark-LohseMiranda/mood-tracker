/**
 * IndexedDB utilities for caching mood entry METADATA ONLY (NOT sensitive data)
 * 
 * SECURITY: Only stores safe fields (userId, timestamp, localDate)
 * NEVER stores: feeling, notes, consumed, or any encrypted/sensitive data
 */

const DB_NAME = 'MoodTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'entryMetadata';

/**
 * Initialize the database
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('localDate', 'localDate', { unique: false });
      }
    };
  });
}

/**
 * Save minimal entry metadata (safe data only) to IndexedDB
 * @param {Array} entries - Array of entry objects
 * @param {string} userId - User's ID from Cognito
 * 
 * SECURITY: Only extracts userId, timestamp, localDate
 * NEVER stores: feeling, notes, consumed (encrypted data)
 */
export async function cacheEntryMetadata(entries, userId) {
  if (!entries || entries.length === 0) return;
  
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    entries.forEach(entry => {
      // ONLY store safe metadata - no encrypted/sensitive fields
      const metadata = {
        id: `${userId}_${entry.timestamp}`,
        userId,
        timestamp: entry.timestamp,
        localDate: entry.localDate
        // NEVER add: feeling, notes, consumed, or any decrypted data
      };
      store.put(metadata);
    });
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.debug('Failed to cache entry metadata:', error);
  }
}

/**
 * Get all entry metadata for a user from cache
 * @returns {Array} Array containing only userId, timestamp, localDate (no sensitive data)
 */
export async function getCachedEntryMetadata(userId) {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('userId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) {
    console.debug('Failed to retrieve cached metadata:', error);
    return [];
  }
}

/**
 * Clear all metadata for a user
 */
export async function clearUserMetadataCache(userId) {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('userId');
    
    const request = index.getAll(userId);
    request.onsuccess = () => {
      request.result.forEach(entry => {
        store.delete(entry.id);
      });
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.debug('Failed to clear user metadata cache:', error);
  }
}
