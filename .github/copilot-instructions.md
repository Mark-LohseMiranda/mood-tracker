# Mood Tracker AI Coding Instructions

## Architecture Overview

This is a **serverless PWA** split into two distinct environments:

- **Frontend**: React 19 + Vite 6 + React Router v7, deployed to S3/CloudFront at [myemtee.com](https://myemtee.com)
- **Backend**: AWS Lambda (Node.js 22) + API Gateway + DynamoDB, deployed via Serverless Framework in `infra/`

**Critical Pattern**: Frontend calls AWS Cognito SDK directly (no hosted UI) and encrypts data client-side before sending to backend.

## Zero-Knowledge Encryption

**All sensitive data is encrypted client-side before storage** using the Web Crypto API:

- **What's encrypted**: `feeling`, `notes`, `consumed` (caffeine, prescriptions, etc.)
- **What's NOT**: `sleepQuality`, `sleepDuration`, `timestamp`, `localDate` (needed for calendar calculations)
- **Key derivation**: `PBKDF2(userSub, salt, 100k iterations)` in [src/lib/encryption.js](src/lib/encryption.js)
- **Algorithm**: AES-256-GCM with random IV per entry

**When modifying data flows**:
1. Encrypt in frontend via `encryptEntry()` before POST ([DailyQuestions.jsx](src/DailyQuestions.jsx#L97-L100))
2. Backend stores encrypted strings as-is ([createEntry.js](infra/createEntry.js#L62-L74))
3. Decrypt in frontend via `decryptEntries()` after fetch ([HistoryCalendar.jsx](src/HistoryCalendar.jsx#L4))

**Never store unencrypted sensitive data in DynamoDB or logs.**

## Authentication Architecture

**Custom Cognito integration** (not Amplify hosted UI):

- Direct SDK calls via `@aws-sdk/client-cognito-identity-provider` in [src/lib/auth.js](src/lib/auth.js)
- **No OAuth redirects** - all forms in-app using `InitiateAuthCommand`, `RespondToAuthChallengeCommand`
- Tokens stored in **IndexedDB** (primary) + localStorage (fallback) for PWA persistence
- JWT access tokens sent in `Authorization: Bearer <token>` header to API Gateway
- [AuthContext.jsx](src/AuthContext.jsx) provides `user`, `isAuthenticated`, `getIdToken()` globally

**MFA flow**: Login → `SMS_MFA`/`SOFTWARE_TOKEN_MFA` challenge → `RespondToAuthChallengeCommand` with code

## Data Model & DynamoDB

**Table**: `MoodEntries` with composite key `userId` (PK) + `timestamp` (SK)

**Schema**:
```javascript
{
  userId: String (Cognito sub),
  timestamp: ISO8601 string,
  localDate: "YYYY-MM-DD" (user's timezone date),
  feeling: String (encrypted emoji),
  consumed: String (encrypted) or Map (legacy),
  notes: String (encrypted),
  sleepQuality: Number (1-5, first entry only),
  sleepDuration: Number (hours, first entry only)
}
```

**Key patterns**:
- First entry of each day **must** include sleep fields ([createEntry.js](infra/createEntry.js#L35-L41))
- Use `localDate` for timezone-aware grouping in calendar ([DailyQuestions.jsx](src/DailyQuestions.jsx#L99))
- Backend queries by `userId` and date prefix: `begins_with(timestamp, '2025-05')`

## Cache Invalidation Pattern

**Problem**: Calendar caches month averages in localStorage to avoid re-decryption.

**Solution**: When creating entry in [DailyQuestions.jsx](src/DailyQuestions.jsx#L121-L135), delete that month's cache key:
```javascript
const ymKey = `${year}-${month}`; // "2025-05"
const cacheObj = JSON.parse(localStorage.getItem('historyCache'));
delete cacheObj[ymKey];
localStorage.setItem('historyCache', JSON.stringify(cacheObj));
```

**Always invalidate cache after mutations** (create/update/delete entries).

## Lambda Function Patterns

**All handlers follow this structure** (see [infra/lib/utils.js](infra/lib/utils.js)):
```javascript
const { wrap, CORS_HEADERS } = require('./lib/utils');

async function handler(event) {
  const userId = event.requestContext.authorizer.claims.sub;
  // ... logic ...
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

module.exports.handler = wrap(handler); // Wraps in try/catch
```

**CORS**: All responses must include `CORS_HEADERS` (wildcard origin for API Gateway authorizer compatibility).

## Serverless Framework Setup

Deploy backend from `infra/`:
```bash
cd infra
npx serverless deploy  # Deploys all 7 functions + API Gateway + DynamoDB
```

**Key config** ([serverless.yml](infra/serverless.yml)):
- `package.individually: true` - each function bundles separately
- Cognito authorizer shared across all endpoints (except `deleteAccount`)
- IAM roles grant minimal DynamoDB/S3/Cognito permissions per function

## Frontend Build & Deploy

```bash
npm run build                # Vite builds to dist/
aws s3 sync dist/ s3://bucket-name/ --delete
aws cloudfront create-invalidation --distribution-id ID --paths "/*"
```

**Environment variables** (`.env` required):
```env
VITE_COGNITO_USER_POOL_ID=us-west-2_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxx
VITE_COGNITO_REGION=us-west-2
VITE_API_URL=https://xxxxx.execute-api.us-west-2.amazonaws.com/dev
```

## PWA Update Mechanism

**iOS-compatible update flow** ([main.jsx](src/main.jsx) + service worker):
1. Check for updates every 60 seconds when app active
2. If new SW detected → unregister old → register new → reload page
3. **Critical**: Must unregister old SW first on iOS for auto-update

**Service worker**: Generated by `vite-plugin-pwa`, serves cached assets offline.

## React Router v7 Patterns

**Routing** in [App.jsx](src/App.jsx):
- Unauthenticated: Landing page → Login/SignUp/ForgotPassword views
- Authenticated: DailyQuestions, HistoryCalendar, AccountSettings, Instructions
- Legal pages (Privacy, Terms, etc.) accessible to all

**Navigation state**: Uses `useLocation()` + `state` to pass feeling emoji from selector to questions page.

## Code Conventions

- **File structure**: Components in `src/`, Lambdas in `infra/`, shared utils in `lib/` subdirs
- **Styling**: Per-component CSS files ([DailyQuestions.css](src/DailyQuestions.css), etc.)
- **Error handling**: User-friendly alerts in frontend, generic messages in backend (prevent info leakage)
- **Date handling**: Always use user's local timezone for `localDate`, but store ISO8601 `timestamp` in UTC

## Common Tasks

**Adding a new Lambda**:
1. Create `infra/newFunction.js` with `wrap()` pattern
2. Add to `functions:` in [serverless.yml](infra/serverless.yml) with `package.patterns`
3. Add IAM permissions if needed
4. Deploy: `cd infra && npx serverless deploy`

**Adding encrypted field**:
1. Update `encryptEntry()`/`decryptEntry()` in [src/lib/encryption.js](src/lib/encryption.js)
2. Ensure backend stores as String in DynamoDB (not parsed)
3. Test encryption/decryption cycle in browser console

**Debugging auth issues**:
- Check browser console for `AuthContext` errors
- Verify tokens in IndexedDB (`MoodTrackerAuth` → `tokens` store)
- Test Cognito directly: `aws cognito-idp initiate-auth ...`

**Profile picture uploads**:
- Frontend validates: image type only, max 5MB ([AccountSettings.jsx](src/AccountSettings.jsx#L193-L202))
- **Display restrictions to users**: Show "Max 5MB, image files only" near upload button
- Backend generates presigned S3 URL with 5-minute expiration
- User-scoped keys: `{userId}/{timestamp}.{extension}` prevents cross-user access
- Old pictures auto-deleted when uploading new ones

## Security Checklist

- ✅ Never log decrypted data or encryption keys
- ✅ Validate user input in Lambda (userId from authorizer, not request body)
- ✅ Use presigned URLs for S3 uploads (time-limited, scoped to user prefix)
- ✅ Include `CORS_HEADERS` in all Lambda responses
- ✅ Keep dependencies updated (`npm audit`, `npm update`)
