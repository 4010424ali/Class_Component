import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import TokenRefreshHandler from './components/auth/TokenRefreshHandler';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthPage      from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';

import './App.css';

class App extends Component {
  render() {
    return (
      <AuthProvider>
        {/* Intercepts 401 fetch responses and silently refreshes the access token */}
        <TokenRefreshHandler />

        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login"    element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={<ProtectedRoute component={DashboardPage} />}
            />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    );
  }
}

export default App;
