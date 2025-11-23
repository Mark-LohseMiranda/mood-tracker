"use strict";

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

module.exports = {
  CORS_HEADERS,
  wrap,
};
