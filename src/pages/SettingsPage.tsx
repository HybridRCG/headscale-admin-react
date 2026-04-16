import { APP_VERSION } from '../constants/version';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Pages.css';

const API = '/admin/api/headscale';

const Card: React.FC<{ icon: string; title: string; desc: string; action: string; onClick: () => void; colour?: string }> = ({ icon, title, desc, action, onClick, colour = '#3b82f6' }) => (
  <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '1.75rem' }}>{icon}</span>
      <div>
        <div style={{ color: '#f3f4f6', fontWeight: '600', fontSize: '0.95rem' }}>{title}</div>
        <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.2rem' }}>{desc}</div>
      </div>
    </div>
    <button onClick={onClick}
      style={{ padding: '0.5rem 1rem', backgroundColor: colour, color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {action}
    </button>
  </div>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [registered, setRegistered] = useState(false);
  const [regPayload, setRegPayload] = useState('');
  const [regKey, setRegKey] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    axios.get(`${API}/registration`).then(r => {
      if (r.data.registered) {
        setRegistered(true);
        setRegPayload(r.data.payload || '');
      }
    }).catch(() => {});
  }, []);

  const handleRegister = async () => {
    if (!regKey.trim()) return;
    setRegLoading(true);
    setRegError('');
    try {
      const resp = await axios.post(`${API}/register`, { key: regKey.trim() });
      if (resp.data.success) {
        setRegistered(true);
        setRegPayload(resp.data.payload || '');
        setShowInput(false);
        setRegKey('');
        // Tell footer to re-check
        window.dispatchEvent(new Event('registration-changed'));
      }
    } catch (e: any) {
      setRegError(e.response?.data?.message || 'Invalid key');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="page-container">

      {/* Admin Tools */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Admin Tools</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Card icon="🔐" title="Pre-Auth Keys" desc="Create and manage node registration keys" action="Manage →" onClick={() => navigate('/preauthkeys')} colour="#6366f1" />
          <Card icon="📜" title="Audit Log" desc="View all admin actions and login history" action="View →" onClick={() => navigate('/auditlog')} colour="#6366f1" />
        </div>
      </div>

      {/* Registration */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Registration</div>
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: `1px solid ${registered ? '#10b981' : '#374151'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.75rem' }}>{registered ? '✅' : '🔑'}</span>
              <div>
                <div style={{ color: '#f3f4f6', fontWeight: '600', fontSize: '0.95rem' }}>
                  {registered ? 'Registered' : 'Unregistered'}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  {registered
                    ? <span style={{ color: '#10b981' }}>Licensed: {regPayload}</span>
                    : 'Enter your license key to register this instance'}
                </div>
              </div>
            </div>
            {!registered && (
              <button onClick={() => setShowInput(!showInput)}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}>
                {showInput ? 'Cancel' : 'Enter Key'}
              </button>
            )}
          </div>

          {showInput && !registered && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <input
                type="text"
                value={regKey}
                onChange={e => { setRegKey(e.target.value); setRegError(''); }}
                placeholder="HSR-CLIENTNAME-2026-XXXXXXXXXXXX"
                style={{ flex: 1, minWidth: '280px', padding: '0.6rem 0.75rem', backgroundColor: '#374151', border: `1px solid ${regError ? '#ef4444' : '#4b5563'}`, borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', fontFamily: 'monospace' }}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
              />
              <button onClick={handleRegister} disabled={!regKey.trim() || regLoading}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: regKey.trim() ? '#10b981' : '#374151', color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: '600', fontSize: '0.875rem', cursor: regKey.trim() ? 'pointer' : 'not-allowed' }}>
                {regLoading ? 'Validating...' : 'Register'}
              </button>
              {regError && <div style={{ width: '100%', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>❌ {regError}</div>}
            </div>
          )}
        </div>
      </div>

      {/* System */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>System</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🖥️</span>
                <div>
                  <div style={{ color: '#f3f4f6', fontWeight: '600', fontSize: '0.95rem' }}>HS React</div>
                  <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    Version <span style={{ color: '#10b981', fontWeight: '700' }}>v{APP_VERSION}</span>
                    <span style={{ margin: '0 0.5rem', color: '#374151' }}>·</span>
                    <a href="https://github.com/HybridRCG/headscale-admin-react" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>GitHub ↗</a>
                  </div>
                </div>
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>© 2026 HybridRCG</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
