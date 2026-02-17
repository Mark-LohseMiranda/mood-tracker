import { useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { useStats } from './StatsContext';
import { shareApp, isShareSupported } from './lib/sharing';

export default function ShareButton() {
  const [visible, setVisible] = useState(false);
  const { isAuthenticated } = useAuthContext();
  const { stats, loading } = useStats();

  useEffect(() => {
    setVisible(isShareSupported());
  }, []);

  const handleShare = async () => {
    const shareData = {
      entryCount: stats?.entryCount || 0,
      daysTracked: stats?.daysTracked || 0,
      streak: stats?.streak || 0,
      isAuthenticated
    };
    console.log('🔘 Share button clicked with stats:', shareData);
    await shareApp(shareData);
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
