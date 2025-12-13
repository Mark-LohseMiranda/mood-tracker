// src/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { 
  getCurrentUser, 
  isAuthenticated as checkAuth, 
  signOut as authSignOut,
  getAccessToken,
  getIdToken,
  refreshUserInfo as refreshUser
} from './lib/auth';

const AuthContext = createContext(null);

export function AuthContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const authenticated = await checkAuth();
      if (authenticated) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await authSignOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Sign out failed:', error);
      // Clear state anyway
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const refreshUserInfo = async () => {
    try {
      const updatedUser = await refreshUser();
      if (updatedUser) {
        setUser(updatedUser);
      }
      return updatedUser;
    } catch (error) {
      console.error('Refresh user info failed:', error);
      return null;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    checkAuthStatus,
    signOut,
    getAccessToken,
    getIdToken,
    refreshUserInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthContextProvider');
  }
  return context;
}
