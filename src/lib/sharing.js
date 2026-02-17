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

  console.log('📤 shareApp called with:', { entryCount, daysTracked, streak, isAuthenticated });

  let message;
  
  if (isAuthenticated && entryCount > 0) {
    const parts = [];
    if (daysTracked > 0) parts.push(`${daysTracked} days tracked`);
    if (streak > 0) parts.push(`${streak} day streak`);
    if (entryCount > 0) parts.push(`${entryCount} entries`);
    
    // Personalized message with stats
    message = `🌟 Check out My Mood Tracker - a secure, encrypted mood & sleep tracker! My stats: ${parts.join(', ')}. Try it out!`;
  } else {
    // Generic message for non-authenticated users
    message = '🌟 Check out My Mood Tracker! A secure, encrypted mood & sleep tracker. Try it out!';
  }

  console.log('📤 Final share message:', message);
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
