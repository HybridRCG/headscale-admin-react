/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import '../styles/Pages.css';

interface User {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  createdAt: string;
  provider: string;
}

interface Node {
  id: string;
  name: string;
  givenName: string;
  online: boolean;
  userId: string;
}

interface ApiKey {
  id: string;
  prefix: string;
  expiration: string;
  createdAt: string;
  lastSeen?: string;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userEmailMap, setUserEmailMap] = useState<Record<string, string>>({});
  const { user: authUser } = useAuthStore();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const shouldFilter = authUser?.role !== 'super_admin' && !manageableDomains.includes('*');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [apiKeys, setApiKeys] = useState<Map<string, ApiKey[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [apiKeyLabels, setApiKeyLabels] = useState<Record<string, string>>({});
  const [_apiKeyOwners, setApiKeyOwners] = useState<Record<string, string>>({});
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [addToMapping, setAddToMapping] = useState(true);
  const [loadingApiKeys, setLoadingApiKeys] = useState<Set<string>>(new Set());
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyModalContent, setApiKeyModalContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Lightweight toast
  const [toast, setToast] = useState<{ kind: 'success' | 'info' | 'error'; message: string } | null>(null);
  const showToast = (kind: 'success' | 'info' | 'error', message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchUsers();
    fetchNodes();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersResp, mappingResp] = await Promise.all([
        axios.get('/admin/api/headscale/api/v1/user'),
        axios.get('/admin/api/headscale/user-mapping').catch(() => ({ data: {} }))
      ]);
      setUsers(usersResp.data.users || []);
      setUserEmailMap(mappingResp.data || {});
      // Fetch API keys for all users
      await fetchAllApiKeys();
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllApiKeys = async () => {
    try {
      const [keyResp, labelResp] = await Promise.all([
        axios.get('/admin/api/headscale/api/v1/apikey'),
        axios.get('/admin/api/headscale/apikey/labels').catch(() => ({ data: { labels: {}, owners: {} } }))
      ]);
      const keys = keyResp.data.apiKeys || [];
      setApiKeys(new Map([['all', keys]]));
      setApiKeyLabels(labelResp.data?.labels || {});
      setApiKeyOwners(labelResp.data?.owners || {});
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const fetchNodes = async () => {
    try {
      const response = await axios.get('/admin/api/headscale/api/v1/node');
      setNodes(response.data.nodes || []);
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    try {
      await axios.post('/admin/api/headscale/user/create', { username: newUsername, email: newUserEmail });
      if (addToMapping) {
        const mapping = await axios.get('/admin/api/headscale/user-emails');
        const current = mapping.data && mapping.data.users
          ? mapping.data
          : { users: {}, api_key_labels: {} };
        current.users[newUsername] = {
          email: newUserEmail || '',
          role: newUserRole,
          manageable_domains: newUserRole === 'super_admin' ? ['*'] : newUserRole === 'group_admin' ? [] : []
        };
        await axios.post('/admin/api/headscale/user-emails', current);
        setUserEmailMap(current.users);
      }
      await fetchUsers();
      setShowCreateUser(false);
      setNewUsername('');
      setNewUserEmail('');
      setNewUserRole('user');
      setAddToMapping(true);
      showToast('success', `Created user "${newUsername}"`);
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Delete user "${userName}"?`)) return;
    try {
      await axios.delete(`/admin/api/headscale/api/v1/user/${userId}`);
      await fetchUsers();
      showToast('success', `Deleted user "${userName}"`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleCreateApiKey = async (userId: string, userName: string) => {
    setLoadingApiKeys(prev => new Set(prev).add(userId));
    try {
      const date = new Date();
      date.setDate(date.getDate() + 90);
      const response = await axios.post('/admin/api/headscale/api/v1/apikey', {
        expiration: date.toISOString(),
      });
      const fullKey = response.data.apiKey;
      setApiKeyModalContent(fullKey);
      setShowApiKeyModal(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchAllApiKeys();
      showToast('success', `Created API key for "${userName}"`);
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('Failed to create API key');
    } finally {
      setLoadingApiKeys(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const getUserNodes = (userId: string) => {
    return nodes.filter((n: any) => n.user?.id === userId);
  };

  const getUserApiKeys = (userId: string) => {
    return (apiKeys.get('all') || []);
  };

  const filteredUsers = users.filter((u) => {
    if (shouldFilter) {
      const email = u.email || userEmailMap[u.name] || '';
      if (!manageableDomains.some((d: string) => email.endsWith(d.replace('@', '')))) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.id.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || 
             (u.email && u.email.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) return <div className="page-container"><div className="loading">Loading users...</div></div>;

  return (
    <div className="page-container">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 2000,
          backgroundColor: toast.kind === 'success' ? '#064e3b' : toast.kind === 'error' ? '#7f1d1d' : '#1e3a5f',
          color: toast.kind === 'success' ? '#86efac' : toast.kind === 'error' ? '#fecaca' : '#bfdbfe',
          border: `1px solid ${toast.kind === 'success' ? '#10b981' : toast.kind === 'error' ? '#dc2626' : '#3b82f6'}`,
          borderRadius: '0.5rem',
          padding: '0.65rem 1rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          maxWidth: '420px',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span>{toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '✕' : 'ℹ'}</span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>×</button>
        </div>
      )}

      {/* ── API Key Modal ── */}
      {showApiKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#1f2937',
            border: '2px solid #10b981',
            borderRadius: '0.5rem',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
          }}>
            <h2 style={{ color: '#f3f4f6', marginBottom: '1rem' }}>🔑 API Key Created</h2>
            <p style={{ color: '#d1d5db', marginBottom: '1rem' }}>
              Copy this API key and save it somewhere safe. You won't be able to see it again:
            </p>
            <div style={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '0.25rem',
              padding: '1rem',
              marginBottom: '1rem',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: '#10b981',
              userSelect: 'all',
            }}>
              {apiKeyModalContent}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                navigator.clipboard.writeText(apiKeyModalContent);
                setShowApiKeyModal(false);
                showToast('success', 'API key copied to clipboard!');
              }}
              style={{ width: '100%' }}
            >
              ✓ Copy & Close
            </button>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-success" onClick={() => setShowCreateUser(!showCreateUser)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          ➕ New User
        </button>
        <input
          type="text"
          placeholder="🔍 Search user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '180px', padding: '0.4rem 0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.85rem' }}
        />
        <button className="btn btn-secondary" onClick={fetchUsers} disabled={loading} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── Create User Form ── */}
      {showCreateUser && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Username..." autoFocus
                style={{ width: '150px', height: '36px', padding: '0 0.75rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@example.com"
                style={{ width: '200px', height: '36px', padding: '0 0.75rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
              <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}
                style={{ height: '36px', padding: '0 0.75rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                <option value="user">User</option>
                <option value="group_admin">Group Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-sm btn-success" onClick={handleCreateUser}>Create</button>
              <button className="btn btn-sm btn-secondary" onClick={() => { setShowCreateUser(false); setNewUsername(''); setNewUserEmail(''); }}>Cancel</button>
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={addToMapping} onChange={e => setAddToMapping(e.target.checked)} />
              Add to login mapping
            </label>
          </div>
        </div>
      )}

      {/* ── User Cards Grid ── */}
      {filteredUsers.length === 0 ? (
        <div className="no-results">{searchQuery ? `No users match "${searchQuery}"` : 'No users found'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
          {filteredUsers.map((user) => {
            const userNodes = getUserNodes(user.id);
            const userKeys = getUserApiKeys(user.id);
            const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            const email = user.email || userEmailMap[user.name] || '—';

            return (
              <div key={user.id} style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '0.625rem',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Header */}
                <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid #374151' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f3f4f6', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.name}>
                        {user.name}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.68rem', marginTop: '0.1rem' }}>ID {user.id}</div>
                    </div>
                    <button onClick={() => handleDeleteUser(user.id, user.name)} className="btn btn-sm btn-error" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', flexShrink: 0, marginLeft: '0.5rem' }}>🗑</button>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginBottom: '0.2rem' }}>📅 {createdDate}</div>
                  <div style={{ color: '#93c5fd', fontSize: '0.7rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={email}>{email}</div>
                </div>

                {/* Content */}
                <div style={{ padding: '0.75rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                  {/* API Keys */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>API Keys ({userKeys.length})</div>
                    {userKeys.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>None</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                        {userKeys.map(key => (
                          <div key={key.id} style={{ fontSize: '0.7rem', backgroundColor: '#111827', padding: '0.3rem 0.4rem', borderRadius: '0.25rem', color: '#93c5fd', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${key.prefix}... (expires ${new Date(key.expiration).toLocaleDateString()})`}>
                            {key.prefix}...
                          </div>
                        ))}
                      </div>
                    )}
                    {authUser?.role === 'super_admin' && (
                      <button className="btn btn-sm btn-success" onClick={() => handleCreateApiKey(user.id, user.name)} disabled={loadingApiKeys.has(user.id)} style={{ marginTop: '0.4rem', fontSize: '0.65rem', padding: '0.25rem 0.5rem', width: '100%' }}>
                        {loadingApiKeys.has(user.id) ? '...' : '+ Add Key'}
                      </button>
                    )}
                  </div>

                  {/* Connected Nodes */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>Nodes ({userNodes.length})</div>
                    {userNodes.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>None</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                        {userNodes.map(node => (
                          <div key={node.id} style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#111827', padding: '0.3rem 0.4rem', borderRadius: '0.25rem', color: '#d1d5db', overflow: 'hidden' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: node.online ? '#10b981' : '#6b7280', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.givenName}>{node.givenName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
