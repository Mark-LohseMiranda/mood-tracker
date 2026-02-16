/**
 * Web Share API utilities for PWA sharing
 */

export async function shareApp(stats = {}) {
  // Check if Web Share API is supported
  if (!navigator.share) {
    console.log('Web Share API not supported');
    return false;
  }

  const { entryCount = 0, daysTracked = 0, streak = 0, isAuthenticated = false } = stats;

  let message = '🌟 Check out My Mood Tracker! ';
  
  if (isAuthenticated && entryCount > 0) {
    const parts = [];
    if (daysTracked > 0) parts.push(`${daysTracked} days tracked`);
    if (streak > 0) parts.push(`${streak} day streak`);
    if (entryCount > 0) parts.push(`${entryCount} entries`);
    if (parts.length > 0) {
      message += `I've been: ${parts.join(', ')}. `;
    }
  }

  message += 'A secure, encrypted mood & sleep tracker. Try it out!';

  try {
    await navigator.share({
      title: 'My Mood Tracker',
      text: message,
      url: 'https://myemtee.com/'
    });
    return true;
  } catch (error) {
    // User cancelled or error occurred
    if (error.name !== 'AbortError') {
      console.error('Share failed:', error);
    }
    return false;
  }
}

/**
 * Check if Web Share API is available
 */
export function isShareSupported() {
  return !!navigator.share;
}

/**
 * Calculate user tracking stats from entries
 */
export async function calculateUserStats(entries = []) {
  if (!entries || entries.length === 0) {
    return {
      entryCount: 0,
      daysTracked: 0,
      streak: 0,
      earliestDate: null,
      latestDate: null
    };
  }

  // Get unique dates
  const uniqueDates = new Set(entries.map(e => e.localDate)).size;

  // Sort entries by localDate to calculate streak
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.localDate) - new Date(b.localDate)
  );

  // Calculate current streak (consecutive days from today backwards)
  let streak = 0;
  let currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0);

  for (let i = sortedEntries.length - 1; i >= 0; i--) {
    const entryDate = new Date(sortedEntries[i].localDate + 'T00:00:00Z');
    
    // Check if this entry is today or consecutive with the current streak
    const daysDiff = Math.floor((currentDate - entryDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0 || daysDiff === streak) {
      streak++;
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    } else {
      break; // Streak is broken
    }
  }

  return {
    entryCount: entries.length,
    daysTracked: uniqueDates,
    streak: streak,
    earliestDate: sortedEntries[0]?.localDate,
    latestDate: sortedEntries[sortedEntries.length - 1]?.localDate
  };
}
