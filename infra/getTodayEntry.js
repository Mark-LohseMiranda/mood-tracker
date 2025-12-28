"use strict";

const {
  DynamoDBClient,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

async function getTodayEntry(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }
  const userId = claims.sub;
  
  // Use localDate from query params (user's timezone), not UTC
  const localDate = event.queryStringParameters?.localDate;
  if (!localDate) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "localDate query param is required (format: YYYY-MM-DD)" }),
    };
  }

  const resp = await db.send(
    new QueryCommand({
      TableName: "MoodEntries",
      IndexName: "userIdLocalDateIndex",
      KeyConditionExpression: "userId = :u AND localDate = :d",
      ExpressionAttributeValues: {
        ":u": { S: userId },
        ":d": { S: localDate },
      },
      Limit: 1,
    })
  );

  if (!resp.Items || resp.Items.length === 0) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "No entry for today." }),
    };
  }

  const item = resp.Items[0];
  const entry = {
    // Handle both encrypted (string) and unencrypted (number) feeling
    feeling: item.feeling.S || String(item.feeling.N),
    sleepQuality: item.sleepQuality ? Number(item.sleepQuality.N) : undefined,
    sleepDuration: item.sleepDuration ? Number(item.sleepDuration.N) : undefined,
    // Handle both encrypted (string) and unencrypted (map) consumed
    consumed: item.consumed.S || {
      prescriptions: item.consumed.M?.prescriptions?.BOOL || false,
      caffeine: item.consumed.M?.caffeine?.BOOL || false,
      marijuana: item.consumed.M?.marijuana?.BOOL || false,
    },
    notes: item.notes?.S || '',
    timestamp: item.timestamp.S,
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(entry),
  };
}

module.exports.handler = wrap(getTodayEntry);
