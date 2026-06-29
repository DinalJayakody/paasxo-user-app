# 🔗 API CONNECTION STATUS - DETAILED ANALYSIS

## Overview: What's Connected vs What Needs Connection

```
✅ = Fully implemented and wired
🟡 = Partially implemented, needs frontend wiring
❌ = Placeholder/Not connected
```

---

## 📊 Current Connection Status

### **1. USER API (✅ FULLY CONNECTED)**

#### Flow: Profile Screen → Screens → AuthContext → userApi → Backend

```typescript
// ✅ endpoints.ts - Defined
USER: {
  PROFILE: '/api/user/profile',
  UPDATE_PROFILE: '/api/user/profile',
  UPLOAD_AVATAR: '/api/user/avatar',
}

// ✅ userApi.ts - Implemented
export const userApi = {
  getProfile: async () → GET /api/user/profile
  updateProfile: async (payload) → PUT /api/user/profile
  uploadAvatar: async (formData) → POST /api/user/avatar (multipart)
}

// ✅ axios.ts - JWT Interceptor Active
When userApi is called:
  1. Axios Interceptor runs
  2. Fetches JWT from AsyncStorage
  3. Adds "Authorization: Bearer <token>" header
  4. Sends request with header

// ✅ AuthContext.tsx - Integrated
loadFromStorage() calls:
  → axiosInstance.get('/api/user/profile')
  → Automatically has JWT header
  → Updates user state
```

**Status:** Complete! Just needs backend endpoint to exist.

---

### **2. AUTH API - EMAIL/PASSWORD (✅ FULLY WIRED)**

#### Flow: SignInScreen → AuthContext → authApi → Backend

```typescript
// ✅ endpoints.ts - Defined
AUTH: {
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  REFRESH: '/api/auth/refresh',
}

// ✅ authApi.ts - Implemented
export const authApi = {
  login: async (payload) → POST /api/auth/login { email, password }
  register: async (payload) → POST /api/auth/register { email, phone, password, ... }
  refreshToken: async (token) → POST /api/auth/refresh { refreshToken }
}

// ✅ AuthContext.tsx - Fully Implemented
signIn(payload):
  1. Calls authApi.login(payload)
  2. Receives { accessToken, refreshToken, user }
  3. Calls persistTokens()
     - Stores both tokens in AsyncStorage
     - Sets Axios default header to "Bearer <accessToken>"
  4. Updates user state
  5. Screen receives user and can navigate

signUp(payload):
  Same flow as signIn, but calls authApi.register()

// ✅ SignInScreen.tsx - Wired
<Button onPress={() => auth.signIn(email, password)} />

// ✅ SignUpScreen.tsx - Wired
<Button onPress={() => auth.signUp(fullName, email, phone, password)} />
```

**Status:** Complete! Ready for backend validation.

---

### **3. SOCIAL AUTH - GOOGLE (🟡 PARTIALLY CONNECTED)**

#### Current Status: API wrapper ready, but missing Firebase frontend

```typescript
// ✅ endpoints.ts - Defined
AUTH: {
  GOOGLE_LOGIN: '/api/auth/social/google',
}

// ✅ socialApi.ts - NEW! Implemented ✨
export const socialApi = {
  loginWithGoogle: async (idToken) 
    → POST /api/auth/social/google { idToken }
    → Returns { accessToken, refreshToken, user }
}

// ✅ AuthContext.tsx - NEW! Integrated ✨
completeSocialSignIn(provider, token):
  1. Calls appropriate socialApi method
  2. Receives JWT tokens from backend
  3. Calls persistTokens()
  4. Updates user state
  
// ❌ SignInScreen/SignUpScreen - NOT WIRED TO FIREBASE
<Button title="Google Login" 
  onPress={async () => await auth.googleSignIn()} 
/>
// ↑ This calls auth.googleSignIn() but it's a placeholder!
// It needs to:
//   1. Get idToken from Firebase
//   2. Call auth.completeSocialSignIn('google', idToken)

// ❌ Firebase SDK - NOT INSTALLED
expo install firebase expo-auth-session is needed
```

**What's Missing:**
- Firebase initialization
- Firebase credential request (promptAsync)
- Extracting idToken from Firebase response
- Wiring screen button to Firebase → completeSocialSignIn

**Flow This Should Look Like:**
```
User taps "Google" button
  ↓
Firebase opens Google login popup
  ↓
User authenticates with Google
  ↓
Firebase returns idToken
  ↓
Screen extracts idToken
  ↓
Screen calls auth.completeSocialSignIn('google', idToken)
  ↓
completeSocialSignIn calls socialApi.loginWithGoogle(idToken)
  ↓
socialApi sends to backend
  ↓
Backend validates idToken with Google
  ↓
Backend creates/updates user
  ↓
Backend returns accessToken, refreshToken
  ↓
completeSocialSignIn persists tokens
  ↓
All future requests have JWT header 🎉
```

**Status:** 80% complete. Backend API wrapper ready, just need Firebase SDK integration.

---

### **4. SOCIAL AUTH - APPLE (🟡 PARTIALLY CONNECTED)**

Same as Google, but for Apple. Same status as Google.

**Additional Requirement:** Apple Sign-In only works on iOS, requires:
- Device or physical iPhone (simulator doesn't work)
- App ID with "Sign in with Apple" capability
- Service ID configuration in Apple Developer Portal

---

## 🎯 Connection Priority: What to Do Next

### **Priority 1 (IMMEDIATE):** 
Add backend endpoints to handle `/api/auth/login`, `/api/auth/register`, `/api/user/profile`

```java
// Spring Boot example
@PostMapping("/api/auth/login")
public ResponseEntity<?> login(@RequestBody LoginRequest req) {
  // Validate email + password against database
  // If valid: generate tokens and return
  // If invalid: return 401
}
```

### **Priority 2 (AFTER PRIORITY 1):**
Test email/password auth end-to-end

```bash
1. Install backend dependencies
2. Create User entity and repository
3. Implement login/register endpoints
4. Run frontend: npm run dev
5. Test SignUp with email/password/phone
6. Test SignIn with email/password
7. Verify ProfileScreen loads user data
```

### **Priority 3 (AFTER PRIORITIES 1 & 2):**
Add Firebase and social sign-in

```bash
1. Create Firebase project
2. npm install firebase expo-auth-session expo-apple-authentication
3. Initialize Firebase in app root
4. Create useGoogleSignIn and useAppleSignIn hooks
5. Wire buttons to Firebase SDK
6. Backend validates Google/Apple tokens
7. Test social login end-to-end
```

---

## 📐 Architecture Comparison

### **Email/Password Flow (Complete)**

```
Input:
  email: "user@example.com"
  password: "secret123"
    ↓
Route:
  SignInScreen
    ↓ (user taps button)
  AuthContext.signIn({ email, password })
    ↓
  authApi.login({ email, password })
    ↓
  Axios POST /api/auth/login
    ↓
Backend:
  Validate email + password in database
  Generate JWT tokens
  Return { accessToken, refreshToken, user }
    ↓
Frontend:
  persistTokens() saves to AsyncStorage
  Axios header updated
  User state updated
  Navigation to home
    ↓
Result:
  All future requests include Authorization: Bearer JWT
```

### **Social Auth Flow (Backend Ready, Frontend Incomplete)**

```
Input:
  (user taps "Google Login")
    ↓
Route:
  SignInScreen (MISSING FIREBASE HERE!)
    ❌ Needs: Firebase.getGoogleIdToken()
    ↓ (should call auth.completeSocialSignIn with idToken)
  AuthContext.completeSocialSignIn('google', idToken)
    ↓
  socialApi.loginWithGoogle(idToken)
    ↓
  Axios POST /api/auth/social/google { idToken }
    ↓
Backend:
  Validate idToken signature with Google
  Extract user info from token
  Find or create user in database
  Generate JWT tokens
  Return { accessToken, refreshToken, user }
    ↓
Frontend:
  persistTokens() saves to AsyncStorage
  Axios header updated
  User state updated
  Navigation to home
    ↓
Result:
  All future requests include Authorization: Bearer JWT
```

---

## 🔄 HTTP Request Examples

### **When User Makes API Call (After Any Auth)**

Every request automatically includes JWT:

```
GET /api/user/profile
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

// Axios interceptor DID THIS ↑ automatically!
```

### **Login Request (Email/Password)**

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret123"
}

Response 200:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

### **Social Login Request (Google)**

```
POST /api/auth/social/google
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9...  ← From Google
}

Backend verifies this token signature using Google's public keys
If valid, creates/updates user and returns:

Response 200:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",  ← Your app's token
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "email": "user@gmail.com",
    "fullName": "John Google"
  }
}
```

---

## 🛑 Why Google/Apple Aren't "Connected" Like UserApi

### User API Example (Why It's "Connected")
```typescript
// Direct: Username/Password ✅ Available
// 1. User enters email + password ✅
// 2. Screen has all data immediately ✅
// 3. Can call API directly ✅

userApi.updateProfile({...})  // Works immediately!
```

### Social Auth Example (Why It's "Not Connected")
```typescript
// Indirect: Need External SDK ❌ Not Available In App
// 1. User needs Firebase SDK ❌ Not installed
// 2. Need native iOS/Android modules ❌ Not compiled
// 3. Need Firebase initialization ❌ Not configured
// 4. Need network request to Firebase ❌ Extra latency

// Until Firebase is installed and configured:
auth.googleSignIn()  // Placeholder, does nothing!
```

---

## ✅ Checklist: Full API Integration

### Frontend (Expo)
- [x] Create endpoints.ts
- [x] Create axios.ts with interceptors
- [x] Create authApi.ts
- [x] Create userApi.ts (only fully connected)
- [x] Create socialApi.ts ← NEW!
- [x] Create AuthContext with all methods
- [x] Add social methods to AuthContext ← UPDATED!
- [ ] Install Firebase: `npm install firebase expo-auth-session`
- [ ] Create useGoogleSignIn hook ← NEEDED
- [ ] Create useAppleSignIn hook ← NEEDED
- [ ] Wire SignInScreen buttons to Firebase
- [ ] Wire SignUpScreen buttons to Firebase

### Backend (Spring Boot)
- [ ] Create User entity
- [ ] Create UserRepository
- [ ] Create /api/auth/login endpoint
- [ ] Create /api/auth/register endpoint
- [ ] Create /api/auth/refresh endpoint (for token refresh)
- [ ] Create /api/auth/social/google endpoint ← NEEDED
- [ ] Create /api/auth/social/apple endpoint ← NEEDED
- [ ] Create /api/user/profile endpoint
- [ ] Create /api/user/avatar endpoint
- [ ] Add JWT token generation
- [ ] Add Google token verification
- [ ] Add Apple token verification

---

## 🎓 Key Learning Points

### 1. **Axios Interceptors = Magic**
Every single request automatically gets JWT without you doing anything!

### 2. **Three Types of Authentication**
- **Email/Password**: Your app validates credentials
- **Social (Google/Apple)**: Google/Apple validates, you trust signature
- **JWT Tokens**: Used for ALL subsequent requests

### 3. **The "Why" Behind Layers**
- `endpoints.ts` → Easy to change URLs per environment
- `authApi.ts / userApi.ts` → Easy to test, reuse, document
- `axios.ts` → Token management happens automatically
- `AuthContext.tsx` → Screens don't know about HTTP internals

### 4. **Persistent JWT Token**
```
First Request:
  - No token, login with email/password
  - Backend returns accessToken
  - Stored in AsyncStorage
  
Every Future Request:
  - Axios interceptor fetches from AsyncStorage
  - Adds to Authorization header
  - Backend recognizes token, grants access
  
App Restart:
  - AuthContext.loadFromStorage() runs
  - Fetches token from AsyncStorage
  - Restores all future requests automatically
```

---

## 💡 Summary

| Layer | Status | What It Does |
|-------|--------|-------------|
| **endpoints.ts** | ✅ Complete | Defines all URL paths |
| **axios.ts** | ✅ Complete | Adds JWT to every request |
| **authApi.ts** | ✅ Complete | Wraps email/password endpoints |
| **userApi.ts** | ✅ Complete | Wraps profile endpoints |
| **socialApi.ts** | ✅ Complete | Wraps social endpoints (NEW) |
| **AuthContext** | ✅ Complete | Manages auth state + tokens |
| **Firebase SDK** | ❌ Missing | Needed for Google/Apple |
| **SignUp/SignIn Wiring** | 🟡 Partial | Email/password works, social needs Firebase |

**Bottom Line:** Email/password auth is ready. Social auth is 80% ready—just needs Firebase SDK and button integration!
