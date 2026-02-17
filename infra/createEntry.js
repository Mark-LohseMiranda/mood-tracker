"use strict";

const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const db = client;
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Update user stats incrementally
 * @param {string} userId - User's Cognito sub
 * @param {string} localDate - Date in user's timezone (YYYY-MM-DD)
 * @param {boolean} isFirstEntryToday - Is this the first entry for this local date
 */
async function updateUserStats(userId, localDate, isFirstEntryToday) {
  // Use UpdateCommand with if_not_exists to handle missing attributes
  try {
    // Calculate new streak if this is first entry of the day
    let streakExpression = 'streak';
    let streakDateExpression = 'lastStreakDate';
    
    if (isFirstEntryToday) {
      // We need to get current stats to calculate streak
      const statsResult = await docClient.send(new GetCommand({
        TableName: 'UserStats',
        Key: { userId }
      }));
      
      const currentStats = statsResult.Item;
      let newStreak = 1;
      
      console.log('Current stats before update:', currentStats);
      
      if (currentStats && currentStats.lastStreakDate) {
        // Check if today extends the streak
        const todayDate = new Date(localDate + 'T12:00:00');
        todayDate.setDate(todayDate.getDate() - 1);
        const year = todayDate.getFullYear();
        const month = String(todayDate.getMonth() + 1).padStart(2, '0');
        const day = String(todayDate.getDate()).padStart(2, '0');
        const yesterdayStr = `${year}-${month}-${day}`;
        
        console.log(`Date check: localDate=${localDate}, yesterdayStr=${yesterdayStr}, lastStreakDate=${currentStats.lastStreakDate}`);
        
        if (currentStats.lastStreakDate === yesterdayStr) {
          // Consecutive day - increment streak
          newStreak = (currentStats.streak || 0) + 1;
          console.log(`Consecutive day! Incrementing streak to ${newStreak}`);
        } else if (currentStats.lastStreakDate !== localDate) {
          // Streak broken - reset to 1
          newStreak = 1;
          console.log('Streak broken, resetting to 1');
        } else {
          // Same day (maintain current streak)
          newStreak = currentStats.streak || 1;
          console.log(`Same day, maintaining streak at ${newStreak}`);
        }
      } else {
        console.log('No previous streak date, starting streak at 1');
      }
      
      // Update with calculated streak and new streak date
      console.log(`Updating stats: entryCount +1, daysTracked +1, streak=${newStreak}`);
      await docClient.send(new UpdateCommand({
        TableName: 'UserStats',
        Key: { userId },
        UpdateExpression: `
          SET entryCount = if_not_exists(entryCount, :zero) + :one,
              daysTracked = if_not_exists(daysTracked, :zero) + :one,
              streak = :streak,
              lastEntryDate = :date,
              lastStreakDate = :date,
              updatedAt = :now
        `,
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
          ':streak': newStreak,
          ':date': localDate,
          ':now': new Date().toISOString()
        }
      }));
    } else {
      // Not first entry today - only increment entryCount
      await docClient.send(new UpdateCommand({
        TableName: 'UserStats',
        Key: { userId },
        UpdateExpression: `
          SET entryCount = if_not_exists(entryCount, :zero) + :one,
              lastEntryDate = :date,
              updatedAt = :now
        `,
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
          ':date': localDate,
          ':now': new Date().toISOString()
        }
      }));
    }
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
}


async function createEntry(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  const userId = claims.sub;
  const data   = JSON.parse(event.body);
  
  // Use localDate from request (user's timezone), not UTC
  const localDate = data.localDate;
  if (!localDate) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'localDate is required' })
    };
  }

  // 1) Check if any entry exists today (using localDate and userIdLocalDateIndex GSI)
  const existing = await db.send(new QueryCommand({
    TableName: 'MoodEntries',
    IndexName: 'userIdLocalDateIndex',
    KeyConditionExpression: 'userId = :u AND localDate = :d',
    ExpressionAttributeValues: {
      ':u': { S: userId },
      ':d': { S: localDate }
    }
  }));

  // 2) Check if user has already submitted sleep data for this local calendar day
  const hasSleepData = existing.Items && existing.Items.some(item => 
    item.sleepQuality && item.sleepDuration
  );

  // 3) If no sleep data yet and sleep fields provided, save them
  // If no sleep data and no sleep fields, that's OK - frontend will prompt user
  if (hasSleepData && (data.sleepQuality != null || data.sleepDuration != null)) {
    // User is trying to add sleep data when it already exists - reject
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Sleep data already recorded for today. You can only add sleep once per calendar day.'
      })
    };
  }

  // 4) Build the new item
  const timestamp = new Date().toISOString();
  const item = {
    userId:    { S: userId },
    timestamp: { S: timestamp },
    feeling:   { S: String(data.feeling) },  // Changed to String to support encrypted data
    notes:     { S: data.notes || '' }
  };
  
  // Add localDate if provided (for timezone-aware grouping)
  if (data.localDate) {
    item.localDate = { S: data.localDate };
  }
  
  // Handle consumed - can be encrypted string or object
  if (typeof data.consumed === 'string') {
    // Encrypted data
    item.consumed = { S: data.consumed };
  } else {
    // Unencrypted object (backward compatibility)
    item.consumed = {
      M: {
        prescriptions: { BOOL: data.consumed.prescriptions },
        caffeine:      { BOOL: data.consumed.caffeine },
        marijuana:     { BOOL: data.consumed.marijuana },
      }
    };
  }
  
  // Include sleep fields if provided (user chose to add sleep)
  if (data.sleepQuality != null && data.sleepDuration != null) {
    item.sleepQuality  = { N: String(data.sleepQuality) };
    item.sleepDuration = { N: String(data.sleepDuration) };
  }

  // 5) Insert a brand-new item
  await db.send(new PutItemCommand({
    TableName: 'MoodEntries',
    Item: item
  }));

  // 6) Update user stats incrementally
  const isFirstEntryToday = !existing.Items || existing.Items.length === 0;
  console.log(`Stats update: isFirstEntryToday=${isFirstEntryToday}, existingCount=${existing.Items?.length || 0}, localDate=${localDate}`);
  await updateUserStats(userId, localDate, isFirstEntryToday);

  return {
    statusCode: 201,
    headers:    CORS_HEADERS,
    body:       JSON.stringify({
      message: "Entry created successfully.",
      needsSleepTracking: !hasSleepData
    })
  };
}

module.exports.handler = wrap(createEntry);
