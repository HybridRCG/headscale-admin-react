import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import '../styles/AclEditorPage.css';

const API_BASE = process.env.REACT_APP_API_URL || '/admin/api';

interface ACL {
  groups: { [key: string]: string[] };
  tagOwners: { [key: string]: string[] };
  hosts: { [key: string]: string };
  acls: Array<{ action: string; src: string[]; dst: string[]; proto?: string }>;
  ssh: Array<{ action: string; src: string[]; dst: string[] }>;
}

export const AclPage: React.FC = () => {
  const userEmail = useAuthStore((state) => state.user?.email || '');
  const tabs = [
    { icon: '👤', label: 'Users' },
    { icon: '👥', label: 'Groups' },
    { icon: '🏷️', label: 'Tag Owners' },
    { icon: '🖥️', label: 'Hosts' },
    { icon: '🔒', label: 'Policies' },
    { icon: '🔐', label: 'SSH' },
    { icon: '⚙️', label: 'Config' }
  ];

  const userRole = useAuthStore((state) => state.user?.role || 'user');
  console.log('[DEBUG AclPage] userRole:', userRole, 'user:', useAuthStore((state) => state.user));
  const visibleTabs = userRole === 'super_admin' ? tabs : [tabs[0]];
  const [acl, setAcl] = useState<ACL | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAcl();
  }, []);

  const fetchAcl = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/headscale/acl`);
      setAcl(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load ACL: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setAcl({ groups: {}, tagOwners: {}, hosts: {}, acls: [], ssh: [] });
    } finally {
      setLoading(false);
    }
  };

  const saveAcl = async () => {
    if (!acl) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/headscale/acl`, acl);
      alert('✅ ACL saved successfully!');
      setError('');
    } catch (err) {
      setError('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !acl) return <div className="acl-container"><p>Loading ACL...</p></div>;


  // Filter tabs based on user role


  return (
    <div className="acl-container">
      {error && <div className="error-box">{error}</div>}
      <div className="acl-tabs" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        {visibleTabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`tab ${activeTab === idx ? 'active' : ''}`}
            title={tab.label}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <button onClick={saveAcl} disabled={loading} className="btn-save" style={{ marginLeft: 'auto' }}>💾 Save ACL</button>
      </div>
      {acl && (
        <div className="acl-content">
          {activeTab === 0 && <UsersTab userEmail={userEmail} />}
          {activeTab === 1 && <GroupsTab acl={acl} setAcl={setAcl} />}
          {activeTab === 2 && <TagOwnersTab acl={acl} setAcl={setAcl} />}
          {activeTab === 3 && <HostsTab acl={acl} setAcl={setAcl} />}
          {activeTab === 4 && <PoliciesTab acl={acl} setAcl={setAcl} />}
          {activeTab === 5 && <SshTab acl={acl} setAcl={setAcl} />}
          {activeTab === 6 && <ConfigTab acl={acl} setAcl={setAcl} />}
        </div>
      )}
    </div>
  );
};

// GROUPS TAB - WITH ACCORDION
const GroupsTab: React.FC<{ acl: ACL; setAcl: (a: ACL) => void }> = ({ acl, setAcl }) => {
  const [newGroup, setNewGroup] = useState('');
  const [newMember, setNewMember] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  const handleCreateGroup = () => {
    if (!newGroup.trim()) return;
    setAcl({ ...acl, groups: { ...acl.groups, [newGroup]: [] } });
    setNewGroup('');
  };

  const handleAddMember = (groupName: string) => {
    if (!newMember.trim()) return;
    const updated = { ...acl };
    if (!updated.groups[groupName].includes(newMember)) {
      updated.groups[groupName].push(newMember);
      setAcl(updated);
      setNewMember('');
    }
  };

  const handleRemoveMember = (groupName: string, member: string) => {
    const updated = { ...acl };
    updated.groups[groupName] = updated.groups[groupName].filter(m => m !== member);
    setAcl(updated);
  };

  const handleDeleteGroup = (groupName: string) => {
    if (!window.confirm(`Delete group "${groupName}"?`)) return;
    const updated = { ...acl };
    delete updated.groups[groupName];
    setAcl(updated);
  };

  const handleRenameGroup = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const updated = { ...acl };
    updated.groups[newName] = updated.groups[oldName];
    delete updated.groups[oldName];
    setAcl(updated);
    setEditingGroup(null);
  };

  return (
    <div>
      <h2>Groups</h2>
      <div className="form-section">
        <h3>Create New Group</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="e.g., group:admins" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()} style={{ flex: 1 }} />
          <button onClick={handleCreateGroup} className="btn-create">➕ Create</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {Object.entries(acl.groups).map(([groupName, members]) => (
          <div key={groupName} className="group-card">
            <div className="accordion-header" onClick={() => setExpandedGroup(expandedGroup === groupName ? null : groupName)} style={{ cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0' }}>{groupName.replace(/^group:/,'')}</h3>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>{members.length} member{members.length !== 1 ? 's' : ''}</p>
              </div>
              <span className={`accordion-icon ${expandedGroup === groupName ? 'open' : ''}`}>▼</span>
            </div>

            {expandedGroup === groupName && (
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                {editingGroup === groupName ? (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600' }}>Rename:</label>
                    <input autoFocus type="text" defaultValue={groupName} onBlur={(e) => { if (e.target.value !== groupName) handleRenameGroup(groupName, e.target.value); else setEditingGroup(null); }} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameGroup(groupName, e.currentTarget.value); else if (e.key === 'Escape') setEditingGroup(null); }} />
                  </div>
                ) : (
                  <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                    <button onClick={() => setEditingGroup(groupName)} className="btn-create" style={{ flex: 1 }}>✏️ Rename</button>
                    <button onClick={() => handleDeleteGroup(groupName)} className="btn-delete">🗑️ Delete</button>
                  </div>
                )}

                <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '10px' }}>Members:</h4>
                {members.length === 0 ? <p style={{ fontSize: '13px', color: '#9ca3af' }}>No members</p> : (
                  <ul className="member-list" style={{ marginBottom: '15px' }}>
                    {members.map(m => (
                      <li key={m} className="member-item">
                        <span>{m}</span>
                        <button onClick={() => handleRemoveMember(groupName, m)} className="btn-delete">✕</button>
                      </li>
                    ))}
                  </ul>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="email" placeholder="Add member..." value={newMember} onChange={(e) => setNewMember(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddMember(groupName)} style={{ flex: 1 }} />
                  <button onClick={() => handleAddMember(groupName)} className="btn-create">➕ Add</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
const TagOwnersTab: React.FC<{ acl: ACL; setAcl: (a: ACL) => void }> = ({ acl, setAcl }) => {
  const [newTag, setNewTag] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  const handleCreateTag = () => {
    if (!newTag.trim()) return;
    setAcl({ ...acl, tagOwners: { ...acl.tagOwners, [newTag]: [] } });
    setNewTag('');
  };

  const handleAddOwner = (tagName: string) => {
    if (!newOwner.trim()) return;
    const updated = { ...acl };
    if (!updated.tagOwners[tagName].includes(newOwner)) {
      updated.tagOwners[tagName].push(newOwner);
      setAcl(updated);
      setNewOwner('');
    }
  };

  const handleRemoveOwner = (tagName: string, owner: string) => {
    const updated = { ...acl };
    updated.tagOwners[tagName] = updated.tagOwners[tagName].filter(o => o !== owner);
    setAcl(updated);
  };

  const handleDeleteTag = (tagName: string) => {
    if (!window.confirm(`Delete tag "${tagName}"?`)) return;
    const updated = { ...acl };
    delete updated.tagOwners[tagName];
    setAcl(updated);
  };

  return (
    <div>
      <h2>Tag Owners</h2>
      <div className="form-section">
        <h3>Create New Tag</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="e.g., tag:production"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            style={{ flex: 1 }}
          />
          <button onClick={handleCreateTag} className="btn-create">➕ Create</button>
        </div>
      </div>

      <div className="grid-cards">
        {Object.entries(acl.tagOwners).map(([tagName, owners]) => (
          <div key={tagName} className="tag-card">
            <div className="accordion-header" onClick={() => setExpandedTag(expandedTag === tagName ? null : tagName)}>
              <div>
                <h3>{tagName}</h3>
                <p>{owners.length} owner{owners.length !== 1 ? 's' : ''}</p>
              </div>
              <span className={`accordion-icon ${expandedTag === tagName ? 'open' : ''}`}>▼</span>
            </div>

            {expandedTag === tagName && (
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                <button onClick={() => handleDeleteTag(tagName)} className="btn-delete" style={{ width: '100%', marginBottom: '15px' }}>🗑️ Delete Tag</button>

                <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '10px' }}>Owners:</h4>
                {owners.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '15px' }}>No owners yet</p>
                ) : (
                  <ul className="member-list" style={{ marginBottom: '15px' }}>
                    {owners.map(o => (
                      <li key={o} className="member-item">
                        <span>{o}</span>
                        <button onClick={() => handleRemoveOwner(tagName, o)} className="btn-delete">✕</button>
                      </li>
                    ))}
                  </ul>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="e.g., group:admins"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOwner(tagName)}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => handleAddOwner(tagName)} className="btn-create">➕ Add</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// HOSTS TAB
const HostsTab: React.FC<{ acl: ACL; setAcl: (a: ACL) => void }> = ({ acl, setAcl }) => {
  const [newHost, setNewHost] = useState('');
  const [newIp, setNewIp] = useState('');

  const handleAddHost = () => {
    if (!newHost.trim() || !newIp.trim()) return;
    setAcl({ ...acl, hosts: { ...acl.hosts, [newHost]: newIp } });
    setNewHost('');
    setNewIp('');
  };

  const handleDeleteHost = (hostname: string) => {
    const updated = { ...acl };
    delete updated.hosts[hostname];
    setAcl(updated);
  };

  return (
    <div>
      <h2>Hosts</h2>
      <div className="form-section">
        <h3>Add Host Mapping</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px' }}>
          <input type="text" placeholder="Hostname" value={newHost} onChange={(e) => setNewHost(e.target.value)} />
          <input type="text" placeholder="IP Address" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
          <button onClick={handleAddHost} className="btn-create">➕ Add</button>
        </div>
      </div>

      {Object.keys(acl.hosts).length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 20px' }}>No hosts configured yet</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hostname</th>
                <th>IP Address</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(acl.hosts).map(([h, ip]) => (
                <tr key={h}>
                  <td>{h}</td>
                  <td style={{ fontFamily: 'monospace' }}>{ip}</td>
                  <td><button onClick={() => handleDeleteHost(h)} className="btn-delete">🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// POLICIES TAB
const PoliciesTab: React.FC<{ acl: ACL; setAcl: (a: ACL) => void }> = ({ acl, setAcl }) => {
  const [newPolicy, setNewPolicy] = useState({ action: 'accept', src: '', dst: '', proto: 'tcp' });
  const [expandedPolicy, setExpandedPolicy] = useState<number | null>(null);

  const handleCreatePolicy = () => {
    if (!newPolicy.src || !newPolicy.dst) return;
    const updated = { ...acl };
    updated.acls.push({
      action: newPolicy.action,
      src: newPolicy.src.split(',').map(s => s.trim()).filter(s => s),
      dst: newPolicy.dst.split(',').map(d => d.trim()).filter(d => d),
      proto: newPolicy.proto || undefined
    });
    setAcl(updated);
    setNewPolicy({ action: 'accept', src: '', dst: '', proto: 'tcp' });
  };

  const handleDeletePolicy = (idx: number) => {
    if (!window.confirm('Delete this policy?')) return;
    const updated = { ...acl };
    updated.acls.splice(idx, 1);
    setAcl(updated);
  };

  const handleReorderPolicy = (idx: number, direction: 'up' | 'down') => {
    if ((idx === 0 && direction === 'up') || (idx === acl.acls.length - 1 && direction === 'down')) return;
    const updated = { ...acl };
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [updated.acls[idx], updated.acls[targetIdx]] = [updated.acls[targetIdx], updated.acls[idx]];
    setAcl(updated);
  };

  return (
    <div>
      <h2>Policies</h2>
      <div className="form-section">
        <h3>Create New Policy</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <select value={newPolicy.action} onChange={(e) => setNewPolicy({ ...newPolicy, action: e.target.value as any })}>
            <option value="accept">✅ Accept</option>
            <option value="reject">❌ Reject</option>
          </select>
          <input type="text" placeholder="Source (comma-separated)" value={newPolicy.src} onChange={(e) => setNewPolicy({ ...newPolicy, src: e.target.value })} />
          <input type="text" placeholder="Destination (comma-separated)" value={newPolicy.dst} onChange={(e) => setNewPolicy({ ...newPolicy, dst: e.target.value })} />
          <select value={newPolicy.proto} onChange={(e) => setNewPolicy({ ...newPolicy, proto: e.target.value })}>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="">Any</option>
          </select>
        </div>
        <button onClick={handleCreatePolicy} className="btn-create" style={{ width: '100%' }}>➕ Create Policy</button>
      </div>

      {acl.acls.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 20px' }}>No policies configured yet</p>
      ) : (
        <div>
          {acl.acls.map((p, idx) => (
            <div key={idx} className="policy-card" style={{ marginBottom: '15px' }}>
              <div className="accordion-header" onClick={() => setExpandedPolicy(expandedPolicy === idx ? null : idx)}>
                <div>
                  <h3>Policy #{idx + 1} - {p.action === 'accept' ? '✅ Accept' : '❌ Reject'}</h3>
                  <p>{p.src.join(', ')} → {p.dst.join(', ')}</p>
                </div>
                <span className={`accordion-icon ${expandedPolicy === idx ? 'open' : ''}`}>▼</span>
              </div>
              {expandedPolicy === idx && (
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <div><strong>Source:</strong><p style={{ color: '#6b7280', margin: '5px 0' }}>{p.src.join(', ')}</p></div>
                    <div><strong>Destination:</strong><p style={{ color: '#6b7280', margin: '5px 0' }}>{p.dst.join(', ')}</p></div>
                    {p.proto && <div style={{ gridColumn: '1 / -1' }}><strong>Protocol:</strong><p style={{ color: '#6b7280', margin: '5px 0' }}>{p.proto}</p></div>}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleReorderPolicy(idx, 'up')} disabled={idx === 0} className="btn-create" style={{ flex: 1 }}>⬆️ Move Up</button>
                    <button onClick={() => handleReorderPolicy(idx, 'down')} disabled={idx === acl.acls.length - 1} className="btn-create" style={{ flex: 1 }}>⬇️ Move Down</button>
                    <button onClick={() => handleDeletePolicy(idx)} className="btn-delete">🗑️</button>
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

// SSH TAB
const SshTab: React.FC<{ acl: ACL; setAcl: (a: ACL) => void }> = ({ acl, setAcl }) => {
  const [newSsh, setNewSsh] = useState({ action: 'accept', src: '', dst: '' });

  const handleCreateSshRule = () => {
    if (!newSsh.src || !newSsh.dst) return;
    const updated = { ...acl };
    updated.ssh.push({
      action: newSsh.action,
      src: newSsh.src.split(',').map(s => s.trim()).filter(s => s),
      dst: newSsh.dst.split(',').map(d => d.trim()).filter(d => d)
    });
    setAcl(updated);
    setNewSsh({ action: 'accept', src: '', dst: '' });
  };

  const handleDeleteSshRule = (idx: number) => {
    if (!window.confirm('Delete this SSH rule?')) return;
    const updated = { ...acl };
    updated.ssh.splice(idx, 1);
    setAcl(updated);
  };

  return (
    <div>
      <h2>SSH Rules</h2>
      <div className="form-section">
        <h3>Create New SSH Rule</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <select value={newSsh.action} onChange={(e) => setNewSsh({ ...newSsh, action: e.target.value as any })}>
            <option value="accept">✅ Accept</option>
            <option value="reject">❌ Reject</option>
          </select>
          <input type="text" placeholder="Source" value={newSsh.src} onChange={(e) => setNewSsh({ ...newSsh, src: e.target.value })} style={{ flex: 1 }} />
          <input type="text" placeholder="Destination" value={newSsh.dst} onChange={(e) => setNewSsh({ ...newSsh, dst: e.target.value })} style={{ flex: 1 }} />
          <button onClick={handleCreateSshRule} className="btn-create">➕ Add</button>
        </div>
      </div>

      {acl.ssh.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 20px' }}>No SSH rules configured yet</p>
      ) : (
        <div>
          {acl.ssh.map((r, idx) => (
            <div key={idx} className="policy-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0' }}>{r.action === 'accept' ? '✅ Accept' : '❌ Reject'}</h4>
                <p style={{ margin: '5px 0', color: '#6b7280' }}>From: {r.src.join(', ')}</p>
                <p style={{ margin: '5px 0', color: '#6b7280' }}>To: {r.dst.join(', ')}</p>
              </div>
              <button onClick={() => handleDeleteSshRule(idx)} className="btn-delete">🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// CONFIG TAB
const ConfigTab: React.FC<{ acl: ACL; setAcl: (a: ACL) => void }> = ({ acl, setAcl }) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(acl, null, 2));

  const handleUpdateJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setAcl(parsed);
      alert('✅ Config updated!');
    } catch (err) {
      alert('❌ Invalid JSON');
    }
  };

  return (
    <div>
      <h2>Raw Config (JSON)</h2>
      <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={30} />
      <button onClick={handleUpdateJson} className="btn-save" style={{ marginTop: '15px' }}>💾 Update Config</button>
    </div>
  );
};

// USERS TAB
const UsersTab: React.FC<{ userEmail: string }> = ({ userEmail }) => {
  const [usersData, setUsersData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [apiKeyExpiration, setApiKeyExpiration] = useState<string>('90d');
  const [showNewKey, setShowNewKey] = useState<string>('');
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/headscale/user-emails`);
      setUsersData(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load users: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserPerms = () => {
    if (!usersData?.users) return { role: 'user', domains: [] };
    const current = Object.values(usersData.users).find((u: any) => u.email === userEmail) as any;
    return { role: (current as any)?.role || 'user', domains: (current as any)?.manageable_domains || [] };
  };

  const canManageUser = (targetEmail: string): boolean => {
    const perms = getCurrentUserPerms();
    if (perms.role === 'super_admin') return true;
    if (perms.role !== 'group_admin') return false;
    return perms.domains.some((d: string) => targetEmail.endsWith(d));
  };

  const canAddUser = (): boolean => {
    const perms = getCurrentUserPerms();
    return perms.role === 'super_admin' || perms.role === 'group_admin';
  };

  const canManagePermissions = (): boolean => {
    const perms = getCurrentUserPerms();
    return perms.role === 'super_admin';
  };

  const getEditableUsers = () => {
    if (!usersData?.users) return [];
    const perms = getCurrentUserPerms();
    if (perms.role === 'super_admin') return Object.entries(usersData.users);
    if (perms.role === 'group_admin') {
      return Object.entries(usersData.users).filter(([_, u]: [string, any]) =>
        perms.domains.some((d: string) => u.email.endsWith(d))
      );
    }
    return [];
  };

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newEmail.trim()) return;
    if (!canAddUser()) {
      setError('You do not have permission to add users');
      return;
    }

    const perms = getCurrentUserPerms();
    if (perms.role === 'group_admin' && perms.domains.length > 0) {
      const domain = perms.domains[0];
      if (!newEmail.endsWith(domain)) {
        setError(`As group admin, you can only add users with ${domain} email`);
        return;
      }
    }

    const updated = { ...usersData };
    updated.users[newUsername] = { email: newEmail, role: 'user', manageable_domains: [] };

    try {
      await axios.post(`${API_BASE}/headscale/user-emails`, updated);
      setUsersData(updated);
      setNewUsername('');
      setNewEmail('');
      setError('');
      alert('✅ User added successfully!');
    } catch (err) {
      setError('Failed to add user: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    if (!canManageUser(usersData.users[username].email)) {
      setError('You do not have permission to delete this user');
      return;
    }

    const updated = { ...usersData };
    delete updated.users[username];

    try {
      await axios.post(`${API_BASE}/headscale/user-emails`, updated);
      setUsersData(updated);
      setError('');
      alert('✅ User deleted successfully!');
    } catch (err) {
      setError('Failed to delete user: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdateUser = async (username: string, field: string, value: any) => {
    if (!canManageUser(usersData.users[username].email)) {
      setError('You do not have permission to edit this user');
      return;
    }

    const updated = { ...usersData };
    updated.users[username][field] = value;

    try {
      await axios.post(`${API_BASE}/headscale/user-emails`, updated);
      setUsersData(updated);
      setError('');
    } catch (err) {
      setError('Failed to update user: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };


  const loadApiKeys = async () => {
    setLoadingApiKeys(true);
    try {
      const response = await axios.get(`${API_BASE}/headscale/apikey/list`);
      setApiKeys(response.data || []);
    } catch (err) {
      setError('Failed to load API keys: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!selectedUser.trim()) {
      setError('Please select a user');
      return;
    }

    setLoadingApiKeys(true);
    try {
      const response = await axios.post(`${API_BASE}/headscale/apikey/create`, {
        username: selectedUser,
        expiration: apiKeyExpiration
      });
      setShowNewKey(response.data.apiKey);
      setSelectedUser('');
      setApiKeyExpiration('90d');
      loadApiKeys();
    } catch (err) {
      setError('Failed to create API key: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!window.confirm('Revoke this API key?')) return;

    try {
      await axios.post(`${API_BASE}/headscale/apikey/revoke`, { keyId });
      loadApiKeys();
      setError('');
    } catch (err) {
      setError('Failed to revoke API key: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('✅ API key copied to clipboard!');
  };

  if (loading) return <div><p>Loading users...</p></div>;

  return (
    <div>
      <h2>Users & Permissions</h2>
      {error && <div className="error-box">{error}</div>}

      {canAddUser() && (
        <div className="form-section">
          <h3>Add New User</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px' }}>
            <input type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <button onClick={handleAddUser} className="btn-create">➕ Add</button>
          </div>
          {getCurrentUserPerms().role === 'group_admin' && getCurrentUserPerms().domains.length > 0 && (
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              You can only add users with {getCurrentUserPerms().domains[0]} email
            </p>
          )}
        </div>
      )}

      {getEditableUsers().length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                {canManagePermissions() && <th>Manageable Domains</th>}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {getEditableUsers().map(([username, user]: any) => (
                <tr key={username}>
                  <td>{username}</td>
                  <td>{user.email}</td>
                  <td>
                    {canManagePermissions() ? (
                      <select value={user.role} onChange={(e) => handleUpdateUser(username, 'role', e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                        <option value="user">User</option>
                        <option value="group_admin">Group Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    ) : (
                      <span>{user.role}</span>
                    )}
                  </td>
                  {canManagePermissions() && <td>{user.manageable_domains.join(', ') || 'N/A'}</td>}
                  <td><button onClick={() => handleDeleteUser(username)} className="btn-delete">🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>No users to manage</p>
      )}

      {canManagePermissions() && (
        <div className="form-section" style={{ marginTop: '30px' }}>
          <h3>🔐 Manage Permissions</h3>
          {Object.entries(usersData?.users || {}).map(([username, user]: any) => (
            <div key={username} style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>{username} - Role:</label>
                  <select value={user.role} onChange={(e) => handleUpdateUser(username, 'role', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}>
                    <option value="user">User</option>
                    <option value="group_admin">Group Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>Domains (comma-separated):</label>
                  <input type="text" value={user.manageable_domains.join(', ')} onChange={(e) => handleUpdateUser(username, 'manageable_domains', e.target.value.split(',').map((s: string) => s.trim()))} placeholder="@domain.com" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManagePermissions() && (
        <div className="form-section" style={{ marginTop: '30px' }}>
          <h3>🔑 API Key Management</h3>
          {showNewKey && (
            <div style={{ padding: '12px', marginBottom: '15px', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px' }}>
              <p style={{ marginBottom: '8px', fontWeight: '600' }}>✅ New API Key Created (save it securely!):</p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <code style={{ padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '4px', flex: 1, fontSize: '12px', wordBreak: 'break-all' }}>{showNewKey}</code>
                <button onClick={() => copyToClipboard(showNewKey)} style={{ padding: '6px 12px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>📋 Copy</button>
              </div>
              <button onClick={() => setShowNewKey('')} style={{ marginTop: '8px', padding: '6px 12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Hide</button>
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '15px' }}>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
              <option value="">Select user...</option>
              {Object.entries(usersData?.users || {}).map(([username]) => (
                <option key={username} value={username}>{username}</option>
              ))}
            </select>
            <select value={apiKeyExpiration} onChange={(e) => setApiKeyExpiration(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
              <option value="30m">30 minutes</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days (default)</option>
            </select>
            <button onClick={handleCreateApiKey} disabled={loadingApiKeys} style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
              🔐 Generate Key
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
