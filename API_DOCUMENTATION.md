# Authentication API Documentation

**Version:** 1.0.0
**Base URL:** `https://api.example.com`
**Protocol:** HTTPS only
**Content-Type:** `application/json`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Rate Limiting](#rate-limiting)
4. [Endpoints](#endpoints)
   - [POST /auth/login](#post-authlogin)
   - [POST /auth/refresh](#post-authrefresh)
   - [POST /auth/logout](#post-authlogout)
5. [Token Reference](#token-reference)
6. [Error Codes](#error-codes)
7. [Client SDK Reference](#client-sdk-reference)
8. [Component Reference](#component-reference)

---

## Overview

The auth system uses a **short-lived access token + long-lived refresh token** pattern.

| Token | Storage | TTL | Purpose |
|-------|---------|-----|---------|
| Access token (JWT) | JavaScript memory | 15 minutes | Authorise API requests |
| Refresh token | httpOnly cookie | 7 days | Obtain new access tokens without re-login |

The client SDK (`authService.js`) handles token storage, silent refresh scheduling, and retry logic automatically. Consumers should call `getAccessToken()` rather than managing tokens directly.

---

## Authentication Flow

```
Browser                          Server
  │                                │
  │── POST /auth/login ───────────►│
  │   { email, password }          │
  │                                │── Validate credentials
  │                                │── Check server-side rate limit
  │◄─ 200 OK ──────────────────────│
  │   { accessToken, user }        │── Set-Cookie: refreshToken (httpOnly)
  │                                │
  │   [access token expires]       │
  │                                │
  │── POST /auth/refresh ─────────►│  (cookie sent automatically)
  │                                │── Validate refresh token
  │◄─ 200 OK ──────────────────────│
  │   { accessToken }              │── Set-Cookie: refreshToken (rotated)
  │                                │
  │── POST /auth/logout ──────────►│
  │   Authorization: Bearer <tok>  │
  │                                │── Revoke refresh token
  │◄─ 204 No Content ──────────────│── Clear-Cookie: refreshToken
```

---

## Rate Limiting

### Server-Side (Authoritative)

All endpoints enforce server-side rate limits. Exceeding them returns `429 Too Many Requests`.

| Endpoint | Limit | Window | Lockout |
|----------|-------|--------|---------|
| `POST /auth/login` | 5 attempts | 15 minutes (per account) | 30 minutes |
| `POST /auth/login` | 20 attempts | 15 minutes (per IP) | 30 minutes |
| `POST /auth/refresh` | 10 requests | 5 minutes (per user) | 10 minutes |
| `POST /auth/logout` | 20 requests | 1 minute | — |

### Client-Side (UX Feedback Only)

The `RateLimiter` class in `src/utils/rateLimiter.js` mirrors these limits locally to provide immediate feedback before a network request is made. **This is not a security control** — server-side limits are authoritative.

`429` responses include a `Retry-After` header with the number of seconds to wait.

---

## Endpoints

### POST /auth/login

Authenticate a user and receive an access token.

**URL:** `POST /auth/login`
**Auth required:** No

#### Request Body

```json
{
  "email":    "user@example.com",
  "password": "s3cur3P@ssw0rd"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address (case-insensitive) |
| `password` | string | Yes | User's password (min 8 characters) |

#### Success Response — 200 OK

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id":    "usr_01HV2X...",
    "email": "user@example.com",
    "name":  "Jane Doe",
    "roles": ["user"]
  }
}
```

The server also sets:
```
Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800
```

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | string | Signed JWT, valid 15 minutes |
| `user.id` | string | Opaque user identifier |
| `user.email` | string | Verified email address |
| `user.name` | string | Display name |
| `user.roles` | string[] | Assigned roles (authorised server-side) |

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| `400` | `VALIDATION_ERROR` | Missing or malformed fields |
| `401` | `INVALID_CREDENTIALS` | Email/password combination incorrect |
| `429` | `RATE_LIMITED` | Too many login attempts |
| `500` | `INTERNAL_ERROR` | Server error |

---

### POST /auth/refresh

Exchange a valid refresh token (from cookie) for a new access token.

**URL:** `POST /auth/refresh`
**Auth required:** Refresh token cookie (sent automatically by browser)

#### Request

No body required. The browser sends the httpOnly `refreshToken` cookie automatically when `credentials: 'include'` is set on the fetch call.

#### Success Response — 200 OK

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

The server issues a **rotated** refresh token:
```
Set-Cookie: refreshToken=<new_token>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800
```

Token rotation means the old refresh token is invalidated immediately. If reuse of an invalidated token is detected, the entire token family is revoked (all refresh tokens for that user).

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| `401` | `REFRESH_TOKEN_MISSING` | No refresh token cookie present |
| `401` | `REFRESH_TOKEN_EXPIRED` | Refresh token has expired |
| `401` | `REFRESH_TOKEN_REVOKED` | Token was revoked (logout or reuse detected) |
| `429` | `RATE_LIMITED` | Refresh rate limit exceeded |

---

### POST /auth/logout

Revoke the current refresh token and clear the session cookie.

**URL:** `POST /auth/logout`
**Auth required:** `Authorization: Bearer <accessToken>`

#### Request Headers

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response — 204 No Content

Empty body. Server clears the refresh token cookie:
```
Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=0
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| `401` | `TOKEN_MISSING` | No Authorization header |
| `401` | `TOKEN_INVALID` | Malformed or expired access token |

---

## Token Reference

### Access Token (JWT)

**Algorithm:** RS256 (asymmetric — server signs with private key, clients verify with public key)
**Lifetime:** 15 minutes

#### Payload Claims

```json
{
  "iss": "https://api.example.com",
  "sub": "usr_01HV2X...",
  "aud": "https://app.example.com",
  "iat": 1711670400,
  "exp": 1711671300,
  "email": "user@example.com",
  "roles": ["user"],
  "jti": "tok_01HV2X..."
}
```

| Claim | Type | Description |
|-------|------|-------------|
| `iss` | string | Token issuer (server URL) |
| `sub` | string | Subject — opaque user ID |
| `aud` | string | Intended audience |
| `iat` | number | Issued-at timestamp (Unix epoch) |
| `exp` | number | Expiry timestamp (Unix epoch) |
| `email` | string | User's email address |
| `roles` | string[] | Assigned roles |
| `jti` | string | Unique token ID (for revocation) |

### Refresh Token

- Opaque random string (256-bit, base64url encoded)
- Stored server-side with `userId`, `family`, `issuedAt`, `expiresAt`
- Rotated on every use
- Token family: if a revoked token in a family is presented, all tokens in the family are revoked

---

## Error Codes

All error responses use the following shape:

```json
{
  "error": {
    "code":    "INVALID_CREDENTIALS",
    "message": "Invalid email or password.",
    "traceId": "req_01HV2X..."
  }
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_MISSING` | 401 | Authorization header absent |
| `TOKEN_INVALID` | 401 | JWT malformed, expired, or wrong signature |
| `REFRESH_TOKEN_MISSING` | 401 | Refresh cookie not present |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token past expiry |
| `REFRESH_TOKEN_REVOKED` | 401 | Token was explicitly revoked |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Client SDK Reference

All functions are exported from `src/services/authService.js`.

---

### `login(email, password)`

Authenticate and store tokens.

```js
import authService from './services/authService';

const { user, accessToken } = await authService.login('user@example.com', 'password123');
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `email` | string | User's email |
| `password` | string | User's password |

**Returns:** `Promise<{ user: object, accessToken: string }>`

**Throws:**
- `"Email and password are required."` — missing fields
- `"Too many failed login attempts. Please try again in X minutes."` — rate limited
- `"Invalid credentials."` — wrong credentials (server response)

---

### `logout(options?)`

Clear tokens and optionally notify the server.

```js
await authService.logout();                    // default: notifies server
await authService.logout({ notifyServer: false }); // silent local clear
```

**Options**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `notifyServer` | boolean | `true` | Call `POST /auth/logout` |

**Returns:** `Promise<void>`

---

### `getAccessToken()`

Return a valid access token, refreshing silently if needed.

```js
const token = await authService.getAccessToken();
if (token) {
  fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
}
```

**Returns:** `Promise<string|null>` — token string, or `null` if unauthenticated

---

### `silentRefresh()`

Explicitly request a new access token via the refresh token.

```js
const newToken = await authService.silentRefresh();
```

**Returns:** `Promise<string>` — new access token

**Throws:** `"Session expired. Please log in again."` on failure

---

### `isAuthenticated()`

Synchronous check whether a valid session exists.

```js
if (authService.isAuthenticated()) {
  // Render protected UI
}
```

**Returns:** `boolean`

---

### `getCurrentUser()`

Return decoded claims from the current access token (for UI display only — do not use for authorization).

```js
const user = authService.getCurrentUser();
console.log(user.email, user.roles);
```

**Returns:** `object|null`

---

## Component Reference

### `<AuthProvider>`

Wrap the application root to provide auth state to all children.

```jsx
import { AuthProvider } from './context/AuthContext';

ReactDOM.render(
  <AuthProvider>
    <TokenRefreshHandler />
    <App />
  </AuthProvider>,
  document.getElementById('root')
);
```

---

### `withAuth(Component)`

Higher-order component that injects an `auth` prop.

```jsx
import { withAuth } from './context/AuthContext';

class MyComponent extends Component {
  render() {
    const { user, isAuthenticated, login, logout } = this.props.auth;
    // ...
  }
}

export default withAuth(MyComponent);
```

**Injected `auth` prop shape:**

| Field | Type | Description |
|-------|------|-------------|
| `user` | object\|null | Decoded user claims from current access token |
| `accessToken` | string\|null | Current access token value |
| `isAuthenticated` | boolean | Whether a valid session exists |
| `isLoading` | boolean | True during initial session restore or auth operations |
| `error` | string\|null | Last authentication error message |
| `login(email, password)` | function | Returns `{ success, error? }` |
| `logout()` | function | Clears session |
| `refreshToken()` | function | Returns new token or null |
| `clearError()` | function | Clears `error` field |

---

### `<LoginForm>`

Renders a login form wired to `AuthContext`. Rate-limit warnings are displayed automatically.

```jsx
import LoginForm from './components/auth/LoginForm';

<LoginForm onSuccess={() => history.push('/dashboard')} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onSuccess` | function | No | Called after successful login |

---

### `<ProtectedRoute>`

Guards a component from unauthenticated access.

```jsx
import ProtectedRoute from './components/auth/ProtectedRoute';

// Without React Router:
<ProtectedRoute component={Dashboard} fallback={<LoginForm />} />

// With React Router v4/v5:
<Route path="/dashboard" render={props => (
  <ProtectedRoute component={Dashboard} routerProps={props} />
)} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `component` | ComponentClass | Yes | Component to render when authenticated |
| `fallback` | ReactNode | No | Rendered when not authenticated (defaults to null) |
| `loadingIndicator` | ReactNode | No | Rendered during session restore |
| `routerProps` | object | No | React Router route props (passed to rendered component) |

---

### `<TokenRefreshHandler>`

Invisible component that patches `window.fetch` to automatically retry `401` responses after a silent token refresh.

```jsx
// Mount once, inside <AuthProvider>, before <App>
<AuthProvider>
  <TokenRefreshHandler />
  <App />
</AuthProvider>
```

No props.
