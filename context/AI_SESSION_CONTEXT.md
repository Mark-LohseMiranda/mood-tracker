# AI Session Context

Use this as the first-read guide for coding sessions in this repository.

## Mandatory Constraints

- Preserve client-side encryption for sensitive mood-entry fields.
- Do not move sensitive data decryption to backend.
- Keep auth as direct Cognito SDK integration (no hosted UI/OAuth redirect rewrite unless explicitly requested).
- Keep timezone-aware `localDate` behavior intact.
- Preserve month-cache invalidation semantics after entry mutations.

## Where to Look First

- Entry submit flow: `src/DailyQuestions.jsx`
- Calendar/history/decryption: `src/HistoryCalendar.jsx`, `src/lib/encryption.js`
- Auth and token lifecycle: `src/lib/auth.js`, `src/AuthContext.jsx`
- Lambda patterns: `infra/*.js`, `infra/lib/utils.js`
- Infra config: `infra/serverless.yml`

## Safe Change Patterns

For new sensitive entry fields:
1. Add to `encryptEntry()` and `decryptEntry()`
2. Ensure backend stores encrypted string payloads
3. Preserve backward compatibility for existing unencrypted/legacy records

For new Lambda handlers:
1. Follow wrap pattern (`wrap(handler)`)
2. Include CORS headers in every response path
3. Register in `infra/serverless.yml` with minimal package patterns

## Known Operational Behaviors

- Login and successful MFA clear history cache.
- Service worker update checks run every 60 seconds.
- iOS update path unregisters existing SW before forced reload.

## Red Flags During Edits

- Any plaintext sensitive field being sent to backend
- Any backend logic trying to decrypt entry content
- Any change that breaks first-entry sleep requirement
- Any change that bypasses authorizer-derived `userId`
