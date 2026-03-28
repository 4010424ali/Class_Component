/**
 * TokenRefreshHandler — Class Component
 *
 * Invisible component that intercepts 401 responses from fetch calls by
 * patching globalThis.fetch with an interceptor.  When a 401 is received it
 * attempts a silent token refresh and replays the original request once.
 *
 * Mount this once at the root of the app (inside <AuthProvider>):
 *   <AuthProvider>
 *     <TokenRefreshHandler />
 *     <App />
 *   </AuthProvider>
 */

import { Component } from 'react';
import { withAuth } from '../../context/AuthContext';

class TokenRefreshHandler extends Component {
  _originalFetch = null;

  componentDidMount() {
    this._installInterceptor();
  }

  componentWillUnmount() {
    this._removeInterceptor();
  }

  _installInterceptor() {
    if (this._originalFetch) return; // Already installed
    this._originalFetch = window.fetch.bind(window);

    const self = this;

    window.fetch = async function interceptedFetch(input, init = {}) {
      // Perform the original request
      let response = await self._originalFetch(input, init);

      // If not a 401 or no auth context, return as-is
      if (response.status !== 401 || !self.props.auth.isAuthenticated) {
        return response;
      }

      // Attempt silent refresh
      const newToken = await self.props.auth.refreshToken();

      if (!newToken) {
        // Refresh failed – return the original 401 for the caller to handle
        return response;
      }

      // Replay the original request with the new token
      const newInit = {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${newToken}`,
        },
      };

      return self._originalFetch(input, newInit);
    };
  }

  _removeInterceptor() {
    if (this._originalFetch) {
      window.fetch      = this._originalFetch;
      this._originalFetch = null;
    }
  }

  render() {
    return null; // Invisible component
  }
}

export default withAuth(TokenRefreshHandler);
