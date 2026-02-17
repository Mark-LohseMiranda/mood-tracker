"use strict";

const {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { 
  S3Client, 
  DeleteObjectCommand,
  ListObjectsV2Command 
} = require("@aws-sdk/client-s3");
const { CognitoIdentityProviderClient, GetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

async function deleteAccount(event) {
  // Get access token from Authorization header
  const authHeader = event.headers.Authorization || event.headers.authorization;
  const accessToken = authHeader?.replace('Bearer ', '');
  
  if (!accessToken) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing access token' })
    };
  }
  
  // Validate token and get user info
  let userId;
  try {
    const getUserResponse = await cognito.send(new GetUserCommand({
      AccessToken: accessToken
    }));
    userId = getUserResponse.UserAttributes.find(attr => attr.Name === 'sub')?.Value;
    if (!userId) {
      throw new Error('Invalid token');
    }
  } catch (error) {
    console.error('Token validation error:', error);
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid or expired token' })
    };
  }
  
  try {
    // Delete all profile pictures from S3
    try {
      const listResponse = await s3.send(new ListObjectsV2Command({
        Bucket: process.env.PROFILE_PICTURES_BUCKET,
        Prefix: `${userId}/`
      }));
      
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const object of listResponse.Contents) {
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.PROFILE_PICTURES_BUCKET,
            Key: object.Key
          }));
          console.log(`Deleted S3 object: ${object.Key}`);
        }
      }
    } catch (s3Error) {
      console.error('Error deleting S3 objects:', s3Error);
      // Continue with account deletion even if S3 cleanup fails
    }
    
    // Delete all DynamoDB entries for this user
    try {
      const entries = await db.send(new QueryCommand({
        TableName: 'MoodEntries',
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: {
          ':u': { S: userId }
        }
      }));
      
      // Delete each entry
      if (entries.Items && entries.Items.length > 0) {
        console.log(`Found ${entries.Items.length} mood entries to delete`);
        for (const item of entries.Items) {
          await db.send(new DeleteItemCommand({
            TableName: 'MoodEntries',
            Key: {
              userId: { S: userId },
              timestamp: item.timestamp
            }
          }));
        }
        console.log(`Successfully deleted ${entries.Items.length} mood entries`);
      } else {
        console.log('No mood entries found for user');
      }
    } catch (dbError) {
      console.error('Error deleting DynamoDB entries:', dbError);
      // This is critical - throw error so frontend knows deletion failed
      throw new Error('Failed to delete mood entries: ' + dbError.message);
    }
    
    // Note: Cognito user deletion is handled by the frontend directly
    // to avoid token validation issues
    
    console.log(`Successfully deleted account data for user: ${userId}`);
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Account data deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting account:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || 'Failed to delete account' })
    };
  }
}

module.exports.handler = wrap(deleteAccount);
