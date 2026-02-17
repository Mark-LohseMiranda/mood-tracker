# 🌈 My Mood Tracker

> **A serverless Progressive Web App for tracking daily moods, sleep patterns, and overall wellness**

[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3.5-646CFF?logo=vite)](https://vitejs.dev/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?logo=amazon-aws)](https://aws.amazon.com/lambda/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)](https://nodejs.org/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Context Files](#-context-files)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Security](#-security)
- [License](#-license)

---

## 🎯 Overview

**My Mood Tracker** is a modern, serverless Progressive Web App that helps users track their daily moods, sleep patterns, consumption habits, and overall wellness over time. Built with privacy and security in mind, the app leverages AWS cloud services for a scalable, cost-effective, and highly available solution.

### 🌟 Live Demo
- **Production**: [https://myemtee.com](https://myemtee.com)

---

## 🧠 Context Files

For contributor and AI-session handoff context, see the docs in [`context/`](context/):

- [`context/README.md`](context/README.md)
- [`context/PROJECT_CONTEXT.md`](context/PROJECT_CONTEXT.md)
- [`context/ARCHITECTURE_CONTEXT.md`](context/ARCHITECTURE_CONTEXT.md)
- [`context/OPERATIONS_CONTEXT.md`](context/OPERATIONS_CONTEXT.md)
- [`context/SECURITY_CONTEXT.md`](context/SECURITY_CONTEXT.md)
- [`context/AI_SESSION_CONTEXT.md`](context/AI_SESSION_CONTEXT.md)

---

## ✨ Features

### 📊 Mood Tracking
- **Daily Mood Entries**: Log how you're feeling with emoji-based mood selection
- **Sleep Tracking**: Record sleep duration and quality once per calendar day
  - Smart sleep prompt: Yes/no modal with time-aware greeting (Good morning/afternoon/evening)
  - Only prompted once per local calendar day - perfect for irregular sleep schedules
  - Can add sleep data anytime during the day (not just first entry)
  - Works across timezone changes - local calendar day determines when you can log sleep
- **Consumption Logging**: Track intake of caffeine, alcohol, cannabis, and nicotine
- **Notes**: Add detailed notes to any entry for context and reflection
- **Multiple Entries**: Create multiple mood entries throughout the day

### 📅 Calendar & History
- **Visual Calendar**: Month view with color-coded mood indicators (average daily mood)
- **Day Details**: Click any calendar day to see all entries with timestamps
- **Timezone-Aware Grouping**: Entries are grouped by your local date, not UTC - no more late-night entries appearing on the wrong day
- **Client-Side Decryption**: Calendar averages calculated in your browser after decrypting your entries
- **Trend Analysis**: Observe patterns over time with visual mood averages
- **Cache Management**: Automatic cache invalidation for fresh data
  - Cache cleared on login for fresh data
  - 5-minute cache expiration for updates
  - Manual refresh available anytime

### 👤 Account Management
- **Custom Authentication UI**: Direct Cognito integration with password manager support
  - Email/password login with MFA support
  - User registration with email verification
  - Forgot password flow
  - Proper autocomplete attributes for 1Password, LastPass, Bitwarden
- **Landing Page**: Marketing page with app overview before authentication
- **Profile Customization**: 
  - Display name
  - Profile pictures with S3 storage
  - Email management
- **Password Management**: Change password securely
- **Multi-Factor Authentication (MFA)**: Optional TOTP-based MFA setup
- **Account Deletion**: Complete data removal (S3, DynamoDB, Cognito)
- **Signup Notifications**: Automatic email alerts to admin when new users register (via SES)

### � Sharing & Social
- **Web Share API**: Native iOS/Android share sheet integration for easy sharing
- **Personalized Share Messages**: 
  - **Unauthenticated users**: Generic message about the app
  - **Authenticated users**: Personalized message with tracking stats (streak, days tracked, entry count)
- **Server-Side Stats**: All stats calculated from full entry history, not limited to current month
  - Stats calculated on-demand from all user entries for accuracy
  - Shared across app components via centralized StatsContext
- **Automatic Stat Refresh**: Stats automatically invalidated and refreshed after new entries
  - On-demand calculation ensures current data
  - Refreshes when app regains focus (tab switch, app foregrounded)
  - Minimal API calls with smart caching
- **Floating Share Button**: Easy-access share button positioned for mobile PWA use

### �🔒 Security & Privacy
- **End-to-End Encryption**: Sensitive data (notes, feelings, consumption) encrypted client-side before storage
- **Zero-Knowledge Privacy**: Encryption keys never leave your browser - even developers can't read your private data
- **AWS Cognito Authentication**: Secure user authentication with MFA support
- **Multi-Layer Encryption**: Client-side AES-256-GCM + AWS encryption at rest
- **HTTPS Only**: SSL/TLS for all communications
- **CORS Protection**: Strict origin policies
- **Token-based Authorization**: ID token for REST API Gateway (Cognito user pool authorizer); access token only for direct Cognito service calls
  - Access/ID tokens automatically refreshed via REFRESH_TOKEN_AUTH when expired
  - 30-day refresh token for extended sessions
  - Smart error handling - only logs out on actual token expiration, not network errors
- **Legal Compliance**: Privacy Policy, Terms of Service, GDPR-ready
- **Cookie Consent**: Usercentrics CMP integration

### 🎨 User Experience
- **Dark Mode**: Automatic detection with manual toggle support
- **Responsive Design**: Mobile-first, works on all devices with proper viewport handling
- **PWA Support**: Install as native app, offline-ready with automatic updates
  - iOS-compatible update mechanism (unregister/re-register service worker)
  - Checks for updates every 60 seconds when app is active
  - Auto-reloads when new version detected
- **Password Manager Compatible**: Works with 1Password, LastPass, Bitwarden on all platforms
  - Desktop: Full autofill for username, password, and MFA codes
  - Mobile: Autofill for username/password, manual MFA entry (iOS limitation)
  - Auto-submit detection for seamless login experience
- **Unsaved Changes Protection**: Navigation warnings prevent data loss
- **Loading States**: Clear feedback during async operations
- **Error Handling**: User-friendly error messages
- **In-App Instructions**: Comprehensive help page with screenshots, a sticky sidebar table of contents with scrollspy highlighting, and a mobile-friendly right-side flyout
- **Animated Navigation**: Smooth hamburger-to-X menu animation
- **Session Persistence**: 30-day refresh token for extended login sessions
- **Version Display**: App version shown in footer for deployment verification across devices

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React SPA)                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Vite Dev   │  │ React Router │  │  Custom Auth │               │
│  │   Server     │  │   (v7.6.0)   │  │   Context    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                     │
│  Components: LandingPage, Login, SignUp, ForgotPassword, Header,    │
│             Footer, DailyQuestions, HistoryCalendar,                │
│             AccountSettings, Instructions, Policy Pages             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AWS CloudFront (CDN)                             │
│                  your-distribution-id.cloudfront.net                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   S3 Static Hosting       │   │   AWS Cognito             │
│   (moodtracker-pwa-       │   │   User Pool               │
│    hosting)               │   │   (auth.myemtee.com)      │
│                           │   │                           │
│  • index.html             │   │  • User Authentication    │
│  • JS/CSS Assets          │   │  • OAuth 2.0 / OIDC       │
│  • Service Worker         │   │  • MFA Support            │
└───────────────────────────┘   │  • Custom Domain          │
                                └───────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (REST API)                           │
│              your-api-id.execute-api.your-region                    │
│                                                                     │
│  Cognito Authorizer ──► Validates JWT Tokens                        │
│  CORS Configuration ──► Allows myemtee.com origins                  │
│  Gateway Responses  ──► CORS headers on errors                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Lambda Functions │ │  Lambda Funcs   │ │  Lambda Funcs   │
│  (Mood Tracking)  │ │  (Profile Mgmt) │ │  (Account Mgmt) │
│                   │ │                 │ │                 │
│ • createEntry     │ │ • getProfile    │ │ • deleteAccount │
│ • getTodayEntry   │ │   PictureUpload │ │   (no auth)     │
│ • getEntriesFor   │ │   Url           │ │                 │
│   Month           │ │ • deleteProfile │ │                 │
│ • getEntriesFor   │ │   Picture       │ │                 │
│   Day             │ │                 │ │                 │
└───────────────────┘ └─────────────────┘ └─────────────────┘
         │                      │                    │
         ▼                      ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐
│   DynamoDB      │  │   S3 Bucket      │  │   Cognito      │
│   (MoodEntries) │  │   (Profile Pics) │  │   (User Mgmt)  │
│                 │  │                  │  │                │
│ • userId (PK)   │  │ • Public Read    │  │ • GetUser      │
│ • timestamp(SK) │  │ • User Prefix    │  │ • DeleteUser   │
│ • localDate     │  │ • Presigned URLs │  │ • Update Attrs │
│ • feeling (enc) │  │                  │  │                │
│ • sleep data    │  │                  │  │                │
│ • consumed(enc) │  │                  │  │                │
│ • notes (enc)   │  │                  │  │                │
└─────────────────┘  └──────────────────┘  └────────────────┘
```

### Data Flow

1. **User Sign-In**:
   - User enters credentials on custom login page
   - Frontend calls Cognito SDK directly
   - If MFA enabled, user enters TOTP code
   - Cognito returns tokens (access, ID, refresh)
   - Tokens stored in IndexedDB with automatic refresh

2. **Creating a Mood Entry**:
   - User loads DailyQuestions page
   - Frontend checks all entries for today's local date via `GET /entries/day?date=YYYY-MM-DD`
   - If no sleep data exists for the day, modal prompts: "{Greeting}! Did you get some sleep last night?" (Yes/No)
     - **Yes**: Shows sleep quality/duration form alongside mood/consumption form
     - **No**: Hides sleep form, user logs mood without sleep data
   - If sleep data already exists for today: No modal, sleep form hidden
      - User fills out form (mood, optionally sleep, consumption, notes) → Frontend sends POST with ID token (REST API user pool authorizer)
   - API Gateway validates token with Cognito authorizer
   - Lambda validates localDate is provided and checks for existing sleep data on the same local date
   - If user tries to add sleep when sleep already exists: Returns 400 error
   - Lambda stores entry in DynamoDB with UTC timestamp and localDate (for timezone-aware queries)
   - Response includes `needsSleepTracking` flag for frontend status
   - Response returned to frontend → UI updates → Cache invalidated for calendar

3. **Profile Picture Upload**:
   - User selects image → Frontend requests presigned URL
   - Lambda generates S3 presigned URL → Returns to frontend
   - Frontend uploads directly to S3 → Updates Cognito user attribute
   - Header refreshes to show new picture

4. **Account Deletion**:
   - User types "DELETE" and confirms
   - Frontend calls Lambda (custom token validation)
   - Lambda deletes S3 objects and DynamoDB entries
   - Frontend calls Cognito DeleteUser API directly
   - Clears localStorage/sessionStorage → Redirects to home

5. **New User Signup Notification**:
   - User completes registration and confirms email
   - Cognito triggers postConfirmation Lambda
   - Lambda sends formatted email to info@myemtee.com via SES
   - Email includes user details (email, name, user ID, timestamp)
   - Signup flow continues normally even if notification fails

6. **Cache Management**:
   - Entry created → Cache invalidated locally
   - Entry saved to DynamoDB (source of truth)
   - On login → Cache cleared → Fresh data fetched
   - After 5 minutes idle → Cache expired → Next calendar view fetches fresh data
   - Ensures consistent data

7. **Automatic Token Refresh**:
   - Access/ID tokens expire (typically 1 hour)
   - Any API call detects expired token
   - Automatically uses refresh token to get new access/ID tokens
   - User stays logged in for up to 30 days (refresh token expiration)
   - Only logs out if refresh token is actually expired, not on temporary network errors

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.1.0 | UI framework |
| **Vite** | 6.3.5 | Build tool & dev server |
| **React Router** | 7.6.0 | Client-side routing |
| **@aws-sdk/client-cognito-identity-provider** | Latest | Direct Cognito authentication |
| **Workbox** | PWA service worker |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **AWS Lambda** | Node.js 22.x | Serverless compute |
| **API Gateway** | REST API | HTTP API endpoint |
| **DynamoDB** | NoSQL | Mood entries storage |
| **S3** | Object storage | Profile pictures & hosting |
| **CloudFront** | CDN | Content delivery |
| **Cognito** | User authentication | Identity provider |
| **SES** | Email service | Signup notifications |
| **Serverless Framework** | 4.x | Infrastructure as Code |

### Third-Party Services
- **Termageddon**: Legal policy generation
- **Usercentrics**: Cookie consent management

---

## 📁 Project Structure

```
mood-tracker/
├── 📂 src/                          # Frontend source code
│   ├── 📄 main.jsx                  # App entry point, OIDC setup
│   ├── 📄 App.jsx                   # Main app component, routing
│   ├── 📄 App.css                   # Global styles, hamburger menu animation
│   ├── 📄 Header.jsx                # Navigation header with animated menu
│   ├── 📄 Footer.jsx                # Footer with policy links
│   ├── 📄 LandingPage.jsx           # Marketing page with sign in/sign up
│   ├── 📄 LandingPage.css           # Landing page styles
│   ├── 📄 Login.jsx                 # Custom login UI with MFA
│   ├── 📄 Login.css                 # Authentication UI styles
│   ├── 📄 SignUp.jsx                # User registration with verification
│   ├── 📄 ForgotPassword.jsx        # Password reset flow
│   ├── 📄 AuthContext.jsx           # Auth state management context
│   ├── 📄 DailyQuestions.jsx        # Mood entry form
│   ├── 📄 DailyQuestions.css        # Sleep section responsive styles
│   ├── 📄 HistoryCalendar.jsx       # Calendar view with modal
│   ├── 📄 HistoryCalendar.css       # Calendar styles
│   ├── 📄 AccountSettings.jsx       # Profile/password/MFA/delete
│   ├── 📄 AccountSettings.css       # Settings page styles
│   ├── 📄 Instructions.jsx          # In-app help page with screenshots
│   ├── 📄 Instructions.css          # Instructions page styles
│   ├── 📄 PrivacyPolicy.jsx         # Privacy policy embed
│   ├── 📄 TermsOfService.jsx        # Terms of service embed
│   ├── 📄 Disclaimer.jsx            # Disclaimer embed
│   ├── 📄 CookiePolicy.jsx          # Cookie policy embed
│   ├── 📄 FeelingSelector.jsx       # Emoji mood selector
│   ├── 📄 ShareButton.jsx           # Floating Web Share API button
│   ├── 📄 AuthContext.jsx           # Auth state management context
│   ├── 📄 StatsContext.jsx          # Centralized user stats context (focus-based refresh)
│   ├── 📄 index.css                 # Base styles, responsive layout fixes
│   ├── 📂 lib/                      # Utility libraries
│   │   ├── 📄 auth.js               # Custom Cognito authentication
│   │   ├── 📄 encryption.js         # Client-side AES-256-GCM encryption
│   │   ├── 📄 sharing.js            # Web Share API utilities and stats functions
│   │   └── 📄 indexedDB.js          # [DEPRECATED] Replaced by server-side stats
│   └── 📂 assets/                   # Static assets
│
├── 📂 infra/                        # Backend infrastructure
│   ├── 📄 serverless.yml            # AWS resource definitions
│   ├── 📄 createEntry.js            # POST /entries (saves localDate)
│   ├── 📄 getTodayEntry.js          # GET /entries/today
│   ├── 📄 getEntriesForMonth.js     # GET /entries/history (returns encrypted feelings)
│   ├── 📄 getEntriesForDay.js       # GET /entries/day?date=YYYY-MM-DD (filters by localDate)
│   ├── 📄 getUserStats.js           # GET /user/stats (calculates stats on-demand from full history)
│   ├── 📄 calculateStats.js         # Utility: calculates streak, daysTracked, entryCount
│   ├── 📄 getProfilePictureUploadUrl.js  # GET /profile/picture-upload-url
│   ├── 📄 deleteProfilePicture.js   # DELETE /profile/picture
│   ├── 📄 deleteAccount.js          # POST /account
│   ├── 📄 postConfirmation.js       # Cognito trigger (sends signup emails)
│   ├── 📄 package.json              # Lambda dependencies
│   └── 📂 lib/
│       └── 📄 utils.js              # Shared utilities (CORS, error handler)
│
├── 📂 public/                       # Public assets
│   ├── 📄 favicon.ico
│   ├── 📄 apple-touch-icon.png
│   ├── 📄 manifest.json             # PWA manifest
│   └── 📂 screenshots/              # Instruction page screenshots
│       ├── 📄 mood-selector.webp
│       ├── 📄 sleep-tracking.webp
│       ├── 📄 consumption-logging.webp
│       ├── 📄 notes-section.webp
│       ├── 📄 calendar-view.webp
│       ├── 📄 calendar-day-detail.webp
│       └── 📄 account-settings.webp
│
├── 📄 index.html                    # HTML entry point
├── 📄 vite.config.js                # Vite configuration
├── 📄 package.json                  # Frontend dependencies
├── 📄 eslint.config.js              # ESLint configuration
├── 📄 .env                          # Environment variables (gitignored)
└── 📄 README.md                     # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v22.16.0 or higher
- **npm**: v10.x or higher
- **AWS CLI**: v2.x configured with credentials
- **Serverless Framework**: v4.x
- **AWS Account**: With appropriate permissions

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mood-tracker
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd infra
   npm install
   cd ..
   ```

4. **Configure environment variables**
   
   Create `.env` in the root directory:
   ```env
   VITE_COGNITO_USER_POOL_ID=your-user-pool-id
   VITE_COGNITO_CLIENT_ID=your-client-id
   VITE_COGNITO_REGION=your-region
   VITE_API_URL=https://your-api-id.execute-api.your-region.amazonaws.com/dev
   ```
   
   **Note**: Custom authentication no longer requires COGNITO_DOMAIN, AUTHORITY, REDIRECT_URI, or LOGOUT_URI

5. **Run locally**
   ```bash
   npm run dev
   ```
   
   Visit `http://localhost:5173`

---

## 📦 Deployment

### Backend Deployment

```bash
cd infra
npx serverless deploy
```

This deploys:
- 12 Lambda functions (individually packaged)
  - 11 API endpoints (mood tracking, profile, device management, account)
  - 1 Cognito trigger (postConfirmation)
- API Gateway REST API
- DynamoDB table with GSI: `userIdLocalDateIndex` (userId PK, localDate SK) for timezone-aware queries
- S3 bucket for profile pictures
- IAM roles and policies
- Gateway responses with CORS

### Frontend Deployment

```bash
# 1. Update version number in src/Footer.jsx
# Change APP_VERSION constant (e.g., "1.00" → "1.01")

# 2. Build for production
npm run build

# 3. Sync to S3
aws s3 sync dist/ s3://your-s3-bucket-name/ --delete

# 4. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

**Version Management:**
- Update `APP_VERSION` in [src/Footer.jsx](src/Footer.jsx) before each deployment
- Version is displayed in footer for easy verification across devices
- Use two decimal places: `1.00`, `1.01`, `1.10`, `2.00`, etc.

---

## 📚 API Documentation

### Base URL
```
https://your-api-id.execute-api.your-region.amazonaws.com/dev
```

### Authentication
All endpoints (except `POST /account`) require a valid JWT access token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

The token is validated by the **API Gateway Cognito authorizer**, which extracts the user's identity from the JWT claims. This ensures:
- Only authenticated users can access their data
- Device operations are scoped to the authenticated user (no cross-user access)
- All requests are securely authenticated before reaching Lambda functions

### Endpoints

#### 📝 Mood Entries

**Create Entry**
```http
POST /entries
Authorization: Bearer <token>

{
  "feeling": 4,          // 1-5 scale
  "consumed": {
    "caffeine": 2,       // servings
    "alcohol": 0,
    "cannabis": 0,
    "nicotine": 0
  },
  "notes": "Great day!",
  "sleep": {             // Optional - can be added anytime during the day
    "duration": 7.5,
    "quality": 4
  }
}

Response: 201 Created
{
  "message": "Entry created successfully.",
  "needsSleepTracking": false  // Frontend uses this to determine if user should be prompted for sleep
}
```

**Get Today's Entries**
```http
GET /entries/day?date=2025-12-27
Authorization: Bearer <token>

Response: Array of all entries for that day (grouped by localDate)
```

**Get Entry for Today (Legacy)**
```http
GET /entries/today?localDate=2025-12-27
Authorization: Bearer <token>

Response: First entry object for that date or 404
Note: Returns only the first entry matching the localDate
```

**Get Month History**
```http
GET /entries/history?year=2025&month=11
Authorization: Bearer <token>

Response: [
  {
    "date": "2025-11-23",
    "feelings": ["encryptedValue1", "encryptedValue2", ...]
  }
]
Note: Frontend decrypts feelings and calculates averages client-side
```

**Get Day Entries**
```http
GET /entries/day?date=2025-11-23
Authorization: Bearer <token>

Response: Array of all entries for that day
```

#### � User Stats

**Get User Stats**
```http
GET /user/stats
Authorization: Bearer <token>

Response: {
  "entryCount": 42,           // Total number of entries
  "daysTracked": 35,          // Number of unique days with entries
  "streak": 7                 // Current consecutive days streak
}
Note: Stats are calculated on-demand from all user entries, ensuring fresh tracking data
```

#### �👤 Profile Management

**Get Profile Picture Upload URL**
```http
GET /profile/picture-upload-url?oldPictureUrl=<url>
Authorization: Bearer <token>

Response: { uploadUrl: "presigned-s3-url" }
```

**Delete Profile Picture**
```http
DELETE /profile/picture?url=<encoded-picture-url>
Authorization: Bearer <token>

Response: 200 OK
```

#### �🗑️ Account Deletion

**Delete Account**
```http
POST /account
Authorization: Bearer <token>

Response: { message: "Account data deleted successfully" }
```
*Note: This endpoint validates the token itself (no API Gateway authorizer) and only deletes S3/DynamoDB data. Frontend handles Cognito user deletion separately.*

---

## � Sleep Tracking Implementation

### Overview
Sleep tracking is optimized for users with irregular sleep schedules (shift workers, night owls, etc.) by allowing flexible sleep logging once per local calendar day, rather than forcing it on the first entry.

### Architecture

**Backend Storage** (`createEntry.js`):
- Checks all entries for the user's local calendar day using GSI: `userIdLocalDateIndex` (userId + localDate)
- If sleep data exists for that localDate, rejects attempts to add more sleep (`400 Bad Request`)
- If no sleep data exists, allows optional sleep fields (sleepQuality, sleepDuration) with any entry
- Response includes `needsSleepTracking` flag indicating if user should be prompted

**Frontend Logic** (`DailyQuestions.jsx`):
1. On page load: Fetches all entries for today's local date via `GET /entries/day?date=YYYY-MM-DD`
2. Checks if any entry has sleep data (sleepQuality && sleepDuration)
3. **If sleep data exists**: No modal, no sleep form - user sees only mood/consumption/notes sections
4. **If no sleep data**: Shows modal with time-aware greeting:
   - 5 AM - 12 PM: "Good morning! Did you get some sleep last night?"
   - 12 PM - 5 PM: "Good afternoon! Did you get some sleep last night?"
   - 5 PM+: "Good evening! Did you get some sleep last night?"
   - User clicks "Yes" → Shows sleep form with quality (1-5 stars) and duration (4-10+ hours)
   - User clicks "No" → Skips sleep form, proceeds to mood entry
5. Sleep form remains hidden if user previously clicked "No" during the same session

**Database** (serverless.yml):
- GSI: `userIdLocalDateIndex` enables efficient per-day sleep tracking
- Primary key: userId (PK) + timestamp (SK) - stored in UTC for timezone portability
- localDate (YYYY-MM-DD) - user's local calendar date, used for all "day boundary" logic

### Use Cases
✅ Shift workers: Sleep at 8 AM, log mood at 6 PM - same day in their timezone  
✅ Night owls: Sleep at 5 AM, log mood at 10 AM - no re-prompting for sleep  
✅ Time zone travelers: localDate anchors entries to user's perceived day, UTC timestamp ensures global consistency  
✅ Multiple entries: Log mood 3x per day - only prompted for sleep once

---

## �🔐 Security

### Authentication & Authorization
- **Custom Cognito Integration**: Direct AWS SDK calls with USER_PASSWORD_AUTH flow
- **Password Manager Support**: Proper autocomplete attributes for 1Password, LastPass, Bitwarden
- **JWT Tokens**: Short-lived access tokens (60 minutes), long-lived refresh tokens (30 days)
- **Automatic Token Refresh**: Tokens refreshed before expiration for seamless 30-day sessions
  - Token expiration checked on every API call
  - Refresh fails gracefully with clear error messages
- **Token Revocation Detection**: Active session validation catches revoked/invalidated tokens
  - App validates token status with Cognito on auth check
  - Revoked tokens automatically force re-login
  - No stale "logged in" state with invalid tokens
- **Token Validation**: API Gateway Cognito authorizer validates JWTs
- **Persistent Storage**: IndexedDB for auth tokens (survives PWA restarts on iOS/Android/macOS)
  - Access, ID, and refresh tokens stored in IndexedDB for PWA persistence
  - Automatic cleanup on sign out
  - Fallback to localStorage for temporary data (temp_username during MFA)
- **MFA Support**: TOTP-based multi-factor authentication

### Custom Authentication Features
- **Landing Page**: Marketing page before authentication with app overview
- **Custom Login**: Email/password with MFA challenge support on your domain
- **User Registration**: Sign up with email verification flow
- **Password Reset**: Forgot password with email verification code
- **Same-Domain Forms**: No redirect to separate auth domain for better UX and security
- **Client-Side Flow**: Direct Cognito API calls via @aws-sdk/client-cognito-identity-provider

### Data Protection
- **Client-Side Encryption**: Sensitive fields (notes, feelings, consumption) encrypted in browser using AES-256-GCM before transmission
- **Zero-Knowledge Architecture**: Encryption keys derived from user's Cognito sub - developers cannot decrypt user data
- **Web Crypto API**: Browser-native cryptography (PBKDF2 key derivation with 100k iterations)
- **Encryption at Rest**: DynamoDB and S3 automatic AWS encryption
- **Encryption in Transit**: TLS 1.2+ for all communications
- **CORS Policies**: Strict origin whitelisting
- **Presigned URLs**: Time-limited, secure S3 uploads
- **User Isolation**: Data scoped by userId (Cognito sub)

### Best Practices
- **Least Privilege**: Lambda functions have minimal IAM permissions
- **Input Validation**: All user inputs validated and sanitized
- **Error Handling**: Generic error messages to prevent info leakage
- **Security Headers**: CloudFront adds security headers
- **Regular Updates**: Dependencies kept up-to-date

### Compliance
- **GDPR Ready**: Complete data deletion capability
- **Privacy Policy**: Comprehensive privacy documentation
- **Cookie Consent**: Usercentrics CMP integration
- **Terms of Service**: Clear user agreements

### 🔐 Client-Side Encryption Implementation

**Zero-Knowledge Privacy**: Your sensitive data is encrypted in your browser before it ever reaches our servers. Even with full database access, developers cannot read your private notes, feelings, or consumption data.

#### How It Works

1. **Key Derivation**: When you log in, a unique encryption key is derived from your Cognito user ID (sub) using PBKDF2 with 100,000 iterations
2. **Encryption**: Before saving an entry, sensitive fields are encrypted using AES-256-GCM (a military-grade encryption standard)
3. **Transmission**: Encrypted data is sent to AWS - only encrypted ciphertext is stored in DynamoDB
4. **Decryption**: When viewing your entries, your browser automatically decrypts the data using your derived key
5. **Key Security**: Your encryption key is derived locally and never transmitted or stored anywhere

#### What Gets Encrypted

- ✅ **Notes**: Your personal reflections and thoughts
- ✅ **Feelings**: Your mood emoji selections
- ✅ **Consumption Data**: What you've consumed (caffeine, prescriptions, etc.)
- ⚠️ **Not Encrypted**: Sleep quality, sleep duration, timestamps, localDate (needed for calendar functionality and timezone-aware grouping)

#### Technical Details

```javascript
// Key derivation (deterministic per user)
Encryption Key = PBKDF2(userSub, salt, 100k iterations, SHA-256)

// Encryption process
Ciphertext = AES-256-GCM(Plaintext, Key, Random IV)
Stored Value = Base64(IV + Ciphertext)

// Decryption process
(IV, Ciphertext) = Base64Decode(Stored Value)
Plaintext = AES-256-GCM-Decrypt(Ciphertext, Key, IV)
```

#### Security Guarantees

- **Zero Server Knowledge**: Backend only sees encrypted gibberish
- **No Key Storage**: Keys derived on-demand from your user ID
- **Unique Per Entry**: Each entry uses a fresh random IV (initialization vector)
- **Industry Standard**: Web Crypto API with NIST-approved algorithms
- **Browser Native**: No third-party crypto libraries, uses built-in browser APIs

---

## 🧪 Testing

```bash
# Run tests (when available)
npm test

# Lint code
npm run lint

# Type check (if using TypeScript)
npm run type-check
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is available for viewing and educational purposes. Commercial use or redistribution requires prior consent from the author.

---

## 👨‍💻 Author

**mmblue69**

---

## 🙏 Acknowledgments

- AWS for serverless infrastructure
- React team for the amazing framework
- Vite for blazing-fast build tooling
- Termageddon for legal policy generation
- Usercentrics for cookie consent management

---

## 📞 Support

For issues or questions:
- Open an issue in the repository
- Contact: [mark@guardiancodewebservices.com]

---

*Built with ❤️ using modern serverless technologies*
