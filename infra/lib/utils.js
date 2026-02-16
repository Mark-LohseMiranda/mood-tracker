"use strict";

const ALLOWED_ORIGINS = [
  'https://myemtee.com',
  'https://www.myemtee.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Legacy CORS_HEADERS for backward compatibility - uses first allowed origin
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Credentials": "true",
};

function wrap(fn) {
  return async (event, context) => {
    const corsHeaders = getCorsHeaders(event);
    try {
      const result = await fn(event, context);
      // Merge CORS headers into the result
      return {
        ...result,
        headers: {
          ...corsHeaders,
          ...result.headers,
        },
      };
    } catch (err) {
      console.error("Handler error:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  };
}

module.exports = {
  CORS_HEADERS,
  getCorsHeaders,
  wrap,
};
