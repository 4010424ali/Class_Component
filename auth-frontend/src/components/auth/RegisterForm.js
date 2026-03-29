import React, { Component } from 'react';
import { withAuth } from '../../context/AuthContext';

class RegisterForm extends Component {
  state = {
    name: '', email: '', password: '', confirmPassword: '',
    validationError: null, successMessage: null, showPassword: false,
  };

  validate() {
    const { name, email, password, confirmPassword } = this.state;
    if (!name.trim())           return 'Name is required.';
    if (!email.trim())          return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    if (password.length < 8)    return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
    if (password !== confirmPassword) return 'Passwords do not match.';
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

    const { name, email, password } = this.state;
    const result = await this.props.auth.register(name, email, password);

    if (result.success) {
      this.setState({ successMessage: 'Account created! You can now sign in.' });
      if (this.props.onSuccess) this.props.onSuccess();
    }
  };

  togglePassword = () => this.setState(p => ({ showPassword: !p.showPassword }));

  render() {
    const { isLoading, error } = this.props.auth;
    const { name, email, password, confirmPassword, validationError, successMessage, showPassword } = this.state;
    const displayError = validationError || error;

    return (
      <div className="auth-card">
        <h2 className="auth-title">Create Account</h2>

        {successMessage && <div className="alert alert-success">{successMessage}</div>}
        {displayError   && <div className="alert alert-danger">{displayError}</div>}

        <form onSubmit={this.handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reg-name">Full Name</label>
            <input id="reg-name" type="text" name="name" className="form-control"
              value={name} onChange={this.handleChange}
              autoComplete="name" disabled={isLoading} required />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email address</label>
            <input id="reg-email" type="email" name="email" className="form-control"
              value={email} onChange={this.handleChange}
              autoComplete="email" disabled={isLoading} required />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <div className="input-group">
              <input id="reg-password" type={showPassword ? 'text' : 'password'}
                name="password" className="form-control"
                value={password} onChange={this.handleChange}
                autoComplete="new-password" disabled={isLoading} required />
              <div className="input-group-append">
                <button type="button" className="btn btn-outline-secondary"
                  onClick={this.togglePassword}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <small className="form-text text-muted">
              Min 8 chars, one uppercase, one number, one special character.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input id="reg-confirm" type={showPassword ? 'text' : 'password'}
              name="confirmPassword" className="form-control"
              value={confirmPassword} onChange={this.handleChange}
              autoComplete="new-password" disabled={isLoading} required />
          </div>

          <button type="submit" className="btn btn-success btn-block mt-3" disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        {this.props.onLoginClick && (
          <p className="auth-switch">
            Already have an account?{' '}
            <button className="btn btn-link p-0" onClick={this.props.onLoginClick}>
              Sign In
            </button>
          </p>
        )}
      </div>
    );
  }
}

export default withAuth(RegisterForm);
