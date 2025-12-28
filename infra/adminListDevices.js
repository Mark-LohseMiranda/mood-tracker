"use strict";

const { CognitoIdentityProviderClient, AdminListDevicesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CORS_HEADERS, wrap } = require('./lib/utils');

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

async function handler(event) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const username = claims['cognito:username'] || claims['username'] || claims['sub'];
  if (!username) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit, 10) : 50;

  const cmd = new AdminListDevicesCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
    Limit: limit,
  });

  try {
    const res = await client.send(cmd);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ devices: res.Devices || [] }) };
  } catch (err) {
    console.error('AdminListDevices error', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Failed to list devices' }) };
  }
}

module.exports.handler = wrap(handler);
