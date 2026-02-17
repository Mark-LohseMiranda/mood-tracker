"use strict";

const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { calculateUserStats } = require("./calculateStats");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function getUserStats(event) {
  const userId = event.requestContext.authorizer.claims.sub;

  // Get stats from UserStats table (updated incrementally on each entry)
  const result = await docClient.send(new GetCommand({
    TableName: 'UserStats',
    Key: { userId }
  }));

  let stats;
  
  if (!result.Item) {
    // User doesn't have stats record yet (existing user from before migration)
    // Calculate from all entries once, then save for future requests
    console.log(`Migrating stats for user: ${userId}`);
    
    let calculatedStats;
    try {
      calculatedStats = await calculateUserStats(userId);
      console.log('Calculated stats:', calculatedStats);
    } catch (error) {
      console.error('Failed to calculate stats:', error);
      calculatedStats = { entryCount: 0, daysTracked: 0, streak: 0 };
    }
    
    // Find the most recent entry date for lastStreakDate
    let lastStreakDate = null;
    if (calculatedStats.daysTracked > 0) {
      const recentEntries = await client.send(new QueryCommand({
        TableName: 'MoodEntries',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': { S: userId }
        },
        ScanIndexForward: false, // Descending order
        Limit: 1
      }));
      
      if (recentEntries.Items && recentEntries.Items.length > 0 && recentEntries.Items[0].localDate) {
        lastStreakDate = recentEntries.Items[0].localDate.S;
      }
    }
    
    // Save calculated stats to UserStats table
    stats = {
      userId,
      entryCount: calculatedStats.entryCount || 0,
      daysTracked: calculatedStats.daysTracked || 0,
      streak: calculatedStats.streak || 0,
      lastEntryDate: lastStreakDate,
      lastStreakDate: lastStreakDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({
      TableName: 'UserStats',
      Item: stats
    }));
    
    console.log('Saved migrated stats:', stats);
  } else {
    stats = result.Item;
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      entryCount: stats.entryCount || 0,
      daysTracked: stats.daysTracked || 0,
      streak: stats.streak || 0
    })
  };
}

module.exports.handler = wrap(getUserStats);
