/* eslint-disable @typescript-eslint/no-unused-vars */
import { APP_VERSION } from '../constants/version';
import React from 'react';
import { useAuthStore } from '../store/authStore';
import './Footer.css';

export const Footer: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = require('react-router-dom').useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-user-info">
          <span className="user-name">{user?.email}</span>
          <span className="user-role">{user?.role}</span>
          <span className="footer-version">v{APP_VERSION}</span>
        </div>
        <a
          href="https://buymeacoffee.com/hybridrcg"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-coffee"
        >
          ☕ Buy me a coffee
        </a>
        <button className="footer-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </footer>
  );
};
