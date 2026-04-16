/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import './Footer.css';

export const Footer: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = require('react-router-dom').useNavigate();
  const [registered, setRegistered] = useState(false);

  const checkRegistration = () => {
    axios.get('/admin/api/headscale/registration')
      .then(r => setRegistered(r.data?.registered === true))
      .catch(() => {});
  };

  useEffect(() => {
    checkRegistration();
    // Re-check when registration changes from Settings page
    window.addEventListener('registration-changed', checkRegistration);
    return () => window.removeEventListener('registration-changed', checkRegistration);
  }, []);

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
        {!registered && (
          <a
            href="https://buymeacoffee.com/hybridrcg"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-coffee"
          >
            ☕ Buy me a coffee
          </a>
        )}
        <button className="footer-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </footer>
  );
};
