"use strict";

const { CognitoIdentityProviderClient, AdminForgetDeviceCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CORS_HEADERS, wrap } = require('./lib/utils');

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

async function handler(event) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body = JSON.parse(event.body || '{}');
  const deviceKey = body.deviceKey;

  if (!deviceKey) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'deviceKey required' }) };
  }

  const username = claims['cognito:username'] || claims['username'] || claims['sub'];
  if (!username) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const cmd = new AdminForgetDeviceCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
    DeviceKey: deviceKey,
  });

  try {
    await client.send(cmd);
    // Also remove from localStorage on success (client should handle too)
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('AdminForgetDevice error', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Failed to forget device' }) };
  }
}

module.exports.handler = wrap(handler);
