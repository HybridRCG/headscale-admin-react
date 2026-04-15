import { APP_VERSION } from '../constants/version';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Pages.css';

const Card: React.FC<{ icon: string; title: string; desc: string; action: string; onClick: () => void; colour?: string }> = ({ icon, title, desc, action, onClick, colour = '#3b82f6' }) => (
  <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '1.75rem' }}>{icon}</span>
      <div>
        <div style={{ color: '#f3f4f6', fontWeight: '600', fontSize: '0.95rem' }}>{title}</div>
        <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.2rem' }}>{desc}</div>
      </div>
    </div>
    <button
      onClick={onClick}
      style={{ padding: '0.5rem 1rem', backgroundColor: colour, color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {action}
    </button>
  </div>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

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
