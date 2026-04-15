import { APP_VERSION } from '../constants/version';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Pages.css';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
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
    <div className="settings-container">
      <h1>Settings</h1>

      <div className="settings-section">
        <h2>Server Configuration</h2>
        <label>
          Server URL:
          <input
            type="text"
            value={settings.serverUrl}
            onChange={(e) => handleChange('serverUrl', e.target.value)}
          />
        </label>
      </div>

      <div className="settings-section">
        <h2>Auto Refresh</h2>
        <label>
          <input
            type="checkbox"
            checked={settings.autoRefresh}
            onChange={(e) => handleChange('autoRefresh', e.target.checked)}
          />
          Enable auto refresh
        </label>
        {settings.autoRefresh && (
          <label>
            Refresh Interval (seconds):
            <input
              type="number"
              value={settings.refreshInterval}
              onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value))}
            />
          </label>
        )}
      </div>

      <div className="settings-section">
        <h2>About</h2>
        <p><strong>Version:</strong> v{APP_VERSION}</p>
        <p><strong>Application:</strong> Headscale Admin</p>
      </div>

      <button onClick={handleSave} className="save-btn">
        Save Settings
      </button>
    </div>
  );
};
