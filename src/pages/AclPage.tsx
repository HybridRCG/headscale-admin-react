/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
    { icon: '🖥️', label: 'Hosts' },
    { icon: '🔒', label: 'Policies' },
    { icon: '🔐', label: 'SSH' },
    { icon: '⚙️', label: 'Config' }
  ];

  const userRole = useAuthStore((state) => state.user?.role || 'user');
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

  if (loading && !acl) return <div className="page-container"><p>Loading ACL...</p></div>;


  // Filter tabs based on user role


  return (
    <div className="page-container">
      {error && <div className="error-box">{error}</div>}
      <div className="acl-tabs" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 9 }}>
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
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', fontWeight: '800', color: '#f3f4f6', letterSpacing: '-0.01em' }}>{groupName.replace(/^group:/,'')}</h3>
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
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState('');

  useEffect(() => {
    axios.get('/admin/api/headscale/api/v1/node').then(r => {
      setNodes(r.data.nodes || []);
    }).catch(() => {});
  }, []);

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNode(nodeId);
    if (!nodeId) { setNewHost(''); setNewIp(''); return; }
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setNewHost(node.givenName || node.name);
      setNewIp(node.ipAddresses?.[0] || '');
    }
  };

  const handleAddHost = () => {
    if (!newHost.trim() || !newIp.trim()) return;
    setAcl({ ...acl, hosts: { ...acl.hosts, [newHost]: newIp } });
    setNewHost(''); setNewIp(''); setSelectedNode('');
  };

  const handleDeleteHost = (hostname: string) => {
    const updated = { ...acl };
    delete updated.hosts[hostname];
    setAcl(updated);
  };

  return (
    <div>
      <div className="form-section">
        <h3>Add Host Mapping</h3>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>Select a registered node to auto-fill, or enter manually.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Select Node:</label>
            <select value={selectedNode} onChange={e => handleNodeSelect(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', minWidth: '180px' }}>
              <option value="">-- pick a node --</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.online ? '🟢' : '🔴'} {n.givenName || n.name} ({n.ipAddresses?.[0] || 'no IP'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Hostname alias:</label>
            <input type="text" placeholder="e.g. myserver" value={newHost} onChange={e => setNewHost(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', width: '150px' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.25rem' }}>IP Address:</label>
            <input type="text" placeholder="100.64.x.x" value={newIp} onChange={e => setNewIp(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', width: '130px', fontFamily: 'monospace' }} />
          </div>
          <button onClick={handleAddHost} className="btn-create" style={{ marginBottom: '0' }}>➕ Add</button>
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


// POLICIES TAB - Visual policy builder
const PoliciesTab: React.FC<{ acl: ACL; setAcl: (a: ACL) => void }> = ({ acl, setAcl }) => {
  const [expandedPolicy, setExpandedPolicy] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<number | null>(null);

  // New policy state
  const [proto, setProto] = useState('');
  const [srcType, setSrcType] = useState<'custom'|'user'|'host'|'group'>('custom');
  const [srcInput, setSrcInput] = useState('');
  // srcPort removed - unused
  const [srcItems, setSrcItems] = useState<string[]>([]);
  const [dstType, setDstType] = useState<'custom'|'user'|'host'|'group'>('custom');
  const [dstInput, setDstInput] = useState('');
  const [dstPort, setDstPort] = useState('');
  const [dstItems, setDstItems] = useState<Array<{obj:string;ports:string}>>([]);
  const [action, setAction] = useState('accept');

  // Available options from ACL
  const groups = Object.keys(acl.groups);
  const hosts = Object.keys(acl.hosts);
  const [users, setUsers] = useState<string[]>([]);
  useEffect(() => {
    axios.get('/admin/api/headscale/api/v1/user').then(r => {
      setUsers((r.data.users || []).map((u: any) => u.name));
    }).catch(() => {});
  }, []);

  const getOptions = (type: string) => {
    if (type === 'group') return groups.map(g => g);
    if (type === 'host') return hosts;
    if (type === 'user') return users;
    return [];
  };

  const addSrcItem = () => {
    const val = srcInput.trim();
    if (!val || srcItems.includes(val)) return;
    setSrcItems([...srcItems, val]);
    setSrcInput('');
  };

  const addDstItem = () => {
    const val = dstInput.trim();
    if (!val) return;
    const entry = { obj: val, ports: dstPort.trim() || '*' };
    setDstItems([...dstItems, entry]);
    setDstInput('');
    setDstPort('');
  };

  const handleCreate = () => {
    if (srcItems.length === 0 || dstItems.length === 0) return;
    const newAcl = { ...acl };
    const entry = {
      action,
      src: srcItems,
      dst: dstItems.map(d => d.ports && d.ports !== '*' ? `${d.obj}:${d.ports}` : d.obj),
      ...(proto ? { proto } : {})
    };
    if (editingPolicy !== null) {
      newAcl.acls[editingPolicy] = entry;
    } else {
      newAcl.acls.push(entry);
    }
    setAcl(newAcl);
    // Reset
    setProto(''); setSrcItems([]); setDstItems([]);
    setSrcInput(''); setDstInput(''); setDstPort('');
    setSrcType('custom'); setDstType('custom');
    setAction('accept'); setCreating(false); setEditingPolicy(null);
  };

  const handleEdit = (idx: number) => {
    const p = acl.acls[idx];
    setEditingPolicy(idx);
    setCreating(true);
    setAction(p.action);
    setProto(p.proto || '');
    // Parse src items
    setSrcItems(p.src);
    setSrcType('custom');
    // Parse dst items - format is "host:ports" or just "host"
    const parsed = p.dst.map(d => {
      const lastColon = d.lastIndexOf(':');
      if (lastColon > 0 && lastColon < d.length - 1) {
        const maybePort = d.substring(lastColon + 1);
        if (/^[0-9,*]+$/.test(maybePort)) {
          return { obj: d.substring(0, lastColon), ports: maybePort };
        }
      }
      return { obj: d, ports: '*' };
    });
    setDstItems(parsed);
    setDstType('custom');
    setSrcInput(''); setDstInput(''); setDstPort('');
    setExpandedPolicy(null);
  };

  const handleDelete = (idx: number) => {
    if (!window.confirm('Delete this policy?')) return;
    const updated = { ...acl };
    updated.acls.splice(idx, 1);
    setAcl(updated);
  };

  const handleMove = (idx: number, dir: 'up'|'down') => {
    const updated = { ...acl };
    const t = dir === 'up' ? idx - 1 : idx + 1;
    [updated.acls[idx], updated.acls[t]] = [updated.acls[t], updated.acls[idx]];
    setAcl(updated);
  };

  // Type selector buttons
  const TypeBar: React.FC<{ value: string; onChange: (v: any) => void; excludeTags?: boolean }> = ({ value, onChange, excludeTags }) => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
      {(['custom','user','host','group'] as const).map(t => (
        <button key={t} onClick={() => onChange(t)}
          style={{ padding: '0.35rem 0.85rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', textTransform: 'capitalize',
            backgroundColor: value === t ? '#3b82f6' : '#374151', color: value === t ? 'white' : '#9ca3af' }}>
          {t === 'custom' ? '✏️ Custom' : t === 'user' ? '👤 User' : t === 'host' ? '🖥️ Host' : '👥 Group'}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button className="btn-create" onClick={() => { setCreating(!creating); if (creating) setEditingPolicy(null); }}>
          {creating ? '✕ Cancel' : '➕ Create Policy'}
        </button>
        {creating && editingPolicy !== null && <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.875rem' }}>✏️ Editing Policy #{editingPolicy + 1}</span>}
        {acl.acls.length > 0 && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{acl.acls.length} polic{acl.acls.length === 1 ? 'y' : 'ies'}</span>}
      </div>

      {/* Create Policy Form */}
      {creating && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1.5rem' }}>

          {/* Action + Protocol row */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Action</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['accept','reject'].map(a => (
                  <button key={a} onClick={() => setAction(a)}
                    style={{ padding: '0.35rem 0.85rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', textTransform: 'capitalize',
                      backgroundColor: action === a ? (a === 'accept' ? '#10b981' : '#ef4444') : '#374151', color: action === a ? 'white' : '#9ca3af' }}>
                    {a === 'accept' ? '✅ Accept' : '❌ Reject'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Protocol</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[{v:'',l:'Any'},{v:'tcp',l:'TCP'},{v:'udp',l:'UDP'},{v:'icmp',l:'ICMP'}].map(p => (
                  <button key={p.v} onClick={() => setProto(p.v)}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                      backgroundColor: proto === p.v ? '#6366f1' : '#374151', color: proto === p.v ? 'white' : '#9ca3af' }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {/* Sources */}
            <div style={{ backgroundColor: '#1f2937', borderRadius: '0.5rem', padding: '1rem' }}>
              <div style={{ color: '#f3f4f6', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Sources</div>
              <TypeBar value={srcType} onChange={setSrcType} />
              {/* Context list for non-custom */}
              {srcType !== 'custom' && getOptions(srcType).length > 0 && (
                <div style={{ backgroundColor: '#374151', borderRadius: '0.375rem', padding: '0.5rem', marginBottom: '0.5rem', maxHeight: '100px', overflowY: 'auto' }}>
                  {getOptions(srcType).map(opt => (
                    <div key={opt} onClick={() => setSrcInput(srcType === 'group' ? opt : srcType === 'user' ? opt : opt)}
                      style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', borderRadius: '0.25rem', color: '#d1d5db', fontSize: '0.8rem' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4b5563')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      {opt}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input value={srcInput} onChange={e => setSrcInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSrcItem()}
                  placeholder={srcType === 'group' ? 'group:name' : srcType === 'user' ? 'username' : srcType === 'host' ? 'hostname' : 'custom value'}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.8rem' }} />
                <button onClick={addSrcItem} className="btn-create" style={{ padding: '0.4rem 0.75rem' }}>Add</button>
              </div>
              {srcItems.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {srcItems.map(item => (
                    <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.6rem', backgroundColor: '#374151', borderRadius: '0.25rem', fontSize: '0.8rem', color: '#d1d5db' }}>
                      <span style={{ fontFamily: 'monospace' }}>{item}</span>
                      <button onClick={() => setSrcItems(srcItems.filter(s => s !== item))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Destinations */}
            <div style={{ backgroundColor: '#1f2937', borderRadius: '0.5rem', padding: '1rem' }}>
              <div style={{ color: '#f3f4f6', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Destinations</div>
              <TypeBar value={dstType} onChange={setDstType} />
              {dstType !== 'custom' && getOptions(dstType).length > 0 && (
                <div style={{ backgroundColor: '#374151', borderRadius: '0.375rem', padding: '0.5rem', marginBottom: '0.5rem', maxHeight: '100px', overflowY: 'auto' }}>
                  {getOptions(dstType).map(opt => (
                    <div key={opt} onClick={() => setDstInput(opt)}
                      style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', borderRadius: '0.25rem', color: '#d1d5db', fontSize: '0.8rem' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4b5563')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      {opt}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <input value={dstInput} onChange={e => setDstInput(e.target.value)}
                  placeholder={dstType === 'group' ? 'group:name' : dstType === 'host' ? 'hostname' : dstType === 'user' ? 'username' : 'destination'}
                  style={{ flex: 2, padding: '0.4rem 0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.8rem' }} />
                <input value={dstPort} onChange={e => setDstPort(e.target.value)}
                  placeholder="ports (e.g. 80,443)"
                  onKeyDown={e => e.key === 'Enter' && addDstItem()}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.8rem' }} />
                <button onClick={addDstItem} className="btn-create" style={{ padding: '0.4rem 0.75rem' }}>Add</button>
              </div>
              {dstItems.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {dstItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.6rem', backgroundColor: '#374151', borderRadius: '0.25rem', fontSize: '0.8rem', color: '#d1d5db' }}>
                      <span style={{ fontFamily: 'monospace' }}>{item.obj}</span>
                      <span style={{ color: '#60a5fa', marginLeft: '0.5rem' }}>{item.ports !== '*' ? item.ports : 'any port'}</span>
                      <button onClick={() => setDstItems(dstItems.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Create button */}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleCreate} disabled={srcItems.length === 0 || dstItems.length === 0}
              style={{ padding: '0.5rem 1.5rem', backgroundColor: srcItems.length > 0 && dstItems.length > 0 ? '#10b981' : '#374151', color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: '700', cursor: srcItems.length > 0 && dstItems.length > 0 ? 'pointer' : 'not-allowed', fontSize: '0.875rem' }}>
              {editingPolicy !== null ? '✏️ Update Policy' : '➕ Add Policy'}
            </button>
          </div>
        </div>
      )}

      {/* Policy list */}
      {acl.acls.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No policies configured yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {acl.acls.map((p, idx) => (
            <div key={idx} className="policy-card">
              <div className="accordion-header" onClick={() => setExpandedPolicy(expandedPolicy === idx ? null : idx)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#6b7280' }}>#{idx + 1}</span>
                  <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: p.action === 'accept' ? '#065f46' : '#7f1d1d', color: p.action === 'accept' ? '#6ee7b7' : '#fca5a5', fontWeight: '700' }}>
                    {p.action.toUpperCase()}
                  </span>
                  {p.proto && <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: '600', backgroundColor: '#1e1b4b', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>{p.proto.toUpperCase()}</span>}
                  <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontFamily: 'monospace' }}>{p.src.join(', ')}</span>
                  <span style={{ color: '#6b7280' }}>→</span>
                  <span style={{ fontSize: '0.8rem', color: '#86efac', fontFamily: 'monospace' }}>{p.dst.join(', ')}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); handleMove(idx, 'up'); }} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#374151' : '#9ca3af', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.8rem' }}>⬆</button>
                  <button onClick={e => { e.stopPropagation(); handleMove(idx, 'down'); }} disabled={idx === acl.acls.length - 1} style={{ background: 'none', border: 'none', color: idx === acl.acls.length - 1 ? '#374151' : '#9ca3af', cursor: idx === acl.acls.length - 1 ? 'default' : 'pointer', fontSize: '0.8rem' }}>⬇</button>
                  <button onClick={e => { e.stopPropagation(); handleEdit(idx); }} style={{ background: 'none', border: '1px solid #92400e', color: '#f59e0b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(idx); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}>🗑</button>
                  <span className={`accordion-icon ${expandedPolicy === idx ? 'open' : ''}`} style={{ fontSize: '0.75rem', color: '#6b7280' }}>▼</span>
                </div>
              </div>
              {expandedPolicy === idx && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #374151', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sources</div>
                    {p.src.map(s => <div key={s} style={{ fontFamily: 'monospace', color: '#93c5fd', fontSize: '0.8rem', padding: '0.2rem 0' }}>{s}</div>)}
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Destinations</div>
                    {p.dst.map(d => <div key={d} style={{ fontFamily: 'monospace', color: '#86efac', fontSize: '0.8rem', padding: '0.2rem 0' }}>{d}</div>)}
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

// SSH TAB// SSH TAB
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
  const [syntaxError, setSyntaxError] = useState('');
  const [syntaxOk, setSyntaxOk] = useState(false);

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    setSyntaxOk(false);
    try {
      JSON.parse(val);
      setSyntaxError('');
    } catch (err: any) {
      setSyntaxError(err.message);
    }
  };

  const handleCheckSyntax = () => {
    try {
      JSON.parse(jsonText);
      setSyntaxError('');
      setSyntaxOk(true);
    } catch (err: any) {
      setSyntaxError(err.message);
      setSyntaxOk(false);
    }
  };

  const handleUpdateJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setSyntaxError('');
      setAcl(parsed);
      setSyntaxOk(false);
      alert('✅ Config updated!');
    } catch (err: any) {
      setSyntaxError(err.message);
      setSyntaxOk(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
        <button onClick={handleCheckSyntax} className="btn-create" style={{ backgroundColor: '#6366f1' }}>🔍 Check Syntax</button>
        <button onClick={handleUpdateJson} className="btn-save" disabled={!!syntaxError}>💾 Apply Config</button>
        {syntaxOk && !syntaxError && <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.875rem' }}>✓ Valid JSON</span>}
      </div>
      {syntaxError && (
        <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#7f1d1d', color: '#fecaca', borderRadius: '0.375rem', marginBottom: '0.75rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          ❌ {syntaxError}
        </div>
      )}
      <textarea value={jsonText} onChange={(e) => handleJsonChange(e.target.value)} rows={30} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
    </div>
  );
};

// USERS TAB
const UsersTab: React.FC<{ userEmail: string }> = ({ userEmail }) => {
  const [usersData, setUsersData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [apiKeys, setApiKeys] = useState<any[]>([]); // eslint-disable-line
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

  // handleRevokeApiKey removed - unused

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('✅ API key copied to clipboard!');
  };

  if (loading) return <div><p>Loading users...</p></div>;

  return (
    <div>
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
        <div className="form-section" style={{ marginTop: '1.5rem' }}>
          <h3>🔐 User Roles &amp; Domain Access</h3>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '1rem', marginTop: '-0.5rem' }}>Controls what each user can see and manage in this admin panel. Role and domain changes take effect on next login.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #374151' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#f3f4f6', fontWeight: '700' }}>User</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#f3f4f6', fontWeight: '700' }}>Role</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#f3f4f6', fontWeight: '700' }}>Manageable Domains</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(usersData?.users || {}).map(([username, user]: any) => (
                  <tr key={username} style={{ borderBottom: '1px solid #374151' }}>
                    <td style={{ padding: '0.4rem 0.75rem', fontWeight: '600', color: '#60a5fa' }}>{username}</td>
                    <td style={{ padding: '0.4rem 0.75rem' }}>
                      <select value={user.role} onChange={(e) => handleUpdateUser(username, 'role', e.target.value)} style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: '0.25rem', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#f3f4f6' }}>
                        <option value="user">User</option>
                        <option value="group_admin">Group Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem 0.75rem' }}>
                      <input type="text" value={user.manageable_domains.join(', ')} onChange={(e) => handleUpdateUser(username, 'manageable_domains', e.target.value.split(',').map((s: string) => s.trim()))} placeholder="@domain.com or *" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: '0.25rem', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#f3f4f6', width: '200px' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
