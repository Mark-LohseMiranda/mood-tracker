import { useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { shareApp, isShareSupported } from './lib/sharing';

export default function ShareButton() {
  const [visible, setVisible] = useState(false);
  const { isAuthenticated, user, getIdToken } = useAuthContext();
  const [stats, setStats] = useState({
    entryCount: 0,
    daysTracked: 0,
    streak: 0,
    isAuthenticated: false
  });

  useEffect(() => {
    setVisible(isShareSupported());
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      if (!isAuthenticated || !user) {
        setStats(prev => ({ ...prev, isAuthenticated: false }));
        return;
      }

      try {
        // Fetch pre-calculated stats from backend
        const token = await getIdToken();
        const apiUrl = `${import.meta.env.VITE_API_URL}/user/stats`;
        const response = await fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const apiStats = await response.json();
          setStats({
            ...apiStats,
            isAuthenticated: true
          });
        } else {
          setStats(prev => ({ ...prev, isAuthenticated: true }));
        }
      } catch (error) {
        // Silently fail, just show authenticated state
        console.debug('Stats loading failed:', error);
        setStats(prev => ({ ...prev, isAuthenticated: true }));
      }
    };

    loadStats();
  }, [isAuthenticated, user, getIdToken]);

  const handleShare = async () => {
    await shareApp(stats);
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleShare}
      className="floating-share-button"
      title="Share Mood Tracker"
      aria-label="Share app"
    >
      ↗️
    </button>
  );
}
