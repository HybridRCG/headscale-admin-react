import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import '../styles/Pages.css';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details?: string;
}

export const AuditLogPage: React.FC = () => {
  const { user: authUser } = useAuthStore();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const resp = await axios.get('/admin/api/headscale/audit-log');
      setLogs(resp.data || []);
    } catch (e) {
      console.error('Failed to fetch audit log:', e);
    } finally {
      setLoading(false);
    }
  };

  const actors = ['all', ...Array.from(new Set(logs.map(l => l.actor)))];
  const actions = ['all', ...Array.from(new Set(logs.map(l => l.action)))];

  const filtered = logs.filter(l => {
    if (filterActor !== 'all' && l.actor !== filterActor) return false;
    if (filterAction !== 'all' && l.action !== filterAction) return false;
    if (search && !JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const actionColor = (action: string) => {
    if (action.includes('delete') || action.includes('expire')) return '#ef4444';
    if (action.includes('create')) return '#10b981';
    if (action.includes('update') || action.includes('rename') || action.includes('label')) return '#f59e0b';
    if (action.includes('login')) return '#3b82f6';
    return '#9ca3af';
  };

  return (
    <div className="page-container">

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <input type="text" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6' }} />
        <select value={filterActor} onChange={e => setFilterActor(e.target.value)}
          style={{ padding: '0.5rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6' }}>
          {actors.map(a => <option key={a} value={a}>{a === 'all' ? 'All Users' : a}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          style={{ padding: '0.5rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6' }}>
          {actions.map(a => <option key={a} value={a}>{a === 'all' ? 'All Actions' : a}</option>)}
        </select>
        <button className="btn btn-primary" onClick={fetchLogs} disabled={loading}>🔄 Refresh</button>
      </div>

      {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? (
        <div className="no-results">No audit log entries found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(entry => (
            <div key={entry.id} style={{ padding: '0.75rem 1rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem', minWidth: '140px' }}>
                {new Date(entry.timestamp).toLocaleString()}
              </span>
              <span style={{ color: '#60a5fa', fontWeight: '600', minWidth: '80px' }}>{entry.actor}</span>
              <span style={{ color: actionColor(entry.action), fontWeight: 'bold', minWidth: '120px', textTransform: 'uppercase', fontSize: '0.75rem' }}>{entry.action}</span>
              <span style={{ color: '#d1d5db', flex: 1 }}>{entry.target}</span>
              {entry.details && <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{entry.details}</span>}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.75rem' }}>
        Showing {filtered.length} of {logs.length} entries
      </div>
    </div>
  );
};
