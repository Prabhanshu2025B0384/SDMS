import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="nav-brand">Secure DMS</div>
        <div className="nav-actions">
          <div className="user-info">
            <span className="user-role">{user.role}</span>
            <span className="user-dept">{user.department}</span>
          </div>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
