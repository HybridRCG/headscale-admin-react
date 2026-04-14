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
  const { user: authUser } = useAuthStore();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const shouldFilter = authUser?.role !== 'super_admin' && !manageableDomains.includes('*');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [apiKeys, setApiKeys] = useState<Map<string, ApiKey[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [renamingUserId, setRenamingUserId] = useState<string | null>(null);
  const [editingEmailUserId, setEditingEmailUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMethod, setSortMethod] = useState<'id' | 'name'>('id');
  const [sortDirection, setSortDirection] = useState<'up' | 'down'>('up');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [loadingApiKeys, setLoadingApiKeys] = useState<Set<string>>(new Set());
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyModalContent, setApiKeyModalContent] = useState('');
  const [showEmailNote, setShowEmailNote] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchNodes();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/api/headscale/api/v1/user');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
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

  const fetchApiKeysForUser = async (userId: string) => {
    setLoadingApiKeys(prev => new Set(prev).add(userId));
    try {
      const response = await axios.get('/admin/api/headscale/api/v1/apikey');
      setApiKeys(prev => new Map(prev).set(userId, response.data.apiKeys || []));
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoadingApiKeys(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    try {
      await axios.post('/admin/api/headscale/user/create', { username: newUsername, email: newUserEmail });
      await fetchUsers();
      setShowCreateUser(false);
      setNewUsername('');
      setNewUserEmail('');
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Failed to create user');
    }
  };

  const handleUpdateEmail = async (userId: string, username: string) => {
    if (!newEmail.trim()) {
      alert('Email cannot be empty');
      return;
    }
    try {
      console.log(`Updating email for ${username} to ${newEmail}`);
      await axios.post('/admin/api/headscale/user/update-email', { username, email: newEmail });
      await fetchUsers();
      setEditingEmailUserId(null);
      setNewEmail('');
    } catch (error) {
      console.error('Failed to update email:', error);
      alert('Failed to update email');
    }
  };

  const handleCreateApiKey = async (userId: string) => {
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
      await fetchApiKeysForUser(userId);
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('Failed to create API key');
    }
  };

  const handleExpireApiKey = async (userId: string, prefix: string) => {
    try {
      await axios.post('/admin/api/headscale/api/v1/apikey/expire', { prefix });
      await fetchApiKeysForUser(userId);
    } catch (error) {
      console.error('Failed to expire API key:', error);
      alert('Failed to expire API key');
    }
  };

  const handleRenameUser = async (userId: string) => {
    if (!newName.trim()) return;
    try {
      await axios.post(`/api/headscale/api/v1/user/${userId}/rename/${newName}`);
      await fetchUsers();
      setRenamingUserId(null);
      setNewName('');
    } catch (error) {
      console.error('Failed to rename user:', error);
      alert('Failed to rename user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await axios.delete(`/api/headscale/api/v1/user/${userId}`);
      await fetchUsers();
      setDeletingUserId(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const getUserNodes = (userId: string) => {
    return nodes.filter((n: any) => n.user?.id === userId);
  };

  const getSortedAndFilteredUsers = () => {
    let filtered = users.filter((u) =>
      (!shouldFilter || manageableDomains.some((d: string) => u.email?.endsWith(d.replace('@','')))) &&
      (
        u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    );

    const sorted = [...filtered].sort((a, b) => {
      let aVal = sortMethod === 'id' ? a.id : a.name;
      let bVal = sortMethod === 'id' ? b.id : b.name;
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'up' ? comparison : -comparison;
    });
    return sorted;
  };

  const toggleSort = (method: 'id' | 'name') => {
    if (sortMethod === method) {
      setSortDirection(sortDirection === 'up' ? 'down' : 'up');
    } else {
      setSortMethod(method);
      setSortDirection('up');
    }
  };

  const filteredUsers = getSortedAndFilteredUsers();

  return (
    <div className="page-container">
      <h1 className="page-title">Users</h1>

      {/* API Key Modal */}
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
                alert('API key copied to clipboard!');
              }}
              style={{ width: '100%' }}
            >
              ✓ Copy & Close
            </button>
          </div>
        </div>
      )}

      {/* Create User Section */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151' }}>
        {showCreateUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>
                Username (required):
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: '0.25rem',
                  color: '#f3f4f6',
                  fontSize: '1rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>
                Email (optional):
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: '0.25rem',
                  color: '#f3f4f6',
                  fontSize: '1rem',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-sm btn-success"
                onClick={handleCreateUser}
              >
                Create User
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setShowCreateUser(false);
                  setNewUsername('');
                  setNewUserEmail('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateUser(true)}
          >
            ➕ Create New User
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="🔍 Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '0.5rem',
            color: '#f3f4f6',
            fontSize: '1rem',
          }}
        />
      </div>

      {/* Sort Controls */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-primary"
          onClick={() => toggleSort('id')}
          style={{ fontWeight: sortMethod === 'id' ? 'bold' : 'normal' }}
        >
          {sortMethod === 'id' ? '📊 ' : ''} ID {sortDirection === 'up' ? '↑' : '↓'}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => toggleSort('name')}
          style={{ fontWeight: sortMethod === 'name' ? 'bold' : 'normal' }}
        >
          {sortMethod === 'name' ? '📊 ' : ''} Name {sortDirection === 'up' ? '↑' : '↓'}
        </button>
        <button className="btn btn-primary" onClick={fetchUsers} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="no-results">
          {searchQuery ? `No users match "${searchQuery}"` : 'No users found'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '0.5rem',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#111827',
                  borderBottom: expandedUserId === user.id ? '1px solid #374151' : 'none',
                }}
              >
                <div
                  onClick={() =>
                    setExpandedUserId(expandedUserId === user.id ? null : user.id)
                  }
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flex: 1,
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.5rem',
                      transition: 'transform 0.2s',
                      transform: expandedUserId === user.id ? 'rotate(180deg)' : 'rotate(0deg)',
                      minWidth: '24px',
                    }}
                  >
                    ▼
                  </div>
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#f3f4f6' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      {user.email || '⚠️ No email (viewer only)'} • ID: {user.id}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  {renamingUserId === user.id ? (
                    <>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New name..."
                        autoFocus
                        style={{
                          padding: '0.4rem 0.6rem',
                          backgroundColor: '#374151',
                          border: '1px solid #4b5563',
                          borderRadius: '0.25rem',
                          color: '#f3f4f6',
                          fontSize: '0.75rem',
                          minWidth: '120px',
                        }}
                      />
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleRenameUser(user.id)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setRenamingUserId(null);
                          setNewName('');
                        }}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setRenamingUserId(user.id);
                        setNewName(user.name);
                      }}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      ✏️
                    </button>
                  )}

                  {deletingUserId === user.id ? (
                    <>
                      <button
                        className="btn btn-sm btn-error"
                        onClick={() => handleDeleteUser(user.id)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setDeletingUserId(null)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm btn-error"
                      onClick={() => setDeletingUserId(user.id)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* Expandable Content */}
              {expandedUserId === user.id && (
                <div style={{ padding: '1.5rem', borderTop: '1px solid #374151' }}>
                  {/* Display Name */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#d1d5db' }}>
                      Display Name:
                    </label>
                    <div style={{ color: '#f3f4f6' }}>
                      {user.displayName || 'Not set'}
                    </div>
                  </div>

                  {/* Email - EDITABLE */}
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #374151' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#d1d5db' }}>
                      Email (determines user role in ACL):
                    </label>
                    {editingEmailUserId === user.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="user@example.com"
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            backgroundColor: '#374151',
                            border: '1px solid #4b5563',
                            borderRadius: '0.25rem',
                            color: '#f3f4f6',
                            fontSize: '0.875rem',
                          }}
                        />
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleUpdateEmail(user.id, user.name)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setEditingEmailUserId(null);
                            setNewEmail('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: user.email ? '#f3f4f6' : '#ef5350', fontSize: '0.875rem' }}>
                          {user.email || '⚠️ Not set (user will be viewer)'}
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setEditingEmailUserId(user.id);
                            setNewEmail(user.email || '');
                          }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Provider */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#d1d5db' }}>
                      Provider:
                    </label>
                    <div style={{ color: '#f3f4f6' }}>{user.provider || 'Local'}</div>
                  </div>

                  {/* Created At */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#d1d5db' }}>
                      Created:
                    </label>
                    <div style={{ color: '#f3f4f6', fontSize: '0.875rem' }}>
                      {new Date(user.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* API Keys Section */}
                  <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #374151' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#d1d5db' }}>
                      API Keys:
                    </label>
                    {loadingApiKeys.has(user.id) ? (
                      <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading...</div>
                    ) : apiKeys.get(user.id) && apiKeys.get(user.id)!.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {apiKeys.get(user.id)!.map((key) => (
                          <div
                            key={key.id}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: '#374151',
                              borderRadius: '0.25rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                            }}
                          >
                            <div>
                              <div style={{ color: '#f3f4f6', fontFamily: 'monospace' }}>{key.prefix}</div>
                              <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                Expires: {new Date(key.expiration).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              className="btn btn-sm btn-error"
                              onClick={() => handleExpireApiKey(user.id, key.prefix)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              Expire
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.75rem' }}>No API keys</div>
                    )}
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => {
                        setExpandedUserId(user.id);
                        fetchApiKeysForUser(user.id);
                        handleCreateApiKey(user.id);
                      }}
                    >
                      ➕ Create API Key
                    </button>
                  </div>

                  {/* Associated Nodes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#d1d5db' }}>
                      Nodes ({getUserNodes(user.id).length}):
                    </label>
                    {getUserNodes(user.id).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {getUserNodes(user.id).map((node: any) => (
                          <div
                            key={node.id}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#374151',
                              borderRadius: '0.25rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                            }}
                          >
                            <span>{node.givenName} ({node.name})</span>
                            <span
                              style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: node.online ? '#10b981' : '#6b7280',
                              }}
                              title={node.online ? 'Online' : 'Offline'}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No nodes</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
