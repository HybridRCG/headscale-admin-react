/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { APP_VERSION } from '../constants/version';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import './Footer.css';

export const Footer: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = require('react-router-dom').useNavigate();
  const [registered, setRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  const checkRegistration = () => {
    axios.get('/admin/api/headscale/registration')
      .then(r => setRegistered(r.data?.registered === true))
      .catch(() => {});
  };

  useEffect(() => {
    checkRegistration();
    window.addEventListener('registration-changed', checkRegistration);
    // Check for updates from GitHub
    fetch('https://api.github.com/repos/HybridRCG/headscale-admin-react/commits/main', {
      headers: { 'User-Agent': 'hs-react-update-check' }
    })
    .then(r => r.json())
    .then(data => {
      const msg = data.commit?.message || '';
      const match = msg.match(/v(\d+\.\d+\.\d+)/);
      if (match) {
        const latest = match[1];
        if (latest !== APP_VERSION) setUpdateAvailable(latest);
      }
    })
    .catch(() => {});
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
        {updateAvailable && (
          <a
            href="https://github.com/HybridRCG/headscale-admin-react/releases"
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f59e0b', color: '#000',
              padding: '0.35rem 0.85rem', borderRadius: '0.375rem', fontWeight: '700', fontSize: '0.8rem',
              textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', animation: 'pulse 2s infinite' }}
          >
            🆕 v{updateAvailable} available
          </a>
        )}
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
