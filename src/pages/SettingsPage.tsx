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
  const [instances, setInstances] = useState<{payload: string; registeredAt: string; domain: string}[]>([]);
  const [showInstances, setShowInstances] = useState(false);
  const [aclHistory, setAclHistory] = useState<{filename: string; timestamp: string; savedBy: string}[]>([]);
  const [showAclHistory, setShowAclHistory] = useState(false);
  const [aclHistoryLoading, setAclHistoryLoading] = useState(false);
  const [aclPreview, setAclPreview] = useState<{filename: string; data: any} | null>(null);
  const [aclRestoring, setAclRestoring] = useState<string | null>(null);

  const fetchAclHistory = async () => {
    setAclHistoryLoading(true);
    try {
      const r = await axios.get(`${API}/headscale/acl/history`);
      setAclHistory(r.data || []);
    } catch { setAclHistory([]); }
    finally { setAclHistoryLoading(false); }
  };

  const handleAclPreview = async (filename: string) => {
    try {
      const r = await axios.get(`${API}/headscale/acl/history/${filename}`);
      setAclPreview({ filename, data: r.data });
    } catch { alert('Failed to load version'); }
  };

  const handleAclRestore = async (filename: string) => {
    if (!window.confirm(`Restore ACL policy from ${filename.replace('.json','')}?\nThis will overwrite the current policy.`)) return;
    setAclRestoring(filename);
    try {
      const r = await axios.get(`${API}/headscale/acl/history/${filename}`);
      await axios.post(`${API}/headscale/acl`, r.data);
      alert('✅ ACL policy restored successfully');
      setAclPreview(null);
    } catch (e: any) {
      alert('Failed to restore: ' + (e.response?.data?.message || e.message));
    } finally { setAclRestoring(null); }
  };

  const handleAclDelete = async (filename: string) => {
    if (!window.confirm(`Delete this history entry?`)) return;
    try {
      await axios.delete(`${API}/headscale/acl/history/${filename}`);
      fetchAclHistory();
    } catch (e: any) { alert('Failed to delete: ' + (e.response?.data?.message || e.message)); }
  };

  const formatAclTs = (ts: string) => {
    try {
      const date = ts.slice(0, 10);
      const time = ts.length > 11 ? ts.slice(11, 19).replace(/-/g, ':') : '00:00:00';
      const d = new Date(`${date}T${time}Z`);
      return isNaN(d.getTime()) ? ts : d.toLocaleString();
    } catch { return ts; }
  };

  const fetchData = () => {
    axios.get(`${API}/instances`).then(r => {
      if (Array.isArray(r.data)) setInstances(r.data);
    }).catch(() => {});
    axios.get(`${API}/registration`).then(r => {
      if (r.data.registered) {
        setRegistered(true);
        setRegPayload(r.data.payload || '');
      } else {
        setRegistered(false);
        setRegPayload('');
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUnregister = async () => {
    if (!window.confirm('Unregister this instance? The Buy Me a Coffee button will reappear.')) return;
    try {
      await axios.post(`${API}/unregister`);
      setRegistered(false);
      setRegPayload('');
      window.dispatchEvent(new Event('registration-changed'));
      fetchData();
    } catch (e: any) {
      alert('Failed to unregister: ' + (e.response?.data?.message || e.message));
    }
  };

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
      fetchData();
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
        {!registered && (
          <div style={{ marginBottom: '1rem', padding: '1rem 1.25rem', backgroundColor: '#1c1f2e', border: '1px solid #FFDD00', borderRadius: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>☕</span>
            <div>
              <div style={{ color: '#FFDD00', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.35rem' }}>Support HS React — Get a License Key</div>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', lineHeight: '1.6' }}>
                Buy Me a Coffee to receive a license key. Registering your instance:
              </div>
              <ul style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.4rem', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
                <li>Removes the ☕ Buy Me a Coffee button from the footer</li>
                <li>Entitles you to request updates and new features</li>
                <li>Supports continued development of HS React</li>
              </ul>
              <a href="https://buymeacoffee.com/hybridrcg" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem', backgroundColor: '#FFDD00', color: '#000', padding: '0.45rem 1.1rem', borderRadius: '0.5rem', fontWeight: '800', fontSize: '0.85rem', textDecoration: 'none' }}>
                ☕ Buy Me a Coffee → Get License Key
              </a>
            </div>
          </div>
        )}
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: `1px solid ${registered ? '#10b981' : '#374151'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.75rem' }}>{registered ? '✅' : '🔑'}</span>
              <div>
                <div style={{ color: '#f3f4f6', fontWeight: '600', fontSize: '0.95rem' }}>
                  {registered
                    ? <span>Registered <span style={{ color: '#10b981', fontSize: '1rem', fontWeight: '800' }}>✓</span></span>
                    : 'Unregistered'}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  {registered
                    ? <span>Licensed to: <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.9rem' }}>{regPayload.replace(/-\d{4}$/, '').replace(/-/g, ' ')}</span></span>
                    : <span>Enter your license key to register this instance. <a href="https://buymeacoffee.com/hybridrcg" target="_blank" rel="noopener noreferrer" style={{ color: '#FFDD00', fontWeight: '700' }}>☕ Buy Me a Coffee</a> to get a key.</span>}
                </div>
              </div>
            </div>
            {registered ? (
              <button onClick={handleUnregister}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#d1d5db', border: '1px solid #4b5563', borderRadius: '0.375rem', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}>
                Unregister
              </button>
            ) : (
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

      {/* Registered Instances */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Registered Instances</div>
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showInstances && instances.length > 0 ? '1rem' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🌐</span>
              <div>
                <div style={{ color: '#f3f4f6', fontWeight: '600', fontSize: '0.95rem' }}>{instances.length} Registered Instance{instances.length !== 1 ? 's' : ''}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.2rem' }}>Instances that have registered with a license key</div>
              </div>
            </div>
            {instances.length > 0 && (
              <button onClick={() => setShowInstances(!showInstances)}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#d1d5db', border: '1px solid #4b5563', borderRadius: '0.375rem', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}>
                {showInstances ? 'Hide' : 'View'}
              </button>
            )}
          </div>
          {showInstances && instances.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #374151' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#9ca3af' }}>Client</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#9ca3af' }}>Domain</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#9ca3af' }}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((inst, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#f3f4f6', fontWeight: '600' }}>{inst.payload.replace(/-\d{4}$/, '').replace(/-/g, ' ')}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#60a5fa' }}>{inst.domain}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#9ca3af' }}>{new Date(inst.registeredAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ACL History */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>ACL History</div>
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📜</span>
              <div>
                <div style={{ color: '#f3f4f6', fontWeight: '600', fontSize: '0.95rem' }}>ACL Version History</div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.2rem' }}>Saved automatically on each Apply. View, restore or delete versions.</div>
              </div>
            </div>
            <button onClick={() => { setShowAclHistory(!showAclHistory); if (!showAclHistory) fetchAclHistory(); }}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#d1d5db', border: '1px solid #4b5563', borderRadius: '0.375rem', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}>
              {showAclHistory ? 'Hide' : 'View'}
            </button>
          </div>

          {showAclHistory && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <button onClick={fetchAclHistory} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}>🔄 Refresh</button>
              </div>
              {aclHistoryLoading ? (
                <div style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>Loading...</div>
              ) : aclHistory.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No history yet. Apply an ACL policy to start tracking.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {aclHistory.map((v, i) => (
                    <div key={v.filename} style={{ padding: '0.6rem 0.75rem', backgroundColor: '#111827', borderRadius: '0.375rem', border: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ backgroundColor: i === 0 ? '#1e3a5f' : '#374151', color: i === 0 ? '#60a5fa' : '#9ca3af', padding: '0.1rem 0.4rem', borderRadius: '0.2rem', fontSize: '0.68rem', fontWeight: '700' }}>
                          {i === 0 ? 'LATEST' : `v-${aclHistory.length - i}`}
                        </span>
                        <div>
                          <div style={{ color: '#f3f4f6', fontSize: '0.82rem', fontWeight: '600' }}>{formatAclTs(v.timestamp || v.filename?.slice(0,19) || '?')}</div>
                          <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Saved by: {(v.savedBy || 'unknown').replace(/_/g, ' ')}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => handleAclPreview(v.filename)}
                          style={{ padding: '0.25rem 0.6rem', backgroundColor: '#374151', color: '#d1d5db', border: '1px solid #4b5563', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>👁 View</button>
                        <button onClick={() => handleAclRestore(v.filename)} disabled={aclRestoring === v.filename || i === 0}
                          style={{ padding: '0.25rem 0.6rem', backgroundColor: i === 0 ? '#374151' : '#1e3a5f', color: i === 0 ? '#6b7280' : '#60a5fa', border: '1px solid #4b5563', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: i === 0 ? 'not-allowed' : 'pointer' }}
                          title={i === 0 ? 'Already the current version' : 'Restore this version'}>
                          {aclRestoring === v.filename ? '...' : '↩ Restore'}
                        </button>
                        <button onClick={() => handleAclDelete(v.filename)}
                          style={{ padding: '0.25rem 0.6rem', backgroundColor: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ACL Preview Modal */}
      {aclPreview && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '680px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#f3f4f6', margin: 0, fontSize: '0.95rem' }}>📜 {aclPreview.filename.replace('.json', '')}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleAclRestore(aclPreview.filename)}
                  style={{ padding: '0.35rem 0.75rem', backgroundColor: '#1e3a5f', color: '#60a5fa', border: '1px solid #3b82f6', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}>↩ Restore</button>
                <button onClick={() => setAclPreview(null)}
                  style={{ padding: '0.35rem 0.75rem', backgroundColor: '#374151', color: '#d1d5db', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>✕ Close</button>
              </div>
            </div>
            <pre style={{ flex: 1, overflow: 'auto', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#86efac', margin: 0 }}>
              {JSON.stringify(aclPreview.data, null, 2)}
            </pre>
          </div>
        </div>
      )}

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
