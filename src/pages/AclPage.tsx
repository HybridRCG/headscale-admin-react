import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Pages.css';

interface ACLPolicy {
  groups?: Record<string, string[]>;
  tagOwners?: Record<string, string[]>;
  hosts?: Record<string, string>;
  acls?: any[];
  ssh?: any[];
}

export const AclPage: React.FC = () => {
  const [aclContent, setAclContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchACL();
  }, []);

  const fetchACL = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3000/api/headscale/api/v1/policy');
      const policy = response.data;
      setAclContent(JSON.stringify(policy, null, 2));
    } catch (error) {
      console.error('Failed to fetch ACL:', error);
      setAclContent('Failed to load ACL policy');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // TODO: Implement ACL save via headscale-config-api
      alert('ACL save not yet implemented');
      setEditing(false);
    } catch (error) {
      console.error('Failed to save ACL:', error);
    }
  };

  const handleRefresh = () => {
    fetchACL();
  };

  return (
    <div className="page-container">
      <h1 className="page-title">ACL Editor</h1>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={handleRefresh} disabled={loading}>
          Refresh
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (editing) {
              handleSave();
            } else {
              setEditing(true);
            }
          }}
          disabled={loading}
        >
          {editing ? 'Save' : 'Edit'}
        </button>
        {editing && (
          <button className="btn btn-primary" onClick={() => setEditing(false)} style={{ backgroundColor: '#ef4444' }}>
            Cancel
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading ACL policy...</div>
      ) : (
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '0.375rem',
          padding: '1rem',
          maxHeight: '600px',
          overflowY: 'auto',
        }}>
          {editing ? (
            <textarea
              value={aclContent}
              onChange={(e) => setAclContent(e.target.value)}
              style={{
                width: '100%',
                height: '500px',
                padding: '1rem',
                backgroundColor: '#111827',
                color: '#f3f4f6',
                border: '1px solid #374151',
                borderRadius: '0.375rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            />
          ) : (
            <pre style={{
              margin: 0,
              color: '#f3f4f6',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {aclContent}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
