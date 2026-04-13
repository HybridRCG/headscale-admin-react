import React, { useEffect, ReactNode, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { UsersPage } from './pages/UsersPage';
import { NodesPage } from './pages/NodesPage';
import { RoutesPage } from './pages/RoutesPage';
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

interface AdminRouteProps {
  children: ReactNode;
}

function AdminRoute({ children }: AdminRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userRole = useAuthStore((state) => state.user?.role || 'user');
  return isAuthenticated && userRole === 'super_admin' ? <>{children}</> : <Navigate to="/dashboard" />;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const restoreSession = useAuthStore.getState().restoreSession;
        await restoreSession();
      } catch (err) {
        // restoreSession failed, user is not authenticated
        console.log('Session restore failed, redirecting to login');
      }
      setAppReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  if (!appReady) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <BrowserRouter basename="/admin">
      {isAuthenticated && <Navigation isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
        <Route path="/nodes" element={<PrivateRoute><NodesPage /></PrivateRoute>} />
        <Route path="/routes" element={<PrivateRoute><RoutesPage /></PrivateRoute>} />
        <Route path="/acl" element={<PrivateRoute><AclPage /></PrivateRoute>} />
        <Route path="/dns" element={<AdminRoute><DnsPage /></AdminRoute>} />
        <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
      {isAuthenticated && <Footer />}
    </BrowserRouter>
  );
}

export default App;
