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
    const uniqueDates = new Set(entries.map(e => e.localDate.S));
    const daysTracked = uniqueDates.size;
    const entryCount = entries.length;

    // Calculate streak: consecutive days from today backwards
    const sortedDates = Array.from(uniqueDates).sort().reverse(); // newest first
    let streak = 0;
    let currentDate = new Date();
    currentDate.setUTCHours(0, 0, 0, 0);

    for (const dateStr of sortedDates) {
      const entryDate = new Date(dateStr + 'T00:00:00Z');
      const daysDiff = Math.floor((currentDate - entryDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === streak) {
        streak++;
        currentDate.setUTCDate(currentDate.getUTCDate() - 1);
      } else {
        break; // Streak is broken
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
