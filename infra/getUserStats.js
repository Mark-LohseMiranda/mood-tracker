"use strict";

const { calculateUserStats } = require("./calculateStats");
const { CORS_HEADERS, wrap } = require("./lib/utils");

async function getUserStats(event) {
  const userId = event.requestContext.authorizer.claims.sub;

  // Recalculate stats on-demand from all user entries
  // This ensures stats are always current (e.g., streak properly reflects consecutive days)
  // Users stay logged in via 30-day refresh token, so fresh calculation on share is worth the cost
  const stats = await calculateUserStats(userId);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(stats)
  };
}

module.exports.handler = wrap(getUserStats);
