"use strict";

const { calculateUserStats } = require("./calculateStats");
const { CORS_HEADERS, wrap } = require("./lib/utils");

async function getUserStats(event) {
  const userId = event.requestContext.authorizer.claims.sub;

  // Calculate stats from all user entries
  const stats = await calculateUserStats(userId);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(stats)
  };
}

module.exports.handler = wrap(getUserStats);
