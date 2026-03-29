import React, { Component } from 'react';
import { Navigate } from 'react-router-dom';
import { withAuth } from '../../context/AuthContext';

/**
 * Wraps a component and redirects unauthenticated users to /login.
 *
 * Usage:
 *   <Route path="/dashboard" element={<ProtectedRoute component={Dashboard} />} />
 */
class ProtectedRoute extends Component {
  render() {
    const { auth, component: WrappedComponent, ...rest } = this.props;
    const { isAuthenticated, isLoading } = auth;

    if (isLoading) {
      return (
        <div className="loading-screen" role="status">
          <div className="spinner-border text-primary" />
          <p>Loading…</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    return <WrappedComponent {...rest} />;
  }
}

export default withAuth(ProtectedRoute);
