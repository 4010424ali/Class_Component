/**
 * LoginForm — Class Component
 *
 * Features:
 *  - Controlled form with validation
 *  - Delegates auth to AuthContext (which calls authService → rate limiter)
 *  - Displays remaining attempts and lockout timer
 *  - Prevents double-submission
 */

import React, { Component } from 'react';
import { withAuth } from '../../context/AuthContext';
import { loginLimiter } from '../../utils/rateLimiter';

class LoginForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      email:              '',
      password:           '',
      validationError:    null,
      showPassword:       false,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  getRateLimitKey() {
    return `login:${this.state.email.toLowerCase().trim()}`;
  }

  getRemainingAttempts() {
    const key = this.getRateLimitKey();
    if (!this.state.email) return null;
    return loginLimiter.remainingAttempts(key);
  }

  getLockoutText() {
    const key = this.getRateLimitKey();
    return loginLimiter.lockoutRemainingText(key);
  }

  validate() {
    const { email, password } = this.state;
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    if (!password)     return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  handleChange = (e) => {
    const { name, value } = e.target;
    this.setState({ [name]: value, validationError: null });
    // Clear auth error when user starts typing
    if (this.props.auth.error) {
      this.props.auth.clearError();
    }
  };

  handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = this.validate();
    if (validationError) {
      this.setState({ validationError });
      return;
    }

    const { email, password } = this.state;
    const result = await this.props.auth.login(email, password);

    if (result.success) {
      // Redirect handled by ProtectedRoute / parent
      if (this.props.onSuccess) this.props.onSuccess();
    }
  };

  togglePasswordVisibility = () => {
    this.setState(prev => ({ showPassword: !prev.showPassword }));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render() {
    const { isLoading, error } = this.props.auth;
    const { email, password, validationError, showPassword } = this.state;

    const lockoutText      = this.getLockoutText();
    const remainingAttempts = this.getRemainingAttempts();
    const displayError     = validationError || error;
    const isLocked         = lockoutText !== null;

    return (
      <div className="login-form-container">
        <form
          onSubmit={this.handleSubmit}
          noValidate
          aria-label="Login form"
        >
          <h2>Sign In</h2>

          {/* ── Rate-limit warnings ── */}
          {isLocked && (
            <div className="alert alert-danger" role="alert">
              Account temporarily locked. Try again in <strong>{lockoutText}</strong>.
            </div>
          )}

          {!isLocked && remainingAttempts !== null && remainingAttempts <= 2 && (
            <div className="alert alert-warning" role="alert">
              Warning: {remainingAttempts} login attempt{remainingAttempts !== 1 ? 's' : ''} remaining
              before temporary lockout.
            </div>
          )}

          {/* ── Error display ── */}
          {displayError && !isLocked && (
            <div className="alert alert-danger" role="alert">
              {displayError}
            </div>
          )}

          {/* ── Email ── */}
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              name="email"
              className="form-control"
              value={email}
              onChange={this.handleChange}
              autoComplete="email"
              disabled={isLoading || isLocked}
              required
            />
          </div>

          {/* ── Password ── */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-group">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-control"
                value={password}
                onChange={this.handleChange}
                autoComplete="current-password"
                disabled={isLoading || isLocked}
                required
              />
              <div className="input-group-append">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={this.togglePasswordVisibility}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isLoading || isLocked}
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }
}

export default withAuth(LoginForm);
