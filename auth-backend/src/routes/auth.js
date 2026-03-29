const express    = require('express');
const { body }   = require('express-validator');
const controller = require('../controllers/authController');
const { verifyToken }     = require('../middleware/authMiddleware');
const { loginLimiter, refreshLimiter, strictLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── Validation rules ──────────────────────────────────────────────────────────

const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name must be at most 100 characters.'),
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character.'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email required.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Create a new user account.
 */
router.post('/register', strictLimiter, registerRules, controller.register);

/**
 * POST /api/auth/login
 * Authenticate and receive tokens.
 */
router.post('/login', loginLimiter, loginRules, controller.login);

/**
 * POST /api/auth/refresh
 * Exchange a refresh token (cookie) for a new access token.
 */
router.post('/refresh', refreshLimiter, controller.refresh);

/**
 * POST /api/auth/logout
 * Revoke session. Requires valid access token.
 */
router.post('/logout', verifyToken, controller.logout);

/**
 * GET /api/auth/me
 * Get current user profile. Requires valid access token.
 */
router.get('/me', verifyToken, controller.me);

module.exports = router;
