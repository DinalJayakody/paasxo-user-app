# 🔀 STEP-BY-STEP API FLOW WITH CODE EXAMPLES

Complete walkthrough of how requests flow through your system.

---

## 🎯 SCENARIO 1: User Signs Up with Email/Password

### **Step 1: User Enters Data on SignUpScreen**

```typescript
// src/screens/SignUpScreen.tsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [fullName, setFullName] = useState('');

const handleSignUp = async () => {
  try {
    await auth.signUp({
      fullName,
      email,
      phone: '+1234567890',
      password,
      confirmPassword: password,
      sport: 'Basketball',
      skillLevel: 'Intermediate',
      location: 'New York',
    });
    // After successful signup, AuthContext updates user state
    // Navigation happens automatically (not wired yet)
  } catch (error) {
    console.error('Sign up failed:', error);
  }
};

return (
  <Button 
    title="Create Account"
    onPress={handleSignUp}
  />
);
```

---

### **Step 2: AuthContext.signUp() is Called**

```typescript
// src/context/AuthContext.tsx
const signUp = async (payload: RegisterPayload) => {
  setLoading(true);  // ← Shows loading spinner
  try {
    // ↓ Calls the API wrapper
    const data: AuthResponse = await authApi.register(payload);
    
    // ↓ Backend response contains tokens
    // { accessToken, refreshToken, user: {...} }
    
    // ↓ Persists tokens to storage
    await persistTokens(data);
    
    // ↓ Updates user state in context
    if (data.user) setUser(data.user);
    
    // Now ALL future requests will have JWT!
  } finally {
    setLoading(false);  // ← Hides loading spinner
  }
};
```

---

### **Step 3: authApi.register() Makes HTTP Request**

```typescript
// src/api/authApi.ts
export const authApi = {
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    // Creates a POST request using axiosInstance
    const { data } = await axiosInstance.post(
      ENDPOINTS.AUTH.REGISTER,
      payload
    );
    return data;
  },
};

// What gets sent:
// POST https://api.example.com/api/auth/register
// {
//   "fullName": "John Doe",
//   "email": "john@example.com",
//   "phone": "+1234567890",
//   "password": "secret123",
//   "sport": "Basketball",
//   ...
// }
```

---

### **Step 4: Axios Request Interceptor Runs**

```typescript
// src/api/axios.ts
// AUTOMATICALLY runs before sending ANY request

axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      // ↓ Fetches token from storage
      const token = await AsyncStorage.getItem('accessToken');
      
      // ↓ On first login, there's NO token yet, so this is skipped
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      // Ignore, request proceeds without token
    }
    return config;  // ← Request continues
  },
  (error) => Promise.reject(error)
);

// First signup: No Authorization header (token doesn't exist yet)
// But for registration, that's OK—backend validates credentials directly
```

---

### **Step 5: Backend Receives Request**

```java
// Spring Boot: src/main/java/com/paasxo/controller/AuthController.java

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  @PostMapping("/register")
  public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
    // Backend receives:
    // {
    //   "fullName": "John Doe",
    //   "email": "john@example.com",
    //   "password": "secret123",  ← MUST be hashed before storing!
    //   ...
    // }

    // Validation
    if (userRepository.existsByEmail(req.getEmail())) {
      return ResponseEntity.status(409).body("Email already exists");
    }

    // Create user
    User user = new User();
    user.setFullName(req.getFullName());
    user.setEmail(req.getEmail());
    user.setPassword(passwordEncoder.encode(req.getPassword())); // Hash!
    user.setPhone(req.getPhone());
    user.setSport(req.getSport());
    
    userRepository.save(user);

    // Generate tokens (signed with SECRET_KEY)
    String accessToken = jwtProvider.generateAccessToken(user.getId());
    String refreshToken = jwtProvider.generateRefreshToken(user.getId());

    // Return response
    return ResponseEntity.ok(new AuthResponse(
      accessToken,           // eyJhbGciOiJIUzI1NiIs...
      refreshToken,          // eyJhbGciOiJIUzI1NiIs...
      new UserProfile(user)  // { id, email, fullName, ... }
    ));
  }
}
```

---

### **Step 6: Frontend Receives Response**

```typescript
// Back in authApi.register()
const { data } = await axiosInstance.post(...);

// data = {
//   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   "user": {
//     "id": 123,
//     "email": "john@example.com",
//     "fullName": "John Doe",
//     "phone": "+1234567890"
//   }
// }

return data;
```

---

### **Step 7: Tokens Are Persisted**

```typescript
// Still in AuthContext.signUp()
const persistTokens = async (tokens: AuthResponse) => {
  // ↓ Store in device local storage
  if (tokens.accessToken) {
    await AsyncStorage.setItem('accessToken', tokens.accessToken);
    // Later: AsyncStorage.getItem('accessToken') will retrieve this
  }
  
  if (tokens.refreshToken) {
    await AsyncStorage.setItem('refreshToken', tokens.refreshToken);
  }

  // ↓ Set Axios default header for ALL future requests
  if (tokens.accessToken) {
    axiosInstance.defaults.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
};

// Now axios WILL automatically add header to next request!
```

---

### **Step 8: User State Updated**

```typescript
// Still in AuthContext.signUp()
if (data.user) {
  setUser(data.user);  // ← Context state changes
  // Component subscribing to context re-renders
  // ProfileScreen can now display:
  // - "Welcome John Doe!"
  // - User profile picture
  // - Settings button
}
```

---

### **Result: User Signed Up! 🎉**

```
✅ User created in database
✅ Tokens stored in AsyncStorage
✅ Axios configured to include JWT
✅ User state updated in context
✅ All future requests will have Authorization header
```

---

## 🎯 SCENARIO 2: User Loads Home Dashboard (After Signup)

### **Step 1: App Initialization - AuthContext.loadFromStorage()**

```typescript
// src/context/AuthContext.tsx
useEffect(() => {
  loadFromStorage();  // ← Runs once when app starts
}, [loadFromStorage]);

const loadFromStorage = useCallback(async () => {
  setLoading(true);
  try {
    // ↓ Check if user was previously authenticated
    const storedToken = await AsyncStorage.getItem('accessToken');
    
    if (storedToken) {
      // ↓ User was logged in! Restore authentication
      axiosInstance.defaults.headers.Authorization = `Bearer ${storedToken}`;
      
      // ↓ Fetch current user profile
      const { data } = await axiosInstance.get('/api/user/profile');
      setUser(data);  // ← Profile loaded
    }
  } catch (err) {
    console.warn('Auth load failed', err);
  } finally {
    setLoading(false);
  }
}, []);
```

---

### **Step 2: Request to GetProfile Endpoint**

```
Axios sees: GET /api/user/profile

Request Interceptor runs:
  ↓ Fetches token from AsyncStorage
  ↓ Finds: "eyJhbGciOiJIUzI1NiIs..."
  ↓ Adds header: Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Sends:
  GET https://api.example.com/api/user/profile
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  ← Added automatically!
```

---

### **Step 3: Backend Validates JWT**

```java
@GetMapping("/profile")
public ResponseEntity<?> getProfile(
  @RequestHeader("Authorization") String authHeader,
  @AuthenticationPrincipal UserDetails userDetails
) {
  // Spring Security middleware verifies JWT:
  // 1. Checks "Bearer " prefix
  // 2. Extracts token: eyJhbGciOiJIUzI1NiIs...
  // 3. Verifies signature using SECRET_KEY
  // 4. If valid: extracts userId from token
  // 5. If invalid: returns 401 Unauthorized

  // If we reach here, token was valid! ✅
  Long userId = Long.parseLong(userDetails.getUsername());
  User user = userRepository.findById(userId)
    .orElseThrow(() -> new RuntimeException("User not found"));

  return ResponseEntity.ok(new UserProfile(user));
}
```

---

### **Step 4: Frontend Receives Profile Data**

```typescript
// Response:
{
  "id": 123,
  "email": "john@example.com",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "sport": "Basketball",
  "skillLevel": "Intermediate",
  "location": "New York",
  "profilePicture": "https://..."
}

// Context updates
setUser(profileData);

// ProfileScreen automatically shows data:
// - Avatar image
// - "John Doe"
// - Settings button
```

---

## 🎯 SCENARIO 3: User Signs In with Email/Password

### **Same Flow as SCENARIO 1, but:**

```typescript
// signIn vs signUp
const signIn = async (payload: LoginPayload) => {
  // Calls: authApi.login(payload)
  // Endpoint: POST /api/auth/login
  // Payload: { "email": "...", "password": "..." }
  
  // Backend:
  // 1. Finds user by email
  // 2. Compares password (hashed)
  // 3. If valid: generates tokens
  // 4. If invalid: returns 401
  
  // Rest of flow is IDENTICAL to signUp
};
```

### **Key Difference:**
```
SignUp: Email doesn't exist yet → Creates new user ✨
SignIn: Email exists → Authenticates existing user
```

---

## 🎯 SCENARIO 4: User Signs In with Google (After Firebase Integration)

### **Step 1: User Taps Google Button**

```typescript
// src/screens/SignInScreen.tsx - AFTER Firebase is installed ✨

import { useGoogleSignIn } from '../hooks/useGoogleSignIn';

const SignInScreen = () => {
  const { handleGoogleSignIn } = useGoogleSignIn();

  return (
    <Button
      title="Continue with Google"
      onPress={handleGoogleSignIn}  // ← User taps this
    />
  );
};
```

---

### **Step 2: useGoogleSignIn Hook (AFTER Firebase Setup)**

```typescript
// src/hooks/useGoogleSignIn.ts - THIS IS WHAT YOU NEED TO CREATE

import * as Google from 'expo-auth-session/providers/google';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useGoogleSignIn = () => {
  const { completeSocialSignIn } = useContext(AuthContext);
  
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
  });

  const handleGoogleSignIn = async () => {
    try {
      // Step 1: Open Google login UI
      const result = await promptAsync();
      
      // Step 2: User authenticates with Google
      // Google returns a result with authentication data
      
      if (result?.type === 'success') {
        // Step 3: Extract Google's idToken
        const idToken = result.params.id_token;
        // idToken is a JWT signed by Google
        // Contains: user's email, name, picture, etc.
        
        // Step 4: Send to YOUR backend to exchange for app JWT
        await completeSocialSignIn('google', idToken);
        
        // ↑ This is where your socialApi gets called!
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  };

  return { handleGoogleSignIn };
};
```

---

### **Step 3: completeSocialSignIn in AuthContext**

```typescript
// src/context/AuthContext.tsx

const completeSocialSignIn = async (
  provider: 'google' | 'apple',
  token: string  // ← idToken from Google or identityToken from Apple
) => {
  setLoading(true);
  try {
    let authResponse: AuthResponse;

    // Calls appropriate wrapper based on provider
    if (provider === 'google') {
      authResponse = await socialApi.loginWithGoogle(token);
      // ↓ Makes: POST /api/auth/social/google { idToken }
    } else if (provider === 'apple') {
      authResponse = await socialApi.loginWithApple(token);
      // ↓ Makes: POST /api/auth/social/apple { identityToken }
    }

    // ↓ Rest is same as email/password signup!
    await persistTokens(authResponse);
    if (authResponse.user) setUser(authResponse.user);
    
  } finally {
    setLoading(false);
  }
};
```

---

### **Step 4: socialApi Sends to Backend**

```typescript
// src/api/socialApi.ts

export const socialApi = {
  loginWithGoogle: async (idToken: string): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post(
      ENDPOINTS.AUTH.GOOGLE_LOGIN,
      { idToken }  // ← Sends Google's token to backend
    );
    return data;
  },
};

// Request:
// POST /api/auth/social/google
// { "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9..." }
```

---

### **Step 5: Backend Validates with Google**

```java
// Spring Boot: AuthController.java

@PostMapping("/social/google")
public ResponseEntity<?> googleSignIn(@RequestBody GoogleSignInRequest req) {
  try {
    // Step 1: Verify idToken with Google
    // (using Google's public keys)
    GoogleIdToken idToken = googleVerifier.verify(req.getIdToken());
    
    if (idToken == null) {
      return ResponseEntity.status(401).body("Invalid token");
    }

    // Step 2: Extract user data from verified token
    GoogleIdToken.Payload payload = idToken.getPayload();
    String email = payload.getEmail();
    String googleUserId = payload.getSubject();
    String fullName = (String) payload.get("name");
    String profilePicture = (String) payload.get("picture");

    // Step 3: Find or create user in YOUR database
    User user = userRepository.findByEmail(email)
      .orElseGet(() -> {
        User newUser = new User();
        newUser.setEmail(email);
        newUser.setFullName(fullName);
        newUser.setProfilePicture(profilePicture);
        newUser.setGoogleId(googleUserId);
        return userRepository.save(newUser);
      });

    // Step 4: Generate YOUR app's JWT tokens
    String accessToken = jwtProvider.generateAccessToken(user.getId());
    String refreshToken = jwtProvider.generateRefreshToken(user.getId());

    // Step 5: Return app tokens (NOT Google's token!)
    return ResponseEntity.ok(new AuthResponse(
      accessToken,        // Your JWT
      refreshToken,       // Your JWT
      new UserProfile(user)
    ));

  } catch (Exception e) {
    return ResponseEntity.status(401).body("Verification failed: " + e);
  }
}
```

---

### **Step 6: Frontend Stores App Tokens**

```typescript
// Back in completeSocialSignIn()

// Backend responded with:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",  // Your JWT!
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 456, "email": "john@gmail.com", ... }
}

// persistTokens() stores these
await AsyncStorage.setItem('accessToken', accessToken);
axiosInstance.defaults.headers.Authorization = `Bearer ${accessToken}`;

// setUser() updates context
setUser(userProfile);

// ALL FUTURE REQUESTS NOW HAVE JWT! 🎉
```

---

## 🔄 Request Flow Diagram: Complete Lifecycle

```
┌─ APP STARTUP ─────────────────────────────┐
│                                           │
│  loadFromStorage()                        │
│  ├─ Get token from AsyncStorage          │
│  ├─ Set Axios default header             │
│  └─ Fetch user profile (if token exists) │
│                                           │
└─────────────┬─────────────────────────────┘
              │
              ├─ Token exists → Restore user session
              └─ No token → Show SignIn screen
                          │
        ┌───────────────────┘
        │
        ├─ USER TAPS "SIGN UP" ─────┐
        │                           │
        │   Enter: email, password  │
        │   ↓                       │
        │   authApi.register()     │
        │   ├─ No Authorization header (first time!)
        │   ├─ Backend creates user
        │   └─ Backend returns tokens
        │       │                   │
        │       └─ persistTokens()  │
        │           └─ Now token in AsyncStorage + Axios header
        │               │
        │               ├─ All FUTURE requests include JWT ✅
        │               └─ userApi.getProfile() succeeds
        │                                       │
        └─────────────────────────────────────────┘
                          │
        ┌─────────────────┘
        │
        ├─ NEXT REQUEST (e.g., getProfile) ─────┐
        │                                       │
        │   Request Interceptor:               │
        │   ├─ Fetches token from AsyncStorage │
        │   ├─ Adds "Authorization: Bearer..." │
        │   ├─ Sends request with token        │
        │   │                                  │
        │   Backend:                           │
        │   ├─ Validates token signature       │
        │   ├─ Checks expiration               │
        │   ├─ Grants access if valid ✅       │
        │   └─ Returns data                    │
        │       │                              │
        │       └─ Response shows new data ✅  │
        │                                       │
        └───────────────────────────────────────┘
```

---

## 🎓 Key Takeaways

1. **Axios Interceptor = Auto JWT Magic**
   - Every request automatically includes JWT
   - You don't manually add headers anywhere!

2. **Three Auth Methods (Same Flow, Different Entry Points)**
   - Email/Password: Direct credentials
   - Google: Google validates, sends idToken
   - Apple: Apple validates, sends identityToken

3. **Backend's Job: Validate & Issue Tokens**
   - Email/Password: Hash and compare password
   - Google: Verify Google's signature
   - Apple: Verify Apple's signature
   - All return app JWT tokens

4. **Token Lifecycle:**
   - First auth request → Get JWT
   - Store in AsyncStorage
   - Add to Axios headers
   - Every future request has it
   - App restart → Restore from AsyncStorage

5. **Why Separate Layers?**
   - endpoints.ts: Change URLs in one place
   - authApi/userApi: Easy to test, document, reuse
   - axios.ts: JWT management isolated
   - AuthContext: State management in context
   - Screens: Don't know about HTTP details

This architecture is **production-grade** and scales to multiple APIs easily!
