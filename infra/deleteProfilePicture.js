"use strict";

const { 
  S3Client, 
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function deleteProfilePicture(event) {
  const claims = event.requestContext.authorizer.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  const userId = claims.sub;
  
  // Get picture URL from query parameter
  const qs = event.queryStringParameters || {};
  const pictureUrl = qs.url;
  
  if (!pictureUrl) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Picture URL is required' })
    };
  }
  
  try {
    const bucketUrl = `https://${process.env.PROFILE_PICTURES_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
    
    if (!pictureUrl.startsWith(bucketUrl)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid picture URL' })
      };
    }
    
    const key = pictureUrl.replace(bucketUrl, '');
    
    // Verify the key belongs to this user before deleting
    if (!key.startsWith(`${userId}/`)) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Unauthorized to delete this picture' })
      };
    }
    
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.PROFILE_PICTURES_BUCKET,
      Key: key
    }));
    
    console.log(`Deleted profile picture: ${key}`);
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Picture deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting picture:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to delete picture' })
    };
  }
}

module.exports.handler = wrap(deleteProfilePicture);
