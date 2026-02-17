# Operations Context

## Local Development

Frontend:
- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Preview build: `npm run preview`

Backend (`infra/`):
- Install: `cd infra && npm install`
- Deploy: `cd infra && npx serverless deploy`

## Required Frontend Environment Variables

- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_COGNITO_REGION`
- `VITE_API_URL`

## Deployment Flow

Frontend deploy (typical):
1. `npm run build`
2. Sync `dist/` to S3 hosting bucket
3. Invalidate CloudFront cache

Backend deploy:
1. Update handlers/config in `infra/`
2. Run `npx serverless deploy`
3. Verify API routes and authorizer behavior

## Change Checklists

When changing entry fields:
- Update frontend encryption/decryption (`src/lib/encryption.js`)
- Verify backend handler persistence format
- Preserve backward compatibility for old records when possible

When changing auth behavior:
- Verify sign-in, MFA, token refresh, and sign-out
- Ensure token storage/clear flow remains consistent in IndexedDB
- Confirm cache clear on login/sign-out still happens

When changing calendar/history behavior:
- Ensure month cache invalidation still occurs after mutations
- Validate `localDate` logic for timezone-aware grouping

When changing sharing/stats behavior:
- User stats are calculated **on-demand** from full entry history when `/user/stats` is called
- Stats reflect current streak based on consecutive days from today
- Unauthenticated users see generic share message without stats

## Troubleshooting Notes

- If users see stale calendar data, inspect `localStorage.historyCache` handling.
- If auth appears broken, verify Cognito env vars and token refresh behavior.
- If CORS issues appear, check API Gateway responses plus Lambda CORS headers.
