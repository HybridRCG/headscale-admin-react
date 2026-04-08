import React from 'react';
import { Link } from 'react-router-dom';
import './Navigation.css';

interface NavigationProps {
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ isDarkMode, setIsDarkMode }) => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a href="https://github.com/HybridRCG/headscale-admin-react" target="_blank" rel="noopener noreferrer" className="navbar-logo">
          🔗 Headscale Admin
        </a>
        <ul className="navbar-menu">
          <li><Link to="/dashboard" className="navbar-link">Home</Link></li>
          <li><Link to="/users" className="navbar-link">Users</Link></li>
          <li><Link to="/nodes" className="navbar-link">Nodes</Link></li>
          <li><Link to="/routes" className="navbar-link">Routes</Link></li>
          <li><Link to="/acl" className="navbar-link">ACL Editor</Link></li>
          <li><Link to="/dns" className="navbar-link">DNS</Link></li>
          <li><Link to="/settings" className="navbar-link">Settings</Link></li>
        </ul>
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
