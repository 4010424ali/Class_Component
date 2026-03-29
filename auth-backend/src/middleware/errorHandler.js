/**
 * Central Express error handler.
 *
 * Catches all errors passed via next(err) and returns a normalised JSON
 * response without leaking stack traces to the client in production.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: messages.join(' ') },
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      error: {
        code:    'DUPLICATE_KEY',
        message: `A record with that ${field} already exists.`,
      },
    });
  }

  // Known operational errors (thrown intentionally with a .status property)
  if (err.status) {
    return res.status(err.status).json({
      error: { code: err.code || 'ERROR', message: err.message },
    });
  }

  // Unknown / programming errors — log detail but hide from client
  console.error('[ErrorHandler]', err);

  res.status(500).json({
    error: {
      code:    'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
}

module.exports = errorHandler;
