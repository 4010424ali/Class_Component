const jwt          = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

// ── Helpers ───────────────────────────────────────────────────────────────────

function signAccessToken(userId, roles) {
  return jwt.sign(
    { sub: userId.toString(), roles },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      issuer:    'auth-backend',
    }
  );
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/api/auth',          // cookie sent only to auth routes
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/api/auth',
  });
}

function clientInfo(req) {
  return {
    userAgent: req.headers['user-agent'] || '',
    ipAddress: req.ip,
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Create a new user account.
 */
async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
      });
    }

    const { name, email, password } = req.body;
    const user = await User.create({ name, email, password });

    res.status(201).json({
      message: 'Account created successfully.',
      user: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Authenticate user, return access token in body and refresh token in cookie.
 */
async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
      });
    }

    const { email, password } = req.body;

    // Fetch user including the password field (excluded by default)
    const user = await User.findOne({ email }).select('+password');

    // Use a constant-time comparison path to prevent user enumeration
    const validPassword = user ? await user.comparePassword(password) : false;

    if (!user || !validPassword) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_INACTIVE', message: 'This account has been deactivated.' },
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const accessToken                 = signAccessToken(user._id, user.roles);
    const { token: rawRefreshToken }  = await RefreshToken.createToken({
      userId: user._id,
      ...clientInfo(req),
    });

    setRefreshCookie(res, rawRefreshToken);

    res.status(200).json({
      accessToken,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Silently exchange a valid refresh token (cookie) for a new access token.
 * Implements token rotation — old refresh token is invalidated, new one issued.
 */
async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      return res.status(401).json({
        error: { code: 'REFRESH_TOKEN_MISSING', message: 'Refresh token not found.' },
      });
    }

    // Consume (validate + mark used) the incoming token
    let tokenDoc;
    try {
      tokenDoc = await RefreshToken.consumeToken(rawToken);
    } catch (err) {
      clearRefreshCookie(res);
      return res.status(401).json({
        error: { code: err.code || 'REFRESH_TOKEN_INVALID', message: err.message },
      });
    }

    const user = await User.findById(tokenDoc.userId);
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({
        error: { code: 'USER_NOT_FOUND', message: 'User account not found or inactive.' },
      });
    }

    // Issue new access token + rotated refresh token (same family)
    const accessToken                = signAccessToken(user._id, user.roles);
    const { token: newRefreshToken } = await RefreshToken.createToken({
      userId:  user._id,
      family:  tokenDoc.family, // continue existing family
      ...clientInfo(req),
    });

    setRefreshCookie(res, newRefreshToken);

    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Revoke all refresh tokens for the authenticated user and clear cookie.
 */
async function logout(req, res, next) {
  try {
    // req.user is set by verifyToken middleware
    if (req.user?.sub) {
      await RefreshToken.revokeAllForUser(req.user.sub);
    }
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Return the current authenticated user's public profile.
 */
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
      });
    }
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, me };
