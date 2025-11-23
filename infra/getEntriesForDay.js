"use strict";

const {
  DynamoDBClient,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

async function getEntriesForDay(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  const userId = claims.sub;

  // Parse date from query string (YYYY-MM-DD)
  const qs = event.queryStringParameters || {};
  const date = qs.date; // e.g. "2025-11-23"
  
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Must provide date in YYYY-MM-DD format' }),
    };
  }

  // Query DynamoDB for all entries on this day
  const resp = await db.send(new QueryCommand({
    TableName: 'MoodEntries',
    KeyConditionExpression: 'userId = :u AND begins_with(#ts, :d)',
    ExpressionAttributeNames: {
      '#ts': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':u': { S: userId },
      ':d': { S: date }
    }
  }));

  // Format entries
  const entries = (resp.Items || []).map(item => ({
    timestamp: item.timestamp.S,
    // Handle both encrypted (string) and unencrypted (number) feeling
    feeling: item.feeling.S || String(item.feeling.N),
    notes: item.notes?.S || '',
    // Handle both encrypted (string) and unencrypted (map) consumed
    consumed: item.consumed.S || {
      prescriptions: item.consumed.M?.prescriptions?.BOOL || false,
      caffeine: item.consumed.M?.caffeine?.BOOL || false,
      marijuana: item.consumed.M?.marijuana?.BOOL || false,
    },
    // Include sleep data if present (only on first entry of day)
    ...(item.sleepQuality ? { sleepQuality: Number(item.sleepQuality.N) } : {}),
    ...(item.sleepDuration ? { sleepDuration: Number(item.sleepDuration.N) } : {}),
  }));

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(entries),
  };
}

module.exports.handler = wrap(getEntriesForDay);
