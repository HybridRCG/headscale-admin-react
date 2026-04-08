import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Navigation.css';

export const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-logo">
          🔗 Headscale Admin
        </Link>
        <ul className="navbar-menu">
          <li><Link to="/dashboard" className="navbar-link">Home</Link></li>
          <li><Link to="/users" className="navbar-link">Users</Link></li>
        </ul>
        <div className="navbar-user">
          <span className="user-email">{user?.email}</span>
          <button className="navbar-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
};
