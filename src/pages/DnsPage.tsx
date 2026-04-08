import React, { useEffect, useState } from 'react';
import '../styles/Pages.css';

export const DnsPage: React.FC = () => {
  const [dnsConfig, setDnsConfig] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch DNS config from headscale-config-api
    setLoading(false);
  }, []);

  const handleSave = () => {
    // TODO: Save DNS config to headscale-config-api
    console.log('Saving DNS config:', dnsConfig);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">DNS Configuration</h1>
      
      {loading ? (
        <div className="loading">Loading DNS config...</div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <textarea
              value={dnsConfig}
              onChange={(e) => setDnsConfig(e.target.value)}
              placeholder="Enter your DNS configuration here..."
              style={{
                width: '100%',
                height: '400px',
                padding: '1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            Save DNS Config
          </button>
        </>
      )}
    </div>
  );
};
