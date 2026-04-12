import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navigation.css';

interface NavigationProps {
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ isDarkMode, setIsDarkMode }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a href="https://github.com/HybridRCG/headscale-admin-react" target="_blank" rel="noopener noreferrer" className="navbar-logo">
          🔗 Headscale Admin
        </a>

        {/* Hamburger menu button */}
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Menu */}
        <ul className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
          <li><Link to="/dashboard" className="navbar-link" onClick={() => setMenuOpen(false)}>Home</Link></li>
          <li><Link to="/users" className="navbar-link" onClick={() => setMenuOpen(false)}>Users</Link></li>
          <li><Link to="/nodes" className="navbar-link" onClick={() => setMenuOpen(false)}>Nodes</Link></li>
          <li><Link to="/routes" className="navbar-link" onClick={() => setMenuOpen(false)}>Routes</Link></li>
          <li><Link to="/acl" className="navbar-link" onClick={() => setMenuOpen(false)}>ACL Editor</Link></li>
          <li><Link to="/dns" className="navbar-link" onClick={() => setMenuOpen(false)}>DNS</Link></li>
          <li><Link to="/settings" className="navbar-link" onClick={() => setMenuOpen(false)}>Settings</Link></li>
        </ul>

        {/* Theme toggle */}
        <div className="theme-toggle-wrapper">
          <span className="toggle-label">☀️</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={isDarkMode} onChange={(e) => setIsDarkMode(e.target.checked)} />
            <span className="slider"></span>
          </label>
          <span className="toggle-label">🌙</span>
        </div>
      </div>
    </nav>
  );
};
