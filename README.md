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
- **Production**: [https://yourdomain.com](https://yourdomain.com)
- **WWW Alias**: [https://www.yourdomain.com](https://www.yourdomain.com)
- **Auth Domain**: [https://auth.yourdomain.com](https://auth.yourdomain.com)

---

## ✨ Features

### 📊 Mood Tracking
- **Daily Mood Entries**: Log how you're feeling with emoji-based mood selection
- **Sleep Tracking**: Record sleep duration and quality for the first entry of each day
- **Consumption Logging**: Track intake of caffeine, alcohol, cannabis, and nicotine
- **Notes**: Add detailed notes to any entry for context and reflection
- **Multiple Entries**: Create multiple mood entries throughout the day

### 📅 Calendar & History
- **Visual Calendar**: Month view with color-coded mood indicators (average daily mood)
- **Day Details**: Click any calendar day to see all entries with timestamps
- **Timezone Support**: Entries display in your local timezone
- **Trend Analysis**: Observe patterns over time with visual mood averages

### 👤 Account Management
- **Secure Authentication**: AWS Cognito with custom domain and OIDC
- **Profile Customization**: 
  - Display name
  - Profile pictures with S3 storage
  - Email management
- **Password Management**: Change password securely
- **Multi-Factor Authentication (MFA)**: Optional TOTP-based MFA setup
- **Account Deletion**: Complete data removal (S3, DynamoDB, Cognito)

### 🔒 Security & Privacy
- **End-to-End Encryption**: Sensitive data (notes, feelings, consumption) encrypted client-side before storage
- **Zero-Knowledge Privacy**: Encryption keys never leave your browser - even developers can't read your private data
- **OAuth 2.0 / OIDC**: Industry-standard authentication
- **Multi-Layer Encryption**: Client-side AES-256-GCM + AWS encryption at rest
- **HTTPS Only**: SSL/TLS for all communications
- **CORS Protection**: Strict origin policies
- **Token-based Authorization**: JWT access/ID tokens
- **Legal Compliance**: Privacy Policy, Terms of Service, GDPR-ready
- **Cookie Consent**: Usercentrics CMP integration

### 🎨 User Experience
- **Dark Mode**: Automatic detection with manual toggle support
- **Responsive Design**: Mobile-first, works on all devices
- **PWA Support**: Install as native app, offline-ready
- **Unsaved Changes Protection**: Navigation warnings prevent data loss
- **Loading States**: Clear feedback during async operations
- **Error Handling**: User-friendly error messages

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React SPA)                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Vite Dev   │  │ React Router │  │  OIDC Auth   │               │
│  │   Server     │  │   (v7.6.0)   │  │   Context    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                     │
│  Components: Header, Footer, DailyQuestions, HistoryCalendar,       │
│             AccountSettings, Policy Pages                           │
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
│ • feeling       │  │ • Presigned URLs │  │ • Update Attrs │
│ • sleep data    │  │                  │  │                │
│ • consumed      │  │                  │  │                │
│ • notes         │  │                  │  │                │
└─────────────────┘  └──────────────────┘  └────────────────┘
```

### Data Flow

1. **User Sign-In**:
   - User clicks "Sign In" → Redirected to Cognito Hosted UI
   - Cognito authenticates → Returns authorization code
   - Frontend exchanges code for tokens (access, ID, refresh)
   - Tokens stored in OIDC context

2. **Creating a Mood Entry**:
   - User fills out form → Frontend sends POST with access token
   - API Gateway validates token with Cognito authorizer
   - Lambda function processes entry → Stores in DynamoDB
   - Response returned to frontend → UI updates

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

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.1.0 | UI framework |
| **Vite** | 6.3.5 | Build tool & dev server |
| **React Router** | 7.6.0 | Client-side routing |
| **react-oidc-context** | 3.5.2 | OAuth/OIDC authentication |
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
│   ├── 📄 Header.jsx                # Navigation header with profile
│   ├── 📄 Footer.jsx                # Footer with policy links
│   ├── 📄 DailyQuestions.jsx        # Mood entry form
│   ├── 📄 HistoryCalendar.jsx       # Calendar view with modal
│   ├── 📄 AccountSettings.jsx       # Profile/password/MFA/delete
│   ├── 📄 PrivacyPolicy.jsx         # Privacy policy embed
│   ├── 📄 TermsOfService.jsx        # Terms of service embed
│   ├── 📄 Disclaimer.jsx            # Disclaimer embed
│   ├── 📄 CookiePolicy.jsx          # Cookie policy embed
│   ├── 📄 FeelingSelector.jsx       # Emoji mood selector
│   ├── 📂 lib/                      # Utility libraries
│   │   └── 📄 encryption.js         # Client-side AES-256-GCM encryption
│   ├── 📄 *.css                     # Component styles
│   └── 📂 assets/                   # Static assets
│
├── 📂 infra/                        # Backend infrastructure
│   ├── 📄 serverless.yml            # AWS resource definitions
│   ├── 📄 createEntry.js            # POST /entries
│   ├── 📄 getTodayEntry.js          # GET /entries/today
│   ├── 📄 getEntriesForMonth.js     # GET /entries/history
│   ├── 📄 getEntriesForDay.js       # GET /entries/day?date=YYYY-MM-DD
│   ├── 📄 getProfilePictureUploadUrl.js  # GET /profile/picture-upload-url
│   ├── 📄 deleteProfilePicture.js   # DELETE /profile/picture
│   ├── 📄 deleteAccount.js          # POST /account
│   ├── 📄 package.json              # Lambda dependencies
│   └── 📂 lib/
│       └── 📄 utils.js              # Shared utilities (CORS, error handler)
│
├── 📂 public/                       # Public assets
│   ├── 📄 favicon.ico
│   ├── 📄 apple-touch-icon.png
│   └── 📄 manifest.json             # PWA manifest
│
├── 📂 dev-dist/                     # Service worker files
│   ├── 📄 registerSW.js
│   ├── 📄 sw.js
│   └── 📄 workbox-*.js
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
   VITE_COGNITO_DOMAIN=https://auth.yourdomain.com
   VITE_COGNITO_AUTHORITY=https://cognito-idp.your-region.amazonaws.com/your-user-pool-id
   VITE_COGNITO_CLIENT_ID=your-client-id
   VITE_COGNITO_REDIRECT_URI=https://yourdomain.com
   VITE_COGNITO_LOGOUT_URI=https://yourdomain.com
   VITE_COGNITO_REGION=your-region
   VITE_API_URL=https://your-api-id.execute-api.your-region.amazonaws.com/dev
   ```

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
- 7 Lambda functions (individually packaged)
- API Gateway REST API
- DynamoDB table
- S3 bucket for profile pictures
- IAM roles and policies
- Gateway responses with CORS

### Frontend Deployment

```bash
# Build for production
npm run build

# Sync to S3
aws s3 sync dist/ s3://your-s3-bucket-name/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

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
  "sleep": {             // Only for first entry of the day
    "duration": 7.5,
    "quality": 4
  }
}
```

**Get Today's Entry**
```http
GET /entries/today
Authorization: Bearer <token>

Response: Entry object or 404
```

**Get Month History**
```http
GET /entries/history?month=2025-11
Authorization: Bearer <token>

Response: Array of daily averages
```

**Get Day Entries**
```http
GET /entries/day?date=2025-11-23
Authorization: Bearer <token>

Response: Array of all entries for that day
```

#### 👤 Profile Management

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

#### 🗑️ Account Deletion

**Delete Account**
```http
POST /account
Authorization: Bearer <token>

Response: { message: "Account data deleted successfully" }
```
*Note: This endpoint validates the token itself (no API Gateway authorizer) and only deletes S3/DynamoDB data. Frontend handles Cognito user deletion separately.*

---

## 🔐 Security

### Authentication & Authorization
- **OAuth 2.0 / OpenID Connect**: Industry-standard protocols
- **JWT Tokens**: Short-lived access tokens (60 minutes)
- **Token Validation**: API Gateway Cognito authorizer
- **Secure Token Storage**: OIDC context manages tokens securely

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
- ⚠️ **Not Encrypted**: Sleep quality, sleep duration, timestamps (needed for calendar functionality)

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
