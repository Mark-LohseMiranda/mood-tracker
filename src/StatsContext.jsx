import { createContext, useContext, useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';

const StatsContext = createContext();

export function StatsProvider({ children }) {
  const { user, getIdToken } = useAuthContext();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);

  // Fetch stats from API
  const fetchStats = async () => {
    if (!user) {
      setStats(null);
      return;
    }

    try {
      setLoading(true);
      let token;
      try {
        token = await getIdToken();
      } catch (tokenError) {
        console.error('Token refresh failed:', tokenError);
        setStats(null);
        return;
      }
      
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/user/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (resp.ok) {
        const data = await resp.json();
        setStats(data);
        setLastFetch(Date.now());
        console.log('📊 StatsContext: Stats fetched:', data);
      } else {
        console.error('StatsContext: Failed to fetch stats, status:', resp.status);
        setStats(null);
      }
    } catch (e) {
      console.error('StatsContext: Failed to fetch stats:', e);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Invalidate stats cache (call after entry creation)
  const invalidateStats = () => {
    setLastFetch(0); // Force refetch on next focus
    console.log('🔄 StatsContext: Cache invalidated');
  };

  // Fetch stats on component mount
  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  // Refetch stats when app regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ StatsContext: App regained focus, refreshing stats');
        fetchStats();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, getIdToken]);

  return (
    <StatsContext.Provider value={{ stats, loading, fetchStats, invalidateStats }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error('useStats must be used within StatsProvider');
  }
  return context;
}
