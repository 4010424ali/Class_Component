import React, { Component } from 'react';
import { Navigate } from 'react-router-dom';
import LoginForm    from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { withAuth } from '../context/AuthContext';

class AuthPage extends Component {
  state = { view: 'login' }; // 'login' | 'register'

  showLogin    = () => this.setState({ view: 'login' });
  showRegister = () => this.setState({ view: 'register' });

  handleLoginSuccess = () => {
    // Navigate happens via ProtectedRoute / Navigate component below
  };

  handleRegisterSuccess = () => {
    this.setState({ view: 'login' });
  };

  render() {
    const { isAuthenticated, isLoading } = this.props.auth;

    if (!isLoading && isAuthenticated) {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <div className="auth-page">
        {this.state.view === 'login' ? (
          <LoginForm
            onSuccess={this.handleLoginSuccess}
            onRegisterClick={this.showRegister}
          />
        ) : (
          <RegisterForm
            onSuccess={this.handleRegisterSuccess}
            onLoginClick={this.showLogin}
          />
        )}
      </div>
    );
  }
}

export default withAuth(AuthPage);
