import React, { useState } from 'react';
import '../styles/Pages.css';

const APP_VERSION = '0.2.0';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    serverUrl: 'https://hs.groblers.co.uk',
    autoRefresh: true,
    refreshInterval: 30,
  });

  const handleChange = (field: string, value: any) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = () => {
    localStorage.setItem('settings', JSON.stringify(settings));
    alert('Settings saved!');
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Settings</h1>
      <div style={{ maxWidth: '600px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Headscale Server URL</label>
          <input type="text" value={settings.serverUrl} onChange={(e) => handleChange('serverUrl', e.target.value)} className="form-input" style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={settings.autoRefresh} onChange={(e) => handleChange('autoRefresh', e.target.checked)} />
            Auto-refresh data
          </label>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Refresh Interval (seconds)</label>
          <input type="number" value={settings.refreshInterval} onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value))} className="form-input" style={{ width: '100%' }} min="5" max="300" />
        </div>
        <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>About</h3>
          <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>Headscale Admin React</p>
          <a href="https://github.com/HybridRCG/headscale-admin-react/releases" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', cursor: 'pointer', fontSize: '0.875rem' }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}>v{APP_VERSION}</a>
        </div>
      </div>
    </div>
  );
};
