// src/lib/auth.js
// Custom authentication using AWS Cognito SDK

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  ConfirmDeviceCommand,
  UpdateDeviceStatusCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserSession, CognitoAccessToken, CognitoIdToken, CognitoRefreshToken } from 'amazon-cognito-identity-js';
import { AuthenticationHelper } from 'amazon-cognito-identity-js';
import BigInteger from 'amazon-cognito-identity-js/lib/BigInteger';
import { Buffer } from 'buffer';

const REGION = import.meta.env.VITE_COGNITO_REGION;
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

const client = new CognitoIdentityProviderClient({ region: REGION });
const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

// Storage keys
const ACCESS_TOKEN_KEY = 'cognito_access_token';
const ID_TOKEN_KEY = 'cognito_id_token';
const REFRESH_TOKEN_KEY = 'cognito_refresh_token';
const USER_INFO_KEY = 'cognito_user_info';

// IndexedDB setup for persistent storage in PWAs
const DB_NAME = 'MoodTrackerAuth';
const DB_VERSION = 1;
const STORE_NAME = 'tokens';

let db;

async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      db.onclose = () => { db = null; };
      db.onversionchange = () => {
        try { db?.close(); } catch (e) {}
        db = null;
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function withDB(operation) {
  let attempts = 0;
  while (attempts < 2) {
    try {
      const database = await openDB();
      return await operation(database);
    } catch (error) {
      const closed = error?.name === 'InvalidStateError' || error?.message?.includes('closed database');
      if (closed && attempts === 0) {
        db = null; // Force reopen on next attempt
        attempts += 1;
        continue;
      }
      throw error;
    }
  }
  throw new Error('IndexedDB unavailable');
}

async function setItem(key, value) {
  return withDB((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}

async function getItem(key) {
  return withDB((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

async function removeItem(key) {
  return withDB((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}

/**
 * Sign in with username and password using CognitoUser (handles device auth automatically)
 */
export async function signIn(username, password) {
  try {
    const authenticationData = {
      Username: username,
      Password: password,
    };
    const authenticationDetails = new AuthenticationDetails(authenticationData);

    const userData = {
      Username: username,
      Pool: userPool,
    };
    const cognitoUser = new CognitoUser(userData);

    // Try to get stored device key and set it on the user
    try {
      const storedDeviceKey = await getStoredDeviceKey(username);
      if (storedDeviceKey) {
        cognitoUser.deviceKey = storedDeviceKey;
      }
    } catch (e) {
      // ignore storage errors
    }

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (result) => {
          // Successful authentication - store tokens
          await storeTokens({
            AccessToken: result.getAccessToken().getJwtToken(),
            IdToken: result.getIdToken().getJwtToken(),
            RefreshToken: result.getRefreshToken().getToken(),
          });
          await fetchUserInfo(result.getAccessToken().getJwtToken());
          localStorage.removeItem('historyCache');
          
          // Check for new device metadata
          const newDeviceMetadata = cognitoUser.deviceKey ? {
            DeviceKey: cognitoUser.deviceKey,
            DeviceGroupKey: cognitoUser.deviceGroupKey,
          } : null;
          
          resolve({ success: true, newDeviceMetadata });
        },
        onFailure: (err) => {
          reject(new Error(err.message || 'Failed to sign in'));
        },
        mfaRequired: (challengeName, challengeParameters) => {
          // MFA challenge - return to UI
          // Store cognitoUser for later device confirmation
          try {
            localStorage.setItem('cognito_user_data', JSON.stringify({
              Username: username,
              Pool: { UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID }
            }));
          } catch (e) {}
          
          resolve({
            challengeName: 'SOFTWARE_TOKEN_MFA',
            session: cognitoUser.Session,
            cognitoUser, // Pass the user object for MFA verification
          });
        },
        totpRequired: (challengeName, challengeParameters) => {
          // TOTP MFA challenge
          resolve({
            challengeName: 'SOFTWARE_TOKEN_MFA',
            session: cognitoUser.Session,
            cognitoUser,
          });
        },
        newDeviceMetadata: (newDevice) => {
          // Device metadata available - will be handled in onSuccess
        },
      });
    });
  } catch (error) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
}

// Device key helpers (persisted in IndexedDB like other tokens)
export async function setStoredDeviceKey(username, deviceKey) {
  try {
    await setItem(`deviceKey_${username}`, deviceKey);
  } catch (e) { console.error('setStoredDeviceKey error', e); }
}

export async function getStoredDeviceKey(username) {
  try {
    return await getItem(`deviceKey_${username}`) || null;
  } catch (e) { console.error('getStoredDeviceKey error', e); return null; }
}

export async function removeStoredDeviceKey(username) {
  try { await removeItem(`deviceKey_${username}`); } catch (e) { console.error(e); }
}

export async function setStoredDeviceSecret(username, deviceSecret) {
  try {
    await setItem(`deviceSecret_${username}`, deviceSecret);
  } catch (e) { console.error('setStoredDeviceSecret error', e); }
}

export async function getStoredDeviceSecret(username) {
  try {
    return await getItem(`deviceSecret_${username}`) || null;
  } catch (e) { console.error('getStoredDeviceSecret error', e); return null; }
}

export async function removeStoredDeviceSecret(username) {
  try { await removeItem(`deviceSecret_${username}`); } catch (e) { console.error(e); }
}

export async function setStoredDeviceGroupKey(username, deviceGroupKey) {
  try {
    await setItem(`deviceGroupKey_${username}`, deviceGroupKey);
  } catch (e) { console.error('setStoredDeviceGroupKey error', e); }
}

export async function getStoredDeviceGroupKey(username) {
  try {
    return await getItem(`deviceGroupKey_${username}`) || null;
  } catch (e) { console.error('getStoredDeviceGroupKey error', e); return null; }
}

export async function removeStoredDeviceGroupKey(username) {
  try { await removeItem(`deviceGroupKey_${username}`); } catch (e) { console.error(e); }
}

export async function setStoredDeviceRemembered(username, remembered = true) {
  try {
    if (remembered) await setItem(`device_remembered_${username}`, '1');
    else await removeItem(`device_remembered_${username}`);
  } catch (e) { console.error('setStoredDeviceRemembered error', e); }
}

export async function isStoredDeviceRemembered(username) {
  try {
    const v = await getItem(`device_remembered_${username}`);
    return !!v;
  } catch (e) { return false; }
}

// Never-remember preference helpers
export async function setNeverRememberDevice(username, never = true) {
  try {
    if (never) await setItem(`never_remember_device_${username}`, '1');
    else await removeItem(`never_remember_device_${username}`);
  } catch (e) { console.error('setNeverRememberDevice error', e); }
}

export async function isNeverRememberDevice(username) {
  try {
    const v = await getItem(`never_remember_device_${username}`);
    return !!v;
  } catch (e) { return false; }
}

/**
 * Respond to MFA challenge using CognitoUser
 */
export async function verifyMFA(cognitoUser, mfaCode) {
  try {
    if (!cognitoUser) {
      throw new Error('No Cognito user session found');
    }

    return new Promise((resolve, reject) => {
      cognitoUser.sendMFACode(
        mfaCode,
        {
          onSuccess: async (result) => {
            // Successful MFA - store tokens
            await storeTokens({
              AccessToken: result.getAccessToken().getJwtToken(),
              IdToken: result.getIdToken().getJwtToken(),
              RefreshToken: result.getRefreshToken().getToken(),
            });
            await fetchUserInfo(result.getAccessToken().getJwtToken());
            localStorage.removeItem('temp_username');
            localStorage.removeItem('historyCache');
            
            // Check for new device metadata
            const newDeviceMetadata = cognitoUser.deviceKey ? {
              DeviceKey: cognitoUser.deviceKey,
              DeviceGroupKey: cognitoUser.deviceGroupKey,
            } : null;
            
            resolve({ success: true, newDeviceMetadata });
          },
          onFailure: (err) => {
            reject(new Error(err.message || 'Invalid MFA code'));
          },
        },
        'SOFTWARE_TOKEN_MFA'
      );
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    throw new Error(error.message || 'Invalid MFA code');
  }
}

/**
 * Sign up new user
 */
export async function signUp(email, password, name) {
  try {
    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ],
    });

    const response = await client.send(command);
    return {
      success: true,
      userSub: response.UserSub,
      codeDeliveryDetails: response.CodeDeliveryDetails,
    };
  } catch (error) {
    console.error('Sign up error:', error);
    throw new Error(error.message || 'Failed to sign up');
  }
}

/**
 * Confirm sign up with verification code
 */
export async function confirmSignUp(username, code) {
  try {
    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
    });

    await client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Confirm sign up error:', error);
    throw new Error(error.message || 'Failed to confirm sign up');
  }
}

/**
 * Initiate forgot password flow
 */
export async function forgotPassword(username) {
  try {
    const command = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: username,
    });

    const response = await client.send(command);
    return {
      success: true,
      codeDeliveryDetails: response.CodeDeliveryDetails,
    };
  } catch (error) {
    console.error('Forgot password error:', error);
    throw new Error(error.message || 'Failed to initiate password reset');
  }
}

/**
 * Confirm forgot password with code and new password
 */
export async function confirmForgotPassword(username, code, newPassword) {
  try {
    const command = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
      Password: newPassword,
    });

    await client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Confirm forgot password error:', error);
    throw new Error(error.message || 'Failed to reset password');
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshSession() {
  try {
    const refreshToken = await getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await client.send(command);

    if (response.AuthenticationResult) {
      await storeTokens(response.AuthenticationResult);
      return { success: true };
    }

    throw new Error('Failed to refresh session');
  } catch (error) {
    console.error('Refresh session error:', error);
    
    // Only clear tokens if the refresh token itself is invalid/expired
    // Don't clear on network errors or temporary failures
    if (error.name === 'NotAuthorizedException' || error.message?.includes('Refresh Token has expired')) {
      console.log('Refresh token expired, clearing all tokens');
      await clearTokens();
    }
    
    throw error;
  }
}

/**
 * Clear all stored tokens (without calling Cognito)
 */
async function clearTokens() {
  await removeItem(ACCESS_TOKEN_KEY);
  await removeItem(ID_TOKEN_KEY);
  await removeItem(REFRESH_TOKEN_KEY);
  await removeItem(USER_INFO_KEY);
  localStorage.removeItem('historyCache');
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    const accessToken = await getItem(ACCESS_TOKEN_KEY);
    
    if (accessToken) {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      });
      await client.send(command);
    }
  } catch (error) {
    console.error('Sign out error:', error);
  } finally {
    // Clear all tokens
    await clearTokens();
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser() {
  try {
    const accessToken = await getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      return null;
    }

    // Check if token is expired
    const tokenPayload = parseJwt(accessToken);
    if (tokenPayload.exp * 1000 < Date.now()) {
      // Token expired, try to refresh
      await refreshSession();
      return getCurrentUser(); // Retry with new token
    }

    const userInfo = await getItem(USER_INFO_KEY);
    return userInfo ? JSON.parse(userInfo) : null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const accessToken = await getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return false;

  const tokenPayload = parseJwt(accessToken);
  return tokenPayload.exp * 1000 > Date.now();
}

/**
 * Get access token (for API calls)
 */
export async function getAccessToken() {
  const accessToken = await getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;

  // Check if token is expired
  const tokenPayload = parseJwt(accessToken);
  if (tokenPayload.exp * 1000 < Date.now()) {
    // Token expired, try to refresh
    try {
      await refreshSession();
      return await getItem(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return null;
    }
  }

  return accessToken;
}

/**
 * Confirm the current device (NewDeviceMetadata) and mark it remembered.
 * Uses the current session's AccessToken to call ConfirmDevice + UpdateDeviceStatus.
 */
export async function confirmDeviceAndRemember(newDeviceMetadata, username, deviceName = 'web') {
  if (!newDeviceMetadata?.DeviceKey || !newDeviceMetadata?.DeviceGroupKey) {
    throw new Error('Missing device metadata');
  }
  if (!username) {
    throw new Error('Username required to store device credentials');
  }

  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not authenticated');

  try {
    // Recreate CognitoUser to use its built-in device methods
    const userData = {
      Username: username,
      Pool: userPool,
    };
    const cognitoUser = new CognitoUser(userData);
    
    // Get all tokens to create a proper session
    const idToken = await getItem(ID_TOKEN_KEY);
    const refreshToken = await getItem(REFRESH_TOKEN_KEY);
    
    // Create proper token objects
    const AccessToken = new CognitoAccessToken({ AccessToken: accessToken });
    const IdToken = new CognitoIdToken({ IdToken: idToken });
    const RefreshToken = new CognitoRefreshToken({ RefreshToken: refreshToken });
    
    // Create a proper session
    const session = new CognitoUserSession({
      IdToken,
      AccessToken,
      RefreshToken,
    });
    
    cognitoUser.setSignInUserSession(session);
    
    // Set device metadata
    cognitoUser.deviceKey = newDeviceMetadata.DeviceKey;
    cognitoUser.deviceGroupKey = newDeviceMetadata.DeviceGroupKey;

    return new Promise((resolve, reject) => {
      cognitoUser.setDeviceStatusRemembered({
        onSuccess: async (result) => {
          // Store device key for future logins
          await setStoredDeviceKey(username, cognitoUser.deviceKey);
          resolve({ deviceKey: cognitoUser.deviceKey, method: 'client' });
        },
        onFailure: (err) => {
          console.error('setDeviceStatusRemembered failed:', err);
          reject(new Error('Failed to remember device: ' + err.message));
        },
      });
    });
  } catch (err) {
    console.error('confirmDeviceAndRemember failed', err);
    throw new Error('Failed to confirm device. Please try signing in again.');
  }
}

/**
 * Get ID token (contains user claims)
 */
export async function getIdToken() {
  const idToken = await getItem(ID_TOKEN_KEY);
  if (!idToken) return null;

  // Check if token is expired
  const tokenPayload = parseJwt(idToken);
  if (tokenPayload.exp * 1000 < Date.now()) {
    // Token expired, try to refresh
    try {
      await refreshSession();
      return await getItem(ID_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to refresh id token:', error);
      return null;
    }
  }

  return idToken;
}

/**
 * Refresh user info from Cognito (force cache update)
 */
export async function refreshUserInfo() {
  try {
    const accessToken = await getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      return null;
    }
    await fetchUserInfo(accessToken);
    const userInfo = await getItem(USER_INFO_KEY);
    return userInfo ? JSON.parse(userInfo) : null;
  } catch (error) {
    console.error('Refresh user info error:', error);
    return null;
  }
}

// Helper functions

async function storeTokens(authResult) {
  if (authResult.AccessToken) {
    await setItem(ACCESS_TOKEN_KEY, authResult.AccessToken);
  }
  if (authResult.IdToken) {
    await setItem(ID_TOKEN_KEY, authResult.IdToken);
  }
  if (authResult.RefreshToken) {
    await setItem(REFRESH_TOKEN_KEY, authResult.RefreshToken);
  }
}

async function fetchUserInfo(accessToken) {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await client.send(command);

    const userInfo = {
      username: response.Username,
      sub: response.UserAttributes.find(attr => attr.Name === 'sub')?.Value,
      email: response.UserAttributes.find(attr => attr.Name === 'email')?.Value,
      name: response.UserAttributes.find(attr => attr.Name === 'name')?.Value,
      picture: response.UserAttributes.find(attr => attr.Name === 'picture')?.Value,
      email_verified: response.UserAttributes.find(attr => attr.Name === 'email_verified')?.Value === 'true',
    };

    await setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  } catch (error) {
    console.error('Fetch user info error:', error);
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return { exp: 0 };
  }
}

/**
 * Client helper: call backend endpoint to remember/forget a device (secure admin API)
 * Expects the backend to be configured at VITE_API_URL and protected by Cognito authorizer
 */
export async function rememberDeviceBackend(deviceKey, remember = true) {
  try {
    const idToken = await getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch(`${import.meta.env.VITE_API_URL}/device/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ deviceKey, remember }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update device status');
    }

    return await res.json();
  } catch (err) {
    console.error('rememberDeviceBackend error', err);
    throw err;
  }
}

export async function listDevicesBackend(limit = 50) {
  try {
    const idToken = await getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch(`${import.meta.env.VITE_API_URL}/device/list?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to list devices');
    }

    return await res.json();
  } catch (err) {
    console.error('listDevicesBackend error', err);
    throw err;
  }
}

export async function forgetDeviceBackend(deviceKey) {
  try {
    const idToken = await getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch(`${import.meta.env.VITE_API_URL}/device/forget`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ deviceKey }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to forget device');
    }

    return await res.json();
  } catch (err) {
    console.error('forgetDeviceBackend error', err);
    throw err;
  }
}

export async function checkDeviceBackend(deviceKey) {
  try {
    const idToken = await getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch(`${import.meta.env.VITE_API_URL}/device/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ deviceKey }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to check device');
    }

    return await res.json();
  } catch (err) {
    console.error('checkDeviceBackend error', err);
    throw err;
  }
}
