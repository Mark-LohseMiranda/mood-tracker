"use strict";

const { CognitoIdentityProviderClient, AdminUpdateDeviceStatusCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CORS_HEADERS, wrap } = require('./lib/utils');

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

async function handler(event) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body = JSON.parse(event.body || '{}');
  const deviceKey = body.deviceKey;
  const remember = Boolean(body.remember);

  if (!deviceKey) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'deviceKey required' }) };
  }

  const username = claims['cognito:username'] || claims['username'] || claims['sub'];
  if (!username) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const cmd = new AdminUpdateDeviceStatusCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
    DeviceKey: deviceKey,
    DeviceRememberedStatus: remember ? 'remembered' : 'not_remembered',
  });

  try {
    await client.send(cmd);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('AdminUpdateDeviceStatus error', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Failed to update device status' }) };
  }
}

module.exports.handler = wrap(handler);
