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
  const today  = new Date().toISOString().slice(0,10);

  // 1) Check if any entry exists today
  const existing = await db.send(new QueryCommand({
    TableName: 'MoodEntries',
    KeyConditionExpression: 'userId = :u AND begins_with(#ts, :d)',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: {
      ':u': { S: userId },
      ':d': { S: today }
    },
    Limit: 1
  }));

  // 2) If first entry of the day, require sleep fields
  const isFirst = !existing.Items || existing.Items.length === 0;
  if (isFirst && (data.sleepQuality == null || data.sleepDuration == null)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Sleep quality and duration are required on your first entry today.'
      })
    };
  }

  // 3) Build the new item
  const timestamp = new Date().toISOString();
  const item = {
    userId:    { S: userId },
    timestamp: { S: timestamp },
    feeling:   { S: String(data.feeling) },  // Changed to String to support encrypted data
    notes:     { S: data.notes || '' }
  };
  
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
  // only include sleep on the first entry
  if (isFirst) {
    item.sleepQuality  = { N: String(data.sleepQuality) };
    item.sleepDuration = { N: String(data.sleepDuration) };
  }

  // 4) Insert a brand-new item
  await db.send(new PutItemCommand({
    TableName: 'MoodEntries',
    Item: item
  }));

  return {
    statusCode: isFirst ? 201 : 200,
    headers:    CORS_HEADERS,
    body:       JSON.stringify({
      message: isFirst 
        ? "Created your first entry today."
        : "Created an additional entry."
    })
  };
}

module.exports.handler = wrap(createEntry);
