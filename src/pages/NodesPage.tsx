/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuthStore } from '../store/authStore';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import '../styles/Pages.css';
import { DeployModal } from '../components/DeployModal';

interface Node {
  id: number;
  name: string;
  hostname: string;
  user?: { name: string };
  ipAddresses?: string[];
  online?: boolean;
  approvedRoutes?: string[];
  availableRoutes?: string[];
  forcedTags?: string[];
  validTags?: string[];
  lastSeen?: string | { seconds: number; nanos: number };
  last_seen?: string | { seconds: number; nanos: number };
}

interface SimNode extends Node {
  x: number; y: number; vx: number; vy: number; radius: number; color: string; pinned?: boolean;
}

export const NodesPage: React.FC = () => {
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<Node[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [userObjects, setUserObjects] = useState<{id:string; name:string}[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [groupUsers, setGroupUsers] = useState<Record<string, string[]>>({});
  const [userEmailMap, setUserEmailMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { user: authUser, sessionToken } = useAuthStore();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const shouldFilter = authUser?.role !== 'super_admin' && !manageableDomains.includes('*');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');

  // Modals
  const [editModal, setEditModal] = useState<Node | null>(null);
  const [editName, setEditName] = useState('');
  const [editUser, setEditUser] = useState('');
  const [routesModal, setRoutesModal] = useState<Node | null>(null);
  const [moveKeyModal, setMoveKeyModal] = useState<{key: string; user: string} | null>(null);
  const [tagModal, setTagModal] = useState<Node | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [sshModal, setSshModal] = useState<Node | null>(null);
  const [deployModal, setDeployModal] = useState(false);
  const [tagOwners, setTagOwners] = useState<Record<string, string>>({});
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  // Map of tag -> list of group names that own it (e.g. "tag:server" -> ["group:admin"]).
  // Used to determine, given a node's owner, which tags they're permitted to assert.
  const [tagOwnerGroups, setTagOwnerGroups] = useState<Record<string, string[]>>({});
  const [tagSaving, setTagSaving] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [expandedNode, setExpandedNode] = useState<number | null>(null);

  const API_BASE = '/admin/api';

  useEffect(() => {
    fetchNodes();
    fetchUsers();
    fetchGroups();
    fetchTagOwners();
    fetchAvailableTags();
  }, []);

  useEffect(() => { applyFilters(); }, [allNodes, searchTerm, filterStatus, selectedUser, selectedGroup, groupUsers, userEmailMap]);

  // SSE real-time — robust with token refresh and exponential backoff
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryDelay = 5000;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      // Always get fresh token at connection time
      const token = useAuthStore.getState().sessionToken || '';
      if (!token) {
        // Not logged in — retry later
        retryTimeout = setTimeout(connect, 10000);
        return;
      }

      es = new EventSource(`/admin/api/headscale/events?token=${encodeURIComponent(token)}`);

      es.addEventListener('ping', () => {
        setLiveConnected(true);
        retryDelay = 5000; // Reset backoff on successful connection
      });

      es.addEventListener('nodes', (e: MessageEvent) => {
        try {
          const updates: {id: number; online: boolean; lastSeen?: string}[] = JSON.parse(e.data);
          setAllNodes(prev => prev.map(node => {
            const u = updates.find(x => x.id === node.id);
            if (!u) return node;
            return { ...node, online: u.online, ...(u.lastSeen ? { lastSeen: u.lastSeen } : {}) };
          }));
        } catch {}
      });

      es.addEventListener('error', () => {
        setLiveConnected(false);
      });

      es.onerror = () => {
        setLiveConnected(false);
        es?.close();
        es = null;
        if (mounted) {
          // Exponential backoff — max 30s
          retryTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, 30000);
        }
      };
    };

    connect();

    // Reconnect when tab becomes visible again (handles phone screen-off/on)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !es) {
        retryDelay = 5000;
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      es?.close();
      clearTimeout(retryTimeout);
      setLiveConnected(false);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/headscale/api/v1/node`);
      setAllNodes(r.data.nodes || []);
    } catch { } finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const r = await axios.get(`${API_BASE}/headscale/api/v1/user`);
      const raw = r.data.users || [];
      setUsers(raw.map((u: any) => u.name));
      setUserObjects(raw.map((u: any) => ({ id: String(u.id), name: u.name })));
      const m = await axios.get(`${API_BASE}/headscale/user-mapping`);
      setUserEmailMap(m.data);
    } catch {}
  };

  const fetchGroups = async () => {
    try {
      const r = await axios.get(`${API_BASE}/headscale/api/v1/policy`);
      let p = r.data;
      if (typeof p.policy === 'string') p = JSON.parse(p.policy);
      const gObj = p.groups || {};
      const gList: string[] = [];
      const uMap: Record<string, string[]> = {};
      Object.entries(gObj).forEach(([k, v]: [string, any]) => {
        const n = k.replace('group:', '');
        gList.push(n); uMap[n] = v;
      });
      setGroups(gList.sort()); setGroupUsers(uMap);
    } catch {}
  };

  const fetchTagOwners = async () => {
    try {
      const r = await axios.get(`${API_BASE}/headscale/user-emails`);
      setTagOwners(r.data?.node_owners || {});
    } catch {}
  };

  const fetchAvailableTags = async () => {
    try {
      const r = await axios.get(`${API_BASE}/headscale/acl`);
      let p = r.data;
      if (typeof p === 'string') p = JSON.parse(p);
      const ownerMap: Record<string, string[]> = {};
      Object.entries(p.tagOwners || {}).forEach(([k, v]: [string, any]) => {
        const tagKey = k.startsWith('tag:') ? k : `tag:${k}`;
        ownerMap[tagKey] = Array.isArray(v) ? v : [];
      });
      setTagOwnerGroups(ownerMap);
      setAvailableTags(Object.keys(ownerMap).sort());
    } catch {}
  };

  const getNodeOwner = (node: Node) => {
    const tags = [...(node.forcedTags || []), ...(node.validTags || [])];
    if (tags.length > 0) return tagOwners[String(node.id)] || node.user?.name || '—';
    return node.user?.name || '—';
  };

  const getNodeTags = (node: Node) => [...new Set([...(node.forcedTags || []), ...(node.validTags || [])])];

  // Whether the given tag can be asserted by the given node's owner. A tag is
  // assertable if the owner's email belongs to one of the groups listed under
  // tagOwners[tag] in the policy. Returns true for super_admin or wildcard
  // ownership ("*"), false otherwise.
  const canOwnerAssertTag = (node: Node | null, tag: string): boolean => {
    if (!node) return false;
    const ownerGroups = tagOwnerGroups[tag] || [];
    if (ownerGroups.includes('*')) return true;
    const ownerName = node.user?.name || tagOwners[String(node.id)] || '';
    if (!ownerName) return false;
    const ownerEmail = userEmailMap[ownerName] || ownerName;
    return ownerGroups.some(g => {
      const stripped = g.replace(/^group:/, '');
      const members = groupUsers[stripped] || [];
      return members.includes(ownerEmail) || members.includes(ownerName);
    });
  };


  const getNodeDuration = (node: Node): string => {
    const raw = (node as any).lastSeen || (node as any).last_seen;
    if (!raw) return '';
    let epochMs: number;
    if (typeof raw === 'string') {
      // ISO string: "2026-04-19T18:02:23.607709216Z"
      epochMs = new Date(raw).getTime();
    } else if (raw.seconds) {
      // Protobuf timestamp: { seconds: 1234567890, nanos: 0 }
      epochMs = raw.seconds * 1000;
    } else {
      return '';
    }
    if (!epochMs || isNaN(epochMs)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return 'just now';
  };

  const applyFilters = () => {
    setFilteredNodes(allNodes.filter(node => {
      if (shouldFilter) {
        const email = node.user?.name ? userEmailMap[node.user.name] : undefined;
        if (!email || !manageableDomains.some((d: string) => email.endsWith(d.replace('@', '')))) return false;
      }
      const search = node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.hostname?.toLowerCase().includes(searchTerm.toLowerCase());
      const userMatch = selectedUser === 'all' || node.user?.name === selectedUser;
      let groupMatch = selectedGroup === 'all';
      if (selectedGroup !== 'all' && node.user?.name) {
        const email = userEmailMap[node.user.name];
        groupMatch = email ? (groupUsers[selectedGroup] || []).includes(email) : false;
      }
      const statusMatch = filterStatus === 'all' || (filterStatus === 'online' && node.online) || (filterStatus === 'offline' && !node.online);
      return search && userMatch && groupMatch && statusMatch;
    }));
  };

  const handleRename = async (): Promise<boolean> => {
    if (!editModal || !editName.trim()) return false;
    const newName = editName.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(newName)) {
      alert('Invalid name. Use lowercase letters, digits, and hyphens (max 63 chars, no leading hyphen).');
      return false;
    }
    try {
      await axios.post(`${API_BASE}/headscale/node/rename`, { nodeId: editModal.id, newName });
      return true;
    } catch (e: any) {
      alert('Rename failed: ' + (e.response?.data?.message || e.message));
      return false;
    }
  };

  const handleMoveUser = async () => {
    if (!editModal || !editUser.trim()) return;
    const ok = window.confirm(`⚠️ Changing owner requires deleting and re-registering the node.\n\nA new pre-auth key will be shown. The device must be online to reconnect.\n\nContinue?`);
    if (!ok) return;
    try {
      const r = await axios.post(`${API_BASE}/headscale/node/move-user`, { nodeId: editModal.id, newUser: editUser });
      if (r.data.newKey) setMoveKeyModal({ key: r.data.newKey, user: editUser });
      else alert('Move succeeded but no auth key was returned. Check server logs.');
    } catch (e: any) {
      alert('Failed to move node: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const wantedName = editName.trim().toLowerCase();
    const currentName = (editModal.name || '').toLowerCase();
    const wantedUser = editUser.trim();
    const renameNeeded = !!wantedName && wantedName !== currentName;
    const moveNeeded = !!wantedUser && wantedUser !== editModal.user?.name;

    if (!renameNeeded && !moveNeeded) {
      // Nothing to do — let the user know rather than silently closing.
      alert('No changes to save.');
      return;
    }
    if (renameNeeded) {
      const ok = await handleRename();
      if (!ok) return; // Keep modal open so user can fix and retry
    }
    if (moveNeeded) await handleMoveUser();
    setEditModal(null);
    await fetchNodes();
  };

  const handleDelete = async (node: Node) => {
    if (!window.confirm(`Delete node "${node.name}"?`)) return;
    try { await axios.post(`${API_BASE}/headscale/node/delete`, { nodeId: node.id }); await fetchNodes(); } catch { alert('Failed to delete'); }
  };

  const handleExpire = async (node: Node) => {
    if (!window.confirm(`Expire node "${node.name}"?`)) return;
    try { await axios.post(`${API_BASE}/headscale/node/expire`, { nodeId: node.id }); await fetchNodes(); } catch { alert('Failed to expire'); }
  };

  const handleApproveRoute = async (route: string) => {
    if (!routesModal) return;
    try {
      const r = await axios.post(`${API_BASE}/headscale/approve-route`, { nodeId: routesModal.id, route });
      if (r.data.node) setRoutesModal(r.data.node);
      await fetchNodes();
    } catch {}
  };

  const handleDisapproveRoute = async (route: string) => {
    if (!routesModal) return;
    try {
      const r = await axios.post(`${API_BASE}/headscale/disapprove-route`, { nodeId: routesModal.id, route });
      if (r.data.node) setRoutesModal(r.data.node);
      await fetchNodes();
    } catch {}
  };

  const handleSaveTags = async (node: Node, tags: string[]) => {
    setTagSaving(true);
    try {
      await axios.post(`${API_BASE}/headscale/node/tags`, { nodeId: node.id, tags, originalOwner: node.user?.name || tagOwners[String(node.id)] || '' });
      await fetchNodes(); await fetchTagOwners(); setTagModal(null); setTagInput('');
    } catch (e: any) { alert('Failed to update tags: ' + (e.response?.data?.message || e.message)); }
    finally { setTagSaving(false); }
  };

  if (loading) return <div className="page-container"><div className="loading">Loading nodes...</div></div>;

  return (
    <div className="page-container">

      {/* ── Toolbar ── */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all','online','offline'].map(f => (
          <button key={f} className={`btn ${filterStatus === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(f)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
            {f === 'all' ? 'All' : f === 'online' ? '🟢 Online' : '🔴 Offline'}
          </button>
        ))}
        <input type="text" placeholder="🔍 Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '120px', padding: '0.5rem 0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.85rem' }} />
        <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
          style={{ padding: '0.5rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.8rem' }}>
          <option value="all">All Users</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
          style={{ padding: '0.5rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.8rem' }}>
          <option value="all">All Groups</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button className="btn btn-success" onClick={() => setDeployModal(true)} style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>+ Deploy</button>
        <button className="btn btn-secondary" onClick={fetchNodes} disabled={loading} style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>🔄</button>
        <span title={liveConnected ? 'Live' : 'Connecting...'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: liveConnected ? '#10b981' : '#6b7280', whiteSpace: 'nowrap' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: liveConnected ? '#10b981' : '#6b7280', display: 'inline-block' }}></span>
          {liveConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* ── Node count ── */}
      <div style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.78rem' }}>
        {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''} &nbsp;•&nbsp;
        <span style={{ color: '#10b981' }}>{filteredNodes.filter(n => n.online).length} online</span> &nbsp;•&nbsp;
        <span style={{ color: '#ef4444' }}>{filteredNodes.filter(n => !n.online).length} offline</span>
      </div>

      {/* ── Node Cards Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {filteredNodes.map(node => {
          const tags = getNodeTags(node);
          const owner = getNodeOwner(node);
          return (
            <div key={node.id}
              onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
              style={{
                backgroundColor: '#1f2937',
                border: `1px solid ${expandedNode === node.id ? '#6366f1' : node.online ? '#1e3a5f' : '#374151'}`,
                borderRadius: '0.625rem',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}>
              {/* Card Header */}
              <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid #374151' }}>
                {/* Row 1: status + name + ID */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{node.online ? '🟢' : '🔴'}</span>
                    <span style={{ color: '#f3f4f6', fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>
                      {node.name}
                    </span>
                  </div>
                  <span style={{ color: '#6b7280', fontSize: '0.68rem', flexShrink: 0, marginLeft: '0.5rem' }}>#{node.id}</span>
                </div>
                {/* Row 2: IPv4 */}
                <div style={{ color: '#60a5fa', fontSize: '0.72rem', fontFamily: 'monospace', marginBottom: '0.15rem' }}>
                  {node.ipAddresses?.[0] || 'No IP'}
                </div>
                {/* Row 3: IPv6 */}
                {node.ipAddresses?.[1] && (
                  <div style={{ color: '#4b5563', fontSize: '0.68rem', fontFamily: 'monospace', marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.ipAddresses[1]}
                  </div>
                )}
                {/* Row 4: owner + duration */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                  <div style={{ color: '#8b5cf6', fontSize: '0.72rem', fontWeight: '600' }}>
                    {tags.length > 0 ? '🏷 ' : '👤 '}{owner}
                  </div>
                  {getNodeDuration(node) && (
                    <div style={{ fontSize: '0.65rem', fontWeight: '600', color: node.online ? '#10b981' : '#6b7280', whiteSpace: 'nowrap', marginLeft: '0.25rem' }}>
                      {node.online ? '⬆' : '⬇'} {getNodeDuration(node)}
                    </div>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                    {tags.map(t => (
                      <span key={t} style={{ backgroundColor: '#1e3a5f', color: '#60a5fa', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: '600' }}>
                        {t.replace('tag:', '')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Routes badge */}
                {(node.availableRoutes?.length || 0) > 0 && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <span style={{ backgroundColor: node.approvedRoutes?.length ? '#064e3b' : '#374151', color: node.approvedRoutes?.length ? '#34d399' : '#9ca3af', padding: '0.1rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: '600' }}>
                      🛣 {node.approvedRoutes?.length || 0}/{node.availableRoutes?.length} routes
                    </span>
                  </div>
                )}
              </div>

              {/* Tap hint — only shown when collapsed */}
              {expandedNode !== node.id && (
                <div style={{ padding: '0.2rem', textAlign: 'center', color: '#4b5563', fontSize: '0.62rem', letterSpacing: '0.03em', backgroundColor: '#111827' }}>
                  tap to manage
                </div>
              )}

              {/* Card Actions — only shown when card is selected */}
              {expandedNode === node.id && (
              <div onClick={e => e.stopPropagation()} style={{ padding: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem', backgroundColor: '#111827', borderTop: '1px solid #374151' }}>
                <button className="btn btn-sm btn-primary"
                  onClick={() => { setEditModal(node); setEditName(node.name); setEditUser(node.user?.name || ''); }}
                  style={{ fontSize: '0.72rem', padding: '0.4rem 0', textAlign: 'center' }}>
                  ✏️ Edit
                </button>
                <button className="btn btn-sm btn-secondary"
                  onClick={() => { setTagModal(node); setTagInput(''); }}
                  style={{ fontSize: '0.72rem', padding: '0.4rem 0', textAlign: 'center' }}>
                  🏷 Tags
                </button>
                <button className="btn btn-sm btn-secondary"
                  onClick={() => setSshModal(node)}
                  style={{ fontSize: '0.72rem', padding: '0.4rem 0', textAlign: 'center' }}>
                  🔗 SSH
                </button>
                <button className="btn btn-sm btn-info"
                  onClick={() => setRoutesModal(node)}
                  disabled={!node.availableRoutes?.length}
                  style={{ fontSize: '0.72rem', padding: '0.4rem 0', textAlign: 'center', opacity: !node.availableRoutes?.length ? 0.3 : 1 }}>
                  🛣 Routes
                </button>
                <button className="btn btn-sm btn-error"
                  onClick={() => handleExpire(node)}
                  style={{ fontSize: '0.72rem', padding: '0.4rem 0', textAlign: 'center' }}>
                  ⏱ Expire
                </button>
                <button className="btn btn-sm btn-error"
                  onClick={() => handleDelete(node)}
                  style={{ fontSize: '0.72rem', padding: '0.4rem 0', textAlign: 'center' }}>
                  🗑 Delete
                </button>
              </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredNodes.length === 0 && !loading && (
        <div className="no-results">No nodes match your filters</div>
      )}

      {/* ── Edit Modal ── */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.75rem', padding: '1.5rem', width: '100%', maxWidth: '440px', color: '#d1d5db' }}>
            <h2 style={{ margin: '0 0 1.25rem', color: '#f3f4f6', fontSize: '1.05rem' }}>✏️ Edit — {editModal.name}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Node Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value.toLowerCase())}
                pattern="[a-z0-9][a-z0-9-]*" maxLength={63}
                style={{ width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: '#6b7280' }}>Lowercase letters, digits, and hyphens only (max 63 chars).</div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Move to User</label>
              <select value={editUser} onChange={e => setEditUser(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.875rem' }}>
                <option value="">— Keep current owner —</option>
                {users.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              {editUser && editUser !== editModal.user?.name && (
                <div style={{ marginTop: '0.4rem', padding: '0.5rem 0.75rem', backgroundColor: '#7f1d1d', borderRadius: '0.375rem', color: '#fecaca', fontSize: '0.75rem' }}>
                  ⚠️ Changing owner will delete and re-register this node
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setEditModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSaveEdit} className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move Key Modal ── */}
      {moveKeyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#111827', border: '2px solid #10b981', borderRadius: '0.75rem', padding: '2rem', maxWidth: '560px', width: '100%', color: '#d1d5db' }}>
            <h2 style={{ margin: '0 0 0.5rem', color: '#f3f4f6', fontSize: '1.1rem' }}>✅ Node moved to {moveKeyModal.user}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#9ca3af' }}>Run this on the device to reconnect:</p>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#86efac', wordBreak: 'break-all', marginBottom: '1rem' }}>
              tailscale login --auth-key {moveKeyModal.key}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => navigator.clipboard.writeText(`tailscale login --auth-key ${moveKeyModal.key}`)} className="btn btn-primary" style={{ flex: 1 }}>📋 Copy Command</button>
              <button onClick={() => navigator.clipboard.writeText(moveKeyModal.key)} className="btn btn-secondary" style={{ flex: 1 }}>🔑 Copy Key</button>
              <button onClick={() => setMoveKeyModal(null)} className="btn btn-success" style={{ flex: 1 }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Routes Modal ── */}
      {routesModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1.5rem', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto', color: '#d1d5db' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>🛣 Routes: {routesModal.name}</h2>
            {!routesModal.availableRoutes?.length ? <p style={{ color: '#9ca3af' }}>No routes</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {routesModal.availableRoutes.map(route => {
                  const approved = routesModal.approvedRoutes?.includes(route);
                  return (
                    <div key={route} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', backgroundColor: '#1f2937', borderRadius: '0.375rem', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#f3f4f6' }}>{route}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ color: approved ? '#10b981' : '#9ca3af', fontSize: '0.75rem' }}>{approved ? '✓ Active' : '○ Pending'}</span>
                        {approved
                          ? <button className="btn btn-sm btn-error" onClick={() => handleDisapproveRoute(route)} style={{ fontSize: '0.72rem' }}>Disable</button>
                          : <button className="btn btn-sm btn-success" onClick={() => handleApproveRoute(route)} style={{ fontSize: '0.72rem' }}>Enable</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="btn btn-secondary" onClick={() => setRoutesModal(null)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Tag Modal ── */}
      {tagModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '520px', width: '100%', color: '#d1d5db' }}>
            <h2 style={{ margin: '0 0 0.25rem', color: '#f3f4f6', fontSize: '1.05rem' }}>🏷 Tags — {tagModal.name}</h2>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '1rem' }}>
              👤 Owner: <span style={{ color: '#10b981', fontWeight: 600 }}>{getNodeOwner(tagModal)}</span>
            </div>

            {/* Ownership-transfer warning — shown only when actually adding tags */}
            {(getNodeTags(tagModal).length > 0 || (availableTags.length > 0 && tagModal !== null)) && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.6rem 0.75rem',
                backgroundColor: '#451a03',
                border: '1px solid #92400e',
                borderRadius: '0.4rem',
                color: '#fde68a',
                fontSize: '0.72rem',
                lineHeight: 1.4,
              }}>
                <strong>⚠ Tags transfer node ownership.</strong> A tagged node is owned by Headscale's
                <code style={{ margin: '0 0.25rem', color: '#fcd34d' }}>tagged-devices</code>
                user. Domain-based filtering still works because the original owner is preserved separately.
              </div>
            )}

            {/* Current tags */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>Current Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', minHeight: '2rem' }}>
                {getNodeTags(tagModal).length === 0
                  ? <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>No tags</span>
                  : getNodeTags(tagModal).map(tag => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#1e3a5f', color: '#60a5fa', padding: '0.25rem 0.6rem', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600 }}>
                      {tag}
                      <button onClick={() => setTagModal({ ...tagModal, forcedTags: getNodeTags(tagModal).filter(t => t !== tag), validTags: [] })}
                        style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, padding: 0 }}>✕</button>
                    </span>
                  ))
                }
              </div>
            </div>

            {/* Available tags from ACL — dropdown-grid with permission checks */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>Available Tags (from ACL Policy)</div>
              {availableTags.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#6b7280', padding: '0.5rem 0' }}>
                  No tags defined in <code>tagOwners</code>. Edit the ACL Policy to define tags first.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {availableTags.map(tag => {
                    const active = getNodeTags(tagModal).includes(tag);
                    const allowed = canOwnerAssertTag(tagModal, tag);
                    const owners = (tagOwnerGroups[tag] || []).join(', ');
                    const tooltip = allowed
                      ? `Owned by ${owners || '(none)'}`
                      : `Cannot apply: this node's owner is not in any of the tag's owner groups (${owners || 'none'})`;
                    const onClick = () => {
                      if (!allowed && !active) return; // Block adding disallowed tags; allow removing already-applied ones
                      if (active) {
                        setTagModal({ ...tagModal, forcedTags: getNodeTags(tagModal).filter(t => t !== tag), validTags: [] });
                      } else {
                        setTagModal({ ...tagModal, forcedTags: [...getNodeTags(tagModal), tag], validTags: [] });
                      }
                    };
                    return (
                      <button
                        key={tag}
                        onClick={onClick}
                        title={tooltip}
                        disabled={!allowed && !active}
                        style={{
                          padding: '0.25rem 0.6rem',
                          backgroundColor: active ? '#1e3a5f' : (allowed ? '#1f2937' : '#171717'),
                          color: active ? '#60a5fa' : (allowed ? '#d1d5db' : '#4b5563'),
                          border: `1px solid ${active ? '#3b82f6' : (allowed ? '#374151' : '#262626')}`,
                          borderRadius: '0.3rem',
                          fontSize: '0.78rem',
                          cursor: (allowed || active) ? 'pointer' : 'not-allowed',
                          fontWeight: active ? 600 : 400,
                          opacity: (allowed || active) ? 1 : 0.55,
                        }}>
                        {active ? '✓ ' : (allowed ? '+ ' : '🔒 ')}{tag}
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: '#6b7280' }}>
                🔒 = locked because the node's owner isn't in this tag's owner group.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setTagModal(null); setTagInput(''); }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleSaveTags(tagModal, getNodeTags(tagModal))} className="btn btn-primary" style={{ flex: 1 }} disabled={tagSaving}>
                {tagSaving ? 'Saving...' : '✓ Apply Tags'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SSH Modal ── */}
      {sshModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '520px', width: '100%', color: '#d1d5db' }}>
            <h2 style={{ margin: '0 0 0.25rem', color: '#f3f4f6', fontSize: '1.05rem' }}>🔗 Connect — {sshModal.name}</h2>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              👤 {getNodeOwner(sshModal)} &nbsp;•&nbsp; {sshModal.ipAddresses?.[0] || 'No IP'}
            </div>
            {[
              { label: 'Tailscale SSH', cmd: `tailscale ssh ${sshModal.ipAddresses?.[0] || sshModal.name}` },
              { label: 'SSH via IP', cmd: `ssh ${sshModal.ipAddresses?.[0] || sshModal.name}` },
              { label: 'SSH via hostname', cmd: `ssh ${sshModal.name}` },
              { label: 'Check status', cmd: `tailscale status | grep ${sshModal.name}` },
            ].map(({ label, cmd }) => (
              <div key={label} style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600' }}>{label}</span>
                  <button onClick={() => navigator.clipboard.writeText(cmd)}
                    style={{ padding: '0.2rem 0.5rem', backgroundColor: '#374151', color: '#9ca3af', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.7rem' }}>📋 Copy</button>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#86efac', wordBreak: 'break-all' }}>{cmd}</div>
              </div>
            ))}
            <button onClick={() => setSshModal(null)} className="btn btn-secondary" style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {deployModal && <DeployModal onClose={() => setDeployModal(false)} visibleUsers={userObjects} />}
    </div>
  );
};
