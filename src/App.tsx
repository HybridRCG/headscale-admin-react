import React, { useEffect, ReactNode, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { UsersPage } from './pages/UsersPage';
import { NodesPage } from './pages/NodesPage';
import { AclPage } from './pages/AclPage';
import { DnsPage } from './pages/DnsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import './App.css';
import './styles/DarkTheme.css';

interface PrivateRouteProps {
  children: ReactNode;
}

function PrivateRoute({ children }: PrivateRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    const restoreSession = useAuthStore.getState().restoreSession;
    restoreSession().catch(() => {});
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <BrowserRouter basename="/admin">
      {isAuthenticated && <Navigation isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
        <Route path="/nodes" element={<PrivateRoute><NodesPage /></PrivateRoute>} />
        <Route path="/acl" element={<PrivateRoute><AclPage /></PrivateRoute>} />
        <Route path="/dns" element={<PrivateRoute><DnsPage /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
      {isAuthenticated && <Footer />}
    </BrowserRouter>
  );
}

export default App;
