/**
 * Client-side Rate Limiter (UX feedback only)
 *
 * Mirrors server-side limits so the UI can warn users before a request
 * is even sent.  This does NOT replace server-side enforcement.
 */

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS    = 15 * 60 * 1000;
const DEFAULT_LOCKOUT_MS   = 30 * 60 * 1000;

export class RateLimiter {
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
    this._store      = {};
  }

  allow(key) {
    const record = this._getRecord(key);
    const now    = Date.now();

    if (record.lockedUntil !== null && now < record.lockedUntil) return false;
    if (record.lockedUntil !== null && now >= record.lockedUntil) {
      record.attempts    = [];
      record.lockedUntil = null;
    }

    record.attempts = record.attempts.filter(ts => now - ts < this.windowMs);

    if (record.attempts.length >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutMs;
      this._saveRecord(key, record);
      return false;
    }

    record.attempts.push(now);
    this._saveRecord(key, record);
    return true;
  }

  remainingAttempts(key) {
    const record = this._getRecord(key);
    const now    = Date.now();
    if (record.lockedUntil !== null && now < record.lockedUntil) return 0;
    const recent = record.attempts.filter(ts => now - ts < this.windowMs);
    return Math.max(0, this.maxAttempts - recent.length);
  }

  lockoutExpiresAt(key) {
    const record = this._getRecord(key);
    const now    = Date.now();
    return record.lockedUntil !== null && now < record.lockedUntil
      ? record.lockedUntil
      : null;
  }

  lockoutRemainingText(key) {
    const expiresAt = this.lockoutExpiresAt(key);
    if (expiresAt === null) return null;
    const minutes = Math.ceil((expiresAt - Date.now()) / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  reset(key) {
    delete this._store[key];
    if (this.persist) {
      try { sessionStorage.removeItem(`rl_${key}`); } catch (_) {}
    }
  }

  _getRecord(key) {
    if (this._store[key]) return this._store[key];
    if (this.persist) {
      try {
        const raw = sessionStorage.getItem(`rl_${key}`);
        if (raw) { this._store[key] = JSON.parse(raw); return this._store[key]; }
      } catch (_) {}
    }
    const fresh = { attempts: [], lockedUntil: null };
    this._store[key] = fresh;
    return fresh;
  }

  _saveRecord(key, record) {
    this._store[key] = record;
    if (this.persist) {
      try { sessionStorage.setItem(`rl_${key}`, JSON.stringify(record)); } catch (_) {}
    }
  }
}

export const loginLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs:    15 * 60 * 1000,
  lockoutMs:   30 * 60 * 1000,
});

export const refreshLimiter = new RateLimiter({
  maxAttempts: 10,
  windowMs:    5 * 60 * 1000,
  lockoutMs:   10 * 60 * 1000,
  persist:     false,
});

export default RateLimiter;
