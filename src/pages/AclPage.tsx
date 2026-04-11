import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

  const tabs = [
    { icon: '👥', label: 'Groups' },
    { icon: '🏷️', label: 'Tag Owners' },
    { icon: '🖥️', label: 'Hosts' },
    { icon: '🔒', label: 'Policies' },
    { icon: '🔐', label: 'SSH' },
    { icon: '⚙️', label: 'Config' }
  ];

  return (
    <div className="acl-container">
      <div className="acl-header">
        <h1>ACL Editor</h1>
        <button onClick={saveAcl} disabled={loading} className="btn-save">💾 Save ACL</button>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="acl-tabs">
        {tabs.map((tab, idx) => (
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
      </div>
      {acl && (
        <div className="acl-content">
          {activeTab === 0 && <GroupsTab acl={acl} setAcl={setAcl} />}
          {activeTab === 1 && <TagOwnersTab acl={acl} setAcl={setAcl} />}
          {activeTab === 2 && <HostsTab acl={acl} setAcl={setAcl} />}
          {activeTab === 3 && <PoliciesTab acl={acl} setAcl={setAcl} />}
          {activeTab === 4 && <SshTab acl={acl} setAcl={setAcl} />}
          {activeTab === 5 && <ConfigTab acl={acl} setAcl={setAcl} />}
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
          <input
            type="text"
            placeholder="e.g., group:admins"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            style={{ flex: 1 }}
          />
          <button onClick={handleCreateGroup} className="btn-create">➕ Create</button>
        </div>
      </div>

      <div className="grid-cards">
        {Object.entries(acl.groups).map(([groupName, members]) => (
          <div key={groupName} className="group-card">
            <div className="accordion-header" onClick={() => setExpandedGroup(expandedGroup === groupName ? null : groupName)}>
              <div>
                <h3>{groupName}</h3>
                <p>{members.length} member{members.length !== 1 ? 's' : ''}</p>
              </div>
              <span className={`accordion-icon ${expandedGroup === groupName ? 'open' : ''}`}>▼</span>
            </div>

            {expandedGroup === groupName && (
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                {editingGroup === groupName ? (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Rename Group:</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        autoFocus
                        type="text"
                        defaultValue={groupName}
                        onBlur={(e) => {
                          if (e.target.value !== groupName) {
                            handleRenameGroup(groupName, e.target.value);
                          } else {
                            setEditingGroup(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameGroup(groupName, e.currentTarget.value);
                          } else if (e.key === 'Escape') {
                            setEditingGroup(null);
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                    <button onClick={() => setEditingGroup(groupName)} className="btn-create" style={{ flex: 1 }}>✏️ Rename</button>
                    <button onClick={() => handleDeleteGroup(groupName)} className="btn-delete">🗑️ Delete</button>
                  </div>
                )}

                <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '10px' }}>Members:</h4>
                {members.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '15px' }}>No members yet</p>
                ) : (
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
                  <input
                    type="email"
                    placeholder="Add member..."
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMember(groupName)}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => handleAddMember(groupName)} className="btn-create">➕ Add</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// TAG OWNERS TAB - WITH ACCORDION
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
