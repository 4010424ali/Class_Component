# Security Vulnerability Analysis

**Project:** Class Component Auth System
**Date:** 2026-03-28
**Scope:** `src/services/authService.js`, `src/utils/rateLimiter.js`,
`src/context/AuthContext.js`, `src/components/auth/`

---

## Executive Summary

The authentication implementation follows several security best practices (memory-only access tokens, httpOnly cookie design for refresh tokens, proactive token rotation, and client-side rate limiting). However, because this is a **client-side React application**, the most critical controls must be implemented server-side. The table below lists every identified vulnerability, its severity, and the recommended mitigation.

---

## Severity Legend

| Label | Meaning |
|-------|---------|
| **CRITICAL** | Exploitable with no preconditions; immediate remediation required |
| **HIGH** | Likely exploitable; remediate before production |
| **MEDIUM** | Requires specific conditions; remediate before production |
| **LOW** | Defence-in-depth; remediate when practical |
| **INFO** | Not a vulnerability; noted for awareness |

---

## Vulnerability Table

### V-01 — Client-Side Rate Limiting Only
**Severity:** HIGH
**File:** `src/utils/rateLimiter.js`

**Description:**
The rate limiter runs entirely in the browser. An attacker can bypass it by:
- Clearing `sessionStorage` and refreshing the page.
- Sending requests directly with `curl` or Postman, bypassing the browser entirely.
- Using private/incognito mode.

**Impact:** Brute-force attacks against the `/auth/login` endpoint remain possible.

**Mitigation:**
- Implement server-side rate limiting (e.g., express-rate-limit, nginx `limit_req`, or a WAF rule).
- Use IP-based AND account-based server-side counters.
- Client-side limiting should be used only as UX feedback, never as the sole security control.

---

### V-02 — Refresh Token Stored in Memory (Demo Fallback)
**Severity:** HIGH
**File:** `src/services/authService.js` (line `_refreshTokenStore`)

**Description:**
The in-memory refresh token fallback (`_refreshTokenStore`) is readable by any JavaScript running in the same page context, including injected XSS payloads.

**Impact:** A successful XSS attack can steal the refresh token and impersonate the user indefinitely until the token expires (7 days).

**Mitigation:**
- Store refresh tokens **exclusively** in `httpOnly`, `Secure`, `SameSite=Strict` cookies set by the server.
- Remove the `_refreshTokenStore` in-memory fallback in production.
- The `credentials: 'include'` flag is already set on fetch calls, so browser will automatically send the httpOnly cookie.

---

### V-03 — JWT Signature Not Verified Client-Side
**Severity:** MEDIUM
**File:** `src/services/authService.js` (`decodeTokenPayload`)

**Description:**
`decodeTokenPayload` base64-decodes the payload without verifying the JWT signature. A modified token with a forged payload would appear valid.

**Impact:** If any auth decision is made client-side based on decoded claims (e.g., role checks), an attacker could craft a token with elevated roles.

**Mitigation:**
- Never make security-sensitive access-control decisions on the client.
- All authorization must be enforced server-side on every API request.
- Client-side claim reading is acceptable only for UI personalisation (e.g., showing username).

---

### V-04 — No CSRF Protection on Refresh Endpoint
**Severity:** HIGH
**File:** `src/services/authService.js` (`silentRefresh`)

**Description:**
If refresh tokens are stored in cookies (the production design), every state-changing request including `/auth/refresh` and `/auth/logout` is vulnerable to Cross-Site Request Forgery (CSRF) unless mitigations are in place.

**Impact:** An attacker can trick a logged-in user into refreshing tokens or logging out via a crafted page.

**Mitigation:**
- Use `SameSite=Strict` on the refresh-token cookie (already recommended above — this largely mitigates CSRF for modern browsers).
- Add a CSRF double-submit cookie or synchronizer token pattern on the server.
- Validate the `Origin` / `Referer` header server-side.

---

### V-05 — Fetch Interceptor Patches `window.fetch` Globally
**Severity:** MEDIUM
**File:** `src/components/auth/TokenRefreshHandler.js`

**Description:**
Replacing `window.fetch` with a custom function can interfere with third-party libraries, service workers, and browser extensions. If the interceptor throws, all network calls in the app will fail.

**Impact:** Application-wide network outage; potential for unintended request replaying.

**Mitigation:**
- Prefer an HTTP client library (axios) with a proper interceptor API.
- Wrap the interceptor body in a `try/catch` that falls back to the original response on error.
- Ensure `_removeInterceptor` is always called on unmount (currently implemented, but verify in error paths).

---

### V-06 — Sensitive Data Logged to Console
**Severity:** LOW
**File:** `src/services/authService.js` (line `console.error`, `console.warn`)

**Description:**
Console output is visible to anyone with DevTools access and may be captured by browser extensions or monitoring tools.

**Impact:** Token-related error messages or stack traces could reveal implementation details useful to an attacker.

**Mitigation:**
- Replace `console.error` / `console.warn` calls with a structured logger that is suppressed in production builds.
- Use environment guards: `if (process.env.NODE_ENV !== 'production') { ... }`.

---

### V-07 — No Token Binding or Device Fingerprinting
**Severity:** LOW

**Description:**
Stolen refresh tokens (e.g., via network interception on HTTP or via XSS) can be replayed from any device.

**Mitigation:**
- Bind refresh tokens to a device fingerprint or IP range (server-side).
- Implement refresh token rotation — issue a new refresh token on every use and invalidate the old one.
- Implement token family detection to revoke all tokens in a family when reuse is detected.

---

### V-08 — Missing Content Security Policy (CSP)
**Severity:** HIGH
**File:** `public/index.html`

**Description:**
No `Content-Security-Policy` header or meta tag is configured. Without CSP, XSS attacks can execute arbitrary JavaScript and steal in-memory tokens.

**Impact:** XSS is the primary threat to memory-stored tokens.

**Mitigation:**
Add a strict CSP via server headers:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  connect-src 'self' https://api.example.com;
  img-src 'self' data:;
  style-src 'self' 'unsafe-inline';
  object-src 'none';
  frame-ancestors 'none';
```

---

### V-09 — Verbose Error Messages Returned to Client
**Severity:** MEDIUM

**Description:**
`authService.login` propagates the raw `body.message` from the server response to the UI. If the server returns messages like "User not found" vs "Wrong password", attackers can enumerate valid accounts.

**Mitigation:**
- Normalise auth errors to a single message: *"Invalid email or password."*
- Never distinguish between "user not found" and "wrong password" in client-facing messages.

---

### V-10 — No Logout on Tab/Window Close
**Severity:** INFO
**File:** `src/services/authService.js`

**Description:**
In-memory tokens persist for the lifetime of the JavaScript runtime. If a user closes a tab without clicking logout, tokens remain valid until natural expiry.

**Mitigation:**
- For high-security apps, listen to `beforeunload` and call `logout({ notifyServer: false })`.
- This is a UX trade-off; session persistence between navigations is often desirable.

---

## OWASP Top 10 Mapping

| OWASP Category | Vulnerabilities |
|----------------|-----------------|
| A01 Broken Access Control | V-03, V-04 |
| A02 Cryptographic Failures | V-02, V-07 |
| A03 Injection (XSS) | V-08 |
| A04 Insecure Design | V-01 |
| A05 Security Misconfiguration | V-08, V-06 |
| A07 Identification & Auth Failures | V-01, V-02, V-09 |
| A09 Security Logging & Monitoring | V-06 |

---

## Recommended Action Plan

| Priority | Action |
|----------|--------|
| **P0 – Before any production deployment** | Implement server-side rate limiting (V-01) |
| **P0** | Replace in-memory refresh token with httpOnly cookie (V-02) |
| **P0** | Add CSRF protection to auth endpoints (V-04) |
| **P0** | Add Content Security Policy header (V-08) |
| **P1 – Before public launch** | Normalise error messages (V-09) |
| **P1** | Replace `window.fetch` patch with axios interceptors (V-05) |
| **P2 – Hardening** | Implement refresh token rotation (V-07) |
| **P2** | Suppress console output in production (V-06) |
| **P3 – Future** | Evaluate token binding / device fingerprinting (V-07) |
| **P3** | Add logout-on-tab-close for sensitive contexts (V-10) |
