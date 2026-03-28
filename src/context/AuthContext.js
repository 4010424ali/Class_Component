/**
 * AuthContext
 *
 * Provides auth state and actions to the entire component tree via React
 * Context.  Components consume it through the `withAuth` HOC or the
 * `AuthConsumer` export (hook-based consumption is available in React 16.8+,
 * but this file is deliberately kept compatible with the class-component
 * style used in this project).
 *
 * Usage (class component):
 *
 *   import { withAuth } from '../context/AuthContext';
 *
 *   class Dashboard extends Component {
 *     render() {
 *       const { user, logout } = this.props.auth;
 *       return <div>Welcome {user?.email}</div>;
 *     }
 *   }
 *
 *   export default withAuth(Dashboard);
 */

import React, { Component } from 'react';
import authService from '../services/authService';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = React.createContext({
  user:          null,
  accessToken:   null,
  isAuthenticated: false,
  isLoading:     true,
  error:         null,
  login:         async () => {},
  logout:        async () => {},
  refreshToken:  async () => {},
  clearError:    () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AuthProvider extends Component {
  constructor(props) {
    super(props);
    this.state = {
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      isLoading:       true,   // true until initial session check completes
      error:           null,
    };
  }

  async componentDidMount() {
    // Attempt to restore session from an existing refresh token
    try {
      const token = await authService.getAccessToken();
      if (token) {
        const user = authService.getCurrentUser();
        this.setState({
          user,
          accessToken:     token,
          isAuthenticated: true,
          isLoading:       false,
        });
      } else {
        this.setState({ isLoading: false });
      }
    } catch (err) {
      this.setState({ isLoading: false });
    }
  }

  // ---------------------------------------------------------------------------
  // Actions exposed through context
  // ---------------------------------------------------------------------------

  login = async (email, password) => {
    this.setState({ isLoading: true, error: null });
    try {
      const { user, accessToken } = await authService.login(email, password);
      this.setState({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading:       false,
        error:           null,
      });
      return { success: true };
    } catch (err) {
      this.setState({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  };

  logout = async () => {
    this.setState({ isLoading: true });
    await authService.logout();
    this.setState({
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      isLoading:       false,
      error:           null,
    });
  };

  refreshToken = async () => {
    try {
      const accessToken = await authService.silentRefresh();
      const user        = authService.getCurrentUser();
      this.setState({ accessToken, user });
      return accessToken;
    } catch (err) {
      // Refresh failed – force logout
      this.setState({
        user:            null,
        accessToken:     null,
        isAuthenticated: false,
        error:           'Session expired. Please log in again.',
      });
      return null;
    }
  };

  clearError = () => this.setState({ error: null });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render() {
    const contextValue = {
      ...this.state,
      login:        this.login,
      logout:       this.logout,
      refreshToken: this.refreshToken,
      clearError:   this.clearError,
    };

    return (
      <AuthContext.Provider value={contextValue}>
        {this.props.children}
      </AuthContext.Provider>
    );
  }
}

// ---------------------------------------------------------------------------
// Consumer HOC — wraps a class component and injects `props.auth`
// ---------------------------------------------------------------------------

export function withAuth(WrappedComponent) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';

  class WithAuth extends Component {
    render() {
      return (
        <AuthContext.Consumer>
          {authContext => (
            <WrappedComponent {...this.props} auth={authContext} />
          )}
        </AuthContext.Consumer>
      );
    }
  }

  WithAuth.displayName = `withAuth(${displayName})`;
  return WithAuth;
}

export const AuthConsumer = AuthContext.Consumer;
export default AuthContext;
