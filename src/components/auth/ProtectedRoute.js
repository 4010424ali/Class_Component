/**
 * ProtectedRoute — Class Component
 *
 * Wraps a component (or React Router <Route>) so that unauthenticated users
 * are redirected to the login page.
 *
 * Usage (without React Router):
 *   <ProtectedRoute component={Dashboard} fallback={<LoginForm />} />
 *
 * Usage (with React Router v4/v5):
 *   <Route path="/dashboard" render={props => (
 *     <ProtectedRoute component={Dashboard} routerProps={props} />
 *   )} />
 */

import React, { Component } from 'react';
import { withAuth } from '../../context/AuthContext';

class ProtectedRoute extends Component {
  render() {
    const {
      auth,
      component: WrappedComponent,
      fallback,
      loadingIndicator,
      routerProps,
      ...rest
    } = this.props;

    const { isAuthenticated, isLoading } = auth;

    // While restoring session from refresh token, show a loading state
    if (isLoading) {
      return loadingIndicator || (
        <div className="protected-route-loading" role="status" aria-live="polite">
          <span>Loading…</span>
        </div>
      );
    }

    if (!isAuthenticated) {
      // If a fallback (e.g. <LoginForm />) is provided, render it
      if (fallback) return fallback;

      // If React Router history is available, redirect programmatically
      if (routerProps && routerProps.history) {
        routerProps.history.replace('/login');
        return null;
      }

      // Default: render nothing (parent should handle redirect)
      return null;
    }

    return <WrappedComponent {...routerProps} {...rest} />;
  }
}

export default withAuth(ProtectedRoute);
