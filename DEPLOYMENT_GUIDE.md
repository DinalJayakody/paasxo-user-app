# Paasxo – End-to-End Deployment Guide

## Overview

| Platform | Tool | Cost |
|----------|------|------|
| iOS App Store | Expo EAS Build + Apple Developer | $99/yr |
| Google Play Store | Expo EAS Build | $25 one-time |
| Web (PWA) | Expo web export + Vercel/Netlify | Free tier available |
| Backend (Spring Boot) | Railway / Render / AWS | $5–20/mo |

---

## STEP 0 — Prerequisites

Install these once on your machine:

```bash
# Node.js 18+ (https://nodejs.org)
node --version   # must be ≥ 18

# Expo CLI + EAS CLI
npm install -g expo-cli eas-cli

# Log in to your Expo account (create at expo.dev)
eas login
```

---

## STEP 1 — Configure app.json for Production

Open `app.json` and update these fields before any build:

```json
{
  "expo": {
    "name": "Paasxo",
    "slug": "paasxo",
    "version": "1.0.0",
    "scheme": "paasxo",
    "icon": "./assets/logo.jpeg",
    "splash": { "image": "./assets/logo.jpeg", "backgroundColor": "#2977C2" },
    "ios": {
      "bundleIdentifier": "com.paasxo.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "To upload match photos",
        "NSPhotoLibraryUsageDescription": "To pick profile and post images",
        "NSLocationWhenInUseUsageDescription": "To find venues and players near you"
      }
    },
    "android": {
      "package": "com.paasxo.app",
      "versionCode": 1,
      "permissions": ["ACCESS_FINE_LOCATION", "CAMERA", "READ_EXTERNAL_STORAGE"]
    },
    "web": { "bundler": "metro", "output": "static", "favicon": "./assets/logo.jpeg" }
  }
}
```

---

## STEP 2 — Set Your Backend URL

Edit `src/api/endpoints.ts`:

```ts
BASE_URL: 'https://api.paasxo.com/api',  // your production backend URL
```

For different environments, use `app.config.js` (rename app.json → app.config.js):

```js
export default ({ config }) => ({
  ...config,
  extra: {
    apiUrl: process.env.API_URL ?? 'http://localhost:8080/api',
  },
});
```

Then in endpoints.ts:
```ts
import Constants from 'expo-constants';
const BASE_URL = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:8080/api';
```

---

## STEP 3 — Configure Firebase (Social Auth)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project "Paasxo"
3. Add iOS app → download `GoogleService-Info.plist` → place in `ios/`
4. Add Android app → download `google-services.json` → place in `android/app/`
5. Enable **Authentication → Sign-in methods → Google** and **Apple**

In `app.json` add:
```json
"plugins": [
  "@react-native-google-signin/google-signin",
  ["@invertase/react-native-apple-authentication"]
]
```

---

## STEP 4 — Initialize EAS

```bash
cd /path/to/Paasxo-main
eas init --id YOUR_EXPO_PROJECT_ID
```

This creates `eas.json`. Replace its contents with:

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "production": {
      "ios": { "resourceClass": "m-medium" },
      "android": { "buildType": "apk" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your@apple.id", "ascAppId": "YOUR_APP_STORE_CONNECT_ID" },
      "android": { "serviceAccountKeyPath": "./google-play-key.json", "track": "internal" }
    }
  }
}
```

---

## STEP 5 — Build for iOS

### 5a. Register with Apple Developer Program
- Enroll at [developer.apple.com](https://developer.apple.com) ($99/yr)
- Create an **App ID** with bundle ID `com.paasxo.app`

### 5b. Build the IPA

```bash
# First build — EAS will walk you through certificates
eas build --platform ios --profile production
```

EAS automatically handles:
- Provisioning profiles
- Code signing certificates
- p12 keys

This takes ~10–20 minutes in the cloud.

### 5c. Submit to App Store

```bash
eas submit --platform ios --profile production
```

Or manually: download the `.ipa` from [expo.dev](https://expo.dev) → upload via **Transporter** (free Mac app).

**App Store Connect checklist before review:**
- [ ] App name, subtitle, description
- [ ] Screenshots for 6.7" iPhone (required), 12.9" iPad (optional)
- [ ] Privacy policy URL
- [ ] Age rating (4+)
- [ ] Keywords

Apple review takes 1–3 days.

---

## STEP 6 — Build for Android

### 6a. Create Google Play Developer Account
- One-time $25 fee at [play.google.com/console](https://play.google.com/console)
- Create new application "Paasxo" with package `com.paasxo.app`

### 6b. Build the APK / AAB

```bash
# APK (for side-loading / testing)
eas build --platform android --profile production

# AAB (required for Play Store)
# In eas.json change "buildType": "app-bundle" for production Android
eas build --platform android --profile production
```

### 6c. Submit to Play Store

```bash
# Generate a Google Play service account JSON key:
# Play Console → Setup → API access → Create service account
# Download the JSON, save as google-play-key.json

eas submit --platform android --profile production
```

Or manually: Play Console → Production track → Create new release → upload AAB.

**Play Store checklist:**
- [ ] Store listing (description, screenshots for phone + 7" tablet)
- [ ] Content rating questionnaire
- [ ] Privacy policy URL
- [ ] At least 2 internal testers before production release

Play Store review takes 1–3 days for the first submission.

---

## STEP 7 — Deploy Web (PWA)

### 7a. Build the web bundle

```bash
npx expo export --platform web
# Output: dist/ folder
```

### 7b. Deploy to Vercel (recommended, free)

```bash
npm install -g vercel
vercel --prod
# Follow prompts: Framework = Other, Output dir = dist
```

Or with Netlify:

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### 7c. Custom domain

In Vercel dashboard → Project → Settings → Domains → Add `app.paasxo.com`

Add a CNAME record in your DNS:
```
CNAME  app  cname.vercel-dns.com.
```

> **Note**: react-native-maps does not render on web. The ExploreScreen shows a
> "Map available on iOS & Android" fallback — all other features work on web.

---

## STEP 8 — Deploy the Spring Boot Backend

### Option A: Railway (easiest, ~$5/mo)

1. Push backend to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add env variables:
   ```
   SPRING_DATASOURCE_URL=jdbc:postgresql://...
   JWT_SECRET=your-secret
   FIREBASE_PROJECT_ID=paasxo
   ```
4. Railway auto-deploys on every push to main
5. Get your URL: `https://paasxo-backend.railway.app`

### Option B: Render (free tier for testing)

1. Go to [render.com](https://render.com) → New Web Service
2. Connect GitHub repo
3. Build command: `./mvnw package -DskipTests`
4. Start command: `java -jar target/*.jar`
5. Add environment variables in dashboard

### Option C: AWS (production-grade)

```bash
# ECR + ECS (Fargate) via AWS CLI
aws ecr create-repository --repository-name paasxo-api
docker build -t paasxo-api .
docker push <ecr-url>/paasxo-api:latest
# Then create ECS task definition + service + ALB
```

For database, use **AWS RDS PostgreSQL** (or Railway's built-in Postgres).

---

## STEP 9 — OTA Updates (no App Store review needed)

Expo lets you push JS-only updates instantly to all users:

```bash
eas update --branch production --message "Fix explore map pins"
```

This updates the JS bundle without a new App Store submission.
Only use for JS/UI changes — native code changes always need a new build.

---

## STEP 10 — CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: EAS Build & Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --non-interactive --profile production
      - run: eas update --branch production --message "Deploy from CI"
```

Store `EXPO_TOKEN` in GitHub → Settings → Secrets.

---

## Quick Reference

| What | Command |
|------|---------|
| Start dev server | `npx expo start` |
| Run on iOS Simulator | `npx expo start --ios` |
| Run on Android Emulator | `npx expo start --android` |
| Run on Web | `npx expo start --web` |
| Build iOS production | `eas build -p ios --profile production` |
| Build Android production | `eas build -p android --profile production` |
| Submit to App Store | `eas submit -p ios` |
| Submit to Play Store | `eas submit -p android` |
| Push OTA update | `eas update --branch production` |
| Export web | `npx expo export --platform web` |

---

## Environment Checklist Before Launch

- [ ] `BASE_URL` in endpoints.ts points to production backend
- [ ] Firebase config files in place (`GoogleService-Info.plist`, `google-services.json`)
- [ ] Bundle IDs match App Store Connect / Play Console
- [ ] Privacy policy page live (required by both stores)
- [ ] Push notification credentials configured in EAS
- [ ] Stripe/payment keys in backend env vars (not in app)
- [ ] Error monitoring: add Sentry (`npx expo install @sentry/react-native`)
- [ ] Analytics: add Expo Analytics or Mixpanel
