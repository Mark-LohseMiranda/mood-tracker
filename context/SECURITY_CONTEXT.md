# Security Context

## Core Security Model

This app uses a zero-knowledge-style pattern for sensitive entry data:
- Sensitive fields are encrypted in the browser before API submission.
- Backend stores encrypted payloads and does not decrypt them.
- Decryption happens only in the client after fetch.

## Encryption Details

Implementation: `src/lib/encryption.js`

- KDF: PBKDF2
- Input secret: Cognito user `sub`
- Salt: static app salt (deterministic per-user derivation)
- Iterations: 100,000
- Cipher: AES-GCM 256-bit
- IV: random 12-byte per encrypted field

Encrypted fields:
- `feeling`
- `consumed`
- `notes`

Unencrypted fields:
- `timestamp`
- `localDate`
- `sleepQuality`
- `sleepDuration`

## Authentication & Tokens

Implementation: `src/lib/auth.js`, `src/AuthContext.jsx`

- Custom Cognito SDK flow (`InitiateAuth`, challenge response, refresh flow)
- MFA supported
- Tokens stored in IndexedDB (`MoodTrackerAuth` / `tokens`), not only in memory
- JWT used for `Authorization: Bearer <token>` to API Gateway

## Backend Safety Rules

- Derive `userId` from Cognito authorizer claims, never from client body.
- Keep Lambda errors generic to avoid information leakage.
- Return CORS headers for both success and failure paths.

## Logging & Data Handling Guardrails

- Never log decrypted notes/feelings/consumption values.
- Never log raw tokens or key material.
- Avoid persisting plaintext sensitive fields to DynamoDB.
- Maintain compatibility with legacy `consumed` object records during reads.
