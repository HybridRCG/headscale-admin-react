import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authenticateUser } from '../services/api';
import '../styles/LoginPage.css';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const HEADSCALE_URL = 'https://hs.groblers.co.uk';
  const HEADSCALE_API_KEY = 'ADu3G5f.TC_833KL90ug6ujda1vch8W9ih6_O5Bj';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authenticateUser(email, HEADSCALE_URL, HEADSCALE_API_KEY);
      login(result.user, result.apiKey, HEADSCALE_URL);
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
        <h1>Headscale Admin</h1>
        <p>Authentication Required</p>

        <form onSubmit={handleSubmit}>
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
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading || !email}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <p className="footer-text">Enter your email address to continue</p>
      </div>
    </div>
  );
};
