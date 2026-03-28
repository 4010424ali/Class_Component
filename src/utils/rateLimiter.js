/**
 * Client-side Rate Limiter
 *
 * Implements a sliding-window rate limiter stored in memory (and optionally
 * persisted to sessionStorage so limits survive soft navigations).
 *
 * Usage:
 *   const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });
 *   if (!limiter.allow('login:user@example.com')) {
 *     throw new Error('Too many attempts – try again later');
 *   }
 */

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const DEFAULT_LOCKOUT_MS   = 30 * 60 * 1000; // 30-minute lockout after max attempts

export class RateLimiter {
  /**
   * @param {object} options
   * @param {number} options.maxAttempts  - Max requests allowed in window (default 5)
   * @param {number} options.windowMs     - Sliding window duration in ms (default 15 min)
   * @param {number} options.lockoutMs    - Hard lockout after maxAttempts exceeded (default 30 min)
   * @param {boolean} options.persist     - Persist attempt records to sessionStorage (default true)
   */
  constructor({
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    windowMs    = DEFAULT_WINDOW_MS,
    lockoutMs   = DEFAULT_LOCKOUT_MS,
    persist     = true,
  } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs    = windowMs;
    this.lockoutMs   = lockoutMs;
    this.persist     = persist;

    // In-memory store: key -> { attempts: number[], lockedUntil: number|null }
    this._store = {};
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Record an attempt for `key` and return whether the request is allowed.
   * @param {string} key - Unique identifier (e.g. "login:user@example.com")
   * @returns {boolean} true if allowed, false if rate-limited
   */
  allow(key) {
    const record = this._getRecord(key);
    const now    = Date.now();

    // Check hard lockout
    if (record.lockedUntil !== null && now < record.lockedUntil) {
      return false;
    }

    // Reset expired lockout
    if (record.lockedUntil !== null && now >= record.lockedUntil) {
      record.attempts    = [];
      record.lockedUntil = null;
    }

    // Purge attempts outside the sliding window
    record.attempts = record.attempts.filter(ts => now - ts < this.windowMs);

    if (record.attempts.length >= this.maxAttempts) {
      // Trigger hard lockout
      record.lockedUntil = now + this.lockoutMs;
      this._saveRecord(key, record);
      return false;
    }

    record.attempts.push(now);
    this._saveRecord(key, record);
    return true;
  }

  /**
   * Returns remaining allowed attempts for `key` in the current window.
   * @param {string} key
   * @returns {number}
   */
  remainingAttempts(key) {
    const record = this._getRecord(key);
    const now    = Date.now();

    if (record.lockedUntil !== null && now < record.lockedUntil) {
      return 0;
    }

    const recentAttempts = record.attempts.filter(ts => now - ts < this.windowMs);
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  /**
   * Returns the timestamp (ms) when the lock expires, or null if not locked.
   * @param {string} key
   * @returns {number|null}
   */
  lockoutExpiresAt(key) {
    const record = this._getRecord(key);
    const now    = Date.now();

    if (record.lockedUntil !== null && now < record.lockedUntil) {
      return record.lockedUntil;
    }
    return null;
  }

  /**
   * Returns a human-readable string describing how long until the lockout ends.
   * @param {string} key
   * @returns {string|null}
   */
  lockoutRemainingText(key) {
    const expiresAt = this.lockoutExpiresAt(key);
    if (expiresAt === null) return null;

    const remainingMs = expiresAt - Date.now();
    const minutes     = Math.ceil(remainingMs / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  /**
   * Manually reset all attempt records for `key` (e.g. on successful login).
   * @param {string} key
   */
  reset(key) {
    delete this._store[key];
    if (this.persist) {
      try {
        sessionStorage.removeItem(this._storageKey(key));
      } catch (_) { /* storage unavailable */ }
    }
  }

  /**
   * Clear all rate-limit records managed by this limiter.
   */
  clearAll() {
    this._store = {};
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _storageKey(key) {
    return `rl_${key}`;
  }

  _getRecord(key) {
    // Try in-memory first
    if (this._store[key]) return this._store[key];

    // Try sessionStorage
    if (this.persist) {
      try {
        const raw = sessionStorage.getItem(this._storageKey(key));
        if (raw) {
          const parsed = JSON.parse(raw);
          this._store[key] = parsed;
          return parsed;
        }
      } catch (_) { /* storage unavailable or corrupted */ }
    }

    // Bootstrap a fresh record
    const fresh = { attempts: [], lockedUntil: null };
    this._store[key] = fresh;
    return fresh;
  }

  _saveRecord(key, record) {
    this._store[key] = record;
    if (this.persist) {
      try {
        sessionStorage.setItem(this._storageKey(key), JSON.stringify(record));
      } catch (_) { /* storage full or unavailable */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-configured singleton instances for common use-cases
// ---------------------------------------------------------------------------

/** Login attempts: 5 tries per 15 minutes, 30-minute lockout */
export const loginLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs:    15 * 60 * 1000,
  lockoutMs:   30 * 60 * 1000,
});

/** Token refresh: 10 refreshes per 5 minutes (prevents refresh-flooding) */
export const refreshLimiter = new RateLimiter({
  maxAttempts: 10,
  windowMs:    5 * 60 * 1000,
  lockoutMs:   10 * 60 * 1000,
  persist:     false, // keep in memory only
});

/** Password-reset: 3 requests per hour */
export const passwordResetLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs:    60 * 60 * 1000,
  lockoutMs:   60 * 60 * 1000,
});

export default RateLimiter;
