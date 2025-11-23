// src/lib/encryption.js
// Client-side encryption utilities using Web Crypto API

/**
 * Derives an encryption key from the user's Cognito sub (user ID).
 * This key is deterministic (same user = same key) but never leaves the browser.
 * 
 * @param {string} userSub - The Cognito user's "sub" claim (UUID)
 * @returns {Promise<CryptoKey>}
 */
async function deriveKeyFromUserSub(userSub) {
  // Use a fixed salt to make key derivation deterministic per user
  const salt = new TextEncoder().encode('myemtee-mood-tracker-v1');
  
  // Import the user's sub as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userSub),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive an AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypts a string value using AES-GCM.
 * 
 * @param {string} plaintext - The text to encrypt
 * @param {CryptoKey} key - The encryption key
 * @returns {Promise<string>} Base64-encoded encrypted data with IV prepended
 */
async function encryptString(plaintext, key) {
  if (!plaintext) return plaintext; // Don't encrypt empty strings
  
  // Generate a random IV (initialization vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the plaintext
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Use URL-safe base64 encoding
  return btoa(String.fromCharCode.apply(null, combined))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decrypts a base64-encoded encrypted string.
 * 
 * @param {string} encryptedData - Base64 string with IV prepended
 * @param {CryptoKey} key - The decryption key
 * @returns {Promise<string>} The decrypted plaintext
 */
async function decryptString(encryptedData, key) {
  if (!encryptedData) return encryptedData; // Don't decrypt empty strings
  
  // Handle non-string values (backward compatibility with unencrypted data)
  if (typeof encryptedData !== 'string') {
    return String(encryptedData);
  }
  
  // If it contains emojis or other non-base64 characters, it's unencrypted
  if (!/^[A-Za-z0-9+/\-_=]+$/.test(encryptedData)) {
    return encryptedData;
  }
  
  // If it's too short to be encrypted (min length is ~16 for IV + small ciphertext)
  if (encryptedData.length < 16) {
    return encryptedData;
  }
  
  try {
    // Restore URL-safe base64 to standard base64
    let base64 = encryptedData
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Decode from base64
    const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    
    // If the data is too short to contain IV + ciphertext, it's probably unencrypted
    if (combined.length < 13) {
      return encryptedData;
    }
    
    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed, returning original:', error);
    // If decryption fails, assume it's unencrypted data (backward compatibility)
    return encryptedData;
  }
}

/**
 * Encrypts sensitive fields in a mood entry.
 * 
 * @param {Object} entry - The entry object with plaintext fields
 * @param {string} userSub - The Cognito user's "sub" claim
 * @returns {Promise<Object>} Entry with encrypted fields
 */
export async function encryptEntry(entry, userSub) {
  const key = await deriveKeyFromUserSub(userSub);
  
  const encrypted = { ...entry };
  
  // Encrypt notes
  if (entry.notes) {
    encrypted.notes = await encryptString(entry.notes, key);
  }
  
  // Encrypt consumed object as JSON string
  if (entry.consumed) {
    encrypted.consumed = await encryptString(JSON.stringify(entry.consumed), key);
  }
  
  // Encrypt feeling (convert to string first)
  if (entry.feeling) {
    encrypted.feeling = await encryptString(String(entry.feeling), key);
  }

  return encrypted;
}

/**
 * Decrypts sensitive fields in a mood entry.
 * 
 * @param {Object} entry - The entry object with encrypted fields
 * @param {string} userSub - The Cognito user's "sub" claim
 * @returns {Promise<Object>} Entry with decrypted fields
 */
export async function decryptEntry(entry, userSub) {
  const key = await deriveKeyFromUserSub(userSub);
  
  const decrypted = { ...entry };
  
  // Decrypt notes
  if (entry.notes) {
    decrypted.notes = await decryptString(entry.notes, key);
  }
  
  // Decrypt consumed (parse JSON after decrypting)
  if (entry.consumed) {
    // Handle both encrypted string and already-parsed object (backward compatibility)
    if (typeof entry.consumed === 'string') {
      const decryptedConsumed = await decryptString(entry.consumed, key);
      try {
        decrypted.consumed = JSON.parse(decryptedConsumed);
      } catch {
        // If JSON parse fails, might be unencrypted JSON object as string
        decrypted.consumed = { prescriptions: false, caffeine: false, marijuana: false };
      }
    } else {
      // Already an object, use as-is (backward compatibility)
      decrypted.consumed = entry.consumed;
    }
  }
  
  // Decrypt feeling (convert back to emoji)
  if (entry.feeling) {
    decrypted.feeling = await decryptString(entry.feeling, key);
  }

  return decrypted;
}

/**
 * Decrypts an array of entries.
 * 
 * @param {Array<Object>} entries - Array of encrypted entries
 * @param {string} userSub - The Cognito user's "sub" claim
 * @returns {Promise<Array<Object>>} Array of decrypted entries
 */
export async function decryptEntries(entries, userSub) {
  return Promise.all(entries.map(entry => decryptEntry(entry, userSub)));
}
