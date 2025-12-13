# Custom Authentication Migration Guide

## Overview
The app has been migrated from using Cognito Hosted UI (via react-oidc-context) to a custom authentication UI using the AWS Cognito SDK directly. This provides:

1. **Better password manager compatibility** - Forms on your domain with proper autocomplete attributes
2. **Consistent branding** - No redirect to auth.myemtee.com
3. **Full control** - Custom styling and user experience

## What Changed

### Removed Dependencies
- `react-oidc-context` - No longer needed (OIDC redirect flow removed)

### New Dependencies
- `@aws-sdk/client-cognito-identity-provider` - Direct Cognito API access

### New Files Created
- `src/lib/auth.js` - Authentication utility library
- `src/AuthContext.jsx` - React context for auth state management
- `src/Login.jsx` - Custom login UI with MFA support
- `src/Login.css` - Authentication UI styling
- `src/SignUp.jsx` - Registration with email verification
- `src/ForgotPassword.jsx` - Password reset flow

### Modified Files
- `src/main.jsx` - Replaced AuthProvider with AuthContextProvider
- `src/App.jsx` - Implemented custom auth UI routing
- `src/Header.jsx` - Updated to use new auth context
- `src/DailyQuestions.jsx` - Updated to use new auth context
- `src/HistoryCalendar.jsx` - Updated to use new auth context
- `src/AccountSettings.jsx` - Updated to use new auth context

## Required Configuration

### 1. Environment Variables

Add this new variable to your `.env` file:

```bash
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
```

You can extract the User Pool ID from your existing `VITE_COGNITO_AUTHORITY` variable. For example:
- If `VITE_COGNITO_AUTHORITY=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXX`
- Then `VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXX`

**Old variables no longer needed** (but keep for backwards compatibility during transition):
- `VITE_COGNITO_DOMAIN` - Not used by custom auth
- `VITE_COGNITO_AUTHORITY` - Not used by custom auth
- `VITE_COGNITO_REDIRECT_URI` - Not used by custom auth
- `VITE_COGNITO_LOGOUT_URI` - Not used by custom auth

**Still required:**
- `VITE_COGNITO_CLIENT_ID` - App client ID
- `VITE_COGNITO_REGION` - AWS region (e.g., us-east-1)

### 2. Cognito User Pool Configuration

You must enable the `USER_PASSWORD_AUTH` flow in your Cognito User Pool App Client:

#### Option A: AWS Console
1. Go to AWS Cognito Console
2. Select your User Pool
3. Go to "App integration" → "App clients"
4. Select your app client
5. Click "Edit" under "Authentication flows"
6. Check the box for **"ALLOW_USER_PASSWORD_AUTH"**
7. Save changes

#### Option B: AWS CLI
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH
```

### 3. Update Lambda Authorizer (if using custom authorizer)

If you're using a custom Lambda authorizer, ensure it accepts ID tokens from both:
- Old: Tokens from hosted UI OAuth flow
- New: Tokens from `InitiateAuth` with `USER_PASSWORD_AUTH`

Both token types are valid JWT tokens from Cognito and should work with existing validation logic.

## Authentication Features

### Login Flow
1. User enters email and password
2. If MFA is enabled, user enters TOTP code
3. Tokens stored in localStorage
4. Auto-refresh before expiration

### Sign Up Flow
1. User enters name, email, and password
2. Password validation (8+ chars, uppercase, lowercase, number, special char)
3. Email verification code sent
4. User enters code to complete registration

### Forgot Password Flow
1. User enters email
2. Verification code sent to email
3. User enters code and new password
4. Password reset complete

### Session Management
- Access Token: 60 minutes (Cognito default)
- Refresh Token: 30 days (Cognito default)
- Tokens automatically refreshed before expiration
- `getCurrentUser()` handles auto-refresh transparently

## Password Manager Compatibility

### Autocomplete Attributes
All form fields use proper autocomplete attributes for password managers:

**Login.jsx:**
- Email: `autoComplete="username email"`
- Password: `autoComplete="current-password"`
- MFA Code: `autoComplete="one-time-code"`

**SignUp.jsx:**
- Name: `autoComplete="name"`
- Email: `autoComplete="email username"`
- Password: `autoComplete="new-password"`
- Verification Code: `autoComplete="one-time-code"`

**ForgotPassword.jsx:**
- Email: `autoComplete="email username"`
- New Password: `autoComplete="new-password"`
- Verification Code: `autoComplete="one-time-code"`

These attributes ensure 1Password, LastPass, Bitwarden, and other password managers can properly recognize and autofill credentials.

## Testing Checklist

Before deploying to production:

- [ ] Add `VITE_COGNITO_USER_POOL_ID` to `.env`
- [ ] Enable `USER_PASSWORD_AUTH` in Cognito app client
- [ ] Test login with username/password
- [ ] Test login with MFA enabled
- [ ] Test sign up and email verification
- [ ] Test forgot password flow
- [ ] Test password manager autofill (1Password, LastPass, etc.)
- [ ] Test token refresh (leave app open for 60+ minutes)
- [ ] Test sign out
- [ ] Verify API calls still work with new tokens
- [ ] Test on mobile browsers
- [ ] Test account settings (profile, MFA setup, delete account)

## Rollback Plan

If you need to rollback to the old OIDC flow:

1. Restore these files from git:
   - `src/main.jsx`
   - `src/App.jsx`
   - `src/Header.jsx`
   - `src/DailyQuestions.jsx`
   - `src/HistoryCalendar.jsx`
   - `src/AccountSettings.jsx`

2. Reinstall react-oidc-context:
   ```bash
   npm install react-oidc-context
   ```

3. Delete custom auth files:
   - `src/lib/auth.js`
   - `src/AuthContext.jsx`
   - `src/Login.jsx`
   - `src/Login.css`
   - `src/SignUp.jsx`
   - `src/ForgotPassword.jsx`

4. Rebuild and deploy

## Deployment

After configuration is complete:

```bash
# Build the frontend
npm run build

# Deploy to your hosting (e.g., S3 + CloudFront)
# Make sure to invalidate CloudFront cache if using it
```

## Additional Notes

### Token Storage
Tokens are stored in `localStorage` with these keys:
- `cognito_access_token`
- `cognito_id_token`
- `cognito_refresh_token`
- `cognito_user_info`

### Security Considerations
- Tokens are automatically refreshed before expiration
- Global sign out invalidates all tokens server-side
- MFA support preserved from hosted UI
- Same Cognito security policies apply

### User Experience Improvements
- No more redirect to different domain (auth.myemtee.com)
- Faster login (no OAuth redirect dance)
- Better mobile experience
- Consistent branding and styling
- Password managers work reliably

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify environment variables are set correctly
3. Confirm Cognito app client has USER_PASSWORD_AUTH enabled
4. Test with a fresh browser session (clear localStorage)
5. Check Cognito CloudWatch logs for authentication errors
