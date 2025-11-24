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

  // Query all entries for the user (we need to scan because localDate is not part of the key)
  // For performance, we query a date range that covers potential timezone differences
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const prevDayStr = prevDay.toISOString().slice(0, 10);
  const nextDayStr = nextDay.toISOString().slice(0, 10);
  
  // Query for timestamps that might correspond to this local date
  // (previous day, current day, or next day in UTC)
  const resp = await db.send(new QueryCommand({
    TableName: 'MoodEntries',
    KeyConditionExpression: 'userId = :u AND #ts BETWEEN :start AND :end',
    ExpressionAttributeNames: {
      '#ts': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':u': { S: userId },
      ':start': { S: prevDayStr },
      ':end': { S: nextDayStr + 'T23:59:59.999Z' }
    }
  }));

  // Filter entries to match the requested localDate
  const filteredItems = (resp.Items || []).filter(item => {
    if (item.localDate && item.localDate.S) {
      // Use localDate if available (new entries)
      return item.localDate.S === date;
    } else {
      // Fallback for old entries without localDate
      return item.timestamp.S.startsWith(date);
    }
  });

  // Format entries
  const entries = filteredItems.map(item => ({
    timestamp: item.timestamp.S,
    localDate: item.localDate?.S || item.timestamp.S.slice(0, 10),
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
