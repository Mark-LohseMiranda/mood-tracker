/**
 * Utility to calculate user stats from all entries
 * Used by: getUserStats.js, createEntry.js
 */

const {
  DynamoDBClient,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

/**
 * Calculate stats from all user entries
 * @param {string} userId - Cognito user ID
 * @returns {Promise<{entryCount, daysTracked, streak}>}
 */
async function calculateUserStats(userId) {
  try {
    // Query all entries for this user
    const result = await db.send(new QueryCommand({
      TableName: 'MoodEntries',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: {
        ':u': { S: userId }
      },
      ProjectionExpression: 'localDate, #ts', // Only fetch dates and timestamp
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      }
    }));

    const entries = result.Items || [];
    if (entries.length === 0) {
      return {
        entryCount: 0,
        daysTracked: 0,
        streak: 0
      };
    }

    // Get unique dates and entry count
    const uniqueDates = new Set(entries.map(e => e.localDate?.S).filter(Boolean));
    const daysTracked = uniqueDates.size;
    const entryCount = entries.length;

    // Calculate streak: consecutive days backwards from most recent entry
    const sortedDates = Array.from(uniqueDates).sort().reverse(); // newest first
    let streak = 0;
    
    if (sortedDates.length === 0) {
      return { entryCount, daysTracked, streak };
    }

    // Helper: get date one day before given YYYY-MM-DD string
    const getPreviousDay = (dateStr) => {
      const d = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
      d.setDate(d.getDate() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Start from most recent entry date
    let expectedDate = sortedDates[0];
    streak = 1; // First date counts
    
    // Count consecutive days backwards from most recent
    for (let i = 1; i < sortedDates.length; i++) {
      const previousDay = getPreviousDay(expectedDate);
      if (sortedDates[i] === previousDay) {
        streak++;
        expectedDate = previousDay;
      } else {
        break; // Streak broken
      }
    }

    return {
      entryCount,
      daysTracked,
      streak
    };
  } catch (error) {
    console.error('calculateUserStats error:', error);
    return {
      entryCount: 0,
      daysTracked: 0,
      streak: 0
    };
  }
}

module.exports = { calculateUserStats };
