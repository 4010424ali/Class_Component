const rateLimit = require('express-rate-limit');

/**
 * Standard JSON error response for rate-limited requests.
 */
function rateLimitHandler(req, res) {
  res.status(429).json({
    error: {
      code:    'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    },
  });
}

/**
 * Login rate limiter
 * 5 attempts per 15 minutes per IP.
 * After limit: 30-minute window reset.
 */
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              5,
  standardHeaders:  true,            // Return rate limit info in `RateLimit-*` headers
  legacyHeaders:    false,
  handler:          rateLimitHandler,
  skipSuccessfulRequests: true,      // Only count failed requests against the limit
  keyGenerator: (req) => {
    // Rate-limit per IP; on production combine with account identifier
    return req.ip;
  },
});

/**
 * Token refresh rate limiter
 * 10 refreshes per 5 minutes per IP.
 */
const refreshLimiter = rateLimit({
  windowMs:        5 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP.
 */
const generalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

/**
 * Strict rate limiter for sensitive endpoints (password reset, etc.)
 * 3 requests per hour per IP.
 */
const strictLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             3,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

module.exports = { loginLimiter, refreshLimiter, generalLimiter, strictLimiter };
