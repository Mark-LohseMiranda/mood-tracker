# Project Context

## Product

My Mood Tracker is a serverless PWA for daily wellness tracking:
- Mood check-ins (emoji-based)
- Sleep quality and duration
- Consumption tracking (prescriptions, caffeine, marijuana)
- Notes and historical calendar views

Primary site: https://myemtee.com

## Tech Stack

Frontend:
- React 19 + Vite 6
- React Router v7
- Custom Cognito SDK auth flow (`@aws-sdk/client-cognito-identity-provider`)
- PWA via `vite-plugin-pwa`

Backend:
- AWS Lambda (Node.js 22)
- API Gateway REST API
- DynamoDB table `MoodEntries`
- S3 for profile pictures
- Cognito User Pool authorizer
- Serverless Framework in `infra/`

## Project Layout

- `src/` — React app and browser-side logic
- `src/lib/auth.js` — Cognito sign-in/sign-up/MFA/token refresh + IndexedDB token storage
- `src/lib/encryption.js` — client-side encryption/decryption helpers
- `infra/` — Lambda handlers + `serverless.yml`
- `infra/lib/utils.js` — shared Lambda wrapper and CORS headers
- `dev-dist/` — generated dev-only PWA artifacts (ignored, not tracked)

## User-Critical Behaviors

- First entry of the day requires sleep fields (enforced by backend).
- Calendar and history behavior depends on `localDate` and decrypted feelings.
- Month cache in `localStorage.historyCache` is invalidated on new entry creation.
- Login and MFA success clear history cache for multi-device freshness.
