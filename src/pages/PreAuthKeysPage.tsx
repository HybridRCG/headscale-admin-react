/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import '../styles/Pages.css';

interface PreAuthKey {
  id: string;
  key: string;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  user: { id: string; name: string } | string;
  aclTags?: string[];
}

const API = '/admin/api/headscale';

const getUserName = (user: any): string => {
  if (!user) return 'Unknown';
  if (typeof user === 'string') return user;
  if (typeof user === 'object') return user.name || user.id || 'Unknown';
  return String(user);
};

export const PreAuthKeysPage: React.FC = () => {
  const { user: authUser } = useAuthStore();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const isSuperAdmin = authUser?.role === 'super_admin';

  const [keys, setKeys] = useState<PreAuthKey[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userEmailMap, setUserEmailMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [newReusable, setNewReusable] = useState(false);
  const [newEphemeral, setNewEphemeral] = useState(false);
  const [newExpiry, setNewExpiry] = useState(90);
  const [newKey, setNewKey] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'used' | 'expired'>('all');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch users first, then fetch keys per user
      const [usersResp, mappingResp] = await Promise.all([
        axios.get(`${API}/api/v1/user`),
        axios.get(`${API}/user-mapping`).catch(() => ({ data: {} }))
      ]);
      const allUsers = usersResp.data.users || [];
      setUsers(allUsers);
      setUserEmailMap(mappingResp.data || {});

      // Fetch all keys once - headscale v0.28 may ignore user param
      // Use the first available user's token to fetch all keys
      let allKeys: PreAuthKey[] = [];
      try {
        // Try fetching all keys without user filter
        const resp = await axios.get(`${API}/api/v1/preauthkey?user=${encodeURIComponent(allUsers[0]?.name || '')}`);
        const rawKeys = resp.data.preAuthKeys || [];
        // Each key has user object - use it to assign correctly, deduplicate by id
        const seen = new Set<string>();
        rawKeys.forEach((k: any) => {
          if (!seen.has(k.id)) {
            seen.add(k.id);
            allKeys.push(k);
          }
        });
      } catch(e) { console.error('Failed to fetch keys:', e); }
      setKeys(allKeys);
    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  const canManageUser = (username: string) => {
    if (isSuperAdmin) return true;
    const email = userEmailMap[username] || '';
    return manageableDomains.some(d => email.endsWith(d.replace('@', '')));
  };

  const visibleUsers = users.filter(u => canManageUser(u.name));

  const filteredKeys = keys.filter(k => {
    const uname = getUserName(k.user);
    if (!canManageUser(uname)) return false;
    if (filterUser !== 'all' && uname !== filterUser) return false;
    const expired = new Date(k.expiration) < new Date();
    if (filterStatus === 'active') return !k.used && !expired;
    if (filterStatus === 'used') return k.used;
    if (filterStatus === 'expired') return expired;
    return true;
  });

  const handleCreate = async () => {
    if (!newUser) return alert('Select a user');
    try {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + newExpiry);
      const resp = await axios.post('/admin/api/headscale/preauthkey/create', {
        userId: newUser,
        reusable: newReusable,
        ephemeral: newEphemeral,
        expiration: expDate.toISOString(),
        tags: []
      });
      setNewKey(resp.data.key || '');
      fetchAll();
    } catch (e: any) {
      alert('Failed: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleExpire = async (key: PreAuthKey) => {
    try {
      const uname = getUserName(key.user);
      console.log('[EXPIRE] id:', key.id, 'user:', uname);
      const resp = await axios.post('/admin/api/headscale/preauthkey/expire', { id: key.id, user: uname, key: key.key });
      console.log('[EXPIRE] response:', resp.data);
      fetchAll();
    } catch (e: any) {
      console.error('[EXPIRE] error:', e.response?.data || e.message);
      alert('Failed: ' + (e.response?.data?.message || e.message));
    }
  };

  const getStatus = (key: PreAuthKey) => {
    if (key.used) return { label: 'Used', color: '#9ca3af' };
    if (new Date(key.expiration) < new Date()) return { label: 'Expired', color: '#ef4444' };
    return { label: 'Active', color: '#10b981' };
  };

  return (
    <div className="page-container">

      {/* New key modal */}
      {newKey && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1f2937', border: '2px solid #10b981', borderRadius: '0.5rem', padding: '2rem', maxWidth: '600px', width: '90%' }}>
            <h2 style={{ color: '#f3f4f6', marginBottom: '1rem' }}>🔑 Pre-Auth Key Created</h2>
            <p style={{ color: '#d1d5db', marginBottom: '1rem' }}>Copy this key — it won't be shown again:</p>
            <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.25rem', padding: '1rem', marginBottom: '1rem', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', userSelect: 'all' }}>
              {newKey}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { navigator.clipboard.writeText(newKey); setNewKey(''); setShowCreate(false); alert('Copied!'); }}>
              ✓ Copy & Close
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ padding: '0.5rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6' }}>
          <option value="all">All Users</option>
          {visibleUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
        {(['all','active','used','expired'] as const).map(s => (
          <button key={s} className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
        ))}
        <button className="btn btn-primary" onClick={fetchAll} disabled={loading}>🔄</button>
        <button className="btn btn-success" onClick={() => setShowCreate(!showCreate)} style={{ marginLeft: 'auto' }}>➕ Create Key</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Left: User + Expiry */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ width: '180px' }}>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>User:</label>
                <select value={newUser} onChange={e => setNewUser(e.target.value)} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#f3f4f6' }}>
                  <option value="">Select...</option>
                  {visibleUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ width: '90px' }}>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Expires (days):</label>
                <input type="number" value={newExpiry} onChange={e => setNewExpiry(Number(e.target.value))} min={1} max={365}
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#f3f4f6' }} />
              </div>
            </div>
            {/* Right: Reusable + Ephemeral + Generate + Cancel */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d1d5db', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={newReusable} onChange={e => setNewReusable(e.target.checked)} /> Reusable
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d1d5db', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={newEphemeral} onChange={e => setNewEphemeral(e.target.checked)} /> Ephemeral
              </label>
              <button className="btn btn-success" onClick={handleCreate} disabled={!newUser}>Generate</button>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Keys table */}
      {loading ? <div className="loading">Loading...</div> : filteredKeys.length === 0 ? (
        <div className="no-results">No pre-auth keys found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#d1d5db', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #374151' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Key</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>User</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Reusable</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ephemeral</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Expires</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Created</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.map(key => {
                const status = getStatus(key);
                const isActive = status.label === 'Active';
                const uname = getUserName(key.user);
                return (
                  <tr key={key.id} style={{ borderBottom: '1px solid #374151' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{key.key.substring(0, 22)}...</td>
                    <td style={{ padding: '0.75rem', fontWeight: '600', color: '#60a5fa' }}>{uname}</td>
                    <td style={{ padding: '0.75rem' }}><span style={{ color: status.color, fontWeight: 'bold' }}>{status.label}</span></td>
                    <td style={{ padding: '0.75rem' }}>{key.reusable ? '✅' : '❌'}</td>
                    <td style={{ padding: '0.75rem' }}>{key.ephemeral ? '✅' : '❌'}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{new Date(key.expiration).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{new Date(key.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {isActive && (
                        <button className="btn btn-sm btn-error" onClick={() => handleExpire(key)}>Expire</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
