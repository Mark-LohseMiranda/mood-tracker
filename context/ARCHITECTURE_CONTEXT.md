# Architecture Context

## High-Level Topology

1. React SPA served from S3 + CloudFront
2. Browser authenticates directly with Cognito SDK (no hosted UI redirect flow)
3. Browser sends JWT bearer tokens to API Gateway endpoints
4. API Gateway uses Cognito User Pool authorizer (except selected endpoints)
5. Lambda functions read/write DynamoDB and generate S3 presigned upload URLs

## Data Model (DynamoDB)

### MoodEntries Table
Composite key:
- Partition key: `userId`
- Sort key: `timestamp`

Common attributes:
- `localDate` (YYYY-MM-DD, local user timezone date)
- `feeling` (encrypted string)
- `consumed` (encrypted string or legacy map)
- `notes` (encrypted string)
- `sleepQuality`, `sleepDuration` (first entry of day)

### UserStats Table
Stores pre-calculated user statistics for sharing:
- Partition key: `userId`

Attributes:
- `entryCount` (Number) - total entries created
- `daysTracked` (Number) - unique days with at least one entry
- `streak` (Number) - current consecutive days streak
- `lastUpdated` (ISO timestamp) - when stats were last recalculated

## Frontend Data Flow

Entry creation path:
1. Build plaintext entry in UI
2. Encrypt sensitive fields in browser with `encryptEntry()`
3. POST encrypted payload to `/entries`
4. Backend recalculates and caches stats in UserStats table
5. Invalidate month cache key in `historyCache`

History path:
1. Fetch encrypted entries from backend
2. Decrypt in browser with `decryptEntry()`/`decryptEntries()`
3. Compute UI averages and render calendar/day details

Share stats path:
1. ShareButton is visible on iOS/Android with Web Share API
2. When clicked, authenticated users fetch `/user/stats` (pre-calculated server-side)
3. Unauthenticated users see generic share message
4. Web Share API opens native share sheet with personalized message: "I've been: X days tracked, Y day streak, Z entries"

## Backend Handler Pattern

Most handlers use:
- `const { wrap, CORS_HEADERS } = require('./lib/utils');`
- `module.exports.handler = wrap(handler);`

Implications:
- Keep thrown errors generic to users.
- Always return consistent CORS headers.

## PWA Update Behavior

`src/main.jsx` registers service worker and checks updates every 60s.
For iOS compatibility, app unregisters existing SW registrations and reloads when refresh is needed.
