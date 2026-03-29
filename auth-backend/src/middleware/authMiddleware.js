const jwt = require('jsonwebtoken');

/**
 * Middleware: verify JWT access token in Authorization header.
 *
 * On success:  attaches decoded payload to req.user and calls next().
 * On failure:  returns 401 JSON error.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'TOKEN_MISSING', message: 'Authorization token required.' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    const code    = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    const message = err.name === 'TokenExpiredError'
      ? 'Access token has expired.'
      : 'Invalid access token.';

    return res.status(401).json({ error: { code, message } });
  }
}

/**
 * Middleware factory: require one of the specified roles.
 * Must be used AFTER verifyToken.
 *
 * Usage:  router.get('/admin', verifyToken, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const hasRole   = roles.some(r => userRoles.includes(r));

    if (!hasRole) {
      return res.status(403).json({
        error: {
          code:    'FORBIDDEN',
          message: `Requires one of roles: ${roles.join(', ')}`,
        },
      });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
