import { Component } from 'react';
import { withAuth } from '../../context/AuthContext';

/**
 * Invisible component that intercepts fetch 401s and silently refreshes.
 * Mount once inside <AuthProvider>, before <App />.
 */
class TokenRefreshHandler extends Component {
  _originalFetch = null;

  componentDidMount() {
    this._originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (input, init = {}) {
      let response = await self._originalFetch(input, init);

      if (response.status !== 401 || !self.props.auth.isAuthenticated) {
        return response;
      }

      const newToken = await self.props.auth.refreshToken();
      if (!newToken) return response;

      return self._originalFetch(input, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${newToken}` },
      });
    };
  }

  componentWillUnmount() {
    if (this._originalFetch) {
      window.fetch       = this._originalFetch;
      this._originalFetch = null;
    }
  }

  render() { return null; }
}

export default withAuth(TokenRefreshHandler);
