# 🗺️ IMPLEMENTATION ROADMAP: From Now to Production

Complete timeline and checklist for connecting all APIs.

---

## 📅 PHASE 1: Foundation (Backend Email/Password) — Week 1-2

### Goal: Complete Email/Password Authentication

#### Milestones

**Week 1 - Model & Database**
```
Day 1-2: Create User Entity
  - UserEntity.java with all fields
  - @Table(name = "users")
  - Fields: id, email, fullName, phone, password_hash, sport, skillLevel, location, createdAt

Day 3: Create Repository
  - UserRepository extends JpaRepository<User, Long>
  - Methods: findByEmail(email), existsByEmail(email)

Day 4-5: Password Hashing Setup
  - Add BCryptPasswordEncoder bean
  - Use PasswordEncoder.encode(password) before saving
  - Test: bcrypt.compare(inputPassword, storedHash) returns true
```

**Week 2 - Authentication Endpoints**
```
Day 6-7: Create AuthController
  - POST /api/auth/register endpoint
  - POST /api/auth/login endpoint
  - Add JwtProvider class for token generation

Day 8-9: JWT Implementation
  - Create JsonWebTokenProvider.java
  - generateAccessToken(userId) → 1 hour expiration
  - generateRefreshToken(userId) → 7 days expiration
  - Include userId in token claims

Day 10: Testing
  - Test /api/auth/register with new user
  - Test /api/auth/register with existing email (409 error)
  - Test /api/auth/login with correct password
  - Test /api/auth/login with wrong password (401 error)
```

#### Code Checklist
```java
✅ User.java entity created
✅ UserRepository created
✅ PasswordEncoder configured
✅ AuthController.register() implemented
✅ AuthController.login() implemented
✅ JwtProvider token generation works
✅ /api/auth/register endpoint working
✅ /api/auth/login endpoint working
✅ Tokens contain userId in claims
✅ Token expiration set correctly
```

#### Success Criteria
```
POST /api/auth/register { email, password, fullName, ... }
Response 200: { accessToken, refreshToken, user: {...} }

POST /api/auth/login { email, password }
Response 200: { accessToken, refreshToken, user: {...} }

POST /api/auth/login { email, wrong_password }
Response 401: "Invalid credentials"
```

---

## 📅 PHASE 2: User Data Endpoints — Week 2-3

### Goal: Profile Retrieval & Updates

#### Milestones

**Week 2-3**
```
Day 1-2: GET /api/user/profile
  - Requires Authorization header with JWT
  - Extract userId from token
  - Return user data
  - Return 401 if token invalid

Day 3-4: PUT /api/user/profile
  - Update: fullName, sport, skillLevel, location, phone
  - Return updated user

Day 5-6: POST /api/user/avatar
  - Multipart form-data upload
  - Save to disk or cloud storage (AWS S3)
  - Return URL to frontend
  - Link to user profile

Day 7: Spring Security Setup
  - Add JWT filter
  - Intercept all /api/** requests
  - Validate token on every request
  - Return 401 for invalid tokens
```

#### Code Checklist
```java
✅ UserController.getProfile() implemented
✅ /api/user/profile returns current user
✅ UserController.updateProfile() implemented
✅ /api/user/avatar POST handler created
✅ File upload storage configured
✅ JwtAuthenticationFilter created
✅ Spring Security configured
✅ All /api/** routes protected
✅ 401 response for invalid tokens
✅ CORS configured for frontend origin
```

#### Success Criteria
```
GET /api/user/profile
Authorization: Bearer <valid_token>
Response 200: { id, email, fullName, ... }

PUT /api/user/profile { fullName: "New Name" }
Authorization: Bearer <valid_token>
Response 200: { ...updated user }

POST /api/user/avatar (multipart file)
Authorization: Bearer <valid_token>
Response 200: { profilePictureUrl: "https://..." }

GET /api/user/profile
Authorization: Bearer <invalid_token>
Response 401: "Unauthorized"
```

---

## 📅 PHASE 3: End-to-End Testing — Week 3

### Goal: Validate Complete Email/Password Flow

#### Test Scenarios

```bash
# Terminal 1: Start backend
mvn spring-boot:run

# Terminal 2: Start frontend
npm run dev

# Open app on device/simulator
```

#### Manual Test Cases

**Test 1: Fresh Signup**
```
✅ Click "Sign Up"
✅ Enter: email, password, fullName, phone, etc.
✅ Submit
⏳ See loading spinner
✅ Receive success (profile screen loads)
✅ See user email/name displayed
✅ Restart app
✅ Still logged in (token persisted)
✅ ProfileScreen loads user data via JWT
```

**Test 2: Signin with Existing User**
```
✅ Logout (or restart and clear AsyncStorage)
✅ Click "Sign In"
✅ Enter correct email/password
✅ Receive success
✅ Home screen loads
❌ Try again with wrong password
✅ See error message "Invalid credentials"
```

**Test 3: Profile Update**
```
✅ Logged in
✅ Go to ProfileScreen
✅ Tap edit/settings
✅ Update profile data
✅ Submit
✅ Data persists after refresh
```

**Test 4: Network Requests**
```
✅ Open DevTools (Charles/Fiddler)
✅ Watch network requests
✅ Verify Authorization header present
✅ Verify token format: "Bearer eyJ..."
✅ See 401 if token removed
```

#### Success Criteria
```
🎯 Email/password signup works end-to-end
🎯 Email/password signin works end-to-end
🎯 Tokens persist across app restart
🎯 Profile loads and displays correctly
🎯 JWT included in all requests
🎯 Invalid tokens return 401
```

---

## 📅 PHASE 4: Social Authentication (Google/Apple) — Week 4

### Goal: Complete Social Sign-In Integration

#### Prerequisites
```
✅ Phase 1-3 complete (email/password working)
✅ Understand JWT flow
✅ Backend runs on HTTPS (for social)
```

#### Milestones

**Week 4 - Setup**
```
Day 1-2: Firebase Setup
  - Create Firebase project
  - Enable Google Sign-In provider
  - Get Web Client ID
  - Add to frontend config/firebase.ts

Day 3-4: Frontend Firebase Integration
  - npm install firebase expo-auth-session
  - Initialize Firebase with config
  - Create useGoogleSignIn hook
  - Create useAppleSignIn hook

Day 5-6: Backend Google Verification
  - Add google-auth-library dependency
  - Create GoogleTokenVerifier bean
  - Implement /api/auth/social/google endpoint
  - Extract email/name from idToken

Day 7: Backend Apple Verification
  - Add jwt dependency
  - Implement Apple token verification
  - Implement /api/auth/social/apple endpoint
```

#### Code Structure

**Frontend - hooks/useGoogleSignIn.ts (NEW)**
```typescript
✅ Import Google.useAuthRequest
✅ Configure with WEB_CLIENT_ID
✅ Create handleGoogleSignIn function
✅ Get idToken from Firebase
✅ Call auth.completeSocialSignIn('google', idToken)
```

**Frontend - hooks/useAppleSignIn.ts (NEW)**
```typescript
✅ Import AppleAuthentication
✅ Create handleAppleSignIn function
✅ Request FULL_NAME + EMAIL scopes
✅ Get identityToken from Apple
✅ Call auth.completeSocialSignIn('apple', identityToken)
```

**Backend - GoogleTokenController.java (NEW)**
```java
✅ @PostMapping("/api/auth/social/google")
✅ Verify idToken with Google
✅ Extract email/name/picture
✅ Find or create user
✅ Generate app JWT tokens
✅ Return { accessToken, refreshToken, user }
```

**Backend - AppleTokenController.java (NEW)**
```java
✅ @PostMapping("/api/auth/social/apple")
✅ Verify identityToken with Apple
✅ Extract email/appleUserId
✅ Find or create user
✅ Generate app JWT tokens
✅ Return { accessToken, refreshToken, user }
```

#### Success Criteria
```
🎯 Google Sign-In button opens Firebase UI
🎯 User authenticates with Google account
🎯 Frontend sends idToken to backend
🎯 Backend validates with Google
🎯 User created/updated in database
🎯 App receives JWT tokens
🎯 All future requests include JWT
🎯 Same flow works for Apple (iOS only)
```

---

## 📅 PHASE 5: Polish & Production — Week 5

### Goal: Finalize and Deploy

#### Before Production Checklist

```
Frontend:
- [ ] Remove console.log statements
- [ ] Error messages user-friendly
- [ ] Loading states shown everywhere
- [ ] Token refresh implemented
- [ ] Logout clears all data
- [ ] Tests passing (if using Jest)
- [ ] Build succeeds without warnings

Backend:
- [ ] No hardcoded secrets
- [ ] Environment variables configured
- [ ] CORS properly configured
- [ ] Rate limiting on auth endpoints
- [ ] Logging for security events
- [ ] Database backups configured
- [ ] SSL/HTTPS enforced
- [ ] Custom error pages (403, 404, 500)

Together:
- [ ] Load testing passed
- [ ] Security audit completed
- [ ] Refresh token rotation works
- [ ] Token expiration handled
- [ ] Network failure recovery
- [ ] Old token cleanup
- [ ] Documentation updated
```

#### Deployment Command Reference
```bash
# Frontend
npm run build
eas build --platform ios
eas build --platform android

# Backend
mvn clean package
java -jar target/paasxo-1.0.0.jar --server.port=8080

# Docker
docker build -t paasxo-backend .
docker run -p 8080:8080 paasxo-backend
```

---

## 🎯 Success Metrics

### Phase Complete When...

**Phase 1: ✅**
```
- Backend creates users with hashed passwords
- Login returns JWT tokens
- Tokens contain userId
- Both endpoints return proper error codes
```

**Phase 2: ✅**
```
- Profile endpoint required JWT
- Invalid JWT returns 401
- Avatar upload works
- Updates persist in database
```

**Phase 3: ✅**
```
- Signup → Profile loaded = WORKS
- Signin → Home loaded = WORKS
- Restart → Still logged in = WORKS
- JWT in all requests = VERIFIED
```

**Phase 4: ✅**
```
- Google button → Firebase UI = WORKS
- User selects account = WORKS
- Backend validates token = WORKS
- User authenticated with app JWT = WORKS
```

**Phase 5: ✅**
```
- All endpoints protected
- All errors handled gracefully
- Performance acceptable
- Security validated
- Ready for users!
```

---

## 📊 What's Already Done for Each Phase

| Phase | Frontend | Backend | Status |
|-------|----------|---------|--------|
| 1 | ✅ 100% | ❌ 0% | Started |
| 2 | ✅ 100% | ❌ 0% | Started |
| 3 | ✅ 100% | 50% | Testing |
| 4 | 🟡 70% | ❌ 0% | Firebase needed |
| 5 | ⏳ Pending | ⏳ Pending | After phase 4 |

---

## ⚡ Fast Track (If You're Experienced)

### Compress Phases 1-2 into 1 Week

**Skip:** Detailed guides, step-by-step tutorials
**Do:** 
- User model + repository (1 hour)
- AuthController (1 hour)
- JwtProvider (30 min)
- JWT filter (1 hour)
- UserController (1 hour)
- Setup CORS + error handling (30 min)
- Quick local testing (1 hour)

**Result:** Backend ready for end-to-end testing in 6-7 hours

---

## ❌ Common Pitfalls to Avoid

### Pitfall 1: Forgetting Password Hash
```
❌ WRONG: user.setPassword(req.getPassword());
✅ RIGHT: user.setPassword(passwordEncoder.encode(req.getPassword()));
Error: Hackers can read passwords directly from database!
```

### Pitfall 2: Weak JWT Secret
```
❌ WRONG: String secret = "secret";
✅ RIGHT: Read from environment variable, 256+ bits long
Error: Anyone can forge tokens!
```

### Pitfall 3: No Token Expiration
```
❌ WRONG: Token never expires
✅ RIGHT: accessToken expires in 1 hour, refreshToken in 7 days
Error: Stolen token grants forever access!
```

### Pitfall 4: CORS Not Configured
```
❌ WRONG: Backend doesn't allow frontend origin
✅ RIGHT: @CrossOrigin("http://localhost:3000") or application.yml config
Error: Frontend can't call backend from different port!
```

### Pitfall 5: Same Token for Social & Email/Password
```
❌ WRONG: Different validation paths but same token format
✅ RIGHT: All tokens validated same way (different sources, same format)
Error: Confusion and potential security holes!
```

---

## 🚀 Launch Day Checklist

```
✅ Database backed up and verified
✅ Backend deployed and tested
✅ Frontend built and submitted
✅ Monitoring/alerts configured
✅ Support team trained
✅ Rollback plan documented
✅ API documentation published
✅ Logging enabled
✅ Performance baseline taken
✅ Security scan passed
✅ Load testing passed

LAUNCH! 🎉
```

---

## 📞 Need Help?

**When Stuck:** Check QUICK_REFERENCE.md first (super fast!)
**Deep Dive:** See STEP_BY_STEP_FLOW.md with code examples
**Architecture:** See API_CONNECTION_ANALYSIS.md for overview
**Social Setup:** See SOCIAL_AUTH_GUIDE.md for detailed firebase

---

## 📈 Scaling Beyond MVP

```
After Phase 5 succeeds, add:

✅ Two-factor authentication (2FA)
✅ Email verification on signup
✅ Password reset flow
✅ Account linking (one user, multiple social accounts)
✅ User roles/permissions
✅ Audit logging
✅ Rate limiting per user
✅ Biometric authentication
✅ Session management (logout all devices)
✅ API keys for integrations
```

---

**Timeline Summary:**
- Week 1: Backend authentication ready
- Week 2: Profile endpoints + testing
- Week 3: End-to-end validation
- Week 4: Social authentication
- Week 5: Polish and production

**Current Status:** Weeks 1-2 backend work ready to start!
Frontend already 100% ready to test once backend is done. 🎯
