"use strict";

const {
  DynamoDBClient,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

async function getEntriesForMonth(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers:    CORS_HEADERS,
      body:       JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  const userId = claims.sub;

  // Parse year/month from query string
  const qs = event.queryStringParameters || {};
  const year  = qs.year;   // e.g. "2025"
  const month = qs.month;  // e.g. "05"
  if (!year || !month || month.length !== 2) {
    return {
      statusCode: 400,
      headers:    CORS_HEADERS,
      body:       JSON.stringify({ error: 'Must provide year and month (MM)' }),
    };
  }

  // Build the "YYYY-MM" prefix for the sort key
  const ymPrefix = `${year}-${month}`;

  // Query DynamoDB for all items with key begins_with( timestamp, "YYYY-MM" )
  const resp = await db.send(new QueryCommand({
    TableName: 'MoodEntries',
    KeyConditionExpression: 'userId = :u AND begins_with(#ts, :ym)',
    ExpressionAttributeNames: {
      '#ts': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':u':  { S: userId },
      ':ym': { S: ymPrefix }
    }
  }));

  // Group by day (YYYY-MM-DD) and collect entries with feelings and timestamps
  const byDay = {};
  (resp.Items || []).forEach(item => {
    // Use localDate if available (new entries), fallback to timestamp extraction (old entries)
    let day;
    if (item.localDate && item.localDate.S) {
      day = item.localDate.S; // e.g. "2025-05-14"
    } else {
      const ts = item.timestamp.S;        // e.g. "2025-05-14T08:23:45.123Z"
      day = ts.slice(0, 10);              // "2025-05-14" (fallback for old entries)
    }
    
    // Store the feeling value (encrypted string or unencrypted number)
    let feelingValue;
    if (item.feeling.N) {
      feelingValue = item.feeling.N; // Unencrypted number as string
    } else if (item.feeling.S) {
      feelingValue = item.feeling.S; // Encrypted string
    } else {
      return; // Skip invalid entries
    }

    if (!byDay[day]) {
      byDay[day] = [];
    }
    byDay[day].push({
      feeling: feelingValue,
      timestamp: item.timestamp.S
    });
  });

  // Build array of { date, entries: [{feeling, timestamp}] }
  // Frontend will decrypt and use real timestamps
  const results = Object.entries(byDay).map(([date, entries]) => ({
    date,
    entries // Array of {feeling, timestamp} objects
  }));

  return {
    statusCode: 200,
    headers:    CORS_HEADERS,
    body:       JSON.stringify(results),
  };
}

module.exports.handler = wrap(getEntriesForMonth);
