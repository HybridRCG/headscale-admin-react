import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/LoginPage.css';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [headscaleUrl, setHeadscaleUrl] = useState(
    process.env.REACT_APP_HEADSCALE_URL || 'https://hs.groblers.co.uk'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, apiKey, headscaleUrl);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Headscale Admin</h1>
          <p>Secure Authentication Required</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
              className="form-input"
            />
            <small>Your headscale user email</small>
          </div>

          <div className="form-group">
            <label htmlFor="apiKey">API Key (Password)</label>
            <div className="password-field">
              <input
                id="apiKey"
                type={showPassword ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Headscale API key"
                required
                disabled={loading}
                className="form-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="show-password-btn"
                disabled={loading}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <small>Your personal Headscale API key or admin token</small>
          </div>

          <div className="form-group">
            <label htmlFor="headscaleUrl">Headscale URL</label>
            <input
              id="headscaleUrl"
              type="url"
              value={headscaleUrl}
              onChange={(e) => setHeadscaleUrl(e.target.value)}
              placeholder="https://hs.example.com"
              required
              disabled={loading}
              className="form-input"
            />
            <small>Base URL of your headscale instance</small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={loading || !email || !apiKey}
            className="btn btn-primary btn-submit"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p className="footer-text">
            Your API key is sent securely to the backend and never stored in your browser.
          </p>
        </div>
      </div>
    </div>
  );
};
