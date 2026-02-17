"use strict";

const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

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
  await db.sendentry
  await db.send(new PutItemCommand({
    TableName: 'MoodEntries',
    Item: item
  }));

  return {
    statusCode: 201,
    headers:    CORS_HEADERS,
    body:       JSON.stringify({
      message: "Entry created successfully.",
      needsSleepTracking: !hasSleepData
  };
}

module.exports.handler = wrap(createEntry);
