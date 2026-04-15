import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Pages.css';

interface DnsRecord {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX';
  value: string;
}

interface DnsConfig {
  tailnetName: string;
  magicDns: boolean;
  overrideLocalDns: boolean;
  nameservers: string[];
  searchDomains: string[];
  splitDns: Record<string, string[]>;
  extraRecords: DnsRecord[];
}

export const DnsPage: React.FC = () => {
  const [config, setConfig] = useState<DnsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const API_BASE = '/admin/api';

  useEffect(() => {
    fetchDnsConfig();
  }, []);

  const fetchDnsConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/config/dns`);
      setConfig(response.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch DNS config');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/config/dns`, config);
      setError('');
      alert('DNS configuration saved successfully!');
    } catch (err) {
      setError('Failed to save DNS config');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading DNS config...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="page-container">
        <div style={{ color: '#ef5350' }}>Failed to load DNS configuration</div>
      </div>
    );
  }

  return (
    <div className="page-container">

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ maxWidth: '900px' }}>
        {/* Tailnet Name */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#d1d5db' }}>
            Tailnet Base Domain
          </label>
          <input
            type="text"
            value={config.tailnetName}
            onChange={(e) => setConfig({ ...config, tailnetName: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              color: '#f3f4f6',
              fontSize: '1rem',
            }}
          />
        </div>

        {/* Magic DNS */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.magicDns}
              onChange={(e) => setConfig({ ...config, magicDns: e.target.checked })}
            />
            <span style={{ color: '#d1d5db', fontWeight: '600' }}>Magic DNS</span>
          </label>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Automatically register domain names for each device on the tailnet
          </p>
        </div>

        {/* Override Local DNS */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.overrideLocalDns}
              onChange={(e) => setConfig({ ...config, overrideLocalDns: e.target.checked })}
            />
            <span style={{ color: '#d1d5db', fontWeight: '600' }}>Override Local DNS</span>
          </label>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Override DNS servers on devices with the Tailnet nameservers
          </p>
        </div>

        {/* Global Nameservers */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#d1d5db' }}>
            Global Nameservers
          </label>
          {config.nameservers.map((ns, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={ns}
                onChange={(e) => {
                  const updated = [...config.nameservers];
                  updated[idx] = e.target.value;
                  setConfig({ ...config, nameservers: updated });
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#f3f4f6',
                }}
              />
              <button
                className="btn btn-sm btn-error"
                onClick={() => setConfig({ ...config, nameservers: config.nameservers.filter((_, i) => i !== idx) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setConfig({ ...config, nameservers: [...config.nameservers, ''] })}
          >
            + Add Nameserver
          </button>
        </div>

        {/* Search Domains */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#d1d5db' }}>
            Search Domains
          </label>
          {config.searchDomains.map((domain, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={domain}
                onChange={(e) => {
                  const updated = [...config.searchDomains];
                  updated[idx] = e.target.value;
                  setConfig({ ...config, searchDomains: updated });
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#f3f4f6',
                }}
              />
              <button
                className="btn btn-sm btn-error"
                onClick={() => setConfig({ ...config, searchDomains: config.searchDomains.filter((_, i) => i !== idx) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setConfig({ ...config, searchDomains: [...config.searchDomains, ''] })}
          >
            + Add Search Domain
          </button>
        </div>

        {/* Split DNS */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#d1d5db' }}>
            Split DNS (Domain-specific Nameservers)
          </label>
          {Object.entries(config.splitDns).map(([domain, servers], idx) => (
            <div key={idx} style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderLeft: '2px solid #374151', paddingLeft: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={domain}
                  placeholder="Domain (e.g., local.example.com)"
                  onChange={(e) => {
                    const newSplitDns = { ...config.splitDns };
                    delete newSplitDns[domain];
                    newSplitDns[e.target.value] = servers;
                    setConfig({ ...config, splitDns: newSplitDns });
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    color: '#f3f4f6',
                  }}
                />
                <button
                  className="btn btn-sm btn-error"
                  onClick={() => {
                    const newSplitDns = { ...config.splitDns };
                    delete newSplitDns[domain];
                    setConfig({ ...config, splitDns: newSplitDns });
                  }}
                >
                  Remove
                </button>
              </div>
              {servers.map((server, sidx) => (
                <div key={sidx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', marginLeft: '1rem' }}>
                  <input
                    type="text"
                    value={server}
                    placeholder="Nameserver IP"
                    onChange={(e) => {
                      const newServers = [...servers];
                      newServers[sidx] = e.target.value;
                      setConfig({ ...config, splitDns: { ...config.splitDns, [domain]: newServers } });
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '0.375rem',
                      color: '#f3f4f6',
                    }}
                  />
                  <button
                    className="btn btn-sm btn-error"
                    onClick={() => {
                      const newServers = servers.filter((_, i) => i !== sidx);
                      setConfig({ ...config, splitDns: { ...config.splitDns, [domain]: newServers } });
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const newServers = [...servers, ''];
                  setConfig({ ...config, splitDns: { ...config.splitDns, [domain]: newServers } });
                }}
              >
                + Add Nameserver
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setConfig({ ...config, splitDns: { ...config.splitDns, 'domain.local': [''] } })}
          >
            + Add Split DNS Domain
          </button>
        </div>

        {/* DNS Records */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#d1d5db' }}>
            Extra DNS Records
          </label>
          {config.extraRecords.map((record, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
              <input
                type="text"
                value={record.name}
                placeholder="Name (e.g., server.local)"
                onChange={(e) => {
                  const updated = [...config.extraRecords];
                  updated[idx].name = e.target.value;
                  setConfig({ ...config, extraRecords: updated });
                }}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#f3f4f6',
                }}
              />
              <select
                value={record.type}
                onChange={(e) => {
                  const updated = [...config.extraRecords];
                  updated[idx].type = e.target.value as 'A' | 'AAAA' | 'CNAME' | 'MX';
                  setConfig({ ...config, extraRecords: updated });
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#f3f4f6',
                }}
              >
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
              </select>
              <input
                type="text"
                value={record.value}
                placeholder="Value (e.g., 192.168.1.1)"
                onChange={(e) => {
                  const updated = [...config.extraRecords];
                  updated[idx].value = e.target.value;
                  setConfig({ ...config, extraRecords: updated });
                }}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#f3f4f6',
                }}
              />
              <button
                className="btn btn-sm btn-error"
                onClick={() => setConfig({ ...config, extraRecords: config.extraRecords.filter((_, i) => i !== idx) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setConfig({ ...config, extraRecords: [...config.extraRecords, { name: '', type: 'A', value: '' }] })}
          >
            + Add DNS Record
          </button>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save DNS Config'}
          </button>
          <button className="btn btn-secondary" onClick={fetchDnsConfig} disabled={saving}>
            🔄 Reload
          </button>
        </div>
      </div>
    </div>
  );
};
