"use strict";

const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command 
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Credentials": true,
};

function wrap(fn) {
  return async (event, context) => {
    try {
      return await fn(event, context);
    } catch (err) {
      console.error("Handler error:", err);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  };
}

// Core createEntry logic
async function _createEntry(event) {
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
    feeling:   { N: String(data.feeling) },
    consumed: {
      M: {
        prescriptions: { BOOL: data.consumed.prescriptions },
        caffeine:      { BOOL: data.consumed.caffeine },
        marijuana:     { BOOL: data.consumed.marijuana },
      }
    },
    notes:     { S: data.notes || '' }
  };
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

// Core getTodayEntry logic
async function _getTodayEntry(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }
  const userId = claims.sub;
  const today = new Date().toISOString().slice(0, 10);

  const resp = await db.send(
    new QueryCommand({
      TableName: "MoodEntries",
      KeyConditionExpression: "userId = :u AND begins_with(#ts, :d)",
      ExpressionAttributeNames: {
        "#ts": "timestamp",
      },
      ExpressionAttributeValues: {
        ":u": { S: userId },
        ":d": { S: today },
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
    feeling: Number(item.feeling.N),
    sleepQuality: Number(item.sleepQuality.N),
    sleepDuration: Number(item.sleepDuration.N),
    consumed: {
      prescriptions: item.consumed.M.prescriptions.BOOL,
      caffeine: item.consumed.M.caffeine.BOOL,
      marijuana: item.consumed.M.marijuana.BOOL,
    },
    notes: item.notes.S,
    timestamp: item.timestamp.S,
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(entry),
  };
}

async function _getEntriesForMonth(event) {
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

  // Build the “YYYY-MM” prefix for the sort key
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
    const val = Number(item.feeling.N); // feeling as number

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

async function _getProfilePictureUploadUrl(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  const userId = claims.sub;
  
  // Get file extension and old picture URL from query parameters
  const qs = event.queryStringParameters || {};
  const fileType = qs.fileType || 'image/jpeg';
  const extension = fileType.split('/')[1] || 'jpg';
  const oldPictureUrl = qs.oldPictureUrl;
  
  console.log('oldPictureUrl received:', oldPictureUrl);
  console.log('PROFILE_PICTURES_BUCKET:', process.env.PROFILE_PICTURES_BUCKET);
  console.log('AWS_REGION:', process.env.AWS_REGION);
  
  try {
    // Delete old profile picture if it exists
    if (oldPictureUrl) {
      const bucketUrl = `https://${process.env.PROFILE_PICTURES_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
      console.log('Expected bucket URL:', bucketUrl);
      console.log('Does oldPictureUrl start with bucketUrl?', oldPictureUrl.startsWith(bucketUrl));
      
      if (oldPictureUrl.startsWith(bucketUrl)) {
        const oldKey = oldPictureUrl.replace(bucketUrl, '');
        console.log('oldKey extracted:', oldKey);
        console.log('Does oldKey start with userId?', oldKey.startsWith(`${userId}/`));
        
        // Verify the key belongs to this user before deleting
        if (oldKey.startsWith(`${userId}/`)) {
          try {
            console.log('Attempting to delete:', { Bucket: process.env.PROFILE_PICTURES_BUCKET, Key: oldKey });
            await s3.send(new DeleteObjectCommand({
              Bucket: process.env.PROFILE_PICTURES_BUCKET,
              Key: oldKey
            }));
            console.log(`Successfully deleted old profile picture: ${oldKey}`);
          } catch (deleteError) {
            console.error('Error deleting old picture:', deleteError);
            // Continue even if delete fails
          }
        } else {
          console.log('oldKey does not belong to this user, skipping delete');
        }
      } else {
        console.log('oldPictureUrl does not match expected bucket URL format');
      }
    } else {
      console.log('No oldPictureUrl provided');
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const key = `${userId}/${timestamp}.${extension}`;
    
    // Create presigned URL for upload (without ACL - bucket policy handles public read)
    const command = new PutObjectCommand({
      Bucket: process.env.PROFILE_PICTURES_BUCKET,
      Key: key,
      ContentType: fileType
    });
    
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
    const publicUrl = `https://${process.env.PROFILE_PICTURES_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        uploadUrl,
        publicUrl
      })
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to generate upload URL' })
    };
  }
}

async function _deleteAccount(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  const userId = claims.sub;
  
  try {
    // Import Cognito client
    const { CognitoIdentityProviderClient, DeleteUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
    const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
    
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
    const { DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
    
    // Query all entries first
    const entries = await db.send(new QueryCommand({
      TableName: 'MoodEntries',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: {
        ':u': { S: userId }
      }
    }));
    
    // Delete each entry
    if (entries.Items && entries.Items.length > 0) {
      for (const item of entries.Items) {
        await db.send(new DeleteItemCommand({
          TableName: 'MoodEntries',
          Key: {
            userId: { S: userId },
            timestamp: item.timestamp
          }
        }));
      }
      console.log(`Deleted ${entries.Items.length} mood entries`);
    }
    
    // Delete user from Cognito
    await cognito.send(new DeleteUserCommand({
      AccessToken: accessToken
    }));
    
    console.log(`Successfully deleted account for user: ${userId}`);
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Account deleted successfully' })
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

module.exports.createEntry = wrap(_createEntry);
module.exports.getTodayEntry = wrap(_getTodayEntry);
module.exports.getEntriesForMonth = wrap(_getEntriesForMonth);
module.exports.getProfilePictureUploadUrl = wrap(_getProfilePictureUploadUrl);
module.exports.deleteAccount = wrap(_deleteAccount);
