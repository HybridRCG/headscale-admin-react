import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Navigation.css';

interface NavigationProps {
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
}

// Sun SVG icon
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
    <path d="M512 704a192 192 0 1 0 0-384 192 192 0 0 0 0 384m0 64a256 256 0 1 1 0-512 256 256 0 0 1 0 512m0-704a32 32 0 0 1 32 32v64a32 32 0 0 1-64 0V96a32 32 0 0 1 32-32m0 768a32 32 0 0 1 32 32v64a32 32 1 1-64 0v-64a32 32 0 0 1 32-32M195.2 195.2a32 32 0 0 1 45.248 0l45.248 45.248a32 32 0 1 1-45.248 45.248L195.2 240.448a32 32 0 0 1 0-45.248zm543.104 543.104a32 32 0 0 1 45.248 0l45.248 45.248a32 32 0 0 1-45.248 45.248l-45.248-45.248a32 32 0 0 1 0-45.248M64 512a32 32 0 0 1 32-32h64a32 32 0 0 1 0 64H96a32 32 0 0 1-32-32m768 0a32 32 0 0 1 32-32h64a32 32 1 1 0 64h-64a32 32 0 0 1-32-32M195.2 828.8a32 32 0 0 1 0-45.248l45.248-45.248a32 32 0 0 1 45.248 45.248L240.448 828.8a32 32 0 0 1-45.248 0zm543.104-543.104a32 32 0 0 1 0-45.248l45.248-45.248a32 32 0 0 1 45.248 45.248l-45.248 45.248a32 32 0 0 1-45.248 0" />
  </svg>
);

// Moon SVG icon
const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="11" height="11" fill="currentColor">
    <path d="M512 1024a512 512 0 1 1 0-1024A512 512 0 0 1 512 1024m-228.2-288.8a416 416 0 1 0 516.8-516.8 320 320 0 0 1-516.8 516.8" />
  </svg>
);

export const Navigation: React.FC<NavigationProps> = ({ isDarkMode, setIsDarkMode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* Hamburger — leftmost on mobile */}
        <button className={`hamburger ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Logo */}
        <a href="https://github.com/HybridRCG/headscale-admin-react" target="_blank" rel="noopener noreferrer" className="navbar-logo">
          🔗 HS-React
        </a>

        {/* Desktop Menu */}
        <ul className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
          <li><NavLink to="/dashboard" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Home</NavLink></li>
          <li><NavLink to="/users" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Users</NavLink></li>
          <li><NavLink to="/nodes" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Nodes</NavLink></li>
          {isSuperAdmin && <li><NavLink to="/routes" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Routes</NavLink></li>}
          <li><NavLink to="/acl" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>ACL</NavLink></li>
          {isSuperAdmin && <li><NavLink to="/dns" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>DNS</NavLink></li>}
          {isSuperAdmin && <li><NavLink to="/settings" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Settings</NavLink></li>}
        </ul>

        {/* Theme toggle — compact with icon inside knob */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="theme-pill"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {/* Track background — moon side (left) + sun side (right) */}
          <span className="theme-pill__moon"><MoonIcon /></span>
          <span className="theme-pill__sun"><SunIcon /></span>
          {/* Sliding knob with current icon */}
          <span className={`theme-pill__knob ${isDarkMode ? 'dark' : 'light'}`}>
            {isDarkMode ? <MoonIcon /> : <SunIcon />}
          </span>
        </button>

      </div>
    </nav>
  );
};
