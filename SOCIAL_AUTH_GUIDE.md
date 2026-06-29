# 🔐 SOCIAL AUTHENTICATION IMPLEMENTATION GUIDE

This guide explains how to integrate Google and Apple sign-in with your existing API architecture.

## 📊 OVERVIEW: How Social Sign-In Works

```
User taps "Sign with Google"
    ↓
Firebase SDK prompts user to sign in with Google account
    ↓
Google returns idToken (JWT with user identity info)
    ↓
App sends idToken to YOUR BACKEND
    ↓
Backend validates idToken with Google's servers
    ↓
Backend finds/creates user in database
    ↓
Backend generates YOUR APP's JWT tokens (accessToken, refreshToken)
    ↓
Backend returns app tokens to frontend
    ↓
Frontend stores tokens locally & authenticates all future requests
```

---

## 🚀 ARCHITECTURE

### Current Setup (After Updates)

```
SignUpScreen / SignInScreen
    ↓
    Button tap → completeSocialSignIn(provider, idToken)
    ↓
AuthContext.completeSocialSignIn()
    ↓
socialApi.loginWithGoogle() or loginWithApple()
    ↓
POST /api/auth/social/google or /api/auth/social/apple
    ↓
Backend validates token & returns JWT
    ↓
persistTokens() → AsyncStorage + Axios headers
    ↓
User authenticated! All future requests have JWT.
```

---

## 🔧 STEP 1: Frontend Setup - Install Firebase (Expo)

### For Expo-managed Project:

```bash
# Install Firebase and Auth Session
npm install firebase expo-auth-session expo-crypto

# Or with yarn
yarn add firebase expo-auth-session expo-crypto
```

### For Bare React Native:

```bash
# Google Sign-In
npm install @react-native-google-signin/google-signin

# Apple Sign-In  
npm install @invertase/react-native-apple-authentication

# Also need Firebase
npm install firebase
```

---

## 🌐 STEP 2: Firebase Console Setup

### Google Sign-In Configuration:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing
3. Enable Google Sign-In provider:
   - Authentication → Sign-in method → Google
   - Add supported email domains
4. Get your **Web Client ID**:
   - Project Settings → Web SDK Configuration
   - Copy: `authDomain`, `projectId`, etc.
5. Register your app's ID for OAuth:
   - For Expo: Bundle ID and SHA-1 certificate
   - For Android: Get SHA-1 from: `keytool -list -v -keystore ~/.android/debug.keystore`

### Apple Sign-In Configuration:

1. Apple requires you to set up:
   - App ID with Sign in with Apple capability
   - Service ID for your app
   - Private key from Apple Developer account
2. Firebase will use this configuration to validate Apple tokens
3. In Apple Developer Portal:
   - Certificates, Identifiers & Profiles → Identifiers → App ID
   - Add "Sign in with Apple" capability

---

## 📱 STEP 3: Frontend Implementation - Create Google Sign-In Hook

Create [src/hooks/useGoogleSignIn.ts](src/hooks/useGoogleSignIn.ts):

```typescript
// NOT YET CREATED - This is an example of what you need

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// Web client ID from Firebase console
const WEB_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

export const useGoogleSignIn = () => {
  const { completeSocialSignIn } = useContext(AuthContext);
  
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
  });

  const handleGoogleSignIn = async () => {
    try {
      const result = await promptAsync();
      
      if (result?.type === 'success') {
        // Get ID token from response
        const idToken = result.params.id_token;
        
        // Now exchange it for your app's JWT
        await completeSocialSignIn('google', idToken);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  return { handleGoogleSignIn, loading: !request };
};
```

---

## 🍎 STEP 4: Frontend Implementation - Create Apple Sign-In Hook

For iOS only. Create [src/hooks/useAppleSignIn.ts](src/hooks/useAppleSignIn.ts):

```typescript
// NOT YET CREATED - This is an example of what you need

import * as AppleAuthentication from 'expo-apple-authentication';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export const useAppleSignIn = () => {
  const { completeSocialSignIn } = useContext(AuthContext);

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      console.warn('Apple Sign-In only available on iOS');
      return;
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // credential.identityToken is the JWT from Apple
      if (credential.identityToken) {
        // Extract user info (only available on first sign-in)
        const appleUser = {
          email: credential.email,
          fullName: credential.fullName,
        };

        // Exchange for your app's JWT
        await completeSocialSignIn('apple', credential.identityToken, appleUser);
      }
    } catch (error) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('Apple sign-in canceled');
      } else {
        console.error('Apple sign-in error:', error);
        throw error;
      }
    }
  };

  return { handleAppleSignIn };
};
```

---

## 🔌 STEP 5: Backend Setup - Spring Boot Implementation

### Create Social Auth Endpoints

Create a Spring Boot controller at `src/main/java/com/paasxo/api/AuthController.java`:

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

  private final UserRepository userRepository;
  private final JwtProvider jwtProvider;
  private final GoogleIdTokenVerifier googleVerifier;
  private final AppleJwtSignatureValidator appleValidator;

  /**
   * Exchange Google ID token for app JWT
   */
  @PostMapping("/social/google")
  public ResponseEntity<?> googleSignIn(@RequestBody GoogleSignInRequest req) {
    try {
      // 1. Verify token with Google
      GoogleIdToken idToken = googleVerifier.verify(req.getIdToken());
      
      if (idToken == null) {
        return ResponseEntity.status(401).body("Invalid Google token");
      }

      GoogleIdToken.Payload payload = idToken.getPayload();
      String email = payload.getEmail();
      String googleUserId = payload.getSubject();
      String firstName = (String) payload.get("given_name");
      String lastName = (String) payload.get("family_name");
      String profilePicture = (String) payload.get("picture");

      // 2. Find or create user in your database
      User user = userRepository.findByEmail(email)
        .orElseGet(() -> {
          User newUser = new User();
          newUser.setEmail(email);
          newUser.setFirstName(firstName);
          newUser.setLastName(lastName);
          newUser.setProfilePicture(profilePicture);
          newUser.setGoogleId(googleUserId);
          newUser.setPassword(null); // Social login, no password
          return userRepository.save(newUser);
        });

      // 3. Generate your app's JWT tokens
      String accessToken = jwtProvider.generateAccessToken(user.getId());
      String refreshToken = jwtProvider.generateRefreshToken(user.getId());

      // 4. Return tokens
      return ResponseEntity.ok(new AuthResponse(
        accessToken,
        refreshToken,
        new UserProfileDto(user)
      ));

    } catch (Exception e) {
      return ResponseEntity.status(401).body("Google verification failed: " + e.getMessage());
    }
  }

  /**
   * Exchange Apple identity token for app JWT
   */
  @PostMapping("/social/apple")
  public ResponseEntity<?> appleSignIn(@RequestBody AppleSignInRequest req) {
    try {
      // 1. Verify token with Apple
      DecodedJWT decodedToken = appleValidator.verify(req.getIdentityToken());
      
      String appleUserId = decodedToken.getSubject();
      String email = decodedToken.getClaim("email").asString();

      // 2. Find or create user
      User user = userRepository.findByEmail(email)
        .orElseGet(() -> {
          User newUser = new User();
          newUser.setEmail(email);
          
          // Apple user data only sent on first sign-in
          if (req.getUser() != null) {
            newUser.setFirstName(req.getUser().getGivenName());
            newUser.setLastName(req.getUser().getFamilyName());
          }
          
          newUser.setAppleId(appleUserId);
          newUser.setPassword(null);
          return userRepository.save(newUser);
        });

      // 3. Generate your app's JWT tokens
      String accessToken = jwtProvider.generateAccessToken(user.getId());
      String refreshToken = jwtProvider.generateRefreshToken(user.getId());

      // 4. Return tokens
      return ResponseEntity.ok(new AuthResponse(
        accessToken,
        refreshToken,
        new UserProfileDto(user)
      ));

    } catch (Exception e) {
      return ResponseEntity.status(401).body("Apple verification failed: " + e.getMessage());
    }
  }
}
```

### Request/Response DTOs

```java
@Data
public class GoogleSignInRequest {
  private String idToken; // From Google
}

@Data
public class AppleSignInRequest {
  private String identityToken; // From Apple
  private AppleUserInfo user; // Only on first sign-in
}

@Data
public class AppleUserInfo {
  private String givenName;
  private String familyName;
  private String email;
}

@Data
public class AuthResponse {
  private String accessToken;
  private String refreshToken;
  private UserProfileDto user;
}
```

### Maven Dependencies

Add to `pom.xml`:

```xml
<!-- Google JWT Verification -->
<dependency>
  <groupId>com.google.auth</groupId>
  <artifactId>google-auth-library-oauth2-http</artifactId>
  <version>1.11.0</version>
</dependency>

<!-- Apple JWT Verification -->
<dependency>
  <groupId>com.auth0</groupId>
  <artifactId>java-jwt</artifactId>
  <version>4.4.0</version>
</dependency>
```

---

## ⚙️ STEP 6: Environment Configuration

### Frontend - Create firebase.config.ts

Create [src/config/firebase.ts](src/config/firebase.ts):

```typescript
export const firebaseConfig = {
  apiKey: 'AIzaSy...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '...',
  appId: '...',
};

// Platform-specific IDs for social sign-in
export const googleSignInConfig = {
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  // iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // For bare RN on iOS
};

export const appleSignInConfig = {
  teamId: 'YOUR_APPLE_TEAM_ID',
  bundleId: 'com.yourcompany.paasxo',
  keyId: 'YOUR_KEY_ID', // From Apple Developer Portal
};
```

### Backend - application.yml

```yaml
# Social sign-in configuration
social:
  google:
    clientId: "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com"
    # Google will verify tokens automatically
  
  apple:
    teamId: "YOUR_TEAM_ID"
    bundleId: "com.yourcompany.paasxo"
    keyId: "YOUR_KEY_ID"
    # Download private key from Apple Developer Portal
    privateKeyPath: "classpath:apple_private_key.p8"
```

---

## 🧪 STEP 7: Testing the Flow

### Test Google Sign-In:

1. Run frontend: `npm run dev`
2. Tap "Google Sign-In" button
3. Firebase will open Google sign-in
4. Select Google account
5. Frontend gets idToken
6. Frontend sends to backend: `POST /api/auth/social/google { idToken }`
7. Backend validates with Google
8. Backend creates user and returns JWTs
9. Frontend stores tokens in AsyncStorage
10. App navigates to home screen
11. All future requests include Authorization header 🎉

### Test Apple Sign-In (iOS only):

1. Run on physical iOS device (simulator doesn't support Apple Sign-In)
2. Tap "Apple Sign-In" button
3. System prompt appears for Face/Touch ID
4. Frontend gets identityToken
5. Follow same flow as Google...

---

## ❌ Common Issues & Solutions

### Issue 1: "Invalid Client ID"
**Cause:** Firebase Web Client ID doesn't match backend config
**Solution:** Copy exact ID from Firebase console, update both frontend and backend

### Issue 2: "CORS errors when calling backend"
**Cause:** Backend doesn't allow requests from frontend origin
**Solution:** Add CORS configuration to Spring Boot:
```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
      .allowedOrigins("http://localhost:*", "https://yourdomain.com")
      .allowedMethods("GET", "POST", "PUT", "DELETE")
      .maxAge(3600);
  }
}
```

### Issue 3: "Token expired immediately"
**Cause:** Token has very short expiration on backend
**Solution:** Adjust JWT expiration in JwtProvider:
```java
public String generateAccessToken(Long userId) {
  return Jwts.builder()
    .setSubject(userId.toString())
    .setIssuedAt(new Date())
    .setExpiration(new Date(System.currentTimeMillis() + 3600000)) // 1 hour
    .signWith(key, SignatureAlgorithm.HS512)
    .compact();
}
```

### Issue 4: "Apple token validation fails"
**Cause:** Private key not loaded correctly on backend
**Solution:** Ensure Apple's .p8 private key file is in resources and properly formatted

---

## 📝 Summary: What Gets Connected

### After These Steps, You'll Have:

✅ `src/api/socialApi.ts` - Social login API wrapper
✅ `src/api/endpoints.ts` - Social endpoints configured
✅ `src/context/AuthContext.tsx` - Social auth methods connected
✅ Backend `/api/auth/social/google` - Validates Google tokens
✅ Backend `/api/auth/social/apple` - Validates Apple tokens
✅ Frontend buttons wired to Firebase SDK
✅ Automatic token persistence and JWT headers

### Remaining Steps (After You Build Backend):

1. Create `src/hooks/useGoogleSignIn.ts` (once Firebase is initialized)
2. Create `src/hooks/useAppleSignIn.ts` (once Firebase is initialized)
3. Update SignInScreen/SignUpScreen buttons to use these hooks
4. Test end-to-end with real Firebase + backend

---

## 🔄 Flow Comparison: Regular vs Social Login

### Regular Email/Password Login:
```
User enters email + password
  ↓
POST /api/auth/login { email, password }
  ↓
Backend verifies with database
  ↓
Returns JWTs
```

### Social Login:
```
User taps "Sign with Google"
  ↓
Firebase SDK authenticates with Google
  ↓
Returns idToken (signed by Google)
  ↓
POST /api/auth/social/google { idToken }
  ↓
Backend verifies signature with Google's public key
  ↓
Returns JWTs
```

**Key difference:** For social, you're trusting Google/Apple to authenticate, and verifying their signature. For regular, you're verifying password directly.

---

## 📚 References

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Expo Auth Session](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [expo-apple-authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Google ID Token Verification](https://developers.google.com/identity/protocols/oauth2/web-server#verify-the-token-signature)
- [Apple Sign In - Backend Integration](https://developer.apple.com/documentation/signinwithapplerestapi)
- [Spring Boot JWT Implementation](https://spring.io/guides/tutorials/spring-boot-oauth2/)
