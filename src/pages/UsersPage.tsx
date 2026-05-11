/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/Pages.css';

interface User {
  id: string;
  name: string;
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
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userEmailMap, setUserEmailMap] = useState<Record<string, string>>({});
  const { user: authUser } = useAuthStore();
  const navigate = useNavigate();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const shouldFilter = authUser?.role !== 'super_admin' && !manageableDomains.includes('*');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [apiKeysByUser, setApiKeysByUser] = useState<Record<string, ApiKey[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [renamingUserId, setRenamingUserId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyModalContent, setApiKeyModalContent] = useState('');
  const [showApiKeysManagerModal, setShowApiKeysManagerModal] = useState<string | null>(null);
  const [userApiKeysInModal, setUserApiKeysInModal] = useState<ApiKey[]>([]);

  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const showToast = (kind: 'success' | 'error', message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersResp, mappingResp, nodesResp, keysResp, labelsResp] = await Promise.all([
        axios.get('/admin/api/headscale/api/v1/user'),
        axios.get('/admin/api/headscale/user-mapping').catch(() => ({ data: {} })),
        axios.get('/admin/api/headscale/api/v1/node'),
        axios.get('/admin/api/headscale/api/v1/apikey'),
        axios.get('/admin/api/headscale/apikey/labels').catch(() => ({ data: { labels: {} } })),
      ]);
      
      setUsers(usersResp.data.users || []);
      setUserEmailMap(mappingResp.data || {});
      setNodes(nodesResp.data.nodes || []);

      const allKeys: ApiKey[] = keysResp.data.apiKeys || [];
      const keysByOwner: Record<string, ApiKey[]> = {};
      (usersResp.data.users || []).forEach((u: User) => { keysByOwner[u.id] = []; });
      
      const labels = labelsResp.data?.labels || {};
      const now = new Date();
      allKeys.forEach((key: ApiKey) => {
        // Skip expired keys
        if (new Date(key.expiration) < now) return;
        const label = labels[key.prefix] || '';
        const matchedUser = (usersResp.data.users || []).find((u: User) => 
          label.toLowerCase().includes(u.name.toLowerCase())
        );
        if (matchedUser) { keysByOwner[matchedUser.id].push(key); }
      });
      setApiKeysByUser(keysByOwner);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    try {
      await axios.post('/admin/api/headscale/user/create', { username: newUsername, email: newUserEmail });
      await fetchAll();
      setShowCreateUser(false);
      setNewUsername('');
      setNewUserEmail('');
      showToast('success', `Created user "${newUsername}"`);
    } catch (error) {
      alert('Failed to create user');
    }
  };

  const handleRenameUser = async (userId: string, currentName: string) => {
    if (!renameInput.trim() || renameInput === currentName) {
      setRenamingUserId(null);
      return;
    }
    setRenaming(true);
    try {
      await axios.post(`/admin/api/headscale/api/v1/user/${userId}/rename/${encodeURIComponent(renameInput.trim())}`);
      await fetchAll();
      setRenamingUserId(null);
      setRenameInput('');
      showToast('success', `Renamed to "${renameInput.trim()}"`);
    } catch (e: any) {
      alert('Rename failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Delete user "${userName}"?`)) return;
    try {
      await axios.delete(`/admin/api/headscale/api/v1/user/${userId}`);
      await fetchAll();
      showToast('success', `Deleted user "${userName}"`);
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const handleCreateApiKey = async (userId: string, userName: string) => {
    try {
      const date = new Date();
      date.setDate(date.getDate() + 90);
      const response = await axios.post('/admin/api/headscale/api/v1/apikey', { expiration: date.toISOString() });
      setApiKeyModalContent(response.data.apiKey);
      setShowApiKeyModal(true);
      await fetchAll();
      showToast('success', `Created API key for "${userName}"`);
    } catch (error) {
      alert('Failed to create API key');
    }
  };

  const handleDeleteApiKey = async (prefix: string) => {
    if (!window.confirm(`Delete API key ${prefix}...?`)) return;
    try {
      await axios.delete(`/admin/api/headscale/api/v1/apikey/${prefix}`);
      await fetchAll();
      showToast('success', 'API key deleted');
    } catch (error) {
      alert('Failed to delete API key');
    }
  };

  const getUserNodes = (userId: string) => {
    return nodes.filter((n: any) => n.user?.id === userId);
  };

  const filteredUsers = users.filter((u) => {
    if (shouldFilter) {
      const email = u.email || userEmailMap[u.name] || '';
      if (!manageableDomains.some((d: string) => email.endsWith(d.replace('@', '')))) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.id.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) return <div className="page-container"><div className="loading">Loading users...</div></div>;

  return (
    <div className="page-container">
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 2000,
          backgroundColor: toast.kind === 'success' ? '#064e3b' : '#7f1d1d',
          color: toast.kind === 'success' ? '#86efac' : '#fecaca',
          border: `1px solid ${toast.kind === 'success' ? '#10b981' : '#dc2626'}`,
          borderRadius: '0.5rem', padding: '0.65rem 1rem', fontSize: '0.85rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span>{toast.kind === 'success' ? '✓' : '✕'}</span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
      )}

      {showApiKeyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1f2937', border: '2px solid #10b981', borderRadius: '0.5rem', padding: '2rem', maxWidth: '600px', width: '90%' }}>
            <h2 style={{ color: '#f3f4f6', marginBottom: '1rem' }}>🔑 API Key Created</h2>
            <p style={{ color: '#d1d5db', marginBottom: '1rem' }}>Copy and save this key safely:</p>
            <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.25rem', padding: '1rem', marginBottom: '1rem', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', userSelect: 'all' }}>
              {apiKeyModalContent}
            </div>
            <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(apiKeyModalContent); setShowApiKeyModal(false); showToast('success', 'Copied!'); }} style={{ width: '100%' }}>
              ✓ Copy & Close
            </button>
          </div>
        </div>
      )}

      {showApiKeysManagerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#f3f4f6', marginBottom: '1rem' }}>🔑 API Keys — {users.find(u => u.id === showApiKeysManagerModal)?.name}</h2>
            {userApiKeysInModal.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>No API keys</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {userApiKeysInModal.map(key => (
                  <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', backgroundColor: '#111827', borderRadius: '0.4rem', fontSize: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#93c5fd', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key.prefix}...</div>
                      <div style={{ color: '#6b7280', marginTop: '0.15rem' }}>Expires {new Date(key.expiration).toLocaleDateString()}</div>
                    </div>
                    <button className="btn btn-sm btn-error" onClick={() => handleDeleteApiKey(key.prefix)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-sm btn-success" onClick={() => handleCreateApiKey(showApiKeysManagerModal, users.find(u => u.id === showApiKeysManagerModal)?.name || '')} style={{ flex: 1 }}>
                ➕ Create Key
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowApiKeysManagerModal(null)} style={{ flex: 1 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-success" onClick={() => setShowCreateUser(!showCreateUser)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          ➕ New User
        </button>
        <input
          type="text"
          placeholder="🔍 Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '180px', padding: '0.4rem 0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.85rem' }}
        />
        <button className="btn btn-secondary" onClick={fetchAll} disabled={loading} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          🔄
        </button>
      </div>

      {showCreateUser && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Username..."
              style={{ width: '140px', height: '36px', padding: '0 0.75rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem' }} />
            <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Email"
              style={{ width: '180px', height: '36px', padding: '0 0.75rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem' }} />
            <button className="btn btn-sm btn-success" onClick={handleCreateUser}>Create</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowCreateUser(false)}>Cancel</button>
          </div>
        </div>
      )}

      {filteredUsers.length === 0 ? (
        <div className="no-results">No users</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {filteredUsers.map((user) => {
            const userNodes = getUserNodes(user.id);
            const userKeys = apiKeysByUser[user.id] || [];
            const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            const email = user.email || userEmailMap[user.name] || '—';

            return (
              <div key={user.id} style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '0.625rem',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid #374151' }}>
                  {renamingUserId === user.id ? (
                    <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                      <input type="text" value={renameInput} onChange={(e) => setRenameInput(e.target.value)} autoFocus
                        style={{ flex: 1, height: '32px', padding: '0 0.5rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#f3f4f6', fontSize: '0.85rem' }} />
                      <button className="btn btn-sm btn-success" onClick={() => handleRenameUser(user.id, user.name)} disabled={renaming} style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>✓</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setRenamingUserId(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ color: '#f3f4f6', fontWeight: 700, fontSize: '0.95rem' }}>{user.name}</div>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => { setRenamingUserId(user.id); setRenameInput(user.name); }} className="btn btn-sm btn-primary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}>✏️</button>
                        <button onClick={() => handleDeleteUser(user.id, user.name)} className="btn btn-sm btn-error" style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}>🗑</button>
                      </div>
                    </div>
                  )}
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.1rem' }}>ID {user.id}</div>
                  <div style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '0.1rem' }}>📅 {createdDate}</div>
                  <div style={{ color: '#93c5fd', fontSize: '0.7rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                </div>

                <div style={{ padding: '0.75rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>API Keys ({userKeys.length})</div>
                    {authUser?.role === 'super_admin' && (
                      <button className="btn btn-sm btn-primary" onClick={() => { setShowApiKeysManagerModal(user.id); setUserApiKeysInModal(userKeys); }} style={{ width: '100%', fontSize: '0.7rem', padding: '0.35rem 0.5rem' }}>
                        {userKeys.length === 0 ? '➕ Create' : '🔑 Manage'}
                      </button>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>Connected ({userNodes.length})</div>
                    {userNodes.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>None</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '100px', overflowY: 'auto' }}>
                        {userNodes.slice(0, 3).map(node => (
                          <div key={node.id} style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#d1d5db', cursor: 'pointer' }} onClick={() => navigate('/admin/nodes')} title={`Click to view ${node.givenName}`}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: node.online ? '#10b981' : '#6b7280' }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', color: '#93c5fd' }}>{node.givenName}</span>
                          </div>
                        ))}
                        {userNodes.length > 3 && <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>+{userNodes.length - 3} more</div>}
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
