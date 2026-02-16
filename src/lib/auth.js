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
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = import.meta.env.VITE_COGNITO_REGION;
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

const client = new CognitoIdentityProviderClient({ region: REGION });

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

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (error) {
    return false;
  }
}

async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
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

async function setItem(key, value) {
  let indexedDbError = null;

  try {
    const database = await initDB();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    indexedDbError = error;
  }

  if (hasLocalStorage()) {
    localStorage.setItem(key, value);
    return;
  }

  if (indexedDbError) {
    throw indexedDbError;
  }
}

async function getItem(key) {
  try {
    const database = await initDB();
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (value !== undefined && value !== null) {
      return value;
    }
  } catch (error) {
    // Fallback to localStorage below.
  }

  if (hasLocalStorage()) {
    return localStorage.getItem(key);
  }

  return null;
}

async function removeItem(key) {
  let indexedDbError = null;

  try {
    const database = await initDB();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    indexedDbError = error;
  }

  if (hasLocalStorage()) {
    localStorage.removeItem(key);
    return;
  }

  if (indexedDbError) {
    throw indexedDbError;
  }
}

/**
 * Sign in with username and password
 */
export async function signIn(username, password) {
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await client.send(command);

    // Check if MFA is required
    if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      return {
        challengeName: 'SOFTWARE_TOKEN_MFA',
        session: response.Session,
      };
    }

    // Check if new password is required
    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return {
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: response.Session,
      };
    }

    // Successful authentication
    if (response.AuthenticationResult) {
      await storeTokens(response.AuthenticationResult);
      await fetchUserInfo(response.AuthenticationResult.AccessToken);
      // Clear history cache on login to ensure fresh data from server
      localStorage.removeItem('historyCache');
      return { success: true };
    }

    throw new Error('Unexpected authentication response');
  } catch (error) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
}

/**
 * Respond to MFA challenge
 */
export async function verifyMFA(session, mfaCode) {
  try {
    // Get from localStorage since we stored it there during login
    const tempUsername = localStorage.getItem('temp_username');
    
    const command = new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      Session: session,
      ChallengeResponses: {
        SOFTWARE_TOKEN_MFA_CODE: mfaCode,
        USERNAME: tempUsername,
      },
    });

    const response = await client.send(command);

    if (response.AuthenticationResult) {
      await storeTokens(response.AuthenticationResult);
      await fetchUserInfo(response.AuthenticationResult.AccessToken);
      localStorage.removeItem('temp_username');
      // Clear history cache on login to ensure fresh data from server
      localStorage.removeItem('historyCache');
      return { success: true };
    }

    throw new Error('MFA verification failed');
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
    let accessToken = await getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      await refreshSession();
      accessToken = await getItem(ACCESS_TOKEN_KEY);
      if (!accessToken) {
        return null;
      }
    }

    // Check if token is expired
    const tokenPayload = parseJwt(accessToken);
    if (tokenPayload.exp * 1000 < Date.now()) {
      // Token expired, try to refresh
      await refreshSession();
      accessToken = await getItem(ACCESS_TOKEN_KEY);
      if (!accessToken) {
        return null;
      }
    }

    let userInfo = await getItem(USER_INFO_KEY);
    if (!userInfo) {
      await fetchUserInfo(accessToken);
      userInfo = await getItem(USER_INFO_KEY);
    }

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
  let accessToken = await getItem(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    try {
      await refreshSession();
      accessToken = await getItem(ACCESS_TOKEN_KEY);
      if (!accessToken) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  const tokenPayload = parseJwt(accessToken);
  if (tokenPayload.exp * 1000 > Date.now()) {
    return true;
  }

  try {
    await refreshSession();
    const refreshedAccessToken = await getItem(ACCESS_TOKEN_KEY);
    if (!refreshedAccessToken) {
      return false;
    }

    const refreshedPayload = parseJwt(refreshedAccessToken);
    return refreshedPayload.exp * 1000 > Date.now();
  } catch (error) {
    return false;
  }
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
