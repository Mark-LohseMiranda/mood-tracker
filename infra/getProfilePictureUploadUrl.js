"use strict";

const { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { CORS_HEADERS, wrap } = require("./lib/utils");

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function getProfilePictureUploadUrl(event) {
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
  
  try {
    // Delete old profile picture if it exists
    if (oldPictureUrl) {
      const bucketUrl = `https://${process.env.PROFILE_PICTURES_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
      
      if (oldPictureUrl.startsWith(bucketUrl)) {
        const oldKey = oldPictureUrl.replace(bucketUrl, '');
        
        // Verify the key belongs to this user before deleting
        if (oldKey.startsWith(`${userId}/`)) {
          try {
            await s3.send(new DeleteObjectCommand({
              Bucket: process.env.PROFILE_PICTURES_BUCKET,
              Key: oldKey
            }));
            console.log(`Deleted old profile picture: ${oldKey}`);
          } catch (deleteError) {
            console.error('Error deleting old picture:', deleteError);
            // Continue even if delete fails
          }
        }
      }
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

module.exports.handler = wrap(getProfilePictureUploadUrl);
