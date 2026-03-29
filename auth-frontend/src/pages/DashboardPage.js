import React, { Component } from 'react';
import { withAuth } from '../context/AuthContext';

class DashboardPage extends Component {
  handleLogout = async () => {
    await this.props.auth.logout();
  };

  render() {
    const { user } = this.props.auth;

    return (
      <div className="dashboard-page container mt-5">
        <div className="card shadow-sm p-4">
          <h1 className="mb-3">Dashboard</h1>
          <p className="text-muted">You are authenticated.</p>

          {user && (
            <table className="table table-bordered">
              <tbody>
                <tr><th>Name</th>  <td>{user.name}</td></tr>
                <tr><th>Email</th> <td>{user.email}</td></tr>
                <tr><th>Roles</th> <td>{(user.roles || []).join(', ')}</td></tr>
                <tr>
                  <th>Last login</th>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}</td>
                </tr>
              </tbody>
            </table>
          )}

          <button className="btn btn-danger mt-2" onClick={this.handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }
}

export default withAuth(DashboardPage);
