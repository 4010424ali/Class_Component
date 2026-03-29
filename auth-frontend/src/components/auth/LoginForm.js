import React, { Component } from 'react';
import { withAuth } from '../../context/AuthContext';
import { loginLimiter } from '../../utils/rateLimiter';

class LoginForm extends Component {
  state = { email: '', password: '', validationError: null, showPassword: false };

  rateLimitKey() {
    return `login:${this.state.email.toLowerCase().trim()}`;
  }

  validate() {
    const { email, password } = this.state;
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  }

  handleChange = (e) => {
    this.setState({ [e.target.name]: e.target.value, validationError: null });
    if (this.props.auth.error) this.props.auth.clearError();
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = this.validate();
    if (validationError) { this.setState({ validationError }); return; }

    const { email, password } = this.state;
    const result = await this.props.auth.login(email, password);
    if (result.success && this.props.onSuccess) this.props.onSuccess();
  };

  togglePassword = () => this.setState(p => ({ showPassword: !p.showPassword }));

  render() {
    const { isLoading, error } = this.props.auth;
    const { email, password, validationError, showPassword } = this.state;

    const lockoutText       = loginLimiter.lockoutRemainingText(this.rateLimitKey());
    const remaining         = email ? loginLimiter.remainingAttempts(this.rateLimitKey()) : null;
    const isLocked          = lockoutText !== null;
    const displayError      = validationError || error;

    return (
      <div className="auth-card">
        <h2 className="auth-title">Sign In</h2>

        {isLocked && (
          <div className="alert alert-danger">
            Account locked. Try again in <strong>{lockoutText}</strong>.
          </div>
        )}
        {!isLocked && remaining !== null && remaining <= 2 && (
          <div className="alert alert-warning">
            Warning: {remaining} attempt{remaining !== 1 ? 's' : ''} remaining before lockout.
          </div>
        )}
        {displayError && !isLocked && (
          <div className="alert alert-danger">{displayError}</div>
        )}

        <form onSubmit={this.handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Email address</label>
            <input id="login-email" type="email" name="email" className="form-control"
              value={email} onChange={this.handleChange}
              autoComplete="email" disabled={isLoading || isLocked} required />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div className="input-group">
              <input id="login-password" type={showPassword ? 'text' : 'password'}
                name="password" className="form-control"
                value={password} onChange={this.handleChange}
                autoComplete="current-password" disabled={isLoading || isLocked} required />
              <div className="input-group-append">
                <button type="button" className="btn btn-outline-secondary"
                  onClick={this.togglePassword}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block mt-3"
            disabled={isLoading || isLocked}>
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {this.props.onRegisterClick && (
          <p className="auth-switch">
            Don't have an account?{' '}
            <button className="btn btn-link p-0" onClick={this.props.onRegisterClick}>
              Register
            </button>
          </p>
        )}
      </div>
    );
  }
}

export default withAuth(LoginForm);
