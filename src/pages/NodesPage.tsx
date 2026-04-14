import { useAuthStore } from '../store/authStore';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Pages.css';

interface Node {
  id: number;
  name: string;
  hostname: string;
  user?: { name: string };
  ipAddresses?: string[];
  online?: boolean;
  approvedRoutes?: string[];
  availableRoutes?: string[];
}

export const NodesPage: React.FC = () => {
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<Node[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [groupUsers, setGroupUsers] = useState<Record<string, string[]>>({});
  const [userEmailMap, setUserEmailMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { user: authUser } = useAuthStore();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const shouldFilter = authUser?.role !== 'super_admin' && !manageableDomains.includes('*');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [editingNode, setEditingNode] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editUser, setEditUser] = useState('');
  const [routesModal, setRoutesModal] = useState<number | null>(null);
  const [modalNode, setModalNode] = useState<Node | null>(null);
  const [deployModal, setDeployModal] = useState(false);
  const [deployHostname, setDeployHostname] = useState('');
  const [deployTags, setDeployTags] = useState('tag:server');
  const [deployCommand, setDeployCommand] = useState('');
  const API_BASE = '/admin/api';

  useEffect(() => {
    fetchNodes();
    fetchUsers();
    fetchGroups();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allNodes, searchTerm, filterStatus, selectedUser, selectedGroup, groupUsers, userEmailMap]);

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/headscale/api/v1/node`);
      setAllNodes(response.data.nodes || []);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE}/headscale/api/v1/user`);
      const userList = response.data.users?.map((u: any) => u.name) || [];
      setUsers(userList);
      
      // Fetch user-email mapping from new endpoint
      const mappingResponse = await axios.get(`${API_BASE}/headscale/user-mapping`);
      console.log('User email map from API:', mappingResponse.data);
      setUserEmailMap(mappingResponse.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API_BASE}/headscale/api/v1/policy`);
      let policyData = response.data;
      console.log('Raw policy response:', policyData);
      if (typeof policyData.policy === 'string') {
        policyData = JSON.parse(policyData.policy);
        console.log('Parsed policy:', policyData);
      }
      const groupsObj = policyData.groups || {};
      console.log('Groups object:', groupsObj);
      const groupList: string[] = [];
      const userMap: Record<string, string[]> = {};

      Object.entries(groupsObj).forEach(([key, users]: [string, any]) => {
        const groupName = key.replace('group:', '');
        groupList.push(groupName);
        userMap[groupName] = users;
      });

      console.log('Groups fetched:', groupList, 'Users map:', userMap);
      setGroups(groupList.sort());
      setGroupUsers(userMap);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const applyFilters = () => {
    let filtered = allNodes.filter(node => {
      // Domain filter
      if (shouldFilter) {
        const nodeEmail = node.user?.name ? userEmailMap[node.user.name] : undefined;
        if (!nodeEmail || !manageableDomains.some((d: string) => nodeEmail.endsWith(d.replace('@','')))) return false;
      }

      const searchMatch = node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.hostname?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const userMatch = selectedUser === 'all' || node.user?.name === selectedUser;
      
      let groupMatch = selectedGroup === 'all';
      if (selectedGroup !== 'all') {
        const groupUsersForGroup = groupUsers[selectedGroup];
        const nodeUser = node.user?.name;
        console.log(`Checking ${node.name}: user=${nodeUser || 'N/A'}, group=${selectedGroup}, groupUsers=${JSON.stringify(groupUsersForGroup)}, match=${nodeUser ? (groupUsersForGroup?.includes(nodeUser) || false) : false}`);
      }
      if (selectedGroup !== 'all' && node.user?.name) {
        const nodeUserEmail = userEmailMap[node.user.name];
        const groupUsersForGroup = groupUsers[selectedGroup] || [];
        groupMatch = nodeUserEmail ? groupUsersForGroup.includes(nodeUserEmail) : false;
      }
      
      const statusMatch = filterStatus === 'all' ||
                         (filterStatus === 'online' && node.online) ||
                         (filterStatus === 'offline' && !node.online);

      return searchMatch && userMatch && groupMatch && statusMatch;
    });

    setFilteredNodes(filtered);
  };

  const handleRename = async (nodeId: number) => {
    if (!editName.trim()) return;
    try {
      await axios.post(`${API_BASE}/headscale/node/rename`, { nodeId, newName: editName });
      setEditingNode(null);
      setEditName('');
      await fetchNodes();
    } catch (err) {
      alert('Failed to rename node');
    }
  };

  const handleMoveUser = async (nodeId: number) => {
    if (!editUser.trim()) return;
    try {
      await axios.post(`${API_BASE}/headscale/node/move-user`, { nodeId, newUser: editUser });
      setEditingNode(null);
      setEditUser('');
      await fetchNodes();
    } catch (err) {
      alert('Failed to move node');
    }
  };

  const handleDelete = async (nodeId: number) => {
    if (!window.confirm('Delete this node?')) return;
    try {
      await axios.post(`${API_BASE}/headscale/node/delete`, { nodeId });
      await fetchNodes();
    } catch (err) {
      alert('Failed to delete node');
    }
  };

  const handleExpire = async (nodeId: number) => {
    if (!window.confirm('Expire this node?')) return;
    try {
      await axios.post(`${API_BASE}/headscale/node/expire`, { nodeId });
      await fetchNodes();
    } catch (err) {
      alert('Failed to expire node');
    }
  };

  const handleApproveRoute = async (route: string) => {
    if (!modalNode) return;
    try {
      const response = await axios.post(`${API_BASE}/headscale/approve-route`, { nodeId: modalNode.id, route });
      if (response.data.node) setModalNode(response.data.node);
      await fetchNodes();
    } catch (err) {
      alert('Failed to approve route');
    }
  };

  const handleDisapproveRoute = async (route: string) => {
    if (!modalNode) return;
    try {
      const response = await axios.post(`${API_BASE}/headscale/disapprove-route`, { nodeId: modalNode.id, route });
      if (response.data.node) setModalNode(response.data.node);
      await fetchNodes();
    } catch (err) {
      alert('Failed to disapprove route');
    }
  };

  const generateDeployCommand = () => {
    let cmd = `tailscale up --login-server=https://hs.groblers.co.uk`;
    if (deployTags) cmd += ` --advertise-tags=${deployTags}`;
    if (deployHostname) cmd += ` --hostname=${deployHostname}`;
    cmd += ` --advertise-routes=10.1.1.0/24 --accept-dns --accept-routes`;
    setDeployCommand(cmd);
  };

  const copyDeployCommand = () => {
    navigator.clipboard.writeText(deployCommand);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return <div className="page-container"><h1 className="page-title">Nodes</h1><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Nodes ({filteredNodes.length}/{allNodes.length})</h1>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6' }}
        />

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('all')}>All</button>
          <button className={`btn ${filterStatus === 'online' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('online')}>Online</button>
          <button className={`btn ${filterStatus === 'offline' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('offline')}>Offline</button>
          
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={{ padding: '0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6' }}>
            <option value="all">All Users</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ padding: '0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6' }}>
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-success" onClick={() => { setDeployModal(true); setDeployCommand(''); }}>+ Deploy</button>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#d1d5db', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #374151' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Hostname</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>User</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>IPs</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.map(node => (
              <tr key={node.id} style={{ borderBottom: '1px solid #374151' }}>
                <td style={{ padding: '0.75rem' }}>
                  {editingNode === node.id ? <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', width: '100%', padding: '0.5rem' }} /> : <span>{node.name}</span>}
                </td>
                <td style={{ padding: '0.75rem' }}>{node.hostname}</td>
                <td style={{ padding: '0.75rem' }}>
                  {editingNode === node.id ? (
                    <select value={editUser} onChange={(e) => setEditUser(e.target.value)} style={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', width: '100%', padding: '0.5rem' }}>
                      <option value="">Select...</option>
                      {users.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : <span>{node.user?.name || 'N/A'}</span>}
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{node.ipAddresses?.join(', ') || 'N/A'}</td>
                <td style={{ padding: '0.75rem' }}><span style={{ color: node.online ? '#86efac' : '#fca5a5' }}>{node.online ? '🟢' : '🔴'}</span></td>
                <td style={{ padding: '0.75rem' }}>
                  {editingNode === node.id ? (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => { handleRename(node.id); if (editUser) handleMoveUser(node.id); }}>Save</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingNode(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-warning" onClick={() => { setEditingNode(node.id); setEditName(node.name); setEditUser(node.user?.name || ''); }}>Edit</button>
                      <button className="btn btn-sm btn-info" onClick={() => { setRoutesModal(node.id); setModalNode(node); }}>Routes</button>
                      <button className="btn btn-sm btn-error" onClick={() => handleDelete(node.id)}>Delete</button>
                      <button className="btn btn-sm btn-error" onClick={() => handleExpire(node.id)}>Expire</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {routesModal && modalNode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', color: '#d1d5db' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Routes: {modalNode.name}</h2>
            
            {!modalNode.availableRoutes || modalNode.availableRoutes.length === 0 ? (
              <p>No routes available</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #374151' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Route</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {modalNode.availableRoutes.map(route => {
                    const isApproved = modalNode.approvedRoutes?.includes(route);
                    return (
                      <tr key={route} style={{ borderBottom: '1px solid #374151' }}>
                        <td style={{ padding: '0.5rem' }}>{route}</td>
                        <td style={{ padding: '0.5rem', color: isApproved ? '#86efac' : '#fca5a5' }}>{isApproved ? '✓ Approved' : '✗ Pending'}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {isApproved ? (
                            <button className="btn btn-sm btn-error" onClick={() => handleDisapproveRoute(route)}>Disapprove</button>
                          ) : (
                            <button className="btn btn-sm btn-primary" onClick={() => handleApproveRoute(route)}>Approve</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <button className="btn btn-secondary" onClick={() => { setRoutesModal(null); setModalNode(null); }}>Close</button>
          </div>
        </div>
      )}

      {deployModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', padding: '2rem', maxWidth: '700px', width: '90%', color: '#d1d5db' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Deploy New Node</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d1d5db' }}>Hostname:</label>
              <input
                type="text"
                value={deployHostname}
                onChange={(e) => setDeployHostname(e.target.value)}
                placeholder="node-name"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d1d5db' }}>Tags (comma-separated):</label>
              <input
                type="text"
                value={deployTags}
                onChange={(e) => setDeployTags(e.target.value)}
                placeholder="tag:server,tag:production"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', boxSizing: 'border-box' }}
              />
            </div>

            <button className="btn btn-primary" onClick={generateDeployCommand} style={{ marginBottom: '1rem' }}>Generate Command</button>

            {deployCommand && (
              <div style={{ marginTop: '1.5rem', backgroundColor: '#0f1419', border: '1px solid #374151', borderRadius: '0.375rem', padding: '1rem' }}>
                <p style={{ color: '#d1d5db', marginBottom: '0.5rem' }}>Copy and run on the new node:</p>
                <div style={{ backgroundColor: '#111827', padding: '1rem', borderRadius: '0.375rem', overflow: 'auto', marginBottom: '1rem', maxHeight: '150px' }}>
                  <code style={{ color: '#10b981', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{deployCommand}</code>
                </div>
                <button className="btn btn-primary" onClick={copyDeployCommand}>📋 Copy to Clipboard</button>
              </div>
            )}

            <button className="btn btn-secondary" onClick={() => setDeployModal(false)} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        </div>
      )}

      <button className="btn btn-secondary" onClick={fetchNodes} style={{ marginTop: '1rem' }}>🔄 Refresh</button>
    </div>
  );
};
