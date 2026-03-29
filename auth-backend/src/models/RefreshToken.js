const mongoose = require('mongoose');
const crypto   = require('crypto');

/**
 * RefreshToken model
 *
 * Supports token family tracking:
 *   - Every new refresh token belongs to a "family" (UUID).
 *   - When a token is used, it is marked used and a new token in the same
 *     family is issued.
 *   - If an already-used token is presented, all tokens in that family are
 *     immediately revoked (replay attack detected).
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    family: {
      type:     String,
      required: true,
      index:    true,
    },
    isUsed: {
      type:    Boolean,
      default: false,
    },
    isRevoked: {
      type:    Boolean,
      default: false,
    },
    expiresAt: {
      type:     Date,
      required: true,
      index:    { expireAfterSeconds: 0 }, // MongoDB TTL index auto-deletes expired docs
    },
    userAgent: String,
    ipAddress: String,
  },
  {
    timestamps: true,
  }
);

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Create and persist a new refresh token.
 * @param {object} opts
 * @param {string}  opts.userId
 * @param {string}  [opts.family]      - Provide to continue an existing family; omit to start a new one
 * @param {number}  [opts.ttlMs]       - Token lifetime in ms (default 7 days)
 * @param {string}  [opts.userAgent]
 * @param {string}  [opts.ipAddress]
 * @returns {Promise<{ token: string, family: string }>}
 */
refreshTokenSchema.statics.createToken = async function ({
  userId,
  family      = crypto.randomUUID(),
  ttlMs       = 7 * 24 * 60 * 60 * 1000,
  userAgent   = '',
  ipAddress   = '',
}) {
  const token     = crypto.randomBytes(64).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMs);

  await this.create({ token, userId, family, expiresAt, userAgent, ipAddress });
  return { token, family };
};

/**
 * Find a token document, validate it, mark it as used, and return it.
 * Throws descriptive errors for each failure case.
 *
 * @param {string} rawToken
 * @returns {Promise<RefreshTokenDocument>}
 */
refreshTokenSchema.statics.consumeToken = async function (rawToken) {
  const doc = await this.findOne({ token: rawToken });

  if (!doc) {
    throw Object.assign(new Error('Refresh token not found.'), { code: 'REFRESH_TOKEN_MISSING' });
  }

  if (doc.expiresAt < new Date()) {
    throw Object.assign(new Error('Refresh token has expired.'), { code: 'REFRESH_TOKEN_EXPIRED' });
  }

  if (doc.isRevoked) {
    throw Object.assign(new Error('Refresh token has been revoked.'), { code: 'REFRESH_TOKEN_REVOKED' });
  }

  if (doc.isUsed) {
    // Replay attack — revoke entire family
    await this.updateMany({ family: doc.family }, { isRevoked: true });
    throw Object.assign(
      new Error('Token reuse detected. All sessions revoked. Please log in again.'),
      { code: 'REFRESH_TOKEN_REUSE' }
    );
  }

  doc.isUsed = true;
  await doc.save();
  return doc;
};

/**
 * Revoke all active refresh tokens belonging to a user (full sign-out).
 * @param {string} userId
 */
refreshTokenSchema.statics.revokeAllForUser = async function (userId) {
  await this.updateMany({ userId, isRevoked: false }, { isRevoked: true });
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
