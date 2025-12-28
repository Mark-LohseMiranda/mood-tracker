"use strict";

const { CognitoIdentityProviderClient, AdminGetDeviceCommand } = require('@aws-sdk/client-cognito-identity-provider');
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

  const cmd = new AdminGetDeviceCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
    DeviceKey: deviceKey,
  });

  try {
    const res = await client.send(cmd);
    const remembered = res?.Device?.DeviceRememberedStatus === 'remembered';
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ remembered }) };
  } catch (err) {
    console.error('AdminGetDevice error', err);
    // If device not found, return remembered: false
    if (err.name === 'ResourceNotFoundException' || (err.message && err.message.includes('Device does not exist'))) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ remembered: false }) };
    }
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Failed to check device' }) };
  }
}

module.exports.handler = wrap(handler);
