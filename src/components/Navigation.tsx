import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Navigation.css';

interface NavigationProps {
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ isDarkMode, setIsDarkMode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a href="https://github.com/HybridRCG/headscale-admin-react" target="_blank" rel="noopener noreferrer" className="navbar-logo">
          🔗 HS-React
        </a>

        {/* Hamburger menu button */}
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Menu */}
        <ul className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
          <li><NavLink to="/dashboard" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Home</NavLink></li>
          <li><NavLink to="/users" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Users</NavLink></li>
          <li><NavLink to="/nodes" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Nodes</NavLink></li>
          {isSuperAdmin && <li><NavLink to="/routes" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Routes</NavLink></li>}
          <li><NavLink to="/acl" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>ACL Editor</NavLink></li>
          {isSuperAdmin && <li><NavLink to="/dns" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>DNS</NavLink></li>}
          {isSuperAdmin && <li><NavLink to="/settings" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Settings</NavLink></li>}
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
