const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false, // never returned by default in queries
    },
    roles: {
      type:    [String],
      default: ['user'],
      enum:    ['user', 'admin', 'moderator'],
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });

// ── Pre-save: hash password ───────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash when the password field was modified
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  this.passwordChangedAt = new Date();
  next();
});

// ── Instance methods ─────────────────────────────────────────────────────────

/**
 * Compare a plain-text candidate against the stored hash.
 * @param {string} candidate
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * Return a sanitised plain object safe to send to the client.
 * Strips password and internal fields.
 */
userSchema.methods.toPublicJSON = function () {
  return {
    id:          this._id,
    name:        this.name,
    email:       this.email,
    roles:       this.roles,
    lastLoginAt: this.lastLoginAt,
    createdAt:   this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
