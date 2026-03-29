import React, { Component } from 'react';
import authService from '../services/authService';

const AuthContext = React.createContext({
  user: null, accessToken: null, isAuthenticated: false,
  isLoading: true, error: null,
  login: async () => {}, logout: async () => {},
  register: async () => {}, refreshToken: async () => {},
  clearError: () => {},
});

export class AuthProvider extends Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null, accessToken: null,
      isAuthenticated: false, isLoading: true, error: null,
    };
  }

  async componentDidMount() {
    // Attempt to restore session via refresh token cookie
    try {
      const token = await authService.getAccessToken();
      if (token) {
        const user = await authService.fetchCurrentUser();
        this.setState({ user, accessToken: token, isAuthenticated: true, isLoading: false });
      } else {
        this.setState({ isLoading: false });
      }
    } catch {
      this.setState({ isLoading: false });
    }
  }

  register = async (name, email, password) => {
    this.setState({ isLoading: true, error: null });
    try {
      const data = await authService.register({ name, email, password });
      this.setState({ isLoading: false });
      return { success: true, user: data.user };
    } catch (err) {
      this.setState({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  };

  login = async (email, password) => {
    this.setState({ isLoading: true, error: null });
    try {
      const { user, accessToken } = await authService.login(email, password);
      this.setState({ user, accessToken, isAuthenticated: true, isLoading: false, error: null });
      return { success: true };
    } catch (err) {
      this.setState({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  };

  logout = async () => {
    this.setState({ isLoading: true });
    await authService.logout();
    this.setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, error: null });
  };

  refreshToken = async () => {
    try {
      const accessToken = await authService.silentRefresh();
      const user        = await authService.fetchCurrentUser();
      this.setState({ accessToken, user });
      return accessToken;
    } catch {
      this.setState({ user: null, accessToken: null, isAuthenticated: false,
        error: 'Session expired. Please log in again.' });
      return null;
    }
  };

  clearError = () => this.setState({ error: null });

  render() {
    return (
      <AuthContext.Provider value={{
        ...this.state,
        login:        this.login,
        logout:       this.logout,
        register:     this.register,
        refreshToken: this.refreshToken,
        clearError:   this.clearError,
      }}>
        {this.props.children}
      </AuthContext.Provider>
    );
  }
}

export function withAuth(WrappedComponent) {
  const name = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  class WithAuth extends Component {
    render() {
      return (
        <AuthContext.Consumer>
          {ctx => <WrappedComponent {...this.props} auth={ctx} />}
        </AuthContext.Consumer>
      );
    }
  }
  WithAuth.displayName = `withAuth(${name})`;
  return WithAuth;
}

export const AuthConsumer = AuthContext.Consumer;
export default AuthContext;
