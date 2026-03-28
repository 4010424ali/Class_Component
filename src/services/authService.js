/**
 * Authentication Service
 *
 * Handles:
 *  - Login / logout
 *  - Access token storage (memory-only for XSS safety)
 *  - Refresh token storage (httpOnly cookie via Set-Cookie header; simulated
 *    here as a secure in-memory fallback until a real backend is wired up)
 *  - Silent token refresh (proactive + reactive)
 *  - Rate limiting via rateLimiter utilities
 *
 * SECURITY NOTES
 * ──────────────
 * • Access tokens are stored ONLY in module-level memory (never localStorage).
 *   This prevents XSS-based token theft from persistent storage.
 * • Refresh tokens should be stored in httpOnly, Secure, SameSite=Strict
 *   cookies set by the server.  The in-memory fallback here is for demo
 *   purposes; replace with real cookie handling in production.
 * • All auth endpoints must be served over HTTPS.
 * • CSRF protection (double-submit cookie or custom header) must be added
 *   server-side when cookie-based refresh tokens are used.
 */

import { loginLimiter, refreshLimiter } from '../utils/rateLimiter';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_TTL_MS  = 15 * 60 * 1000;       // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_THRESHOLD_MS = 2 * 60 * 1000;         // Refresh 2 min before expiry

// Simulated API base – replace with real endpoint
const API_BASE = process.env.REACT_APP_API_BASE || 'https://api.example.com';

// ---------------------------------------------------------------------------
// In-memory token store (never written to localStorage/sessionStorage)
// ---------------------------------------------------------------------------

let _accessToken       = null;  // { value: string, expiresAt: number }
let _refreshTokenStore = null;  // { value: string, expiresAt: number }
let _refreshTimer      = null;  // NodeJS.Timeout handle

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload without verifying the signature.
 * Signature verification MUST happen server-side.
 * @param {string} token
 * @returns {object|null}
 */
export function decodeTokenPayload(token) {
  try {
    const [, payloadB64] = token.split('.');
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(tokenObj) {
  if (!tokenObj) return true;
  return Date.now() >= tokenObj.expiresAt;
}

function scheduleTokenRefresh(expiresAt) {
  if (_refreshTimer) clearTimeout(_refreshTimer);

  const delay = expiresAt - Date.now() - REFRESH_THRESHOLD_MS;
  if (delay <= 0) {
    // Already near-expired – refresh immediately
    silentRefresh().catch(console.error);
    return;
  }

  _refreshTimer = setTimeout(() => {
    silentRefresh().catch(err => {
      console.warn('[AuthService] Proactive token refresh failed:', err.message);
    });
  }, delay);
}

// ---------------------------------------------------------------------------
// Core auth operations
// ---------------------------------------------------------------------------

/**
 * Authenticate with email + password.
 *
 * Rate-limited per unique identifier (email address).
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, accessToken: string }>}
 * @throws {Error} on invalid credentials, rate-limiting, or network failure
 */
export async function login(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const rateLimitKey = `login:${email.toLowerCase().trim()}`;

  if (!loginLimiter.allow(rateLimitKey)) {
    const remaining = loginLimiter.lockoutRemainingText(rateLimitKey);
    throw new Error(
      `Too many failed login attempts. Please try again in ${remaining}.`
    );
  }

  // --- Real API call (replace the simulation below) ---
  const response = await _post(`${API_BASE}/auth/login`, { email, password });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Invalid credentials.');
  }

  const data = await response.json();

  // On success reset the rate limiter for this identifier
  loginLimiter.reset(rateLimitKey);

  _storeTokens(data.accessToken, data.refreshToken);

  return { user: data.user, accessToken: data.accessToken };
}

/**
 * Exchange a refresh token for a new access token.
 *
 * Called automatically by `getAccessToken()` when the current access token
 * is expired, and proactively before expiry via `scheduleTokenRefresh()`.
 *
 * @returns {Promise<string>} New access token value
 * @throws {Error} if refresh fails (session ended – user must re-login)
 */
export async function silentRefresh() {
  const refreshKey = 'token-refresh';

  if (!refreshLimiter.allow(refreshKey)) {
    throw new Error('Refresh rate limit exceeded. Please log in again.');
  }

  const stored = _getStoredRefreshToken();
  if (!stored || isTokenExpired(stored)) {
    _clearTokens();
    throw new Error('Refresh token expired. Please log in again.');
  }

  const response = await _post(`${API_BASE}/auth/refresh`, {
    refreshToken: stored.value,
  });

  if (!response.ok) {
    _clearTokens();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();
  _storeTokens(data.accessToken, data.refreshToken || stored.value);

  return data.accessToken;
}

/**
 * Return a valid access token, refreshing silently if needed.
 * Components should call this instead of reading the token directly.
 *
 * @returns {Promise<string|null>} Valid access token, or null if not authenticated
 */
export async function getAccessToken() {
  if (_accessToken && !isTokenExpired(_accessToken)) {
    return _accessToken.value;
  }

  if (_getStoredRefreshToken()) {
    try {
      return await silentRefresh();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Log the user out, clear all tokens, and optionally notify the server.
 *
 * @param {object} [options]
 * @param {boolean} [options.notifyServer=true] - Whether to call the logout endpoint
 * @returns {Promise<void>}
 */
export async function logout({ notifyServer = true } = {}) {
  const token = _accessToken?.value;
  _clearTokens();

  if (notifyServer && token) {
    await _post(`${API_BASE}/auth/logout`, {}, token).catch(() => {
      // Logout is best-effort – local tokens already cleared
    });
  }
}

/**
 * Check whether a valid session currently exists (access token present and
 * not expired, OR a refresh token available to obtain a new access token).
 *
 * @returns {boolean}
 */
export function isAuthenticated() {
  if (_accessToken && !isTokenExpired(_accessToken)) return true;
  const stored = _getStoredRefreshToken();
  return !!(stored && !isTokenExpired(stored));
}

/**
 * Return the decoded user claims from the current access token.
 * @returns {object|null}
 */
export function getCurrentUser() {
  if (!_accessToken) return null;
  return decodeTokenPayload(_accessToken.value);
}

// ---------------------------------------------------------------------------
// Token storage helpers (internal)
// ---------------------------------------------------------------------------

function _storeTokens(accessToken, refreshToken) {
  const accessPayload = decodeTokenPayload(accessToken);
  const accessExpiry  = accessPayload?.exp
    ? accessPayload.exp * 1000
    : Date.now() + ACCESS_TOKEN_TTL_MS;

  _accessToken = { value: accessToken, expiresAt: accessExpiry };

  if (refreshToken) {
    const refreshExpiry = Date.now() + REFRESH_TOKEN_TTL_MS;
    // In production: the server sets an httpOnly cookie.
    // Here we store in memory as a fallback for the demo.
    _refreshTokenStore = { value: refreshToken, expiresAt: refreshExpiry };
  }

  scheduleTokenRefresh(accessExpiry);
}

function _getStoredRefreshToken() {
  // Production: read from httpOnly cookie (handled transparently by the browser).
  // Demo fallback: read from memory.
  return _refreshTokenStore;
}

function _clearTokens() {
  _accessToken       = null;
  _refreshTokenStore = null;
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
}

// ---------------------------------------------------------------------------
// HTTP helper (thin wrapper – replace with axios/fetch interceptor in prod)
// ---------------------------------------------------------------------------

async function _post(url, body, bearerToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

  return fetch(url, {
    method:      'POST',
    headers,
    credentials: 'include', // sends httpOnly cookies automatically
    body:        JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const authService = {
  login,
  logout,
  silentRefresh,
  getAccessToken,
  isAuthenticated,
  getCurrentUser,
  decodeTokenPayload,
};

export default authService;
