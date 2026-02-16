import { useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { shareApp, isShareSupported, calculateUserStats } from './lib/sharing';
import { getCachedEntryMetadata } from './lib/indexedDB';

export default function ShareButton() {
  const [visible, setVisible] = useState(false);
  const { isAuthenticated, user } = useAuthContext();
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
        // Load cached entry metadata from IndexedDB
        const metadata = await getCachedEntryMetadata(user.sub);
        
        if (metadata && metadata.length > 0) {
          const calculatedStats = await calculateUserStats(metadata);
          setStats({
            ...calculatedStats,
            isAuthenticated: true
          });
        } else {
          setStats(prev => ({ ...prev, isAuthenticated: true }));
        }
      } catch (error) {
        // Silently fail, just show authenticated state
        console.debug('Stats calculation failed:', error);
        setStats(prev => ({ ...prev, isAuthenticated: true }));
      }
    };

    loadStats();
  }, [isAuthenticated, user]);

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
