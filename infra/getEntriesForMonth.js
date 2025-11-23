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

  // Group by day (YYYY-MM-DD) and compute average
  const byDay = {};
  (resp.Items || []).forEach(item => {
    const ts = item.timestamp.S;        // e.g. "2025-05-14T08:23:45.123Z"
    const day = ts.slice(0, 10);        // "2025-05-14"
    
    // Handle both encrypted (string) and unencrypted (number) feeling
    // For encrypted data, we can't compute average on server side
    // So we'll skip encrypted entries in the calendar view
    // Or return a placeholder value
    let val;
    if (item.feeling.N) {
      // Unencrypted number
      val = Number(item.feeling.N);
    } else if (item.feeling.S) {
      // Encrypted - use middle value (3) as placeholder for calendar coloring
      val = 3;
    } else {
      return; // Skip invalid entries
    }

    if (!byDay[day]) {
      byDay[day] = { sum: 0, count: 0 };
    }
    byDay[day].sum += val;
    byDay[day].count += 1;
  });

  // Build array of { date, avgFeeling }
  const results = Object.entries(byDay).map(([date, { sum, count }]) => ({
    date,
    avgFeeling: Math.round(sum / count) // round to nearest integer 1–5
  }));

  return {
    statusCode: 200,
    headers:    CORS_HEADERS,
    body:       JSON.stringify(results),
  };
}

module.exports.handler = wrap(getEntriesForMonth);
