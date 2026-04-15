/* eslint-disable @typescript-eslint/no-unused-vars */
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
      </div>
    </footer>
  );
};
