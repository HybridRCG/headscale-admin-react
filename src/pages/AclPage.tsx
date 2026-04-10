import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/AclEditorPage.css';

const API_BASE = process.env.REACT_APP_API_URL || '/admin/api';

interface ACL {
  groups: { [key: string]: string[] };
  tagOwners: { [key: string]: string[] };
  hosts: { [key: string]: string };
  acls: Array<{
    '#ha-meta'?: { name: string; open: boolean };
    action: string;
    src: string[];
    dst: string[];
    proto?: string;
  }>;
  ssh: Array<{
    '#ha-meta'?: { name: string; open: boolean };
    action: string;
    src: string[];
    dst: string[];
  }>;
}

export const AclPage: React.FC = () => {
  const [acl, setAcl] = useState<ACL | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');

  const tabs = [
    { name: 'Groups', icon: '👥' },
    { name: 'Tag Owners', icon: '🏷️' },
    { name: 'Hosts', icon: '🖥️' },
    { name: 'Policies', icon: '🔒' },
    { name: 'SSH', icon: '🔐' },
    { name: 'Config', icon: '⚙️' }
  ];

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
      setError(err instanceof Error ? err.message : 'Failed to load ACL');
    } finally {
      setLoading(false);
    }
  };

  const saveAcl = async () => {
    if (!acl) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/headscale/acl`, acl);
      setError('');
      alert('ACL saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ACL');
    } finally {
      setLoading(false);
    }
  };

  if (!acl) return <div className="acl-container">Loading...</div>;

  return (
    <div className="acl-container">
      <div className="acl-header">
        <h1>ACL Editor</h1>
        <button onClick={saveAcl} disabled={loading} className="btn-save">
          💾 Save ACL
        </button>
      </div>

      <div className="acl-tabs">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`tab ${activeTab === idx ? 'active' : ''}`}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="acl-content">
        {activeTab === 0 && <GroupsTab acl={acl} setAcl={setAcl} />}
        {activeTab === 1 && <TagOwnersTab acl={acl} setAcl={setAcl} />}
        {activeTab === 2 && <HostsTab acl={acl} setAcl={setAcl} />}
        {activeTab === 3 && <PoliciesTab acl={acl} setAcl={setAcl} />}
        {activeTab === 4 && <SshTab acl={acl} setAcl={setAcl} />}
        {activeTab === 5 && <ConfigTab acl={acl} setAcl={setAcl} />}
      </div>
    </div>
  );
};

// Placeholder components
const GroupsTab: React.FC<{ acl: ACL; setAcl: (acl: ACL) => void }> = ({ acl, setAcl }) => (
  <div className="tab-content">
    <h2>Groups</h2>
    <pre>{JSON.stringify(acl.groups, null, 2)}</pre>
  </div>
);

const TagOwnersTab: React.FC<{ acl: ACL; setAcl: (acl: ACL) => void }> = ({ acl, setAcl }) => (
  <div className="tab-content">
    <h2>Tag Owners</h2>
    <pre>{JSON.stringify(acl.tagOwners, null, 2)}</pre>
  </div>
);

const HostsTab: React.FC<{ acl: ACL; setAcl: (acl: ACL) => void }> = ({ acl, setAcl }) => (
  <div className="tab-content">
    <h2>Hosts</h2>
    <pre>{JSON.stringify(acl.hosts, null, 2)}</pre>
  </div>
);

const PoliciesTab: React.FC<{ acl: ACL; setAcl: (acl: ACL) => void }> = ({ acl, setAcl }) => (
  <div className="tab-content">
    <h2>Policies</h2>
    <pre>{JSON.stringify(acl.acls, null, 2)}</pre>
  </div>
);

const SshTab: React.FC<{ acl: ACL; setAcl: (acl: ACL) => void }> = ({ acl, setAcl }) => (
  <div className="tab-content">
    <h2>SSH Rules</h2>
    <pre>{JSON.stringify(acl.ssh, null, 2)}</pre>
  </div>
);

const ConfigTab: React.FC<{ acl: ACL; setAcl: (acl: ACL) => void }> = ({ acl, setAcl }) => (
  <div className="tab-content">
    <h2>Config</h2>
    <p>Raw JSON Editor</p>
    <textarea rows={20} defaultValue={JSON.stringify(acl, null, 2)} />
  </div>
);

