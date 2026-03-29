/**
 * Auth Service — wired to the real Express + MongoDB backend.
 *
 * Endpoints consumed:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/refresh   (refresh token sent automatically via httpOnly cookie)
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 */

import { loginLimiter, refreshLimiter } from '../utils/rateLimiter';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// With package.json "proxy": "http://localhost:5000" this resolves correctly
// in development.  In production set REACT_APP_API_BASE to the real API URL.
const API_BASE = process.env.REACT_APP_API_BASE || '';

const ACCESS_TOKEN_TTL_MS  = 15 * 60 * 1000;      // 15 min (matches server)
const REFRESH_THRESHOLD_MS = 2  * 60 * 1000;       // Refresh 2 min before expiry

// ---------------------------------------------------------------------------
// In-memory access token (never persisted to storage)
// ---------------------------------------------------------------------------

let _accessToken  = null;  // { value: string, expiresAt: number }
let _refreshTimer = null;

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

export function decodeTokenPayload(token) {
  try {
    const [, b64] = token.split('.');
    return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function tokenExpired(tokenObj) {
  return !tokenObj || Date.now() >= tokenObj.expiresAt;
}

function scheduleRefresh(expiresAt) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const delay = expiresAt - Date.now() - REFRESH_THRESHOLD_MS;
  if (delay <= 0) { silentRefresh().catch(() => {}); return; }
  _refreshTimer = setTimeout(() => silentRefresh().catch(() => {}), delay);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function request(method, path, body = null, bearerToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',         // send/receive httpOnly refresh cookie
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

function storeAccessToken(token) {
  const payload   = decodeTokenPayload(token);
  const expiresAt = payload?.exp
    ? payload.exp * 1000
    : Date.now() + ACCESS_TOKEN_TTL_MS;

  _accessToken = { value: token, expiresAt };
  scheduleRefresh(expiresAt);
}

function clearAccessToken() {
  _accessToken = null;
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a new account.
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ user: object }>}
 */
export async function register({ name, email, password }) {
  const res = await request('POST', '/api/auth/register', { name, email, password });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Registration failed.');
  return data;
}

/**
 * Login — rate-limited client-side (server also enforces independently).
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, accessToken: string }>}
 */
export async function login(email, password) {
  if (!email || !password) throw new Error('Email and password are required.');

  const key = `login:${email.toLowerCase().trim()}`;
  if (!loginLimiter.allow(key)) {
    const t = loginLimiter.lockoutRemainingText(key);
    throw new Error(`Too many failed attempts. Try again in ${t}.`);
  }

  const res  = await request('POST', '/api/auth/login', { email, password });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error?.message || 'Invalid credentials.');

  loginLimiter.reset(key);
  storeAccessToken(data.accessToken);
  return { user: data.user, accessToken: data.accessToken };
}

/**
 * Silently exchange the httpOnly refresh token cookie for a new access token.
 * @returns {Promise<string>} new access token
 */
export async function silentRefresh() {
  if (!refreshLimiter.allow('refresh')) {
    throw new Error('Refresh rate limit exceeded. Please log in again.');
  }

  const res  = await request('POST', '/api/auth/refresh');
  const data = await res.json();

  if (!res.ok) {
    clearAccessToken();
    throw new Error(data.error?.message || 'Session expired. Please log in again.');
  }

  storeAccessToken(data.accessToken);
  return data.accessToken;
}

/**
 * Return a valid access token, refreshing silently if needed.
 * @returns {Promise<string|null>}
 */
export async function getAccessToken() {
  if (_accessToken && !tokenExpired(_accessToken)) return _accessToken.value;
  try { return await silentRefresh(); } catch { return null; }
}

/**
 * Fetch the current user's profile from the server.
 * @returns {Promise<object>}
 */
export async function fetchCurrentUser() {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated.');
  const res  = await request('GET', '/api/auth/me', null, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch user.');
  return data.user;
}

/**
 * Logout — revokes session on server, clears local access token.
 * @param {{ notifyServer?: boolean }} [options]
 */
export async function logout({ notifyServer = true } = {}) {
  if (notifyServer && _accessToken) {
    await request('POST', '/api/auth/logout', null, _accessToken.value).catch(() => {});
  }
  clearAccessToken();
}

/**
 * Synchronous check for a non-expired access token in memory.
 * Does NOT check the refresh token — call getAccessToken() for that.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!(_accessToken && !tokenExpired(_accessToken));
}

/**
 * Decoded claims from the current in-memory access token.
 * For UI display only — never use for authorization decisions.
 * @returns {object|null}
 */
export function getCurrentUser() {
  return _accessToken ? decodeTokenPayload(_accessToken.value) : null;
}

const authService = {
  register, login, logout,
  silentRefresh, getAccessToken,
  fetchCurrentUser, isAuthenticated, getCurrentUser,
};

export default authService;
