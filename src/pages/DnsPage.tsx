import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Pages.css';

interface DnsRecord { name: string; type: 'A' | 'AAAA' | 'CNAME' | 'MX'; value: string; }
interface DnsConfig {
  tailnetName: string; magicDns: boolean; overrideLocalDns: boolean;
  nameservers: string[]; searchDomains: string[];
  splitDns: Record<string, string[]>; extraRecords: DnsRecord[];
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '0.4rem 0.6rem', backgroundColor: '#1f2937',
  border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem',
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{children}</div>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>{children}</div>
);

export const DnsPage: React.FC = () => {
  const [config, setConfig] = useState<DnsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchDnsConfig(); }, []);

  const fetchDnsConfig = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/admin/api/config/dns');
      setConfig(r.data); setError('');
    } catch { setError('Failed to fetch DNS config'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await axios.post('/admin/api/config/dns', config);
      setError(''); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { setError('Failed to save DNS config'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="page-container"><div className="loading">Loading DNS config...</div></div>;
  if (!config) return <div className="page-container"><div style={{ color: '#ef5350' }}>Failed to load DNS configuration</div></div>;

  return (
    <div className="page-container" style={{ paddingTop: 0 }}>

      {/* Sticky toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#111827', borderBottom: '1px solid #374151', padding: '0.75rem 0', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: '130px' }}>
          {saving ? 'Saving...' : saved ? '✓ Saved!' : '💾 Save DNS Config'}
        </button>
        <button className="btn btn-secondary" onClick={fetchDnsConfig} disabled={saving}>🔄 Reload</button>
        {error && <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</span>}
      </div>

      <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Tailnet Name */}
        <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem' }}>
          <SectionLabel>Tailnet Base Domain</SectionLabel>
          <input type="text" value={config.tailnetName} onChange={e => setConfig({ ...config, tailnetName: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
        </div>

        {/* Toggles */}
        <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={config.magicDns} onChange={e => setConfig({ ...config, magicDns: e.target.checked })} />
            <div>
              <div style={{ color: '#f3f4f6', fontWeight: '700', fontSize: '0.875rem' }}>Magic DNS</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Auto-register device names</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={config.overrideLocalDns} onChange={e => setConfig({ ...config, overrideLocalDns: e.target.checked })} />
            <div>
              <div style={{ color: '#f3f4f6', fontWeight: '700', fontSize: '0.875rem' }}>Override Local DNS</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Push tailnet nameservers to devices</div>
            </div>
          </label>
        </div>

        {/* Nameservers */}
        <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem' }}>
          <SectionLabel>Global Nameservers</SectionLabel>
          {config.nameservers.map((ns, idx) => (
            <Row key={idx}>
              <input type="text" value={ns} onChange={e => { const u = [...config.nameservers]; u[idx] = e.target.value; setConfig({ ...config, nameservers: u }); }} style={inputStyle} placeholder="e.g. 1.1.1.1" />
              <button className="btn btn-sm btn-error" onClick={() => setConfig({ ...config, nameservers: config.nameservers.filter((_, i) => i !== idx) })}>✕</button>
            </Row>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={() => setConfig({ ...config, nameservers: [...config.nameservers, ''] })}>+ Add</button>
        </div>

        {/* Search Domains */}
        <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem' }}>
          <SectionLabel>Search Domains</SectionLabel>
          {config.searchDomains.map((d, idx) => (
            <Row key={idx}>
              <input type="text" value={d} onChange={e => { const u = [...config.searchDomains]; u[idx] = e.target.value; setConfig({ ...config, searchDomains: u }); }} style={inputStyle} placeholder="e.g. company.local" />
              <button className="btn btn-sm btn-error" onClick={() => setConfig({ ...config, searchDomains: config.searchDomains.filter((_, i) => i !== idx) })}>✕</button>
            </Row>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={() => setConfig({ ...config, searchDomains: [...config.searchDomains, ''] })}>+ Add</button>
        </div>

        {/* Split DNS */}
        <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem' }}>
          <SectionLabel>Split DNS</SectionLabel>
          {Object.entries(config.splitDns).map(([domain, servers], idx) => (
            <div key={idx} style={{ marginBottom: '0.75rem', paddingLeft: '0.75rem', borderLeft: '2px solid #374151' }}>
              <Row>
                <input type="text" value={domain} placeholder="domain.local" onChange={e => { const n = { ...config.splitDns }; delete n[domain]; n[e.target.value] = servers; setConfig({ ...config, splitDns: n }); }} style={{ ...inputStyle, fontWeight: '600' }} />
                <button className="btn btn-sm btn-error" onClick={() => { const n = { ...config.splitDns }; delete n[domain]; setConfig({ ...config, splitDns: n }); }}>✕</button>
              </Row>
              {servers.map((srv, sidx) => (
                <Row key={sidx}>
                  <div style={{ width: '16px' }} />
                  <input type="text" value={srv} placeholder="Nameserver IP" onChange={e => { const ns = [...servers]; ns[sidx] = e.target.value; setConfig({ ...config, splitDns: { ...config.splitDns, [domain]: ns } }); }} style={inputStyle} />
                  <button className="btn btn-sm btn-error" onClick={() => { const ns = servers.filter((_, i) => i !== sidx); setConfig({ ...config, splitDns: { ...config.splitDns, [domain]: ns } }); }}>✕</button>
                </Row>
              ))}
              <button className="btn btn-sm btn-secondary" style={{ marginLeft: '24px', marginTop: '0.25rem' }} onClick={() => setConfig({ ...config, splitDns: { ...config.splitDns, [domain]: [...servers, ''] } })}>+ Add NS</button>
            </div>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={() => setConfig({ ...config, splitDns: { ...config.splitDns, 'domain.local': [''] } })}>+ Add Domain</button>
        </div>

        {/* Extra Records */}
        <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem' }}>
          <SectionLabel>Extra DNS Records</SectionLabel>
          {config.extraRecords.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 2fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '700' }}>NAME</div>
              <div style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '700' }}>TYPE</div>
              <div style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '700' }}>VALUE</div>
              <div />
            </div>
          )}
          {config.extraRecords.map((rec, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 2fr auto', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
              <input type="text" value={rec.name} placeholder="server.local" onChange={e => { const u = [...config.extraRecords]; u[idx] = { ...u[idx], name: e.target.value }; setConfig({ ...config, extraRecords: u }); }} style={inputStyle} />
              <select value={rec.type} onChange={e => { const u = [...config.extraRecords]; u[idx] = { ...u[idx], type: e.target.value as any }; setConfig({ ...config, extraRecords: u }); }} style={{ ...inputStyle, flex: 'unset' }}>
                <option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option>
              </select>
              <input type="text" value={rec.value} placeholder="192.168.1.1" onChange={e => { const u = [...config.extraRecords]; u[idx] = { ...u[idx], value: e.target.value }; setConfig({ ...config, extraRecords: u }); }} style={inputStyle} />
              <button className="btn btn-sm btn-error" onClick={() => setConfig({ ...config, extraRecords: config.extraRecords.filter((_, i) => i !== idx) })}>✕</button>
            </div>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={() => setConfig({ ...config, extraRecords: [...config.extraRecords, { name: '', type: 'A', value: '' }] })}>+ Add Record</button>
        </div>

      </div>
    </div>
  );
};
